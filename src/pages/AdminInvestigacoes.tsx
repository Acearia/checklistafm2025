import React, { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Download, Eye, RefreshCw, Trash2 } from "lucide-react";
import jsPDF from "jspdf";
import { useNavigate, useSearchParams } from "react-router-dom";
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
import { accidentActionPlanService } from "@/lib/supabase-service";
import { useToast } from "@/hooks/use-toast";

interface AttachmentMeta {
  name: string;
  size: number;
  type: string;
  data_url?: string;
  dataUrl?: string;
  url?: string;
  preview_url?: string;
}

interface InvestigacaoRecord {
  id: string;
  numero_ocorrencia: number;
  created_at: string;
  titulo: string;
  data_ocorrencia: string;
  hora: string;
  turno: string;
  nome_acidentado: string;
  cargo: string;
  setor: string;
  tempo_empresa: string;
  tempo_funcao: string;
  natureza_ocorrencia: string;
  mao_de_obra: string;
  tipo_acidente: string;
  teve_afastamento: boolean;
  dias_afastamento: string;
  gravidade: string;
  probabilidade: string;
  parte_corpo_atingida: string;
  causa_raiz: string;
  agente_causador: string;
  causa_acidente: string;
  problema: string;
  causa_maquinas: string;
  causa_mao_de_obra: string;
  causa_metodos: string;
  causa_meio_ambiente: string;
  causa_materiais: string;
  causa_medicoes: string;
  cinco_porques: string;
  descricao_detalhada: string;
  observacoes: string;
  investigador: string;
  attachments: AttachmentMeta[];
}

interface AnaliseCausasData {
  problema: string;
  causa_maquinas: string;
  causa_mao_de_obra: string;
  causa_metodos: string;
  causa_meio_ambiente: string;
  causa_materiais: string;
  causa_medicoes: string;
  cinco_porques: string;
}

interface PdfAssinadoArquivo {
  id: string;
  name: string;
  size: number;
  type: string;
  uploaded_at: string;
  data_url: string;
}

const STORAGE_KEY = "checklistafm-investigacoes-acidente";
const CAUSAS_STORAGE_KEY = "checklistafm-investigacao-causas-admin";
const CAUSAS_STORAGE_EVENT = "checklistafm-investigacao-causas-admin-updated";
const PDF_ASSINADO_STORAGE_KEY = "checklistafm-investigacao-pdf-assinado-admin";
const PDF_ASSINADO_STORAGE_EVENT = "checklistafm-investigacao-pdf-assinado-admin-updated";
const PLANO_ACAO_STORAGE_KEY = "checklistafm-planos-acao-acidente";
const PLANO_ACAO_STORAGE_EVENT = "checklistafm-plano-acao-updated";
const ADMIN_SESSION_STORAGE_KEY = "checklistafm-admin-session";
const FILTER_ALL = "all";

const isMissingActionPlansTableError = (error: unknown) => {
  const message = String((error as any)?.message || "").toLowerCase();
  return message.includes("does not exist") && message.includes("accident_action_plans");
};

const hasAdmAccess = () => {
  if (typeof window === "undefined") return false;

  try {
    const rawSession = sessionStorage.getItem(ADMIN_SESSION_STORAGE_KEY);
    if (!rawSession) return false;
    const parsed = JSON.parse(rawSession);
    const username = String(parsed?.username || "").trim().toLowerCase();
    const role = String(parsed?.role || "").trim().toLowerCase();
    return username === "adm" || role === "admin";
  } catch {
    return false;
  }
};

const EMPTY_ANALISE_CAUSAS: AnaliseCausasData = {
  problema: "",
  causa_maquinas: "",
  causa_mao_de_obra: "",
  causa_metodos: "",
  causa_meio_ambiente: "",
  causa_materiais: "",
  causa_medicoes: "",
  cinco_porques: "",
};

const decodePotentialMojibake = (value: string) => {
  // Mapa de caracteres UTF-8 que foram mal-interpretados como Latin-1
  const mojibakeMap: Record<string, string> = {
    "Ã§": "ç", // ç mal decodificado
    "Ã£": "ã", // ã mal decodificado
    "Ã©": "é", // é mal decodificado
    "Ã": "Ã",   // Ã mal decodificado
    "Ã¡": "á", // á mal decodificado
    "Â": "",   // Â mal decodificado (remover)
  };

  // Corrigir mojibake comum (Latin-1 interpretado como UTF-8)
  let fixed = value;
  Object.entries(mojibakeMap).forEach(([broken, correct]) => {
    fixed = fixed.split(broken).join(correct);
  });

  // Corrigir EXPEDIÇÃO especificamente (com til)
  fixed = fixed
    .replace(/expedi[çc\u00E7\u00C3\uFFFD]*[oa\u00E3]*o/gi, "EXPEDIÇÃO")
    .replace(/N\uFFFDO/gi, "NÃO");

  // Remover caracteres de replacement Unicode
  fixed = fixed.replace(/\uFFFD/g, "");

  return fixed;
};

const toSafeString = (value: unknown) =>
  value == null ? "" : decodePotentialMojibake(String(value));

const formatFileSize = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
};

const uniqueSortedValues = (values: string[]) =>
  Array.from(new Set(values.filter((value) => value.trim().length > 0))).sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );

const getInvestigacaoDateValue = (item: InvestigacaoRecord) => item.data_ocorrencia || item.created_at;

const hasInvestigacaoAssinada = (item: InvestigacaoRecord) => item.investigador.trim().length > 0;

