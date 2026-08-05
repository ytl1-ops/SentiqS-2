import { createClient } from 'npm:@supabase/supabase-js@2';

interface AdminPayload {
  email: string;
  password: string;
  full_name?: string;
  organization?: string;
  zone?: string;
}

function corsHeaders(origin: string) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin') ?? '*';

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(origin) });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = (await req.json()) as AdminPayload;
    const email = body.email?.trim().toLowerCase();
    const password = body.password;

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Email and password are required' }), {
        status: 400,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    if (password.length < 8) {
      return new Response(JSON.stringify({ error: 'Password must be at least 8 characters' }), {
        status: 400,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Call the proven DB function that inserts directly into auth.users + auth.identities + profiles
    const { data, error } = await supabaseAdmin.rpc('create_admin_user', {
      p_email: email,
      p_password: password,
      p_full_name: body.full_name || '',
      p_org: body.organization || '',
      p_zone: body.zone || '',
    });

    if (error) {
      return new Response(JSON.stringify({ error: error.message, code: error.code }), {
        status: 400,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    const result = data as { status: string; message?: string; user_id?: string };

    if (result?.status === 'exists') {
      return new Response(JSON.stringify({ error: 'Un compte existe déjà avec cette adresse e-mail.', code: 'user_exists' }), {
        status: 409,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    if (result?.status === 'error') {
      return new Response(JSON.stringify({ error: result.message || 'Creation failed' }), {
        status: 400,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, user_id: result?.user_id }), {
      status: 200,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    });
  }
});
