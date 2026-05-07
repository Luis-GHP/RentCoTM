import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type DiditStatus =
  | 'not_started'
  | 'started'
  | 'in_progress'
  | 'in_review'
  | 'approved'
  | 'declined'
  | 'resubmitted'
  | 'expired'
  | 'abandoned'
  | 'kyc_expired'
  | 'error';

type DiditWorkflow = {
  uuid?: string;
  workflow_label?: string;
  workflow_type?: string;
  is_default?: boolean;
  is_archived?: boolean;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function normalizeDiditStatus(value: unknown): DiditStatus {
  const status = String(value ?? '').trim().toLowerCase();
  if (!status) return 'started';
  if (status === 'not started') return 'not_started';
  if (status === 'in progress') return 'in_progress';
  if (status === 'in review') return 'in_review';
  if (status === 'approved') return 'approved';
  if (status === 'declined') return 'declined';
  if (status === 'resubmitted') return 'resubmitted';
  if (status === 'expired') return 'expired';
  if (status === 'abandoned') return 'abandoned';
  if (status === 'kyc expired') return 'kyc_expired';
  return 'started';
}

function splitName(name: string | null | undefined) {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return {};
  if (parts.length === 1) return { first_name: parts[0] };
  return {
    first_name: parts[0],
    last_name: parts.slice(1).join(' '),
  };
}

function allowedCallbackUrl(value: unknown) {
  if (typeof value !== 'string') return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol === 'rentco:') return value;
    if (parsed.origin === 'http://localhost:8081') return value;
    if (parsed.origin === 'https://rentco.app') return value;
    return null;
  } catch {
    return null;
  }
}

function terminalStatus(status: string) {
  return ['approved', 'declined', 'expired', 'abandoned', 'kyc_expired', 'error'].includes(status);
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

async function listDiditWorkflows(diditKey: string) {
  const response = await fetch('https://verification.didit.me/v3/workflows/', {
    headers: { 'x-api-key': diditKey },
  });
  if (!response.ok) return [];
  const data = await response.json();
  return Array.isArray(data) ? data as DiditWorkflow[] : [];
}

async function fallbackWorkflowId(diditKey: string, configuredWorkflowId: string) {
  try {
    const workflows = await listDiditWorkflows(diditKey);
    const active = workflows.filter(workflow => !workflow.is_archived);
    if (active.some(workflow => workflow.uuid === configuredWorkflowId)) return configuredWorkflowId;
    const defaultKyc = active.find(workflow => workflow.workflow_type === 'kyc' && workflow.is_default);
    const firstKyc = active.find(workflow => workflow.workflow_type === 'kyc');
    return defaultKyc?.uuid ?? firstKyc?.uuid ?? null;
  } catch (error) {
    console.error('Could not inspect Didit workflows', error);
    return null;
  }
}

async function createDiditSession(diditKey: string, payload: Record<string, unknown>) {
  const response = await fetch('https://verification.didit.me/v3/session/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': diditKey,
    },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }
  return { response, text, data };
}

