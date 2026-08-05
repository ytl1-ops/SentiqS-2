import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ============================================================
// SentiqS — rss-poll v1.1
// Scheduled function that polls all active RSS sources,
// parses articles, deduplicates, and inserts into feeds.
// v1.1 : génère un id crypto.randomUUID() pour chaque insert,
//        plafonne hallucination_score à 0.28 max.
// ============================================================

const AFRICAN_COUNTRIES = new Set([
  'Afrique du Sud', 'Algérie', 'Angola', 'Bénin', 'Botswana', 'Burkina Faso',
  'Burundi', 'Cameroun', 'Cap-Vert', 'Centrafrique', 'Comores', 'Congo',
  'Côte d\'Ivoire', 'Djibouti', 'Égypte', 'Érythrée', 'Éthiopie', 'Gabon',
  'Gambie', 'Ghana', 'Guinée', 'Guinée-Bissau', 'Guinée Équatoriale',
  'Kenya', 'Lesotho', 'Libéria', 'Libye', 'Madagascar', 'Malawi', 'Mali',
  'Maroc', 'Maurice', 'Mauritanie', 'Mozambique', 'Namibie', 'Niger',
  'Nigeria', 'Ouganda', 'RDC', 'Rwanda', 'Sao Tomé-et-Principe',
  'Sénégal', 'Seychelles', 'Sierra Leone', 'Somalie', 'Soudan',
  'Soudan du Sud', 'Éswatini', 'Tanzanie', 'Tchad', 'Togo', 'Tunisie',
  'Zambie', 'Zimbabwe',
]);

const VALID_CATEGORIES: Record<string, string> = {
  'Sécurité': 'Sécurité',
  'Politique': 'Politique',
  'Économie': 'Économie',
  'Santé': 'Santé',
  'Environnement': 'Environnement',
  'Social': 'Social',
  'Cyber': 'Cyber',
  'Diplomatie': 'Diplomatie',
  'Énergie': 'Énergie',
  'Transport': 'Transport',
  'Humanitaire': 'Humanitaire',
  'Militaire': 'Militaire',
};

interface RssArticle {
  title: string;
  link: string;
  description: string;
  pubDate: string | null;
}

interface SourceResult {
  source_id: number;
  source_name: string;
  status: 'ok' | 'error' | 'empty' | 'skipped';
  total_fetched: number;
  inserted: number;
  skipped_duplicates: number;
  error_message?: string;
  sample_titles: string[];
}

// ----- RSS/Atom Parsing -----
// NB: DOMParser n'est PAS disponible dans le runtime Deno des Supabase Edge
// Functions (contrairement à un navigateur) — l'ancienne implémentation basée
// dessus échouait silencieusement sur 100% des flux (0 article jamais parsé,
// quel que soit le flux, même valides). Remplacé par un parseur regex.

function decodeEntities(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, '')
    .trim();
}

function extractTag(block: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const match = block.match(regex);
  return match ? decodeEntities(match[1]) : '';
}

function extractAtomLink(block: string): string {
  const regex = /<link[^>]*href=["']([^"']+)["'][^>]*\/?>/i;
  const match = block.match(regex);
  return match ? match[1] : '';
}

function parseRssXml(xml: string): RssArticle[] {
  const articles: RssArticle[] = [];

  const rssItems = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  for (const block of rssItems) {
    const title = extractTag(block, 'title');
    const link = extractTag(block, 'link') || extractAtomLink(block);
    const description = extractTag(block, 'description') || extractTag(block, 'summary');
    const pubDate = extractTag(block, 'pubDate') || extractTag(block, 'published') || extractTag(block, 'updated');
    if (title && link) articles.push({ title, link, description, pubDate: pubDate || null });
  }
  if (articles.length > 0) return articles;

  const atomEntries = xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  for (const block of atomEntries) {
    const title = extractTag(block, 'title');
    const link = extractAtomLink(block);
    const description = extractTag(block, 'summary') || extractTag(block, 'content');
    const pubDate = extractTag(block, 'published') || extractTag(block, 'updated');
    if (title && link) articles.push({ title, link, description, pubDate: pubDate || null });
  }
  return articles;
}

// ----- Category Detection -----

