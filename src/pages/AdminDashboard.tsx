import React, { useState, useEffect, useMemo } from "react";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart, PieChart } from "@/components/ui/charts";
import { Link } from "react-router-dom";
import { CheckCircle, RefreshCw, Users, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { applyAlertRuleToItem, shouldTriggerAlert } from "@/lib/alertRules";
import { useSupabaseData } from "@/hooks/useSupabaseData";
import { loadMaintenanceOrders } from "@/lib/maintenanceOrders";
import type { MaintenanceOrder } from "@/lib/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const AdminDashboard = () => {
  const { toast } = useToast();
  const { 
    operators, 
    equipment, 
    inspections, 
    sectors, 
    leaders, 
    loading, 
    error, 
    refresh 
  } = useSupabaseData();
  
  const [stats, setStats] = useState({
    totalInspections: 0,
    pendingInspections: 0,
    completedInspections: 0,
    totalOperators: 0,
    totalEquipments: 0,
    totalLeaders: 0,
    totalSectors: 0
  });
  const [inspectionsByMonth, setInspectionsByMonth] = useState([]);
  const [inspectionsByEquipment, setInspectionsByEquipment] = useState([]);
  const [recentInspections, setRecentInspections] = useState([]);
  const [sectorSummary, setSectorSummary] = useState<{
    sectors: {
      sector: string;
      totalInspections: number;
      inspectionsWithProblems: number;
      inspectionsWithoutOS: number;
    }[];
    total: number;
    totalWithProblems: number;
    totalWithoutOS: number;
    totalWithoutProblems: number;
  }>({
    sectors: [],
    total: 0,
    totalWithProblems: 0,
    totalWithoutOS: 0,
    totalWithoutProblems: 0,
  });
  const [maintenanceOrders, setMaintenanceOrders] = useState<MaintenanceOrder[]>([]);
  const [sectorFilter, setSectorFilter] = useState<"all" | "with-os" | "without-os">("all");

  useEffect(() => {
    if (!loading) {
      loadDashboardData();
    }
  }, [loading, operators, equipment, inspections, sectors, leaders, maintenanceOrders]);

  useEffect(() => {
    const updateOrders = () => {
      setMaintenanceOrders(loadMaintenanceOrders());
    };
    updateOrders();
    window.addEventListener(
      "checklistafm-maintenance-orders-updated",
      updateOrders as EventListener
    );
    return () => {
      window.removeEventListener(
        "checklistafm-maintenance-orders-updated",
        updateOrders as EventListener
      );
    };
  }, []);

  const loadDashboardData = () => {
    try {
      console.log("Loading dashboard data from Supabase...");
      console.log("Loaded operators:", operators.length);
      console.log("Loaded equipments:", equipment.length);
      console.log("Loaded inspections:", inspections.length);
      console.log("Loaded leaders:", leaders.length);
      console.log("Loaded sectors:", sectors.length);
      
      // Estatísticas gerais
      setStats({
        totalInspections: inspections.length,
        pendingInspections: 0,
        completedInspections: inspections.length,
        totalOperators: operators.length,
        totalEquipments: equipment.length,
        totalLeaders: leaders.length,
        totalSectors: sectors.length
      });
      
      // Inspeções recentes (últimas 5)
      const sortedInspections = [...inspections].sort((a, b) => {
        return new Date(b.submission_date || b.created_at).getTime() - new Date(a.submission_date || a.created_at).getTime();
      });
      
      setRecentInspections(sortedInspections.slice(0, 5));
      
      // Dados para os gráficos
      const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth();
      
      const lastFourMonthsData = [];
      
      for (let i = 3; i >= 0; i--) {
        const monthIndex = (currentMonth - i + 12) % 12;
        const monthName = months[monthIndex];
        
        // Determinar o ano correto para cada mês
        const year = currentDate.getFullYear() - (monthIndex > currentMonth ? 1 : 0);
        
        // Count inspections for this month
        const monthStart = new Date(year, monthIndex, 1);
        const monthEnd = new Date(year, monthIndex + 1, 0);
        
        console.log(`Counting inspections for ${monthName} ${year}: ${monthStart.toLocaleDateString()} to ${monthEnd.toLocaleDateString()}`);
        
        const count = inspections.filter(inspection => {
          const inspDate = new Date(inspection.submission_date || inspection.created_at);
          return inspDate >= monthStart && inspDate <= monthEnd;
        }).length;
        
        console.log(`Found ${count} inspections for ${monthName}`);
        
        lastFourMonthsData.push({
          name: monthName,
          value: count
        });
      }
      
      setInspectionsByMonth(lastFourMonthsData);
      
      // Distribution by equipment (using actual data)
      const equipmentCounts = {};
      
      inspections.forEach((inspection: any) => {
        // Handle both cases: with equipment relation or just equipment_id
        let equipmentName = '';
        if (inspection.equipment && inspection.equipment.name) {
          // Case 1: Has equipment relation (from Supabase with join)
          equipmentName = inspection.equipment.name;
        } else if (inspection.equipment_id) {
          // Case 2: Only has equipment_id, need to find equipment
          const equipmentItem = equipment.find(eq => eq.id === inspection.equipment_id);
          if (equipmentItem && equipmentItem.name) {
            equipmentName = equipmentItem.name;
          }
        }
        
        if (!equipmentName) {
          console.warn("Encontrada inspeção sem equipamento válido:", inspection);
          return;
        }
        
        if (!equipmentCounts[equipmentName]) {
          equipmentCounts[equipmentName] = 0;
        }
        equipmentCounts[equipmentName]++;
      });
      
      const equipmentDistribution = [];
      for (const [name, value] of Object.entries(equipmentCounts)) {
        equipmentDistribution.push({ name, value });
      }
      
      // Take only top 5 equipment by inspection count
      const topEquipments = equipmentDistribution
        .sort((a: any, b: any) => b.value - a.value)
        .slice(0, 5);
      
      setInspectionsByEquipment(topEquipments);
      console.log("Equipment distribution:", topEquipments);

      // Summary by sector
      const equipmentById = new Map(
        (equipment || []).map((item: any) => [item.id, item])
      );

      const summaryMap = new Map<
        string,
        {
          sector: string;
          totalInspections: number;
          inspectionsWithProblems: number;
          inspectionsWithoutOS: number;
        }
      >();

      let inspectionsWithProblemsTotal = 0;
      let inspectionsWithoutOSTotal = 0;

      const maintenanceOrdersByInspection = new Set(
        maintenanceOrders.map((order) => order.inspectionId)
      );

      inspections.forEach((inspection: any) => {
        const equipmentItem =
          inspection.equipment && inspection.equipment.sector
            ? inspection.equipment
            : equipmentById.get(inspection.equipment_id);

        const sectorName = equipmentItem?.sector || "Sem setor";

        const answers = Array.isArray(inspection.checklist_answers)
          ? (inspection.checklist_answers as any[])
          : [];

        const hasProblems = answers.some((answer, index) => {
          const answerWithRules = applyAlertRuleToItem({
            ...answer,
            question:
              answer?.question && String(answer.question).trim().length > 0
                ? answer.question
                : `Pergunta ${index + 1}`,
          });

          return shouldTriggerAlert(
            answerWithRules.question,
            answerWithRules.answer,
            {
              onYes: answerWithRules.alertOnYes,
              onNo: answerWithRules.alertOnNo,
            }
          );
        });
        const hasOrderForInspection = maintenanceOrdersByInspection.has(
          inspection.id
        );

        if (hasProblems) {
          inspectionsWithProblemsTotal += 1;
          if (!hasOrderForInspection) {
            inspectionsWithoutOSTotal += 1;
          }
        }

        const existing = summaryMap.get(sectorName);
        if (existing) {
          existing.totalInspections += 1;
          if (hasProblems) {
            existing.inspectionsWithProblems += 1;
            if (!hasOrderForInspection) {
              existing.inspectionsWithoutOS += 1;
            }
          }
        } else {
          summaryMap.set(sectorName, {
            sector: sectorName,
            totalInspections: 1,
            inspectionsWithProblems: hasProblems ? 1 : 0,
            inspectionsWithoutOS:
              hasProblems && !hasOrderForInspection ? 1 : 0,
          });
        }
      });

      const summaryBySector = Array.from(summaryMap.values()).sort((a, b) =>
        a.sector.localeCompare(b.sector, "pt-BR")
      );

      setSectorSummary({
        sectors: summaryBySector,
        total: inspections.length,
        totalWithProblems: inspectionsWithProblemsTotal,
        totalWithoutOS: inspectionsWithoutOSTotal,
        totalWithoutProblems: Math.max(
          inspections.length - inspectionsWithProblemsTotal,
          0
        ),
      });
      
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast({
        title: "Erro ao carregar dados",
        description: "Não foi possível carregar os dados do dashboard.",
        variant: "destructive",
      });
    }
  };

  const handleRefreshData = () => {
    refresh();
    toast({
      title: "Atualizando dados",
      description: "Os dados do dashboard estão sendo atualizados...",
    });
  };

  const filteredSectors = useMemo(() => {
    switch (sectorFilter) {
      case "without-os":
        return sectorSummary.sectors.filter(
          (sector) => sector.inspectionsWithoutOS > 0
        );
      case "with-os":
        return sectorSummary.sectors.filter(
          (sector) =>
            sector.inspectionsWithProblems > 0 &&
            sector.inspectionsWithProblems > sector.inspectionsWithoutOS
        );
      default:
        return sectorSummary.sectors;
    }
  }, [sectorSummary.sectors, sectorFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-red-700 border-t-transparent"></div>
          <p className="mt-4 text-gray-600">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex flex-wrap items-center gap-3">

          <Button onClick={handleRefreshData} variant="outline" className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </Button>
          <Link to="/admin/sectors">
            <Button variant="outline" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Gerenciar Setores
            </Button>
          </Link>
          <Link to="/admin/leaders">
            <Button variant="outline" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Definir Líderes
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total de Inspeções</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalInspections}</div>
            <p className="text-xs text-muted-foreground">
              Realizadas no sistema
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Operadores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalOperators}</div>
            <p className="text-xs text-muted-foreground">
              Cadastrados no sistema
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Equipamentos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalEquipments}</div>
            <p className="text-xs text-muted-foreground">
              Monitorados ativamente
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Líderes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalLeaders}</div>
            <p className="text-xs text-muted-foreground">
              Gerenciando setores
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Setores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSectors}</div>
            <p className="text-xs text-muted-foreground">
              Organizados na empresa
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Resumo por Setor</CardTitle>
              <CardDescription>
                Total de checklists e quantos apresentaram problemas em cada setor
              </CardDescription>
            </div>
            <Select
              value={sectorFilter}
              onValueChange={(value) =>
                setSectorFilter(value as "all" | "with-os" | "without-os")
              }
            >
              <SelectTrigger className="w-full bg-white sm:w-60">
                <SelectValue placeholder="Filtrar setores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os setores</SelectItem>
                <SelectItem value="without-os">Sem abertura de OS</SelectItem>
                <SelectItem value="with-os">Com OS registrada</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {sectorSummary.sectors.length === 0 ? (
            <p className="text-sm text-gray-600">
              Nenhuma inspeção registrada até o momento.
            </p>
          ) : filteredSectors.length === 0 ? (
            <p className="text-sm text-gray-600">
              Nenhum setor encontrado para o filtro selecionado.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="pb-2">Setor</th>
                    <th className="pb-2 text-center">Checklists</th>
                    <th className="pb-2 text-center">Com problemas</th>
                    <th className="pb-2 text-center">Com OS</th>
                    <th className="pb-2 text-center">% com problemas</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {filteredSectors.map((sector) => {
                    const percentage =
                      sector.totalInspections === 0
                        ? 0
                        : Math.round(
                            (sector.inspectionsWithProblems /
                              sector.totalInspections) *
                              100
                    );
                    const problemBadgeClass =
                      sector.inspectionsWithProblems > 0
                        ? "bg-red-100 text-red-800"
                        : "bg-green-100 text-green-800";
                    const withoutOsBadgeClass =
                      sector.inspectionsWithoutOS > 0
                        ? "bg-amber-100 text-amber-800"
                        : "bg-green-100 text-green-800";

                    return (
                      <tr
                        key={sector.sector}
                        className="border-t border-gray-200 last:border-b"
                      >
                        <td className="py-3 font-medium text-gray-800">
                          {sector.sector}
                        </td>
                        <td className="py-3 text-center text-gray-700">
                          {sector.totalInspections.toLocaleString("pt-BR")}
                        </td>
                        <td className="py-3 text-center">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${problemBadgeClass}`}
                          >
                            {sector.inspectionsWithProblems.toLocaleString("pt-BR")}
                          </span>
                        </td>
                        <td className="py-3 text-center">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                              sector.inspectionsWithProblems > sector.inspectionsWithoutOS
                                ? "bg-green-100 text-green-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {(sector.inspectionsWithProblems - sector.inspectionsWithoutOS).toLocaleString("pt-BR")}
                          </span>
                        </td>
                        <td className="py-3 text-center text-xs text-muted-foreground">
                          {percentage}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
        {sectorSummary.sectors.length > 0 && (
          <CardFooter className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm text-muted-foreground">
            <span>
              Total de inspeções:{" "}
              <strong>{sectorSummary.total.toLocaleString("pt-BR")}</strong>
            </span>
            <span>
              Inspeções com problemas:{" "}
              <strong>
                {sectorSummary.totalWithProblems.toLocaleString("pt-BR")}
              </strong>
            </span>
            <span>
              Inspeções sem problemas:{" "}
              <strong>
                {sectorSummary.totalWithoutProblems.toLocaleString("pt-BR")}
              </strong>
            </span>
          </CardFooter>
        )}
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Inspeções por Mês</CardTitle>
            <CardDescription>Tendência de inspeções realizadas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              {inspectionsByMonth.length > 0 ? (
                <BarChart
                  data={inspectionsByMonth}
                  index="name"
                  categories={["value"]}
                  colors={["#ef4444"]}
                  valueFormatter={(value) => `${value} inspeções`}
                  yAxisWidth={40}
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-500">Nenhuma inspeção registrada</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Distribuição por Equipamento</CardTitle>
            <CardDescription>Inspeções por tipo de equipamento</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              {inspectionsByEquipment.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-500">Nenhuma inspeção registrada</p>
                </div>
              ) : (
                <PieChart
                  data={inspectionsByEquipment}
                  index="name"
                  valueFormatter={(value) => `${value} inspeções`}
                  category="value"
                  colors={["#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6"]}
                />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Inspeções Recentes</CardTitle>
          <CardDescription>
            Últimas inspeções registradas no sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentInspections.length === 0 ? (
            <div className="text-center p-6">
              <p className="text-gray-500">Nenhuma inspeção registrada ainda.</p>
            </div>
          ) : (
            <div className="space-y-4">
                {recentInspections.map((inspection: any, index) => {
                  // Handle both cases: with relations or just IDs
                  let operatorName = '';
                  let equipmentName = '';
                  let equipmentKp = '';
                  
                  if (inspection.operator && inspection.operator.name) {
                    operatorName = inspection.operator.name;
                  } else if (inspection.operator_id) {
                    const operatorItem = operators.find(op => op.id === inspection.operator_id);
                    operatorName = operatorItem?.name || '';
                  }
                  
                  if (inspection.equipment && inspection.equipment.name) {
                    equipmentName = inspection.equipment.name;
                    equipmentKp = inspection.equipment.kp || '';
                  } else if (inspection.equipment_id) {
                    const equipmentItem = equipment.find(eq => eq.id === inspection.equipment_id);
                    equipmentName = equipmentItem?.name || '';
                    equipmentKp = equipmentItem?.kp || '';
                  }
                  
                  return (
                    <div key={index} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                      <div className="flex items-start gap-4">
                        <div className="bg-red-100 text-red-700 p-2 rounded-full">
                          <CheckCircle className="h-5 w-5" />
                        </div>
                        <div>
                          <h4 className="font-medium">{equipmentName || "Equipamento não informado"}</h4>
                          <p className="text-sm text-gray-500">
                            Operador: {operatorName || "Não informado"} | KP: {equipmentKp || "N/A"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">
                          {format(new Date(inspection.submission_date || inspection.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </div>
                        <div className="text-xs text-gray-500">
                          {format(new Date(inspection.submission_date || inspection.created_at), "HH:mm", { locale: ptBR })}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Link to="/admin/inspections" className="w-full">
            <Button variant="outline" className="w-full">
              Ver todas as inspeções
            </Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
};

export default AdminDashboard;

