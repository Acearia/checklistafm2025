-- Corrige grupos já existentes de Transpaleteira para usar apenas
-- as perguntas corretas e com regras de alerta consistentes.

WITH target_groups AS (
  SELECT id
  FROM public.checklist_groups
  WHERE trim(coalesce(equipment_type, '')) = '7'
     OR lower(trim(name)) = lower('Transpaleteira')
)
DELETE FROM public.group_questions
WHERE group_id IN (SELECT id FROM target_groups);

WITH target_groups AS (
  SELECT id
  FROM public.checklist_groups
  WHERE trim(coalesce(equipment_type, '')) = '7'
     OR lower(trim(name)) = lower('Transpaleteira')
)
INSERT INTO public.group_questions (group_id, question, alert_on_yes, alert_on_no, order_number)
SELECT
  tg.id,
  q.question,
  q.alert_on_yes,
  q.alert_on_no,
  q.order_number
FROM target_groups tg
CROSS JOIN (
  VALUES
    ('Estou apto a operar?', false, true, 1),
    ('Garfos ok?', false, true, 2),
    ('Painel geral ok?', false, true, 3),
    ('Possui vazamentos?', true, false, 4),
    ('Rodas de carga ok?', false, true, 5),
    ('Roda de tração ok?', false, true, 6),
    ('Bateria ok?', false, true, 7),
    ('Conector e cabos ok?', false, true, 8),
    ('Sinais sonoros ok?', false, true, 9),
    ('Sistema hidráulico ok?', false, true, 10),
    ('Timão ok?', false, true, 11),
    ('Botão antiesmagamento ok?', false, true, 12),
    ('Existem ruídos?', true, false, 13),
    ('Limpeza ok?', false, true, 14),
    ('Aparência geral ok?', false, true, 15)
) AS q(question, alert_on_yes, alert_on_no, order_number);
