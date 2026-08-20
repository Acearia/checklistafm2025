import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Eye, RefreshCw, Trash2, Upload } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { accidentActionPlanService, goldenRuleService } from "@/lib/supabase-service";
import { useToast } from "@/hooks/use-toast";
import { canDeleteAdminRecords, getStoredAdminSession } from "@/lib/adminSession";
import { buildCompressedImageAttachment } from "@/lib/attachmentPreview";

type PrioridadeAcao = "Baixa" | "Media" | "Alta" | "Critica";
type StatusAcao = "Aberta" | "Em andamento" | "Concluida" | "Cancelada";

interface PlanoAcaoRecord {
  id: string;
  created_at: string;
  updated_at: string;
  numero_plano: number;
  numero_ocorrencia: number;
  data_ocorrencia: string;
  prioridade_ocorrencia: PrioridadeAcao;
  descricao_ocorrencia: string;
  origem: string;
  descricao_resumida_acao: string;
  severidade: string;
  probabilidade: string;
  prioridade: PrioridadeAcao;
  status: StatusAcao;
  responsavel_execucao: string;
  inicio_planejado: string;
  termino_planejado: string;
  acao_iniciada: string;
  acao_finalizada: string;
  descricao_acao: string;
  observacoes_conclusao: string;
  data_eficacia: string;
  observacao_eficacia: string;
  comentarios?: any[];
  finalizacao_foto?: AttachmentMeta | null;
}

interface InvestigacaoResumo {
  numero_ocorrencia: number;
  nome_acidentado: string;
  setor: string;
  data_ocorrencia: string;
  titulo: string;
  attachments: AttachmentMeta[];
}

interface AttachmentMeta {
  name: string;
  size: number;
  type: string;
  data_url?: string;
  dataUrl?: string;
  url?: string;
  preview_url?: string;
}

const INVESTIGACAO_STORAGE_KEY = "checklistafm-investigacoes-acidente";
const PLANO_STORAGE_KEY = "checklistafm-planos-acao-acidente";
const PLANO_STORAGE_EVENT = "checklistafm-plano-acao-updated";

const isMissingActionPlansTableError = (error: unknown) => {
  const message = String((error as any)?.message || "").toLowerCase();
  return message.includes("does not exist") && message.includes("accident_action_plans");
};

const formatNumero = (value: number) => String(value || 0).padStart(3, "0");

const formatDate = (value?: string) => {
  if (!value) return "N/A";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("pt-BR");
};

const formatText = (value?: string) => {
  if (!value) return "N/A";
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "N/A";
};

const getAttachmentImageUrl = (attachment?: AttachmentMeta | null) =>
  String(
    attachment?.data_url ||
      attachment?.dataUrl ||
      attachment?.url ||
      attachment?.preview_url ||
      "",
  ).trim();

const getTodayInputDate = () => new Date().toISOString().slice(0, 10);

const readFileAsAttachment = (file: File): Promise<AttachmentMeta> =>
  buildCompressedImageAttachment(file);

const normalizeQuestionCode = (value?: string | number | null) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  const parsed = Number.parseInt(digits, 10);
  return Number.isNaN(parsed) ? digits : String(parsed);
};

const extractQuestionNumberFromPlan = (record?: PlanoAcaoRecord | null) => {
  if (!record) return "";
  const texts = [
    record.descricao_resumida_acao,
    record.descricao_ocorrencia,
    ...(Array.isArray(record.comentarios) ? record.comentarios.map((item) => item?.texto || "") : []),
  ];

  for (const text of texts) {
    const match = String(text).match(/Pergunta\s+(\d+)/i) || String(text).match(/Pergunta\s+(\d{1,3})/i);
    if (match?.[1]) return match[1];
  }

  return "";
};

const calculateEficaciaDueDate = (finishedAt?: string) => {
  if (!finishedAt) return "";
  const baseDate = new Date(`${finishedAt}T00:00:00`);
  if (Number.isNaN(baseDate.getTime())) return "";
  baseDate.setDate(baseDate.getDate() + 30);
  return baseDate.toISOString().slice(0, 10);
};

const isEficaciaPendente = (item: PlanoAcaoRecord) => {
  if (item.status !== "Concluida") return false;
  if (!item.acao_finalizada) return false;
  if (item.data_eficacia || item.observacao_eficacia.trim()) return false;
  const dueDate = calculateEficaciaDueDate(item.acao_finalizada);
  if (!dueDate) return false;
  const today = new Date();
  const compareDate = new Date(`${dueDate}T23:59:59`);
  return !Number.isNaN(compareDate.getTime()) && today >= compareDate;
};

const isPlanoAtrasado = (item: PlanoAcaoRecord) => {
  if (item.status === "Concluida" || item.status === "Cancelada") return false;
  if (!item.termino_planejado) return false;

  const dueDate = new Date(`${item.termino_planejado}T23:59:59`);
  if (Number.isNaN(dueDate.getTime())) return false;

  const today = new Date();
  return dueDate < today;
};

const normalizeResponsibleKey = (value: string) =>
  value
    .trim()
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");

const getPlanoProgressPercent = (item: PlanoAcaoRecord) => {
  if (item.status === "Concluida") return 100;
  if (item.status === "Cancelada") return 0;
  if (item.acao_iniciada || item.status === "Em andamento") return 60;
  return 20;
};

const getPlanoProgressBarClasses = (item: PlanoAcaoRecord) => {
  if (isPlanoAtrasado(item)) return "bg-red-500";
  if (item.status === "Concluida") return "bg-green-500";
  if (item.status === "Cancelada") return "bg-gray-400";
  if (item.status === "Em andamento" || item.acao_iniciada) return "bg-amber-500";
  return "bg-blue-500";
};

