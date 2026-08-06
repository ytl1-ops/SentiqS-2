import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

// Miroir de AFRICA_54 / COUNTRY_CODES dans src/hooks/useAlertLevels.ts
const COUNTRY_NAMES: string[] = [
  "Afrique du Sud", "Algérie", "Angola", "Bénin", "Botswana",
  "Burkina Faso", "Burundi", "Cameroun", "Cap-Vert", "Centrafrique",
  "Comores", "Congo", "Côte d'Ivoire", "Djibouti", "Égypte",
  "Érythrée", "Éthiopie", "Gabon", "Gambie", "Ghana",
  "Guinée", "Guinée-Bissau", "Guinée Équatoriale", "Kenya", "Lesotho",
  "Libéria", "Libye", "Madagascar", "Malawi", "Mali",
  "Maroc", "Maurice", "Mauritanie", "Mozambique", "Namibie",
  "Niger", "Nigeria", "Ouganda", "RDC", "Rwanda",
  "Sao Tomé-et-Principe", "Sénégal", "Seychelles", "Sierra Leone", "Somalie",
  "Soudan", "Soudan du Sud", "Éswatini", "Tanzanie", "Tchad",
  "Togo", "Tunisie", "Zambie", "Zimbabwe",
];

const ALIASES: Record<string, string> = {
  "RD Congo": "RDC", "RDCongo": "RDC", "Congo-Kinshasa": "RDC", "Congo Kinshasa": "RDC",
  "Congo Brazzaville": "Congo", "Congo-Brazzaville": "Congo",
  "Cote d Ivoire": "Côte d'Ivoire", "Cote d'Ivoire": "Côte d'Ivoire",
  "Cap Vert": "Cap-Vert", "Guinee": "Guinée", "Guinee Bissau": "Guinée-Bissau", "Guinea Bissau": "Guinée-Bissau",
  "Guinee Equatoriale": "Guinée Équatoriale", "Equatorial Guinea": "Guinée Équatoriale",
  "Sao Tome": "Sao Tomé-et-Principe", "South Sudan": "Soudan du Sud",
  "Swaziland": "Éswatini", "Eswatini": "Éswatini", "Tanzania": "Tanzanie",
  "Algerie": "Algérie", "Algeria": "Algérie", "Egypte": "Égypte", "Egypt": "Égypte",
  "Erythree": "Érythrée", "Eritrea": "Érythrée", "Ethiopie": "Éthiopie", "Ethiopia": "Éthiopie",
  "RCA": "Centrafrique", "Central African Republic": "Centrafrique", "CAR": "Centrafrique",
  "Morocco": "Maroc", "Ivory Coast": "Côte d'Ivoire", "DR Congo": "RDC", "DRC": "RDC",
  "Democratic Republic of Congo": "RDC", "Republic of Congo": "Congo",
  "Mauritius": "Maurice", "Uganda": "Ouganda", "Guinea": "Guinée", "Libya": "Libye",
  "Sudan": "Soudan", "Chad": "Tchad", "Tunisia": "Tunisie", "Zambia": "Zambie",
};

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function norm(s: string): string {
  return stripAccents(s).toLowerCase();
}

