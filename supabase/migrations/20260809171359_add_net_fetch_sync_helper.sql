-- Les appels sortants HTTP effectués directement depuis le runtime Deno des
-- Edge Functions vers news.google.com échouent systématiquement (HTTP 503),
-- alors que le même appel via pg_net (net.http_get, exécuté côté Postgres)
-- réussit de façon fiable — confirmé en test réel le 2026-08-09. Ce helper
-- relaie un GET HTTP via pg_net et attend la réponse de façon synchrone
-- (polling court), pour être appelé en RPC depuis une Edge Function.
--
-- SUPERSEDÉ par la migration suivante (20260809171927) : le polling bloquant
-- s'est révélé peu fiable en pratique (latence pg_net très variable, jusqu'à
-- ~80s, qui fait expirer une attente par requête individuelle). Conservé ici
-- tel qu'appliqué pour l'historique des migrations.
--
-- Rollback : voir 20260809171359_add_net_fetch_sync_helper.down.sql

create or replace function public.net_fetch_sync(
  p_url text,
  p_headers jsonb default '{}'::jsonb,
  p_timeout_ms integer default 10000,
  p_poll_interval_ms integer default 200
) returns table(status_code integer, content text, error_msg text)
language plpgsql
as $$
declare
  v_request_id bigint;
  v_deadline timestamptz;
  v_row net._http_response%rowtype;
begin
  v_request_id := net.http_get(
    url := p_url,
    params := '{}'::jsonb,
    headers := p_headers,
    timeout_milliseconds := p_timeout_ms
  );
  v_deadline := clock_timestamp() + (p_timeout_ms || ' milliseconds')::interval + interval '2 seconds';

  loop
    select r.status_code, r.content, r.error_msg into v_row.status_code, v_row.content, v_row.error_msg
    from net._http_response r where r.id = v_request_id;

    if v_row.status_code is not null or v_row.error_msg is not null then
      status_code := v_row.status_code;
      content := v_row.content;
      error_msg := v_row.error_msg;
      return next;
      return;
    end if;

    if clock_timestamp() > v_deadline then
      status_code := null;
      content := null;
      error_msg := 'net_fetch_sync: timeout waiting for response';
      return next;
      return;
    end if;

    perform pg_sleep(p_poll_interval_ms / 1000.0);
  end loop;
end;
$$;

revoke all on function public.net_fetch_sync(text, jsonb, integer, integer) from public, anon, authenticated;
grant execute on function public.net_fetch_sync(text, jsonb, integer, integer) to service_role;
