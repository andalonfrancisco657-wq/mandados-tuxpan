-- Storage (privado salvo fotos de productos) y tiempo real
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('ine','ine',false,5242880,array['image/jpeg','image/png','image/webp']),
 ('selfies','selfies',false,5242880,array['image/jpeg','image/png','image/webp']),
 ('tickets','tickets',false,5242880,array['image/jpeg','image/png','image/webp']),
 ('product-photos','product-photos',true,2097152,array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- cada usuario sube a su carpeta <uid>/...; dueño/directivo pueden ver todo
create policy "own upload private" on storage.objects for insert to authenticated
  with check (bucket_id in ('ine','selfies','tickets') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "own update private" on storage.objects for update to authenticated
  using (bucket_id in ('ine','selfies','tickets') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "own or admin read private" on storage.objects for select to authenticated
  using (bucket_id in ('ine','selfies','tickets') and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.is_admin())));
create policy "admin write product photos" on storage.objects for insert to authenticated
  with check (bucket_id='product-photos' and (select private.is_admin()));
create policy "admin update product photos" on storage.objects for update to authenticated
  using (bucket_id='product-photos' and (select private.is_admin()));
create policy "admin delete product photos" on storage.objects for delete to authenticated
  using (bucket_id='product-photos' and (select private.is_admin()));

-- tiempo real
alter publication supabase_realtime add table public.orders, public.order_events, public.messages;
-- un mensaje nuevo "toca" el pedido para que todos los participantes refresquen
create or replace function private.touch_order() returns trigger language plpgsql security definer set search_path='' as
$$ begin update public.orders set updated_at=now() where id=new.order_id; return new; end $$;
create trigger messages_touch after insert on public.messages for each row execute function private.touch_order();