function detectCountry(message: string): string | null {
  const normMsg = norm(message);

  const aliasEntries = Object.entries(ALIASES).sort((a, b) => b[0].length - a[0].length);
  for (const [alias, canonical] of aliasEntries) {
    if (normMsg.includes(norm(alias))) return canonical;
  }

  const sortedNames = [...COUNTRY_NAMES].sort((a, b) => b.length - a.length);
  for (const name of sortedNames) {
    if (normMsg.includes(norm(name))) return name;
  }

  return null;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: "MISSING_ANTHROPIC_KEY", detail: "ANTHROPIC_API_KEY non configurée sur ce projet Supabase." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json();
    const message: string = (body.message || "").toString().slice(0, 2000);
    const history: ChatMessage[] = Array.isArray(body.history) ? body.history : [];

    if (!message.trim()) {
      return new Response(JSON.stringify({ error: "message required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const country = detectCountry(message);
    const dataBlocks: string[] = [];
    const today = new Date().toISOString().slice(0, 10);

    if (country) {
      const [postureRes, historyRes, feedsRes, agendaRes] = await Promise.all([
        supabase.from("country_posture_state").select("*").eq("country_name", country).maybeSingle(),
        supabase.from("posture_history").select("*").eq("country_name", country).order("created_at", { ascending: false }).limit(3),
        supabase.from("feeds").select("title,category,timestamp,source,source_url,verification_status,summary").eq("country", country).in("verification_status", ["verified", "confirmed"]).order("timestamp", { ascending: false }).limit(10),
        supabase.from("agenda_events").select("title,date,type,description").eq("country", country).gte("date", today).order("date", { ascending: true }).limit(5),
      ]);

      dataBlocks.push(`PAYS DÉTECTÉ DANS LA QUESTION : ${country}`);

      if (postureRes.data) {
        const p = postureRes.data as { level: string; score: number; updated_at: string };
        dataBlocks.push(`NIVEAU DE POSTURE ENREGISTRÉ (country_posture_state) : ${p.level} (score ${p.score}/100, mis à jour le ${p.updated_at})`);
      } else {
        dataBlocks.push(`NIVEAU DE POSTURE ENREGISTRÉ : aucune donnée pour ${country} dans country_posture_state actuellement. Le niveau affiché dans le module Alertes est calculé dynamiquement à partir des flux ; il n'a pas encore été synchronisé pour ce pays. Ne PAS affirmer un niveau de risque sans cette donnée.`);
      }

      const historyData = (historyRes.data || []) as Array<{ created_at: string; old_level: string; new_level: string; old_score: number; new_score: number; reason: string | null }>;
      if (historyData.length > 0) {
        dataBlocks.push(
          `HISTORIQUE DES CHANGEMENTS RÉCENTS DE POSTURE :\n` +
          historyData.map((h) => `- ${h.created_at} : ${h.old_level} → ${h.new_level} (score ${h.old_score}→${h.new_score}). Raison enregistrée : ${h.reason || "non précisée"}`).join("\n"),
        );
      }

      const feedsData = (feedsRes.data || []) as Array<{ title: string; category: string | null; timestamp: string; source: string; source_url: string | null; summary: string | null }>;
      if (feedsData.length > 0) {
        dataBlocks.push(
          `FLUX VÉRIFIÉS RÉCENTS POUR ${country} (${feedsData.length} résultats) :\n` +
          feedsData.map((f, i) => `[${i + 1}] ${f.timestamp} | ${f.category || "N/A"} | ${f.source} : ${f.title}${f.summary ? " — " + f.summary : ""} (${f.source_url || "pas de lien"})`).join("\n"),
        );
      } else {
        dataBlocks.push(`FLUX VÉRIFIÉS RÉCENTS POUR ${country} : aucun flux vérifié trouvé dans la base actuellement.`);
      }

      const agendaData = (agendaRes.data || []) as Array<{ title: string; date: string; type: string; description: string | null }>;
      if (agendaData.length > 0) {
        dataBlocks.push(
          `ÉVÉNEMENTS À VENIR (agenda) POUR ${country} :\n` +
          agendaData.map((a) => `- ${a.date} (${a.type}) : ${a.title}`).join("\n"),
        );
      }
    } else {
      const postureRes = await supabase.from("country_posture_state").select("*").in("level", ["rouge", "orange"]).order("score", { ascending: false }).limit(10);
      const postureData = (postureRes.data || []) as Array<{ country_name: string; level: string; score: number }>;
      if (postureData.length > 0) {
        dataBlocks.push(
          `PAYS ACTUELLEMENT EN NIVEAU ÉLEVÉ (orange/rouge) DANS country_posture_state :\n` +
          postureData.map((p) => `- ${p.country_name} : ${p.level} (score ${p.score})`).join("\n"),
        );
      } else {
        dataBlocks.push(`Aucun pays n'apparaît actuellement en orange/rouge dans country_posture_state (donnée pas encore synchronisée en production, ou aucune escalade en cours). Ne PAS en déduire que la situation est calme partout — dire que cette donnée spécifique est indisponible.`);
      }
    }

    const contextText = dataBlocks.join("\n\n");

    const systemPrompt = `Tu es l'assistant intégré de SentiqS, plateforme de veille sécuritaire sur 54 pays d'Afrique.

RÈGLES IMPÉRATIVES (zéro hallucination) :
1. Réponds UNIQUEMENT à partir des DONNÉES DISPONIBLES ci-dessous, extraites en temps réel de la base SentiqS. N'invente JAMAIS un fait, un événement, une date, un chiffre ou un niveau de risque qui n'y figure pas explicitement.
2. Si les données fournies ne permettent pas de répondre, dis-le clairement : "Je n'ai pas cette information dans la base SentiqS actuellement." Ne complète jamais par des connaissances générales non vérifiées sur l'actualité du pays.
3. Si la question suppose une prémisse fausse (ex. un pays présenté comme « critique » ou « rouge » alors que rien dans les données ne le confirme), corrige-la explicitement au lieu de jouer le jeu de la question.
4. Cite tes sources (nom du média + date) quand tu t'appuies sur un flux.
5. Réponds en 3 à 6 phrases, ton professionnel et direct, dans la langue de la question (français ou anglais).

DONNÉES DISPONIBLES (extraites en direct de la base SentiqS à l'instant de la question) :
${contextText || "Aucune donnée pertinente trouvée pour cette question."}`;

    const messages: ChatMessage[] = [];
    for (const h of history.slice(-6)) {
      if ((h.role === "user" || h.role === "assistant") && typeof h.content === "string") {
        messages.push({ role: h.role, content: h.content.slice(0, 2000) });
      }
    }
    messages.push({ role: "user", content: message });

    const anthropicRes = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 700,
        system: systemPrompt,
        messages,
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      return new Response(
        JSON.stringify({ error: "Anthropic API error", status: anthropicRes.status, detail: errText.slice(0, 500) }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const claudeData = await anthropicRes.json();
    const answer: string = claudeData.content?.[0]?.text || "";

    return new Response(
      JSON.stringify({ answer, country_matched: country }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal error", detail: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
