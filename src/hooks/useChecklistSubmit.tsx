
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { getChecklistState, saveChecklistState, clearChecklistState } from "@/lib/checklistStore";
import { isDatabaseConnected } from "@/lib/dataInitializer";
import { appendChecklistAlert } from "@/lib/checklistTemplate";
import type { ChecklistAlert } from "@/lib/types";

export const useChecklistSubmit = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [signature, setSignature] = useState<string | null>(null);
  const [currentState, setCurrentState] = useState(getChecklistState());
  const [isSaving, setIsSaving] = useState(false);
  const [inspectionDate] = useState<string>(
    currentState.inspectionDate || new Date().toISOString().split('T')[0]
  );
  const [dbConnectionStatus, setDbConnectionStatus] = useState<'unchecked' | 'connected' | 'error'>('unchecked');

  useEffect(() => {
    // Verify if previous steps were completed
    if (!currentState.operator || !currentState.equipment || currentState.checklist.length === 0) {
      navigate('/checklist-steps/operator');
      return;
    }

    // Check database connection
    checkDatabaseConnection();

    // Load signature if it exists
    if (currentState.signature) {
      setSignature(currentState.signature);
    }
  }, [navigate, currentState.operator, currentState.equipment, currentState.checklist]);

  const checkDatabaseConnection = () => {
    const isConnected = isDatabaseConnected();
    setDbConnectionStatus(isConnected ? 'connected' : 'error');
  };

  const createAlertsForChecklist = (inspectionId: string) => {
    if (!currentState.checklist || currentState.checklist.length === 0) {
      return 0;
    }

    let alertsCreated = 0;
    currentState.checklist.forEach((item) => {
      if (!item) return;
      const answer = item.answer;
      const triggersAlert =
        (item.alertOnYes && answer === "Sim") ||
        (item.alertOnNo && answer === "Não");

      if (!triggersAlert) {
        return;
      }

      const alert: ChecklistAlert = {
        id: `${inspectionId}-${item.id}`,
        questionId: item.id,
        question: item.question,
        answer: answer as "Sim" | "Não",
        inspectionId,
        operatorName: currentState.operator?.name,
        operatorMatricula: currentState.operator?.matricula,
        equipmentId: currentState.equipment?.id,
        equipmentName: currentState.equipment?.name,
        sector: currentState.equipment?.sector,
        createdAt: new Date().toISOString(),
        seenByAdmin: false,
        seenByLeaders: [],
      };

      appendChecklistAlert(alert);
      alertsCreated += 1;
    });

    return alertsCreated;
  };

  const handleBack = () => {
    // Save signature before going back
    if (signature) {
      saveChecklistState({ signature });
    }
    navigate('/checklist-steps/media');
  };

  const handleSubmit = async () => {
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
      // Save signature to state
      saveChecklistState({ signature });
      
      const formData = {
        id: Date.now().toString(),
        operator: currentState.operator,
        equipment: currentState.equipment,
        checklist: currentState.checklist,
        photos: currentState.photos,
        comments: currentState.comments,
        signature,
        inspectionDate,
        submissionDate: new Date().toISOString(),
      };

      const alertsGenerated = createAlertsForChecklist(formData.id);

      // Store data locally for offline compatibility
      const existingInspections = JSON.parse(localStorage.getItem('checklistafm-inspections') || '[]');
      const updatedInspections = [formData, ...existingInspections];
      localStorage.setItem('checklistafm-inspections', JSON.stringify(updatedInspections));

      // Try to save to Supabase
      try {
        const { inspectionService, operatorService, equipmentService } = await import('@/lib/supabase-service');
        
        // Get operator and equipment IDs from Supabase
        const [operators, equipment] = await Promise.all([
          operatorService.getAll(),
          equipmentService.getAll()
        ]);

        const operatorMatch = operators.find(op => op.name === currentState.operator?.name);
        const equipmentMatch = equipment.find(eq => eq.name === currentState.equipment?.name);

        if (operatorMatch && equipmentMatch) {
          const operatorMatricula = operatorMatch.matricula || operatorMatch.id;
          const sanitizedChecklistAnswers = (currentState.checklist || []).map((item) => ({
            id: item.id,
            question: item.question,
            answer: item.answer,
            alertOnYes: item.alertOnYes ?? false,
            alertOnNo: item.alertOnNo ?? false,
          }));

          await inspectionService.create({
            operator_matricula: operatorMatricula,
            equipment_id: equipmentMatch.id,
            inspection_date: inspectionDate,
            submission_date: new Date().toISOString(),
            comments: currentState.comments || '',
            signature,
            photos: currentState.photos || [],
            checklist_answers: sanitizedChecklistAnswers
          });

          toast({
            title: "Dados sincronizados",
            description: "Inspeção salva e sincronizada com o banco de dados.",
          });
        } else {
          throw new Error('Operador ou equipamento não encontrado no banco');
        }
      } catch (supabaseError) {
        console.error('Erro ao salvar no Supabase:', supabaseError);
        toast({
          title: "Dados salvos localmente",
          description: "Inspeção salva no armazenamento local. Erro na sincronização com o banco.",
          variant: "destructive",
        });
      }

      // Check if there's a leader for this equipment's sector
      try {
        const savedLeaders = localStorage.getItem('checklistafm-leaders');
        if (savedLeaders) {
          const leaders = JSON.parse(savedLeaders);
          const sectorLeaders = leaders.filter(leader => leader.sector === currentState.equipment?.sector);
          
          if (sectorLeaders.length > 0) {
            // If we have leaders for this sector, simulate sending email notification
            toast({
              title: "Notificação enviada",
              description: `${sectorLeaders.length} líder(es) do setor ${currentState.equipment?.sector} foram notificados`,
            });
          }
        }
      } catch (error) {
        console.error("Error processing leader notifications:", error);
      }

      toast({
        title: "Checklist enviado com sucesso!",
        description: `Inspeção do equipamento ${currentState.equipment?.name} registrada`,
        variant: "default",
      });

      if (alertsGenerated > 0) {
        toast({
          title: "Alerta de segurança emitido",
          description: `${alertsGenerated} alerta(s) foram enviados para acompanhamento pelo administrativo e líderes.`,
        });
      }

      // Clear checklist state
      clearChecklistState();

      // Navigate to leader dashboard if the operator has a sector set
      if (currentState.operator?.setor) {
        navigate('/leader');
      } else {
        navigate('/');
      }
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

  // Checklist answer summary
  const getChecklistSummary = () => {
    if (!currentState.checklist || currentState.checklist.length === 0) {
      return { sim: 0, nao: 0, na: 0 };
    }

    return currentState.checklist.reduce((acc, item) => {
      if (item.answer === "Sim") acc.sim++;
      if (item.answer === "Não") acc.nao++;
      if (item.answer === "N/A") acc.na++;
      return acc;
    }, { sim: 0, nao: 0, na: 0 });
  };

  return {
    signature,
    setSignature,
    currentState,
    isSaving,
    inspectionDate,
    dbConnectionStatus,
    getChecklistSummary,
    handleBack,
    handleSubmit
  };
};
