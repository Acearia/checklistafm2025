import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Plus, Clock, Save, User, Calendar as CalendarIcon, Shield, ShieldAlert, BellRing, RefreshCw, Wrench } from "lucide-react";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { initializeDefaultData } from "@/lib/checklistStore";
import { loadChecklistAlerts, markAlertSeenByAdmin } from "@/lib/checklistTemplate";
import {
  loadMaintenanceOrders,
  upsertMaintenanceOrder,
  getMaintenanceOrderByInspection,
  deleteMaintenanceOrdersByInspection,
} from "@/lib/maintenanceOrders";
import type { ChecklistAlert, MaintenanceOrder, MaintenanceOrderStatus } from "@/lib/types";

interface Inspection {
  id: string;
  equipment: {
    id: string;
    name: string;
    sector: string;
    bridgeNumber?: string;
  };
  operator: {
    id: string;
    name: string;
  };
  submissionDate: string;
  answers: Record<string, boolean>;
  observations: string;
  hasMaintenanceOrder?: boolean;
  maintenanceOrderClosed?: boolean;
  maintenanceOrderNumber?: string | null;
  maintenanceOrderStatus?: MaintenanceOrderStatus | null;
  maintenanceOrderNotes?: string | null;
}

interface ScheduledInspection {
  id: string;
  equipmentId: string;
  scheduleTime: string;
  frequency: "daily" | "weekly" | "monthly";
  active: boolean;
  days: string[]; // Days of the week for weekly frequency
}

interface LeaderAssignment {
  leaderId: string;
  sectorName: string;
}

const scheduleFormSchema = z.object({
  equipmentId: z.string().min(1, "Selecione um equipamento"),
  scheduleTime: z.string().min(1, "Horário é obrigatório"),
  frequency: z.enum(["daily", "weekly", "monthly"]),
  active: z.boolean(),
  days: z.array(z.string()).optional(),
});

const leaderAssignmentSchema = z.object({
  leaderId: z.string().min(1, "Selecione um líder"),
  sectorName: z.string().min(1, "Setor é obrigatório")
});

