import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { 
  AlertCircle, 
  CheckCircle, 
  LogOut,
  Wrench, 
  FileText,
  Mail,
  RefreshCw,
  AlertTriangle,
  BellRing
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSupabaseData } from "@/hooks/useSupabaseData";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";
import { loadChecklistAlerts, markAlertSeenByLeader } from "@/lib/checklistTemplate";
import { loadMaintenanceOrders, upsertMaintenanceOrder } from "@/lib/maintenanceOrders";
import type { ChecklistAlert, MaintenanceOrder } from "@/lib/types";

// Types
interface Inspection {
  id: string;
  equipment: {
    name: string;
    kp: string;
    sector: string;
  };
  checklist_answers: { question: string; answer: string; comments?: string; alertOnYes?: boolean; alertOnNo?: boolean }[];
  comments: string;
  inspection_date: string;
  submission_date: string;
  operator: {
    name: string;
    matricula: string;
  };
}

interface Leader {
  id: string;
  name: string;
  email: string;
  sector: string;
}

interface ProblemEntry {
  id: string;
  inspectionId: string;
  equipment: string;
  equipmentKp: string;
  operator: string;
  operatorMatricula: string;
  problem: string;
  comments: string;
  date: string;
  status: string;
}

interface EquipmentProblemSummary {
  equipment: string;
  problemas: number;
}

const LeaderDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Use Supabase data hook
  const { 
    inspections: supabaseInspections, 
    equipment: supabaseEquipment, 
    operators: supabaseOperators,
    leaders: supabaseLeaders,
    loading: supabaseLoading,
    error: supabaseError,
    refresh
  } = useSupabaseData();
  
  // States
  const [loading, setLoading] = useState(true);
  const [currentLeader, setCurrentLeader] = useState<Leader | null>(null);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [problemsList, setProblemsList] = useState<ProblemEntry[]>([]);
  const [problemsByEquipment, setProblemsByEquipment] = useState<EquipmentProblemSummary[]>([]);
  const [operatorFilter, setOperatorFilter] = useState<string>("all");
  const [timeRangeFilter, setTimeRangeFilter] = useState<string>("week");
  const [operators, setOperators] = useState<{id: string, name: string}[]>([]);
  const [checklistAlerts, setChecklistAlerts] = useState<ChecklistAlert[]>([]);
  const [maintenanceOrders, setMaintenanceOrders] = useState<MaintenanceOrder[]>([]);
  const [maintenanceDialogOpen, setMaintenanceDialogOpen] = useState(false);
  const [maintenanceEquipmentId, setMaintenanceEquipmentId] = useState<string>("");
  const [maintenanceOrderId, setMaintenanceOrderId] = useState<string | null>(null);
  const [maintenanceOrderNumber, setMaintenanceOrderNumber] = useState("");
  const [maintenanceStatus, setMaintenanceStatus] = useState<MaintenanceOrder["status"]>("open");
  const [maintenanceNotes, setMaintenanceNotes] = useState("");
  
  const refreshChecklistAlerts = useCallback(() => {
    if (!currentLeader) return;

    const localAlerts = loadChecklistAlerts().filter((alert) => {
      if (!alert.sector) return true;
      return alert.sector === currentLeader.sector;
    });

    const generatedAlerts: ChecklistAlert[] = [];

    inspections.forEach((inspection) => {
      if (!inspection.checklist_answers || inspection.checklist_answers.length === 0) {
        return;
      }

      inspection.checklist_answers.forEach((answer, index) => {
        const normalizedAnswer = (answer.answer || "").trim();
        const alertOnYes = Boolean(answer.alertOnYes);
        const alertOnNo = Boolean(answer.alertOnNo);
        const triggersOnYes = alertOnYes && normalizedAnswer === "Sim";
        const triggersOnNo = alertOnNo && normalizedAnswer === "Não";

        if (!triggersOnYes && !triggersOnNo) {
          return;
        }

        const alertId = `${inspection.id}-${answer.question || index}`;

        generatedAlerts.push({
          id: alertId,
          questionId: answer.question || String(index),
          question: answer.question || `Pergunta ${index + 1}`,
          answer: normalizedAnswer === "Sim" ? "Sim" : "Não",
          operatorName: inspection.operator.name !== "N/A" ? inspection.operator.name : undefined,
          operatorMatricula: inspection.operator.matricula !== "N/A" ? inspection.operator.matricula : undefined,
          equipmentName: inspection.equipment.name,
          sector: inspection.equipment.sector || currentLeader.sector,
          createdAt: inspection.submission_date || inspection.inspection_date,
          seenByAdmin: false,
          seenByLeaders: [],
        });
      });
    });

    const mergedAlerts = new Map<string, ChecklistAlert>();

    localAlerts.forEach((alert) => {
      mergedAlerts.set(alert.id, {
        ...alert,
        seenByLeaders: alert.seenByLeaders ?? [],
      });
    });

    generatedAlerts.forEach((alert) => {
      if (!mergedAlerts.has(alert.id)) {
        mergedAlerts.set(alert.id, alert);
      }
    });

    const sortedAlerts = Array.from(mergedAlerts.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    setChecklistAlerts(sortedAlerts);
  }, [currentLeader, inspections]);
  
  // Statistics
  const [stats, setStats] = useState({
    totalProblems: 0,
    totalInspections: 0,
    problemInspections: 0,
    pendingActions: 0
  });

  // Authentication and initial setup
  useEffect(() => {
    const checkAuthentication = async () => {
      const isAuthenticated = localStorage.getItem("checklistafm-leader-auth");
      const leaderId = localStorage.getItem("checklistafm-leader-id");
      
      if (!isAuthenticated || !leaderId) {
        navigate("/leader/login");
        return;
      }

      // Load leader data from Supabase
      if (!supabaseLoading && supabaseLeaders.length > 0) {
        const leader = supabaseLeaders.find(l => l.id === leaderId);
        if (leader) {
          setCurrentLeader({
            id: leader.id,
            name: leader.name,
            email: leader.email,
            sector: leader.sector
          });
        }
      }
    };

    checkAuthentication();
  }, [navigate, supabaseLoading, supabaseLeaders]);

  // Load dashboard data when Supabase data is available
  useEffect(() => {
    if (!supabaseLoading && currentLeader) {
      loadDashboardData();
    }
  }, [supabaseLoading, currentLeader, loadDashboardData]);

  useEffect(() => {
    if (currentLeader) {
      refreshChecklistAlerts();
    }
  }, [currentLeader, refreshChecklistAlerts]);

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

  const loadDashboardData = useCallback(() => {
    if (!currentLeader) return;

    setLoading(true);
    
    try {
      // Filter data by leader's sector
      const sectorEquipments = supabaseEquipment.filter(eq => eq.sector === currentLeader.sector);
      const operatorsByMatricula = new Map(
        supabaseOperators.map(op => [op.matricula, op])
      );
      
      // Filter inspections by sector equipment
      const sectorEquipmentIds = sectorEquipments.map(eq => eq.id);
      const sectorInspections = supabaseInspections.filter(inspection => 
        sectorEquipmentIds.includes(inspection.equipment_id)
      );

      // Process inspections to match expected format
      const processedInspections = sectorInspections.map(inspection => {
        const equipment =
          inspection.equipment ??
          sectorEquipments.find(eq => eq.id === inspection.equipment_id);
        const operatorFromJoin = inspection.operator;
        const operator =
          operatorFromJoin ??
          (inspection.operator_matricula
            ? operatorsByMatricula.get(inspection.operator_matricula)
            : undefined);
        
        // Ensure checklist_answers is an array
        let checklistAnswers: Inspection["checklist_answers"] = [];
        if (Array.isArray(inspection.checklist_answers)) {
          checklistAnswers = inspection.checklist_answers as { question: string; answer: string; comments?: string; alertOnYes?: boolean; alertOnNo?: boolean }[];
        }
        
        return {
          id: inspection.id,
          equipment: {
            name: equipment?.name || 'N/A',
            kp: equipment?.kp || 'N/A',
            sector: equipment?.sector || 'N/A'
          },
          checklist_answers: checklistAnswers,
          comments: inspection.comments || '',
          inspection_date: inspection.inspection_date,
          submission_date: inspection.submission_date,
          operator: {
            name: operator?.name || 'N/A',
            matricula: operator?.matricula || inspection.operator_matricula || 'N/A'
          }
        };
      });

      setInspections(processedInspections);

      // Get unique operators for filter
      const uniqueOperators = new Map<string, { id: string; name: string }>();
      processedInspections.forEach((inspection) => {
        const matricula = inspection.operator.matricula;
        const name = inspection.operator.name;
        if (!matricula || matricula === 'N/A') {
          return;
        }
        uniqueOperators.set(matricula, {
          id: matricula,
          name: name
        });
      });
      setOperators(Array.from(uniqueOperators.values()));

      // Process problems from inspections
      const problems: ProblemEntry[] = [];
      const equipmentProblems: { [key: string]: number } = {};

      processedInspections.forEach(inspection => {
        const answers = inspection.checklist_answers || [];
        answers.forEach(answer => {
          if (answer.answer === 'Não') {
            problems.push({
              id: `${inspection.id}-${answer.question}`,
              inspectionId: inspection.id,
              equipment: inspection.equipment.name,
              equipmentKp: inspection.equipment.kp,
              operator: inspection.operator.name,
              operatorMatricula: inspection.operator.matricula,
              problem: answer.question,
              comments: answer.comments || inspection.comments || 'Nenhum comentário',
              date: inspection.inspection_date,
              status: 'Identificado'
            });

            // Count problems by equipment
            const equipmentKey = inspection.equipment.name;
            equipmentProblems[equipmentKey] = (equipmentProblems[equipmentKey] || 0) + 1;
          }
        });
      });

      setProblemsList(problems);

      // Convert to chart format
      const chartData = Object.entries(equipmentProblems).map(([equipment, count]) => ({
        equipment,
        problemas: count
      }));
      setProblemsByEquipment(chartData);

      // Calculate statistics
      const problemInspectionsCount = new Set(problems.map(p => p.inspectionId)).size;

      setStats({
        totalProblems: problems.length,
        totalInspections: processedInspections.length,
        problemInspections: problemInspectionsCount,
        pendingActions: problems.length
      });

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados do dashboard",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [currentLeader, supabaseEquipment, supabaseInspections, supabaseOperators, toast]);

  const handleRefreshData = () => {
    refresh(); // Refresh Supabase data
    refreshChecklistAlerts();
    setMaintenanceOrders(loadMaintenanceOrders());
    toast({
      title: "Dados atualizados",
      description: "Dashboard atualizado com sucesso",
    });
  };

  const handleSendEmailNotification = () => {
    if (!currentLeader) {
      toast({
        title: "Erro ao enviar email",
        description: "Não foi possível identificar o líder atual",
        variant: "destructive",
      });
      return;
    }
    
    // Simulate email sending
    toast({
      title: "Email enviado",
      description: `Relatório enviado para ${currentLeader.email}`,
    });
  };

  const getMaintenanceOrderStatusLabel = (status: MaintenanceOrder["status"]) => {
    switch (status) {
      case "open":
        return "Em andamento";
      case "closed":
        return "Finalizada";
      case "cancelled":
        return "Cancelada";
      default:
        return "Indefinida";
    }
  };

  const handleOpenMaintenanceDialog = (equipmentId?: string) => {
    if (!sectorEquipments.length) {
      toast({
        title: "Sem equipamentos disponíveis",
        description: "Nenhum equipamento foi encontrado para o seu setor.",
        variant: "destructive",
      });
      return;
    }

    const selectedId = equipmentId ?? sectorEquipments[0]?.id ?? "";
    const ordersForEquipment = maintenanceOrders
      .filter(order => order.equipmentId === selectedId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    const activeOrder = ordersForEquipment.find(order => order.status === "open");
    const latestOrder = ordersForEquipment[0];

    setMaintenanceEquipmentId(selectedId);
    setMaintenanceOrderId(activeOrder?.id ?? latestOrder?.id ?? null);
    setMaintenanceOrderNumber(activeOrder?.orderNumber ?? latestOrder?.orderNumber ?? "");
    setMaintenanceStatus(activeOrder?.status ?? "open");
    setMaintenanceNotes(activeOrder?.notes ?? latestOrder?.notes ?? "");
    setMaintenanceDialogOpen(true);
  };

  const handleEquipmentChangeInDialog = (equipmentId: string) => {
    setMaintenanceEquipmentId(equipmentId);
    const ordersForEquipment = maintenanceOrders
      .filter(order => order.equipmentId === equipmentId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    const activeOrder = ordersForEquipment.find(order => order.status === "open");
    const latestOrder = ordersForEquipment[0];
    setMaintenanceOrderId(activeOrder?.id ?? latestOrder?.id ?? null);
    setMaintenanceOrderNumber(activeOrder?.orderNumber ?? latestOrder?.orderNumber ?? "");
    setMaintenanceStatus(activeOrder?.status ?? "open");
    setMaintenanceNotes(activeOrder?.notes ?? latestOrder?.notes ?? "");
  };

  const handleSaveMaintenanceOrderLeader = () => {
    if (!maintenanceEquipmentId) return;

    const orderNumber = maintenanceOrderNumber.trim();
    if (!orderNumber) {
      toast({
        title: "Número da OS obrigatório",
        description: "Informe o número da OS antes de salvar.",
        variant: "destructive",
      });
      return;
    }

    const notes = maintenanceNotes.trim();
    const existingOrder = maintenanceOrders.find(order => order.id === maintenanceOrderId);
    const inspectionId =
      existingOrder?.inspectionId ?? `equipment-${maintenanceEquipmentId}-${Date.now()}`;

  const { order, orders } = upsertMaintenanceOrder({
    id: maintenanceOrderId,
    inspectionId,
    equipmentId: maintenanceEquipmentId,
      orderNumber,
      status: maintenanceStatus,
      notes: notes || undefined,
  });

  setMaintenanceOrders(orders);
  setMaintenanceOrderId(order.id);
  setMaintenanceDialogOpen(false);

    toast({
      title: maintenanceStatus === "closed" ? "OS finalizada" : "OS atualizada",
      description: `OS #${order.orderNumber} marcada como ${getMaintenanceOrderStatusLabel(order.status)}.`,
    });
  };

  const handleAcknowledgeAlert = (alertId: string) => {
    if (!currentLeader) return;
    markAlertSeenByLeader(alertId, currentLeader.id);
    setChecklistAlerts((prev) =>
      prev.map((alert) => {
        if (alert.id !== alertId) return alert;
        const seenByLeaders = new Set(alert.seenByLeaders || []);
        seenByLeaders.add(currentLeader.id);
        return { ...alert, seenByLeaders: Array.from(seenByLeaders) };
      })
    );
    toast({
      title: "Alerta acompanhado",
      description: "O alerta foi marcado como recebido por você.",
    });
  };

  const leaderId = currentLeader?.id ?? "";
  const pendingAlertsCount = checklistAlerts.filter(
    (alert) => !alert.seenByLeaders?.includes(leaderId)
  ).length;
  const alertsToShow = checklistAlerts.slice(0, 5);
  const sectorEquipments = useMemo(() => {
    if (!currentLeader) return [];
    return supabaseEquipment.filter(
      (equipment) => equipment.sector === currentLeader.sector
    );
  }, [supabaseEquipment, currentLeader]);
  const sectorMaintenanceOrders = useMemo(() => {
    if (!currentLeader) return [];
    const equipmentById = new Map(
      supabaseEquipment.map((equipment) => [equipment.id, equipment])
    );
    return maintenanceOrders
      .filter((order) => {
        const equipment = equipmentById.get(order.equipmentId);
        return equipment?.sector === currentLeader.sector;
      })
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
  }, [maintenanceOrders, currentLeader, supabaseEquipment]);
  const activeSectorOrders = sectorMaintenanceOrders.filter(
    (order) => order.status === "open"
  );
  const latestSectorOrder = sectorMaintenanceOrders[0];

  const filteredProblems = problemsList.filter(problem => {
    const matchesOperator = operatorFilter === "all" || problem.operatorMatricula === operatorFilter;
    
    const problemDate = new Date(problem.date);
    const today = new Date();
    let matchesTimeRange = true;
    
    if (timeRangeFilter === "day") {
      matchesTimeRange = problemDate.toDateString() === today.toDateString();
    } else if (timeRangeFilter === "week") {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      matchesTimeRange = problemDate >= weekAgo;
    } else if (timeRangeFilter === "month") {
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      matchesTimeRange = problemDate >= monthAgo;
    }
    
    return matchesOperator && matchesTimeRange;
  });

  const exportReportToPDF = () => {
    try {
      const doc = new jsPDF();
      
      // Header
      doc.setFontSize(20);
      doc.text("Relatório de Inspeções do Setor", 20, 20);
      
      doc.setFontSize(12);
      doc.text(`Setor: ${currentLeader?.sector || 'N/A'}`, 20, 30);
      doc.text(`Data do relatório: ${format(new Date(), "PP", { locale: ptBR })}`, 20, 38);
      
      // Add leader info
      if (currentLeader) {
        doc.text(`Líder: ${currentLeader.name}`, 20, 46);
        doc.text(`Email: ${currentLeader.email}`, 20, 54);
      }
      
      // Statistics
      doc.setFontSize(14);
      doc.text("Estatísticas", 20, 64);
      doc.setFontSize(12);
      doc.text(`Total de inspeções: ${stats.totalInspections}`, 30, 74);
      doc.text(`Inspeções com problemas: ${stats.problemInspections}`, 30, 82);
      doc.text(`Total de problemas: ${stats.pendingActions}`, 30, 90);
      
      // Save PDF
      doc.save(`relatorio-setor-${currentLeader?.sector}-${format(new Date(), "dd-MM-yyyy")}.pdf`);
      
      toast({
        title: "PDF gerado com sucesso",
        description: "O relatório foi baixado para o seu computador",
      });
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast({
        title: "Erro ao gerar PDF",
        description: "Não foi possível gerar o relatório",
        variant: "destructive",
      });
    }
  };

  if (loading || supabaseLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-red-700 border-t-transparent"></div>
          <p className="mt-4 text-gray-600">Carregando dashboard de líderes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full text-center text-gray-900 sm:w-auto">
          <h1 className="text-2xl font-bold">
            Dashboard de Líderes
          </h1>
          <p>
            {currentLeader ? `${currentLeader.name} - ${currentLeader.sector}` : 'Dashboard'}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2 sm:justify-end">
          <Button 
            onClick={handleSendEmailNotification} 
            variant="outline" 
            className="flex items-center gap-2"
          >
            <Mail className="h-4 w-4" />
            Receber por Email
          </Button>
          <Button 
            onClick={exportReportToPDF} 
            variant="outline" 
            className="flex items-center gap-2"
          >
            <FileText className="h-4 w-4" />
            Exportar PDF
          </Button>
          <Button onClick={handleRefreshData} variant="outline" className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </Button>
          <Button 
            onClick={() => {
              localStorage.removeItem("checklistafm-leader-auth");
              localStorage.removeItem("checklistafm-leader-id");
              localStorage.removeItem("checklistafm-leader-sector");
              navigate("/leader/login");
            }} 
            variant="outline" 
            className="flex items-center gap-2 text-red-700 hover:text-red-800"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </div>
      </div>
      
      <Card className="border border-gray-200 bg-white">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <BellRing className="h-4 w-4 text-red-600" />
            Alertas críticos do checklist
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge
              variant={pendingAlertsCount > 0 ? "destructive" : "secondary"}
              className="text-xs px-2 py-0"
            >
              {pendingAlertsCount} pendente(s)
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center gap-1"
              onClick={refreshChecklistAlerts}
            >
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {alertsToShow.length === 0 ? (
            <p className="text-sm text-gray-600">
              Nenhum alerta crítico registrado para o seu setor.
            </p>
          ) : (
            alertsToShow.map((alert) => {
              const alreadySeen = alert.seenByLeaders?.includes(leaderId);
              return (
                <div
                  key={alert.id}
                  className="bg-white border border-red-100 rounded-md p-3 shadow-sm"
                >
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-gray-900">
                        {alert.question}
                      </p>
                      <div className="flex flex-wrap gap-3 text-xs text-gray-600">
                        <span>
                          Resposta:{" "}
                          <span className="text-red-600 font-medium">{alert.answer}</span>
                        </span>
                        {alert.operatorName && (
                          <span>
                            Operador: {alert.operatorName}
                            {alert.operatorMatricula ? ` (${alert.operatorMatricula})` : ""}
                          </span>
                        )}
                        {alert.equipmentName && (
                          <span>Equipamento: {alert.equipmentName}</span>
                        )}
                        <span>
                          Registrado em:{" "}
                          {format(new Date(alert.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Badge
                        variant={alreadySeen ? "secondary" : "destructive"}
                        className="px-2 py-0 text-xs"
                      >
                        {alreadySeen ? "Acompanhando" : "Pendente"}
                      </Badge>
                      {!alreadySeen && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAcknowledgeAlert(alert.id)}
                        >
                          Marcar como recebido
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
      
      <Card className="border border-gray-200 bg-white">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Wrench className="h-4 w-4 text-blue-600" />
            Ordens de Serviço do Setor
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={activeSectorOrders.length > 0 ? "destructive" : "secondary"}
              className="text-xs px-2 py-0"
            >
              {activeSectorOrders.length} em andamento
            </Badge>
            <Badge variant="outline" className="text-xs px-2 py-0">
              Histórico: {sectorMaintenanceOrders.length}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenMaintenanceDialog()}
              className="flex items-center gap-1 text-blue-700 border-blue-200 hover:bg-blue-50"
            >
              <Wrench className="h-4 w-4" />
              Registrar OS
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {sectorMaintenanceOrders.length === 0 ? (
            <p className="text-sm text-gray-600">
              Ainda não há ordens de serviço registradas para o seu setor.
            </p>
          ) : (
            <>
              {activeSectorOrders.length > 0 ? (
                <div className="space-y-2">
                  {activeSectorOrders.slice(0, 3).map((order) => (
                    <div
                      key={order.id}
                      className="border border-blue-200 bg-white rounded-md p-3 shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-blue-700">
                          OS #{order.orderNumber}
                        </span>
                        <Badge variant="destructive" className="text-[11px]">
                          Em andamento
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">
                        Aberta em {format(new Date(order.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </p>
                      {order.notes && (
                        <p className="text-xs text-gray-500 mt-1">
                          Obs.: {order.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-600">
                  Não há OS em andamento. Última OS:{" "}
                  {latestSectorOrder
                    ? `#${latestSectorOrder.orderNumber} • ${getMaintenanceOrderStatusLabel(latestSectorOrder.status)} em ${format(new Date(latestSectorOrder.updatedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}`
                    : "sem registros"}
                </p>
              )}

              <div className="text-xs text-gray-500">
                Histórico recente:
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                  {sectorMaintenanceOrders.slice(0, 4).map((order) => (
                    <span key={order.id}>
                      #{order.orderNumber} {getMaintenanceOrderStatusLabel(order.status)}
                    </span>
                  ))}
                </div>
              </div>
            </>
      )}
    </CardContent>
  </Card>
  
  <Dialog open={maintenanceDialogOpen} onOpenChange={setMaintenanceDialogOpen}>
    <DialogContent className="sm:max-w-[500px]">
      <DialogHeader>
        <DialogTitle>Registrar ordem de serviço</DialogTitle>
        <DialogDescription>
          Defina o equipamento, número e status para informar o administrativo.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-2">
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase text-gray-600">
            Equipamento
          </label>
          <Select
            value={maintenanceEquipmentId}
            onValueChange={handleEquipmentChangeInDialog}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione um equipamento" />
            </SelectTrigger>
            <SelectContent>
              {sectorEquipments.map((equipment) => (
                <SelectItem key={equipment.id} value={equipment.id}>
                  {equipment.name} (KP {equipment.kp})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase text-gray-600">
            Número da OS
          </label>
          <Input
            value={maintenanceOrderNumber}
            onChange={(event) => setMaintenanceOrderNumber(event.target.value)}
            placeholder="Informe o número da OS"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase text-gray-600">
            Status
          </label>
          <Select
            value={maintenanceStatus}
            onValueChange={(value) => setMaintenanceStatus(value as MaintenanceOrder["status"])}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Em andamento</SelectItem>
              <SelectItem value="closed">Finalizada</SelectItem>
              <SelectItem value="cancelled">Cancelada</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase text-gray-600">
            Observações (opcional)
          </label>
          <Textarea
            value={maintenanceNotes}
            onChange={(event) => setMaintenanceNotes(event.target.value)}
            rows={3}
            placeholder="Descreva o problema, equipe responsável ou prazo"
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => setMaintenanceDialogOpen(false)}>
          Cancelar
        </Button>
        <Button
          onClick={handleSaveMaintenanceOrderLeader}
          disabled={!maintenanceEquipmentId}
        >
          Salvar OS
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
  
  {supabaseError && (
    <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro de Conexão com Banco de Dados</AlertTitle>
          <AlertDescription>
            {supabaseError || "Não foi possível conectar ao banco de dados. Verifique as configurações ou contate o suporte técnico."}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2 bg-red-50">
            <CardTitle className="text-sm font-medium text-red-700">Problemas Identificados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700">{stats.pendingActions}</div>
            <p className="text-xs text-muted-foreground">
              Em {stats.problemInspections} inspeções com problemas
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2 bg-green-50">
            <CardTitle className="text-sm font-medium text-green-700">Total de Inspeções</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">{stats.totalInspections}</div>
            <p className="text-xs text-muted-foreground">
              Inspeções realizadas no setor
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2 bg-blue-50">
            <CardTitle className="text-sm font-medium text-blue-700">Taxa de Problemas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">
              {stats.totalInspections > 0 ? Math.round((stats.problemInspections / stats.totalInspections) * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              Inspeções com problemas identificados
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-4 mb-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Operador:</label>
          <Select value={operatorFilter} onValueChange={setOperatorFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Todos os operadores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os operadores</SelectItem>
              {operators.map((operator) => (
                <SelectItem key={operator.id} value={operator.id}>
                  {operator.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Período:</label>
          <Select value={timeRangeFilter} onValueChange={setTimeRangeFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Hoje</SelectItem>
              <SelectItem value="week">Última semana</SelectItem>
              <SelectItem value="month">Último mês</SelectItem>
              <SelectItem value="all">Todos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="problems" className="space-y-4">
        <TabsList>
          <TabsTrigger value="problems" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Problemas
          </TabsTrigger>
          <TabsTrigger value="chart" className="flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Gráfico
          </TabsTrigger>
          <TabsTrigger value="inspections" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Inspeções
          </TabsTrigger>
        </TabsList>

        <TabsContent value="problems">
          <Card>
            <CardHeader>
              <CardTitle>Problemas Identificados</CardTitle>
              <CardDescription>
                Lista de problemas encontrados nas inspeções do seu setor
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Equipamento</TableHead>
                    <TableHead>Operador</TableHead>
                    <TableHead>Problema</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProblems.map((problem) => (
                    <TableRow key={problem.id}>
                      <TableCell>{new Date(problem.date).toLocaleDateString()}</TableCell>
                      <TableCell>{problem.equipment} ({problem.equipmentKp})</TableCell>
                      <TableCell>{problem.operator}</TableCell>
                      <TableCell>{problem.problem}</TableCell>
                      <TableCell>
                        <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded">
                          {problem.status}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chart">
          <Card>
            <CardHeader>
              <CardTitle>Problemas por Equipamento</CardTitle>
              <CardDescription>
                Distribuição de problemas identificados por equipamento
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={problemsByEquipment}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="equipment" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="problemas" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inspections">
          <Card>
            <CardHeader>
              <CardTitle>Inspeções Recentes</CardTitle>
              <CardDescription>
                Últimas inspeções realizadas no seu setor
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Equipamento</TableHead>
                    <TableHead>Operador</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inspections.slice(0, 10).map((inspection) => {
                    const hasProblems = inspection.checklist_answers.some(answer => answer.answer === 'Não');
                    return (
                      <TableRow key={inspection.id}>
                        <TableCell>{new Date(inspection.inspection_date).toLocaleDateString()}</TableCell>
                        <TableCell>{inspection.equipment.name} ({inspection.equipment.kp})</TableCell>
                        <TableCell>{inspection.operator.name}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 text-xs rounded ${
                            hasProblems 
                              ? 'bg-red-100 text-red-800' 
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {hasProblems ? 'Com Problemas' : 'OK'}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default LeaderDashboard;
