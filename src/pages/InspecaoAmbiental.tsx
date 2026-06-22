import React, { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, CheckCircle, ClipboardCheck, Eraser, Leaf, Save, Signature, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AddOperatorDialog } from "@/components/operators/AddOperatorDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSupabaseData } from "@/hooks/useSupabaseData";
import { useToast } from "@/hooks/use-toast";
import { getTodayLocalDateKey } from "@/lib/dateHelpers";
import { environmentalInspectionService, operatorService } from "@/lib/supabase-service";

type EnvironmentalAnswer = "Sim" | "Não" | "N/A" | "";

interface EnvironmentalEvidence {
  comentario: string;
  foto: {
    name: string;
    size: number;
    type: string;
    data_url: string;
  } | null;
}

interface EnvironmentalQuestion {
  id: string;
  number: number;
  section: string;
  text: string;
  expected: "Sim" | "Não";
}

type SignatureTarget = "acompanhante" | "realizado" | "gestor";

const DEFAULT_ENVIRONMENTAL_INSPECTOR = "GICELIA FELIX";

const ENVIRONMENTAL_QUESTIONS: EnvironmentalQuestion[] = [
  {
    id: "segregacao-residuos",
    number: 5,
    section: "Resíduos",
    text: "A segregação de resíduos está adequada?",
    expected: "Sim",
  },
  {
    id: "lixeiras-identificadas",
    number: 7,
    section: "Resíduos",
    text: "As lixeiras estão identificadas conforme padrão?",
    expected: "Sim",
  },
  {
    id: "placas-residuos-bom-estado",
    number: 9,
    section: "Resíduos",
    text: "Todas as placas de identificação para resíduos estão em bom estado?",
    expected: "Sim",
  },
  {
    id: "bacias-contencao-equipamentos",
    number: 11,
    section: "Resíduos",
    text: "Máquinas/Equipamentos com possibilidade de vazamento possuem bacias de contenção?",
    expected: "Sim",
  },
  {
    id: "produtos-perigosos-identificados",
    number: 13,
    section: "Produtos Químicos",
    text: "Todos os produtos perigosos estão identificados em embalagens adequadas? (Inclusive os fracionados)",
    expected: "Sim",
  },
  {
    id: "produtos-local-adequado",
    number: 15,
    section: "Produtos Químicos",
    text: "Estão em um local adequado?",
    expected: "Sim",
  },
  {
    id: "fds-local-uso",
    number: 17,
    section: "Produtos Químicos",
    text: "Todas as FDS estão no local de uso do produto?",
    expected: "Sim",
  },
  {
    id: "kits-emergencia-facil-acesso",
    number: 19,
    section: "Sistema de Contenção",
    text: "Os kits de emergências estão em local de fácil acesso?",
    expected: "Sim",
  },
  {
    id: "kit-identificado",
    number: 21,
    section: "Sistema de Contenção",
    text: "O kit está identificado?",
    expected: "Sim",
  },
  {
    id: "vazamentos-contidos-rede-pluvial-solo",
    number: 23,
    section: "Sistema de Contenção",
    text: "Foram contidos vazamentos/derramamento para a rede pluvial e ou solo? (Produtos Químicos, Efluentes e etc)",
    expected: "Sim",
  },
  {
    id: "limpeza-derramamentos-residuos-solidos",
    number: 25,
    section: "Sistema de Contenção",
    text: "Foram realizadas limpeza de derramamentos de Resíduos Sólidos? (ADF, Pó de Esmeril, Papel, Plástico e EPI)",
    expected: "Sim",
  },
  {
    id: "setor-livre-vazamentos",
    number: 27,
    section: "Vazamentos de Óleos / Produtos Químicos / Resíduos",
    text: "O setor está livre de vazamentos ou derramamentos de resíduos?",
    expected: "Sim",
  },
  {
    id: "kits-emergencia-abastecidos",
    number: 29,
    section: "Vazamentos de Óleos / Produtos Químicos / Resíduos",
    text: "Os kits de emergências estão abastecidos?",
    expected: "Sim",
  },
  {
    id: "sistema-exaustao-funcionando",
    number: 31,
    section: "Sistema de Controle Ambiental",
    text: "O sistema de exaustão do setor está funcionando corretamente?",
    expected: "Sim",
  },
  {
    id: "lixeiras-bom-estado",
    number: 33,
    section: "Sistema de Controle Ambiental",
    text: "As lixeiras estão em bom estado?",
    expected: "Sim",
  },
  {
    id: "momentos-meio-ambiente-erp",
    number: 35,
    section: "Educação Ambiental",
    text: "Os momentos do meio Ambiente estão sendo realizados e registrados no sistema ERP?",
    expected: "Sim",
  },
  {
    id: "funcionarios-cientes-temas",
    number: 37,
    section: "Educação Ambiental",
    text: "Os funcionários estão cientes e entendendo os temas dos momentos do meio ambiente?",
    expected: "Sim",
  },
];

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const resizeImageToDataUrl = (file: File, maxSize = 1280) =>
  new Promise<string>((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      fileToDataUrl(file).then(resolve).catch(reject);
      return;
    }

    const imageUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(imageUrl);

      let { width, height } = img;
      const ratio = Math.min(maxSize / width, maxSize / height, 1);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Nao foi possivel processar a imagem."));
        return;
      }

      context.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Nao foi possivel gerar a imagem."));
            return;
          }

          const reader = new FileReader();
          reader.onloadend = () => resolve(String(reader.result || ""));
          reader.onerror = () => reject(new Error("Falha ao ler a imagem."));
          reader.readAsDataURL(blob);
        },
        "image/jpeg",
        0.72,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(imageUrl);
      reject(new Error("Falha ao carregar a imagem."));
    };

    img.src = imageUrl;
  });

