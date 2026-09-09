alter table if exists public.admin_users
  drop constraint if exists admin_users_role_check;

alter table if exists public.admin_users
  add constraint admin_users_role_check
  check (
    role in (
      'admin',
      'seguranca',
      'diretoria',
      'tecnico',
      'coordenador',
      'investigador',
      'investigator'
    )
  );

grant select, insert, update, delete on table public.admin_users to anon, authenticated;
