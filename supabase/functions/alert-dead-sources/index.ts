import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ============================================================
// SentiqS — alert-dead-sources v1.1
// Audit du 2026-08-09 ("instabilité de la collecte, zéro alerting") :
// les échecs de rss-poll finissaient dans un JSON de réponse HTTP que
// personne ne lisait — une source RSS pouvait rester cassée
// indéfiniment sans que personne ne s'en aperçoive. Ce job planifié
// (cron horaire) surveille osint_sources.consecutive_failures (peuplé
// par rss-poll depuis la v1.2) et notifie l'équipe via send-push-alert,
// qui gère déjà son propre cooldown (notification_log) pour ne pas
// spammer à chaque exécution tant que la panne n'est pas résolue.
//
// v1.1 (2026-08-10) — ajoute une seconde vérification indépendante :
// osint_sources ne couvre que les ~33 flux RSS enregistrés, alors
// qu'aucun des 54 pays suivis par refresh-coverage-gaps n'y a de ligne.
// Un pays pouvait donc rester des jours sans la moindre recherche
// sécuritaire ciblée sans déclencher quoi que ce soit ici (cas réel :
// Côte d'Ivoire, le décès du colonel Fofié annoncé par les FACI n'a
// jamais été détecté). On surveille désormais aussi
// country_posture_state.last_collection_at, mis à jour par
// refresh-coverage-gaps à chaque passage — succès ou échec.
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

// refresh-coverage-gaps tourne toutes les 30 min et traite 5 pays sur 54 —
// une rotation complète prend ~5h30 dans le pire cas. 24h laisse une marge
// large (plusieurs rotations manquées) avant de considérer qu'un pays est
// vraiment livré à lui-même, tout en restant assez court pour rester
// "durable" au sens de l'utilisateur (pas besoin d'attendre une semaine
// pour s'en apercevoir).
const COVERAGE_STALE_HOURS = 24;
const COVERAGE_ALERT_COOLDOWN_MINUTES = 360;

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

    let deadSourcesAlertError: string | null = null;
    if (deadSources && deadSources.length > 0) {
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
      deadSourcesAlertError = alertErr ? alertErr.message : null;
    }

    // ---- Couverture pays : refresh-coverage-gaps jamais passé ou en retard ----
    const coverageStaleCutoff = new Date(Date.now() - COVERAGE_STALE_HOURS * 3600 * 1000).toISOString();
    const { data: staleCountries, error: staleErr } = await supabase
      .from('country_posture_state')
      .select('country_code, country_name, last_collection_at, coverage_status')
      .or(`last_collection_at.is.null,last_collection_at.lt.${coverageStaleCutoff}`)
      .order('last_collection_at', { ascending: true, nullsFirst: true });

    if (staleErr) throw staleErr;

    let coverageAlertError: string | null = null;
    if (staleCountries && staleCountries.length > 0) {
      const summary = staleCountries
        .slice(0, 15)
        .map((c) => `${c.country_name} (${c.last_collection_at ? 'depuis ' + c.last_collection_at : 'jamais vérifié'})`)
        .join(' ; ');

      const dedupKey = `stale-coverage-${staleCountries.map((c) => c.country_code).sort().join('-')}`;

      const { error: alertErr } = await supabase.functions.invoke('send-push-alert', {
        body: {
          title: `${staleCountries.length} pays sans recherche sécuritaire ciblée depuis ${COVERAGE_STALE_HOURS}h+`,
          body: summary.substring(0, 500),
          dedupKey,
          cooldownMinutes: COVERAGE_ALERT_COOLDOWN_MINUTES,
        },
      });
      coverageAlertError = alertErr ? alertErr.message : null;
    }

    return new Response(JSON.stringify({
      success: true,
      dead_sources: deadSources?.length ?? 0,
      sources: (deadSources ?? []).map((s) => ({
        id: s.id,
        name: s.source_name,
        consecutive_failures: s.consecutive_failures,
        last_failure_reason: s.last_failure_reason,
        last_success_at: s.last_success_at,
      })),
      dead_sources_alert_error: deadSourcesAlertError,
      stale_coverage_countries: staleCountries?.length ?? 0,
      stale_coverage_sample: (staleCountries ?? []).slice(0, 15).map((c) => ({
        code: c.country_code,
        name: c.country_name,
        last_collection_at: c.last_collection_at,
        coverage_status: c.coverage_status,
      })),
      coverage_alert_error: coverageAlertError,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
