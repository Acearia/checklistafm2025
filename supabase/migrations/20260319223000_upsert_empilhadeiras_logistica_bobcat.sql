DO $$
DECLARE
  logistica_sector_id uuid;
  bruno_leader_id uuid;
  bobcat_group_id uuid;
  equipamento record;
BEGIN
  SELECT id
    INTO logistica_sector_id
  FROM public.sectors
  WHERE translate(lower(name), 'áàãâäéèêëíìîïóòõôöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') = 'logistica interna'
  ORDER BY created_at
  LIMIT 1;

  IF logistica_sector_id IS NULL THEN
    INSERT INTO public.sectors (name, description)
    VALUES ('LOGISTICA INTERNA', 'Setor de logística interna')
    RETURNING id INTO logistica_sector_id;
  END IF;

  SELECT id
    INTO bruno_leader_id
  FROM public.leaders
  WHERE lower(email) = 'bruno.rech@afm.com.br'
     OR lower(name) = 'bruno rech'
  ORDER BY created_at
  LIMIT 1;

  IF bruno_leader_id IS NULL THEN
    INSERT INTO public.leaders (name, email, sector, password_hash)
    VALUES ('Bruno Rech', 'bruno.rech@afm.com.br', 'LOGISTICA INTERNA', 'YnJ1bm8xMjM=')
    RETURNING id INTO bruno_leader_id;
  ELSE
    UPDATE public.leaders
       SET name = 'Bruno Rech',
           email = 'bruno.rech@afm.com.br',
           sector = 'LOGISTICA INTERNA'
     WHERE id = bruno_leader_id;
  END IF;

  UPDATE public.sectors
     SET leader_id = bruno_leader_id
   WHERE id = logistica_sector_id;

  INSERT INTO public.sector_leader_assignments (sector_id, leader_id, shift)
  VALUES (logistica_sector_id, bruno_leader_id, 'default')
  ON CONFLICT (sector_id, leader_id, shift) DO NOTHING;

  FOR equipamento IN
    SELECT *
    FROM (
      VALUES
        ('1239', 'Bobcat / Mini Carregadeira', 'N/A'),
        ('1257', 'EMPILHADEIRA', 'N/A'),
        ('1814', 'EMPILHADEIRA: RC44 25C (EMPILHADEIRA LOCADA)', 'N/A'),
        ('2856', 'Empilhadeira Retrátil', 'N/A'),
        ('3186', 'EMPILHADEIRA LOCADA', 'N/A'),
        ('3236', 'EMPILHADEIRA LOCADA', 'N/A'),
        ('3413', 'Empilhadeira Locada Linde', 'N/A'),
        ('3429', 'EMPILHADEIRA', 'N/A'),
        ('5780', 'EMPILHADEIRA', 'N/A'),
        ('5813', 'EMPILHADEIRA', 'N/A'),
        ('5834', 'EMPILHADEIRA ELÉTRICA', 'N/A'),
        ('6242', 'Empilhadeira locada 7816W', 'N/A'),
        ('6250', 'Empilhadeira locada 8218X', 'N/A'),
        ('6257', 'EMPILHADEIRA RETRÁTIL LOCADO 2872Y', 'N/A')
    ) AS equipamentos(kp, name, capacity)
  LOOP
    IF EXISTS (SELECT 1 FROM public.equipment WHERE kp = equipamento.kp) THEN
      UPDATE public.equipment
         SET name = equipamento.name,
             sector = 'LOGISTICA INTERNA',
             type = '5',
             capacity = CASE
               WHEN trim(coalesce(capacity, '')) = '' THEN equipamento.capacity
               ELSE capacity
             END
       WHERE kp = equipamento.kp;
    ELSE
      INSERT INTO public.equipment (name, kp, sector, type, capacity)
      VALUES (equipamento.name, equipamento.kp, 'LOGISTICA INTERNA', '5', equipamento.capacity);
    END IF;
  END LOOP;

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
  SELECT bobcat_group_id, v.question, false, true, v.order_number
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
  ) AS v(question, order_number)
  WHERE NOT EXISTS (
    SELECT 1
      FROM public.group_questions q
     WHERE q.group_id = bobcat_group_id
       AND lower(q.question) = lower(v.question)
  );

  INSERT INTO public.equipment_groups (equipment_id, group_id)
  SELECT e.id::text, bobcat_group_id
    FROM public.equipment e
   WHERE e.kp = '1239'
     AND NOT EXISTS (
       SELECT 1
         FROM public.equipment_groups eg
        WHERE eg.equipment_id = e.id::text
          AND eg.group_id = bobcat_group_id
     );
END $$;
