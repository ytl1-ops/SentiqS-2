import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ============================================================
// SentiqS — alert-dead-sources v1.0
// Audit du 2026-08-09 ("instabilité de la collecte, zéro alerting") :
// les échecs de rss-poll finissaient dans un JSON de réponse HTTP que
// personne ne lisait — une source RSS pouvait rester cassée
// indéfiniment sans que personne ne s'en aperçoive. Ce job planifié
// (cron horaire) surveille osint_sources.consecutive_failures (peuplé
// par rss-poll depuis la v1.2) et notifie l'équipe via send-push-alert,
// qui gère déjà son propre cooldown (notification_log) pour ne pas
// spammer à chaque exécution tant que la panne n'est pas résolue.
// ============================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 5 cycles ratés d'affilée (cron sentiqs-rss-poll toutes les 30 min) = ~2h30
// sans succès avant de considérer une source comme en panne — assez pour
// absorber un blip ponctuel (déjà couvert par le retry côté rss-poll),
// pas assez pour laisser une vraie panne filer plusieurs jours sans alerte.
const FAILURE_THRESHOLD = 5;
const ALERT_COOLDOWN_MINUTES = 240;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: deadSources, error } = await supabase
      .from('osint_sources')
      .select('id, source_name, consecutive_failures, last_failure_reason, last_success_at')
      .eq('is_active', true)
      .gte('consecutive_failures', FAILURE_THRESHOLD)
      .order('consecutive_failures', { ascending: false });

    if (error) throw error;

    if (!deadSources || deadSources.length === 0) {
      return new Response(JSON.stringify({ success: true, dead_sources: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const summary = deadSources
      .map((s) => `${s.source_name} (${s.consecutive_failures} échecs, ${s.last_failure_reason ?? 'raison inconnue'})`)
      .join(' ; ');

    // dedupKey basé sur l'ensemble des sources concernées : si le lot de
    // sources en panne change (une nouvelle tombe, une autre se rétablit),
    // c'est une alerte différente qui doit repasser le cooldown à zéro.
    const dedupKey = `dead-sources-${deadSources.map((s) => s.id).sort((a, b) => a - b).join('-')}`;

    const { error: alertErr } = await supabase.functions.invoke('send-push-alert', {
      body: {
        title: `${deadSources.length} source${deadSources.length > 1 ? 's' : ''} RSS en panne`,
        body: summary.substring(0, 500),
        dedupKey,
        cooldownMinutes: ALERT_COOLDOWN_MINUTES,
      },
    });

    return new Response(JSON.stringify({
      success: true,
      dead_sources: deadSources.length,
      sources: deadSources.map((s) => ({
        id: s.id,
        name: s.source_name,
        consecutive_failures: s.consecutive_failures,
        last_failure_reason: s.last_failure_reason,
        last_success_at: s.last_success_at,
      })),
      alert_dispatch_error: alertErr ? alertErr.message : null,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