const InspecaoAmbiental = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { sectors, operators, refresh } = useSupabaseData(["sectors", "operators"]);
  const acompanhanteSignatureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const realizadoPorSignatureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const gestorSignatureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingSignatureTargetRef = useRef<SignatureTarget | null>(null);
  const signedTargetsRef = useRef<Record<SignatureTarget, boolean>>({
    acompanhante: false,
    realizado: false,
    gestor: false,
  });

  const [realizadoPor] = useState(DEFAULT_ENVIRONMENTAL_INSPECTOR);
  const [dataInspecao, setDataInspecao] = useState(getTodayLocalDateKey() || "");
  const [acompanhadoPor, setAcompanhadoPor] = useState("");
  const [gestor, setGestor] = useState("");
  const [personDialogTarget, setPersonDialogTarget] = useState<"acompanhadoPor" | "gestor" | null>(null);
  const [setor, setSetor] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [answers, setAnswers] = useState<Record<string, EnvironmentalAnswer>>(
    () =>
      Object.fromEntries(
        ENVIRONMENTAL_QUESTIONS.map((question) => [question.id, question.expected]),
      ),
  );
  const [evidences, setEvidences] = useState<Record<string, EnvironmentalEvidence>>({});
  const [assinaturaAcompanhante, setAssinaturaAcompanhante] = useState("");
  const [assinaturaRealizadoPor, setAssinaturaRealizadoPor] = useState("");
  const [assinaturaGestor, setAssinaturaGestor] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [processingPhotos, setProcessingPhotos] = useState(0);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);
  const [successInspectionNumber, setSuccessInspectionNumber] = useState<number | null>(null);

  const sortedSectors = useMemo(
    () =>
      [...(sectors as any[])]
        .map((item) => String(item?.name || "").trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "pt-BR")),
    [sectors],
  );

  const sortedPeople = useMemo(
    () =>
      [...(operators as any[])]
        .map((item) => ({
          id: String(item?.matricula || item?.id || item?.name || ""),
          name: String(item?.name || "").trim(),
          sector: String(item?.setor || "").trim(),
        }))
        .filter((item) => item.id && item.name)
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [operators],
  );

  const irregularQuestions = useMemo(
    () =>
      ENVIRONMENTAL_QUESTIONS.filter((question) => {
        const answer = answers[question.id];
        return answer && answer !== "N/A" && answer !== question.expected;
      }),
    [answers],
  );

  const progress = useMemo(() => {
    const answered = ENVIRONMENTAL_QUESTIONS.filter((question) => answers[question.id]).length;
    return Math.round((answered / ENVIRONMENTAL_QUESTIONS.length) * 100);
  }, [answers]);

  const sectorOptions = useMemo(
    () =>
      [...(sectors as any[])]
        .map((item) => ({
          id: String(item?.id || item?.name || ""),
          name: String(item?.name || "").trim(),
        }))
        .filter((item) => item.id && item.name)
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [sectors],
  );

  const openAddPersonDialog = (target: "acompanhadoPor" | "gestor") => {
    setPersonDialogTarget(target);
  };

  const handleAddPerson = async (data: {
    id: string;
    name: string;
    cargo?: string;
    setor?: string;
    senha?: string;
  }) => {
    try {
      const personName = data.name.trim().toUpperCase();
      await operatorService.create({
        matricula: data.id.trim(),
        name: personName,
        cargo: data.cargo?.trim().toUpperCase() || null,
        setor: data.setor || null,
        senha: data.senha ? data.senha.trim() : null,
      });

      if (personDialogTarget === "acompanhadoPor") {
        setAcompanhadoPor(personName);
      } else if (personDialogTarget === "gestor") {
        setGestor(personName);
      }

      await refresh();
      toast({
        title: "Pessoa adicionada",
        description: `${personName} foi adicionada e selecionada no campo.`,
      });
    } catch (error) {
      console.error("Erro ao adicionar pessoa na inspeção ambiental:", error);
      toast({
        title: "Erro ao adicionar pessoa",
        description: error instanceof Error ? error.message : "Não foi possível adicionar a pessoa.",
        variant: "destructive",
      });
    }
  };

  const updateEvidence = (questionId: string, patch: Partial<EnvironmentalEvidence>) => {
    setEvidences((current) => ({
      ...current,
      [questionId]: {
        comentario: "",
        foto: null,
        ...current[questionId],
        ...patch,
      },
    }));
  };

  const handleAnswerChange = (question: EnvironmentalQuestion, answer: EnvironmentalAnswer) => {
    setAnswers((current) => ({ ...current, [question.id]: answer }));
    if (!answer || answer === "N/A" || answer === question.expected) {
      setEvidences((current) => {
        const existing = current[question.id];
        if (!existing) return current;
        return {
          ...current,
          [question.id]: {
            ...existing,
            foto: null,
          },
        };
      });
    }
  };

  const handleEvidenceFile = async (questionId: string, file: File | null) => {
    if (!file) {
      updateEvidence(questionId, { foto: null });
      return;
    }

    setProcessingPhotos((current) => current + 1);
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      updateEvidence(questionId, {
        foto: {
          name: file.name,
          size: Math.round((dataUrl.length * 3) / 4),
          type: "image/jpeg",
          data_url: dataUrl,
        },
      });
    } catch (error) {
      console.error("Erro ao processar foto ambiental:", error);
      toast({
        title: "Erro ao anexar foto",
        description: error instanceof Error ? error.message : "Nao foi possivel anexar a imagem.",
        variant: "destructive",
      });
    } finally {
      setProcessingPhotos((current) => Math.max(0, current - 1));
    }
  };

  const handleEvidenceInputChange = async (
    questionId: string,
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    await handleEvidenceFile(questionId, event.target.files?.[0] || null);
    event.target.value = "";
  };

  const updateSignatureDataUrl = (target: SignatureTarget, canvas: HTMLCanvasElement) => {
    const dataUrl = canvas.toDataURL("image/png");
    if (target === "acompanhante") {
      setAssinaturaAcompanhante(dataUrl);
    } else if (target === "gestor") {
      setAssinaturaGestor(dataUrl);
    } else {
      setAssinaturaRealizadoPor(dataUrl);
    }
  };

  const getCurrentSignatureDataUrl = (target: SignatureTarget, fallback: string) => {
    if (!signedTargetsRef.current[target]) return "";
    const canvas = getSignatureCanvas(target);
    return fallback || canvas?.toDataURL("image/png") || "";
  };

  const getSignatureCanvas = (target: SignatureTarget) => {
    if (target === "acompanhante") return acompanhanteSignatureCanvasRef.current;
    if (target === "gestor") return gestorSignatureCanvasRef.current;
    return realizadoPorSignatureCanvasRef.current;
  };

  const getCanvasPosition = (event: React.PointerEvent<HTMLCanvasElement>, target: SignatureTarget) => {
    const canvas = getSignatureCanvas(target);
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  };

  const startDrawingSignature = (target: SignatureTarget, event: React.PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const canvas = getSignatureCanvas(target);
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const { x, y } = getCanvasPosition(event, target);
    drawingSignatureTargetRef.current = target;
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      // Alguns navegadores moveis nao suportam captura de ponteiro de forma consistente.
    }
    context.beginPath();
    context.lineWidth = 2;
    context.lineCap = "round";
    context.strokeStyle = "#0f172a";
    context.fillStyle = "#0f172a";
    context.arc(x, y, 1, 0, Math.PI * 2);
    context.fill();
    signedTargetsRef.current[target] = true;
    updateSignatureDataUrl(target, canvas);
    context.beginPath();
    context.moveTo(x, y);
  };

  const drawSignature = (target: SignatureTarget, event: React.PointerEvent<HTMLCanvasElement>) => {
    if (drawingSignatureTargetRef.current !== target) return;
    event.preventDefault();
    const canvas = getSignatureCanvas(target);
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const { x, y } = getCanvasPosition(event, target);
    context.lineWidth = 2;
    context.lineCap = "round";
    context.strokeStyle = "#0f172a";
    context.lineTo(x, y);
    context.stroke();
    signedTargetsRef.current[target] = true;
    updateSignatureDataUrl(target, canvas);
  };

  const stopDrawingSignature = (target: SignatureTarget, event: React.PointerEvent<HTMLCanvasElement>) => {
    if (drawingSignatureTargetRef.current !== target) return;
    event.preventDefault();
    const canvas = getSignatureCanvas(target);
    const context = canvas?.getContext("2d");
    if (canvas && context) {
      context.closePath();
      updateSignatureDataUrl(target, canvas);
      try {
        canvas.releasePointerCapture(event.pointerId);
      } catch {
        // Ignora navegadores que ja liberaram o ponteiro.
      }
    }
    drawingSignatureTargetRef.current = null;
  };

  const clearSignature = (target: SignatureTarget) => {
    const canvas = getSignatureCanvas(target);
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    signedTargetsRef.current[target] = false;
    if (target === "acompanhante") {
      setAssinaturaAcompanhante("");
    } else if (target === "gestor") {
      setAssinaturaGestor("");
    } else {
      setAssinaturaRealizadoPor("");
    }
  };

  const handleSave = async () => {
    if (isSaving) return;

    if (processingPhotos > 0) {
      toast({
        title: "Foto em processamento",
        description: "Aguarde a foto terminar de carregar antes de enviar.",
        variant: "destructive",
      });
      return;
    }

    if (!realizadoPor.trim() || !dataInspecao || !setor.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha realizado por, data da inspeção e setor.",
        variant: "destructive",
      });
      return;
    }

    if (!acompanhadoPor.trim()) {
      toast({
        title: "Acompanhante obrigatório",
        description: "Selecione quem acompanhou a inspeção ambiental.",
        variant: "destructive",
      });
      return;
    }

    if (!gestor.trim()) {
      toast({
        title: "Gestor obrigatorio",
        description: "Selecione o gestor responsavel pela inspecao ambiental.",
        variant: "destructive",
      });
      return;
    }

    const unanswered = ENVIRONMENTAL_QUESTIONS.filter((question) => !answers[question.id]);
    if (unanswered.length > 0) {
      toast({
        title: "Checklist incompleto",
        description: "Responda todas as perguntas ambientais antes de salvar.",
        variant: "destructive",
      });
      return;
    }

    const missingEvidence = irregularQuestions.find((question) => {
      const evidence = evidences[question.id];
      return !evidence?.comentario?.trim() && !evidence?.foto;
    });
    if (missingEvidence) {
      toast({
        title: "Evidência obrigatória",
        description: `Informe comentário ou foto para a pergunta ${String(missingEvidence.number).padStart(2, "0")}.`,
        variant: "destructive",
      });
      return;
    }

    const currentAssinaturaRealizadoPor = getCurrentSignatureDataUrl("realizado", assinaturaRealizadoPor);
    const currentAssinaturaAcompanhante = getCurrentSignatureDataUrl("acompanhante", assinaturaAcompanhante);
    const currentAssinaturaGestor = getCurrentSignatureDataUrl("gestor", assinaturaGestor);

    if (!currentAssinaturaRealizadoPor || !currentAssinaturaAcompanhante || !currentAssinaturaGestor) {
      toast({
        title: "Assinaturas obrigatórias",
        description: "Colete as assinaturas de quem realizou, acompanhou e do gestor antes de salvar.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSaving(true);
      const now = new Date().toISOString();
      const saved = await environmentalInspectionService.create({
        created_at: now,
        realizado_por: realizadoPor.trim(),
        data_inspecao: dataInspecao,
        acompanhado_por: acompanhadoPor.trim(),
        gestor: gestor.trim(),
        setor: setor.trim(),
        observacoes: observacoes.trim(),
        responses: ENVIRONMENTAL_QUESTIONS.map((question) => ({
          codigo: question.id,
          numero: String(question.number).padStart(2, "0"),
          secao: question.section,
          pergunta: question.text,
          resposta: answers[question.id] as "Sim" | "Não" | "N/A",
          resposta_esperada: question.expected,
          irregular: answers[question.id] !== "N/A" && answers[question.id] !== question.expected,
          comentario: evidences[question.id]?.comentario || "",
          foto: evidences[question.id]?.foto || null,
        })),
        assinatura: currentAssinaturaRealizadoPor,
        assinatura_realizado_por: currentAssinaturaRealizadoPor,
        assinatura_acompanhante: currentAssinaturaAcompanhante,
        assinatura_gestor: currentAssinaturaGestor,
      });

      const savedNumber = Number((saved as any)?.numero_inspecao) || 0;
      toast({
        title: "Inspeção ambiental salva",
        description: `Registro ambiental ${String(savedNumber).padStart(3, "0")} salvo no banco de dados.`,
      });
      setSuccessInspectionNumber(savedNumber || null);
      setSubmissionSuccess(true);

      setTimeout(() => {
        setSubmissionSuccess(false);
        setSuccessInspectionNumber(null);
        navigate("/");
      }, 2000);
    } catch (error) {
      console.error("Erro ao salvar inspeção ambiental:", error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar a inspeção ambiental.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      {submissionSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-green-700/95 px-6 text-white">
          <div className="flex max-w-md flex-col items-center gap-4 text-center">
            <CheckCircle size={64} className="text-white" />
            <h2 className="text-2xl font-bold">{"Inspe\u00e7\u00e3o ambiental enviada!"}</h2>
            <p className="text-sm text-green-100">
              {successInspectionNumber
                ? `O registro ambiental ${String(successInspectionNumber).padStart(3, "0")} foi salvo com sucesso.`
                : "A inspe\u00e7\u00e3o ambiental foi registrada com sucesso."}
              {" Voc\u00ea ser\u00e1 redirecionado para a tela inicial em instantes."}
            </p>
          </div>
        </div>
      )}
      <header className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-red-700 px-4 py-5 text-white shadow-lg">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white/15 p-3">
              <Leaf className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Inspeção Ambiental</h1>
              <p className="text-sm text-emerald-50">
                Registro de verificação ambiental do setor.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            className="border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6">
        <Card className="border-emerald-100 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-950">
              <ClipboardCheck className="h-5 w-5 text-emerald-700" />
              Dados da Inspeção Ambiental
            </CardTitle>
            <CardDescription>
              Preencha os responsáveis, setor e data. Progresso: {progress}%
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Realizado por *</Label>
              <Input value={realizadoPor} readOnly className="bg-muted/60 font-semibold" />
            </div>
            <div className="space-y-2">
              <Label>Data da inspeção *</Label>
              <Input type="date" value={dataInspecao} onChange={(event) => setDataInspecao(event.target.value)} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Acompanhado por</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openAddPersonDialog("acompanhadoPor")}
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  Adicionar pessoa
                </Button>
              </div>
              <Select value={acompanhadoPor || "nao-informado"} onValueChange={(value) => setAcompanhadoPor(value === "nao-informado" ? "" : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar acompanhante" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nao-informado">Não informado</SelectItem>
                  {sortedPeople.map((person) => (
                    <SelectItem key={person.id} value={person.name}>
                      {person.name}
                      {person.sector ? ` - ${person.sector}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Setor *</Label>
              <Select value={setor} onValueChange={setSetor}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar setor" />
                </SelectTrigger>
                <SelectContent>
                  {sortedSectors.map((sector) => (
                    <SelectItem key={sector} value={sector}>
                      {sector}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Gestor *</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openAddPersonDialog("gestor")}
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  Adicionar pessoa
                </Button>
              </div>
              <Select value={gestor || "nao-informado"} onValueChange={(value) => setGestor(value === "nao-informado" ? "" : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar gestor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nao-informado">Nao informado</SelectItem>
                  {sortedPeople.map((person) => (
                    <SelectItem key={person.id} value={person.name}>
                      {person.name}
                      {person.sector ? ` - ${person.sector}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-100 shadow-sm">
          <CardHeader>
            <CardTitle>Checklist Ambiental</CardTitle>
            <CardDescription>
              Quando a resposta fugir do padrão, informe comentário ou foto da irregularidade.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {ENVIRONMENTAL_QUESTIONS.map((question, index) => {
              const answer = answers[question.id];
              const isIrregular = Boolean(answer && answer !== "N/A" && answer !== question.expected);
              const evidence = evidences[question.id] || { comentario: "", foto: null };
              const showSectionTitle =
                index === 0 || ENVIRONMENTAL_QUESTIONS[index - 1].section !== question.section;

              return (
                <React.Fragment key={question.id}>
                  {showSectionTitle && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-700">
                        Inspeção Ambiental
                      </p>
                      <h3 className="text-xl font-bold text-emerald-950">{question.section}</h3>
                    </div>
                  )}
                  <div
                    className={`rounded-xl border p-4 transition-colors ${
                      isIrregular ? "border-red-200 bg-red-50/70" : "border-emerald-100 bg-white"
                    }`}
                  >
                    <div className="grid gap-4 md:grid-cols-[72px_1fr_300px] md:items-center">
                      <div className="text-4xl font-black text-slate-950">
                        {String(question.number).padStart(2, "0")}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-950">{question.text}</p>
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row md:justify-end">
                        {(["Sim", "Não", "N/A"] as EnvironmentalAnswer[]).map((option) => (
                          <Button
                            key={option}
                            type="button"
                            variant={answer === option ? "default" : "outline"}
                            className={answer === option ? "bg-slate-950 text-white hover:bg-slate-800" : ""}
                            onClick={() => handleAnswerChange(question, option)}
                          >
                            {option === "N/A" ? "Não se Aplica" : option}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      <Label>Alguma observação?</Label>
                      <Textarea
                        value={evidence.comentario}
                        onChange={(event) => updateEvidence(question.id, { comentario: event.target.value })}
                        placeholder="Insira sua resposta"
                      />
                    </div>

                    {isIrregular && (
                      <div className="mt-4 rounded-lg border border-red-100 bg-white p-4">
                        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-red-700">
                          <Camera className="h-4 w-4" />
                          Foto da irregularidade
                        </div>
                        <div className="space-y-2">
                          <Label>Foto</Label>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <label className="inline-flex cursor-pointer items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground">
                              <Camera className="mr-2 h-4 w-4" />
                              Bater foto
                              <Input
                                className="sr-only"
                                type="file"
                                accept="image/*"
                                capture="environment"
                                onChange={(event) => void handleEvidenceInputChange(question.id, event)}
                              />
                            </label>
                            <label className="inline-flex cursor-pointer items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground">
                              Escolher da galeria
                              <Input
                                className="sr-only"
                                type="file"
                                accept="image/*"
                                onChange={(event) => void handleEvidenceInputChange(question.id, event)}
                              />
                            </label>
                          </div>
                          {evidence.foto && (
                            <p className="text-xs text-muted-foreground">
                              Foto anexada: {evidence.foto.name}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </React.Fragment>
              );
            })}
          </CardContent>
        </Card>

        <Card className="border-emerald-100 shadow-sm">
          <CardHeader>
            <CardTitle>Observações e Assinaturas</CardTitle>
            <CardDescription>Finalize com observações gerais e as assinaturas de quem realizou e acompanhou.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Observações gerais</Label>
              <Textarea
                value={observacoes}
                onChange={(event) => setObservacoes(event.target.value)}
                placeholder="Registre observações adicionais da inspeção ambiental."
              />
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-xl border bg-white p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <Label className="flex items-center gap-2">
                    <Signature className="h-4 w-4" />
                    Assinatura de quem realizou: {DEFAULT_ENVIRONMENTAL_INSPECTOR} *
                  </Label>
                  <Button type="button" variant="outline" size="sm" onClick={() => clearSignature("realizado")}>
                    <Eraser className="mr-2 h-4 w-4" />
                    Limpar
                  </Button>
                </div>
                <canvas
                  ref={realizadoPorSignatureCanvasRef}
                  width={960}
                  height={220}
                  className="h-48 w-full touch-none rounded-lg border bg-white"
                  onPointerDown={(event) => startDrawingSignature("realizado", event)}
                  onPointerMove={(event) => drawSignature("realizado", event)}
                  onPointerUp={(event) => stopDrawingSignature("realizado", event)}
                  onPointerLeave={(event) => stopDrawingSignature("realizado", event)}
                  onPointerCancel={(event) => stopDrawingSignature("realizado", event)}
                />
              </div>
              <div className="rounded-xl border bg-white p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <Label className="flex items-center gap-2">
                    <Signature className="h-4 w-4" />
                    Assinatura do acompanhante *
                  </Label>
                  <Button type="button" variant="outline" size="sm" onClick={() => clearSignature("acompanhante")}>
                    <Eraser className="mr-2 h-4 w-4" />
                    Limpar
                  </Button>
                </div>
                <canvas
                  ref={acompanhanteSignatureCanvasRef}
                  width={960}
                  height={220}
                  className="h-48 w-full touch-none rounded-lg border bg-white"
                  onPointerDown={(event) => startDrawingSignature("acompanhante", event)}
                  onPointerMove={(event) => drawSignature("acompanhante", event)}
                  onPointerUp={(event) => stopDrawingSignature("acompanhante", event)}
                  onPointerLeave={(event) => stopDrawingSignature("acompanhante", event)}
                  onPointerCancel={(event) => stopDrawingSignature("acompanhante", event)}
                />
              </div>
              <div className="rounded-xl border bg-white p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <Label className="flex items-center gap-2">
                    <Signature className="h-4 w-4" />
                    Assinatura do gestor: {gestor || "Gestor"} *
                  </Label>
                  <Button type="button" variant="outline" size="sm" onClick={() => clearSignature("gestor")}>
                    <Eraser className="mr-2 h-4 w-4" />
                    Limpar
                  </Button>
                </div>
                <canvas
                  ref={gestorSignatureCanvasRef}
                  width={960}
                  height={220}
                  className="h-48 w-full touch-none rounded-lg border bg-white"
                  onPointerDown={(event) => startDrawingSignature("gestor", event)}
                  onPointerMove={(event) => drawSignature("gestor", event)}
                  onPointerUp={(event) => stopDrawingSignature("gestor", event)}
                  onPointerLeave={(event) => stopDrawingSignature("gestor", event)}
                  onPointerCancel={(event) => stopDrawingSignature("gestor", event)}
                />
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => navigate("/")}>
                Cancelar
              </Button>
              <Button
                type="button"
                className="bg-emerald-700 hover:bg-emerald-800"
                onClick={handleSave}
                disabled={isSaving || processingPhotos > 0}
              >
                <Save className="mr-2 h-4 w-4" />
                {processingPhotos > 0
                  ? "Processando foto..."
                  : isSaving
                    ? "Enviando..."
                    : "Enviar Inspe\u00e7\u00e3o Ambiental"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
      <AddOperatorDialog
        open={Boolean(personDialogTarget)}
        onOpenChange={(open) => {
          if (!open) setPersonDialogTarget(null);
        }}
        onAddOperator={handleAddPerson}
        sectors={sectorOptions}
      />
    </div>
  );
};

export default InspecaoAmbiental;
