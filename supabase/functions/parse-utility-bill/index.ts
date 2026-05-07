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

const UNAVAILABLE = {
  error: 'anthropic_unavailable',
  message: 'AI bill parsing is currently unavailable. Please enter bill details manually.',
};

const MAX_PDF_BYTES = 10 * 1024 * 1024;

const EXTRACTION_PROMPT = `You are extracting structured billing data from a utility bill PDF for a Philippine rental property app.

Look for common bill labels such as:
- Provider/company: Meralco, VECO, DLPC, Beneco, Manila Water, Maynilad, PLDT, Globe, Converge, or similar.
- Billing period, service period, statement period, bill month, due date, or bill date.
- Total Amount Due, Amount Due, Current Amount Due, Total Current Charges, Balance Due, or similar.
- For electric bills: present reading, previous reading, kWh used/consumed, and rate per kWh.

Rules:
- Return ONLY one valid JSON object. No markdown, no code fences, no explanation.
- Use raw numbers only. Remove currency symbols, commas, and units.
- Use null when a field is not present or cannot be inferred.
- period_month and period_year should represent the billing/service period. If that is missing, infer from due date or bill date.
- amount is the peso amount the tenant should pay for this bill. Prefer Total Amount Due / Amount Due.
- For water or internet bills, reading_start, reading_end, kwh_consumed, and rate_per_kwh should be null unless the bill explicitly provides comparable usage fields.
- For electric bills, if rate_per_kwh is not printed but kwh_consumed and amount are clear, calculate an approximate rate_per_kwh as amount / kwh_consumed.
- confidence is "high" when provider, period, and amount are clear; "medium" when one key value is inferred; "low" when multiple values are uncertain.

Return exactly this shape:
{
  "provider": "company name",
  "utility_type": "electric | water | internet | other",
  "period_month": 1,
  "period_year": 2026,
  "reading_start": null,
  "reading_end": null,
  "kwh_consumed": null,
  "rate_per_kwh": null,
  "amount": 0,
  "confidence": "high | medium | low"
}`;

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function parseJsonObject(raw: string) {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const withoutFence = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    try {
      return JSON.parse(withoutFence);
    } catch {
      const start = withoutFence.indexOf('{');
      const end = withoutFence.lastIndexOf('}');
      if (start >= 0 && end > start) {
        return JSON.parse(withoutFence.slice(start, end + 1));
      }
      throw new Error('No JSON object found');
    }
  }
}

function toNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^0-9.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeMonth(value: unknown) {
  const numeric = toNumber(value);
  if (numeric && numeric >= 1 && numeric <= 12) return Math.trunc(numeric);
  if (typeof value === 'string') {
    const month = [
      'january', 'february', 'march', 'april', 'may', 'june',
      'july', 'august', 'september', 'october', 'november', 'december',
    ].findIndex(name => value.toLowerCase().includes(name));
    if (month >= 0) return month + 1;
  }
  return null;
}

function normalizeParsedBill(parsed: Record<string, unknown>) {
  const now = new Date();
  const type = String(parsed.utility_type ?? '').toLowerCase();
  const utilityType = ['electric', 'water', 'internet', 'other'].includes(type) ? type : 'other';
  const confidence = String(parsed.confidence ?? '').toLowerCase();
  const periodMonth = normalizeMonth(parsed.period_month) ?? now.getMonth() + 1;
  const periodYear = toNumber(parsed.period_year) ?? now.getFullYear();
  const kwhConsumed = toNumber(parsed.kwh_consumed);
  const amount = toNumber(parsed.amount);
  const explicitRate = toNumber(parsed.rate_per_kwh);
  const ratePerKwh = explicitRate ?? (utilityType === 'electric' && kwhConsumed && amount ? amount / kwhConsumed : null);

  if (!amount || amount <= 0) {
    throw new Error('Missing amount');
  }

  return {
    provider: String(parsed.provider ?? '').trim() || 'Unknown provider',
    utility_type: utilityType,
    period_month: periodMonth,
    period_year: Math.trunc(periodYear),
    reading_start: toNumber(parsed.reading_start),
    reading_end: toNumber(parsed.reading_end),
    kwh_consumed: kwhConsumed,
    rate_per_kwh: ratePerKwh == null ? null : Number(ratePerKwh.toFixed(4)),
    amount,
    confidence: ['high', 'medium', 'low'].includes(confidence) ? confidence : 'low',
  };
}

