import { getAlertRule, normalizeQuestion } from "@/lib/alertRules";

export type GoldenRuleAnswer = "Sim" | "NÃ£o" | "N/A";

export interface GoldenRuleQuestionTemplate {
  id: string;
  numero: string;
  texto: string;
  alert_on_yes: boolean;
  alert_on_no: boolean;
  order_number: number;
}

const DEFAULT_NO_RESPONSE_KEYS = new Set([
  "1n5",
  "1n6",
  "1n8",
  "1n9",
  "1n10",
  "1n11",
  "1n12",
  "1n13",
  "1n21",
  "05",
  "06",
  "08",
  "09",
  "10",
  "11",
  "12",
  "13",
  "21",
  "5",
  "6",
  "8",
  "9",
]);

const DEFAULT_GOLDEN_RULE_QUESTION_SOURCES = [
  { id: "1n1", texto: "O(s) operador(es) tem treinamento para a(s) mÃ¡quina(s) ou equipamento(s) que estÃ¡(Ã£o) operando?" },
  { id: "1n2", texto: "O(s) operador(es) estÃ¡(Ã£o) usando corretamente todos os EPIs obrigatÃ³rios?" },
  { id: "1n3", texto: "O(s) operador(es) estÃ¡(Ã£o) autorizado(s) para a(s) mÃ¡quina(s) ou equipamento(s) que estÃ¡(Ã£o) operando?" },
  { id: "1n4", texto: "Os dispositivos de seguranÃ§a das mÃ¡quinas estÃ£o funcionando corretamente?" },
  { id: "1n5", texto: "Ã‰ possÃ­vel identificar algum comportamento que possa causar acidentes de trabalho? Exemplos: correr, brincar, desrespeitar procedimentos etc." },
  { id: "1n6", texto: "Ã‰ possÃ­vel identificar alguma condiÃ§Ã£o insegura no local?" },
  { id: "1n7", texto: "O(s) check list(s) do(s) equipamento(s) do setor estÃ¡(Ã£o) sendo aplicado(s) corretamente?" },
  { id: "1n8", texto: "Ã‰ possÃ­vel identificar alguÃ©m no setor utilizando adorno(s)? Exemplos: alianÃ§a, corrente, relÃ³gio etc." },
  { id: "1n9", texto: "Ã‰ possÃ­vel identificar alguÃ©m de cabelos longos e soltos no setor?" },
  { id: "1n10", texto: "Ã‰ possÃ­vel identificar alguÃ©m com roupas de materiais sintÃ©ticos no setor? Exemplos: lÃ£, viscose etc." },
  { id: "1n11", texto: "Existe no setor alguma atividade sendo executada por pessoa nÃ£o habilitada?" },
  { id: "1n12", texto: "Ã‰ possÃ­vel identificar alguma ferramenta improvisada, defeituosa ou desgastada, sendo usada ou armazenada no setor?" },
  { id: "1n13", texto: "Ã‰ possÃ­vel identificar alguÃ©m no setor utilizando ou em posse de celular?" },
  { id: "1n14", texto: "Os chuveiros e lava olhos estÃ£o funcionando corretamente e estÃ£o desobstruÃ­dos?" },
  { id: "1n15", texto: "Os extintores do local estÃ£o pressurizados, com a recarga em dia e estÃ£o desobstruÃ­dos?" },
  { id: "1n16", texto: "Alarme de incÃªndio estÃ¡ funcionando?" },
  { id: "1n17", texto: "Detector de fumaÃ§a estÃ¡ funcionando?" },
  { id: "1n18", texto: "Checklist da empilhadeira estÃ¡ sendo realizado?" },
  { id: "1n19", texto: "Checklist da transpaleteira estÃ¡ sendo realizado?" },
  { id: "1n20", texto: "Checklist da mini carregadeira estÃ¡ sendo realizado?" },
  { id: "1n21", texto: "Existe EPIs descartados dentro do setor?" },
  { id: "1n22", texto: "Setor estÃ¡ limpo e organizado?" },
  { id: "1n23", texto: "Rotas de fugas estÃ£o desobstruÃ­das?" },
  { id: "1n24", texto: "Blocos autÃ´nomos e luminÃ¡rias de saÃ­da de emergÃªncia estÃ£o funcionando e ligadas na energia?" },
  { id: "1n25", texto: "Extintores e hidrantes estÃ£o devidamente sinalizados?" },
  { id: "1n26", texto: "Hidrantes foram testados e estÃ£o funcionando corretamente?" },
  { id: "1n27", texto: "As caixas de hidrantes estÃ£o com conectores storz, chaves e mangueiras em quantidades corretas?" },
  { id: "1n28", texto: "Mangueiras de hidrante estÃ£o com manutenÃ§Ã£o em dia?" },
  {
    id: "1n29",
    texto: "As escadas portÃ¡teis existentes no setor estÃ£o em condiÃ§Ãµes seguras de uso?",
    alert_on_no: true,
  },
  {
    id: "1n30",
    texto: "Existe algum mobiliÃ¡rio de trabalho que pode causar desconforto ergonÃ´mico ao colaborador?",
    alert_on_yes: true,
  }
] as const;

