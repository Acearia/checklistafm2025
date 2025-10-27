-- Add matricula column and modify operators table structure
ALTER TABLE public.operators ADD COLUMN matricula TEXT;

-- Update existing operators to have matricula values (using random 4-digit numbers for existing data)
UPDATE public.operators SET matricula = LPAD(FLOOR(RANDOM() * 9000 + 1000)::TEXT, 4, '0') WHERE matricula IS NULL;

-- Make matricula column not null and unique
ALTER TABLE public.operators ALTER COLUMN matricula SET NOT NULL;
ALTER TABLE public.operators ADD CONSTRAINT operators_matricula_unique UNIQUE (matricula);
ALTER TABLE public.operators ADD CONSTRAINT operators_matricula_length CHECK (LENGTH(matricula) = 4);

-- Update foreign key references in inspections table to use matricula instead of id
ALTER TABLE public.inspections ADD COLUMN operator_matricula TEXT;

-- Copy existing operator references using matricula
UPDATE public.inspections 
SET operator_matricula = (
    SELECT matricula 
    FROM public.operators 
    WHERE operators.id = inspections.operator_id
);

-- Drop old foreign key and add new one
ALTER TABLE public.inspections DROP COLUMN operator_id;
ALTER TABLE public.inspections ADD CONSTRAINT inspections_operator_matricula_fkey 
FOREIGN KEY (operator_matricula) REFERENCES public.operators(matricula);

-- Create index for better performance
CREATE INDEX idx_operators_matricula ON public.operators(matricula);
CREATE INDEX idx_inspections_operator_matricula ON public.inspections(operator_matricula);;
