import React, { useEffect, useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import { CheckCircle, ClipboardList, Upload } from "lucide-react";
import SignatureCanvas from "@/components/SignatureCanvas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { Textarea } from "@/components/ui/textarea";
import SearchableStringSelect, {
  type SearchableStringOption,
} from "@/components/ui/searchable-string-select";
import { useSupabaseData } from "@/hooks/useSupabaseData";
import { useToast } from "@/hooks/use-toast";
import { buildImagePreviewDataUrl } from "@/lib/attachmentPreview";
import {
  buildGoldenRuleQuestionItems,
  resolveGoldenRuleQuestionExpectedAnswer,
} from "@/lib/goldenRuleQuestions";
import { FIXED_FORM_SECTORS, resolveFixedSectorName } from "@/lib/fixed-sectors";
import { buildStoredPassword } from "@/lib/password-utils";
import {
  accidentActionPlanService,
  goldenRuleService,
  leaderService,
  operatorService,
  type AccidentActionPlanRecordPayload,
} from "@/lib/supabase-service";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

type SignatureKey = "ass_tst" | "ass_gestor" | "ass_acomp";
type QuestionAnswer = "Sim" | "Não" | "N/A";

interface QuestionItem {
  id: string;
  numero: string;
  texto: string;
  alert_on_yes?: boolean;
  alert_on_no?: boolean;
  order_number?: number;
}

interface AttachmentMeta {
  name: string;
  size: number;
  type: string;
  data_url?: string;
}

interface QuestionResponse {
  codigo: string;
  numero: string;
  pergunta: string;
  resposta: QuestionAnswer;
  comentario: string;
  foto: AttachmentMeta | null;
  evidencias?: Array<{
    id?: string;
    comentario: string;
    foto: AttachmentMeta | null;
  }>;
}

interface InvestigacaoChecklistRecord {
  id: string;
  numero_inspecao: number;
  created_at: string;
  titulo: string;
  setor: string;
  gestor: string;
  tecnico_seg: string;
  acompanhante: string;
  respostas: QuestionResponse[];
  ass_tst: string;
  ass_gestor: string;
  ass_acomp: string;
  anexos: AttachmentMeta[];
}

interface GoldenRuleHistoryRecord {
  id: string;
  created_at: string;
  setor: string;
}

interface PeriodicQuestionLock {
  locked: boolean;
  lastInspectionAt: Date | null;
  unlockAt: Date | null;
}

interface PlanoAcaoContext {
  fonte: "regra-ouro";
  registro_id: string;
  numero_referencia: number;
  data_referencia: string;
  titulo: string;
  setor: string;
  tecnico: string;
  descricao_ocorrencia: string;
  origem: string;
  descricao_resumida_acao?: string;
  descricao_acao?: string;
  question_id?: string;
  question_numero?: string;
  question_texto?: string;
  question_resposta?: QuestionAnswer;
}

interface ActionPlanDraft {
  descricao_resumida_acao: string;
  responsavel_execucao: string;
  inicio_planejado: string;
  termino_planejado: string;
  descricao_acao: string;
}

interface QuestionState {
  answer: QuestionAnswer;
  evidences: Array<{
    id: string;
    comment: string;
    photo: File | null;
  }>;
}

const STORAGE_KEY = "checklistafm-regras-de-ouro";
const STORAGE_EVENT = "checklistafm-regras-de-ouro-updated";
const COUNTER_KEY = "checklistafm-regras-de-ouro-counter";
const PLANO_ACAO_CONTEXT_KEY = "checklistafm-plano-acao-context";
const ACTION_PLAN_STORAGE_KEY = "checklistafm-planos-acao-acidente";
const ACTION_PLAN_COUNTER_KEY = "checklistafm-plano-acao-counter";
const ACTION_PLAN_STORAGE_EVENT = "checklistafm-plano-acao-updated";
const PERIODIC_15_DAY_QUESTION_IDS = new Set(["1n15", "1n16", "1n17"]);
const PERIODIC_15_DAY_INTERVAL_DAYS = 15;
const REGRAS_DE_OURO_TECNICOS = [
  "CELSO PEREIRA",
  "JOÃO PAULO",
] as const;

const QUESTION_ITEMS: QuestionItem[] = [
  {
    id: "1n1",
    numero: "01",
    texto:
      "O(s) operador(es) tem treinamento para a(s) máquina(s) ou equipamento(s) que está(ão) operando?",
  },
  {
    id: "1n2",
    numero: "02",
    texto: "O(s) operador(es) está(ão) usando corretamente todos os EPIs obrigatórios?",
  },
  {
    id: "1n3",
    numero: "03",
    texto:
      "O(s) operador(es) está(ão) autorizado(s) para a(s) máquina(s) ou equipamento(s) que está(ão) operando?",
  },
  {
    id: "1n4",
    numero: "04",
    texto: "Os dispositivos de segurança das máquinas estão funcionando corretamente?",
  },
  {
    id: "1n5",
    numero: "05",
    texto:
      "É possível identificar algum comportamento que possa causar acidentes de trabalho? Exemplos: correr, brincar, desrespeitar procedimentos etc.",
  },
  {
    id: "1n6",
    numero: "06",
    texto: "É possível identificar alguma condição insegura no local?",
  },
  {
    id: "1n7",
    numero: "07",
    texto:
      "O(s) check list(s) do(s) equipamento(s) do setor está(ão) sendo aplicado(s) corretamente?",
  },
  {
    id: "1n8",
    numero: "08",
    texto:
      "É possível identificar alguém no setor utilizando adorno(s)? Exemplos: aliança, corrente, relógio etc.",
  },
  {
    id: "1n9",
    numero: "09",
    texto: "É possível identificar alguém de cabelos longos e soltos no setor?",
  },
  {
    id: "1n10",
    numero: "10",
    texto:
      "É possível identificar alguém com roupas de materiais sintéticos no setor? Exemplos: lã, viscose etc.",
  },
  {
    id: "1n11",
    numero: "11",
    texto: "Existe no setor alguma atividade sendo executada por pessoa não habilitada?",
  },
  {
    id: "1n12",
    numero: "12",
    texto:
      "É possível identificar alguma ferramenta improvisada, defeituosa ou desgastada, sendo usada ou armazenada no setor?",
  },
  {
    id: "1n13",
    numero: "13",
    texto: "É possível identificar alguém no setor utilizando ou em posse de celular?",
  },
  {
    id: "1n14",
    numero: "14",
    texto: "Os chuveiros e lava olhos estão funcionando corretamente e estão desobstruídos?",
  },
  {
    id: "1n15",
    numero: "15",
    texto:
      "Os extintores do local estão pressurizados, com a recarga em dia e estão desobstruídos?",
  },
  {
    id: "1n16",
    numero: "16",
    texto: "Alarme de incêndio está funcionando?",
  },
  {
    id: "1n17",
    numero: "17",
    texto: "Detector de fumaça está funcionando?",
  },
  {
    id: "1n18",
    numero: "18",
    texto: "Checklist da empilhadeira está sendo realizado?",
  },
  {
    id: "1n19",
    numero: "19",
    texto: "Checklist da transpaleteira está sendo realizado?",
  },
  {
    id: "1n20",
    numero: "20",
    texto: "Checklist da mini carregadeira está sendo realizado?",
  },
  {
    id: "1n21",
    numero: "21",
    texto: "Existe EPIs descartados dentro do setor?",
  },
  {
    id: "1n22",
    numero: "22",
    texto: "Setor está limpo e organizado?",
  },
  {
    id: "1n23",
    numero: "23",
    texto: "Rotas de fugas estão desobstruídas?",
  },
  {
    id: "1n24",
    numero: "24",
    texto:
      "Blocos autônomos e luminárias de saída de emergência estão funcionando e ligadas na energia?",
  },
  {
    id: "1n25",
    numero: "25",
    texto: "Extintores e hidrantes estão devidamente sinalizados?",
  },
  {
    id: "1n26",
    numero: "26",
    texto: "Hidrantes foram testados e estão funcionando corretamente?",
  },
  {
    id: "1n27",
    numero: "27",
    texto:
      "As caixas de hidrantes estão com conectores storz, chaves e mangueiras em quantidades corretas?",
  },
  {
    id: "1n28",
    numero: "28",
    texto: "Mangueiras de hidrante estão com manutenção em dia?",
  },
];

const normalizeText = (value: unknown) => {
  const text = value == null ? "" : String(value);
  if (!/[ÃÂ\uFFFD]/.test(text)) return text;
  try {
    const bytes = Uint8Array.from(Array.from(text, (char) => char.charCodeAt(0) & 0xff));
    return new TextDecoder("utf-8").decode(bytes).replace(/\uFFFD+/g, "");
  } catch {
    return text.replace(/\uFFFD+/g, "");
  }
};

const dedupeSorted = (values: string[]) =>
  Array.from(new Set(values.filter((item) => item.trim().length > 0))).sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );

