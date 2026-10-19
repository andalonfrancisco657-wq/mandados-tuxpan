-- v24: comprobantes por paso (recogido / entregado) validados en el servidor.
alter table public.order_private add column if not exists deliv_code text, add column if not exists deliv_tries int not null default 0,
  add column if not exists handoff_code text, add column if not exists handoff_tries int not null default 0, add column if not exists handoff_used boolean not null default false;
create or replace function private.order_codes() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.deliv_code is null then new.deliv_code := lpad(((get_byte(extensions.gen_random_bytes(2),0)*256+get_byte(extensions.gen_random_bytes(2),1))%10000)::text,4,'0'); end if;
  if new.handoff_code is null then new.handoff_code := lpad((('x'||encode(extensions.gen_random_bytes(4),'hex'))::bit(32)::bigint % 1000000)::text,6,'0'); end if;
  return new;
end $$;
drop trigger if exists order_codes on public.order_private;
create trigger order_codes before insert on public.order_private for each row execute function private.order_codes();
update public.order_private set deliv_code=lpad((floor(random()*10000))::int::text,4,'0'), handoff_code=lpad((floor(random()*1000000))::int::text,6,'0') where deliv_code is null;

create or replace function private.dist_m(a1 float8,o1 float8,a2 float8,o2 float8) returns float8 language sql immutable set search_path='' as $$
  select 2*6371000*asin(sqrt(power(sin(radians(a2-a1)/2),2)+cos(radians(a1))*cos(radians(a2))*power(sin(radians(o2-o1)/2),2))) $$;

-- order_json: se envuelve para añadir códigos según el rol
do $$ begin
  if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname='order_json_base') then
    alter function private.order_json(bigint,text) rename to order_json_base; end if; end $$;
