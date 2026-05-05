-- ============================================================
-- MIGRATION 004
-- Tenant invite/unit assignment, tenant status RPC, gov ID docs,
-- and rent increase notes for landlord-side tenant workflows.
-- ============================================================

alter table public.tenant_invite
  add column if not exists unit_id uuid references public.unit(id);

alter table public.rent_increase_history
  add column if not exists reason text;

alter table public.maintenance_request
  drop constraint if exists maintenance_request_category_check;

alter table public.maintenance_request
  add constraint maintenance_request_category_check
  check (category in (
    'plumbing', 'electrical', 'structural',
    'appliance', 'pest', 'cleaning', 'internet', 'other'
  ));

alter table public.document
  drop constraint if exists document_doc_type_check;

alter table public.document
  add constraint document_doc_type_check
  check (doc_type in (
    'photo', 'contract', 'gov_id', 'gov_id_front', 'gov_id_back',
    'receipt', 'bill', 'inspection_report', 'or_pdf',
    'utility_bill_pdf', 'other'
  ));

create index if not exists idx_tenant_invite_unit
  on public.tenant_invite(unit_id);


create or replace function public.create_landlord_invite(
  p_name text,
  p_phone text,
  p_unit_id uuid
) returns table (
  invite_id uuid,
  tenant_id uuid,
  token text,
  expires_at timestamptz
) language plpgsql security definer
set search_path = ''
as $$
declare
  v_landlord_id uuid;
  v_tenant_id uuid;
  v_invite public.tenant_invite%rowtype;
begin
  v_landlord_id := public.auth_landlord_id();

  if v_landlord_id is null then
    raise exception 'Permission denied: landlord role required';
  end if;

  if not exists (
    select 1
    from public.unit u
    join public.property p on p.id = u.property_id
    where u.id = p_unit_id
      and u.status = 'vacant'
      and p.landlord_id = v_landlord_id
  ) then
    raise exception 'Unit is not available for invite';
  end if;

  update public.tenant_invite
  set status = 'revoked'
  where unit_id = p_unit_id
    and landlord_id = v_landlord_id
    and status = 'pending'
    and expires_at > now();

  insert into public.tenant (name, phone)
  values (trim(p_name), trim(p_phone))
  returning id into v_tenant_id;

  insert into public.tenant_invite (tenant_id, landlord_id, unit_id, invited_via)
  values (v_tenant_id, v_landlord_id, p_unit_id, 'other')
  returning * into v_invite;

  return query select v_invite.id, v_tenant_id, v_invite.token, v_invite.expires_at;
end;
$$;


create or replace function public.list_landlord_tenants()
returns table (
  tenant_id uuid,
  name text,
  email text,
  phone text,
  gov_id_type text,
  gov_id_number text,
  is_active boolean,
  lease_id uuid,
  unit_id uuid,
  unit_number text,
  property_name text,
  monthly_rent numeric,
  lease_status text
) language sql security definer
set search_path = ''
as $$
  select
    t.id,
    t.name,
    t.email,
    t.phone,
    t.gov_id_type,
    t.gov_id_number,
    coalesce(up.is_active, false),
    l.id,
    u.id,
    u.unit_number,
    p.name,
    l.monthly_rent,
    l.status
  from public.lease_tenant lt
  join public.tenant t on t.id = lt.tenant_id
  join public.lease l on l.id = lt.lease_id
  join public.unit u on u.id = l.unit_id
  join public.property p on p.id = u.property_id
  left join public.user_profile up on up.tenant_id = t.id
  where p.landlord_id = public.auth_landlord_id()
  order by t.name asc;
$$;


create or replace function public.set_tenant_active(
  p_tenant_id uuid,
  p_is_active boolean
) returns void language plpgsql security definer
set search_path = ''
as $$
begin
  if public.auth_landlord_id() is null then
    raise exception 'Permission denied: landlord role required';
  end if;

  if not exists (
    select 1
    from public.lease_tenant lt
    join public.lease l on l.id = lt.lease_id
    join public.unit u on u.id = l.unit_id
    join public.property p on p.id = u.property_id
    where lt.tenant_id = p_tenant_id
      and p.landlord_id = public.auth_landlord_id()
  ) then
    raise exception 'Tenant not found for landlord';
  end if;

  update public.user_profile
  set is_active = p_is_active
  where tenant_id = p_tenant_id;
end;
$$;


create or replace function public.record_rent_increase(
  p_lease_id uuid,
  p_new_rent numeric,
  p_effective_date date,
  p_reason text default null
) returns void language plpgsql security definer
set search_path = ''
as $$
declare
  v_lease public.lease%rowtype;
  v_increase_pct numeric;
  v_within_cap boolean;
begin
  if public.auth_landlord_id() is null then
    raise exception 'Permission denied: landlord role required';
  end if;

  select l.* into v_lease
  from public.lease l
  join public.unit u on u.id = l.unit_id
  join public.property p on p.id = u.property_id
  where l.id = p_lease_id
    and p.landlord_id = public.auth_landlord_id();

  if not found then
    raise exception 'Lease % not found', p_lease_id;
  end if;

  v_increase_pct := round(((p_new_rent - v_lease.monthly_rent) / v_lease.monthly_rent) * 100, 2);
  v_within_cap := v_increase_pct <= 7.00;

  insert into public.rent_increase_history (
    lease_id, previous_rent, new_rent,
    increase_pct, effective_date, within_ra9653, noted_by, reason
  ) values (
    p_lease_id, v_lease.monthly_rent, p_new_rent,
    v_increase_pct, p_effective_date, v_within_cap, public.auth_landlord_id(), nullif(trim(p_reason), '')
  );

  update public.lease
  set monthly_rent = p_new_rent,
      last_rent_increase_date = p_effective_date,
      is_rent_controlled = (p_new_rent <= 10000)
  where id = p_lease_id;
end;
$$;

revoke execute on function public.create_landlord_invite(text, text, uuid) from anon;
revoke execute on function public.list_landlord_tenants() from anon;
revoke execute on function public.set_tenant_active(uuid, boolean) from anon;
revoke execute on function public.record_rent_increase(uuid, numeric, date, text) from anon;
