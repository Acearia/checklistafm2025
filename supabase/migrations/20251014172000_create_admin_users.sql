create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,
  role text not null check (role in ('admin', 'seguranca')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.set_admin_users_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_admin_users_updated_at on public.admin_users;

create trigger set_admin_users_updated_at
before update on public.admin_users
for each row
execute procedure public.set_admin_users_updated_at();

insert into public.admin_users (username, password_hash, role)
values
  ('admin', encode('admin123'::bytea, 'base64'), 'admin'),
  ('seguranca', encode('seguranca123'::bytea, 'base64'), 'seguranca')
on conflict (username) do nothing;
