DO $$
DECLARE
  logistica_sector_id uuid;
  bruno_leader_id uuid;
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
  ORDER BY created_at
  LIMIT 1;

  IF bruno_leader_id IS NULL THEN
    INSERT INTO public.leaders (name, email, sector, password_hash)
    VALUES ('Bruno Rech', 'bruno.rech@afm.com.br', 'LOGISTICA INTERNA', 'YnJ1bm8xMjM=')
    RETURNING id INTO bruno_leader_id;
  ELSE
    UPDATE public.leaders
    SET name = 'Bruno Rech',
        sector = 'LOGISTICA INTERNA'
    WHERE id = bruno_leader_id;
  END IF;

  UPDATE public.sectors
  SET leader_id = bruno_leader_id
  WHERE id = logistica_sector_id;

  INSERT INTO public.sector_leader_assignments (sector_id, leader_id, shift)
  VALUES (logistica_sector_id, bruno_leader_id, 'default')
  ON CONFLICT (sector_id, leader_id, shift) DO NOTHING;

  UPDATE public.equipment
  SET sector = 'LOGISTICA INTERNA',
      type = '5'
  WHERE kp IN (
    '1239', '1257', '1814', '2856', '3186', '3236', '3413',
    '3429', '5780', '5813', '5834', '6242', '6250', '6257'
  );
END $$;