create or replace function private.order_json(oid bigint, mode text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare j jsonb := private.order_json_base(oid, mode); pv public.order_private; fin boolean;
begin
  select * into pv from public.order_private where order_id=oid;
  fin := (j->>'st')::int >= case when j->>'cat'='paquetes' then 3 else 4 end or j ? 'cancel';
  if mode='client' then j := (j - 'verif') || case when not fin then jsonb_build_object('delivCode',pv.deliv_code) else '{}' end;
  elsif mode='tienda' then j := (j - 'verif') || case when not fin and not pv.handoff_used then jsonb_build_object('handoff',pv.handoff_code) else '{}' end;
  elsif mode='admin' then j := j || jsonb_build_object('handoff',pv.handoff_code,'delivTries',pv.deliv_tries,'handoffTries',pv.handoff_tries);
  elsif mode='rep' then j := j || jsonb_build_object('delivTries',pv.deliv_tries,'handoffTries',pv.handoff_tries);
  end if;
  return j;
end $$;

-- sync_order: el repartidor ya no cambia estado ni recog/ts; la tienda tampoco ts
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
    when 'client' then array['xtra','cancelT'] when 'rep' then array[]::text[] when 'tienda' then array['prep','tacc'] end;
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
    if m='admin' then -- v24: el repartidor solo avanza con public.rep_step (con comprobantes)
      newst := least(greatest(newst,0),maxst);
      update public.orders set st=newst, pct=case when newst=maxst and pct is null then coalesce((select (value->>'repPct')::numeric from public.settings where key='cfg'),75) else pct end where id=o.id;
      insert into public.order_events(order_id,kind,st,by_role,by_id) values(o.id,'estado',newst,m,u);
      v_wf := jsonb_set(jsonb_set(v_wf,'{ts}',coalesce(v_wf->'ts','{}')||jsonb_build_object(newst::text,private.now_ms())),'{verif}',coalesce(v_wf->'verif','{}')||jsonb_build_object('manual'||newst,jsonb_build_object('t',private.now_ms(),'por',nm)));
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
  if (m='admin' or (m='rep' and o.rep_id=u and o.st>=(case when o.cat='paquetes' then 2 else 3 end))) and coalesce((p->>'cobrado')::int,0)=1 and not o.cobrado then
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
-- tienda: "Entregado al repartidor" (queda como comprobante del recogido)
create or replace function public.tienda_handoff(p_id bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.orders; t bigint := private.now_ms();
begin
  select * into o from public.orders where id=p_id for update;
  if o.id is null or o.store_id is null or o.store_id is distinct from private.my_store() then raise exception 'Sin permiso sobre este pedido'; end if;
  if o.cancel then raise exception 'Pedido cancelado'; end if;
  if o.rep_id is null then raise exception 'Aún no hay repartidor asignado'; end if;
  if not (o.wf ? 'prep') then raise exception 'Primero marca el pedido como listo para recoger'; end if;
  if o.wf->'recog' ? 'tienda' then return private.order_json(o.id,'tienda'); end if;
  update public.orders set wf=jsonb_set(wf,'{recog}',coalesce(wf->'recog','{}')||jsonb_build_object('tienda',t)), updated_at=now() where id=o.id;
  insert into public.order_events(order_id,kind,st,by_role,by_id) values(o.id,'tienda_entrego',o.st,'tienda',auth.uid());
  perform private.audit('tienda:'||coalesce(o.det->>'tienda',''),'Tablet: entregado al repartidor','Pedido #'||o.id||' · '||o.rep_name);
  return private.order_json(o.id,'tienda');
end $$;

-- repartidor: único camino para cambiar el estado. Devuelve {ok,msg,order}.
create or replace function public.rep_step(p_id bigint, p_action text, p_code text default null, p_lat float8 default null, p_lng float8 default null,
  p_acc float8 default null, p_photo text default null, p_monto numeric default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.orders; pv public.order_private; s public.stores; u uuid := auth.uid(); t bigint := private.now_ms(); maxst int; rs int; ns int;
  meth text; dist float8; gps boolean := p_lat is not null and p_lng is not null and p_lat between -90 and 90 and p_lng between -180 and 180;
  lim float8; v jsonb; tab boolean; bad int; v_w jsonb;
begin
  select * into o from public.orders where id=p_id for update;
  if o.id is null or o.rep_id is distinct from u or u is null then raise exception 'Solo el repartidor asignado puede avanzar este pedido'; end if;
  if o.cancel then raise exception 'Pedido cancelado'; end if;
  if not private.rep_ok() then raise exception 'Tu cuenta no está habilitada'; end if;
  select * into pv from public.order_private where order_id=o.id for update;
  maxst := case when o.cat='paquetes' then 3 else 4 end; rs := case when o.cat='paquetes' then 1 else 2 end;
  if o.st>=maxst then raise exception 'El pedido ya fue entregado'; end if;
  select count(*) into bad from public.order_events where by_id=u and kind='codigo_mal' and created_at>now()-interval '1 hour';
  lim := 150 + least(coalesce(p_acc,0),50);
  v_w := o.wf;
  if p_action='avanzar' then
    if o.st>=rs then raise exception 'Este paso necesita comprobante (recogido o entregado)'; end if;
    ns := o.st+1;
  elsif p_action='recogido' then
    if o.st<>rs then raise exception 'Primero avanza al paso de recolección'; end if;
    if pv.compra is null then raise exception 'Primero sube la foto de la nota / ticket / paquete'; end if;
    if o.store_id is not null then
      select * into s from public.stores where id=o.store_id;
      tab := exists(select 1 from public.tablet_codes c where c.store_id=o.store_id and c.act);
      if gps and s.lat is not null then
        dist := private.dist_m(p_lat,p_lng,s.lat,s.lng);
        if dist>lim then return jsonb_build_object('ok',false,'msg','Estás a '||round(dist)||' m de la tienda. Debes estar en la tienda (a menos de 150 m) para marcar recogido.'); end if;
      end if;
      if v_w->'recog' ? 'tienda' then meth := 'tienda';
      elsif nullif(btrim(coalesce(p_code,'')),'') is not null then
        if pv.handoff_used then raise exception 'El código de la tienda ya se usó'; end if;
        if pv.handoff_tries>=5 or bad>=15 then return jsonb_build_object('ok',false,'msg','Demasiados intentos: pide a la tienda que marque “Entregado al repartidor” en su tablet'); end if;
        if btrim(p_code)<>pv.handoff_code then
          update public.order_private set handoff_tries=handoff_tries+1 where order_id=o.id;
          insert into public.order_events(order_id,kind,st,by_role,by_id) values(o.id,'codigo_mal',o.st,'rep',u);
          return jsonb_build_object('ok',false,'msg','Código de la tienda incorrecto. Te quedan '||(4-pv.handoff_tries)||' intentos.');
        end if;
        meth := 'codigo'; update public.order_private set handoff_used=true where order_id=o.id;
      elsif not tab then meth := 'sin_tablet';
      else return jsonb_build_object('ok',false,'msg','Falta la confirmación de la tienda: pide que marquen “Entregado al repartidor” en su tablet o escribe el código que aparece en la tablet.');
      end if;
    else meth := 'foto';
    end if;
    v := jsonb_strip_nulls(jsonb_build_object('m',meth,'t',t,'gps',gps,'dist',round(dist),'acc',round(p_acc),'lat',p_lat,'lng',p_lng,
      'ok', meth in ('tienda','codigo') and dist is not null,'sinUbic', dist is null));
    v_w := jsonb_set(v_w,'{verif}',coalesce(v_w->'verif','{}')||jsonb_build_object('recog',v));
    v_w := jsonb_set(v_w,'{recog}',coalesce(v_w->'recog','{}')||jsonb_build_object('rep',t)||case when v_w->'recog' ? 't' then '{}' else jsonb_build_object('t',t) end);
    ns := rs+1;
    insert into public.messages(order_id,de,who,kind,txt,cli,extra,t,sender) values(o.id,'sys','',null,
      '📦 Tu pedido fue recogido'||case when o.det ? 'tienda' then ' en '||(o.det->>'tienda') else '' end||' por '||o.rep_name||'. Va en camino.',false,'{}',t,u) on conflict do nothing;
  elsif p_action in ('entregado','entregado_foto') then
    if o.st<>maxst-1 then raise exception 'Primero marca el pedido como recogido'; end if;
    if o.pago='efectivo' and not o.cobrado then
      if p_monto is null or p_monto<=0 or p_monto>100000 then raise exception 'Escribe cuánto cobraste en efectivo'; end if;
    end if;
    if p_action='entregado' then
      if pv.deliv_tries>=5 then return jsonb_build_object('ok',false,'locked',true,'msg','Código bloqueado por 5 intentos fallidos. Usa la entrega con foto.'); end if;
      if bad>=15 then return jsonb_build_object('ok',false,'msg','Demasiados códigos incorrectos en la última hora. Usa la entrega con foto.'); end if;
      if coalesce(btrim(p_code),'')<>pv.deliv_code then
        update public.order_private set deliv_tries=deliv_tries+1 where order_id=o.id;
        insert into public.order_events(order_id,kind,st,by_role,by_id) values(o.id,'codigo_mal',o.st,'rep',u);
        return jsonb_build_object('ok',false,'locked',pv.deliv_tries+1>=5,'msg',case when pv.deliv_tries+1>=5 then 'Código incorrecto. Se bloqueó: usa la entrega con foto.' else 'Código incorrecto. Te quedan '||(4-pv.deliv_tries)||' intentos.' end);
      end if;
      meth := 'codigo';
    else
      if p_photo is null or p_photo not like 'tk:entrega:'||o.id||':%' or not exists(select 1 from public.photo_index x join storage.objects so on so.bucket_id='tickets' and so.name=x.path where x.key=p_photo and x.owner=u and x.bucket='tickets') then
        raise exception 'Falta la foto de la entrega'; end if;
      meth := 'foto';
      -- el domicilio aún no tiene coordenadas en la app: se guarda el GPS para que el dueño lo revise
    end if;
    v := jsonb_strip_nulls(jsonb_build_object('m',meth,'t',t,'gps',gps,'acc',round(p_acc),'lat',p_lat,'lng',p_lng,'foto',p_photo,'ok',meth='codigo','revisar',meth='foto'));
    v_w := jsonb_set(v_w,'{verif}',coalesce(v_w->'verif','{}')||jsonb_build_object('entrega',v));
    if o.pago='efectivo' and not o.cobrado then
      update public.orders set cobrado=true where id=o.id;
      update public.order_private set cobrado_monto=p_monto where order_id=o.id;
    end if;
    ns := maxst;
    if meth='foto' then
      insert into public.order_events(order_id,kind,st,by_role,by_id) values(o.id,'entrega_sin_codigo',maxst,'rep',u);
      perform private.audit('rep:'||o.rep_name,'Entregado (sin código) – por revisar','Pedido #'||o.id||case when gps then ' · GPS '||round(p_lat::numeric,5)||','||round(p_lng::numeric,5) else ' · sin GPS' end);
    end if;
  else raise exception 'Acción no válida';
  end if;
  v_w := jsonb_set(v_w,'{ts}',coalesce(v_w->'ts','{}')||jsonb_build_object(ns::text,t));
  update public.orders set st=ns, wf=v_w, updated_at=now(),
    pct=case when ns=maxst and pct is null then coalesce((select (value->>'repPct')::numeric from public.settings where key='cfg'),75) else pct end where id=o.id;
  insert into public.order_events(order_id,kind,st,by_role,by_id) values(o.id,'estado',ns,'rep',u);
  return jsonb_build_object('ok',true,'order',private.order_json(o.id,'rep'));
end $$;

-- dueño/directivo: marcar como revisada una entrega sin código
create or replace function public.review_delivery(p_id bigint, p_nota text default '') returns void language plpgsql security definer set search_path='' as $$
begin
  if not private.is_admin() then raise exception 'Sin permiso'; end if;
  update public.orders set wf=jsonb_set(wf,'{verif,entrega}',(wf->'verif'->'entrega')||jsonb_build_object('revisar',false,'rev',jsonb_build_object('t',private.now_ms(),'por',private.my_name(),'nota',left(coalesce(p_nota,''),300))))
   where id=p_id and wf->'verif'->'entrega' is not null;
  perform private.audit('pedido:'||p_id,'Entrega sin código revisada',left(coalesce(p_nota,''),300));
end $$;
revoke all on function public.tienda_handoff(bigint), public.rep_step(bigint,text,text,float8,float8,float8,text,numeric), public.review_delivery(bigint,text) from public, anon;
grant execute on function public.tienda_handoff(bigint), public.rep_step(bigint,text,text,float8,float8,float8,text,numeric), public.review_delivery(bigint,text) to authenticated;
