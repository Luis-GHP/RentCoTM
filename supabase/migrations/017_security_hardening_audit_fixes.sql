-- ============================================================
-- MIGRATION 017
-- Security hardening from codebase audit:
-- 1. Lock user_profile writes behind a push-token-only RPC.
-- 2. Make storage buckets private and path-scoped for writes.
-- 3. Require new document/utility file references to use storage:// refs.
-- 4. Bind invite acceptance to auth.uid().
-- 5. Move accounting/status transitions into server-side RPCs.
-- ============================================================

-- 1. user_profile: remove broad self-update and expose only push token mutation.
drop policy if exists "user: update own push token" on public.user_profile;

create or replace function public.update_own_push_token(
  p_push_token text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  update public.user_profile
  set push_token = nullif(trim(p_push_token), '')
  where id = auth.uid();

  if not found then
    raise exception 'Profile not found';
  end if;
end;
$$;

revoke execute on function public.update_own_push_token(text) from public;
grant execute on function public.update_own_push_token(text) to authenticated;


-- 2. Private storage. Reads now require an authenticated request and signed URLs.
update storage.buckets
set public = false
where id in ('documents', 'utility-bills', 'receipts', 'or-pdfs');

drop policy if exists "public: read rentco storage files" on storage.objects;
drop policy if exists "authenticated: read rentco storage files" on storage.objects;
create policy "authenticated: read rentco storage files"
  on storage.objects for select
  to authenticated
  using (bucket_id in ('documents', 'utility-bills', 'receipts', 'or-pdfs'));

drop policy if exists "authenticated: upload rentco storage files" on storage.objects;
drop policy if exists "authenticated: upload scoped rentco storage files" on storage.objects;
create policy "authenticated: upload scoped rentco storage files"
  on storage.objects for insert
  to authenticated
  with check (
    (bucket_id = 'documents' and name like ('users/' || auth.uid()::text || '/%'))
    or (bucket_id = 'utility-bills' and name like ('landlord/' || auth.uid()::text || '/%'))
    or (bucket_id = 'receipts' and name like ('users/' || auth.uid()::text || '/%'))
  );

drop policy if exists "authenticated: update own rentco storage files" on storage.objects;
create policy "authenticated: update own rentco storage files"
  on storage.objects for update
  to authenticated
  using (
    bucket_id in ('documents', 'utility-bills', 'receipts', 'or-pdfs')
    and owner = auth.uid()
  )
  with check (
    bucket_id in ('documents', 'utility-bills', 'receipts', 'or-pdfs')
    and owner = auth.uid()
  );

drop policy if exists "authenticated: delete own rentco storage files" on storage.objects;
create policy "authenticated: delete own rentco storage files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id in ('documents', 'utility-bills', 'receipts', 'or-pdfs')
    and owner = auth.uid()
  );


-- 3. New file references must be storage refs, not arbitrary external URLs.
create or replace function public.is_rentco_storage_ref(
  p_value text,
  p_bucket text default null
) returns boolean
language sql
immutable
as $$
  select
    p_value is not null
    and p_value ~ '^storage://(documents|utility-bills|receipts|or-pdfs)/.+$'
    and position('..' in p_value) = 0
    and (p_bucket is null or p_value like ('storage://' || p_bucket || '/%'));
$$;

create or replace function public.enforce_document_storage_ref()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_rentco_storage_ref(new.file_url) then
    raise exception 'Document files must be stored in RentCo storage';
  end if;
  return new;
end;
$$;

drop trigger if exists document_storage_ref_required on public.document;
create trigger document_storage_ref_required
  before insert or update of file_url on public.document
  for each row execute function public.enforce_document_storage_ref();

create or replace function public.enforce_utility_bill_storage_ref()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.bill_pdf_url is not null and not public.is_rentco_storage_ref(new.bill_pdf_url, 'utility-bills') then
    raise exception 'Utility bill PDFs must be stored in RentCo storage';
  end if;
  return new;
end;
$$;

drop trigger if exists utility_bill_storage_ref_required on public.utility_bill;
create trigger utility_bill_storage_ref_required
  before insert or update of bill_pdf_url on public.utility_bill
  for each row execute function public.enforce_utility_bill_storage_ref();

alter table public.notification_event
  add column if not exists sender_user_id uuid references public.user_profile(id) on delete set null;

create index if not exists idx_notification_event_sender_created
  on public.notification_event (sender_user_id, created_at desc);


-- 4. Invite acceptance must bind to the authenticated caller, not a client-supplied user id.
create or replace function public.accept_invite_token(
  p_token text,
  p_user_id uuid
) returns void
language plpgsql
security definer
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
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_user_id is distinct from auth.uid() then
    raise exception 'Invite user mismatch';
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


