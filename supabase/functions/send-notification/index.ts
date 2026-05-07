import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type UserProfileRow = {
  id: string;
  role: 'landlord' | 'tenant';
  landlord_id: string | null;
  tenant_id: string | null;
  push_token: string | null;
};

type TargetSpec = {
  type:
    | 'user'
    | 'lease_tenants'
    | 'lease_landlords'
    | 'unit_tenants'
    | 'unit_landlords'
    | 'tenant_tenants'
    | 'tenant_landlords'
    | 'payment_landlords'
    | 'utility_tenants'
    | 'utility_landlords'
    | 'maintenance_tenants'
    | 'maintenance_landlords';
  id: string;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function uniq<T>(values: T[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function uniqueProfiles(rows: UserProfileRow[]) {
  const seen = new Set<string>();
  return rows.filter(row => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Authentication required' }, 401);

    const { user_id, target, title, body, data } = await req.json();
    const targetSpec = (target ?? (user_id ? { type: 'user', id: user_id } : null)) as TargetSpec | null;
    if (!targetSpec?.type || !targetSpec?.id || !title || !body) {
      return json({ error: 'target, title, and body are required' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) return json({ error: 'Invalid session' }, 401);

    const supabase = createClient(supabaseUrl, serviceKey);

    async function profilesByUserIds(ids: string[]) {
      const targetIds = uniq(ids);
      if (targetIds.length === 0) return [];
      const { data, error } = await supabase
        .from('user_profile')
        .select('id, role, landlord_id, tenant_id, push_token')
        .in('id', targetIds)
        .eq('is_active', true);
      if (error) throw error;
      return (data ?? []) as UserProfileRow[];
    }

    async function profilesByTenantIds(ids: string[]) {
      const tenantIds = uniq(ids);
      if (tenantIds.length === 0) return [];
      const { data, error } = await supabase
        .from('user_profile')
        .select('id, role, landlord_id, tenant_id, push_token')
        .in('tenant_id', tenantIds)
        .eq('is_active', true);
      if (error) throw error;
      return (data ?? []) as UserProfileRow[];
    }

    async function profilesByLandlordIds(ids: string[]) {
      const landlordIds = uniq(ids);
      if (landlordIds.length === 0) return [];
      const { data, error } = await supabase
        .from('user_profile')
        .select('id, role, landlord_id, tenant_id, push_token')
        .in('landlord_id', landlordIds)
        .eq('is_active', true);
      if (error) throw error;
      return (data ?? []) as UserProfileRow[];
    }

    async function leaseTenantProfiles(leaseId: string) {
      const { data, error } = await supabase
        .from('lease_tenant')
        .select('tenant_id')
        .eq('lease_id', leaseId);
      if (error) throw error;
      return profilesByTenantIds((data ?? []).map((row: { tenant_id: string }) => row.tenant_id));
    }

    async function unitTenantProfiles(unitId: string) {
      const { data: leases, error: leaseError } = await supabase
        .from('lease')
        .select('id')
        .eq('unit_id', unitId)
        .eq('status', 'active');
      if (leaseError) throw leaseError;
      const leaseIds = (leases ?? []).map((row: { id: string }) => row.id);
      if (leaseIds.length === 0) return [];

      const { data, error } = await supabase
        .from('lease_tenant')
        .select('tenant_id')
        .in('lease_id', leaseIds);
      if (error) throw error;
      return profilesByTenantIds((data ?? []).map((row: { tenant_id: string }) => row.tenant_id));
    }

    async function unitLandlordProfiles(unitId: string) {
      const { data: unit, error: unitError } = await supabase
        .from('unit')
        .select('property_id')
        .eq('id', unitId)
        .single();
      if (unitError) throw unitError;

      const { data: property, error: propertyError } = await supabase
        .from('property')
        .select('landlord_id')
        .eq('id', unit.property_id)
        .single();
      if (propertyError) throw propertyError;

      return profilesByLandlordIds([property.landlord_id]);
    }

    async function leaseLandlordProfiles(leaseId: string) {
      const { data, error } = await supabase
        .from('lease')
        .select('unit_id')
        .eq('id', leaseId)
        .single();
      if (error) throw error;
      return unitLandlordProfiles(data.unit_id);
    }

    async function tenantLandlordProfiles(tenantId: string) {
      const { data, error } = await supabase
        .from('lease_tenant')
        .select('lease_id')
        .eq('tenant_id', tenantId);
      if (error) throw error;
      const nested = await Promise.all((data ?? []).map((row: { lease_id: string }) => leaseLandlordProfiles(row.lease_id)));
      return uniqueProfiles(nested.flat());
    }

    async function paymentLandlordProfiles(paymentId: string) {
      const { data, error } = await supabase
        .from('rent_payment')
        .select('lease_id')
        .eq('id', paymentId)
        .single();
      if (error) throw error;
      return leaseLandlordProfiles(data.lease_id);
    }

    async function utilityTenantProfiles(billId: string) {
      const { data, error } = await supabase
        .from('utility_bill')
        .select('unit_id')
        .eq('id', billId)
        .single();
      if (error) throw error;
      return unitTenantProfiles(data.unit_id);
    }

    async function utilityLandlordProfiles(billId: string) {
      const { data, error } = await supabase
        .from('utility_bill')
        .select('unit_id')
        .eq('id', billId)
        .single();
      if (error) throw error;
      return unitLandlordProfiles(data.unit_id);
    }

    async function maintenanceTenantProfiles(requestId: string) {
      const { data, error } = await supabase
        .from('maintenance_request')
        .select('unit_id, reported_by')
        .eq('id', requestId)
        .single();
      if (error) throw error;
      if (data.reported_by) return profilesByTenantIds([data.reported_by]);
      return unitTenantProfiles(data.unit_id);
    }

    async function maintenanceLandlordProfiles(requestId: string) {
      const { data, error } = await supabase
        .from('maintenance_request')
        .select('unit_id')
        .eq('id', requestId)
        .single();
      if (error) throw error;
      return unitLandlordProfiles(data.unit_id);
    }

    async function resolveTargets(spec: TargetSpec) {
      switch (spec.type) {
        case 'user': return profilesByUserIds([spec.id]);
        case 'lease_tenants': return leaseTenantProfiles(spec.id);
        case 'lease_landlords': return leaseLandlordProfiles(spec.id);
        case 'unit_tenants': return unitTenantProfiles(spec.id);
        case 'unit_landlords': return unitLandlordProfiles(spec.id);
        case 'tenant_tenants': return profilesByTenantIds([spec.id]);
        case 'tenant_landlords': return tenantLandlordProfiles(spec.id);
        case 'payment_landlords': return paymentLandlordProfiles(spec.id);
        case 'utility_tenants': return utilityTenantProfiles(spec.id);
        case 'utility_landlords': return utilityLandlordProfiles(spec.id);
        case 'maintenance_tenants': return maintenanceTenantProfiles(spec.id);
        case 'maintenance_landlords': return maintenanceLandlordProfiles(spec.id);
        default: return [];
      }
    }

    async function canNotify(caller: UserProfileRow, targetProfile: UserProfileRow) {
      if (caller.id === targetProfile.id) return true;

      if (caller.role === 'landlord' && targetProfile.role === 'tenant' && targetProfile.tenant_id) {
        const { count } = await supabase
          .from('lease_tenant')
          .select('lease_id, lease!inner(unit!inner(property!inner(landlord_id)))', { count: 'exact', head: true })
          .eq('tenant_id', targetProfile.tenant_id)
          .eq('lease.unit.property.landlord_id', caller.landlord_id);
        return (count ?? 0) > 0;
      }

      if (caller.role === 'tenant' && targetProfile.role === 'landlord' && caller.tenant_id) {
        const { count } = await supabase
          .from('lease_tenant')
          .select('lease_id, lease!inner(unit!inner(property!inner(landlord_id)))', { count: 'exact', head: true })
          .eq('tenant_id', caller.tenant_id)
          .eq('lease.unit.property.landlord_id', targetProfile.landlord_id);
        return (count ?? 0) > 0;
      }

      return false;
    }

    const callerRows = await profilesByUserIds([authData.user.id]);
    const caller = callerRows[0];
    if (!caller) return json({ error: 'Caller profile not found' }, 404);

    const { count: recentNotificationCount, error: recentNotificationError } = await supabase
      .from('notification_event')
      .select('id', { count: 'exact', head: true })
      .eq('sender_user_id', authData.user.id)
      .gt('created_at', new Date(Date.now() - 60_000).toISOString());
    if (recentNotificationError) {
      console.warn('Could not check notification rate limit', recentNotificationError);
    } else if ((recentNotificationCount ?? 0) >= 20) {
      return json({ error: 'rate_limited', message: 'Please wait before sending more notifications.' }, 429);
    }

    const targets = uniqueProfiles(await resolveTargets(targetSpec));
    if (targets.length === 0) return json({ skipped: true, reason: 'No notification targets found' });

    const allowedTargets: UserProfileRow[] = [];
    for (const targetProfile of targets) {
      if (await canNotify(caller, targetProfile)) allowedTargets.push(targetProfile);
    }
    if (allowedTargets.length === 0) return json({ error: 'Notification target is outside your account scope' }, 403);

    let sent = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const profile of allowedTargets) {
      const { error: historyError } = await supabase
        .from('notification_event')
        .insert({
          user_id: profile.id,
          sender_user_id: authData.user.id,
          title,
          body,
          data: data ?? {},
        });
      if (historyError) {
        console.warn('Could not write notification history', historyError);
      }

      if (!profile.push_token) {
        skipped += 1;
        continue;
      }

      const expoRes = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...(Deno.env.get('EXPO_ACCESS_TOKEN')
            ? { 'Authorization': `Bearer ${Deno.env.get('EXPO_ACCESS_TOKEN')}` }
            : {}),
        },
        body: JSON.stringify({
          to: profile.push_token,
          title,
          body,
          data: data ?? {},
          sound: 'default',
          priority: 'high',
        }),
      });

      const expoData = await expoRes.json();
      const ticket = Array.isArray(expoData.data) ? expoData.data[0] : expoData.data;

      if (ticket?.status === 'error') {
        if (ticket.details?.error === 'DeviceNotRegistered') {
          await supabase
            .from('user_profile')
            .update({ push_token: null })
            .eq('id', profile.id);
        }
        errors.push(ticket.message ?? 'Expo push failed');
        continue;
      }

      sent += 1;
    }

    return json({ sent, skipped, errors });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
