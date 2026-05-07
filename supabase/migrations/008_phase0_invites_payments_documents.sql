-- ============================================================
-- MIGRATION 008
-- Phase 0 hardening for invite-to-lease, payment confirmation,
-- OR sequencing, and document upload consistency.
-- ============================================================

alter table public.tenant_invite
  add column if not exists lease_start_date date,
  add column if not exists lease_end_date date,
  add column if not exists monthly_rent numeric(10,2),
  add column if not exists security_deposit numeric(10,2),
  add column if not exists advance_months int not null default 1;

alter table public.tenant_invite
  drop constraint if exists tenant_invite_lease_dates_check;

alter table public.tenant_invite
  add constraint tenant_invite_lease_dates_check
  check (
    lease_start_date is null
    or lease_end_date is null
    or lease_end_date > lease_start_date
  );

alter table public.tenant_invite
  drop constraint if exists tenant_invite_amounts_check;

alter table public.tenant_invite
  add constraint tenant_invite_amounts_check
  check (
    (monthly_rent is null or monthly_rent > 0)
    and (security_deposit is null or security_deposit >= 0)
    and advance_months between 0 and 12
  );

drop function if exists public.create_landlord_invite(text, text, uuid);

create or replace function public.create_landlord_invite(
  p_name text,
  p_phone text,
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
) language plpgsql security definer
set search_path = ''
as $$
declare
  v_landlord_id uuid;
  v_unit public.unit%rowtype;
  v_tenant_id uuid;
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

  insert into public.tenant (name, phone)
  values (trim(p_name), trim(p_phone))
  returning id into v_tenant_id;

  insert into public.tenant_invite (
    tenant_id, landlord_id, unit_id, invited_via,
    lease_start_date, lease_end_date, monthly_rent,
    security_deposit, advance_months
  ) values (
    v_tenant_id, v_landlord_id, p_unit_id, 'other',
    p_start_date, p_end_date, v_rent,
    v_deposit, v_advance
  )
  returning * into v_invite;

  return query select v_invite.id, v_tenant_id, v_invite.token, v_invite.expires_at;
end;
$$;


create or replace function public.accept_invite_token(
  p_token text,
  p_user_id uuid
) returns void language plpgsql security definer
set search_path = ''
as $$
declare
  v_invite public.tenant_invite%rowtype;
  v_unit public.unit%rowtype;
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
    v_unit.id, v_invite.tenant_id,
    v_start, v_end,
    v_rent,
    v_deposit, v_deposit,
    v_advance, (v_rent * v_advance),
    (v_rent <= 10000)
  ) returning id into v_lease_id;

  insert into public.lease_tenant (lease_id, tenant_id, role)
  values (v_lease_id, v_invite.tenant_id, 'primary');

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
  set status = 'accepted', accepted_at = now()
  where id = v_invite.id;

  insert into public.user_profile (id, role, tenant_id, is_active)
  values (p_user_id, 'tenant', v_invite.tenant_id, true);
end;
$$;


create or replace function public.claim_or_number(
  p_payment_id uuid
) returns text language plpgsql security definer
set search_path = ''
as $$
declare
  v_year int := extract(year from now())::int;
  v_count int;
  v_or_number text;
begin
  if (select role from public.user_profile where id = auth.uid()) != 'landlord' then
    raise exception 'Permission denied: landlord role required';
  end if;

  if not exists (
    select 1
    from public.rent_payment rp
    join public.lease l on l.id = rp.lease_id
    join public.unit u on u.id = l.unit_id
    join public.property p on p.id = u.property_id
    where rp.id = p_payment_id
      and p.landlord_id = public.auth_landlord_id()
  ) then
    raise exception 'Payment not found for landlord';
  end if;

  perform pg_advisory_xact_lock(hashtext('rentco_or_' || v_year::text));

  select count(*) into v_count
  from public.or_sequence
  where or_number like 'OR-' || v_year || '-%';

  v_or_number := 'OR-' || v_year || '-' || lpad((v_count + 1)::text, 6, '0');

  insert into public.or_sequence (or_number, status, payment_id)
  values (v_or_number, 'issued', p_payment_id);

  return v_or_number;
end;
$$;


create or replace function public.void_or_number(
  p_or_number text
) returns void language plpgsql security definer
set search_path = ''
as $$
begin
  if (select role from public.user_profile where id = auth.uid()) != 'landlord' then
    raise exception 'Permission denied: landlord role required';
  end if;

  if not exists (
    select 1
    from public.or_sequence os
    join public.rent_payment rp on rp.id = os.payment_id
    join public.lease l on l.id = rp.lease_id
    join public.unit u on u.id = l.unit_id
    join public.property p on p.id = u.property_id
    where os.or_number = p_or_number
      and p.landlord_id = public.auth_landlord_id()
  ) then
    raise exception 'OR number not found for landlord';
  end if;

  update public.or_sequence
  set status = 'void'
  where or_number = p_or_number;
end;
$$;

drop policy if exists "tenant: upload utility bill documents" on public.document;

create policy "tenant: upload utility bill documents"
  on public.document for insert
  with check (
    uploaded_by = 'tenant' and
    entity_type = 'utility_bill' and
    doc_type in ('bill', 'utility_bill_pdf') and
    entity_id in (
      select ub.id
      from public.utility_bill ub
      join public.lease l on l.unit_id = ub.unit_id
      join public.lease_tenant lt on lt.lease_id = l.id
      where lt.tenant_id = public.auth_tenant_id()
        and l.status = 'active'
    )
  );

revoke execute on function public.create_landlord_invite(text, text, uuid, date, date, numeric, numeric, int) from public;
grant execute on function public.create_landlord_invite(text, text, uuid, date, date, numeric, numeric, int) to authenticated;

revoke execute on function public.accept_invite_token(text, uuid) from public;
grant execute on function public.accept_invite_token(text, uuid) to authenticated;

revoke execute on function public.claim_or_number(uuid) from public;
grant execute on function public.claim_or_number(uuid) to authenticated;

revoke execute on function public.void_or_number(text) from public;
grant execute on function public.void_or_number(text) to authenticated;

revoke execute on function public.validate_invite_token(text) from public;
grant execute on function public.validate_invite_token(text) to service_role;
