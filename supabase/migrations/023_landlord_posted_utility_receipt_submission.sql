-- ============================================================
-- MIGRATION 023
-- Landlord-posted utility bills are payable even if older rows
-- were created before confirmed_at was backfilled.
-- ============================================================

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
    and (
      ub.uploaded_by = 'landlord'
      or ub.confirmed_at is not null
    )
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

revoke execute on function public.submit_utility_bill_payment_review(uuid) from public;
grant execute on function public.submit_utility_bill_payment_review(uuid) to authenticated;
