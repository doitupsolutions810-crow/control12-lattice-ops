create schema if not exists avrone_runtime;
set search_path to avrone_runtime, public;

create table if not exists workload_identities(id text primary key,tenant text,provider text,issuer text,subject text,audience text,status text,claims text,verified_by text,verified_at text,verification_receipt text,created_at text,updated_at text);
create table if not exists cluster_agents(id text primary key,tenant text,cluster_id text,name text,endpoint text,identity_id text,capabilities text,allowed_namespaces text,token_hash text,status text,lease_expires_at text,last_seen_at text,registered_by text,created_at text,updated_at text);
create table if not exists cluster_commands(id text primary key,tenant text,cluster_agent_id text,command_type text,target text,payload text,nonce text,status text,requested_by text,approved_by text,expires_at text,envelope text,result text,approval_reason text,created_at text,updated_at text,dispatched_at text);
create table if not exists cluster_receipts(id text primary key,command_id text,cluster_agent_id text,status text,receipt text,signature text,created_at text);
create table if not exists slo_ingest_batches(id text primary key,tenant text,source text,deployment_id text,metrics text,status text,received_at text,created_at text);
create table if not exists rollback_executions(id text primary key,tenant text,proposal_id text,cluster_agent_id text,requested_by text,approved_by text,approval_reason text,status text,executed_by text,command_id text,receipt text,created_at text,updated_at text,completed_at text);
create table if not exists disaster_recovery_drills(id text primary key,tenant text,backup_id text,recovery_rehearsal_id text,cluster_agent_id text,requested_by text,approved_by text,status text,checks text,started_at text,completed_at text,created_at text,updated_at text);
create table if not exists mission_team_requests(id text primary key,tenant text,mission_id text,capabilities text,roles text,budget_units integer,lease_minutes integer,requested_by text,status text,result text,created_at text);
create table if not exists federation_peers(id text primary key,tenant text,name text,public_key text,allowed_types text,status text,registered_by text,created_at text,updated_at text,last_seen_at text);
create table if not exists federation_v2_messages(id text primary key,tenant text,peer_id text,direction text,message_type text,envelope text,status text,receipt text,created_at text,updated_at text);
create table if not exists federation_v2_receipts(id text primary key,message_id text,peer_id text,status text,receipt text,created_at text);

create index if not exists idx_cluster_commands_agent_status on cluster_commands(cluster_agent_id,status,created_at);
create index if not exists idx_cluster_agents_tenant_status on cluster_agents(tenant,status,last_seen_at);
create index if not exists idx_slo_batches_deployment on slo_ingest_batches(tenant,deployment_id,received_at);
create index if not exists idx_rollback_execution_status on rollback_executions(tenant,status,created_at);
create index if not exists idx_dr_drills_status on disaster_recovery_drills(tenant,status,created_at);
create index if not exists idx_federation_v2_peer on federation_v2_messages(tenant,peer_id,status,created_at);

alter table workload_identities enable row level security;
alter table cluster_agents enable row level security;
alter table cluster_commands enable row level security;
alter table cluster_receipts enable row level security;
alter table slo_ingest_batches enable row level security;
alter table rollback_executions enable row level security;
alter table disaster_recovery_drills enable row level security;
alter table mission_team_requests enable row level security;
alter table federation_peers enable row level security;
alter table federation_v2_messages enable row level security;
alter table federation_v2_receipts enable row level security;

do $$ begin create policy deny_client_access_workload_identities on workload_identities for all to anon,authenticated using (false) with check (false); exception when duplicate_object then null; end $$;
do $$ begin create policy deny_client_access_cluster_agents on cluster_agents for all to anon,authenticated using (false) with check (false); exception when duplicate_object then null; end $$;
do $$ begin create policy deny_client_access_cluster_commands on cluster_commands for all to anon,authenticated using (false) with check (false); exception when duplicate_object then null; end $$;
do $$ begin create policy deny_client_access_cluster_receipts on cluster_receipts for all to anon,authenticated using (false) with check (false); exception when duplicate_object then null; end $$;
do $$ begin create policy deny_client_access_slo_ingest_batches on slo_ingest_batches for all to anon,authenticated using (false) with check (false); exception when duplicate_object then null; end $$;
do $$ begin create policy deny_client_access_rollback_executions on rollback_executions for all to anon,authenticated using (false) with check (false); exception when duplicate_object then null; end $$;
do $$ begin create policy deny_client_access_disaster_recovery_drills on disaster_recovery_drills for all to anon,authenticated using (false) with check (false); exception when duplicate_object then null; end $$;
do $$ begin create policy deny_client_access_mission_team_requests on mission_team_requests for all to anon,authenticated using (false) with check (false); exception when duplicate_object then null; end $$;
do $$ begin create policy deny_client_access_federation_peers on federation_peers for all to anon,authenticated using (false) with check (false); exception when duplicate_object then null; end $$;
do $$ begin create policy deny_client_access_federation_v2_messages on federation_v2_messages for all to anon,authenticated using (false) with check (false); exception when duplicate_object then null; end $$;
do $$ begin create policy deny_client_access_federation_v2_receipts on federation_v2_receipts for all to anon,authenticated using (false) with check (false); exception when duplicate_object then null; end $$;
