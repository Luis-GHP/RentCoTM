-- ============================================================
-- MIGRATION 016
-- Durable in-app notification history.
-- ============================================================

create table if not exists public.notification_event (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references public.user_profile(id) on delete cascade,
  title      text not null,
  body       text not null,
  data       jsonb not null default '{}'::jsonb,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

alter table public.notification_event enable row level security;

drop policy if exists "users: view own notification events" on public.notification_event;
create policy "users: view own notification events"
  on public.notification_event for select
  using (user_id = auth.uid());

drop policy if exists "users: update own notification events" on public.notification_event;
create policy "users: update own notification events"
  on public.notification_event for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "users: delete own notification events" on public.notification_event;
create policy "users: delete own notification events"
  on public.notification_event for delete
  using (user_id = auth.uid());

create index if not exists idx_notification_event_user_created
  on public.notification_event (user_id, created_at desc);

create index if not exists idx_notification_event_user_unread
  on public.notification_event (user_id)
  where read_at is null;