function guessCategory(text: string): string {
  const lower = text.toLowerCase();
  const map: Array<[RegExp, string]> = [
    [/attaque|attentat|combat|affrontement|militaire|armée|rebelle|djihadiste|terroriste|boko haram|al-shabaab|aqmi|jnim/i, 'Sécurité'],
    [/président|élection|gouvernement|ministre|parlement|opposition|réforme|constitution|loi|décret|vote|scrutin/i, 'Politique'],
    [/croissance|pib|inflation|dette|investissement|commerce|export|import|budget|fmi|banque mondiale|économ/i, 'Économie'],
    [/épidémie|virus|maladie|vaccin|hôpital|médecin|patient|contamin|cas confirmé|santé/i, 'Santé'],
    [/inondation|sécheresse|cyclone|tempête|climat|pollution|déforestation|co2|environnement/i, 'Environnement'],
    [/grève|manifestation|protest|syndicat|étudiant|société civile|ong|droits/i, 'Social'],
    [/cyber|piratage|ransomware|données|fuite|hack|malware|phishing/i, 'Cyber'],
    [/diplomate|ambassade|sommet|accord|nations unies|onu|ua|cedeao|sadc|diplomati/i, 'Diplomatie'],
    [/pétrole|gaz|mine|pétrolier|énerg|électricité|barrage/i, 'Énergie'],
    [/route|port|aéroport|ferroviaire|logistique|transport|camion|conteneur/i, 'Transport'],
    [/réfugié|déplacé|humanitaire|famine|aide|secours|pam|oms|unicef|ocha/i, 'Humanitaire'],
    [/coup d.état|putsch|junte|militaire|état-major|général/i, 'Militaire'],
  ];
  for (const [regex, cat] of map) {
    if (regex.test(lower)) return cat;
  }
  return 'Sécurité';
}

// ----- Country Detection from Text -----

function detectCountry(text: string): string | null {
  const lower = text.toLowerCase();
  // Try to find an African country name in the text
  for (const country of AFRICAN_COUNTRIES) {
    if (lower.includes(country.toLowerCase())) {
      return country;
    }
  }
  return null;
}

// ----- Keyword Matching -----

function matchKeywords(text: string, keywords: string[]): boolean {
  if (!keywords || keywords.length === 0) return true;
  const lower = text.toLowerCase();
  return keywords.some(kw => lower.includes(kw.toLowerCase()));
}

// ----- Clean HTML from Description -----

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

// ----- Content Hash (détection d'altération ultérieure de la source) -----

