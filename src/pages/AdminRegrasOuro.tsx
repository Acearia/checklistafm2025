import React, { useEffect, useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Download, Eye, FileText, PlusCircle, RefreshCw, Trash2 } from "lucide-react";
import jsPDF from "jspdf";
import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { isImageAttachment, resolveAttachmentPreviewUrl } from "@/lib/attachmentPreview";
import { isRootAdminUser } from "@/lib/adminSession";
import { goldenRuleService } from "@/lib/supabase-service";
import { useToast } from "@/hooks/use-toast";
import { useSupabaseData } from "@/hooks/useSupabaseData";
import {
  buildGoldenRuleQuestionItems,
  DEFAULT_GOLDEN_RULE_QUESTION_ITEMS,
  resolveGoldenRuleQuestionExpectedAnswer,
} from "@/lib/goldenRuleQuestions";
import { normalizeQuestion } from "@/lib/alertRules";
import { useNavigate } from "react-router-dom";

interface AttachmentMeta {
  name: string;
  size: number;
  type: string;
  data_url?: string;
  dataUrl?: string;
  url?: string;
  preview_url?: string;
}

interface QuestionResponse {
  codigo: string;
  numero: string;
  pergunta: string;
  resposta: "Sim" | "Não" | "N/A";
  comentario: string;
  foto: AttachmentMeta | null;
  evidencias: Array<{
    id?: string;
    comentario: string;
    foto: AttachmentMeta | null;
  }>;
}

interface RegraOuroRecord {
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

interface SectorQuestionLock {
  setorKey: string;
  setor: string;
  lastInspectionAt: Date | null;
  unlockAt: Date | null;
  locked: boolean;
}

const STORAGE_KEY = "checklistafm-regras-de-ouro";
const STORAGE_EVENT = "checklistafm-regras-de-ouro-updated";
const PLANO_ACAO_CONTEXT_KEY = "checklistafm-plano-acao-context";
const FILTER_ALL = "all";
const ANSWER_YES: QuestionResponse["resposta"] = "Sim";
const ANSWER_NO: QuestionResponse["resposta"] = "Não";
const ANSWER_NA: QuestionResponse["resposta"] = "N/A";
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

const PERIODIC_15_DAY_INTERVAL_DAYS = 15;

const isMissingGoldenRulesTableError = (error: unknown) => {
  const message = String((error as any)?.message || "").toLowerCase();
  return message.includes("does not exist") && message.includes("golden_rules");
};

const decodePotentialMojibake = (value: string) => {
  if (!/[ÃÂ\uFFFD]/.test(value)) return value;

  try {
    const bytes = Uint8Array.from(Array.from(value, (char) => char.charCodeAt(0) & 0xff));
    return new TextDecoder("utf-8").decode(bytes).replace(/\uFFFD+/g, "").replace(/Â/g, "");
  } catch {
    return value.replace(/\uFFFD+/g, "").replace(/Â/g, "");
  }
};

const toSafeString = (value: unknown) =>
  value == null ? "" : decodePotentialMojibake(String(value));

const getSectorComparisonKey = (value: unknown) => normalizeSectorKey(normalizeSectorName(value).trim());

const parseDateOrNull = (value: unknown) => {
  const text = value == null ? "" : String(value).trim();
  if (!text) return null;

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
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
  MECNICA: "MECANICA",
};

const normalizePersonName = (value: unknown) => {
  const safeValue = toSafeString(value).trim();
  if (!safeValue) return "";

  const normalizedKey = normalizeSectorKey(safeValue);
  const personMap: Record<string, string> = {
    "JOO PAULO": "JOÃO PAULO",
    "JOAO PAULO": "JOÃO PAULO",
  };

  return personMap[normalizedKey] || safeValue;
};

const normalizeSectorName = (value: unknown) => {
  const safeValue = toSafeString(value).trim();
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
    MECNICA: "MECÂNICA",
    MECANICA: "MECÂNICA",
    "LOGISTICA INTERNA": "LOGÍSTICA INTERNA",
  };

  if (sectorMap[normalizedKey]) return sectorMap[normalizedKey];

  if (normalizedKey.startsWith("EXPEDI")) return "EXPEDIÇÃO";
  if (normalizedKey.startsWith("REBARBA")) return "REBARBAÇÃO";
  if (normalizedKey.startsWith("FUS")) return "FUSÃO";
  if (normalizedKey.startsWith("MANUTEN")) return "MANUTENÇÃO";
  if (normalizedKey.startsWith("PRODU")) return "PRODUÇÃO";
  if (normalizedKey.startsWith("MODEL")) return "MODELAÇÃO";
  if (normalizedKey.startsWith("MECAN") || normalizedKey.startsWith("MECNIC")) return "MECÂNICA";
  if (normalizedKey.startsWith("LOGISTICA INTERNA")) return "LOGÍSTICA INTERNA";

  return safeValue;
};

const formatDateTime = (value?: string) => {
  if (!value) return "N/A";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "N/A";
  return format(parsed, "dd/MM/yyyy HH:mm", { locale: ptBR });
};

const buildSectorQuestionLocks = (records: RegraOuroRecord[]) => {
  const locks = new Map<string, SectorQuestionLock>();

  records.forEach((record) => {
    const sectorKey = getSectorComparisonKey(record.setor);
    if (!sectorKey) return;

    const createdAt = parseDateOrNull(record.created_at);
    if (!createdAt) return;

    const current = locks.get(sectorKey);
    if (current && current.lastInspectionAt && current.lastInspectionAt.getTime() >= createdAt.getTime()) {
      return;
    }

    const unlockAt = addDays(createdAt, PERIODIC_15_DAY_INTERVAL_DAYS);
    locks.set(sectorKey, {
      setorKey: sectorKey,
      setor: record.setor || "N/A",
      lastInspectionAt: createdAt,
      unlockAt,
      locked: Date.now() < unlockAt.getTime(),
    });
  });

  return locks;
};

const formatInspectionNumber = (value: number) => String(value).padStart(3, "0");

const formatFileSize = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
};

const getRenderableImageUrl = (file?: AttachmentMeta | null) => {
  if (!file) return "";
  const previewUrl = resolveAttachmentPreviewUrl(file);
  if (!previewUrl) return "";
  if (previewUrl.startsWith("data:image/")) return previewUrl;
  return isImageAttachment(file) ? previewUrl : "";
};

const getPdfImageFormat = (imageUrl: string) => {
  const match = imageUrl.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,/i);
  const rawFormat = String(match?.[1] || "").toLowerCase();
  if (rawFormat === "png") return "PNG";
  if (rawFormat === "webp") return "WEBP";
  return "JPEG";
};

const parseEpoch = (value?: string) => {
  const epoch = new Date(value || "").getTime();
  return Number.isNaN(epoch) ? 0 : epoch;
};

const sortRecordsByCreatedAtDesc = (records: RegraOuroRecord[]) =>
  [...records].sort((a, b) => parseEpoch(b.created_at) - parseEpoch(a.created_at));

