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
      'Checklist padrão da mini carregadeira Bobcat / direção deslizante (KP 1239)'
    )
    RETURNING id INTO bobcat_group_id;
  ELSE
    UPDATE public.checklist_groups
       SET name = 'Bobcat / Mini Carregadeira',
           description = 'Checklist padrão da mini carregadeira Bobcat / direção deslizante (KP 1239)'
     WHERE id = bobcat_group_id;
  END IF;

  INSERT INTO public.group_questions (group_id, question, alert_on_yes, alert_on_no, order_number)
  SELECT bobcat_group_id, src.question, false, true, src.order_number
  FROM (
    VALUES
      ('Os faróis dianteiros estão funcionando normalmente?', 1),
      ('O stop de freio está funcionando normalmente?', 2),
      ('O sinal sonoro (buzina) está funcionando normalmente?', 3),
      ('A mini carregadeira possui ré sonora e está funcionando normalmente?', 4),
      ('Os pneus estão em boas condições?', 5),
      ('O sistema hidráulico (mangueiras e bomba) apresenta algum aspecto que indique vazamento de óleo?', 6),
      ('O sistema de frenagem, testado pelo operador no momento da inspeção, apresenta algum problema?', 7),
      ('O óleo do motor apresenta nível normal?', 8),
      ('O sistema de refrigeração do motor (radiador) apresenta nível de água normal?', 9),
      ('A mini carregadeira está com os retrovisores em boas condições de uso?', 10),
      ('O cinto de segurança está em boas condições de uso?', 11),
      ('A torre de garfos está em boas condições de uso?', 12),
      ('Possui catraca para amarração de cargas com risco de queda?', 13),
      ('Possui placa de identificação de equipamento?', 14),
      ('Diante dos pontos observados nesta inspeção, a mini carregadeira de direção deslizante está em condições de operar normalmente?', 15)
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
        ('Os faróis dianteiros estão funcionando normalmente?', 1),
        ('O stop de freio está funcionando normalmente?', 2),
        ('O sinal sonoro (buzina) está funcionando normalmente?', 3),
        ('A mini carregadeira possui ré sonora e está funcionando normalmente?', 4),
        ('Os pneus estão em boas condições?', 5),
        ('O sistema hidráulico (mangueiras e bomba) apresenta algum aspecto que indique vazamento de óleo?', 6),
        ('O sistema de frenagem, testado pelo operador no momento da inspeção, apresenta algum problema?', 7),
        ('O óleo do motor apresenta nível normal?', 8),
        ('O sistema de refrigeração do motor (radiador) apresenta nível de água normal?', 9),
        ('A mini carregadeira está com os retrovisores em boas condições de uso?', 10),
        ('O cinto de segurança está em boas condições de uso?', 11),
        ('A torre de garfos está em boas condições de uso?', 12),
        ('Possui catraca para amarração de cargas com risco de queda?', 13),
        ('Possui placa de identificação de equipamento?', 14),
        ('Diante dos pontos observados nesta inspeção, a mini carregadeira de direção deslizante está em condições de operar normalmente?', 15)
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
