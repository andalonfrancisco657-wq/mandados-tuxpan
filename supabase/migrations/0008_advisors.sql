-- Correcciones de los advisors de Supabase
-- función interna creada por "RLS automático": no debe llamarse desde la API
do $$ begin
  if exists(select 1 from pg_proc where proname='rls_auto_enable' and pronamespace='public'::regnamespace) then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;
drop function if exists public.tablet_touch();
-- tablas solo accesibles por funciones seguras: política explícita de "sin acceso directo"
create policy no_direct_access on public.order_private for all to anon, authenticated using (false) with check (false);
create policy no_direct_access on public.order_items for all to anon, authenticated using (false) with check (false);
create policy no_direct_access on public.admin_notes for all to anon, authenticated using (false) with check (false);
create policy no_direct_access on public.photo_index for all to anon, authenticated using (false) with check (false);
-- cada usuario puede borrar sus propias fotos privadas
create policy "own delete private" on storage.objects for delete to authenticated
  using (bucket_id in ('ine','selfies','tickets') and (storage.foldername(name))[1] = (select auth.uid())::text);
