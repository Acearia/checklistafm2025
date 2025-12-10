
import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Save, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import SignatureCanvas from "@/components/SignatureCanvas";
import type { ChecklistItem, Operator, Equipment } from "@/lib/data";
import { checklistItems as defaultChecklistItems } from "@/lib/data";
import { AddOperatorDialog } from "@/components/operators/AddOperatorDialog";
import ChecklistHeader from "@/components/checklist/ChecklistHeader";
import ChecklistOperatorSelect from "@/components/checklist/ChecklistOperatorSelect";
import ChecklistEquipmentSelect from "@/components/checklist/ChecklistEquipmentSelect";
import ChecklistItems from "@/components/checklist/ChecklistItems";
import ChecklistPhotoUpload from "@/components/checklist/ChecklistPhotoUpload";
import ChecklistComments from "@/components/checklist/ChecklistComments";
import { useChecklistData } from "@/hooks/useChecklistData";
import { getChecklistState, saveChecklistState } from "@/lib/checklistStore";
import { loadMaintenanceOrders, upsertMaintenanceOrder, deleteMaintenanceOrdersByEquipment } from "@/lib/maintenanceOrders";
import type { MaintenanceOrder } from "@/lib/types";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { filterChecklistItemsByEquipmentType } from "@/lib/checklistQuestionsByEquipmentType";
import type { GroupQuestion } from "@/lib/types-compat";

