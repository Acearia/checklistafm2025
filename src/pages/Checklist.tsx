
import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Save, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import SignatureCanvas from "@/components/SignatureCanvas";
import { ChecklistItem, Operator, Equipment } from "@/lib/data";
import { AddOperatorDialog } from "@/components/operators/AddOperatorDialog";
import ChecklistHeader from "@/components/checklist/ChecklistHeader";
import ChecklistOperatorSelect from "@/components/checklist/ChecklistOperatorSelect";
import ChecklistEquipmentSelect from "@/components/checklist/ChecklistEquipmentSelect";
import ChecklistItems from "@/components/checklist/ChecklistItems";
import ChecklistPhotoUpload from "@/components/checklist/ChecklistPhotoUpload";
import ChecklistComments from "@/components/checklist/ChecklistComments";
import { useChecklistData } from "@/hooks/useChecklistData";
import { getChecklistState, saveChecklistState } from "@/lib/checklistStore";

const Checklist = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const {
    operators,
    equipments,
    checklistItems: supabaseChecklistItems,
    sectors,
    refresh
  } = useChecklistData();

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
  
  // State for photos and comments
  const [photos, setPhotos] = useState<{ id: string, data: string }[]>([]);
  const [comments, setComments] = useState<string>('');

  const unansweredCount = useMemo(
    () =>
      checklist.filter((item) => item.answer === null || item.answer === "Selecione")
        .length,
    [checklist]
  );

  // Debug: Log operators when they change
  useEffect(() => {
    console.log("Operators updated in Checklist:", operators.length);
    console.log("Operators data:", operators);
  }, [operators]);

  useEffect(() => {
    if (supabaseChecklistItems.length > 0) {
      const needsUpdate =
        checklist.length !== supabaseChecklistItems.length ||
        checklist.some((item, index) => {
          const supabaseItem = supabaseChecklistItems[index];
          return !supabaseItem || item.id !== supabaseItem.id;
        });

      if (needsUpdate && !hasInteractedWithChecklist) {
        const normalizedChecklist = supabaseChecklistItems.map((item) => ({
          id: item.id,
          question: item.question,
          answer: null,
          alertOnYes: item.alertOnYes,
          alertOnNo: item.alertOnNo,
        }));
        setChecklist(normalizedChecklist);
      }
    }
  }, [supabaseChecklistItems, hasInteractedWithChecklist, checklist]);

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

    const expectedPassword = matchingOperator?.senha
      ? String(matchingOperator.senha).trim()
      : "";

    if (!expectedPassword) {
      setOperatorUnlockError("Este operador não possui senha cadastrada. Solicite ao administrador.");
      return;
    }

    if (expectedPassword !== trimmedPassword) {
      setOperatorUnlockError("Senha incorreta. Tente novamente.");
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

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setPhotos(prev => [...prev, { id: Date.now().toString(), data: result }]);
      };
      reader.readAsDataURL(file);
    });
    
    // Reset the file input to allow selecting the same file again
    if (event.target) {
      event.target.value = '';
    }
  };

  const handleRemovePhoto = (id: string) => {
    setPhotos(prev => prev.filter(photo => photo.id !== id));
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
          answer: item.answer
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
        description: "Ocorreu um erro ao salvar a inspeção. Tente novamente.",
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
            equipments={equipments}
            selectedEquipment={selectedEquipment}
            onEquipmentSelect={handleEquipmentSelect}
          />

          {(hasInteractedWithChecklist || highlightUnanswered) && unansweredCount > 0 && (
            <div className="mt-6 rounded-md border-2 border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
              {unansweredCount === 1
                ? "Ainda falta responder 1 pergunta do checklist."
                : `Ainda faltam responder ${unansweredCount} perguntas do checklist.`}
            </div>
          )}

          <ChecklistItems
            checklist={checklist}
            onChecklistChange={handleChecklistChange}
            highlightUnanswered={highlightUnanswered}
          />

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
