-- ===========================================================================
-- Document Assistant — chat persistence schema
-- ---------------------------------------------------------------------------
-- Run this ONCE in the Supabase Dashboard → SQL Editor (the corporate proxy
-- blocks a direct Postgres connection, so migrations can't be applied from the
-- app). After running it, conversations + messages persist per signed-in user.
--
-- Security model: RLS scopes every row to the authenticated user (auth.uid()),
-- so the app's cookie-bound Supabase client only ever sees its owner's data.
-- ===========================================================================

create extension if not exists "pgcrypto";

-- --- Conversations ---------------------------------------------------------
create table if not exists public.conversations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title      text not null default 'New chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists conversations_user_updated_idx
  on public.conversations (user_id, updated_at desc);

-- --- Messages (one row per AI SDK UIMessage; `parts` stored verbatim) -------
create table if not exists public.messages (
  id              text primary key,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  role            text not null,
  parts           jsonb not null default '[]'::jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at);

-- --- Row Level Security -----------------------------------------------------
alter table public.conversations enable row level security;
alter table public.messages      enable row level security;

drop policy if exists conversations_owner on public.conversations;
create policy conversations_owner on public.conversations
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists messages_owner on public.messages;
create policy messages_owner on public.messages
  for all
  using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.conversations to authenticated;
grant select, insert, update, delete on public.messages      to authenticated;

-- --- Keep updated_at fresh on every conversation update --------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists conversations_set_updated_at on public.conversations;
create trigger conversations_set_updated_at
  before update on public.conversations
  for each row execute function public.set_updated_at();
