-- v32: vehículo y licencia del repartidor
create or replace function private.today_mx() returns date language sql stable set search_path='' as $$ select (now() at time zone 'America/Mazatlan')::date $$;
-- valida {veh,lic:{num,tipo,vence:'YYYY-MM-DD',fotos:{licF,licR}},placas}; devuelve mensaje de error o null
create or replace function private.veh_err(d jsonb, u uuid) returns text language plpgsql stable security definer set search_path='' as $$
declare v text := d->>'veh'; l jsonb := d->'lic'; dt date;
begin
  if v is null or v not in ('moto','carro','bici','pie') then return 'Elige tu tipo de vehículo'; end if;
  if length(coalesce(d->>'placas',''))>15 then return 'Las placas no son válidas'; end if;
  if v in ('bici','pie') then return null; end if;
  if l is null or length(trim(coalesce(l->>'num','')))<4 or length(l->>'num')>30 then return 'Escribe el número de tu licencia'; end if;
  if length(trim(coalesce(l->>'tipo','')))<1 or length(l->>'tipo')>30 then return 'Escribe el tipo de licencia'; end if;
  begin dt := (l->>'vence')::date; exception when others then return 'La fecha de vencimiento no es válida'; end;
  if dt is null or dt <= private.today_mx() then return 'Tu licencia está vencida: sube una vigente'; end if;
  if dt > private.today_mx() + interval '15 years' then return 'La fecha de vencimiento no es válida'; end if;
  if coalesce(l#>>'{fotos,licF}','')='' or coalesce(l#>>'{fotos,licR}','')='' then return 'Sube la foto del frente y del reverso de tu licencia'; end if;
  if (select count(*) from public.photo_index where key in (l#>>'{fotos,licF}', l#>>'{fotos,licR}') and owner=u and bucket='ine')<2 then return 'Las fotos de la licencia no se subieron; inténtalo otra vez'; end if;
  return null;
end $$;
-- licencia vigente (solo si el vehículo la necesita; registros viejos sin vehículo no se bloquean)
create or replace function private.lic_ok(u uuid) returns boolean language sql stable security definer set search_path='' as $$
  select not exists(select 1 from public.repartidor_registrations r where r.user_id=u and r.data->>'veh' in ('moto','carro')
    and coalesce((r.data#>>'{lic,vence}')::date, '1900-01-01') <= private.today_mx()) $$;
create or replace function private.rep_ok() returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.profiles where id=(select auth.uid()) and role='repartidor' and verified)
   and not private.sanctioned('rep:'||coalesce(private.my_name(),'')) and private.lic_ok((select auth.uid())) $$;

-- el repartidor manda vehículo/licencia (completar o renovar): queda en revisión, sin cambiar su estado actual
create or replace function public.rep_vehicle_update(p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := auth.uid(); r public.repartidor_registrations; e text; p jsonb;
begin
  select * into r from public.repartidor_registrations where user_id=u;
  if r.nombre is null or private.my_role()<>'repartidor' then raise exception 'Primero envía tu registro de repartidor'; end if;
  e := private.veh_err(p_data,u); if e is not null then raise exception '%', e; end if;
  p := jsonb_build_object('veh',p_data->'veh','placas',coalesce(p_data->>'placas',''),'t',private.now_ms())
    || case when p_data->>'veh' in ('moto','carro') then jsonb_build_object('lic',jsonb_build_object('num',trim(p_data#>>'{lic,num}'),'tipo',trim(p_data#>>'{lic,tipo}'),'vence',p_data#>>'{lic,vence}','fotos',p_data#>'{lic,fotos}')) else '{}' end;
  update public.repartidor_registrations set data=(data-'vehRej')||jsonb_build_object('vehPend',p), updated_at=now() where nombre=r.nombre;
  insert into public.audit_log(key,data,actor) values('rep:'||r.nombre, jsonb_build_object('t',private.now_ms(),'key','rep:'||r.nombre,
    'acc',case when r.data ? 'veh' then 'Licencia/vehículo actualizado (en revisión)' else 'Vehículo y licencia enviados (en revisión)' end,'mot','','nota',p->>'veh'), u);
  return (select data from public.repartidor_registrations where nombre=r.nombre);
end $$;
create or replace function public.review_vehicle(p_nombre text, p_ok boolean, p_mot text default '', p_nota text default '') returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.repartidor_registrations; por text := case when private.is_dir() then 'Directivo' else 'Dueño' end; t bigint := private.now_ms(); p jsonb; d jsonb;
begin
  if not private.is_admin() then raise exception 'Solo dueño o directivo'; end if;
  select * into r from public.repartidor_registrations where nombre=p_nombre for update; p := r.data->'vehPend';
  if p is null then raise exception 'No hay licencia/vehículo en revisión'; end if;
  if not p_ok and coalesce(p_mot,'')='' then raise exception 'Escribe el motivo del rechazo'; end if;
  if p_ok then
    if p->>'veh' in ('moto','carro') and (p#>>'{lic,vence}')::date <= private.today_mx() then raise exception 'Esa licencia ya venció; recházala'; end if;
    d := (r.data - array['vehPend','vehRej','lic']) || jsonb_build_object('veh',p->'veh','placas',p->'placas','vehRev',jsonb_build_object('t',t,'por',por)) || case when p ? 'lic' then jsonb_build_object('lic',p->'lic') else '{}' end;
  else d := (r.data - 'vehPend') || jsonb_build_object('vehRej',jsonb_build_object('t',t,'por',por,'mot',p_mot,'nota',coalesce(p_nota,''))); end if;
  update public.repartidor_registrations set data=d, updated_at=now() where nombre=p_nombre;
  insert into public.audit_log(key,data,actor) values('rep:'||p_nombre, jsonb_build_object('t',t,'key','rep:'||p_nombre,'acc',case when p_ok then 'Licencia/vehículo aprobado' else 'Licencia/vehículo rechazado' end,
    'mot',case when p_ok then '' else p_mot end,'nota',case when coalesce(p_nota,'')='' then 'Por '||por else p_nota||' · Por '||por end), auth.uid());
  return d;
end $$;
revoke all on function public.rep_vehicle_update(jsonb), public.review_vehicle(text,boolean,text,text) from public, anon;
grant execute on function public.rep_vehicle_update(jsonb), public.review_vehicle(text,boolean,text,text) to authenticated;
CREATE OR REPLACE FUNCTION public.rep_register(p_nombre text, p_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  -- v32: vehículo/licencia obligatorio al registrarse o reenviar (salvo repartidor ya aprobado que solo actualiza datos)
  if not (old->>'st'='aprobado' and me.nombre=n) or p_data ? 'veh' then
    if private.veh_err(p_data,u) is not null then raise exception '%', private.veh_err(p_data,u); end if; end if;
  p_data := (p_data - array['vehPend','vehRev','vehRej']) || case when old ? 'vehPend' then jsonb_build_object('vehPend',old->'vehPend') else '{}' end;
  if old->>'st'='aprobado' and me.nombre=n and old ? 'veh' then p_data := (p_data - array['veh','lic','placas']) || jsonb_strip_nulls(jsonb_build_object('veh',old->'veh','lic',old->'lic','placas',old->'placas','vehRev',old->'vehRev')); end if;
  delete from public.repartidor_registrations where user_id=u and nombre<>n;
  insert into public.repartidor_registrations(nombre,user_id,data) values(n,u,
    (p_data - 'rev') || jsonb_build_object('nombre',n,'st', case when old->>'st'='aprobado' and me.nombre=n then 'aprobado' else 'pendiente' end))
  on conflict (nombre) do update set data=excluded.data, updated_at=now();
  update public.profiles set role='repartidor', nombre=n,
    verified = (verified and me.nombre=n) where id=u;
  return jsonb_build_object('ok',true);
end $function$
;CREATE OR REPLACE FUNCTION public.sync_docs(coll text, entries jsonb)
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
      -- v32: vehículo/licencia solo cambian con rep_register/rep_vehicle_update/review_vehicle
      select data into ex from public.repartidor_registrations where nombre=k;
      v := (v - array['veh','lic','placas','vehPend','vehRev','vehRej']) || coalesce(jsonb_strip_nulls(jsonb_build_object('veh',ex->'veh','lic',ex->'lic','placas',ex->'placas','vehPend',ex->'vehPend','vehRev',ex->'vehRev','vehRej',ex->'vehRej')),'{}');
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
;