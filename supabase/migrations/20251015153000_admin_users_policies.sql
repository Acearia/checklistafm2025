alter table if exists public.admin_users enable row level security;

create policy if not exists "Anon select admin_users"
on public.admin_users
for select
using (true);

create policy if not exists "Anon insert admin_users"
on public.admin_users
for insert
with check (true);

create policy if not exists "Anon update admin_users"
on public.admin_users
for update
using (true)
with check (true);
