begin;
create table public.ti_account_managers (
  user_id uuid primary key references public.ti_members(user_id),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.ti_account_managers enable row level security;
revoke all on public.ti_account_managers from public,anon,authenticated;
grant all on public.ti_account_managers to service_role;
notify pgrst,'reload schema';
commit;
