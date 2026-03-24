-- Populate sectors table with all sectors from leaders.json
-- This ensures we have the source of truth for all sectors used in the system

-- Clear existing sectors if migration needs to be rerun
DELETE FROM public.sectors WHERE name NOT IN ('Manutenção', 'Produção', 'Armazém', 'Segurança');

-- Insert all sectors from leaders.json
INSERT INTO public.sectors (name, description) VALUES
  ('TRATAMENTO TÉRMICO', 'Setor de tratamento térmico e processamento de materiais'),
  ('SOLDA', 'Setor de soldagem e união de componentes'),
  ('REBOLO PENDULAR', 'Setor de rebolos pendulares para acabamento'),
  ('REBARBAÇÃO', 'Setor de rebarbação e limpeza de peças'),
  ('MAÇARICO', 'Setor de corte e acabamento com maçarico'),
  ('LIXADEIRA MANUAL', 'Setor de lixamento manual de peças'),
  ('JATEAMENTO', 'Setor de jateamento e limpeza abrasiva'),
  ('CORTE', 'Setor de corte de materiais'),
  ('ACABAMENTO DE PEÇAS', 'Setor de acabamento final de peças'),
  ('SUCATA', 'Setor de processamento de sucata'),
  ('FUSÃO', 'Setor de fusão e fundição'),
  ('DESMOLDAGEM', 'Setor de desmoldagem de peças fundidas'),
  ('LINHA DE MOLDAGEM E FECHAMENTO', 'Setor de moldagem e fechamento de formas'),
  ('MACHARIA', 'Setor de fabricação de machos'),
  ('MOLDAGEM', 'Setor de moldagem de peças'),
  ('MOLDES E MACHOS', 'Setor de produção de moldes e machos'),
  ('ALMOXARIFADO', 'Setor de armazenamento e controle de materiais'),
  ('LOGÍSTICA INTERNA', 'Setor de logística interna e movimentação'),
  ('EXPEDIÇÃO', 'Setor de expedição e envio de produtos'),
  ('CQF', 'Setor de controle de qualidade final'),
  ('USINAGEM', 'Setor de usinagem e processamento mecânico')
ON CONFLICT (name) DO NOTHING;
