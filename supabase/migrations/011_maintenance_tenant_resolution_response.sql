-- ============================================================
-- MIGRATION 011
-- Tenant response to landlord-marked maintenance resolutions.
--
-- Workflow:
-- - Landlord marks request resolved when work is fixed.
-- - Tenant confirms fixed, which closes the request.
-- - Tenant can send it back to in_progress if the fix did not hold.
-- - Landlord can still close as an override from the landlord app.
-- ============================================================

create or replace function public.respond_to_maintenance_resolution(
  p_request_id uuid,
  p_fixed boolean
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.maintenance_request%rowtype;
begin
  select * into v_request
  from public.maintenance_request
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Maintenance request not found';
  end if;

  if v_request.reported_by is distinct from public.auth_tenant_id() then
    raise exception 'Permission denied: tenant does not own this request';
  end if;

  if v_request.status != 'resolved' then
    raise exception 'Only resolved requests can be confirmed by tenant';
  end if;

  if p_fixed then
    update public.maintenance_request
    set status = 'closed'
    where id = p_request_id;
  else
    update public.maintenance_request
    set status = 'in_progress',
        resolved_at = null
    where id = p_request_id;
  end if;
end;
$$;

revoke execute on function public.respond_to_maintenance_resolution(uuid, boolean) from public;
grant execute on function public.respond_to_maintenance_resolution(uuid, boolean) to authenticated;

notify pgrst, 'reload schema';
