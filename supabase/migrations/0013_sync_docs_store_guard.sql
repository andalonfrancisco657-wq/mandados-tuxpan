-- Corrige: un usuario sin tienda (ms nulo) no debe poder escribir tReq/pChg de ninguna tienda.
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
      if not adm and not coalesce((v->>'storeId')::bigint=ms,false) then continue; end if;
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
