import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft,
  Eye,
  RefreshCw,
  ShieldAlert,
  ClipboardList,
} from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useSupabaseData } from "@/hooks/useSupabaseData";
import { resolveAttachmentPreviewUrl } from "@/lib/attachmentPreview";
import { accidentActionPlanService, goldenRuleService, type AccidentActionPlan } from "@/lib/supabase-service";

interface Leader {
  id: string;
  name: string;
  email: string;
  sector: string;
}

interface RuleResponse {
  id?: string;
  codigo: string;
  numero: string;
  pergunta: string;
  resposta: string;
  comentario?: string | null;
  foto?: {
    name?: string;
    size?: number;
    type?: string;
    data_url?: string;
    dataUrl?: string;
    url?: string;
    preview_url?: string;
  } | null;
  evidences?: Array<{
    id?: string;
    comentario?: string;
    foto?: {
      name?: string;
      size?: number;
      type?: string;
      data_url?: string;
      dataUrl?: string;
      url?: string;
      preview_url?: string;
    } | null;
    foto_data_url?: string | null;
  }>;
}

interface GoldenRuleRecord {
  id: string;
  numero_inspecao: number;
  created_at: string;
  updated_at?: string;
  titulo: string;
  setor: string;
  gestor: string;
  tecnico_seg: string;
  acompanhante: string;
  ass_tst?: string | null;
  ass_gestor?: string | null;
  ass_acomp?: string | null;
  responses: RuleResponse[];
  attachments: Array<{
    name?: string;
    size?: number;
    type?: string;
    data_url?: string;
    dataUrl?: string;
    url?: string;
    preview_url?: string;
  }>;
}

interface ActionPlanRecord extends AccidentActionPlan {
  comments?: Array<{
    id?: string;
    texto: string;
    autor?: string;
    created_at?: string;
  }>;
}

interface InvestigationSummary {
  numero_ocorrencia: number;
  nome_acidentado: string;
  setor: string;
  data_ocorrencia: string;
  titulo: string;
}

const LOCAL_PROFILE_KEY = "checklistafm-leader-local-profile";
const INVESTIGATION_STORAGE_KEY = "checklistafm-investigacoes-acidente";
const FILTER_ALL = "all";

const normalizeText = (value?: string | null) =>
  (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const normalizeSector = (value?: string | null) => normalizeText(value);

const formatDateTime = (value?: string | null) => {
  if (!value) return "N/A";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value || "N/A";
  return format(parsed, "dd/MM/yyyy HH:mm", { locale: ptBR });
};

const formatDate = (value?: string | null) => {
  if (!value) return "N/A";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value || "N/A";
  return format(parsed, "dd/MM/yyyy", { locale: ptBR });
};

const formatNumber = (value: number) => String(value || 0).padStart(3, "0");

const parseInvestigacoes = (): InvestigationSummary[] => {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(INVESTIGATION_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item: any): InvestigationSummary | null => {
        if (!item || typeof item !== "object") return null;
        const numeroOcorrencia = Number(item.numero_ocorrencia) || 0;
        if (numeroOcorrencia <= 0) return null;

        return {
          numero_ocorrencia: numeroOcorrencia,
          nome_acidentado: String(item.nome_acidentado || ""),
          setor: String(item.setor || ""),
          data_ocorrencia: String(item.data_ocorrencia || ""),
          titulo: String(item.titulo || ""),
        };
      })
      .filter((item): item is InvestigationSummary => Boolean(item));
  } catch (error) {
    console.error("Erro ao carregar investigacoes:", error);
    return [];
  }
};

const normalizeQuestionCode = (value?: string | number | null) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  const parsed = Number.parseInt(digits, 10);
  return Number.isNaN(parsed) ? digits : String(parsed);
};

const extractQuestionNumberFromPlan = (record?: ActionPlanRecord | null) => {
  if (!record) return "";

  const texts = [
    record.descricao_resumida_acao,
    record.descricao_ocorrencia || "",
    record.descricao_acao || "",
    ...(Array.isArray(record.comments) ? record.comments.map((item) => item?.texto || "") : []),
  ];

  for (const text of texts) {
    const match = String(text).match(/Pergunta\s+(\d{1,3})/i);
    if (match?.[1]) return match[1];
  }

  return "";
};