const getPlanoProgressTextClasses = (item: PlanoAcaoRecord) => {
  if (isPlanoAtrasado(item)) return "text-red-700";
  if (item.status === "Concluida") return "text-green-700";
  if (item.status === "Cancelada") return "text-gray-700";
  if (item.status === "Em andamento" || item.acao_iniciada) return "text-amber-700";
  return "text-blue-700";
};

const parsePlanos = (): PlanoAcaoRecord[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PLANO_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item: any): PlanoAcaoRecord | null => {
        if (!item || typeof item !== "object") return null;
        return {
          id: String(item.id || `${Date.now()}-${Math.random()}`),
          created_at: String(item.created_at || ""),
          updated_at: String(item.updated_at || ""),
          numero_plano: Number(item.numero_plano) || 0,
          numero_ocorrencia: Number(item.numero_ocorrencia) || 0,
          data_ocorrencia: String(item.data_ocorrencia || ""),
          prioridade_ocorrencia: (String(item.prioridade_ocorrencia || "Baixa") as PrioridadeAcao) || "Baixa",
          descricao_ocorrencia: String(item.descricao_ocorrencia || ""),
          origem: String(item.origem || "Acidente"),
          descricao_resumida_acao: String(item.descricao_resumida_acao || ""),
          severidade: String(item.severidade || ""),
          probabilidade: String(item.probabilidade || ""),
          prioridade: (String(item.prioridade || "Baixa") as PrioridadeAcao) || "Baixa",
          status: (String(item.status || "Aberta") as StatusAcao) || "Aberta",
          responsavel_execucao: String(item.responsavel_execucao || ""),
          inicio_planejado: String(item.inicio_planejado || ""),
          termino_planejado: String(item.termino_planejado || ""),
          acao_iniciada: String(item.acao_iniciada || ""),
          acao_finalizada: String(item.acao_finalizada || ""),
          descricao_acao: String(item.descricao_acao || ""),
          observacoes_conclusao: String(item.observacoes_conclusao || ""),
          data_eficacia: String(item.data_eficacia || ""),
          observacao_eficacia: String(item.observacao_eficacia || ""),
          finalizacao_foto: item.finalizacao_foto
            ? {
                name: String(item.finalizacao_foto?.name || ""),
                size: Number(item.finalizacao_foto?.size) || 0,
                type: String(item.finalizacao_foto?.type || ""),
                data_url: String(item.finalizacao_foto?.data_url || item.finalizacao_foto?.dataUrl || ""),
                dataUrl: String(item.finalizacao_foto?.dataUrl || item.finalizacao_foto?.data_url || ""),
                url: String(item.finalizacao_foto?.url || ""),
                preview_url: String(item.finalizacao_foto?.preview_url || ""),
              }
            : null,
          comentarios: Array.isArray(item.comentarios)
            ? item.comentarios.map((comentario: any) => ({
                id: String(comentario?.id || `${Date.now()}-${Math.random()}`),
                texto: String(comentario?.texto || ""),
                autor: String(comentario?.autor || "Sistema"),
                created_at: String(comentario?.created_at || ""),
              }))
            : [],
        };
      })
      .filter((item): item is PlanoAcaoRecord => Boolean(item))
      .sort((a, b) => {
        const dateA = new Date(a.updated_at || a.created_at).getTime();
        const dateB = new Date(b.updated_at || b.created_at).getTime();
        return dateB - dateA;
      });
  } catch (error) {
    console.error("Erro ao carregar planos de acao:", error);
    return [];
  }
};

const mergePlanoRecords = (primary: PlanoAcaoRecord, secondary?: PlanoAcaoRecord | null): PlanoAcaoRecord => {
  if (!secondary) return primary;

  const pick = (first: string, second: string) => (first.trim() ? first : second);
  const commentsById = new Map<string, any>();
  [...(primary.comentarios || []), ...(secondary.comentarios || [])].forEach((comment) => {
    const key = comment.id || `${comment.created_at}-${comment.texto}`;
    if (!commentsById.has(key)) {
      commentsById.set(key, comment);
    }
  });

  return {
    ...primary,
    ...secondary,
    descricao_ocorrencia: pick(primary.descricao_ocorrencia, secondary.descricao_ocorrencia),
    descricao_resumida_acao: pick(primary.descricao_resumida_acao, secondary.descricao_resumida_acao),
    severidade: pick(primary.severidade, secondary.severidade),
    probabilidade: pick(primary.probabilidade, secondary.probabilidade),
    responsavel_execucao: pick(primary.responsavel_execucao, secondary.responsavel_execucao),
    inicio_planejado: pick(primary.inicio_planejado, secondary.inicio_planejado),
    termino_planejado: pick(primary.termino_planejado, secondary.termino_planejado),
    acao_iniciada: pick(primary.acao_iniciada, secondary.acao_iniciada),
    acao_finalizada: pick(primary.acao_finalizada, secondary.acao_finalizada),
    descricao_acao: pick(primary.descricao_acao, secondary.descricao_acao),
    observacoes_conclusao: pick(primary.observacoes_conclusao, secondary.observacoes_conclusao),
    data_eficacia: pick(primary.data_eficacia, secondary.data_eficacia),
    observacao_eficacia: pick(primary.observacao_eficacia, secondary.observacao_eficacia),
    finalizacao_foto: primary.finalizacao_foto || secondary.finalizacao_foto || null,
    comentarios: Array.from(commentsById.values()),
  };
};

