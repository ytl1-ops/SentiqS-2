// Désactivée après usage unique (reset ponctuel du mot de passe propriétaire).
Deno.serve(() => new Response(JSON.stringify({ error: 'disabled' }), { status: 410, headers: { 'Content-Type': 'application/json' } }));
