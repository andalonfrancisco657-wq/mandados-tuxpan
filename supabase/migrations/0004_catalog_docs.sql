-- Catálogo, documentos de administración, configuración y arranque de la app

-- id del mensaje del servidor en el chat
create or replace function private.order_json_fix() returns void language sql as $$ select $$;

create or replace function private.store_json(s public.stores, with_cost boolean) returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('id',s.id,'cat',s.cat,'n',s.n,'tipo',s.tipo,'col',s.col,'hor',s.hor,'act',case when s.act then 1 else 0 end,'ej',s.ej) || s.extra
   || jsonb_build_object('tab',(select jsonb_build_object('act',case when t.act then 1 else 0 end,'t',(extract(epoch from t.created_at)*1000)::bigint,'por',t.por,
        'last',(extract(epoch from t.last_used)*1000)::bigint) from public.tablet_codes t where t.store_id=s.id order by t.id desc limit 1))
   || jsonb_build_object('prods',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'n',p.n,'pres',p.pres,'p',p.p,'sec',p.sec,'e',p.e,
        'disp',case when p.disp then 1 else 0 end,'stk',p.stk,'ej',p.ej) || p.extra
        || case when with_cost then jsonb_build_object('pc',c.pc,'pcEst',case when c.pc_est then 1 else 0 end) else '{}' end order by p.ord,p.id)
      from public.products p left join public.product_costs c on c.product_id=p.id where p.store_id=s.id),'[]'))
$$;

-- dueño/directivo: guarda tiendas completas; tienda: solo precio de compra, existencias y disponible de sus productos
create or replace function public.sync_catalog(p_stores jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare s jsonb; pr jsonb; sid bigint; pid bigint; adm boolean := private.is_admin(); ms bigint := private.my_store(); old public.products; oc numeric; np numeric; i int; keep bigint[];
begin
  if not adm and ms is null then raise exception 'Sin permiso para el catálogo'; end if;
  for s in select * from jsonb_array_elements(p_stores) loop
    sid := (s->>'id')::bigint;
    if adm then
      insert into public.stores(id,cat,n,tipo,col,hor,act,ej,extra) values(sid,s->>'cat',s->>'n',coalesce(s->>'tipo',''),coalesce(s->>'col',''),coalesce(s->>'hor',''),
        coalesce((s->>'act')::int,1)=1, coalesce((s->>'ej')::boolean,false), s - array['id','cat','n','tipo','col','hor','act','ej','prods','tab'])
      on conflict (id) do update set cat=excluded.cat,n=excluded.n,tipo=excluded.tipo,col=excluded.col,hor=excluded.hor,act=excluded.act,extra=excluded.extra,updated_at=now();
      perform setval(pg_get_serial_sequence('public.stores','id'), greatest((select max(id) from public.stores),1));
      keep := '{}'; i := 0;
      for pr in select * from jsonb_array_elements(coalesce(s->'prods','[]')) loop
        pid := (pr->>'id')::bigint;
        if pid is null or not exists(select 1 from public.products where id=pid and store_id=sid) then
          insert into public.products(store_id,n,pres,sec,e,p,disp,stk,ord,extra) values(sid,pr->>'n',coalesce(pr->>'pres',''),coalesce(pr->>'sec',''),coalesce(pr->>'e',''),
            coalesce((pr->>'p')::numeric,0),coalesce((pr->>'disp')::int,1)=1,(pr->>'stk')::int,i,pr - array['id','n','pres','sec','e','p','disp','stk','ej','pc','pcEst']) returning id into pid;
        else
          update public.products set n=pr->>'n',pres=coalesce(pr->>'pres',''),sec=coalesce(pr->>'sec',''),e=coalesce(pr->>'e',''),p=coalesce((pr->>'p')::numeric,0),
            disp=coalesce((pr->>'disp')::int,1)=1,stk=(pr->>'stk')::int,ord=i,extra=pr - array['id','n','pres','sec','e','p','disp','stk','ej','pc','pcEst'],updated_at=now() where id=pid;
        end if;
        insert into public.product_costs(product_id,store_id,pc,pc_est) values(pid,sid,coalesce((pr->>'pc')::numeric,0),coalesce((pr->>'pcEst')::int,0)=1)
          on conflict (product_id) do update set pc=excluded.pc,pc_est=excluded.pc_est,updated_at=now();
        keep := keep || pid; i := i+1;
      end loop;
      if s ? 'prods' then delete from public.products where store_id=sid and not (id = any(keep)); end if;
    elsif sid=ms then
      for pr in select * from jsonb_array_elements(coalesce(s->'prods','[]')) loop
        select * into old from public.products where id=(pr->>'id')::bigint and store_id=ms;
        if old.id is null then continue; end if;
        select pc into oc from public.product_costs where product_id=old.id;
        if (pr->>'pc') is not null and (pr->>'pc')::numeric>=0 and (pr->>'pc')::numeric is distinct from oc then
          np := private.venta_para(old.p, coalesce(oc,0), (pr->>'pc')::numeric);
          update public.product_costs set pc=(pr->>'pc')::numeric, pc_est=false, updated_at=now() where product_id=old.id;
          update public.products set p=np, extra=extra||jsonb_build_object('upd',jsonb_build_object('t',private.now_ms(),'por','Tienda'),'rev',1) where id=old.id;
        end if;
        update public.products set stk=case when pr ? 'stk' then (pr->>'stk')::int else stk end,
          disp=case when pr ? 'disp' then coalesce((pr->>'disp')::int,1)=1 else disp end, updated_at=now() where id=old.id;
      end loop;
    end if;
  end loop;
  return public.get_catalog();
end $$;

create or replace function public.get_catalog() returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(private.store_json(s, private.is_admin() or s.id=private.my_store()) order by s.id),'[]')
  from public.stores s where s.act or private.is_admin() or s.id=private.my_store()
