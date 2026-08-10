// Supabase Edge Function — fetch-mentions (multi-tenant, saas_stream_posts)
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const POSITIVE_WORDS = ["succès", "croissance", "innovation", "record", "réussite", "levée", "partenariat", "lancement", "avancée", "progrès"];
const NEGATIVE_WORDS = ["crise", "attaque", "fuite", "scandale", "échec", "chute", "panne", "menace", "conflit", "violence", "arnaque", "piratage"];

function scoreSentiment(text) {
  const lower = text.toLowerCase();
  let pos = 0, neg = 0;
  for (const w of POSITIVE_WORDS) if (lower.includes(w)) pos++;
  for (const w of NEGATIVE_WORDS) if (lower.includes(w)) neg++;
  const total = pos + neg;
  if (total === 0) return 0;
  return (pos - neg) / total;
}

function buildUrl(page) {
  if (page.platform === "google_news" && page.search_query) {
    return `https://news.google.com/rss/search?q=${encodeURIComponent(page.search_query)}&hl=fr&gl=CI&ceid=CI:fr`;
  }
  return null;
}

function parseRssItems(xml) {
  const items = [];
  const itemBlocks = xml.split(/<item>/i).slice(1);
  for (const block of itemBlocks) {
    const get = (tag) => {
      const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
      if (!m) return "";
      return m[1].replace(/<!\[CDATA\[/g, "").replace(/\]\]>/g, "").trim();
    };
    const title = get("title");
    const link = get("link");
    const guid = get("guid") || link;
    const pubDate = get("pubDate");
    if (title && link) items.push({ title, link, guid, pubDate });
  }
  return items.slice(0, 15);
}

async function fetchWithTimeout(url, ms) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ResoBuzzBot/1.0)" },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(t);
  }
}

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: keywords, error: kwError } = await supabase
    .from("saas_topics_keywords")
    .select("tenant_id, keyword, priority_default");
  if (kwError) return new Response(JSON.stringify({ step: "keywords", error: kwError.message }), { status: 500 });

  function priorityFor(tenantId, text) {
    const lower = text.toLowerCase();
    const match = (keywords || []).find((k) => k.tenant_id === tenantId && lower.includes(k.keyword.toLowerCase()));
    return match ? match.priority_default : "P2";
  }

  const { data: pages, error: pagesError } = await supabase
    .from("saas_connected_pages")
    .select("id, tenant_id, platform, search_query")
    .eq("is_active", true);
  if (pagesError) return new Response(JSON.stringify({ step: "pages", error: pagesError.message }), { status: 500 });

  const errors = [];
  let inserted = 0;

  const results = await Promise.allSettled(
    (pages || []).map(async (page) => {
      const url = buildUrl(page);
      if (!url) throw new Error(`page ${page.id}: pas d'URL de flux générable`);
      const res = await fetchWithTimeout(url, 8000);
      if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
      const xml = await res.text();
      const items = parseRssItems(xml);
      const rows = items.map((it) => ({
        tenant_id: page.tenant_id,
        connected_page_id: page.id,
        platform: page.platform,
        external_post_id: it.guid,
        content: it.title,
        source_url: it.link,
        sentiment_score: scoreSentiment(it.title),
        priority_level: priorityFor(page.tenant_id, it.title),
        published_at: it.pubDate ? new Date(it.pubDate).toISOString() : new Date().toISOString(),
      }));
      return { page, rows };
    })
  );

  for (const r of results) {
    if (r.status === "rejected") {
      errors.push(String(r.reason));
      continue;
    }
    const { page, rows } = r.value;
    if (rows.length > 0) {
      const { error: insertError } = await supabase
        .from("saas_stream_posts")
        .upsert(rows, { onConflict: "tenant_id,platform,external_post_id", ignoreDuplicates: true });
      if (insertError) errors.push(`page ${page.id}: ${insertError.message}`);
      else inserted += rows.length;
    }
  }

  return new Response(
    JSON.stringify({ pages_processed: (pages || []).length, items_upserted: inserted, errors }),
    { headers: { "Content-Type": "application/json" } }
  );
});
