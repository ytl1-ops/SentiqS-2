---
name: refresh-news-coverage
description: Déclenche à la demande (diagnostic/rattrapage immédiat) le rattrapage de couverture des actualités pour les 54 pays africains suivis par SentiqS — recherche multi-langue (français/anglais/arabe/portugais) combinée à un vocabulaire sécuritaire générique via Google News, sur une rotation équitable pilotée par country_posture_state.last_collection_at. Depuis le 2026-08-10 ce rattrapage tourne aussi automatiquement toutes les 30 min via pg_cron (sentiqs-refresh-coverage-gaps) — ce skill sert surtout à forcer un passage immédiat ou à diagnostiquer un pays précis. Utilise ce skill dès que l'utilisateur demande d'actualiser les actus, de rafraîchir/vérifier la couverture, de "lancer un rattrapage", de savoir quels pays manquent de données récentes, ou mentionne "temps réel" à propos de SentiqS — même sans nommer explicitement refresh-coverage-gaps.
---

# Rattrapage de couverture SentiqS (54 pays)

## Pourquoi ce skill existe

SentiqS ingère déjà les actualités en continu via un cron (`sentiqs-rss-poll`, toutes les
30 min) qui interroge les ~33 sources RSS enregistrées dans `osint_sources`. Mais ce cron
ne priorise pas géographiquement : un pays sans source enregistrée ne remonte jamais en
tête tant que personne ne s'en aperçoit. C'est exactement le trou identifié dans l'audit du
2026-08-07 (section 4 : "ne jamais déclarer une zone sûre uniquement parce qu'aucune
actualité n'a été trouvée") — et concrètement constaté le 2026-08-10 : le décès du colonel
Fofié, annoncé par les FACI, n'est jamais remonté pour la Côte d'Ivoire, qui n'a aucune
source dédiée dans `osint_sources`.

L'Edge Function `refresh-coverage-gaps` comble ce trou : elle identifie les pays à
rafraîchir (rotation équitable sur les 54, voir plus bas), et lance pour eux une recherche
élargie multi-langue **combinée à un vocabulaire sécuritaire générique** (armée, sécurité,
attaque, coup d'État, décès, etc. — voir `SECURITY_TERMS` dans le code) via Google News RSS
— sans jamais toucher au niveau de risque déjà calculé (`country_posture_state.level`), qui
reste la responsabilité exclusive de `useAlertLevels.ts` côté client.

**Correctif 2026-08-10 (v2.1)** — trois causes racines corrigées après le cas Fofié :
1. **Cette fonction n'était jamais planifiée** — uniquement déclenchable à la demande via
   ce skill. Sans session humaine pour la relancer chaque jour, aucun pays n'était plus
   jamais rattrapé. Corrigé : cron `sentiqs-refresh-coverage-gaps` (`5,35 * * * *`, migration
   `schedule_refresh_coverage_gaps`) — le rattrapage tourne désormais seul, en continu.
2. **La requête ne portait que sur le nom du pays**, un terme trop générique qui remonte du
   contenu panafricain grand public (culture, sport) plutôt que les événements
   sécuritaires/institutionnels qui sont la raison d'être de SentiqS. Corrigé en combinant
   systématiquement le nom du pays à un vocabulaire sécuritaire générique et stable dans le
   temps (jamais de nom propre ni d'événement précis à y ajouter).
3. **La priorisation se basait sur `feeds.timestamp`** (date du dernier article toutes
   sources confondues), que des mentions incidentes de flux panafricains génériques
   pouvaient rafraîchir sans qu'aucune recherche ciblée n'ait réellement eu lieu — masquant
   ainsi un pays réellement délaissé. Remplacé par une rotation équitable sur
   `country_posture_state.last_collection_at` (date de la dernière tentative de CETTE
   fonction, succès ou échec) : chaque pays repasse en tête après un nombre de runs borné,
   indépendamment du bruit généré par rss-poll.
4. **Alerting étendu** : `alert-dead-sources` (cron horaire) surveille désormais aussi les
   pays sans recherche ciblée depuis 24h+, en plus des sources RSS mortes — pour ne plus
   jamais dépendre d'une vérification manuelle périodique pour s'en apercevoir.

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

- `reason` par pays ciblé (informatif — ne sert plus à prioriser depuis v2.1, voir plus
  bas) : `sans_source` (aucune source enregistrée pour ce pays), `jamais_collecte` (source
  existe mais aucun article encore vu), `donnees_anciennes` (dernier article de plus de
  48h), `couverture_recente` (le pays a été choisi uniquement parce que sa dernière
  recherche ciblée est la plus ancienne, pas parce que ses données sont en creux).
- `result` par pays traité : `couverture_amelioree` (au moins un article inséré),
  `aucun_resultat` (recherche effectuée, rien trouvé), `erreur` (la requête vers Google
  News a échoué — voir `detail`).
- Si `skipped: true` dans la réponse, un rattrapage est déjà en cours (verrou actif) —
  ne pas relancer, réessayer plus tard.
- `total_countries_in_gap` : depuis v2.1, ce n'est plus "combien de pays sur 54 sont
  candidats" (tous le sont en permanence désormais) mais "combien de pays n'ont pas eu de
  recherche ciblée depuis plus de 48h" — un indicateur de retard de la rotation, pas de
  la population totale.

**Présente toujours à l'utilisateur, en français, un résumé court avant le détail** :
combien de pays étaient en retard (`total_countries_in_gap`), combien ont été traités
cette fois-ci, combien d'articles ont été trouvés/insérés. Comme la rotation tourne en
continu via le cron, il n'est plus nécessaire de "rattraper tout le retard en plusieurs
appels manuels" — mais un appel manuel reste utile pour accélérer un pays précis.

Rappelle que les articles insérés portent `verification_status: 'unverified'` et un score
d'hallucination prudent (0.3) — ils seront re-vérifiés automatiquement par le prochain
passage de `batch-verify-feeds` (cron `sentiqs-batch-verify`, toutes les 30 min), pas
immédiatement.

## Automatisation périodique — déjà en place depuis le 2026-08-10

Le rattrapage tourne désormais **automatiquement** via `pg_cron`
(`sentiqs-refresh-coverage-gaps`, `5,35 * * * *` — décalé de 5 min par rapport à
`sentiqs-rss-poll` pour ne pas cumuler deux pics `pg_net`), planifié par la migration
`schedule_refresh_coverage_gaps`. Ce skill reste utile pour :
- **forcer un passage immédiat** (ex. l'utilisateur signale un pays précis qui manque
  d'actualité et ne veut pas attendre la prochaine rotation) ;
- **diagnostiquer** un run qui échoue de façon répétée (voir `coverage_refresh_log` et la
  note de timing plus bas).

Si l'utilisateur veut modifier la cadence ou désactiver l'automatisation, c'est un
changement d'infrastructure récurrent : demander confirmation avant de modifier ou
supprimer le cron (`select cron.alter_job(...)` / migration dédiée), ne jamais le faire
silencieusement.

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