const Checklist = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const {
    operators,
    equipments,
    checklistItems: supabaseChecklistItems,
    sectors,
    groups,
    groupQuestions,
    equipmentGroups,
    refresh
  } = useChecklistData();

  const normalizeText = (value?: string | null) => (value || "").trim().toUpperCase();
  const getOperatorIdentifier = (op: any) => op?.matricula || op?.id || "";

  const normalizeOperator = (op: any): Operator => ({
    id: getOperatorIdentifier(op),
    matricula: getOperatorIdentifier(op),
    name: op?.name || "",
    cargo: op?.cargo || undefined,
    setor: op?.setor || undefined,
    senha: op?.senha || undefined,
  });

  const [selectedOperator, setSelectedOperator] = useState<Operator | null>(null);
  const [isOperatorLocked, setIsOperatorLocked] = useState(false);
  const [hasInitializedOperator, setHasInitializedOperator] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [signature, setSignature] = useState<string | null>(null);
  const [inspectionDate, setInspectionDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);
  const [successEquipmentName, setSuccessEquipmentName] = useState<string | null>(null);
  const [highlightUnanswered, setHighlightUnanswered] = useState(false);
  const [hasInteractedWithChecklist, setHasInteractedWithChecklist] = useState(false);
  const [operatorUnlockDialogOpen, setOperatorUnlockDialogOpen] = useState(false);
  const [operatorUnlockSelection, setOperatorUnlockSelection] = useState<string>("");
  const [operatorUnlockPassword, setOperatorUnlockPassword] = useState("");
  const [operatorUnlockError, setOperatorUnlockError] = useState<string | null>(null);
  const [maintenanceOrders, setMaintenanceOrders] = useState<MaintenanceOrder[]>([]);
  const [maintenanceDialogOpen, setMaintenanceDialogOpen] = useState(false);
  const [maintenanceOrderId, setMaintenanceOrderId] = useState<string | null>(null);
  const [maintenanceOrderNumber, setMaintenanceOrderNumber] = useState("");
  const [maintenanceStatus, setMaintenanceStatus] = useState<MaintenanceOrder["status"]>("open");
  const [maintenanceNotes, setMaintenanceNotes] = useState("");
  
  // State for photos and comments
  const [photos, setPhotos] = useState<{ id: string, data: string }[]>([]);
  const [comments, setComments] = useState<string>('');

  const equipmentGroupIds = useMemo(() => {
    if (!selectedEquipment) return [];
    return equipmentGroups
      .filter((eg) => eg.equipment_id === selectedEquipment.id)
      .map((eg) => eg.group_id);
  }, [equipmentGroups, selectedEquipment]);

  const unansweredCount = useMemo(
    () =>
      checklist.filter((item) => item.answer === null || item.answer === "Selecione")
        .length,
    [checklist]
  );

  const getOperatorSectors = (op?: Operator | null) => {
    const raw = normalizeText(op?.setor);
    if (!raw) return [];
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
  };

  const filteredEquipments = useMemo(() => {
    const sectors = getOperatorSectors(selectedOperator);
    if (sectors.length === 0) return equipments;
    const sectorSet = new Set(sectors);
    return equipments.filter((eq) => sectorSet.has(normalizeText(eq.sector)));
  }, [equipments, selectedOperator]);

  const ordersForSelectedEquipment = useMemo(() => {
    if (!selectedEquipment) return [];
    return maintenanceOrders
      .filter(order => order.equipmentId === selectedEquipment.id)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [selectedEquipment, maintenanceOrders]);

  // Debug: Log operators when they change
  useEffect(() => {
    console.log("Operators updated in Checklist:", operators.length);
    console.log("Operators data:", operators);
  }, [operators]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateOrders = () => {
      setMaintenanceOrders(loadMaintenanceOrders());
    };

    updateOrders();
    const listener = () => updateOrders();
    window.addEventListener("checklistafm-maintenance-orders-updated", listener);
    return () => {
      window.removeEventListener("checklistafm-maintenance-orders-updated", listener);
    };
  }, []);

  useEffect(() => {
    const getGroupItems = (groupIds: string[]): ChecklistItem[] => {
      if (!groupIds || groupIds.length === 0) return [];
      const relevant = (groupQuestions as GroupQuestion[]).filter((q) => groupIds.includes(q.group_id));
      return relevant
        .sort((a, b) => (a.order_number || 0) - (b.order_number || 0))
        .map((q) => ({
          id: q.id,
          question: q.question,
          alertOnYes: Boolean(q.alert_on_yes),
          alertOnNo: Boolean(q.alert_on_no),
          answer: null,
        }));
    };

    const sourceItems =
      supabaseChecklistItems.length > 0 ? supabaseChecklistItems : defaultChecklistItems;

    const groupItems = getGroupItems(equipmentGroupIds);
    const filteredItems = groupItems.length > 0
      ? groupItems
      : filterChecklistItemsByEquipmentType(
          sourceItems,
          selectedEquipment?.type ?? selectedEquipment?.name
        );

    const needsUpdate =
      checklist.length !== filteredItems.length ||
      checklist.some((item, index) => {
        const filteredItem = filteredItems[index];
        return !filteredItem || item.id !== filteredItem.id;
      });

    if (needsUpdate && !hasInteractedWithChecklist) {
      const normalizedChecklist = filteredItems.map((item) => ({
        id: item.id,
        question: item.question,
        answer: null,
        alertOnYes: item.alertOnYes ?? false,
        alertOnNo: item.alertOnNo ?? false,
      }));
      setChecklist(normalizedChecklist);
    }
  }, [
    supabaseChecklistItems,
    selectedEquipment?.type,
    equipmentGroupIds,
    groupQuestions,
    hasInteractedWithChecklist,
    checklist,
  ]);

  useEffect(() => {
    if (hasInitializedOperator || operators.length === 0) {
      return;
    }

    const storedState = getChecklistState();
    const storedOperator = storedState.operator;

    if (!storedOperator) {
      setHasInitializedOperator(true);
      return;
    }

    const storedIdentifier = getOperatorIdentifier(storedOperator);
    if (!storedIdentifier) {
      setHasInitializedOperator(true);
      return;
    }

    const existingOperator = operators.find(op => getOperatorIdentifier(op) === storedIdentifier);
    const normalizedOperator = normalizeOperator(existingOperator || storedOperator);

    if (normalizedOperator.id) {
      setSelectedOperator(normalizedOperator);
      setIsOperatorLocked(true);
      saveChecklistState({ operator: normalizedOperator });
    }

    setHasInitializedOperator(true);
  }, [operators, hasInitializedOperator]);

  const handleOperatorSelect = (operatorId: string) => {
    console.log("Selecting operator with identifier:", operatorId);
    const operator = operators.find(op => getOperatorIdentifier(op) === operatorId);

    if (operator) {
      const normalizedOperator = normalizeOperator(operator);
      console.log("Operator found and normalized:", normalizedOperator);
      setSelectedOperator(normalizedOperator);
      setIsOperatorLocked(true);
      saveChecklistState({ operator: normalizedOperator });
    } else {
      console.warn("Operator not found for id:", operatorId);
      toast({
        title: "Operador não encontrado",
        description: "Não foi possível localizar o operador selecionado.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (!selectedEquipment) return;

    const stillAllowed = filteredEquipments.some((eq) => eq.id === selectedEquipment.id);
    if (!stillAllowed) {
      setSelectedEquipment(null);
      setChecklist([]);
      setHasInteractedWithChecklist(false);
      setHighlightUnanswered(false);
      saveChecklistState({ equipment: null, checklist: [] });
    }
  }, [filteredEquipments, selectedEquipment]);

  useEffect(() => {
    if (!selectedEquipment || ordersForSelectedEquipment.length === 0) {
      setMaintenanceOrderId(null);
      setMaintenanceOrderNumber("");
      setMaintenanceStatus("open");
      setMaintenanceNotes("");
      return;
    }

    const activeOrder = ordersForSelectedEquipment.find(order => order.status === "open");
    const latestOrder = ordersForSelectedEquipment[0];

    setMaintenanceOrderId(activeOrder?.id ?? latestOrder?.id ?? null);
    setMaintenanceOrderNumber(activeOrder?.orderNumber ?? latestOrder?.orderNumber ?? "");
    setMaintenanceStatus(activeOrder?.status ?? "open");
    setMaintenanceNotes(activeOrder?.notes ?? latestOrder?.notes ?? "");
  }, [selectedEquipment, ordersForSelectedEquipment]);

  const activeMaintenanceOrder = useMemo(() => {
    return ordersForSelectedEquipment.find(order => order.status === "open") ?? null;
  }, [ordersForSelectedEquipment]);

  const latestMaintenanceOrder = ordersForSelectedEquipment[0] ?? null;
  const hasOrdersForSelectedEquipment = ordersForSelectedEquipment.length > 0;

  const getMaintenanceStatusLabel = (status: MaintenanceOrder["status"]) => {
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

  const formatOrderDate = (isoDate?: string) => {
    if (!isoDate) return "-";
    try {
      return format(new Date(isoDate), "dd/MM/yyyy HH:mm", { locale: ptBR });
    } catch (error) {
      console.warn("Não foi possível formatar data da OS:", error);
      return "-";
    }
  };

  const handleUnlockOperator = () => {
    setOperatorUnlockDialogOpen(true);
    setOperatorUnlockSelection(selectedOperator?.id || "");
    setOperatorUnlockPassword("");
    setOperatorUnlockError(null);
  };

  const handleOperatorUnlockDialogChange = (open: boolean) => {
    setOperatorUnlockDialogOpen(open);
    if (!open) {
      setOperatorUnlockSelection("");
      setOperatorUnlockPassword("");
      setOperatorUnlockError(null);
    }
  };

  const confirmOperatorUnlock = () => {
    if (!operatorUnlockSelection) {
      setOperatorUnlockError("Selecione o novo operador.");
      return;
    }

    const trimmedPassword = operatorUnlockPassword.trim();
    if (!trimmedPassword) {
      setOperatorUnlockError("Informe a senha do operador selecionado.");
      return;
    }

    const matchingOperator = operators.find(
      (op) => getOperatorIdentifier(op) === operatorUnlockSelection,
    );
    if (!matchingOperator) {
      setOperatorUnlockError("Operador selecionado não encontrado.");
      return;
    }

    const rawSenha = matchingOperator?.senha ? String(matchingOperator.senha).trim() : "";
    const [expectedPassword, senhaFlag] = rawSenha.split("|");

    if (!expectedPassword) {
      setOperatorUnlockError("Este operador não possui senha cadastrada. Solicite ao administrador.");
      return;
    }

    if (expectedPassword !== trimmedPassword) {
      setOperatorUnlockError("Senha incorreta. Tente novamente.");
      return;
    }

    const requiresReset = (senhaFlag || "").toUpperCase() === "RESET";
    if (requiresReset) {
      setOperatorUnlockError("Esta senha requer troca. Use a tela inicial para definir uma nova senha.");
      return;
    }

    const normalizedOperator = normalizeOperator(matchingOperator);

    setOperatorUnlockDialogOpen(false);
    setOperatorUnlockSelection(normalizedOperator.id);
    setOperatorUnlockPassword("");
    setOperatorUnlockError(null);
    setSelectedOperator(normalizedOperator);
    setIsOperatorLocked(true);
    saveChecklistState({ operator: normalizedOperator });
  };

  const handleEquipmentSelect = (equipmentId: string) => {
    const equipment = equipments.find(eq => eq.id === equipmentId) || null;
    setSelectedEquipment(equipment);
    setHasInteractedWithChecklist(false);
    setHighlightUnanswered(false);
    setChecklist([]);
    saveChecklistState({ equipment, checklist: [] });
  };

  const handleChecklistChange = (id: string, answer: "Sim" | "Não" | "N/A" | "Selecione") => {
    setHasInteractedWithChecklist(true);
    setChecklist((prevChecklist) => {
      const updated = prevChecklist.map((item) =>
        item.id === id ? { ...item, answer } : item
      );

      if (highlightUnanswered) {
        const remaining = updated.some(
          (item) => item.answer === null || item.answer === "Selecione"
        );
        if (!remaining) {
          setHighlightUnanswered(false);
        }
      }

      return updated;
    });
  };

  const handleAddOperator = async (data: { id: string; name: string; cargo?: string; setor?: string; senha: string }) => {
    try {
      const { operatorService } = await import('@/lib/supabase-service');

      await operatorService.create({
        matricula: data.id,
        name: data.name.toUpperCase(),
        cargo: data.cargo ? data.cargo.toUpperCase() : null,
        setor: data.setor || null,
        senha: data.senha.trim(),
      });
      
      toast({
        title: "Operador adicionado",
        description: `O operador ${data.name} foi adicionado com sucesso.`,
      });
      
      // Refresh data to get the newly added operator
      refresh();
      
    } catch (error) {
      console.error('Erro ao adicionar operador:', error);
      toast({
        title: "Erro",
        description: "Não foi possível adicionar o operador. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const resizeImageToDataUrl = (file: File, maxSize = 1280): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        const ratio = Math.min(maxSize / width, maxSize / height, 1);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Não foi possível processar a imagem."));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Não foi possível gerar a imagem."));
              return;
            }
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error("Falha ao ler a imagem."));
            reader.readAsDataURL(blob);
          },
          "image/jpeg",
          0.7
        );
      };
      img.onerror = () => reject(new Error("Falha ao carregar a imagem."));
      img.src = URL.createObjectURL(file);
    });
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const MAX_PHOTOS = 5;
    if (photos.length >= MAX_PHOTOS) {
      toast({
        title: "Limite de fotos atingido",
        description: `Você pode anexar até ${MAX_PHOTOS} fotos por checklist.`,
        variant: "destructive",
      });
      return;
    }

    try {
      for (const file of Array.from(files)) {
        if (photos.length >= MAX_PHOTOS) break;
        const dataUrl = await resizeImageToDataUrl(file, 1280);
        setPhotos((prev) => [...prev, { id: `${Date.now()}-${file.name}`, data: dataUrl }]);
      }
    } catch (err) {
      console.error("Erro ao processar foto:", err);
      toast({
        title: "Erro ao anexar foto",
        description: err instanceof Error ? err.message : "Não foi possível adicionar a imagem. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      if (event.target) {
        event.target.value = "";
      }
    }
  };

  const handleRemovePhoto = (id: string) => {
    setPhotos(prev => prev.filter(photo => photo.id !== id));
  };

  const handleOpenMaintenanceDialog = () => {
    if (!selectedEquipment) {
      toast({
        title: "Selecione um equipamento",
        description: "Escolha o equipamento antes de registrar uma OS.",
        variant: "destructive",
      });
      return;
    }

    const activeOrder = ordersForSelectedEquipment.find(order => order.status === "open");
    const latestOrder = ordersForSelectedEquipment[0];

    setMaintenanceOrderId(activeOrder?.id ?? latestOrder?.id ?? null);
    setMaintenanceOrderNumber(activeOrder?.orderNumber ?? latestOrder?.orderNumber ?? "");
    setMaintenanceStatus(activeOrder?.status ?? "open");
    setMaintenanceNotes(activeOrder?.notes ?? latestOrder?.notes ?? "");
    setMaintenanceDialogOpen(true);
  };

  const handleSaveMaintenanceOrder = () => {
    if (!selectedEquipment) return;

    const trimmedNumber = maintenanceOrderNumber.trim();
    if (!trimmedNumber) {
      toast({
        title: "Número da OS obrigatório",
        description: "Informe o número da ordem de serviço para continuar.",
        variant: "destructive",
      });
      return;
    }

    const trimmedNotes = maintenanceNotes.trim();
    const existingOrder = maintenanceOrders.find(order => order.id === maintenanceOrderId);
    const inspectionId =
      existingOrder?.inspectionId ?? `equipment-${selectedEquipment.id}-${Date.now()}`;

    const { order, orders } = upsertMaintenanceOrder({
      id: maintenanceOrderId,
      inspectionId,
      equipmentId: selectedEquipment.id,
      orderNumber: trimmedNumber,
      status: maintenanceStatus,
      notes: trimmedNotes || undefined,
    });

    setMaintenanceOrders(orders);
    setMaintenanceOrderId(order.id);
    setMaintenanceOrderNumber(order.orderNumber);
    setMaintenanceStatus(order.status);
    setMaintenanceNotes(order.notes ?? "");
    setMaintenanceDialogOpen(false);

    toast({
      title: maintenanceStatus === "closed" ? "OS finalizada" : "OS registrada",
      description:
        maintenanceStatus === "closed"
          ? `A OS ${order.orderNumber} foi marcada como finalizada.`
          : `A OS ${order.orderNumber} foi registrada como em andamento.`,
    });
  };

  const handleDeleteMaintenanceOrders = () => {
    if (!selectedEquipment) return;

    const confirmationMessage = `Remover todas as ordens de serviço do equipamento "${selectedEquipment.name}"?`;
    const confirmed =
      typeof window === "undefined" ? true : window.confirm(confirmationMessage);

    if (!confirmed) {
      return;
    }

    const updatedOrders = deleteMaintenanceOrdersByEquipment(selectedEquipment.id);
    setMaintenanceOrders(updatedOrders);
    setMaintenanceOrderId(null);
    setMaintenanceOrderNumber("");
    setMaintenanceStatus("open");
    setMaintenanceNotes("");
    setMaintenanceDialogOpen(false);

    toast({
      title: "OS removidas",
      description: `Todas as OS do equipamento ${selectedEquipment.name} foram excluídas.`,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedOperator) {
      toast({
        title: "Erro",
        description: "Selecione um operador para continuar",
        variant: "destructive",
      });
      return;
    }

    if (!selectedEquipment) {
      toast({
        title: "Erro",
        description: "Selecione um equipamento para continuar",
        variant: "destructive",
      });
      return;
    }

    const unansweredItems = checklist.filter(item => item.answer === null || item.answer === "Selecione");
    if (unansweredItems.length > 0) {
      setHighlightUnanswered(true);
      setHasInteractedWithChecklist(true);
      toast({
        title: "Checklist incompleto",
        description: "Responda todos os itens da verificação para continuar",
        variant: "destructive",
      });
      return;
    }

    if (!signature) {
      toast({
        title: "Assinatura não encontrada",
        description: "Por favor, assine o formulário para confirmar a inspeção",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      // Save inspection to Supabase
      const { inspectionService } = await import('@/lib/supabase-service');
      
      const operatorMatricula = getOperatorIdentifier(selectedOperator);
      
      const inspectionData = {
        operator_matricula: operatorMatricula,
        equipment_id: selectedEquipment.id,
        inspection_date: inspectionDate,
        submission_date: new Date().toISOString(),
        comments: comments || null,
        signature: signature || null,
        photos: photos.length > 0 ? photos : [],
        checklist_answers: checklist.map(item => ({
          id: item.id,
          question: item.question,
          answer: item.answer,
          alertOnYes: item.alertOnYes ?? false,
          alertOnNo: item.alertOnNo ?? false,
        }))
      };

      await inspectionService.create(inspectionData);
      refresh();

      // Check if leader already exists for this sector if updating
      if (selectedEquipment.sector) {
        try {
          const savedLeaders = localStorage.getItem('checklistafm-leaders');
          if (savedLeaders) {
            const leaders = JSON.parse(savedLeaders);
            const sectorLeaders = leaders.filter(leader => leader.sector === selectedEquipment.sector);
            
            if (sectorLeaders.length > 0) {
              // If we have leaders for this sector, simulate sending email notification
              toast({
                title: "Notificação enviada",
                description: `${sectorLeaders.length} líder(es) do setor ${selectedEquipment.sector} foram notificados`,
              });
            }
          }
        } catch (error) {
          console.error("Error processing leader notifications:", error);
        }
      }

      toast({
        title: "Checklist enviado com sucesso!",
        description: `Inspeção do equipamento ${selectedEquipment.name} registrada`,
        variant: "default",
      });

      const equipmentName = selectedEquipment.name;

      setChecklist(checklist.map(item => ({ ...item, answer: null })));
      setSignature(null);
      setSelectedEquipment(null);
      setPhotos([]);
      setComments('');
      setHighlightUnanswered(false);
      setHasInteractedWithChecklist(false);
      saveChecklistState({
        equipment: null,
        checklist: [],
        photos: [],
        comments: '',
        signature: null,
      });
      setSuccessEquipmentName(equipmentName);
      setSubmissionSuccess(true);

      // Navigate to leader dashboard if the operator has a sector set
      setTimeout(() => {
        setSubmissionSuccess(false);
        setSuccessEquipmentName(null);
        navigate('/');
      }, 2000);
    } catch (error) {
      console.error('Error saving inspection:', error);
      toast({
        title: "Erro ao salvar",
        description: error instanceof Error ? error.message : "Ocorreu um erro ao salvar a inspeção. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {submissionSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-green-700/95 px-6 text-white">
          <div className="flex max-w-md flex-col items-center gap-4 text-center">
            <CheckCircle size={64} className="text-white" />
            <h2 className="text-2xl font-bold">Inspeção enviada!</h2>
            <p className="text-sm text-green-100">
              {successEquipmentName
                ? `A inspeção do equipamento ${successEquipmentName} foi registrada com sucesso.`
                : "Inspeção registrada com sucesso."}
              {" "}Você será redirecionado para a tela inicial em instantes.
            </p>
          </div>
        </div>
      )}

      <ChecklistHeader backUrl="/" />
      
      <div className="flex-1 p-4 max-w-3xl mx-auto w-full overflow-auto">
        <form onSubmit={handleSubmit}>
          {selectedOperator && isOperatorLocked ? (
            <div className="mb-6 rounded-lg border-2 border-green-200 bg-green-50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-green-700">Operador selecionado</p>
                  <p className="text-xl font-semibold text-green-900">
                    {selectedOperator.name}
                  </p>
                  <div className="mt-1 text-sm text-green-800">
                    <div>Matrícula: {selectedOperator.matricula}</div>
                    {selectedOperator.setor && <div>Setor: {selectedOperator.setor}</div>}
                    {selectedOperator.cargo && <div>Cargo: {selectedOperator.cargo}</div>}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleUnlockOperator}
                  className="self-start sm:self-auto"
                >
                  Trocar operador
                </Button>
              </div>
            </div>
          ) : (
            <ChecklistOperatorSelect
              operators={operators}
              selectedOperator={selectedOperator}
              onOperatorSelect={handleOperatorSelect}
            />
          )}

          <ChecklistEquipmentSelect
            equipments={filteredEquipments}
            selectedEquipment={selectedEquipment}
            onEquipmentSelect={handleEquipmentSelect}
            disabled={!selectedOperator}
            emptyMessage={
              selectedOperator
                ? `Nenhum equipamento disponível para o setor ${selectedOperator.setor ?? ""}.`
                : "Selecione o operador para listar os equipamentos do setor."
            }
          />

          {selectedEquipment && (
            <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-700">
                    OS do equipamento {selectedEquipment.name}
                  </p>
                  {activeMaintenanceOrder ? (
                    <div className="mt-2 space-y-1">
                      <Badge variant="destructive" className="text-xs">
                        OS #{activeMaintenanceOrder.orderNumber} • Em andamento
                      </Badge>
                      <p className="text-xs text-gray-600">
                        Aberta em {formatOrderDate(activeMaintenanceOrder.createdAt)}
                      </p>
                      {activeMaintenanceOrder.notes && (
                        <p className="text-xs text-gray-500">
                          Obs.: {activeMaintenanceOrder.notes}
                        </p>
                      )}
                    </div>
                  ) : latestMaintenanceOrder ? (
                    <div className="mt-2 space-y-1">
                      <Badge variant="secondary" className="text-xs">
                        Última OS #{latestMaintenanceOrder.orderNumber} • {getMaintenanceStatusLabel(latestMaintenanceOrder.status)}
                      </Badge>
                      <p className="text-xs text-gray-600">
                        Atualizada em {formatOrderDate(latestMaintenanceOrder.updatedAt)}
                      </p>
                      {latestMaintenanceOrder.notes && (
                        <p className="text-xs text-gray-500">
                          Obs.: {latestMaintenanceOrder.notes}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-gray-500">
                      Sem OS registradas para este equipamento.
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleOpenMaintenanceDialog}
                >
                  Gerenciar OS
                </Button>
              </div>
              {ordersForSelectedEquipment.length > 1 && (
                <div className="mt-3 text-xs text-gray-500">
                  Histórico recente:
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                    {ordersForSelectedEquipment.slice(0, 3).map((order) => (
                      <span key={order.id}>
                        #{order.orderNumber} {getMaintenanceStatusLabel(order.status)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {selectedEquipment && (hasInteractedWithChecklist || highlightUnanswered) && unansweredCount > 0 && (
            <div className="mt-6 rounded-md border-2 border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
              {unansweredCount === 1
                ? "Ainda falta responder 1 pergunta do checklist."
                : `Ainda faltam responder ${unansweredCount} perguntas do checklist.`}
            </div>
          )}

          {selectedEquipment ? (
            <ChecklistItems
              checklist={checklist}
              onChecklistChange={handleChecklistChange}
              highlightUnanswered={highlightUnanswered}
            />
          ) : (
            <div className="mt-6 rounded-md border border-dashed border-gray-300 bg-gray-50 p-4 text-center text-sm text-gray-600">
              Selecione um equipamento para carregar o checklist correspondente.
            </div>
          )}

          <ChecklistPhotoUpload
            photos={photos}
            onPhotoUpload={handlePhotoUpload}
            onRemovePhoto={handleRemovePhoto}
          />

          <ChecklistComments
            comments={comments}
            onChange={(e) => setComments(e.target.value)}
          />

          <div className="mt-6 bg-white p-4 rounded-md shadow-sm border-2 border-gray-200">
            <SignatureCanvas onSignatureChange={setSignature} />
          </div>

          <div className="mt-6 mb-10 flex justify-center">
            <Button 
              type="submit"
              className="bg-red-700 hover:bg-red-800 text-white w-full max-w-xs py-6 text-lg"
              disabled={isSaving}
            >
              {isSaving ? (
                <span className="flex items-center gap-2">
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Salvando...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Save size={20} />
                  Enviar Inspeção
                </span>
              )}
            </Button>
          </div>
        </form>
      </div>

      <Dialog open={maintenanceDialogOpen} onOpenChange={setMaintenanceDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Gerenciar OS do equipamento</DialogTitle>
            <DialogDescription>
              Registre ou atualize a OS relacionada ao equipamento selecionado.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-gray-600">
                Equipamento
              </label>
              <Input
                value={selectedEquipment ? `${selectedEquipment.name} (KP ${selectedEquipment.kp})` : ""}
                disabled
                readOnly
              />
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
                placeholder="Descreva detalhes da manutenção ou responsáveis"
              />
            </div>
          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex w-full sm:w-auto gap-2">
              <Button
                type="button"
                className="flex-1 sm:flex-none"
                variant="outline"
                onClick={() => setMaintenanceDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="flex-1 sm:flex-none"
                variant="destructive"
                onClick={handleDeleteMaintenanceOrders}
                disabled={!selectedEquipment || !hasOrdersForSelectedEquipment}
              >
                Excluir OS
              </Button>
            </div>
            <Button
              type="button"
              onClick={handleSaveMaintenanceOrder}
              disabled={!selectedEquipment}
            >
              Salvar OS
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={operatorUnlockDialogOpen} onOpenChange={handleOperatorUnlockDialogChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Trocar operador</DialogTitle>
            <DialogDescription>
              Escolha o novo operador e informe a senha correspondente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Select
              value={operatorUnlockSelection}
              onValueChange={(value) => setOperatorUnlockSelection(value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o operador" />
              </SelectTrigger>
              <SelectContent>
                {operators.map((op) => {
                  const id = getOperatorIdentifier(op);
                  return (
                    <SelectItem key={id} value={id}>
                      {op.name || id}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <Input
              type="password"
              placeholder="Senha do operador"
              value={operatorUnlockPassword}
              maxLength={4}
              onChange={(e) => setOperatorUnlockPassword(e.target.value.replace(/[^0-9]/g, ""))}
              autoFocus
            />
            {operatorUnlockError && (
              <p className="text-sm text-red-600">{operatorUnlockError}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOperatorUnlockDialogChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={confirmOperatorUnlock}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AddOperatorDialog 
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onAddOperator={handleAddOperator}
        sectors={sectors}
      />
    </div>
  );
};

export default Checklist;
