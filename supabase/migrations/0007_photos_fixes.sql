-- Índice de fotos (INE, selfie, tickets) para abrirlas desde otros dispositivos
create table if not exists public.photo_index(key text primary key, bucket text not null, path text not null, owner uuid references auth.users(id) on delete cascade, created_at timestamptz default now());
create index if not exists photo_index_owner on public.photo_index(owner);
alter table public.photo_index enable row level security;
revoke all on public.photo_index from anon, authenticated;

create or replace function public.photo_register(p_key text, p_bucket text, p_path text) returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or p_bucket not in ('ine','selfies','tickets') or split_part(p_path,'/',1)<>auth.uid()::text then raise exception 'No permitido'; end if;
  insert into public.photo_index(key,bucket,path,owner) values(p_key,p_bucket,p_path,auth.uid())
  on conflict (key) do update set bucket=excluded.bucket, path=excluded.path where public.photo_index.owner=auth.uid();
end $$;
create or replace function public.photo_lookup(p_key text) returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('bucket',bucket,'path',path) from public.photo_index where key=p_key and (owner=(select auth.uid()) or private.is_admin())
$$;
revoke all on function public.photo_register(text,text,text), public.photo_lookup(text) from public, anon;
grant execute on function public.photo_register(text,text,text), public.photo_lookup(text) to authenticated;

-- arranque disponible también sin sesión (solo catálogo y configuración)
grant execute on function public.app_bootstrap() to anon;

-- código del directivo sin importar mayúsculas
create or replace function public.claim_directivo(code text) returns boolean language plpgsql security definer set search_path='' as $$
declare h text; u uuid := auth.uid();
begin
  if u is null or coalesce((select is_anonymous from auth.users where id=u),true) then raise exception 'Inicia sesión con correo y contraseña'; end if;
  select value into h from private.secrets where key='directivo_setup' and used_at is null for update;
  if h is null then raise exception 'El código ya se usó o no existe'; end if;
  if extensions.crypt(upper(trim(code)), h) <> h then raise exception 'Código incorrecto'; end if;
  update private.secrets set used_at=now() where key='directivo_setup';
  update public.profiles set role='directivo', store_id=null, tablet_code_id=null where id=u;
  perform private.audit('dir:'||coalesce((select email from public.profiles where id=u),''),'Directivo reclamado con código de configuración');
  return true;
end $$;
revoke all on function public.claim_directivo(text) from public, anon;
grant execute on function public.claim_directivo(text) to authenticated;
