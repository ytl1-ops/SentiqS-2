// ============================================================
// SENTINEL — Collecte RSS directe et respectueuse (diagnostic + alimentation)
//
// Complète scripts/collecte-planifiee.js : celui-ci pilote un navigateur
// headless qui réutilise le moteur de collecte CLIENT (nécessaire côté
// navigateur, contraint par CORS — voir proxyFetch/CORS_PX dans
// web/SENTINEL_Surete_Web.html). Ce script-ci s'exécute en Node PUR, sans
// navigateur ni proxy CORS tiers : Node n'a aucune restriction CORS, un
// fetch() direct vers chaque flux RSS suffit. Utilise UNIQUEMENT des
// ressources gratuites et déjà publiques (les flux RSS de SRCS eux-mêmes) —
// aucune clé d'API payante, aucun service tiers requis.
//
// "Respectueux" (voir scripts/lib/fetch-respectueux.js pour le détail) :
// User-Agent identifiable, throttle par domaine, lecture best-effort de
// robots.txt, tentatives limitées avec backoff, aucune erreur non capturée.
//
// Portée volontairement limitée à un DIAGNOSTIC de collecte (récupère
// chaque flux, vérifie qu'il répond avec du contenu RSS/Atom valide, compte
// les articles bruts) — ne reproduit PAS le pipeline complet de
// classification/scoring/déduplication du moteur client, pour éviter
// exactement le risque de divergence entre deux implémentations du même
// traitement (déjà écarté explicitement pour collecte-planifiee.js). Sert à
// mesurer la fiabilité réelle d'une collecte 100% directe (sans proxy) avant
// toute décision de migration du pipeline principal.
//
// Usage : node scripts/collecte-rss-directe.js [--concurrence=8] [--limite=50]
// ============================================================

const fs = require('fs');
const path = require('path');
const { fetchRespectueux, USER_AGENT } = require('./lib/fetch-respectueux');

const HTML_PATH = process.env.SENTINEL_HTML_PATH || path.join(__dirname, '..', 'web', 'SENTINEL_Surete_Web.html');
const RAPPORT_PATH = path.join(__dirname, '..', 'scripts', 'rapport-collecte-directe.json');

function lireArgs() {
  const args = {};
  process.argv.slice(2).forEach(a => {
    const m = /^--([a-z]+)=(.+)$/.exec(a);
    if (m) args[m[1]] = m[2];
  });
  return {
    concurrence: parseInt(args.concurrence, 10) || 8,
    limite: args.limite ? parseInt(args.limite, 10) : null,
  };
}

// extraireSRCS() : lit web/SENTINEL_Surete_Web.html et evalue le tableau
// SRCS tel quel — SOURCE UNIQUE DE VERITE (jamais de copie/duplication
// manuelle de ~500 entrees qui finirait par diverger du fichier reel).
// Le fichier est notre propre code source statique versionne (pas une
// entree utilisateur) : evaluer son contenu litteral est sans risque ici,
// meme principe deja utilise par collecte-planifiee.js (lecture directe de
// COLLECTOR_TOKEN depuis le HTML).
function extraireSRCS() {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  const debut = html.indexOf('const SRCS=[');
  if (debut === -1) throw new Error('Tableau SRCS introuvable dans ' + HTML_PATH + ' — le script et l\'application ont divergé ?');
  const finMarqueur = '\n];';
  const fin = html.indexOf(finMarqueur, debut);
  if (fin === -1) throw new Error('Fin du tableau SRCS introuvable.');
  const litteral = html.slice(debut + 'const SRCS='.length, fin + 2); // inclut le ']' final, exclut le ';'
  // eslint-disable-next-line no-new-func
  const SRCS = new Function('return (' + litteral + ')')();
  if (!Array.isArray(SRCS) || !SRCS.length) throw new Error('SRCS extrait vide ou invalide.');
  return SRCS;
}

// pool(items, concurrence, tache) : execute `tache` sur chaque element avec
// au plus `concurrence` executions simultanees — implementation minimale
// (aucune dependance externe requise, coherent avec l'esprit "APIs
// gratuites/pas de dependance superflue" de cette demande).
async function pool(items, concurrence, tache) {
  const resultats = new Array(items.length);
  let curseur = 0;
  async function travailleur() {
    while (curseur < items.length) {
      const i = curseur++;
      resultats[i] = await tache(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrence, items.length) }, travailleur));
  return resultats;
}

