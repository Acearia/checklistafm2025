-- Preconfigure alert flags for checklist items based on safety requirements.
-- Items listed here should remain in sync with the images provided by the client.

-- Alerts when the answer is "Sim"
UPDATE public.checklist_items
SET alert_on_yes = true, alert_on_no = false
WHERE order_number IN (
  1,  -- O equipamento está fazendo algum barulho estranho?
  3,  -- Existem grandes danos estruturais no equipamento?
  5,  -- O controle possui botões danificados?
  15, -- O saco recolhedor da corrente possui furos ou rasgos?
  16, -- O cabo de aço possui fios amassados?
  17, -- O cabo de aço possui fios com dobras?
  18, -- O cabo de aço possui fios partidos?
  19, -- A corrente possui elos com desgaste?
  20, -- A corrente possui elos alongados?
  21, -- A corrente possui elos alargados?
  23, -- O(s) gancho(s) da corrente possui(em) sinais de desgaste?
  24  -- O(s) gancho(s) da corrente possui(em) sinais de alongamento?
);

-- Alerts when the answer is "Não"
UPDATE public.checklist_items
SET alert_on_yes = false, alert_on_no = true
WHERE order_number IN (
  2,  -- O sinal sonoro está funcionando?
  4,  -- O botão de emergência do controle está funcionando?
  6,  -- As polias estão girando sem dificuldades?
  7,  -- O gancho está girando sem dificuldades?
  8,  -- As travas de segurança do guincho estão funcionando?
  9,  -- O sistema de freio do guincho está funcionando?
  10, -- O fim de curso superior está funcionando?
  11, -- O fim de curso inferior está funcionando?
  12, -- O fim de curso para a esquerda está funcionando?
  13, -- O fim de curso para a direita está funcionando?
  14, -- O batente de giro está em boas condições de uso?
  22, -- A corrente possui plaqueta de identificação fixada?
  25, -- O(s) gancho(s) da corrente possui(em) travas de segurança funcionando?
  26, -- O sistema de freio do Troller está funcionando?
  27, -- Os trilhos do pórtico estão desobstruídos?
  28  -- Os sensores anti esmagamento do pórtico estão funcionando?
);

-- Any remaining items default to no automatic alerts
UPDATE public.checklist_items
SET alert_on_yes = false, alert_on_no = false
WHERE order_number NOT IN (
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  11, 12, 13, 14, 15, 16, 17, 18,
  19, 20, 21, 22, 23, 24, 25, 26,
  27, 28
);
