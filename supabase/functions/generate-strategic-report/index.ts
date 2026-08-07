import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================
// FILTRE SERVEUR — realDataGuard porté en Deno (4 critères)
// Appliqué AVANT inclusion dans tout rapport stratégique.
// ============================================================

const SYNTHETIC_ID_PATTERNS: RegExp[] = [
  /^feed-\d+$/,
  /^FLX-/,
  /^[a-z]{2}-feed-/,
  /^feed-rss-/,
  /-extra-/,
];

const NON_ARTICLE_DOMAINS = new Set([
  'google.com', 'www.google.com',
  'bing.com', 'www.bing.com',
  'search.yahoo.com',
  'duckduckgo.com', 'www.duckduckgo.com',
]);

function isSyntheticId(id: string | number): boolean {
  const str = String(id);
  return SYNTHETIC_ID_PATTERNS.some((p) => p.test(str));
}

function isArticleUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    if (NON_ARTICLE_DOMAINS.has(parsed.hostname)) return false;
    const pathname = parsed.pathname.replace(/\/+$/, '');
    if (!pathname || pathname === '/') return false;
    const segments = pathname.split('/').filter(Boolean);
    return segments.length > 0;
  } catch { return false; }
}

// ============================================================
// TYPES
// ============================================================

interface RawFeed {
  id: string;
  title: string;
  source: string;
  source_url: string | null;
  country: string;
  created_at: string;
  verification_status: string;
  hallucination_score: number;
  source_status: string;
  rss_validated?: boolean | null;
}

interface FilteredFeed {
  id: string;
  title: string;
  source: string;
  source_url: string;
  country: string;
  created_at: string;
  isVerified: boolean;
  verificationStatus: string;
}

interface FilterReport {
  total_fetched: number;
  passed: FilteredFeed[];
  rejected: number;
  verified: FilteredFeed[];
  unverified: FilteredFeed[];
}

// ============================================================
// FILTRE PRINCIPAL — 4 critères
// ============================================================

function filterFeedsForReport(feeds: RawFeed[]): FilterReport {
  const passed: FilteredFeed[] = [];
  let rejected = 0;

  for (const f of feeds) {
    // Critère 1 : ID non synthétique
    if (isSyntheticId(f.id)) { rejected++; continue; }
    // Critère 2 : source_url = vraie URL article http(s)
    if (!isArticleUrl(f.source_url)) { rejected++; continue; }
    // Critère 3 : source_status != 'dead'
    if (f.source_status === 'dead') { rejected++; continue; }
    // Critère 4 : hallucination_score <= 0.3
    if (f.hallucination_score === null || f.hallucination_score === undefined || f.hallucination_score > 0.3) { rejected++; continue; }

    const isVerified = f.verification_status === 'verified' || f.verification_status === 'confirmed';
    passed.push({
      id: f.id,
      title: f.title,
      source: f.source,
      source_url: f.source_url!,
      country: f.country,
      created_at: f.created_at,
      isVerified,
      verificationStatus: f.verification_status,
    });
  }

  return {
    total_fetched: feeds.length,
    passed,
    rejected,
    verified: passed.filter((f) => f.isVerified),
    unverified: passed.filter((f) => !f.isVerified),
  };
}

// ============================================================
// TEMPLATE & CONTENT BUILDERS (existing)
// ============================================================

const VALID_REPORT_TYPES = ["sir", "sitrep", "threat_assessment", "logistics_audit"];
const VALID_FORMATS = ["pdf", "word", "excel", "ppt", "csv"];

function applyTemplate(content: string, vars: Record<string, string>): string {
  let result = content;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value || "");
  }
  return result;
}

function buildSIRContent(payload: Record<string, unknown>, branding: Record<string, string>): string {
  const header = `${branding.ORG_NAME || "SentiqS"} — Alerte Flash (SIR)
${branding.ORG_CONFIDENTIALITY || "CONFIDENTIEL"}
${"=".repeat(60)}

NATURE DE L'INCIDENT : ${payload.incident_nature || "—"}
SEVERITE : ${payload.severity || "—"}
COORDONNEES GPS : ${payload.gps_lat || "—"}, ${payload.gps_lng || "—"}
ZONE AFFECTEE : ${payload.affected_area || "—"}
VICTIMES : ${payload.casualties ?? "—"}
STATUT REPONSE : ${payload.response_status || "—"}

CONSIGNES :
${payload.instructions || "—"}

${"=".repeat(60)}
Genere par : ${branding.ORG_SIGNATURE || "Direction Surete"}
${branding.ORG_FOOTER || ""}`;
  return header;
}

