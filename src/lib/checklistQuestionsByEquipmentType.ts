import type { ChecklistItem } from "@/lib/data";
import { normalizeQuestion } from "@/lib/alertRules";

type EquipmentQuestionCategory = "ponte" | "talha" | "portico";

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
  return filtered.length > 0 ? filtered : items;
};
