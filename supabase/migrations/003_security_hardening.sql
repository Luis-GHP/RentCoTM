-- ============================================================
-- MIGRATION 003 — Security Hardening
-- Fixes three Supabase linter warnings:
--   1. function_search_path_mutable  → add SET search_path = '' to all functions
--   2. anon_security_definer_function_executable → revoke anon EXECUTE on business RPCs
--   3. authenticated_security_definer_function_executable (partial) → add landlord
--      role guard inside landlord-only functions so tenants can't call them
--
-- NOTE: RLS helper functions (auth_user_role, auth_landlord_id, auth_tenant_id)
-- are NOT revoked from anon or authenticated because PostgreSQL evaluates RLS
-- USING clauses in the caller's security context — revoking EXECUTE from those
-- roles would cause permission errors instead of simple row-level denials.
--
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================


-- ── 1. RLS HELPER FUNCTIONS (search_path fix only) ──────────

create or replace function public.auth_user_role()
returns text language sql security definer
set search_path = ''
as $$
  select role from public.user_profile where id = auth.uid();
$$;

create or replace function public.auth_landlord_id()
returns uuid language sql security definer
set search_path = ''
as $$
  select landlord_id from public.user_profile where id = auth.uid();
$$;

create or replace function public.auth_tenant_id()
returns uuid language sql security definer
set search_path = ''
as $$
  select tenant_id from public.user_profile where id = auth.uid();
$$;


-- ── 2. LANDLORD-ONLY FUNCTIONS (search_path + role guard) ───

create or replace function public.approve_application(
  p_application_id uuid
) returns uuid language plpgsql security definer
set search_path = ''
as $$
declare
  v_tenant_id  uuid;
  v_lease_id   uuid;
  v_unit_id    uuid;
  v_app        public.tenant_application%rowtype;
  v_unit       public.unit%rowtype;
  v_start      date := current_date;
  v_end        date := current_date + interval '1 year';
  v_month      int;
  v_year       int;
  i            int;
begin
  if (select role from public.user_profile where id = auth.uid()) != 'landlord' then
    raise exception 'Permission denied: landlord role required';
  end if;

  select * into v_app from public.tenant_application where id = p_application_id;
  if not found then
    raise exception 'Application % not found', p_application_id;
  end if;
  if v_app.status != 'pending' then
    raise exception 'Application is not in pending status';
  end if;

  v_unit_id := v_app.unit_id;
  select * into v_unit from public.unit where id = v_unit_id;

  insert into public.tenant (name, email, phone)
  values (v_app.name, v_app.email, v_app.phone)
  returning id into v_tenant_id;

  insert into public.lease (
    unit_id, primary_tenant_id,
    start_date, end_date,
    monthly_rent,
    security_deposit, security_deposit_balance,
    advance_months, advance_amount,
    is_rent_controlled
  ) values (
    v_unit_id, v_tenant_id,
    v_start, v_end,
    v_unit.monthly_rent,
    v_unit.monthly_rent, v_unit.monthly_rent,
    v_app.advance_months, (v_unit.monthly_rent * v_app.advance_months),
    (v_unit.monthly_rent <= 10000)
  ) returning id into v_lease_id;

  insert into public.lease_tenant (lease_id, tenant_id, role)
  values (v_lease_id, v_tenant_id, 'primary');

  for i in 1..v_app.advance_months loop
    v_month := extract(month from v_start)::int + i - 1;
    v_year  := extract(year from v_start)::int;
    if v_month > 12 then
      v_month := v_month - 12;
      v_year  := v_year + 1;
    end if;
    insert into public.rent_payment (
      lease_id, period_month, period_year,
      amount_due, amount_paid,
      status, payment_method
    ) values (
      v_lease_id, v_month, v_year,
      v_unit.monthly_rent, v_unit.monthly_rent,
      'paid', 'advance'
    );
  end loop;

  insert into public.security_deposit_transaction (lease_id, type, amount, date, reason)
  values (v_lease_id, 'deposit_paid', v_unit.monthly_rent, v_start, 'Initial deposit at move-in');

  update public.unit set status = 'occupied' where id = v_unit_id;
  update public.tenant_application set status = 'converted' where id = p_application_id;

  return v_lease_id;
end;
$$;


create or replace function public.claim_or_number(
  p_payment_id uuid
) returns text language plpgsql security definer
set search_path = ''
as $$
declare
  v_year      int := extract(year from now())::int;
  v_count     int;
  v_or_number text;
