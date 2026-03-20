DO $$
DECLARE
  bobcat_group_id uuid;
  bobcat_equipment_id text;
BEGIN
  UPDATE public.equipment
     SET type = '6',
         name = CASE
           WHEN trim(coalesce(name, '')) = '' OR lower(trim(name)) = 'empilhadeira' THEN 'Bobcat / Mini Carregadeira'
           ELSE name
         END
   WHERE kp = '1239';

  UPDATE public.equipment
     SET type = '5'
   WHERE kp IN ('1257', '1814', '2856', '3186', '3236', '3413', '3429', '5780', '5813', '5834', '6242', '6250', '6257');

  SELECT id
    INTO bobcat_group_id
  FROM public.checklist_groups
  WHERE lower(name) IN (
    lower('Empilhadeira - Bobcat'),
    lower('Bobcat / Mini Carregadeira')
  )
  ORDER BY created_at
  LIMIT 1;

  IF bobcat_group_id IS NULL THEN
    INSERT INTO public.checklist_groups (name, description)
    VALUES (
      'Bobcat / Mini Carregadeira',
      'Checklist padr?o da mini carregadeira Bobcat / dire??o deslizante (KP 1239)'
    )
    RETURNING id INTO bobcat_group_id;
  ELSE
    UPDATE public.checklist_groups
       SET name = 'Bobcat / Mini Carregadeira',
           description = 'Checklist padr?o da mini carregadeira Bobcat / dire??o deslizante (KP 1239)'
     WHERE id = bobcat_group_id;
  END IF;

  INSERT INTO public.group_questions (group_id, question, alert_on_yes, alert_on_no, order_number)
  SELECT bobcat_group_id, src.question, false, true, src.order_number
  FROM (
    VALUES
      ('Os far?is dianteiros est?o funcionando normalmente?', 1),
      ('O stop de freio est? funcionando normalmente?', 2),
      ('O sinal sonoro (buzina) est? funcionando normalmente?', 3),
      ('A mini carregadeira possui r? sonora e est? funcionando normalmente?', 4),
      ('Os pneus est?o em boas condi??es?', 5),
      ('O sistema hidr?ulico (mangueiras e bomba) apresenta algum aspecto que indique vazamento de ?leo?', 6),
      ('O sistema de frenagem, testado pelo operador no momento da inspe??o, apresenta algum problema?', 7),
      ('O ?leo do motor apresenta n?vel normal?', 8),
      ('O sistema de refrigera??o do motor (radiador) apresenta n?vel de ?gua normal?', 9),
      ('A mini carregadeira est? com os retrovisores em boas condi??es de uso?', 10),
      ('O cinto de seguran?a est? em boas condi??es de uso?', 11),
      ('A torre de garfos est? em boas condi??es de uso?', 12),
      ('Possui catraca para amarra??o de cargas com risco de queda?', 13),
      ('Possui placa de identifica??o de equipamento?', 14),
      ('Diante dos pontos observados nesta inspe??o, a mini carregadeira de dire??o deslizante est? em condi??es de operar normalmente?', 15)
  ) AS src(question, order_number)
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.group_questions q
    WHERE q.group_id = bobcat_group_id
      AND q.order_number = src.order_number
  );

  UPDATE public.group_questions q
     SET question = src.question,
         alert_on_yes = false,
         alert_on_no = true
    FROM (
      VALUES
        ('Os far?is dianteiros est?o funcionando normalmente?', 1),
        ('O stop de freio est? funcionando normalmente?', 2),
        ('O sinal sonoro (buzina) est? funcionando normalmente?', 3),
        ('A mini carregadeira possui r? sonora e est? funcionando normalmente?', 4),
        ('Os pneus est?o em boas condi??es?', 5),
        ('O sistema hidr?ulico (mangueiras e bomba) apresenta algum aspecto que indique vazamento de ?leo?', 6),
        ('O sistema de frenagem, testado pelo operador no momento da inspe??o, apresenta algum problema?', 7),
        ('O ?leo do motor apresenta n?vel normal?', 8),
        ('O sistema de refrigera??o do motor (radiador) apresenta n?vel de ?gua normal?', 9),
        ('A mini carregadeira est? com os retrovisores em boas condi??es de uso?', 10),
        ('O cinto de seguran?a est? em boas condi??es de uso?', 11),
        ('A torre de garfos est? em boas condi??es de uso?', 12),
        ('Possui catraca para amarra??o de cargas com risco de queda?', 13),
        ('Possui placa de identifica??o de equipamento?', 14),
        ('Diante dos pontos observados nesta inspe??o, a mini carregadeira de dire??o deslizante est? em condi??es de operar normalmente?', 15)
    ) AS src(question, order_number)
   WHERE q.group_id = bobcat_group_id
     AND q.order_number = src.order_number;

  SELECT id::text
    INTO bobcat_equipment_id
  FROM public.equipment
  WHERE kp = '1239'
  LIMIT 1;

  IF bobcat_equipment_id IS NOT NULL THEN
    DELETE FROM public.equipment_groups
    WHERE equipment_id = bobcat_equipment_id
      AND group_id <> bobcat_group_id;

    INSERT INTO public.equipment_groups (equipment_id, group_id)
    VALUES (bobcat_equipment_id, bobcat_group_id)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
