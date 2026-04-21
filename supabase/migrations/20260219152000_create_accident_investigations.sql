create sequence if not exists public.accident_investigation_number_seq
  as bigint
  increment by 1
  minvalue 0
  start with 0;

create table if not exists public.accident_investigations (
  id uuid primary key default gen_random_uuid(),
  numero_ocorrencia bigint not null default nextval('public.accident_investigation_number_seq'),
  titulo text not null,
  data_ocorrencia date not null,
  hora time not null,
  turno text not null check (turno in ('1o', '2o', '3o', 'Geral')),
  nome_acidentado text not null,
  matricula_acidentado text null,
  cargo text not null,
  setor text not null,
  tempo_empresa text not null,
  tempo_funcao text not null,
  natureza_ocorrencia text not null check (natureza_ocorrencia in ('Incidente', 'Acidente')),
  mao_de_obra text not null check (mao_de_obra in ('Direta', 'Indireta')),
  tipo_acidente text not null check (tipo_acidente in ('Tipico', 'Trajeto', 'Terceiros', 'Danos Morais', 'Ambiental')),
  teve_afastamento boolean not null default false,
  dias_afastamento integer null check (dias_afastamento is null or dias_afastamento >= 0),
  gravidade text not null check (gravidade in ('Minima', 'Mediana', 'Consideravel', 'Critica')),
  probabilidade text not null check (probabilidade in ('Improvavel', 'Pouco Provavel', 'Provavel', 'Altamente Provavel')),
  parte_corpo_atingida text not null,
  causa_raiz text not null,
  agente_causador text not null,
  causa_acidente text not null,
  descricao_detalhada text not null,
  observacoes text not null,
  investigador text not null,
  whatsapp_resumo text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint accident_investigations_numero_ocorrencia_key unique (numero_ocorrencia)
);

create index if not exists idx_accident_investigations_created_at
  on public.accident_investigations (created_at desc);

create index if not exists idx_accident_investigations_data_ocorrencia
  on public.accident_investigations (data_ocorrencia desc);

create table if not exists public.accident_investigation_attachments (
  id uuid primary key default gen_random_uuid(),
  investigation_id uuid not null references public.accident_investigations(id) on delete cascade,
  file_name text not null,
  file_size bigint not null default 0,
  file_type text null,
  storage_path text null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_accident_investigation_attachments_investigation_id
  on public.accident_investigation_attachments (investigation_id);

create or replace function public.set_accident_investigations_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_accident_investigations_updated_at on public.accident_investigations;

create trigger set_accident_investigations_updated_at
before update on public.accident_investigations
for each row
execute procedure public.set_accident_investigations_updated_at();

alter table if exists public.accident_investigations enable row level security;
alter table if exists public.accident_investigation_attachments enable row level security;

drop policy if exists "Anon select accident investigations" on public.accident_investigations;
create policy "Anon select accident investigations"
on public.accident_investigations
for select
using (true);

drop policy if exists "Anon insert accident investigations" on public.accident_investigations;
create policy "Anon insert accident investigations"
on public.accident_investigations
for insert
with check (true);

drop policy if exists "Anon update accident investigations" on public.accident_investigations;
create policy "Anon update accident investigations"
on public.accident_investigations
for update
using (true)
with check (true);

drop policy if exists "Anon delete accident investigations" on public.accident_investigations;
create policy "Anon delete accident investigations"
on public.accident_investigations
for delete
using (true);

drop policy if exists "Anon select accident investigation attachments" on public.accident_investigation_attachments;
create policy "Anon select accident investigation attachments"
on public.accident_investigation_attachments
for select
using (true);

drop policy if exists "Anon insert accident investigation attachments" on public.accident_investigation_attachments;
create policy "Anon insert accident investigation attachments"
on public.accident_investigation_attachments
for insert
with check (true);

drop policy if exists "Anon update accident investigation attachments" on public.accident_investigation_attachments;
create policy "Anon update accident investigation attachments"
on public.accident_investigation_attachments
for update
using (true)
with check (true);

drop policy if exists "Anon delete accident investigation attachments" on public.accident_investigation_attachments;
create policy "Anon delete accident investigation attachments"
on public.accident_investigation_attachments
for delete
using (true);
