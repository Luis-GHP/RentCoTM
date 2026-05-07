-- ============================================================
-- MIGRATION 007
-- Fix lease_tenant RLS recursion.
--
-- The property detail screen can load property -> unit -> lease ->
-- lease_tenant. The original lease_tenant policy checked access by
-- querying lease, while the tenant lease policy checked access by
-- querying lease_tenant. Postgres detects that loop and returns:
-- 42P17 infinite recursion detected in policy for relation "lease_tenant".
-- ============================================================

create or replace function public.auth_landlord_can_access_lease(p_lease_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.lease l
    join public.unit u on u.id = l.unit_id
    join public.property p on p.id = u.property_id
    where l.id = p_lease_id
      and p.landlord_id = public.auth_landlord_id()
  );
$$;

create or replace function public.auth_tenant_can_access_lease(p_lease_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.lease_tenant lt
    where lt.lease_id = p_lease_id
      and lt.tenant_id = public.auth_tenant_id()
  );
$$;

drop policy if exists "landlord: manage lease tenants" on public.lease_tenant;
create policy "landlord: manage lease tenants"
  on public.lease_tenant for all
  using (public.auth_landlord_can_access_lease(lease_id))
  with check (public.auth_landlord_can_access_lease(lease_id));

drop policy if exists "tenant: view own lease" on public.lease;
create policy "tenant: view own lease"
  on public.lease for select
  using (public.auth_tenant_can_access_lease(id));
