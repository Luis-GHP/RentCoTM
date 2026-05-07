import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function normalizeDiditStatus(value: unknown) {
  const status = String(value ?? '').trim().toLowerCase();
  if (status === 'not started') return 'not_started';
  if (status === 'in progress') return 'in_progress';
  if (status === 'in review') return 'in_review';
  if (status === 'approved') return 'approved';
  if (status === 'declined') return 'declined';
  if (status === 'resubmitted') return 'resubmitted';
  if (status === 'expired') return 'expired';
  if (status === 'abandoned') return 'abandoned';
  if (status === 'kyc expired') return 'kyc_expired';
  return status ? 'started' : 'not_started';
}

function completedAtFor(status: string) {
  return ['approved', 'declined', 'expired', 'abandoned', 'kyc_expired'].includes(status)
    ? new Date().toISOString()
    : null;
}

function submittedAtFor(status: string) {
  return ['approved', 'declined', 'in_review'].includes(status)
    ? new Date().toISOString()
    : null;
}

function firstIdVerification(decision: Record<string, unknown>) {
  const list = decision.id_verifications;
  if (Array.isArray(list)) return list[0] as Record<string, unknown> | undefined;
  if (decision.id_verification && typeof decision.id_verification === 'object') {
    return decision.id_verification as Record<string, unknown>;
  }
  return undefined;
}

function last4(value: unknown) {
  const text = String(value ?? '').replace(/\s+/g, '');
  if (!text) return null;
  return text.slice(-4);
}

function extractedFields(decision: Record<string, unknown>) {
  const idv = firstIdVerification(decision);
  if (!idv) return {};
  const firstName = String(idv.first_name ?? '').trim();
  const lastName = String(idv.last_name ?? '').trim();
  const fullName = String(idv.full_name ?? [firstName, lastName].filter(Boolean).join(' ')).trim();
  return {
    verified_name: fullName || null,
    document_type: typeof idv.document_type === 'string' ? idv.document_type : null,
    document_number_last4: last4(idv.document_number ?? idv.personal_number),
    issuing_country: typeof idv.issuing_state === 'string'
      ? idv.issuing_state
      : typeof idv.issuing_state_name === 'string'
        ? idv.issuing_state_name
        : null,
  };
}

function reviewMessageFor(status: string) {
  if (status === 'approved') return 'Identity verification approved by Didit.';
  if (status === 'declined') return 'Identity verification was declined by Didit.';
  if (status === 'in_review') return 'Identity verification is under Didit review.';
  if (status === 'resubmitted') return 'Didit requested a resubmission.';
  if (status === 'expired') return 'The verification link expired.';
  if (status === 'abandoned') return 'The verification was abandoned before completion.';
  return null;
}

function safeRowForClient(row: Record<string, unknown>) {
  return {
    ...row,
    provider_session_token: null,
    decision: {},
    features: [],
    resubmit_info: row.resubmit_info ?? null,
  };
}

async function updateVerification(serviceClient: ReturnType<typeof createClient>, row: Record<string, unknown>, decision: Record<string, unknown>) {
  const providerStatus = String(decision.status ?? row.provider_status ?? '');
  const status = normalizeDiditStatus(providerStatus);
  const update = {
    status,
    provider_status: providerStatus || row.provider_status,
    workflow_id: typeof decision.workflow_id === 'string' ? decision.workflow_id : row.workflow_id,
    verification_url: typeof decision.session_url === 'string' ? decision.session_url : row.verification_url,
    features: Array.isArray(decision.features) ? decision.features : row.features,
    decision,
    resubmit_info: decision.resubmit_info ?? row.resubmit_info ?? null,
    review_message: reviewMessageFor(status),
    submitted_at: submittedAtFor(status) ?? row.submitted_at ?? null,
    completed_at: completedAtFor(status) ?? row.completed_at ?? null,
    last_error: null,
    ...extractedFields(decision),
  };

  const { data, error } = await serviceClient
    .from('tenant_identity_verification')
    .update(update)
    .eq('id', row.id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'auth_required', message: 'You must be signed in to refresh verification.' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const diditKey = Deno.env.get('DIDIT_API_KEY');
    if (!diditKey) return json({ error: 'didit_not_configured', message: 'Identity verification is not configured yet.' }, 503);

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const serviceClient = createClient(supabaseUrl, serviceKey);

    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) return json({ error: 'invalid_session', message: 'Your session expired. Sign in again.' }, 401);

    const { data: profile, error: profileError } = await userClient
      .from('user_profile')
      .select('role, tenant_id')
      .eq('id', authData.user.id)
      .single();
    if (profileError || profile?.role !== 'tenant' || !profile.tenant_id) {
      return json({ error: 'tenant_required', message: 'Only tenant accounts can refresh identity verification.' }, 403);
    }

    const { data: rows, error: rowError } = await serviceClient
      .from('tenant_identity_verification')
      .select('*')
      .eq('tenant_id', profile.tenant_id)
      .eq('provider', 'didit')
      .not('provider_session_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1);
    if (rowError) throw rowError;
    const row = rows?.[0];
    if (!row?.provider_session_id) return json({ data: null });

    const diditRes = await fetch(`https://verification.didit.me/v3/session/${row.provider_session_id}/decision/`, {
      headers: { 'x-api-key': diditKey },
    });
    const diditText = await diditRes.text();
    let decision: Record<string, unknown> = {};
    try {
      decision = diditText ? JSON.parse(diditText) : {};
    } catch {
      decision = {};
    }
    if (!diditRes.ok) {
      console.error('Didit sync failed', diditRes.status, diditText);
      return json({ error: 'didit_sync_failed', message: 'Could not refresh verification right now.' }, 502);
    }

    const updated = await updateVerification(serviceClient, row, decision);
    return json({ data: safeRowForClient(updated) });
  } catch (error) {
    console.error('sync-didit-session failed', error);
    return json({ error: 'didit_unavailable', message: 'Could not refresh verification right now.' }, 503);
  }
});
