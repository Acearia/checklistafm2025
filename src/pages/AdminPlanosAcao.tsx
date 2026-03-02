import React, { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

type PrioridadeAcao = "Baixa" | "Media" | "Alta" | "Critica";
type StatusAcao = "Aberta" | "Em andamento" | "Concluida" | "Cancelada";

interface PlanoAcaoRecord {
  id: string;
  created_at: string;
  updated_at: string;
  numero_plano: number;
  numero_ocorrencia: number;
  data_ocorrencia: string;
  descricao_resumida_acao: string;
  prioridade: PrioridadeAcao;
  status: StatusAcao;
  responsavel_execucao: string;
  termino_planejado: string;
}

interface InvestigacaoResumo {
  numero_ocorrencia: number;
  nome_acidentado: string;
  setor: string;
  data_ocorrencia: string;
  titulo: string;
}

const INVESTIGACAO_STORAGE_KEY = "checklistafm-investigacoes-acidente";
const PLANO_STORAGE_KEY = "checklistafm-planos-acao-acidente";
const PLANO_STORAGE_EVENT = "checklistafm-plano-acao-updated";

const formatNumero = (value: number) => String(value || 0).padStart(3, "0");

const formatDate = (value?: string) => {
  if (!value) return "N/A";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("pt-BR");
};

const parsePlanos = (): PlanoAcaoRecord[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PLANO_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item: any): PlanoAcaoRecord | null => {
        if (!item || typeof item !== "object") return null;
        return {
          id: String(item.id || `${Date.now()}-${Math.random()}`),
          created_at: String(item.created_at || ""),
          updated_at: String(item.updated_at || ""),
          numero_plano: Number(item.numero_plano) || 0,
          numero_ocorrencia: Number(item.numero_ocorrencia) || 0,
          data_ocorrencia: String(item.data_ocorrencia || ""),
          descricao_resumida_acao: String(item.descricao_resumida_acao || ""),
          prioridade: (String(item.prioridade || "Baixa") as PrioridadeAcao) || "Baixa",
          status: (String(item.status || "Aberta") as StatusAcao) || "Aberta",
          responsavel_execucao: String(item.responsavel_execucao || ""),
          termino_planejado: String(item.termino_planejado || ""),
        };
      })
      .filter((item): item is PlanoAcaoRecord => Boolean(item))
      .sort((a, b) => {
        const dateA = new Date(a.updated_at || a.created_at).getTime();
        const dateB = new Date(b.updated_at || b.created_at).getTime();
        return dateB - dateA;
      });
  } catch (error) {
    console.error("Erro ao carregar planos de acao:", error);
    return [];
  }
};

const parseInvestigacoes = (): InvestigacaoResumo[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(INVESTIGACAO_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item: any): InvestigacaoResumo | null => {
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
      .filter((item): item is InvestigacaoResumo => Boolean(item));
  } catch (error) {
    console.error("Erro ao carregar investigacoes:", error);
    return [];
  }
};