const normalizeAnswer = (value: unknown): QuestionResponse["resposta"] => {
  const normalized = toSafeString(value).trim().toLocaleLowerCase("pt-BR");
  if (
    normalized === "n/a" ||
    normalized === "na" ||
    normalized === "não se aplica" ||
    normalized === "nao se aplica"
  ) {
    return ANSWER_NA;
  }
  return normalized.startsWith("n") ? ANSWER_NO : ANSWER_YES;
};

const toSafeNumber = (value: unknown) => Number(value) || 0;

const buildFallbackRecordId = (prefix: string, inspectionNumber: number, createdAt: string) =>
  `${prefix}-${inspectionNumber || 0}-${createdAt || "sem-data"}`;

const hasCompleteSignatures = (
  record: Pick<RegraOuroRecord, "ass_tst" | "ass_gestor" | "ass_acomp">,
) => Boolean(record.ass_tst.trim() && record.ass_gestor.trim() && record.ass_acomp.trim());

const normalizeGoldenRuleResponseKey = (response: Pick<QuestionResponse, "codigo" | "numero">) => {
  const codigo = toSafeString(response.codigo).trim().toLowerCase();
  if (codigo) return codigo;

  const numero = toSafeString(response.numero).trim();
  if (!numero) return "";

  const numericValue = Number.parseInt(numero, 10);
  if (Number.isNaN(numericValue)) return numero.toLowerCase();

  return String(numericValue);
};

const findQuestionTemplateForResponse = (
  response: Pick<QuestionResponse, "codigo" | "numero" | "pergunta">,
  questions = DEFAULT_GOLDEN_RULE_QUESTION_ITEMS,
) => {
  const codigoKey = normalizeGoldenRuleResponseKey(response);
  const numeroRaw = String(response.numero || "").trim();
  const numeroKey = numeroRaw.replace(/^0+/, "") || numeroRaw;
  const perguntaKey = normalizeQuestion(String(response.pergunta || ""));

  return (
    questions.find((question) => normalizeQuestion(question.id) === normalizeQuestion(codigoKey)) ||
    questions.find((question) => String(question.numero || "").trim().replace(/^0+/, "") === numeroKey) ||
    questions.find((question) => normalizeQuestion(question.texto) === perguntaKey) ||
    null
  );
};

const getExpectedGoldenRuleAnswer = (
  response: Pick<QuestionResponse, "codigo" | "numero" | "pergunta">,
  questions = DEFAULT_GOLDEN_RULE_QUESTION_ITEMS,
) => {
  const question = findQuestionTemplateForResponse(response, questions);
  if (question) {
    return resolveGoldenRuleQuestionExpectedAnswer(question);
  }

  const normalizedKey = normalizeGoldenRuleResponseKey(response);
  return DEFAULT_NO_RESPONSE_KEYS.has(normalizedKey) ? ANSWER_NO : ANSWER_YES;
};

const responseRequiresNonConformityEvidence = (
  response: Pick<QuestionResponse, "codigo" | "numero" | "resposta" | "pergunta">,
  questions = DEFAULT_GOLDEN_RULE_QUESTION_ITEMS,
) => {
  const answer = normalizeAnswer(response.resposta);
  if (answer === ANSWER_NA) return false;
  return answer !== getExpectedGoldenRuleAnswer(response, questions);
};

const countResponseEvidences = (responses: QuestionResponse[]) =>
  responses.reduce((acc, response) => acc + getResponseEvidences(response).length, 0);

const responseHasNonConformityEvidence = (
  response: QuestionResponse,
  questions = DEFAULT_GOLDEN_RULE_QUESTION_ITEMS,
) => responseRequiresNonConformityEvidence(response, questions);

const countNonConformityResponses = (
  responses: QuestionResponse[],
  questions = DEFAULT_GOLDEN_RULE_QUESTION_ITEMS,
) => responses.filter((response) => responseHasNonConformityEvidence(response, questions)).length;

const buildNonConformitySummary = (
  record: RegraOuroRecord,
  questions = DEFAULT_GOLDEN_RULE_QUESTION_ITEMS,
) => {
  const responses = record.respostas.filter((response) => responseHasNonConformityEvidence(response, questions));
  if (responses.length === 0) {
    return `Regra de Ouro ${formatInspectionNumber(record.numero_inspecao)} sem nao conformidades detalhadas.`;
  }

  return responses
    .map((response) => `- ${response.numero || response.codigo}: ${response.pergunta}`)
    .join("\n");
};

const buildPlanoAcaoContext = (record: RegraOuroRecord, questions = DEFAULT_GOLDEN_RULE_QUESTION_ITEMS) => ({
  fonte: "regra-ouro" as const,
  registro_id: record.id,
  numero_referencia: Number(record.numero_inspecao) || 0,
  data_referencia: record.created_at || "",
  titulo: record.titulo || `Regra de Ouro ${formatInspectionNumber(record.numero_inspecao)}`,
  setor: record.setor || "",
  tecnico: record.tecnico_seg || "",
  descricao_ocorrencia: buildNonConformitySummary(record, questions),
  origem: "Regra de Ouro",
});

const getRecordCompletenessScore = (record: RegraOuroRecord | null | undefined) => {
  if (!record) return 0;

  return (
    record.respostas.length * 100 +
    countResponseEvidences(record.respostas) * 10 +
    record.anexos.length * 10 +
    (record.ass_tst.trim() ? 1 : 0) +
    (record.ass_gestor.trim() ? 1 : 0) +
    (record.ass_acomp.trim() ? 1 : 0)
  );
};

const mergeGoldenRuleRecords = (
  primary: RegraOuroRecord,
  fallback?: RegraOuroRecord | null,
): RegraOuroRecord => {
  if (!fallback) return primary;

  const primaryScore = getRecordCompletenessScore(primary);
  const fallbackScore = getRecordCompletenessScore(fallback);
  const richest = fallbackScore > primaryScore ? fallback : primary;
  const secondary = richest === primary ? fallback : primary;

  return {
    ...richest,
    titulo: richest.titulo || secondary.titulo,
    setor: richest.setor || secondary.setor,
    gestor: richest.gestor || secondary.gestor,
    tecnico_seg: richest.tecnico_seg || secondary.tecnico_seg,
    acompanhante: richest.acompanhante || secondary.acompanhante,
    respostas: richest.respostas.length > 0 ? richest.respostas : secondary.respostas,
    anexos: richest.anexos.length > 0 ? richest.anexos : secondary.anexos,
    ass_tst: richest.ass_tst || secondary.ass_tst,
    ass_gestor: richest.ass_gestor || secondary.ass_gestor,
    ass_acomp: richest.ass_acomp || secondary.ass_acomp,
  };
};

const getResponseEvidences = (response: QuestionResponse) =>
  response.evidencias.length > 0
    ? response.evidencias
    : response.comentario || response.foto
      ? [
          {
            comentario: response.comentario,
            foto: response.foto,
          },
        ]
      : [];

const uniqueSortedValues = (values: string[]) =>
  Array.from(new Set(values.filter((value) => value.trim().length > 0))).sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );

