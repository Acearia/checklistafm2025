import React, { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Download, Eye, RefreshCw } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";

interface AttachmentMeta {
  name: string;
  size: number;
  type: string;
}

interface InvestigacaoRecord {
  id: string;
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
  descricao_detalhada: string;
  observacoes: string;
  investigador: string;
  attachments: AttachmentMeta[];
}

const STORAGE_KEY = "checklistafm-investigacoes-acidente";

const toSafeString = (value: unknown) => (value == null ? "" : String(value));

const formatFileSize = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
};

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
            }))
          : [];

        return {
          id: toSafeString(item.id) || `${Date.now()}-${Math.random()}`,
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

const AdminInvestigacoes = () => {
  const { toast } = useToast();
  const [investigacoes, setInvestigacoes] = useState<InvestigacaoRecord[]>([]);
  const [selected, setSelected] = useState<InvestigacaoRecord | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [tipoFilter, setTipoFilter] = useState("all");
  const [gravidadeFilter, setGravidadeFilter] = useState("all");
  const [investigadorFilter, setInvestigadorFilter] = useState("all");
  const [afastamentoFilter, setAfastamentoFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const loadData = () => {
    setInvestigacoes(parseInvestigacoes());
  };

  useEffect(() => {
    loadData();

    const handleUpdated = () => loadData();
    const handleStorage = (event: StorageEvent) => {
      if (!event.key || event.key === STORAGE_KEY) {
        loadData();
      }
    };

    window.addEventListener("checklistafm-investigacao-acidente-updated", handleUpdated);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("checklistafm-investigacao-acidente-updated", handleUpdated);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const uniqueTipos = useMemo(
    () =>
      Array.from(
        new Set(
          investigacoes
            .map((item) => item.tipo_acidente)
            .filter((value) => value.trim().length > 0),
        ),
      ).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [investigacoes],
  );

  const uniqueGravidades = useMemo(
    () =>
      Array.from(
        new Set(
          investigacoes
            .map((item) => item.gravidade)
            .filter((value) => value.trim().length > 0),
        ),
      ).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [investigacoes],
  );

  const uniqueInvestigadores = useMemo(
    () =>
      Array.from(
        new Set(
          investigacoes
            .map((item) => item.investigador)
            .filter((value) => value.trim().length > 0),
        ),
      ).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [investigacoes],
  );

  const filteredInvestigacoes = useMemo(() => {
    return investigacoes.filter((item) => {
      const matchesTipo = tipoFilter === "all" || item.tipo_acidente === tipoFilter;
      const matchesGravidade = gravidadeFilter === "all" || item.gravidade === gravidadeFilter;
      const matchesInvestigador =
        investigadorFilter === "all" || item.investigador === investigadorFilter;
      const matchesAfastamento =
        afastamentoFilter === "all" ||
        (afastamentoFilter === "com" && item.teve_afastamento) ||
        (afastamentoFilter === "sem" && !item.teve_afastamento);

      const normalizedSearch = searchTerm.trim().toLowerCase();
      const matchesSearch =
        normalizedSearch.length === 0 ||
        item.titulo.toLowerCase().includes(normalizedSearch) ||
        item.nome_acidentado.toLowerCase().includes(normalizedSearch) ||
        item.setor.toLowerCase().includes(normalizedSearch) ||
        item.investigador.toLowerCase().includes(normalizedSearch);

      const dateValue = item.data_ocorrencia || item.created_at;
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
    searchTerm,
    tipoFilter,
  ]);

  const summary = useMemo(() => {
    const total = investigacoes.length;
    const comAfastamento = investigacoes.filter((item) => item.teve_afastamento).length;
    const criticas = investigacoes.filter((item) => item.gravidade === "Critica").length;
    const assinadas = investigacoes.filter((item) => item.investigador.trim().length > 0).length;

    return { total, comAfastamento, criticas, assinadas };
  }, [investigacoes]);

  const handleViewDetails = (record: InvestigacaoRecord) => {
    setSelected(record);
    setDetailsOpen(true);
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
      "investigador",
      "anexos",
    ];

    const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;

    const rows = filteredInvestigacoes.map((item) =>
      [
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
        item.investigador,
        String(item.attachments.length),
      ]
        .map((cell) => escape(cell || ""))
        .join(","),
    );

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
          <Button variant="outline" onClick={loadData}>
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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-7">
            <div>
              <label className="mb-1 block text-sm font-medium">Busca rapida</label>
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Titulo, acidentado, setor..."
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
                        <Button variant="ghost" size="sm" onClick={() => handleViewDetails(item)}>
                          <Eye className="mr-2 h-4 w-4" />
                          Detalhes
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

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-h-[85vh] max-w-4xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>Detalhes da Investigacao</DialogTitle>
            <DialogDescription>
              {selected
                ? `${selected.titulo || "Sem titulo"} - ${formatDateTime(
                    selected.data_ocorrencia || selected.created_at,
                    selected.hora,
                  )}`
                : ""}
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-4 overflow-y-auto pr-1">
              <div className="grid gap-3 md:grid-cols-2">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Identificacao</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    <p><strong>Nome:</strong> {selected.nome_acidentado || "N/A"}</p>
                    <p><strong>Cargo:</strong> {selected.cargo || "N/A"}</p>
                    <p><strong>Setor:</strong> {selected.setor || "N/A"}</p>
                    <p><strong>Turno:</strong> {selected.turno || "N/A"}</p>
                    <p><strong>Tempo empresa:</strong> {selected.tempo_empresa || "N/A"}</p>
                    <p><strong>Tempo funcao:</strong> {selected.tempo_funcao || "N/A"}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Classificacao</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    <p><strong>Classificacao:</strong> {selected.natureza_ocorrencia || "N/A"}</p>
                    <p><strong>Mao de obra:</strong> {selected.mao_de_obra || "N/A"}</p>
                    <p><strong>Tipo:</strong> {selected.tipo_acidente || "N/A"}</p>
                    <p><strong>Gravidade:</strong> {selected.gravidade || "N/A"}</p>
                    <p><strong>Probabilidade:</strong> {selected.probabilidade || "N/A"}</p>
                    <p>
                      <strong>Afastamento:</strong>{" "}
                      {selected.teve_afastamento
                        ? `Sim (${selected.dias_afastamento || "0"} dia(s))`
                        : "Nao"}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Analise e relato</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p><strong>Parte do corpo:</strong> {selected.parte_corpo_atingida || "N/A"}</p>
                  <p><strong>Causa raiz:</strong> {selected.causa_raiz || "N/A"}</p>
                  <p><strong>Descricao detalhada:</strong></p>
                  <p className="rounded border bg-gray-50 p-2 whitespace-pre-wrap">
                    {selected.descricao_detalhada || "N/A"}
                  </p>
                  <p><strong>Observacoes:</strong></p>
                  <p className="rounded border bg-gray-50 p-2 whitespace-pre-wrap">
                    {selected.observacoes || "N/A"}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Assinatura e anexos</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
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
                          className="flex items-center justify-between rounded border px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium">{file.name || `Arquivo ${index + 1}`}</p>
                            <p className="text-xs text-gray-500">
                              {file.type || "tipo nao informado"} - {formatFileSize(file.size)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminInvestigacoes;
