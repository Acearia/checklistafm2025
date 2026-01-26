-- Grupos de checklist e mapeamentos
create table if not exists public.checklist_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_at timestamp with time zone default now()
);

create table if not exists public.group_questions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.checklist_groups(id) on delete cascade,
  question text not null,
  alert_on_yes boolean default false,
  alert_on_no boolean default false,
  order_number integer default 0,
  created_at timestamp with time zone default now()
);

create table if not exists public.group_procedures (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.checklist_groups(id) on delete cascade,
  title text not null,
  description text,
  procedure_type text,
  order_number integer default 0,
  created_at timestamp with time zone default now()
);

create table if not exists public.equipment_groups (
  equipment_id text not null,
  group_id uuid not null references public.checklist_groups(id) on delete cascade,
  created_at timestamp with time zone default now(),
  primary key (equipment_id, group_id)
);

-- RLS aberto como demais tabelas (ajuste conforme segurança desejada)
alter table public.checklist_groups enable row level security;
alter table public.group_questions enable row level security;
alter table public.group_procedures enable row level security;
alter table public.equipment_groups enable row level security;

create policy "Anyone can view checklist_groups" on public.checklist_groups for select using (true);
create policy "Anyone can insert checklist_groups" on public.checklist_groups for insert with check (true);
create policy "Anyone can update checklist_groups" on public.checklist_groups for update using (true);
create policy "Anyone can delete checklist_groups" on public.checklist_groups for delete using (true);

create policy "Anyone can view group_questions" on public.group_questions for select using (true);
create policy "Anyone can insert group_questions" on public.group_questions for insert with check (true);
create policy "Anyone can update group_questions" on public.group_questions for update using (true);
create policy "Anyone can delete group_questions" on public.group_questions for delete using (true);

create policy "Anyone can view group_procedures" on public.group_procedures for select using (true);
create policy "Anyone can insert group_procedures" on public.group_procedures for insert with check (true);
create policy "Anyone can update group_procedures" on public.group_procedures for update using (true);
create policy "Anyone can delete group_procedures" on public.group_procedures for delete using (true);

create policy "Anyone can view equipment_groups" on public.equipment_groups for select using (true);
create policy "Anyone can insert equipment_groups" on public.equipment_groups for insert with check (true);
create policy "Anyone can update equipment_groups" on public.equipment_groups for update using (true);
create policy "Anyone can delete equipment_groups" on public.equipment_groups for delete using (true);

-- Grupos iniciais
insert into public.checklist_groups (name, description)
values ('Ponte', 'Checklist padrão para Pontes'),
       ('Talha', 'Checklist padrão para Talhas'),
       ('Pórtico', 'Checklist padrão para Pórticos')
on conflict (name) do nothing;
