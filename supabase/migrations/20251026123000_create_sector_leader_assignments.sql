-- Create table to allow multiple leaders per sector with optional shift designation
CREATE TABLE IF NOT EXISTS public.sector_leader_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id UUID NOT NULL REFERENCES public.sectors(id) ON DELETE CASCADE,
  leader_id UUID NOT NULL REFERENCES public.leaders(id) ON DELETE CASCADE,
  shift TEXT DEFAULT 'default',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Avoid duplicate assignments for the same leader/shift in a sector
ALTER TABLE public.sector_leader_assignments
  ADD CONSTRAINT sector_leader_assignments_unique UNIQUE (sector_id, leader_id, shift);

-- Enable RLS similar to other tables
ALTER TABLE public.sector_leader_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view sector_leader_assignments" ON public.sector_leader_assignments;
DROP POLICY IF EXISTS "Anyone can insert sector_leader_assignments" ON public.sector_leader_assignments;
DROP POLICY IF EXISTS "Anyone can update sector_leader_assignments" ON public.sector_leader_assignments;
DROP POLICY IF EXISTS "Anyone can delete sector_leader_assignments" ON public.sector_leader_assignments;

CREATE POLICY "Anyone can view sector_leader_assignments"
  ON public.sector_leader_assignments
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert sector_leader_assignments"
  ON public.sector_leader_assignments
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update sector_leader_assignments"
  ON public.sector_leader_assignments
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete sector_leader_assignments"
  ON public.sector_leader_assignments
  FOR DELETE
  USING (true);

-- Keep updated_at in sync
DROP TRIGGER IF EXISTS update_sector_leader_assignments_updated_at ON public.sector_leader_assignments;
CREATE TRIGGER update_sector_leader_assignments_updated_at
  BEFORE UPDATE ON public.sector_leader_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Backfill any existing single-leader associations
INSERT INTO public.sector_leader_assignments (sector_id, leader_id, shift)
SELECT id, leader_id, 'default'
FROM public.sectors
WHERE leader_id IS NOT NULL
ON CONFLICT DO NOTHING;
