-- ============================================================
-- MIGRATION 019
-- Let tenants remove their own pending upload attachments.
-- ============================================================

drop policy if exists "tenant: delete own pending uploads" on public.document;

create policy "tenant: delete own pending uploads"
  on public.document for delete
  to authenticated
  using (
    uploaded_by = 'tenant'
    and (
      (
        entity_type = 'rent_payment'
        and doc_type = 'receipt'
        and entity_id in (
          select rp.id
          from public.rent_payment rp
          join public.lease_tenant lt on lt.lease_id = rp.lease_id
          where lt.tenant_id = public.auth_tenant_id()
            and rp.status in ('pending', 'unpaid', 'overdue')
        )
      )
      or (
        entity_type = 'utility_bill'
        and doc_type in ('receipt', 'bill', 'utility_bill_pdf')
        and entity_id in (
          select ub.id
          from public.utility_bill ub
          join public.lease l on l.unit_id = ub.unit_id
          join public.lease_tenant lt on lt.lease_id = l.id
          where lt.tenant_id = public.auth_tenant_id()
            and ub.status <> 'paid'
            and make_date(ub.period_year, ub.period_month, 1)
              between date_trunc('month', l.start_date)::date
              and date_trunc('month', l.end_date)::date
        )
      )
    )
  );
