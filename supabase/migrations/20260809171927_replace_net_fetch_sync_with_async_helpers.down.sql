-- Rollback de 20260809171927_replace_net_fetch_sync_with_async_helpers.
drop function if exists public.net_fetch_start(text, jsonb, integer);
drop function if exists public.net_fetch_collect(bigint[]);
