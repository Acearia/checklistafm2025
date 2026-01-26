-- Add senha column to operators table for operator PIN management
ALTER TABLE public.operators
  ADD COLUMN senha TEXT;
