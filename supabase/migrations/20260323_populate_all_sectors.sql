-- Populate sectors table with all sectors used by the application.
-- This migration is intentionally idempotent and does not delete rows.

WITH desired_sectors(name, description) AS (
  VALUES
    (U&'TRATAMENTO T\00C9RMICO', 'Setor de tratamento termico e processamento de materiais'),
    ('SOLDA', 'Setor de soldagem e uniao de componentes'),
    ('REBOLO PENDULAR', 'Setor de rebolos pendulares para acabamento'),
    (U&'REBARBA\00C7\00C3O', 'Setor de rebarbacao e limpeza de pecas'),
    (U&'MA\00C7ARICO', 'Setor de corte e acabamento com macarico'),
    ('LIXADEIRA MANUAL', 'Setor de lixamento manual de pecas'),
    ('JATEAMENTO', 'Setor de jateamento e limpeza abrasiva'),
    ('CORTE', 'Setor de corte de materiais'),
    (U&'ACABAMENTO DE PE\00C7AS', 'Setor de acabamento final de pecas'),
    ('SUCATA', 'Setor de processamento de sucata'),
    (U&'FUS\00C3O', 'Setor de fusao e fundicao'),
    ('DESMOLDAGEM', 'Setor de desmoldagem de pecas fundidas'),
    ('LINHA DE MOLDAGEM E FECHAMENTO', 'Setor de moldagem e fechamento de formas'),
    ('MACHARIA', 'Setor de fabricacao de machos'),
    ('MOLDAGEM', 'Setor de moldagem de pecas'),
    ('MOLDES E MACHOS', 'Setor de producao de moldes e machos'),
    ('ALMOXARIFADO', 'Setor de armazenamento e controle de materiais'),
    (U&'LOG\00CDSTICA INTERNA', 'Setor de logistica interna e movimentacao'),
    (U&'EXPEDI\00C7\00C3O', 'Setor de expedicao e envio de produtos'),
    ('CQF', 'Setor de controle de qualidade final'),
    ('USINAGEM', 'Setor de usinagem e processamento mecanico')
)
INSERT INTO public.sectors (name, description)
SELECT ds.name, ds.description
FROM desired_sectors ds
WHERE NOT EXISTS (
  SELECT 1
  FROM public.sectors s
  WHERE upper(trim(s.name)) = upper(trim(ds.name))
);
