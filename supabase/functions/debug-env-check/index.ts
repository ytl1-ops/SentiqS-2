import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (_req: Request) => {
  return new Response(JSON.stringify({ error: 'disabled' }), { status: 410, headers: { 'Content-Type': 'application/json' } });
});