const toLocalAttachmentMeta = (file: any): AttachmentMeta => ({
  name: toSafeString(file?.name),
  size: toSafeNumber(file?.size),
  type: toSafeString(file?.type),
  data_url: toSafeString(file?.data_url),
  dataUrl: toSafeString(file?.dataUrl),
  url: toSafeString(file?.url),
  preview_url: toSafeString(file?.preview_url),
});

const toSupabaseAttachmentMeta = (file: any): AttachmentMeta => ({
  name: toSafeString(file?.file_name),
  size: toSafeNumber(file?.file_size),
  type: toSafeString(file?.file_type),
  data_url: toSafeString(file?.file_data_url),
});

const toQuestionEvidenceAttachment = (value: any): AttachmentMeta | null => {
  if (!value) return null;

  const attachment = value?.file_name || value?.file_data_url || value?.foto_name || value?.foto_data_url
    ? {
        name: toSafeString(value?.file_name ?? value?.foto_name),
        size: toSafeNumber(value?.file_size ?? value?.foto_size),
        type: toSafeString(value?.file_type ?? value?.foto_type),
        data_url: toSafeString(value?.file_data_url ?? value?.foto_data_url),
      }
    : value?.name || value?.data_url || value?.preview_url || value?.url
      ? toLocalAttachmentMeta(value)
      : null;

  if (!attachment) return null;
  return attachment.name || attachment.data_url || attachment.url || attachment.preview_url ? attachment : null;
};

const getNormalizedResponseEvidences = (response: any) => {
  const mappedEvidenceSource = Array.isArray(response?.evidencias)
    ? response.evidencias
    : Array.isArray(response?.evidences)
      ? response.evidences
      : [];

  if (mappedEvidenceSource.length > 0) {
    return mappedEvidenceSource
      .map((evidence: any) => ({
        id: toSafeString(evidence?.id),
        comentario: toSafeString(evidence?.comentario),
        foto: toQuestionEvidenceAttachment(evidence?.foto ?? evidence),
      }))
      .filter((evidence) => evidence.comentario || evidence.foto);
  }

  const legacyComment = toSafeString(response?.comentario);
  const legacyPhoto = toQuestionEvidenceAttachment(response?.foto ?? response);
  if (!legacyComment && !legacyPhoto) return [];

  return [
    {
      comentario: legacyComment,
      foto: legacyPhoto,
    },
  ];
};

const toLocalQuestionResponse = (response: any, index: number): QuestionResponse => ({
  codigo: toSafeString(response?.codigo) || `item-${index + 1}`,
  numero: toSafeString(response?.numero),
  pergunta: toSafeString(response?.pergunta),
  resposta: normalizeAnswer(response?.resposta),
  comentario: toSafeString(response?.comentario),
  foto: response?.foto ? toLocalAttachmentMeta(response.foto) : null,
  evidencias: getNormalizedResponseEvidences(response),
});

const toSupabaseQuestionResponse = (response: any, index: number): QuestionResponse => ({
  codigo: toSafeString(response?.codigo) || `item-${index + 1}`,
  numero: toSafeString(response?.numero),
  pergunta: toSafeString(response?.pergunta),
  resposta: normalizeAnswer(response?.resposta),
  comentario: toSafeString(response?.comentario),
  foto: response
    ? {
        name: toSafeString(response?.foto_name),
        size: toSafeNumber(response?.foto_size),
        type: toSafeString(response?.foto_type),
        data_url: toSafeString(response?.foto_data_url),
      }
    : null,
  evidencias: getNormalizedResponseEvidences(response),
});

const parseRegrasOuro = (): RegraOuroRecord[] => {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const normalized = parsed
      .map((item: any): RegraOuroRecord | null => {
        if (!item || typeof item !== "object") return null;

        const numeroInspecao = toSafeNumber(item.numero_inspecao);
        const createdAt = toSafeString(item.created_at);

        const respostas = Array.isArray(item.respostas)
          ? item.respostas.map(toLocalQuestionResponse)
          : [];

        const anexos = Array.isArray(item.anexos) ? item.anexos.map(toLocalAttachmentMeta) : [];

        return {
          id: toSafeString(item.id) || buildFallbackRecordId("local", numeroInspecao, createdAt),
          numero_inspecao: numeroInspecao,
          created_at: createdAt,
          titulo: toSafeString(item.titulo),
          setor: normalizeSectorName(item.setor),
          gestor: normalizePersonName(item.gestor),
          tecnico_seg: normalizePersonName(item.tecnico_seg),
          acompanhante: normalizePersonName(item.acompanhante),
          respostas,
          ass_tst: toSafeString(item.ass_tst),
          ass_gestor: toSafeString(item.ass_gestor),
          ass_acomp: toSafeString(item.ass_acomp),
          anexos,
        };
      })
      .filter((item): item is RegraOuroRecord => Boolean(item));

    return sortRecordsByCreatedAtDesc(normalized);
  } catch (error) {
    console.error("Erro ao carregar regras de ouro:", error);
    return [];
  }
};

const toLegacyGoldenRulePayload = (record: RegraOuroRecord) => ({
  id: record.id,
  numero_inspecao: record.numero_inspecao,
  created_at: record.created_at,
  titulo: record.titulo,
  setor: record.setor,
  gestor: record.gestor,
  tecnico_seg: record.tecnico_seg,
  acompanhante: record.acompanhante,
  ass_tst: record.ass_tst,
  ass_gestor: record.ass_gestor,
  ass_acomp: record.ass_acomp,
  responses: record.respostas.map((response) => ({
    codigo: response.codigo,
    numero: response.numero,
    pergunta: response.pergunta,
    resposta: response.resposta,
    comentario: response.comentario,
    foto: response.foto
      ? {
          name: response.foto.name,
          size: response.foto.size,
          type: response.foto.type,
          data_url: response.foto.data_url || response.foto.dataUrl || response.foto.url || response.foto.preview_url,
        }
      : null,
    evidencias: getResponseEvidences(response).map((evidence) => ({
      comentario: evidence.comentario,
      foto: evidence.foto
        ? {
            name: evidence.foto.name,
            size: evidence.foto.size,
            type: evidence.foto.type,
            data_url:
              evidence.foto.data_url || evidence.foto.dataUrl || evidence.foto.url || evidence.foto.preview_url,
          }
        : null,
    })),
  })),
  attachments: record.anexos.map((attachment) => ({
    name: attachment.name,
    size: attachment.size,
    type: attachment.type,
    data_url: attachment.data_url || attachment.dataUrl || attachment.url || attachment.preview_url,
  })),
});