const formatQuestionNumber = (value: number) => String(value).padStart(2, "0");



const buildDefaultTemplate = (
  source: { id: string; texto: string; alert_on_yes?: boolean; alert_on_no?: boolean },
  index: number,
): GoldenRuleQuestionTemplate => {
  const alertRule = getAlertRule(source.texto);

  return {
    id: source.id,
    numero: formatQuestionNumber(index + 1),
    texto: source.texto,
    alert_on_yes: Boolean(typeof source.alert_on_yes === "boolean" ? source.alert_on_yes : alertRule.onYes),
    alert_on_no: Boolean(typeof source.alert_on_no === "boolean" ? source.alert_on_no : alertRule.onNo),
    order_number: index + 1,
  };
};

export const DEFAULT_GOLDEN_RULE_QUESTION_ITEMS: GoldenRuleQuestionTemplate[] =
  DEFAULT_GOLDEN_RULE_QUESTION_SOURCES.map(buildDefaultTemplate);

const normalizeQuestionOrder = (value: unknown, fallback: number) => {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;
  return fallback;
};

const buildAlertRuleFromRow = (
  row: Partial<GoldenRuleQuestionTemplate> & { question?: string; order_number?: number },
) => {
  const explicitFlags = Boolean(row.alert_on_yes) || Boolean(row.alert_on_no);
  if (explicitFlags) {
    return {
      onYes: Boolean(row.alert_on_yes),
      onNo: Boolean(row.alert_on_no),
    };
  }

  return getAlertRule(String(row.question || row.texto || ""));
};

export const buildGoldenRuleQuestionItems = (
  rows?: Array<Partial<GoldenRuleQuestionTemplate> & { question?: string; order_number?: number }> | null,
) => {
  if (!rows || rows.length === 0) {
    return DEFAULT_GOLDEN_RULE_QUESTION_ITEMS;
  }

  const mapped = rows
    .map((row, index): GoldenRuleQuestionTemplate | null => {
      const texto = String(row.question || row.texto || "").trim();
      if (!texto) return null;

      const orderNumber = normalizeQuestionOrder(row.order_number, index + 1);
      const alertRule = buildAlertRuleFromRow(row);

      return {
        id: String(row.id || `golden-rule-question-${orderNumber}`),
        numero: formatQuestionNumber(orderNumber),
        texto,
        alert_on_yes: Boolean(alertRule.onYes),
        alert_on_no: Boolean(alertRule.onNo),
        order_number: orderNumber,
      };
    })
    .filter((item): item is GoldenRuleQuestionTemplate => Boolean(item));

  const byId = new Map<string, GoldenRuleQuestionTemplate>();
  const byNumero = new Map<string, GoldenRuleQuestionTemplate>();
  const byTexto = new Map<string, GoldenRuleQuestionTemplate>();

  mapped.forEach((item) => {
    const id = String(item.id || "").trim().toLowerCase();
    const numero = String(item.numero || "").trim();
    const texto = String(item.texto || "").trim();
    if (id) byId.set(id, item);
    if (numero) byNumero.set(numero.replace(/^0+/, "") || "0", item);
    if (texto) byTexto.set(normalizeQuestion(texto), item);
  });

  const mergedDefaults = DEFAULT_GOLDEN_RULE_QUESTION_ITEMS.map((defaultItem) => {
    const matchedRow =
      byId.get(defaultItem.id.toLowerCase()) ||
      byNumero.get(defaultItem.numero.replace(/^0+/, "") || "0") ||
      byTexto.get(normalizeQuestion(defaultItem.texto));

    if (!matchedRow) {
      return defaultItem;
    }

    return {
      ...defaultItem,
      texto: matchedRow.texto || defaultItem.texto,
      alert_on_yes: matchedRow.alert_on_yes,
      alert_on_no: matchedRow.alert_on_no,
      order_number: normalizeQuestionOrder(matchedRow.order_number, defaultItem.order_number),
    };
  });

  const matchedRowIds = new Set<string>();
  mergedDefaults.forEach((defaultItem) => {
    const matchedRow =
      byId.get(defaultItem.id.toLowerCase()) ||
      byNumero.get(defaultItem.numero.replace(/^0+/, "") || "0") ||
      byTexto.get(normalizeQuestion(defaultItem.texto));

    if (matchedRow) {
      matchedRowIds.add(matchedRow.id);
    }
  });

  const customItems = mapped.filter((item) => !matchedRowIds.has(item.id));

  return [...mergedDefaults, ...customItems].sort((a, b) => {
    const byOrder = (a.order_number || 0) - (b.order_number || 0);
    if (byOrder !== 0) return byOrder;
    return a.texto.localeCompare(b.texto, "pt-BR");
  });
};

