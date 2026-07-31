create table if not exists public.control12_fabric_events (
  tenant_id text not null,
  seq bigint generated always as identity,
  event_hash text not null unique,
  prev_hash text,
  event_type text not null,
  actor text not null,
  payload jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null default now(),
  primary key (tenant_id, seq)
);
create table if not exists public.control12_fabric_workflows (
  tenant_id text not null,
  workflow_id text not null,
  status text not null,
  definition jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, workflow_id)
);
alter table public.control12_fabric_events enable row level security;
alter table public.control12_fabric_workflows enable row level security;
create policy "fabric events tenant access" on public.control12_fabric_events for all using (tenant_id = coalesce(auth.jwt()->>'tenant_id','')) with check (tenant_id = coalesce(auth.jwt()->>'tenant_id',''));
create policy "fabric workflows tenant access" on public.control12_fabric_workflows for all using (tenant_id = coalesce(auth.jwt()->>'tenant_id','')) with check (tenant_id = coalesce(auth.jwt()->>'tenant_id',''));
create index if not exists control12_fabric_events_tenant_time_idx on public.control12_fabric_events (tenant_id, observed_at desc);
create index if not exists control12_fabric_workflows_status_idx on public.control12_fabric_workflows (tenant_id, status, updated_at desc);
