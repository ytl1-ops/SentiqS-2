import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // Fetch current state for all countries at once
    const { data: currentStates, error: stateError } = await supabaseClient
      .from("country_posture_state")
      .select("country_code, country_name, level, score");

    if (stateError) {
      return new Response(
        JSON.stringify({ success: false, error: stateError.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
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

      // Determine if this is a level change
      const levelChanged = !prev || prev.level !== currentLevel;

      // Determine if score changed meaningfully (more than 5 points)
      const scoreChanged = prev && Math.abs(prev.score - currentScore) > 5;

      if (levelChanged) {
        const oldLevel = prev ? prev.level : "non_cote";
        const oldScore = prev ? prev.score : 0;

        // Generate reason based on direction
        let reason: string | null = null;
        const oldIdx = LEVEL_ORDER[oldLevel] ?? -1;
        const newIdx = LEVEL_ORDER[currentLevel] ?? -1;

        if (oldIdx === -1 && newIdx !== -1) {
          reason = `Première cotation du pays — score calculé ${currentScore}/100`;
        } else if (newIdx > oldIdx) {
          // Escalation
          const reasonMap: Record<string, string> = {
            rouge: "Détérioration critique — conflit majeur ou évacuation recommandée",
            orange: "Dégradation significative de la situation sécuritaire",
            jaune: "Augmentation des tensions — vigilance renforcée recommandée",
          };
          reason = reasonMap[currentLevel] || `Score passé de ${oldScore} à ${currentScore}`;
        } else if (newIdx < oldIdx) {
          // De-escalation
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
        // Score changed significantly but no level change — still record it
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

      // Always upsert current state
      upsertStates.push({
        country_code: input.country_code,
        country_name: input.country_name,
        level: currentLevel,
        score: currentScore,
      });
    }

    // Insert history entries
    if (newHistoryEntries.length > 0) {
      const { error: histError } = await supabaseClient
        .from("posture_history")
        .insert(newHistoryEntries);

      if (histError) {
        return new Response(
          JSON.stringify({ success: false, error: histError.message }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Upsert current states
    if (upsertStates.length > 0) {
      const { error: upsertError } = await supabaseClient
        .from("country_posture_state")
        .upsert(upsertStates, { onConflict: "country_code" });

      if (upsertError) {
        return new Response(
          JSON.stringify({ success: false, error: upsertError.message }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        changes: newHistoryEntries.length,
        entries: newHistoryEntries,
        message: `${newHistoryEntries.length} changement(s) de posture enregistré(s)`,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});