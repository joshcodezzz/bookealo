-- Solicitudes de negocios para aparecer en Bookealo. Publicar es gratis; cada solicitud la revisa
-- el administrador a mano antes de crear el negocio.

alter table public.businesses add column if not exists description text;

create table if not exists public.business_applications (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  business_name text not null check (char_length(business_name) between 2 and 80),
  category text not null check (char_length(category) between 2 and 30),
  zone text check (zone is null or char_length(zone) <= 80),
  phone text check (phone is null or char_length(phone) <= 30),
  maps_url text check (maps_url is null or char_length(maps_url) <= 500),
  instagram text check (instagram is null or char_length(instagram) <= 60),
  description text not null check (char_length(description) between 80 and 600),
  services_text text not null check (char_length(services_text) between 10 and 600),
  -- [{ "path": "solicitudes/<usuario>/<archivo>", "url": "https://…" }]
  photos jsonb not null default '[]'::jsonb check (jsonb_typeof(photos) = 'array' and jsonb_array_length(photos) <= 8),
  review_note text check (review_note is null or char_length(review_note) <= 500),
  business_id uuid references public.businesses(id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

-- Una sola solicitud en revisión por cuenta.
create unique index if not exists business_applications_one_pending
  on public.business_applications (applicant_id) where status = 'pending';
create index if not exists business_applications_status_idx
  on public.business_applications (status, created_at desc);

alter table public.business_applications enable row level security;

drop policy if exists "Applicants view own applications" on public.business_applications;
create policy "Applicants view own applications"
  on public.business_applications for select to authenticated
  using (applicant_id = auth.uid() or public.is_super_admin());

drop policy if exists "Customers submit applications" on public.business_applications;
create policy "Customers submit applications"
  on public.business_applications for insert to authenticated
  with check (
    applicant_id = auth.uid()
    and status = 'pending'
    and business_id is null
    and review_note is null
    and reviewed_at is null
    and public.is_customer()
  );

drop policy if exists "Super admin reviews applications" on public.business_applications;
create policy "Super admin reviews applications"
  on public.business_applications for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- En este proyecto los permisos de tabla se dan a mano.
grant select, insert, update on public.business_applications to authenticated;

-- Quien solicita sube sus fotos a su propia carpeta dentro del bucket de la galería.
drop policy if exists "Applicants upload application photos" on storage.objects;
create policy "Applicants upload application photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'business-media'
    and (storage.foldername(name))[1] = 'solicitudes'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- Aprobar: crea el negocio (oculto hasta que el administrador lo publique), lo asigna a quien
-- lo solicitó, pasa sus fotos a la galería y marca la solicitud como aprobada.
create or replace function public.admin_approve_application(p_application uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.business_applications;
  v_business uuid;
  v_photo jsonb;
  v_path text;
  v_url text;
  v_position integer := 0;
  v_cover text;
begin
  if not public.is_super_admin() then
    raise exception 'Solo el administrador puede aprobar solicitudes';
  end if;

  select * into a from public.business_applications where id = p_application for update;
  if not found then raise exception 'No encontramos esa solicitud'; end if;
  if a.status <> 'pending' then raise exception 'Esa solicitud ya fue revisada'; end if;

  if (select role::text from public.profiles where id = a.applicant_id) = 'super_admin' then
    raise exception 'Una cuenta de administrador no puede ser dueña de un negocio';
  end if;
  if exists (select 1 from public.businesses where owner_id = a.applicant_id) then
    raise exception 'Esa cuenta ya es dueña de un negocio';
  end if;

  insert into public.businesses (name, category, zone, phone, maps_url, description, amenities, plan, is_active, owner_id)
  values (a.business_name, a.category, a.zone, a.phone, a.maps_url, a.description, '[]'::jsonb, 'gratis', false, a.applicant_id)
  returning id into v_business;

  for v_photo in select * from jsonb_array_elements(a.photos) loop
    v_path := v_photo->>'path';
    v_url := v_photo->>'url';
    -- Solo se aceptan archivos que la persona subió a su carpeta y que existen en el bucket.
    if v_path is not null
       and v_path like 'solicitudes/' || a.applicant_id::text || '/%'
       and v_url like 'https://%'
       and right(v_url, char_length('/storage/v1/object/public/business-media/' || v_path))
           = '/storage/v1/object/public/business-media/' || v_path
       and exists (select 1 from storage.objects o where o.bucket_id = 'business-media' and o.name = v_path)
    then
      insert into public.business_media (business_id, kind, storage_path, url, position)
      values (v_business, 'image', v_path, v_url, v_position);
      if v_cover is null then v_cover := v_url; end if;
      v_position := v_position + 1;
    end if;
  end loop;

  if v_cover is not null then
    update public.businesses set cover_image_url = v_cover where id = v_business;
  end if;

  update public.profiles set role = 'business_owner' where id = a.applicant_id and role::text = 'customer';

  update public.business_applications
     set status = 'approved', business_id = v_business, reviewed_at = now()
   where id = a.id;

  return v_business;
end;
$$;

revoke all on function public.admin_approve_application(uuid) from public, anon;
grant execute on function public.admin_approve_application(uuid) to authenticated;
