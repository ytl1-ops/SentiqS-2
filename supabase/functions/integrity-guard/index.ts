// ============================================================
// SentiqS — integrity-guard v1.0
// Agent de surveillance permanente contre les données factices
// Exécution : périodique (scheduled-scan) ou manuelle
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GuardViolation {
  feed_id: string;
  feed_title: string;
  violation_type: "TITLE_IS_SOURCE_NAME" | "CONTRADICTORY_STATUS" | "GENERIC_DOMAIN_URL" | "SCORE_INCONSISTENCY" | "MISSING_REQUIRED_FIELD";
  severity: "critical" | "high" | "medium";
  detail: string;
  auto_fixed: boolean;
}

interface GuardReport {
  scanned_at: string;
  total_scanned: number;
  violations_found: number;
  auto_fixed: number;
  violations: GuardViolation[];
  summary: {
    title_as_source: number;
    contradictory_status: number;
    generic_domain: number;
    score_inconsistency: number;
    missing_fields: number;
  };
}

// Liste de patterns qui indiquent qu'un titre est en réalité un nom de source
const SOURCE_NAME_PATTERNS = [
  /^(The |Le |La |Les )?(Independent|Guardian|Nation|Times|Standard|Citizen|Punch|Herald|Monitor|Tribune|Reporter|Observer|Chronicle|Gazette|Post|Mail|News|Mirror|Sun|Star|Echo|Voice|Journal|Daily|Weekly|Today|Report|Africa|Afrique)( .*)?$/i,
];

// Liste de noms de médias connus qui ne sont PAS des titres d'articles
const KNOWN_MEDIA_NAMES = new Set([
  "quartz africa", "nation media group", "this day nigeria", "punch nigeria",
  "the citizen tanzania", "the independent uganda", "le360 maroc", "telquel maroc",
  "the conversation africa", "nation media", "mediapart afrique", "les echos afrique",
  "allafrica", "africanews", "voa africa", "bbc africa", "dw afrique",
  "rfi afrique", "france 24", "al jazeera", "reuters afrique", "afp",
  "jeune afrique", "le monde afrique", "the africa report", "africa intelligence",
]);

function isSourceNameAsTitle(title: string): boolean {
  if (!title || title.length < 3) return false;
  const normalized = title.trim().toLowerCase();

  // Vérifier contre les noms de médias connus
  if (KNOWN_MEDIA_NAMES.has(normalized)) return true;

  // Vérifier contre les patterns regex
  for (const pattern of SOURCE_NAME_PATTERNS) {
    if (pattern.test(title.trim())) {
      // Double check: le titre ne doit pas dépasser 50 caractères
      // Un vrai titre d'article est généralement plus long
      if (title.trim().length <= 50) return true;
    }
  }

  return false;
}

function isGenericDomainUrl(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url.trim());
    const path = parsed.pathname.replace(/\/$/, "");
    // Si le chemin est vide ou juste "/", c'est une page d'accueil de domaine
    if (path === "" || path === "/") return true;
    // Si le chemin est très court (1 segment), probablement une section, pas un article
    const segments = path.split("/").filter(Boolean);
    if (segments.length === 1 && segments[0].length < 30) return true;
    return false;
  } catch {
    return false;
  }
}

const REQUIRED_FIELDS = ["source_url", "source", "country", "category", "timestamp"] as const;

