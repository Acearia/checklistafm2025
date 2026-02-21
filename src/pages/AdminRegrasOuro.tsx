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

interface QuestionResponse {
  codigo: string;
  numero: string;
  pergunta: string;
  resposta: "Sim" | "Não";
  comentario: string;
  foto: AttachmentMeta | null;
}

interface RegraOuroRecord {
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

const STORAGE_KEY = "checklistafm-regras-de-ouro";
const STORAGE_EVENT = "checklistafm-regras-de-ouro-updated";

const decodePotentialMojibake = (value: string) => {
  const cp1252ReverseMap: Record<number, number> = {
    0x20ac: 0x80,
    0x201a: 0x82,
    0x0192: 0x83,
    0x201e: 0x84,
    0x2026: 0x85,
    0x2020: 0x86,
    0x2021: 0x87,
    0x02c6: 0x88,
    0x2030: 0x89,
    0x0160: 0x8a,
    0x2039: 0x8b,
    0x0152: 0x8c,
    0x017d: 0x8e,
    0x2018: 0x91,
    0x2019: 0x92,
    0x201c: 0x93,
    0x201d: 0x94,
    0x2022: 0x95,
    0x2013: 0x96,
    0x2014: 0x97,
    0x02dc: 0x98,
    0x2122: 0x99,
    0x0161: 0x9a,
    0x203a: 0x9b,
    0x0153: 0x9c,
    0x017e: 0x9e,
    0x0178: 0x9f,
  };

  const hasMojibake = /[ÃƒÃ‚]/.test(value);
  const hasReplacement = /\uFFFD/.test(value);
  if (!hasMojibake && !hasReplacement) return value;

  if (!hasMojibake) {
    return value.replace(/\uFFFD+/g, "");
  }

  try {
    const bytes = Uint8Array.from(
      Array.from(value, (char) => {
        const codePoint = char.charCodeAt(0);
        if (codePoint <= 0xff) return codePoint;
        return cp1252ReverseMap[codePoint] ?? 0x3f;
      }),
    );
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return value;
  }
};

const toSafeString = (value: unknown) =>
  value == null ? "" : decodePotentialMojibake(String(value));

const formatDateTime = (value?: string) => {
  if (!value) return "N/A";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "N/A";
  return format(parsed, "dd/MM/yyyy HH:mm", { locale: ptBR });
};

const formatInspectionNumber = (value: number) => String(value).padStart(3, "0");

const formatFileSize = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
};

const parseRegrasOuro = (): RegraOuroRecord[] => {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const normalized = parsed
      .map((item: any): RegraOuroRecord | null => {
        if (!item || typeof item !== "object") return null;

        const respostas = Array.isArray(item.respostas)
          ? item.respostas.map((response: any, index: number) => ({
              codigo: toSafeString(response?.codigo) || `item-${index + 1}`,
              numero: toSafeString(response?.numero),
              pergunta: toSafeString(response?.pergunta),
              resposta: toSafeString(response?.resposta) === "Não" ? "Não" : "Sim",
              comentario: toSafeString(response?.comentario),
              foto: response?.foto
                ? {
                    name: toSafeString(response.foto?.name),
                    size: Number(response.foto?.size) || 0,
                    type: toSafeString(response.foto?.type),
                  }
                : null,
            }))
          : [];

        const anexos = Array.isArray(item.anexos)
          ? item.anexos.map((file: any) => ({
              name: toSafeString(file?.name),
              size: Number(file?.size) || 0,
              type: toSafeString(file?.type),
            }))
          : [];

        return {
          id: toSafeString(item.id) || `${Date.now()}-${Math.random()}`,
          numero_inspecao: Number(item.numero_inspecao) || 0,
          created_at: toSafeString(item.created_at),
          titulo: toSafeString(item.titulo),
          setor: toSafeString(item.setor),
          gestor: toSafeString(item.gestor),
          tecnico_seg: toSafeString(item.tecnico_seg),
          acompanhante: toSafeString(item.acompanhante),
          respostas,
          ass_tst: toSafeString(item.ass_tst),
          ass_gestor: toSafeString(item.ass_gestor),
          ass_acomp: toSafeString(item.ass_acomp),
          anexos,
        };
      })
      .filter((item): item is RegraOuroRecord => Boolean(item));

    return normalized.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return dateB - dateA;
    });
  } catch (error) {
    console.error("Erro ao carregar regras de ouro:", error);
    return [];
  }
};

