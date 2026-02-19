-- Add alert flag columns to checklist_items so admin toggles persist in the database
ALTER TABLE public.checklist_items
  ADD COLUMN IF NOT EXISTS alert_on_yes BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS alert_on_no BOOLEAN NOT NULL DEFAULT false;

-- Ensure default values are applied to any existing rows (defensive)
UPDATE public.checklist_items
SET
  alert_on_yes = COALESCE(alert_on_yes, false),
  alert_on_no = COALESCE(alert_on_no, false);
