create sequence if not exists public.environmental_inspection_number_seq
  as bigint
  increment by 1
  minvalue 1
  start with 1;

create table if not exists public.environmental_inspections (
  id uuid primary key default gen_random_uuid(),
  numero_inspecao bigint not null default nextval('public.environmental_inspection_number_seq'),
  realizado_por text not null,
  data_inspecao date not null,
  acompanhado_por text null,
  setor text not null,
  observacoes text null,
  assinatura text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint environmental_inspections_numero_inspecao_key unique (numero_inspecao)
);

create table if not exists public.environmental_inspection_responses (
  id uuid primary key default gen_random_uuid(),
  environmental_inspection_id uuid not null references public.environmental_inspections(id) on delete cascade,
  codigo text not null,
  numero text not null,
  secao text not null,
  pergunta text not null,
  resposta text not null check (resposta in ('Sim', 'Não', 'Nao', 'N/A')),
  resposta_esperada text not null check (resposta_esperada in ('Sim', 'Não', 'Nao')),
  irregular boolean not null default false,
  comentario text null,
  foto_name text null,
  foto_size bigint null,
  foto_type text null,
  foto_data_url text null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_environmental_inspections_created_at
  on public.environmental_inspections (created_at desc);

create index if not exists idx_environmental_inspections_setor
  on public.environmental_inspections (setor);

create index if not exists idx_environmental_inspection_responses_inspection_id
  on public.environmental_inspection_responses (environmental_inspection_id, numero);

create or replace function public.set_environmental_inspections_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_environmental_inspections_updated_at on public.environmental_inspections;
create trigger set_environmental_inspections_updated_at
before update on public.environmental_inspections
for each row
execute procedure public.set_environmental_inspections_updated_at();

alter table if exists public.environmental_inspections enable row level security;
alter table if exists public.environmental_inspection_responses enable row level security;

drop policy if exists "Anon select environmental inspections" on public.environmental_inspections;
create policy "Anon select environmental inspections"
on public.environmental_inspections
for select
using (true);

drop policy if exists "Anon insert environmental inspections" on public.environmental_inspections;
create policy "Anon insert environmental inspections"
on public.environmental_inspections
for insert
with check (true);

drop policy if exists "Anon update environmental inspections" on public.environmental_inspections;
create policy "Anon update environmental inspections"
on public.environmental_inspections
for update
using (true)
with check (true);

drop policy if exists "Anon delete environmental inspections" on public.environmental_inspections;
create policy "Anon delete environmental inspections"
on public.environmental_inspections
for delete
using (true);

drop policy if exists "Anon select environmental inspection responses" on public.environmental_inspection_responses;
create policy "Anon select environmental inspection responses"
on public.environmental_inspection_responses
for select
using (true);

drop policy if exists "Anon insert environmental inspection responses" on public.environmental_inspection_responses;
create policy "Anon insert environmental inspection responses"
on public.environmental_inspection_responses
for insert
with check (true);

drop policy if exists "Anon update environmental inspection responses" on public.environmental_inspection_responses;
create policy "Anon update environmental inspection responses"
on public.environmental_inspection_responses
for update
using (true)
with check (true);

drop policy if exists "Anon delete environmental inspection responses" on public.environmental_inspection_responses;
create policy "Anon delete environmental inspection responses"
on public.environmental_inspection_responses
for delete
using (true);