function buildSITREPContent(payload: Record<string, unknown>, branding: Record<string, string>): string {
  const roadAxes = (payload.road_axes as Array<Record<string, string>>) || [];
  const airports = (payload.airports as Array<Record<string, string>>) || [];
  const weather = (payload.weather as Record<string, unknown>) || {};
  const incidents = (payload.key_incidents as Array<Record<string, string>>) || [];
  const feedQuality = (payload.feed_quality as Record<string, unknown>) || {};

  let content = `${branding.ORG_NAME || "SentiqS"} — Point de Situation Quotidien (SITREP)
${branding.ORG_CONFIDENTIALITY || "CONFIDENTIEL"}
${"=".repeat(60)}

BILAN 24H :
${payload.bilan_24h || "—"}

QUALITE DES DONNEES :
  Flux filtres disponibles : ${feedQuality.passed || 0}
  Dont faits etablis (verifies/confirmes) : ${feedQuality.verified || 0}
  Dont non confirmes (source unique) : ${feedQuality.unverified || 0}
  Rejetes par le filtre serveur : ${feedQuality.rejected || 0}
  ${feedQuality.empty_note || ""}

AXES ROUTIERS :
${roadAxes.map((a: Record<string, string>) => `  - ${a.name || "—"} : ${a.status || "—"} (${a.details || ""})`).join("\n") || "—"}

AEROPORTS :
${airports.map((a: Record<string, string>) => `  - ${a.code || "—"} ${a.name || "—"} : ${a.status || "—"} (${a.details || ""})`).join("\n") || "—"}

METEO :
  Conditions : ${weather.conditions || "—"}
  Temperature : ${weather.temperature ?? "—"}°C
  Mise a jour : ${weather.updated_at || "—"}

INCIDENTS CLES 24H :
${incidents.map((i: Record<string, string>) => {
    const verifTag = i.verification === 'verified' || i.verification === 'confirmed'
      ? '[FAIT ÉTABLI]'
      : '[NON CONFIRMÉ]';
    return `  ${verifTag} [${i.time || "—"}] ${i.description || "—"} (${i.location || "—"}) — Source: ${i.source || "—"}`;
  }).join("\n") || "—"}

RECOMMANDATIONS :
${payload.recommendations || "—"}

${"=".repeat(60)}
Genere par : ${branding.ORG_SIGNATURE || "Direction Surete"}
${branding.ORG_FOOTER || ""}`;
  return content;
}

function buildThreatAssessmentContent(payload: Record<string, unknown>, branding: Record<string, string>): string {
  const political = (payload.political_risk as Record<string, unknown>) || {};
  const health = (payload.health_risk as Record<string, unknown>) || {};
  const security = (payload.security_risk as Record<string, unknown>) || {};
  const actors = (payload.actor_mapping as Array<Record<string, string>>) || [];

  let content = `${branding.ORG_NAME || "SentiqS"} — Evaluation des Menaces Pays
${branding.ORG_CONFIDENTIALITY || "CONFIDENTIEL"}
${"=".repeat(60)}

RISQUE POLITIQUE : ${political.level || "—"}
  Resume : ${political.summary || "—"}
  Declencheurs : ${Array.isArray(political.triggers) ? (political.triggers as string[]).join(", ") : "—"}

RISQUE SANITAIRE : ${health.level || "—"}
  Resume : ${health.summary || "—"}
  Epidemies actives : ${Array.isArray(health.active_outbreaks) ? (health.active_outbreaks as string[]).join(", ") : "—"}

RISQUE SECURITAIRE : ${security.level || "—"}
  Resume : ${security.summary || "—"}
  Groupes actifs : ${Array.isArray(security.active_groups) ? (security.active_groups as string[]).join(", ") : "—"}

CARTOGRAPHIE DES ACTEURS :
${actors.map((a: Record<string, string>) => `  - ${a.name || "—"} (${a.type || "—"}) — Influence: ${a.influence || "—"} — Position: ${a.stance || "—"}`).join("\n") || "—"}

PREVISION 30 JOURS :
${payload.forecast_30d || "—"}

${"=".repeat(60)}
Genere par : ${branding.ORG_SIGNATURE || "Direction Surete"}
${branding.ORG_FOOTER || ""}`;
  return content;
}

