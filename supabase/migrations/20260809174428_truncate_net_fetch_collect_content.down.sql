-- Rollback de 20260809174500_truncate_net_fetch_collect_content.
create or replace function public.net_fetch_collect(p_request_ids bigint[])
returns table(id bigint, status_code integer, content text, error_msg text)
language sql
as $$
  select r.id, r.status_code, r.content, r.error_msg
  from net._http_response r
  where r.id = any(p_request_ids);
$$;

revoke all on function public.net_fetch_collect(bigint[]) from public, anon, authenticated;
grant execute on function public.net_fetch_collect(bigint[]) to service_role;
