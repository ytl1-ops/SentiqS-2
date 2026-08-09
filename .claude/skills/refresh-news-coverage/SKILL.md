---
name: refresh-news-coverage
description: Déclenche un rattrapage de couverture des actualités pour les 54 pays africains suivis par SentiqS, en ciblant en priorité les pays sans source enregistrée, jamais collectés, ou dont la donnée la plus récente date de plus de 48h — avec recherche multi-langue (français/anglais/arabe/portugais selon le pays) via Google News. Utilise ce skill dès que l'utilisateur demande d'actualiser les actus, de rafraîchir/vérifier la couverture, de "lancer un rattrapage", de savoir quels pays manquent de données récentes, ou mentionne "temps réel" à propos de SentiqS — même sans nommer explicitement refresh-coverage-gaps.
---

# Rattrapage de couverture SentiqS (54 pays)

## Pourquoi ce skill existe

SentiqS ingère déjà les actualités en continu via un cron (`sentiqs-rss-poll`, toutes les
30 min) qui interroge les ~33 sources RSS enregistrées dans `osint_sources`. Mais ce cron
ne priorise pas géographiquement : un pays sans source enregistrée, ou dont la dernière
actualité remonte à plusieurs jours, ne remonte jamais en tête tant que personne ne s'en
aperçoit. C'est exactement le trou identifié dans l'audit du 2026-08-07 (section 4 :
"ne jamais déclarer une zone sûre uniquement parce qu'aucune actualité n'a été trouvée").

L'Edge Function `refresh-coverage-gaps` comble ce trou : elle identifie les pays en creux,
les priorise, et lance pour eux une recherche élargie multi-langue via Google News RSS —
sans jamais toucher au niveau de risque déjà calculé (`country_posture_state.level`), qui
reste la responsabilité exclusive de `useAlertLevels.ts` côté client.

## Contrainte d'environnement importante

**Les appels HTTP directs (`curl`, `fetch`) vers `*.supabase.co` depuis ce type de session
sont bloqués par le proxy sortant** (confirmé : `CONNECT tunnel failed, response 403`).
La seule voie qui fonctionne est d'exécuter le POST **côté Postgres**, via l'extension
`pg_net` déjà utilisée par les cron jobs existants du projet (`net.http_post`), appelée à
travers l'outil MCP `mcp__Supabase__execute_sql`. `pg_net` est asynchrone : l'appel renvoie
immédiatement un `request_id`, et la réponse doit être relue séparément dans
`net._http_response`.

## Comment déclencher le rattrapage

1. Récupérer une clé publique à jour du projet (ne jamais coder une clé en dur dans ce
   fichier — les clés peuvent être régénérées) :

   Appeler `mcp__Supabase__get_publishable_keys` avec `project_id: "yttctytqjtmaiheegqky"`
   et prendre la clé `"name": "anon"` (legacy JWT — c'est celle utilisée par les cron jobs
   existants du projet, `sentiqs-rss-poll` etc.).

2. Lancer l'appel via `mcp__Supabase__execute_sql` (voir `scripts/trigger_refresh.sql`
   pour le gabarit exact — remplacer `<ANON_KEY>` par la clé récupérée à l'étape 1). Utiliser
   un `timeout_milliseconds` d'au moins 150000 (150s) — voir pourquoi ci-dessous :

   ```sql
   select net.http_post(
     url := 'https://yttctytqjtmaiheegqky.supabase.co/functions/v1/refresh-coverage-gaps',
     headers := '{"Content-Type": "application/json", "Authorization": "Bearer <ANON_KEY>"}'::jsonb,
     body := '{}'::jsonb,
     timeout_milliseconds := 150000
   ) as request_id;
   ```

   Noter le `request_id` retourné (ex. `399`).

