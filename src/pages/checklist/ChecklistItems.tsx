
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import ChecklistHeader from "@/components/checklist/ChecklistHeader";
import { ChecklistStepIndicator } from "@/components/checklist/ChecklistProgressBar";
import type { ChecklistItem } from "@/lib/data";
import { getChecklistState, saveChecklistState } from "@/lib/checklistStore";
import { useChecklistData } from "@/hooks/useChecklistData";
import { checklistItems as defaultChecklistItems } from "@/lib/data";
import { filterChecklistItemsByEquipmentType } from "@/lib/checklistQuestionsByEquipmentType";

const ChecklistItems = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [currentState, setCurrentState] = useState(getChecklistState());
  const { checklistItems: supabaseChecklistItems } = useChecklistData();

  const steps = ["Operador", "Equipamento", "Checklist", "Mídia", "Enviar"];

  useEffect(() => {
    const state = getChecklistState();
    setCurrentState(state);

    // Verificar se as etapas anteriores foram concluídas
    if (!state.operator || !state.equipment) {
      navigate('/checklist-steps/operator');
      return;
    }

    const sourceItems =
      supabaseChecklistItems.length > 0 ? supabaseChecklistItems : defaultChecklistItems;

    const filteredSourceItems = filterChecklistItemsByEquipmentType(
      sourceItems,
      state.equipment?.type ?? state.equipment?.name
    );

    const templateItems = filteredSourceItems.map((item) => ({
      id: item.id,
      question: item.question,
      answer: null,
      alertOnYes: item.alertOnYes ?? false,
      alertOnNo: item.alertOnNo ?? false,
    }));

    if (state.checklist && state.checklist.length > 0) {
      const checklistMap = new Map(state.checklist.map(item => [item.id, item]));
      const mergedChecklist = templateItems.map(item => {
        const saved = checklistMap.get(item.id);
        if (saved) {
          return {
            ...item,
            answer: saved.answer ?? null,
            alertOnYes: saved.alertOnYes ?? item.alertOnYes ?? false,
            alertOnNo: saved.alertOnNo ?? item.alertOnNo ?? false,
          };
        }
        return item;
      });

      setChecklist(mergedChecklist);
    } else {
      setChecklist(templateItems);
    }
  }, [navigate, supabaseChecklistItems]);

  const handleChecklistChange = (id: string, answer: "Sim" | "Não" | "N/A" | "Selecione") => {
    setChecklist(prevChecklist => 
      prevChecklist.map(item => 
        item.id === id ? { ...item, answer } : item
      )
    );
  };

  const handleBack = () => {
    // Salvar o progresso atual antes de voltar
    saveChecklistState({ checklist });
    navigate('/checklist-steps/equipment');
  };

  const handleNext = () => {
    const unansweredItems = checklist.filter(item => item.answer === null || item.answer === "Selecione");
    if (unansweredItems.length > 0) {
      toast({
        title: "Checklist incompleto",
        description: "Responda todos os itens da verificação para continuar",
        variant: "destructive",
      });
      return;
    }

    // Salvar as respostas do checklist no estado
    saveChecklistState({ checklist });
    
    // Navegar para a próxima etapa
    navigate('/checklist-steps/media');
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <ChecklistHeader backUrl="/checklist-steps/equipment" />

      <div className="flex-1 p-4 max-w-3xl mx-auto w-full">
        <ChecklistStepIndicator steps={steps} currentStep={2} />
        
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-4">Preencha o checklist</h2>
          
          <div className="bg-blue-50 p-3 rounded-md mb-4">
            <p className="text-sm">
              <strong>Operador:</strong> {currentState.operator?.name || "Não selecionado"}
            </p>
            <p className="text-sm">
              <strong>Equipamento:</strong> {currentState.equipment?.name || "Não selecionado"} 
              (KP: {currentState.equipment?.kp || "-"})
            </p>
          </div>

          <div className="space-y-4">
            {checklist.map((item, index) => (
              <div key={item.id} className="p-3 bg-white rounded-md shadow-sm border border-gray-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="text-sm sm:text-base font-medium flex-grow">
                    <span className="font-semibold text-gray-900 mr-2">{index + 1} -</span>
                    {item.question}
                  </div>
                  <div className="w-full sm:w-36">
                    <Select
                      onValueChange={(value) => 
                        handleChecklistChange(item.id, value as "Sim" | "Não" | "N/A" | "Selecione")
                      }
                      value={item.answer || "Selecione"}
                    >
                      <SelectTrigger className="w-full bg-white">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Selecione">Selecione</SelectItem>
                        <SelectItem value="Sim">Sim</SelectItem>
                        <SelectItem value="Não">Não</SelectItem>
                        <SelectItem value="N/A">N/A</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 flex justify-between">
          <Button 
            onClick={handleBack}
            variant="outline"
            className="px-6 py-2"
          >
            Voltar
          </Button>
          
          <Button 
            onClick={handleNext}
            className="bg-red-700 hover:bg-red-800 text-white px-6 py-2"
          >
            Próximo
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChecklistItems;
