-- ============================================================
-- MIGRATION 009
-- Hotfix create_landlord_invite ambiguity caused by the
-- returned expires_at column shadowing tenant_invite.expires_at.
-- ============================================================

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

revoke execute on function public.create_landlord_invite(text, text, uuid, date, date, numeric, numeric, int) from public;
grant execute on function public.create_landlord_invite(text, text, uuid, date, date, numeric, numeric, int) to authenticated;

notify pgrst, 'reload schema';
