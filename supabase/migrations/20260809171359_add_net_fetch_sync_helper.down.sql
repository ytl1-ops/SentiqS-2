-- Rollback de 20260809171359_add_net_fetch_sync_helper.
-- Sans objet si 20260809171927_replace_net_fetch_sync_with_async_helpers a
-- déjà été appliquée (cette dernière a déjà DROP la fonction).
drop function if exists public.net_fetch_sync(text, jsonb, integer, integer);
