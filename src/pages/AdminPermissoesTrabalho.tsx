import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useSupabaseData } from "@/hooks/useSupabaseData";
import { canDeleteAdminRecords } from "@/lib/adminSession";
import {
  GENERAL_PERMIT_QUESTIONS,
  CONDITIONAL_PERMIT_QUESTIONS,
  WORK_PERMIT_SERVICE_TYPES,
  WORK_PERMIT_STORAGE_EVENT,
  type WorkPermitRecord,
  readLocalWorkPermits,
  removeLocalWorkPermits,
  workPermitService,
} from "@/lib/workPermit";

const normalize = (value: unknown) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const formatNumber = (value?: number) => String(value || 0).padStart(3, "0");
const formatDate = (value?: string) => {
  if (!value) return "N/A";
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
};
const isClosed = (status: string) => ["concluido", "cancelado"].includes(normalize(status));
const isExpired = (record: WorkPermitRecord) => {
  if (isClosed(record.status)) return false;
  const issuedAt = new Date(`${record.data_permissao}T${record.hora_permissao || "00:00"}`);
  return Number.isFinite(issuedAt.getTime()) && Date.now() - issuedAt.getTime() > 24 * 60 * 60 * 1000;
};

const allQuestions = [...GENERAL_PERMIT_QUESTIONS, ...Object.values(CONDITIONAL_PERMIT_QUESTIONS).flat()];
const questionById = new Map(allQuestions.map((item) => [item.id, item.text]));

const DetailBlock = ({ title, values }: { title: string; values: string[] }) => (
  <section className="rounded-lg border p-4">
    <h3 className="mb-2 font-semibold">{title}</h3>
    {values.length ? <div className="flex flex-wrap gap-2">{values.map((value) => <Badge key={value} variant="secondary">{value}</Badge>)}</div> : <p className="text-sm text-muted-foreground">Nenhum item informado.</p>}
  </section>
);

const PermitDetails = ({ permit }: { permit: WorkPermitRecord }) => (
  <div className="space-y-4 text-sm">
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div><span className="text-muted-foreground">Empresa</span><p className="font-medium">{permit.empresa}</p></div>
      <div><span className="text-muted-foreground">Setor</span><p className="font-medium">{permit.setor}</p></div>
      <div><span className="text-muted-foreground">Data e hora</span><p className="font-medium">{formatDate(permit.data_permissao)} {permit.hora_permissao?.slice(0, 5)}</p></div>
      <div><span className="text-muted-foreground">Situação</span><p className="font-medium">{permit.status}</p></div>
    </div>
    <section className="rounded-lg border p-4"><h3 className="mb-1 font-semibold">Descrição do serviço</h3><p className="whitespace-pre-wrap">{permit.descricao_servico}</p></section>
    <DetailBlock title="Tipos de serviço" values={(permit.tipos_servico || []).map((id) => WORK_PERMIT_SERVICE_TYPES.find((item) => item.id === id)?.label || id)} />
    <DetailBlock title="Riscos identificados" values={[...(permit.riscos || []), permit.riscos_outros].filter(Boolean)} />
    <DetailBlock title="Medidas de controle" values={[...(permit.medidas_controle || []), permit.procedimento_auxiliar, permit.medidas_outros].filter(Boolean)} />
    {Object.keys(permit.detalhes_tipo || {}).length > 0 && <section className="rounded-lg border p-4"><h3 className="mb-2 font-semibold">Detalhes técnicos</h3>{Object.entries(permit.detalhes_tipo).map(([key, value]) => <p key={key}><strong>{key.replaceAll("_", " ")}:</strong> {Array.isArray(value) ? value.join(", ") : value}</p>)}</section>}
    <section className="rounded-lg border p-4">
      <h3 className="mb-3 font-semibold">Verificações</h3>
      <div className="space-y-2">
        {Object.entries(permit.respostas || {}).map(([id, answer]) => (
          <div key={id} className="flex items-start justify-between gap-3 border-b pb-2 last:border-0">
            <span>{questionById.get(id) || id}</span><Badge variant={answer === "Sim" ? "secondary" : "outline"}>{answer}</Badge>
          </div>
        ))}
      </div>
    </section>
    <section className="rounded-lg border p-4">
      <h3 className="mb-3 font-semibold">Executores</h3>
      <div className="grid gap-3 md:grid-cols-2">
        {(permit.executores || []).map((executor, index) => (
          <div key={executor.id || index} className="rounded-md bg-muted/50 p-3">
            <p className="font-medium">{executor.nome}</p><p className="text-muted-foreground">{executor.funcao}</p>
            {executor.assinatura && <img src={executor.assinatura} alt={`Assinatura de ${executor.nome}`} className="mt-2 h-24 w-full rounded border bg-white object-contain" />}
          </div>
        ))}
      </div>
    </section>
    <section className="grid gap-3 md:grid-cols-2">
      <div className="rounded-lg border p-4"><h3 className="font-semibold">Emissor</h3><p>{permit.emissor_nome}</p>{permit.emissor_assinatura && <img src={permit.emissor_assinatura} alt="Assinatura do emissor" className="mt-2 h-28 w-full rounded border bg-white object-contain" />}</div>
      <div className="rounded-lg border p-4"><h3 className="font-semibold">Verificador</h3><p>{permit.verificador_nome}</p>{permit.verificador_assinatura && <img src={permit.verificador_assinatura} alt="Assinatura do verificador" className="mt-2 h-28 w-full rounded border bg-white object-contain" />}</div>
    </section>
    {permit.status !== "Aberta" && <section className="grid gap-3 md:grid-cols-2"><div className="rounded-lg border p-4"><h3 className="font-semibold">Encerramento pelo emissor</h3><p>{permit.encerramento_emissor?.nome || "N/A"}</p>{permit.encerramento_emissor?.assinatura && <img src={permit.encerramento_emissor.assinatura} alt="Assinatura de encerramento do emissor" className="mt-2 h-28 w-full rounded border bg-white object-contain" />}</div><div className="rounded-lg border p-4"><h3 className="font-semibold">Encerramento pelo executor</h3><p>{permit.encerramento_executor?.nome || "N/A"}</p>{permit.encerramento_executor?.assinatura && <img src={permit.encerramento_executor.assinatura} alt="Assinatura de encerramento do executor" className="mt-2 h-28 w-full rounded border bg-white object-contain" />}</div></section>}
    {(permit.observacoes_emissor || permit.observacoes_verificador) && <section className="rounded-lg border p-4"><h3 className="mb-2 font-semibold">Observações</h3>{permit.observacoes_emissor && <p><strong>Emissor:</strong> {permit.observacoes_emissor}</p>}{permit.observacoes_verificador && <p><strong>Verificador:</strong> {permit.observacoes_verificador}</p>}</section>}
  </div>
);