const mapSupabaseRegrasOuro = (rows: any[]): RegraOuroRecord[] => {
  const mapped = rows
    .map((row): RegraOuroRecord | null => {
      if (!row || typeof row !== "object") return null;

      const numeroInspecao = toSafeNumber(row.numero_inspecao);
      const createdAt = toSafeString(row.created_at);

      const respostas = Array.isArray(row.responses)
        ? row.responses.map(toSupabaseQuestionResponse)
        : [];

      const anexos = Array.isArray(row.attachments)
        ? row.attachments.map(toSupabaseAttachmentMeta)
        : [];

      return {
        id: toSafeString(row.id) || buildFallbackRecordId("remote", numeroInspecao, createdAt),
        numero_inspecao: numeroInspecao,
        created_at: createdAt,
        titulo: toSafeString(row.titulo),
        setor: normalizeSectorName(row.setor),
        gestor: normalizePersonName(row.gestor),
        tecnico_seg: normalizePersonName(row.tecnico_seg),
        acompanhante: normalizePersonName(row.acompanhante),
        respostas,
        ass_tst: toSafeString(row.ass_tst),
        ass_gestor: toSafeString(row.ass_gestor),
        ass_acomp: toSafeString(row.ass_acomp),
        anexos,
      };
    })
    .filter((item): item is RegraOuroRecord => Boolean(item));

  return sortRecordsByCreatedAtDesc(mapped);
};

