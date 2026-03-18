create table if not exists public.golden_rule_response_evidences (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references public.golden_rule_responses(id) on delete cascade,
  order_index integer not null default 0,
  comentario text null,
  foto_name text null,
  foto_size bigint null,
  foto_type text null,
  foto_data_url text null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_golden_rule_response_evidences_response_id
  on public.golden_rule_response_evidences (response_id, order_index);

alter table if exists public.golden_rule_response_evidences enable row level security;

drop policy if exists "Anon select golden rule response evidences" on public.golden_rule_response_evidences;
create policy "Anon select golden rule response evidences"
on public.golden_rule_response_evidences
for select
using (true);

drop policy if exists "Anon insert golden rule response evidences" on public.golden_rule_response_evidences;
create policy "Anon insert golden rule response evidences"
on public.golden_rule_response_evidences
for insert
with check (true);

drop policy if exists "Anon update golden rule response evidences" on public.golden_rule_response_evidences;
create policy "Anon update golden rule response evidences"
on public.golden_rule_response_evidences
for update
using (true)
with check (true);

drop policy if exists "Anon delete golden rule response evidences" on public.golden_rule_response_evidences;
create policy "Anon delete golden rule response evidences"
on public.golden_rule_response_evidences
for delete
using (true);
