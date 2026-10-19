-- Funciones auxiliares (schema private, no expuesto por la API) y RLS
grant usage on schema private to anon, authenticated;

create or replace function private.my_role() returns text language sql stable security definer set search_path='' as
$$ select coalesce((select role from public.profiles where id = (select auth.uid())), 'none') $$;
create or replace function private.my_name() returns text language sql stable security definer set search_path='' as
$$ select nombre from public.profiles where id = (select auth.uid()) $$;
create or replace function private.my_store() returns bigint language sql stable security definer set search_path='' as
$$ select p.store_id from public.profiles p join public.tablet_codes t on t.id=p.tablet_code_id and t.act and t.store_id=p.store_id
   where p.id=(select auth.uid()) and p.role='tienda' $$;
create or replace function private.sanctioned(k text) returns boolean language sql stable security definer set search_path='' as
$$ select exists(select 1 from public.sanctions s where s.key=k and s.data->>'st' in ('suspendido','baja')
     and not (s.data->>'st'='suspendido' and (s.data->>'hasta') is not null and (s.data->>'hasta')::bigint < extract(epoch from now())*1000)) $$;
create or replace function private.is_dir() returns boolean language sql stable security definer set search_path='' as
$$ select private.my_role()='directivo' $$;
create or replace function private.is_admin() returns boolean language sql stable security definer set search_path='' as
$$ select private.my_role()='directivo' or (private.my_role()='dueno' and not private.sanctioned('due:'||coalesce(private.my_name(),''))) $$;
create or replace function private.rep_ok() returns boolean language sql stable security definer set search_path='' as
$$ select exists(select 1 from public.profiles where id=(select auth.uid()) and role='repartidor' and verified)
   and not private.sanctioned('rep:'||coalesce(private.my_name(),'')) $$;
revoke all on all functions in schema private from public;
grant execute on all functions in schema private to anon, authenticated;

-- nuevo usuario -> perfil cliente (los roles solo se cambian con funciones seguras)
create or replace function private.on_new_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.profiles(id,email,nombre,tel) values(new.id, lower(new.email),
    coalesce(new.raw_user_meta_data->>'nombre',''), coalesce(new.raw_user_meta_data->>'tel',''))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.on_new_user();

-- ===== RLS en todas las tablas =====
do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname='public' loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- profiles: cada quien ve el suyo; admins ven todos. Solo puede editar nombre/tel/data (no rol, tienda ni verificación)
grant select on public.profiles to authenticated;
grant update (nombre, tel, data) on public.profiles to authenticated;
create policy profiles_sel on public.profiles for select to authenticated using (id=(select auth.uid()) or (select private.is_admin()));
create policy profiles_upd on public.profiles for update to authenticated using (id=(select auth.uid())) with check (id=(select auth.uid()));

-- catálogo público (sin precio de compra)
grant select on public.stores, public.products to anon, authenticated;
create policy stores_sel on public.stores for select to anon, authenticated using (act or (select private.is_admin()));
create policy products_sel on public.products for select to anon, authenticated using (true);
grant select on public.product_costs to authenticated;
create policy costs_sel on public.product_costs for select to authenticated using ((select private.is_admin()) or store_id=(select private.my_store()));

grant select on public.settings to anon, authenticated;
create policy settings_sel on public.settings for select to anon, authenticated using (key in ('cfg','dirCfg'));

-- pedidos: lectura directa limitada (para tiempo real); los datos completos/filtrados por rol salen de get_orders()
grant select on public.orders, public.order_events, public.messages to authenticated;
create policy orders_sel on public.orders for select to authenticated using (
  (select private.is_admin()) or client_id=(select auth.uid()) or rep_id=(select auth.uid())
  or (rep_id is null and not cancel and (select private.rep_ok()))
  or (store_id is not null and store_id=(select private.my_store())));
create policy events_sel on public.order_events for select to authenticated using (
  exists(select 1 from public.orders o where o.id=order_id));
create policy messages_sel on public.messages for select to authenticated using (
  exists(select 1 from public.orders o where o.id=order_id and (
    (select private.is_admin()) or o.client_id=(select auth.uid())
    or (o.rep_id=(select auth.uid()) and not messages.cli)
    or (o.store_id=(select private.my_store()) and (messages.de='tienda' or messages.kind='na')))));

-- tablas solo para administración (lectura directa); escritura vía funciones
grant select on public.complaints, public.sanctions, public.audit_log, public.repartidor_registrations,
  public.bank_accounts, public.payouts, public.cash_deposits, public.store_credit_ledger,
  public.store_requests, public.price_changes, public.tablet_codes to authenticated;
create policy adm_complaints on public.complaints for select to authenticated using ((select private.is_admin()) or client_id=(select auth.uid()));
create policy adm_sanctions on public.sanctions for select to authenticated using ((select private.is_admin()));
create policy adm_audit on public.audit_log for select to authenticated using ((select private.is_admin()));
create policy own_regs on public.repartidor_registrations for select to authenticated using ((select private.is_admin()) or user_id=(select auth.uid()));
create policy own_bank on public.bank_accounts for select to authenticated using ((select private.is_admin()) or user_id=(select auth.uid()));
create policy own_payouts on public.payouts for select to authenticated using ((select private.is_admin()) or rep_name=(select private.my_name()) and (select private.my_role())='repartidor');
create policy own_cash on public.cash_deposits for select to authenticated using ((select private.is_admin()) or rep_name=(select private.my_name()) and (select private.my_role())='repartidor');
create policy store_credit on public.store_credit_ledger for select to authenticated using ((select private.is_admin()) or store_id=(select private.my_store()));
create policy store_req on public.store_requests for select to authenticated using ((select private.is_admin()) or store_id=(select private.my_store()));
create policy store_pchg on public.price_changes for select to authenticated using ((select private.is_admin()) or store_id=(select private.my_store()));
create policy adm_tablets on public.tablet_codes for select to authenticated using ((select private.is_admin()));
-- order_private, order_items, admin_notes: sin políticas => solo accesibles por funciones security definer
