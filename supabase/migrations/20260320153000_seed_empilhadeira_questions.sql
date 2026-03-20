-- Seed para perguntas do checklist de Empilhadeira
-- No campo alert_on_no true, pois se a resposta for NÃO gera alerta

WITH empilhadeira AS (
  SELECT id
  FROM public.checklist_groups
  WHERE lower(name) LIKE '%empilhadeira%'
  LIMIT 1
)
INSERT INTO public.group_questions (group_id, question, alert_on_yes, alert_on_no, order_number)
SELECT
  e.id,
  q.question,
  false AS alert_on_yes,
  true AS alert_on_no,
  q.order_number
FROM empilhadeira e
CROSS JOIN (VALUES
  ('Estou apto a operar?', 1),
  ('Painel geral ok?', 2),
  ('Torre ok?', 3),
  ('Mangueiras ok?', 4),
  ('Sistema hidráulico ok?', 5),
  ('Cinto segurança ok?', 6),
  ('Faróis ok?', 7),
  ('Blue spot/Redzone ok?', 8),
  ('Possui vazamentos?', 9),
  ('Garfos ok?', 10),
  ('Pneus ok?', 11),
  ('Sinais sonoros ok?', 12),
  ('Freio estacionário ok?', 13),
  ('Freio de serviço ok?', 14),
  ('Aparência geral ok?', 15),
  ('Extintor incêndio ok?', 16),
  ('Direção pesada?', 17),
  ('Existem ruídos?', 18),
  ('Retrovisores ok?', 19)
) AS q(question, order_number)
WHERE NOT EXISTS (
  SELECT 1 FROM public.group_questions gq
  WHERE gq.group_id = e.id
    AND lower(gq.question) = lower(q.question)
);
