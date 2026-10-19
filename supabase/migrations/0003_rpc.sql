-- Funciones de negocio (security definer, validan rol y propiedad)

-- ---------- utilidades ----------
create or replace function private.audit(k text, acc text, nota text default '') returns void language sql security definer set search_path='' as
$$ insert into public.audit_log(key,data,actor) values(k, jsonb_build_object('t',(extract(epoch from now())*1000)::bigint,'key',k,'acc',acc,'mot','','nota',coalesce(nota,'')), (select auth.uid())) $$;
create or replace function private.now_ms() returns bigint language sql stable set search_path='' as $$ select (extract(epoch from now())*1000)::bigint $$;


-- ---------- directivo asigna rol (dueño / cliente) ----------
create or replace function public.set_role(target_email text, new_role text) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.profiles;
begin
  if not private.is_dir() then raise exception 'Solo el directivo puede cambiar roles'; end if;
  if new_role not in ('dueno','cliente') then raise exception 'Rol no permitido'; end if;
  select * into r from public.profiles where email=lower(trim(target_email)) and id<>auth.uid();
  if r.id is null then raise exception 'No existe una cuenta con ese correo (debe registrarse primero)'; end if;
  if r.role='directivo' then raise exception 'No se puede cambiar al directivo'; end if;
  update public.profiles set role=new_role, store_id=null, tablet_code_id=null, verified=false where id=r.id;
  perform private.audit('due:'||coalesce(nullif(r.nombre,''),r.email), case when new_role='dueno' then 'Promovido a dueño' else 'Quitado como dueño' end, r.email);
  return jsonb_build_object('email',r.email,'role',new_role);
end $$;

