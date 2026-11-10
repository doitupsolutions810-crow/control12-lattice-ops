create schema if not exists avrone_runtime;
set search_path to avrone_runtime, public;

alter table deployment_admissions add column if not exists oci_artifact_id text;
alter table deployment_admissions add column if not exists rollout_id text;

create table if not exists oci_artifacts(
  id text primary key,tenant text,image_ref text,image_digest text,sbom_path text,sbom_sha256 text,
  provenance_path text,provenance_sha256 text,verification_receipt_path text,verification_receipt_sha256 text,
  source_repository text,source_commit text,workflow_identity text,registered_by text,status text,checks text,
  admitted_by text,admitted_at text,admission_receipt text,created_at text,updated_at text
);
create table if not exists canary_rollouts(
  id text primary key,tenant text,admission_id text,deployment_id text,oci_artifact_id text,image_ref text,
  namespace text,requested_by text,status text,steps text,current_step integer,plan text,decision text,
  rollback_proposal_id text,completed_at text,applied_by text,applied_at text,apply_receipt text,created_at text,updated_at text
);
create table if not exists rollout_observations(
  id text primary key,tenant text,rollout_id text,step_index integer,metric text,value double precision,
  threshold double precision,status text,observed_at text
);
create table if not exists rollback_proposals(
  id text primary key,tenant text,rollout_id text,deployment_id text,status text,proposal text,
  proposed_by text,decision_by text,created_at text,updated_at text
);

create index if not exists idx_oci_artifacts_tenant_status on oci_artifacts(tenant,status,created_at);
create index if not exists idx_canary_rollouts_admission on canary_rollouts(admission_id,status,created_at);
create index if not exists idx_rollout_observations_step on rollout_observations(rollout_id,step_index,observed_at);
create index if not exists idx_rollback_proposals_status on rollback_proposals(tenant,status,created_at);

alter table oci_artifacts enable row level security;
alter table canary_rollouts enable row level security;
alter table rollout_observations enable row level security;
alter table rollback_proposals enable row level security;

do $$ begin
  create policy deny_client_access_oci_artifacts on oci_artifacts for all to anon,authenticated using (false) with check (false);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy deny_client_access_canary_rollouts on canary_rollouts for all to anon,authenticated using (false) with check (false);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy deny_client_access_rollout_observations on rollout_observations for all to anon,authenticated using (false) with check (false);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy deny_client_access_rollback_proposals on rollback_proposals for all to anon,authenticated using (false) with check (false);
exception when duplicate_object then null; end $$;
