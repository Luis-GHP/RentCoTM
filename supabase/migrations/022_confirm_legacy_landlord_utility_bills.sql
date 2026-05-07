-- ============================================================
-- MIGRATION 022
-- Backfill confirmation for landlord-created utility bills from
-- before landlord bill creation auto-confirmed records.
-- ============================================================

update public.utility_bill
set confirmed_by = 'landlord',
    confirmed_at = coalesce(created_at, now()),
    confirmed_by_user = true
where uploaded_by = 'landlord'
  and confirmed_at is null;