const AdminRegrasOuro = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { sectors, goldenRuleQuestions, refresh } = useSupabaseData(["sectors", "goldenRuleQuestions"]);
  const questionItems = useMemo(
    () => buildGoldenRuleQuestionItems(goldenRuleQuestions as any[]),
    [goldenRuleQuestions],
  );
  const [records, setRecords] = useState<RegraOuroRecord[]>([]);
  const [selected, setSelected] = useState<RegraOuroRecord | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [imagePreview, setImagePreview] = useState<{ url: string; title: string } | null>(null);
  const [isRootAdmin, setIsRootAdmin] = useState<boolean>(isRootAdminUser());

  const [searchTerm, setSearchTerm] = useState("");
  const [setorFilter, setSetorFilter] = useState(FILTER_ALL);
  const [tecnicoFilter, setTecnicoFilter] = useState(FILTER_ALL);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const loadData = async () => {
    const localRecords = parseRegrasOuro();

    try {
      let remoteRows = await goldenRuleService.safeGetAllWithFallback();
      let remoteRecords = mapSupabaseRegrasOuro(remoteRows);

      if (localRecords.length > 0) {
        const remoteById = new Map(remoteRecords.map((item) => [item.id, item]));
        const pendingLocalSync = localRecords.filter((item) => {
          if (!item.id) return false;
          const remoteRecord = remoteById.get(item.id);
          if (!remoteRecord) return true;
          return getRecordCompletenessScore(item) > getRecordCompletenessScore(remoteRecord);
        });

        if (pendingLocalSync.length > 0) {
          const syncResult = await goldenRuleService.syncLocalRecords(
            pendingLocalSync.map(toLegacyGoldenRulePayload),
          );

          if (syncResult.syncedIds.length > 0) {
            toast({
              title: "Regras de Ouro sincronizadas",
              description: `${syncResult.syncedIds.length} registro(s) local(is) foram enviados ao banco.`,
            });
          }

          remoteRows = await goldenRuleService.safeGetAllWithFallback();
          remoteRecords = mapSupabaseRegrasOuro(remoteRows);
        }
      }

      if (remoteRows.length === 0) {
        setRecords(localRecords);
        return;
      }

      const mergedMap = new Map<string, RegraOuroRecord>();
      [...remoteRecords, ...localRecords].forEach((item) => {
        const key = item.id;
        const current = mergedMap.get(key);
        mergedMap.set(key, current ? mergeGoldenRuleRecords(current, item) : item);
      });
      const mergedRecords = sortRecordsByCreatedAtDesc(Array.from(mergedMap.values()));

      setRecords(mergedRecords);

      // A tela administrativa nao deve sobrescrever o cache local completo com
      // anexos/base64 do banco. Isso estoura a quota do navegador e derruba a listagem.
      try {
        if (localRecords.length > 0) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(localRecords));
        }
      } catch (storageError) {
        console.warn("Falha ao manter cache local das regras de ouro:", storageError);
      }
    } catch (error) {
      if (!isMissingGoldenRulesTableError(error)) {
        console.error("Erro ao carregar regras de ouro no Supabase:", error);
      }
      setRecords(localRecords);
    }
  };

  useEffect(() => {
    void loadData();

    const handleUpdated = () => void loadData();
    const handleStorage = (event: StorageEvent) => {
      if (!event.key || event.key === STORAGE_KEY) {
        void loadData();
      }
    };

    window.addEventListener(STORAGE_EVENT, handleUpdated);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(STORAGE_EVENT, handleUpdated);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncAdminSession = () => {
      setIsRootAdmin(isRootAdminUser());
    };

    window.addEventListener("storage", syncAdminSession);
    return () => {
      window.removeEventListener("storage", syncAdminSession);
    };
  }, []);

  const canonicalSectorMap = useMemo(() => {
    const map = new Map<string, string>();

    sectors.forEach((item: any) => {
      const name = toSafeString(item?.name).trim();
      if (!name) return;
      map.set(normalizeSectorKey(name), name);
    });

    return map;
  }, [sectors]);

  const resolveCanonicalSectorName = React.useCallback(
    (value: unknown) => {
      const normalizedValue = normalizeSectorName(value);
      if (!normalizedValue) return "";

      const normalizedKey = normalizeSectorKey(normalizedValue);
      const aliasedKey = LEGACY_SECTOR_ALIASES[normalizedKey];

      return (
        canonicalSectorMap.get(normalizedKey) ||
        (aliasedKey ? canonicalSectorMap.get(aliasedKey) : undefined) ||
        normalizedValue
      );
    },
    [canonicalSectorMap],
  );

  const recordsWithCanonicalSector = useMemo(
    () =>
      records.map((item) => {
        const setor = resolveCanonicalSectorName(item.setor);
        return setor === item.setor ? item : { ...item, setor };
      }),
    [records, resolveCanonicalSectorName],
  );

  const sectorQuestionLocks = useMemo(
    () => buildSectorQuestionLocks(recordsWithCanonicalSector),
    [recordsWithCanonicalSector],
  );

  const uniqueSetores = useMemo(
    () =>
      uniqueSortedValues(sectors.map((s: any) => resolveCanonicalSectorName(s.name))).sort((a, b) =>
        a.localeCompare(b, "pt-BR"),
      ),
    [sectors, resolveCanonicalSectorName],
  );

  const uniqueTecnicos = useMemo(
    () => uniqueSortedValues(recordsWithCanonicalSector.map((item) => item.tecnico_seg)),
    [recordsWithCanonicalSector],
  );

  const filteredRecords = useMemo(() => {
    return recordsWithCanonicalSector.filter((item) => {
      const matchesSetor = setorFilter === FILTER_ALL || item.setor === setorFilter;
      const matchesTecnico = tecnicoFilter === FILTER_ALL || item.tecnico_seg === tecnicoFilter;

      const normalizedSearch = searchTerm.trim().toLowerCase();
      const matchesSearch =
        normalizedSearch.length === 0 ||
        item.titulo.toLowerCase().includes(normalizedSearch) ||
        item.setor.toLowerCase().includes(normalizedSearch) ||
        item.gestor.toLowerCase().includes(normalizedSearch) ||
        item.tecnico_seg.toLowerCase().includes(normalizedSearch);

      const itemDate = item.created_at ? new Date(item.created_at) : null;
      const from = dateFrom ? new Date(dateFrom) : null;
      const to = dateTo ? new Date(dateTo) : null;
      if (from) from.setHours(0, 0, 0, 0);
      if (to) to.setHours(23, 59, 59, 999);
      const matchesDate =
        (!from || (itemDate && itemDate >= from)) &&
        (!to || (itemDate && itemDate <= to));

      return matchesSetor && matchesTecnico && matchesSearch && matchesDate;
    });
  }, [recordsWithCanonicalSector, setorFilter, tecnicoFilter, searchTerm, dateFrom, dateTo]);

  const summary = useMemo(() => {
    const total = recordsWithCanonicalSector.length;
    const inspecoesComNaoConformidade = recordsWithCanonicalSector.filter((item) =>
      item.respostas.some((response) => responseHasNonConformityEvidence(response, questionItems)),
    ).length;

    return { total, inspecoesComNaoConformidade };
  }, [questionItems, recordsWithCanonicalSector]);

  const loadFullRecord = async (recordId: string) => {
    const remoteRow = await goldenRuleService.getById(recordId);
    const localFallback = recordsWithCanonicalSector.find((item) => item.id === recordId) || null;
    if (!remoteRow) return localFallback;

    const [mapped] = mapSupabaseRegrasOuro([remoteRow]);
    if (!mapped) return localFallback;
    const merged = mergeGoldenRuleRecords(mapped, localFallback);
    return { ...merged, setor: resolveCanonicalSectorName(merged.setor) };
  };

  const handleViewDetails = async (record: RegraOuroRecord) => {
    setSelected(record);
    setDetailsOpen(true);
    setIsLoadingDetails(true);

    try {
      const fullRecord = await loadFullRecord(record.id);
      if (fullRecord) {
        setSelected(fullRecord);
      }
    } catch (error) {
      console.error("Erro ao carregar detalhes completos da regra de ouro:", error);
      toast({
        title: "Detalhes parciais",
        description: "Nao foi possivel carregar todas as respostas e anexos deste registro.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleDeleteRecord = async (record: RegraOuroRecord) => {
    if (!isRootAdmin) {
      toast({
        title: "Acesso restrito",
        description: "Somente o usuário adm pode excluir registros.",
        variant: "destructive",
      });
      return;
    }

    const confirmed = window.confirm(
      "Deseja realmente excluir esta regra de ouro? Esta ação não pode ser desfeita.",
    );
    if (!confirmed) return;

    try {
      try {
        await goldenRuleService.delete(record.id);
      } catch (error) {
        if (!isMissingGoldenRulesTableError(error)) {
          throw error;
        }
      }

      const updated = records.filter((item) => item.id !== record.id);
      try {
        const localCache = parseRegrasOuro();
        const nextLocalCache = localCache.filter((item) => item.id !== record.id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(nextLocalCache));
      } catch (storageError) {
        console.warn("Falha ao atualizar cache local das regras de ouro apos exclusao:", storageError);
      }
      window.dispatchEvent(new Event(STORAGE_EVENT));
      setRecords(updated);

      if (selected?.id === record.id) {
        setSelected(null);
        setDetailsOpen(false);
      }

      toast({
        title: "Registro excluído",
        description: "A regra de ouro foi removida com sucesso.",
      });
    } catch (error) {
      console.error("Erro ao excluir regra de ouro:", error);
      toast({
        title: "Erro ao excluir",
        description: "Não foi possível excluir o registro.",
        variant: "destructive",
      });
    }
  };

  const handleExportCsv = () => {
    if (filteredRecords.length === 0) {
      toast({
        title: "Nenhum registro",
        description: "Não há dados para exportar com os filtros atuais.",
        variant: "destructive",
      });
      return;
    }

    const headers = [
      "numero_inspecao",
      "data_hora",
      "titulo",
      "setor",
      "tecnico_seg",
      "gestor",
      "acompanhante",
      "nao_conformidade",
      "anexos",
    ];
    const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;

    const rows = filteredRecords.map((item) => {
      const temNaoConformidade = item.respostas.some((response) =>
        responseHasNonConformityEvidence(response, questionItems),
      );

      return [
        formatInspectionNumber(item.numero_inspecao),
        formatDateTime(item.created_at),
        item.titulo,
        item.setor,
        item.tecnico_seg,
        item.gestor,
        item.acompanhante,
        temNaoConformidade ? "com nao conformidade" : "conforme",
        String(item.anexos.length),
      ]
        .map((cell) => escape(cell || ""))
        .join(",");
    });

    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `regras-de-ouro-${format(new Date(), "yyyy-MM-dd")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Exportação concluída",
      description: "Arquivo CSV gerado com sucesso.",
    });
  };

  const handleStartPlanoAcao = (record: RegraOuroRecord) => {
    const hasNonConformity = record.respostas.some((response) =>
      responseHasNonConformityEvidence(response, questionItems),
    );
    if (!hasNonConformity) {
      toast({
        title: "Sem nao conformidade",
        description: "Esta Regra de Ouro nao possui nao conformidades para abrir plano de acao.",
        variant: "destructive",
      });
      return;
    }

    try {
      sessionStorage.setItem(
        PLANO_ACAO_CONTEXT_KEY,
        JSON.stringify(buildPlanoAcaoContext(record, questionItems)),
      );
      navigate(
        `/plano-acao-acidente?origem=admin&fonte=regra-ouro&registro=${encodeURIComponent(record.id)}&ocorrencia=${record.numero_inspecao}`,
      );
    } catch (error) {
      console.error("Erro ao abrir plano de acao da regra de ouro:", error);
      toast({
        title: "Erro ao abrir plano",
        description: "Nao foi possivel preparar o plano de acao deste registro.",
        variant: "destructive",
      });
    }
  };

  const handleOpenImagePreview = (url: string, title: string) => {
    const trimmedUrl = String(url || "").trim();
    if (!trimmedUrl) {
      toast({
        title: "Imagem indisponível",
        description: "Não foi possível carregar a imagem.",
        variant: "destructive",
      });
      return;
    }
    setImagePreview({ url: trimmedUrl, title: title || "Imagem" });
  };

  const handleExportRecordPdf = async (summaryRecord: RegraOuroRecord) => {
    let record = summaryRecord;

    try {
      const fullRecord = await loadFullRecord(summaryRecord.id);
      if (fullRecord) {
        record = fullRecord;
      }
    } catch (error) {
      console.error("Erro ao carregar dados completos para o PDF da regra de ouro:", error);
    }

    try {
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 14;
      const contentWidth = pageWidth - margin * 2;
      const lineHeight = 6;
      let y = margin;

      const ensureSpace = (required = lineHeight) => {
        if (y + required <= pageHeight - margin) return;
        doc.addPage();
        y = margin;
      };

      const writeValueBlock = (label: string, value: string) => {
        const labelText = `${label}:`;
        const safeValue = value || "N/A";

        doc.setFont("helvetica", "bold");
        const measuredLabelWidth = doc.getTextWidth(labelText) + 2;
        const labelWidth = Math.min(Math.max(measuredLabelWidth, 24), Math.floor(contentWidth * 0.45));
        const valueX = margin + labelWidth;
        const valueWidth = Math.max(contentWidth - labelWidth, 30);

        doc.setFont("helvetica", "normal");
        const valueLines = doc.splitTextToSize(safeValue, valueWidth);
        const blockHeight = Math.max(valueLines.length, 1) * lineHeight;
        ensureSpace(blockHeight);

        doc.setFont("helvetica", "bold");
        doc.text(labelText, margin, y);
        doc.setFont("helvetica", "normal");
        doc.text(valueLines, valueX, y);

        y += blockHeight;
      };

      const writeSeparator = () => {
        ensureSpace(5);
        doc.setDrawColor(220, 220, 220);
        doc.line(margin, y, margin + contentWidth, y);
        y += 5;
      };

      const drawImageBlock = (
        imageUrl: string,
        options?: {
          label?: string;
          maxWidth?: number;
          maxHeight?: number;
          fileName?: string;
        },
      ) => {
        if (!imageUrl) return;

        const label = options?.label?.trim() || "";
        const fileName = options?.fileName?.trim() || "";
        const maxWidth = options?.maxWidth ?? contentWidth;
        const maxHeight = options?.maxHeight ?? 60;

        if (label) {
          ensureSpace(lineHeight);
          doc.setFont("helvetica", "bold");
          doc.text(label, margin, y);
          y += lineHeight;
        }

        if (fileName) {
          doc.setFont("helvetica", "normal");
          const fileLines = doc.splitTextToSize(fileName, contentWidth);
          ensureSpace(fileLines.length * 4);
          doc.text(fileLines, margin, y);
          y += fileLines.length * 4 + 1;
        }

        let imageWidth = maxWidth;
        let imageHeight = maxHeight;

        try {
          const imageProperties = doc.getImageProperties(imageUrl);
          const aspectRatio = imageProperties.width / Math.max(imageProperties.height, 1);
          imageWidth = Math.min(maxWidth, maxHeight * aspectRatio);
          imageHeight = imageWidth / Math.max(aspectRatio, 0.01);

          if (imageHeight > maxHeight) {
            imageHeight = maxHeight;
            imageWidth = imageHeight * aspectRatio;
          }
        } catch {
          imageWidth = Math.min(maxWidth, 80);
          imageHeight = Math.min(maxHeight, 40);
        }

        ensureSpace(imageHeight + 4);
        doc.setDrawColor(210, 210, 210);
        doc.rect(margin, y, imageWidth, imageHeight);
        doc.addImage(imageUrl, getPdfImageFormat(imageUrl), margin, y, imageWidth, imageHeight);
        y += imageHeight + 4;
      };

      const drawSignatureRow = () => {
        const signatures = [
          {
            label: "Assinatura tecnico",
            imageUrl: record.ass_tst,
          },
          {
            label: "Assinatura gestor",
            imageUrl: record.ass_gestor,
          },
          {
            label: "Assinatura acompanhante",
            imageUrl: record.ass_acomp,
          },
        ];

        const boxGap = 6;
        const boxWidth = (contentWidth - boxGap * 2) / 3;
        const imageHeight = 22;
        const boxHeight = 33;

        ensureSpace(boxHeight + 4);
        doc.setFont("helvetica", "bold");
        doc.text("Assinaturas", margin, y);
        y += 5;

        signatures.forEach((signature, index) => {
          const x = margin + index * (boxWidth + boxGap);
          doc.setDrawColor(210, 210, 210);
          doc.rect(x, y, boxWidth, boxHeight);
          doc.setFontSize(9);
          doc.setFont("helvetica", "bold");
          doc.text(signature.label, x + 2, y + 4);

          if (signature.imageUrl?.trim()) {
            try {
              doc.addImage(
                signature.imageUrl,
                getPdfImageFormat(signature.imageUrl),
                x + 2,
                y + 7,
                boxWidth - 4,
                imageHeight,
              );
            } catch {
              doc.setFont("helvetica", "normal");
              doc.text("Falha ao carregar assinatura", x + 2, y + 16);
            }
          } else {
            doc.setFont("helvetica", "normal");
            doc.text("Nao assinada", x + 2, y + 16);
          }
        });

        y += boxHeight + 6;
        doc.setFontSize(11);
      };

      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("Relatorio - Regra de Ouro", margin, y);
      y += 9;

      doc.setFontSize(11);
      writeValueBlock("Registro", formatInspectionNumber(record.numero_inspecao));
      writeValueBlock("Data/Hora", formatDateTime(record.created_at));
      writeValueBlock("Titulo", record.titulo || "N/A");
      writeValueBlock("Setor", record.setor || "N/A");
      writeValueBlock("Tecnico", record.tecnico_seg || "N/A");
      writeValueBlock("Gestor", record.gestor || "N/A");
      writeValueBlock("Acompanhante", record.acompanhante || "N/A");
      drawSignatureRow();

      writeSeparator();
      doc.setFont("helvetica", "bold");
      doc.text("Respostas", margin, y);
      y += 7;

      record.respostas.forEach((response, index) => {
        const numberLabel = response.numero || String(index + 1).padStart(2, "0");
        const question = response.pergunta || "Pergunta";
        const questionLines = doc.splitTextToSize(`${numberLabel} - ${question}`, contentWidth);
        ensureSpace(questionLines.length * lineHeight + 8);
        doc.setFont("helvetica", "bold");
        doc.text(questionLines, margin, y);
        y += questionLines.length * lineHeight;
        doc.setFont("helvetica", "normal");
        writeValueBlock("Resposta", response.resposta || "N/A");
        const evidences = getResponseEvidences(response);
        evidences.forEach((evidence, evidenceIndex) => {
          const suffix = evidences.length > 1 ? ` ${evidenceIndex + 1}` : "";

          if (evidence.comentario?.trim()) {
            writeValueBlock(`Comentario${suffix}`, evidence.comentario.trim());
          }
          if (evidence.foto?.name?.trim()) {
            writeValueBlock(
              `Foto${suffix}`,
              `${evidence.foto.name} (${formatFileSize(evidence.foto.size)})`,
            );
            const imageUrl = getRenderableImageUrl(evidence.foto);
            if (imageUrl) {
              drawImageBlock(imageUrl, {
                label: `Imagem da resposta${suffix}`,
                fileName: evidence.foto.name,
                maxWidth: Math.min(contentWidth, 90),
                maxHeight: 58,
              });
            }
          }
        });
        y += 1;
      });

      if (record.anexos.length > 0) {
        writeSeparator();
        doc.setFont("helvetica", "bold");
        doc.text("Anexos", margin, y);
        y += 7;
        doc.setFont("helvetica", "normal");
        record.anexos.forEach((file, index) => {
          writeValueBlock(
            `Arquivo ${index + 1}`,
            `${file.name || "arquivo"} - ${file.type || "tipo não informado"} - ${formatFileSize(file.size)}`,
          );
          const imageUrl = getRenderableImageUrl(file);
          if (imageUrl) {
            drawImageBlock(imageUrl, {
              label: `Imagem do anexo ${index + 1}`,
              fileName: file.name,
              maxWidth: Math.min(contentWidth, 110),
              maxHeight: 70,
            });
          }
        });
      }

      doc.save(`regra-ouro-${formatInspectionNumber(record.numero_inspecao)}.pdf`);

      toast({
        title: "PDF gerado",
        description: `Registro ${formatInspectionNumber(record.numero_inspecao)} exportado.`,
      });
    } catch (error) {
      console.error("Erro ao gerar PDF da regra de ouro:", error);
      toast({
        title: "Erro ao gerar PDF",
        description: "Nao foi possivel gerar o PDF.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Regras de Ouro</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => void loadData()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
          <Button onClick={handleExportCsv} className="bg-green-600 hover:bg-green-700">
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total</CardDescription>
            <CardTitle>{summary.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Inspeções com não conformidade</CardDescription>
            <CardTitle>{summary.inspecoesComNaoConformidade}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Refine por setor, técnico, data e busca rápida.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <div>
              <label className="mb-1 block text-sm font-medium">Busca rápida</label>
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Título, setor, gestor..."
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Data início</label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Data fim</label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Setor</label>
              <Select value={setorFilter} onValueChange={setSetorFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os setores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={FILTER_ALL}>Todos os setores</SelectItem>
                  {uniqueSetores.map((setor) => (
                    <SelectItem key={setor} value={setor}>
                      {setor}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Técnico</label>
              <Select value={tecnicoFilter} onValueChange={setTecnicoFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os técnicos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={FILTER_ALL}>Todos os técnicos</SelectItem>
                  {uniqueTecnicos.map((tecnico) => (
                    <SelectItem key={tecnico} value={tecnico}>
                      {tecnico}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Regras de Ouro</CardTitle>
          <CardDescription>
            {filteredRecords.length === 0
              ? "Nenhum registro encontrado."
              : `Mostrando ${filteredRecords.length} registro(s).`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredRecords.length === 0 ? (
            <div className="rounded-md border bg-gray-50 p-8 text-center text-gray-500">
              Não há registros com os filtros selecionados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N</TableHead>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Setor</TableHead>
                    <TableHead>Trava 15 dias</TableHead>
                    <TableHead>Técnico</TableHead>
                    <TableHead>Gestor</TableHead>
                    <TableHead>Não conformidade</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.map((item) => {
                    const temNaoConformidade = item.respostas.some((response) =>
                      responseHasNonConformityEvidence(response, questionItems),
                    );
                    const sectorLock = sectorQuestionLocks.get(getSectorComparisonKey(item.setor));
                    const isQuestionLocked = Boolean(sectorLock?.locked);

                    return (
                      <TableRow key={item.id}>
                        <TableCell>{formatInspectionNumber(item.numero_inspecao)}</TableCell>
                        <TableCell>{formatDateTime(item.created_at)}</TableCell>
                        <TableCell className="max-w-[260px] truncate">{item.titulo || "N/A"}</TableCell>
                        <TableCell>{item.setor || "N/A"}</TableCell>
                        <TableCell>
                          {sectorLock ? (
                            <div className="space-y-1">
                              <Badge variant={isQuestionLocked ? "destructive" : "secondary"}>
                                {isQuestionLocked ? "Bloqueado" : "Liberado"}
                              </Badge>
                              <div className="text-xs text-gray-600">
                                {isQuestionLocked ? (
                                  <>
                                    Retorna em {format(sectorLock.unlockAt as Date, "dd/MM/yyyy")}
                                  </>
                                ) : (
                                  <>
                                    Última em {format(sectorLock.lastInspectionAt as Date, "dd/MM/yyyy")}
                                  </>
                                )}
                              </div>
                            </div>
                          ) : (
                            <Badge variant="outline">Sem histórico</Badge>
                          )}
                        </TableCell>
                        <TableCell>{item.tecnico_seg || "N/A"}</TableCell>
                        <TableCell>{item.gestor || "N/A"}</TableCell>
                        <TableCell>
                          <Badge variant={temNaoConformidade ? "destructive" : "secondary"}>
                            {temNaoConformidade ? "Com não conformidade" : "Conforme"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {temNaoConformidade && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleStartPlanoAcao(item)}
                              >
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Plano de acao
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => void handleExportRecordPdf(item)}>
                              <FileText className="mr-2 h-4 w-4" />
                              PDF
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => void handleViewDetails(item)}>
                              <Eye className="mr-2 h-4 w-4" />
                              Detalhes
                            </Button>
            {isRootAdmin && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-700"
                                onClick={() => handleDeleteRecord(item)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Excluir
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Detalhes da Regra de Ouro</DialogTitle>
            <DialogDescription>
              {selected
                ? `Registro ${formatInspectionNumber(selected.numero_inspecao)} - ${formatDateTime(selected.created_at)}`
                : ""}
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="min-h-0 flex-1 space-y-4 overflow-y-scroll pr-2">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded border p-3 text-sm">
                  <p><strong>Título:</strong> {selected.titulo || "N/A"}</p>
                  <p><strong>Setor:</strong> {selected.setor || "N/A"}</p>
                  <p><strong>Técnico:</strong> {selected.tecnico_seg || "N/A"}</p>
                  <p><strong>Gestor:</strong> {selected.gestor || "N/A"}</p>
                  <p><strong>Acompanhante:</strong> {selected.acompanhante || "N/A"}</p>
                  {sectorQuestionLocks.get(getSectorComparisonKey(selected.setor)) && (
                    <p className="mt-2 rounded bg-amber-50 px-3 py-2 text-amber-900">
                      {(() => {
                        const lock = sectorQuestionLocks.get(getSectorComparisonKey(selected.setor));
                        if (!lock) return null;
                        return lock.locked
                          ? `Perguntas 15, 16 e 17 bloqueadas até ${format(lock.unlockAt as Date, "dd/MM/yyyy")}.`
                          : `Perguntas 15, 16 e 17 liberadas. Próxima verificação em ${format(
                              lock.unlockAt as Date,
                              "dd/MM/yyyy",
                            )}.`;
                      })()}
                    </p>
                  )}
                </div>
                <div className="rounded border p-3 text-sm">
                  <p className="mb-3 text-sm font-semibold">Resumo do registro</p>
                  <p><strong>Assinatura técnico:</strong> {selected.ass_tst ? "Sim" : "Não"}</p>
                  <p><strong>Assinatura gestor:</strong> {selected.ass_gestor ? "Sim" : "Não"}</p>
                  <p><strong>Assinatura acompanhante:</strong> {selected.ass_acomp ? "Sim" : "Não"}</p>
                  <p><strong>Anexos:</strong> {selected.anexos.length}</p>
                </div>
              </div>

              <div>
                <h3 className="mb-2 font-semibold">Assinaturas</h3>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {[
                    { label: "Técnico", value: selected.ass_tst },
                    { label: "Gestor", value: selected.ass_gestor },
                    { label: "Acompanhante", value: selected.ass_acomp },
                  ].map((signature) => (
                    <div key={signature.label} className="rounded border bg-gray-50 p-3">
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                        Assinatura {signature.label}
                      </p>
                      {signature.value ? (
                        <img
                          src={signature.value}
                          alt={`Assinatura ${signature.label}`}
                          className="h-24 w-full cursor-zoom-in rounded border bg-white object-contain"
                          onClick={() =>
                            handleOpenImagePreview(signature.value, `Assinatura ${signature.label}`)
                          }
                        />
                      ) : (
                        <div className="flex h-24 items-center justify-center rounded border bg-white text-xs text-gray-500">
                          Não assinada.
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="mb-2 font-semibold">Respostas</h3>
                {isLoadingDetails ? (
                  <div className="rounded border bg-gray-50 p-4 text-sm text-gray-500">
                    Carregando respostas completas...
                  </div>
                ) : selected.respostas.length === 0 ? (
                  <div className="rounded border bg-gray-50 p-4 text-sm text-gray-500">
                    Nenhuma resposta detalhada encontrada para este registro.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selected.respostas.map((response) => (
                    <div key={`${response.codigo}-${response.numero}`} className="rounded border p-3 text-sm">
                      <div className="mb-1 flex items-center justify-between gap-3">
                        <p className="font-medium">
                          {response.numero} - {response.pergunta || "Pergunta"}
                        </p>
                        <Badge
                          variant={
                            response.resposta === ANSWER_NO
                              ? "destructive"
                              : response.resposta === ANSWER_NA
                                ? "outline"
                                : "secondary"
                          }
                        >
                          {response.resposta}
                        </Badge>
                      </div>
                      {getResponseEvidences(response).map((evidence, evidenceIndex) => (
                        <div
                          key={`${response.codigo}-${evidence.id || evidenceIndex}`}
                          className="mt-3 space-y-2 rounded border bg-gray-50 p-3"
                        >
                          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                            Evidencia {evidenceIndex + 1}
                          </p>
                          {evidence.comentario ? (
                            <p className="text-gray-700">
                              <strong>Comentário:</strong> {evidence.comentario}
                            </p>
                          ) : null}
                          {evidence.foto ? (
                            <div className="space-y-2">
                              <p className="text-xs text-gray-500">
                                Foto: {evidence.foto.name || "arquivo"} ({formatFileSize(evidence.foto.size)})
                              </p>
                              {(() => {
                                const previewUrl = resolveAttachmentPreviewUrl(evidence.foto);
                                const isImage = previewUrl.length > 0 && isImageAttachment(evidence.foto);

                                if (isImage) {
                                  return (
                                    <div className="space-y-2">
                                      <img
                                        src={previewUrl}
                                        alt={evidence.foto?.name || `Foto ${response.numero}.${evidenceIndex + 1}`}
                                        className="h-36 w-full cursor-zoom-in rounded border object-cover"
                                        onClick={() =>
                                          handleOpenImagePreview(
                                            previewUrl,
                                            evidence.foto?.name || `Foto ${response.numero}.${evidenceIndex + 1}`,
                                          )
                                        }
                                      />
                                      <div className="flex flex-wrap items-center gap-2">
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          onClick={() =>
                                            handleOpenImagePreview(
                                              previewUrl,
                                              evidence.foto?.name || `Foto ${response.numero}.${evidenceIndex + 1}`,
                                            )
                                          }
                                        >
                                          Expandir imagem
                                        </Button>
                                      </div>
                                    </div>
                                  );
                                }

                                if (previewUrl.length > 0) {
                                  return (
                                    <p className="text-xs text-gray-500">
                                      Este anexo não possui visualização ampliada nesta tela.
                                    </p>
                                  );
                                }

                                return (
                                  <p className="text-xs text-gray-500">
                                    Visualização indisponível para este registro antigo.
                                  </p>
                                );
                              })()}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                    ))}
                  </div>
                )}
              </div>

              {selected.anexos.length > 0 && (
                <div>
                  <h3 className="mb-2 font-semibold">Anexos</h3>
                  <div className="space-y-2">
                    {selected.anexos.map((file, index) => (
                      <div
                        key={`${file.name}-${index}`}
                        className="rounded border bg-gray-50 px-3 py-2 text-sm"
                      >
                        <p className="truncate">{file.name || `Arquivo ${index + 1}`}</p>
                        <p className="text-xs text-gray-500">
                          {file.type || "tipo não informado"} - {formatFileSize(file.size)}
                        </p>
                        {(() => {
                          const previewUrl = resolveAttachmentPreviewUrl(file);
                          const isImage = previewUrl.length > 0 && isImageAttachment(file);

                          if (isImage) {
                            return (
                              <div className="mt-2 space-y-2">
                                <img
                                  src={previewUrl}
                                  alt={file.name || `Anexo ${index + 1}`}
                                  className="h-40 w-full cursor-zoom-in rounded border object-cover"
                                  onClick={() =>
                                    handleOpenImagePreview(
                                      previewUrl,
                                      file.name || `Anexo ${index + 1}`,
                                    )
                                  }
                                />
                                <div className="flex flex-wrap items-center gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      handleOpenImagePreview(
                                        previewUrl,
                                        file.name || `Anexo ${index + 1}`,
                                      )
                                    }
                                  >
                                    Expandir imagem
                                  </Button>
                                </div>
                              </div>
                            );
                          }

                          if (previewUrl.length > 0) {
                            return (
                              <p className="text-xs text-gray-500">
                                Este anexo não possui visualização ampliada nesta tela.
                              </p>
                            );
                          }

                          return (
                            <p className="text-xs text-gray-500">
                              Visualização indisponível para este registro antigo.
                            </p>
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {selected &&
              selected.respostas.some((response) => responseHasNonConformityEvidence(response, questionItems)) && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleStartPlanoAcao(selected)}
                >
                <PlusCircle className="mr-2 h-4 w-4" />
                Plano de acao
              </Button>
            )}
            {selected && (
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleExportRecordPdf(selected)}
              >
                <FileText className="mr-2 h-4 w-4" />
                Gerar PDF
              </Button>
            )}
            {selected && isRootAdmin && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => handleDeleteRecord(selected)}
              >
                Excluir registro
              </Button>
            )}
            <Button variant="outline" onClick={() => setDetailsOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(imagePreview)} onOpenChange={(open) => !open && setImagePreview(null)}>
        <DialogContent className="flex max-h-[92vh] max-w-5xl flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>{imagePreview?.title || "Imagem"}</DialogTitle>
            <DialogDescription>Visualização ampliada.</DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-auto rounded border bg-black/80 p-3">
            {imagePreview?.url ? (
              <img
                src={imagePreview.url}
                alt={imagePreview.title}
                className="mx-auto max-h-[72vh] w-auto max-w-full rounded object-contain"
              />
            ) : (
              <p className="text-sm text-white/80">Imagem indisponível.</p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setImagePreview(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminRegrasOuro;
