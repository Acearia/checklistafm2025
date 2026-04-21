DO $$
DECLARE
  canonical_sector_id uuid;
  duplicate_sector record;
  canonical_leader_id uuid;
  canonical_name constant text := 'LOGÍSTICA INTERNA';
BEGIN
  SELECT id, leader_id
    INTO canonical_sector_id, canonical_leader_id
  FROM public.sectors
  WHERE trim(name) = canonical_name
  ORDER BY created_at
  LIMIT 1;

  IF canonical_sector_id IS NULL THEN
    SELECT id, leader_id
      INTO canonical_sector_id, canonical_leader_id
    FROM public.sectors
    WHERE regexp_replace(
            translate(lower(trim(name)), 'áàãâäéèêëíìîïóòõôöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'),
            '\s+',
            ' ',
            'g'
          ) = 'logistica interna'
    ORDER BY created_at
    LIMIT 1;
  END IF;

  IF canonical_sector_id IS NULL THEN
    RAISE EXCEPTION 'Setor LOGÍSTICA INTERNA não encontrado para consolidação';
  END IF;

  UPDATE public.sectors
     SET name = canonical_name,
         description = COALESCE(NULLIF(description, ''), 'Setor de logística interna')
   WHERE id = canonical_sector_id;

  UPDATE public.equipment
     SET sector = canonical_name,
         type = '5'
   WHERE kp IN ('1239', '1257', '1814', '2856', '3186', '3236', '3413', '3429', '5780', '5813', '5834', '6242', '6250', '6257')
      OR regexp_replace(
           translate(lower(trim(sector)), 'áàãâäéèêëíìîïóòõôöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'),
           '\s+',
           ' ',
           'g'
         ) = 'logistica interna';

  UPDATE public.leaders
     SET sector = canonical_name
   WHERE regexp_replace(
           translate(lower(trim(sector)), 'áàãâäéèêëíìîïóòõôöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'),
           '\s+',
           ' ',
           'g'
         ) = 'logistica interna';

  UPDATE public.operators
     SET setor = canonical_name
   WHERE regexp_replace(
           translate(lower(trim(setor)), 'áàãâäéèêëíìîïóòõôöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'),
           '\s+',
           ' ',
           'g'
         ) = 'logistica interna';

  FOR duplicate_sector IN
    SELECT id, leader_id
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

    IF canonical_leader_id IS NULL AND duplicate_sector.leader_id IS NOT NULL THEN
      canonical_leader_id := duplicate_sector.leader_id;
    END IF;

    DELETE FROM public.sector_leader_assignments
    WHERE sector_id = duplicate_sector.id;

    DELETE FROM public.sectors
    WHERE id = duplicate_sector.id;
  END LOOP;

  IF canonical_leader_id IS NOT NULL THEN
    UPDATE public.sectors
       SET leader_id = canonical_leader_id
     WHERE id = canonical_sector_id;
  END IF;
END $$;