function diditSetupMessage(status: number, diditData: Record<string, unknown>) {
  const message = typeof diditData.message === 'string'
    ? diditData.message
    : typeof diditData.error === 'string'
      ? diditData.error
      : '';
  if (status === 401 || status === 403) {
    return 'Didit rejected the API key. Check the DIDIT_API_KEY Supabase secret.';
  }
  if (status === 400 || status === 404) {
    return message || 'Didit could not create a verification session. Confirm DIDIT_WORKFLOW_ID is the ID from Didit Workflows.';
  }
  return message || 'Didit could not create a verification session.';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'auth_required', message: 'You must be signed in to verify your identity.' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const diditKey = Deno.env.get('DIDIT_API_KEY');
    const workflowId = Deno.env.get('DIDIT_WORKFLOW_ID') ?? Deno.env.get('DIDIT_VERIFICATION_LINK_ID');
    const envCallback = Deno.env.get('DIDIT_CALLBACK_URL');

    if (!diditKey || !workflowId) {
      return json({
        error: 'didit_not_configured',
        message: 'Identity verification is not configured yet. Ask your landlord to try again later.',
      }, 503);
    }

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

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
      return json({ error: 'tenant_required', message: 'Only tenant accounts can start identity verification.' }, 403);
    }

    const tenantId = profile.tenant_id as string;
    const { data: tenant, error: tenantError } = await userClient
      .from('tenant')
      .select('name, email, phone')
      .eq('id', tenantId)
      .single();
    if (tenantError) throw tenantError;

    const { data: existingRows, error: existingError } = await serviceClient
      .from('tenant_identity_verification')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('provider', 'didit')
      .order('created_at', { ascending: false })
      .limit(1);
    if (existingError) throw existingError;

    const existing = existingRows?.[0];
    if (!existing) {
      return json({
        error: 'identity_not_requested',
        message: 'Your landlord has not requested identity verification.',
      }, 403);
    }
    if (existing?.status === 'approved') {
      return json({ data: safeRowForClient(existing) });
    }
    if (existing && !terminalStatus(existing.status) && existing.verification_url) {
      return json({ data: safeRowForClient(existing) });
    }
    if (terminalStatus(existing.status)) {
      return json({
        error: 'identity_request_inactive',
        message: 'Ask your landlord to request a new identity verification.',
      }, 409);
    }

    const callbackUrl = allowedCallbackUrl(body.callback_url) ?? envCallback ?? 'http://localhost:8081/identity';
    const tenantName = String(tenant?.name ?? '').trim();
    const contactEmail = String(tenant?.email ?? authData.user.email ?? '').trim().toLowerCase();
    const contactPhone = String(tenant?.phone ?? '').trim();
    const vendorData = tenantId;

    const diditPayload: Record<string, unknown> = {
      workflow_id: workflowId,
      vendor_data: vendorData,
      callback: callbackUrl,
      callback_method: 'both',
      language: 'en',
      metadata: JSON.stringify({
        tenant_id: tenantId,
        user_id: authData.user.id,
        source: 'rentco',
      }),
      expected_details: {
        ...splitName(tenantName),
      },
    };

    if (contactEmail || contactPhone) {
      diditPayload.contact_details = {
        ...(contactEmail ? { email: contactEmail, send_notification_emails: false, email_lang: 'en' } : {}),
        ...(contactPhone ? { phone: contactPhone } : {}),
      };
    }

    let { response: diditRes, text: diditText, data: diditData } = await createDiditSession(diditKey, diditPayload);

    if (!diditRes.ok && (diditRes.status === 400 || diditRes.status === 404)) {
      const fallback = await fallbackWorkflowId(diditKey, workflowId);
      if (fallback && fallback !== workflowId) {
        console.warn('Retrying Didit session with default KYC workflow because configured workflow was rejected');
        diditPayload.workflow_id = fallback;
        ({ response: diditRes, text: diditText, data: diditData } = await createDiditSession(diditKey, diditPayload));
      }
    }

    if (!diditRes.ok) {
      console.error('Didit create session failed', diditRes.status, diditText);
      const setupMessage = diditSetupMessage(diditRes.status, diditData);
      await serviceClient
        .from('tenant_identity_verification')
        .update({
          provider_session_id: null,
          provider_session_token: null,
          verification_url: null,
          workflow_id: String(diditPayload.workflow_id ?? workflowId),
          status: 'error',
          provider_status: `HTTP ${diditRes.status}`,
          vendor_data: vendorData,
          last_error: setupMessage,
        })
        .eq('id', existing.id);
      return json({
        error: 'didit_session_failed',
        message: setupMessage,
      }, 502);
    }

    const sessionId = String(diditData.session_id ?? '');
    const verificationUrl = String(diditData.url ?? diditData.verification_url ?? '');
    if (!sessionId || !verificationUrl) {
      console.error('Didit create session missing identifiers', diditData);
      return json({
        error: 'didit_invalid_response',
        message: 'Didit did not return a verification link. Please try again.',
      }, 502);
    }

    const row = {
      tenant_id: tenantId,
      provider: 'didit',
      provider_session_id: sessionId,
      provider_session_token: typeof diditData.session_token === 'string' ? diditData.session_token : null,
      workflow_id: String(diditData.workflow_id ?? workflowId),
      status: normalizeDiditStatus(diditData.status),
      provider_status: String(diditData.status ?? 'Not Started'),
      verification_url: verificationUrl,
      vendor_data: vendorData,
      features: Array.isArray(diditData.features) ? diditData.features : [],
      decision: {},
      last_error: null,
      started_at: new Date().toISOString(),
    };

    const { data: saved, error: saveError } = await serviceClient
      .from('tenant_identity_verification')
      .update(row)
      .eq('id', existing.id)
      .select('*')
      .single();
    if (saveError) throw saveError;

    return json({ data: safeRowForClient(saved) }, 201);
  } catch (error) {
    console.error('create-didit-session failed', error);
    return json({
      error: 'didit_unavailable',
      message: 'Identity verification is unavailable right now. Please try again.',
    }, 503);
  }
});
