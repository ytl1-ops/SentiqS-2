-- Relit le résultat d'un appel refresh-coverage-gaps déclenché via trigger_refresh.sql.
-- Remplacer <REQUEST_ID> par le request_id retourné par net.http_post.
-- Exécuter via mcp__Supabase__execute_sql.

select status_code, content_type, content, error_msg, created
from net._http_response
where id = <REQUEST_ID>;

-- Si content est vide et error_msg est null : la requête est encore en cours,
-- réessayer dans quelques secondes (pas de boucle serrée).

-- Journal détaillé par territoire, toutes exécutions confondues :
-- select * from public.coverage_refresh_log order by run_at desc limit 50;

-- État de couverture actuel par pays :
-- select country_code, country_name, level, coverage_status, last_collection_at,
--        sources_consulted_count
-- from public.country_posture_state
-- order by last_collection_at asc nulls first;
