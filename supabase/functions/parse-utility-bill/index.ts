import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

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
  message: 'PDF parsing is currently unavailable. Please enter bill details manually.',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const { bill_pdf_url } = await req.json();
    if (!bill_pdf_url) return json({ error: 'bill_pdf_url is required' }, 400);

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicKey) return json(UNAVAILABLE, 503);

    // Download PDF from Supabase Storage
    const pdfRes = await fetch(bill_pdf_url);
    if (!pdfRes.ok) return json({ error: 'Failed to download PDF' }, 400);

    const pdfBytes = await pdfRes.arrayBuffer();
    const pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(pdfBytes)));

    // Send to Claude Haiku for extraction
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 },
            },
            {
              type: 'text',
              text: `Extract billing information from this utility bill. Return ONLY a valid JSON object with these exact keys:
{
  "provider": "company name (e.g. Meralco, Manila Water, PLDT)",
  "utility_type": "electric | water | internet | other",
  "period_month": <number 1-12>,
  "period_year": <number e.g. 2026>,
  "reading_start": <number or null>,
  "reading_end": <number or null>,
  "kwh_consumed": <number or null>,
  "rate_per_kwh": <number or null>,
  "amount": <number total amount due in PHP>,
  "confidence": "high | medium | low"
}
No explanation. No markdown. JSON only.`,
            },
          ],
        }],
      }),
    });

    if (!anthropicRes.ok) return json(UNAVAILABLE, 503);

    const anthropicData = await anthropicRes.json();
    const raw = anthropicData.content?.[0]?.text ?? '';

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return json({ error: 'parse_failed', message: 'Could not read bill. Please enter details manually.' }, 422);
    }

    return json({ data: parsed });
  } catch {
    return json(UNAVAILABLE, 503);
  }
});
