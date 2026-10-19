-- v29: estados de tienda (activa / inactiva / eliminada). Eliminar = borrado suave (pedidos e historial intactos).
alter table public.stores add column if not exists deleted_at timestamptz, add column if not exists deleted_by text;
-- tienda eliminada: siempre act=false, así clientes, mapa, pedidos y login de tablet (que exigen act) ya la excluyen
create or replace function private.store_json(s public.stores, with_cost boolean) returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('id',s.id,'cat',s.cat,'n',s.n,'tipo',s.tipo,'col',s.col,'hor',s.hor,'act',case when s.act then 1 else 0 end,'ej',s.ej,'lat',s.lat,'lng',s.lng) || s.extra
   || case when s.deleted_at is not null then jsonb_build_object('del',(extract(epoch from s.deleted_at)*1000)::bigint,'delPor',s.deleted_by) else '{}' end
   || jsonb_build_object('tab',(select jsonb_build_object('act',case when t.act then 1 else 0 end,'t',(extract(epoch from t.created_at)*1000)::bigint,'por',t.por,
        'last',(extract(epoch from t.last_used)*1000)::bigint) from public.tablet_codes t where t.store_id=s.id order by t.id desc limit 1))
   || jsonb_build_object('prods',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'n',p.n,'pres',p.pres,'p',p.p,'sec',p.sec,'e',p.e,
        'disp',case when p.disp then 1 else 0 end,'stk',p.stk,'ej',p.ej) || p.extra
        || case when with_cost then jsonb_build_object('pc',c.pc,'pcEst',case when c.pc_est then 1 else 0 end) else '{}' end order by p.ord,p.id)
      from public.products p left join public.product_costs c on c.product_id=p.id where p.store_id=s.id),'[]')) $$;
-- la tablet de una tienda eliminada tampoco ve su catálogo
create or replace function public.get_catalog() returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(private.store_json(s, private.is_admin() or s.id=private.my_store()) order by s.id),'[]')
  from public.stores s where (s.act and s.deleted_at is null) or private.is_admin() or s.id=private.my_store() $$;
drop policy if exists stores_sel on public.stores;
create policy stores_sel on public.stores for select using ((act and deleted_at is null) or (select private.is_admin()));

create or replace function public.store_state(p_store bigint, p_action text, p_motivo text default '') returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.stores; nm text := coalesce(private.my_name(),'Admin');
begin
  if not private.is_admin() then raise exception 'Solo dueño o directivo'; end if;
  select * into s from public.stores where id=p_store for update; if s.id is null then raise exception 'Tienda no existe'; end if;
  if p_action='deactivate' then
    if s.deleted_at is not null then raise exception 'La tienda está eliminada'; end if;
    update public.stores set act=false, extra=extra||jsonb_build_object('inMot',coalesce(p_motivo,''),'inT',private.now_ms(),'inPor',nm), updated_at=now() where id=p_store;
    perform private.audit('tienda:'||s.n,'Tienda desactivada',coalesce(p_motivo,''));
  elsif p_action='reactivate' then
    if s.deleted_at is not null then raise exception 'Primero restaura la tienda'; end if;
    update public.stores set act=true, extra=extra-'inMot'-'inT'-'inPor', updated_at=now() where id=p_store;
    update private.store_auth set blocked=false where store_id=p_store;
    perform private.audit('tienda:'||s.n,'Tienda reactivada');
  elsif p_action='delete' then
    if s.deleted_at is not null then return public.get_catalog(); end if;
    update public.stores set act=false, deleted_at=now(), deleted_by=nm, extra=extra||jsonb_build_object('delAct',case when s.act then 1 else 0 end), updated_at=now() where id=p_store;
    update public.tablet_codes set act=false where store_id=p_store;
    insert into private.store_auth(store_id) values(p_store) on conflict do nothing;
    update private.store_auth set epoch=epoch+1 where store_id=p_store;
    perform private.audit('tienda:'||s.n,'Tienda eliminada',coalesce(p_motivo,''));
  elsif p_action='restore' then
    if s.deleted_at is null then return public.get_catalog(); end if;
    update public.stores set deleted_at=null, deleted_by=null, extra=extra-'delAct'||jsonb_build_object('inMot','Restaurada; revisa y reactívala','inT',private.now_ms(),'inPor',nm), updated_at=now() where id=p_store;
    perform private.audit('tienda:'||s.n,'Tienda restaurada','Queda inactiva hasta reactivarla');
  else raise exception 'Acción no válida'; end if;
  return public.get_catalog();
end $$;
revoke all on function public.store_state(bigint,text,text) from public, anon;
grant execute on function public.store_state(bigint,text,text) to authenticated;
CREATE OR REPLACE FUNCTION public.sync_catalog(p_stores jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare s jsonb; pr jsonb; sid bigint; pid bigint; adm boolean := private.is_admin(); ms bigint := private.my_store(); old public.products; oc numeric; np numeric; i int; keep bigint[];
begin
  if not adm and ms is null then raise exception 'Sin permiso para el catálogo'; end if;
  for s in select * from jsonb_array_elements(p_stores) loop
    sid := (s->>'id')::bigint;
    if adm then
      if not exists(select 1 from public.stores where id=sid) and coalesce((s->>'del')::bigint,0)>0 then continue; end if;
      insert into public.stores(id,cat,n,tipo,col,hor,act,ej,extra) values(sid,s->>'cat',s->>'n',coalesce(s->>'tipo',''),coalesce(s->>'col',''),coalesce(s->>'hor',''),
        coalesce((s->>'act')::int,1)=1, coalesce((s->>'ej')::boolean,false), s - array['id','cat','n','tipo','col','hor','act','ej','prods','tab','lat','lng','del','delPor','st'])
      on conflict (id) do update set cat=excluded.cat,n=excluded.n,tipo=excluded.tipo,col=excluded.col,hor=excluded.hor,act=case when public.stores.deleted_at is not null then false else excluded.act end,extra=excluded.extra,updated_at=now();
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
end $function$
;