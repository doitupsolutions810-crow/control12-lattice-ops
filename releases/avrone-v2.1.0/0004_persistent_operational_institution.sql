create schema if not exists avrone_runtime;
set search_path to avrone_runtime, public;

create table if not exists objects(tenant text,kind text,id text,version integer,state text,primary key(tenant,kind,id));
create table if not exists envelopes(id text primary key,tenant text,project text,status text,body text,decision text,created_at text,updated_at text);
create table if not exists nonces(tenant text,nonce text,created_at text,primary key(tenant,nonce));
create table if not exists evidence(id text primary key,tenant text,seq bigint,event_type text,subject text,payload text,previous_hash text,entry_hash text,created_at text,unique(tenant,seq));
create table if not exists approvals(id text primary key,tenant text,envelope_id text,status text,actor text,reason text,created_at text,unique(envelope_id,actor));
create table if not exists artifacts(id text primary key,tenant text,name text,sha256 text,size bigint,recovery_class text,status text,path text,metadata text,created_at text);
create table if not exists adapters(name text primary key,kind text,capabilities text,endpoint text,enabled integer,metadata text,created_at text);
create table if not exists leases(id text primary key,tenant text,domain_id text,actor text,actions text,max_uses integer,uses integer,expires_at text,status text,created_at text);
create table if not exists events(id text primary key,tenant text,topic text,payload text,status text,attempts integer,created_at text,updated_at text);
create table if not exists cache(key text primary key,value text,expires_at double precision);
create table if not exists locks(key text primary key,owner text,expires_at double precision);
create table if not exists secrets(tenant text,name text,ciphertext text,primary key(tenant,name));
create table if not exists workflows(id text primary key,tenant text,name text,status text,state text,created_at text,updated_at text);
create table if not exists jobs(id text primary key,tenant text,kind text,payload text,status text,attempts integer,idempotency_key text,result text,created_at text,updated_at text,claimed_by text,lease_expires_at text,unique(tenant,idempotency_key));
create table if not exists constitutions(id text primary key,version integer unique,status text,body text,digest text,created_at text,activated_at text);
create table if not exists missions(id text primary key,tenant text,project text,title text,objective text,status text,risk text,plan text,constitution_id text,approval_id text,artifact_id text,deployment_id text,result text,created_at text,updated_at text);
create table if not exists mission_events(id text primary key,mission_id text,seq bigint,event_type text,payload text,created_at text,unique(mission_id,seq));
create table if not exists deployments(id text primary key,tenant text,mission_id text,artifact_id text,environment text,status text,release_dir text,health text,previous_deployment_id text,created_at text,updated_at text);
create table if not exists lessons(id text primary key,tenant text,mission_id text,kind text,statement text,evidence text,confidence double precision,status text,created_at text);
create table if not exists improvement_proposals(id text primary key,tenant text,title text,rationale text,patch_plan text,status text,constitution_check text,approval_id text,created_at text,updated_at text);
create table if not exists organization_members(id text primary key,tenant text,name text,kind text,roles text,status text,metadata text,created_at text,updated_at text);
create table if not exists capability_leases(id text primary key,tenant text,mission_id text,member_id text,capabilities text,budget_units integer,used_units integer,expires_at text,status text,created_at text,updated_at text);
create table if not exists agent_runs(id text primary key,tenant text,mission_id text,member_id text,role text,status text,input text,output text,cost_units integer,started_at text,completed_at text,error text);
create table if not exists deliberations(id text primary key,tenant text,mission_id text,status text,reports text,decision text,vetoes text,created_at text,updated_at text);
create table if not exists budgets(id text primary key,tenant text,project text,mission_id text,limit_units integer,used_units integer,status text,created_at text,updated_at text);
create table if not exists evaluations(id text primary key,tenant text,subject_type text,subject_id text,status text,spec text,results text,score double precision,passed integer,created_at text,completed_at text);
create table if not exists knowledge_claims(id text primary key,tenant text,statement text,status text,confidence double precision,evidence text,source text,created_at text,updated_at text);
create table if not exists connector_outbox(id text primary key,tenant text,connector text,event_type text,payload text,status text,attempts integer,next_attempt_at text,last_error text,created_at text,updated_at text,claimed_by text,lease_expires_at text,receipt text);
create table if not exists service_observations(id text primary key,tenant text,deployment_id text,metric text,value double precision,threshold double precision,status text,observed_at text);
create table if not exists evolution_candidates(id text primary key,tenant text,proposal_id text,status text,base_version text,target_version text,workspace text,manifest text,evaluation_id text,approval_id text,created_at text,updated_at text);
create table if not exists federation_messages(id text primary key,tenant text,peer_id text,direction text,message_type text,payload text,signature text,status text,created_at text);
create table if not exists constitution_amendments(id text primary key,tenant text,proposer text,rationale text,body text,digest text,status text,approval_actor text,approval_reason text,created_at text,updated_at text);
create table if not exists constitution_amendment_votes(amendment_id text,actor_id text,decision text,reason text,created_at text,primary key(amendment_id,actor_id));
create table if not exists worker_nodes(id text primary key,tenant text,kind text,status text,capabilities text,lease_expires_at text,last_heartbeat_at text,created_at text,updated_at text);
create table if not exists review_schedules(id text primary key,tenant text,name text,cadence_seconds integer,scope text,status text,next_run_at text,created_at text,updated_at text);
create table if not exists institutional_reviews(id text primary key,tenant text,schedule_id text,status text,findings text,lessons text,proposals text,started_at text,completed_at text);
create table if not exists monitor_targets(id text primary key,tenant text,deployment_id text,url text,interval_seconds integer,timeout_seconds integer,expected_status integer,latency_threshold_ms double precision,status text,next_probe_at text,last_probe_at text,last_result text,created_at text,updated_at text);

create index if not exists idx_events_topic_status on events(topic,status,created_at);
create index if not exists idx_jobs_tenant_status on jobs(tenant,status,created_at);
create index if not exists idx_jobs_lease on jobs(status,lease_expires_at,created_at);
create index if not exists idx_evidence_tenant_seq on evidence(tenant,seq);
create index if not exists idx_missions_tenant_status on missions(tenant,status,created_at);
create index if not exists idx_mission_events_mission_seq on mission_events(mission_id,seq);
create index if not exists idx_capability_leases_mission on capability_leases(tenant,mission_id,status);
create index if not exists idx_agent_runs_mission on agent_runs(tenant,mission_id,status);
create index if not exists idx_outbox_status on connector_outbox(connector,status,next_attempt_at);
create index if not exists idx_outbox_lease on connector_outbox(status,lease_expires_at,next_attempt_at);
create index if not exists idx_observations_deployment on service_observations(deployment_id,observed_at);
create index if not exists idx_reviews_due on review_schedules(status,next_run_at);
create index if not exists idx_monitors_due on monitor_targets(status,next_probe_at);

-- Service-owned runtime tables are never directly exposed to browser roles.
do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname='avrone_runtime' loop
    execute format('alter table avrone_runtime.%I enable row level security', r.tablename);
    execute format('drop policy if exists deny_client_access on avrone_runtime.%I', r.tablename);
    execute format('create policy deny_client_access on avrone_runtime.%I for all to anon, authenticated using (false) with check (false)', r.tablename);
  end loop;
end $$;