const mergeSearchableStringOptions = (...groups: SearchableStringOption[][]) => {
  const unique = new Map<string, SearchableStringOption>();

  groups.flat().forEach((option) => {
    const key = normalizeText(option.value).trim().toLocaleLowerCase("pt-BR");
    if (!key || unique.has(key)) return;
    unique.set(key, option);
  });

  return Array.from(unique.values()).sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
};

const withCurrentSearchableStringOption = (options: SearchableStringOption[], value: string) => {
  const normalizedValue = normalizeText(value).trim();
  if (!normalizedValue) return options;

  const normalizedKey = normalizedValue.toLocaleLowerCase("pt-BR");
  if (options.some((option) => normalizeText(option.value).trim().toLocaleLowerCase("pt-BR") === normalizedKey)) {
    return options;
  }

  return [
    {
      value: normalizedValue,
      label: normalizedValue,
      searchText: normalizedValue,
    },
    ...options,
  ];
};

const normalizeSectorKey = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

const LEGACY_SECTOR_ALIASES: Record<string, string> = {
  EXPEDIO: "EXPEDICAO",
  REBARBAO: "REBARBACAO",
  FUSO: "FUSAO",
  MANUTENO: "MANUTENCAO",
  PRODUO: "PRODUCAO",
  MODELAO: "MODELACAO",
};

const normalizeSectorName = (value: unknown) => {
  const safeValue = normalizeText(value).trim();
  if (!safeValue) return "";

  const normalizedKey = normalizeSectorKey(safeValue);
  const sectorMap: Record<string, string> = {
    EXPEDIO: "EXPEDIÇÃO",
    EXPEDICAO: "EXPEDIÇÃO",
    REBARBAO: "REBARBAÇÃO",
    REBARBACAO: "REBARBAÇÃO",
    FUSO: "FUSÃO",
    FUSAO: "FUSÃO",
    MANUTENO: "MANUTENÇÃO",
    MANUTENCAO: "MANUTENÇÃO",
    PRODUO: "PRODUÇÃO",
    PRODUCAO: "PRODUÇÃO",
    MODELAO: "MODELAÇÃO",
    MODELACAO: "MODELAÇÃO",
    "LOGISTICA INTERNA": "LOGÍSTICA INTERNA",
  };

  if (sectorMap[normalizedKey]) return sectorMap[normalizedKey];
  if (normalizedKey.startsWith("EXPEDI")) return "EXPEDIÇÃO";
  if (normalizedKey.startsWith("REBARBA")) return "REBARBAÇÃO";
  if (normalizedKey.startsWith("FUS")) return "FUSÃO";
  if (normalizedKey.startsWith("MANUTEN")) return "MANUTENÇÃO";
  if (normalizedKey.startsWith("PRODU")) return "PRODUÇÃO";
  if (normalizedKey.startsWith("MODEL")) return "MODELAÇÃO";
  if (normalizedKey.startsWith("LOGISTICA INTERNA")) return "LOGÍSTICA INTERNA";

  return safeValue;
};

const normalizePersonKey = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleUpperCase("pt-BR")
    .replace(/\s+/g, " ")
    .trim();

const buildManualIdentifier = (value: string) =>
  normalizePersonKey(value)
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "usuario";

