alter table if exists public.golden_rule_responses
  drop constraint if exists golden_rule_responses_resposta_check;

alter table if exists public.golden_rule_responses
  add constraint golden_rule_responses_resposta_check
  check (resposta in ('Sim', 'Não', 'Nao', 'N/A', 'Não se aplica', 'Nao se aplica'));