-- ---------- repartidor: registro ----------
create or replace function public.rep_register(p_nombre text, p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := auth.uid(); me public.profiles; n text := trim(p_nombre); old jsonb;
begin
  select * into me from public.profiles where id=u;
  if me.id is null or coalesce((select is_anonymous from auth.users where id=u),true) then raise exception 'Inicia sesión con correo y contraseña'; end if;
  if me.role not in ('cliente','repartidor') then raise exception 'Esta cuenta ya tiene otro rol'; end if;
  if length(n)<3 or length(n)>80 then raise exception 'Nombre no válido'; end if;
  if exists(select 1 from public.profiles where lower(nombre)=lower(n) and role='repartidor' and id<>u)
     or exists(select 1 from public.repartidor_registrations where lower(nombre)=lower(n) and user_id<>u) then
    raise exception 'Ya hay un repartidor con ese nombre; agrega tu apellido'; end if;
  select data into old from public.repartidor_registrations where user_id=u;
  delete from public.repartidor_registrations where user_id=u and nombre<>n;
  insert into public.repartidor_registrations(nombre,user_id,data) values(n,u,
    (p_data - 'rev') || jsonb_build_object('nombre',n,'st', case when old->>'st'='aprobado' and me.nombre=n then 'aprobado' else 'pendiente' end))
  on conflict (nombre) do update set data=excluded.data, updated_at=now();
  update public.profiles set role='repartidor', nombre=n,
    verified = (verified and me.nombre=n) where id=u;
  return jsonb_build_object('ok',true);
end $$;

-- ---------- tablets de tienda ----------
create or replace function public.gen_tablet_code(p_store bigint) returns text language plpgsql security definer set search_path='' as $$
declare c text; s public.stores;
begin
  if not private.is_admin() then raise exception 'Solo dueño o directivo'; end if;
  select * into s from public.stores where id=p_store; if s.id is null then raise exception 'Tienda no existe'; end if;
  c := lpad(((('x'||encode(extensions.gen_random_bytes(4),'hex'))::bit(32)::bigint) % 1000000)::text, 6, '0');
  update public.tablet_codes set act=false where store_id=p_store;
  insert into public.tablet_codes(store_id,code_hash,created_by,por) values(p_store, extensions.crypt(c, extensions.gen_salt('bf',8)), auth.uid(),
    case when private.is_dir() then 'Directivo' else 'Dueño' end);
  perform private.audit('tienda:'||s.n,'Código de tablet generado');
  return c;
end $$;
create or replace function public.tablet_off(p_store bigint) returns void language plpgsql security definer set search_path='' as $$
begin
  if not private.is_admin() then raise exception 'Solo dueño o directivo'; end if;
  update public.tablet_codes set act=false where store_id=p_store;
  perform private.audit('tienda:'||(select n from public.stores where id=p_store),'Código de tablet desactivado');
end $$;
create or replace function public.redeem_tablet_code(p_store bigint, p_code text) returns boolean language plpgsql security definer set search_path='' as $$
declare t public.tablet_codes; me public.profiles;
begin
  select * into me from public.profiles where id=auth.uid();
  if me.id is null then raise exception 'Sin sesión'; end if;
  if me.role not in ('cliente','tienda') then raise exception 'Esta cuenta no puede usarse como tablet'; end if;
  select * into t from public.tablet_codes where store_id=p_store and act order by id desc limit 1 for update;
  if t.id is null then raise exception 'Código incorrecto'; end if;
  if t.locked_until is not null and t.locked_until>now() then raise exception 'Demasiados intentos. Espera un minuto'; end if;
  if p_code !~ '^\d{6}$' or extensions.crypt(p_code, t.code_hash) <> t.code_hash then
    update public.tablet_codes set fails=fails+1, locked_until=case when fails+1>=5 then now()+interval '1 minute' else null end,
      act = act and fails+1 < 30 where id=t.id;
    return false;
  end if;
  update public.tablet_codes set fails=0, locked_until=null, last_used=now() where id=t.id;
  update public.profiles set role='tienda', store_id=p_store, tablet_code_id=t.id, nombre=(select n from public.stores where id=p_store) where id=me.id;
  perform private.audit('tienda:'||(select n from public.stores where id=p_store),'Tablet: inicio de sesión');
  return true;
end $$;
create or replace function public.tablet_touch() returns void language sql security definer set search_path='' as
$$ update public.tablet_codes set last_used=now() where id=(select tablet_code_id from public.profiles where id=(select auth.uid()) and role='tienda') $$;

-- ---------- precio de venta a partir del precio de compra (igual que ventaPara de la app) ----------
create or replace function private.venta_para(old_p numeric, old_pc numeric, pc numeric) returns numeric language sql stable set search_path='' as $$
  select case when pc>0 then greatest(pc, round(pc*(1+ case when old_pc>0 and old_p>old_pc then old_p/old_pc-1
     else coalesce((select (value->>'mrgSug')::numeric from public.settings where key='dirCfg'),10)/100 end)*2)/2) else 0 end $$;

-- ---------- pedido en formato de la app, filtrado por rol ----------
create or replace function private.order_json(oid bigint, mode text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare o public.orders; pv public.order_private; items jsonb; chat jsonb; j jsonb; tot numeric;
begin
  select * into o from public.orders where id=oid; select * into pv from public.order_private where order_id=oid;
  select coalesce(jsonb_agg(
    jsonb_build_object('n',i.n,'pres',i.pres,'q',i.q,'pid',i.pid) || i.state
    || case when mode in ('admin','client') then jsonb_build_object('p',i.p) else '{}' end
    || case when mode in ('admin','tienda') then jsonb_build_object('pc',i.pc) else '{}' end
    || case when mode='tienda' then jsonb_build_object('p',i.pc) else '{}' end
    order by i.idx),'[]') into items from public.order_items i where i.order_id=oid;
  select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'srvId',m.id,'de',m.de,'who',m.who,'t',m.t,'txt',m.txt)
     || case when m.kind is not null then jsonb_build_object('kind',m.kind) else '{}' end
     || case when m.cli then jsonb_build_object('cli',true) else '{}' end || m.extra order by m.t),'[]') into chat
    from public.messages m where m.order_id=oid
     and (mode in ('admin','client') or (mode='rep' and not m.cli) or (mode='tienda' and (m.de='tienda' or m.kind='na')));
  select coalesce(sum(case when coalesce((i.state->>'quit')::boolean,false) then 0 else i.p*i.q end),0) into tot from public.order_items i where i.order_id=oid;
  j := jsonb_build_object('id',o.id,'cat',o.cat,'st',o.st,'rep',o.rep_name,'zona',o.zona,'pago',o.pago,
       'cobrado',case when o.cobrado then 1 else 0 end,'t',(extract(epoch from o.created_at)*1000)::bigint,'src',o.src,
       'chat',chat,'srv',1) || (o.wf - 'tok');
  if o.cancel then j := j || '{"cancel":1}'; end if;
  if o.pct is not null then j := j || jsonb_build_object('pct',o.pct); end if;
  j := j || jsonb_build_object('det', o.det || jsonb_build_object('storeId',o.store_id) ||
        case when o.det ? 'tienda' or o.store_id is not null then jsonb_build_object('items',items) else '{}' end ||
        jsonb_build_object('extraEst', case when mode in ('admin','client') then coalesce(pv.extra_est,0) else 0 end));
  if mode in ('admin','client') then
    j := j || jsonb_build_object('fee',o.fee,'nombre',pv.nombre,'tel',pv.tel,'dir',pv.dir,'senas',coalesce(pv.senas,''),'email',coalesce(pv.email,''),
      'pagaCon',coalesce(pv.paga_con,0)) || case when pv.tarj is not null then jsonb_build_object('tarj',pv.tarj) else '{}' end
      || case when pv.cobrado_monto is not null then jsonb_build_object('cobradoMonto',pv.cobrado_monto) else '{}' end;
  end if;
  if mode='admin' then
    j := j || case when pv.compra is not null then jsonb_build_object('compra',pv.compra) else '{}' end
           || case when pv.nota is not null then jsonb_build_object('nota',pv.nota) else '{}' end;
  elsif mode='client' then
    j := j || case when pv.compra is not null then jsonb_build_object('compra',(pv.compra - 'monto') || '{"monto":0}') else '{}' end;
  elsif mode='rep' then
    j := j || jsonb_build_object('fee',o.fee,'nombre',pv.nombre,'tel',pv.tel,'dir',pv.dir,'senas',coalesce(pv.senas,''),'pagaCon',0,
      'cobraTotal', case when o.pago='efectivo' then o.fee+tot+coalesce(pv.extra_est,0) else 0 end)
      || case when pv.cobrado_monto is not null then jsonb_build_object('cobradoMonto',pv.cobrado_monto) else '{}' end
      || case when pv.compra is not null then jsonb_build_object('compra',case when pv.compra->>'kind'='tienda' then (pv.compra - 'monto')||'{"monto":0}' else pv.compra end) else '{}' end
      || case when pv.nota is not null then jsonb_build_object('nota',jsonb_build_object('folio',pv.nota->'folio','t',pv.nota->'t','fin',pv.nota->'fin')) else '{}' end;
  elsif mode='repx' then -- repartidor aún no aprobado: sin datos del cliente
    j := j || jsonb_build_object('fee',o.fee,'nombre','','tel','','dir','','senas','','pagaCon',0,'cobraTotal',0);
  elsif mode='tienda' then
    j := j || jsonb_build_object('fee',0,'nombre',split_part(coalesce(pv.nombre,''),' ',1),'tel','','dir','','senas','','pagaCon',0)
      || case when pv.compra is not null then jsonb_build_object('compra',pv.compra) else '{}' end
      || case when pv.nota is not null then jsonb_build_object('nota',pv.nota) else '{}' end;
  end if;
  return j;
