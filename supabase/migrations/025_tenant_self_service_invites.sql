-- ============================================================
-- MIGRATION 025
-- Tenant self-service invite identity.
-- Landlords assign a unit and lease terms; tenants provide their
-- own name, phone, and email during account setup.
-- ============================================================

alter table public.tenant_invite
  alter column tenant_id drop not null;

drop function if exists public.create_landlord_invite(text, text, uuid);
drop function if exists public.create_landlord_invite(text, text, uuid, date, date, numeric, numeric, int);
drop function if exists public.create_landlord_invite(uuid, date, date, numeric, numeric, int);

create or replace function public.create_landlord_invite(
  p_unit_id uuid,
  p_start_date date default current_date,
  p_end_date date default (current_date + interval '1 year')::date,
  p_monthly_rent numeric default null,
  p_security_deposit numeric default null,
  p_advance_months int default 1
) returns table (
  invite_id uuid,
  tenant_id uuid,
  token text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_landlord_id uuid;
  v_unit public.unit%rowtype;
  v_invite public.tenant_invite%rowtype;
  v_rent numeric;
  v_deposit numeric;
  v_advance int;
begin
  v_landlord_id := public.auth_landlord_id();

  if v_landlord_id is null then
    raise exception 'Permission denied: landlord role required';
  end if;

  select u.* into v_unit
  from public.unit u
  join public.property p on p.id = u.property_id
  where u.id = p_unit_id
    and u.status = 'vacant'
    and p.landlord_id = v_landlord_id;

  if not found then
    raise exception 'Unit is not available for invite';
  end if;

  if p_end_date <= p_start_date then
    raise exception 'Lease end date must be after start date';
  end if;

  v_rent := coalesce(p_monthly_rent, v_unit.monthly_rent);
  v_deposit := coalesce(p_security_deposit, v_rent);
  v_advance := coalesce(p_advance_months, 1);

  if v_rent <= 0 then
    raise exception 'Monthly rent must be greater than zero';
  end if;

  if v_deposit < 0 then
    raise exception 'Security deposit cannot be negative';
  end if;

  if v_advance < 0 or v_advance > 12 then
    raise exception 'Advance months must be between 0 and 12';
  end if;

  update public.tenant_invite ti
  set status = 'revoked'
  where ti.unit_id = p_unit_id
    and ti.landlord_id = v_landlord_id
    and ti.status = 'pending'
    and ti.expires_at > now();

  insert into public.tenant_invite (
    tenant_id, landlord_id, unit_id, invited_via,
    lease_start_date, lease_end_date, monthly_rent,
    security_deposit, advance_months
  ) values (
    null, v_landlord_id, p_unit_id, 'other',
    p_start_date, p_end_date, v_rent,
    v_deposit, v_advance
  )
  returning * into v_invite;

  return query select v_invite.id, null::uuid, v_invite.token, v_invite.expires_at;
end;
$$;

drop function if exists public.accept_invite_token(text, uuid);
drop function if exists public.accept_invite_token(text, uuid, text, text, text);

create or replace function public.accept_invite_token(
  p_token text,
  p_user_id uuid,
  p_name text,
  p_phone text,
  p_email text default null
) returns table (
  tenant_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.tenant_invite%rowtype;
  v_unit public.unit%rowtype;
  v_tenant_id uuid;
  v_lease_id uuid;
  v_start date;
  v_end date;
  v_rent numeric;
  v_deposit numeric;
  v_advance int;
  v_month int;
  v_year int;
  i int;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_user_id is distinct from auth.uid() then
    raise exception 'Invite user mismatch';
  end if;

  if nullif(trim(p_name), '') is null then
    raise exception 'Tenant name is required';
  end if;

  if nullif(trim(p_phone), '') is null then
    raise exception 'Tenant phone is required';
  end if;

  select * into v_invite
  from public.tenant_invite
  where token = p_token
  for update;

  if not found or v_invite.status != 'pending' then
    raise exception 'Invalid or already used token';
  end if;

  if v_invite.expires_at < now() then
    update public.tenant_invite set status = 'expired' where id = v_invite.id;
    raise exception 'Token has expired';
  end if;

  if v_invite.unit_id is null then
    raise exception 'Invite has no unit assignment';
  end if;

  select * into v_unit
  from public.unit
  where id = v_invite.unit_id
  for update;

  if not found or v_unit.status != 'vacant' then
    raise exception 'Unit is no longer available';
  end if;

  if v_invite.tenant_id is null then
    insert into public.tenant (name, phone, email)
    values (trim(p_name), trim(p_phone), nullif(trim(coalesce(p_email, '')), ''))
    returning id into v_tenant_id;
  else
    v_tenant_id := v_invite.tenant_id;

    update public.tenant
    set
      name = trim(p_name),
      phone = trim(p_phone),
      email = nullif(trim(coalesce(p_email, '')), '')
    where id = v_tenant_id;
  end if;

  v_start := coalesce(v_invite.lease_start_date, current_date);
  v_end := coalesce(v_invite.lease_end_date, (current_date + interval '1 year')::date);
  v_rent := coalesce(v_invite.monthly_rent, v_unit.monthly_rent);
  v_deposit := coalesce(v_invite.security_deposit, v_rent);
  v_advance := coalesce(v_invite.advance_months, 1);

  insert into public.lease (
    unit_id, primary_tenant_id,
    start_date, end_date,
    monthly_rent,
    security_deposit, security_deposit_balance,
    advance_months, advance_amount,
    is_rent_controlled
  ) values (
    v_unit.id, v_tenant_id,
    v_start, v_end,
    v_rent,
    v_deposit, v_deposit,
    v_advance, (v_rent * v_advance),
    (v_rent <= 10000)
  ) returning id into v_lease_id;

  insert into public.lease_tenant (lease_id, tenant_id, role)
  values (v_lease_id, v_tenant_id, 'primary');

  for i in 1..v_advance loop
    v_month := extract(month from v_start)::int + i - 1;
    v_year := extract(year from v_start)::int;
    while v_month > 12 loop
      v_month := v_month - 12;
      v_year := v_year + 1;
    end loop;

    insert into public.rent_payment (
      lease_id, period_month, period_year,
      amount_due, amount_paid,
      status, payment_method, payment_date
    ) values (
      v_lease_id, v_month, v_year,
      v_rent, v_rent,
      'paid', 'advance', v_start
    );
  end loop;

  if v_deposit > 0 then
    insert into public.security_deposit_transaction (lease_id, type, amount, date, reason)
    values (v_lease_id, 'deposit_paid', v_deposit, v_start, 'Initial deposit at invite acceptance');
  end if;

  update public.unit
  set status = 'occupied'
  where id = v_unit.id;

  update public.tenant_invite
  set tenant_id = v_tenant_id, status = 'accepted', accepted_at = now()
  where id = v_invite.id;

  insert into public.user_profile (id, role, tenant_id, is_active)
  values (p_user_id, 'tenant', v_tenant_id, true);

  return query select v_tenant_id;
end;
$$;

revoke execute on function public.create_landlord_invite(uuid, date, date, numeric, numeric, int) from public;
grant execute on function public.create_landlord_invite(uuid, date, date, numeric, numeric, int) to authenticated;

revoke execute on function public.accept_invite_token(text, uuid, text, text, text) from public;
grant execute on function public.accept_invite_token(text, uuid, text, text, text) to authenticated;

notify pgrst, 'reload schema';
