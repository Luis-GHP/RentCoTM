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
    const { user_id, title, body, data } = await req.json();
    if (!user_id || !title || !body) return json({ error: 'user_id, title, and body are required' }, 400);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Look up push token
    const { data: profile, error: profileError } = await supabase
      .from('user_profile')
      .select('push_token')
      .eq('id', user_id)
      .single();

    if (profileError) return json({ error: profileError.message }, 500);
    if (!profile?.push_token) return json({ skipped: true, reason: 'No push token registered' });

    // Send via Expo Push API
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

    // Expo returns a ticket — check for errors
    const ticket = expoData.data;
    if (ticket?.status === 'error') {
      // Token is invalid — clear it so we stop trying
      if (ticket.details?.error === 'DeviceNotRegistered') {
        await supabase
          .from('user_profile')
          .update({ push_token: null })
          .eq('id', user_id);
      }
      return json({ error: ticket.message }, 500);
    }

    return json({ sent: true, ticket });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
