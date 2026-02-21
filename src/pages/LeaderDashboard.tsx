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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
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
  RefreshCw,
  AlertTriangle,
  Calendar as CalendarIcon
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSupabaseData } from "@/hooks/useSupabaseData";
import InspectionBoardPanel from "@/components/inspection/InspectionBoardPanel";
import { format, startOfDay, endOfDay, subDays, subMonths, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";
import { loadChecklistAlerts, saveChecklistAlerts } from "@/lib/checklistTemplate";
import { loadMaintenanceOrders, upsertMaintenanceOrder, deleteMaintenanceOrdersByEquipment } from "@/lib/maintenanceOrders";
import {
  buildInspectionBoard,
  calculateInspectionBoardStats,
  type InspectionBoardInspectionEntry,
} from "@/lib/inspectionBoard";
import type { ChecklistAlert, MaintenanceOrder } from "@/lib/types";
import { applyAlertRuleToItem, shouldTriggerAlert } from "@/lib/alertRules";
import { operatorService, type Operator as SupabaseOperator } from "@/lib/supabase-service";
import type { DateRange } from "react-day-picker";

// Types
interface Inspection {
  id: string;
  equipment: {
    name: string;
    kp: string;
    sector: string;
  };
  equipmentId: string;
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
  equipmentId: string;
  operator: string;
  operatorMatricula: string;
  problem: string;
  comments: string;
  date: string;
  status: string;
  answer?: string;
}

const LOCAL_PROFILE_KEY = "checklistafm-leader-local-profile";

const LeaderDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Use Supabase data hook
  const { 
    inspections: supabaseInspections, 
    equipment: supabaseEquipment, 
    operators: supabaseOperators,
    leaders: supabaseLeaders,
    sectors: supabaseSectors,
    sectorLeaderAssignments: supabaseSectorLeaderAssignments,
    loading: supabaseLoading,
    error: supabaseError,
    refresh
  } = useSupabaseData([
    "inspections",
    "equipment",
    "operators",
    "leaders",
    "sectors",
    "sectorLeaderAssignments",
  ]);
  
  // States
  const [loading, setLoading] = useState(true);
  const [currentLeader, setCurrentLeader] = useState<Leader | null>(null);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [problemsList, setProblemsList] = useState<ProblemEntry[]>([]);
  const [operatorFilter, setOperatorFilter] = useState<string>("all");
  const [timeRangeFilter, setTimeRangeFilter] = useState<string>("week");
  const [operators, setOperators] = useState<{id: string, name: string}[]>([]);
  const [checklistAlerts, setChecklistAlerts] = useState<ChecklistAlert[]>([]);
  const [maintenanceOrders, setMaintenanceOrders] = useState<MaintenanceOrder[]>([]);
  const [maintenanceDialogOpen, setMaintenanceDialogOpen] = useState(false);
  const [maintenanceEquipmentId, setMaintenanceEquipmentId] = useState<string>("");
  const [maintenanceInspectionId, setMaintenanceInspectionId] = useState<string | null>(null);
  const [maintenanceOrderId, setMaintenanceOrderId] = useState<string | null>(null);
  const [maintenanceOrderNumber, setMaintenanceOrderNumber] = useState("");
  const [maintenanceStatus, setMaintenanceStatus] = useState<MaintenanceOrder["status"]>("open");
  const [maintenanceNotes, setMaintenanceNotes] = useState("");
  const [selectedEquipmentFilter, setSelectedEquipmentFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [inspectionDialogOpen, setInspectionDialogOpen] = useState(false);
  const [inspectionToView, setInspectionToView] = useState<Inspection | null>(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [operatorToReset, setOperatorToReset] = useState<{ id: string; name: string } | null>(null);
  const [newOperatorPassword, setNewOperatorPassword] = useState("");
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [showEquipmentList, setShowEquipmentList] = useState(false);
  const [showOperatorList, setShowOperatorList] = useState(false);
  const [osFilter, setOsFilter] = useState<"all" | "with-open" | "without-open">("all");
  const [sectorSummaryFilter, setSectorSummaryFilter] = useState<"all" | "with-os" | "without-os">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const normalizeSector = (value?: string | null) =>
    value
      ? value
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .trim()
          .toLowerCase()
      : "";

  const leaderSectorKeys = useMemo(() => {
    if (!currentLeader?.sector) return [] as string[];
    return currentLeader.sector
      .split(/[,;/]/)
      .map((value) => normalizeSector(value))
      .filter((value): value is string => Boolean(value));
  }, [currentLeader]);

  const leaderAssignmentSectorIds = useMemo<string[]>(() => {
    if (!currentLeader || !Array.isArray(supabaseSectorLeaderAssignments)) {
      return [];
    }
    return supabaseSectorLeaderAssignments
      .filter((assignment) => assignment.leader_id === currentLeader.id)
      .map((assignment) => assignment.sector_id)
      .filter((id): id is string => Boolean(id));
  }, [supabaseSectorLeaderAssignments, currentLeader]);

  const sectorIdToNormalizedName = useMemo(() => {
    const map = new Map<string, string>();
    supabaseSectors.forEach((sector) => {
      map.set(sector.id, normalizeSector(sector.name));
    });
    return map;
  }, [supabaseSectors]);

  const assignmentSectorNameSet = useMemo(() => {
    const set = new Set<string>();
    leaderAssignmentSectorIds.forEach((id) => {
      const normalized = sectorIdToNormalizedName.get(id);
      if (normalized) {
        set.add(normalized);
      }
    });
    return set;
  }, [leaderAssignmentSectorIds, sectorIdToNormalizedName]);

  const allowedSectorNames = useMemo(() => {
    const names = new Set<string>();
    leaderSectorKeys.forEach((name) => names.add(name));
    assignmentSectorNameSet.forEach((name) => names.add(name));
    return names;
  }, [leaderSectorKeys, assignmentSectorNameSet]);

  const hasGlobalSectorAccess = useMemo(
    () => allowedSectorNames.has("todos"),
    [allowedSectorNames],
  );

  const allowedEquipmentIds = useMemo<string[]>(() => {
    if (hasGlobalSectorAccess) {
      return supabaseEquipment.map((equipment) => equipment.id);
    }

    const allowed = new Set<string>();

    supabaseEquipment.forEach((equipment) => {
      const sectorNormalized = normalizeSector(equipment.sector);
      if (sectorNormalized && allowedSectorNames.has(sectorNormalized)) {
        allowed.add(equipment.id);
      }
    });

    return Array.from(allowed);
  }, [supabaseEquipment, allowedSectorNames, hasGlobalSectorAccess]);

  const allowedEquipmentSet = useMemo(() => new Set(allowedEquipmentIds), [allowedEquipmentIds]);

  const handleMaintenanceDialogOpenChange = (open: boolean) => {
    setMaintenanceDialogOpen(open);
    if (!open) {
      setMaintenanceInspectionId(null);
      setMaintenanceOrderId(null);
      setMaintenanceOrderNumber("");
      setMaintenanceStatus("open");
      setMaintenanceNotes("");
    }
  };

  const handleTimeRangeChange = (value: string) => {
    setTimeRangeFilter(value);
    if (value === "custom") {
      setCalendarOpen(true);
    }
  };

  const handleInspectionDialogOpenChange = (open: boolean) => {
    setInspectionDialogOpen(open);
    if (!open) {
      setInspectionToView(null);
    }
  };

  const matchesDateFilter = useCallback(
    (rawDate: Date | null | undefined) => {
      if (!rawDate || Number.isNaN(rawDate.getTime())) {
        return true;
      }

      const now = new Date();
      const intervalEnd = endOfDay(now);

      switch (timeRangeFilter) {
        case "day":
          return isWithinInterval(rawDate, {
            start: startOfDay(now),
            end: intervalEnd,
          });
        case "week": {
          const start = startOfDay(subDays(now, 7));
          return rawDate >= start && rawDate <= intervalEnd;
        }
        case "month": {
          const start = startOfDay(subMonths(now, 1));
          return rawDate >= start && rawDate <= intervalEnd;
        }
        case "custom":
          if (dateRange?.from && dateRange?.to) {
            return isWithinInterval(rawDate, {
              start: startOfDay(dateRange.from),
              end: endOfDay(dateRange.to),
            });
          }
          return true;
        default:
          return true;
      }
    },
    [timeRangeFilter, dateRange]
  );
  
  const refreshChecklistAlerts = useCallback(() => {
    if (!currentLeader) return;

    const generatedAlerts: ChecklistAlert[] = [];

    inspections.forEach((inspection) => {
      if (!inspection.checklist_answers || inspection.checklist_answers.length === 0) {
        return;
      }

      inspection.checklist_answers.forEach((answer, index) => {
        const hasAlert = shouldTriggerAlert(
          answer.question,
          answer.answer,
          { onYes: answer.alertOnYes, onNo: answer.alertOnNo }
        );

        if (!hasAlert) {
          return;
        }

        const alertId = `${inspection.id}-${answer.question || index}`;
        const rawAnswer = (answer.answer ?? "").trim();
        const normalizedLower = rawAnswer
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase();
        const answerLabel =
          normalizedLower === "sim"
            ? "Sim"
            : normalizedLower === "nao"
            ? "Não"
            : rawAnswer || "N/A";

        generatedAlerts.push({
          id: alertId,
          questionId: answer.question || String(index),
          question: answer.question || `Pergunta ${index + 1}`,
          answer: answerLabel,
          inspectionId: inspection.id,
          operatorName: inspection.operator.name !== "N/A" ? inspection.operator.name : undefined,
          operatorMatricula: inspection.operator.matricula !== "N/A" ? inspection.operator.matricula : undefined,
          equipmentName: inspection.equipment.name,
          sector:
            inspection.equipment.sector || currentLeader.sector || undefined,
          createdAt: inspection.submission_date || inspection.inspection_date,
          seenByAdmin: false,
          seenByLeaders: [],
        });
      });
    });

    const mergedAlerts = new Map<string, ChecklistAlert>();

    generatedAlerts.forEach((alert) => {
      mergedAlerts.set(alert.id, {
        ...alert,
        seenByLeaders: alert.seenByLeaders ?? [],
      });
    });

    const localAlerts = loadChecklistAlerts().filter((alert) => {
      if (!alert.sector) return true;
      if (hasGlobalSectorAccess) return true;
      const normalized = normalizeSector(alert.sector);
      return !normalized || allowedSectorNames.has(normalized);
    });

    localAlerts.forEach((storedAlert) => {
      const existing = mergedAlerts.get(storedAlert.id);
      if (!existing) {
        return;
      }

      const combinedSeenByLeaders = new Set([
        ...(existing.seenByLeaders ?? []),
        ...(storedAlert.seenByLeaders ?? []),
      ]);

      mergedAlerts.set(storedAlert.id, {
        ...existing,
        seenByAdmin: existing.seenByAdmin || storedAlert.seenByAdmin || false,
        seenByLeaders: Array.from(combinedSeenByLeaders),
        createdAt: existing.createdAt ?? storedAlert.createdAt,
      });
    });

    const sortedAlerts = Array.from(mergedAlerts.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    saveChecklistAlerts(sortedAlerts);
    setChecklistAlerts(sortedAlerts);
  }, [currentLeader, inspections, allowedSectorNames, hasGlobalSectorAccess]);
  
  const loadDashboardData = useCallback(() => {
    if (!currentLeader) return;

    setLoading(true);
    
    try {
      const allowedEquipmentIdsSet = allowedEquipmentSet;
      const sectorEquipmentIds = Array.from(allowedEquipmentIdsSet);
      const sectorEquipments = supabaseEquipment.filter((equipment) =>
        allowedEquipmentIdsSet.has(equipment.id)
      );

      const operatorsByMatricula = new Map(
        supabaseOperators.map(op => [op.matricula, op])
      );

      // Filter inspections by allowed equipment ids
      const sectorInspections = supabaseInspections.filter(
        (inspection) => allowedEquipmentIdsSet.has(inspection.equipment_id)
      );

      // Process inspections to match expected format
      const processedInspections = sectorInspections.map(inspection => {
        const equipment =
          inspection.equipment ??
          sectorEquipments.find(eq => eq.id === inspection.equipment_id);
        const resolvedEquipmentId = equipment?.id ?? inspection.equipment_id ?? "";
        const operatorFromJoin = inspection.operator;
        const operator =
          operatorFromJoin ??
          (inspection.operator_matricula
            ? operatorsByMatricula.get(inspection.operator_matricula)
            : undefined);
        
        // Ensure checklist_answers is an array
        let checklistAnswers: Inspection["checklist_answers"] = [];
        if (Array.isArray(inspection.checklist_answers)) {
          checklistAnswers = (inspection.checklist_answers as Inspection["checklist_answers"]).map(
            (answerItem, answerIndex) =>
              applyAlertRuleToItem({
                ...answerItem,
                question:
                  answerItem.question && answerItem.question.trim().length > 0
                    ? answerItem.question
                    : `Pergunta ${answerIndex + 1}`,
              })
          );
        }
        
        return {
          id: inspection.id,
          equipment: {
            name: equipment?.name || 'N/A',
            kp: equipment?.kp || 'N/A',
            sector: equipment?.sector || 'N/A'
          },
          equipmentId: resolvedEquipmentId,
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
          const triggersAlert = shouldTriggerAlert(
            answer.question,
            answer.answer,
            { onYes: answer.alertOnYes, onNo: answer.alertOnNo }
          );

          if (!triggersAlert) {
            return;
          }

          const rawAnswer = (answer.answer ?? "").trim();
          const normalizedLower = rawAnswer
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase();
          const answerLabel =
            normalizedLower === "sim"
              ? "Sim"
              : normalizedLower === "nao"
              ? "Não"
              : rawAnswer || "N/A";

          problems.push({
            id: `${inspection.id}-${answer.question}`,
            inspectionId: inspection.id,
            equipment: inspection.equipment.name,
            equipmentKp: inspection.equipment.kp,
            equipmentId: inspection.equipmentId,
            operator: inspection.operator.name,
            operatorMatricula: inspection.operator.matricula,
            problem: answer.question,
            comments: answer.comments || inspection.comments || 'Nenhum comentário',
            date: inspection.inspection_date,
            status: 'Identificado',
            answer: answerLabel,
          });

          // Count problems by equipment
          const equipmentKey = inspection.equipment.name;
          equipmentProblems[equipmentKey] = (equipmentProblems[equipmentKey] || 0) + 1;
        });
      });

      setProblemsList(problems);

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
  }, [currentLeader, supabaseEquipment, supabaseInspections, supabaseOperators, toast, allowedEquipmentIds]);

  // Authentication and initial setup
  useEffect(() => {
    const checkAuthentication = async () => {
      const isAuthenticated = localStorage.getItem("checklistafm-leader-auth");
      const leaderId = localStorage.getItem("checklistafm-leader-id");
      const leaderSector = localStorage.getItem("checklistafm-leader-sector") || "";
      const localProfileRaw = localStorage.getItem(LOCAL_PROFILE_KEY);
      
      if (!isAuthenticated || !leaderId) {
        navigate("/leader/login");
        return;
      }

      // Load leader data from Supabase
      if (!supabaseLoading) {
        const leader = supabaseLeaders.find(l => l.id === leaderId);
        if (leader) {
          setCurrentLeader({
            id: leader.id,
            name: leader.name,
            email: leader.email,
            sector: leader.sector
          });
          return;
        }

        if (leaderId === "__local_super__" && localProfileRaw) {
          try {
            const parsed = JSON.parse(localProfileRaw);
            setCurrentLeader({
              id: parsed.id || "__local_super__",
              name: parsed.name || "Usuario Local",
              email: parsed.email || "teste@local",
              sector: parsed.sector || leaderSector || "TODOS",
            });
            return;
          } catch (error) {
            console.error("Erro ao carregar perfil local de lider:", error);
          }
        }

        if (leaderSector) {
          setCurrentLeader({
            id: leaderId,
            name: "Lider Local",
            email: "local@checklist",
            sector: leaderSector,
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

  const handleRefreshData = () => {
    refresh(); // Refresh Supabase data
    refreshChecklistAlerts();
    setMaintenanceOrders(loadMaintenanceOrders());
    toast({
      title: "Dados atualizados",
      description: "Dashboard atualizado com sucesso",
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

  const handleOpenInspectionDetails = (inspection: Inspection) => {
    setInspectionToView(inspection);
    setInspectionDialogOpen(true);
  };

  const handleOpenMaintenanceDialog = (options?: {
    equipmentId?: string;
    inspectionId?: string;
    suggestedOrderNumber?: string | null;
    suggestedNotes?: string | null;
  }) => {
    if (!sectorEquipments.length) {
      toast({
        title: "Sem equipamentos disponíveis",
        description: "Nenhum equipamento foi encontrado para o seu setor.",
        variant: "destructive",
      });
      return;
    }

    const selectedId = options?.equipmentId ?? sectorEquipments[0]?.id ?? "";
    if (!selectedId) {
      toast({
        title: "Equipamento não encontrado",
        description: "Não foi possível localizar o equipamento para registrar a OS.",
        variant: "destructive",
      });
      return;
    }

    const ordersForEquipment = maintenanceOrders
      .filter(order => order.equipmentId === selectedId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    const inspectionOrder = options?.inspectionId
      ? ordersForEquipment.find(order => order.inspectionId === options.inspectionId)
      : undefined;
    const activeOrder = ordersForEquipment.find(order => order.status === "open");
    const latestOrder = ordersForEquipment[0];
    const orderToUse = inspectionOrder ?? activeOrder ?? latestOrder;

    setMaintenanceEquipmentId(selectedId);
    setMaintenanceInspectionId(options?.inspectionId ?? orderToUse?.inspectionId ?? null);
    setMaintenanceOrderId(orderToUse?.id ?? null);
    setMaintenanceOrderNumber(
      orderToUse?.orderNumber ?? options?.suggestedOrderNumber ?? ""
    );
    setMaintenanceStatus(orderToUse?.status ?? "open");
    setMaintenanceNotes(
      orderToUse?.notes ?? options?.suggestedNotes ?? ""
    );
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
    setMaintenanceInspectionId(null);
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
      maintenanceInspectionId ??
      existingOrder?.inspectionId ??
      `equipment-${maintenanceEquipmentId}-${Date.now()}`;

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
    handleMaintenanceDialogOpenChange(false);

    toast({
      title: maintenanceStatus === "closed" ? "OS finalizada" : "OS atualizada",
      description: `OS #${order.orderNumber} marcada como ${getMaintenanceOrderStatusLabel(order.status)}.`,
    });
  };

  const handleDeleteMaintenanceOrders = () => {
    if (!maintenanceEquipmentId) return;

    const equipmentName =
      sectorEquipments.find((equipment) => equipment.id === maintenanceEquipmentId)?.name ??
      "este equipamento";
    const confirmationMessage = `Remover todas as ordens de serviço do equipamento "${equipmentName}"?`;
    const confirmed =
      typeof window === "undefined" ? true : window.confirm(confirmationMessage);

    if (!confirmed) {
      return;
    }

    const updatedOrders = deleteMaintenanceOrdersByEquipment(maintenanceEquipmentId);
    setMaintenanceOrders(updatedOrders);
    setMaintenanceOrderId(null);
    setMaintenanceInspectionId(null);
    setMaintenanceOrderNumber("");
    setMaintenanceStatus("open");
    setMaintenanceNotes("");
    handleMaintenanceDialogOpenChange(false);

    toast({
      title: "OS removidas",
      description: "Todas as OS deste equipamento foram excluídas.",
    });
  };

  const handleOpenResetPasswordDialog = (operator: SupabaseOperator) => {
    setOperatorToReset({
      id: operator.matricula,
      name: operator.name || operator.matricula,
    });
    setNewOperatorPassword("");
    setResetDialogOpen(true);
  };

  const handleResetDialogOpenChange = (open: boolean) => {
    setResetDialogOpen(open);
    if (!open) {
      setOperatorToReset(null);
      setNewOperatorPassword("");
      setIsResettingPassword(false);
    }
  };

  const handleResetOperatorPassword = async () => {
    if (!operatorToReset) return;

    const trimmedPassword = newOperatorPassword.trim();
    if (!trimmedPassword) {
      toast({
        title: "Informe a nova senha",
        description: "Digite uma nova senha para o operador selecionado.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsResettingPassword(true);
      await operatorService.update(operatorToReset.id, { senha: trimmedPassword });
      toast({
        title: "Senha redefinida",
        description: `A senha de ${operatorToReset.name} foi atualizada com sucesso.`,
      });
      handleResetDialogOpenChange(false);
      refresh();
    } catch (error) {
      console.error("Erro ao resetar senha do operador:", error);
      toast({
        title: "Erro ao resetar senha",
        description: "Não foi possível atualizar a senha. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsResettingPassword(false);
    }
  };


  const leaderId = currentLeader?.id ?? "";

  const alertsByInspection = useMemo(() => {
    if (!checklistAlerts.length) {
      return [];
    }

    const grouped = new Map<
      string,
      {
        inspectionId: string;
        alerts: ChecklistAlert[];
        latestCreatedAt: string;
        equipmentName?: string;
        operatorName?: string;
        operatorMatricula?: string;
      }
    >();

    checklistAlerts.forEach((alert) => {
      const inspectionId =
        alert.inspectionId ||
        (alert.id.includes("-") ? alert.id.split("-")[0] : alert.id);
      const createdAt =
        alert.createdAt ?? new Date().toISOString();

      const existing = grouped.get(inspectionId);
      if (existing) {
        existing.alerts.push(alert);
        if (!existing.equipmentName && alert.equipmentName) {
          existing.equipmentName = alert.equipmentName;
        }
        if (!existing.operatorName && alert.operatorName) {
          existing.operatorName = alert.operatorName;
        }
        if (!existing.operatorMatricula && alert.operatorMatricula) {
          existing.operatorMatricula = alert.operatorMatricula;
        }
        if (
          new Date(createdAt).getTime() >
          new Date(existing.latestCreatedAt).getTime()
        ) {
          existing.latestCreatedAt = createdAt;
        }
        grouped.set(inspectionId, existing);
      } else {
        grouped.set(inspectionId, {
          inspectionId,
          alerts: [alert],
          latestCreatedAt: createdAt,
          equipmentName: alert.equipmentName,
          operatorName: alert.operatorName,
          operatorMatricula: alert.operatorMatricula,
        });
      }
    });

    return Array.from(grouped.values()).sort(
      (a, b) =>
        new Date(b.latestCreatedAt).getTime() -
        new Date(a.latestCreatedAt).getTime()
    );
  }, [checklistAlerts]);

  const pendingAlertsCount = alertsByInspection.filter((entry) =>
    entry.alerts.some(
      (alert) => !alert.seenByLeaders?.includes(leaderId)
    )
  ).length;

  const sectorEquipments = useMemo(() => {
    if (!currentLeader) return [];
    return supabaseEquipment.filter((equipment) =>
      allowedEquipmentSet.has(equipment.id)
    );
  }, [supabaseEquipment, currentLeader, allowedEquipmentSet]);

  const openOrdersByInspection = useMemo(() => {
    return new Set(
      maintenanceOrders
        .filter((order) => order.status === "open")
        .map((order) => order.inspectionId)
    );
  }, [maintenanceOrders]);

  useEffect(() => {
    if (
      selectedEquipmentFilter !== "all" &&
      !sectorEquipments.some((equipment) => equipment.id === selectedEquipmentFilter)
    ) {
      setSelectedEquipmentFilter("all");
    }
  }, [sectorEquipments, selectedEquipmentFilter]);
  const sectorMaintenanceOrders = useMemo(() => {
    if (!currentLeader) return [];
    return maintenanceOrders
      .filter((order) => allowedEquipmentSet.has(order.equipmentId))
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
  }, [maintenanceOrders, currentLeader, allowedEquipmentSet]);
  const activeSectorOrders = sectorMaintenanceOrders.filter(
    (order) => order.status === "open"
  );
  const latestSectorOrder = sectorMaintenanceOrders[0];
  const hasOrdersForSelectedEquipment = maintenanceEquipmentId
    ? maintenanceOrders.some(order => order.equipmentId === maintenanceEquipmentId)
    : false;
  const filteredInspections = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return inspections.filter((inspection) => {
      const matchesOperatorFilter =
        operatorFilter === "all" ||
        inspection.operator.matricula === operatorFilter;

      const matchesEquipment =
        selectedEquipmentFilter === "all" ||
        inspection.equipmentId === selectedEquipmentFilter;

      const dateValue = inspection.submission_date || inspection.inspection_date;
      const inspectionDate = dateValue ? new Date(dateValue) : null;

      const hasOpenOrder = openOrdersByInspection.has(inspection.id);
      const matchesSearch =
        normalizedSearch.length === 0 ||
        inspection.operator.name.toLowerCase().includes(normalizedSearch) ||
        inspection.operator.matricula.toLowerCase().includes(normalizedSearch) ||
        inspection.equipment.name.toLowerCase().includes(normalizedSearch) ||
        inspection.equipment.kp.toLowerCase().includes(normalizedSearch);
      const matchesOsFilter =
        osFilter === "all" ||
        (osFilter === "with-open" && hasOpenOrder) ||
        (osFilter === "without-open" &&
          inspection.checklist_answers?.some((answer) =>
            shouldTriggerAlert(
              answer.question,
              answer.answer,
              { onYes: answer.alertOnYes, onNo: answer.alertOnNo }
            )
          ) &&
          !hasOpenOrder);

      return (
        matchesOperatorFilter &&
        matchesEquipment &&
        matchesDateFilter(inspectionDate) &&
        matchesOsFilter &&
        matchesSearch
      );
    });
  }, [inspections, operatorFilter, selectedEquipmentFilter, matchesDateFilter, osFilter, openOrdersByInspection, searchTerm]);

  const filteredProblems = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return problemsList.filter((problem) => {
      const matchesOperatorFilter =
        operatorFilter === "all" ||
        problem.operatorMatricula === operatorFilter;

      const matchesEquipment =
        selectedEquipmentFilter === "all" ||
        problem.equipmentId === selectedEquipmentFilter;

      const problemDate = problem.date ? new Date(problem.date) : null;

      const hasOpenOrder = openOrdersByInspection.has(problem.inspectionId);
      const matchesSearch =
        normalizedSearch.length === 0 ||
        problem.operator.toLowerCase().includes(normalizedSearch) ||
        (problem.operatorMatricula || "").toLowerCase().includes(normalizedSearch) ||
        problem.equipment.toLowerCase().includes(normalizedSearch) ||
        (problem.equipmentKp || "").toLowerCase().includes(normalizedSearch);
      const matchesOsFilter =
        osFilter === "all" ||
        (osFilter === "with-open" && hasOpenOrder) ||
        (osFilter === "without-open" && !hasOpenOrder);

      return (
        matchesOperatorFilter &&
        matchesEquipment &&
        matchesDateFilter(problemDate) &&
        matchesOsFilter &&
        matchesSearch
      );
    });
  }, [problemsList, operatorFilter, selectedEquipmentFilter, matchesDateFilter, osFilter, openOrdersByInspection, searchTerm]);

  const filteredStats = useMemo(() => {
    const problemInspectionsCount = new Set(
      filteredProblems.map((problem) => problem.inspectionId)
    ).size;

    return {
      totalInspections: filteredInspections.length,
      problemInspections: problemInspectionsCount,
      pendingActions: filteredProblems.length,
    };
  }, [filteredInspections, filteredProblems]);

  const boardBySector = useMemo(
    () =>
      buildInspectionBoard({
        equipments: sectorEquipments,
        inspections,
        getInspectionEquipmentId: (inspection, index) =>
          inspection.equipmentId ||
          `${inspection.equipment.name}-${inspection.equipment.kp}-${inspection.id || index}`,
        getInspectionEquipmentMeta: (inspection) => inspection.equipment,
        getInspectionDate: (inspection) =>
          inspection.submission_date || inspection.inspection_date,
        getInspectionHasProblems: (inspection) =>
          inspection.checklist_answers.some((answer) =>
            shouldTriggerAlert(
              answer.question,
              answer.answer,
              { onYes: answer.alertOnYes, onNo: answer.alertOnNo },
            ),
          ),
        getInspectionHasOpenOrder: (inspection) =>
          openOrdersByInspection.has(inspection.id),
      }),
    [sectorEquipments, inspections, openOrdersByInspection],
  );

  const boardStats = useMemo(
    () => calculateInspectionBoardStats(boardBySector),
    [boardBySector],
  );

  const leaderSectorSummary = useMemo(() => {
    if (!inspections || inspections.length === 0) {
      return {
        sectors: [] as Array<{
          sector: string;
          totalInspections: number;
          inspectionsWithProblems: number;
          inspectionsWithoutOS: number;
        }>,
        total: 0,
        totalWithProblems: 0,
        totalWithoutOS: 0,
        totalWithoutProblems: 0,
      };
    }

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

    inspections.forEach((inspection) => {
      const sectorName = inspection.equipment?.sector || "Sem setor";
      const hasProblems = inspection.checklist_answers.some((answer) =>
        shouldTriggerAlert(
          answer.question,
          answer.answer,
          { onYes: answer.alertOnYes, onNo: answer.alertOnNo },
        ),
      );
      const hasOpenOrder = openOrdersByInspection.has(inspection.id);

      if (hasProblems) {
        inspectionsWithProblemsTotal += 1;
        if (!hasOpenOrder) {
          inspectionsWithoutOSTotal += 1;
        }
      }

      const existing = summaryMap.get(sectorName);
      if (existing) {
        existing.totalInspections += 1;
        if (hasProblems) {
          existing.inspectionsWithProblems += 1;
          if (!hasOpenOrder) {
            existing.inspectionsWithoutOS += 1;
          }
        }
      } else {
        summaryMap.set(sectorName, {
          sector: sectorName,
          totalInspections: 1,
          inspectionsWithProblems: hasProblems ? 1 : 0,
          inspectionsWithoutOS: hasProblems && !hasOpenOrder ? 1 : 0,
        });
      }
    });

    const sectors = Array.from(summaryMap.values()).sort((a, b) =>
      a.sector.localeCompare(b.sector, "pt-BR"),
    );

    return {
      sectors,
      total: inspections.length,
      totalWithProblems: inspectionsWithProblemsTotal,
      totalWithoutOS: inspectionsWithoutOSTotal,
      totalWithoutProblems: Math.max(inspections.length - inspectionsWithProblemsTotal, 0),
    };
  }, [inspections, openOrdersByInspection]);

  const filteredLeaderSectors = useMemo(() => {
    switch (sectorSummaryFilter) {
      case "without-os":
        return leaderSectorSummary.sectors.filter(
          (sector) => sector.inspectionsWithoutOS > 0,
        );
      case "with-os":
        return leaderSectorSummary.sectors.filter(
          (sector) =>
            sector.inspectionsWithProblems > 0 &&
            sector.inspectionsWithProblems > sector.inspectionsWithoutOS,
        );
      default:
        return leaderSectorSummary.sectors;
    }
  }, [leaderSectorSummary.sectors, sectorSummaryFilter]);

  const getLeaderBoardRowClass = (entry: InspectionBoardInspectionEntry<Inspection>) => {
    if (!entry.hasProblems && entry.isToday) return "bg-green-100";
    if (entry.hasProblems) return entry.hasOpenOrder ? "bg-amber-100" : "bg-red-100";
    return "bg-white";
  };

  const getLeaderBoardDotClass = (entry: InspectionBoardInspectionEntry<Inspection>) => {
    if (!entry.hasProblems) {
      return entry.isToday ? "bg-green-500" : "bg-gray-300";
    }
    return entry.hasOpenOrder ? "bg-yellow-500" : "bg-red-500";
  };

  const filteredProblemsByEquipment = useMemo(() => {
    const counts = new Map<string, number>();
    filteredProblems.forEach((problem) => {
      counts.set(problem.equipment, (counts.get(problem.equipment) || 0) + 1);
    });
    return Array.from(counts.entries()).map(([equipment, count]) => ({
      equipment,
      problemas: count,
    }));
  }, [filteredProblems]);

  const lastInspectionByEquipment = useMemo(() => {
    const map = new Map<string, { date: Date; operator: string }>();
    inspections.forEach((inspection) => {
      const dateValue = inspection.submission_date || inspection.inspection_date;
      if (!dateValue) return;
      const date = new Date(dateValue);
      if (Number.isNaN(date.getTime())) return;
      const existing = map.get(inspection.equipmentId);
      if (!existing || date > existing.date) {
        map.set(inspection.equipmentId, {
          date,
          operator: inspection.operator.name,
        });
      }
    });
    return map;
  }, [inspections]);

  const activeOrdersByEquipment = useMemo(() => {
    return new Set(
      maintenanceOrders
        .filter((order) => order.status === "open")
        .map((order) => order.equipmentId)
    );
  }, [maintenanceOrders]);

  const sectorOperatorsList = useMemo(() => {
    if (!currentLeader) return [];
    return supabaseOperators.filter((operator) => {
      if (!operator.setor) return false;
      const operatorSectorKeys = operator.setor
        .split(/[,;/]/)
        .map((value) => normalizeSector(value))
        .filter((value): value is string => Boolean(value));

      return operatorSectorKeys.some((sector) =>
        allowedSectorNames.has(sector)
      );
    });
  }, [supabaseOperators, currentLeader, allowedSectorNames]);

  const inspectionDetailData = useMemo(() => {
    if (!inspectionToView) {
      return {
        answers: [] as Array<
          Inspection["checklist_answers"][number] & { triggersAlert: boolean }
        >,
        alerts: 0,
      };
    }

    const answers = inspectionToView.checklist_answers.map((answer, index) => {
      const question =
        answer.question && answer.question.trim().length > 0
          ? answer.question
          : `Pergunta ${index + 1}`;

      const triggersAlert = shouldTriggerAlert(
        question,
        answer.answer,
        { onYes: answer.alertOnYes, onNo: answer.alertOnNo }
      );

      return {
        ...answer,
        question,
        triggersAlert,
      };
    });

    const alerts = answers.filter((answer) => answer.triggersAlert).length;

    return { answers, alerts };
  }, [inspectionToView]);
  const { answers: inspectionDetailAnswers, alerts: inspectionAlertsCount } =
    inspectionDetailData;
  const criticalInspectionAnswers = useMemo(
    () => inspectionDetailAnswers.filter((answer) => answer.triggersAlert),
    [inspectionDetailAnswers]
  );
  const inspectionDetailDateLabel = useMemo(() => {
    if (!inspectionToView) return "-";
    const dateValue =
      inspectionToView.submission_date || inspectionToView.inspection_date;
    if (!dateValue) return "-";
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) {
      return "-";
    }
    return format(date, "dd/MM/yyyy HH:mm", { locale: ptBR });
  }, [inspectionToView]);

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
      doc.text(`Total de inspeções: ${filteredStats.totalInspections}`, 30, 74);
      doc.text(`Inspeções com problemas: ${filteredStats.problemInspections}`, 30, 82);
      doc.text(`Total de problemas: ${filteredStats.pendingActions}`, 30, 90);
      
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
    <div className="space-y-6 pb-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard de Líderes</h1>
          <p className="text-sm text-muted-foreground">
            {currentLeader ? `${currentLeader.name} - ${currentLeader.sector}` : "Dashboard"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={handleRefreshData} variant="outline" className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </Button>
          <Button onClick={exportReportToPDF} variant="outline" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Exportar PDF
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
            className="flex items-center gap-2 text-red-700 hover:text-red-800"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </div>
      </div>

      <InspectionBoardPanel
        title="Painel por setor"
        description="Visão consolidada por setor e equipamento. Clique em uma linha para abrir a inspeção."
        emptyMessage="Nenhuma inspeção encontrada para os setores liberados."
        boardBySector={boardBySector}
        boardStats={boardStats}
        getRowClass={getLeaderBoardRowClass}
        getDotClass={getLeaderBoardDotClass}
        onInspectionClick={(inspection) => {
          if (inspection.id) {
            navigate(`/leader/checklists/${inspection.id}`);
            return;
          }
          handleOpenInspectionDetails(inspection);
        }}
      />

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total de Inspeções</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{leaderSectorSummary.total}</div>
            <p className="text-xs text-muted-foreground">Realizadas no setor</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Operadores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sectorOperatorsList.length}</div>
            <p className="text-xs text-muted-foreground">Vinculados ao setor</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Equipamentos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sectorEquipments.length}</div>
            <p className="text-xs text-muted-foreground">Monitorados no setor</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Setores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{leaderSectorSummary.sectors.length}</div>
            <p className="text-xs text-muted-foreground">Sob sua gestão</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Inspeções com Problemas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{leaderSectorSummary.totalWithProblems}</div>
            <p className="text-xs text-muted-foreground">
              Alertas pendentes: {pendingAlertsCount}
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
              value={sectorSummaryFilter}
              onValueChange={(value) =>
                setSectorSummaryFilter(value as "all" | "with-os" | "without-os")
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
          {leaderSectorSummary.sectors.length === 0 ? (
            <p className="text-sm text-gray-600">
              Nenhuma inspeção registrada até o momento.
            </p>
          ) : filteredLeaderSectors.length === 0 ? (
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
                  {filteredLeaderSectors.map((sector) => {
                    const percentage =
                      sector.totalInspections === 0
                        ? 0
                        : Math.round(
                            (sector.inspectionsWithProblems / sector.totalInspections) * 100,
                          );
                    const openedOs = Math.max(
                      sector.inspectionsWithProblems - sector.inspectionsWithoutOS,
                      0,
                    );

                    return (
                      <tr key={sector.sector} className="border-t border-gray-200 last:border-b">
                        <td className="py-3 font-medium text-gray-800">{sector.sector}</td>
                        <td className="py-3 text-center text-gray-700">
                          {sector.totalInspections.toLocaleString("pt-BR")}
                        </td>
                        <td className="py-3 text-center">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                              sector.inspectionsWithProblems > 0
                                ? "bg-red-100 text-red-800"
                                : "bg-green-100 text-green-800"
                            }`}
                          >
                            {sector.inspectionsWithProblems.toLocaleString("pt-BR")}
                          </span>
                        </td>
                        <td className="py-3 text-center">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                              openedOs > 0
                                ? "bg-green-100 text-green-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {openedOs.toLocaleString("pt-BR")}
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
  
      <Card className="border border-gray-200 bg-white">
        <CardHeader className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <CardTitle className="text-base font-semibold">Equipamentos do Setor</CardTitle>
            <CardDescription>
              Lista completa dos equipamentos sob responsabilidade do seu setor
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs px-2 py-0">
              {sectorEquipments.length} equipamento(s)
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowEquipmentList((previous) => !previous)}
            >
              {showEquipmentList ? "Ocultar lista" : "Listar equipamentos"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {sectorEquipments.length === 0 ? (
            <p className="text-sm text-gray-600">
              Nenhum equipamento foi associado ao seu setor até o momento.
            </p>
          ) : showEquipmentList ? (
            <div className="grid gap-3 md:grid-cols-2">
              {sectorEquipments.map((equipment) => {
                const lastInspection = lastInspectionByEquipment.get(equipment.id);
                const hasActiveOrder = activeOrdersByEquipment.has(equipment.id);
                return (
                  <div
                    key={equipment.id}
                    className="border border-gray-200 rounded-md p-3 bg-white shadow-sm flex flex-col gap-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {equipment.name}
                        </p>
                        <p className="text-xs text-gray-600">KP {equipment.kp}</p>
                      </div>
                      {hasActiveOrder && (
                        <Badge variant="destructive" className="text-[11px]">
                          OS em andamento
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-600">
                      Setor: {equipment.sector || "Não informado"}
                    </p>
                    <p className="text-xs text-gray-600">
                      {lastInspection
                        ? `Última inspeção: ${format(lastInspection.date, "dd/MM/yyyy HH:mm", { locale: ptBR })} por ${lastInspection.operator}`
                        : "Ainda sem inspeções registradas"}
                    </p>
                    <div className="flex items-center justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-blue-700 border-blue-200 hover:bg-blue-50"
                        onClick={() =>
                          handleOpenMaintenanceDialog({
                            equipmentId: equipment.id,
                          })
                        }
                      >
                        Gerenciar OS
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-600">
              Utilize o botão "Listar equipamentos" para visualizar os detalhes apenas quando necessário.
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={inspectionDialogOpen} onOpenChange={handleInspectionDialogOpenChange}>
        <DialogContent className="sm:max-w-[680px]">
          <DialogHeader>
            <DialogTitle>Detalhes da inspeção</DialogTitle>
            <DialogDescription>
              Visualize todas as respostas do checklist selecionado.
            </DialogDescription>
          </DialogHeader>

          {inspectionToView ? (
            <div className="space-y-4 py-1">
              <Alert
                variant={inspectionAlertsCount > 0 ? "destructive" : "default"}
                className={
                  inspectionAlertsCount > 0 ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"
                }
              >
                <div className="flex flex-col gap-1">
                  <AlertTitle className="flex items-center gap-2 text-sm">
                    {inspectionAlertsCount > 0 ? (
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                    ) : (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    )}
                    {inspectionAlertsCount > 0
                      ? `${inspectionAlertsCount} alerta(s) identificado(s)`
                      : "Checklist sem alertas críticos"}
                  </AlertTitle>
                  {inspectionAlertsCount > 0 && (
                    <AlertDescription className="space-y-1 text-xs text-red-700">
                      {criticalInspectionAnswers.map((answer, index) => (
                        <div key={`${answer.question}-${index}`} className="flex flex-col">
                          <span className="font-semibold text-red-700">{answer.question}</span>
                          <span className="text-red-600">
                            Resposta: {answer.answer || "Não informada"}
                          </span>
                        </div>
                      ))}
                    </AlertDescription>
                  )}
                </div>
              </Alert>

              <div className="grid gap-3 text-sm text-gray-700 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase text-gray-500">Data da inspeção</p>
                  <p>{inspectionDetailDateLabel}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-gray-500">Equipamento</p>
                  <p>
                    {inspectionToView.equipment.name} • KP {inspectionToView.equipment.kp}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-gray-500">Setor</p>
                  <p>{inspectionToView.equipment.sector || "Não informado"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-gray-500">Operador</p>
                  <p>
                    {inspectionToView.operator.name}
                    {inspectionToView.operator.matricula !== "N/A"
                      ? ` • Matrícula ${inspectionToView.operator.matricula}`
                      : ""}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-800">Itens do checklist</p>
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {inspectionDetailAnswers.map((answer, index) => {
                    const isAlert = answer.triggersAlert;
                    const answerLabel = answer.answer || "Não informado";
                    return (
                      <div
                        key={`${answer.question}-${index}`}
                        className={`rounded-md border px-3 py-2 ${
                          isAlert
                            ? "border-red-200 bg-red-50/70"
                            : "border-gray-200 bg-white"
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <div className="text-sm font-medium text-gray-900">
                            {answer.question}
                          </div>
                          <Badge
                            variant={isAlert ? "destructive" : "secondary"}
                            className="w-fit text-xs"
                          >
                            {answerLabel}
                          </Badge>
                        </div>
                        {isAlert && (
                          <p className="mt-1 text-xs font-semibold text-red-700">
                            Alerta gerado para acompanhamento.
                          </p>
                        )}
                        {answer.comments && answer.comments.trim().length > 0 && (
                          <p className="mt-2 rounded bg-gray-100 px-2 py-1 text-xs text-gray-700">
                            Observação: {answer.comments}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1 text-sm text-gray-700">
                <p className="text-sm font-semibold text-gray-800">Observações gerais</p>
                <p className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                  {inspectionToView.comments?.trim()
                    ? inspectionToView.comments
                    : "Nenhuma observação adicional registrada."}
                </p>
              </div>
            </div>
          ) : (
            <div className="py-4 text-sm text-gray-600">
              Selecione uma inspeção para visualizar os detalhes.
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleInspectionDialogOpenChange(false)}
            >
              Fechar
            </Button>
            <Button
              type="button"
              disabled={!inspectionToView?.equipmentId}
              onClick={() => {
                if (!inspectionToView?.equipmentId) return;
                const inspection = inspectionToView;
                handleInspectionDialogOpenChange(false);
                handleOpenMaintenanceDialog({
                  equipmentId: inspection.equipmentId,
                  inspectionId: inspection.id,
                });
              }}
            >
              Gerenciar OS
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={maintenanceDialogOpen} onOpenChange={handleMaintenanceDialogOpenChange}>
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

      <DialogFooter className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex w-full sm:w-auto gap-2">
          <Button
            type="button"
            className="flex-1 sm:flex-none"
            variant="outline"
            onClick={() => handleMaintenanceDialogOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="flex-1 sm:flex-none"
            variant="destructive"
            onClick={handleDeleteMaintenanceOrders}
            disabled={!maintenanceEquipmentId || !hasOrdersForSelectedEquipment}
          >
            Excluir OS
          </Button>
        </div>
        <Button
          type="button"
          onClick={handleSaveMaintenanceOrderLeader}
          disabled={!maintenanceEquipmentId}
        >
          Salvar OS
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <Dialog open={resetDialogOpen} onOpenChange={handleResetDialogOpenChange}>
    <DialogContent className="sm:max-w-[420px]">
      <DialogHeader>
        <DialogTitle>Redefinir senha de operador</DialogTitle>
        <DialogDescription>
          Informe uma nova senha para o operador selecionado.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-3">
        <div className="text-sm text-gray-700">
          Operador: <strong>{operatorToReset?.name ?? "Não selecionado"}</strong>
        </div>
        <Input
          type="password"
          value={newOperatorPassword}
          onChange={(event) => setNewOperatorPassword(event.target.value)}
          placeholder="Nova senha"
          maxLength={20}
        />
        <p className="text-xs text-gray-500">
          Use ao menos 4 dígitos. Compartilhe a nova senha com o operador após a atualização.
        </p>
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={() => handleResetDialogOpenChange(false)}
        >
          Cancelar
        </Button>
        <Button
          type="button"
          onClick={handleResetOperatorPassword}
          disabled={isResettingPassword || !operatorToReset}
        >
          {isResettingPassword ? "Atualizando..." : "Salvar nova senha"}
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

      <Card className="border border-gray-200 bg-white mb-4">
        <CardHeader className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <CardTitle className="text-base font-semibold">Operadores do Setor</CardTitle>
            <CardDescription>
              Gerencie rapidamente as credenciais dos operadores vinculados ao seu setor
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs px-2 py-0">
              {sectorOperatorsList.length} operador(es)
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowOperatorList((previous) => !previous)}
            >
              {showOperatorList ? "Ocultar operadores" : "Listar operadores"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {sectorOperatorsList.length === 0 ? (
            <p className="text-sm text-gray-600">
              Nenhum operador foi associado ao seu setor ainda.
            </p>
          ) : showOperatorList ? (
            <div className="space-y-3">
              {sectorOperatorsList.map((operator) => {
                const displayName = operator.name || operator.matricula;
                return (
                  <div
                    key={operator.matricula}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border border-gray-200 rounded-md px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{displayName}</p>
                      <p className="text-xs text-gray-600">
                        Matrícula: {operator.matricula}
                        {operator.cargo ? ` • Cargo: ${operator.cargo}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenResetPasswordDialog(operator)}
                      >
                        Resetar senha
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-600">
              Clique em "Listar operadores" para visualizar e redefinir senhas quando necessário.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-4 mb-4">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <label className="text-sm font-medium">Busca:</label>
          <Input
            placeholder="Equipamento, KP ou operador"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:w-64"
          />
        </div>

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
          <label className="text-sm font-medium">Equipamento:</label>
          <Select
            value={selectedEquipmentFilter}
            onValueChange={setSelectedEquipmentFilter}
          >
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Todos os equipamentos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os equipamentos</SelectItem>
              {sectorEquipments.map((equipment) => (
                <SelectItem key={equipment.id} value={equipment.id}>
                  {equipment.name} (KP {equipment.kp})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Período:</label>
          <Select value={timeRangeFilter} onValueChange={handleTimeRangeChange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Hoje</SelectItem>
              <SelectItem value="week">Última semana</SelectItem>
              <SelectItem value="month">Último mês</SelectItem>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">OS:</label>
          <Select value={osFilter} onValueChange={setOsFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Todos os status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="with-open">Com OS em andamento</SelectItem>
              <SelectItem value="without-open">Sem OS aberta</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="justify-start w-[240px]"
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateRange?.from ? (
                dateRange.to ? (
                  `${format(dateRange.from, "dd/MM/yyyy")} - ${format(dateRange.to, "dd/MM/yyyy")}`
                ) : (
                  format(dateRange.from, "dd/MM/yyyy")
                )
              ) : (
                "Selecionar datas"
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              numberOfMonths={2}
              selected={dateRange}
              defaultMonth={dateRange?.from}
              onSelect={(range) => {
                setDateRange(range);
                setTimeRangeFilter("custom");
                if (range?.from && range?.to) {
                  setCalendarOpen(false);
                }
              }}
              locale={ptBR}
            />
            <div className="flex items-center justify-end gap-2 border-t p-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDateRange(undefined);
                  setTimeRangeFilter("all");
                  setCalendarOpen(false);
                }}
              >
                Limpar
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <Tabs defaultValue="inspections" className="space-y-4">
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
              {filteredProblems.length === 0 ? (
                <p className="text-sm text-gray-600">
                  Nenhum problema encontrado para os filtros selecionados.
                </p>
              ) : (
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
                    {filteredProblems.map((problem) => {
                      const problemDateValue = problem.date ? new Date(problem.date) : null;
                      const problemDateLabel =
                        problemDateValue && !Number.isNaN(problemDateValue.getTime())
                          ? format(problemDateValue, "dd/MM/yyyy HH:mm", { locale: ptBR })
                          : "-";
                      return (
                        <TableRow key={problem.id}>
                          <TableCell>{problemDateLabel}</TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="text-sm text-gray-900">{problem.equipment}</span>
                              <span className="text-xs text-gray-500">KP {problem.equipmentKp}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="text-sm text-gray-900">{problem.operator}</span>
                              <span className="text-xs text-gray-500">Matrícula: {problem.operatorMatricula}</span>
                            </div>
                          </TableCell>
                          <TableCell>{problem.problem}</TableCell>
                          <TableCell>
                            <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded">
                              {problem.status}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
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
              {filteredProblemsByEquipment.length === 0 ? (
                <p className="text-sm text-gray-600">
                  Não há dados suficientes para montar o gráfico com os filtros aplicados.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={filteredProblemsByEquipment}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="equipment" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="problemas" fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              )}
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
              {filteredInspections.length === 0 ? (
                <p className="text-sm text-gray-600">
                  Nenhuma inspeção encontrada para os filtros selecionados.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data e Hora</TableHead>
                      <TableHead>Equipamento</TableHead>
                      <TableHead>Operador</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInspections.map((inspection) => {
                      const hasProblems = inspection.checklist_answers.some((answer) =>
                        shouldTriggerAlert(
                          answer.question,
                          answer.answer,
                          { onYes: answer.alertOnYes, onNo: answer.alertOnNo }
                        )
                      );
                      const dateValue = inspection.submission_date || inspection.inspection_date;
                      const inspectionDate = dateValue ? new Date(dateValue) : null;
                      const inspectionDateLabel =
                        inspectionDate && !Number.isNaN(inspectionDate.getTime())
                          ? format(inspectionDate, "dd/MM/yyyy HH:mm", { locale: ptBR })
                          : "-";
                      return (
                        <TableRow key={inspection.id}>
                          <TableCell>{inspectionDateLabel}</TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="text-sm text-gray-900">{inspection.equipment.name}</span>
                              <span className="text-xs text-gray-500">KP {inspection.equipment.kp}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="text-sm text-gray-900">{inspection.operator.name}</span>
                              <span className="text-xs text-gray-500">Matrícula: {inspection.operator.matricula}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 text-xs rounded ${
                              hasProblems 
                                ? 'bg-red-100 text-red-800' 
                                : 'bg-green-100 text-green-800'
                            }`}>
                              {hasProblems ? 'Com Problemas' : 'OK'}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-blue-700 hover:bg-blue-50"
                                onClick={() => {
                                  if (inspection.id) {
                                    navigate(`/leader/checklists/${inspection.id}`);
                                    return;
                                  }
                                  handleOpenInspectionDetails(inspection);
                                }}
                              >
                                Ver inspeção
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-blue-700 border-blue-200 hover:bg-blue-50"
                                disabled={!inspection.equipmentId}
                                onClick={() =>
                                  handleOpenMaintenanceDialog({
                                    equipmentId: inspection.equipmentId,
                                    inspectionId: inspection.id,
                                  })
                                }
                              >
                                Gerenciar OS
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
};

export default LeaderDashboard;


