alter table if exists public.checklist_groups
  add column if not exists equipment_type text null;

update public.checklist_groups
set equipment_type = '1'
where lower(name) = lower('Ponte');

update public.checklist_groups
set equipment_type = '2'
where lower(name) = lower('Talha');

update public.checklist_groups
set equipment_type = '3'
where lower(name) in (lower('Pórtico'), lower('Portico'));

insert into public.checklist_groups (name, description, equipment_type)
select 'Empilhadeira', 'Checklist padrão para empilhadeiras', '5'
where not exists (
  select 1 from public.checklist_groups where lower(name) = lower('Empilhadeira')
);

update public.checklist_groups
set equipment_type = '5'
where lower(name) = lower('Empilhadeira');

update public.checklist_groups
set name = 'Bobcat / Mini Carregadeira',
    description = coalesce(nullif(description, ''), 'Checklist padrão para mini carregadeira Bobcat'),
    equipment_type = '6'
where lower(name) in (
  lower('Empilhadeira - Bobcat'),
  lower('Bobcat / Mini Carregadeira')
);

insert into public.checklist_groups (name, description, equipment_type)
select 'Bobcat / Mini Carregadeira', 'Checklist padrão para mini carregadeira Bobcat', '6'
where not exists (
  select 1 from public.checklist_groups where lower(name) = lower('Bobcat / Mini Carregadeira')
);

insert into public.checklist_groups (name, description, equipment_type)
select 'Transpaleteira', 'Checklist padrão para transpaleteiras', '7'
where not exists (
  select 1 from public.checklist_groups where lower(name) = lower('Transpaleteira')
);

update public.checklist_groups
set equipment_type = '7'
where lower(name) = lower('Transpaleteira');
