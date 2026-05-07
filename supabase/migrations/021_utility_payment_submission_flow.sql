-- ============================================================
-- MIGRATION 021
-- Tenant utility receipt submission flow.
-- ============================================================

alter table public.utility_bill
  drop constraint if exists utility_bill_status_check;

alter table public.utility_bill
  add constraint utility_bill_status_check
  check (status in ('unpaid', 'payment_submitted', 'paid'));

drop policy if exists "tenant: upload utility documents" on public.document;
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
        and ub.status = 'unpaid'
    )
  );

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
            and ub.status = 'unpaid'
        )
      )
    )
  );

create or replace function public.submit_utility_bill_payment_review(
  p_bill_id uuid
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.auth_tenant_id() is null then
    raise exception 'Only tenants can submit utility payment receipts';
  end if;

  if not exists (
    select 1
    from public.document d
    where d.entity_type = 'utility_bill'
      and d.entity_id = p_bill_id
      and d.doc_type = 'receipt'
      and d.uploaded_by = 'tenant'
  ) then
    raise exception 'Upload a receipt before submitting for review';
  end if;

  update public.utility_bill ub
  set status = 'payment_submitted'
  where ub.id = p_bill_id
    and ub.status = 'unpaid'
    and ub.confirmed_at is not null
    and exists (
      select 1
      from public.lease l
      join public.lease_tenant lt on lt.lease_id = l.id
      where l.unit_id = ub.unit_id
        and lt.tenant_id = public.auth_tenant_id()
    );

  if not found then
    raise exception 'Utility bill not found or not ready for receipt review';
  end if;
end;
$$;

create or replace function public.delete_document_upload(
  p_document_id uuid
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_doc public.document%rowtype;
  v_file_url text;
  v_can_delete boolean := false;
begin
  select *
  into v_doc
  from public.document
  where id = p_document_id;

  if not found then
    raise exception 'Document not found';
  end if;

  if v_doc.uploaded_by = 'tenant' and public.auth_tenant_id() is not null then
    if v_doc.entity_type = 'rent_payment' and v_doc.doc_type = 'receipt' then
      select exists (
        select 1
        from public.rent_payment rp
        join public.lease_tenant lt on lt.lease_id = rp.lease_id
        where rp.id = v_doc.entity_id
          and lt.tenant_id = public.auth_tenant_id()
          and rp.status in ('pending', 'unpaid', 'overdue')
      ) into v_can_delete;
    elsif v_doc.entity_type = 'utility_bill' and v_doc.doc_type in ('receipt', 'bill', 'utility_bill_pdf') then
      select exists (
        select 1
        from public.utility_bill ub
        join public.lease l on l.unit_id = ub.unit_id
        join public.lease_tenant lt on lt.lease_id = l.id
        where ub.id = v_doc.entity_id
          and lt.tenant_id = public.auth_tenant_id()
          and ub.status = 'unpaid'
      ) into v_can_delete;
    end if;
  end if;

  if not v_can_delete
    and v_doc.uploaded_by = 'landlord'
    and public.auth_landlord_id() is not null
  then
    v_can_delete := public.landlord_can_access_document(v_doc.entity_type, v_doc.entity_id);
  end if;

  if not v_can_delete then
    raise exception 'Not allowed to delete this document';
  end if;

  delete from public.document
  where id = p_document_id
  returning file_url into v_file_url;

  return v_file_url;
end;
$$;

revoke execute on function public.submit_utility_bill_payment_review(uuid) from public;
grant execute on function public.submit_utility_bill_payment_review(uuid) to authenticated;

revoke execute on function public.delete_document_upload(uuid) from public;
grant execute on function public.delete_document_upload(uuid) to authenticated;
