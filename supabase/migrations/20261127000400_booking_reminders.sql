-- Recordatorios de reserva: 24 horas, 2 horas y 30 minutos antes.
-- La base arma la cola sola cada 5 minutos (pg_cron). El envío por WhatsApp se conecta después:
-- /api/reminders/send toma las filas 'queued' y las manda.

create extension if not exists pg_cron with schema pg_catalog;

create table if not exists public.booking_reminders (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  kind text not null check (kind in ('24h', '2h', '30m')),
  due_at timestamptz not null,
  to_name text,
  to_phone text,
  message text not null,
  -- Variables de la plantilla de WhatsApp: name, business, service, when, date, time
  params jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'skipped')),
  error text,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (booking_id, kind)
);

create index if not exists booking_reminders_status_idx
  on public.booking_reminders (status, due_at);

-- Contiene teléfonos: solo el super admin puede verla. El envío usa la clave de servicio.
alter table public.booking_reminders enable row level security;

drop policy if exists "Super admin views reminders" on public.booking_reminders;
create policy "Super admin views reminders"
  on public.booking_reminders for select to authenticated
  using (public.is_super_admin());

create or replace function public.enqueue_due_reminders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted integer := 0;
  step integer;
  k record;
begin
  for k in
    select * from (values
      ('24h', interval '24 hours', 'mañana'),
      ('2h',  interval '2 hours',  'en 2 horas'),
      ('30m', interval '30 minutes', 'en 30 minutos')
    ) as t(kind, lead, phrase)
  loop
    insert into public.booking_reminders (booking_id, kind, due_at, to_name, to_phone, message, params, status, error)
    select
      b.id,
      k.kind,
      b.start_time - k.lead,
      coalesce(p.full_name, b.guest_name),
      coalesce(nullif(trim(p.phone), ''), nullif(trim(b.guest_phone), '')),
      format(
        'Hola %s, te recordamos tu reserva en %s (%s) %s: %s a las %s. Si no puedes asistir, cancélala desde Bookealo.',
        coalesce(nullif(split_part(coalesce(p.full_name, b.guest_name, ''), ' ', 1), ''), ''),
        biz.name,
        s.name,
        k.phrase,
        to_char(b.start_time at time zone 'America/Panama', 'DD/MM'),
        trim(to_char(b.start_time at time zone 'America/Panama', 'HH12:MI AM'))
      ),
      jsonb_build_object(
        'name', coalesce(nullif(split_part(coalesce(p.full_name, b.guest_name, ''), ' ', 1), ''), 'cliente'),
        'business', biz.name,
        'service', s.name,
        'when', k.phrase,
        'date', to_char(b.start_time at time zone 'America/Panama', 'DD/MM'),
        'time', trim(to_char(b.start_time at time zone 'America/Panama', 'HH12:MI AM'))
      ),
      case when coalesce(nullif(trim(p.phone), ''), nullif(trim(b.guest_phone), '')) is null then 'skipped' else 'queued' end,
      case when coalesce(nullif(trim(p.phone), ''), nullif(trim(b.guest_phone), '')) is null then 'Sin teléfono' else null end
    from public.bookings b
    join public.services s on s.id = b.service_id
    join public.businesses biz on biz.id = s.business_id
    left join public.profiles p on p.id = b.customer_id
    where b.status = 'confirmed'
      and b.start_time > now()
      -- Ya llegó el momento del aviso, con 15 minutos de margen.
      and b.start_time - k.lead <= now()
      and b.start_time - k.lead > now() - interval '15 minutes'
      -- Si la reserva se hizo después de ese momento, ese aviso ya no aplica.
      and b.created_at <= b.start_time - k.lead
    on conflict (booking_id, kind) do nothing;

    get diagnostics step = row_count;
    inserted := inserted + step;
  end loop;

  -- Si la reserva se canceló, sus avisos pendientes ya no se envían.
  update public.booking_reminders r
     set status = 'skipped', error = 'Reserva cancelada'
    from public.bookings b
   where b.id = r.booking_id and r.status = 'queued' and b.status <> 'confirmed';

  return inserted;
end;
$$;

revoke all on function public.enqueue_due_reminders() from public, anon, authenticated;

select cron.schedule('bookealo-reminders', '*/5 * * * *', $cron$select public.enqueue_due_reminders()$cron$);