end $$;

create or replace function private.order_mode(o public.orders) returns text language plpgsql stable security definer set search_path='' as $$
begin
  if private.is_admin() then return 'admin'; end if;
  if o.client_id=auth.uid() then return 'client'; end if;
  if o.rep_id=auth.uid() then return 'rep'; end if;
  if o.store_id is not null and o.store_id=private.my_store() then return 'tienda'; end if;
  if o.rep_id is null and not o.cancel and o.st=0 and private.my_role()='repartidor' then
    return case when private.rep_ok() then 'rep' else 'repx' end; end if;
  return null;
end $$;

create or replace function public.get_orders(since_days int default 45) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r jsonb := '[]'; o public.orders; m text;
begin
  if auth.uid() is null then return r; end if;
  for o in select * from public.orders where created_at > now() - make_interval(days=>least(greatest(since_days,1),400)) order by id loop
    m := private.order_mode(o);
    if m is not null then r := r || jsonb_build_array(private.order_json(o.id, m)); end if;
  end loop;
  return r;
end $$;

-- seguimiento de invitado con token (por si se pierde la sesión anónima)
create or replace function public.get_guest_order(p_id bigint, p_token text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare h text;
begin
  select guest_token_hash into h from public.order_private where order_id=p_id;
  if h is null or h <> encode(extensions.digest(p_token,'sha256'),'hex') then return null; end if;
  return private.order_json(p_id,'client');
end $$;

-- ---------- crear pedido (cliente con cuenta o invitado con sesión anónima) ----------
create or replace function public.create_order(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := auth.uid(); me public.profiles; anon boolean; cat text := p->>'cat'; d jsonb := coalesce(p->'det','{}');
  sid bigint; s public.stores; it jsonb; pr public.products; pcv numeric; zon jsonb; fee numeric; zi int := coalesce((p->>'zona')::int,0);
  oid bigint; idx int := 0; tok text; v_tel text := regexp_replace(coalesce(p->>'tel',''),'\D','','g'); src text; em text; q int; n_items int := 0;
begin
  if u is null then raise exception 'Sin sesión'; end if;
  select * into me from public.profiles where id=u;
  select is_anonymous into anon from auth.users where id=u;
  if me.role<>'cliente' then raise exception 'Solo clientes pueden hacer pedidos'; end if;
  src := case when anon then 'invitado' else 'cuenta' end; em := case when anon then '' else me.email end;
  if cat not in ('abarrotes','farmacia','paquetes') then raise exception 'Categoría no válida'; end if;
  if length(v_tel)<>10 then raise exception 'Teléfono de 10 dígitos'; end if;
  if length(trim(coalesce(p->>'nombre','')))=0 or length(trim(coalesce(p->>'dir','')))=0 then raise exception 'Faltan nombre o dirección'; end if;
  if private.sanctioned(case when anon then 'inv:'||v_tel else 'cli:'||em end) or private.sanctioned('inv:'||v_tel) then raise exception 'Cuenta o teléfono bloqueado'; end if;
  if (select count(*) from public.orders where client_id=u and created_at>now()-interval '10 minutes')>=5
     or (select count(*) from public.order_private v join public.orders o on o.id=v.order_id where v.tel=v_tel and o.created_at>now()-interval '1 day')>=20 then
    raise exception 'Demasiados pedidos seguidos. Intenta más tarde'; end if;
  select value->'zonas'->zi into zon from public.settings where key='cfg';
  if zon is null then raise exception 'Zona no válida'; end if; fee := (zon->>'f')::numeric;
  if cat='paquetes' then
    if length(trim(coalesce(d->>'de','')))=0 or length(trim(coalesce(d->>'a','')))=0 then raise exception 'Completa los datos del paquete'; end if;
    d := jsonb_build_object('de',left(d->>'de',200),'a',left(d->>'a',200),'tam',left(coalesce(d->>'tam',''),80));
  else
    sid := (d->>'storeId')::bigint; select * into s from public.stores where id=sid and act;
    if s.id is null or s.cat<>cat then raise exception 'Tienda no disponible'; end if;
    if jsonb_array_length(coalesce(d->'items','[]'))=0 and length(trim(coalesce(d->>'extra','')))=0 then raise exception 'Agrega productos'; end if;
    if jsonb_array_length(coalesce(d->'items','[]'))>60 then raise exception 'Demasiados productos'; end if;
  end if;
  insert into public.orders(cat,store_id,client_id,src,zona,fee,pago,det,wf)
    values(cat,sid,u,src,zi,fee,case when p->>'pago'='tarjeta' then 'tarjeta' else 'efectivo' end,
      case when cat='paquetes' then d else jsonb_build_object('tienda',s.n,'notas',left(coalesce(d->>'notas',''),500),'extra',left(coalesce(d->>'extra',''),300),'receta',coalesce((d->>'receta')::boolean,false)) end,
      jsonb_build_object('ts',jsonb_build_object('0',private.now_ms()),'d',to_char(now() at time zone 'UTC','YYYY-MM-DD')))
    returning id into oid;
  if cat<>'paquetes' then
    for it in select * from jsonb_array_elements(coalesce(d->'items','[]')) loop
      select * into pr from public.products where id=(it->>'pid')::bigint and store_id=sid for update;
      q := (it->>'q')::int;
      if pr.id is null or not pr.disp or q is null or q<1 or q>99 then raise exception 'Producto no disponible: %', coalesce(it->>'n','?'); end if;
      if pr.stk is not null and q>pr.stk then raise exception 'Solo quedan % de %', pr.stk, pr.n; end if;
      if pr.stk is not null then update public.products set stk=stk-q, updated_at=now() where id=pr.id; end if;
      select pc into pcv from public.product_costs where product_id=pr.id;
      insert into public.order_items(order_id,idx,pid,n,pres,q,p,pc,state) values(oid,idx,pr.id,pr.n,pr.pres,q,pr.p,pcv,jsonb_build_object('rsv',case when pr.stk is not null then q else 0 end));
      idx := idx+1;
    end loop;
  end if;
  tok := encode(extensions.gen_random_bytes(16),'hex');
  insert into public.order_private(order_id,nombre,tel,dir,senas,email,paga_con,tarj,extra_est,guest_token_hash)
    values(oid,left(trim(p->>'nombre'),100),v_tel,left(trim(p->>'dir'),300),left(coalesce(p->>'senas',''),300),em,
      case when p->>'pago'='tarjeta' then 0 else least(greatest(coalesce((p->>'pagaCon')::numeric,0),0),100000) end,
      case when p ? 'tarj' then jsonb_build_object('marca',left(p->'tarj'->>'marca',20),'last4',right(regexp_replace(coalesce(p->'tarj'->>'last4',''),'\D','','g'),4)) end,
      least(greatest(coalesce((d->>'extraEst')::numeric,0),0),5000), encode(extensions.digest(tok,'sha256'),'hex'));
  insert into public.order_events(order_id,kind,st,by_role,by_id) values(oid,'creado',0,'cliente',u);
  return jsonb_build_object('id',oid,'token',tok,'order',private.order_json(oid,'client'));
end $$;

-- ---------- actualizar pedido: cada rol solo puede cambiar sus campos ----------
create or replace function public.sync_order(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.orders; m text; u uuid := auth.uid(); nm text := private.my_name(); v_wf jsonb; newst int; maxst int; it jsonb; i int;
  allowed text[]; k text; msg jsonb; rid uuid; v_de text; pv public.order_private; ist jsonb;
begin
  select * into o from public.orders where id=(p->>'id')::bigint for update;
  if o.id is null then raise exception 'Pedido no existe'; end if;
  m := private.order_mode(o);
  if m is null or m='repx' then raise exception 'Sin permiso sobre este pedido'; end if;
  select * into pv from public.order_private where order_id=o.id;
  maxst := case when o.cat='paquetes' then 3 else 4 end;
  v_wf := o.wf;
  -- campos de flujo (v_wf) permitidos por rol
  allowed := case m when 'admin' then array['ts','prep','recog','tacc','xtra','cancelT','leido','d']
    when 'client' then array['xtra','cancelT'] when 'rep' then array['ts','recog'] when 'tienda' then array['prep','tacc','ts'] end;
  foreach k in array allowed loop
    if p ? k then v_wf := jsonb_set(v_wf, array[k], p->k); end if;
  end loop;
  if p ? 'leido' and m<>'admin' then
    k := case m when 'client' then 'cli' when 'rep' then 'rep' when 'tienda' then 'tienda' end;
    v_wf := jsonb_set(v_wf, '{leido}', coalesce(v_wf->'leido','{}') || jsonb_build_object(k, p->'leido'->k));
  end if;
  -- asignación de repartidor
  if coalesce(p->>'rep','') <> o.rep_name then
    if m='admin' then
      select id into rid from public.profiles where role='repartidor' and lower(nombre)=lower(p->>'rep');
      if coalesce(p->>'rep','')<>'' and rid is null then raise exception 'Repartidor no encontrado'; end if;
      update public.orders set rep_id=rid, rep_name=coalesce(p->>'rep','') where id=o.id;
      insert into public.order_events(order_id,kind,st,by_role,by_id) values(o.id,'asignado',o.st,m,u);
    elsif m='rep' and o.rep_id is null and p->>'rep'=nm and private.rep_ok() and not o.cancel then
      update public.orders set rep_id=u, rep_name=nm where id=o.id;
      insert into public.order_events(order_id,kind,st,by_role,by_id) values(o.id,'aceptado',o.st,m,u);
      o.rep_id := u;
    end if;
  end if;
  -- estado
  newst := coalesce((p->>'st')::int, o.st);
  if newst<>o.st and not o.cancel then
    if m='admin' or (m='rep' and o.rep_id=u and newst between o.st and least(o.st+3,maxst)) then
      newst := least(greatest(newst,0),maxst);
      update public.orders set st=newst, pct=case when newst=maxst and pct is null then coalesce((select (value->>'repPct')::numeric from public.settings where key='cfg'),75) else pct end where id=o.id;
      insert into public.order_events(order_id,kind,st,by_role,by_id) values(o.id,'estado',newst,m,u);
    end if;
  end if;
  -- cancelación
  if coalesce((p->>'cancel')::int,0)=1 and not o.cancel then
    if m='admin' or (m='client' and o.st=0 and o.rep_id is null) then
      update public.orders set cancel=true where id=o.id;
      update public.products pr set stk=pr.stk+i2.q from public.order_items i2
        where i2.order_id=o.id and pr.id=i2.pid and pr.stk is not null and not coalesce((i2.state->>'na')::boolean,false) and not coalesce((i2.state->>'quit')::boolean,false);
      insert into public.order_events(order_id,kind,st,by_role,by_id) values(o.id,'cancelado',o.st,m,u);
    end if;
  end if;
  -- cobro en efectivo (repartidor asignado o admin)
  if (m='admin' or (m='rep' and o.rep_id=u)) and coalesce((p->>'cobrado')::int,0)=1 and not o.cobrado then
    update public.orders set cobrado=true where id=o.id;
    update public.order_private set cobrado_monto=least(greatest(coalesce((p->>'cobradoMonto')::numeric,0),0),100000) where order_id=o.id;
  end if;
  -- recolección (ticket/nota) y nota de remisión
  if p ? 'compra' and (m='admin' or (m='rep' and o.rep_id=u)) then
    update public.order_private set compra = case when m='rep' and p->'compra'->>'kind'='tienda' and pv.nota is not null
       then (p->'compra') || jsonb_build_object('monto', coalesce((pv.nota->>'total')::numeric, (p->'compra'->>'monto')::numeric))
       else p->'compra' end where order_id=o.id;
  end if;
  if p ? 'nota' and (m='admin' or m='tienda') and (pv.nota is null or not coalesce((pv.nota->>'fin')::boolean,false) or m='admin') then
    update public.order_private set nota=p->'nota' where order_id=o.id;
  end if;
  -- artículos: tienda marca surtido/no disponible; cliente elige qué hacer; admin todo (sin cambiar precios)
  if jsonb_typeof(p->'det'->'items')='array' and m in ('admin','tienda','client') then
    i := 0;
    for it in select * from jsonb_array_elements(p->'det'->'items') loop
      select state into ist from public.order_items where order_id=o.id and idx=i;
      if found then
        if m in ('admin','tienda') then
          ist := ist || jsonb_strip_nulls(jsonb_build_object('surt',it->'surt','na',it->'na','quit',it->'quit','rsv',it->'rsv','res',case when m='admin' then it->'res' end));
          if not (it ? 'na') then ist := ist - 'na'; end if;
        end if;
        if m='client' and coalesce((ist->>'na')::boolean,(ist->>'na')='1',false) then
          ist := ist || jsonb_strip_nulls(jsonb_build_object('res',it->'res','quit',it->'quit'));
        end if;
        update public.order_items set state=ist where order_id=o.id and idx=i;
      end if;
      i := i+1;
    end loop;
  end if;
  update public.orders set wf=v_wf, updated_at=now() where id=o.id;
  -- mensajes nuevos del chat
  v_de := case m when 'client' then 'cli' when 'rep' then 'rep' when 'tienda' then 'tienda' else null end;
  if jsonb_typeof(p->'chat')='array' then
    for msg in select * from jsonb_array_elements(p->'chat') loop
      if not (msg ? 'srvId') and (msg->>'t') is not null and length(coalesce(msg->>'txt',''))<=1000 then
        insert into public.messages(order_id,de,who,kind,txt,cli,extra,t,sender)
        values(o.id, case when msg->>'de'='sys' then 'sys' when v_de is null then coalesce(nullif(msg->>'de',''),'adm') else v_de end,
          left(coalesce(case when v_de='rep' then nm when v_de='tienda' then nm else msg->>'who' end,''),80),
          msg->>'kind', coalesce(msg->>'txt',''), coalesce((msg->>'cli')::boolean,false),
          coalesce(msg - array['id','de','who','kind','txt','cli','t','srvId'],'{}'), (msg->>'t')::bigint, u)
        on conflict (order_id,t,de) do nothing;
      end if;
    end loop;
  end if;
  return private.order_json(o.id, private.order_mode((select x from public.orders x where x.id=o.id)));
end $$;