function buildLogisticsAuditContent(payload: Record<string, unknown>, branding: Record<string, string>): string {
  const base = (payload.base_security as Record<string, unknown>) || {};
  const routes = (payload.route_checkpoints as Array<Record<string, unknown>>) || [];
  const safety = (payload.site_safety as Record<string, unknown>) || {};
  const supply = (payload.supply_chain as Record<string, unknown>) || {};
  const recs = (payload.recommendations as string[]) || [];

  let content = `${branding.ORG_NAME || "SentiqS"} — Audit Logistique et Site
${branding.ORG_CONFIDENTIALITY || "CONFIDENTIEL"}
${"=".repeat(60)}

SECURITE BASE VIE : Score ${base.score ?? "—"}/10
  Perimetre : ${base.perimeter || "—"}
  Controle acces : ${base.access_control || "—"}
  Issues de secours : ${base.emergency_exits || "—"}

CHECKPOINTS / ROUTES :
${routes.map((r: Record<string, unknown>) => `  - ${r.name || "—"} (${r.gps_lat || "—"}, ${r.gps_lng || "—"}) — Risque: ${r.risk || "—"} — ${r.notes || ""}`).join("\n") || "—"}

SECURITE SITE :
  Protection incendie : ${safety.fire_protection || "—"}
  Capacite medicale : ${safety.medical_capability || "—"}
  Redondance comms : ${safety.comms_redundancy || "—"}

CHAINE D'APPROVISIONNEMENT :
  Carburant : ${supply.fuel_status || "—"}
  Eau : ${supply.water_status || "—"}
  Stock alimentaire : ${supply.food_stock_days ?? "—"} jours

RECOMMANDATIONS :
${recs.map((r: string) => `  - ${r}`).join("\n") || "—"}

${"=".repeat(60)}
Genere par : ${branding.ORG_SIGNATURE || "Direction Surete"}
${branding.ORG_FOOTER || ""}`;
  return content;
}

