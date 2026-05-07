-- ============================================================
-- MIGRATION 018
-- Keep tenant utility bill/receipt uploads aligned with utility bill access.
-- ============================================================

drop policy if exists "tenant: upload utility bill documents" on public.document;
drop policy if exists "tenant: upload utility receipt documents" on public.document;

create policy "tenant: upload utility documents"
  on public.document for insert
  to authenticated
  with check (
    uploaded_by = 'tenant'
    and entity_type = 'utility_bill'
    and doc_type in ('receipt', 'bill', 'utility_bill_pdf')
    and entity_id in (
      select ub.id
      from public.utility_bill ub
      join public.lease l on l.unit_id = ub.unit_id
      join public.lease_tenant lt on lt.lease_id = l.id
      where lt.tenant_id = public.auth_tenant_id()
        and make_date(ub.period_year, ub.period_month, 1)
          between date_trunc('month', l.start_date)::date
          and date_trunc('month', l.end_date)::date
    )
  );