const getRulePhotoUrl = (rule?: GoldenRuleRecord | null) => {
  if (!rule) return "";

  const candidates: any[] = [];

  rule.attachments?.forEach((attachment) => {
    candidates.push(attachment);
  });

  rule.responses?.forEach((response) => {
    candidates.push(response?.foto);
    (response as any)?.evidences?.forEach((evidence: any) => {
      candidates.push(evidence?.foto, evidence);
    });
  });

  for (const candidate of candidates) {
    const preview =
      typeof candidate === "string"
        ? candidate.trim()
        : resolveAttachmentPreviewUrl(candidate as any).trim() ||
          String((candidate as any)?.foto_data_url || (candidate as any)?.file_data_url || "").trim();
    if (preview) return preview;
  }

  return "";
};

const getExpectedAnswer = (response: Pick<RuleResponse, "codigo" | "numero">) => {
  const key = normalizeQuestionCode(response.codigo || response.numero);
  const noResponseKeys = new Set([
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

  return noResponseKeys.has(key) ? "Não" : "Sim";
};

const normalizeRuleAnswer = (value?: string | null) => {
  const normalized = normalizeText(value);
  if (normalized === "n/a" || normalized === "na" || normalized === "nao se aplica") return "N/A";
  if (normalized.startsWith("n")) return "Não";
  return "Sim";
};

const responseHasIrregularity = (response: Pick<RuleResponse, "codigo" | "numero" | "resposta">) => {
  const answer = normalizeRuleAnswer(response.resposta);
  if (answer === "N/A") return false;
  return answer !== getExpectedAnswer(response);
};

const getRuleNonConformityCount = (rule: GoldenRuleRecord) =>
  (rule.responses || []).filter(responseHasIrregularity).length;

const getPlanSector = (
  plan: ActionPlanRecord,
  rulesByOccurrence: Map<number, GoldenRuleRecord>,
  investigationsByOccurrence: Map<number, InvestigationSummary>,
) => {
  const origin = normalizeText(plan.origem);
  if (origin.includes("regra de ouro")) {
    return rulesByOccurrence.get(Number(plan.numero_ocorrencia))?.setor || "";
  }
  return investigationsByOccurrence.get(Number(plan.numero_ocorrencia))?.setor || "";
};

const getPlanSourceLabel = (plan: ActionPlanRecord) => {
  const origin = normalizeText(plan.origem);
  if (origin.includes("regra de ouro")) return "Regra de Ouro";
  return plan.origem || "Acidente";
};

const LeaderRulesPlans = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const {
    leaders: supabaseLeaders,
    loading: supabaseLoading,
    refresh,
  } = useSupabaseData(["leaders"]);

  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loadingData, setLoadingData] = useState(true);
  const [currentLeader, setCurrentLeader] = useState<Leader | null>(null);
  const [goldenRules, setGoldenRules] = useState<GoldenRuleRecord[]>([]);
  const [actionPlans, setActionPlans] = useState<ActionPlanRecord[]>([]);
  const [investigacoes, setInvestigacoes] = useState<InvestigationSummary[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailKind, setDetailKind] = useState<"rule" | "plan" | null>(null);
  const [selectedRule, setSelectedRule] = useState<GoldenRuleRecord | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<ActionPlanRecord | null>(null);
  const [selectedRuleDetail, setSelectedRuleDetail] = useState<GoldenRuleRecord | null>(null);
  const [selectedPlanRelatedRule, setSelectedPlanRelatedRule] = useState<GoldenRuleRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const openedFromQueryRef = useRef("");

  const normalizeLeaderSector = useCallback((value?: string | null) => normalizeSector(value), []);

  const primaryLeaderSector = useMemo(() => {
    if (!currentLeader?.sector) return "";
    return normalizeLeaderSector(currentLeader.sector.split(/[,;/]/)[0]);
  }, [currentLeader, normalizeLeaderSector]);

  const allowedSectorNames = useMemo(() => {
    const names = new Set<string>();
    if (primaryLeaderSector) {
      names.add(primaryLeaderSector);
    }
    return names;
  }, [primaryLeaderSector]);

  const hasGlobalSectorAccess = useMemo(() => allowedSectorNames.has("todos"), [allowedSectorNames]);

  const isSectorVisible = useCallback(
    (sector?: string | null) => {
      const normalized = normalizeLeaderSector(sector);
      if (!normalized) return hasGlobalSectorAccess;
      if (hasGlobalSectorAccess) return true;
      return allowedSectorNames.has(normalized);
    },
    [allowedSectorNames, hasGlobalSectorAccess, normalizeLeaderSector],
  );

  useEffect(() => {
    const checkAuthentication = async () => {
      const isAuthenticated = localStorage.getItem("checklistafm-leader-auth");
      const leaderId = localStorage.getItem("checklistafm-leader-id");
      const leaderSector = localStorage.getItem("checklistafm-leader-sector") || "";
      const localProfileRaw = localStorage.getItem(LOCAL_PROFILE_KEY);

      if (!isAuthenticated || !leaderId) {
        navigate("/leader/login");
        return;
      }

      if (!supabaseLoading) {
        const leader = supabaseLeaders.find((item) => item.id === leaderId);
        if (leader) {
          setCurrentLeader({
            id: leader.id,
            name: leader.name,
            email: leader.email,
            sector: leader.sector,
          });
          setLoadingAuth(false);
          return;
        }

        if (leaderId === "__local_super__" && localProfileRaw) {
          try {
            const parsed = JSON.parse(localProfileRaw);
            setCurrentLeader({
              id: parsed.id || "__local_super__",
              name: parsed.name || "Usuário Local",
              email: parsed.email || "teste@local",
              sector: parsed.sector || leaderSector || "TODOS",
            });
            setLoadingAuth(false);
            return;
          } catch (error) {
            console.error("Erro ao carregar perfil local do lider:", error);
          }
        }

        if (leaderSector) {
          setCurrentLeader({
            id: leaderId,
            name: "Líder Local",
            email: "local@checklist",
            sector: leaderSector,
          });
          setLoadingAuth(false);
          return;
        }
      }

      setLoadingAuth(false);
    };

    void checkAuthentication();
  }, [navigate, supabaseLoading, supabaseLeaders]);

  const loadRecords = useCallback(async () => {
    if (!currentLeader) return;

    setLoadingData(true);
    try {
      const [rules, plans] = await Promise.all([
        goldenRuleService.safeGetAllWithFallback(),
        accidentActionPlanService.safeGetAllWithFallback(),
      ]);

      setGoldenRules((Array.isArray(rules) ? rules : []).map((item: any) => ({
        id: String(item.id || ""),
        numero_inspecao: Number(item.numero_inspecao) || 0,
        created_at: String(item.created_at || ""),
        updated_at: String(item.updated_at || ""),
        titulo: String(item.titulo || ""),
        setor: String(item.setor || ""),
        gestor: String(item.gestor || ""),
        tecnico_seg: String(item.tecnico_seg || ""),
        acompanhante: String(item.acompanhante || ""),
        ass_tst: item.ass_tst || null,
        ass_gestor: item.ass_gestor || null,
        ass_acomp: item.ass_acomp || null,
        responses: Array.isArray(item.responses) ? item.responses : [],
        attachments: Array.isArray(item.attachments) ? item.attachments : [],
      })));

      setActionPlans((Array.isArray(plans) ? plans : []).map((item: any) => ({
        ...item,
        comments: Array.isArray(item.comments) ? item.comments : [],
      })));

      setInvestigacoes(parseInvestigacoes());
    } catch (error) {
      console.error("[LeaderRulesPlans] Erro ao carregar registros:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar Regras de Ouro e Planos de Ação.",
        variant: "destructive",
      });
    } finally {
      setLoadingData(false);
    }
  }, [currentLeader, toast]);

  useEffect(() => {
    if (!supabaseLoading && currentLeader) {
      void loadRecords();
    }
  }, [supabaseLoading, currentLeader, loadRecords]);

  const investigationsByOccurrence = useMemo(() => {
    const map = new Map<number, InvestigationSummary>();
    investigacoes.forEach((item) => {
      map.set(item.numero_ocorrencia, item);
    });
    return map;
  }, [investigacoes]);

  const goldenRuleByOccurrence = useMemo(() => {
    const map = new Map<number, GoldenRuleRecord>();
    goldenRules.forEach((item) => {
      map.set(Number(item.numero_inspecao), item);
    });
    return map;
  }, [goldenRules]);

  const filteredRules = useMemo(() => {
    const normalizedSearch = normalizeText(searchTerm);
    return goldenRules.filter((rule) => {
      if (!isSectorVisible(rule.setor)) return false;

      if (!normalizedSearch) return true;

      return [
        rule.titulo,
        rule.setor,
        rule.gestor,
        rule.tecnico_seg,
        rule.acompanhante,
        String(rule.numero_inspecao),
      ].some((field) => normalizeText(field).includes(normalizedSearch));
    });
  }, [goldenRules, isSectorVisible, searchTerm]);

  const visiblePlans = useMemo(() => {
    const normalizedSearch = normalizeText(searchTerm);
    return actionPlans.filter((plan) => {
      const sector = getPlanSector(plan, goldenRuleByOccurrence, investigationsByOccurrence);
      if (!isSectorVisible(sector)) return false;

      if (!normalizedSearch) return true;

      const linkedInvestigation = investigationsByOccurrence.get(Number(plan.numero_ocorrencia));
      const linkedRule = goldenRuleByOccurrence.get(Number(plan.numero_ocorrencia));
      return [
        String(plan.numero_plano),
        String(plan.numero_ocorrencia),
        plan.origem,
        plan.status,
        plan.prioridade,
        plan.responsavel_execucao,
        plan.descricao_resumida_acao,
        plan.descricao_acao,
        plan.descricao_ocorrencia || "",
        sector,
        linkedInvestigation?.nome_acidentado || "",
        linkedRule?.titulo || "",
      ].some((field) => normalizeText(field).includes(normalizedSearch));
    });
  }, [actionPlans, goldenRuleByOccurrence, investigationsByOccurrence, isSectorVisible, searchTerm]);

  const summary = useMemo(() => {
    const totalRules = filteredRules.length;
    const totalPlans = visiblePlans.length;
    const irregularRules = filteredRules.filter((rule) => getRuleNonConformityCount(rule) > 0).length;
    const openPlans = visiblePlans.filter((plan) => normalizeText(plan.status) === "aberta").length;
    return { totalRules, totalPlans, irregularRules, openPlans };
  }, [filteredRules, visiblePlans]);

  const handleRefresh = useCallback(async () => {
    try {
      await refresh();
      await loadRecords();
      toast({
        title: "Dados atualizados",
        description: "A tela foi sincronizada com sucesso.",
      });
    } catch (error) {
      console.error("[LeaderRulesPlans] Erro ao atualizar dados:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar os dados.",
        variant: "destructive",
      });
    }
  }, [loadRecords, refresh, toast]);

  const closeDetails = useCallback(() => {
    setDetailOpen(false);
    setDetailKind(null);
    setSelectedRule(null);
    setSelectedPlan(null);
    setSelectedRuleDetail(null);
    setSelectedPlanRelatedRule(null);
    setDetailLoading(false);
  }, []);

  const handleOpenRule = useCallback(
    async (rule: GoldenRuleRecord) => {
      setDetailKind("rule");
      setSelectedRule(rule);
      setSelectedPlan(null);
      setSelectedPlanRelatedRule(null);
      setDetailOpen(true);
      setDetailLoading(true);

      try {
        const detail = await goldenRuleService.getById(rule.id);
        setSelectedRuleDetail((detail as any) || rule);
      } catch (error) {
        console.warn("[LeaderRulesPlans] Falha ao carregar detalhe da regra:", error);
        setSelectedRuleDetail(rule);
      } finally {
        setDetailLoading(false);
      }
    },
    [],
  );

  const handleOpenPlan = useCallback(
    async (plan: ActionPlanRecord) => {
      setDetailKind("plan");
      setSelectedPlan(plan);
      setSelectedRule(null);
      setSelectedRuleDetail(null);
      setDetailOpen(true);
      setDetailLoading(true);

      try {
        const detail = (await accidentActionPlanService.getById(plan.id)) as ActionPlanRecord | null;
        const resolvedPlan = detail || plan;
        setSelectedPlan(resolvedPlan);
        setSelectedPlanRelatedRule(null);

        if (normalizeText(resolvedPlan.origem).includes("regra de ouro")) {
          const linked = goldenRuleByOccurrence.get(Number(resolvedPlan.numero_ocorrencia));
          if (linked?.id) {
            try {
              const ruleDetail = await goldenRuleService.getById(linked.id);
              setSelectedPlanRelatedRule((ruleDetail as any) || linked);
            } catch (error) {
              console.warn("[LeaderRulesPlans] Falha ao carregar regra relacionada:", error);
              setSelectedPlanRelatedRule(linked);
            }
          } else {
            setSelectedPlanRelatedRule(linked || null);
          }
        }
      } catch (error) {
        console.warn("[LeaderRulesPlans] Falha ao carregar detalhe do plano:", error);
        setSelectedPlanRelatedRule(null);
      } finally {
        setDetailLoading(false);
      }
    },
    [goldenRuleByOccurrence],
  );

  useEffect(() => {
    if (!currentLeader || loadingAuth || loadingData) return;

    const params = new URLSearchParams(location.search);
    const kind = params.get("kind");
    const id = params.get("id");
    if (!kind || !id) return;

    const token = `${kind}:${id}`;
    if (openedFromQueryRef.current === token) return;

    if (kind === "rule") {
      const rule = goldenRules.find((item) => item.id === id);
      if (rule) {
        openedFromQueryRef.current = token;
        void handleOpenRule(rule);
      }
      return;
    }

    if (kind === "plan") {
      const plan = actionPlans.find((item) => item.id === id);
      if (plan) {
        openedFromQueryRef.current = token;
        void handleOpenPlan(plan);
      }
    }
  }, [
    actionPlans,
    currentLeader,
    handleOpenPlan,
    handleOpenRule,
    loadingAuth,
    loadingData,
    location.search,
    goldenRules,
  ]);

  const selectedPlanSector = useMemo(() => {
    if (!selectedPlan) return "";
    return getPlanSector(selectedPlan, goldenRuleByOccurrence, investigationsByOccurrence);
  }, [goldenRuleByOccurrence, investigationsByOccurrence, selectedPlan]);

  const selectedPlanQuestionNumber = useMemo(
    () => extractQuestionNumberFromPlan(selectedPlan),
    [selectedPlan],
  );

  const selectedPlanPhotoUrl = useMemo(() => {
    const sourceRule = selectedPlanRelatedRule;
    if (!sourceRule || !selectedPlanQuestionNumber) return "";

    const responses = Array.isArray(sourceRule.responses) ? sourceRule.responses : [];
    const target = normalizeQuestionCode(selectedPlanQuestionNumber);

    const response = responses.find((item) => {
      const numero = normalizeQuestionCode(item?.numero);
      const codigo = normalizeQuestionCode(item?.codigo);
      return numero === target || codigo === target;
    });

    if (!response) return "";

    const candidates: any[] = [
      response?.foto,
    ];

    for (const candidate of candidates) {
      const value =
        typeof candidate === "string"
          ? candidate.trim()
          : resolveAttachmentPreviewUrl(candidate as any).trim() ||
            String((candidate as any)?.foto_data_url || (candidate as any)?.file_data_url || "").trim();
      if (value) return value;
    }

    const evidences: any[] = Array.isArray((response as any)?.evidences) ? (response as any).evidences : [];
    for (const evidence of evidences) {
      const evidenceCandidates: any[] = [evidence?.foto, evidence];

      for (const candidate of evidenceCandidates) {
        const value =
          typeof candidate === "string"
            ? candidate.trim()
            : resolveAttachmentPreviewUrl(candidate as any).trim() ||
              String((candidate as any)?.foto_data_url || (candidate as any)?.file_data_url || "").trim();
        if (value) return value;
      }
    }

    return "";
  }, [selectedPlanQuestionNumber, selectedPlanRelatedRule]);

  const selectedRulePhotoUrl = useMemo(() => getRulePhotoUrl(selectedRuleDetail), [selectedRuleDetail]);

  if (loadingAuth || supabaseLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-red-700 border-t-transparent" />
          <p className="mt-4 text-gray-600">Carregando visão dos líderes...</p>
        </div>
      </div>
    );
  }

  if (!currentLeader) {
    return null;
  }

  return (
    <div className="mx-auto w-full max-w-[1700px] space-y-6 px-4 pb-6 sm:px-6 lg:px-8">
      <Card className="border border-red-200 bg-gradient-to-r from-red-700 via-red-700 to-red-600 text-white shadow-md">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Regras e Planos</h1>
            <p className="text-sm text-red-100">
              {currentLeader.name} - {currentLeader.sector}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => navigate("/leader/login")}
              variant="outline"
              className="flex items-center gap-2 border-red-200 bg-white text-red-700 hover:bg-red-50 hover:text-red-800"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
            <Button
              onClick={handleRefresh}
              variant="outline"
              className="flex items-center gap-2 border-red-200 bg-white text-red-700 hover:bg-red-50 hover:text-red-800"
            >
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </Button>
            <Button
              onClick={() => {
                localStorage.removeItem("checklistafm-leader-auth");
                localStorage.removeItem("checklistafm-leader-id");
                localStorage.removeItem("checklistafm-leader-sector");
                localStorage.removeItem(LOCAL_PROFILE_KEY);
                navigate("/leader/login");
              }}
              variant="outline"
              className="flex items-center gap-2 border-red-200 bg-transparent text-white hover:bg-red-600 hover:text-white"
            >
              Sair
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-4">
        <Card className="border border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>Total de Regras</CardDescription>
            <CardTitle>{summary.totalRules}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>Regras com não conformidade</CardDescription>
            <CardTitle>{summary.irregularRules}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>Total de Planos</CardDescription>
            <CardTitle>{summary.totalPlans}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>Planos abertos</CardDescription>
            <CardTitle>{summary.openPlans}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="border border-slate-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle>Busca rápida</CardTitle>
          <CardDescription>Filtre por número, setor, descrição ou responsável.</CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Procurar regras ou planos..."
            className="max-w-2xl"
          />
        </CardContent>
      </Card>

      <Tabs defaultValue="rules" className="space-y-4">
        <TabsList className="grid h-auto w-full max-w-[520px] grid-cols-2 bg-slate-100 p-1">
          <TabsTrigger
            value="rules"
            className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:text-red-700"
          >
            <ShieldAlert className="h-4 w-4" />
            Regras de Ouro
          </TabsTrigger>
          <TabsTrigger
            value="plans"
            className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:text-red-700"
          >
            <ClipboardList className="h-4 w-4" />
            Planos de Ação
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rules">
          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle>Regras de Ouro visíveis</CardTitle>
              <CardDescription>
                {filteredRules.length === 0
                  ? "Nenhuma regra encontrada."
                  : `Mostrando ${filteredRules.length} regra(s).`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingData ? (
                <div className="rounded-md border bg-gray-50 p-8 text-center text-gray-500">
                  Carregando regras...
                </div>
              ) : filteredRules.length === 0 ? (
                <div className="rounded-md border bg-gray-50 p-8 text-center text-gray-500">
                  Não há regras para os setores liberados.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nº</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Setor</TableHead>
                        <TableHead>Título</TableHead>
                        <TableHead>Não conformidades</TableHead>
                        <TableHead>Técnico</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRules.map((rule) => (
                        <TableRow key={rule.id}>
                          <TableCell>{formatNumber(rule.numero_inspecao)}</TableCell>
                          <TableCell>{formatDateTime(rule.created_at)}</TableCell>
                          <TableCell>{rule.setor || "N/A"}</TableCell>
                          <TableCell className="max-w-[280px] truncate">{rule.titulo || "N/A"}</TableCell>
                          <TableCell>
                            <Badge variant={getRuleNonConformityCount(rule) > 0 ? "destructive" : "secondary"}>
                              {getRuleNonConformityCount(rule) > 0 ? "Com irregularidade" : "Conforme"}
                            </Badge>
                          </TableCell>
                          <TableCell>{rule.tecnico_seg || "N/A"}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => void handleOpenRule(rule)}>
                              <Eye className="mr-2 h-4 w-4" />
                              Ver
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
        </TabsContent>

        <TabsContent value="plans">
          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle>Planos de Ação visíveis</CardTitle>
              <CardDescription>
                {visiblePlans.length === 0
                  ? "Nenhum plano encontrado."
                  : `Mostrando ${visiblePlans.length} plano(s).`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingData ? (
                <div className="rounded-md border bg-gray-50 p-8 text-center text-gray-500">
                  Carregando planos...
                </div>
              ) : visiblePlans.length === 0 ? (
                <div className="rounded-md border bg-gray-50 p-8 text-center text-gray-500">
                  Não há planos para os setores liberados.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Plano</TableHead>
                        <TableHead>Ocorrência</TableHead>
                        <TableHead>Setor</TableHead>
                        <TableHead>Origem</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Responsável</TableHead>
                        <TableHead>Prazo</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visiblePlans.map((plan) => {
                        const sector = getPlanSector(plan, goldenRuleByOccurrence, investigationsByOccurrence);
                        return (
                          <TableRow key={plan.id}>
                            <TableCell>{formatNumber(plan.numero_plano)}</TableCell>
                            <TableCell>{formatNumber(plan.numero_ocorrencia)}</TableCell>
                            <TableCell>{sector || "N/A"}</TableCell>
                            <TableCell>{getPlanSourceLabel(plan)}</TableCell>
                            <TableCell>
                              <Badge variant={normalizeText(plan.status) === "concluida" ? "secondary" : "outline"}>
                                {plan.status || "N/A"}
                              </Badge>
                            </TableCell>
                            <TableCell>{plan.responsavel_execucao || "N/A"}</TableCell>
                            <TableCell>{formatDate(plan.termino_planejado || plan.data_ocorrencia)}</TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm" onClick={() => void handleOpenPlan(plan)}>
                                <Eye className="mr-2 h-4 w-4" />
                                Ver
                              </Button>
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
        </TabsContent>
      </Tabs>

      <Dialog
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) {
            closeDetails();
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {detailKind === "rule" ? "Detalhes da Regra de Ouro" : "Detalhes do Plano de Ação"}
            </DialogTitle>
            <DialogDescription>
              Visualização simplificada para os líderes do setor.
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="rounded-md border bg-gray-50 p-8 text-center text-gray-500">
              Carregando detalhes...
            </div>
          ) : detailKind === "rule" && selectedRuleDetail ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Card className="border-slate-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Dados principais</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p><strong>Número:</strong> {formatNumber(selectedRuleDetail.numero_inspecao)}</p>
                    <p><strong>Título:</strong> {selectedRuleDetail.titulo || "N/A"}</p>
                    <p><strong>Setor:</strong> {selectedRuleDetail.setor || "N/A"}</p>
                    <p><strong>Técnico:</strong> {selectedRuleDetail.tecnico_seg || "N/A"}</p>
                    <p><strong>Gestor:</strong> {selectedRuleDetail.gestor || "N/A"}</p>
                    <p><strong>Acompanhante:</strong> {selectedRuleDetail.acompanhante || "N/A"}</p>
                    <p><strong>Data:</strong> {formatDateTime(selectedRuleDetail.created_at)}</p>
                  </CardContent>
                </Card>

                <Card className="border-slate-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Resumo</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p><strong>Assinatura técnico:</strong> {selectedRuleDetail.ass_tst ? "Sim" : "Não"}</p>
                    <p><strong>Assinatura gestor:</strong> {selectedRuleDetail.ass_gestor ? "Sim" : "Não"}</p>
                    <p><strong>Assinatura acompanhante:</strong> {selectedRuleDetail.ass_acomp ? "Sim" : "Não"}</p>
                    <p><strong>Não conformidades:</strong> {getRuleNonConformityCount(selectedRuleDetail)}</p>
                    <p><strong>Anexos:</strong> {selectedRuleDetail.attachments?.length || 0}</p>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-slate-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Foto da irregularidade</CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedRulePhotoUrl ? (
                    <img
                      src={selectedRulePhotoUrl}
                      alt="Foto da irregularidade"
                      className="max-h-[420px] w-full rounded-md border object-contain"
                    />
                  ) : (
                    <div className="rounded-md border bg-gray-50 p-4 text-sm text-gray-500">
                      Nenhuma foto encontrada para esta regra.
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-slate-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Respostas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(selectedRuleDetail.responses || []).map((response) => (
                    <div key={`${response.codigo}-${response.numero}`} className="rounded-md border p-3 text-sm">
                        <div className="mb-2 flex items-start justify-between gap-3">
                          <p className="font-medium">
                            {response.numero || response.codigo || "-"} - {response.pergunta || "Pergunta"}
                          </p>
                        <Badge variant={responseHasIrregularity(response) ? "destructive" : "secondary"}>
                          {normalizeRuleAnswer(response.resposta)}
                        </Badge>
                      </div>
                      {response.comentario ? (
                        <p className="text-sm text-gray-700">
                          <strong>Comentário:</strong> {response.comentario}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          ) : detailKind === "plan" && selectedPlan ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Card className="border-slate-200">
                  <CardHeader className="pb-2">
                    <CardDescription>Plano</CardDescription>
                    <CardTitle>{formatNumber(selectedPlan.numero_plano)}</CardTitle>
                  </CardHeader>
                </Card>
                <Card className="border-slate-200">
                  <CardHeader className="pb-2">
                    <CardDescription>Ocorrência</CardDescription>
                    <CardTitle>{formatNumber(selectedPlan.numero_ocorrencia)}</CardTitle>
                  </CardHeader>
                </Card>
                <Card className="border-slate-200">
                  <CardHeader className="pb-2">
                    <CardDescription>Origem</CardDescription>
                    <CardTitle>{getPlanSourceLabel(selectedPlan)}</CardTitle>
                  </CardHeader>
                </Card>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Card className="border-slate-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Dados principais</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p><strong>Status:</strong> {selectedPlan.status || "N/A"}</p>
                    <p><strong>Prioridade:</strong> {selectedPlan.prioridade || "N/A"}</p>
                    <p><strong>Responsável:</strong> {selectedPlan.responsavel_execucao || "N/A"}</p>
                    <p><strong>Prazo:</strong> {formatDate(selectedPlan.termino_planejado || undefined)}</p>
                    <p><strong>Início planejado:</strong> {formatDate(selectedPlan.inicio_planejado || undefined)}</p>
                    <p><strong>Ação iniciada:</strong> {formatDate(selectedPlan.acao_iniciada || undefined)}</p>
                    <p><strong>Ação finalizada:</strong> {formatDate(selectedPlan.acao_finalizada || undefined)}</p>
                  </CardContent>
                </Card>

                <Card className="border-slate-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Vínculo da ocorrência</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p><strong>Setor:</strong> {selectedPlanSector || "N/A"}</p>
                    <p><strong>Data da ocorrência:</strong> {formatDate(selectedPlan.data_ocorrencia || undefined)}</p>
                    <p><strong>Descrição resumida:</strong> {selectedPlan.descricao_resumida_acao || "N/A"}</p>
                    <p><strong>Descrição da ação:</strong> {selectedPlan.descricao_acao || "N/A"}</p>
                  </CardContent>
                </Card>
              </div>

              {normalizeText(selectedPlan.origem).includes("regra de ouro") && (
                <Card className="border-slate-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Foto da irregularidade</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selectedPlanPhotoUrl ? (
                      <img
                        src={selectedPlanPhotoUrl}
                        alt="Foto da irregularidade"
                        className="max-h-[420px] w-full rounded-md border object-contain"
                      />
                    ) : (
                      <div className="rounded-md border bg-gray-50 p-4 text-sm text-gray-500">
                        Nenhuma foto encontrada para a pergunta relacionada.
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              <Card className="border-slate-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Comentários e conclusão</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p><strong>Observações de conclusão:</strong> {selectedPlan.observacoes_conclusao || "N/A"}</p>
                  <p><strong>Observação de eficácia:</strong> {selectedPlan.observacao_eficacia || "N/A"}</p>
                  <p><strong>Data de eficácia:</strong> {formatDate(selectedPlan.data_eficacia || undefined)}</p>
                  <div className="pt-2">
                    <p className="mb-2 font-medium">Comentários</p>
                    {Array.isArray(selectedPlan.comments) && selectedPlan.comments.length > 0 ? (
                      <div className="space-y-2">
                        {selectedPlan.comments.map((comment, index) => (
                          <div key={comment.id || `${index}-${comment.created_at}`} className="rounded-md border p-3">
                            <p className="font-medium">{comment.autor || "Sistema"}</p>
                            <p className="text-gray-700">{comment.texto || "N/A"}</p>
                            <p className="text-xs text-gray-500">{formatDateTime(comment.created_at)}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-md border bg-gray-50 p-4 text-sm text-gray-500">
                        Nenhum comentário registrado.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="rounded-md border bg-gray-50 p-8 text-center text-gray-500">
              Nenhum registro selecionado.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LeaderRulesPlans;
