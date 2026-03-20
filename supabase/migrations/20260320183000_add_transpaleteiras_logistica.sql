DO $$
DECLARE
  resolved_sector_name text;
  transpaleteira_group_id uuid;
  equipment_row record;
BEGIN
  SELECT s.name
    INTO resolved_sector_name
  FROM public.sectors s
  WHERE translate(
          lower(trim(s.name)),
          'áàãâäéèêëíìîïóòõôöúùûüç',
          'aaaaaeeeeiiiiooooouuuuc'
        ) = 'logistica interna'
  ORDER BY s.created_at
  LIMIT 1;

  IF resolved_sector_name IS NULL THEN
    RAISE EXCEPTION 'Setor LOGÍSTICA INTERNA não encontrado para vincular as transpaleteiras';
  END IF;

  FOR equipment_row IN
    SELECT *
    FROM (
      VALUES
        ('2832', 'TRANSPALETEIRA', 'N/A'),
        ('3416', 'TRANSPALETEIRA', 'N/A'),
        ('3365', 'TRANSPALETEIRA', 'N/A')
    ) AS v(kp, name, capacity)
  LOOP
    IF EXISTS (SELECT 1 FROM public.equipment WHERE kp = equipment_row.kp) THEN
      UPDATE public.equipment
         SET name = equipment_row.name,
             sector = resolved_sector_name,
             type = '7',
             capacity = CASE
               WHEN trim(coalesce(capacity, '')) = '' THEN equipment_row.capacity
               ELSE capacity
             END
       WHERE kp = equipment_row.kp;
    ELSE
      INSERT INTO public.equipment (name, kp, sector, type, capacity)
      VALUES (equipment_row.name, equipment_row.kp, resolved_sector_name, '7', equipment_row.capacity);
    END IF;
  END LOOP;

  SELECT cg.id
    INTO transpaleteira_group_id
  FROM public.checklist_groups cg
  WHERE trim(coalesce(cg.equipment_type, '')) = '7'
     OR lower(trim(cg.name)) = lower('Transpaleteira')
  ORDER BY cg.created_at
  LIMIT 1;

  IF transpaleteira_group_id IS NOT NULL THEN
    INSERT INTO public.equipment_groups (equipment_id, group_id)
    SELECT e.id::text, transpaleteira_group_id
    FROM public.equipment e
    WHERE e.kp IN ('2832', '3416', '3365')
      AND NOT EXISTS (
        SELECT 1
        FROM public.equipment_groups eg
        WHERE eg.equipment_id = e.id::text
          AND eg.group_id = transpaleteira_group_id
      );
  END IF;
END $$;
