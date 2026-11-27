-- Categoría de cada negocio, para la cuadrícula de categorías del inicio.
-- Mientras esté vacía, la app la deduce por el nombre (src/lib/categories.ts).

alter table public.businesses
  add column if not exists category text;

alter table public.businesses
  drop constraint if exists businesses_category_check;

alter table public.businesses
  add constraint businesses_category_check check (
    category is null or category in (
      'talents',   -- Bookealo Talents: freelancers (pianistas, detailing, limpieza de casas…)
      'mandaos',   -- Manda'os: trabajos pequeños, "ve, búscame esto y tráemelo"
      'belleza',   -- Belleza y Estilo
      'bienestar', -- Bienestar y Spa
      'hogar',     -- Hogar y Reparaciones
      'limpieza',  -- Limpieza
      'deportes',  -- Deportes y Espacios
      'clases',    -- Clases y Tutorías
      'mascotas'   -- Mascotas
    )
  );

-- Valores iniciales para los negocios actuales (ajústalos si alguno no encaja).
update public.businesses set category = 'deportes'
  where category is null and name ~* '(soccer|f[uú]tbol|p[aá]del|sport|club|yacht|yate)';
update public.businesses set category = 'belleza'
  where category is null and name ~* '(barber|hair|sal[oó]n|nails|beauty)';
