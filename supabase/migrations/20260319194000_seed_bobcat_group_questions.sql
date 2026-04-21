DO $$
DECLARE
  bobcat_group_id uuid;
BEGIN
  SELECT id
    INTO bobcat_group_id
  FROM public.checklist_groups
  WHERE lower(name) = 'empilhadeira - bobcat'
  ORDER BY created_at
  LIMIT 1;

  IF bobcat_group_id IS NULL THEN
    INSERT INTO public.checklist_groups (name, description)
    VALUES (
      'Empilhadeira - Bobcat',
      'Checklist padrão da mini carregadeira Bobcat / direção deslizante (KP 1239)'
    )
    RETURNING id INTO bobcat_group_id;
  END IF;

  INSERT INTO public.group_questions (group_id, question, alert_on_yes, alert_on_no, order_number)
  SELECT bobcat_group_id, v.question, v.alert_on_yes, v.alert_on_no, v.order_number
  FROM (
    VALUES
      ('Os faróis dianteiros estão funcionando normalmente?', false, true, 1),
      ('O stop de freio está funcionando normalmente?', false, true, 2),
      ('O sinal sonoro (buzina) está funcionando normalmente?', false, true, 3),
      ('A mini carregadeira possui ré sonora e está funcionando normalmente?', false, true, 4),
      ('Os pneus estão em boas condições?', false, true, 5),
      ('O sistema hidráulico (mangueiras e bomba) apresenta algum aspecto que indique vazamento de óleo?', false, true, 6),
      ('O sistema de frenagem, testado pelo operador no momento da inspeção, apresenta algum problema?', false, true, 7),
      ('O óleo do motor apresenta nível normal?', false, true, 8),
      ('O sistema de refrigeração do motor (radiador) apresenta nível de água normal?', false, true, 9),
      ('A mini carregadeira está com os retrovisores em boas condições de uso?', false, true, 10),
      ('O cinto de segurança está em boas condições de uso?', false, true, 11),
      ('A torre de garfos está em boas condições de uso?', false, true, 12),
      ('Possui catraca para amarração de cargas com risco de queda?', false, true, 13),
      ('Possui placa de identificação de equipamento?', false, true, 14),
      ('Diante dos pontos observados nesta inspeção, a mini carregadeira de direção deslizante está em condições de operar normalmente?', false, true, 15)
  ) AS v(question, alert_on_yes, alert_on_no, order_number)
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.group_questions q
    WHERE q.group_id = bobcat_group_id
      AND lower(q.question) = lower(v.question)
  );

  INSERT INTO public.equipment_groups (equipment_id, group_id)
  SELECT e.id, bobcat_group_id
  FROM public.equipment e
  WHERE e.kp = '1239'
    AND NOT EXISTS (
      SELECT 1
      FROM public.equipment_groups eg
      WHERE eg.equipment_id = e.id
        AND eg.group_id = bobcat_group_id
    );
END $$;
