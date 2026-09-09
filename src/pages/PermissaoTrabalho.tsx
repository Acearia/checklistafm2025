import { useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, ClipboardCheck, Plus, Save, ShieldCheck, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import SignatureCanvas from "@/components/SignatureCanvas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useSupabaseData } from "@/hooks/useSupabaseData";
import { isDeviceOnline } from "@/lib/connectivity";
import {
  CONDITIONAL_PERMIT_QUESTIONS,
  GENERAL_PERMIT_QUESTIONS,
  WORK_PERMIT_CONTROLS,
  WORK_PERMIT_RISKS,
  WORK_PERMIT_SERVICE_TYPES,
  type PermitQuestion,
  type WorkPermitAnswer,
  type WorkPermitExecutor,
  type WorkPermitRecord,
  upsertLocalWorkPermit,
  workPermitService,
} from "@/lib/workPermit";

const today = () => new Date().toLocaleDateString("en-CA");
const currentTime = () => new Date().toTimeString().slice(0, 5);
const makeId = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const newExecutor = (): WorkPermitExecutor => ({
  id: makeId(),
  nome: "",
  funcao: "",
  data: today(),
  hora: currentTime(),
  assinatura: null,
});

const toggleValue = (values: string[], value: string) =>
  values.includes(value) ? values.filter((item) => item !== value) : [...values, value];

const ChoiceGrid = ({
  title,
  values,
  selected,
  onChange,
}: {
  title: string;
  values: readonly string[];
  selected: string[];
  onChange: (values: string[]) => void;
}) => (
  <Card>
    <CardHeader className="pb-3">
      <CardTitle className="text-xl">{title}</CardTitle>
    </CardHeader>
    <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {values.map((value) => (
        <label key={value} className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 hover:bg-slate-50 dark:hover:bg-slate-900">
          <Checkbox
            checked={selected.includes(value)}
            onCheckedChange={() => onChange(toggleValue(selected, value))}
          />
          <span className="text-sm leading-5">{value}</span>
        </label>
      ))}
    </CardContent>
  </Card>
);

const QuestionList = ({
  title,
  questions,
  answers,
  onAnswer,
}: {
  title: string;
  questions: PermitQuestion[];
  answers: Record<string, WorkPermitAnswer>;
  onAnswer: (id: string, value: WorkPermitAnswer) => void;
}) => (
  <Card>
    <CardHeader className="pb-3">
      <CardTitle className="text-xl">{title}</CardTitle>
      <CardDescription>Marque Sim quando a condição estiver atendida ou N/A quando não se aplicar.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-3">
      {questions.map((question, index) => (
        <div key={question.id} className="grid gap-3 rounded-lg border p-4 md:grid-cols-[1fr_auto] md:items-center">
          <p className="font-medium"><span className="mr-2 text-muted-foreground">{index + 1}.</span>{question.text}</p>
          <div className="flex gap-2">
            {(["Sim", "N/A"] as WorkPermitAnswer[]).map((option) => (
              <Button
                key={option}
                type="button"
                variant={answers[question.id] === option ? "default" : "outline"}
                className="min-w-20"
                onClick={() => onAnswer(question.id, option)}
              >
                {option}
              </Button>
            ))}
          </div>
        </div>
      ))}
    </CardContent>
  </Card>
);

const PermissaoTrabalho = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { sectors } = useSupabaseData(["sectors"]);
  const [empresa, setEmpresa] = useState("");
  const [setor, setSetor] = useState("");
  const [dataPermissao, setDataPermissao] = useState(today());
  const [horaPermissao, setHoraPermissao] = useState(currentTime());
  const [descricao, setDescricao] = useState("");
  const [tipos, setTipos] = useState<string[]>([]);
  const [detalhesTipo, setDetalhesTipo] = useState<Record<string, string | string[]>>({});
  const [riscos, setRiscos] = useState<string[]>([]);
  const [riscosOutros, setRiscosOutros] = useState("");
  const [controles, setControles] = useState<string[]>([]);
  const [controlesOutros, setControlesOutros] = useState("");
  const [procedimentoAuxiliar, setProcedimentoAuxiliar] = useState("");
  const [respostas, setRespostas] = useState<Record<string, WorkPermitAnswer>>({});
  const [detalhesRespostas, setDetalhesRespostas] = useState<Record<string, string | string[]>>({});
  const [executores, setExecutores] = useState<WorkPermitExecutor[]>([newExecutor()]);
  const [emissorNome, setEmissorNome] = useState("");
  const [emissorAssinatura, setEmissorAssinatura] = useState<string | null>(null);
  const [verificadorNome, setVerificadorNome] = useState("");
  const [verificadorAssinatura, setVerificadorAssinatura] = useState<string | null>(null);
  const [status, setStatus] = useState("Aberta");
  const [observacoesEmissor, setObservacoesEmissor] = useState("");
  const [observacoesVerificador, setObservacoesVerificador] = useState("");
  const [encerramentoEmissor, setEncerramentoEmissor] = useState({ nome: "", assinatura: null as string | null });
  const [encerramentoExecutor, setEncerramentoExecutor] = useState({ nome: "", assinatura: null as string | null });
  const [saving, setSaving] = useState(false);
  const [savedNumber, setSavedNumber] = useState<number | null>(null);

  const sectorNames = useMemo(() => {
    const names = new Set((sectors as Array<{ name?: unknown }>).map((item) => String(item?.name || "").trim()).filter(Boolean));
    return Array.from(names).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [sectors]);

  const conditionalGroups = useMemo(() => {
    const groups: { key: string; title: string; questions: PermitQuestion[] }[] = [];
    if (tipos.includes("psq") || tipos.includes("area_classificada")) groups.push({ key: "psq", title: "PSQ - Serviço a quente / área classificada", questions: CONDITIONAL_PERMIT_QUESTIONS.psq });
    if (tipos.includes("altura")) groups.push({ key: "altura", title: "LVTA - Trabalho em altura", questions: CONDITIONAL_PERMIT_QUESTIONS.altura });
    if (tipos.includes("carga")) groups.push({ key: "carga", title: "LVMC - Movimentação de carga", questions: CONDITIONAL_PERMIT_QUESTIONS.carga });
    if (tipos.includes("eletrico")) groups.push({ key: "eletrico", title: "PSE - Serviço elétrico", questions: CONDITIONAL_PERMIT_QUESTIONS.eletrico });
    if (tipos.includes("escavacao")) groups.push({ key: "escavacao", title: "LVE - Escavação", questions: CONDITIONAL_PERMIT_QUESTIONS.escavacao });
    return groups;
  }, [tipos]);

  const visibleQuestions = useMemo(
    () => [...GENERAL_PERMIT_QUESTIONS, ...conditionalGroups.flatMap((group) => group.questions)],
    [conditionalGroups],
  );

  const updateExecutor = (id: string, values: Partial<WorkPermitExecutor>) => {
    setExecutores((current) => current.map((item) => item.id === id ? { ...item, ...values } : item));
  };

  const updateDetail = (key: string, value: string | string[]) =>
    setDetalhesTipo((current) => ({ ...current, [key]: value }));

  const validate = () => {
    if (!empresa.trim() || !setor || !dataPermissao || !horaPermissao || !descricao.trim()) return "Preencha empresa, setor, data, hora e descrição do serviço.";
    if (tipos.length === 0) return "Selecione pelo menos um tipo de serviço.";
    const unanswered = visibleQuestions.find((question) => !respostas[question.id]);
    if (unanswered) return `Responda a verificação: ${unanswered.text}`;
    const validExecutors = executores.filter((item) => item.nome.trim() || item.funcao.trim() || item.assinatura);
    if (validExecutors.length === 0 || validExecutors.some((item) => !item.nome.trim() || !item.funcao.trim() || !item.assinatura)) return "Informe nome, função e assinatura de cada executor.";
    if (!emissorNome.trim() || !emissorAssinatura) return "Informe o emissor e recolha sua assinatura.";
    if (!verificadorNome.trim() || !verificadorAssinatura) return "Informe o verificador e recolha sua assinatura.";
    if (status !== "Aberta" && (!encerramentoEmissor.nome.trim() || !encerramentoEmissor.assinatura || !encerramentoExecutor.nome.trim() || !encerramentoExecutor.assinatura)) return "Recolha as assinaturas do emissor e do executor responsável pelo encerramento.";
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      toast({ title: "Permissão incompleta", description: validationError, variant: "destructive" });
      return;
    }

    const record: WorkPermitRecord = {
      id: makeId(), empresa: empresa.trim(), setor, data_permissao: dataPermissao,
      hora_permissao: horaPermissao, descricao_servico: descricao.trim(), tipos_servico: tipos,
      detalhes_tipo: detalhesTipo, riscos, riscos_outros: riscosOutros.trim(), medidas_controle: controles,
      medidas_outros: controlesOutros.trim(), procedimento_auxiliar: procedimentoAuxiliar.trim(),
      respostas, detalhes_respostas: detalhesRespostas,
      executores: executores.filter((item) => item.nome.trim()),
      emissor_nome: emissorNome.trim(), emissor_assinatura: emissorAssinatura,
      emissor_data: today(), emissor_hora: currentTime(),
      verificador_nome: verificadorNome.trim(), verificador_assinatura: verificadorAssinatura,
      verificador_data: today(), verificador_hora: currentTime(), status,
      encerramento_emissor: status === "Aberta" ? {} : { ...encerramentoEmissor, data: today(), hora: currentTime() },
      encerramento_executor: status === "Aberta" ? {} : { ...encerramentoExecutor, data: today(), hora: currentTime() },
      observacoes_emissor: observacoesEmissor.trim(), observacoes_verificador: observacoesVerificador.trim(),
      created_at: new Date().toISOString(),
    };

    setSaving(true);
    try {
      if (!(await isDeviceOnline())) throw new Error("offline");
      const saved = await workPermitService.create(record);
      setSavedNumber(saved.numero_permissao || null);
      toast({ title: "Permissão enviada", description: `Permissão nº ${String(saved.numero_permissao || "").padStart(3, "0")} salva com sucesso.` });
    } catch (error) {
      upsertLocalWorkPermit(record);
      setSavedNumber(0);
      toast({ title: "Permissão salva no aparelho", description: "Ela será enviada automaticamente quando a conexão voltar." });
    } finally {
      setSaving(false);
    }
  };

  if (savedNumber !== null) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-emerald-50 p-4">
        <Card className="w-full max-w-lg border-emerald-200 text-center">
          <CardContent className="space-y-4 pt-8">
            <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-600" />
            <h1 className="text-2xl font-bold">Permissão registrada</h1>
            <p className="text-muted-foreground">{savedNumber ? `Permissão nº ${String(savedNumber).padStart(3, "0")}.` : "Registro guardado para sincronização automática."}</p>
            <Button onClick={() => navigate("/")}>Voltar ao início</Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-10 dark:bg-slate-950">
      <header className="bg-gradient-to-r from-orange-800 via-red-800 to-slate-900 text-white shadow-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-5">
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-white/15 p-3"><ShieldCheck className="h-7 w-7" /></span>
            <div><h1 className="text-2xl font-bold">Permissão de Trabalho</h1><p className="text-sm text-orange-100">Liberação e controle seguro da execução do serviço.</p></div>
          </div>
          <Button variant="outline" className="border-white/50 bg-white/10 text-white hover:bg-white/20" onClick={() => navigate("/")}><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-5 px-4 py-6">
        <Card className="border-orange-200">
          <CardHeader><CardTitle className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-orange-700" />Dados da permissão</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div><Label>Empresa responsável *</Label><Input value={empresa} onChange={(e) => setEmpresa(e.target.value)} className="mt-1" /></div>
            <div><Label>Setor *</Label><select value={setor} onChange={(e) => setSetor(e.target.value)} className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="">Selecionar setor</option>{sectorNames.map((name) => <option key={name}>{name}</option>)}</select></div>
            <div><Label>Data *</Label><Input type="date" value={dataPermissao} onChange={(e) => setDataPermissao(e.target.value)} className="mt-1" /></div>
            <div><Label>Hora *</Label><Input type="time" value={horaPermissao} onChange={(e) => setHoraPermissao(e.target.value)} className="mt-1" /></div>
            <div className="md:col-span-2"><Label>Descrição do serviço *</Label><Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} className="mt-1 min-h-24" /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Tipo de serviço</CardTitle><CardDescription>Selecione todos os tipos envolvidos. As verificações específicas serão abertas automaticamente.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              {WORK_PERMIT_SERVICE_TYPES.map((item) => (
                <label key={item.id} className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 hover:bg-orange-50 dark:hover:bg-slate-900">
                  <Checkbox checked={tipos.includes(item.id)} onCheckedChange={() => setTipos(toggleValue(tipos, item.id))} />
                  <span><strong>{item.label}</strong>{item.code && <small className="ml-2 rounded bg-orange-100 px-2 py-0.5 text-orange-800">{item.code}</small>}</span>
                </label>
              ))}
            </div>
            {tipos.includes("altura") && <div className="space-y-2"><Label>Equipamento de trabalho em altura</Label><div className="flex flex-wrap gap-2">{["Andaime", "Escada", "Plataforma elevatória", "Outros"].map((value) => { const selected = Array.isArray(detalhesTipo.altura_equipamento) ? detalhesTipo.altura_equipamento as string[] : []; return <label key={value} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"><Checkbox checked={selected.includes(value)} onCheckedChange={() => updateDetail("altura_equipamento", toggleValue(selected, value))} />{value}</label>; })}</div></div>}
            {tipos.includes("carga") && <div className="grid gap-3 md:grid-cols-2"><div className="space-y-2"><Label>Equipamento de movimentação</Label><div className="flex flex-wrap gap-2">{["Guindauto", "Guindaste", "Empilhadeira", "Ponte Rolante", "Talha", "Outros"].map((value) => { const selected = Array.isArray(detalhesTipo.carga_equipamento) ? detalhesTipo.carga_equipamento as string[] : []; return <label key={value} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"><Checkbox checked={selected.includes(value)} onCheckedChange={() => updateDetail("carga_equipamento", toggleValue(selected, value))} />{value}</label>; })}</div></div><div><Label>Peso estimado da carga (kg)</Label><Input type="number" value={String(detalhesTipo.carga_peso || "")} onChange={(e) => updateDetail("carga_peso", e.target.value)} className="mt-1" /></div></div>}
            {tipos.includes("escavacao") && <div className="grid gap-3 md:grid-cols-3"><div className="space-y-2"><Label>Tipo da escavação</Label><div className="flex gap-2">{["Manual", "Por máquina"].map((value) => { const selected = Array.isArray(detalhesTipo.escavacao_tipo) ? detalhesTipo.escavacao_tipo as string[] : []; return <label key={value} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"><Checkbox checked={selected.includes(value)} onCheckedChange={() => updateDetail("escavacao_tipo", toggleValue(selected, value))} />{value}</label>; })}</div></div><div><Label>Profundidade (m)</Label><Input type="number" step="0.1" value={String(detalhesTipo.escavacao_profundidade || "")} onChange={(e) => updateDetail("escavacao_profundidade", e.target.value)} className="mt-1" /></div><div><Label>Técnico legalmente habilitado</Label><Input value={String(detalhesTipo.escavacao_tecnico || "")} onChange={(e) => updateDetail("escavacao_tecnico", e.target.value)} className="mt-1" /></div></div>}
            {tipos.includes("outros") && <div><Label>Especificar outro trabalho</Label><Input value={String(detalhesTipo.outros || "")} onChange={(e) => updateDetail("outros", e.target.value)} className="mt-1" /></div>}
          </CardContent>
        </Card>

        <ChoiceGrid title="Identificação de riscos" values={WORK_PERMIT_RISKS} selected={riscos} onChange={setRiscos} />
        {riscos.includes("Outros") && <Input value={riscosOutros} onChange={(e) => setRiscosOutros(e.target.value)} placeholder="Descreva os outros riscos" />}
        <ChoiceGrid title="Medidas de controle" values={WORK_PERMIT_CONTROLS} selected={controles} onChange={setControles} />
        <div className="grid gap-3 md:grid-cols-2">
          {controles.includes("Procedimento auxiliar") && <Input value={procedimentoAuxiliar} onChange={(e) => setProcedimentoAuxiliar(e.target.value)} placeholder="Identifique o procedimento auxiliar" />}
          {controles.includes("Outros") && <Input value={controlesOutros} onChange={(e) => setControlesOutros(e.target.value)} placeholder="Descreva outras medidas" />}
        </div>

        <QuestionList title="Lista geral de verificação" questions={GENERAL_PERMIT_QUESTIONS} answers={respostas} onAnswer={(id, value) => setRespostas((current) => ({ ...current, [id]: value }))} />
        {(tipos.includes("psq") || tipos.includes("area_classificada")) && <Card><CardContent className="pt-6"><Label>Tipo e quantidade do equipamento de combate a incêndio</Label><Input value={String(detalhesRespostas.psq_equipamento_incendio || "")} onChange={(e) => setDetalhesRespostas((current) => ({ ...current, psq_equipamento_incendio: e.target.value }))} className="mt-1" /></CardContent></Card>}
        {conditionalGroups.map((group) => <QuestionList key={group.key} title={group.title} questions={group.questions} answers={respostas} onAnswer={(id, value) => setRespostas((current) => ({ ...current, [id]: value }))} />)}

        <Card>
          <CardHeader className="flex-row items-center justify-between"><div><CardTitle>Executores</CardTitle><CardDescription>Li e compreendi os riscos e as medidas de controle desta permissão.</CardDescription></div><Button type="button" variant="outline" disabled={executores.length >= 8} onClick={() => setExecutores((current) => [...current, newExecutor()])}><Plus className="mr-2 h-4 w-4" />Adicionar</Button></CardHeader>
          <CardContent className="space-y-5">
            {executores.map((executor, index) => (
              <div key={executor.id} className="rounded-xl border p-4">
                <div className="mb-3 flex items-center justify-between"><strong>Executor {index + 1}</strong>{executores.length > 1 && <Button type="button" variant="ghost" className="text-red-600" onClick={() => setExecutores((current) => current.filter((item) => item.id !== executor.id))}><Trash2 className="h-4 w-4" /></Button>}</div>
                <div className="grid gap-3 md:grid-cols-2"><div><Label>Nome *</Label><Input value={executor.nome} onChange={(e) => updateExecutor(executor.id, { nome: e.target.value })} className="mt-1" /></div><div><Label>Função *</Label><Input value={executor.funcao} onChange={(e) => updateExecutor(executor.id, { funcao: e.target.value })} className="mt-1" /></div></div>
                <div className="mt-4"><SignatureCanvas onSignatureChange={(signature) => updateExecutor(executor.id, { assinatura: signature })} /></div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Autorização</CardTitle><CardDescription>Assinaturas do emissor e do verificador da permissão.</CardDescription></CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            <div><Label>Emissor *</Label><Input value={emissorNome} onChange={(e) => setEmissorNome(e.target.value)} className="mb-3 mt-1" /><SignatureCanvas onSignatureChange={setEmissorAssinatura} /></div>
            <div><Label>Verificador *</Label><Input value={verificadorNome} onChange={(e) => setVerificadorNome(e.target.value)} className="mb-3 mt-1" /><SignatureCanvas onSignatureChange={setVerificadorAssinatura} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Observações e situação</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div><Label>Observações do emissor</Label><Textarea value={observacoesEmissor} onChange={(e) => setObservacoesEmissor(e.target.value)} className="mt-1" /></div>
            <div><Label>Observações do verificador</Label><Textarea value={observacoesVerificador} onChange={(e) => setObservacoesVerificador(e.target.value)} className="mt-1" /></div>
            <div className="md:col-span-2"><Label>Situação</Label><select value={status} onChange={(e) => setStatus(e.target.value)} className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"><option>Aberta</option><option>Não iniciado</option><option>Iniciado mas não concluído</option><option>Iniciado e transferido para o próximo turno</option><option>Concluído</option><option>Cancelado</option></select></div>
          </CardContent>
        </Card>

        {status !== "Aberta" && <Card className="border-emerald-200"><CardHeader><CardTitle>Encerramento da permissão</CardTitle><CardDescription>Confirme a situação final e que a área foi deixada em condições seguras.</CardDescription></CardHeader><CardContent className="grid gap-6 md:grid-cols-2"><div><Label>Emissor *</Label><Input value={encerramentoEmissor.nome} onChange={(e) => setEncerramentoEmissor((current) => ({ ...current, nome: e.target.value }))} className="mb-3 mt-1" /><SignatureCanvas onSignatureChange={(assinatura) => setEncerramentoEmissor((current) => ({ ...current, assinatura }))} /></div><div><Label>Executor responsável *</Label><Input value={encerramentoExecutor.nome} onChange={(e) => setEncerramentoExecutor((current) => ({ ...current, nome: e.target.value }))} className="mb-3 mt-1" /><SignatureCanvas onSignatureChange={(assinatura) => setEncerramentoExecutor((current) => ({ ...current, assinatura }))} /></div></CardContent></Card>}

        <Button size="lg" className="w-full bg-orange-800 text-white hover:bg-orange-900" disabled={saving} onClick={() => void handleSubmit()}><Save className="mr-2 h-5 w-5" />{saving ? "Salvando..." : "Emitir permissão de trabalho"}</Button>
        <p className="text-center text-xs text-muted-foreground">A permissão possui validade máxima de 24 horas e perde a validade em situações de emergência.</p>
      </main>
    </div>
  );
};

export default PermissaoTrabalho;
