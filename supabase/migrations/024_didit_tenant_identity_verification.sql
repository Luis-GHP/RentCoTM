-- ============================================================
-- MIGRATION 024
-- Didit hosted KYC session tracking.
-- RentCo stores verification state and minimal extracted metadata,
-- while raw identity capture remains with Didit.
-- ============================================================

create table if not exists public.tenant_identity_verification (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenant(id) on delete cascade,
  provider text not null default 'didit' check (provider in ('didit')),
  provider_session_id text unique,
  provider_session_token text,
  workflow_id text,
  status text not null default 'not_started' check (status in (
    'not_started',
    'started',
    'in_progress',
    'in_review',
    'approved',
    'declined',
    'resubmitted',
    'expired',
    'abandoned',
    'kyc_expired',
    'error'
  )),
  provider_status text,
  verification_url text,
  vendor_data text,
  verified_name text,
  document_type text,
  document_number_last4 text,
  issuing_country text,
  features jsonb not null default '[]'::jsonb,
  decision jsonb not null default '{}'::jsonb,
  resubmit_info jsonb,
  review_message text,
  last_error text,
  started_at timestamptz,
  submitted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tenant_identity_tenant_created
  on public.tenant_identity_verification (tenant_id, created_at desc);

create index if not exists idx_tenant_identity_status
  on public.tenant_identity_verification (status, updated_at desc);

create or replace function public.touch_tenant_identity_verification()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tenant_identity_verification_touch on public.tenant_identity_verification;
create trigger tenant_identity_verification_touch
  before update on public.tenant_identity_verification
  for each row execute function public.touch_tenant_identity_verification();

alter table public.tenant_identity_verification enable row level security;

drop policy if exists "tenant: view own identity verification" on public.tenant_identity_verification;
create policy "tenant: view own identity verification"
  on public.tenant_identity_verification for select
  to authenticated
  using (tenant_id = public.auth_tenant_id());

drop policy if exists "landlord: view tenant identity verification" on public.tenant_identity_verification;
create policy "landlord: view tenant identity verification"
  on public.tenant_identity_verification for select
  to authenticated
  using (
    tenant_id in (
      select lt.tenant_id
      from public.lease_tenant lt
      join public.lease l on l.id = lt.lease_id
      join public.unit u on u.id = l.unit_id
      join public.property p on p.id = u.property_id
      where p.landlord_id = public.auth_landlord_id()
    )
  );

revoke all on public.tenant_identity_verification from authenticated;

grant select (
  id,
  tenant_id,
  provider,
  workflow_id,
  status,
  provider_status,
  vendor_data,
  verified_name,
  document_type,
  document_number_last4,
  issuing_country,
  review_message,
  last_error,
  started_at,
  submitted_at,
  completed_at,
  created_at,
  updated_at
) on public.tenant_identity_verification to authenticated;
