create schema if not exists avrone_runtime;
set search_path to avrone_runtime, public;

create table if not exists backup_records(
  id text primary key,tenant text,requested_by text,path text,sha256 text,database_backend text,
  metadata text,status text,created_at text,updated_at text
);
create table if not exists recovery_rehearsals(
  id text primary key,tenant text,backup_id text,requested_by text,status text,checks text,
  started_at text,completed_at text,error text
);
create table if not exists deployment_admissions(
  id text primary key,tenant text,deployment_id text,environment text,archive_sha256 text,
  evaluation_id text,backup_id text,rollback_plan text,requested_by text,status text,checks text,
  approved_by text,approval_reason text,created_at text,updated_at text
);
create table if not exists worker_recoveries(
  id text primary key,worker_id text,recovered_jobs integer,recovered_outbox integer,
  stale_workers integer,details text,created_at text
);

create index if not exists idx_backups_tenant_created on backup_records(tenant,created_at);
create index if not exists idx_rehearsals_tenant_status on recovery_rehearsals(tenant,status,completed_at);
create index if not exists idx_admissions_tenant_status on deployment_admissions(tenant,status,created_at);

alter table backup_records enable row level security;
alter table recovery_rehearsals enable row level security;
alter table deployment_admissions enable row level security;
alter table worker_recoveries enable row level security;

do $$ begin
  create policy deny_client_access_backup_records on backup_records for all to anon,authenticated using (false) with check (false);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy deny_client_access_recovery_rehearsals on recovery_rehearsals for all to anon,authenticated using (false) with check (false);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy deny_client_access_deployment_admissions on deployment_admissions for all to anon,authenticated using (false) with check (false);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy deny_client_access_worker_recoveries on worker_recoveries for all to anon,authenticated using (false) with check (false);
exception when duplicate_object then null; end $$;