const parseInvestigacoes = (): InvestigacaoRecord[] => {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const normalized = parsed
      .map((item: any): InvestigacaoRecord | null => {
        if (!item || typeof item !== "object") return null;
        const attachments = Array.isArray(item.attachments)
          ? item.attachments.map((file: any) => ({
              name: toSafeString(file?.name),
              size: Number(file?.size) || 0,
              type: toSafeString(file?.type),
              data_url: toSafeString(file?.data_url),
              dataUrl: toSafeString(file?.dataUrl),
              url: toSafeString(file?.url),
              preview_url: toSafeString(file?.preview_url),
            }))
          : [];

        return {
          id: toSafeString(item.id) || `${Date.now()}-${Math.random()}`,
          numero_ocorrencia: Number(item.numero_ocorrencia) || 0,
          created_at: toSafeString(item.created_at),
          titulo: toSafeString(item.titulo),
          data_ocorrencia: toSafeString(item.data_ocorrencia),
          hora: toSafeString(item.hora),
          turno: toSafeString(item.turno),
          nome_acidentado: toSafeString(item.nome_acidentado),
          cargo: toSafeString(item.cargo),
          setor: toSafeString(item.setor),
          tempo_empresa: toSafeString(item.tempo_empresa),
          tempo_funcao: toSafeString(item.tempo_funcao),
          natureza_ocorrencia: toSafeString(item.natureza_ocorrencia),
          mao_de_obra: toSafeString(item.mao_de_obra),
          tipo_acidente: toSafeString(item.tipo_acidente),
          teve_afastamento: Boolean(item.teve_afastamento),
          dias_afastamento: toSafeString(item.dias_afastamento),
          gravidade: toSafeString(item.gravidade),
          probabilidade: toSafeString(item.probabilidade),
          parte_corpo_atingida: toSafeString(item.parte_corpo_atingida),
          causa_raiz: toSafeString(item.causa_raiz),
          agente_causador: toSafeString(item.agente_causador),
          causa_acidente: toSafeString(item.causa_acidente),
          problema: toSafeString(item.problema),
          causa_maquinas: toSafeString(item.causa_maquinas),
          causa_mao_de_obra: toSafeString(item.causa_mao_de_obra),
          causa_metodos: toSafeString(item.causa_metodos),
          causa_meio_ambiente: toSafeString(item.causa_meio_ambiente),
          causa_materiais: toSafeString(item.causa_materiais),
          causa_medicoes: toSafeString(item.causa_medicoes),
          cinco_porques: toSafeString(item.cinco_porques),
          descricao_detalhada: toSafeString(item.descricao_detalhada),
          observacoes: toSafeString(item.observacoes),
          investigador: toSafeString(item.investigador),
          attachments,
        };
      })
      .filter((item): item is InvestigacaoRecord => Boolean(item));

    return normalized.sort((a, b) => {
      const dateA = new Date(a.data_ocorrencia || a.created_at).getTime();
      const dateB = new Date(b.data_ocorrencia || b.created_at).getTime();
      return dateB - dateA;
    });
  } catch (error) {
    console.error("Erro ao carregar investigacoes:", error);
    return [];
  }
};

const parseAnaliseCausasByOcorrencia = (): Record<string, AnaliseCausasData> => {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(CAUSAS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    const normalized: Record<string, AnaliseCausasData> = {};
    Object.entries(parsed).forEach(([key, value]) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return;
      normalized[String(key)] = {
        problema: toSafeString((value as any).problema),
        causa_maquinas: toSafeString((value as any).causa_maquinas),
        causa_mao_de_obra: toSafeString((value as any).causa_mao_de_obra),
        causa_metodos: toSafeString((value as any).causa_metodos),
        causa_meio_ambiente: toSafeString((value as any).causa_meio_ambiente),
        causa_materiais: toSafeString((value as any).causa_materiais),
        causa_medicoes: toSafeString((value as any).causa_medicoes),
        cinco_porques: toSafeString((value as any).cinco_porques),
      };
    });

    return normalized;
  } catch (error) {
    console.error("Erro ao carregar analise de causas por ocorrencia:", error);
    return {};
  }
};

const parsePdfAssinadoByOcorrencia = (): Record<string, PdfAssinadoArquivo[]> => {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(PDF_ASSINADO_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    const normalized: Record<string, PdfAssinadoArquivo[]> = {};
    Object.entries(parsed).forEach(([key, value]) => {
      if (!Array.isArray(value)) return;
      normalized[String(key)] = value
        .map((item: any): PdfAssinadoArquivo | null => {
          if (!item || typeof item !== "object") return null;
          return {
            id: toSafeString(item.id) || `${Date.now()}-${Math.random()}`,
            name: toSafeString(item.name) || "arquivo-assinado.pdf",
            size: Number(item.size) || 0,
            type: toSafeString(item.type),
            uploaded_at: toSafeString(item.uploaded_at),
            data_url: toSafeString(item.data_url),
          };
        })
        .filter((item): item is PdfAssinadoArquivo => Boolean(item))
        .sort((a, b) => {
          const dateA = new Date(a.uploaded_at).getTime();
          const dateB = new Date(b.uploaded_at).getTime();
          return dateB - dateA;
        });
    });
    return normalized;
  } catch (error) {
    console.error("Erro ao carregar PDFs assinados:", error);
    return {};
  }
};

