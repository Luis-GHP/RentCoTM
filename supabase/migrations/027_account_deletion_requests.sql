-- ============================================================
-- MIGRATION 027
-- Account and data deletion request intake.
-- This supports Apple/Google in-app account deletion initiation
-- while preserving manual review for lease, payment, tax, and
-- legal-retention obligations.
-- ============================================================

create table if not exists public.account_deletion_request (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('landlord', 'tenant')),
  landlord_id uuid references public.landlord(id) on delete set null,
  tenant_id uuid references public.tenant(id) on delete set null,
  status text not null default 'requested' check (status in ('requested', 'in_review', 'completed', 'cancelled', 'rejected')),
  reason text,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  admin_notes text
);

create index if not exists idx_account_deletion_request_user_requested
  on public.account_deletion_request (user_id, requested_at desc);

create unique index if not exists idx_account_deletion_request_one_open
  on public.account_deletion_request (user_id)
  where status in ('requested', 'in_review');

alter table public.account_deletion_request enable row level security;

drop policy if exists "user: view own deletion requests" on public.account_deletion_request;
create policy "user: view own deletion requests"
  on public.account_deletion_request for select
  to authenticated
  using (user_id = auth.uid());

revoke all on public.account_deletion_request from authenticated;

grant select (
  id,
  user_id,
  role,
  status,
  reason,
  requested_at,
  completed_at
) on public.account_deletion_request to authenticated;

drop function if exists public.request_account_deletion(text);

create or replace function public.request_account_deletion(
  p_reason text default null
) returns table (
  request_id uuid,
  request_status text,
  requested_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.user_profile%rowtype;
  v_existing public.account_deletion_request%rowtype;
  v_request public.account_deletion_request%rowtype;
begin
  select *
  into v_profile
  from public.user_profile
  where id = auth.uid();

  if not found then
    raise exception 'Account profile not found';
  end if;

  select *
  into v_existing
  from public.account_deletion_request
  where user_id = auth.uid()
    and status in ('requested', 'in_review')
  order by requested_at desc
  limit 1;

  if found then
    return query
      select v_existing.id, v_existing.status, v_existing.requested_at;
    return;
  end if;

  insert into public.account_deletion_request (
    user_id,
    role,
    landlord_id,
    tenant_id,
    reason
  ) values (
    auth.uid(),
    v_profile.role,
    v_profile.landlord_id,
    v_profile.tenant_id,
    nullif(trim(p_reason), '')
  )
  returning * into v_request;

  return query
    select v_request.id, v_request.status, v_request.requested_at;
end;
$$;

revoke execute on function public.request_account_deletion(text) from public;
grant execute on function public.request_account_deletion(text) to authenticated;

notify pgrst, 'reload schema';
