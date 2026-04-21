DO $$
DECLARE
  canonical_sector_id uuid;
  duplicate_sector record;
  bruno_leader_id uuid;
BEGIN
  SELECT id
    INTO canonical_sector_id
  FROM public.sectors
  WHERE regexp_replace(
          translate(lower(trim(name)), 'áàãâäéèêëíìîïóòõôöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'),
          '\s+',
          ' ',
          'g'
        ) = 'logistica interna'
  ORDER BY
    CASE WHEN upper(trim(name)) = 'LOGISTICA INTERNA' THEN 0 ELSE 1 END,
    created_at
  LIMIT 1;

  IF canonical_sector_id IS NULL THEN
    INSERT INTO public.sectors (name, description)
    VALUES ('LOGISTICA INTERNA', 'Setor de logística interna')
    RETURNING id INTO canonical_sector_id;
  END IF;

  SELECT id
    INTO bruno_leader_id
  FROM public.leaders
  WHERE lower(email) = 'bruno.rech@afm.com.br'
     OR lower(name) = 'bruno rech'
  ORDER BY created_at
  LIMIT 1;

  IF bruno_leader_id IS NOT NULL THEN
    UPDATE public.leaders
       SET name = 'Bruno Rech',
           email = 'bruno.rech@afm.com.br',
           sector = 'LOGISTICA INTERNA'
     WHERE id = bruno_leader_id;

    UPDATE public.sectors
       SET name = 'LOGISTICA INTERNA',
           description = COALESCE(NULLIF(description, ''), 'Setor de logística interna'),
           leader_id = bruno_leader_id
     WHERE id = canonical_sector_id;
  ELSE
    UPDATE public.sectors
       SET name = 'LOGISTICA INTERNA',
           description = COALESCE(NULLIF(description, ''), 'Setor de logística interna')
     WHERE id = canonical_sector_id;
  END IF;

  FOR duplicate_sector IN
    SELECT id
    FROM public.sectors
    WHERE id <> canonical_sector_id
      AND regexp_replace(
            translate(lower(trim(name)), 'áàãâäéèêëíìîïóòõôöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'),
            '\s+',
            ' ',
            'g'
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
     SET sector = 'LOGISTICA INTERNA',
         type = '5'
   WHERE kp IN ('1239', '1257', '1814', '2856', '3186', '3236', '3413', '3429', '5780', '5813', '5834', '6242', '6250', '6257');
END $$;