const buildManualSeed = () =>
  globalThis.crypto?.randomUUID?.() ||
  `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const getCounterValue = () => {
  if (typeof window === "undefined") return 0;
  const parsed = Number.parseInt(localStorage.getItem(COUNTER_KEY) || "0", 10);
  return Number.isNaN(parsed) ? 0 : Math.max(parsed, 0);
};

const getSectorComparisonKey = (value: unknown) => normalizeSectorKey(normalizeText(value).trim());

const parseDateOrNull = (value: unknown) => {
  const text = value == null ? "" : String(value).trim();
  if (!text) return null;

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const readStoredGoldenRuleHistory = (): GoldenRuleHistoryRecord[] => {
  if (typeof window === "undefined") return [];

  try {
    const rawStored = localStorage.getItem(STORAGE_KEY) || "[]";
    const parsed = JSON.parse(rawStored);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item: any) => ({
        id: String(item?.id || "").trim(),
        created_at: String(item?.created_at || "").trim(),
        setor: String(item?.setor || "").trim(),
      }))
      .filter((item) => item.id && item.created_at && item.setor);
  } catch {
    return [];
  }
};

const mergeGoldenRuleHistory = (records: GoldenRuleHistoryRecord[]) => {
  const byId = new Map<string, GoldenRuleHistoryRecord>();

  records.forEach((record) => {
    if (!record.id) return;
    byId.set(record.id, record);
  });

  return Array.from(byId.values());
};

const getPeriodicQuestionLock = (
  setor: unknown,
  history: GoldenRuleHistoryRecord[],
): PeriodicQuestionLock => {
  const sectorKey = getSectorComparisonKey(setor);
  if (!sectorKey) {
    return {
      locked: false,
      lastInspectionAt: null,
      unlockAt: null,
    };
  }

  const latestInspection = history.reduce<
    (GoldenRuleHistoryRecord & { createdAt: Date }) | null
  >((latest, record) => {
    const recordSectorKey = getSectorComparisonKey(record.setor);
    if (recordSectorKey !== sectorKey) return latest;

    const createdAt = parseDateOrNull(record.created_at);
    if (!createdAt) return latest;

    if (!latest || createdAt.getTime() > latest.createdAt.getTime()) {
      return {
        ...record,
        createdAt,
      };
    }

    return latest;
  }, null);

  if (!latestInspection) {
    return {
      locked: false,
      lastInspectionAt: null,
      unlockAt: null,
    };
  }

  const unlockAt = addDays(latestInspection.createdAt, PERIODIC_15_DAY_INTERVAL_DAYS);
  return {
    locked: Date.now() < unlockAt.getTime(),
    lastInspectionAt: latestInspection.createdAt,
    unlockAt,
  };
};

const formatInspectionNumber = (value: number) => String(value).padStart(3, "0");
const formatDateForInput = (value: string) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value.slice(0, 10);
  }
  return format(parsed, "yyyy-MM-dd");
};
const DEFAULT_NAO_QUESTION_IDS = new Set([
  "1n5",
  "1n6",
  "1n8",
  "1n9",
  "1n10",
  "1n11",
  "1n12",
  "1n13",
  "1n21",
]);
const getDefaultAnswer = (questionId: string): QuestionAnswer =>
  DEFAULT_NAO_QUESTION_IDS.has(questionId) ? "Não" : "Sim";

const isResponseOutOfPattern = (
  questionId: string,
  answer: QuestionAnswer,
  questions: QuestionItem[] = QUESTION_ITEMS,
) => {
  const question =
    questions.find((item) => item.id === questionId || item.numero === questionId) || null;
  const expectedAnswer = resolveGoldenRuleQuestionExpectedAnswer(question as any);
  return answer !== "N/A" && answer !== expectedAnswer;
};

const buildNonConformitySummary = (
  responses: QuestionResponse[],
  questions: QuestionItem[] = QUESTION_ITEMS,
) => {
  const nonConformingResponses = responses.filter((response) =>
    isResponseOutOfPattern(response.codigo, response.resposta, questions),
  );

  if (nonConformingResponses.length === 0) {
    return "Regra de Ouro sem n\u00e3o conformidades detalhadas.";
  }

  return nonConformingResponses
    .map((response) => `- ${response.numero || response.codigo}: ${response.pergunta}`)
    .join("\n");
};

const buildPlanoAcaoContext = (
  record: InvestigacaoChecklistRecord,
  questions: QuestionItem[] = QUESTION_ITEMS,
): PlanoAcaoContext => ({
  fonte: "regra-ouro",
  registro_id: record.id,
  numero_referencia: Number(record.numero_inspecao) || 0,
  data_referencia: formatDateForInput(record.created_at || ""),
  titulo: record.titulo || `Regra de Ouro ${formatInspectionNumber(record.numero_inspecao)}`,
  setor: record.setor || "",
  tecnico: record.tecnico_seg || "",
  descricao_ocorrencia: buildNonConformitySummary(record.respostas, questions),
  origem: "Regra de Ouro",
  descricao_resumida_acao: "Tratar irregularidades identificadas na Regra de Ouro",
});

const getActionPlanCounterValue = () => {
  if (typeof window === "undefined") return 0;
  return Number(localStorage.getItem(ACTION_PLAN_COUNTER_KEY) || 0) || 0;
};

const getNextActionPlanNumber = () => {
  const next = getActionPlanCounterValue() + 1;
  localStorage.setItem(ACTION_PLAN_COUNTER_KEY, String(next));
  return next;
};

const parseStoredActionPlans = (): Array<Record<string, unknown>> => {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(ACTION_PLAN_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Erro ao ler planos de acao locais:", error);
    return [];
  }
};

const createActionPlanDraft = (_item: QuestionItem, _response: QuestionState): ActionPlanDraft => ({
  descricao_resumida_acao: "",
  responsavel_execucao: "",
  inicio_planejado: "",
  termino_planejado: "",
  descricao_acao: "",
});

const storePlanoAcaoContext = (context: PlanoAcaoContext) => {
  if (typeof window === "undefined") return;

  try {
    const payload = JSON.stringify(context);
    sessionStorage.setItem(PLANO_ACAO_CONTEXT_KEY, payload);
    localStorage.setItem(PLANO_ACAO_CONTEXT_KEY, payload);
  } catch (error) {
    console.warn("[InvestigacaoAcidente2] Nao foi possivel persistir o contexto do plano de acao.", error);
  }
};

const buildPlanoAcaoUrl = (context: PlanoAcaoContext) => {
  const params = new URLSearchParams({
    origem: "admin",
    fonte: "regra-ouro",
    registro: context.registro_id,
    ocorrencia: String(context.numero_referencia || 0),
  });

  if (context.question_id) {
    params.set("pergunta", context.question_id);
  }

  return `/plano-acao-acidente?${params.toString()}`;
};

const buildQuestionPlanoAcaoContext = (
  item: QuestionItem,
  response: QuestionState,
  currentState: {
    previewNumber: number;
    titulo: string;
    setor: string;
    tecnicoSeg: string;
  },
): PlanoAcaoContext => {
  const { previewNumber: currentPreviewNumber, titulo: currentTitulo, setor: currentSetor, tecnicoSeg: currentTecnico } =
    currentState;

  return {
    fonte: "regra-ouro",
    registro_id: `rascunho-regra-ouro-${currentPreviewNumber}-${item.id}`,
    numero_referencia: currentPreviewNumber,
    data_referencia: formatDateForInput(new Date().toISOString()),
    titulo: currentTitulo || `Regra de Ouro ${formatInspectionNumber(currentPreviewNumber)}`,
    setor: currentSetor || "",
    tecnico: currentTecnico || "",
    descricao_ocorrencia: [
      `Pergunta ${item.numero}: ${item.texto}`,
      `Resposta registrada: ${normalizeText(response.answer).trim()}`,
      response.evidences.length > 0 ? `Evidencias anexadas: ${response.evidences.length}` : "",
      "Irregularidade identificada. Abrir plano de acao para definir responsavel, prazo e tratativa.",
    ]
      .filter(Boolean)
      .join("\n"),
    origem: "Regra de Ouro",
    descricao_resumida_acao: `Tratar irregularidade da pergunta ${item.numero}`,
    descricao_acao: "",
    question_id: item.id,
    question_numero: item.numero,
    question_texto: item.texto,
    question_resposta: normalizeText(response.answer).trim() as QuestionAnswer,
  };
};

const openPlanoAcaoForQuestion = (
  item: QuestionItem,
  response: QuestionState,
  currentState: {
    previewNumber: number;
    titulo: string;
    setor: string;
    tecnicoSeg: string;
  },
  openQuestionId: string | null,
  setOpenQuestionId: React.Dispatch<React.SetStateAction<string | null>>,
  setActionPlanDrafts: React.Dispatch<React.SetStateAction<Record<string, ActionPlanDraft>>>,
) => {
  setOpenQuestionId((previous) => (previous === item.id ? null : item.id));
  setActionPlanDrafts((previous) =>
    previous[item.id] ? previous : { ...previous, [item.id]: createActionPlanDraft(item, response) },
  );
};

const buildActionPlanPayloadForQuestion = (
  item: QuestionItem,
  response: QuestionState,
  draft: ActionPlanDraft,
  savedRecord: InvestigacaoChecklistRecord,
  finalInspectionNumber: number,
): AccidentActionPlanRecordPayload => {
  const now = new Date().toISOString();
  const questionContext = buildQuestionPlanoAcaoContext(item, response, {
    previewNumber: finalInspectionNumber,
    titulo: savedRecord.titulo,
    setor: savedRecord.setor,
    tecnicoSeg: savedRecord.tecnico_seg,
  });

  return {
    id:
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`,
    numero_plano: getNextActionPlanNumber(),
    created_at: now,
    updated_at: now,
    numero_ocorrencia: finalInspectionNumber,
    data_ocorrencia: questionContext.data_referencia || formatDateForInput(savedRecord.created_at || now),
    prioridade_ocorrencia: "Baixa",
    descricao_ocorrencia: [
      questionContext.descricao_ocorrencia,
      draft.descricao_acao.trim() ? `\n\nAção proposta:\n${draft.descricao_acao.trim()}` : "",
    ]
      .filter(Boolean)
      .join(""),
    origem: "Regra de Ouro",
    descricao_resumida_acao:
      draft.descricao_resumida_acao.trim() || questionContext.descricao_resumida_acao || `Tratar irregularidade da pergunta ${item.numero}`,
    severidade: "",
    probabilidade: "",
    prioridade: "Baixa",
    status: "Aberta",
    responsavel_execucao: draft.responsavel_execucao.trim() || savedRecord.tecnico_seg || savedRecord.gestor || "Sistema",
    inicio_planejado: draft.inicio_planejado.trim(),
    termino_planejado: draft.termino_planejado.trim(),
    acao_iniciada: "",
    acao_finalizada: "",
    descricao_acao: draft.descricao_acao.trim(),
    observacoes_conclusao: "",
    data_eficacia: "",
    observacao_eficacia: "",
    comentarios: [
      {
        id:
          typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random()}`,
        texto: [
          `Plano iniciado a partir da Regra de Ouro ${formatInspectionNumber(finalInspectionNumber)}.`,
          `Pergunta ${item.numero}: ${item.texto}`,
          `Resposta registrada: ${normalizeText(response.answer).trim()}`,
        ].join("\n"),
        autor: savedRecord.tecnico_seg || "Sistema",
        created_at: now,
      },
    ],
  };
};

const persistActionPlansForInspection = async (
  savedRecord: InvestigacaoChecklistRecord,
  finalInspectionNumber: number,
  responses: Record<string, QuestionState>,
  actionPlanDrafts: Record<string, ActionPlanDraft>,
  questions: QuestionItem[] = QUESTION_ITEMS,
) => {
  const nonConformingItems = questions.filter((item) =>
    isResponseOutOfPattern(item.id, responses[item.id]?.answer || "N/A", questions),
  );

  if (nonConformingItems.length === 0) {
    return 0;
  }

  const existingPlans = parseStoredActionPlans();
  const persistedPlans = [...existingPlans];

  for (const item of nonConformingItems) {
    const response = responses[item.id];
    if (!response) continue;

    const draft = actionPlanDrafts[item.id] || createActionPlanDraft(item, response);
    const payload = buildActionPlanPayloadForQuestion(item, response, draft, savedRecord, finalInspectionNumber);
    storePlanoAcaoContext({
      fonte: "regra-ouro",
      registro_id: savedRecord.id,
      numero_referencia: finalInspectionNumber,
      data_referencia: savedRecord.created_at,
      titulo: savedRecord.titulo,
      setor: savedRecord.setor,
      tecnico: savedRecord.tecnico_seg,
      descricao_ocorrencia: payload.descricao_ocorrencia || "",
      origem: payload.origem || "Regra de Ouro",
      descricao_resumida_acao: payload.descricao_resumida_acao || "",
      descricao_acao: payload.descricao_acao || "",
      question_id: item.id,
      question_numero: item.numero,
      question_texto: item.texto,
      question_resposta: normalizeText(response.answer).trim() as QuestionAnswer,
    });

    try {
      await accidentActionPlanService.upsertFromLegacy(payload);
    } catch (error) {
      if (!String((error as any)?.message || "").toLowerCase().includes("accident_action_plans")) {
        console.warn("[InvestigacaoAcidente2] Falha ao salvar o plano de acao no Supabase.", error);
      }
    }

    const existingIndex = persistedPlans.findIndex((plan: any) => String(plan?.id || "") === payload.id);
    if (existingIndex >= 0) {
      persistedPlans[existingIndex] = payload;
    } else {
      persistedPlans.unshift(payload);
    }
  }

  localStorage.setItem(ACTION_PLAN_STORAGE_KEY, JSON.stringify(persistedPlans));
  window.dispatchEvent(new Event(ACTION_PLAN_STORAGE_EVENT));

  return nonConformingItems.length;
};

const getAnswerTone = (answer: QuestionAnswer) => {
  if (answer === "Sim") return "text-green-600";
  if (answer === "Não") return "text-red-600";
  return "text-gray-500";
};

const createEmptyEvidence = () => ({
  id:
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : 'evidence-' + Date.now() + '-' + Math.random().toString(16).slice(2),
  comment: "",
  photo: null as File | null,
});

const createInitialResponses = (
  items: QuestionItem[] = QUESTION_ITEMS,
  previous?: Record<string, QuestionState>,
): Record<string, QuestionState> =>
  Object.fromEntries(
    items.map((question) => {
      const existing = previous?.[question.id];
      return [
        question.id,
        existing || {
          answer: resolveGoldenRuleQuestionExpectedAnswer(question as any),
          evidences: [],
        },
      ];
    }),
  ) as Record<string, QuestionState>;

const createInitialSignatures = () => ({
  ass_tst: null,
  ass_gestor: null,
  ass_acomp: null,
});

const SIGNATURE_LABELS: Record<SignatureKey, string> = {
  ass_tst: "Técnico Seg. Trabalho",
  ass_gestor: "Gestor da Área",
  ass_acomp: "Acompanhante da Inspeção",
};

const isMissingGoldenRulesTableError = (error: unknown) => {
  const message = String((error as any)?.message || "").toLowerCase();
  return message.includes("does not exist") && message.includes("golden_rules");
};

const InvestigacaoAcidente2 = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { leaders, operators, goldenRuleQuestions, refresh } = useSupabaseData([
    "leaders",
    "operators",
    "goldenRuleQuestions",
  ]);
  const questionItems = useMemo(
    () => buildGoldenRuleQuestionItems(goldenRuleQuestions as any[]),
    [goldenRuleQuestions],
  );

  const [titulo, setTitulo] = useState("");
  const [setor, setSetor] = useState("");
  const [gestor, setGestor] = useState("");
  const [tecnicoSeg, setTecnicoSeg] = useState("");
  const [acompanhante, setAcompanhante] = useState("");
  const [responses, setResponses] = useState<Record<string, QuestionState>>(createInitialResponses);
  const [signatures, setSignatures] = useState<{
    ass_tst: string | null;
    ass_gestor: string | null;
    ass_acomp: string | null;
  }>(createInitialSignatures);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [signatureDialog, setSignatureDialog] = useState<SignatureKey | null>(null);
  const [manualPersonTarget, setManualPersonTarget] = useState<"gestor" | "acompanhante" | null>(null);
  const [manualPersonName, setManualPersonName] = useState("");
  const [manualPersonMatricula, setManualPersonMatricula] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [previewNumber, setPreviewNumber] = useState(() => getCounterValue() + 1);
  const [goldenRuleHistory, setGoldenRuleHistory] = useState<GoldenRuleHistoryRecord[]>([]);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);
  const [submittedInspectionNumber, setSubmittedInspectionNumber] = useState<number | null>(null);
  const [successRedirectMessage, setSuccessRedirectMessage] = useState(
    "Voc\u00ea ser\u00e1 redirecionado para a tela inicial em instantes.",
  );
  const [openActionPlanQuestionId, setOpenActionPlanQuestionId] = useState<string | null>(null);
  const [actionPlanDrafts, setActionPlanDrafts] = useState<Record<string, ActionPlanDraft>>({});
  useEffect(() => {
    setResponses((previous) => createInitialResponses(questionItems, previous));
  }, [questionItems]);

  const planoAcaoCurrentState = useMemo(
    () => ({
      previewNumber,
      titulo,
      setor,
      tecnicoSeg,
    }),
    [previewNumber, setor, tecnicoSeg, titulo],
  );

  useEffect(() => {
    setActionPlanDrafts((previous) => {
      let changed = false;
      const next = { ...previous };

      questionItems.forEach((item) => {
        const response = responses[item.id];
        if (!response) return;
        if (isResponseOutOfPattern(item.id, normalizeText(response.answer).trim() as QuestionAnswer, questionItems) && !next[item.id]) {
          next[item.id] = createActionPlanDraft(item, response);
          changed = true;
        }
      });

      return changed ? next : previous;
    });
  }, [questionItems, responses]);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const remoteNext = await goldenRuleService.getNextInspectionNumber();
        const nextPreview = Math.max(remoteNext, getCounterValue() + 1);
        if (active) {
          setPreviewNumber(nextPreview);
        }
      } catch (error) {
        console.warn("[InvestigacaoAcidente2] Não foi possível consultar o próximo número remoto.", error);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadGoldenRuleHistory = async () => {
      const storedHistory = readStoredGoldenRuleHistory();

      try {
        const remoteHistory = await goldenRuleService.safeGetAllWithFallback();
        if (!active) return;

        const normalizedRemoteHistory = Array.isArray(remoteHistory)
          ? remoteHistory
              .map((item: any) => ({
                id: String(item?.id || "").trim(),
                created_at: String(item?.created_at || "").trim(),
                setor: String(item?.setor || "").trim(),
              }))
              .filter((item) => item.id && item.created_at && item.setor)
          : [];

        setGoldenRuleHistory(mergeGoldenRuleHistory([...normalizedRemoteHistory, ...storedHistory]));
      } catch (error) {
        console.warn("[InvestigacaoAcidente2] Nao foi possivel carregar o historico das regras de ouro.", error);
        if (active) {
          setGoldenRuleHistory(storedHistory);
        }
      }
    };

    const syncGoldenRuleHistory = () => {
      if (!active) return;
      setGoldenRuleHistory((current) => mergeGoldenRuleHistory([...current, ...readStoredGoldenRuleHistory()]));
    };

    void loadGoldenRuleHistory();
    window.addEventListener(STORAGE_EVENT, syncGoldenRuleHistory);

    return () => {
      active = false;
      window.removeEventListener(STORAGE_EVENT, syncGoldenRuleHistory);
    };
  }, []);

  const resolveCanonicalSectorName = (value: unknown) => resolveFixedSectorName(value);

  const setorOptions = useMemo<SearchableStringOption[]>(
    () =>
      FIXED_FORM_SECTORS.map((option) => ({
        value: option,
        label: option,
      })),
    [],
  );

  const liderOptions = useMemo<SearchableStringOption[]>(
    () =>
      dedupeSorted(leaders.map((item: any) => normalizeText(item?.name))).map((option) => ({
        value: option,
        label: option,
      })),
    [leaders],
  );

  const tecnicoInvestigadorOptions = useMemo<SearchableStringOption[]>(() => {
    return [...REGRAS_DE_OURO_TECNICOS].map((option) => ({
      value: option,
      label: option,
    }));
  }, []);

  const periodicQuestionLock = useMemo(
    () => getPeriodicQuestionLock(setor, goldenRuleHistory),
    [goldenRuleHistory, setor],
  );

  const isPeriodicQuestionLocked = (questionId: string) =>
    periodicQuestionLock.locked && PERIODIC_15_DAY_QUESTION_IDS.has(questionId);

  const acompanhanteOptions = useMemo<SearchableStringOption[]>(() => {
    const uniqueByName = new Map<string, SearchableStringOption>();

    (operators || []).forEach((item: any) => {
      const name = normalizeText(item?.name).trim();
      if (!name) return;
      const key = name.toLocaleLowerCase("pt-BR");
      if (uniqueByName.has(key)) return;

      const matricula = normalizeText(item?.matricula).trim();
      const cargo = normalizeText(item?.cargo).trim();
      const setorOperador = normalizeText(item?.setor).trim();

      uniqueByName.set(key, {
        value: name,
        label: name,
        searchText: [name, matricula, cargo, setorOperador].filter(Boolean).join(" "),
        description: [matricula ? `Matrícula: ${matricula}` : "", cargo, setorOperador]
          .filter(Boolean)
          .join(" • "),
      });
    });

    (leaders || []).forEach((item: any) => {
      const name = normalizeText(item?.name).trim();
      if (!name) return;
      const key = name.toLocaleLowerCase("pt-BR");
      if (uniqueByName.has(key)) return;

      const matricula = normalizeText(item?.operator_matricula).trim();

      uniqueByName.set(key, {
        value: name,
        label: name,
        searchText: [name, matricula, "lider", "usuario"].filter(Boolean).join(" "),
        description: [matricula ? `Matrícula: ${matricula}` : "", "Líder/Usuário"]
          .filter(Boolean)
          .join(" • "),
      });
    });

    return Array.from(uniqueByName.values()).sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [leaders, operators]);

  const gestorOptions = useMemo<SearchableStringOption[]>(() => {
    if (!gestor || liderOptions.some((item) => item.value === gestor)) {
      return liderOptions;
    }

    return [{ value: gestor, label: gestor }, ...liderOptions];
  }, [gestor, liderOptions]);

  const acompanhanteSelectOptions = useMemo<SearchableStringOption[]>(() => {
    if (!acompanhante || acompanhanteOptions.some((item) => item.value === acompanhante)) {
      return acompanhanteOptions;
    }

    return [{ value: acompanhante, label: acompanhante }, ...acompanhanteOptions];
  }, [acompanhante, acompanhanteOptions]);

  const responsavelExecucaoOptions = useMemo<SearchableStringOption[]>(
    () => mergeSearchableStringOptions(acompanhanteOptions, tecnicoInvestigadorOptions, liderOptions),
    [acompanhanteOptions, liderOptions, tecnicoInvestigadorOptions],
  );

  const handleSaveManualPerson = async () => {
    const normalizedName = normalizeText(manualPersonName).trim();
    const normalizedMatricula = normalizeText(manualPersonMatricula).trim();

    if (!manualPersonTarget) return;

    if (!normalizedName) {
      toast({
        title: "Nome obrigatório",
        description: "Informe o nome antes de adicionar.",
        variant: "destructive",
      });
      return;
    }

    if (!normalizedMatricula) {
      toast({
        title: "Matrícula obrigatória",
        description: "Informe a matrícula antes de adicionar.",
        variant: "destructive",
      });
      return;
    }

    try {
      if (manualPersonTarget === "gestor") {
        const existingLeader = leaders.find(
          (item: any) =>
            normalizePersonKey(normalizeText(item?.name)) === normalizePersonKey(normalizedName) ||
            normalizeText(item?.operator_matricula).trim() === normalizedMatricula,
        );

        if (!existingLeader) {
          const manualSeed = buildManualSeed();
          const passwordHash = await buildStoredPassword(manualSeed);

          await leaderService.create({
            name: normalizedName,
            sector: setor || "N/A",
            email: `manual.gestor.${buildManualIdentifier(`${normalizedName}-${normalizedMatricula}`)}.${manualSeed}@afm.local`,
            password_hash: passwordHash,
            operator_matricula: normalizedMatricula,
          });
        }

        await refresh();
        setGestor(existingLeader ? normalizeText(existingLeader?.name).trim() || normalizedName : normalizedName);
      } else {
        const personKey = normalizePersonKey(normalizedName);
        const existingOperator = operators.find(
          (item: any) =>
            normalizePersonKey(normalizeText(item?.name)) === personKey ||
            normalizeText(item?.matricula).trim() === normalizedMatricula,
        );
        const existingLeader = leaders.find(
          (item: any) =>
            normalizePersonKey(normalizeText(item?.name)) === personKey ||
            normalizeText(item?.operator_matricula).trim() === normalizedMatricula,
        );

        if (!existingOperator && !existingLeader) {
          await operatorService.create({
            matricula: normalizedMatricula,
            name: normalizedName,
            cargo: "Acompanhante",
            setor: setor || null,
            senha: null,
          });
        }

        await refresh();
        setAcompanhante(
          existingOperator
            ? normalizeText(existingOperator?.name).trim() || normalizedName
            : existingLeader
              ? normalizeText(existingLeader?.name).trim() || normalizedName
              : normalizedName,
        );
      }

      toast({
        title: "Cadastro salvo",
        description:
          manualPersonTarget === "gestor"
            ? "Gestor salvo no banco e selecionado."
            : "Acompanhante salvo no banco e selecionado.",
      });

      setManualPersonName("");
      setManualPersonMatricula("");
      setManualPersonTarget(null);
    } catch (error) {
      console.error("[InvestigacaoAcidente2] Erro ao salvar pessoa manual:", error);
      toast({
        title: "Erro ao salvar cadastro",
        description: "Não foi possível gravar esse cadastro no banco.",
        variant: "destructive",
      });
    }
  };

  const completionPercent = useMemo(() => {
    const total = questionItems.length + 8;
    let filled = 0;

    if (titulo.trim()) filled += 1;
    if (setor.trim()) filled += 1;
    if (gestor.trim()) filled += 1;
    if (tecnicoSeg.trim()) filled += 1;
    if (acompanhante.trim()) filled += 1;
    if (signatures.ass_tst) filled += 1;
    if (signatures.ass_gestor) filled += 1;
    if (signatures.ass_acomp) filled += 1;

    questionItems.forEach((item) => {
      if (responses[item.id]) filled += 1;
    });

    return Math.round((filled / total) * 100);
  }, [acompanhante, gestor, questionItems.length, responses, setor, signatures.ass_acomp, signatures.ass_gestor, signatures.ass_tst, tecnicoSeg, titulo]);

  const updateQuestion = (id: string, patch: Partial<QuestionState>) => {
    setResponses((previous) => ({
      ...previous,
      [id]: {
        ...previous[id],
        ...patch,
      },
    }));
  };

  const addEvidence = (questionId: string) => {
    if (isPeriodicQuestionLocked(questionId)) return;

    setResponses((previous) => ({
      ...previous,
      [questionId]: {
        ...previous[questionId],
        evidences: [...previous[questionId].evidences, createEmptyEvidence()],
      },
    }));

    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        document.getElementById(`evidencias-${questionId}`)?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 50);
    }
  };

  const updateEvidence = (
    questionId: string,
    evidenceId: string,
    patch: Partial<QuestionState["evidences"][number]>,
  ) => {
    if (isPeriodicQuestionLocked(questionId)) return;

    setResponses((previous) => ({
      ...previous,
      [questionId]: {
        ...previous[questionId],
        evidences: previous[questionId].evidences.map((evidence) =>
          evidence.id === evidenceId ? { ...evidence, ...patch } : evidence,
        ),
      },
    }));
  };

  const removeEvidence = (questionId: string, evidenceId: string) => {
    if (isPeriodicQuestionLocked(questionId)) return;

    setResponses((previous) => ({
      ...previous,
      [questionId]: {
        ...previous[questionId],
        evidences: previous[questionId].evidences.filter((evidence) => evidence.id !== evidenceId),
      },
    }));
  };

  const updateAnswer = (questionId: string, answer: QuestionAnswer) => {
    if (isPeriodicQuestionLocked(questionId)) return;

    const shouldRequireEvidence = isResponseOutOfPattern(questionId, answer, questionItems);

    if (!shouldRequireEvidence) {
      setActionPlanDrafts((previous) => {
        if (!previous[questionId]) return previous;

        const next = { ...previous };
        delete next[questionId];
        return next;
      });

      setOpenActionPlanQuestionId((previous) => (previous === questionId ? null : previous));
    }

    setResponses((previous) => {
      const current = previous[questionId];
      if (!shouldRequireEvidence) {
        return {
          ...previous,
          [questionId]: {
            ...current,
            answer,
            evidences: [],
          },
        };
      }

      const nextEvidences =
        shouldRequireEvidence && current.evidences.length === 0
          ? [createEmptyEvidence()]
          : current.evidences;

      return {
        ...previous,
        [questionId]: {
          ...current,
          answer,
          evidences: nextEvidences,
        },
      };
    });
  };

  const updateActionPlanDraft = (questionId: string, patch: Partial<ActionPlanDraft>) => {
    const question = questionItems.find((item) => item.id === questionId);
    if (!question) return;

    setActionPlanDrafts((previous) => {
      const response = responses[questionId];
      const baseDraft = previous[questionId] || createActionPlanDraft(question, response);
      return {
        ...previous,
        [questionId]: {
          ...baseDraft,
          ...patch,
        },
      };
    });
  };

  const validateForm = () => {
    if (!titulo.trim()) return "Preencha o Título.";
    if (!setor.trim()) return "Selecione o Setor.";
    if (!gestor.trim()) return "Selecione o Gestor.";
    if (!tecnicoSeg.trim()) return "Selecione o Técnico.";
    if (!acompanhante.trim()) return "Selecione o Acompanhante.";
    if (!signatures.ass_tst) return "Registre a assinatura do Tecnico de Seguranca.";
    if (!signatures.ass_gestor) return "Registre a assinatura do Gestor.";
    if (!signatures.ass_acomp) return "Registre a assinatura do Acompanhante.";

    for (const item of questionItems) {
      if (isPeriodicQuestionLocked(item.id)) {
        continue;
      }

      const response = responses[item.id];
      if (!response) return `Resposta ausente em ${item.id}.`;
      const requiresEvidence = isResponseOutOfPattern(item.id, normalizeText(response.answer).trim() as QuestionAnswer, questionItems);
      const completedEvidenceCount = response.evidences.filter(
        (evidence) => evidence.comment.trim().length > 0 && Boolean(evidence.photo),
      ).length;
      const invalidEvidenceIndex = response.evidences.findIndex((evidence) => {
        const hasComment = evidence.comment.trim().length > 0;
        const hasPhoto = Boolean(evidence.photo);
        return (hasComment || hasPhoto) && !(hasComment && hasPhoto);
      });

      if (requiresEvidence && completedEvidenceCount === 0) {
        return `Adicione pelo menos uma foto com comentário no item ${item.numero} quando a resposta estiver fora do padrão.`;
      }

    if (requiresEvidence) {
        const draft = actionPlanDrafts[item.id];
        if (!draft) {
          return `Abra o plano de ação do item ${item.numero} para registrar a tratativa.`;
        }
        if (!draft.descricao_acao.trim()) {
          return `Preencha a descrição da ação do item ${item.numero}.`;
        }
      }

      if (invalidEvidenceIndex >= 0) {
        return `Complete comentário e foto da evidência ${invalidEvidenceIndex + 1} do item ${item.numero}.`;
      }
    }

    return null;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const validationError = validateForm();
    if (validationError) {
      toast({
        title: "Formulario incompleto",
        description: validationError,
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      const rawStored = localStorage.getItem(STORAGE_KEY) || "[]";
      const parsed = JSON.parse(rawStored);
      const existingRecords = Array.isArray(parsed) ? parsed : [];
      const fallbackNumber = Math.max(
        getCounterValue(),
        ...existingRecords.map((item: any) => Number(item?.numero_inspecao) || 0),
      ) + 1;

      const serializedRespostas = await Promise.all(
        questionItems.map(async (item) => {
          const current = responses[item.id];
          const isLockedQuestion = isPeriodicQuestionLocked(item.id);
          const effectiveAnswer = isLockedQuestion ? "N/A" : (normalizeText(current.answer).trim() as QuestionAnswer);
          const effectiveEvidences = isLockedQuestion ? [] : current.evidences;
          const evidencias = await Promise.all(
            effectiveEvidences.map(async (evidence) => ({
              id: evidence.id,
              comentario: evidence.comment.trim(),
              foto: evidence.photo
                ? {
                    name: evidence.photo.name,
                    size: evidence.photo.size,
                    type: evidence.photo.type,
                    data_url: await buildImagePreviewDataUrl(evidence.photo),
                  }
                : null,
            })),
          );
          const validEvidencias = evidencias.filter(
            (evidence) => evidence.comentario.trim().length > 0 && Boolean(evidence.foto),
          );
          const firstEvidence = validEvidencias[0] || null;

          return {
            codigo: item.id,
            numero: item.numero,
            pergunta: item.texto,
            resposta: effectiveAnswer,
            comentario: firstEvidence?.comentario || "",
            foto: firstEvidence?.foto || null,
            evidencias: validEvidencias,
          };
        }),
      );

      const serializedAnexos = await Promise.all(
        attachments.map(async (file) => ({
          name: file.name,
          size: file.size,
          type: file.type,
          data_url: await buildImagePreviewDataUrl(file),
        })),
      );

      const payloadId =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${Date.now()}`;

      let finalInspectionNumber = fallbackNumber;
      let savedRemotely = false;

      try {
        const savedRule = await goldenRuleService.upsertFromLegacy({
          id: payloadId,
          titulo: titulo.trim(),
          setor: resolveCanonicalSectorName(setor),
          gestor,
          tecnico_seg: tecnicoSeg,
          acompanhante,
          ass_tst: signatures.ass_tst || "",
          ass_gestor: signatures.ass_gestor || "",
          ass_acomp: signatures.ass_acomp || "",
          created_at: new Date().toISOString(),
          responses: serializedRespostas,
          attachments: serializedAnexos,
        });

        finalInspectionNumber = Number((savedRule as any)?.numero_inspecao) || finalInspectionNumber;
        savedRemotely = true;
      } catch (error) {
        if (!isMissingGoldenRulesTableError(error)) {
          throw error;
        }
        console.warn(
          "[InvestigacaoAcidente2] Tabela golden_rules indisponivel. Salvando apenas no armazenamento local.",
        );
      }

      localStorage.setItem(COUNTER_KEY, String(finalInspectionNumber));

      const payload: InvestigacaoChecklistRecord = {
        id: payloadId,
        numero_inspecao: finalInspectionNumber,
        created_at: new Date().toISOString(),
        titulo: titulo.trim(),
        setor: resolveCanonicalSectorName(setor),
        gestor,
        tecnico_seg: tecnicoSeg,
        acompanhante,
        respostas: serializedRespostas,
        ass_tst: signatures.ass_tst || "",
        ass_gestor: signatures.ass_gestor || "",
        ass_acomp: signatures.ass_acomp || "",
        anexos: serializedAnexos,
      };

      if (!savedRemotely) {
        const updatedRecords = [payload, ...existingRecords.filter((item: any) => item?.id !== payloadId)];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedRecords));
        window.dispatchEvent(new Event(STORAGE_EVENT));
      } else {
        try {
          const lightweightRecords = existingRecords
            .filter((item: any) => item?.id !== payloadId)
            .map((item: any) => ({
              id: item?.id,
              numero_inspecao: item?.numero_inspecao,
              created_at: item?.created_at,
              titulo: item?.titulo,
              setor: resolveCanonicalSectorName(item?.setor),
              gestor: item?.gestor,
              tecnico_seg: item?.tecnico_seg,
              acompanhante: item?.acompanhante,
            }));

          localStorage.setItem(STORAGE_KEY, JSON.stringify(lightweightRecords.slice(0, 20)));
          window.dispatchEvent(new Event(STORAGE_EVENT));
        } catch (storageError) {
          console.warn(
            "[InvestigacaoAcidente2] Regra salva no banco, mas o cache local não foi atualizado.",
            storageError,
          );
        }
      }

      const savedRecord: InvestigacaoChecklistRecord = payload;
      const hasNonConformity = savedRecord.respostas.some((response) =>
        isResponseOutOfPattern(response.codigo, response.resposta, questionItems),
      );
      let nextSuccessMessage = "Voc\u00ea ser\u00e1 redirecionado para a tela inicial em instantes.";

      if (hasNonConformity) {
        const savedActionPlans = await persistActionPlansForInspection(
          savedRecord,
          finalInspectionNumber,
          responses,
          actionPlanDrafts,
          questionItems,
        );
        nextSuccessMessage =
          savedActionPlans > 0
            ? `Foram identificadas n\u00e3o conformidades. ${savedActionPlans} plano(s) de a\u00e7\u00e3o foram gerados.`
            : "Foram identificadas n\u00e3o conformidades e o plano de a\u00e7\u00e3o foi preparado.";
      }

      toast({
        title: "Regra de Ouro registrada",
        description: hasNonConformity
          ? `Registro ${formatInspectionNumber(finalInspectionNumber)} salvo. O plano de ação foi gerado no próprio item irregular.`
          : `Registro ${formatInspectionNumber(finalInspectionNumber)} salvo com sucesso.`,
      });

      setTitulo("");
      setSetor("");
      setGestor("");
      setTecnicoSeg("");
      setAcompanhante("");
      setResponses(createInitialResponses(questionItems));
      setSignatures(createInitialSignatures());
      setAttachments([]);
      setActionPlanDrafts({});
      setOpenActionPlanQuestionId(null);
      setPreviewNumber(finalInspectionNumber + 1);
      setSubmittedInspectionNumber(finalInspectionNumber);
      setSuccessRedirectMessage(nextSuccessMessage);
      setSubmissionSuccess(true);
      window.setTimeout(() => {
        setSubmissionSuccess(false);
        setSubmittedInspectionNumber(null);
        navigate("/");
      }, 2000);
    } catch (error) {
      console.error("Erro ao salvar regra de ouro:", error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível concluir o envio.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };
  const signatureTargetLabel = signatureDialog ? SIGNATURE_LABELS[signatureDialog] : "";

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 px-3 pb-16 sm:px-4 lg:px-6 lg:space-y-6">
      {submissionSuccess && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-blue-700/95 px-6 text-white">
          <div className="flex max-w-md flex-col items-center gap-4 text-center">
            <CheckCircle size={64} className="text-white" />
            <h2 className="text-2xl font-bold">Regra de Ouro enviada!</h2>
            <p className="text-sm text-blue-100">
              {submittedInspectionNumber !== null
                ? `O registro ${formatInspectionNumber(submittedInspectionNumber)} foi salvo com sucesso.`
                : "Registro salvo com sucesso."}{" "}
              {successRedirectMessage}
            </p>
          </div>
        </div>
      )}

      <Card className="border-blue-100 bg-gradient-to-br from-white via-white to-blue-50/40">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-blue-700 p-2 text-white">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-2xl text-blue-900">Regras de Ouro</CardTitle>
              <CardDescription>
                Preenchimento no padrão de inspeção: respostas diretas SIM/NÃO/N/A, com comentários e assinaturas.
              </CardDescription>
              <p className="text-sm text-gray-600">Progresso: {completionPercent}%</p>
            </div>
          </div>
        </CardHeader>
      </Card>

      <form onSubmit={handleSubmit} className="space-y-5 lg:space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Dados da Regra de Ouro</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>ID</Label>
              <Input value={formatInspectionNumber(previewNumber)} readOnly />
            </div>
            <div className="space-y-2">
              <Label>Data</Label>
              <Input value={format(new Date(), "dd/MM/yyyy HH:mm")} readOnly />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="investigacao2-titulo">Título *</Label>
              <Input
                id="investigacao2-titulo"
                value={titulo}
                onChange={(event) => setTitulo(event.target.value)}
                placeholder="Insira o valor aqui"
              />
            </div>

            <div className="space-y-2">
              <Label>Setor *</Label>
              <SearchableStringSelect
                value={setor}
                onValueChange={setSetor}
                options={setorOptions}
                placeholder="Selecionar o setor"
                searchPlaceholder="Buscar setor..."
                emptyText="Nenhum setor encontrado."
              />
            </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>Gestor *</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setManualPersonName(gestor);
                      setManualPersonMatricula("");
                      setManualPersonTarget("gestor");
                    }}
                  >
                    Adicionar gestor
                  </Button>
                </div>
                <SearchableStringSelect
                  value={gestor}
                  onValueChange={setGestor}
                  options={gestorOptions}
                  placeholder="Selecionar o Gestor"
                  searchPlaceholder="Buscar gestor..."
                  emptyText="Nenhum gestor encontrado."
                />
              </div>

            <div className="space-y-2">
              <Label>Técnico / Investigador *</Label>
              <SearchableStringSelect
                value={tecnicoSeg}
                onValueChange={setTecnicoSeg}
                options={tecnicoInvestigadorOptions}
                placeholder="Selecionar o Técnico"
                searchPlaceholder="Buscar técnico..."
                emptyText="Nenhum técnico encontrado."
              />
              <p className="text-xs text-gray-500">
                Técnicos/Investigadores de Segurança: CELSO PEREIRA e JOÃO PAULO.
              </p>
            </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>Acomp. *</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setManualPersonName(acompanhante);
                      setManualPersonMatricula("");
                      setManualPersonTarget("acompanhante");
                    }}
                  >
                    Adicionar acompanhante
                  </Button>
                </div>
                <SearchableStringSelect
                  value={acompanhante}
                  onValueChange={setAcompanhante}
                  options={acompanhanteSelectOptions}
                  placeholder="Selecionar o acompanhante"
                  searchPlaceholder="Buscar operador/usuario..."
                  emptyText="Nenhum acompanhante encontrado."
                />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Checklist de Perguntas</CardTitle>
            <CardDescription>
              Responda cada item com Sim, Não ou N/A. Quando a resposta ficar diferente do padrão da pergunta, comentário e foto são obrigatórios. Em N/A não é necessário preencher nada.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {periodicQuestionLock.locked && periodicQuestionLock.unlockAt && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                As perguntas 15, 16 e 17 para este setor ficam liberadas novamente em{" "}
                {format(periodicQuestionLock.unlockAt, "dd/MM/yyyy")}.
              </div>
            )}
            {questionItems.map((item) => {
              const response =
                responses[item.id] ?? {
                  answer: resolveGoldenRuleQuestionExpectedAnswer(item as any),
                  evidences: [],
                };
              const isLockedQuestion = isPeriodicQuestionLocked(item.id);
              const displayAnswer = normalizeText(response.answer).trim() as QuestionAnswer;
              const requiresEvidence = isResponseOutOfPattern(item.id, displayAnswer, questionItems);
              const showExtra = !isLockedQuestion && requiresEvidence;

              return (
                <div key={item.id} className="rounded-lg border border-blue-200 bg-white">
                  <div className="grid items-center gap-3 p-4 lg:grid-cols-[74px_1fr_260px]">
                    <div className="text-center">
                      <div className="text-3xl font-bold leading-none text-black sm:text-4xl">{item.numero}</div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-base font-medium text-blue-950">{item.texto}</p>
                      {isLockedQuestion && periodicQuestionLock.unlockAt ? (
                        <p className="text-sm font-medium text-amber-700">
                          Bloqueada até {format(periodicQuestionLock.unlockAt, "dd/MM/yyyy")}.
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => addEvidence(item.id)}
                          >
                            Adicionar foto/comentário
                          </Button>
                          {requiresEvidence && (
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() =>
                                openPlanoAcaoForQuestion(
                                  item,
                                  response,
                                  planoAcaoCurrentState,
                                  openActionPlanQuestionId,
                                  setOpenActionPlanQuestionId,
                                  setActionPlanDrafts,
                                )
                              }
                            >
                              <ClipboardList className="mr-2 h-4 w-4" />
                              Plano de ação
                            </Button>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-center justify-center gap-2">
                      <span
                        className={cn(
                          "text-lg font-bold",
                          isLockedQuestion ? "text-amber-600" : getAnswerTone(response.answer),
                        )}
                      >
                        {isLockedQuestion ? "BLOQUEADA" : displayAnswer.toUpperCase()}
                      </span>
                      <div className="grid w-full grid-cols-3 gap-2">
                        {(["Sim", "Não", "N/A"] as QuestionAnswer[]).map((answerOption) => (
                          <Button
                            key={answerOption}
                            type="button"
                            variant={
                              isLockedQuestion
                                ? "outline"
                                : displayAnswer === answerOption
                                  ? "default"
                                  : "outline"
                            }
                            size="sm"
                            className="w-full"
                            disabled={isLockedQuestion}
                            onClick={() => updateAnswer(item.id, answerOption)}
                          >
                            {answerOption}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {showExtra && (
                    <div id={`evidencias-${item.id}`} className="space-y-3 border-t border-blue-100 px-4 pb-4 pt-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm text-gray-600">
                          Adicione uma ou mais evidências com comentário e foto para este item.
                        </p>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => addEvidence(item.id)}
                        >
                          Adicionar outra foto/comentário
                        </Button>
                      </div>
                      {response.evidences.length === 0 ? (
                        <p className="text-sm text-gray-500">
                          Nenhuma evidência adicionada para este item.
                        </p>
                      ) : (
                        response.evidences.map((evidence, index) => (
                          <div
                            key={evidence.id}
                            className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-2"
                          >
                            <div className="space-y-2">
                              <Label htmlFor={`comentario-${item.id}-${evidence.id}`}>
                                Comentario {item.numero}.{index + 1}
                              </Label>
                              <Textarea
                                id={`comentario-${item.id}-${evidence.id}`}
                                value={evidence.comment}
                                onChange={(event) =>
                                  updateEvidence(item.id, evidence.id, { comment: event.target.value })
                                }
                                placeholder={`Comentario da evidencia ${index + 1}`}
                                rows={3}
                              />
                            </div>

                            <div className="space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <Label htmlFor={`foto-${item.id}-${evidence.id}`}>
                                  Foto {item.numero}.{index + 1}
                                </Label>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-600 hover:text-red-700"
                                  onClick={() => removeEvidence(item.id, evidence.id)}
                                >
                                  Remover
                                </Button>
                              </div>
                              <Input
                                id={`foto-${item.id}-${evidence.id}`}
                                type="file"
                                accept="image/*"
                                onChange={(event) =>
                                  updateEvidence(item.id, evidence.id, {
                                    photo: event.target.files?.[0] || null,
                                  })
                                }
                              />
                              {evidence.photo && (
                                <p className="text-xs text-gray-500">Arquivo: {evidence.photo.name}</p>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {openActionPlanQuestionId === item.id && (
                    <div className="space-y-3 border-t border-emerald-100 bg-emerald-50/40 px-4 pb-4 pt-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-emerald-900">Plano de ação da irregularidade</p>
                          <p className="text-xs text-emerald-800">
                            Esse rascunho será salvo junto com a inspeção e vai cair no painel de planos de ação.
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setOpenActionPlanQuestionId(null)}
                        >
                          Fechar
                        </Button>
                      </div>

                      {(() => {
                        const draft = actionPlanDrafts[item.id] || createActionPlanDraft(item, response);

                        return (
                          <>
                            <div className="grid gap-3 md:grid-cols-2">
                              <div className="space-y-2">
                                <Label htmlFor={`plano-resumo-${item.id}`}>Resumo da ação *</Label>
                                <Input
                                  id={`plano-resumo-${item.id}`}
                                  value={draft.descricao_resumida_acao}
                                  onChange={(event) =>
                                    updateActionPlanDraft(item.id, {
                                      descricao_resumida_acao: event.target.value,
                                    })
                                  }
                                />
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor={`plano-responsavel-${item.id}`}>Responsável *</Label>
                                <SearchableStringSelect
                                  value={draft.responsavel_execucao}
                                  onValueChange={(value) =>
                                    updateActionPlanDraft(item.id, {
                                      responsavel_execucao: value,
                                    })
                                  }
                                  options={withCurrentSearchableStringOption(
                                    responsavelExecucaoOptions,
                                    draft.responsavel_execucao,
                                  )}
                                  placeholder="Selecionar responsável"
                                  searchPlaceholder="Buscar responsável..."
                                  emptyText="Nenhuma pessoa encontrada."
                                />
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor={`plano-inicio-${item.id}`}>Início planejado</Label>
                                <Input
                                  id={`plano-inicio-${item.id}`}
                                  type="date"
                                  value={draft.inicio_planejado}
                                  onChange={(event) =>
                                    updateActionPlanDraft(item.id, {
                                      inicio_planejado: event.target.value,
                                    })
                                  }
                                />
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor={`plano-prazo-${item.id}`}>Prazo final</Label>
                                <Input
                                  id={`plano-prazo-${item.id}`}
                                  type="date"
                                  value={draft.termino_planejado}
                                  onChange={(event) =>
                                    updateActionPlanDraft(item.id, {
                                      termino_planejado: event.target.value,
                                    })
                                  }
                                />
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor={`plano-descricao-${item.id}`}>Descrição da ação *</Label>
                              <Textarea
                                id={`plano-descricao-${item.id}`}
                                rows={4}
                                value={draft.descricao_acao}
                                onChange={(event) =>
                                  updateActionPlanDraft(item.id, {
                                    descricao_acao: event.target.value,
                                  })
                                }
                              />
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Assinaturas</CardTitle>
            <CardDescription>
              Assine digitalmente os três responsáveis, igual ao padrão de inspeção.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {(Object.keys(SIGNATURE_LABELS) as SignatureKey[]).map((key) => (
              <div key={key} className="rounded-lg border p-3">
                <p className="mb-2 text-sm font-medium text-gray-700">{SIGNATURE_LABELS[key]}</p>

                <div className="flex h-32 items-center justify-center rounded border bg-gray-50">
                  {signatures[key] ? (
                    <img
                      src={signatures[key] || ""}
                      alt={`Assinatura ${SIGNATURE_LABELS[key]}`}
                      className="max-h-[120px] w-full object-contain"
                    />
                  ) : (
                    <p className="text-xs text-gray-500">Sem assinatura</p>
                  )}
                </div>

                <Button type="button" variant="outline" className="mt-2 w-full" onClick={() => setSignatureDialog(key)}>
                  {signatures[key] ? "Refazer assinatura" : "Assinar"}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Anexos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="investigacao2-anexos">Adicionar anexos</Label>
              <Input
                id="investigacao2-anexos"
                type="file"
                multiple
                onChange={(event) => setAttachments(Array.from(event.target.files || []))}
              />
              {attachments.length > 0 && (
                <p className="text-sm text-gray-600">{attachments.length} anexo(s) selecionado(s).</p>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" className="w-full sm:w-auto sm:min-w-[220px]" disabled={isSaving}>
            <Upload className="mr-2 h-4 w-4" />
            {isSaving ? "Salvando..." : "Enviar Regra de Ouro"}
          </Button>
        </div>
      </form>

      <Dialog open={Boolean(signatureDialog)} onOpenChange={(open) => !open && setSignatureDialog(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{signatureTargetLabel}</DialogTitle>
            <DialogDescription>Use o dedo ou o mouse para registrar a assinatura.</DialogDescription>
          </DialogHeader>

          {signatureDialog && (
            <SignatureCanvas
              initialSignature={signatures[signatureDialog]}
              onSignatureChange={(signature) => {
                setSignatures((previous) => ({
                  ...previous,
                  [signatureDialog]: signature,
                }));
              }}
            />
          )}

          <DialogFooter>
            <Button type="button" onClick={() => setSignatureDialog(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(manualPersonTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setManualPersonTarget(null);
            setManualPersonName("");
            setManualPersonMatricula("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {manualPersonTarget === "gestor" ? "Adicionar gestor" : "Adicionar acompanhante"}
            </DialogTitle>
            <DialogDescription>
              Use este campo quando a pessoa ainda não estiver cadastrada na lista.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="manual-person-name">Nome</Label>
            <Input
              id="manual-person-name"
              value={manualPersonName}
              onChange={(event) => setManualPersonName(event.target.value)}
              placeholder={
                manualPersonTarget === "gestor"
                  ? "Digite o nome do gestor"
                  : "Digite o nome do acompanhante"
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="manual-person-matricula">Matrícula</Label>
            <Input
              id="manual-person-matricula"
              value={manualPersonMatricula}
              onChange={(event) => setManualPersonMatricula(event.target.value)}
              placeholder="Digite a matrícula"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setManualPersonTarget(null);
                setManualPersonName("");
                setManualPersonMatricula("");
              }}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={handleSaveManualPerson}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InvestigacaoAcidente2;
