-- Add leader-related columns to operators
ALTER TABLE public.operators
  ADD COLUMN IF NOT EXISTS is_leader boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS leader_email text,
  ADD COLUMN IF NOT EXISTS leader_password_hash text;

ALTER TABLE public.operators
  ADD CONSTRAINT operators_leader_email_unique UNIQUE (leader_email);

-- Add operator reference to sectors for leader assignment
ALTER TABLE public.sectors
  ADD COLUMN IF NOT EXISTS leader_operator_matricula text REFERENCES public.operators(matricula);

-- Migrate data from leaders table into operators and sectors
DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN SELECT * FROM public.leaders LOOP
    UPDATE public.operators
    SET is_leader = true,
        leader_email = rec.email,
        leader_password_hash = rec.password_hash
    WHERE matricula = rec.operator_matricula;

    UPDATE public.sectors
    SET leader_operator_matricula = rec.operator_matricula
    WHERE leader_id = rec.id::text;
  END LOOP;
END $$;

-- Drop old leader references on sectors
ALTER TABLE public.sectors DROP COLUMN IF EXISTS leader_id;

-- Drop legacy leaders table
DROP TABLE IF EXISTS public.leaders;
