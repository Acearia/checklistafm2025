import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, RefreshCw } from "lucide-react";
import EnvironmentalInspectionDetailsDialog, {
  type EnvironmentalInspectionDetail,
} from "@/components/environmental/EnvironmentalInspectionDetailsDialog";
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
import { useToast } from "@/hooks/use-toast";
import { useSupabaseData } from "@/hooks/useSupabaseData";
import { environmentalInspectionService } from "@/lib/supabase-service";

const FILTER_ALL = "all";

type EnvironmentalInspectionListItem = EnvironmentalInspectionDetail & {
  id: string;
  setor: string;
};

const normalizeText = (value?: string | null) =>
  (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const formatNumber = (value?: number | null) => String(Number(value) || 0).padStart(3, "0");

const formatDateOnly = (value?: string | null) => {
  if (!value) return "N/A";
  const [year, month, day] = String(value).slice(0, 10).split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
};

const getInspectionDateKey = (item: EnvironmentalInspectionDetail) =>
  String(item.data_inspecao || item.created_at || "").slice(0, 10);

const getIrregularCount = (item: EnvironmentalInspectionDetail) =>
  (Array.isArray(item.responses) ? item.responses : []).filter((response) => Boolean(response.irregular)).length;

const AdminInspecoesAmbientais = () => {
  const { toast } = useToast();
  const { sectors } = useSupabaseData(["sectors"]);
  const [records, setRecords] = useState<EnvironmentalInspectionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sectorFilter, setSectorFilter] = useState(FILTER_ALL);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [selectedInspection, setSelectedInspection] = useState<EnvironmentalInspectionDetail | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await environmentalInspectionService.safeGetAllWithFallback();
      setRecords(
        (Array.isArray(data) ? data : []).map((item: any) => ({
          ...item,
          id: String(item.id || ""),
          setor: String(item.setor || ""),
          responses: Array.isArray(item.responses) ? item.responses : [],
        })),
      );
    } catch (error) {
      console.error("[AdminInspecoesAmbientais] Erro ao carregar inspeções ambientais:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as inspeções ambientais.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const uniqueSectors = useMemo(() => {
    const names = new Set<string>();
    sectors.forEach((sector: any) => {
      const name = String(sector?.name || "").trim();
      if (name) names.add(name);
    });
    records.forEach((record) => {
      const name = String(record.setor || "").trim();
      if (name) names.add(name);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [records, sectors]);

  const filteredRecords = useMemo(() => {
    const normalizedSearch = normalizeText(searchTerm);
    return records.filter((record) => {
      const dateKey = getInspectionDateKey(record);
      const matchesDate =
        (!dateFrom || (dateKey && dateKey >= dateFrom)) &&
        (!dateTo || (dateKey && dateKey <= dateTo));
      const matchesSector = sectorFilter === FILTER_ALL || record.setor === sectorFilter;
      const matchesSearch =
        !normalizedSearch ||
        [
          String(record.numero_inspecao || ""),
          record.setor,
          record.realizado_por || "",
          record.acompanhado_por || "",
          record.observacoes || "",
        ].some((field) => normalizeText(field).includes(normalizedSearch));

      return matchesDate && matchesSector && matchesSearch;
    });
  }, [dateFrom, dateTo, records, searchTerm, sectorFilter]);

  const summary = useMemo(() => {
    const total = records.length;
    const irregular = records.filter((item) => getIrregularCount(item) > 0).length;
    const withPhotos = records.filter((item) =>
      (item.responses || []).some((response) => String(response.foto_data_url || "").trim()),
    ).length;
    const sectorsCount = new Set(records.map((item) => normalizeText(item.setor)).filter(Boolean)).size;
    return { total, irregular, withPhotos, sectorsCount };
  }, [records]);

  const handleOpenDetails = useCallback(
    async (record: EnvironmentalInspectionListItem) => {
      setDetailsOpen(true);
      setDetailsLoading(true);
      setSelectedInspection(record);
      try {
        const detail = await environmentalInspectionService.getById(record.id);
        setSelectedInspection((detail as EnvironmentalInspectionDetail) || record);
      } catch (error) {
        console.warn("[AdminInspecoesAmbientais] Falha ao carregar detalhes:", error);
        setSelectedInspection(record);
      } finally {
        setDetailsLoading(false);
      }
    },
    [],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Inspeções Ambientais</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie os registros ambientais, evidências e não conformidades.
          </p>
        </div>
        <Button variant="outline" onClick={() => void loadData()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
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
            <CardDescription>Com irregularidade</CardDescription>
            <CardTitle>{summary.irregular}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Com foto</CardDescription>
            <CardTitle>{summary.withPhotos}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Setores</CardDescription>
            <CardTitle>{summary.sectorsCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Refine por data, setor, responsável ou observação.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-5">
          <div className="md:col-span-2">
            <label className="text-sm font-medium">Busca rápida</label>
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Número, setor, responsável..."
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Data início</label>
            <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="mt-1" />
          </div>
          <div>
            <label className="text-sm font-medium">Data fim</label>
            <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="mt-1" />
          </div>
          <div>
            <label className="text-sm font-medium">Setor</label>
            <Select value={sectorFilter} onValueChange={setSectorFilter}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Todos os setores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FILTER_ALL}>Todos os setores</SelectItem>
                {uniqueSectors.map((sector) => (
                  <SelectItem key={sector} value={sector}>
                    {sector}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Inspeções Ambientais</CardTitle>
          <CardDescription>
            {loading ? "Carregando..." : `Mostrando ${filteredRecords.length} registro(s).`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="rounded-md border bg-muted/40 p-8 text-center text-muted-foreground">
              Carregando inspeções ambientais...
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="rounded-md border bg-muted/40 p-8 text-center text-muted-foreground">
              Nenhuma inspeção ambiental encontrada.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nº</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Setor</TableHead>
                    <TableHead>Realizado por</TableHead>
                    <TableHead>Acompanhado por</TableHead>
                    <TableHead>Irregularidades</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.map((record) => {
                    const irregularCount = getIrregularCount(record);
                    return (
                      <TableRow key={record.id}>
                        <TableCell>{formatNumber(record.numero_inspecao)}</TableCell>
                        <TableCell>{formatDateOnly(record.data_inspecao)}</TableCell>
                        <TableCell>{record.setor || "N/A"}</TableCell>
                        <TableCell>{record.realizado_por || "N/A"}</TableCell>
                        <TableCell>{record.acompanhado_por || "N/A"}</TableCell>
                        <TableCell>
                          <Badge variant={irregularCount > 0 ? "destructive" : "secondary"}>
                            {irregularCount > 0 ? `${irregularCount} irregularidade(s)` : "Conforme"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => void handleOpenDetails(record)}>
                            <Eye className="mr-2 h-4 w-4" />
                            Ver
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

      <EnvironmentalInspectionDetailsDialog
        open={detailsOpen}
        onOpenChange={(open) => {
          setDetailsOpen(open);
          if (!open) setSelectedInspection(null);
        }}
        inspection={selectedInspection}
        loading={detailsLoading}
      />
    </div>
  );
};

export default AdminInspecoesAmbientais;
