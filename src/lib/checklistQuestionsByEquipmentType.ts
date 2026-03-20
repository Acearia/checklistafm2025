import type { ChecklistItem } from "@/lib/data";
import { applyAlertRuleToItem, normalizeQuestion } from "@/lib/alertRules";

type EquipmentQuestionCategory = "ponte" | "talha" | "portico" | "bobcat";

const EQUIPMENT_TYPE_ALIAS: Record<string, EquipmentQuestionCategory> = {
  "1": "ponte",
  "ponte": "ponte",
  "ponte rolante": "ponte",
  "ponterolante": "ponte",
  "ponte rolante a": "ponte",
  "ponte rolante b": "ponte",
  "ponte rolante c": "ponte",
  "2": "talha",
  "talha": "talha",
  "talha eletrica": "talha",
  "talha elétrica": "talha",
  "talha manual": "talha",
  "talha eletrica 5t": "talha",
  "3": "portico",
  "pórtico": "portico",
  "portico": "portico",
  "portico rolante": "portico",
  "portico movel": "portico",
  "6": "bobcat",
  "bobcat": "bobcat",
  "mini carregadeira": "bobcat",
  "mini-carregadeira": "bobcat",
  "mini carregadeira bobcat": "bobcat",
  "mini carregadeira de direcao deslizante": "bobcat",
  "mini carregadeira de direção deslizante": "bobcat",
  "mini carregadeira direcao deslizante": "bobcat",
  "1239": "bobcat",
};

const normalizeValue = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const aliasEntries = Object.entries(EQUIPMENT_TYPE_ALIAS).map(([key, category]) => [
  normalizeValue(key),
  category,
] as [string, EquipmentQuestionCategory]);

