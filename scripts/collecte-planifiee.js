// ============================================================
// SentiqS-2 — Job de collecte planifiee (voir
// .github/workflows/collecte-planifiee.yml)
//
// Adapte de scripts/collecte-planifiee.js (SentiqS) pour la nouvelle
// webapp React, dont l'architecture differe sur deux points essentiels :
//
// 1) Il n'y a plus de fichier HTML unique ni de jeton COLLECTOR_TOKEN a
//    lire pour etablir une session collecteur en lecture seule : la page
//    /dashboard/feeds lit et ecrit le cache partage Supabase
//    (collecte_partagee) directement via la cle anon publique, sans
//    session particuliere.
//
// 2) doCollect() n'est pas expose sur window (bundle React) : on ne peut
//    plus l'appeler via page.evaluate() comme dans la version d'origine.
//    Ce script simule donc un clic sur le bouton "Rafraichir" de la page
//    /dashboard/feeds (voir handleCollect() dans
//    webapp/src/pages/dashboard/feeds/page.tsx), qui declenche la meme
//    collecte reelle (~495 sources RSS) et publie le resultat dans
//    collecte_partagee.
//
// A VALIDER avant de faire tourner ce job sans supervision : le libelle
// exact du bouton a ete verifie sur l'application deployee au moment de
// cette adaptation, mais l'interface peut evoluer independamment de ce
// depot — revalider le selecteur ci-dessous si le job echoue de maniere
// repetee.
// ============================================================

const { chromium } = require('playwright');
const { USER_AGENT } = require('./lib/fetch-respectueux');
const { creerIntercepteur } = require('./lib/interception-proxy-directe');

// Deploiement reel de SentiqS-2 (voir le champ "Site web" du depot).
const TARGET_URL = process.env.SENTINEL_URL || 'https://sentiqs.netlify.app/dashboard/feeds';

// Meme raisonnement que la version SentiqS : les proxys CORS partages
// (allorigins, codetabs...) rate-limitent une rafale de ~495 requetes
// concentrees depuis une seule IP (le runner GitHub Actions) — delai
// large pour laisser la collecte se terminer meme en cas de throttling.
const COLLECT_TIMEOUT_MS = 8 * 60 * 1000;

const { interceptionProxyDirecte, stats: statsInterception } = creerIntercepteur();

async function run() {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, userAgent: USER_AGENT });
  const erreursPage = [];
  page.on('pageerror', (e) => erreursPage.push(e.message));
  page.on('console', (msg) => {
    if (msg.type() === 'warning' || msg.type() === 'error') console.log('[page]', msg.text());
  });
  await page.route('**/*', interceptionProxyDirecte);

  try {
    await page.goto(TARGET_URL, { waitUntil: 'load', timeout: 60000 });

    const boutonRafraichir = page.getByRole('button', { name: /rafra[iî]chir/i });
    await boutonRafraichir.waitFor({ state: 'visible', timeout: 30000 });
    await boutonRafraichir.click();
    console.log('Clic sur "Rafraichir" effectue, collecte lancee cote page.');

    // Pas d'acces direct a la promesse interne de doCollect() depuis ce
    // process (elle vit dans le bundle React, pas exposee sur window) :
    // on attend que le bouton redevienne actif (collecte terminee cote
    // UI), avec le meme filet de securite que la version d'origine — si
    // le delai est depasse, la collecte continue en tache de fond cote
    // page tant que le navigateur reste ouvert, et le cache partage peut
    // deja avoir ete mis a jour partiellement (doCollect publie par lots).
    await Promise.race([
      page.waitForFunction(
        () => {
          const b = [...document.querySelectorAll('button')].find((el) => /rafra[iî]chir/i.test(el.textContent || ''));
          return b && !b.disabled;
        },
        { timeout: COLLECT_TIMEOUT_MS },
      ),
      new Promise((_, reject) => setTimeout(() => reject(new Error('temps mort')), COLLECT_TIMEOUT_MS)),
    ]).catch((e) => {
      console.log(
        'Collecte non confirmee terminee sous ' + (COLLECT_TIMEOUT_MS / 60000) + 'min (' + e.message + ') — ' +
        'le cache partage collecte_partagee peut neanmoins avoir ete mis a jour partiellement.',
      );
    });

    console.log('Job de collecte planifiee termine. Stats interception proxy :', JSON.stringify(statsInterception));
    if (erreursPage.length) console.warn('Erreurs JS detectees sur la page :', JSON.stringify(erreursPage));
  } catch (e) {
    console.error('Erreur pendant la collecte planifiee :', e && e.message ? e.message : e);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

run();