$$;

-- documentos de administración (mismo formato que la app)
create or replace function public.sync_docs(coll text, entries jsonb) returns void language plpgsql security definer set search_path='' as $$
declare k text; v jsonb; adm boolean := private.is_admin(); dir boolean := private.is_dir(); r text := private.my_role(); nm text := private.my_name();
  ms bigint := private.my_store(); u uuid := auth.uid(); ex jsonb; rid uuid;
begin
  for k, v in select * from jsonb_each(entries) loop
    if coll='sanc' then
      if not dir then raise exception 'Solo el directivo sanciona'; end if;
      insert into public.sanctions(key,data,by_id) values(k,v,u) on conflict (key) do update set data=excluded.data, updated_at=now(), by_id=u;
    elsif coll='audit' then
      if not adm and not (r='tienda' and ms is not null) then continue; end if;
      if not exists(select 1 from public.audit_log where data->>'t'=v->>'t' and data->>'acc'=v->>'acc' and coalesce(key,'')=coalesce(v->>'key','')) then
        insert into public.audit_log(key,data,actor) values(v->>'key', case when adm then v else v||jsonb_build_object('key','tienda:'||nm) end, u); end if;
    elsif coll='quejas' then
      if adm then
        insert into public.complaints(id,order_id,data) values(k::bigint,(v->>'orderId')::bigint,v)
          on conflict (id) do update set data=excluded.data, updated_at=now();
      elsif exists(select 1 from public.orders o where o.id=(v->>'orderId')::bigint and o.client_id=u) and not exists(select 1 from public.complaints where id=k::bigint) then
        insert into public.complaints(id,order_id,client_id,data) values(k::bigint,(v->>'orderId')::bigint,u,v || '{"st":"Nueva"}');
      end if;
    elsif coll='regs' then
      if adm then
        select user_id into rid from public.repartidor_registrations where nombre=k;
        update public.repartidor_registrations set data=v, updated_at=now() where nombre=k;
        update public.profiles set verified=(v->>'st'='aprobado') where id=rid and role='repartidor';
      elsif r='repartidor' and k=nm then
        select data into ex from public.repartidor_registrations where nombre=k and user_id=u;
        if ex is not null then update public.repartidor_registrations set data=v || jsonb_build_object('st',ex->'st') || case when ex ? 'rev' then jsonb_build_object('rev',ex->'rev') else '{}' end where nombre=k; end if;
      end if;
    elsif coll='bank' then
      if adm then
        insert into public.bank_accounts(rep_name,user_id,data) values(k,(select id from public.profiles where role='repartidor' and nombre=k),v)
          on conflict (rep_name) do update set data=excluded.data, updated_at=now();
      elsif r='repartidor' and k=nm then
        select data into ex from public.bank_accounts where rep_name=k;
        insert into public.bank_accounts(rep_name,user_id,data) values(k,u, v || jsonb_build_object('st',
            case when ex is not null and ex->>'clabe'=v->>'clabe' then ex->>'st' else 'pendiente' end))
          on conflict (rep_name) do update set data=excluded.data, updated_at=now();
      end if;
    elsif coll='pagos' then
      if not adm then continue; end if;
      insert into public.payouts(key,rep_name,data) values(k,split_part(k,'|',2),v) on conflict (key) do update set data=excluded.data, updated_at=now();
    elsif coll='cashIn' then
      if not adm then continue; end if;
      insert into public.cash_deposits(id,rep_name,data) values(k::bigint,v->>'rep',v) on conflict (id) do update set data=excluded.data;
    elsif coll='credito' then
      if not adm then continue; end if;
      if exists(select 1 from public.stores where id=k::bigint) then
        insert into public.store_credit_ledger(store_id,data) values(k::bigint,v) on conflict (store_id) do update set data=excluded.data, updated_at=now(); end if;
    elsif coll in ('tReq','pChg') then
      if not adm and not ((v->>'storeId')::bigint=ms) then continue; end if;
      if coll='tReq' then
        if not adm and exists(select 1 from public.store_requests where id=k::bigint and data->>'st'<>'pendiente') then continue; end if;
        insert into public.store_requests(id,store_id,data) values(k::bigint,(v->>'storeId')::bigint,
          case when adm then v else v || jsonb_build_object('st','pendiente') - 'dec' end) on conflict (id) do update set data=excluded.data;
      else
        insert into public.price_changes(id,store_id,data) values(k::bigint,(v->>'storeId')::bigint,v) on conflict (id) do update set data=excluded.data;
      end if;
    elsif coll='notes' then
      if not adm then continue; end if;
      insert into public.admin_notes(key,data) values(k,v) on conflict (key) do update set data=excluded.data;
    elsif coll in ('cfg','dirCfg') then
      if not (adm and (coll='cfg' or dir)) then continue; end if;
      insert into public.settings(key,value) values(coll,v) on conflict (key) do update set value=excluded.value, updated_at=now();
    end if;
  end loop;
