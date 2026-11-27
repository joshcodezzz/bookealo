-- Chat dentro de la app: una conversación por cliente y negocio.
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  customer_name text,
  created_at timestamptz not null default now(),
  last_message_at timestamptz,
  last_message_preview text,
  last_sender_id uuid,
  customer_read_at timestamptz,
  owner_read_at timestamptz,
  unique (business_id, customer_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists conversations_customer_idx on public.conversations (customer_id, last_message_at desc);
create index if not exists conversations_business_idx on public.conversations (business_id, last_message_at desc);
create index if not exists messages_conversation_idx on public.messages (conversation_id, created_at);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- ¿El usuario actual participa en esta conversación? (cliente, dueño del negocio o super admin)
create or replace function public.is_conversation_participant(p_conversation uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversations c
    join public.businesses b on b.id = c.business_id
    where c.id = p_conversation
      and (c.customer_id = auth.uid() or b.owner_id = auth.uid() or public.is_super_admin())
  );
$$;

revoke all on function public.is_conversation_participant(uuid) from public, anon;
grant execute on function public.is_conversation_participant(uuid) to authenticated;

drop policy if exists "Participants view conversations" on public.conversations;
create policy "Participants view conversations"
  on public.conversations for select to authenticated
  using (public.is_conversation_participant(id));

-- Solo un cliente puede abrir una conversación, y solo a su nombre, con un negocio activo que tenga dueño.
drop policy if exists "Customers start conversations" on public.conversations;
create policy "Customers start conversations"
  on public.conversations for insert to authenticated
  with check (
    customer_id = auth.uid()
    and public.is_customer()
    and exists (
      select 1 from public.businesses b
      where b.id = business_id and b.is_active and b.owner_id is not null
    )
  );

drop policy if exists "Participants view messages" on public.messages;
create policy "Participants view messages"
  on public.messages for select to authenticated
  using (public.is_conversation_participant(conversation_id));

drop policy if exists "Participants send messages" on public.messages;
create policy "Participants send messages"
  on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and public.is_conversation_participant(conversation_id));

-- Al llegar un mensaje se actualiza el resumen de la conversación y se marca como leída para quien lo envió.
create or replace function public.on_message_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations c
     set last_message_at = new.created_at,
         last_message_preview = left(new.body, 120),
         last_sender_id = new.sender_id,
         customer_read_at = case when c.customer_id = new.sender_id then new.created_at else c.customer_read_at end,
         owner_read_at = case when c.customer_id <> new.sender_id then new.created_at else c.owner_read_at end
   where c.id = new.conversation_id;
  return new;
end;
$$;

revoke all on function public.on_message_created() from public, anon, authenticated;

drop trigger if exists messages_after_insert on public.messages;
create trigger messages_after_insert
  after insert on public.messages
  for each row execute function public.on_message_created();

-- Marca la conversación como leída para quien la abre.
create or replace function public.mark_conversation_read(p_conversation uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_conversation_participant(p_conversation) then
    return;
  end if;
  update public.conversations c
     set customer_read_at = case when c.customer_id = auth.uid() then now() else c.customer_read_at end,
         owner_read_at = case when c.customer_id <> auth.uid() then now() else c.owner_read_at end
   where c.id = p_conversation;
end;
$$;

revoke all on function public.mark_conversation_read(uuid) from public, anon;
grant execute on function public.mark_conversation_read(uuid) to authenticated;
