create schema if not exists avrone_runtime;
set search_path to avrone_runtime, public;

create table if not exists constitutional_policy_documents(
  id text primary key,tenant text,organization_id text,slug text,title text,status text,active_version_id text,
  created_by text,created_at text,updated_at text,unique(tenant,organization_id,slug)
);
create table if not exists constitutional_policy_versions(
  id text primary key,tenant text,document_id text,version_number integer,body text,digest text,proposed_by text,
  ratified_by text,activated_by text,status text,created_at text,ratified_at text,activated_at text,
  unique(document_id,version_number),unique(document_id,digest)
);
create table if not exists constitutional_amendment_proposals(
  id text primary key,tenant text,document_id text,base_version_id text,proposed_body text,digest text,rationale text,
  proposed_by text,status text,required_quorum integer,created_at text,updated_at text,activated_version_id text
);
create table if not exists constitutional_amendment_votes_v6(
  amendment_id text,actor_id text,decision text,reason text,created_at text,primary key(amendment_id,actor_id)
);
create table if not exists delegated_authority_leases(
  id text primary key,tenant text,organization_id text,grantor text,grantee text,capabilities text,max_uses integer,
  uses integer,valid_from text,expires_at text,status text,scope text,created_at text,updated_at text,revoked_by text
);
create table if not exists emergency_authority_requests(
  id text primary key,tenant text,organization_id text,requested_by text,approved_by text,activated_by text,
  capabilities text,reason text,expires_at text,max_uses integer,uses integer,status text,receipt text,
  created_at text,updated_at text,closed_at text
);
create table if not exists institutional_event_log(
  id text primary key,tenant text,seq integer,event_type text,subject_type text,subject_id text,payload text,actor text,
  previous_hash text,entry_hash text,created_at text,unique(tenant,seq)
);
create table if not exists institutional_event_checkpoints(
  id text primary key,tenant text,from_seq integer,to_seq integer,merkle_root text,entry_count integer,
  created_by text,created_at text
);
create table if not exists federation_treaties(
  id text primary key,tenant text,peer_id text,name text,terms text,digest text,proposed_by text,local_ratifier text,
  peer_attestation text,activated_by text,status text,effective_at text,expires_at text,created_at text,updated_at text
);
create table if not exists treaty_missions(
  id text primary key,tenant text,treaty_id text,title text,objective text,requested_by text,approved_by text,
  executed_by text,status text,capability text,receipt text,created_at text,updated_at text,completed_at text
);
create table if not exists audit_export_requests(
  id text primary key,tenant text,organization_id text,scope text,period_start text,period_end text,requested_by text,
  approved_by text,exported_by text,status text,export_digest text,export_payload text,created_at text,updated_at text,
  completed_at text
);
create table if not exists reconciliation_runs(
  id text primary key,tenant text,organization_id text,requested_by text,reviewed_by text,status text,results text,
  results_digest text,created_at text,updated_at text,completed_at text
);

create index if not exists idx_policy_documents_tenant_status on constitutional_policy_documents(tenant,status,created_at);
create index if not exists idx_policy_versions_document on constitutional_policy_versions(document_id,version_number);
create index if not exists idx_amendments_status on constitutional_amendment_proposals(tenant,status,created_at);
create index if not exists idx_authority_leases_grantee on delegated_authority_leases(tenant,grantee,status,expires_at);
create index if not exists idx_emergency_authority_status on emergency_authority_requests(tenant,status,expires_at);
create index if not exists idx_institutional_event_log_seq on institutional_event_log(tenant,seq);
create index if not exists idx_treaties_peer_status on federation_treaties(tenant,peer_id,status);
create index if not exists idx_treaty_missions_status on treaty_missions(tenant,status,created_at);
create index if not exists idx_audit_exports_status on audit_export_requests(tenant,status,created_at);
create index if not exists idx_reconciliation_status on reconciliation_runs(tenant,status,created_at);

create or replace function avrone_runtime.prevent_institutional_event_mutation()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  raise exception 'institutional event log is append-only';
end;
$$;
drop trigger if exists trg_institutional_event_log_no_update on institutional_event_log;
create trigger trg_institutional_event_log_no_update before update on institutional_event_log
for each row execute function avrone_runtime.prevent_institutional_event_mutation();
drop trigger if exists trg_institutional_event_log_no_delete on institutional_event_log;
create trigger trg_institutional_event_log_no_delete before delete on institutional_event_log
for each row execute function avrone_runtime.prevent_institutional_event_mutation();

alter table constitutional_policy_documents enable row level security;
alter table constitutional_policy_versions enable row level security;
alter table constitutional_amendment_proposals enable row level security;
alter table constitutional_amendment_votes_v6 enable row level security;
alter table delegated_authority_leases enable row level security;
alter table emergency_authority_requests enable row level security;
alter table institutional_event_log enable row level security;
alter table institutional_event_checkpoints enable row level security;
alter table federation_treaties enable row level security;
alter table treaty_missions enable row level security;
alter table audit_export_requests enable row level security;
alter table reconciliation_runs enable row level security;

do $$ begin create policy deny_client_access_constitutional_policy_documents on constitutional_policy_documents for all to anon,authenticated using (false) with check (false); exception when duplicate_object then null; end $$;
do $$ begin create policy deny_client_access_constitutional_policy_versions on constitutional_policy_versions for all to anon,authenticated using (false) with check (false); exception when duplicate_object then null; end $$;
do $$ begin create policy deny_client_access_constitutional_amendment_proposals on constitutional_amendment_proposals for all to anon,authenticated using (false) with check (false); exception when duplicate_object then null; end $$;
do $$ begin create policy deny_client_access_constitutional_amendment_votes_v6 on constitutional_amendment_votes_v6 for all to anon,authenticated using (false) with check (false); exception when duplicate_object then null; end $$;
do $$ begin create policy deny_client_access_delegated_authority_leases on delegated_authority_leases for all to anon,authenticated using (false) with check (false); exception when duplicate_object then null; end $$;
do $$ begin create policy deny_client_access_emergency_authority_requests on emergency_authority_requests for all to anon,authenticated using (false) with check (false); exception when duplicate_object then null; end $$;
do $$ begin create policy deny_client_access_institutional_event_log on institutional_event_log for all to anon,authenticated using (false) with check (false); exception when duplicate_object then null; end $$;
do $$ begin create policy deny_client_access_institutional_event_checkpoints on institutional_event_checkpoints for all to anon,authenticated using (false) with check (false); exception when duplicate_object then null; end $$;
do $$ begin create policy deny_client_access_federation_treaties on federation_treaties for all to anon,authenticated using (false) with check (false); exception when duplicate_object then null; end $$;
do $$ begin create policy deny_client_access_treaty_missions on treaty_missions for all to anon,authenticated using (false) with check (false); exception when duplicate_object then null; end $$;
do $$ begin create policy deny_client_access_audit_export_requests on audit_export_requests for all to anon,authenticated using (false) with check (false); exception when duplicate_object then null; end $$;
do $$ begin create policy deny_client_access_reconciliation_runs on reconciliation_runs for all to anon,authenticated using (false) with check (false); exception when duplicate_object then null; end $$;