export const buildGoldenRuleQuestionLookup = (questions: GoldenRuleQuestionTemplate[]) => {
  const byId = new Map<string, GoldenRuleQuestionTemplate>();
  const byNumero = new Map<string, GoldenRuleQuestionTemplate>();
  const byTexto = new Map<string, GoldenRuleQuestionTemplate>();

  questions.forEach((question) => {
    const id = String(question.id || "").trim();
    const numero = String(question.numero || "").trim();
    const texto = String(question.texto || "").trim();
    if (id) byId.set(id.toLowerCase(), question);
    if (numero) byNumero.set(numero.replace(/^0+/, "") || "0", question);
    if (texto) byTexto.set(normalizeQuestion(texto), question);
  });

  return { byId, byNumero, byTexto };
};

export const resolveGoldenRuleQuestionExpectedAnswer = (
  question:
    | Pick<GoldenRuleQuestionTemplate, "id" | "numero" | "texto" | "alert_on_yes" | "alert_on_no">
    | null
    | undefined,
) => {
  if (!question) return "Sim" as GoldenRuleAnswer;

  if (question.alert_on_yes && !question.alert_on_no) return "NÃ£o" as GoldenRuleAnswer;
  if (question.alert_on_no && !question.alert_on_yes) return "Sim" as GoldenRuleAnswer;

  const explicitQuestion = String(question.texto || "").trim();
  const inferredRule = explicitQuestion ? getAlertRule(explicitQuestion) : { onYes: false, onNo: false };
  if (inferredRule.onYes) return "NÃ£o" as GoldenRuleAnswer;
  if (inferredRule.onNo) return "Sim" as GoldenRuleAnswer;

  const questionId = String(question.id || "").trim();
  const questionNumero = String(question.numero || "").trim();
  if (DEFAULT_NO_RESPONSE_KEYS.has(questionId) || DEFAULT_NO_RESPONSE_KEYS.has(questionNumero)) {
    return "NÃ£o" as GoldenRuleAnswer;
  }

  return "Sim" as GoldenRuleAnswer;
};

export const resolveGoldenRuleResponseExpectedAnswer = (
  response:
    | {
        codigo?: string | null;
        numero?: string | null;
        pergunta?: string | null;
        alert_on_yes?: boolean | null;
        alert_on_no?: boolean | null;
      }
    | null
    | undefined,
  questions: GoldenRuleQuestionTemplate[] = DEFAULT_GOLDEN_RULE_QUESTION_ITEMS,
) => {
  if (!response) return "Sim" as GoldenRuleAnswer;

  if (Boolean(response.alert_on_yes) && !Boolean(response.alert_on_no)) return "NÃ£o" as GoldenRuleAnswer;
  if (Boolean(response.alert_on_no) && !Boolean(response.alert_on_yes)) return "Sim" as GoldenRuleAnswer;

  const lookup = buildGoldenRuleQuestionLookup(questions);
  const codigo = String(response.codigo || "").trim().toLowerCase();
  const numeroRaw = String(response.numero || "").trim();
  const numeroKey = numeroRaw.replace(/^0+/, "") || numeroRaw;
  const perguntaKey = normalizeQuestion(String(response.pergunta || ""));

  const directMatch =
    (codigo ? lookup.byId.get(codigo) : undefined) ||
    (numeroKey ? lookup.byNumero.get(numeroKey) : undefined) ||
    (perguntaKey ? lookup.byTexto.get(perguntaKey) : undefined);

  if (directMatch) {
    return resolveGoldenRuleQuestionExpectedAnswer(directMatch);
  }

  if (String(response.pergunta || "").trim()) {
    const inferredRule = getAlertRule(String(response.pergunta));
    if (inferredRule.onYes) return "NÃ£o" as GoldenRuleAnswer;
    if (inferredRule.onNo) return "Sim" as GoldenRuleAnswer;
  }

  if (DEFAULT_NO_RESPONSE_KEYS.has(codigo) || DEFAULT_NO_RESPONSE_KEYS.has(numeroRaw) || DEFAULT_NO_RESPONSE_KEYS.has(numeroKey)) {
    return "NÃ£o" as GoldenRuleAnswer;
  }

  return "Sim" as GoldenRuleAnswer;
};

export const isGoldenRuleResponseOutOfPattern = (
  response:
    | {
        codigo?: string | null;
        numero?: string | null;
        pergunta?: string | null;
        resposta?: GoldenRuleAnswer | string | null;
        alert_on_yes?: boolean | null;
        alert_on_no?: boolean | null;
      }
    | null
    | undefined,
  questions: GoldenRuleQuestionTemplate[] = DEFAULT_GOLDEN_RULE_QUESTION_ITEMS,
) => {
  if (!response) return false;
  const answer = String(response.resposta || "").trim() as GoldenRuleAnswer;
  if (answer === "N/A") return false;

  const expectedAnswer = resolveGoldenRuleResponseExpectedAnswer(response, questions);
  return answer !== expectedAnswer;
};