end $$;

-- arranque: todo lo compartido que este usuario puede ver, en el formato de la app
create or replace function public.app_bootstrap() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid := auth.uid(); me public.profiles; adm boolean := private.is_admin(); ms bigint := private.my_store(); r text; nm text; j jsonb; anon boolean;
begin
  select * into me from public.profiles where id=u; r := coalesce(me.role,'none'); nm := me.nombre;
  select is_anonymous into anon from auth.users where id=u;
  j := jsonb_build_object(
    'me', case when me.id is null then null else jsonb_build_object('id',me.id,'role',me.role,'nombre',me.nombre,'email',me.email,'tel',me.tel,'data',me.data,
        'store_id',ms,'verified',me.verified,'anon',coalesce(anon,false)) end,
    'cfg', (select value from public.settings where key='cfg'),
    'dirCfg', (select value from public.settings where key='dirCfg'),
    'dirClaimed', not exists(select 1 from private.secrets where key='directivo_setup' and used_at is null),
    'stores', public.get_catalog(),
    'reps', coalesce((select jsonb_agg(nombre order by nombre) from public.profiles where role='repartidor' and (adm or verified or id=u)),'[]'),
    'duenos', coalesce((select jsonb_agg(coalesce(nullif(nombre,''),email) order by created_at) from public.profiles where role='dueno'),'[]'));
  if adm then
    j := j || jsonb_build_object(
      'regs', coalesce((select jsonb_object_agg(nombre,data) from public.repartidor_registrations),'{}'),
      'sanc', coalesce((select jsonb_object_agg(key,data) from public.sanctions),'{}'),
      'quejas', coalesce((select jsonb_agg(data order by id) from public.complaints),'[]'),
      'audit', coalesce((select jsonb_agg(data order by id) from (select * from public.audit_log order by id desc limit 1000) a),'[]'),
      'bank', coalesce((select jsonb_object_agg(rep_name,data) from public.bank_accounts),'{}'),
      'pagos', coalesce((select jsonb_object_agg(key,data) from public.payouts),'{}'),
      'cashIn', coalesce((select jsonb_agg(data order by id) from public.cash_deposits),'[]'),
      'credito', coalesce((select jsonb_object_agg(store_id::text,data) from public.store_credit_ledger),'{}'),
      'tReq', coalesce((select jsonb_agg(data order by id) from public.store_requests),'[]'),
      'pChg', coalesce((select jsonb_agg(data order by id) from public.price_changes),'[]'),
      'notes', coalesce((select jsonb_object_agg(key,data) from public.admin_notes),'{}'),
      'accounts', coalesce((select jsonb_object_agg(email, jsonb_build_object('email',email,'nombre',nombre,'tel',tel,'dirs',coalesce(data->'dirs','[]'),'creado',(extract(epoch from created_at)*1000)::bigint))
          from public.profiles where role='cliente' and email is not null),'{}'));
  elsif r='repartidor' then
    j := j || jsonb_build_object(
      'regs', coalesce((select jsonb_object_agg(nombre,data) from public.repartidor_registrations where user_id=u),'{}'),
      'sanc', coalesce((select jsonb_object_agg(key,data) from public.sanctions where key='rep:'||nm),'{}'),
      'bank', coalesce((select jsonb_object_agg(rep_name,data) from public.bank_accounts where user_id=u),'{}'),
      'pagos', coalesce((select jsonb_object_agg(key,data) from public.payouts where rep_name=nm),'{}'),
      'cashIn', coalesce((select jsonb_agg(data order by id) from public.cash_deposits where rep_name=nm),'[]'));
  elsif ms is not null then
    j := j || jsonb_build_object(
      'credito', coalesce((select jsonb_object_agg(store_id::text,data) from public.store_credit_ledger where store_id=ms),'{}'),
      'tReq', coalesce((select jsonb_agg(data order by id) from public.store_requests where store_id=ms),'[]'),
      'pChg', coalesce((select jsonb_agg(data order by id) from public.price_changes where store_id=ms),'[]'));
  elsif me.id is not null then
    j := j || jsonb_build_object('sanc', coalesce((select jsonb_object_agg(key,data) from public.sanctions where key in ('cli:'||coalesce(me.email,''), 'inv:'||coalesce(me.tel,''))),'{}'),
      'quejas', coalesce((select jsonb_agg(data order by id) from public.complaints where client_id=u),'[]'));
  end if;
  return j;
end $$;

-- funciones expuestas: solo usuarios con sesión (incluye anónimos: invitados y tablets)
do $$ declare f text; begin
  for f in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
grant execute on function public.get_catalog() to anon;
drop function if exists private.order_json_fix();
