-- v31: sanciones y revisión de repartidores por RPC (rol + auditoría en el servidor) y en tiempo real para dueño y directivo
create or replace function public.set_sanction(p_key text, p_acc text, p_dias int default null, p_mot text default '', p_nota text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare old jsonb; nv jsonb; t bigint := private.now_ms(); h bigint; rid uuid; nm text := coalesce(private.my_name(),'Directivo');
begin
  if not private.is_dir() then raise exception 'Solo el directivo puede sancionar o reactivar'; end if;
  if p_key !~ '^(cli|inv|rep|due):.+' then raise exception 'Persona no válida'; end if;
  if p_acc not in ('Advertencia','Suspender','Dar de baja','Reactivar') then raise exception 'Acción no válida'; end if;
  if coalesce(p_mot,'')='' then raise exception 'Elige un motivo'; end if;
  select data into old from public.sanctions where key=p_key;
  if p_acc='Suspender' then if coalesce(p_dias,0)<1 or p_dias>3650 then raise exception 'Días de suspensión no válidos'; end if; h := t + p_dias::bigint*86400000; end if;
  nv := case p_acc when 'Advertencia' then coalesce(old,'{"st":"activo"}'::jsonb)
    when 'Reactivar' then jsonb_build_object('st','activo','t',t,'por','Directivo','porNm',nm)
    else jsonb_build_object('st',case when p_acc='Suspender' then 'suspendido' else 'baja' end,'hasta',h,'mot',p_mot,'nota',coalesce(p_nota,''),'t',t,'por','Directivo','porNm',nm) end;
  insert into public.sanctions(key,data,by_id) values(p_key,nv,auth.uid()) on conflict (key) do update set data=excluded.data, updated_at=now(), by_id=excluded.by_id;
  insert into public.audit_log(key,data,actor) values(p_key, jsonb_build_object('t',t,'key',p_key,'acc',p_acc||case when p_dias is not null and p_acc='Suspender' then ' ('||p_dias||' días)' else '' end,
    'mot',p_mot,'nota',coalesce(p_nota,'')||' · Por Directivo'), auth.uid());
  -- repartidor suspendido/dado de baja: deja de aparecer en el mapa al instante
  if p_key like 'rep:%' and p_acc in ('Suspender','Dar de baja') then
    delete from public.driver_locations where driver_id in (select id from public.profiles where role='repartidor' and nombre=substr(p_key,5));
  end if;
  return coalesce((select jsonb_object_agg(key,data) from public.sanctions),'{}');
end $$;

create or replace function public.review_rep_registration(p_nombre text, p_ok boolean, p_mot text default '', p_nota text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.repartidor_registrations; por text := case when private.is_dir() then 'Directivo' else 'Dueño' end; t bigint := private.now_ms(); d jsonb;
begin
  if not private.is_admin() then raise exception 'Solo dueño o directivo'; end if;
  select * into r from public.repartidor_registrations where nombre=p_nombre for update;
  if r.nombre is null then raise exception 'Registro no encontrado'; end if;
  if r.data->>'st'<>'pendiente' then raise exception 'Este registro ya fue revisado (%)', r.data->>'st'; end if;
  if not p_ok and coalesce(p_mot,'')='' then raise exception 'Elige el motivo del rechazo'; end if;
  d := r.data || jsonb_build_object('st',case when p_ok then 'aprobado' else 'rechazado' end,'motivo',case when p_ok then '' else p_mot end,'nota',case when p_ok then '' else coalesce(p_nota,'') end,'rev',jsonb_build_object('t',t,'por',por));
  update public.repartidor_registrations set data=d, updated_at=now() where nombre=p_nombre;
  update public.profiles set verified=p_ok where id=r.user_id and role='repartidor';
  insert into public.audit_log(key,data,actor) values('rep:'||p_nombre, jsonb_build_object('t',t,'key','rep:'||p_nombre,'acc',case when p_ok then 'Registro aprobado' else 'Registro rechazado' end,
    'mot',case when p_ok then '' else p_mot end,'nota',case when p_ok or coalesce(p_nota,'')='' then 'Por '||por else p_nota||' · Por '||por end), auth.uid());
  return d;
end $$;
revoke all on function public.set_sanction(text,text,int,text,text), public.review_rep_registration(text,boolean,text,text) from public, anon;
grant execute on function public.set_sanction(text,text,int,text,text), public.review_rep_registration(text,boolean,text,text) to authenticated;
do $$ begin
  begin alter publication supabase_realtime add table public.sanctions; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.repartidor_registrations; exception when duplicate_object then null; end;
end $$;
CREATE OR REPLACE FUNCTION public.sync_docs(coll text, entries jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare k text; v jsonb; adm boolean := private.is_admin(); dir boolean := private.is_dir(); r text := private.my_role(); nm text := private.my_name();
  ms bigint := private.my_store(); u uuid := auth.uid(); ex jsonb; rid uuid;
begin
  for k, v in select * from jsonb_each(entries) loop
    if coll='sanc' then
      continue; -- v31: las sanciones solo se cambian con set_sanction (rol + auditoría)
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
        -- v31: aprobar/rechazar solo con review_rep_registration; aquí se conserva el estado y la revisión
        select data into ex from public.repartidor_registrations where nombre=k;
        if ex is not null then update public.repartidor_registrations set data=v || jsonb_build_object('st',ex->'st','motivo',coalesce(ex->'motivo','""'),'nota',coalesce(ex->'nota','""')) || case when ex ? 'rev' then jsonb_build_object('rev',ex->'rev') else '{}' end, updated_at=now() where nombre=k; end if;
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
end $function$
;-- la persona sancionada ve su propia sanción (para que su app se bloquee al momento)
drop policy if exists own_sanction on public.sanctions;
create policy own_sanction on public.sanctions for select to authenticated using (key = 'rep:'||coalesce((select private.my_name()),'') or key = 'cli:'||coalesce((select email from public.profiles where id=(select auth.uid())),''));
-- v31: un repartidor suspendido o dado de baja no comparte ubicación ni aparece en el mapa
create or replace function public.update_my_location(p_lat double precision, p_lng double precision, p_acc double precision default null) returns void
language plpgsql security definer set search_path='' as $$
begin
  if private.my_role()<>'repartidor' then raise exception 'Solo repartidores'; end if;
  if private.sanctioned('rep:'||coalesce(private.my_name(),'')) then delete from public.driver_locations where driver_id=auth.uid(); raise exception 'Estás suspendido o dado de baja: no se comparte tu ubicación'; end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then raise exception 'Ubicación no válida'; end if;
  insert into public.driver_locations(driver_id,lat,lng,accuracy,available,updated_at) values(auth.uid(),p_lat,p_lng,p_acc,true,now())
  on conflict (driver_id) do update set lat=excluded.lat,lng=excluded.lng,accuracy=excluded.accuracy,available=true,updated_at=now();
end $$;
create or replace function public.get_driver_locations() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not private.is_admin() then raise exception 'Solo dueño o directivo'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',l.driver_id,'nombre',p.nombre,'lat',l.lat,'lng',l.lng,'acc',l.accuracy,
    't',(extract(epoch from l.updated_at)*1000)::bigint,'verified',p.verified,
    'activos',(select count(*) from public.orders o where o.rep_id=l.driver_id and not o.cancel and o.st < case when o.cat='paquetes' then 3 else 4 end))
    order by p.nombre) from public.driver_locations l join public.profiles p on p.id=l.driver_id and p.role='repartidor'
    where l.available and not private.sanctioned('rep:'||coalesce(p.nombre,''))),'[]');
end $$;