const sectorColors: Record<string, string> = {
  ACABAMENTO: "bg-green-100 text-green-800 border-green-200",
  FUSÃO: "bg-blue-100 text-blue-800 border-blue-200",
  FECHAMENTO: "bg-amber-100 text-amber-800 border-amber-200",
  MOLDAGEM: "bg-violet-100 text-violet-800 border-violet-200",
  DESMOLDAGEM: "bg-rose-100 text-rose-800 border-rose-200",
  MACHARIA: "bg-cyan-100 text-cyan-800 border-cyan-200",
  "T.TÉRMICO": "bg-orange-100 text-orange-800 border-orange-200",
  QUALIDADE: "bg-indigo-100 text-indigo-800 border-indigo-200",
  EXPEDIÇÃO: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

const weekDays = [
  { value: "sun", label: "Domingo" },
  { value: "mon", label: "Segunda" },
  { value: "tue", label: "Terça" },
  { value: "wed", label: "Quarta" },
  { value: "thu", label: "Quinta" },
  { value: "fri", label: "Sexta" },
  { value: "sat", label: "Sábado" },
];

const AdminChecklistsOverview = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [sectors, setSectors] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<string>("alertas");
  const [bridges, setBridges] = useState<Record<string, string[]>>({});
  const [groupedInspections, setGroupedInspections] = useState<Record<string, Record<string, Inspection[]>>>({});
  const [equipmentList, setEquipmentList] = useState<{id: string, name: string, sector: string, bridgeNumber?: string}[]>([]);
  const [scheduledInspections, setScheduledInspections] = useState<ScheduledInspection[]>([]);
  const [editSchedule, setEditSchedule] = useState<ScheduledInspection | null>(null);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [leaderAssignments, setLeaderAssignments] = useState<LeaderAssignment[]>([]);
  const [leadersList, setLeadersList] = useState<{id: string, name: string, email: string}[]>([]);
  const [assignLeaderDialogOpen, setAssignLeaderDialogOpen] = useState(false);
  const [selectedSector, setSelectedSector] = useState<string>("");
  const [maintenanceDialogOpen, setMaintenanceDialogOpen] = useState(false);
  const [selectedInspection, setSelectedInspection] = useState<Inspection | null>(null);
  const [alerts, setAlerts] = useState<ChecklistAlert[]>([]);
  const [maintenanceOrders, setMaintenanceOrders] = useState<MaintenanceOrder[]>([]);
  const [maintenanceOrderNumber, setMaintenanceOrderNumber] = useState("");
  const [maintenanceOrderNotes, setMaintenanceOrderNotes] = useState("");
  const [currentMaintenanceOrderId, setCurrentMaintenanceOrderId] = useState<string | null>(null);

  const form = useForm<z.infer<typeof scheduleFormSchema>>({
    resolver: zodResolver(scheduleFormSchema),
    defaultValues: {
      equipmentId: "",
      scheduleTime: "08:00",
      frequency: "daily",
      active: true,
      days: ["mon", "tue", "wed", "thu", "fri"],
    },
  });
  
  const leaderAssignmentForm = useForm<z.infer<typeof leaderAssignmentSchema>>({
    resolver: zodResolver(leaderAssignmentSchema),
    defaultValues: {
      leaderId: "",
      sectorName: "",
    },
  });

  const watchFrequency = form.watch("frequency");

  useEffect(() => {
    setMaintenanceOrders(loadMaintenanceOrders());
    const handleOrdersUpdated = () => {
      setMaintenanceOrders(loadMaintenanceOrders());
    };
    window.addEventListener(
      "checklistafm-maintenance-orders-updated",
      handleOrdersUpdated as EventListener
    );
    return () => {
      window.removeEventListener(
        "checklistafm-maintenance-orders-updated",
        handleOrdersUpdated as EventListener
      );
    };
  }, []);

  useEffect(() => {
    setAlerts(loadChecklistAlerts());
  }, []);

  useEffect(() => {
    if (activeTab === "alertas") {
      setAlerts(loadChecklistAlerts());
    }
  }, [activeTab]);

  useEffect(() => {
    if (!maintenanceDialogOpen || !selectedInspection) {
      return;
    }
    const maintenanceOrder =
      getMaintenanceOrderByInspection(selectedInspection.id) ||
      maintenanceOrders.find(order => order.equipmentId === selectedInspection.equipment.id && order.status === "open");
    setCurrentMaintenanceOrderId(maintenanceOrder?.id ?? null);
    setMaintenanceOrderNumber(
      maintenanceOrder?.orderNumber ??
      selectedInspection.maintenanceOrderNumber ??
      ""
    );
    setMaintenanceOrderNotes(
      maintenanceOrder?.notes ?? selectedInspection.maintenanceOrderNotes ?? ""
    );
  }, [maintenanceDialogOpen, selectedInspection, maintenanceOrders]);

  const reloadAlerts = () => {
    setAlerts(loadChecklistAlerts());
  };

  const handleMarkAlertAsSeen = (alertId: string) => {
    markAlertSeenByAdmin(alertId);
    setAlerts((prev) =>
      prev.map((alert) =>
        alert.id === alertId ? { ...alert, seenByAdmin: true } : alert
      )
    );
  };

  const unseenAlertsCount = alerts.filter((alert) => !alert.seenByAdmin).length;
  const alertsToDisplay = alerts.slice(0, 5);
  const selectedMaintenanceStatus: MaintenanceOrderStatus | null =
    selectedInspection?.maintenanceOrderStatus ?? (selectedInspection?.maintenanceOrderClosed ? "closed" : null);
  const maintenanceStatusLabel =
    selectedMaintenanceStatus === "closed"
      ? "Finalizada"
      : selectedMaintenanceStatus === "open"
        ? "Em andamento"
        : null;

  useEffect(() => {
    // Garantir que os dados padrão estejam inicializados
    initializeDefaultData();
    
    const fetchInspections = () => {
      try {
        // Carregar equipamentos primeiro, pois precisamos deles para os agendamentos
        const storedEquipments = localStorage.getItem('checklistafm-equipments');
        if (storedEquipments) {
          try {
            const parsedEquipments = JSON.parse(storedEquipments);
            console.log(`Loaded ${parsedEquipments.length} equipments from localStorage for admin view`);
            
            // Transformar para o formato esperado pelo componente
            const formattedEquipments = parsedEquipments.map((eq) => ({
              id: eq.id,
              name: eq.name,
              sector: eq.sector,
              bridgeNumber: eq.bridgeNumber || eq.kp || "N/A"
            }));
            
            setEquipmentList(formattedEquipments);
            console.log("Equipment list set:", formattedEquipments);
          } catch (error) {
            console.error("Error parsing equipments:", error);
            setEquipmentList([]);
          }
        } else {
          console.warn("No equipment data found in localStorage");
          setEquipmentList([]);
        }

        const storedInspections = localStorage.getItem('checklistafm-inspections');
        const storedMaintenanceOrders = loadMaintenanceOrders();
        setMaintenanceOrders(storedMaintenanceOrders);

        if (storedInspections) {
          const parsedInspections: Inspection[] = JSON.parse(storedInspections);
          
          const enrichedInspections = parsedInspections.map((inspection) => {
            const maintenanceOrder =
              storedMaintenanceOrders.find(order => order.inspectionId === inspection.id) ||
              storedMaintenanceOrders.find(order => order.equipmentId === inspection.equipment.id && order.status === "open");
            
            const maintenanceStatus = maintenanceOrder?.status ?? inspection.maintenanceOrderStatus ?? (inspection.maintenanceOrderClosed ? "closed" : null);
            const hasMaintenance = inspection.hasMaintenanceOrder ?? Boolean(maintenanceOrder && maintenanceOrder.status !== "cancelled");
            const normalizedStatus = hasMaintenance ? (maintenanceStatus ?? "open") : null;
            const isClosed = hasMaintenance && normalizedStatus === "closed";
            const maintenanceNumber = hasMaintenance
              ? inspection.maintenanceOrderNumber ?? maintenanceOrder?.orderNumber ?? null
              : null;
            
            return {
              ...inspection,
              hasMaintenanceOrder: hasMaintenance,
              maintenanceOrderClosed: isClosed,
              maintenanceOrderNumber: maintenanceNumber,
              maintenanceOrderStatus: normalizedStatus,
              maintenanceOrderNotes: inspection.maintenanceOrderNotes ?? maintenanceOrder?.notes ?? null,
            };
          });

          // Sort inspections by date (newest first)
          const sortedInspections = enrichedInspections.sort((a, b) => 
            new Date(b.submissionDate).getTime() - new Date(a.submissionDate).getTime()
          );
          
          setInspections(sortedInspections);

          // Extract unique sectors
          const uniqueSectors = Array.from(
            new Set(sortedInspections.map(inspection => inspection.equipment.sector))
          ).sort();
          setSectors(uniqueSectors);
          
          // Set initial active tab
          if (uniqueSectors.length > 0 && !activeTab) {
            setActiveTab(uniqueSectors[0]);
          }

          // Group bridges by sector
          const bridgesBySector: Record<string, string[]> = {};
          uniqueSectors.forEach(sector => {
            const sectorBridges = sortedInspections
              .filter(insp => insp.equipment.sector === sector)
              .map(insp => insp.equipment.bridgeNumber || insp.equipment.id)
              .filter((value, index, self) => self.indexOf(value) === index)
              .sort();
            
            bridgesBySector[sector] = sectorBridges;
          });
          setBridges(bridgesBySector);

          // Group inspections by sector and bridge
          const grouped: Record<string, Record<string, Inspection[]>> = {};
          uniqueSectors.forEach(sector => {
            grouped[sector] = {};
            
            bridgesBySector[sector].forEach(bridge => {
              grouped[sector][bridge] = sortedInspections.filter(
                insp => insp.equipment.sector === sector && 
                (insp.equipment.bridgeNumber === bridge || (!insp.equipment.bridgeNumber && insp.equipment.id === bridge))
              );
            });
          });
          setGroupedInspections(grouped);
        }

        // Load scheduled inspections
        const storedSchedules = localStorage.getItem('checklistafm-scheduled-inspections');
        if (storedSchedules) {
          setScheduledInspections(JSON.parse(storedSchedules));
        }

        // Load leader assignments
        const storedLeaderAssignments = localStorage.getItem('checklistafm-leader-assignments');
        if (storedLeaderAssignments) {
          setLeaderAssignments(JSON.parse(storedLeaderAssignments));
        }

        // Load leaders list
        const storedLeaders = localStorage.getItem('checklistafm-leaders');
        if (storedLeaders) {
          setLeadersList(JSON.parse(storedLeaders));
        } else {
          // Create sample leaders if none exist
          const sampleLeaders = [
            { id: "leader1", name: "João Silva", email: "joao@example.com" },
            { id: "leader2", name: "Maria Oliveira", email: "maria@example.com" },
            { id: "leader3", name: "Carlos Santos", email: "carlos@example.com" },
          ];
          localStorage.setItem('checklistafm-leaders', JSON.stringify(sampleLeaders));
          setLeadersList(sampleLeaders);
        }
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
        toast({
          title: "Erro ao carregar dados",
          description: "Não foi possível carregar os dados necessários.",
          variant: "destructive"
        });
      }
    };

    fetchInspections();
  }, [toast, activeTab]);

  const getStatusClass = (inspection: Inspection) => {
    // Check if all answers are true (OK)
    const allOK = Object.values(inspection.answers).every(answer => answer === true);
    
    // Last inspection of the day (today)
    const isToday = new Date(inspection.submissionDate).toDateString() === new Date().toDateString();
    
    if (allOK && isToday) {
      return "bg-green-100"; // OK hoje
    } else if (!allOK && isToday) {
      if (inspection.hasMaintenanceOrder) {
        return "bg-yellow-100"; // NOK com OS
      }
      return "bg-red-100"; // NOK hoje
    } else if (!allOK) {
      if (inspection.hasMaintenanceOrder) {
        return "bg-yellow-50"; // NOK com OS (não hoje)
      }
      return "bg-red-50"; // NOK não hoje
    }
    
    return ""; // default
  };

  const getStatusDot = (inspection: Inspection) => {
    // Check if all answers are true (OK)
    const allOK = Object.values(inspection.answers).every(answer => answer === true);
    
    if (allOK) {
      return null; // No dot for OK
    }
    
    if (inspection.hasMaintenanceOrder) {
      if (inspection.maintenanceOrderClosed) {
        return <span className="w-2 h-2 rounded-full bg-green-500 inline-block mr-1"></span>;
      }
      return <span className="w-2 h-2 rounded-full bg-yellow-500 inline-block mr-1"></span>;
    }
    
    return <span className="w-2 h-2 rounded-full bg-red-500 inline-block mr-1"></span>;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, "dd/MM/yyyy HH:mm", { locale: ptBR });
  };

  const handleOpenScheduleDialog = (schedule?: ScheduledInspection) => {
    if (schedule) {
      setEditSchedule(schedule);
      form.reset({
        equipmentId: schedule.equipmentId,
        scheduleTime: schedule.scheduleTime,
        frequency: schedule.frequency,
        active: schedule.active,
        days: schedule.days,
      });
    } else {
      setEditSchedule(null);
      form.reset({
        equipmentId: "",
        scheduleTime: "08:00",
        frequency: "daily",
        active: true,
        days: ["mon", "tue", "wed", "thu", "fri"],
      });
    }
    setScheduleDialogOpen(true);
  };

  const saveSchedule = (values: z.infer<typeof scheduleFormSchema>) => {
    try {
      const newSchedule: ScheduledInspection = {
        id: editSchedule?.id || `schedule-${Date.now()}`,
        equipmentId: values.equipmentId,
        scheduleTime: values.scheduleTime,
        frequency: values.frequency,
        active: values.active,
        days: values.days || [],
      };

      let updatedSchedules: ScheduledInspection[];
      
      if (editSchedule) {
        updatedSchedules = scheduledInspections.map(s => 
          s.id === editSchedule.id ? newSchedule : s
        );
        toast({
          title: "Agendamento atualizado",
          description: "O agendamento foi atualizado com sucesso"
        });
      } else {
        updatedSchedules = [...scheduledInspections, newSchedule];
        toast({
          title: "Agendamento criado",
          description: "O novo agendamento foi criado com sucesso"
        });
      }

      setScheduledInspections(updatedSchedules);
      localStorage.setItem('checklistafm-scheduled-inspections', JSON.stringify(updatedSchedules));
      setScheduleDialogOpen(false);
    } catch (error) {
      console.error('Erro ao salvar agendamento:', error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar o agendamento.",
        variant: "destructive"
      });
    }
  };

  const getEquipmentName = (id: string) => {
    const equipment = equipmentList.find(e => e.id === id);
    return equipment ? equipment.name : id;
  };

  const getEquipmentBridge = (id: string) => {
    const equipment = equipmentList.find(e => e.id === id);
    return equipment?.bridgeNumber || "N/A";
  };

  const getEquipmentSector = (id: string) => {
    const equipment = equipmentList.find(e => e.id === id);
    return equipment?.sector || "N/A";
  };

  const toggleScheduleStatus = (scheduleId: string) => {
    const updatedSchedules = scheduledInspections.map(schedule => {
      if (schedule.id === scheduleId) {
        return { ...schedule, active: !schedule.active };
      }
      return schedule;
    });
    
    setScheduledInspections(updatedSchedules);
    localStorage.setItem('checklistafm-scheduled-inspections', JSON.stringify(updatedSchedules));
    
    toast({
      title: "Status atualizado",
      description: "O status do agendamento foi atualizado"
    });
  };

  const deleteSchedule = (scheduleId: string) => {
    const updatedSchedules = scheduledInspections.filter(s => s.id !== scheduleId);
    setScheduledInspections(updatedSchedules);
    localStorage.setItem('checklistafm-scheduled-inspections', JSON.stringify(updatedSchedules));
    
    toast({
      title: "Agendamento removido",
      description: "O agendamento foi removido com sucesso"
    });
  };

  const viewInspectionDetail = (inspectionId: string) => {
    if (inspectionId) {
      navigate(`/admin/checklists/${inspectionId}`);
    }
  };

  const handleOpenAssignLeaderDialog = (sector: string) => {
    setSelectedSector(sector);
    
    // Check if sector already has a leader assigned
    const existingAssignment = leaderAssignments.find(a => a.sectorName === sector);
    
    leaderAssignmentForm.reset({
      leaderId: existingAssignment?.leaderId || "",
      sectorName: sector,
    });
    
    setAssignLeaderDialogOpen(true);
  };

  const saveLeaderAssignment = (values: z.infer<typeof leaderAssignmentSchema>) => {
    try {
      const newAssignments = [...leaderAssignments];
      const existingIndex = newAssignments.findIndex(a => a.sectorName === values.sectorName);
      
      if (existingIndex >= 0) {
        // Update existing assignment
        newAssignments[existingIndex] = {
          leaderId: values.leaderId,
          sectorName: values.sectorName
        };
      } else {
        // Add new assignment
        newAssignments.push({
          leaderId: values.leaderId,
          sectorName: values.sectorName
        });
      }
      
      setLeaderAssignments(newAssignments);
      localStorage.setItem('checklistafm-leader-assignments', JSON.stringify(newAssignments));
      
      toast({
        title: "Líder atribuído",
        description: `Líder atribuído ao setor ${values.sectorName} com sucesso!`
      });
      
      setAssignLeaderDialogOpen(false);
    } catch (error) {
      console.error('Erro ao salvar atribuição de líder:', error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível atribuir o líder ao setor.",
        variant: "destructive"
      });
    }
  };

  const getSectorLeaderName = (sectorName: string) => {
    const assignment = leaderAssignments.find(a => a.sectorName === sectorName);
    if (!assignment) return "Não atribuído";
    
    const leader = leadersList.find(l => l.id === assignment.leaderId);
    return leader ? leader.name : "Não encontrado";
  };

  const handleOpenMaintenanceDialog = (inspection: Inspection) => {
    setSelectedInspection(inspection);
    const maintenanceOrder =
      getMaintenanceOrderByInspection(inspection.id) ||
      maintenanceOrders.find(order => order.equipmentId === inspection.equipment.id && order.status === "open");
    setCurrentMaintenanceOrderId(maintenanceOrder?.id ?? null);
    setMaintenanceOrderNumber(
      maintenanceOrder?.orderNumber ??
      inspection.maintenanceOrderNumber ??
      ""
    );
    setMaintenanceOrderNotes(maintenanceOrder?.notes ?? inspection.maintenanceOrderNotes ?? "");
    setMaintenanceDialogOpen(true);
  };

  const persistInspectionMaintenance = (updatedInspection: Inspection) => {
    const updatedInspections = inspections.map(inspection =>
      inspection.id === updatedInspection.id ? updatedInspection : inspection
    );
    setInspections(updatedInspections);
    localStorage.setItem('checklistafm-inspections', JSON.stringify(updatedInspections));

    const sectorKey = updatedInspection.equipment.sector;
    const bridgeKey = updatedInspection.equipment.bridgeNumber || updatedInspection.equipment.id;

    setGroupedInspections(prev => {
      if (!prev[sectorKey] || !prev[sectorKey][bridgeKey]) {
        return prev;
      }
      return {
        ...prev,
        [sectorKey]: {
          ...prev[sectorKey],
          [bridgeKey]: prev[sectorKey][bridgeKey].map(inspection =>
            inspection.id === updatedInspection.id ? updatedInspection : inspection
          ),
        },
      };
    });

    setSelectedInspection(updatedInspection);
  };

  const handleSaveMaintenanceOrder = (status: MaintenanceOrderStatus) => {
    if (!selectedInspection) return;

    const trimmedNumber = maintenanceOrderNumber.trim();
    const trimmedNotes = maintenanceOrderNotes.trim();

    const existingOrder =
      maintenanceOrders.find(order => order.id === currentMaintenanceOrderId) ||
      getMaintenanceOrderByInspection(selectedInspection.id);

    if (status !== "cancelled" && trimmedNumber.length === 0) {
      toast({
        title: "Número da OS obrigatório",
        description: "Informe o número da ordem de serviço para continuar.",
        variant: "destructive",
      });
      return;
    }

    let orderNumberToPersist = trimmedNumber;

    if (!orderNumberToPersist && existingOrder) {
      orderNumberToPersist = existingOrder.orderNumber;
    }

    const notesToPersist = trimmedNotes.length > 0 ? trimmedNotes : undefined;

    if (status === "cancelled") {
      const updatedOrders = deleteMaintenanceOrdersByInspection(selectedInspection.id);
      setCurrentMaintenanceOrderId(null);
      setMaintenanceOrders(updatedOrders);
      setMaintenanceOrderNumber("");
      setMaintenanceOrderNotes(trimmedNotes);
      const updatedInspection: Inspection = {
        ...selectedInspection,
        hasMaintenanceOrder: false,
        maintenanceOrderClosed: false,
        maintenanceOrderNumber: null,
        maintenanceOrderStatus: null,
        maintenanceOrderNotes: notesToPersist ?? null,
      };

      persistInspectionMaintenance(updatedInspection);
      setMaintenanceOrderNotes(trimmedNotes);
      toast({
        title: "OS removida",
        description: "A ordem de serviço foi removida da inspeção.",
      });
      setMaintenanceDialogOpen(false);
      return;
    }

    const { order, orders } = upsertMaintenanceOrder({
      id: currentMaintenanceOrderId ?? existingOrder?.id ?? null,
      inspectionId: selectedInspection.id,
      equipmentId: selectedInspection.equipment.id,
      orderNumber: orderNumberToPersist,
      status,
      notes: notesToPersist,
    });

    setCurrentMaintenanceOrderId(order.id);
    setMaintenanceOrders(orders);
    setMaintenanceOrderNumber(order.orderNumber);

    const updatedInspection: Inspection = {
      ...selectedInspection,
      hasMaintenanceOrder: true,
      maintenanceOrderClosed: status === "closed",
      maintenanceOrderNumber: order.orderNumber,
      maintenanceOrderStatus: status,
      maintenanceOrderNotes: notesToPersist ?? null,
    };

    persistInspectionMaintenance(updatedInspection);
    setMaintenanceOrderNotes(trimmedNotes);

    toast({
      title: status === "closed" ? "OS finalizada" : "OS registrada",
      description:
        status === "closed"
          ? `A OS ${order.orderNumber} foi marcada como finalizada.`
          : `A OS ${order.orderNumber} foi registrada como em andamento.`,
    });

    setMaintenanceDialogOpen(false);
  };

  return (
    <div className="space-y-6 p-2 pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Visão de Checklists</h1>
          <p className="text-muted-foreground">Monitoramento de checklists por setor e ponte</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => handleOpenScheduleDialog()}>
            <Plus size={16} className="mr-2" />
            Agendar Inspeção
          </Button>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Agendamentos de Inspeções</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-48 w-full rounded-md border">
            <div className="p-4">
              {scheduledInspections.length === 0 ? (
                <p className="text-center text-muted-foreground">Nenhum agendamento encontrado</p>
              ) : (
                <div className="space-y-4">
                  {scheduledInspections.map((schedule) => (
                    <div key={schedule.id} className="flex items-center justify-between border-b pb-2">
                      <div>
                        <h3 className="font-medium">{getEquipmentName(schedule.equipmentId)}</h3>
                        <div className="flex gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center">
                            <Clock size={14} className="mr-1" />
                            {schedule.scheduleTime}
                          </span>
                          <span>Ponte: {getEquipmentBridge(schedule.equipmentId)}</span>
                          <span>Setor: {getEquipmentSector(schedule.equipmentId)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch 
                          checked={schedule.active} 
                          onCheckedChange={() => toggleScheduleStatus(schedule.id)} 
                        />
                        <Button size="sm" variant="outline" onClick={() => handleOpenScheduleDialog(schedule)}>
                          Editar
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => deleteSchedule(schedule.id)}>
                          Remover
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="bg-white shadow-md">
        <CardHeader className="bg-blue-700 text-white pb-2 pt-3">
          <CardTitle className="text-lg flex items-center justify-between">
            <span>Todos os Check lists</span>
          </CardTitle>
        </CardHeader>
        
        <CardContent className="p-0">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="flex w-full h-auto bg-gray-100 p-0 overflow-x-auto">
              <TabsTrigger
                value="alertas"
                className="px-6 py-3 flex-1 sm:flex-initial data-[state=active]:bg-white data-[state=active]:border-t-2 data-[state=active]:border-blue-600 rounded-none flex justify-center min-w-[180px]"
              >
                <div className="flex flex-col items-center gap-1">
                  <span className="font-medium flex items-center gap-1">
                    <BellRing className="h-4 w-4" />
                    Checklist
                    {unseenAlertsCount > 0 && (
                      <Badge variant="destructive" className="ml-2 px-2 py-0 text-[11px]">
                        {unseenAlertsCount}
                      </Badge>
                    )}
                  </span>
                  <span className="text-xs text-gray-500">
                    Alertas recentes
                  </span>
                </div>
              </TabsTrigger>
              {sectors.map(sector => (
                <TabsTrigger 
                  key={sector} 
                  value={sector}
                  className="px-6 py-3 flex-1 data-[state=active]:bg-white data-[state=active]:border-t-2 data-[state=active]:border-blue-600 rounded-none flex justify-center"
                >
                  <div className="flex flex-col items-center">
                    <span className="font-medium">{sector}</span>
                    <span className="text-xs text-gray-500">Líder: {getSectorLeaderName(sector)}</span>
                  </div>
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value="alertas" className="m-0 p-0">
              <div className="p-4 space-y-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <BellRing className="h-5 w-5 text-blue-600" />
                      Alertas de checklist
                    </h2>
                    <p className="text-sm text-gray-600">
                      Acompanhe as respostas críticas e acesse a configuração completa das perguntas quando necessário.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex items-center gap-1"
                      onClick={reloadAlerts}
                    >
                      <RefreshCw className="h-4 w-4" />
                      Atualizar
                    </Button>
                  </div>
                </div>

                <Card className="border border-red-200 bg-red-50/50">
                  <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <ShieldAlert className="h-4 w-4 text-red-600" />
                        Alertas recentes
                      </CardTitle>
                      <p className="text-xs sm:text-sm text-gray-600">
                        Monitoramento das respostas críticas enviadas pelos operadores.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={unseenAlertsCount > 0 ? "destructive" : "secondary"}
                        className="text-xs px-2 py-0"
                      >
                        {unseenAlertsCount} pendente(s)
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {alertsToDisplay.length === 0 ? (
                      <p className="text-sm text-gray-600">
                        Nenhum alerta registrado até o momento.
                      </p>
                    ) : (
                      alertsToDisplay.map((alert) => (
                        <div
                          key={alert.id}
                          className="bg-white rounded-md border border-red-100 p-3 shadow-sm"
                        >
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                            <div className="space-y-1">
                              <p className="text-sm font-semibold text-gray-900">
                                {alert.question}
                              </p>
                              <div className="flex flex-wrap gap-3 text-xs text-gray-600">
                                <span>
                                  Resposta:{" "}
                                  <span className="text-red-600 font-medium">
                                    {alert.answer}
                                  </span>
                                </span>
                                {alert.operatorName && (
                                  <span>
                                    Operador: {alert.operatorName}
                                    {alert.operatorMatricula ? ` (${alert.operatorMatricula})` : ""}
                                  </span>
                                )}
                                {alert.equipmentName && (
                                  <span>
                                    Equipamento: {alert.equipmentName}
                                    {alert.equipmentId ? ` (${alert.equipmentId})` : ""}
                                  </span>
                                )}
                                {alert.sector && <span>Setor: {alert.sector}</span>}
                                <span>
                                  Criado em:{" "}
                                  {format(new Date(alert.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-start gap-2">
                              {!alert.seenByAdmin ? (
                                <Badge variant="destructive" className="px-2 py-0 text-xs">
                                  Pendente
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="px-2 py-0 text-xs">
                                  Arquivado
                                </Badge>
                              )}
                              {!alert.seenByAdmin && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleMarkAlertAsSeen(alert.id)}
                                >
                                  Marcar como visto
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

              </div>
            </TabsContent>

            {sectors.map(sector => (
              <TabsContent key={sector} value={sector} className="m-0 p-0">
                <div className="p-2 flex justify-end">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleOpenAssignLeaderDialog(sector)}
                  >
                    <User size={14} className="mr-1" />
                    Atribuir Líder
                  </Button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
                  {bridges[sector]?.map(bridge => (
                    <Card key={bridge} className="shadow-sm">
                      <CardHeader className="py-2 px-4 bg-gray-50 border-b">
                        <CardTitle className="text-md font-semibold">Ponte {bridge}</CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="flex flex-col">
                          {groupedInspections[sector]?.[bridge]?.slice(0, 10).map((inspection, index) => (
                            <div 
                              key={`${inspection.id}-${index}`}
                              className={`p-2 border-b flex items-center text-sm ${getStatusClass(inspection)} hover:bg-gray-50 cursor-pointer`}
                              onClick={() => viewInspectionDetail(inspection.id)}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                handleOpenMaintenanceDialog(inspection);
                              }}
                            >
                              {getStatusDot(inspection)}
                              <span className="ml-1">{formatDate(inspection.submissionDate).replace(' ', ' ')}</span>
                              
                              <div className="ml-auto flex items-center gap-2">
                                {inspection.hasMaintenanceOrder && (
                                  <Badge 
                                    variant="outline" 
                                    className={`text-xs ${inspection.maintenanceOrderClosed ? 'bg-green-50 text-green-700 border-green-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}`}
                                  >
                                    <span className="flex items-center gap-1">
                                      {inspection.maintenanceOrderClosed ? (
                                        <Shield size={12} className="text-green-600" />
                                      ) : (
                                        <ShieldAlert size={12} className="text-yellow-600" />
                                      )}
                                      <span>
                                        {inspection.maintenanceOrderNumber
                                          ? `OS #${inspection.maintenanceOrderNumber}`
                                          : "OS registrada"}{" "}
                                        {inspection.maintenanceOrderClosed ? "finalizada" : "em andamento"}
                                      </span>
                                    </span>
                                  </Badge>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-gray-600 hover:text-gray-900"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleOpenMaintenanceDialog(inspection);
                                  }}
                                  title="Gerenciar OS"
                                >
                                  <Wrench className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
        
        <div className="p-4 border-t">
          <h2 className="text-sm font-semibold mb-2">Legenda</h2>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-100 border border-green-300"></div>
              <span className="text-sm">Check list "OK" hoje</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-100 border border-red-300"></div>
              <span className="text-sm">Check list "NOK" hoje</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-yellow-100 border border-yellow-300"></div>
              <span className="text-sm">Check list "NOK" com OS</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <span className="text-sm">Check list "NOK" sem OS</span>
            </div>
          </div>
        </div>
      </Card>

      <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editSchedule ? 'Editar Agendamento' : 'Novo Agendamento'}</DialogTitle>
            <DialogDescription>
              Configure o horário e a frequência da inspeção para o equipamento
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(saveSchedule)} className="space-y-6">
              <FormField
                control={form.control}
                name="equipmentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Equipamento</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Selecione um equipamento" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-white">
                        {equipmentList && equipmentList.length > 0 ? (
                          equipmentList.map(equipment => (
                            <SelectItem key={equipment.id} value={equipment.id}>
                              {equipment.name} ({equipment.sector} - Ponte {equipment.bridgeNumber || "N/A"})
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="no-equipment" disabled>
                            Nenhum equipamento encontrado
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="scheduleTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Horário</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormDescription>
                      Horário programado para a inspeção
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="frequency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Frequência</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Selecione a frequência" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-white">
                        <SelectItem value="daily">Diário</SelectItem>
                        <SelectItem value="weekly">Semanal</SelectItem>
                        <SelectItem value="monthly">Mensal</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {watchFrequency === "weekly" && (
                <FormField
                  control={form.control}
                  name="days"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dias da Semana</FormLabel>
                      <div className="flex flex-wrap gap-2">
                        {weekDays.map((day) => (
                          <Button
                            type="button"
                            key={day.value}
                            variant={field.value?.includes(day.value) ? "default" : "outline"}
                            className="px-3 py-1 text-xs"
                            onClick={() => {
                              const currentValue = field.value || [];
                              
                              if (currentValue.includes(day.value)) {
                                field.onChange(
                                  currentValue.filter((val) => val !== day.value)
                                );
                              } else {
                                field.onChange([...currentValue, day.value]);
                              }
                            }}
                          >
                            {day.label}
                          </Button>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Ativo</FormLabel>
                      <FormDescription>
                        Determina se este agendamento está ativo ou não
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setScheduleDialogOpen(false)}>Cancelar</Button>
                <Button type="submit">
                  <Save className="mr-2 h-4 w-4" />
                  {editSchedule ? 'Atualizar' : 'Salvar'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={assignLeaderDialogOpen} onOpenChange={setAssignLeaderDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Atribuir Líder ao Setor {selectedSector}</DialogTitle>
            <DialogDescription>
              Selecione um líder para gerenciar este setor e suas inspeções
            </DialogDescription>
          </DialogHeader>
          
          <Form {...leaderAssignmentForm}>
            <form onSubmit={leaderAssignmentForm.handleSubmit(saveLeaderAssignment)} className="space-y-6">
              <FormField
                control={leaderAssignmentForm.control}
                name="leaderId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Líder</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Selecione um líder" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-white">
                        {leadersList.map(leader => (
                          <SelectItem key={leader.id} value={leader.id}>
                            {leader.name} ({leader.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setAssignLeaderDialogOpen(false)}>Cancelar</Button>
                <Button type="submit">
                  <Save className="mr-2 h-4 w-4" />
                  Salvar
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={maintenanceDialogOpen} onOpenChange={setMaintenanceDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Gerenciar Ordem de Serviço</DialogTitle>
            <DialogDescription>
              {selectedInspection && (
                <span>
                  Equipamento: {selectedInspection.equipment.name} - 
                  Ponte: {selectedInspection.equipment.bridgeNumber || 'N/A'} - 
                  Data: {formatDate(selectedInspection.submissionDate)}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-3">
              {selectedInspection?.maintenanceOrderNumber && maintenanceStatusLabel && (
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  OS atual: #{selectedInspection.maintenanceOrderNumber} • {maintenanceStatusLabel}
                </div>
              )}
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
                  Observações (opcional)
                </label>
                <Textarea
                  value={maintenanceOrderNotes}
                  onChange={(event) => setMaintenanceOrderNotes(event.target.value)}
                  rows={3}
                  placeholder="Descreva ações da manutenção, responsáveis ou prazos"
                />
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              Selecione o status desejado para a ordem de serviço deste checklist:
            </p>
            
            <div className="flex flex-col space-y-2">
              <Button 
                variant="outline" 
                className={`justify-start ${selectedMaintenanceStatus === 'open' ? 'border-yellow-500 bg-yellow-50' : ''}`}
                onClick={() => handleSaveMaintenanceOrder("open")}
              >
                <ShieldAlert className="mr-2 h-4 w-4 text-yellow-500" />
                Registrar OS em andamento
              </Button>
              
              <Button 
                variant="outline" 
                className={`justify-start ${selectedMaintenanceStatus === 'closed' ? 'border-green-500 bg-green-50' : ''}`}
                onClick={() => handleSaveMaintenanceOrder("closed")}
              >
                <Shield className="mr-2 h-4 w-4 text-green-500" />
                Marcar OS como Fechada
              </Button>
              
              <Button 
                variant="outline" 
                className={`justify-start ${!selectedInspection?.hasMaintenanceOrder ? 'border-gray-300 bg-gray-50' : ''}`}
                onClick={() => handleSaveMaintenanceOrder("cancelled")}
              >
                <CalendarIcon className="mr-2 h-4 w-4 text-gray-500" />
                Cancelar / remover OS
              </Button>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setMaintenanceDialogOpen(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminChecklistsOverview;
