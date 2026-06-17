alter table if exists public.environmental_inspections
  add column if not exists gestor text null;

alter table if exists public.environmental_inspections
  add column if not exists assinatura_gestor text null;
