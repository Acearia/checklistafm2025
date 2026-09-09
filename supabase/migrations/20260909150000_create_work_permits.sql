create sequence if not exists public.work_permits_number_seq start with 1;

create table if not exists public.work_permits (
  id uuid primary key default gen_random_uuid(),
  numero_permissao bigint not null default nextval('public.work_permits_number_seq') unique,
  empresa text not null,
  setor text not null,
  data_permissao date not null,
  hora_permissao time not null,
  descricao_servico text not null,
  tipos_servico jsonb not null default '[]'::jsonb,
  detalhes_tipo jsonb not null default '{}'::jsonb,
  riscos jsonb not null default '[]'::jsonb,
  riscos_outros text,
  medidas_controle jsonb not null default '[]'::jsonb,
  medidas_outros text,
  procedimento_auxiliar text,
  respostas jsonb not null default '{}'::jsonb,
  detalhes_respostas jsonb not null default '{}'::jsonb,
  executores jsonb not null default '[]'::jsonb,
  emissor_nome text not null,
  emissor_assinatura text,
  emissor_data date,
  emissor_hora time,
  verificador_nome text not null,
  verificador_assinatura text,
  verificador_data date,
  verificador_hora time,
  status text not null default 'Aberta',
  encerramento_emissor jsonb not null default '{}'::jsonb,
  encerramento_executor jsonb not null default '{}'::jsonb,
  observacoes_emissor text,
  observacoes_verificador text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_work_permits_created_at on public.work_permits (created_at desc);
create index if not exists idx_work_permits_setor on public.work_permits (setor);
create index if not exists idx_work_permits_status on public.work_permits (status);

alter table public.work_permits enable row level security;

drop policy if exists "Anon select work permits" on public.work_permits;
create policy "Anon select work permits" on public.work_permits for select to anon using (true);
drop policy if exists "Anon insert work permits" on public.work_permits;
create policy "Anon insert work permits" on public.work_permits for insert to anon with check (true);
drop policy if exists "Anon update work permits" on public.work_permits;
create policy "Anon update work permits" on public.work_permits for update to anon using (true) with check (true);
drop policy if exists "Anon delete work permits" on public.work_permits;
create policy "Anon delete work permits" on public.work_permits for delete to anon using (true);

grant select, insert, update, delete on public.work_permits to anon, authenticated, service_role;
grant usage, select on sequence public.work_permits_number_seq to anon, authenticated, service_role;

create or replace function public.set_work_permits_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_work_permits_updated_at on public.work_permits;
create trigger set_work_permits_updated_at
before update on public.work_permits
for each row execute procedure public.set_work_permits_updated_at();
