-- Conteo público de reservas por negocio, para mostrar prueba social real en el catálogo.
-- Solo devuelve números agregados (nunca nombres, teléfonos ni horarios de clientes).
-- Cuenta reservas reales creadas en el periodo: pendientes o confirmadas.
-- Las franjas bloqueadas por el dueño ("blocked") y las canceladas no cuentan.

create or replace function public.get_business_booking_counts(p_since timestamptz)
returns table (business_id uuid, booking_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select s.business_id, count(b.id) as booking_count
  from public.bookings b
  join public.services s on s.id = b.service_id
  join public.businesses biz on biz.id = s.business_id
  where b.status in ('pending', 'confirmed')
    and b.created_at >= p_since
    and biz.is_active
  group by s.business_id;
$$;

revoke all on function public.get_business_booking_counts(timestamptz) from public;
grant execute on function public.get_business_booking_counts(timestamptz) to anon, authenticated;
