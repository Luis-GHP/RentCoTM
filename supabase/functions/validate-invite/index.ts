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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const { token } = await req.json();
    if (!token) return json({ error: 'token is required' }, 400);

    // Use service role so the token lookup bypasses RLS
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data, error } = await supabase
      .rpc('validate_invite_token', { p_token: token })
      .single();

    if (error) return json({ error: error.message }, 500);

    if (!data?.is_valid) return json(data);

    const { data: tenant } = data.tenant_id
      ? await supabase
        .from('tenant')
        .select('name')
        .eq('id', data.tenant_id)
        .single()
      : { data: null };

    const { data: invite } = await supabase
      .from('tenant_invite')
      .select(`
        unit:unit_id (
          unit_number,
          property:property_id (name, address)
        )
      `)
      .eq('token', token)
      .single();

    const unit = Array.isArray(invite?.unit) ? invite?.unit[0] : invite?.unit;
    const property = Array.isArray(unit?.property) ? unit?.property[0] : unit?.property;

    return json({
      ...data,
      tenant_name: tenant?.name ?? null,
      unit_number: unit?.unit_number ?? null,
      property_name: property?.name ?? null,
      property_address: property?.address ?? null,
    });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
