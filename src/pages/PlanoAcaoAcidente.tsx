import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ClipboardCheck, MessageSquarePlus, Save } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { isImageAttachment, resolveAttachmentPreviewUrl } from "@/lib/attachmentPreview";
import { accidentActionPlanService } from "@/lib/supabase-service";

type Severidade = "Minima" | "Mediana" | "Consideravel" | "Critica";
type Probabilidade = "Improvavel" | "Pouco Provavel" | "Provavel" | "Altamente Provavel";
type PrioridadeAcao = "Baixa" | "Media" | "Alta" | "Critica";
type StatusAcao = "Aberta" | "Em andamento" | "Concluida" | "Cancelada";

interface AttachmentMeta {
  name: string;
  size: number;
  type: string;
  data_url?: string;
  dataUrl?: string;
  url?: string;
  preview_url?: string;
}

interface InvestigacaoResumo {
  id: string;
  numero_ocorrencia: number;
  data_ocorrencia: string;
  hora: string;
  titulo: string;
  setor: string;
  nome_acidentado: string;
  gravidade: Severidade | "";
  probabilidade: Probabilidade | "";
  natureza_ocorrencia: string;
  descricao_detalhada: string;
  attachments: AttachmentMeta[];
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
}

interface ComentarioPlano {
  id: string;
  texto: string;
  autor: string;
  created_at: string;
}

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
  severidade: Severidade | "";
  probabilidade: Probabilidade | "";
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
  comentarios: ComentarioPlano[];
}

type PlanoAcaoForm = Omit<PlanoAcaoRecord, "id" | "created_at" | "updated_at" | "numero_plano" | "comentarios">;

const INVESTIGACAO_STORAGE_KEY = "checklistafm-investigacoes-acidente";
const PLANO_ACAO_CONTEXT_KEY = "checklistafm-plano-acao-context";
const PLANO_STORAGE_KEY = "checklistafm-planos-acao-acidente";
const PLANO_COUNTER_KEY = "checklistafm-plano-acao-counter";
const PLANO_STORAGE_EVENT = "checklistafm-plano-acao-updated";

const isMissingActionPlansTableError = (error: unknown) => {
  const message = String((error as any)?.message || "").toLowerCase();
  return message.includes("does not exist") && message.includes("accident_action_plans");
};

const INITIAL_FORM: PlanoAcaoForm = {
  numero_ocorrencia: 0,
  data_ocorrencia: "",
  prioridade_ocorrencia: "Baixa",
  descricao_ocorrencia: "",
  origem: "Acidente",
  descricao_resumida_acao: "",
  severidade: "",
  probabilidade: "",
  prioridade: "Baixa",
  status: "Aberta",
  responsavel_execucao: "",
  inicio_planejado: "",
  termino_planejado: "",
  acao_iniciada: "",
  acao_finalizada: "",
  descricao_acao: "",
  observacoes_conclusao: "",
  data_eficacia: "",
  observacao_eficacia: "",
};

