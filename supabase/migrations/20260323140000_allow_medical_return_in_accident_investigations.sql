alter table if exists public.accident_investigations
  drop constraint if exists accident_investigations_natureza_ocorrencia_check;

alter table if exists public.accident_investigations
  add constraint accident_investigations_natureza_ocorrencia_check
  check (natureza_ocorrencia in ('Incidente', 'Acidente', 'Aguardando retorno medico'));
