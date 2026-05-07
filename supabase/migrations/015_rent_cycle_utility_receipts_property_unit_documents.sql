-- ============================================================
-- MIGRATION 015
-- Rent cycle polish support plus document coverage for utility
-- receipts, properties, and units.
-- ============================================================

alter table public.document
  drop constraint if exists document_entity_type_check;

alter table public.document
  add constraint document_entity_type_check
  check (entity_type in (
    'maintenance_request',
    'inspection',
    'lease',
    'tenant',
    'rent_payment',
    'expense',
    'utility_bill',
    'property',
    'unit'
  ));

create or replace function public.landlord_can_access_document(
  p_entity_type text,
  p_entity_id uuid
) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_entity_type = 'property' then exists (
      select 1
      from public.property p
      where p.id = p_entity_id
        and p.landlord_id = public.auth_landlord_id()
    )
    when p_entity_type = 'unit' then exists (
      select 1
      from public.unit u
      join public.property p on p.id = u.property_id
      where u.id = p_entity_id
        and p.landlord_id = public.auth_landlord_id()
    )
    when p_entity_type = 'lease' then exists (
      select 1
      from public.lease l
      join public.unit u on u.id = l.unit_id
      join public.property p on p.id = u.property_id
      where l.id = p_entity_id
        and p.landlord_id = public.auth_landlord_id()
    )
    when p_entity_type = 'tenant' then exists (
      select 1
      from public.lease_tenant lt
      join public.lease l on l.id = lt.lease_id
      join public.unit u on u.id = l.unit_id
      join public.property p on p.id = u.property_id
      where lt.tenant_id = p_entity_id
        and p.landlord_id = public.auth_landlord_id()
    )
    when p_entity_type = 'rent_payment' then exists (
      select 1
      from public.rent_payment rp
      join public.lease l on l.id = rp.lease_id
      join public.unit u on u.id = l.unit_id
      join public.property p on p.id = u.property_id
      where rp.id = p_entity_id
        and p.landlord_id = public.auth_landlord_id()
    )
    when p_entity_type = 'maintenance_request' then exists (
      select 1
      from public.maintenance_request mr
      join public.unit u on u.id = mr.unit_id
      join public.property p on p.id = u.property_id
      where mr.id = p_entity_id
        and p.landlord_id = public.auth_landlord_id()
    )
    when p_entity_type = 'utility_bill' then exists (
      select 1
      from public.utility_bill ub
      join public.unit u on u.id = ub.unit_id
      join public.property p on p.id = u.property_id
      where ub.id = p_entity_id
        and p.landlord_id = public.auth_landlord_id()
    )
    when p_entity_type = 'inspection' then exists (
      select 1
      from public.inspection i
      join public.unit u on u.id = i.unit_id
      join public.property p on p.id = u.property_id
      where i.id = p_entity_id
        and p.landlord_id = public.auth_landlord_id()
    )
    when p_entity_type = 'expense' then exists (
      select 1
      from public.expense e
      join public.property p on p.id = e.property_id
      where e.id = p_entity_id
        and p.landlord_id = public.auth_landlord_id()
    )
    else false
  end;
$$;

drop policy if exists "landlord: manage documents" on public.document;

create policy "landlord: manage documents"
  on public.document for all
  using (public.landlord_can_access_document(entity_type, entity_id))
  with check (
    uploaded_by = 'landlord'
    and public.landlord_can_access_document(entity_type, entity_id)
  );

drop policy if exists "tenant: view leased property documents" on public.document;

create policy "tenant: view leased property documents"
  on public.document for select
  using (
    entity_type = 'property'
    and entity_id in (
      select u.property_id
      from public.lease_tenant lt
      join public.lease l on l.id = lt.lease_id
      join public.unit u on u.id = l.unit_id
      where lt.tenant_id = public.auth_tenant_id()
    )
  );

drop policy if exists "tenant: view leased unit documents" on public.document;

create policy "tenant: view leased unit documents"
  on public.document for select
  using (
    entity_type = 'unit'
    and entity_id in (
      select l.unit_id
      from public.lease_tenant lt
      join public.lease l on l.id = lt.lease_id
      where lt.tenant_id = public.auth_tenant_id()
    )
  );

drop policy if exists "tenant: upload utility receipt documents" on public.document;

create policy "tenant: upload utility receipt documents"
  on public.document for insert
  with check (
    uploaded_by = 'tenant'
    and entity_type = 'utility_bill'
    and doc_type = 'receipt'
    and entity_id in (
      select ub.id
      from public.utility_bill ub
      join public.lease l on l.unit_id = ub.unit_id
      join public.lease_tenant lt on lt.lease_id = l.id
      where lt.tenant_id = public.auth_tenant_id()
        and l.status = 'active'
    )
  );
