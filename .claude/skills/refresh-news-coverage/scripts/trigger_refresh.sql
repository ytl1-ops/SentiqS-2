-- Déclenche un rattrapage de couverture (voir SKILL.md).
-- 1. Récupérer une clé anon à jour via mcp__Supabase__get_publishable_keys
--    (project_id: yttctytqjtmaiheegqky) et remplacer <ANON_KEY> ci-dessous.
-- 2. Exécuter via mcp__Supabase__execute_sql. Noter le request_id retourné.
-- 3. Relire le résultat avec check_result.sql après ~2 minutes 30 (voir la note de
--    timing dans SKILL.md — la fonction attend elle-même jusqu'à 135s en interne
--    à cause de la latence variable de pg_net vers Google News).

select net.http_post(
  url := 'https://yttctytqjtmaiheegqky.supabase.co/functions/v1/refresh-coverage-gaps',
  headers := '{"Content-Type": "application/json", "Authorization": "Bearer <ANON_KEY>"}'::jsonb,
  body := '{}'::jsonb,
  timeout_milliseconds := 150000
) as request_id;