-- 5. Accounting and status mutations run server-side now.
drop policy if exists "landlord: manage or sequence" on public.or_sequence;

create or replace function public.confirm_rent_payment(
  p_payment_id uuid,
  p_current_payment_date date default null
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.rent_payment%rowtype;
  v_or_number text;
  v_amount_due numeric;
  v_amount_paid numeric;
begin
  if (select role from public.user_profile where id = auth.uid()) != 'landlord' then
    raise exception 'Only landlords can confirm payments';
  end if;

  select rp.* into v_payment
  from public.rent_payment rp
  join public.lease l on l.id = rp.lease_id
  join public.unit u on u.id = l.unit_id
  join public.property p on p.id = u.property_id
  where rp.id = p_payment_id
    and p.landlord_id = public.auth_landlord_id()
  for update of rp;

  if not found then
    raise exception 'Payment not found';
  end if;

  if v_payment.or_number is not null then
    return v_payment.or_number;
  end if;

  v_amount_due := coalesce(v_payment.amount_due, 0);
  v_amount_paid := case
    when coalesce(v_payment.amount_paid, 0) > 0 then v_payment.amount_paid
    else v_amount_due
  end;

  v_or_number := public.claim_or_number(p_payment_id);

  update public.rent_payment
  set status = case when v_amount_paid >= v_amount_due then 'paid' else 'partial' end,
      amount_paid = v_amount_paid,
      or_number = v_or_number,
      confirmed_by = 'landlord',
      confirmed_at = now(),
      payment_date = coalesce(v_payment.payment_date, p_current_payment_date, current_date)
  where id = p_payment_id;

  return v_or_number;
end;
$$;

create or replace function public.record_landlord_rent_payment(
  p_lease_id uuid,
  p_period_month int,
  p_period_year int,
  p_amount_due numeric,
  p_amount_paid numeric,
  p_payment_method text,
  p_reference_number text,
  p_payment_date date
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment_id uuid;
  v_or_number text;
  v_is_paid boolean;
begin
  if (select role from public.user_profile where id = auth.uid()) != 'landlord' then
    raise exception 'Only landlords can record payments';
  end if;

  if not exists (
    select 1
    from public.lease l
    join public.unit u on u.id = l.unit_id
    join public.property p on p.id = u.property_id
    where l.id = p_lease_id
      and p.landlord_id = public.auth_landlord_id()
  ) then
    raise exception 'Lease not found';
  end if;

  v_is_paid := p_amount_paid >= p_amount_due;

  insert into public.rent_payment (
    lease_id, period_month, period_year,
    amount_due, amount_paid,
    payment_method, reference_number, payment_date,
    status, confirmed_by, confirmed_at
  ) values (
    p_lease_id, p_period_month, p_period_year,
    p_amount_due, p_amount_paid,
    p_payment_method, nullif(trim(p_reference_number), ''), p_payment_date,
    case when v_is_paid then 'paid' else 'partial' end,
    'landlord', now()
  ) returning id into v_payment_id;

  if v_is_paid then
    v_or_number := public.claim_or_number(v_payment_id);
    update public.rent_payment
    set or_number = v_or_number
    where id = v_payment_id;
  end if;

  return v_payment_id;
end;
$$;

create or replace function public.revert_rent_payment_to_pending(
  p_payment_id uuid
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.rent_payment%rowtype;
begin
  if (select role from public.user_profile where id = auth.uid()) != 'landlord' then
    raise exception 'Only landlords can update payments';
  end if;

  select rp.* into v_payment
  from public.rent_payment rp
  join public.lease l on l.id = rp.lease_id
  join public.unit u on u.id = l.unit_id
  join public.property p on p.id = u.property_id
  where rp.id = p_payment_id
    and p.landlord_id = public.auth_landlord_id()
  for update of rp;

  if not found then
    raise exception 'Payment not found';
  end if;

  if v_payment.or_number is not null then
    perform public.void_or_number(v_payment.or_number);
  end if;

  update public.rent_payment
  set status = 'pending',
      amount_paid = 0,
      payment_date = null,
      or_number = null,
      confirmed_by = null,
      confirmed_at = null
  where id = p_payment_id;
end;
$$;

create or replace function public.generate_rent_cycle(
  p_period_month int,
  p_period_year int
) returns table(created_count int, skipped_count int)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_period_start date;
  v_period_end date;
begin
  if (select role from public.user_profile where id = auth.uid()) != 'landlord' then
    raise exception 'Only landlords can generate rent cycles';
  end if;

  if p_period_month not between 1 and 12 then
    raise exception 'Invalid period month';
  end if;

  v_period_start := make_date(p_period_year, p_period_month, 1);
  v_period_end := (v_period_start + interval '1 month - 1 day')::date;

  return query
  with eligible as (
    select l.id as lease_id, l.monthly_rent
    from public.lease l
    join public.unit u on u.id = l.unit_id
    join public.property p on p.id = u.property_id
    where p.landlord_id = public.auth_landlord_id()
      and l.status = 'active'
      and l.start_date <= v_period_end
      and l.end_date >= v_period_start
  ),
  inserted as (
    insert into public.rent_payment (
      lease_id, period_month, period_year,
      amount_due, amount_paid, status
    )
    select
      e.lease_id,
      p_period_month,
      p_period_year,
      e.monthly_rent,
      0,
      case when v_period_end < current_date then 'overdue' else 'pending' end
    from eligible e
    on conflict (lease_id, period_month, period_year) do nothing
    returning id
  )
  select
    (select count(*)::int from inserted) as created_count,
    ((select count(*)::int from eligible) - (select count(*)::int from inserted)) as skipped_count;
end;
$$;

create or replace function public.set_utility_bill_payment_status(
  p_bill_id uuid,
  p_status text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select role from public.user_profile where id = auth.uid()) != 'landlord' then
    raise exception 'Only landlords can update utility bill payment status';
  end if;

  if p_status not in ('paid', 'unpaid') then
    raise exception 'Invalid utility bill status';
  end if;

  update public.utility_bill ub
  set status = p_status
  from public.unit u
  join public.property p on p.id = u.property_id
  where ub.id = p_bill_id
    and ub.unit_id = u.id
    and p.landlord_id = public.auth_landlord_id()
    and ub.confirmed_at is not null;

  if not found then
    raise exception 'Utility bill not found or not confirmed';
  end if;
end;
$$;

create or replace function public.confirm_utility_bill(
  p_bill_id uuid
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select role from public.user_profile where id = auth.uid()) != 'landlord' then
    raise exception 'Only landlords can confirm utility bills';
  end if;

  update public.utility_bill ub
  set confirmed_by = 'landlord',
      confirmed_at = now(),
      confirmed_by_user = true
  from public.unit u
  join public.property p on p.id = u.property_id
  where ub.id = p_bill_id
    and ub.unit_id = u.id
    and p.landlord_id = public.auth_landlord_id();

  if not found then
    raise exception 'Utility bill not found';
  end if;
end;
$$;

create or replace function public.set_unit_status(
  p_unit_id uuid,
  p_status text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_has_active_lease boolean;
begin
  if (select role from public.user_profile where id = auth.uid()) != 'landlord' then
    raise exception 'Only landlords can update unit status';
  end if;

  if p_status not in ('vacant', 'occupied', 'under_maintenance') then
    raise exception 'Invalid unit status';
  end if;

  if not exists (
    select 1
    from public.unit u
    join public.property p on p.id = u.property_id
    where u.id = p_unit_id
      and p.landlord_id = public.auth_landlord_id()
  ) then
    raise exception 'Unit not found';
  end if;

  select exists (
    select 1
    from public.lease
    where unit_id = p_unit_id
      and status = 'active'
  ) into v_has_active_lease;

  if p_status = 'occupied' and not v_has_active_lease then
    raise exception 'A unit needs an active lease before it can be marked occupied';
  end if;

  if p_status = 'vacant' and v_has_active_lease then
    raise exception 'A unit with an active lease cannot be marked vacant';
  end if;

  update public.unit
  set status = p_status
  where id = p_unit_id;
end;
$$;

revoke execute on function public.confirm_rent_payment(uuid, date) from public;
revoke execute on function public.record_landlord_rent_payment(uuid, int, int, numeric, numeric, text, text, date) from public;
revoke execute on function public.revert_rent_payment_to_pending(uuid) from public;
revoke execute on function public.generate_rent_cycle(int, int) from public;
revoke execute on function public.set_utility_bill_payment_status(uuid, text) from public;
revoke execute on function public.confirm_utility_bill(uuid) from public;
revoke execute on function public.set_unit_status(uuid, text) from public;

grant execute on function public.confirm_rent_payment(uuid, date) to authenticated;
grant execute on function public.record_landlord_rent_payment(uuid, int, int, numeric, numeric, text, text, date) to authenticated;
grant execute on function public.revert_rent_payment_to_pending(uuid) to authenticated;
grant execute on function public.generate_rent_cycle(int, int) to authenticated;
grant execute on function public.set_utility_bill_payment_status(uuid, text) to authenticated;
grant execute on function public.confirm_utility_bill(uuid) to authenticated;
grant execute on function public.set_unit_status(uuid, text) to authenticated;