// ============================================================
// SERVEUR PRINCIPAL
// ============================================================

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("VITE_PUBLIC_SUPABASE_URL") || Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("VITE_PUBLIC_SUPABASE_ANON_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { report_type, title, region, countries, branding_id, target_formats } = body;

    if (!report_type || !VALID_REPORT_TYPES.includes(report_type)) {
      return new Response(JSON.stringify({ error: "Type de rapport invalide" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!title) {
      return new Response(JSON.stringify({ error: "Titre requis" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch branding
    let brandingVars: Record<string, string> = {};
    if (branding_id) {
      const { data: branding } = await supabase.from("org_branding").select("*").eq("id", branding_id).maybeSingle();
      if (branding?.template_vars) brandingVars = branding.template_vars as Record<string, string>;
    }
    if (Object.keys(brandingVars).length === 0) {
      const { data: defaultBranding } = await supabase.from("org_branding").select("*").eq("is_default", true).maybeSingle();
      if (defaultBranding?.template_vars) brandingVars = defaultBranding.template_vars as Record<string, string>;
    }

    const countriesList = Array.isArray(countries) ? countries : [];
    let contextPayload: Record<string, unknown> = {};
    let filterReport: FilterReport = { total_fetched: 0, passed: [], rejected: 0, verified: [], unverified: [] };

    if (report_type === "sir") {
      contextPayload = {
        incident_nature: "",
        gps_lat: null,
        gps_lng: null,
        severity: "medium",
        affected_area: "",
        casualties: null,
        response_status: "",
        instructions: "",
      };
    } else if (report_type === "sitrep") {
      // --- Fetch alerts ---
      const { data: alerts } = await supabase.from("alerts").select("id, title, severity, country, created_at").order("created_at", { ascending: false }).limit(20);

      // --- Fetch feeds WITH filtering columns ---
      const { data: rawFeeds } = await supabase
        .from("feeds")
        .select("id, title, source, source_url, country, created_at, verification_status, hallucination_score, source_status, rss_validated")
        .lte("hallucination_score", 0.30)
        .neq("source_status", "dead")
        .not("source_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(30);

      // --- Appliquer le filtre serveur strict (4 critères) ---
      filterReport = filterFeedsForReport((rawFeeds || []) as RawFeed[]);

      // --- Construire les incidents avec distinction verified/unverified ---
      const filteredIncidents = filterReport.passed.slice(0, 10).map((f: FilteredFeed) => ({
        time: f.created_at || "",
        description: f.title || "",
        location: f.country || "",
        source: f.source || "",
        verification: f.verificationStatus,
      }));

      // --- Message si aucun feed exploitable ---
      let emptyNote = "";
      if (filterReport.passed.length === 0) {
        const countryRef = countriesList.length > 0
          ? `pour ${countriesList.join(', ')}`
          : "pour la zone surveillée";
        emptyNote = `⚠️ Aucune donnée vérifiée disponible ${countryRef} sur cette période. ${filterReport.total_fetched} flux récupérés, ${filterReport.rejected} rejetés par le filtre serveur (IDs synthétiques, URLs invalides, sources mortes, ou score hallucination > 0.3).`;
      }

      const feedQuality = {
        passed: filterReport.passed.length,
        verified: filterReport.verified.length,
        unverified: filterReport.unverified.length,
        rejected: filterReport.rejected,
        empty_note: emptyNote,
      };

      contextPayload = {
        bilan_24h: `Surveillance active sur ${countriesList.length || "54"} pays. ${(alerts || []).length} alertes actives.`,
        feed_quality: feedQuality,
        road_axes: [],
        airports: [],
        weather: { conditions: "", temperature: null, updated_at: "" },
        key_incidents: filteredIncidents,
        recommendations: "",
      };
    } else if (report_type === "threat_assessment") {
      contextPayload = {
        political_risk: { level: "", summary: "", triggers: [] },
        health_risk: { level: "", summary: "", active_outbreaks: [] },
        security_risk: { level: "", summary: "", active_groups: [] },
        actor_mapping: [],
        forecast_30d: "",
      };
    } else {
      contextPayload = {
        base_security: { perimeter: "", access_control: "", emergency_exits: "", score: 0 },
        route_checkpoints: [],
        site_safety: { fire_protection: "", medical_capability: "", comms_redundancy: "" },
        supply_chain: { fuel_status: "", water_status: "", food_stock_days: 0 },
        recommendations: [],
      };
    }

    // Generate content
    let generatedContent = "";
    if (report_type === "sir") generatedContent = buildSIRContent(contextPayload, brandingVars);
    else if (report_type === "sitrep") generatedContent = buildSITREPContent(contextPayload, brandingVars);
    else if (report_type === "threat_assessment") generatedContent = buildThreatAssessmentContent(contextPayload, brandingVars);
    else generatedContent = buildLogisticsAuditContent(contextPayload, brandingVars);

    // Apply template
    const brandedContent = applyTemplate(generatedContent, brandingVars);

    // Insert into DB
    const { data: report, error } = await supabase.from("strategic_reports").insert({
      report_type,
      title,
      status: "ready",
      payload: contextPayload,
      region: region || null,
      countries: countriesList,
      branding_id: branding_id || null,
      generated_formats: target_formats || ["pdf"],
      generated_at: new Date().toISOString(),
    }).select("id").single();

    if (error) throw error;

    const result = {
      report_id: report.id,
      formats_generated: target_formats || ["pdf"],
      content: brandedContent,
      download_urls: {} as Record<string, string>,
      filter_stats: report_type === "sitrep" ? {
        total_fetched: filterReport.total_fetched,
        passed: filterReport.passed.length,
        rejected: filterReport.rejected,
        verified: filterReport.verified.length,
        unverified: filterReport.unverified.length,
      } : null,
    };

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erreur inconnue";
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
