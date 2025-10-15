alter table if exists public.admin_users enable row level security;

drop policy if exists "Anon select admin_users" on public.admin_users;
create policy "Anon select admin_users"
on public.admin_users
for select
using (true);

drop policy if exists "Anon insert admin_users" on public.admin_users;
create policy "Anon insert admin_users"
on public.admin_users
for insert
with check (true);

drop policy if exists "Anon update admin_users" on public.admin_users;
create policy "Anon update admin_users"
on public.admin_users
for update
using (true)
with check (true);
