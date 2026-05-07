-- ============================================================
-- MIGRATION 012
-- Landlord-owned maintenance status transition RPC.
--
-- Direct client-side table updates can leave the mobile UI waiting
-- when RLS/session state blocks the request. This RPC performs the
-- ownership check server-side and gives the app one authoritative
-- transition path for landlord status changes.
-- ============================================================

create or replace function public.update_maintenance_status(
  p_request_id uuid,
  p_status text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.maintenance_request%rowtype;
  v_landlord_id uuid;
begin
  if p_status not in ('open', 'assigned', 'in_progress', 'resolved', 'closed') then
    raise exception 'Invalid maintenance status: %', p_status;
  end if;

  v_landlord_id := public.auth_landlord_id();
  if v_landlord_id is null then
    raise exception 'Landlord profile not found';
  end if;

  select mr.* into v_request
  from public.maintenance_request mr
  join public.unit u on u.id = mr.unit_id
  join public.property p on p.id = u.property_id
  where mr.id = p_request_id
    and p.landlord_id = v_landlord_id
  for update of mr;

  if not found then
    raise exception 'Maintenance request not found for landlord';
  end if;

  update public.maintenance_request
  set
    status = p_status,
    resolved_at = case
      when p_status = 'resolved' then now()
      when p_status in ('open', 'assigned', 'in_progress') then null
      when p_status = 'closed' then coalesce(v_request.resolved_at, now())
      else v_request.resolved_at
    end
  where id = p_request_id;
end;
$$;

revoke execute on function public.update_maintenance_status(uuid, text) from public;
grant execute on function public.update_maintenance_status(uuid, text) to authenticated;

notify pgrst, 'reload schema';
