create schema if not exists avrone_runtime;
set search_path to avrone_runtime, public;

create table if not exists strategic_objectives(
  id text primary key,tenant text,organization_id text,title text,outcome text,horizon text,owner text,status text,
  metrics text,created_at text,updated_at text
);
create table if not exists portfolio_initiatives(
  id text primary key,tenant text,objective_id text,name text,service_id text,budget_account_id text,
  expected_value integer,risk text,status text,proposed_by text,approved_by text,created_at text,updated_at text
);
create table if not exists strategy_scenarios(
  id text primary key,tenant text,objective_id text,name text,assumptions text,results text,status text,
  run_by text,created_at text,completed_at text
);
create table if not exists ledger_accounts(
  id text primary key,tenant text,organization_id text,code text,name text,account_type text,currency text,status text,
  created_by text,created_at text,updated_at text,unique(tenant,organization_id,code)
);
create table if not exists journal_entries(
  id text primary key,tenant text,organization_id text,description text,reference_type text,reference_id text,
  requested_by text,approved_by text,posted_by text,status text,total_debits integer,total_credits integer,
  receipt text,created_at text,updated_at text,posted_at text
);
create table if not exists journal_lines(
  id text primary key,entry_id text,line_index integer,account_id text,side text,amount_minor integer,memo text,
  unique(entry_id,line_index)
);
create table if not exists procurement_requests(
  id text primary key,tenant text,organization_id text,department_id text,service_id text,supplier_name text,
  description text,amount_minor integer,currency text,requested_by text,approved_by text,issued_by text,status text,
  contract_terms text,receipt text,created_at text,updated_at text
);
create table if not exists evidence_assessments(
  id text primary key,tenant text,node_id text,confidence double precision,status text,rationale text,assessed_by text,
  created_at text,updated_at text
);
create table if not exists causal_hypotheses(
  id text primary key,tenant text,incident_id text,cause_node_id text,effect_node_id text,confidence double precision,
  rationale text,proposed_by text,reviewed_by text,status text,created_at text,updated_at text
);
create table if not exists workforce_reviews(
  id text primary key,tenant text,member_id text,period_start text,period_end text,metrics text,score double precision,
  status text,reviewed_by text,created_at text,updated_at text
);
create table if not exists federated_deliveries(
  id text primary key,tenant text,reservation_id text,provider_peer_id text,artifact_ref text,evidence text,
  delivered_by text,accepted_by text,status text,created_at text,updated_at text
);
create table if not exists settlement_requests(
  id text primary key,tenant text,delivery_id text,amount_minor integer,currency text,requested_by text,approved_by text,
  settled_by text,status text,receipt text,created_at text,updated_at text,settled_at text
);
create table if not exists institutional_disputes(
  id text primary key,tenant text,subject_type text,subject_id text,opened_by text,respondent text,reason text,status text,
  reviewer text,decision text,created_at text,updated_at text,closed_at text
);
create table if not exists continuity_plans(
  id text primary key,tenant text,organization_id text,name text,scope text,recovery_objectives text,owner text,status text,
  created_at text,updated_at text
);
create table if not exists continuity_exercises(
  id text primary key,tenant text,plan_id text,scenario text,requested_by text,approved_by text,executed_by text,status text,
  results text,receipt text,created_at text,updated_at text,completed_at text
);

create index if not exists idx_strategy_objectives_tenant_status on strategic_objectives(tenant,status,created_at);
create index if not exists idx_portfolio_initiatives_objective on portfolio_initiatives(objective_id,status,created_at);
create index if not exists idx_journal_entries_status on journal_entries(tenant,status,created_at);
create index if not exists idx_procurement_status on procurement_requests(tenant,status,created_at);
create index if not exists idx_evidence_assessments_node on evidence_assessments(tenant,node_id,created_at);
create index if not exists idx_causal_hypotheses_incident on causal_hypotheses(tenant,incident_id,status,created_at);
create index if not exists idx_settlement_status on settlement_requests(tenant,status,created_at);
create index if not exists idx_disputes_status on institutional_disputes(tenant,status,created_at);
create index if not exists idx_continuity_exercises_status on continuity_exercises(tenant,status,created_at);

alter table strategic_objectives enable row level security;
alter table portfolio_initiatives enable row level security;
alter table strategy_scenarios enable row level security;
alter table ledger_accounts enable row level security;
alter table journal_entries enable row level security;
alter table journal_lines enable row level security;
alter table procurement_requests enable row level security;
alter table evidence_assessments enable row level security;
alter table causal_hypotheses enable row level security;
alter table workforce_reviews enable row level security;
alter table federated_deliveries enable row level security;
alter table settlement_requests enable row level security;
alter table institutional_disputes enable row level security;
alter table continuity_plans enable row level security;
alter table continuity_exercises enable row level security;

do $$ begin create policy deny_client_access_strategic_objectives on strategic_objectives for all to anon,authenticated using (false) with check (false); exception when duplicate_object then null; end $$;
do $$ begin create policy deny_client_access_portfolio_initiatives on portfolio_initiatives for all to anon,authenticated using (false) with check (false); exception when duplicate_object then null; end $$;
do $$ begin create policy deny_client_access_strategy_scenarios on strategy_scenarios for all to anon,authenticated using (false) with check (false); exception when duplicate_object then null; end $$;
do $$ begin create policy deny_client_access_ledger_accounts on ledger_accounts for all to anon,authenticated using (false) with check (false); exception when duplicate_object then null; end $$;
do $$ begin create policy deny_client_access_journal_entries on journal_entries for all to anon,authenticated using (false) with check (false); exception when duplicate_object then null; end $$;
do $$ begin create policy deny_client_access_journal_lines on journal_lines for all to anon,authenticated using (false) with check (false); exception when duplicate_object then null; end $$;
do $$ begin create policy deny_client_access_procurement_requests on procurement_requests for all to anon,authenticated using (false) with check (false); exception when duplicate_object then null; end $$;
do $$ begin create policy deny_client_access_evidence_assessments on evidence_assessments for all to anon,authenticated using (false) with check (false); exception when duplicate_object then null; end $$;
do $$ begin create policy deny_client_access_causal_hypotheses on causal_hypotheses for all to anon,authenticated using (false) with check (false); exception when duplicate_object then null; end $$;
do $$ begin create policy deny_client_access_workforce_reviews on workforce_reviews for all to anon,authenticated using (false) with check (false); exception when duplicate_object then null; end $$;
do $$ begin create policy deny_client_access_federated_deliveries on federated_deliveries for all to anon,authenticated using (false) with check (false); exception when duplicate_object then null; end $$;
do $$ begin create policy deny_client_access_settlement_requests on settlement_requests for all to anon,authenticated using (false) with check (false); exception when duplicate_object then null; end $$;
do $$ begin create policy deny_client_access_institutional_disputes on institutional_disputes for all to anon,authenticated using (false) with check (false); exception when duplicate_object then null; end $$;
do $$ begin create policy deny_client_access_continuity_plans on continuity_plans for all to anon,authenticated using (false) with check (false); exception when duplicate_object then null; end $$;
do $$ begin create policy deny_client_access_continuity_exercises on continuity_exercises for all to anon,authenticated using (false) with check (false); exception when duplicate_object then null; end $$;
