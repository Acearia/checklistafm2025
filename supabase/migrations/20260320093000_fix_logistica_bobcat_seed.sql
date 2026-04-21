DO $$
DECLARE
  canonical_name constant text := 'LOGÍSTICA INTERNA';
  canonical_sector_id uuid;
  duplicate_sector record;
  bruno_leader_id uuid;
  bobcat_group_id uuid;
  equipment_row record;
BEGIN
  SELECT id
    INTO canonical_sector_id
  FROM public.sectors
  WHERE trim(name) = canonical_name
  ORDER BY created_at
  LIMIT 1;

  IF canonical_sector_id IS NULL THEN
    SELECT id
      INTO canonical_sector_id
    FROM public.sectors
    WHERE translate(
            lower(trim(name)),
            'áàãâäéèêëíìîïóòõôöúùûüç',
            'aaaaaeeeeiiiiooooouuuuc'
          ) = 'logistica interna'
    ORDER BY created_at
    LIMIT 1;
  END IF;

  IF canonical_sector_id IS NULL THEN
    INSERT INTO public.sectors (name, description)
    VALUES (canonical_name, 'Setor de logística interna')
    RETURNING id INTO canonical_sector_id;
  ELSE
    UPDATE public.sectors
       SET name = canonical_name,
           description = COALESCE(NULLIF(description, ''), 'Setor de logística interna')
     WHERE id = canonical_sector_id;
  END IF;

  SELECT id
    INTO bruno_leader_id
  FROM public.leaders
  WHERE lower(coalesce(email, '')) = 'bruno.rech@afm.com.br'
     OR lower(coalesce(name, '')) = 'bruno rech'
  ORDER BY created_at
  LIMIT 1;

  IF bruno_leader_id IS NULL THEN
    INSERT INTO public.leaders (name, email, sector, password_hash)
    VALUES ('Bruno Rech', 'bruno.rech@afm.com.br', canonical_name, 'YnJ1bm8xMjM=')
    RETURNING id INTO bruno_leader_id;
  ELSE
    UPDATE public.leaders
       SET name = 'Bruno Rech',
           email = 'bruno.rech@afm.com.br',
           sector = canonical_name
     WHERE id = bruno_leader_id;
  END IF;

  UPDATE public.sectors
     SET leader_id = bruno_leader_id
   WHERE id = canonical_sector_id;

  INSERT INTO public.sector_leader_assignments (sector_id, leader_id, shift)
  VALUES (canonical_sector_id, bruno_leader_id, 'default')
  ON CONFLICT (sector_id, leader_id, shift) DO NOTHING;

  FOR duplicate_sector IN
    SELECT id, leader_id
    FROM public.sectors
    WHERE id <> canonical_sector_id
      AND translate(
            lower(trim(name)),
            'áàãâäéèêëíìîïóòõôöúùûüç',
            'aaaaaeeeeiiiiooooouuuuc'
          ) = 'logistica interna'
  LOOP
    INSERT INTO public.sector_leader_assignments (sector_id, leader_id, shift)
    SELECT canonical_sector_id, assignment.leader_id, assignment.shift
    FROM public.sector_leader_assignments assignment
    WHERE assignment.sector_id = duplicate_sector.id
    ON CONFLICT (sector_id, leader_id, shift) DO NOTHING;

    DELETE FROM public.sector_leader_assignments
    WHERE sector_id = duplicate_sector.id;

    DELETE FROM public.sectors
    WHERE id = duplicate_sector.id;
  END LOOP;

  UPDATE public.equipment
     SET sector = canonical_name,
         type = '5'
   WHERE kp IN ('1239', '1257', '1814', '2856', '3186', '3236', '3413', '3429', '5780', '5813', '5834', '6242', '6250', '6257')
      OR translate(
           lower(trim(coalesce(sector, ''))),
           'áàãâäéèêëíìîïóòõôöúùûüç',
           'aaaaaeeeeiiiiooooouuuuc'
         ) = 'logistica interna';

  UPDATE public.leaders
     SET sector = canonical_name
   WHERE translate(
           lower(trim(coalesce(sector, ''))),
           'áàãâäéèêëíìîïóòõôöúùûüç',
           'aaaaaeeeeiiiiooooouuuuc'
         ) = 'logistica interna';

  UPDATE public.operators
     SET setor = canonical_name
   WHERE translate(
           lower(trim(coalesce(setor, ''))),
           'áàãâäéèêëíìîïóòõôöúùûüç',
           'aaaaaeeeeiiiiooooouuuuc'
         ) = 'logistica interna';

  FOR equipment_row IN
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
    ) AS data(kp, name, capacity)
  LOOP
    IF EXISTS (SELECT 1 FROM public.equipment WHERE kp = equipment_row.kp) THEN
      UPDATE public.equipment
         SET name = equipment_row.name,
             sector = canonical_name,
             type = '5',
             capacity = CASE
               WHEN trim(coalesce(capacity, '')) = '' THEN equipment_row.capacity
               ELSE capacity
             END
       WHERE kp = equipment_row.kp;
    ELSE
      INSERT INTO public.equipment (name, kp, sector, type, capacity)
      VALUES (equipment_row.name, equipment_row.kp, canonical_name, '5', equipment_row.capacity);
    END IF;
  END LOOP;

  SELECT id
    INTO bobcat_group_id
  FROM public.checklist_groups
  WHERE lower(name) = lower('Empilhadeira - Bobcat')
  ORDER BY created_at
  LIMIT 1;

  IF bobcat_group_id IS NULL THEN
    INSERT INTO public.checklist_groups (name, description)
    VALUES (
      'Empilhadeira - Bobcat',
      'Checklist padrão da mini carregadeira Bobcat / direção deslizante (KP 1239)'
    )
    RETURNING id INTO bobcat_group_id;
  ELSE
    UPDATE public.checklist_groups
       SET name = 'Empilhadeira - Bobcat',
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
