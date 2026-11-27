-- Galería de cada negocio: fotos, videos y modelos 3D (.glb).
create table if not exists public.business_media (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  kind text not null check (kind in ('image', 'video', 'model3d')),
  storage_path text not null,
  url text not null,
  title text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists business_media_business_idx
  on public.business_media (business_id, position, created_at);

alter table public.business_media enable row level security;

drop policy if exists "Public can view media of active businesses" on public.business_media;
create policy "Public can view media of active businesses"
  on public.business_media for select
  using (exists (select 1 from public.businesses b where b.id = business_id and b.is_active));

drop policy if exists "Super admin manages media" on public.business_media;
create policy "Super admin manages media"
  on public.business_media for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Bucket público de lectura; solo el super admin sube o borra. Límite 50 MB por archivo.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'business-media', 'business-media', true, 52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'model/gltf-binary']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Super admin reads business media" on storage.objects;
create policy "Super admin reads business media"
  on storage.objects for select to authenticated
  using (bucket_id = 'business-media' and public.is_super_admin());

drop policy if exists "Super admin uploads business media" on storage.objects;
create policy "Super admin uploads business media"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'business-media' and public.is_super_admin());

drop policy if exists "Super admin deletes business media" on storage.objects;
create policy "Super admin deletes business media"
  on storage.objects for delete to authenticated
  using (bucket_id = 'business-media' and public.is_super_admin());
