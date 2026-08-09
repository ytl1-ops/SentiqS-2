-- Diagnostic en réel le 2026-08-09 : trois runs successifs de
-- refresh-coverage-gaps ont tous rapporté requests_answered:0, quel que
-- soit le budget d'attente testé (27s, 65s, 100s) — alors que
-- net._http_response montrait bien status_code=200 pour toutes les
-- requêtes. Cause identifiée : le contenu RSS de news.google.com pèse
-- 60 à 300 Ko par réponse ; collecter les ~11 requêtes d'un run en un seul
-- appel net_fetch_collect renvoie donc un JSON de plusieurs Mo, ce que
-- l'appel RPC depuis l'Edge Function échoue à traiter silencieusement
-- (collectOnce avale l'erreur). Comme aucune requête n'est jamais marquée
-- résolue, chaque passe de récolte suivante retente le même lot complet et
-- échoue de la même façon — d'où le 0 constant, indépendant du délai.
--
-- Fix : tronquer `content` côté SQL. parseRssItems() (edge function) ne
-- garde de toute façon que les 20 premiers <item> — bien en-deçà de ce que
-- 60 000 caractères contiennent pour un flux Google News.
--
-- Rollback : voir 20260809174500_truncate_net_fetch_collect_content.down.sql

create or replace function public.net_fetch_collect(p_request_ids bigint[])
returns table(id bigint, status_code integer, content text, error_msg text)
language sql
as $$
  select r.id, r.status_code, left(r.content, 60000), r.error_msg
  from net._http_response r
  where r.id = any(p_request_ids);
$$;

revoke all on function public.net_fetch_collect(bigint[]) from public, anon, authenticated;
grant execute on function public.net_fetch_collect(bigint[]) to service_role;
