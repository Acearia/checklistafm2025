import React, { useMemo, useState } from "react";
import { format } from "date-fns";
import { ClipboardList, Upload } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useSupabaseData } from "@/hooks/useSupabaseData";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

type SignatureKey = "ass_tst" | "ass_gestor" | "ass_acomp";

interface QuestionItem {
  id: string;
  numero: string;
  texto: string;
}

interface AttachmentMeta {
  name: string;
  size: number;
  type: string;
}

interface QuestionResponse {
  codigo: string;
  numero: string;
  pergunta: string;
  resposta: "Sim" | "Não";
  comentario: string;
  foto: AttachmentMeta | null;
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

interface QuestionState {
  answer: boolean;
  comment: string;
  photo: File | null;
}

const STORAGE_KEY = "checklistafm-regras-de-ouro";
const STORAGE_EVENT = "checklistafm-regras-de-ouro-updated";
const COUNTER_KEY = "checklistafm-regras-de-ouro-counter";
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

const createInitialResponses = (): Record<string, QuestionState> =>
  Object.fromEntries(
    QUESTION_ITEMS.map((question) => [
      question.id,
      {
        answer: true,
        comment: "",
        photo: null,
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

  const setorOptions = useMemo(
    () => dedupeSorted(sectors.map((item: any) => normalizeText(item?.name))),
    [sectors],
  );

  const liderOptions = useMemo(
    () => dedupeSorted(leaders.map((item: any) => normalizeText(item?.name))),
    [leaders],
  );

  const tecnicoInvestigadorOptions = useMemo(() => {
    const allowedNames = new Map(
      REGRAS_DE_OURO_TECNICOS.map((name) => [normalizePersonKey(name), name]),
    );

    const fromLeaders = dedupeSorted(leaders.map((item: any) => normalizeText(item?.name)))
      .map((name) => allowedNames.get(normalizePersonKey(name)))
      .filter((name): name is string => Boolean(name));

    const resolved = Array.from(new Set(fromLeaders));
    return resolved.length > 0 ? resolved : [...REGRAS_DE_OURO_TECNICOS];
  }, [leaders]);

  const acompanhanteOptions = useMemo(
    () => dedupeSorted(operators.map((item: any) => normalizeText(item?.name))),
    [operators],
  );

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

  const validateForm = () => {
    if (!titulo.trim()) return "Preencha o Título.";
    if (!setor.trim()) return "Selecione o Setor.";
    if (!gestor.trim()) return "Selecione o Gestor.";
    if (!tecnicoSeg.trim()) return "Selecione o Técnico.";
    if (!acompanhante.trim()) return "Selecione o Acompanhante.";
    if (!signatures.ass_tst) return "Registre a assinatura do Técnico de Segurança.";
    if (!signatures.ass_gestor) return "Registre a assinatura do Gestor.";
    if (!signatures.ass_acomp) return "Registre a assinatura do Acompanhante.";

    for (const item of QUESTION_ITEMS) {
      const response = responses[item.id];
      if (!response) return `Resposta ausente em ${item.id}.`;
      if (!response.answer && !response.comment.trim()) {
        return `Preencha o comentário do item ${item.id} quando a resposta for NÃO.`;
      }
    }

    return null;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const validationError = validateForm();
    if (validationError) {
      toast({
        title: "Formulário incompleto",
        description: validationError,
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      const currentCounter = getCounterValue();
      const nextCounter = currentCounter + 1;
      localStorage.setItem(COUNTER_KEY, String(nextCounter));

      const rawStored = localStorage.getItem(STORAGE_KEY) || "[]";
      const parsed = JSON.parse(rawStored);
      const existingRecords = Array.isArray(parsed) ? parsed : [];

      const payload: InvestigacaoChecklistRecord = {
        id:
          typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `${Date.now()}`,
        numero_inspecao: nextCounter,
        created_at: new Date().toISOString(),
        titulo: titulo.trim(),
        setor,
        gestor,
        tecnico_seg: tecnicoSeg,
        acompanhante,
        respostas: QUESTION_ITEMS.map((item) => {
          const current = responses[item.id];
          return {
            codigo: item.id,
            numero: item.numero,
            pergunta: item.texto,
            resposta: current.answer ? "Sim" : "Não",
            comentario: current.comment.trim(),
            foto: current.photo
              ? {
                  name: current.photo.name,
                  size: current.photo.size,
                  type: current.photo.type,
                }
              : null,
          };
        }),
        ass_tst: signatures.ass_tst || "",
        ass_gestor: signatures.ass_gestor || "",
        ass_acomp: signatures.ass_acomp || "",
        anexos: attachments.map((file) => ({
          name: file.name,
          size: file.size,
          type: file.type,
        })),
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify([payload, ...existingRecords]));
      window.dispatchEvent(new Event(STORAGE_EVENT));

      toast({
        title: "Regra de Ouro registrada",
        description: `Registro ${formatInspectionNumber(nextCounter)} salvo com sucesso.`,
      });

      setTitulo("");
      setSetor("");
      setGestor("");
      setTecnicoSeg("");
      setAcompanhante("");
      setResponses(createInitialResponses());
      setSignatures(createInitialSignatures());
      setAttachments([]);
      setPreviewNumber(nextCounter + 1);
      setTimeout(() => {
        navigate("/");
      }, 800);
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
    <div className="mx-auto w-full max-w-5xl space-y-6 pb-12">
      <Card className="border-blue-100 bg-gradient-to-br from-white via-white to-blue-50/40">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-blue-700 p-2 text-white">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-2xl text-blue-900">Regras de Ouro</CardTitle>
              <CardDescription>
                Preenchimento no padrão de inspeção: respostas diretas SIM/NÃO, com comentários e assinaturas.
              </CardDescription>
              <p className="text-sm text-gray-600">Progresso: {completionPercent}%</p>
            </div>
          </div>
        </CardHeader>
      </Card>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Dados da Regra de Ouro</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
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
              <Select value={setor || undefined} onValueChange={setSetor}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar o setor" />
                </SelectTrigger>
                <SelectContent>
                  {setorOptions.length === 0 ? (
                    <SelectItem value="__sem_setor" disabled>
                      Nenhum setor encontrado
                    </SelectItem>
                  ) : (
                    setorOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Gestor *</Label>
              <Select value={gestor || undefined} onValueChange={setGestor}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar o Gestor" />
                </SelectTrigger>
                <SelectContent>
                  {liderOptions.length === 0 ? (
                    <SelectItem value="__sem_gestor" disabled>
                      Nenhum gestor encontrado
                    </SelectItem>
                  ) : (
                    liderOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Técnico / Investigador *</Label>
              <Select value={tecnicoSeg || undefined} onValueChange={setTecnicoSeg}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar o Técnico" />
                </SelectTrigger>
                <SelectContent>
                  {tecnicoInvestigadorOptions.length === 0 ? (
                    <SelectItem value="__sem_tecnico" disabled>
                      Nenhum técnico encontrado
                    </SelectItem>
                  ) : (
                    tecnicoInvestigadorOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                Técnicos/Investigadores de Segurança: CELSO PEREIRA, ODAIR NASCIMENTO e JOÃO PAULO.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Acomp. *</Label>
              <Select value={acompanhante || undefined} onValueChange={setAcompanhante}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar o acompanhante" />
                </SelectTrigger>
                <SelectContent>
                  {acompanhanteOptions.length === 0 ? (
                    <SelectItem value="__sem_acomp" disabled>
                      Nenhum acompanhante encontrado
                    </SelectItem>
                  ) : (
                    acompanhanteOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Checklist de Perguntas</CardTitle>
            <CardDescription>
              Responda cada item. Para resposta NÃO, o comentário é obrigatório.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {QUESTION_ITEMS.map((item) => {
              const response = responses[item.id];
              const showExtra = !response.answer || response.comment.trim().length > 0 || Boolean(response.photo);

              return (
                <div key={item.id} className="rounded-lg border border-blue-200 bg-white">
                  <div className="grid items-center gap-3 p-4 md:grid-cols-[90px_1fr_130px]">
                    <div className="text-center">
                      <div className="text-4xl font-bold leading-none text-black">{item.numero}</div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-base font-medium text-blue-950">{item.texto}</p>
                    </div>

                    <div className="flex flex-col items-center justify-center gap-2">
                      <span
                        className={cn(
                          "text-lg font-bold",
                          response.answer ? "text-green-600" : "text-red-600",
                        )}
                      >
                        {response.answer ? "SIM" : "NÃO"}
                      </span>
                      <Switch
                        checked={response.answer}
                        onCheckedChange={(checked) => updateQuestion(item.id, { answer: checked })}
                      />
                    </div>
                  </div>

                  {showExtra && (
                    <div className="grid gap-3 border-t border-blue-100 px-4 pb-4 pt-3 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor={`comentario-${item.id}`}>Comentários ({item.id})</Label>
                        <Textarea
                          id={`comentario-${item.id}`}
                          value={response.comment}
                          onChange={(event) => updateQuestion(item.id, { comment: event.target.value })}
                          placeholder={`Comentários do requisito ${item.id}`}
                          rows={3}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`foto-${item.id}`}>foto_{item.id}</Label>
                        <Input
                          id={`foto-${item.id}`}
                          type="file"
                          accept="image/*"
                          onChange={(event) =>
                            updateQuestion(item.id, {
                              photo: event.target.files?.[0] || null,
                            })
                          }
                        />
                        {response.photo && (
                          <p className="text-xs text-gray-500">Arquivo: {response.photo.name}</p>
                        )}
                      </div>
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
          <CardContent className="grid gap-4 md:grid-cols-3">
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
          <Button type="submit" className="min-w-[220px]" disabled={isSaving}>
            <Upload className="mr-2 h-4 w-4" />
            {isSaving ? "Salvando..." : "Enviar Regra de Ouro"}
          </Button>
        </div>
      </form>

      <Dialog open={Boolean(signatureDialog)} onOpenChange={(open) => !open && setSignatureDialog(null)}>
        <DialogContent className="sm:max-w-2xl">
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
