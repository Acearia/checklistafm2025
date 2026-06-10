import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Eye, LogOut, RefreshCw } from "lucide-react";
import EnvironmentalInspectionDetailsDialog, {
  type EnvironmentalInspectionDetail,
} from "@/components/environmental/EnvironmentalInspectionDetailsDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

interface Leader {
  id: string;
  name: string;
  email: string;
  sector: string;
}

type EnvironmentalInspectionListItem = EnvironmentalInspectionDetail & {
  id: string;
  setor: string;
};

const LOCAL_PROFILE_KEY = "checklistafm-leader-local-profile";

const normalizeText = (value?: string | null) =>
  (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const normalizeSector = (value?: string | null) => normalizeText(value);

const splitLeaderSectors = (value?: string | null) =>
  String(value || "")
    .split(/[,;]/)
    .map((sector) => normalizeSector(sector))
    .filter(Boolean);

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

const LeaderEnvironmentalInspections = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const {
    leaders,
    sectors,
    sectorLeaderAssignments,
    loading: supabaseLoading,
    refresh,
  } = useSupabaseData(["leaders", "sectors", "sectorLeaderAssignments"]);

  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loadingData, setLoadingData] = useState(true);
  const [currentLeader, setCurrentLeader] = useState<Leader | null>(null);
  const [records, setRecords] = useState<EnvironmentalInspectionListItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [selectedInspection, setSelectedInspection] = useState<EnvironmentalInspectionDetail | null>(null);

  useEffect(() => {
    const isAuthenticated = localStorage.getItem("checklistafm-leader-auth");
    const leaderId = localStorage.getItem("checklistafm-leader-id");
    const leaderSector = localStorage.getItem("checklistafm-leader-sector") || "";
    const localProfileRaw = localStorage.getItem(LOCAL_PROFILE_KEY);

    if (!isAuthenticated || !leaderId) {
      navigate("/leader/login");
      return;
    }

    if (supabaseLoading) return;

    const leader = leaders.find((item: any) => item.id === leaderId);
    if (leader) {
      setCurrentLeader({
        id: leader.id,
        name: leader.name,
        email: leader.email,
        sector: leader.sector,
      });
      setLoadingAuth(false);
      return;
    }

    if (leaderId === "__local_super__" && localProfileRaw) {
      try {
        const parsed = JSON.parse(localProfileRaw);
        setCurrentLeader({
          id: parsed.id || "__local_super__",
          name: parsed.name || "Usuário Local",
          email: parsed.email || "teste@local",
          sector: parsed.sector || leaderSector || "TODOS",
        });
        setLoadingAuth(false);
        return;
      } catch (error) {
        console.error("Erro ao carregar perfil local do líder:", error);
      }
    }

    if (leaderSector) {
      setCurrentLeader({
        id: leaderId,
        name: "Líder Local",
        email: "local@checklist",
        sector: leaderSector,
      });
    }
    setLoadingAuth(false);
  }, [leaders, navigate, supabaseLoading]);

  const assignedSectorNames = useMemo(() => {
    if (!currentLeader) return [] as string[];

    const sectorById = new Map<string, string>();
    sectors.forEach((sector: any) => {
      sectorById.set(String(sector.id), normalizeSector(sector.name));
    });

    const names = new Set<string>();
    splitLeaderSectors(currentLeader.sector).forEach((sector) => names.add(sector));

    sectorLeaderAssignments.forEach((assignment: any) => {
      if (assignment.leader_id !== currentLeader.id) return;
      const sectorName = sectorById.get(String(assignment.sector_id || ""));
      if (sectorName) names.add(sectorName);
    });

    return Array.from(names);
  }, [currentLeader, sectorLeaderAssignments, sectors]);

  const hasGlobalAccess = useMemo(() => assignedSectorNames.includes("todos"), [assignedSectorNames]);

  const isSectorVisible = useCallback(
    (sector?: string | null) => {
      const normalized = normalizeSector(sector);
      if (!normalized) return false;
      if (hasGlobalAccess) return true;
      return assignedSectorNames.includes(normalized);
    },
    [assignedSectorNames, hasGlobalAccess],
  );

  const loadData = useCallback(async () => {
    if (!currentLeader) return;

    setLoadingData(true);
    try {
      const data = await environmentalInspectionService.safeGetAllWithFallback();
      setRecords(
        (Array.isArray(data) ? data : [])
          .map((item: any) => ({
            ...item,
            id: String(item.id || ""),
            setor: String(item.setor || ""),
            responses: Array.isArray(item.responses) ? item.responses : [],
          }))
          .filter((item) => isSectorVisible(item.setor)),
      );
    } catch (error) {
      console.error("[LeaderEnvironmentalInspections] Erro ao carregar inspeções ambientais:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as inspeções ambientais.",
        variant: "destructive",
      });
    } finally {
      setLoadingData(false);
    }
  }, [currentLeader, isSectorVisible, toast]);

  useEffect(() => {
    if (!supabaseLoading && currentLeader) {
      void loadData();
    }
  }, [currentLeader, loadData, supabaseLoading]);

  const filteredRecords = useMemo(() => {
    const normalizedSearch = normalizeText(searchTerm);
    return records.filter((record) => {
      const dateKey = getInspectionDateKey(record);
      const matchesDate =
        (!dateFrom || (dateKey && dateKey >= dateFrom)) &&
        (!dateTo || (dateKey && dateKey <= dateTo));
      const matchesSearch =
        !normalizedSearch ||
        [
          String(record.numero_inspecao || ""),
          record.setor,
          record.realizado_por || "",
          record.acompanhado_por || "",
          record.observacoes || "",
        ].some((field) => normalizeText(field).includes(normalizedSearch));

      return matchesDate && matchesSearch;
    });
  }, [dateFrom, dateTo, records, searchTerm]);

  const summary = useMemo(() => {
    const total = filteredRecords.length;
    const irregular = filteredRecords.filter((item) => getIrregularCount(item) > 0).length;
    const sectorsCount = new Set(filteredRecords.map((item) => normalizeText(item.setor)).filter(Boolean)).size;
    return { total, irregular, sectorsCount };
  }, [filteredRecords]);

  const handleRefresh = useCallback(async () => {
    await refresh();
    await loadData();
    toast({
      title: "Dados atualizados",
      description: "Inspeções ambientais sincronizadas.",
    });
  }, [loadData, refresh, toast]);

  const handleOpenDetails = useCallback(
    async (record: EnvironmentalInspectionListItem) => {
      setDetailsOpen(true);
      setDetailsLoading(true);
      setSelectedInspection(record);
      try {
        const detail = await environmentalInspectionService.getById(record.id);
        setSelectedInspection((detail as EnvironmentalInspectionDetail) || record);
      } catch (error) {
        console.warn("[LeaderEnvironmentalInspections] Falha ao carregar detalhes:", error);
        setSelectedInspection(record);
      } finally {
        setDetailsLoading(false);
      }
    },
    [],
  );

  if (loadingAuth || supabaseLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-red-700 border-t-transparent" />
          <p className="mt-4 text-gray-600">Carregando inspeções ambientais...</p>
        </div>
      </div>
    );
  }

  if (!currentLeader) {
    return null;
  }

  return (
    <div className="mx-auto w-full max-w-[1700px] space-y-6 px-4 pb-6 sm:px-6 lg:px-8">
      <Card className="border border-red-200 bg-gradient-to-r from-red-700 via-red-700 to-red-600 text-white shadow-md">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Inspeções Ambientais</h1>
            <p className="text-sm text-red-100">
              {currentLeader.name} - {currentLeader.sector}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => navigate("/leader/dashboard")}
              variant="outline"
              className="flex items-center gap-2 border-red-200 bg-white text-red-700 hover:bg-red-50 hover:text-red-800"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
            <Button
              onClick={handleRefresh}
              variant="outline"
              className="flex items-center gap-2 border-red-200 bg-white text-red-700 hover:bg-red-50 hover:text-red-800"
            >
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </Button>
            <Button
              onClick={() => {
                localStorage.removeItem("checklistafm-leader-auth");
                localStorage.removeItem("checklistafm-leader-id");
                localStorage.removeItem("checklistafm-leader-sector");
                localStorage.removeItem(LOCAL_PROFILE_KEY);
                navigate("/leader/login");
              }}
              variant="outline"
              className="flex items-center gap-2 border-red-200 bg-transparent text-white hover:bg-red-600 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total visível</CardDescription>
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
            <CardDescription>Setores liberados</CardDescription>
            <CardTitle>{summary.sectorsCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Busca rápida</CardTitle>
          <CardDescription>Filtre por número, setor, responsável ou observação.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <div className="md:col-span-2">
            <label className="text-sm font-medium">Busca</label>
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Procurar inspeções ambientais..."
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Inspeções Ambientais visíveis</CardTitle>
          <CardDescription>
            {loadingData ? "Carregando..." : `Mostrando ${filteredRecords.length} registro(s) dos seus setores.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingData ? (
            <div className="rounded-md border bg-muted/40 p-8 text-center text-muted-foreground">
              Carregando inspeções ambientais...
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="rounded-md border bg-muted/40 p-8 text-center text-muted-foreground">
              Nenhuma inspeção ambiental encontrada para os seus setores.
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

export default LeaderEnvironmentalInspections;