const mapSupabasePlan = (item: any): PlanoAcaoRecord | null => {
  if (!item || typeof item !== "object") return null;
  const rawComments = Array.isArray(item.comments)
    ? item.comments
    : Array.isArray(item.comentarios)
      ? item.comentarios
      : [];

  return {
    id: String(item.id || `${Date.now()}-${Math.random()}`),
    created_at: String(item.created_at || ""),
    updated_at: String(item.updated_at || ""),
    numero_plano: Number(item.numero_plano) || 0,
    numero_ocorrencia: Number(item.numero_ocorrencia) || 0,
    data_ocorrencia: String(item.data_ocorrencia || ""),
    prioridade_ocorrencia: (String(item.prioridade_ocorrencia || "Baixa") as PrioridadeAcao) || "Baixa",
    descricao_ocorrencia: String(item.descricao_ocorrencia || ""),
    origem: String(item.origem || "Acidente"),
    descricao_resumida_acao: String(item.descricao_resumida_acao || ""),
    severidade: String(item.severidade || ""),
    probabilidade: String(item.probabilidade || ""),
    prioridade: (String(item.prioridade || "Baixa") as PrioridadeAcao) || "Baixa",
    status: (String(item.status || "Aberta") as StatusAcao) || "Aberta",
    responsavel_execucao: String(item.responsavel_execucao || ""),
    inicio_planejado: String(item.inicio_planejado || ""),
    termino_planejado: String(item.termino_planejado || ""),
    acao_iniciada: String(item.acao_iniciada || ""),
    acao_finalizada: String(item.acao_finalizada || ""),
    descricao_acao: String(item.descricao_acao || ""),
    observacoes_conclusao: String(item.observacoes_conclusao || ""),
    data_eficacia: String(item.data_eficacia || ""),
    observacao_eficacia: String(item.observacao_eficacia || ""),
    finalizacao_foto: item.finalizacao_foto
      ? {
          name: String(item.finalizacao_foto?.name || ""),
          size: Number(item.finalizacao_foto?.size) || 0,
          type: String(item.finalizacao_foto?.type || ""),
          data_url: String(item.finalizacao_foto?.data_url || item.finalizacao_foto?.dataUrl || ""),
          dataUrl: String(item.finalizacao_foto?.dataUrl || item.finalizacao_foto?.data_url || ""),
          url: String(item.finalizacao_foto?.url || ""),
          preview_url: String(item.finalizacao_foto?.preview_url || ""),
        }
      : null,
    comentarios: rawComments
      .map((comentario: any) => ({
          id: String(comentario?.id || `${Date.now()}-${Math.random()}`),
          texto: String(comentario?.texto || ""),
          autor: String(comentario?.autor || "Sistema"),
          created_at: String(comentario?.created_at || ""),
        })),
  };
};

const parseInvestigacoes = (): InvestigacaoResumo[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(INVESTIGACAO_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item: any): InvestigacaoResumo | null => {
        if (!item || typeof item !== "object") return null;
        const numeroOcorrencia = Number(item.numero_ocorrencia) || 0;
        if (numeroOcorrencia <= 0) return null;
        return {
          numero_ocorrencia: numeroOcorrencia,
          nome_acidentado: String(item.nome_acidentado || ""),
          setor: String(item.setor || ""),
          data_ocorrencia: String(item.data_ocorrencia || ""),
          titulo: String(item.titulo || ""),
          attachments: Array.isArray(item.attachments)
            ? item.attachments.map((attachment: any) => ({
                name: String(attachment?.name || ""),
                size: Number(attachment?.size) || 0,
                type: String(attachment?.type || ""),
                data_url: String(attachment?.data_url || ""),
                dataUrl: String(attachment?.dataUrl || ""),
                url: String(attachment?.url || ""),
                preview_url: String(attachment?.preview_url || ""),
              }))
            : [],
        };
      })
      .filter((item): item is InvestigacaoResumo => Boolean(item));
  } catch (error) {
    console.error("Erro ao carregar investigacoes:", error);
    return [];
  }
};

