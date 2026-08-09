// ============================================================
// SentiqS-2 — Job de collecte planifiee (voir
// .github/workflows/collecte-planifiee.yml)
//
// Adapte de scripts/collecte-planifiee.js (SentiqS) pour la nouvelle
// webapp React, dont l'architecture differe sur plusieurs points :
//
// 1) Il n'y a plus de fichier HTML unique ni de jeton COLLECTOR_TOKEN a
//    lire pour etablir une session collecteur en lecture seule : la page
//    /dashboard/feeds lit et ecrit le cache partage Supabase
//    (collecte_partagee) directement via la cle anon publique.
//
// 2) doCollect() n'est pas expose sur window (bundle React) : on ne peut
//    plus l'appeler via page.evaluate() comme dans la version d'origine.
//    On simule donc un clic reel sur le bouton "Rafraichir" de l'UI et on
//    attend qu'il redevienne actif pour considerer la collecte terminee.
//
// 3) Le tableau de bord /dashboard/feeds est protege par une
//    authentification (AuthGuard : redirection vers /login si aucune
//    session Supabase active — confirme le 09/08/2026 apres l'echec du
//    run #1, qui expirait en attendant le bouton "Rafraichir" jamais
//    affiche car la page redirigeait vers /login). Ce job doit donc se
//    connecter avant de naviguer vers la page de collecte. Les
//    identifiants ne sont JAMAIS ecrits en dur ici : ils doivent etre
//    fournis via les variables d'environnement COLLECT_LOGIN_EMAIL et
//    COLLECT_LOGIN_PASSWORD, elles-memes definies comme "GitHub Secrets"
//    sur ce depot (Settings > Secrets and variables > Actions > New
//    repository secret). Sans ces secrets, le job s'arrete immediatement
//    avec un message clair plutot que d'echouer par un timeout obscur.
//
// A VALIDER avant de faire tourner ce job sans supervision : le libelle
// exact du bouton et des champs de connexion a ete verifie sur le code
// source de l'application au moment de cette adaptation, mais
// l'interface peut evoluer independamment de ce depot — revalider les
// selecteurs ci-dessous si le job echoue de maniere repetee.
// ============================================================

const { chromium } = require('playwright');
const { USER_AGENT } = require('./lib/fetch-respectueux');
const { creerIntercepteur } = require('./lib/interception-proxy-directe');

// Deploiement reel de SentiqS-2 (voir le champ "Site web" du depot).
const TARGET_URL = process.env.SENTINEL_URL || 'https://sentiqs.netlify.app/dashboard/feeds';
const LOGIN_URL = TARGET_URL.replace(/\/dashboard.*$/, '/login');
const LOGIN_EMAIL = process.env.COLLECT_LOGIN_EMAIL || '';
const LOGIN_PASSWORD = process.env.COLLECT_LOGIN_PASSWORD || '';

const COLLECT_TIMEOUT_MS = 8 * 60 * 1000; // 8 minutes, comme la version d'origine.

const { interceptionProxyDirecte, stats: statsInterception } = creerIntercepteur();

async function run() {
  if (!LOGIN_EMAIL || !LOGIN_PASSWORD) {
    console.error(
      'COLLECT_LOGIN_EMAIL / COLLECT_LOGIN_PASSWORD ne sont pas definis. ' +
      'Le tableau de bord ' + TARGET_URL + ' necessite une session connectee ' +
      '(AuthGuard). Ajoutez ces deux secrets dans Settings > Secrets and ' +
      'variables > Actions de ce depot avant de relancer ce job.'
    );
    process.exitCode = 1;
    return;
  }

  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, userAgent: USER_AGENT });
  const erreursPage = [];
  page.on('pageerror', e => erreursPage.push(e.message));
  page.on('console', (msg) => {
    if (msg.type() === 'warning' || msg.type() === 'error') console.log('[page]', msg.text());
  });
  await page.route('**/*', interceptionProxyDirecte);

  try {
    // Etape 1 : connexion. La page /dashboard/feeds est protegee par
    // AuthGuard et redirige vers /login sans session active.
    await page.goto(LOGIN_URL, { waitUntil: 'load', timeout: 60000 });
    await page.locator('input[name="email"]').fill(LOGIN_EMAIL);
    await page.locator('input[name="password"]').fill(LOGIN_PASSWORD);
    await page.locator('form button[type="submit"]').click();
    // On attend d'etre sorti de /login (redirection une fois la session active).
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30000 });
    console.log('Connexion reussie, session active.');

    // Etape 2 : aller sur la page de collecte et declencher le rafraichissement.
    await page.goto(TARGET_URL, { waitUntil: 'load', timeout: 60000 });

    const boutonRafraichir = page.getByRole('button', { name: /rafra[ii]chir/i });
    await boutonRafraichir.waitFor({ state: 'visible', timeout: 30000 });
    await boutonRafraichir.click();
    console.log('Clic sur "Rafraichir" effectue, collecte lancee cote page.');

    // Pas d'acces direct a la promesse interne de doCollect() depuis ce
    // process (elle vit dans le bundle React, pas exposee sur window) :
    // on attend que le bouton redevienne actif (collecte terminee cote
    // UI). Si le delai est depasse, on tolere un resultat partiel plutot
    // que de faire echouer tout le job.
    await page.waitForFunction(() => {
      const boutons = Array.from(document.querySelectorAll('button'));
      const btn = boutons.find((b) => /rafra[ii]chir/i.test(b.textContent || ''));
      return !!btn && !btn.disabled;
    }, { timeout: COLLECT_TIMEOUT_MS }).catch((e) => {
      console.warn(
        'Collecte non confirmee terminee sous ' + (COLLECT_TIMEOUT_MS / 60000) + 'min (' + e.message + ') — ' +
        'le cache partage collecte_partagee peut neanmoins avoir ete mis a jour partiellement.'
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