const AdminPlanosAcao = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [records, setRecords] = useState<PlanoAcaoRecord[]>([]);
  const [investigacoes, setInvestigacoes] = useState<InvestigacaoResumo[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [ocorrenciaFilter, setOcorrenciaFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [prioridadeFilter, setPrioridadeFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const ocorrenciaFromQuery = useMemo(() => {
    const value = searchParams.get("ocorrencia") || "";
    return value.trim();
  }, [searchParams]);

  useEffect(() => {
    setOcorrenciaFilter(ocorrenciaFromQuery.replace(/\D/g, ""));
  }, [ocorrenciaFromQuery]);

  const loadData = () => {
    setRecords(parsePlanos());
    setInvestigacoes(parseInvestigacoes());
  };

  useEffect(() => {
    loadData();

    const handleStorage = (event: StorageEvent) => {
      if (!event.key || event.key === PLANO_STORAGE_KEY || event.key === INVESTIGACAO_STORAGE_KEY) {
        loadData();
      }
    };

    const handlePlanoUpdated = () => loadData();
    const handleInvestigacaoUpdated = () => loadData();

    window.addEventListener("storage", handleStorage);
    window.addEventListener(PLANO_STORAGE_EVENT, handlePlanoUpdated);
    window.addEventListener("checklistafm-investigacao-acidente-updated", handleInvestigacaoUpdated);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(PLANO_STORAGE_EVENT, handlePlanoUpdated);
      window.removeEventListener("checklistafm-investigacao-acidente-updated", handleInvestigacaoUpdated);
    };
  }, []);

  const investigacaoByOcorrencia = useMemo(() => {
    const map = new Map<number, InvestigacaoResumo>();
    investigacoes.forEach((item) => {
      map.set(item.numero_ocorrencia, item);
    });
    return map;
  }, [investigacoes]);

  const filteredRecords = useMemo(() => {
    return records.filter((item) => {
      const linked = investigacaoByOcorrencia.get(item.numero_ocorrencia);
      const normalizedSearch = searchTerm.trim().toLowerCase();

      const matchesSearch =
        normalizedSearch.length === 0 ||
        String(item.numero_plano).includes(normalizedSearch) ||
        String(item.numero_ocorrencia).includes(normalizedSearch) ||
        item.descricao_resumida_acao.toLowerCase().includes(normalizedSearch) ||
        item.responsavel_execucao.toLowerCase().includes(normalizedSearch) ||
        String(linked?.nome_acidentado || "").toLowerCase().includes(normalizedSearch) ||
        String(linked?.setor || "").toLowerCase().includes(normalizedSearch);
      const matchesOcorrencia =
        !ocorrenciaFilter.trim() ||
        String(item.numero_ocorrencia).includes(ocorrenciaFilter.trim());

      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      const matchesPrioridade = prioridadeFilter === "all" || item.prioridade === prioridadeFilter;

      const itemDateValue = item.data_ocorrencia || linked?.data_ocorrencia || item.created_at;
      const itemDate = itemDateValue ? new Date(itemDateValue) : null;
      const from = dateFrom ? new Date(dateFrom) : null;
      const to = dateTo ? new Date(dateTo) : null;
      if (from) from.setHours(0, 0, 0, 0);
      if (to) to.setHours(23, 59, 59, 999);
      const matchesDate =
        (!from || (itemDate && itemDate >= from)) &&
        (!to || (itemDate && itemDate <= to));

      return matchesSearch && matchesOcorrencia && matchesStatus && matchesPrioridade && matchesDate;
    });
  }, [
    records,
    investigacaoByOcorrencia,
    searchTerm,
    ocorrenciaFilter,
    statusFilter,
    prioridadeFilter,
    dateFrom,
    dateTo,
  ]);

  const summary = useMemo(() => {
    const total = records.length;
    const abertas = records.filter((item) => item.status === "Aberta").length;
    const andamento = records.filter((item) => item.status === "Em andamento").length;
    const concluidas = records.filter((item) => item.status === "Concluida").length;
    return { total, abertas, andamento, concluidas };
  }, [records]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Planos de Acao</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => navigate("/admin/investigacoes")}>
            Investigacoes
          </Button>
          <Button variant="outline" onClick={loadData}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar
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
            <CardDescription>Abertas</CardDescription>
            <CardTitle>{summary.abertas}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Em andamento</CardDescription>
            <CardTitle>{summary.andamento}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Concluidas</CardDescription>
            <CardTitle>{summary.concluidas}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Refine por status, prioridade, periodo e busca.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-7">
            <div>
              <label className="mb-1 block text-sm font-medium">Busca rapida</label>
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Plano, ocorrencia, responsavel..."
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
              <label className="mb-1 block text-sm font-medium">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="Aberta">Aberta</SelectItem>
                  <SelectItem value="Em andamento">Em andamento</SelectItem>
                  <SelectItem value="Concluida">Concluida</SelectItem>
                  <SelectItem value="Cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Prioridade</label>
              <Select value={prioridadeFilter} onValueChange={setPrioridadeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="Baixa">Baixa</SelectItem>
                  <SelectItem value="Media">Media</SelectItem>
                  <SelectItem value="Alta">Alta</SelectItem>
                  <SelectItem value="Critica">Critica</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSearchTerm("");
                  setOcorrenciaFilter("");
                  setStatusFilter("all");
                  setPrioridadeFilter("all");
                  setDateFrom("");
                  setDateTo("");
                }}
              >
                Limpar filtros
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Planos de Acao</CardTitle>
          <CardDescription>
            {filteredRecords.length === 0
              ? "Nenhum plano encontrado."
              : `Mostrando ${filteredRecords.length} plano(s).`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredRecords.length === 0 ? (
            <div className="rounded-md border bg-gray-50 p-8 text-center text-gray-500">
              Nao ha planos de acao com os filtros selecionados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plano</TableHead>
                    <TableHead>Ocorrencia</TableHead>
                    <TableHead>Acidentado</TableHead>
                    <TableHead>Setor</TableHead>
                    <TableHead>Resumo da acao</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Prioridade</TableHead>
                    <TableHead>Responsavel</TableHead>
                    <TableHead>Termino</TableHead>
                    <TableHead className="text-right">Acoes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.map((item) => {
                    const linked = investigacaoByOcorrencia.get(item.numero_ocorrencia);
                    return (
                      <TableRow key={item.id}>
                        <TableCell>{formatNumero(item.numero_plano)}</TableCell>
                        <TableCell>{formatNumero(item.numero_ocorrencia)}</TableCell>
                        <TableCell>{linked?.nome_acidentado || "N/A"}</TableCell>
                        <TableCell>{linked?.setor || "N/A"}</TableCell>
                        <TableCell className="max-w-[280px] truncate">{item.descricao_resumida_acao || "N/A"}</TableCell>
                        <TableCell>
                          <Badge variant={item.status === "Concluida" ? "default" : "secondary"}>
                            {item.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={item.prioridade === "Critica" ? "destructive" : "secondary"}>
                            {item.prioridade}
                          </Badge>
                        </TableCell>
                        <TableCell>{item.responsavel_execucao || "N/A"}</TableCell>
                        <TableCell>{formatDate(item.termino_planejado)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              navigate(
                                `/plano-acao-acidente?plano=${encodeURIComponent(item.id)}&ocorrencia=${item.numero_ocorrencia}&origem=admin`,
                              )
                            }
                          >
                            Editar plano
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/admin/investigacoes?ocorrencia=${item.numero_ocorrencia}`)}
                          >
                            Ver investigacao
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
    </div>
  );
};

export default AdminPlanosAcao;
