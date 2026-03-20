-- Seed para perguntas dos checklists de Empilhadeira e Transpaleteira.
-- Usa regras explícitas por pergunta para manter o mesmo comportamento
-- no banco e no fallback do frontend.

WITH target_groups AS (
  SELECT
    id,
    CASE
      WHEN trim(coalesce(equipment_type, '')) = '7' OR lower(trim(name)) = lower('Transpaleteira') THEN '7'
      ELSE '5'
    END AS equipment_type
  FROM public.checklist_groups
  WHERE trim(coalesce(equipment_type, '')) IN ('5', '7')
     OR lower(trim(name)) IN (lower('Empilhadeira'), lower('Transpaleteira'))
),
question_templates AS (
  SELECT * FROM (
    VALUES
      ('5', 'Estou apto a operar?', false, true, 1),
      ('5', 'Painel geral ok?', false, true, 2),
      ('5', 'Torre ok?', false, true, 3),
      ('5', 'Mangueiras ok?', false, true, 4),
      ('5', 'Sistema hidráulico ok?', false, true, 5),
      ('5', 'Cinto segurança ok?', false, true, 6),
      ('5', 'Faróis ok?', false, true, 7),
      ('5', 'Blue spot/Redzone ok?', false, true, 8),
      ('5', 'Possui vazamentos?', true, false, 9),
      ('5', 'Garfos ok?', false, true, 10),
      ('5', 'Pneus ok?', false, true, 11),
      ('5', 'Sinais sonoros ok?', false, true, 12),
      ('5', 'Freio estacionário ok?', false, true, 13),
      ('5', 'Freio de serviço ok?', false, true, 14),
      ('5', 'Aparência geral ok?', false, true, 15),
      ('5', 'Extintor incêndio ok?', false, true, 16),
      ('5', 'Direção pesada?', true, false, 17),
      ('5', 'Existem ruídos?', true, false, 18),
      ('5', 'Retrovisores ok?', false, true, 19),

      ('7', 'Estou apto a operar?', false, true, 1),
      ('7', 'Garfos ok?', false, true, 2),
      ('7', 'Painel geral ok?', false, true, 3),
      ('7', 'Possui vazamentos?', true, false, 4),
      ('7', 'Rodas de carga ok?', false, true, 5),
      ('7', 'Roda de tração ok?', false, true, 6),
      ('7', 'Bateria ok?', false, true, 7),
      ('7', 'Conector e cabos ok?', false, true, 8),
      ('7', 'Sinais sonoros ok?', false, true, 9),
      ('7', 'Sistema hidráulico ok?', false, true, 10),
      ('7', 'Timão ok?', false, true, 11),
      ('7', 'Botão antiesmagamento ok?', false, true, 12),
      ('7', 'Existem ruídos?', true, false, 13),
      ('7', 'Limpeza ok?', false, true, 14),
      ('7', 'Aparência geral ok?', false, true, 15)
  ) AS t(equipment_type, question, alert_on_yes, alert_on_no, order_number)
)
INSERT INTO public.group_questions (group_id, question, alert_on_yes, alert_on_no, order_number)
SELECT
  tg.id,
  qt.question,
  qt.alert_on_yes,
  qt.alert_on_no,
  qt.order_number
FROM target_groups tg
JOIN question_templates qt
  ON qt.equipment_type = tg.equipment_type
WHERE NOT EXISTS (
  SELECT 1
  FROM public.group_questions gq
  WHERE gq.group_id = tg.id
    AND lower(trim(gq.question)) = lower(trim(qt.question))
);