serve(async (req: Request) => {
  // CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ());
    const dryRun = body.dryRun !== false; // par défaut dryRun=true (safe)
    const autoFix = body.autoFix === true; // par défaut autoFix=false

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Récupérer TOUS les feeds
    const { data: feeds, error } = await supabase
      .from("feeds")
      .select("id, title, source, source_url, source_status, verification_status, hallucination_score, verified_at, parent_feed_id, country, category, timestamp")
      .order("id");

    if (error) throw error;

    const violations: GuardViolation[] = [];
    let autoFixed = 0;

    for (const feed of feeds || []) {
      // --- Vérification 1 : Titre = nom de source ---
      if (isSourceNameAsTitle(feed.title)) {
        violations.push({
          feed_id: feed.id,
          feed_title: feed.title,
          violation_type: "TITLE_IS_SOURCE_NAME",
          severity: "critical",
          detail: `Le titre "${feed.title}" est un nom de média/source, pas un titre d'actualité. Donnée factice probable.`,
          auto_fixed: autoFix,
        });

        if (!dryRun && autoFix) {
          await supabase.from("feeds").update({
            verification_status: "rumor",
            hallucination_score: 0.95,
          }).eq("id", feed.id);
          autoFixed++;
        }
        continue; // Skip other checks for this feed — already critical
      }

      // --- Vérification 2 : Statuts contradictoires ---
      if (feed.source_status === "dead" && (feed.verification_status === "verified" || feed.verification_status === "confirmed")) {
        violations.push({
          feed_id: feed.id,
          feed_title: feed.title,
          violation_type: "CONTRADICTORY_STATUS",
          severity: "critical",
          detail: `Source morte (dead) mais statut de vérification = ${feed.verification_status}. Contradiction logique.`,
          auto_fixed: autoFix,
        });

        if (!dryRun && autoFix) {
          await supabase.from("feeds").update({
            verification_status: "unverified",
            hallucination_score: Math.max(feed.hallucination_score ?? 0, 0.50),
          }).eq("id", feed.id);
          autoFixed++;
        }
      }

      // --- Vérification 3 : URL de domaine générique ---
      if (feed.source_url && isGenericDomainUrl(feed.source_url)) {
        const isAlreadyFlagged = feed.verification_status === "rumor" || feed.source_status === "dead";
        if (!isAlreadyFlagged) {
          violations.push({
            feed_id: feed.id,
            feed_title: feed.title,
            violation_type: "GENERIC_DOMAIN_URL",
            severity: "medium",
            detail: `L'URL source "${feed.source_url}" pointe vers la page d'accueil d'un domaine, pas vers un article spécifique. Invérifiable.`,
            auto_fixed: false,
          });
        }
      }

      // --- Vérification 4 : Incohérence de score d'hallucination ---
      const storedScore = feed.hallucination_score;
      if (storedScore !== null && storedScore !== undefined) {
        if (feed.source_status === "dead" && storedScore < 0.35) {
          violations.push({
            feed_id: feed.id,
            feed_title: feed.title,
            violation_type: "SCORE_INCONSISTENCY",
            severity: "high",
            detail: `Score d'hallucination=${storedScore} trop bas pour une source morte. Attendu ≥0.35.`,
            auto_fixed: autoFix,
          });

          if (!dryRun && autoFix) {
            await supabase.from("feeds").update({
              hallucination_score: 0.50,
            }).eq("id", feed.id);
            autoFixed++;
          }
        }

        if (feed.verification_status === "rumor" && storedScore < 0.60) {
          violations.push({
            feed_id: feed.id,
            feed_title: feed.title,
            violation_type: "SCORE_INCONSISTENCY",
            severity: "high",
            detail: `Score d'hallucination=${storedScore} trop bas pour une rumeur. Attendu >0.60.`,
            auto_fixed: autoFix,
          });

          if (!dryRun && autoFix) {
            await supabase.from("feeds").update({
              hallucination_score: 0.78,
            }).eq("id", feed.id);
            autoFixed++;
          }
        }
      }

      // --- Vérification 5 : Champs obligatoires manquants ---
      const missingFields: string[] = [];
      for (const field of REQUIRED_FIELDS) {
        const val = (feed as Record<string, unknown>)[field];
        if (val === null || val === undefined || val === "") {
          missingFields.push(field);
        }
      }
      if (missingFields.length >= 2) {
        violations.push({
          feed_id: feed.id,
          feed_title: feed.title,
          violation_type: "MISSING_REQUIRED_FIELD",
          severity: "high",
          detail: `Champs requis manquants : ${missingFields.join(", ")}.`,
          auto_fixed: false,
        });
      }
    }

    // Construire le rapport
    const summary = {
      title_as_source: violations.filter((v) => v.violation_type === "TITLE_IS_SOURCE_NAME").length,
      contradictory_status: violations.filter((v) => v.violation_type === "CONTRADICTORY_STATUS").length,
      generic_domain: violations.filter((v) => v.violation_type === "GENERIC_DOMAIN_URL").length,
      score_inconsistency: violations.filter((v) => v.violation_type === "SCORE_INCONSISTENCY").length,
      missing_fields: violations.filter((v) => v.violation_type === "MISSING_REQUIRED_FIELD").length,
    };

    const report: GuardReport = {
      scanned_at: new Date().toISOString(),
      total_scanned: feeds?.length || 0,
      violations_found: violations.length,
      auto_fixed: autoFixed,
      violations,
      summary,
    };

    return new Response(JSON.stringify(report), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