async function computeContentHash(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ----- Domaine racine -----

function getDomain(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

// NB: pas de capture Wayback Machine ici — synchrone par article, elle
// rendrait le polling en masse (plusieurs sources × dizaines d'articles)
// bien trop lent / sujet aux timeouts. Réservée à ingest-feed (volume
// unitaire, déclenché manuellement).

// ============ MAIN ============

serve(async (req: Request) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers });
  }

  const startTime = Date.now();

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Fetch all active RSS sources
    const { data: sources, error: srcError } = await supabase
      .from('osint_sources')
      .select('*')
      .eq('source_type', 'rss')
      .eq('is_active', true);

    if (srcError) {
      return new Response(JSON.stringify({
        success: false,
        error: 'DB_FETCH_FAILED',
        detail: srcError.message,
      }), { status: 500, headers });
    }

    if (!sources || sources.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Aucune source RSS active trouvée.',
        results: [],
      }), { headers });
    }

    const results: SourceResult[] = [];
    const now = new Date().toISOString();

    for (const source of sources) {
      const result: SourceResult = {
        source_id: source.id as number,
        source_name: source.source_name as string,
        status: 'ok',
        total_fetched: 0,
        inserted: 0,
        skipped_duplicates: 0,
        sample_titles: [],
      };

      try {
        // 1. Fetch RSS feed
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);

        let rssResp: Response;
        try {
          rssResp = await fetch(source.source_url as string, {
            method: 'GET',
            signal: controller.signal,
            headers: {
              'User-Agent': 'SentiqS-RSS-Poll/1.1',
              'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
            },
            redirect: 'follow',
          });
        } finally {
          clearTimeout(timeoutId);
        }

        if (!rssResp.ok) {
          result.status = 'error';
          result.error_message = `HTTP ${rssResp.status}`;
          results.push(result);

          // Update source as errored
          await supabase.from('osint_sources').update({
            last_fetched_at: now,
            rss_validated: false,
          }).eq('id', source.id);
          continue;
        }

        const xml = await rssResp.text();

        // 2. Parse articles
        const articles = parseRssXml(xml);
        result.total_fetched = articles.length;

        if (articles.length === 0) {
          result.status = 'empty';
          result.error_message = 'Aucun article parsable';
          results.push(result);

          await supabase.from('osint_sources').update({
            last_fetched_at: now,
            nb_articles_last_check: 0,
            rss_validated: true,
          }).eq('id', source.id);
          continue;
        }

        // 3. Filter by keywords if configured
        const keywords: string[] = (source.detection_keywords as string[]) || [];
        const matchedArticles = keywords.length > 0
          ? articles.filter(a => matchKeywords(`${a.title} ${a.description}`, keywords))
          : articles;

        // 4. Insert articles (up to 40 per source per poll)
        const toInsert = matchedArticles.slice(0, 40);
        const reliability = (source.reliability_score as number) || 0.80;
        // Plafonner hallucination_score à 0.28 max pour passer le garde d'insertion
        const hallucinationScore = Math.min(1.0 - reliability, 0.28);
        const sourceDomain = getDomain(source.source_url as string);

        for (const article of toInsert) {
          // Dedup: check if source_url already exists
          const { data: existing } = await supabase
            .from('feeds')
            .select('id')
            .eq('source_url', article.link)
            .maybeSingle();

          if (existing) {
            result.skipped_duplicates++;
            continue;
          }

          // Detect country from article text
          const detectedCountry = detectCountry(`${article.title} ${article.description}`)
            || (source.country as string)
            || 'Monde';

          // Only insert if it's about an African country or we want global coverage
          const category = guessCategory(`${article.title} ${article.description}`);
          const cleanSummary = stripHtml(article.description).substring(0, 1000);
          const contentHash = await computeContentHash(`${article.title}|${cleanSummary}`);

          const { error: insertErr } = await supabase.from('feeds').insert({
            id: crypto.randomUUID(),
            title: article.title.substring(0, 500),
            source: source.source_name as string,
            source_url: article.link,
            source_domain: sourceDomain,
            content_hash: contentHash,
            country: detectedCountry,
            category,
            summary: cleanSummary || null,
            timestamp: article.pubDate || now,
            verification_status: 'unverified',
            hallucination_score: hallucinationScore,
            // Le flux RSS parent a répondu, mais l'URL de CET article n'a
            // pas encore été vérifiée individuellement — batch-verify-feeds
            // s'en charge ensuite. Ne jamais marquer 'active'/last_link_check
            // ici, sinon le cron de vérification ne retrouve plus ces lignes
            // (il ne cible que unchecked/warning/null) et rien n'est jamais
            // re-vérifié.
            source_status: 'unchecked',
            last_link_check: null,
            rss_validated: true,
          });

          if (!insertErr) {
            result.inserted++;
            if (result.sample_titles.length < 3) {
              result.sample_titles.push(article.title.substring(0, 80));
            }
          }
        }

        // 5. Update source metadata
        await supabase.from('osint_sources').update({
          last_fetched_at: now,
          nb_articles_last_check: articles.length,
          rss_validated: true,
          updated_at: now,
        }).eq('id', source.id);

      } catch (fetchErr) {
        result.status = 'error';
        result.error_message = (fetchErr as Error).message.substring(0, 200);
      }

      results.push(result);
    }

    const totalInserted = results.reduce((sum, r) => sum + r.inserted, 0);
    const totalFetched = results.reduce((sum, r) => sum + r.total_fetched, 0);
    const totalSkipped = results.reduce((sum, r) => sum + r.skipped_duplicates, 0);
    const elapsed = Date.now() - startTime;

    return new Response(JSON.stringify({
      success: true,
      polled_at: now,
      elapsed_ms: elapsed,
      sources_polled: sources.length,
      total_articles_fetched: totalFetched,
      total_inserted: totalInserted,
      total_skipped_duplicates: totalSkipped,
      results,
    }), { headers });

  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      error: 'INTERNAL_ERROR',
      detail: (err as Error).message,
    }), { status: 500, headers });
  }
});
