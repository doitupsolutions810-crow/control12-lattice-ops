-- Avrone v1.5: explicit deny-by-default policies for service-owned control tables.
-- Application access should use SECURITY DEFINER RPCs or a trusted service role.

alter table if exists control12.workspaces enable row level security;
alter table if exists control12.terminal_sessions enable row level security;
alter table if exists control12.terminal_events enable row level security;
alter table if exists control12.replay_locks enable row level security;
alter table if exists control12.rate_limits enable row level security;
alter table if exists control12.idempotency_keys enable row level security;
alter table if exists control12.worker_heartbeats enable row level security;
alter table if exists control12.artifacts enable row level security;
alter table if exists control12.audit_receipts enable row level security;

-- Presence of these policies makes the deny boundary explicit for anon/authenticated users.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'workspaces','terminal_sessions','terminal_events','replay_locks','rate_limits',
    'idempotency_keys','worker_heartbeats','artifacts','audit_receipts'
  ] loop
    execute format('drop policy if exists %I on control12.%I', 'deny_client_access_' || table_name, table_name);
    execute format(
      'create policy %I on control12.%I for all to anon, authenticated using (false) with check (false)',
      'deny_client_access_' || table_name, table_name
    );
  end loop;
end $$;
