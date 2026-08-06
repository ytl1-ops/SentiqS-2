import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LEVEL_ORDER: Record<string, number> = {
  vert: 0,
  jaune: 1,
  orange: 2,
  rouge: 3,
};

interface PostureInput {
  country_code: string;
  country_name: string;
  level: string;
  score: number;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();
    const inputs: PostureInput[] = body.levels || [];

    if (!Array.isArray(inputs) || inputs.length === 0) {
      return new Response(
        JSON.stringify({ success: true, changes: [], message: "No levels provided" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: currentStates, error: stateError } = await supabaseClient
      .from("country_posture_state")
      .select("country_code, country_name, level, score");

    if (stateError) {
      return new Response(
        JSON.stringify({ success: false, error: stateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stateMap = new Map<string, { level: string; score: number }>();
    (currentStates || []).forEach((s) => {
      stateMap.set(s.country_code, { level: s.level, score: s.score });
    });

    const newHistoryEntries: Array<{
      country_code: string;
      country_name: string;
      old_level: string;
      new_level: string;
      old_score: number;
      new_score: number;
      reason: string | null;
      event_type: string;
    }> = [];

    // Pays passant réellement AU niveau rouge (pas déjà rouge avant) —
    // ce sont ceux-là, et seulement ceux-là, qui déclenchent une notification
    // push critique (écran de verrouillage). Une simple variation de score en
    // restant rouge ne renvoie pas de nouvelle alerte.
    const newCriticalEscalations: Array<{ country_name: string; score: number }> = [];

    const upsertStates: Array<{
      country_code: string;
      country_name: string;
      level: string;
      score: number;
    }> = [];

    for (const input of inputs) {
      const prev = stateMap.get(input.country_code);
      const currentLevel = input.level;
      const currentScore = input.score;

      const levelChanged = !prev || prev.level !== currentLevel;
      const scoreChanged = prev && Math.abs(prev.score - currentScore) > 5;

      if (levelChanged) {
        const oldLevel = prev ? prev.level : "non_cote";
        const oldScore = prev ? prev.score : 0;

        let reason: string | null = null;
        const oldIdx = LEVEL_ORDER[oldLevel] ?? -1;
        const newIdx = LEVEL_ORDER[currentLevel] ?? -1;

        if (oldIdx === -1 && newIdx !== -1) {
          reason = `Première cotation du pays — score calculé ${currentScore}/100`;
        } else if (newIdx > oldIdx) {
          const reasonMap: Record<string, string> = {
            rouge: "Détérioration critique — conflit majeur ou évacuation recommandée",
            orange: "Dégradation significative de la situation sécuritaire",
            jaune: "Augmentation des tensions — vigilance renforcée recommandée",
          };
          reason = reasonMap[currentLevel] || `Score passé de ${oldScore} à ${currentScore}`;

          if (currentLevel === "rouge" && prev) {
            newCriticalEscalations.push({ country_name: input.country_name, score: currentScore });
          }
        } else if (newIdx < oldIdx) {
          const reasonMap: Record<string, string> = {
            vert: "Retour à la normale — absence d'incidents majeurs signalés",
            jaune: "Amélioration progressive — risque modéré résiduel",
            orange: "Désescalade partielle — risque encore élevé",
          };
          reason = reasonMap[currentLevel] || `Score passé de ${oldScore} à ${currentScore}`;
        }

        newHistoryEntries.push({
          country_code: input.country_code,
          country_name: input.country_name,
          old_level: oldLevel,
          new_level: currentLevel,
          old_score: oldScore,
          new_score: currentScore,
          reason,
          event_type: "auto",
        });
      } else if (scoreChanged && prev) {
        newHistoryEntries.push({
          country_code: input.country_code,
          country_name: input.country_name,
          old_level: prev.level,
          new_level: currentLevel,
          old_score: prev.score,
          new_score: currentScore,
          reason: `Variation significative du score (${prev.score > currentScore ? "-" : "+"}${Math.abs(Math.round(prev.score - currentScore))} pts)`,
          event_type: "auto",
        });
      }

      upsertStates.push({
        country_code: input.country_code,
        country_name: input.country_name,
        level: currentLevel,
        score: currentScore,
      });
    }

    if (newHistoryEntries.length > 0) {
      const { error: histError } = await supabaseClient
        .from("posture_history")
        .insert(newHistoryEntries);

      if (histError) {
        return new Response(
          JSON.stringify({ success: false, error: histError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (upsertStates.length > 0) {
      const { error: upsertError } = await supabaseClient
        .from("country_posture_state")
        .upsert(upsertStates, { onConflict: "country_code" });

      if (upsertError) {
        return new Response(
          JSON.stringify({ success: false, error: upsertError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Notification push best-effort — ne doit jamais faire échouer la synchro
    // de posture si l'envoi échoue (clés VAPID absentes, etc.)
    if (newCriticalEscalations.length > 0) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
        for (const esc of newCriticalEscalations) {
          await fetch(`${supabaseUrl}/functions/v1/send-push-alert`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({
              title: `🚨 ${esc.country_name} — Niveau CRITIQUE`,
              body: `Score de risque : ${esc.score.toFixed(1)}/100. Vérification immédiate recommandée.`,
              url: "/dashboard/alerts",
            }),
          });
        }
      } catch (pushErr) {
        console.error("[sync-posture-changes] push notification failed:", pushErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        changes: newHistoryEntries.length,
        entries: newHistoryEntries,
        pushNotified: newCriticalEscalations.length,
        message: `${newHistoryEntries.length} changement(s) de posture enregistré(s)`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
