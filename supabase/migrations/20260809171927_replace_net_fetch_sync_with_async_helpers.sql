-- net_fetch_sync (synchrone, polling bloquant) s'est révélé peu fiable en test réel :
-- les requêtes pg_net vers news.google.com aboutissent (status 200) mais avec une
-- latence très variable (jusqu'à ~80s), ce qui fait systématiquement expirer une
-- attente bloquante par requête. Remplacé par un modèle asynchrone "tir groupé puis
-- récolte" : on lance toutes les requêtes d'un coup (retour immédiat), on attend une
-- seule fois, puis on récupère en bloc tout ce qui est prêt.
--
-- Rollback : voir 20260809171927_replace_net_fetch_sync_with_async_helpers.down.sql

drop function if exists public.net_fetch_sync(text, jsonb, integer, integer);

create or replace function public.net_fetch_start(
  p_url text,
  p_headers jsonb default '{}'::jsonb,
  p_timeout_ms integer default 15000
) returns bigint
language sql
as $$
  select net.http_get(
    url := p_url,
    params := '{}'::jsonb,
    headers := p_headers,
    timeout_milliseconds := p_timeout_ms
  );
$$;

create or replace function public.net_fetch_collect(p_request_ids bigint[])
returns table(id bigint, status_code integer, content text, error_msg text)
language sql
as $$
  select r.id, r.status_code, r.content, r.error_msg
  from net._http_response r
  where r.id = any(p_request_ids);
$$;

revoke all on function public.net_fetch_start(text, jsonb, integer) from public, anon, authenticated;
revoke all on function public.net_fetch_collect(bigint[]) from public, anon, authenticated;
grant execute on function public.net_fetch_start(text, jsonb, integer) to service_role;
grant execute on function public.net_fetch_collect(bigint[]) to service_role;
