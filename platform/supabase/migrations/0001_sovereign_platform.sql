create extension if not exists pgcrypto;

create table if not exists public.control12_tenants (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug ~ '^[a-z0-9-]{3,64}$'),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.control12_components (
  tenant_id uuid not null references public.control12_tenants(id) on delete cascade,
  component_id text not null,
  version text not null,
  kind text not null check (kind in ('agent','plugin','service','artifact','policy')),
  digest text not null check (digest ~ '^[a-f0-9]{64}$'),
  capabilities text[] not null default '{}',
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  primary key (tenant_id, component_id)
);

create table if not exists public.control12_workflows (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.control12_tenants(id) on delete cascade,
  name text not null,
  status text not null check (status in ('queued','running','completed','failed','cancelled')),
  definition jsonb not null,
  results jsonb not null default '[]',
  error text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create table if not exists public.control12_events (
  sequence bigint generated always as identity primary key,
  tenant_id uuid not null references public.control12_tenants(id) on delete cascade,
  event_id uuid not null default gen_random_uuid(),
  topic text not null,
  payload jsonb not null,
  metadata jsonb not null default '{}',
  digest text not null check (digest ~ '^[a-f0-9]{64}$'),
  observed_at timestamptz not null default now(),
  unique (tenant_id, event_id)
);

create table if not exists public.control12_graph_nodes (
  tenant_id uuid not null references public.control12_tenants(id) on delete cascade,
  node_id text not null,
  node_type text not null,
  attributes jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (tenant_id, node_id)
);

create table if not exists public.control12_graph_edges (
  tenant_id uuid not null references public.control12_tenants(id) on delete cascade,
  edge_key text not null,
  source_node text not null,
  relation text not null,
  target_node text not null,
  attributes jsonb not null default '{}',
  observed_at timestamptz not null default now(),
  primary key (tenant_id, edge_key),
  foreign key (tenant_id, source_node) references public.control12_graph_nodes(tenant_id, node_id) on delete cascade,
  foreign key (tenant_id, target_node) references public.control12_graph_nodes(tenant_id, node_id) on delete cascade
);

create index if not exists control12_events_tenant_observed_idx on public.control12_events (tenant_id, observed_at desc);
create index if not exists control12_workflows_tenant_status_idx on public.control12_workflows (tenant_id, status, created_at desc);
create index if not exists control12_graph_edges_source_idx on public.control12_graph_edges (tenant_id, source_node);
create index if not exists control12_graph_edges_target_idx on public.control12_graph_edges (tenant_id, target_node);

alter table public.control12_tenants enable row level security;
alter table public.control12_components enable row level security;
alter table public.control12_workflows enable row level security;
alter table public.control12_events enable row level security;
alter table public.control12_graph_nodes enable row level security;
alter table public.control12_graph_edges enable row level security;

create or replace function public.control12_current_tenant_id()
returns uuid
language sql
stable
security invoker
set search_path = public
as $$
  select nullif(auth.jwt() ->> 'tenant_id', '')::uuid
$$;

create policy "tenant members read tenant" on public.control12_tenants
for select using (id = public.control12_current_tenant_id());
create policy "tenant members read components" on public.control12_components
for select using (tenant_id = public.control12_current_tenant_id());
create policy "tenant members write components" on public.control12_components
for all using (tenant_id = public.control12_current_tenant_id()) with check (tenant_id = public.control12_current_tenant_id());
create policy "tenant members access workflows" on public.control12_workflows
for all using (tenant_id = public.control12_current_tenant_id()) with check (tenant_id = public.control12_current_tenant_id());
create policy "tenant members read events" on public.control12_events
for select using (tenant_id = public.control12_current_tenant_id());
create policy "tenant members insert events" on public.control12_events
for insert with check (tenant_id = public.control12_current_tenant_id());
create policy "tenant members access graph nodes" on public.control12_graph_nodes
for all using (tenant_id = public.control12_current_tenant_id()) with check (tenant_id = public.control12_current_tenant_id());
create policy "tenant members access graph edges" on public.control12_graph_edges
for all using (tenant_id = public.control12_current_tenant_id()) with check (tenant_id = public.control12_current_tenant_id());