3. **Attendre ~2 minutes 30 avant de relire le résultat** — voir la note de timing
   ci-dessous, c'est plus long qu'on ne s'y attendrait. Puis relire avec
   `scripts/check_result.sql` (remplacer `<REQUEST_ID>`) :

   ```sql
   select status_code, content, error_msg, created
   from net._http_response
   where id = <REQUEST_ID>;
   ```

   Si `content` est vide et `error_msg` est `null`, la requête est encore en cours —
   attendre encore ~30s et réinterroger. N'utilise pas de boucle `sleep` serrée.

   ### Note de timing (important, testé en réel le 2026-08-09)

   `refresh-coverage-gaps` interroge Google News via `pg_net` (voir "Architecture interne"
   plus bas) et non via `fetch()` direct. Le worker `pg_net` de ce projet vide sa file par
   cycle plutôt que requête par requête, avec une latence observée entre ~35s et ~140s selon
   la charge du moment — donc la fonction peut légitimement prendre jusqu'à ~2 minutes
   avant de répondre. Elle attend elle-même jusqu'à 135s en interne (trois passes de
   récolte) avant de rendre la main, pour rester sous la limite stricte de réponse des
   Edge Functions Supabase (150s, au-delà : 504 côté appelant).

   **Il est normal et attendu qu'un run se termine avec `requests_answered: 0` et
   `total_articles_inserted: 0`** si la latence pg_net dépasse exceptionnellement ce budget
   ce jour-là (queue chargée, etc.) — ce n'est pas une panne : le verrou est relâché
   proprement, chaque pays reçoit un log `"result": "erreur", "detail": "Pas de réponse
   dans le délai imparti"`, et le prochain déclenchement (à la demande ou via le cron
   d'automatisation) retentera normalement. Si une majorité des runs échouent ainsi de
   façon répétée, c'est le signe que la file `pg_net` de ce projet est durablement
   surchargée — dans ce cas, resignale-le à l'utilisateur plutôt que de relancer en boucle
   (ne jamais redéclencher plusieurs fois d'affilée pour "forcer" un succès : chaque tir
   ajoute des requêtes à la même file et aggrave la situation).

## Interpréter et présenter le résultat

Le corps JSON de la réponse (`content`, à parser) a cette forme :

```json
{
  "success": true,
  "requests_fired": 8,
  "requests_answered": 6,
  "countries_targeted": [{ "name": "Botswana", "code": "BW", "reason": "sans_source" }, ...],
  "countries_processed": 5,
  "total_countries_in_gap": 23,
  "total_articles_found": 14,
  "total_articles_inserted": 6,
  "log": [
    {
      "country_code": "BW", "country_name": "Botswana",
      "languages_tried": ["en"], "sources_checked": 1,
      "articles_found": 2, "articles_inserted": 2,
      "result": "couverture_amelioree", "detail": null
    },
    ...
  ]
}
```

`requests_fired` vs `requests_answered` indique directement si la latence `pg_net` a posé
problème sur ce run (voir note de timing) — si `requests_answered` est nettement inférieur
à `requests_fired`, c'est le signe que le budget de récolte a été dépassé pour certaines
requêtes ce run-ci.

- `reason` par pays ciblé : `sans_source` (aucune source enregistrée pour ce pays — le
  cas le plus prioritaire), `jamais_collecte` (source existe mais aucun article encore
  vu), `donnees_anciennes` (dernier article de plus de 48h).
- `result` par pays traité : `couverture_amelioree` (au moins un article inséré),
  `aucun_resultat` (recherche effectuée, rien trouvé), `erreur` (la requête vers Google
  News a échoué — voir `detail`).
- Si `skipped: true` dans la réponse, un rattrapage est déjà en cours (verrou actif) —
  ne pas relancer, réessayer plus tard.

**Présente toujours à l'utilisateur, en français, un résumé courent avant le détail** :
combien de pays étaient en creux au total, combien ont été traités cette fois-ci, combien
d'articles ont été trouvés/insérés, et la liste des pays encore en attente
(`total_countries_in_gap - countries_processed`) — c'est cette dernière donnée qui indique
si plusieurs exécutions successives seront nécessaires pour rattraper tout le retard.

Rappelle que les articles insérés portent `verification_status: 'unverified'` et un score
d'hallucination prudent (0.3) — ils seront re-vérifiés automatiquement par le prochain
passage de `batch-verify-feeds` (cron `sentiqs-batch-verify`, toutes les 30 min), pas
immédiatement.

## Automatisation périodique (au-delà du déclenchement à la demande)

Ce skill déclenche le rattrapage *à la demande*. Si l'utilisateur veut une exécution
vraiment périodique ("en temps réel", "toutes les heures", "automatiquement") :

- **Option pg_cron** (cohérente avec les cron jobs existants du projet, ex.
  `sentiqs-rss-poll`) : demander confirmation puis appliquer une migration qui ajoute un
  job `net.http_post` planifié, sur le même modèle que `sentiqs-scheduled-scan`. Comme
  chaque exécution ne traite que 5 pays maximum, un intervalle de 30-60 min laisse le
  temps de couvrir tous les pays en creux en quelques passages sans jamais surcharger
  Google News.
- **Option Routine Claude Code** : `mcp__Claude_Code_Remote__create_trigger` avec un
  `cron_expression`, qui répète ce skill dans cette session ou une session dédiée.

Ne mets en place l'un ou l'autre qu'après confirmation explicite de l'utilisateur — c'est
un changement d'infrastructure récurrent, pas une simple lecture.

## Architecture interne (utile pour diagnostiquer un run qui échoue)

Les appels sortants `fetch()` du runtime Deno des Edge Functions vers `news.google.com`
échouent systématiquement (HTTP 503, confirmé en test réel — cohérent avec l'échec
silencieux jamais résolu de la fonction `fetch-mentions`/resobuzz préexistante, qui utilise
le même pattern et n'a jamais réussi une seule insertion). `refresh-coverage-gaps` relaie
donc ses requêtes via `pg_net` (exécuté côté Postgres, qui aboutit de façon fiable) avec un
modèle "tir groupé puis récolte différée" : toutes les requêtes d'un run sont lancées d'un
coup (RPC `net_fetch_start`), puis récoltées en bloc après une ou plusieurs attentes (RPC
`net_fetch_collect`) — voir la note de timing ci-dessus pour pourquoi ces attentes sont
longues (jusqu'à 135s cumulés).

## Limites à connaître et à rappeler si pertinent

- **5 pays maximum par exécution**, 2 langues maximum par pays — volontairement limité
  pour ne jamais bombarder Google News de requêtes et pour limiter la pression sur la file
  `pg_net` (voir note de timing) ; la fonction utilise un User-Agent de navigateur standard
  et un délai de 300ms entre tirs.
- **Catégorisation limitée au français** : un article dont la langue de recherche est
  `en`/`ar`/`pt` entre en base avec `category = null` plutôt qu'une catégorie devinée à
  l'aveugle — cohérent avec le principe "zéro hallucination" de l'application.
- **Ne recote jamais un pays** : la fonction ne touche jamais `level`/`score` d'un pays
  déjà présent dans `country_posture_state` (c'est `useAlertLevels.ts` côté client qui
  reste seul responsable du niveau de risque) — elle ne crée un niveau `non_cote` que pour
  un pays qui n'avait encore jamais de ligne du tout.
- **Verrou dédié** (`coverage_refresh_lock`, distinct du verrou de scan de liens
  `scan_schedule`) — deux rattrapages ne peuvent jamais tourner en même temps ; un verrou
  abandonné (crash) se libère automatiquement après 20 minutes.
- Le journal complet par territoire et par exécution est consultable directement dans la
  table `coverage_refresh_log` (via `mcp__Supabase__execute_sql`) si l'utilisateur veut un
  historique plutôt qu'un seul run.
