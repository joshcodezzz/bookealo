-- En este proyecto las tablas nuevas no reciben permisos automáticos: hay que darlos tabla por tabla.
-- Las políticas RLS siguen decidiendo qué filas ve o escribe cada usuario.
grant select, insert on public.conversations to authenticated;
grant select, insert on public.messages to authenticated;

grant select on public.business_media to anon, authenticated;
grant insert, update, delete on public.business_media to authenticated;

grant select on public.booking_reminders to authenticated;
grant select, update on public.booking_reminders to service_role;

-- Al crear una conversación, la fila recién insertada aún no era visible para la función que
-- comprobaba la participación y la base rechazaba la creación. Se comprueba con las columnas.
drop policy if exists "Participants view conversations" on public.conversations;
create policy "Participants view conversations"
  on public.conversations for select to authenticated
  using (
    customer_id = auth.uid()
    or public.is_super_admin()
    or exists (
      select 1 from public.businesses b
      where b.id = business_id and b.owner_id = auth.uid()
    )
  );