const prioridadeFromMatriz = (
  severidade: Severidade | "",
  probabilidade: Probabilidade | "",
): PrioridadeAcao => {
  const severidadeScore: Record<Severidade, number> = {
    Minima: 1,
    Mediana: 2,
    Consideravel: 3,
    Critica: 4,
  };
  const probabilidadeScore: Record<Probabilidade, number> = {
    Improvavel: 1,
    "Pouco Provavel": 2,
    Provavel: 3,
    "Altamente Provavel": 4,
  };

  if (!severidade || !probabilidade) return "Baixa";
  const score = severidadeScore[severidade] + probabilidadeScore[probabilidade];
  if (score >= 7) return "Critica";
  if (score >= 5) return "Alta";
  if (score >= 4) return "Media";
  return "Baixa";
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
          id: String(item.id || `${Date.now()}-${Math.random()}`),
          numero_ocorrencia: numeroOcorrencia,
          data_ocorrencia: String(item.data_ocorrencia || ""),
          hora: String(item.hora || ""),
          titulo: String(item.titulo || ""),
          setor: String(item.setor || ""),
          nome_acidentado: String(item.nome_acidentado || ""),
          gravidade: (String(item.gravidade || "") as Severidade | "") || "",
          probabilidade: (String(item.probabilidade || "") as Probabilidade | "") || "",
          natureza_ocorrencia: String(item.natureza_ocorrencia || ""),
          descricao_detalhada: String(item.descricao_detalhada || ""),
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
      .filter((item): item is InvestigacaoResumo => Boolean(item))
      .sort((a, b) => b.numero_ocorrencia - a.numero_ocorrencia);
  } catch (error) {
    console.error("Erro ao carregar investigacoes para plano de acao:", error);
    return [];
  }
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
          prioridade_ocorrencia:
            (String(item.prioridade_ocorrencia || "Baixa") as PrioridadeAcao) || "Baixa",
          descricao_ocorrencia: String(item.descricao_ocorrencia || ""),
          origem: String(item.origem || "Acidente"),
          descricao_resumida_acao: String(item.descricao_resumida_acao || ""),
          severidade: (String(item.severidade || "") as Severidade | "") || "",
          probabilidade: (String(item.probabilidade || "") as Probabilidade | "") || "",
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
          comentarios: Array.isArray(item.comentarios)
            ? item.comentarios.map((comentario: any) => ({
                id: String(comentario.id || `${Date.now()}-${Math.random()}`),
                texto: String(comentario.texto || ""),
                autor: String(comentario.autor || "Sistema"),
                created_at: String(comentario.created_at || ""),
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

const mapSupabasePlan = (item: any): PlanoAcaoRecord | null => {
  if (!item || typeof item !== "object") return null;

  const comments = Array.isArray(item.comments)
    ? item.comments.map((comentario: any) => ({
        id: String(comentario?.id || `${Date.now()}-${Math.random()}`),
        texto: String(comentario?.texto || ""),
        autor: String(comentario?.autor || "Sistema"),
        created_at: String(comentario?.created_at || ""),
      }))
    : [];

  return {
    id: String(item.id || `${Date.now()}-${Math.random()}`),
    created_at: String(item.created_at || ""),
    updated_at: String(item.updated_at || ""),
    numero_plano: Number(item.numero_plano) || 0,
    numero_ocorrencia: Number(item.numero_ocorrencia) || 0,
    data_ocorrencia: String(item.data_ocorrencia || ""),
    prioridade_ocorrencia:
      (String(item.prioridade_ocorrencia || "Baixa") as PrioridadeAcao) || "Baixa",
    descricao_ocorrencia: String(item.descricao_ocorrencia || ""),
    origem: String(item.origem || "Acidente"),
    descricao_resumida_acao: String(item.descricao_resumida_acao || ""),
    severidade: (String(item.severidade || "") as Severidade | "") || "",
    probabilidade: (String(item.probabilidade || "") as Probabilidade | "") || "",
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
    comentarios: comments,
  };
};

const formatNumero = (value: number) => String(value).padStart(3, "0");

const formatDate = (value: string) => {
  if (!value) return "N/A";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("pt-BR");
};

const parsePlanoAcaoContext = (): PlanoAcaoContext | null => {
  if (typeof window === "undefined") return null;

  try {
    const raw = sessionStorage.getItem(PLANO_ACAO_CONTEXT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.fonte !== "regra-ouro") return null;

    return {
      fonte: "regra-ouro",
      registro_id: String(parsed.registro_id || ""),
      numero_referencia: Number(parsed.numero_referencia) || 0,
      data_referencia: String(parsed.data_referencia || ""),
      titulo: String(parsed.titulo || ""),
      setor: String(parsed.setor || ""),
      tecnico: String(parsed.tecnico || ""),
      descricao_ocorrencia: String(parsed.descricao_ocorrencia || ""),
      origem: String(parsed.origem || "Regra de Ouro"),
    };
  } catch (error) {
    console.error("Erro ao carregar contexto do plano de acao:", error);
    return null;
  }
};

const calculateEficaciaDueDate = (finishedAt?: string) => {
  if (!finishedAt) return "";
  const baseDate = new Date(`${finishedAt}T00:00:00`);
  if (Number.isNaN(baseDate.getTime())) return "";
  baseDate.setDate(baseDate.getDate() + 30);
  return baseDate.toISOString().slice(0, 10);
};

const getNextNumeroPlano = (existing: PlanoAcaoRecord[]) => {
  const storageValue = Number(localStorage.getItem(PLANO_COUNTER_KEY) || 0);
  const maxFromRecords = existing.reduce((max, item) => Math.max(max, Number(item.numero_plano) || 0), 0);
  const next = Math.max(storageValue, maxFromRecords) + 1;
  localStorage.setItem(PLANO_COUNTER_KEY, String(next));
  return next;
};

const PlanoAcaoAcidente = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [investigacoes, setInvestigacoes] = useState<InvestigacaoResumo[]>([]);
  const [planos, setPlanos] = useState<PlanoAcaoRecord[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingNumeroPlano, setEditingNumeroPlano] = useState<number | null>(null);
  const [form, setForm] = useState<PlanoAcaoForm>(INITIAL_FORM);
  const [novoComentario, setNovoComentario] = useState("");
  const [autorComentario, setAutorComentario] = useState("");
  const [comentarios, setComentarios] = useState<ComentarioPlano[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const loadData = async () => {
    setInvestigacoes(parseInvestigacoes());
    const localPlans = parsePlanos();

    try {
      const remoteRows = await accidentActionPlanService.safeGetAllWithFallback();
      if (remoteRows.length === 0) {
        setPlanos(localPlans);
        return;
      }

      const remotePlans = remoteRows
        .map((item) => mapSupabasePlan(item))
        .filter((item): item is PlanoAcaoRecord => Boolean(item))
        .sort((a, b) => {
          const dateA = new Date(a.updated_at || a.created_at).getTime();
          const dateB = new Date(b.updated_at || b.created_at).getTime();
          return dateB - dateA;
        });

      const mergedMap = new Map<string, PlanoAcaoRecord>();
      [...remotePlans, ...localPlans].forEach((item) => {
        const key = item.id || `n-${item.numero_plano}-${item.numero_ocorrencia}`;
        if (!mergedMap.has(key)) {
          mergedMap.set(key, item);
        }
      });
      const mergedPlans = Array.from(mergedMap.values()).sort((a, b) => {
        const dateA = new Date(a.updated_at || a.created_at).getTime();
        const dateB = new Date(b.updated_at || b.created_at).getTime();
        return dateB - dateA;
      });

      setPlanos(mergedPlans);
      localStorage.setItem(PLANO_STORAGE_KEY, JSON.stringify(mergedPlans));
    } catch (error) {
      if (!isMissingActionPlansTableError(error)) {
        console.error("Erro ao carregar planos de ação no Supabase:", error);
      }
      setPlanos(localPlans);
    }
  };

  useEffect(() => {
    void loadData();
    const handleStorage = (event: StorageEvent) => {
      if (!event.key || event.key === INVESTIGACAO_STORAGE_KEY || event.key === PLANO_STORAGE_KEY) {
        void loadData();
      }
    };
    const handleInvestigacaoUpdated = () => void loadData();
    const handlePlanoUpdated = () => void loadData();

    window.addEventListener("storage", handleStorage);
    window.addEventListener("checklistafm-investigacao-acidente-updated", handleInvestigacaoUpdated);
    window.addEventListener(PLANO_STORAGE_EVENT, handlePlanoUpdated);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("checklistafm-investigacao-acidente-updated", handleInvestigacaoUpdated);
      window.removeEventListener(PLANO_STORAGE_EVENT, handlePlanoUpdated);
    };
  }, []);

  const ocorrenciaParam = useMemo(() => {
    const raw = searchParams.get("ocorrencia");
    return raw ? Number(raw) || 0 : 0;
  }, [searchParams]);
  const planoParam = useMemo(() => {
    const raw = searchParams.get("plano");
    return raw ? raw.trim() : "";
  }, [searchParams]);
  const fonteParam = useMemo(() => {
    const raw = searchParams.get("fonte");
    return raw ? raw.trim().toLowerCase() : "";
  }, [searchParams]);
  const registroParam = useMemo(() => {
    const raw = searchParams.get("registro");
    return raw ? raw.trim() : "";
  }, [searchParams]);
  const origemParam = useMemo(() => {
    const raw = searchParams.get("origem");
    return raw ? raw.trim().toLowerCase() : "";
  }, [searchParams]);
  const planoContext = useMemo(() => parsePlanoAcaoContext(), []);
  const cameFromAdmin = origemParam === "admin";
  const isAdminAuthenticated =
    typeof window !== "undefined" &&
    sessionStorage.getItem("checklistafm-admin-auth") === "true";
  const canAccessPlanoAcao = cameFromAdmin && isAdminAuthenticated;

  useEffect(() => {
    if (canAccessPlanoAcao) return;
    if (isAdminAuthenticated) {
      navigate("/admin/planos-acao", { replace: true });
      return;
    }
    navigate("/admin/login?redirect=/admin/planos-acao", { replace: true });
  }, [canAccessPlanoAcao, isAdminAuthenticated, navigate]);

  if (!canAccessPlanoAcao) {
    return null;
  }

  useEffect(() => {
    if (fonteParam !== "regra-ouro" || !planoContext) return;
    if (registroParam && planoContext.registro_id && planoContext.registro_id !== registroParam) return;
    if (editingId) return;
    if (
      Number(form.numero_ocorrencia) === planoContext.numero_referencia &&
      form.origem === planoContext.origem &&
      form.descricao_ocorrencia === planoContext.descricao_ocorrencia
    ) {
      return;
    }

    setForm((previous) => ({
      ...previous,
      numero_ocorrencia: planoContext.numero_referencia,
      data_ocorrencia: planoContext.data_referencia,
      descricao_ocorrencia: planoContext.descricao_ocorrencia,
      origem: planoContext.origem || "Regra de Ouro",
      prioridade_ocorrencia: previous.prioridade_ocorrencia || "Baixa",
    }));
  }, [
    editingId,
    fonteParam,
    form.descricao_ocorrencia,
    form.numero_ocorrencia,
    form.origem,
    planoContext,
    registroParam,
  ]);

  useEffect(() => {
    if (!ocorrenciaParam || investigacoes.length === 0) return;
    if (form.numero_ocorrencia === ocorrenciaParam) return;

    const investigacao = investigacoes.find((item) => item.numero_ocorrencia === ocorrenciaParam);
    if (!investigacao) return;

    setForm((previous) => ({
      ...previous,
      numero_ocorrencia: investigacao.numero_ocorrencia,
      data_ocorrencia: investigacao.data_ocorrencia,
      descricao_ocorrencia: investigacao.descricao_detalhada || investigacao.titulo,
      origem: investigacao.natureza_ocorrencia || "Acidente",
      severidade: investigacao.gravidade || previous.severidade,
      probabilidade: investigacao.probabilidade || previous.probabilidade,
      prioridade_ocorrencia: prioridadeFromMatriz(investigacao.gravidade, investigacao.probabilidade),
      prioridade: prioridadeFromMatriz(
        investigacao.gravidade || previous.severidade,
        investigacao.probabilidade || previous.probabilidade,
      ),
    }));
  }, [investigacoes, ocorrenciaParam, form.numero_ocorrencia]);

  useEffect(() => {
    if (!planoParam || planos.length === 0) return;
    const selectedPlano = planos.find((item) => item.id === planoParam);
    if (!selectedPlano) return;
    if (editingId === selectedPlano.id) return;

    setEditingId(selectedPlano.id);
    setEditingNumeroPlano(selectedPlano.numero_plano);
    setComentarios(selectedPlano.comentarios || []);
    setNovoComentario("");
    setAutorComentario("");
    setForm({
      numero_ocorrencia: selectedPlano.numero_ocorrencia,
      data_ocorrencia: selectedPlano.data_ocorrencia,
      prioridade_ocorrencia: selectedPlano.prioridade_ocorrencia,
      descricao_ocorrencia: selectedPlano.descricao_ocorrencia,
      origem: selectedPlano.origem,
      descricao_resumida_acao: selectedPlano.descricao_resumida_acao,
      severidade: selectedPlano.severidade,
      probabilidade: selectedPlano.probabilidade,
      prioridade: selectedPlano.prioridade,
      status: selectedPlano.status,
      responsavel_execucao: selectedPlano.responsavel_execucao,
      inicio_planejado: selectedPlano.inicio_planejado,
      termino_planejado: selectedPlano.termino_planejado,
      acao_iniciada: selectedPlano.acao_iniciada,
      acao_finalizada: selectedPlano.acao_finalizada,
      descricao_acao: selectedPlano.descricao_acao,
      observacoes_conclusao: selectedPlano.observacoes_conclusao,
      data_eficacia: selectedPlano.data_eficacia,
      observacao_eficacia: selectedPlano.observacao_eficacia,
    });
  }, [planoParam, planos, editingId]);

  const updateField = <K extends keyof PlanoAcaoForm>(field: K, value: PlanoAcaoForm[K]) => {
    setForm((previous) => ({ ...previous, [field]: value }));
  };

  const selectedInvestigacao = useMemo(
    () =>
      investigacoes.find((item) => item.numero_ocorrencia === Number(form.numero_ocorrencia)) || null,
    [investigacoes, form.numero_ocorrencia],
  );

  const selectedInvestigacaoImagens = useMemo(() => {
    if (!selectedInvestigacao) return [];
    return selectedInvestigacao.attachments
      .map((file) => ({
        ...file,
        previewUrl: resolveAttachmentPreviewUrl(file),
      }))
      .filter((file) => file.previewUrl.length > 0 && isImageAttachment(file));
  }, [selectedInvestigacao]);

  const applyInvestigacaoToForm = (numeroOcorrencia: number) => {
    const investigacao = investigacoes.find((item) => item.numero_ocorrencia === numeroOcorrencia);
    if (!investigacao) {
      updateField("numero_ocorrencia", numeroOcorrencia);
      return;
    }

    setForm((previous) => ({
      ...previous,
      numero_ocorrencia: investigacao.numero_ocorrencia,
      data_ocorrencia: investigacao.data_ocorrencia,
      descricao_ocorrencia: investigacao.descricao_detalhada || investigacao.titulo,
      origem: investigacao.natureza_ocorrencia || "Acidente",
      severidade: investigacao.gravidade || previous.severidade,
      probabilidade: investigacao.probabilidade || previous.probabilidade,
      prioridade_ocorrencia: prioridadeFromMatriz(investigacao.gravidade, investigacao.probabilidade),
      prioridade: previous.prioridade || prioridadeFromMatriz(investigacao.gravidade, investigacao.probabilidade),
    }));
  };

  const buildNewPlanUrl = () => {
    const nextParams = new URLSearchParams();
    nextParams.set("origem", "admin");

    if (fonteParam === "regra-ouro") {
      if (registroParam) nextParams.set("registro", registroParam);
      if (ocorrenciaParam) nextParams.set("ocorrencia", String(ocorrenciaParam));
      nextParams.set("fonte", "regra-ouro");
    } else if (ocorrenciaParam) {
      nextParams.set("ocorrencia", String(ocorrenciaParam));
    }

    return `/plano-acao-acidente?${nextParams.toString()}`;
  };

  const clearForm = () => {
    setEditingId(null);
    setEditingNumeroPlano(null);
    setForm({
      ...INITIAL_FORM,
      numero_ocorrencia:
        fonteParam === "regra-ouro"
          ? planoContext?.numero_referencia || 0
          : ocorrenciaParam || 0,
      data_ocorrencia:
        fonteParam === "regra-ouro"
          ? planoContext?.data_referencia || ""
          : "",
      descricao_ocorrencia:
        fonteParam === "regra-ouro"
          ? planoContext?.descricao_ocorrencia || ""
          : "",
      origem:
        fonteParam === "regra-ouro"
          ? planoContext?.origem || "Regra de Ouro"
          : INITIAL_FORM.origem,
    });
    setComentarios([]);
    setNovoComentario("");
    setAutorComentario("");
    navigate(buildNewPlanUrl(), { replace: true });
  };

  const validate = () => {
    if (!form.origem.trim()) return "Informe a origem da acao.";
    if (!form.descricao_resumida_acao.trim()) return "Informe a descricao resumida da acao.";
    if (!form.descricao_acao.trim()) return "Informe a descricao da acao.";
    if (!form.responsavel_execucao.trim()) return "Informe o responsavel da execucao.";
    if (!form.status) return "Informe o status da acao.";
    if (!form.prioridade) return "Informe a prioridade da acao.";
    return null;
  };

  const handleAddComentario = () => {
    const texto = novoComentario.trim();
    if (!texto) return;
    const payload: ComentarioPlano = {
      id:
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`,
      texto,
      autor: autorComentario.trim() || "Sistema",
      created_at: new Date().toISOString(),
    };
    setComentarios((previous) => [payload, ...previous]);
    setNovoComentario("");
  };

  const handleSave = async () => {
    const error = validate();
    if (error) {
      toast({
        title: "Formulario incompleto",
        description: error,
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const existing = parsePlanos();
      const now = new Date().toISOString();
      const fallbackPrioridade = prioridadeFromMatriz(form.severidade, form.probabilidade);
      const eficaciaDueDate = calculateEficaciaDueDate(form.acao_finalizada);
      const eficaciaPendingComment =
        form.status === "Concluida" &&
        eficaciaDueDate &&
        !form.data_eficacia &&
        !form.observacao_eficacia.trim()
          ? `Pendencia gerada para o TST realizar a avaliacao de eficacia em ${formatDate(eficaciaDueDate)}.`
          : "";
      const nextComentarios = [...comentarios];
      if (
        eficaciaPendingComment &&
        !nextComentarios.some((item) => item.texto === eficaciaPendingComment)
      ) {
        nextComentarios.unshift({
          id:
            typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
              ? crypto.randomUUID()
              : `${Date.now()}-${Math.random()}`,
          texto: eficaciaPendingComment,
          autor: "Sistema",
          created_at: now,
        });
      }
      const currentForEdit = editingId
        ? existing.find((item) => item.id === editingId) || null
        : null;

      let payload: PlanoAcaoRecord = editingId
        ? {
            ...(currentForEdit || {
              id: editingId,
              created_at: now,
              updated_at: now,
              numero_plano: editingNumeroPlano || 0,
            }),
            ...form,
            prioridade: form.prioridade || fallbackPrioridade,
            updated_at: now,
            comentarios: nextComentarios,
          }
        : {
            id:
              typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
                ? crypto.randomUUID()
                : `${Date.now()}-${Math.random()}`,
            created_at: now,
            updated_at: now,
            numero_plano: getNextNumeroPlano(existing),
            ...form,
            prioridade: form.prioridade || fallbackPrioridade,
            comentarios: nextComentarios,
          };

      try {
        const savedRemote = await accidentActionPlanService.upsertFromLegacy({
          ...payload,
          comentarios: payload.comentarios,
        });
        const normalized = savedRemote ? mapSupabasePlan(savedRemote) : null;
        if (normalized) {
          payload = normalized;
        }
      } catch (error) {
        if (!isMissingActionPlansTableError(error)) {
          throw error;
        }
        console.warn(
          "[PlanoAcaoAcidente] Tabela accident_action_plans indisponível. Salvando apenas local.",
        );
      }

      const updated = editingId
        ? existing.map((item) => (item.id === editingId ? payload : item))
        : [payload, ...existing];

      localStorage.setItem(PLANO_STORAGE_KEY, JSON.stringify(updated));

      window.dispatchEvent(new Event(PLANO_STORAGE_EVENT));
      await loadData();
      clearForm();

      toast({
        title: "Plano de acao salvo",
        description: "Registro salvo com sucesso.",
      });
    } catch (error) {
      console.error("Erro ao salvar plano de acao:", error);
      toast({
        title: "Erro ao salvar",
        description: "Nao foi possivel salvar o plano de acao.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (record: PlanoAcaoRecord) => {
    setEditingId(record.id);
    setEditingNumeroPlano(record.numero_plano);
    setComentarios(record.comentarios || []);
    setNovoComentario("");
    setAutorComentario("");
    setForm({
      numero_ocorrencia: record.numero_ocorrencia,
      data_ocorrencia: record.data_ocorrencia,
      prioridade_ocorrencia: record.prioridade_ocorrencia,
      descricao_ocorrencia: record.descricao_ocorrencia,
      origem: record.origem,
      descricao_resumida_acao: record.descricao_resumida_acao,
      severidade: record.severidade,
      probabilidade: record.probabilidade,
      prioridade: record.prioridade,
      status: record.status,
      responsavel_execucao: record.responsavel_execucao,
      inicio_planejado: record.inicio_planejado,
      termino_planejado: record.termino_planejado,
      acao_iniciada: record.acao_iniciada,
      acao_finalizada: record.acao_finalizada,
      descricao_acao: record.descricao_acao,
      observacoes_conclusao: record.observacoes_conclusao,
      data_eficacia: record.data_eficacia,
      observacao_eficacia: record.observacao_eficacia,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-3 pb-16 sm:px-4 lg:px-6">
      <Card className="border-blue-100 bg-gradient-to-br from-white via-white to-blue-50/40">
        <CardHeader className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-blue-700 p-2 text-white">
                <ClipboardCheck className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-2xl">Plano de Acao</CardTitle>
                <CardDescription>
                  Registre a acao e acompanhe a origem, execucao e eficacia.
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() =>
                  navigate(cameFromAdmin ? "/admin/planos-acao" : "/investigacao-acidente")
                }
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                {cameFromAdmin ? "Voltar para Planos (Admin)" : "Voltar para Investigacao"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {fonteParam === "regra-ouro" && planoContext && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-medium">Plano iniciado a partir de Regra de Ouro</p>
              <p>
                Registro #{formatNumero(planoContext.numero_referencia)} - {planoContext.titulo || "Sem titulo"}
              </p>
              <p>
                Setor: {planoContext.setor || "N/A"} | Tecnico: {planoContext.tecnico || "N/A"}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>{fonteParam === "regra-ouro" ? "Registro" : "Ocorrencia"}</Label>
              {fonteParam === "regra-ouro" ? (
                <Input
                  value={
                    form.numero_ocorrencia
                      ? `#${formatNumero(form.numero_ocorrencia)}`
                      : "Nao vinculado"
                  }
                  readOnly
                />
              ) : (
                <Select
                  value={form.numero_ocorrencia ? String(form.numero_ocorrencia) : undefined}
                  onValueChange={(value) => applyInvestigacaoToForm(Number(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a ocorrencia" />
                  </SelectTrigger>
                  <SelectContent>
                    {investigacoes.map((item) => (
                      <SelectItem key={item.id} value={String(item.numero_ocorrencia)}>
                        {`#${formatNumero(item.numero_ocorrencia)} - ${item.nome_acidentado || item.titulo || "Ocorrencia"}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2">
              <Label>Plano Nro</Label>
              <Input value={editingNumeroPlano ? formatNumero(editingNumeroPlano) : "Novo"} readOnly />
            </div>
            <div className="space-y-2">
              <Label>Prioridade ocorrencia</Label>
              <Select
                value={form.prioridade_ocorrencia}
                onValueChange={(value) => updateField("prioridade_ocorrencia", value as PrioridadeAcao)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Baixa">Baixa</SelectItem>
                  <SelectItem value="Media">Media</SelectItem>
                  <SelectItem value="Alta">Alta</SelectItem>
                  <SelectItem value="Critica">Critica</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Origem *</Label>
              <Input value={form.origem} onChange={(e) => updateField("origem", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <Label>Data da ocorrencia</Label>
              <Input type="date" value={form.data_ocorrencia} onChange={(e) => updateField("data_ocorrencia", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Descricao resumida da acao *</Label>
              <Input
                value={form.descricao_resumida_acao}
                onChange={(e) => updateField("descricao_resumida_acao", e.target.value)}
                placeholder="Ex: Isolar area de circulacao de carga."
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descricao da ocorrencia</Label>
            <Textarea
              rows={4}
              value={form.descricao_ocorrencia}
              onChange={(e) => updateField("descricao_ocorrencia", e.target.value)}
              placeholder="Resumo do que aconteceu na ocorrencia."
            />
          </div>

          <div className="space-y-2">
            <Label>Imagens da investigacao</Label>
            {Number(form.numero_ocorrencia) <= 0 ? (
              <div className="rounded-md border bg-gray-50 p-3 text-sm text-gray-500">
                Selecione uma ocorrencia para visualizar as imagens.
              </div>
            ) : selectedInvestigacaoImagens.length === 0 ? (
              <div className="rounded-md border bg-gray-50 p-3 text-sm text-gray-500">
                Nenhuma imagem disponivel para esta ocorrencia.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {selectedInvestigacaoImagens.map((file, index) => (
                  <a
                    key={`${file.name}-${index}`}
                    href={file.previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md border bg-white p-2 transition hover:border-blue-300"
                  >
                    <img
                      src={file.previewUrl}
                      alt={file.name || `Imagem ${index + 1}`}
                      className="h-36 w-full rounded object-cover"
                    />
                    <p className="mt-2 truncate text-xs text-gray-600">
                      {file.name || `Imagem ${index + 1}`}
                    </p>
                  </a>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            <div className="space-y-2">
              <Label>Severidade</Label>
              <Select value={form.severidade || undefined} onValueChange={(value) => updateField("severidade", value as Severidade)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Minima">Minima</SelectItem>
                  <SelectItem value="Mediana">Mediana</SelectItem>
                  <SelectItem value="Consideravel">Consideravel</SelectItem>
                  <SelectItem value="Critica">Critica</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Probabilidade</Label>
              <Select
                value={form.probabilidade || undefined}
                onValueChange={(value) => updateField("probabilidade", value as Probabilidade)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Improvavel">Improvavel</SelectItem>
                  <SelectItem value="Pouco Provavel">Pouco Provavel</SelectItem>
                  <SelectItem value="Provavel">Provavel</SelectItem>
                  <SelectItem value="Altamente Provavel">Altamente Provavel</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select
                value={form.prioridade}
                onValueChange={(value) => updateField("prioridade", value as PrioridadeAcao)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Baixa">Baixa</SelectItem>
                  <SelectItem value="Media">Media</SelectItem>
                  <SelectItem value="Alta">Alta</SelectItem>
                  <SelectItem value="Critica">Critica</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(value) => updateField("status", value as StatusAcao)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Aberta">Aberta</SelectItem>
                  <SelectItem value="Em andamento">Em andamento</SelectItem>
                  <SelectItem value="Concluida">Concluida</SelectItem>
                  <SelectItem value="Cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Responsavel *</Label>
              <Input
                value={form.responsavel_execucao}
                onChange={(e) => updateField("responsavel_execucao", e.target.value)}
                placeholder="Nome do responsavel"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Inicio planejado</Label>
              <Input type="date" value={form.inicio_planejado} onChange={(e) => updateField("inicio_planejado", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Termino planejado</Label>
              <Input type="date" value={form.termino_planejado} onChange={(e) => updateField("termino_planejado", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Acao iniciada</Label>
              <Input type="date" value={form.acao_iniciada} onChange={(e) => updateField("acao_iniciada", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Acao finalizada</Label>
              <Input type="date" value={form.acao_finalizada} onChange={(e) => updateField("acao_finalizada", e.target.value)} />
              {calculateEficaciaDueDate(form.acao_finalizada) && (
                <p className="text-xs text-amber-700">
                  Avaliacao de eficacia do TST prevista para{" "}
                  {formatDate(calculateEficaciaDueDate(form.acao_finalizada))}.
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <Label>Descricao da acao *</Label>
              <Textarea
                rows={5}
                value={form.descricao_acao}
                onChange={(e) => updateField("descricao_acao", e.target.value)}
                placeholder="Descreva a acao que sera executada para evitar recorrencia."
              />
            </div>
            <div className="space-y-2">
              <Label>Observacoes de conclusao</Label>
              <Textarea
                rows={5}
                value={form.observacoes_conclusao}
                onChange={(e) => updateField("observacoes_conclusao", e.target.value)}
                placeholder="Observacoes finais da execucao."
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <Label>Data de eficacia</Label>
              <Input type="date" value={form.data_eficacia} onChange={(e) => updateField("data_eficacia", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Observacao de eficacia</Label>
              <Textarea
                rows={3}
                value={form.observacao_eficacia}
                onChange={(e) => updateField("observacao_eficacia", e.target.value)}
                placeholder="Descreva o resultado da verificacao de eficacia."
              />
            </div>
          </div>

          <Card className="border-slate-200 bg-slate-50/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Comentarios</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_220px_auto]">
                <Input
                  value={novoComentario}
                  onChange={(e) => setNovoComentario(e.target.value)}
                  placeholder="Adicionar comentario"
                />
                <Input
                  value={autorComentario}
                  onChange={(e) => setAutorComentario(e.target.value)}
                  placeholder="Autor (opcional)"
                />
                <Button type="button" variant="outline" onClick={handleAddComentario}>
                  <MessageSquarePlus className="mr-2 h-4 w-4" />
                  Adicionar
                </Button>
              </div>
              {comentarios.length === 0 ? (
                <p className="text-sm text-gray-500">Sem comentarios.</p>
              ) : (
                <div className="space-y-2">
                  {comentarios.map((comentario) => (
                    <div key={comentario.id} className="rounded-md border bg-white p-3 text-sm">
                      <p className="whitespace-pre-wrap">{comentario.texto}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        {comentario.autor || "Sistema"} - {formatDate(comentario.created_at)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleSave} disabled={isSaving}>
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? "Salvando..." : "Salvar plano de acao"}
            </Button>
            <Button type="button" variant="outline" onClick={clearForm}>
              Novo plano
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Planos cadastrados</CardTitle>
          <CardDescription>
            Clique em editar para atualizar um plano ja registrado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {planos.length === 0 ? (
            <div className="rounded-md border bg-gray-50 p-8 text-center text-gray-500">
              Nenhum plano de acao cadastrado.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plano</TableHead>
                    <TableHead>Ocorrencia</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Prioridade</TableHead>
                    <TableHead>Responsavel</TableHead>
                    <TableHead>Termino</TableHead>
                    <TableHead className="text-right">Acoes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {planos.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>#{formatNumero(item.numero_plano)}</TableCell>
                      <TableCell>#{formatNumero(item.numero_ocorrencia)}</TableCell>
                      <TableCell>
                        <Badge variant={item.status === "Concluida" ? "default" : "secondary"}>
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{item.prioridade}</TableCell>
                      <TableCell>{item.responsavel_execucao || "N/A"}</TableCell>
                      <TableCell>{formatDate(item.termino_planejado)}</TableCell>
                      <TableCell className="text-right">
                        <Button type="button" size="sm" variant="outline" onClick={() => handleEdit(item)}>
                          Editar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PlanoAcaoAcidente;
