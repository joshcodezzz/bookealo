-- El administrador asigna (o quita) al dueño de un negocio usando el correo de su cuenta.
create or replace function public.admin_assign_owner(p_business uuid, p_email text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_role text;
begin
  if not public.is_super_admin() then
    raise exception 'Solo el administrador puede asignar dueños';
  end if;

  if p_email is null or trim(p_email) = '' then
    update public.businesses set owner_id = null where id = p_business;
    if not found then raise exception 'No encontramos ese negocio'; end if;
    return 'removed';
  end if;

  select id into v_user from auth.users where lower(email) = lower(trim(p_email));
  if v_user is null then
    raise exception 'No existe una cuenta con ese correo. Pídele que se registre primero.';
  end if;

  select role::text into v_role from public.profiles where id = v_user;
  if v_role = 'super_admin' then
    raise exception 'Una cuenta de administrador no puede ser dueña de un negocio';
  end if;
  -- El panel del dueño maneja un negocio por cuenta.
  if exists (select 1 from public.businesses where owner_id = v_user and id <> p_business) then
    raise exception 'Esa cuenta ya es dueña de otro negocio';
  end if;

  update public.businesses set owner_id = v_user where id = p_business;
  if not found then raise exception 'No encontramos ese negocio'; end if;

  update public.profiles set role = 'business_owner' where id = v_user and role::text = 'customer';
  return 'assigned';
end;
$$;

revoke all on function public.admin_assign_owner(uuid, text) from public, anon;
grant execute on function public.admin_assign_owner(uuid, text) to authenticated;

-- Correo del dueño de cada negocio, solo para el panel del administrador.
create or replace function public.admin_business_owners()
returns table (business_id uuid, owner_email text)
language sql
stable
security definer
set search_path = public
as $$
  select b.id, u.email::text
  from public.businesses b
  join auth.users u on u.id = b.owner_id
  where public.is_super_admin();
$$;

revoke all on function public.admin_business_owners() from public, anon;
grant execute on function public.admin_business_owners() to authenticated;
