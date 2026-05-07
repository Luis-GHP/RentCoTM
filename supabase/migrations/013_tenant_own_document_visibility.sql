-- Tenant document center: tenants should be able to see documents attached to
-- their own tenant record, such as government ID files uploaded by landlord.

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'document'
      and policyname = 'tenant: view own tenant documents'
  ) then
    create policy "tenant: view own tenant documents"
      on public.document for select
      using (
        entity_type = 'tenant'
        and entity_id = public.auth_tenant_id()
      );
  end if;
end $$;
