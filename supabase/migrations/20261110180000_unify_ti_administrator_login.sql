begin;
create table public.ti_administrator_login (
  username text primary key check (username='administrador'),
  user_id uuid not null unique references public.ti_account_managers(user_id),
  updated_at timestamptz not null default now()
);
alter table public.ti_administrator_login enable row level security;
revoke all on public.ti_administrator_login from public,anon,authenticated;
grant all on public.ti_administrator_login to service_role;
notify pgrst,'reload schema';
commit;
