-- La tablet de la tienda puede subir/cambiar fotos solo en la carpeta de su tienda (<store_id>/...)
create policy "store write own product photos" on storage.objects for insert to authenticated
  with check (bucket_id='product-photos' and (storage.foldername(name))[1] = (select private.my_store())::text);
create policy "store update own product photos" on storage.objects for update to authenticated
  using (bucket_id='product-photos' and (storage.foldername(name))[1] = (select private.my_store())::text);
create policy "store read own product photos" on storage.objects for select to authenticated
  using (bucket_id='product-photos' and ((storage.foldername(name))[1] = (select private.my_store())::text or (select private.is_admin())));