const AdminRegrasOuro = () => {
  const { toast } = useToast();
  const [records, setRecords] = useState<RegraOuroRecord[]>([]);
  const [selected, setSelected] = useState<RegraOuroRecord | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [setorFilter, setSetorFilter] = useState("all");
  const [tecnicoFilter, setTecnicoFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const loadData = () => {
    setRecords(parseRegrasOuro());
  };

  useEffect(() => {
    loadData();

    const handleUpdated = () => loadData();
    const handleStorage = (event: StorageEvent) => {
      if (!event.key || event.key === STORAGE_KEY) {
        loadData();
      }
    };

    window.addEventListener(STORAGE_EVENT, handleUpdated);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(STORAGE_EVENT, handleUpdated);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const uniqueSetores = useMemo(
    () =>
      Array.from(
        new Set(
          records.map((item) => item.setor).filter((value) => value.trim().length > 0),
        ),
      ).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [records],
  );

  const uniqueTecnicos = useMemo(
    () =>
      Array.from(
        new Set(
          records
            .map((item) => item.tecnico_seg)
            .filter((value) => value.trim().length > 0),
        ),
      ).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [records],
  );

  const filteredRecords = useMemo(() => {
    return records.filter((item) => {
      const matchesSetor = setorFilter === "all" || item.setor === setorFilter;
      const matchesTecnico = tecnicoFilter === "all" || item.tecnico_seg === tecnicoFilter;

      const normalizedSearch = searchTerm.trim().toLowerCase();
      const matchesSearch =
        normalizedSearch.length === 0 ||
        item.titulo.toLowerCase().includes(normalizedSearch) ||
        item.setor.toLowerCase().includes(normalizedSearch) ||
        item.gestor.toLowerCase().includes(normalizedSearch) ||
        item.tecnico_seg.toLowerCase().includes(normalizedSearch);

      const itemDate = item.created_at ? new Date(item.created_at) : null;
      const from = dateFrom ? new Date(dateFrom) : null;
      const to = dateTo ? new Date(dateTo) : null;
      if (from) from.setHours(0, 0, 0, 0);
      if (to) to.setHours(23, 59, 59, 999);
      const matchesDate =
        (!from || (itemDate && itemDate >= from)) &&
        (!to || (itemDate && itemDate <= to));

      return matchesSetor && matchesTecnico && matchesSearch && matchesDate;
    });
  }, [records, setorFilter, tecnicoFilter, searchTerm, dateFrom, dateTo]);

  const summary = useMemo(() => {
    const total = records.length;
    const comPendencias = records.filter((item) =>
      item.respostas.some((response) => response.resposta === "Não"),
    ).length;
    const totalItensNao = records.reduce(
      (acc, item) => acc + item.respostas.filter((response) => response.resposta === "Não").length,
      0,
    );
    const assinadas = records.filter(
      (item) => item.ass_tst.trim() && item.ass_gestor.trim() && item.ass_acomp.trim(),
    ).length;

    return { total, comPendencias, totalItensNao, assinadas };
  }, [records]);

  const handleViewDetails = (record: RegraOuroRecord) => {
    setSelected(record);
    setDetailsOpen(true);
  };

  const handleExportCsv = () => {
    if (filteredRecords.length === 0) {
      toast({
        title: "Nenhum registro",
        description: "Nao ha dados para exportar com os filtros atuais.",
        variant: "destructive",
      });
      return;
    }

    const headers = [
      "numero_inspecao",
      "data_hora",
      "titulo",
      "setor",
      "tecnico_seg",
      "gestor",
      "acompanhante",
      "itens_nao",
      "assinaturas",
      "anexos",
    ];
    const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;

    const rows = filteredRecords.map((item) => {
      const itensNao = item.respostas.filter((response) => response.resposta === "Não").length;
      const assinaturas =
        item.ass_tst.trim() && item.ass_gestor.trim() && item.ass_acomp.trim()
          ? "completo"
          : "pendente";

      return [
        formatInspectionNumber(item.numero_inspecao),
        formatDateTime(item.created_at),
        item.titulo,
        item.setor,
        item.tecnico_seg,
        item.gestor,
        item.acompanhante,
        String(itensNao),
        assinaturas,
        String(item.anexos.length),
      ]
        .map((cell) => escape(cell || ""))
        .join(",");
    });

    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `regras-de-ouro-${format(new Date(), "yyyy-MM-dd")}.csv`;
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
        <h1 className="text-2xl font-bold">Regras de Ouro</h1>
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
            <CardDescription>Com pendencias</CardDescription>
            <CardTitle>{summary.comPendencias}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total de itens Nao</CardDescription>
            <CardTitle>{summary.totalItensNao}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Assinaturas completas</CardDescription>
            <CardTitle>{summary.assinadas}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Refine por setor, tecnico, data e busca rapida.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <div>
              <label className="mb-1 block text-sm font-medium">Busca rapida</label>
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Titulo, setor, gestor..."
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
              <label className="mb-1 block text-sm font-medium">Setor</label>
              <Select value={setorFilter} onValueChange={setSetorFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os setores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os setores</SelectItem>
                  {uniqueSetores.map((setor) => (
                    <SelectItem key={setor} value={setor}>
                      {setor}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Tecnico</label>
              <Select value={tecnicoFilter} onValueChange={setTecnicoFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os tecnicos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tecnicos</SelectItem>
                  {uniqueTecnicos.map((tecnico) => (
                    <SelectItem key={tecnico} value={tecnico}>
                      {tecnico}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Regras de Ouro</CardTitle>
          <CardDescription>
            {filteredRecords.length === 0
              ? "Nenhum registro encontrado."
              : `Mostrando ${filteredRecords.length} registro(s).`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredRecords.length === 0 ? (
            <div className="rounded-md border bg-gray-50 p-8 text-center text-gray-500">
              Nao ha registros com os filtros selecionados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N</TableHead>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Titulo</TableHead>
                    <TableHead>Setor</TableHead>
                    <TableHead>Tecnico</TableHead>
                    <TableHead>Gestor</TableHead>
                    <TableHead>Itens Nao</TableHead>
                    <TableHead>Assinaturas</TableHead>
                    <TableHead className="text-right">Acoes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.map((item) => {
                    const itensNao = item.respostas.filter((response) => response.resposta === "Não").length;
                    const assinaturasCompletas =
                      item.ass_tst.trim() && item.ass_gestor.trim() && item.ass_acomp.trim();

                    return (
                      <TableRow key={item.id}>
                        <TableCell>{formatInspectionNumber(item.numero_inspecao)}</TableCell>
                        <TableCell>{formatDateTime(item.created_at)}</TableCell>
                        <TableCell className="max-w-[260px] truncate">{item.titulo || "N/A"}</TableCell>
                        <TableCell>{item.setor || "N/A"}</TableCell>
                        <TableCell>{item.tecnico_seg || "N/A"}</TableCell>
                        <TableCell>{item.gestor || "N/A"}</TableCell>
                        <TableCell>
                          <Badge variant={itensNao > 0 ? "destructive" : "secondary"}>
                            {itensNao}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={assinaturasCompletas ? "default" : "secondary"}>
                            {assinaturasCompletas ? "Completo" : "Pendente"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => handleViewDetails(item)}>
                            <Eye className="mr-2 h-4 w-4" />
                            Detalhes
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

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-h-[85vh] max-w-4xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>Detalhes da Regra de Ouro</DialogTitle>
            <DialogDescription>
              {selected
                ? `Registro ${formatInspectionNumber(selected.numero_inspecao)} - ${formatDateTime(selected.created_at)}`
                : ""}
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-4 overflow-y-auto pr-1">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded border p-3 text-sm">
                  <p><strong>Titulo:</strong> {selected.titulo || "N/A"}</p>
                  <p><strong>Setor:</strong> {selected.setor || "N/A"}</p>
                  <p><strong>Tecnico:</strong> {selected.tecnico_seg || "N/A"}</p>
                  <p><strong>Gestor:</strong> {selected.gestor || "N/A"}</p>
                  <p><strong>Acompanhante:</strong> {selected.acompanhante || "N/A"}</p>
                </div>
                <div className="rounded border p-3 text-sm">
                  <p><strong>Assinatura tecnico:</strong> {selected.ass_tst ? "Sim" : "Nao"}</p>
                  <p><strong>Assinatura gestor:</strong> {selected.ass_gestor ? "Sim" : "Nao"}</p>
                  <p><strong>Assinatura acompanhante:</strong> {selected.ass_acomp ? "Sim" : "Nao"}</p>
                  <p><strong>Anexos:</strong> {selected.anexos.length}</p>
                </div>
              </div>

              <div>
                <h3 className="mb-2 font-semibold">Respostas</h3>
                <div className="space-y-2">
                  {selected.respostas.map((response) => (
                    <div key={`${response.codigo}-${response.numero}`} className="rounded border p-3 text-sm">
                      <div className="mb-1 flex items-center justify-between gap-3">
                        <p className="font-medium">
                          {response.numero} - {response.pergunta || "Pergunta"}
                        </p>
                        <Badge variant={response.resposta === "Não" ? "destructive" : "secondary"}>
                          {response.resposta}
                        </Badge>
                      </div>
                      {response.comentario && (
                        <p className="text-gray-700">
                          <strong>Comentario:</strong> {response.comentario}
                        </p>
                      )}
                      {response.foto && (
                        <p className="text-xs text-gray-500">
                          Foto: {response.foto.name || "arquivo"} ({formatFileSize(response.foto.size)})
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {selected.anexos.length > 0 && (
                <div>
                  <h3 className="mb-2 font-semibold">Anexos</h3>
                  <div className="space-y-2">
                    {selected.anexos.map((file, index) => (
                      <div
                        key={`${file.name}-${index}`}
                        className="flex items-center justify-between rounded border bg-gray-50 px-3 py-2 text-sm"
                      >
                        <p className="truncate">{file.name || `Arquivo ${index + 1}`}</p>
                        <p className="text-xs text-gray-500">
                          {file.type || "tipo nao informado"} - {formatFileSize(file.size)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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

export default AdminRegrasOuro;

