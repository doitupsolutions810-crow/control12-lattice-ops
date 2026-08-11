drop policy if exists "tenant members read components" on public.control12_components;
drop policy if exists "tenant members write components" on public.control12_components;

create policy "tenant members access components" on public.control12_components
for all
using (tenant_id = public.control12_current_tenant_id())
with check (tenant_id = public.control12_current_tenant_id());
