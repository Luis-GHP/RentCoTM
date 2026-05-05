-- Allow tenants to attach reviewed bill PDFs/images to utility bills through
-- the central document table. Parsing remains landlord/server-side only.

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
      where lt.tenant_id = auth_tenant_id()
        and l.status = 'active'
    )
  );