const parsePlanoCountByOcorrencia = (): Record<string, number> => {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(PLANO_ACAO_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return {};

    const counts: Record<string, number> = {};
    parsed.forEach((item: any) => {
      const numeroOcorrencia = Number(item?.numero_ocorrencia) || 0;
      if (numeroOcorrencia <= 0) return;
      const key = String(numeroOcorrencia);
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  } catch (error) {
    console.error("Erro ao carregar contagem de planos de acao:", error);
    return {};
  }
};

const fetchPlanoCountByOcorrencia = async (): Promise<Record<string, number>> => {
  try {
    const rows = await accidentActionPlanService.safeGetAllWithFallback();
    if (rows.length === 0) {
      return parsePlanoCountByOcorrencia();
    }

    const counts: Record<string, number> = {};
    rows.forEach((item: any) => {
      const numeroOcorrencia = Number(item?.numero_ocorrencia) || 0;
      if (numeroOcorrencia <= 0) return;
      const key = String(numeroOcorrencia);
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  } catch (error) {
    if (!isMissingActionPlansTableError(error)) {
      console.error("Erro ao carregar contagem de planos de ação no Supabase:", error);
    }
    return parsePlanoCountByOcorrencia();
  }
};

const formatDate = (value?: string) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return format(date, "dd/MM/yyyy", { locale: ptBR });
};

const formatDateTime = (dateValue?: string, timeValue?: string) => {
  const dateFormatted = formatDate(dateValue);
  const timeFormatted = timeValue || "N/A";
  return `${dateFormatted} ${timeFormatted}`;
};

const formatDateTimeFull = (value?: string) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return format(date, "dd/MM/yyyy HH:mm", { locale: ptBR });
};

const AdminInvestigacoes = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isAdmUser, setIsAdmUser] = useState<boolean>(hasAdmAccess);
  const [investigacoes, setInvestigacoes] = useState<InvestigacaoRecord[]>([]);
  const [causasByOcorrencia, setCausasByOcorrencia] = useState<Record<string, AnaliseCausasData>>(
    {},
  );
  const [pdfAssinadoByOcorrencia, setPdfAssinadoByOcorrencia] = useState<
    Record<string, PdfAssinadoArquivo[]>
  >({});
  const [planoCountByOcorrencia, setPlanoCountByOcorrencia] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<InvestigacaoRecord | null>(null);
  const [expandedImage, setExpandedImage] = useState<{ url: string; title: string } | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [analiseDialogOpen, setAnaliseDialogOpen] = useState(false);
  const [editingAnaliseRecord, setEditingAnaliseRecord] = useState<InvestigacaoRecord | null>(null);
  const [analiseForm, setAnaliseForm] = useState<AnaliseCausasData>(EMPTY_ANALISE_CAUSAS);
  const [isUploadingPdfAssinado, setIsUploadingPdfAssinado] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [tipoFilter, setTipoFilter] = useState(FILTER_ALL);
  const [gravidadeFilter, setGravidadeFilter] = useState(FILTER_ALL);
  const [investigadorFilter, setInvestigadorFilter] = useState(FILTER_ALL);
  const [afastamentoFilter, setAfastamentoFilter] = useState(FILTER_ALL);
  const [ocorrenciaFilter, setOcorrenciaFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const ocorrenciaFromQuery = useMemo(() => {
    const value = searchParams.get("ocorrencia") || "";
    return value.trim();
  }, [searchParams]);

  useEffect(() => {
    setOcorrenciaFilter(ocorrenciaFromQuery);
  }, [ocorrenciaFromQuery]);

  const loadData = async () => {
    setInvestigacoes(parseInvestigacoes());
    setCausasByOcorrencia(parseAnaliseCausasByOcorrencia());
    setPdfAssinadoByOcorrencia(parsePdfAssinadoByOcorrencia());
    setPlanoCountByOcorrencia(await fetchPlanoCountByOcorrencia());
  };

  useEffect(() => {
    void loadData();

    const handleUpdated = () => void loadData();
    const handleStorage = (event: StorageEvent) => {
      if (
        !event.key ||
        event.key === STORAGE_KEY ||
        event.key === CAUSAS_STORAGE_KEY ||
        event.key === PDF_ASSINADO_STORAGE_KEY ||
        event.key === PLANO_ACAO_STORAGE_KEY
      ) {
        void loadData();
      }
    };
    const handleCausasUpdated = () => void loadData();
    const handlePdfAssinadoUpdated = () => void loadData();
    const handlePlanoAcaoUpdated = () => void loadData();

    window.addEventListener("checklistafm-investigacao-acidente-updated", handleUpdated);
    window.addEventListener(CAUSAS_STORAGE_EVENT, handleCausasUpdated);
    window.addEventListener(PDF_ASSINADO_STORAGE_EVENT, handlePdfAssinadoUpdated);
    window.addEventListener(PLANO_ACAO_STORAGE_EVENT, handlePlanoAcaoUpdated);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("checklistafm-investigacao-acidente-updated", handleUpdated);
      window.removeEventListener(CAUSAS_STORAGE_EVENT, handleCausasUpdated);
      window.removeEventListener(PDF_ASSINADO_STORAGE_EVENT, handlePdfAssinadoUpdated);
      window.removeEventListener(PLANO_ACAO_STORAGE_EVENT, handlePlanoAcaoUpdated);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncAdminSession = () => {
      setIsAdmUser(hasAdmAccess());
    };

    window.addEventListener("storage", syncAdminSession);
    return () => {
      window.removeEventListener("storage", syncAdminSession);
    };
  }, []);

  const uniqueTipos = useMemo(
    () => uniqueSortedValues(investigacoes.map((item) => item.tipo_acidente)),
    [investigacoes],
  );

  const uniqueGravidades = useMemo(
    () => uniqueSortedValues(investigacoes.map((item) => item.gravidade)),
    [investigacoes],
  );

  const uniqueInvestigadores = useMemo(
    () => uniqueSortedValues(investigacoes.map((item) => item.investigador)),
    [investigacoes],
  );

  const filteredInvestigacoes = useMemo(() => {
    return investigacoes.filter((item) => {
      const matchesTipo = tipoFilter === FILTER_ALL || item.tipo_acidente === tipoFilter;
      const matchesGravidade = gravidadeFilter === FILTER_ALL || item.gravidade === gravidadeFilter;
      const matchesInvestigador =
        investigadorFilter === FILTER_ALL || item.investigador === investigadorFilter;
      const matchesAfastamento =
        afastamentoFilter === FILTER_ALL ||
        (afastamentoFilter === "com" && item.teve_afastamento) ||
        (afastamentoFilter === "sem" && !item.teve_afastamento);

      const normalizedSearch = searchTerm.trim().toLowerCase();
      const matchesSearch =
        normalizedSearch.length === 0 ||
        item.titulo.toLowerCase().includes(normalizedSearch) ||
        item.nome_acidentado.toLowerCase().includes(normalizedSearch) ||
        item.setor.toLowerCase().includes(normalizedSearch) ||
        item.investigador.toLowerCase().includes(normalizedSearch);
      const matchesOcorrencia =
        !ocorrenciaFilter.trim() ||
        String(item.numero_ocorrencia).includes(ocorrenciaFilter.trim());

      const dateValue = getInvestigacaoDateValue(item);
      const itemDate = dateValue ? new Date(dateValue) : null;
      const from = dateFrom ? new Date(dateFrom) : null;
      const to = dateTo ? new Date(dateTo) : null;
      if (from) from.setHours(0, 0, 0, 0);
      if (to) to.setHours(23, 59, 59, 999);
      const matchesDate =
        (!from || (itemDate && itemDate >= from)) &&
        (!to || (itemDate && itemDate <= to));

      return (
        matchesTipo &&
        matchesGravidade &&
        matchesInvestigador &&
        matchesAfastamento &&
        matchesOcorrencia &&
        matchesSearch &&
        matchesDate
      );
    });
  }, [
    afastamentoFilter,
    dateFrom,
    dateTo,
    gravidadeFilter,
    investigadorFilter,
    investigacoes,
    ocorrenciaFilter,
    searchTerm,
    tipoFilter,
  ]);

  const summary = useMemo(() => {
    const total = investigacoes.length;
    const comAfastamento = investigacoes.filter((item) => item.teve_afastamento).length;
    const criticas = investigacoes.filter((item) => item.gravidade === "Critica").length;
    const assinadas = investigacoes.filter(hasInvestigacaoAssinada).length;

    return { total, comAfastamento, criticas, assinadas };
  }, [investigacoes]);

  const resolveAnaliseCausas = (item: InvestigacaoRecord): AnaliseCausasData => {
    const fromAdmin = causasByOcorrencia[String(item.numero_ocorrencia)];
    if (fromAdmin) return fromAdmin;
    return {
      problema: item.problema || "",
      causa_maquinas: item.causa_maquinas || "",
      causa_mao_de_obra: item.causa_mao_de_obra || "",
      causa_metodos: item.causa_metodos || "",
      causa_meio_ambiente: item.causa_meio_ambiente || "",
      causa_materiais: item.causa_materiais || "",
      causa_medicoes: item.causa_medicoes || "",
      cinco_porques: item.cinco_porques || "",
    };
  };

  const selectedCausas = useMemo(
    () => (selected ? resolveAnaliseCausas(selected) : EMPTY_ANALISE_CAUSAS),
    [selected, causasByOcorrencia],
  );

  const selectedPdfAssinados = useMemo(() => {
    if (!selected) return [];
    return pdfAssinadoByOcorrencia[String(selected.numero_ocorrencia)] || [];
  }, [selected, pdfAssinadoByOcorrencia]);

  const getPlanoCount = (numeroOcorrencia: number) => {
    if (numeroOcorrencia <= 0) return 0;
    return planoCountByOcorrencia[String(numeroOcorrencia)] || 0;
  };

  const handleViewDetails = (record: InvestigacaoRecord) => {
    setSelected(record);
    setDetailsOpen(true);
  };

  const handleOpenAnaliseDialog = (record: InvestigacaoRecord) => {
    setEditingAnaliseRecord(record);
    setAnaliseForm(resolveAnaliseCausas(record));
    setAnaliseDialogOpen(true);
  };

  const updateAnaliseField = <K extends keyof AnaliseCausasData>(
    field: K,
    value: AnaliseCausasData[K],
  ) => {
    setAnaliseForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveAnalise = () => {
    if (!editingAnaliseRecord || editingAnaliseRecord.numero_ocorrencia <= 0) {
      toast({
        title: "Ocorrencia invalida",
        description: "Nao foi possivel identificar a ocorrencia para salvar a analise.",
        variant: "destructive",
      });
      return;
    }

    try {
      const current = parseAnaliseCausasByOcorrencia();
      current[String(editingAnaliseRecord.numero_ocorrencia)] = {
        problema: analiseForm.problema.trim(),
        causa_maquinas: analiseForm.causa_maquinas.trim(),
        causa_mao_de_obra: analiseForm.causa_mao_de_obra.trim(),
        causa_metodos: analiseForm.causa_metodos.trim(),
        causa_meio_ambiente: analiseForm.causa_meio_ambiente.trim(),
        causa_materiais: analiseForm.causa_materiais.trim(),
        causa_medicoes: analiseForm.causa_medicoes.trim(),
        cinco_porques: analiseForm.cinco_porques.trim(),
      };
      localStorage.setItem(CAUSAS_STORAGE_KEY, JSON.stringify(current));
      window.dispatchEvent(new Event(CAUSAS_STORAGE_EVENT));
      setAnaliseDialogOpen(false);
      toast({
        title: "Analise salva",
        description: "Os dados da analise foram atualizados na ocorrencia.",
      });
    } catch (error) {
      console.error("Erro ao salvar analise:", error);
      toast({
        title: "Erro ao salvar",
        description: "Nao foi possivel salvar a analise.",
        variant: "destructive",
      });
    }
  };

  const fileToDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Falha ao ler arquivo"));
      reader.readAsDataURL(file);
    });

  const handleGenerateAssinaturaPdf = (record: InvestigacaoRecord) => {
    try {
      const doc = new jsPDF();
      const margin = 14;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const maxTextWidth = pageWidth - margin * 2;
      const lineHeight = 4.6;
      const causas = resolveAnaliseCausas(record);
      let y = 16;

      const safe = (value?: string) => (value && value.trim().length > 0 ? value.trim() : "N/A");

      const ensureSpace = (neededHeight = 10) => {
        if (y + neededHeight > pageHeight - margin) {
          doc.addPage();
          y = margin;
        }
      };

      const addSectionTitle = (title: string) => {
        ensureSpace(8);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text(title, margin, y);
        y += 6;
      };

      const addLabelValue = (label: string, value: string) => {
        ensureSpace(8);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text(label, margin, y);
        y += 4.5;
        doc.setFont("helvetica", "normal");
        const lines = doc.splitTextToSize(safe(value), maxTextWidth);
        ensureSpace(lines.length * lineHeight + 2);
        doc.text(lines, margin, y);
        y += lines.length * lineHeight + 2;
      };

      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.text("Investigacao de Ocorrencia", pageWidth / 2, y, { align: "center" });
      y += 7;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Numero da ocorrencia: ${String(record.numero_ocorrencia).padStart(3, "0")}`, margin, y);
      y += 5;
      doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`, margin, y);
      y += 6;

      addSectionTitle("Dados gerais");
      addLabelValue("Titulo", record.titulo);
      addLabelValue("Data/Hora", `${formatDate(record.data_ocorrencia)} ${safe(record.hora)}`);
      addLabelValue("Turno", record.turno);
      addLabelValue("Classificacao", record.natureza_ocorrencia);
      addLabelValue("Tipo de acidente", record.tipo_acidente);
      addLabelValue("Setor", record.setor);

      addSectionTitle("Envolvido");
      addLabelValue("Nome do acidentado", record.nome_acidentado);
      addLabelValue("Cargo", record.cargo);
      addLabelValue("Tempo de empresa", record.tempo_empresa);
      addLabelValue("Tempo na funcao", record.tempo_funcao);
      addLabelValue(
        "Afastamento",
        record.teve_afastamento ? `Sim (${safe(record.dias_afastamento)} dia(s))` : "Nao",
      );

      addSectionTitle("Analise");
      addLabelValue("Gravidade", record.gravidade);
      addLabelValue("Probabilidade", record.probabilidade);
      addLabelValue("Parte do corpo atingida", record.parte_corpo_atingida);
      addLabelValue("Causa raiz", record.causa_raiz);
      addLabelValue("Agente causador", record.agente_causador);
      addLabelValue("Causa do acidente", record.causa_acidente);
      addLabelValue("Descricao detalhada", record.descricao_detalhada);
      addLabelValue("Observacoes", record.observacoes);

      addSectionTitle("Analises complementares");
      addLabelValue("Problema", causas.problema);
      addLabelValue("Maquinas", causas.causa_maquinas);
      addLabelValue("Mao de obra", causas.causa_mao_de_obra);
      addLabelValue("Metodos", causas.causa_metodos);
      addLabelValue("Meio ambiente", causas.causa_meio_ambiente);
      addLabelValue("Materiais", causas.causa_materiais);
      addLabelValue("Medicoes", causas.causa_medicoes);
      addLabelValue("5 porques", causas.cinco_porques);

      ensureSpace(38);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("Assinaturas manuais", margin, y);
      y += 8;

      const signatureLineWidth = (maxTextWidth - 12) / 3;
      const sigX1 = margin;
      const sigX2 = margin + signatureLineWidth + 6;
      const sigX3 = margin + (signatureLineWidth + 6) * 2;
      const sigY = y + 10;

      doc.setDrawColor(0);
      doc.line(sigX1, sigY, sigX1 + signatureLineWidth, sigY);
      doc.line(sigX2, sigY, sigX2 + signatureLineWidth, sigY);
      doc.line(sigX3, sigY, sigX3 + signatureLineWidth, sigY);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text("Operador", sigX1, sigY + 5);
      doc.text("Tecnico de seguranca", sigX2, sigY + 5);
      doc.text("Testemunha", sigX3, sigY + 5);
      doc.text("Data da assinatura: ____/____/________", margin, sigY + 13);
      doc.text(
        "Apos colher as assinaturas, faca upload do arquivo assinado no campo de arquivamento da ocorrencia.",
        margin,
        sigY + 19,
      );

      doc.save(`investigacao-ocorrencia-${String(record.numero_ocorrencia).padStart(3, "0")}.pdf`);
      toast({
        title: "PDF gerado",
        description: "Arquivo pronto para assinatura manual.",
      });
    } catch (error) {
      console.error("Erro ao gerar PDF da investigacao:", error);
      toast({
        title: "Erro ao gerar PDF",
        description: "Nao foi possivel gerar o PDF da ocorrencia.",
        variant: "destructive",
      });
    }
  };

  const handleArchiveSignedPdf = async (
    record: InvestigacaoRecord,
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (files.length === 0) return;

    if (record.numero_ocorrencia <= 0) {
      toast({
        title: "Ocorrencia invalida",
        description: "Nao foi possivel identificar a ocorrencia para arquivar o PDF.",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingPdfAssinado(true);
    try {
      const storage = parsePdfAssinadoByOcorrencia();
      const key = String(record.numero_ocorrencia);
      const current = storage[key] || [];
      const incoming: PdfAssinadoArquivo[] = [];

      for (const file of files) {
        const isPdf =
          file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
        if (!isPdf) {
          throw new Error(`Arquivo ${file.name} nao e PDF. Envie somente .pdf.`);
        }
        if (file.size > 4 * 1024 * 1024) {
          throw new Error(`Arquivo ${file.name} excede 4MB para arquivamento local.`);
        }
        const dataUrl = await fileToDataUrl(file);
        incoming.push({
          id:
            typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
              ? crypto.randomUUID()
              : `${Date.now()}-${Math.random()}`,
          name: file.name,
          size: file.size,
          type: file.type,
          uploaded_at: new Date().toISOString(),
          data_url: dataUrl,
        });
      }

      storage[key] = [...incoming, ...current];
      localStorage.setItem(PDF_ASSINADO_STORAGE_KEY, JSON.stringify(storage));
      window.dispatchEvent(new Event(PDF_ASSINADO_STORAGE_EVENT));

      toast({
        title: "Arquivo arquivado",
        description: `${incoming.length} arquivo(s) assinado(s) arquivado(s) na ocorrencia.`,
      });
    } catch (error) {
      console.error("Erro ao arquivar PDF assinado:", error);
      toast({
        title: "Erro ao arquivar",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel arquivar o PDF assinado.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingPdfAssinado(false);
    }
  };

  const handleDownloadPdfAssinado = (file: PdfAssinadoArquivo) => {
    const link = document.createElement("a");
    link.href = file.data_url;
    link.download = file.name || "arquivo-assinado.pdf";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRemovePdfAssinado = (record: InvestigacaoRecord, fileId: string) => {
    try {
      const storage = parsePdfAssinadoByOcorrencia();
      const key = String(record.numero_ocorrencia);
      const current = storage[key] || [];
      storage[key] = current.filter((item) => item.id !== fileId);
      localStorage.setItem(PDF_ASSINADO_STORAGE_KEY, JSON.stringify(storage));
      window.dispatchEvent(new Event(PDF_ASSINADO_STORAGE_EVENT));
      toast({
        title: "Arquivo removido",
        description: "Arquivo assinado removido da ocorrencia.",
      });
    } catch (error) {
      console.error("Erro ao remover PDF assinado:", error);
      toast({
        title: "Erro ao remover",
        description: "Nao foi possivel remover o arquivo assinado.",
        variant: "destructive",
      });
    }
  };

  const handleExpandAttachmentImage = (file: AttachmentMeta, index: number) => {
    const previewUrl = resolveAttachmentPreviewUrl(file);
    if (!previewUrl) {
      toast({
        title: "Imagem indisponivel",
        description: "Nao foi possivel carregar a imagem para ampliacao.",
        variant: "destructive",
      });
      return;
    }

    setExpandedImage({
      url: previewUrl,
      title: file.name || `Anexo ${index + 1}`,
    });
  };

  const handleStartPlanoAcao = (record: InvestigacaoRecord) => {
    if (record.numero_ocorrencia <= 0) {
      toast({
        title: "Ocorrencia invalida",
        description: "Nao foi possivel identificar a ocorrencia para iniciar o plano de acao.",
        variant: "destructive",
      });
      return;
    }
    navigate(`/plano-acao-acidente?ocorrencia=${record.numero_ocorrencia}&origem=admin`);
  };

  const handleViewPlanoAcao = (record: InvestigacaoRecord) => {
    if (record.numero_ocorrencia <= 0) {
      toast({
        title: "Ocorrencia invalida",
        description: "Nao foi possivel identificar a ocorrencia.",
        variant: "destructive",
      });
      return;
    }

    const totalPlanos = getPlanoCount(record.numero_ocorrencia);
    if (totalPlanos <= 0) {
      toast({
        title: "Sem plano de acao",
        description: "Esta ocorrencia ainda nao possui plano de acao. Clique em Iniciar plano.",
        variant: "destructive",
      });
      return;
    }

    navigate(`/admin/planos-acao?ocorrencia=${record.numero_ocorrencia}`);
  };

  const handleDeleteInvestigacao = async (record: InvestigacaoRecord) => {
    if (!isAdmUser) {
      toast({
        title: "Acesso restrito",
        description: "Somente o usuario adm pode excluir investigacoes.",
        variant: "destructive",
      });
      return;
    }

    const confirmed = window.confirm(
      "Deseja realmente excluir esta investigacao? Esta acao nao pode ser desfeita.",
    );
    if (!confirmed) return;

    try {
      const nextInvestigacoes = investigacoes.filter((item) => item.id !== record.id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextInvestigacoes));
      window.dispatchEvent(new Event("checklistafm-investigacao-acidente-updated"));

      const occurrenceNumber = Number(record.numero_ocorrencia) || 0;
      if (occurrenceNumber > 0) {
        const occurrenceKey = String(occurrenceNumber);

        const currentCausas = parseAnaliseCausasByOcorrencia();
        if (currentCausas[occurrenceKey]) {
          delete currentCausas[occurrenceKey];
          localStorage.setItem(CAUSAS_STORAGE_KEY, JSON.stringify(currentCausas));
          window.dispatchEvent(new Event(CAUSAS_STORAGE_EVENT));
        }

        const currentPdfAssinado = parsePdfAssinadoByOcorrencia();
        if (currentPdfAssinado[occurrenceKey]) {
          delete currentPdfAssinado[occurrenceKey];
          localStorage.setItem(PDF_ASSINADO_STORAGE_KEY, JSON.stringify(currentPdfAssinado));
          window.dispatchEvent(new Event(PDF_ASSINADO_STORAGE_EVENT));
        }

        try {
          try {
            await accidentActionPlanService.deleteByOccurrence(occurrenceNumber);
          } catch (error) {
            if (!isMissingActionPlansTableError(error)) {
              throw error;
            }
          }

          const planosRaw = localStorage.getItem(PLANO_ACAO_STORAGE_KEY);
          if (planosRaw) {
            const parsedPlanos = JSON.parse(planosRaw);
            if (Array.isArray(parsedPlanos)) {
              const nextPlanos = parsedPlanos.filter(
                (item: any) => Number(item?.numero_ocorrencia) !== occurrenceNumber,
              );
              if (nextPlanos.length !== parsedPlanos.length) {
                localStorage.setItem(PLANO_ACAO_STORAGE_KEY, JSON.stringify(nextPlanos));
                window.dispatchEvent(new Event(PLANO_ACAO_STORAGE_EVENT));
              }
            }
          }
        } catch (error) {
          console.error("Erro ao limpar planos de acao vinculados:", error);
        }
      }

      if (selected?.id === record.id) {
        setSelected(null);
        setDetailsOpen(false);
      }

      await loadData();

      toast({
        title: "Investigacao excluida",
        description: "A investigacao foi removida com sucesso.",
      });
    } catch (error) {
      console.error("Erro ao excluir investigacao:", error);
      toast({
        title: "Erro ao excluir",
        description: "Nao foi possivel excluir a investigacao.",
        variant: "destructive",
      });
    }
  };

  const handleExportCsv = () => {
    if (filteredInvestigacoes.length === 0) {
      toast({
        title: "Nenhuma investigacao",
        description: "Nao ha dados para exportar com os filtros atuais.",
        variant: "destructive",
      });
      return;
    }

    const headers = [
      "data",
      "hora",
      "turno",
      "titulo",
      "acidentado",
      "setor",
      "natureza_ocorrencia",
      "tipo_acidente",
      "gravidade",
      "probabilidade",
      "afastamento",
      "dias_afastamento",
      "problema",
      "causa_maquinas",
      "causa_mao_de_obra",
      "causa_metodos",
      "causa_meio_ambiente",
      "causa_materiais",
      "causa_medicoes",
      "cinco_porques",
      "investigador",
      "anexos",
    ];

    const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;

    const rows = filteredInvestigacoes.map((item) => {
      const causas = resolveAnaliseCausas(item);
      return [
        item.data_ocorrencia,
        item.hora,
        item.turno,
        item.titulo,
        item.nome_acidentado,
        item.setor,
        item.natureza_ocorrencia,
        item.tipo_acidente,
        item.gravidade,
        item.probabilidade,
        item.teve_afastamento ? "sim" : "nao",
        item.dias_afastamento,
        causas.problema,
        causas.causa_maquinas,
        causas.causa_mao_de_obra,
        causas.causa_metodos,
        causas.causa_meio_ambiente,
        causas.causa_materiais,
        causas.causa_medicoes,
        causas.cinco_porques,
        item.investigador,
        String(item.attachments.length),
      ]
        .map((cell) => escape(cell || ""))
        .join(",");
    });

    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `investigacoes-${format(new Date(), "yyyy-MM-dd")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Exportacao concluida",
      description: "Arquivo CSV gerado com sucesso.",
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Investigacoes</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate("/admin/planos-acao")}>
            Planos de acao
          </Button>
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

      <div className="grid gap-3 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total</CardDescription>
            <CardTitle>{summary.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Com afastamento</CardDescription>
            <CardTitle>{summary.comAfastamento}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Gravidade critica</CardDescription>
            <CardTitle>{summary.criticas}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Assinadas</CardDescription>
            <CardTitle>{summary.assinadas}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Refine por tipo, gravidade, investigador, data e busca.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-8">
            <div>
              <label className="mb-1 block text-sm font-medium">Busca rapida</label>
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Titulo, acidentado, setor..."
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
              <label className="mb-1 block text-sm font-medium">Tipo</label>
              <Select value={tipoFilter} onValueChange={setTipoFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os tipos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  {uniqueTipos.map((tipo) => (
                    <SelectItem key={tipo} value={tipo}>
                      {tipo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Gravidade</label>
              <Select value={gravidadeFilter} onValueChange={setGravidadeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {uniqueGravidades.map((gravidade) => (
                    <SelectItem key={gravidade} value={gravidade}>
                      {gravidade}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Investigador</label>
              <Select value={investigadorFilter} onValueChange={setInvestigadorFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {uniqueInvestigadores.map((investigador) => (
                    <SelectItem key={investigador} value={investigador}>
                      {investigador}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Afastamento</label>
              <Select value={afastamentoFilter} onValueChange={setAfastamentoFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="com">Com afastamento</SelectItem>
                  <SelectItem value="sem">Sem afastamento</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Investigacoes</CardTitle>
          <CardDescription>
            {filteredInvestigacoes.length === 0
              ? "Nenhuma investigacao encontrada."
              : `Mostrando ${filteredInvestigacoes.length} investigacao(oes).`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredInvestigacoes.length === 0 ? (
            <div className="rounded-md border bg-gray-50 p-8 text-center text-gray-500">
              Nao ha investigacoes com os filtros selecionados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ocorrencia</TableHead>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Turno</TableHead>
                    <TableHead>Titulo</TableHead>
                    <TableHead>Acidentado</TableHead>
                    <TableHead>Setor</TableHead>
                    <TableHead>Classificacao</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Gravidade</TableHead>
                    <TableHead>Assinatura</TableHead>
                    <TableHead className="text-right">Acoes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvestigacoes.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        {item.numero_ocorrencia > 0
                          ? String(item.numero_ocorrencia).padStart(3, "0")
                          : "N/A"}
                      </TableCell>
                      <TableCell>{formatDateTime(item.data_ocorrencia, item.hora)}</TableCell>
                      <TableCell>{item.turno || "N/A"}</TableCell>
                      <TableCell className="max-w-[260px] truncate">{item.titulo || "N/A"}</TableCell>
                      <TableCell>{item.nome_acidentado || "N/A"}</TableCell>
                      <TableCell>{item.setor || "N/A"}</TableCell>
                      <TableCell>{item.natureza_ocorrencia || "N/A"}</TableCell>
                      <TableCell>{item.tipo_acidente || "N/A"}</TableCell>
                      <TableCell>
                        <Badge
                          variant={item.gravidade === "Critica" ? "destructive" : "secondary"}
                        >
                          {item.gravidade || "N/A"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {item.investigador ? (
                          <Badge variant="default">{item.investigador}</Badge>
                        ) : (
                          <Badge variant="secondary">Pendente</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleViewDetails(item)}>
                            <Eye className="mr-2 h-4 w-4" />
                            Detalhes
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleOpenAnaliseDialog(item)}>
                            Analises
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleStartPlanoAcao(item)}>
                            Iniciar plano
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleViewPlanoAcao(item)}>
                            Ver plano de acao
                          </Button>
                          {isAdmUser && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => handleDeleteInvestigacao(item)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Excluir
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Detalhes da Investigacao</DialogTitle>
            <DialogDescription>
              {selected && (
                <div className="text-sm">
                  Ocorrencia:{" "}
                  {selected.numero_ocorrencia > 0
                    ? String(selected.numero_ocorrencia).padStart(3, "0")
                    : "N/A"}{" "}
                  |{" "}
                  Data:{" "}
                  {formatDateTime(selected.data_ocorrencia || selected.created_at, selected.hora)}{" "}
                  | Acidentado: {selected.nome_acidentado || "N/A"} | Setor:{" "}
                  {selected.setor || "N/A"} | Classificacao:{" "}
                  {selected.natureza_ocorrencia || "N/A"}
                </div>
              )}
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="border rounded p-3">
                  <h3 className="font-medium text-sm mb-1">Identificacao</h3>
                  <p className="text-sm"><strong>Nome:</strong> {selected.nome_acidentado || "N/A"}</p>
                  <p className="text-sm"><strong>Cargo:</strong> {selected.cargo || "N/A"}</p>
                  <p className="text-sm"><strong>Setor:</strong> {selected.setor || "N/A"}</p>
                  <p className="text-sm"><strong>Turno:</strong> {selected.turno || "N/A"}</p>
                  <p className="text-sm"><strong>Tempo empresa:</strong> {selected.tempo_empresa || "N/A"}</p>
                  <p className="text-sm"><strong>Tempo funcao:</strong> {selected.tempo_funcao || "N/A"}</p>
                </div>

                <div className="border rounded p-3">
                  <h3 className="font-medium text-sm mb-1">Classificacao</h3>
                  <p className="text-sm"><strong>Classificacao:</strong> {selected.natureza_ocorrencia || "N/A"}</p>
                  <p className="text-sm"><strong>Mao de obra:</strong> {selected.mao_de_obra || "N/A"}</p>
                  <p className="text-sm"><strong>Tipo:</strong> {selected.tipo_acidente || "N/A"}</p>
                  <p className="text-sm"><strong>Gravidade:</strong> {selected.gravidade || "N/A"}</p>
                  <p className="text-sm"><strong>Probabilidade:</strong> {selected.probabilidade || "N/A"}</p>
                  <p className="text-sm">
                    <strong>Afastamento:</strong>{" "}
                    {selected.teve_afastamento ? `Sim (${selected.dias_afastamento || "0"} dia(s))` : "Nao"}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="font-medium mb-2">Analise e relato</h3>
                <div className="border p-3 rounded bg-gray-50 space-y-2 text-sm">
                  <p><strong>Parte do corpo:</strong> {selected.parte_corpo_atingida || "N/A"}</p>
                  <p><strong>Causa raiz:</strong> {selected.causa_raiz || "N/A"}</p>
                  <p><strong>Agente causador:</strong> {selected.agente_causador || "N/A"}</p>
                  <p><strong>Causa do acidente:</strong> {selected.causa_acidente || "N/A"}</p>
                  <p><strong>Descricao detalhada:</strong></p>
                  <p className="rounded border bg-white p-2 whitespace-pre-wrap">
                    {selected.descricao_detalhada || "N/A"}
                  </p>
                  <p><strong>Observacoes:</strong></p>
                  <p className="rounded border bg-white p-2 whitespace-pre-wrap">
                    {selected.observacoes || "N/A"}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="font-medium mb-2">Analise de causas (5 porques)</h3>
                <div className="border p-3 rounded bg-gray-50 space-y-2 text-sm">
                  <p><strong>Problema:</strong></p>
                  <p className="rounded border bg-white p-2 whitespace-pre-wrap">
                    {selectedCausas.problema || "N/A"}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <p><strong>Maquinas:</strong> {selectedCausas.causa_maquinas || "N/A"}</p>
                    <p><strong>Mao de obra:</strong> {selectedCausas.causa_mao_de_obra || "N/A"}</p>
                    <p><strong>Metodos:</strong> {selectedCausas.causa_metodos || "N/A"}</p>
                    <p><strong>Meio ambiente:</strong> {selectedCausas.causa_meio_ambiente || "N/A"}</p>
                    <p><strong>Materiais:</strong> {selectedCausas.causa_materiais || "N/A"}</p>
                    <p><strong>Medicoes:</strong> {selectedCausas.causa_medicoes || "N/A"}</p>
                  </div>
                  <p><strong>5 porques:</strong></p>
                  <p className="rounded border bg-white p-2 whitespace-pre-wrap">
                    {selectedCausas.cinco_porques || "N/A"}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="font-medium mb-2">Assinatura e anexos</h3>
                <div className="border p-3 rounded bg-gray-50 space-y-2 text-sm">
                  <p>
                    <strong>Investigador:</strong> {selected.investigador || "Nao assinado"}
                  </p>
                  <p>
                    <strong>Anexos:</strong> {selected.attachments.length}
                  </p>
                  {selected.attachments.length > 0 && (
                    <div className="space-y-2">
                      {selected.attachments.map((file, index) => (
                        <div
                          key={`${file.name}-${index}`}
                          className="rounded border bg-white px-3 py-2"
                        >
                          <div className="min-w-0 space-y-2">
                            <p className="truncate font-medium">{file.name || `Arquivo ${index + 1}`}</p>
                            <p className="text-xs text-gray-500">
                              {file.type || "tipo nao informado"} - {formatFileSize(file.size)}
                            </p>
                            {(() => {
                              const previewUrl = resolveAttachmentPreviewUrl(file);
                              const isImage = previewUrl.length > 0 && isImageAttachment(file);

                              if (isImage) {
                                return (
                                  <div className="space-y-2">
                                    <img
                                      src={previewUrl}
                                      alt={file.name || `Anexo ${index + 1}`}
                                      className="h-40 w-full rounded border object-cover"
                                    />
                                    <div className="flex flex-wrap gap-2">
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleExpandAttachmentImage(file, index)}
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
                                    Este anexo nao possui visualizacao ampliada nesta tela.
                                  </p>
                                );
                              }

                              return (
                                <p className="text-xs text-gray-500">
                                  Visualizacao indisponivel para este registro antigo.
                                </p>
                              );
                            })()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="font-medium mb-2">PDF para assinatura manual</h3>
                <div className="rounded border bg-gray-50 p-3 space-y-3 text-sm">
                  <p className="text-gray-600">
                    Gere o PDF da ocorrencia, colete as assinaturas fisicas e depois arquive o PDF
                    assinado nesta ocorrencia.
                  </p>

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleGenerateAssinaturaPdf(selected)}
                    >
                      Gerar PDF para assinatura
                    </Button>

                    <label className="inline-flex">
                      <input
                        type="file"
                        accept="application/pdf,.pdf"
                        multiple
                        className="hidden"
                        onChange={(event) => handleArchiveSignedPdf(selected, event)}
                        disabled={isUploadingPdfAssinado}
                      />
                      <span className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground">
                        {isUploadingPdfAssinado ? "Arquivando..." : "Arquivar PDF assinado"}
                      </span>
                    </label>
                  </div>

                  <div className="space-y-2">
                    <p className="font-medium">
                      Arquivados nesta ocorrencia: {selectedPdfAssinados.length}
                    </p>
                    {selectedPdfAssinados.length === 0 ? (
                      <p className="text-gray-500">Nenhum PDF assinado arquivado.</p>
                    ) : (
                      <div className="space-y-2">
                        {selectedPdfAssinados.map((file) => (
                          <div
                            key={file.id}
                            className="flex flex-col gap-2 rounded border bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-medium">{file.name}</p>
                              <p className="text-xs text-gray-500">
                                {formatFileSize(file.size)} - enviado em{" "}
                                {formatDateTimeFull(file.uploaded_at)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => handleDownloadPdfAssinado(file)}
                              >
                                Baixar
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                onClick={() => handleRemovePdfAssinado(selected, file.id)}
                              >
                                Remover
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            {selected && (
              <Button type="button" variant="outline" onClick={() => handleOpenAnaliseDialog(selected)}>
                Editar analises
              </Button>
            )}
            {selected && (
              <Button type="button" variant="outline" onClick={() => handleStartPlanoAcao(selected)}>
                Iniciar plano de acao
              </Button>
            )}
            {selected && (
              <Button type="button" variant="outline" onClick={() => handleViewPlanoAcao(selected)}>
                Ver plano de acao
              </Button>
            )}
            {selected && isAdmUser && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => handleDeleteInvestigacao(selected)}
              >
                Excluir investigacao
              </Button>
            )}
            <Button variant="outline" onClick={() => setDetailsOpen(false)} className="w-full sm:w-auto">
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={analiseDialogOpen} onOpenChange={setAnaliseDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Analises da ocorrencia</DialogTitle>
            <DialogDescription>
              {editingAnaliseRecord
                ? `Ocorrencia ${String(editingAnaliseRecord.numero_ocorrencia).padStart(3, "0")} - ${editingAnaliseRecord.nome_acidentado || "N/A"}`
                : "Preencha as analises da ocorrencia selecionada."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Problema</label>
              <Textarea
                rows={4}
                value={analiseForm.problema}
                onChange={(e) => updateAnaliseField("problema", e.target.value)}
                placeholder="Descreva o problema principal da ocorrencia."
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Maquinas</label>
                <Textarea
                  rows={3}
                  value={analiseForm.causa_maquinas}
                  onChange={(e) => updateAnaliseField("causa_maquinas", e.target.value)}
                  placeholder="Causas relacionadas a maquinas/equipamentos."
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Mao de obra</label>
                <Textarea
                  rows={3}
                  value={analiseForm.causa_mao_de_obra}
                  onChange={(e) => updateAnaliseField("causa_mao_de_obra", e.target.value)}
                  placeholder="Causas relacionadas a pessoas/comportamento."
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Metodos</label>
                <Textarea
                  rows={3}
                  value={analiseForm.causa_metodos}
                  onChange={(e) => updateAnaliseField("causa_metodos", e.target.value)}
                  placeholder="Causas relacionadas a metodos/processos."
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Meio ambiente</label>
                <Textarea
                  rows={3}
                  value={analiseForm.causa_meio_ambiente}
                  onChange={(e) => updateAnaliseField("causa_meio_ambiente", e.target.value)}
                  placeholder="Causas relacionadas ao ambiente."
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Materiais</label>
                <Textarea
                  rows={3}
                  value={analiseForm.causa_materiais}
                  onChange={(e) => updateAnaliseField("causa_materiais", e.target.value)}
                  placeholder="Causas relacionadas a materiais."
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Medicoes</label>
                <Textarea
                  rows={3}
                  value={analiseForm.causa_medicoes}
                  onChange={(e) => updateAnaliseField("causa_medicoes", e.target.value)}
                  placeholder="Causas relacionadas a medicao/controle."
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">5 porques</label>
              <Textarea
                rows={6}
                value={analiseForm.cinco_porques}
                onChange={(e) => updateAnaliseField("cinco_porques", e.target.value)}
                placeholder="Ex: 1) Por que aconteceu? 2) Por que isso aconteceu? ..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAnaliseDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveAnalise}>Salvar analise</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(expandedImage)}
        onOpenChange={(open) => {
          if (!open) setExpandedImage(null);
        }}
      >
        <DialogContent className="max-h-[92vh] overflow-hidden sm:max-w-6xl">
          <DialogHeader>
            <DialogTitle>Imagem ampliada</DialogTitle>
            <DialogDescription>
              {expandedImage?.title || "Anexo da investigacao"}
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-auto rounded border bg-black p-2">
            {expandedImage ? (
              <img
                src={expandedImage.url}
                alt={expandedImage.title}
                className="mx-auto max-h-[72vh] w-auto object-contain"
              />
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setExpandedImage(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminInvestigacoes;

