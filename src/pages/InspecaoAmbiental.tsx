import React, { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, ClipboardCheck, Eraser, Leaf, Save, Signature } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

const STORAGE_KEY = "checklistafm-inspecoes-ambientais";

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

const normalizeStoredList = (raw: string | null) => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const InspecaoAmbiental = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { sectors, operators } = useSupabaseData(["sectors", "operators"]);
  const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);

  const [realizadoPor, setRealizadoPor] = useState("");
  const [dataInspecao, setDataInspecao] = useState(getTodayLocalDateKey() || "");
  const [acompanhadoPor, setAcompanhadoPor] = useState("");
  const [setor, setSetor] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [answers, setAnswers] = useState<Record<string, EnvironmentalAnswer>>(
    () =>
      Object.fromEntries(
        ENVIRONMENTAL_QUESTIONS.map((question) => [question.id, question.expected]),
      ),
  );
  const [evidences, setEvidences] = useState<Record<string, EnvironmentalEvidence>>({});
  const [signature, setSignature] = useState("");
  const [isSaving, setIsSaving] = useState(false);

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

    const dataUrl = await fileToDataUrl(file);
    updateEvidence(questionId, {
      foto: {
        name: file.name,
        size: file.size,
        type: file.type,
        data_url: dataUrl,
      },
    });
  };

  const getCanvasPosition = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  };

  const startDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = signatureCanvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const { x, y } = getCanvasPosition(event);
    isDrawingRef.current = true;
    canvas.setPointerCapture(event.pointerId);
    context.beginPath();
    context.moveTo(x, y);
  };

  const drawSignature = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = signatureCanvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const { x, y } = getCanvasPosition(event);
    context.lineWidth = 2;
    context.lineCap = "round";
    context.strokeStyle = "#0f172a";
    context.lineTo(x, y);
    context.stroke();
    setSignature(canvas.toDataURL("image/png"));
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
  };

  const clearSignature = () => {
    const canvas = signatureCanvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    setSignature("");
  };

  const handleSave = () => {
    if (!realizadoPor.trim() || !dataInspecao || !setor.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha realizado por, data da inspeção e setor.",
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

    try {
      setIsSaving(true);
      const existing = normalizeStoredList(localStorage.getItem(STORAGE_KEY));
      const nextNumber =
        existing.reduce((max, item) => Math.max(max, Number(item?.numero_inspecao) || 0), 0) + 1;
      const now = new Date().toISOString();
      const payload = {
        id: `ambiental-${Date.now()}`,
        numero_inspecao: nextNumber,
        created_at: now,
        updated_at: now,
        realizado_por: realizadoPor.trim(),
        data_inspecao: dataInspecao,
        acompanhado_por: acompanhadoPor.trim(),
        setor: setor.trim(),
        observacoes: observacoes.trim(),
        respostas: ENVIRONMENTAL_QUESTIONS.map((question) => ({
          codigo: question.id,
          numero: String(question.number).padStart(2, "0"),
          pergunta: question.text,
          resposta: answers[question.id],
          resposta_esperada: question.expected,
          irregular: answers[question.id] !== "N/A" && answers[question.id] !== question.expected,
          evidencia: evidences[question.id] || { comentario: "", foto: null },
        })),
        assinatura: signature,
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify([payload, ...existing]));
      toast({
        title: "Inspeção ambiental salva",
        description: `Registro ambiental ${String(nextNumber).padStart(3, "0")} salvo neste dispositivo.`,
      });
      navigate("/");
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
              <Select value={realizadoPor} onValueChange={setRealizadoPor}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar responsável" />
                </SelectTrigger>
                <SelectContent>
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
              <Label>Data da inspeção *</Label>
              <Input type="date" value={dataInspecao} onChange={(event) => setDataInspecao(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Acompanhado por</Label>
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
                        <p className="mt-1 text-xs text-muted-foreground">
                          Padrão esperado: {question.expected}
                        </p>
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
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={(event) => void handleEvidenceFile(question.id, event.target.files?.[0] || null)}
                          />
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
            <CardTitle>Observações e Assinatura</CardTitle>
            <CardDescription>Finalize com observações gerais e assinatura do responsável.</CardDescription>
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
            <div className="rounded-xl border bg-white p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <Label className="flex items-center gap-2">
                  <Signature className="h-4 w-4" />
                  Assinatura
                </Label>
                <Button type="button" variant="outline" size="sm" onClick={clearSignature}>
                  <Eraser className="mr-2 h-4 w-4" />
                  Limpar assinatura
                </Button>
              </div>
              <canvas
                ref={signatureCanvasRef}
                width={960}
                height={220}
                className="h-48 w-full touch-none rounded-lg border bg-white"
                onPointerDown={startDrawing}
                onPointerMove={drawSignature}
                onPointerUp={stopDrawing}
                onPointerLeave={stopDrawing}
              />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => navigate("/")}>
                Cancelar
              </Button>
              <Button
                type="button"
                className="bg-emerald-700 hover:bg-emerald-800"
                onClick={handleSave}
                disabled={isSaving}
              >
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? "Salvando..." : "Salvar Inspeção Ambiental"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default InspecaoAmbiental;