const AdminPermissoesTrabalho = () => {
  const { toast } = useToast();
  const { sectors } = useSupabaseData(["sectors"]);
  const [records, setRecords] = useState<WorkPermitRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sector, setSector] = useState("all");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<WorkPermitRecord | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const canDelete = canDeleteAdminRecords();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      let local = readLocalWorkPermits();
      if (local.length) {
        const result = await workPermitService.syncLocalRecords(local);
        removeLocalWorkPermits(result.syncedIds);
        local = readLocalWorkPermits();
      }
      const remote = await workPermitService.getAll();
      const merged = new Map<string, WorkPermitRecord>();
      local.forEach((item) => merged.set(item.id, item));
      remote.forEach((item) => merged.set(item.id, item));
      setRecords(Array.from(merged.values()));
    } catch (error) {
      console.error("Erro ao carregar permissões de trabalho:", error);
      setRecords(readLocalWorkPermits());
      toast({ title: "Não foi possível consultar o banco", description: "Os registros pendentes deste aparelho continuam disponíveis.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadData();
    const refresh = () => void loadData();
    window.addEventListener(WORK_PERMIT_STORAGE_EVENT, refresh);
    window.addEventListener("online", refresh);
    return () => {
      window.removeEventListener(WORK_PERMIT_STORAGE_EVENT, refresh);
      window.removeEventListener("online", refresh);
    };
  }, [loadData]);

  const sectorsList = useMemo(() => {
    const values = new Set<string>();
    (sectors as Array<{ name?: unknown }>).forEach((item) => item?.name && values.add(String(item.name)));
    records.forEach((item) => item.setor && values.add(item.setor));
    return Array.from(values).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [records, sectors]);

  const filtered = useMemo(() => records.filter((record) => {
    const haystack = normalize([record.numero_permissao, record.empresa, record.setor, record.descricao_servico, record.emissor_nome, record.verificador_nome].join(" "));
    return (!search || haystack.includes(normalize(search))) && (!dateFrom || record.data_permissao >= dateFrom) && (!dateTo || record.data_permissao <= dateTo) && (sector === "all" || record.setor === sector) && (status === "all" || (status === "expired" ? isExpired(record) : normalize(record.status) === status));
  }), [dateFrom, dateTo, records, search, sector, status]);

  const summary = useMemo(() => ({
    total: records.length,
    open: records.filter((item) => !isClosed(item.status)).length,
    closed: records.filter((item) => isClosed(item.status)).length,
    expired: records.filter(isExpired).length,
  }), [records]);

  const handleDelete = async (record: WorkPermitRecord) => {
    if (!canDelete || !window.confirm(`Excluir a permissão ${formatNumber(record.numero_permissao)}?`)) return;
    setDeletingId(record.id);
    try {
      await workPermitService.delete(record.id);
      removeLocalWorkPermits([record.id]);
      setRecords((current) => current.filter((item) => item.id !== record.id));
      toast({ title: "Permissão excluída" });
    } catch {
      toast({ title: "Erro ao excluir", description: "Não foi possível remover a permissão.", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3"><div><h1 className="flex items-center gap-2 text-2xl font-bold"><ShieldCheck className="h-6 w-6 text-orange-700" />Permissões de Trabalho</h1><p className="text-sm text-muted-foreground">Consulte liberações, riscos, controles e assinaturas.</p></div><Button variant="outline" onClick={() => void loadData()}><RefreshCw className="mr-2 h-4 w-4" />Atualizar</Button></div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[['Total', summary.total], ['Abertas', summary.open], ['Encerradas', summary.closed], ['Vencidas (24 h)', summary.expired]].map(([label, value]) => <Card key={String(label)}><CardHeader className="pb-2"><CardDescription>{label}</CardDescription><CardTitle>{value}</CardTitle></CardHeader></Card>)}
      </div>
      <Card><CardHeader><CardTitle>Filtros</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-6">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Número, empresa, serviço..." className="md:col-span-2" />
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        <select value={sector} onChange={(e) => setSector(e.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm"><option value="all">Todos os setores</option>{sectorsList.map((item) => <option key={item}>{item}</option>)}</select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm"><option value="all">Todas as situações</option><option value="aberta">Abertas</option><option value="concluido">Concluídas</option><option value="cancelado">Canceladas</option><option value="expired">Vencidas</option></select>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Lista de Permissões</CardTitle><CardDescription>{loading ? "Carregando..." : `Mostrando ${filtered.length} registro(s).`}</CardDescription></CardHeader><CardContent>
        <div className="max-h-[58vh] overflow-auto rounded-md border"><Table><TableHeader className="sticky top-0 z-10 bg-background"><TableRow><TableHead>Nº</TableHead><TableHead>Data</TableHead><TableHead>Empresa</TableHead><TableHead>Setor</TableHead><TableHead>Serviço</TableHead><TableHead>Situação</TableHead><TableHead>Emissor</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader><TableBody>
          {!loading && filtered.length === 0 && <TableRow><TableCell colSpan={8} className="h-28 text-center text-muted-foreground">Nenhuma permissão encontrada.</TableCell></TableRow>}
          {filtered.map((record) => <TableRow key={record.id}><TableCell>{formatNumber(record.numero_permissao)}</TableCell><TableCell className="whitespace-nowrap">{formatDate(record.data_permissao)}<br /><small>{record.hora_permissao?.slice(0, 5)}</small></TableCell><TableCell>{record.empresa}</TableCell><TableCell>{record.setor}</TableCell><TableCell className="max-w-64 truncate">{record.descricao_servico}</TableCell><TableCell><div className="flex gap-1"><Badge variant="secondary">{record.status}</Badge>{isExpired(record) && <Badge variant="destructive">Vencida</Badge>}</div></TableCell><TableCell>{record.emissor_nome}</TableCell><TableCell><div className="flex justify-end gap-1"><Button variant="ghost" size="sm" onClick={() => setSelected(record)}><Eye className="mr-1 h-4 w-4" />Ver</Button>{canDelete && <Button variant="ghost" size="sm" className="text-red-600" disabled={deletingId === record.id} onClick={() => void handleDelete(record)}><Trash2 className="mr-1 h-4 w-4" />Excluir</Button>}</div></TableCell></TableRow>)}
        </TableBody></Table></div>
      </CardContent></Card>
      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}><DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto"><DialogHeader><DialogTitle>Permissão nº {formatNumber(selected?.numero_permissao)}</DialogTitle><DialogDescription>Visualização completa da permissão de trabalho.</DialogDescription></DialogHeader>{selected && <PermitDetails permit={selected} />}</DialogContent></Dialog>
    </div>
  );
};

export default AdminPermissoesTrabalho;
