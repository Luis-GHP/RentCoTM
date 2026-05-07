import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-signature, x-signature-v2, x-signature-simple, x-timestamp',
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

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce((result, key) => {
        result[key] = sortKeys((value as Record<string, unknown>)[key]);
        return result;
      }, {} as Record<string, unknown>);
  }
  return value;
}

async function hmacHex(secret: string, payload: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

function constantEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function freshTimestamp(value: string | null) {
  const incoming = Number(value);
  if (!Number.isFinite(incoming)) return false;
  return Math.abs(Math.floor(Date.now() / 1000) - incoming) <= 300;
}

async function verifySignature(
  rawBody: string,
  jsonBody: Record<string, unknown>,
  headers: Headers,
  secret: string,
) {
  const timestamp = headers.get('x-timestamp');
  if (!freshTimestamp(timestamp)) return false;

  const signatureV2 = headers.get('x-signature-v2');
  if (signatureV2) {
    const canonicalJson = JSON.stringify(sortKeys(jsonBody));
    const expected = await hmacHex(secret, canonicalJson);
    if (constantEqual(expected, signatureV2)) return true;
  }

  const signatureSimple = headers.get('x-signature-simple');
  if (signatureSimple) {
    const canonicalString = [
      jsonBody.timestamp ?? '',
      jsonBody.session_id ?? '',
      jsonBody.status ?? '',
      jsonBody.webhook_type ?? '',
    ].join(':');
    const expected = await hmacHex(secret, canonicalString);
    if (constantEqual(expected, signatureSimple)) return true;
  }

  const signatureRaw = headers.get('x-signature');
  if (signatureRaw) {
    const expected = await hmacHex(secret, rawBody);
    if (constantEqual(expected, signatureRaw)) return true;
  }

  return false;
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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const secret = Deno.env.get('DIDIT_WEBHOOK_SECRET');
    if (!secret) return json({ error: 'webhook_secret_missing' }, 503);

    const rawBody = await req.text();
    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    const verified = await verifySignature(rawBody, payload, req.headers, secret);
    if (!verified) return json({ error: 'invalid_signature' }, 401);

    const sessionId = String(payload.session_id ?? '');
    if (!sessionId) return json({ error: 'missing_session_id' }, 400);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const serviceClient = createClient(supabaseUrl, serviceKey);
    const decision = (payload.decision && typeof payload.decision === 'object')
      ? payload.decision as Record<string, unknown>
      : payload;
    const providerStatus = String(payload.status ?? decision.status ?? '');
    const status = normalizeDiditStatus(providerStatus);
    const update = {
      status,
      provider_status: providerStatus,
      workflow_id: typeof payload.workflow_id === 'string' ? payload.workflow_id : undefined,
      vendor_data: typeof payload.vendor_data === 'string' ? payload.vendor_data : undefined,
      verification_url: typeof decision.session_url === 'string' ? decision.session_url : undefined,
      features: Array.isArray(decision.features) ? decision.features : undefined,
      decision,
      resubmit_info: payload.resubmit_info ?? decision.resubmit_info ?? null,
      review_message: reviewMessageFor(status),
      submitted_at: submittedAtFor(status),
      completed_at: completedAtFor(status),
      last_error: null,
      ...extractedFields(decision),
    };

    Object.keys(update).forEach(key => {
      if ((update as Record<string, unknown>)[key] === undefined) delete (update as Record<string, unknown>)[key];
    });

    const { error } = await serviceClient
      .from('tenant_identity_verification')
      .update(update)
      .eq('provider', 'didit')
      .eq('provider_session_id', sessionId);
    if (error) throw error;

    return json({ received: true });
  } catch (error) {
    console.error('didit-webhook failed', error);
    return json({ error: 'webhook_failed' }, 500);
  }
});
