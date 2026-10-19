-- Importación de productos desde archivo (tablet de la tienda o dueño/directivo).
-- Existentes (por código de barras, si no por nombre normalizado): precio/disponibilidad directo (cuenta como confirmación de precios).
-- Nuevos: solicitudes "producto nuevo" pendientes (sin foto). Máx. 500 filas por llamada (el cliente parte en bloques, máx. 2000).
create or replace function private.norm_name(t text) returns text language sql immutable set search_path='' as $$
  select btrim(regexp_replace(translate(lower(coalesce(t,'')),'áéíóúüñàèìòùâêîôû','aeiouunaeiouaeiou'),'[^a-z0-9]+',' ','g')) $$;

create or replace function public.import_store_products(p_store bigint, p_rows jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare adm boolean := private.is_admin(); s public.stores; r jsonb; i int := 0; nm text; nn text; cb text; v_pc numeric; v_stk int; dsp boolean;
  pr public.products; oc numeric; np numeric; t bigint := private.now_ms(); nid bigint; cid bigint; por text;
  n_upd int := 0; n_same int := 0; n_new int := 0; n_dup int := 0; errs jsonb := '[]'; seen text[] := '{}';
begin
  if not (adm or coalesce(private.my_store() = p_store, false)) then raise exception 'Sin permiso para importar en esta tienda'; end if;
  select * into s from public.stores where id = p_store;
  if s.id is null then raise exception 'Tienda no encontrada'; end if;
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'Formato inválido'; end if;
  if jsonb_array_length(p_rows) > 500 then raise exception 'Máximo 500 filas por envío'; end if;
  por := case when adm then 'Importación ('||coalesce(private.my_name(),'dueño')||')' else 'Tienda (importación)' end;
  perform pg_advisory_xact_lock(hashtext('mt_import'), p_store::int);
  for r in select * from jsonb_array_elements(p_rows) loop
    i := i + 1;
    nm := left(btrim(coalesce(r->>'n','')),120); nn := private.norm_name(nm); cb := nullif(left(regexp_replace(coalesce(r->>'cb',''),'\s','','g'),40),'');
    if nn = '' then errs := errs || jsonb_build_object('i',coalesce((r->>'row')::int,i),'msg','Falta el nombre'); continue; end if;
    begin v_pc := nullif(r->>'pc','')::numeric; exception when others then v_pc := -1; end;
    if v_pc is not null and (v_pc <= 0 or v_pc > 100000) then errs := errs || jsonb_build_object('i',coalesce((r->>'row')::int,i),'msg','Precio inválido'); continue; end if;
    begin v_stk := nullif(r->>'stk','')::numeric::int; exception when others then v_stk := null; end;
    if v_stk is not null and (v_stk < 0 or v_stk > 1000000) then v_stk := null; end if;
    dsp := case when r ? 'disp' and r->>'disp' is not null then (r->>'disp')::boolean else null end;
    if coalesce(cb,'#'||nn) = any(seen) then n_dup := n_dup + 1; continue; end if;
    seen := seen || coalesce(cb,'#'||nn);
    pr := null;
    if cb is not null then select * into pr from public.products where store_id=p_store and extra->>'cb'=cb order by id limit 1; end if;
    if pr.id is null then select * into pr from public.products where store_id=p_store and private.norm_name(n)=nn order by id limit 1; end if;
    if pr.id is not null then
      select c.pc into oc from public.product_costs c where c.product_id=pr.id;
      if v_pc is not null and v_pc is distinct from oc then
        np := private.venta_para(pr.p, coalesce(oc,0), v_pc);
        insert into public.product_costs(product_id,store_id,pc,pc_est) values(pr.id,p_store,v_pc,false)
          on conflict (product_id) do update set pc=excluded.pc, pc_est=false, updated_at=now();
        select coalesce(max(id),0)+1 into cid from public.price_changes;
        insert into public.price_changes(id,store_id,data) values(cid,p_store,jsonb_build_object('id',cid,'storeId',p_store,'prodId',pr.id,'n',pr.n,'pres',pr.pres,
          'oldPc',coalesce(oc,0),'newPc',v_pc,'oldP',pr.p,'newP',np,'pct',case when oc>0 then round((v_pc-oc)/oc*1000)/10 end,
          'big',coalesce(oc>0 and abs((v_pc-oc)/oc)>0.3,false),'t',t,'por',por));
        update public.products set p=np, extra=extra||jsonb_build_object('upd',jsonb_build_object('t',t,'por','Tienda'),'rev',1) where id=pr.id;
        n_upd := n_upd + 1;
      elsif v_pc is not null then
        update public.product_costs set pc_est=false where product_id=pr.id; n_same := n_same + 1;
      else n_same := n_same + 1;
      end if;
      update public.products set disp=coalesce(dsp, case when v_stk is not null then v_stk>0 else products.disp end), stk=coalesce(v_stk,products.stk),
        extra=case when cb is not null and not (extra ? 'cb') then extra||jsonb_build_object('cb',cb) else extra end, updated_at=now() where id=pr.id;
    else
      if exists(select 1 from public.store_requests q where q.store_id=p_store and q.data->>'st'='pendiente' and q.data->>'tipo'='nuevo'
                and (private.norm_name(q.data->>'n')=nn or (cb is not null and q.data->>'cb'=cb))) then n_dup := n_dup + 1; continue; end if;
      if v_pc is null then errs := errs || jsonb_build_object('i',coalesce((r->>'row')::int,i),'msg','Producto nuevo sin precio'); continue; end if;
      select coalesce(max(id),0)+1 into nid from public.store_requests;
      insert into public.store_requests(id,store_id,data) values(nid,p_store,jsonb_strip_nulls(jsonb_build_object('id',nid,'storeId',p_store,'tipo','nuevo','n',nm,
        'pres',left(coalesce(nullif(btrim(r->>'pres'),''),'1 pza'),60),'nuevo',v_pc,'foto',null,'st','pendiente','t',t,'por',por,'imp',1,'cb',cb,
        'sec',nullif(left(btrim(coalesce(r->>'sec','')),40),''),'stk',v_stk,'disp',case when dsp is null then null when dsp then 1 else 0 end)));
      n_new := n_new + 1;
    end if;
  end loop;
  if n_upd + n_same > 0 then
    update public.stores set extra=extra||jsonb_build_object('revT',t,'revPor',por), updated_at=now() where id=p_store;
  end if;
  perform private.audit('tienda:'||s.n,'Importación de productos', format('%s actualizados · %s sin cambio · %s nuevos enviados a revisión · %s duplicados · %s con error · Por %s',n_upd,n_same,n_new,n_dup,jsonb_array_length(errs),por));
  return jsonb_build_object('upd',n_upd,'same',n_same,'nuevos',n_new,'dup',n_dup,'errs',errs);
end $$;
revoke all on function public.import_store_products(bigint,jsonb) from public, anon;
grant execute on function public.import_store_products(bigint,jsonb) to authenticated;
