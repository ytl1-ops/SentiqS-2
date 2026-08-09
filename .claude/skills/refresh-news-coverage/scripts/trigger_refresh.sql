-- Déclenche un rattrapage de couverture (voir SKILL.md).
-- 1. Récupérer une clé anon à jour via mcp__Supabase__get_publishable_keys
--    (project_id: yttctytqjtmaiheegqky) et remplacer <ANON_KEY> ci-dessous.
-- 2. Exécuter via mcp__Supabase__execute_sql. Noter le request_id retourné.
-- 3. Relire le résultat avec check_result.sql après ~45-60s.

select net.http_post(
  url := 'https://yttctytqjtmaiheegqky.supabase.co/functions/v1/refresh-coverage-gaps',
  headers := '{"Content-Type": "application/json", "Authorization": "Bearer <ANON_KEY>"}'::jsonb,
  body := '{}'::jsonb,
  timeout_milliseconds := 90000
) as request_id;
