-- ============================================================
-- MIGRATION 010
-- Fix tenant dashboard unit visibility and align maintenance
-- categories with the mobile app choices.
-- ============================================================

alter table public.maintenance_request
  drop constraint if exists maintenance_request_category_check;

alter table public.maintenance_request
  add constraint maintenance_request_category_check
  check (category in (
    'plumbing', 'electrical', 'structural',
    'appliance', 'pest', 'cleaning', 'internet', 'other'
  ));

create or replace function public.auth_tenant_unit_ids()
returns setof uuid
language sql
security definer
stable
set search_path = ''
as $$
  select l.unit_id
  from public.lease l
  join public.lease_tenant lt on lt.lease_id = l.id
  where lt.tenant_id = public.auth_tenant_id();
$$;

create or replace function public.auth_tenant_property_ids()
returns setof uuid
language sql
security definer
stable
set search_path = ''
as $$
  select distinct u.property_id
  from public.unit u
  where u.id in (select public.auth_tenant_unit_ids());
$$;

grant execute on function public.auth_tenant_unit_ids() to authenticated;
grant execute on function public.auth_tenant_property_ids() to authenticated;

drop policy if exists "tenant: view leased units" on public.unit;
create policy "tenant: view leased units"
  on public.unit for select
  using (id in (select public.auth_tenant_unit_ids()));

drop policy if exists "tenant: view leased properties" on public.property;
create policy "tenant: view leased properties"
  on public.property for select
  using (id in (select public.auth_tenant_property_ids()));

notify pgrst, 'reload schema';
