-- ============================================================
-- MIGRATION 002
-- 1. push_token column on user_profile (Expo push notifications)
-- 2. RLS policies so users can read/update their own profile
-- 3. create_landlord_profile() RPC (called by register.tsx)
-- Run this in Supabase dashboard → SQL Editor after 001_schema.sql
-- ============================================================


-- ── 1. Push token ─────────────────────────────────────────────
alter table user_profile
  add column if not exists push_token text;


-- ── 2. user_profile RLS policies ──────────────────────────────
-- auth.ts fetches the profile on every app load — needs SELECT.
-- Expo push token update needs UPDATE on own row only.

create policy "user: read own profile"
  on user_profile for select
  using (id = auth.uid());

create policy "user: update own push token"
  on user_profile for update
  using (id = auth.uid())
  with check (id = auth.uid());


-- ── 3. create_landlord_profile RPC ────────────────────────────
-- Called immediately after supabase.auth.signUp() in register.tsx.
-- Creates the landlord row and user_profile row in one transaction.
-- security definer so it can write to both tables regardless of RLS.
create or replace function create_landlord_profile(
  p_name  text,
  p_email text
) returns void language plpgsql security definer as $$
declare
  v_landlord_id uuid;
begin
  insert into landlord (user_id, name, email)
  values (auth.uid(), p_name, p_email)
  returning id into v_landlord_id;

  insert into user_profile (id, role, landlord_id)
  values (auth.uid(), 'landlord', v_landlord_id);
end;
$$;