function contientRSSValide(texte) {
  if (!texte || texte.length < 200) return false;
  return texte.includes('<item') || texte.includes('<entry') || texte.includes('<rss') || texte.includes('<feed');
}

function compterArticles(texte) {
  const items = (texte.match(/<item[\s>]/g) || []).length;
  const entries = (texte.match(/<entry[\s>]/g) || []).length;
  return items + entries;
}

(async () => {
  const { concurrence, limite } = lireArgs();
  let SRCS = extraireSRCS();
  if (limite) SRCS = SRCS.slice(0, limite);

  console.log('SENTINEL — Collecte RSS directe (respectueuse, sans proxy tiers)');
  console.log('User-Agent : ' + USER_AGENT);
  console.log(SRCS.length + ' source(s) a traiter, concurrence=' + concurrence + '\n');

  const debut = Date.now();
  let termines = 0;

  const resultats = await pool(SRCS, concurrence, async (src) => {
    const t0 = Date.now();
    const r = await fetchRespectueux(src.rss);
    const dureeMs = Date.now() - t0;
    termines++;
    if (termines % 25 === 0 || termines === SRCS.length) {
      process.stdout.write('\r' + termines + '/' + SRCS.length + ' sources traitees...');
    }
    if (!r.ok) {
      return { id: src.id, nom: src.n, cy: src.cy, ok: false, raison: r.raison, bloqueRobots: !!r.bloque, dureeMs };
    }
    const valide = contientRSSValide(r.texte);
    return {
      id: src.id, nom: src.n, cy: src.cy, ok: valide,
      raison: valide ? null : 'reponse recue mais ne ressemble pas a du RSS/Atom valide',
      nbArticles: valide ? compterArticles(r.texte) : 0,
      tentatives: r.tentatives, dureeMs,
    };
  });
  console.log('');

  const dureeTotaleS = Math.round((Date.now() - debut) / 1000);
  const succes = resultats.filter(r => r.ok);
  const echecs = resultats.filter(r => !r.ok);
  const bloquesRobots = echecs.filter(r => r.bloqueRobots);
  const totalArticles = succes.reduce((s, r) => s + (r.nbArticles || 0), 0);
  const dureeMoyenneMs = Math.round(resultats.reduce((s, r) => s + r.dureeMs, 0) / resultats.length);

  console.log('\n=== RESUME ===');
  console.log('Duree totale        : ' + dureeTotaleS + 's');
  console.log('Sources OK           : ' + succes.length + '/' + resultats.length);
  console.log('Sources en echec      : ' + echecs.length + '/' + resultats.length);
  console.log('  dont bloquees robots.txt : ' + bloquesRobots.length);
  console.log('Articles bruts detectes : ' + totalArticles);
  console.log('Duree moyenne / source  : ' + dureeMoyenneMs + 'ms');

  if (echecs.length) {
    console.log('\nDetail des echecs (10 premiers) :');
    echecs.slice(0, 10).forEach(e => console.log('  - [' + e.cy + '] ' + e.nom + ' : ' + e.raison));
  }

  const rapport = {
    genereLe: new Date().toISOString(),
    userAgent: USER_AGENT,
    dureeTotaleS, concurrence,
    nbSources: resultats.length,
    nbSucces: succes.length,
    nbEchecs: echecs.length,
    nbBloquesRobots: bloquesRobots.length,
    totalArticlesBrutsDetectes: totalArticles,
    dureeMoyenneMs,
    details: resultats,
  };
  fs.writeFileSync(RAPPORT_PATH, JSON.stringify(rapport, null, 2));
  console.log('\nRapport complet ecrit dans ' + RAPPORT_PATH);

  // Code de sortie non nul si la collecte directe echoue trop largement
  // (utile si ce script est un jour branche sur un job CI dedie) — seuil
  // permissif (moins de 20% de succes) car ce script reste un diagnostic,
  // pas le pipeline principal dont depend la fraicheur reelle de l'appli.
  process.exitCode = (succes.length / resultats.length) < 0.2 ? 1 : 0;
})().catch(e => {
  console.error('Erreur fatale :', e && e.message ? e.message : e);
  process.exitCode = 1;
});
