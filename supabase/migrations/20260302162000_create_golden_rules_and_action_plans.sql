create sequence if not exists public.golden_rule_number_seq
  as bigint
  increment by 1
  minvalue 1
  start with 1;

create table if not exists public.golden_rules (
  id uuid primary key default gen_random_uuid(),
  numero_inspecao bigint not null default nextval('public.golden_rule_number_seq'),
  titulo text not null,
  setor text not null,
  gestor text not null,
  tecnico_seg text not null,
  acompanhante text not null,
  ass_tst text null,
  ass_gestor text null,
  ass_acomp text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint golden_rules_numero_inspecao_key unique (numero_inspecao)
);

create table if not exists public.golden_rule_responses (
  id uuid primary key default gen_random_uuid(),
  regra_id uuid not null references public.golden_rules(id) on delete cascade,
  codigo text not null,
  numero text not null,
  pergunta text not null,
  resposta text not null check (resposta in ('Sim', 'Não', 'Nao')),
  comentario text null,
  foto_name text null,
  foto_size bigint null,
  foto_type text null,
  foto_data_url text null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.golden_rule_attachments (
  id uuid primary key default gen_random_uuid(),
  regra_id uuid not null references public.golden_rules(id) on delete cascade,
  file_name text not null,
  file_size bigint not null default 0,
  file_type text null,
  file_data_url text null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_golden_rule_responses_regra_id
  on public.golden_rule_responses (regra_id);

create index if not exists idx_golden_rule_attachments_regra_id
  on public.golden_rule_attachments (regra_id);

create sequence if not exists public.accident_action_plan_number_seq
  as bigint
  increment by 1
  minvalue 1
  start with 1;

create table if not exists public.accident_action_plans (
  id uuid primary key default gen_random_uuid(),
  numero_plano bigint not null default nextval('public.accident_action_plan_number_seq'),
  numero_ocorrencia bigint not null,
  data_ocorrencia date null,
  prioridade_ocorrencia text null,
  descricao_ocorrencia text null,
  origem text not null default 'Acidente',
  descricao_resumida_acao text not null,
  severidade text null,
  probabilidade text null,
  prioridade text not null default 'Baixa',
  status text not null default 'Aberta',
  responsavel_execucao text not null,
  inicio_planejado date null,
  termino_planejado date null,
  acao_iniciada date null,
  acao_finalizada date null,
  descricao_acao text not null,
  observacoes_conclusao text null,
  data_eficacia date null,
  observacao_eficacia text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint accident_action_plans_numero_plano_key unique (numero_plano)
);

create table if not exists public.accident_action_plan_comments (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.accident_action_plans(id) on delete cascade,
  texto text not null,
  autor text not null default 'Sistema',
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_accident_action_plans_numero_ocorrencia
  on public.accident_action_plans (numero_ocorrencia);

create index if not exists idx_accident_action_plans_created_at
  on public.accident_action_plans (created_at desc);

create index if not exists idx_accident_action_plan_comments_plan_id
  on public.accident_action_plan_comments (plan_id);

create or replace function public.set_golden_rules_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_golden_rules_updated_at on public.golden_rules;
create trigger set_golden_rules_updated_at
before update on public.golden_rules
for each row
execute procedure public.set_golden_rules_updated_at();

create or replace function public.set_accident_action_plans_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_accident_action_plans_updated_at on public.accident_action_plans;
create trigger set_accident_action_plans_updated_at
before update on public.accident_action_plans
for each row
execute procedure public.set_accident_action_plans_updated_at();

alter table if exists public.golden_rules enable row level security;
alter table if exists public.golden_rule_responses enable row level security;
alter table if exists public.golden_rule_attachments enable row level security;
alter table if exists public.accident_action_plans enable row level security;
alter table if exists public.accident_action_plan_comments enable row level security;

drop policy if exists "Anon select golden rules" on public.golden_rules;
create policy "Anon select golden rules"
on public.golden_rules
for select
using (true);

drop policy if exists "Anon insert golden rules" on public.golden_rules;
create policy "Anon insert golden rules"
on public.golden_rules
for insert
with check (true);

drop policy if exists "Anon update golden rules" on public.golden_rules;
create policy "Anon update golden rules"
on public.golden_rules
for update
using (true)
with check (true);

drop policy if exists "Anon delete golden rules" on public.golden_rules;
create policy "Anon delete golden rules"
on public.golden_rules
for delete
using (true);

drop policy if exists "Anon select golden rule responses" on public.golden_rule_responses;
create policy "Anon select golden rule responses"
on public.golden_rule_responses
for select
using (true);

drop policy if exists "Anon insert golden rule responses" on public.golden_rule_responses;
create policy "Anon insert golden rule responses"
on public.golden_rule_responses
for insert
with check (true);

drop policy if exists "Anon update golden rule responses" on public.golden_rule_responses;
create policy "Anon update golden rule responses"
on public.golden_rule_responses
for update
using (true)
with check (true);

drop policy if exists "Anon delete golden rule responses" on public.golden_rule_responses;
create policy "Anon delete golden rule responses"
on public.golden_rule_responses
for delete
using (true);

drop policy if exists "Anon select golden rule attachments" on public.golden_rule_attachments;
create policy "Anon select golden rule attachments"
on public.golden_rule_attachments
for select
using (true);

drop policy if exists "Anon insert golden rule attachments" on public.golden_rule_attachments;
create policy "Anon insert golden rule attachments"
on public.golden_rule_attachments
for insert
with check (true);

drop policy if exists "Anon update golden rule attachments" on public.golden_rule_attachments;
create policy "Anon update golden rule attachments"
on public.golden_rule_attachments
for update
using (true)
with check (true);

drop policy if exists "Anon delete golden rule attachments" on public.golden_rule_attachments;
create policy "Anon delete golden rule attachments"
on public.golden_rule_attachments
for delete
using (true);

drop policy if exists "Anon select accident action plans" on public.accident_action_plans;
create policy "Anon select accident action plans"
on public.accident_action_plans
for select
using (true);

drop policy if exists "Anon insert accident action plans" on public.accident_action_plans;
create policy "Anon insert accident action plans"
on public.accident_action_plans
for insert
with check (true);

drop policy if exists "Anon update accident action plans" on public.accident_action_plans;
create policy "Anon update accident action plans"
on public.accident_action_plans
for update
using (true)
with check (true);

drop policy if exists "Anon delete accident action plans" on public.accident_action_plans;
create policy "Anon delete accident action plans"
on public.accident_action_plans
for delete
using (true);

drop policy if exists "Anon select accident action plan comments" on public.accident_action_plan_comments;
create policy "Anon select accident action plan comments"
on public.accident_action_plan_comments
for select
using (true);

drop policy if exists "Anon insert accident action plan comments" on public.accident_action_plan_comments;
create policy "Anon insert accident action plan comments"
on public.accident_action_plan_comments
for insert
with check (true);

drop policy if exists "Anon update accident action plan comments" on public.accident_action_plan_comments;
create policy "Anon update accident action plan comments"
on public.accident_action_plan_comments
for update
using (true)
with check (true);

drop policy if exists "Anon delete accident action plan comments" on public.accident_action_plan_comments;
create policy "Anon delete accident action plan comments"
on public.accident_action_plan_comments
for delete
using (true);


