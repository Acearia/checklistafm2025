-- Restore leaders table and revert leader-related schema changes

-- Recreate leaders table
CREATE TABLE IF NOT EXISTS public.leaders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  sector TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Ensure row level security is enabled
ALTER TABLE public.leaders ENABLE ROW LEVEL SECURITY;

-- Reset policies to avoid duplicates
DROP POLICY IF EXISTS "Anyone can view leaders" ON public.leaders;
DROP POLICY IF EXISTS "Anyone can insert leaders" ON public.leaders;
DROP POLICY IF EXISTS "Anyone can update leaders" ON public.leaders;
DROP POLICY IF EXISTS "Anyone can delete leaders" ON public.leaders;

CREATE POLICY "Anyone can view leaders" ON public.leaders FOR SELECT USING (true);
CREATE POLICY "Anyone can insert leaders" ON public.leaders FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update leaders" ON public.leaders FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete leaders" ON public.leaders FOR DELETE USING (true);

-- Ensure updated_at trigger exists
DROP TRIGGER IF EXISTS update_leaders_updated_at ON public.leaders;
CREATE TRIGGER update_leaders_updated_at
  BEFORE UPDATE ON public.leaders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Restore leader reference on sectors
ALTER TABLE public.sectors
  ADD COLUMN IF NOT EXISTS leader_id UUID REFERENCES public.leaders(id);

-- Remove operator matricula link if it exists
ALTER TABLE public.sectors
  DROP COLUMN IF EXISTS leader_operator_matricula;

-- Remove leader columns from operators (no longer used)
ALTER TABLE public.operators
  DROP COLUMN IF EXISTS is_leader,
  DROP COLUMN IF EXISTS leader_email,
  DROP COLUMN IF EXISTS leader_password_hash;
