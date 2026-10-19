-- v25: ubicación del domicilio (pin del cliente) en el pedido. Solo la ven el cliente, el repartidor asignado y dueño/directivo.
alter table public.order_private add column if not exists dlat float8, add column if not exists dlng float8, add column if not exists sin_ubic boolean not null default false;

do $$ begin
  if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname='create_order_base') then
    alter function public.create_order(jsonb) set schema private;
    alter function private.create_order(jsonb) rename to create_order_base; end if; end $$;
revoke all on function private.create_order_base(jsonb) from public, anon, authenticated;

create or replace function public.create_order(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r jsonb; la float8; ln float8;
begin
  begin la := (p->>'lat')::float8; ln := (p->>'lng')::float8; exception when others then la := null; ln := null; end;
  if la is null or ln is null or la not between 14 and 33 or ln not between -118 and -86 then la := null; ln := null; end if; -- dentro de México
  r := private.create_order_base(p);
  update public.order_private set dlat=la, dlng=ln, sin_ubic=(la is null) where order_id=(r->>'id')::bigint;
  return jsonb_build_object('id',r->'id','token',r->'token','order',private.order_json((r->>'id')::bigint,'client'));
end $$;
revoke all on function public.create_order(jsonb) from public, anon;
grant execute on function public.create_order(jsonb) to authenticated;

create or replace function private.order_json(oid bigint, mode text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare j jsonb := private.order_json_base(oid, mode); pv public.order_private; fin boolean; rid uuid;
begin
  select * into pv from public.order_private where order_id=oid;
  select rep_id into rid from public.orders where id=oid;
  fin := (j->>'st')::int >= case when j->>'cat'='paquetes' then 3 else 4 end or j ? 'cancel';
  if mode='client' then j := (j - 'verif') || case when not fin then jsonb_build_object('delivCode',pv.deliv_code) else '{}' end;
  elsif mode='tienda' then j := (j - 'verif') || case when not fin and not pv.handoff_used then jsonb_build_object('handoff',pv.handoff_code) else '{}' end;
  elsif mode='admin' then j := j || jsonb_build_object('handoff',pv.handoff_code,'delivTries',pv.deliv_tries,'handoffTries',pv.handoff_tries);
  elsif mode='rep' then j := j || jsonb_build_object('delivTries',pv.deliv_tries,'handoffTries',pv.handoff_tries);
  end if;
  -- pin del domicilio: cliente, repartidor ASIGNADO (no los que solo ven pedidos disponibles) y dueño/directivo
  if mode in ('client','admin') or (mode='rep' and rid is not null and rid=auth.uid()) then
    j := j || jsonb_build_object('sinUbic',pv.sin_ubic) || case when pv.dlat is not null then jsonb_build_object('dlat',pv.dlat,'dlng',pv.dlng) else '{}' end;
  end if;
  return j;
end $$;
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
      if gps and pv.dlat is not null then dist := private.dist_m(p_lat,p_lng,pv.dlat,pv.dlng); end if;
    else
      if p_photo is null or p_photo not like 'tk:entrega:'||o.id||':%' or not exists(select 1 from public.photo_index x join storage.objects so on so.bucket_id='tickets' and so.name=x.path where x.key=p_photo and x.owner=u and x.bucket='tickets') then
        raise exception 'Falta la foto de la entrega'; end if;
      meth := 'foto';
      if pv.dlat is not null then
        if not gps then return jsonb_build_object('ok',false,'msg','Activa la ubicación de tu celular: para entregar sin código debes estar en el domicilio que marcó el cliente.'); end if;
        dist := private.dist_m(p_lat,p_lng,pv.dlat,pv.dlng);
        if dist>lim then return jsonb_build_object('ok',false,'msg','Estás a '||round(dist)||' m del domicilio que marcó el cliente. Para entregar sin código debes estar a menos de 150 m.'); end if;
      end if;
    end if;
    v := jsonb_strip_nulls(jsonb_build_object('m',meth,'t',t,'gps',gps,'acc',round(p_acc),'lat',p_lat,'lng',p_lng,'foto',p_photo,'ok',meth='codigo','revisar',meth='foto','dist',round(dist),'sinPin',pv.dlat is null));
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