const AdminPlanosAcao = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [records, setRecords] = useState<PlanoAcaoRecord[]>([]);
  const [investigacoes, setInvestigacoes] = useState<InvestigacaoResumo[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [ocorrenciaFilter, setOcorrenciaFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [prioridadeFilter, setPrioridadeFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [viewPlano, setViewPlano] = useState<PlanoAcaoRecord | null>(null);
  const [goldenRules, setGoldenRules] = useState<any[]>([]);
  const [goldenRuleDetail, setGoldenRuleDetail] = useState<any | null>(null);
  const [goldenRuleDetailLoading, setGoldenRuleDetailLoading] = useState(false);
  const [finishPlano, setFinishPlano] = useState<PlanoAcaoRecord | null>(null);
  const [finishDate, setFinishDate] = useState(getTodayInputDate());
  const [finishObservation, setFinishObservation] = useState("");
  const [finishPhoto, setFinishPhoto] = useState<AttachmentMeta | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);

  const ocorrenciaFromQuery = useMemo(() => {
    const value = searchParams.get("ocorrencia") || "";
    return value.trim();
  }, [searchParams]);
  const origemFromQuery = useMemo(() => {
    const value = searchParams.get("origemFiltro") || "";
    return value.trim().toLowerCase();
  }, [searchParams]);
  const [canDelete, setCanDelete] = useState<boolean>(() =>
    canDeleteAdminRecords(getStoredAdminSession()),
  );

  const resetFinishDialog = () => {
    setFinishPlano(null);
    setFinishDate(getTodayInputDate());
    setFinishObservation("");
    setFinishPhoto(null);
    setIsFinishing(false);
  };

  const openFinishDialog = (record: PlanoAcaoRecord) => {
    setFinishPlano(record);
    setFinishDate(record.acao_finalizada || getTodayInputDate());
    setFinishObservation(record.observacoes_conclusao || "");
    setFinishPhoto(record.finalizacao_foto || null);
  };

  useEffect(() => {
    setOcorrenciaFilter(ocorrenciaFromQuery.replace(/\D/g, ""));
  }, [ocorrenciaFromQuery]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncDeletePermission = () => {
      setCanDelete(canDeleteAdminRecords(getStoredAdminSession()));
    };

    window.addEventListener("storage", syncDeletePermission);
    return () => {
      window.removeEventListener("storage", syncDeletePermission);
    };
  }, []);

  const loadData = async () => {
    const localRecords = parsePlanos();
    setInvestigacoes(parseInvestigacoes());

    try {
      try {
        const rules = await goldenRuleService.safeGetListWithFallback();
        setGoldenRules(Array.isArray(rules) ? rules : []);
      } catch (error) {
        console.warn("Erro ao carregar regras de ouro para visualizacao do plano:", error);
        setGoldenRules([]);
      }

      const remoteRows = await accidentActionPlanService.safeGetListWithFallback();
      if (remoteRows.length === 0) {
        setRecords(localRecords);
        return;
      }

      const remoteRecords = remoteRows
        .map((item) => mapSupabasePlan(item))
        .filter((item): item is PlanoAcaoRecord => Boolean(item))
        .sort((a, b) => {
          const dateA = new Date(a.updated_at || a.created_at).getTime();
          const dateB = new Date(b.updated_at || b.created_at).getTime();
          return dateB - dateA;
        });

      const mergedMap = new Map<string, PlanoAcaoRecord>();
      [...remoteRecords, ...localRecords].forEach((item) => {
        const key = item.id || `n-${item.numero_plano}-${item.numero_ocorrencia}`;
        const current = mergedMap.get(key);
        if (!current) {
          mergedMap.set(key, item);
          return;
        }

        const currentTimestamp = new Date(current.updated_at || current.created_at).getTime();
        const incomingTimestamp = new Date(item.updated_at || item.created_at).getTime();
        const preferred = incomingTimestamp >= currentTimestamp ? item : current;
        const fallback = incomingTimestamp >= currentTimestamp ? current : item;
        mergedMap.set(key, mergePlanoRecords(preferred, fallback));
      });
      const mergedRecords = Array.from(mergedMap.values()).sort((a, b) => {
        const dateA = new Date(a.updated_at || a.created_at).getTime();
        const dateB = new Date(b.updated_at || b.created_at).getTime();
        return dateB - dateA;
      });

      setRecords(mergedRecords);
      localStorage.setItem(PLANO_STORAGE_KEY, JSON.stringify(mergedRecords));
    } catch (error) {
      if (!isMissingActionPlansTableError(error)) {
        console.error("Erro ao carregar planos de ação no Supabase:", error);
      }
      setRecords(localRecords);
    }
  };

  useEffect(() => {
    void loadData();

    const handleStorage = (event: StorageEvent) => {
      if (!event.key || event.key === PLANO_STORAGE_KEY || event.key === INVESTIGACAO_STORAGE_KEY) {
        void loadData();
      }
    };

    const handlePlanoUpdated = () => void loadData();
    const handleInvestigacaoUpdated = () => void loadData();

    window.addEventListener("storage", handleStorage);
    window.addEventListener(PLANO_STORAGE_EVENT, handlePlanoUpdated);
    window.addEventListener("checklistafm-investigacao-acidente-updated", handleInvestigacaoUpdated);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(PLANO_STORAGE_EVENT, handlePlanoUpdated);
      window.removeEventListener("checklistafm-investigacao-acidente-updated", handleInvestigacaoUpdated);
    };
  }, []);

  const investigacaoByOcorrencia = useMemo(() => {
    const map = new Map<number, InvestigacaoResumo>();
    investigacoes.forEach((item) => {
      map.set(item.numero_ocorrencia, item);
    });
    return map;
  }, [investigacoes]);

  const selectedInvestigacao = useMemo(() => {
    if (!viewPlano) return null;
    return investigacaoByOcorrencia.get(viewPlano.numero_ocorrencia) || null;
  }, [viewPlano, investigacaoByOcorrencia]);

  const selectedGoldenRule = useMemo(() => {
    if (!viewPlano || viewPlano.origem.trim().toLowerCase() !== "regra de ouro") return null;
    return (
      goldenRules.find((item) => Number(item?.numero_inspecao) === Number(viewPlano.numero_ocorrencia)) ||
      null
    );
  }, [viewPlano, goldenRules]);

  const selectedQuestionNumber = useMemo(() => extractQuestionNumberFromPlan(viewPlano), [viewPlano]);

  const selectedQuestionEvidencePhoto = useMemo(() => {
    const sourceRule = goldenRuleDetail || selectedGoldenRule;
    if (!sourceRule || !selectedQuestionNumber) return "";

    const responses = Array.isArray(sourceRule.responses) ? sourceRule.responses : [];
    const question = responses.find((response: any) => {
      const numero = normalizeQuestionCode(response?.numero);
      const codigo = normalizeQuestionCode(response?.codigo);
      const target = normalizeQuestionCode(selectedQuestionNumber);
      return numero === target || codigo === target;
    });

    const evidencePhoto = (() => {
      const directCandidates = [
        question?.foto?.data_url,
        question?.foto_data_url,
        question?.foto?.url,
        question?.foto?.preview_url,
      ];

      const directPhoto = directCandidates.find((value) => String(value || "").trim().length > 0);
      if (directPhoto) return directPhoto;

      const evidences = Array.isArray(question?.evidences) ? question.evidences : [];
      for (const evidence of evidences) {
        const evidenceCandidates = [
          evidence?.foto?.data_url,
          evidence?.foto_data_url,
          evidence?.foto?.url,
          evidence?.foto?.preview_url,
          evidence?.url,
          evidence?.preview_url,
        ];

        const found = evidenceCandidates.find((value) => String(value || "").trim().length > 0);
        if (found) return found;
      }

      return "";
    })();

    return String(evidencePhoto || "").trim();
  }, [goldenRuleDetail, selectedGoldenRule, selectedQuestionNumber]);

  useEffect(() => {
    let cancelled = false;

    const loadDetail = async () => {
      if (!viewPlano || viewPlano.origem.trim().toLowerCase() !== "regra de ouro") {
        setGoldenRuleDetail(null);
        setGoldenRuleDetailLoading(false);
        return;
      }

      const summaryRule =
        goldenRules.find((item) => Number(item?.numero_inspecao) === Number(viewPlano.numero_ocorrencia)) ||
        null;

      if (!summaryRule?.id) {
        setGoldenRuleDetail(summaryRule);
        setGoldenRuleDetailLoading(false);
        return;
      }

      setGoldenRuleDetailLoading(true);
      try {
        const detail = await goldenRuleService.getById(summaryRule.id);
        if (!cancelled) {
          setGoldenRuleDetail(detail || summaryRule);
        }
      } catch (error) {
        if (!cancelled) {
          console.warn("Erro ao carregar detalhes da Regra de Ouro para o resumo do plano:", error);
          setGoldenRuleDetail(summaryRule);
        }
      } finally {
        if (!cancelled) {
          setGoldenRuleDetailLoading(false);
        }
      }
    };

    void loadDetail();

    return () => {
      cancelled = true;
    };
  }, [viewPlano, goldenRules]);

  const filteredRecords = useMemo(() => {
    return records.filter((item) => {
      const linked = investigacaoByOcorrencia.get(item.numero_ocorrencia);
      const normalizedSearch = searchTerm.trim().toLowerCase();

      const matchesSearch =
        normalizedSearch.length === 0 ||
        String(item.numero_plano).includes(normalizedSearch) ||
        String(item.numero_ocorrencia).includes(normalizedSearch) ||
        item.descricao_ocorrencia.toLowerCase().includes(normalizedSearch) ||
        item.descricao_resumida_acao.toLowerCase().includes(normalizedSearch) ||
        item.descricao_acao.toLowerCase().includes(normalizedSearch) ||
        item.responsavel_execucao.toLowerCase().includes(normalizedSearch) ||
        String(linked?.nome_acidentado || "").toLowerCase().includes(normalizedSearch) ||
        String(linked?.setor || "").toLowerCase().includes(normalizedSearch);
      const matchesOcorrencia =
        !ocorrenciaFilter.trim() ||
        String(item.numero_ocorrencia).includes(ocorrenciaFilter.trim());

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "Atrasadas" ? isPlanoAtrasado(item) : item.status === statusFilter);
      const matchesPrioridade = prioridadeFilter === "all" || item.prioridade === prioridadeFilter;
      const matchesOrigem =
        origemFromQuery.length === 0 ||
        item.origem.trim().toLowerCase() === origemFromQuery;

      const itemDateValue = item.data_ocorrencia || linked?.data_ocorrencia || item.created_at;
      const itemDate = itemDateValue ? new Date(itemDateValue) : null;
      const from = dateFrom ? new Date(dateFrom) : null;
      const to = dateTo ? new Date(dateTo) : null;
      if (from) from.setHours(0, 0, 0, 0);
      if (to) to.setHours(23, 59, 59, 999);
      const matchesDate =
        (!from || (itemDate && itemDate >= from)) &&
        (!to || (itemDate && itemDate <= to));

      return (
        matchesSearch &&
        matchesOcorrencia &&
        matchesStatus &&
        matchesPrioridade &&
        matchesOrigem &&
        matchesDate
      );
    });
  }, [
    records,
    investigacaoByOcorrencia,
    searchTerm,
    ocorrenciaFilter,
    statusFilter,
    prioridadeFilter,
    origemFromQuery,
    dateFrom,
    dateTo,
  ]);

  const handleDeletePlano = async (record: PlanoAcaoRecord) => {
    if (!canDelete) {
      toast({
        title: "Acesso negado",
        description: "Apenas administradores e coordenadores podem excluir planos de ação.",
        variant: "destructive",
      });
      return;
    }

    const shouldDelete = window.confirm(
      "Deseja realmente excluir este plano de ação? Esta ação não pode ser desfeita.",
    );
    if (!shouldDelete) return;

    try {
      try {
        await accidentActionPlanService.delete(record.id);
      } catch (error) {
        if (!isMissingActionPlansTableError(error)) {
          throw error;
        }
      }

      const nextRecords = records.filter((item) => item.id !== record.id);
      setRecords(nextRecords);
      localStorage.setItem(PLANO_STORAGE_KEY, JSON.stringify(nextRecords));
      window.dispatchEvent(new CustomEvent(PLANO_STORAGE_EVENT));

      toast({
        title: "Plano excluído",
        description: `O plano ${formatNumero(record.numero_plano)} foi removido com sucesso.`,
      });
    } catch (error) {
      console.error("[AdminPlanosAcao] Erro ao excluir plano:", error);
      toast({
        title: "Erro ao excluir plano",
        description: "Não foi possível remover o plano de ação.",
        variant: "destructive",
      });
    }
  };

  const handleFinishPhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Arquivo inválido",
        description: "Selecione uma imagem para anexar à finalização.",
        variant: "destructive",
      });
      event.target.value = "";
      return;
    }

    try {
      const attachment = await readFileAsAttachment(file);
      setFinishPhoto(attachment);
    } catch (error) {
      console.error("[AdminPlanosAcao] Erro ao carregar foto de finalização:", error);
      toast({
        title: "Erro ao carregar foto",
        description: "Não foi possível anexar a foto selecionada.",
        variant: "destructive",
      });
    }
  };

  const handleFinalizePlano = async () => {
    if (!finishPlano) return;
    if (!finishDate) {
      toast({
        title: "Informe a data",
        description: "Escolha a data de finalização do plano de ação.",
        variant: "destructive",
      });
      return;
    }

    setIsFinishing(true);
    const now = new Date().toISOString();
    const updatedPlano: PlanoAcaoRecord = {
      ...finishPlano,
      status: "Concluida",
      acao_finalizada: finishDate,
      observacoes_conclusao: finishObservation.trim(),
      finalizacao_foto: finishPhoto,
      updated_at: now,
      comentarios: finishPlano.comentarios || [],
    };

    try {
      try {
        await accidentActionPlanService.upsertFromLegacy({
          ...updatedPlano,
          comentarios: updatedPlano.comentarios || [],
        });
      } catch (error) {
        if (!isMissingActionPlansTableError(error)) {
          console.warn("[AdminPlanosAcao] Plano finalizado localmente, mas falhou ao sincronizar no Supabase:", error);
        }
      }

      const nextRecords = records.map((item) => (item.id === updatedPlano.id ? updatedPlano : item));
      setRecords(nextRecords);
      localStorage.setItem(PLANO_STORAGE_KEY, JSON.stringify(nextRecords));
      window.dispatchEvent(new CustomEvent(PLANO_STORAGE_EVENT));
      setViewPlano((current) => (current?.id === updatedPlano.id ? updatedPlano : current));
      resetFinishDialog();

      toast({
        title: "Plano finalizado",
        description: `Plano ${formatNumero(updatedPlano.numero_plano)} concluído com sucesso.`,
      });
    } catch (error) {
      console.error("[AdminPlanosAcao] Erro ao finalizar plano:", error);
      toast({
        title: "Erro ao finalizar",
        description: "Não foi possível finalizar o plano de ação.",
        variant: "destructive",
      });
      setIsFinishing(false);
    }
  };

  const summary = useMemo(() => {
    const total = records.length;
    const abertas = records.filter((item) => item.status === "Aberta").length;
    const andamento = records.filter((item) => item.status === "Em andamento").length;
    const concluidas = records.filter((item) => item.status === "Concluida").length;
    const atrasadas = records.filter(isPlanoAtrasado).length;
    const eficaciaPendente = records.filter(isEficaciaPendente).length;
    return { total, abertas, andamento, concluidas, atrasadas, eficaciaPendente };
  }, [records]);

  const responsibleRanking = useMemo(() => {
    const grouped = new Map<
      string,
      { responsavel: string; total: number; andamento: number; concluidos: number; atrasados: number }
    >();

    records.forEach((item) => {
      const responsavel = item.responsavel_execucao.trim() || "Sem responsável";
      const key = normalizeResponsibleKey(responsavel);
      const current = grouped.get(key) || {
        responsavel,
        total: 0,
        andamento: 0,
        concluidos: 0,
        atrasados: 0,
      };

      current.total += 1;
      if (item.status === "Em andamento") current.andamento += 1;
      if (item.status === "Concluida") current.concluidos += 1;
      if (isPlanoAtrasado(item)) current.atrasados += 1;
      grouped.set(key, current);
    });

    return Array.from(grouped.values()).sort(
      (a, b) =>
        b.atrasados - a.atrasados ||
        b.andamento - a.andamento ||
        a.concluidos - b.concluidos ||
        b.total - a.total ||
        a.responsavel.localeCompare(b.responsavel, "pt-BR"),
    );
  }, [records]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Planos de Acao</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => navigate("/plano-acao-acidente?origem=admin")}>
            Novo plano
          </Button>
          <Button variant="outline" onClick={() => navigate("/admin/investigacoes")}>
            Investigacoes
          </Button>
          <Button variant="outline" onClick={() => void loadData()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-6">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total</CardDescription>
            <CardTitle>{summary.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Abertas</CardDescription>
            <CardTitle>{summary.abertas}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Em andamento</CardDescription>
            <CardTitle>{summary.andamento}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Concluidas</CardDescription>
            <CardTitle>{summary.concluidas}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Atrasadas</CardDescription>
            <CardTitle className={summary.atrasadas > 0 ? "text-red-600" : ""}>
              {summary.atrasadas}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avaliacao de eficacia pendente</CardDescription>
            <CardTitle>{summary.eficaciaPendente}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Desempenho por responsável</CardTitle>
          <CardDescription>
            Ranking do maior número de atrasos para o melhor resultado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {responsibleRanking.length === 0 ? (
            <div className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
              Nenhum responsável encontrado nos planos de ação.
            </div>
          ) : (
            <div className="max-h-80 overflow-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow>
                    <TableHead className="w-16">Posição</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead className="text-center">Em andamento</TableHead>
                    <TableHead className="text-center">Concluídos</TableHead>
                    <TableHead className="text-center">Atrasados</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {responsibleRanking.map((item, index) => (
                    <TableRow key={normalizeResponsibleKey(item.responsavel)}>
                      <TableCell className="font-semibold text-muted-foreground">#{index + 1}</TableCell>
                      <TableCell className="font-medium">{item.responsavel}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{item.andamento}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                          {item.concluidos}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={item.atrasados > 0 ? "destructive" : "secondary"}>
                          {item.atrasados}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-semibold">{item.total}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Refine por status, prioridade, periodo e busca.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-7">
            <div>
              <label className="mb-1 block text-sm font-medium">Busca rapida</label>
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Plano, ocorrencia, responsavel..."
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Ocorrencia</label>
              <Input
                value={ocorrenciaFilter}
                onChange={(e) => setOcorrenciaFilter(e.target.value.replace(/\D/g, ""))}
                placeholder="Ex: 001"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Data inicio</label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Data fim</label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="Aberta">Aberta</SelectItem>
                  <SelectItem value="Em andamento">Em andamento</SelectItem>
                  <SelectItem value="Atrasadas">Atrasadas</SelectItem>
                  <SelectItem value="Concluida">Concluida</SelectItem>
                  <SelectItem value="Cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Prioridade</label>
              <Select value={prioridadeFilter} onValueChange={setPrioridadeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="Baixa">Baixa</SelectItem>
                  <SelectItem value="Media">Media</SelectItem>
                  <SelectItem value="Alta">Alta</SelectItem>
                  <SelectItem value="Critica">Critica</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSearchTerm("");
                  setOcorrenciaFilter("");
                  setStatusFilter("all");
                  setPrioridadeFilter("all");
                  setDateFrom("");
                  setDateTo("");
                }}
              >
                Limpar filtros
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Planos de Acao</CardTitle>
          <CardDescription>
            {filteredRecords.length === 0
              ? "Nenhum plano encontrado."
              : `Mostrando ${filteredRecords.length} plano(s).`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredRecords.length === 0 ? (
            <div className="rounded-md border bg-gray-50 p-8 text-center text-gray-500">
              Nao ha planos de acao com os filtros selecionados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plano</TableHead>
                    <TableHead>Ocorrencia</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Acidentado</TableHead>
                    <TableHead>Setor</TableHead>
                    <TableHead>Resumo da acao</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Prioridade</TableHead>
                    <TableHead>Responsavel</TableHead>
                    <TableHead>Termino</TableHead>
                    <TableHead className="sticky right-0 z-20 min-w-[300px] bg-background text-right shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.35)]">
                      Acoes
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.map((item) => {
                    const linked = investigacaoByOcorrencia.get(item.numero_ocorrencia);
                    const progressPercent = getPlanoProgressPercent(item);
                    return (
                      <TableRow key={item.id}>
                        <TableCell>{formatNumero(item.numero_plano)}</TableCell>
                        <TableCell>{formatNumero(item.numero_ocorrencia)}</TableCell>
                        <TableCell>{item.origem || "N/A"}</TableCell>
                        <TableCell>{linked?.nome_acidentado || "N/A"}</TableCell>
                        <TableCell>{linked?.setor || "N/A"}</TableCell>
                        <TableCell className="max-w-[280px] truncate">{item.descricao_resumida_acao || "N/A"}</TableCell>
                        <TableCell>
                          <div className="min-w-[160px] space-y-2">
                            <div className="flex flex-wrap gap-1">
                              <Badge variant={item.status === "Concluida" ? "default" : "secondary"}>
                                {item.status}
                              </Badge>
                              {isPlanoAtrasado(item) && (
                                <Badge variant="destructive">Atrasada</Badge>
                              )}
                              {isEficaciaPendente(item) && (
                                <Badge variant="destructive">Avaliacao de eficacia pendente</Badge>
                              )}
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className={`text-xs font-semibold ${getPlanoProgressTextClasses(item)}`}>
                                  {progressPercent}%
                                </span>
                                <span className="text-[11px] text-muted-foreground">andamento</span>
                              </div>
                              <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-slate-700">
                                <div
                                  className={`h-full rounded-full transition-all ${getPlanoProgressBarClasses(item)}`}
                                  style={{ width: `${progressPercent}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={item.prioridade === "Critica" ? "destructive" : "secondary"}>
                            {item.prioridade}
                          </Badge>
                        </TableCell>
                        <TableCell>{item.responsavel_execucao || "N/A"}</TableCell>
                        <TableCell>{formatDate(item.termino_planejado)}</TableCell>
                        <TableCell className="sticky right-0 z-10 bg-background text-right shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.35)]">
                          <div className="flex min-w-[300px] flex-wrap items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2"
                              title="Ver plano"
                              onClick={() => setViewPlano(item)}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              Ver
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2"
                              title="Editar plano"
                              onClick={() =>
                                navigate(
                                  `/plano-acao-acidente?plano=${encodeURIComponent(item.id)}&ocorrencia=${item.numero_ocorrencia}&origem=admin`,
                                )
                              }
                            >
                              Editar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2"
                              title="Ver investigacao"
                              onClick={() => navigate(`/admin/investigacoes?ocorrencia=${item.numero_ocorrencia}`)}
                            >
                              Invest.
                            </Button>
                            {item.status !== "Concluida" && item.status !== "Cancelada" ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 text-green-700 hover:text-green-800"
                                title="Finalizar plano"
                                onClick={() => openFinishDialog(item)}
                              >
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                Finalizar
                              </Button>
                            ) : null}
                            {canDelete ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 text-red-600 hover:text-red-700"
                                title="Excluir plano"
                                onClick={() => void handleDeletePlano(item)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Excluir
                              </Button>
                            ) : null}
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

      <Dialog open={Boolean(viewPlano)} onOpenChange={(open) => !open && setViewPlano(null)}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Resumo do plano {viewPlano ? formatNumero(viewPlano.numero_plano) : ""}
            </DialogTitle>
            <DialogDescription>
              Visualização simplificada com as informações principais do plano de ação.
            </DialogDescription>
          </DialogHeader>

          {viewPlano ? (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Plano</CardDescription>
                    <CardTitle>{formatNumero(viewPlano.numero_plano)}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Ocorrência</CardDescription>
                    <CardTitle>{formatNumero(viewPlano.numero_ocorrencia)}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Origem</CardDescription>
                    <CardTitle>{formatText(viewPlano.origem)}</CardTitle>
                  </CardHeader>
                </Card>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3 rounded-lg border p-4">
                  <h3 className="text-sm font-semibold">Dados principais</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <div className="text-xs font-medium uppercase text-muted-foreground">Status</div>
                      <div className="mt-1">
                        <Badge variant={viewPlano.status === "Concluida" ? "default" : "secondary"}>
                          {viewPlano.status}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase text-muted-foreground">Prioridade</div>
                      <div className="mt-1">
                        <Badge variant={viewPlano.prioridade === "Critica" ? "destructive" : "secondary"}>
                          {viewPlano.prioridade}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase text-muted-foreground">Responsável</div>
                      <div className="mt-1 text-sm">{formatText(viewPlano.responsavel_execucao)}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase text-muted-foreground">Prazo</div>
                      <div className="mt-1 text-sm">{formatDate(viewPlano.termino_planejado)}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase text-muted-foreground">Início planejado</div>
                      <div className="mt-1 text-sm">{formatDate(viewPlano.inicio_planejado)}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase text-muted-foreground">Ação iniciada</div>
                      <div className="mt-1 text-sm">{formatDate(viewPlano.acao_iniciada)}</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 rounded-lg border p-4">
                  <h3 className="text-sm font-semibold">Ocorrência vinculada</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <div className="text-xs font-medium uppercase text-muted-foreground">Acidentado</div>
                      <div className="mt-1 text-sm">{formatText(selectedInvestigacao?.nome_acidentado)}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase text-muted-foreground">Setor</div>
                      <div className="mt-1 text-sm">{formatText(selectedInvestigacao?.setor)}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase text-muted-foreground">Data da ocorrência</div>
                      <div className="mt-1 text-sm">
                        {formatDate(viewPlano.data_ocorrencia || selectedInvestigacao?.data_ocorrencia)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase text-muted-foreground">
                        Prioridade da ocorrência
                      </div>
                      <div className="mt-1 text-sm">{viewPlano.prioridade_ocorrencia}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3 rounded-lg border p-4">
                <h3 className="text-sm font-semibold">Foto da irregularidade</h3>
                {goldenRuleDetailLoading ? (
                  <div className="rounded-md border bg-gray-50 p-4 text-sm text-muted-foreground">
                    Carregando foto da evidência...
                  </div>
                ) : selectedQuestionEvidencePhoto ? (
                  <div className="overflow-hidden rounded-md border bg-muted/20">
                    <img
                      src={selectedQuestionEvidencePhoto}
                      alt={`Foto da pergunta ${selectedQuestionNumber || "N/A"}`}
                      className="max-h-[420px] w-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="rounded-md border bg-gray-50 p-4 text-sm text-muted-foreground">
                    Nenhuma foto de evidência encontrada para a pergunta irregular deste plano.
                  </div>
                )}
              </div>

              <div className="space-y-3 rounded-lg border p-4">
                <h3 className="text-sm font-semibold">Foto da finalização</h3>
                {getAttachmentImageUrl(viewPlano.finalizacao_foto) ? (
                  <div className="overflow-hidden rounded-md border bg-muted/20">
                    <img
                      src={getAttachmentImageUrl(viewPlano.finalizacao_foto)}
                      alt={`Foto de finalização do plano ${formatNumero(viewPlano.numero_plano)}`}
                      className="max-h-[420px] w-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="rounded-md border bg-gray-50 p-4 text-sm text-muted-foreground">
                    Nenhuma foto de finalização anexada neste plano.
                  </div>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3 rounded-lg border p-4">
                  <h3 className="text-sm font-semibold">Resumo e descrição</h3>
                  <div className="space-y-3">
                    <div>
                      <div className="text-xs font-medium uppercase text-muted-foreground">Resumo da ação</div>
                      <p className="mt-1 text-sm leading-relaxed">{formatText(viewPlano.descricao_resumida_acao)}</p>
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase text-muted-foreground">Descrição da ocorrência</div>
                      <p className="mt-1 text-sm leading-relaxed">{formatText(viewPlano.descricao_ocorrencia)}</p>
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase text-muted-foreground">Descrição da ação</div>
                      <p className="mt-1 text-sm leading-relaxed">{formatText(viewPlano.descricao_acao)}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 rounded-lg border p-4">
                  <h3 className="text-sm font-semibold">Conclusão e eficácia</h3>
                  <div className="space-y-3">
                    <div>
                      <div className="text-xs font-medium uppercase text-muted-foreground">Ação finalizada</div>
                      <div className="mt-1 text-sm">{formatDate(viewPlano.acao_finalizada)}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase text-muted-foreground">Observações de conclusão</div>
                      <p className="mt-1 text-sm leading-relaxed">{formatText(viewPlano.observacoes_conclusao)}</p>
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase text-muted-foreground">Data de eficácia</div>
                      <div className="mt-1 text-sm">{formatDate(viewPlano.data_eficacia)}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase text-muted-foreground">Observação de eficácia</div>
                      <p className="mt-1 text-sm leading-relaxed">{formatText(viewPlano.observacao_eficacia)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(finishPlano)} onOpenChange={(open) => !open && resetFinishDialog()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Finalizar plano de ação</DialogTitle>
            <DialogDescription>
              Informe a data de conclusão e, se quiser, anexe uma foto final para comparar com a situação inicial.
            </DialogDescription>
          </DialogHeader>

          {finishPlano ? (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="text-sm font-semibold">Plano {formatNumero(finishPlano.numero_plano)}</div>
                <div className="text-sm text-muted-foreground">
                  {finishPlano.descricao_resumida_acao || "Sem resumo informado"}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="finish-date">
                    Data de finalização *
                  </label>
                  <Input
                    id="finish-date"
                    type="date"
                    value={finishDate}
                    onChange={(event) => setFinishDate(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="finish-photo">
                    Foto final opcional
                  </label>
                  <Input
                    id="finish-photo"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(event) => void handleFinishPhotoChange(event)}
                  />
                </div>
              </div>

              {finishPhoto ? (
                <div className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium">Prévia da foto final</div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setFinishPhoto(null)}>
                      Remover foto
                    </Button>
                  </div>
                  {getAttachmentImageUrl(finishPhoto) ? (
                    <img
                      src={getAttachmentImageUrl(finishPhoto)}
                      alt="Prévia da foto de finalização"
                      className="max-h-72 w-full rounded-md border object-contain"
                    />
                  ) : null}
                  <div className="text-xs text-muted-foreground">
                    {finishPhoto.name || "Imagem anexada"} {finishPhoto.size ? `(${(finishPhoto.size / 1024).toFixed(1)} KB)` : ""}
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  <Upload className="mb-2 h-4 w-4" />
                  A foto não é obrigatória, mas ajuda a comparar o antes e depois da ação.
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="finish-observation">
                  Observação da conclusão
                </label>
                <Textarea
                  id="finish-observation"
                  value={finishObservation}
                  onChange={(event) => setFinishObservation(event.target.value)}
                  placeholder="Descreva rapidamente o que foi concluído..."
                  rows={4}
                />
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={resetFinishDialog} disabled={isFinishing}>
                  Cancelar
                </Button>
                <Button type="button" onClick={() => void handleFinalizePlano()} disabled={isFinishing}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  {isFinishing ? "Finalizando..." : "Finalizar plano"}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPlanosAcao;