const EQUIPMENT_TYPE_QUESTION_MAP: Record<EquipmentQuestionCategory, string[]> = {
  ponte: [
    "Os cabos de aço apresentam fios partidos?",
    "Os cabos de aço apresentam pontos de amassamento?",
    "Os cabos de aço apresentam alguma dobra?",
    "O sistema de freios do guincho está funcionando?",
    "O gancho está girando sem dificuldades?",
    "O gancho possui trava de segurança funcionando?",
    "O gancho possui sinais de alongamento?",
    "Os ganchos da corrente possuem sinais de desgaste?",
    "As travas de segurança dos ganchos estão funcionando?",
    "A corrente possui a plaqueta de identificação instalada?",
    "As polias estão girando sem dificuldades?",
    "A sinalização sonora funciona durante a movimentação?",
    "O controle possui botão danificado?",
    "O botão de emergência está funcionando?",
    "A estrutura possui grandes danos?",
    "O sistema de freios do Troller está funcionando?",
    "Os elos da corrente possuem sinais de desgaste?",
    "Os elos da corrente possuem sinais de \"alargamento\"?",
    "Os elos da corrente possuem sinais de \"alongamento\"?",
    "O fim de curso superior está funcionando?",
    "O fim de curso inferior está funcionando?",
    "O fim de curso direito está funcionando?",
    "O fim de curso esquerdo está funcionando?",
    "O equipamento apresenta ruídos estranhos?",
  ],
  talha: [
    "O sistema de freios do guincho está funcionando?",
    "O gancho está girando sem dificuldades?",
    "O gancho possui trava de segurança funcionando?",
    "Ao movimentar o equipamento, é possível perceber balanço?",
    "O gancho possui sinais de alongamento?",
    "Os ganchos da corrente possuem sinais de desgaste?",
    "As travas de segurança dos ganchos estão funcionando?",
    "A corrente possui a plaqueta de identificação instalada?",
    "As polias estão girando sem dificuldades?",
    "A sinalização sonora funciona durante a movimentação?",
    "O batente de giro está em boas condições de uso?",
    "O saco recolhedor da corrente possui furos ou rasgos?",
    "O controle possui botão danificado?",
    "O botão de emergência está funcionando?",
    "A estrutura possui grandes danos?",
    "O sistema de freios do Troller está funcionando?",
    "Os elos da corrente possuem sinais de desgaste?",
    "Os elos da corrente possuem sinais de \"alargamento\"?",
    "Os elos da corrente possuem sinais de \"alongamento\"?",
    "O fim de curso superior está funcionando?",
    "O fim de curso inferior está funcionando?",
    "O fim de curso direito está funcionando?",
    "O fim de curso esquerdo está funcionando?",
    "O equipamento apresenta ruídos estranhos?",
  ],
  portico: [
    "O sistema de freios do guincho está funcionando?",
    "O gancho está girando sem dificuldades?",
    "O gancho possui trava de segurança funcionando?",
    "O gancho possui sinais de alongamento?",
    "Os ganchos da corrente possuem sinais de desgaste?",
    "As travas de segurança dos ganchos estão funcionando?",
    "A corrente possui a plaqueta de identificação instalada?",
    "As polias estão girando sem dificuldades?",
    "A sinalização sonora funciona durante a movimentação?",
    "O controle possui botão danificado?",
    "O botão de emergência está funcionando?",
    "A estrutura possui grandes danos?",
    "O sistema de freios do Troller está funcionando?",
    "Os elos da corrente possuem sinais de desgaste?",
    "Os elos da corrente possuem sinais de \"alargamento\"?",
    "Os elos da corrente possuem sinais de \"alongamento\"?",
    "O fim de curso superior está funcionando?",
    "O fim de curso inferior está funcionando?",
    "O fim de curso direito está funcionando?",
    "O fim de curso esquerdo está funcionando?",
    "O freio do pórtico está funcionando?",
    "Os trilhos do pórtico estão desobstruídos?",
    "O equipamento apresenta ruídos estranhos?",
    "Os sensores antiesmagamento do pórtico estão funcionando?",
  ],
  bobcat: [
    "Os faróis dianteiros estão funcionando normalmente?",
    "O stop de freio está funcionando normalmente?",
    "O sinal sonoro (buzina) está funcionando normalmente?",
    "A mini carregadeira possui ré sonora e está funcionando normalmente?",
    "Os pneus estão em boas condições?",
    "O sistema hidráulico (mangueiras e bomba) apresenta algum aspecto que indique vazamento de óleo?",
    "O sistema de frenagem, testado pelo operador no momento da inspeção, apresenta algum problema?",
    "O óleo do motor apresenta nível normal?",
    "O sistema de refrigeração do motor (radiador) apresenta nível de água normal?",
    "A mini carregadeira está com os retrovisores em boas condições de uso?",
    "O cinto de segurança está em boas condições de uso?",
    "A torre de garfos está em boas condições de uso?",
    "Possui catraca para amarração de cargas com risco de queda?",
    "Possui placa de identificação de equipamento?",
    "Diante dos pontos observados nesta inspeção, a mini carregadeira de direção deslizante está em condições de operar normalmente?",
  ],
};

const normalizedQuestionsByType = Object.entries(EQUIPMENT_TYPE_QUESTION_MAP).reduce(
  (acc, [type, questions]) => {
    acc[type as EquipmentQuestionCategory] = new Set(
      questions.map((question) => normalizeQuestion(question))
    );
    return acc;
  },
  {} as Record<EquipmentQuestionCategory, Set<string>>
);

const createSyntheticChecklistItems = (category: EquipmentQuestionCategory): ChecklistItem[] =>
  EQUIPMENT_TYPE_QUESTION_MAP[category].map((question, index) =>
    applyAlertRuleToItem({
      id: `${category}-${index + 1}`,
      question,
      answer: null,
      alertOnYes: false,
      alertOnNo: false,
    })
  );

const getQuestionCategory = (equipmentType?: string | null): EquipmentQuestionCategory | null => {
  if (!equipmentType) return null;
  const normalized = normalizeValue(equipmentType);

  for (const [alias, category] of aliasEntries) {
    if (normalized === alias || normalized.includes(alias)) {
      return category;
    }
  }

  return null;
};

export const filterChecklistItemsByEquipmentType = (
  items: ChecklistItem[],
  equipmentType?: string | null
): ChecklistItem[] => {
  const category = getQuestionCategory(equipmentType);
  if (!category) {
    return items;
  }

  const allowedSet = normalizedQuestionsByType[category];
  if (!allowedSet || allowedSet.size === 0) {
    return items;
  }

  const filtered = items.filter((item) => allowedSet.has(normalizeQuestion(item.question)));
  if (filtered.length > 0) {
    return filtered;
  }

  return createSyntheticChecklistItems(category);
};
