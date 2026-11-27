-- Plan de suscripción de cada negocio. Define qué ve el dueño en /panel/metricas.
-- Solo un super admin puede cambiarlo: las políticas de businesses no dejan que el dueño edite su fila.
alter table public.businesses
  add column if not exists plan text not null default 'gratis';

alter table public.businesses drop constraint if exists businesses_plan_check;
alter table public.businesses
  add constraint businesses_plan_check check (plan in ('gratis', 'pro'));

comment on column public.businesses.plan is
  'gratis | pro. Pro desbloquea el panel de métricas completo. Lo cambia solo el super admin.';
