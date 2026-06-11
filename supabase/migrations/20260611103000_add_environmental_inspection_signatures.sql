alter table if exists public.environmental_inspections
  add column if not exists assinatura_realizado_por text null;

alter table if exists public.environmental_inspections
  add column if not exists assinatura_acompanhante text null;

update public.environmental_inspections
set assinatura_realizado_por = assinatura
where assinatura_realizado_por is null
  and assinatura is not null;