function storagePathFromSupabaseUrl(value: unknown, supabaseUrl: string) {
  if (typeof value !== 'string') return null;

  try {
    const url = new URL(value);
    const projectUrl = new URL(supabaseUrl);
    if (url.origin !== projectUrl.origin) return null;

    const publicPrefix = '/storage/v1/object/public/utility-bills/';
    const signPrefix = '/storage/v1/object/sign/utility-bills/';
    const prefix = url.pathname.startsWith(publicPrefix)
      ? publicPrefix
      : url.pathname.startsWith(signPrefix)
        ? signPrefix
        : null;
    if (!prefix) return null;
    return decodeURIComponent(url.pathname.slice(prefix.length));
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'auth_required', message: 'You must be signed in to parse utility bills.' }, 401);

    const { bill_pdf_path, bill_pdf_url } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const userClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) return json({ error: 'invalid_session', message: 'Your session expired. Sign in again and retry the parser.' }, 401);

    const { data: profile, error: profileError } = await userClient
      .from('user_profile')
      .select('role')
      .eq('id', authData.user.id)
      .single();
    if (profileError || profile?.role !== 'landlord') {
      return json({ error: 'landlord_required', message: 'Only landlord accounts can parse utility bills.' }, 403);
    }

    const pdfPath = typeof bill_pdf_path === 'string'
      ? bill_pdf_path
      : storagePathFromSupabaseUrl(bill_pdf_url, supabaseUrl);
    if (!pdfPath) return json({ error: 'missing_pdf_path', message: 'No bill PDF was sent to the parser.' }, 400);
    if (!pdfPath.startsWith(`landlord/${authData.user.id}/`) || pdfPath.includes('..')) {
      return json({ error: 'pdf_owner_mismatch', message: 'This bill PDF was not uploaded by the current landlord account.' }, 403);
    }

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicKey) return json(UNAVAILABLE, 503);

    const serviceClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: pdfBlob, error: downloadError } = await serviceClient.storage
      .from('utility-bills')
      .download(pdfPath);
    if (downloadError || !pdfBlob) {
      return json({ error: 'pdf_download_failed', message: 'The parser could not download the uploaded bill PDF from Storage.' }, 400);
    }

    const pdfBytes = await pdfBlob.arrayBuffer();
    if (pdfBytes.byteLength === 0) {
      return json({
        error: 'empty_pdf',
        message: 'The uploaded PDF is empty. Please select the original bill file and upload it again.',
      }, 422);
    }
    if (pdfBytes.byteLength > MAX_PDF_BYTES) {
      return json({ error: 'pdf_too_large', message: 'This PDF is too large to parse. Please upload a smaller bill PDF.' }, 413);
    }
    const pdfBase64 = arrayBufferToBase64(pdfBytes);
    const model = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-haiku-4-5-20251001';

    // Send to Claude Haiku for extraction
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1200,
        system: 'You are a strict JSON extraction service. Return only valid JSON that matches the requested schema.',
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 },
            },
            {
              type: 'text',
              text: EXTRACTION_PROMPT,
            },
          ],
        }],
      }),
    });

    if (!anthropicRes.ok) {
      const body = await anthropicRes.text();
      console.error('Anthropic utility parse failed', anthropicRes.status);
      let reason = `Anthropic returned HTTP ${anthropicRes.status}`;
      try {
        const parsed = JSON.parse(body);
        if (parsed?.error?.message) reason = parsed.error.message;
      } catch {
        // Keep the HTTP status fallback.
      }
      return json({
        error: 'anthropic_request_failed',
        message: `AI parser could not analyze this PDF right now: ${reason}. Please enter bill details manually.`,
      }, 503);
    }

    const anthropicData = await anthropicRes.json();
    const raw = (anthropicData.content ?? [])
      .filter((block: { type?: string }) => block.type === 'text')
      .map((block: { text?: string }) => block.text ?? '')
      .join('\n');

    let parsed: Record<string, unknown>;
    try {
      parsed = normalizeParsedBill(parseJsonObject(raw));
    } catch (err) {
      console.error('Utility parse JSON failed', err);
      return json({ error: 'parse_failed', message: 'Could not read bill. Please enter details manually.' }, 422);
    }

    return json({ data: parsed });
  } catch (err) {
    console.error('parse-utility-bill failed', err);
    return json(UNAVAILABLE, 503);
  }
});
