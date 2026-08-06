create schema if not exists avrone_runtime;
set search_path to avrone_runtime, public;

create table if not exists enterprise_organizations(
  id text primary key, tenant text, slug text, name text, charter text, status text, created_by text,
  created_at text, updated_at text, unique(tenant,slug)
);
create table if not exists enterprise_departments(
  id text primary key, tenant text, organization_id text, parent_department_id text, name text, purpose text,
  status text, created_by text, created_at text, updated_at text
);
create table if not exists enterprise_services(
  id text primary key, tenant text, organization_id text, department_id text, name text, tier text,
  environment text, slo_policy text, owner_member_id text, ownership_status text, status text,
  created_at text, updated_at text
);
create table if not exists service_ownership_events(
  id text primary key, tenant text, service_id text, previous_owner_member_id text, new_owner_member_id text,
  detail text, created_at text
);
create table if not exists enterprise_budget_accounts(
  id text primary key, tenant text, organization_id text, department_id text, service_id text, name text,
  limit_units integer, committed_units integer, spent_units integer, status text, created_by text,
  created_at text, updated_at text
);
create table if not exists enterprise_budget_transactions(
  id text primary key, tenant text, account_id text, mission_id text, kind text, units integer, purpose text,
  requested_by text, approved_by text, approval_reason text, status text, receipt text, created_at text, updated_at text
);
create table if not exists incidents(
  id text primary key, tenant text, service_id text, severity text, status text, summary text,
  source_slo_batch_id text, declared_by text, commander text, resolution text, external_reference text,
  created_at text, updated_at text, resolved_at text
);
create table if not exists incident_events(
  id text primary key, incident_id text, seq integer, event_type text, payload text, actor text, created_at text,
  unique(incident_id,seq)
);
create table if not exists incident_actions(
  id text primary key, tenant text, incident_id text, cluster_agent_id text, command_type text, target text,
  payload text, requested_by text, approved_by text, approval_reason text, executed_by text, command_id text,
  status text, receipt text, created_at text, updated_at text, completed_at text
);
create table if not exists evidence_graph_nodes(
  id text primary key, tenant text, node_type text, subject_id text, label text, attributes text, digest text,
  created_by text, created_at text, updated_at text, unique(tenant,node_type,subject_id)
);
create table if not exists evidence_graph_edges(
  id text primary key, tenant text, from_node_id text, to_node_id text, relation text, evidence_id text,
  attributes text, digest text, created_by text, created_at text
);
create table if not exists resource_offers(
  id text primary key, tenant text, peer_id text, resource_type text, capacity_units integer,
  allocated_units integer, terms text, offered_by text, approved_by text, status text, created_at text,
  updated_at text, federation_message_id text
);
create table if not exists resource_reservations(
  id text primary key, tenant text, offer_id text, units integer, purpose text, requested_by text,
  approved_by text, approval_reason text, activated_by text, status text, expires_at text, receipt text,
  created_at text, updated_at text, activated_at text
);
create table if not exists operation_plans(
  id text primary key, tenant text, service_id text, cluster_agent_id text, title text, window_start text,
  window_end text, requested_by text, approved_by text, approval_reason text, executed_by text, status text,
  steps text, receipt text, created_at text, updated_at text
);
create table if not exists operation_plan_steps(
  id text primary key, plan_id text, step_index integer, command_type text, target text, payload text,
  status text, command_id text, result text, created_at text, updated_at text, unique(plan_id,step_index)
);

create index if not exists idx_enterprise_services_tenant_status on enterprise_services(tenant,status,created_at);
create index if not exists idx_enterprise_budget_scope on enterprise_budget_accounts(tenant,organization_id,status);
create index if not exists idx_incidents_tenant_status on incidents(tenant,status,created_at);
create index if not exists idx_incident_actions_status on incident_actions(tenant,status,created_at);
create index if not exists idx_evidence_graph_edges_from on evidence_graph_edges(tenant,from_node_id,relation);
create index if not exists idx_evidence_graph_edges_to on evidence_graph_edges(tenant,to_node_id,relation);
create index if not exists idx_resource_offers_status on resource_offers(tenant,peer_id,status,created_at);
create index if not exists idx_resource_reservations_status on resource_reservations(tenant,offer_id,status,created_at);
create index if not exists idx_operation_plans_status on operation_plans(tenant,status,window_start);

alter table enterprise_organizations enable row level security;
alter table enterprise_departments enable row level security;
alter table enterprise_services enable row level security;
alter table service_ownership_events enable row level security;
alter table enterprise_budget_accounts enable row level security;
alter table enterprise_budget_transactions enable row level security;
alter table incidents enable row level security;
alter table incident_events enable row level security;
alter table incident_actions enable row level security;
alter table evidence_graph_nodes enable row level security;
alter table evidence_graph_edges enable row level security;
alter table resource_offers enable row level security;
alter table resource_reservations enable row level security;
alter table operation_plans enable row level security;
alter table operation_plan_steps enable row level security;

do $$ begin create policy deny_client_access_enterprise_organizations on enterprise_organizations for all to anon,authenticated using (false) with check (false); exception when duplicate_object then null; end $$;
do $$ begin create policy deny_client_access_enterprise_departments on enterprise_departments for all to anon,authenticated using (false) with check (false); exception when duplicate_object then null; end $$;
do $$ begin create policy deny_client_access_enterprise_services on enterprise_services for all to anon,authenticated using (false) with check (false); exception when duplicate_object then null; end $$;
do $$ begin create policy deny_client_access_service_ownership_events on service_ownership_events for all to anon,authenticated using (false) with check (false); exception when duplicate_object then null; end $$;
do $$ begin create policy deny_client_access_enterprise_budget_accounts on enterprise_budget_accounts for all to anon,authenticated using (false) with check (false); exception when duplicate_object then null; end $$;
do $$ begin create policy deny_client_access_enterprise_budget_transactions on enterprise_budget_transactions for all to anon,authenticated using (false) with check (false); exception when duplicate_object then null; end $$;
do $$ begin create policy deny_client_access_incidents on incidents for all to anon,authenticated using (false) with check (false); exception when duplicate_object then null; end $$;
do $$ begin create policy deny_client_access_incident_events on incident_events for all to anon,authenticated using (false) with check (false); exception when duplicate_object then null; end $$;
do $$ begin create policy deny_client_access_incident_actions on incident_actions for all to anon,authenticated using (false) with check (false); exception when duplicate_object then null; end $$;
do $$ begin create policy deny_client_access_evidence_graph_nodes on evidence_graph_nodes for all to anon,authenticated using (false) with check (false); exception when duplicate_object then null; end $$;
do $$ begin create policy deny_client_access_evidence_graph_edges on evidence_graph_edges for all to anon,authenticated using (false) with check (false); exception when duplicate_object then null; end $$;
do $$ begin create policy deny_client_access_resource_offers on resource_offers for all to anon,authenticated using (false) with check (false); exception when duplicate_object then null; end $$;
do $$ begin create policy deny_client_access_resource_reservations on resource_reservations for all to anon,authenticated using (false) with check (false); exception when duplicate_object then null; end $$;
do $$ begin create policy deny_client_access_operation_plans on operation_plans for all to anon,authenticated using (false) with check (false); exception when duplicate_object then null; end $$;
do $$ begin create policy deny_client_access_operation_plan_steps on operation_plan_steps for all to anon,authenticated using (false) with check (false); exception when duplicate_object then null; end $$;
