-- ============================================================
-- MIGRATION 026
-- Landlord-requested identity verification.
-- Tenants should only enter the Didit flow after a landlord
-- explicitly requests verification for a tenant in their portfolio.
-- ============================================================

alter table public.tenant_identity_verification
  add column if not exists requested_by_landlord_id uuid references public.landlord(id) on delete set null,
  add column if not exists requested_at timestamptz;

grant select (
  requested_by_landlord_id,
  requested_at
) on public.tenant_identity_verification to authenticated;

drop function if exists public.request_tenant_identity_verification(uuid);

create or replace function public.request_tenant_identity_verification(
  p_tenant_id uuid
) returns table (
  verification_id uuid,
  result_tenant_id uuid,
  verification_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_landlord_id uuid;
  v_existing public.tenant_identity_verification%rowtype;
  v_new public.tenant_identity_verification%rowtype;
begin
  v_landlord_id := public.auth_landlord_id();

  if v_landlord_id is null then
    raise exception 'Permission denied: landlord role required';
  end if;

  if not exists (
    select 1
    from public.lease_tenant lt
    join public.lease l on l.id = lt.lease_id
    join public.unit u on u.id = l.unit_id
    join public.property p on p.id = u.property_id
    where lt.tenant_id = p_tenant_id
      and p.landlord_id = v_landlord_id
  ) then
    raise exception 'Tenant not found for landlord';
  end if;

  select *
  into v_existing
  from public.tenant_identity_verification
  where tenant_id = p_tenant_id
    and provider = 'didit'
  order by created_at desc
  limit 1;

  if found and v_existing.status in (
    'not_started',
    'started',
    'in_progress',
    'in_review',
    'approved',
    'resubmitted'
  ) then
    return query
      select v_existing.id, v_existing.tenant_id, v_existing.status;
    return;
  end if;

  insert into public.tenant_identity_verification (
    tenant_id,
    provider,
    status,
    provider_status,
    requested_by_landlord_id,
    requested_at,
    review_message
  ) values (
    p_tenant_id,
    'didit',
    'not_started',
    'Requested',
    v_landlord_id,
    now(),
    'Your landlord requested identity verification.'
  )
  returning * into v_new;

  return query
    select v_new.id, v_new.tenant_id, v_new.status;
end;
$$;

revoke execute on function public.request_tenant_identity_verification(uuid) from public;
grant execute on function public.request_tenant_identity_verification(uuid) to authenticated;

notify pgrst, 'reload schema';
