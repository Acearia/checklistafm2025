-- Create sectors table
CREATE TABLE public.sectors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  leader_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;

-- Create policy for sectors (public read access for now)
CREATE POLICY "Anyone can view sectors" ON public.sectors FOR SELECT USING (true);
CREATE POLICY "Anyone can insert sectors" ON public.sectors FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update sectors" ON public.sectors FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete sectors" ON public.sectors FOR DELETE USING (true);

-- Create operators table
CREATE TABLE public.operators (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  cargo TEXT,
  setor TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.operators ENABLE ROW LEVEL SECURITY;

-- Create policy for operators
CREATE POLICY "Anyone can view operators" ON public.operators FOR SELECT USING (true);
CREATE POLICY "Anyone can insert operators" ON public.operators FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update operators" ON public.operators FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete operators" ON public.operators FOR DELETE USING (true);

-- Create equipment table
CREATE TABLE public.equipment (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  kp TEXT NOT NULL,
  type TEXT NOT NULL,
  sector TEXT NOT NULL,
  capacity TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;

-- Create policy for equipment
CREATE POLICY "Anyone can view equipment" ON public.equipment FOR SELECT USING (true);
CREATE POLICY "Anyone can insert equipment" ON public.equipment FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update equipment" ON public.equipment FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete equipment" ON public.equipment FOR DELETE USING (true);

-- Create checklist_items table
CREATE TABLE public.checklist_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question TEXT NOT NULL,
  order_number INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;

-- Create policy for checklist_items
CREATE POLICY "Anyone can view checklist_items" ON public.checklist_items FOR SELECT USING (true);
CREATE POLICY "Anyone can insert checklist_items" ON public.checklist_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update checklist_items" ON public.checklist_items FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete checklist_items" ON public.checklist_items FOR DELETE USING (true);

-- Create inspections table
CREATE TABLE public.inspections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  operator_id UUID REFERENCES public.operators(id),
  equipment_id UUID REFERENCES public.equipment(id),
  inspection_date DATE NOT NULL,
  submission_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  comments TEXT,
  signature TEXT,
  photos JSONB DEFAULT '[]',
  checklist_answers JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.inspections ENABLE ROW LEVEL SECURITY;

-- Create policy for inspections
CREATE POLICY "Anyone can view inspections" ON public.inspections FOR SELECT USING (true);
CREATE POLICY "Anyone can insert inspections" ON public.inspections FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update inspections" ON public.inspections FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete inspections" ON public.inspections FOR DELETE USING (true);

-- Create leaders table
CREATE TABLE public.leaders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  sector TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.leaders ENABLE ROW LEVEL SECURITY;

-- Create policy for leaders
CREATE POLICY "Anyone can view leaders" ON public.leaders FOR SELECT USING (true);
CREATE POLICY "Anyone can insert leaders" ON public.leaders FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update leaders" ON public.leaders FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete leaders" ON public.leaders FOR DELETE USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_sectors_updated_at BEFORE UPDATE ON public.sectors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_operators_updated_at BEFORE UPDATE ON public.operators FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_equipment_updated_at BEFORE UPDATE ON public.equipment FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_checklist_items_updated_at BEFORE UPDATE ON public.checklist_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_inspections_updated_at BEFORE UPDATE ON public.inspections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_leaders_updated_at BEFORE UPDATE ON public.leaders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert initial data
INSERT INTO public.sectors (name, description) VALUES 
  ('Manutenção', 'Setor responsável pela manutenção de equipamentos'),
  ('Produção', 'Setor de produção industrial'),
  ('Armazém', 'Setor de armazenamento e logística'),
  ('Segurança', 'Setor de segurança do trabalho');

INSERT INTO public.operators (name, cargo, setor) VALUES 
  ('João Silva', 'Operador de Ponte Rolante', 'Manutenção'),
  ('Maria Oliveira', 'Técnica de Segurança', 'Segurança'),
  ('Carlos Pereira', 'Supervisor de Produção', 'Produção');

INSERT INTO public.equipment (name, kp, type, sector, capacity) VALUES 
  ('Ponte Rolante A', '1234', '1', 'Manutenção', '5'),
  ('Talha Elétrica B', '5678', '2', 'Produção', '2'),
  ('Pórtico C', '9012', '3', 'Armazém', '10');

-- Insert checklist items
INSERT INTO public.checklist_items (question, order_number) VALUES 
  ('O cabo de aço possui fios amassados?', 1),
  ('O cabo de aço possui fios partidos?', 2),
  ('O cabo de aço possui fios com dobras?', 3),
  ('O sistema de freio do guincho está funcionando?', 4),
  ('O sistema de freio do Troller está funcionando?', 5),
  ('As travas de segurança do guincho estão funcionando?', 6),
  ('O gancho está girando sem dificuldades?', 7),
  ('O sinal sonoro está funcionando?', 8),
  ('As polias estão girando sem dificuldades?', 9),
  ('Existem grandes danos estruturais no equipamento?', 10),
  ('O equipamento está fazendo algum barulho estranho?', 11),
  ('O fim de curso inferior está funcionando?', 12),
  ('O fim de curso superior está funcionando?', 13),
  ('O fim de curso esquerdo está funcionando?', 14),
  ('O fim de curso direito está funcionando?', 15),
  ('O botão de emergência do controle está funcionando?', 16),
  ('O controle possui botões danificados?', 17),
  ('A corrente possui elos com desgaste?', 18),
  ('A corrente possui elos alongados?', 19),
  ('A corrente possui elos alargados?', 20),
  ('O(s) gancho(s) da corrente possui sinais de desgaste?', 21),
  ('O(s) gancho(s) da corrente possui elos com sinais de alongamento?', 22),
  ('O(s) gancho(s) da corrente possui travas de segurança funcionando?', 23),
  ('A corrente possui plaqueta de identificação fixada?', 24),
  ('O saco recolhedor da corrente, possui furos ou rasgos?', 25),
  ('O batente de giro, está em boas condições de uso?', 26),
  ('Os trilhos do pórtico estão desobstruídos?', 27),
  ('O freio do pórtico está funcionando?', 28),
  ('Os sensores contra esmagamento, estão funcionando?', 29);;
