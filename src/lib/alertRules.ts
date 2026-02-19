export interface AlertRule {
  onYes?: boolean;
  onNo?: boolean;
}

const normalizeAnswer = (value: string | null | undefined): string =>
  (value || "")
    .trim()
    .toLowerCase()
    .replace(/[ãâáà]/g, "a")
    .replace(/[êéè]/g, "e")
    .replace(/[îíì]/g, "i")
    .replace(/[ôóò]/g, "o")
    .replace(/[ûúù]/g, "u");

export const normalizeQuestion = (question: string | null | undefined): string => {
  if (!question) return "";
  const normalized = question
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return normalized
    .replace(/[\s/]+/g, " ")
    .replace(/[^\w\s]/g, "")
    .trim();
};

const QUESTION_ALERT_RULES = new Map<string, AlertRule>();
const SKIP_ALERT_QUESTIONS = new Set<string>([
  normalizeQuestion("A corrente possui a plaqueta de identificação instalada?"),
  normalizeQuestion("A corrente possui plaqueta de identificação instalada?"),
  normalizeQuestion("Corrente possui plaqueta de identificação instalada?"),
]);

const registerRule = (question: string, rule: AlertRule) => {
  QUESTION_ALERT_RULES.set(normalizeQuestion(question), rule);
};

const registerRules = (questions: string[], rule: AlertRule) => {
  questions.forEach((question) => registerRule(question, rule));
};

registerRules(
  [
    "O sistema de freios do guincho está funcionando?",
    "O sistema de freio do guincho está funcionando?",
    "O sistema de freios do troller está funcionando?",
    "O sistema de freio do troller está funcionando?",
    "O gancho está girando sem dificuldades?",
    "As polias estão girando sem dificuldades?",
    "O sinal sonoro está funcionando?",
    "A sinalização sonora funciona durante a movimentação?",
    "O botão de emergência do controle está funcionando?",
    "O botão de emergência está funcionando?",
    "As travas de segurança dos ganchos estão funcionando?",
    "As travas de segurança do guincho estão funcionando?",
    "A corrente possui a plaqueta de identificação instalada?",
    "Os sensores antiesmagamento do pórtico estão funcionando?",
    "Os trilhos do pórtico estão desobstruídos?",
    "O fim de curso superior está funcionando?",
    "O fim de curso inferior está funcionando?",
    "O fim de curso direito está funcionando?",
    "O fim de curso esquerdo está funcionando?",
    "O fim de curso para a direita está funcionando?",
    "O fim de curso para a esquerda está funcionando?",
    "O batente de giro está em boas condições de uso?",
    "O(s) gancho(s) da corrente possui(em) travas de segurança funcionando?",
    "O freio do pórtico está funcionando?",
  ],
  { onNo: true }
);

registerRules(
  [
    "O gancho possui sinais de alongamento?",
    "O equipamento está fazendo algum barulho estranho?",
    "O equipamento apresenta ruídos estranhos?",
    "O Equipamento apresenta ruídos estranhos?",
    "O controle possui botão danificado?",
    "O controle possui botões danificados?",
    "A estrutura possui grandes danos?",
    "Existem grandes danos estruturais no equipamento?",
    "Os ganchos da corrente possuem sinais de desgaste?",
    "O(s) gancho(s) da corrente possui(em) sinais de desgaste?",
    "Os ganchos da corrente possuem sinais de alongamento?",
    "O(s) gancho(s) da corrente possui(em) sinais de alongamento?",
    "Os elos da corrente possuem sinais de desgaste?",
    "A corrente possui elos com desgaste?",
    "Os elos da corrente possuem sinais de \"alargamento\"?",
    "Os elos da corrente possuem sinais de \"alongamento\"?",
    "A corrente possui elos com alongados?",
    "A corrente possui elos alargados?",
    "O saco recolhedor da corrente possui furos ou rasgos?",
    "O cabo de aço possui fios amassados?",
    "O cabo de aço possui fios com dobras?",
    "O cabo de aço possui fios partidos?",
    "Os cabos de aço apresentam fios partidos?",
    "Os cabos de aço apresentam pontos de amassamento?",
    "Os cabos de aço apresentam alguma dobra?",
    "Ao movimentar o equipamento, é possível perceber balanço?",
    "O(s) gancho(s) da corrente possui(em) sinais de desgaste?",
    "O(s) gancho(s) da corrente possui(em) sinais de alongamento?",
  ],
  { onYes: true }
);

registerRule("A corrente possui a plaqueta de identificação instalada?", { onNo: false });
registerRule("Os ganchos da corrente possuem sinais de alongamento?", { onYes: true });

const ALERT_ON_NO_KEYWORDS = [
  "esta funcionando",
  "estao funcionando",
  "em boas condicoes",
  "desobstruid",
  "girando sem dificuldades",
  "funciona durante",
  "fixada",
  "presente",
];

const ALERT_ON_YES_KEYWORDS = [
  "possui sinais",
  "possui dano",
  "possui danificado",
  "esta fazendo",
  "ruidos estranhos",
  "possui furos",
  "possui rasgos",
  "possui fios",
  "possui elos",
];

export const getAlertRule = (
  question: string,
  existing?: AlertRule
): { onYes: boolean; onNo: boolean } => {
  const normalized = normalizeQuestion(question);
  if (SKIP_ALERT_QUESTIONS.has(normalized)) {
    return { onYes: false, onNo: false };
  }

  let onYes = Boolean(existing?.onYes);
  let onNo = Boolean(existing?.onNo);

  const explicitRule = QUESTION_ALERT_RULES.get(normalized);
  if (explicitRule) {
    onYes = Boolean(explicitRule.onYes);
    onNo = Boolean(explicitRule.onNo);
  }

  if (!onYes && !onNo) {
    if (ALERT_ON_NO_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
      onNo = true;
    } else if (
      ALERT_ON_YES_KEYWORDS.some((keyword) => normalized.includes(keyword))
    ) {
      onYes = true;
    }
  }

  return { onYes, onNo };
};

export const shouldTriggerAlert = (
  question: string,
  answer: string | null | undefined,
  existing?: AlertRule
): boolean => {
  if (SKIP_ALERT_QUESTIONS.has(normalizeQuestion(question))) {
    return false;
  }
  const { onYes, onNo } = getAlertRule(question, existing);
  const normalizedAnswer = normalizeAnswer(answer);

  if (normalizedAnswer === "sim") {
    return onYes;
  }

  if (normalizedAnswer === "nao" || normalizedAnswer === "não") {
    return onNo;
  }

  return false;
};

export const applyAlertRuleToItem = <T extends { question: string; alertOnYes?: boolean; alertOnNo?: boolean }>(
  item: T
): T => {
  const { onYes, onNo } = getAlertRule(item.question, {
    onYes: item.alertOnYes,
    onNo: item.alertOnNo,
  });

  return {
    ...item,
    alertOnYes: onYes,
    alertOnNo: onNo,
  };
};
