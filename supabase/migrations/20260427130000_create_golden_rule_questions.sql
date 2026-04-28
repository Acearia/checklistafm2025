create table if not exists public.golden_rule_questions (
  id text primary key default gen_random_uuid()::text,
  question text not null,
  alert_on_yes boolean not null default false,
  alert_on_no boolean not null default false,
  order_number integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists update_golden_rule_questions_updated_at on public.golden_rule_questions;
create trigger update_golden_rule_questions_updated_at
before update on public.golden_rule_questions
for each row
execute procedure public.update_updated_at_column();

alter table if exists public.golden_rule_questions enable row level security;

drop policy if exists "Anon select golden rule questions" on public.golden_rule_questions;
create policy "Anon select golden rule questions"
on public.golden_rule_questions
for select
using (true);

drop policy if exists "Anon insert golden rule questions" on public.golden_rule_questions;
create policy "Anon insert golden rule questions"
on public.golden_rule_questions
for insert
with check (true);

drop policy if exists "Anon update golden rule questions" on public.golden_rule_questions;
create policy "Anon update golden rule questions"
on public.golden_rule_questions
for update
using (true)
with check (true);

drop policy if exists "Anon delete golden rule questions" on public.golden_rule_questions;
create policy "Anon delete golden rule questions"
on public.golden_rule_questions
for delete
using (true);
