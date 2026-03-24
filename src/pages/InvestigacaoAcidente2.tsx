import React, { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
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
import { goldenRuleService } from "@/lib/supabase-service";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

type SignatureKey = "ass_tst" | "ass_gestor" | "ass_acomp";
type QuestionAnswer = "Sim" | "Não" | "N/A";

interface QuestionItem {
  id: string;
  numero: string;
  texto: string;
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
const REGRAS_DE_OURO_TECNICOS = [
  "CELSO PEREIRA",
  "ODAIR NASCIMENTO",
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
    texto: "O(s) dispositivos de segurança das máquinas está(ão) funcionando corretamente?",
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

const getCounterValue = () => {
  if (typeof window === "undefined") return 0;
  const parsed = Number.parseInt(localStorage.getItem(COUNTER_KEY) || "0", 10);
  return Number.isNaN(parsed) ? 0 : Math.max(parsed, 0);
};

const formatInspectionNumber = (value: number) => String(value).padStart(3, "0");
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

const isResponseOutOfPattern = (questionId: string, answer: QuestionAnswer) =>
  answer !== "N/A" && answer !== getDefaultAnswer(questionId);

const buildNonConformitySummary = (responses: QuestionResponse[]) => {
  const nonConformingResponses = responses.filter((response) =>
    isResponseOutOfPattern(response.codigo, response.resposta),
  );

  if (nonConformingResponses.length === 0) {
    return "Regra de Ouro sem n\u00e3o conformidades detalhadas.";
  }

  return nonConformingResponses
    .map((response) => `- ${response.numero || response.codigo}: ${response.pergunta}`)
    .join("\n");
};

const buildPlanoAcaoContext = (record: InvestigacaoChecklistRecord): PlanoAcaoContext => ({
  fonte: "regra-ouro",
  registro_id: record.id,
  numero_referencia: Number(record.numero_inspecao) || 0,
  data_referencia: record.created_at || "",
  titulo: record.titulo || `Regra de Ouro ${formatInspectionNumber(record.numero_inspecao)}`,
  setor: record.setor || "",
  tecnico: record.tecnico_seg || "",
  descricao_ocorrencia: buildNonConformitySummary(record.respostas),
  origem: "Regra de Ouro",
});

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

const createInitialResponses = (): Record<string, QuestionState> =>
  Object.fromEntries(
    QUESTION_ITEMS.map((question) => [
      question.id,
      {
        answer: getDefaultAnswer(question.id),
        evidences: [],
      },
    ]),
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
  const { sectors, leaders, operators } = useSupabaseData(["sectors", "leaders", "operators"]);

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
  const [isSaving, setIsSaving] = useState(false);
  const [previewNumber, setPreviewNumber] = useState(() => getCounterValue() + 1);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);
  const [submittedInspectionNumber, setSubmittedInspectionNumber] = useState<number | null>(null);
  const [successRedirectMessage, setSuccessRedirectMessage] = useState(
    "Voc\u00ea ser\u00e1 redirecionado para a tela inicial em instantes.",
  );

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
        console.warn("[InvestigacaoAcidente2] Nao foi possivel consultar o proximo numero remoto.", error);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const canonicalSectorMap = useMemo(() => {
    const map = new Map<string, string>();

    sectors.forEach((item: any) => {
      const name = normalizeText(item?.name).trim();
      if (!name) return;
      map.set(normalizeSectorKey(name), name);
    });

    return map;
  }, [sectors]);

  const resolveCanonicalSectorName = (value: unknown) => {
    const normalizedValue = normalizeSectorName(value);
    if (!normalizedValue) return "";

    const normalizedKey = normalizeSectorKey(normalizedValue);
    const aliasedKey = LEGACY_SECTOR_ALIASES[normalizedKey];

    return (
      canonicalSectorMap.get(normalizedKey) ||
      (aliasedKey ? canonicalSectorMap.get(aliasedKey) : undefined) ||
      normalizedValue
    );
  };

  const setorOptions = useMemo<SearchableStringOption[]>(
    () =>
      dedupeSorted(sectors.map((item: any) => resolveCanonicalSectorName(item?.name))).map((option) => ({
        value: option,
        label: option,
      })),
    [sectors, canonicalSectorMap],
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
    const allowedNames = new Map(
      REGRAS_DE_OURO_TECNICOS.map((name) => [normalizePersonKey(name), name]),
    );

    const fromLeaders = dedupeSorted(leaders.map((item: any) => normalizeText(item?.name)))
      .map((name) => allowedNames.get(normalizePersonKey(name)))
      .filter((name): name is string => Boolean(name));

    const resolved = Array.from(new Set(fromLeaders));
    const items = resolved.length > 0 ? resolved : [...REGRAS_DE_OURO_TECNICOS];
    return items.map((option) => ({
      value: option,
      label: option,
    }));
  }, [leaders]);

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
        description: [matricula ? `Matricula: ${matricula}` : "", cargo, setorOperador]
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
        description: [matricula ? `Matricula: ${matricula}` : "", "Lider/Usuario"]
          .filter(Boolean)
          .join(" • "),
      });
    });

    return Array.from(uniqueByName.values()).sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [leaders, operators]);

  const completionPercent = useMemo(() => {
    const total = QUESTION_ITEMS.length + 8;
    let filled = 0;

    if (titulo.trim()) filled += 1;
    if (setor.trim()) filled += 1;
    if (gestor.trim()) filled += 1;
    if (tecnicoSeg.trim()) filled += 1;
    if (acompanhante.trim()) filled += 1;
    if (signatures.ass_tst) filled += 1;
    if (signatures.ass_gestor) filled += 1;
    if (signatures.ass_acomp) filled += 1;

    QUESTION_ITEMS.forEach((item) => {
      if (responses[item.id]) filled += 1;
    });

    return Math.round((filled / total) * 100);
  }, [acompanhante, gestor, responses, setor, signatures.ass_acomp, signatures.ass_gestor, signatures.ass_tst, tecnicoSeg, titulo]);

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
    setResponses((previous) => ({
      ...previous,
      [questionId]: {
        ...previous[questionId],
        evidences: previous[questionId].evidences.filter((evidence) => evidence.id !== evidenceId),
      },
    }));
  };

  const updateAnswer = (questionId: string, answer: QuestionAnswer) => {
    setResponses((previous) => {
      const current = previous[questionId];
      if (answer === "N/A") {
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
        isResponseOutOfPattern(questionId, answer) && current.evidences.length === 0
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

  const validateForm = () => {
    if (!titulo.trim()) return "Preencha o Titulo.";
    if (!setor.trim()) return "Selecione o Setor.";
    if (!gestor.trim()) return "Selecione o Gestor.";
    if (!tecnicoSeg.trim()) return "Selecione o Tecnico.";
    if (!acompanhante.trim()) return "Selecione o Acompanhante.";
    if (!signatures.ass_tst) return "Registre a assinatura do Tecnico de Seguranca.";
    if (!signatures.ass_gestor) return "Registre a assinatura do Gestor.";
    if (!signatures.ass_acomp) return "Registre a assinatura do Acompanhante.";

    for (const item of QUESTION_ITEMS) {
      const response = responses[item.id];
      if (!response) return `Resposta ausente em ${item.id}.`;
      const requiresEvidence = isResponseOutOfPattern(item.id, response.answer);
      const completedEvidenceCount = response.evidences.filter(
        (evidence) => evidence.comment.trim().length > 0 && Boolean(evidence.photo),
      ).length;
      const invalidEvidenceIndex = response.evidences.findIndex((evidence) => {
        const hasComment = evidence.comment.trim().length > 0;
        const hasPhoto = Boolean(evidence.photo);
        return (hasComment || hasPhoto) && !(hasComment && hasPhoto);
      });

      if (requiresEvidence && completedEvidenceCount === 0) {
        return `Adicione pelo menos uma foto com comentario no item ${item.numero} quando a resposta estiver fora do padrao.`;
      }

      if (invalidEvidenceIndex >= 0) {
        return `Complete comentario e foto da evidencia ${invalidEvidenceIndex + 1} do item ${item.numero}.`;
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
        QUESTION_ITEMS.map(async (item) => {
          const current = responses[item.id];
          const evidencias = await Promise.all(
            current.evidences.map(async (evidence) => ({
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
            resposta: current.answer,
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
            "[InvestigacaoAcidente2] Regra salva no banco, mas o cache local nao foi atualizado.",
            storageError,
          );
        }
      }

      const savedRecord: InvestigacaoChecklistRecord = payload;
      const hasNonConformity = savedRecord.respostas.some((response) =>
        isResponseOutOfPattern(response.codigo, response.resposta),
      );
      let nextPath = "/";
      let nextSuccessMessage = "Voc\u00ea ser\u00e1 redirecionado para a tela inicial em instantes.";

      if (hasNonConformity) {
        sessionStorage.setItem(
          PLANO_ACAO_CONTEXT_KEY,
          JSON.stringify(buildPlanoAcaoContext(savedRecord)),
        );
        nextPath = `/plano-acao-acidente?origem=admin&fonte=regra-ouro&registro=${encodeURIComponent(savedRecord.id)}&ocorrencia=${finalInspectionNumber}`;
        nextSuccessMessage =
          "Foram identificadas n\u00e3o conformidades. Voc\u00ea ser\u00e1 redirecionado para o plano de a\u00e7\u00e3o em instantes.";
      }

      toast({
        title: "Regra de Ouro registrada",
        description: hasNonConformity
          ? `Registro ${formatInspectionNumber(finalInspectionNumber)} salvo. O plano de a\u00e7\u00e3o ser\u00e1 aberto em seguida.`
          : `Registro ${formatInspectionNumber(finalInspectionNumber)} salvo com sucesso.`,
      });

      setTitulo("");
      setSetor("");
      setGestor("");
      setTecnicoSeg("");
      setAcompanhante("");
      setResponses(createInitialResponses());
      setSignatures(createInitialSignatures());
      setAttachments([]);
      setPreviewNumber(finalInspectionNumber + 1);
      setSubmittedInspectionNumber(finalInspectionNumber);
      setSuccessRedirectMessage(nextSuccessMessage);
      setSubmissionSuccess(true);
      window.setTimeout(() => {
        setSubmissionSuccess(false);
        setSubmittedInspectionNumber(null);
        navigate(nextPath);
      }, 2000);
    } catch (error) {
      console.error("Erro ao salvar regra de ouro:", error);
      toast({
        title: "Erro ao salvar",
        description: "Nao foi possivel concluir o envio.",
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
              <Label>Gestor *</Label>
              <SearchableStringSelect
                value={gestor}
                onValueChange={setGestor}
                options={liderOptions}
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
                Técnicos/Investigadores de Segurança: CELSO PEREIRA, ODAIR NASCIMENTO e JOÃO PAULO.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Acomp. *</Label>
              <SearchableStringSelect
                value={acompanhante}
                onValueChange={setAcompanhante}
                options={acompanhanteOptions}
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
            {QUESTION_ITEMS.map((item) => {
              const response = responses[item.id];
              const requiresEvidence = isResponseOutOfPattern(item.id, response.answer);
              const showExtra = requiresEvidence || response.evidences.length > 0;

              return (
                <div key={item.id} className="rounded-lg border border-blue-200 bg-white">
                  <div className="grid items-center gap-3 p-4 lg:grid-cols-[74px_1fr_260px]">
                    <div className="text-center">
                      <div className="text-3xl font-bold leading-none text-black sm:text-4xl">{item.numero}</div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-base font-medium text-blue-950">{item.texto}</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addEvidence(item.id)}
                      >
                        Adicionar foto/comentário
                      </Button>
                    </div>

                    <div className="flex flex-col items-center justify-center gap-2">
                      <span className={cn("text-lg font-bold", getAnswerTone(response.answer))}>
                        {response.answer.toUpperCase()}
                      </span>
                      <div className="grid w-full grid-cols-3 gap-2">
                        {(["Sim", "Não", "N/A"] as QuestionAnswer[]).map((answerOption) => (
                          <Button
                            key={answerOption}
                            type="button"
                            variant={response.answer === answerOption ? "default" : "outline"}
                            size="sm"
                            className="w-full"
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
    </div>
  );
};

export default InvestigacaoAcidente2;













