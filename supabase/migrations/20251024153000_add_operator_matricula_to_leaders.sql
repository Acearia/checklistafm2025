-- Link leaders to operator matricula for admin-managed assignments
ALTER TABLE public.leaders
  ADD COLUMN IF NOT EXISTS operator_matricula TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_leaders_operator_matricula
  ON public.leaders(operator_matricula);