begin
  if (select role from public.user_profile where id = auth.uid()) != 'landlord' then
    raise exception 'Permission denied: landlord role required';
  end if;

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

  update public.or_sequence set status = 'void' where or_number = p_or_number;
end;
$$;


create or replace function public.record_rent_increase(
  p_lease_id       uuid,
  p_new_rent       numeric,
  p_effective_date date
) returns void language plpgsql security definer
set search_path = ''
as $$
declare
  v_lease        public.lease%rowtype;
  v_increase_pct numeric;
  v_within_cap   boolean;
begin
  if (select role from public.user_profile where id = auth.uid()) != 'landlord' then
    raise exception 'Permission denied: landlord role required';
  end if;

  select * into v_lease from public.lease where id = p_lease_id;
  if not found then
    raise exception 'Lease % not found', p_lease_id;
  end if;

  v_increase_pct := round(
    ((p_new_rent - v_lease.monthly_rent) / v_lease.monthly_rent) * 100, 2
  );
  v_within_cap := v_increase_pct <= 7.00;

  insert into public.rent_increase_history (
    lease_id, previous_rent, new_rent,
    increase_pct, effective_date, within_ra9653
  ) values (
    p_lease_id, v_lease.monthly_rent, p_new_rent,
    v_increase_pct, p_effective_date, v_within_cap
  );

  update public.lease set
    monthly_rent            = p_new_rent,
    last_rent_increase_date = p_effective_date,
    is_rent_controlled      = (p_new_rent <= 10000)
  where id = p_lease_id;
end;
$$;


-- ── 3. INVITE FUNCTIONS (search_path fix only) ──────────────
-- No role guard needed: validate is called pre-auth via edge function,
-- accept is called by a freshly authenticated tenant.

create or replace function public.validate_invite_token(
  p_token text
) returns table (
  is_valid  boolean,
  tenant_id uuid,
  reason    text
) language plpgsql security definer
set search_path = ''
as $$
declare
  v_invite public.tenant_invite%rowtype;
begin
  select * into v_invite from public.tenant_invite where token = p_token;

  if not found then
    return query select false, null::uuid, 'Token not found';
    return;
  end if;

  if v_invite.status = 'accepted' then
    return query select false, null::uuid, 'Token already used';
    return;
  end if;

  if v_invite.status = 'revoked' then
    return query select false, null::uuid, 'Token has been revoked';
    return;
  end if;

  if v_invite.expires_at < now() then
    update public.tenant_invite set status = 'expired' where id = v_invite.id;
    return query select false, null::uuid, 'Token has expired';
    return;
  end if;

  return query select true, v_invite.tenant_id, 'Valid';
end;
$$;


create or replace function public.accept_invite_token(
  p_token   text,
  p_user_id uuid
) returns void language plpgsql security definer
set search_path = ''
as $$
declare
  v_invite public.tenant_invite%rowtype;
begin
  select * into v_invite from public.tenant_invite where token = p_token;

  if not found or v_invite.status != 'pending' then
    raise exception 'Invalid or already used token';
  end if;

  if v_invite.expires_at < now() then
    raise exception 'Token has expired';
  end if;

  update public.tenant_invite
  set status = 'accepted', accepted_at = now()
  where id = v_invite.id;

  insert into public.user_profile (id, role, tenant_id, is_active)
  values (p_user_id, 'tenant', v_invite.tenant_id, true);
end;
$$;


-- ── 4. LANDLORD PROFILE FUNCTION (search_path fix) ──────────

create or replace function public.create_landlord_profile(
  p_name  text,
  p_email text
) returns void language plpgsql security definer
set search_path = ''
as $$
declare
  v_landlord_id uuid;
begin
  insert into public.landlord (user_id, name, email)
  values (auth.uid(), p_name, p_email)
  returning id into v_landlord_id;

  insert into public.user_profile (id, role, landlord_id)
  values (auth.uid(), 'landlord', v_landlord_id);
end;
$$;


-- ── 5. REVOKE anon EXECUTE on all business RPCs ──────────────
-- RLS helper functions intentionally excluded — see note at top of file.

revoke execute on function public.approve_application(uuid) from anon;
revoke execute on function public.claim_or_number(uuid) from anon;
revoke execute on function public.void_or_number(text) from anon;
revoke execute on function public.record_rent_increase(uuid, numeric, date) from anon;
revoke execute on function public.validate_invite_token(text) from anon;
revoke execute on function public.accept_invite_token(text, uuid) from anon;
revoke execute on function public.create_landlord_profile(text, text) from anon;
