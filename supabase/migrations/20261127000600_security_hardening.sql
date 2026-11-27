-- ============ 1) SEGURIDAD ============
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.check_booking_status_change() from public, anon, authenticated;
revoke execute on function public.prepare_booking() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

revoke execute on function public.is_customer() from public, anon;
revoke execute on function public.is_super_admin() from public, anon;
revoke execute on function public.is_customer_of_my_business(uuid) from public, anon;
grant execute on function public.is_customer() to authenticated, service_role;
grant execute on function public.is_super_admin() to authenticated, service_role;
grant execute on function public.is_customer_of_my_business(uuid) to authenticated, service_role;

drop policy if exists "Owners can view their customers" on public.profiles;
create policy "Owners can view their customers"
  on public.profiles for select to authenticated
  using (public.is_customer_of_my_business(id));

alter view public.my_customers set (security_invoker = true);
revoke all on public.my_customers from public, anon;
revoke truncate, references, trigger on public.my_customers from authenticated;
grant select on public.my_customers to authenticated;
