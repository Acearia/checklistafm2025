alter table if exists public.admin_users
  add column if not exists display_name text null;

alter table if exists public.admin_users
  add column if not exists cargo text null;

alter table if exists public.admin_users
  add column if not exists setor text null;

alter table if exists public.admin_users
  add column if not exists email text null;

update public.admin_users
set display_name = username
where display_name is null;
