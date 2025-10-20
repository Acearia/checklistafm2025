
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import ChecklistHeader from "@/components/checklist/ChecklistHeader";
import { ChecklistStepIndicator } from "@/components/checklist/ChecklistProgressBar";
import { equipments as initialEquipments } from "@/lib/data";
import { 
  getChecklistState, 
  saveChecklistState 
} from "@/lib/checklistStore";
import { useEquipmentSelection } from "@/hooks/useEquipmentSelection";
import EquipmentDetails from "@/components/checklist/EquipmentDetails";
import EquipmentDebugButton from "@/components/checklist/EquipmentDebugButton";
import ChecklistEquipmentSearchSelect from "@/components/checklist/ChecklistEquipmentSearchSelect";

const ChecklistEquipment = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { 
    equipments, 
    selectedEquipment, 
    handleEquipmentSelect,
    initializeEquipments
  } = useEquipmentSelection();
  
  const steps = ["Operador", "Equipamento", "Checklist", "Mídia", "Enviar"];

  useEffect(() => {
    // Verificar se o operador foi selecionado
    const currentState = getChecklistState();
    if (!currentState.operator) {
      navigate('/checklist-steps/operator');
      return;
    }
    
    // Carregar equipamento selecionado anteriormente se existir
    if (currentState.equipment) {
      handleEquipmentSelect(currentState.equipment.id);
    }
  }, [navigate]);

  // Debug function to log available equipments
  const logEquipments = () => {
    console.log("Currently loaded equipments:", equipments);
    if (equipments.length === 0) {
      console.warn("No equipments available for selection!");
      initializeEquipments(initialEquipments);
    }
  };

  const handleBack = () => {
    navigate('/checklist-steps/operator');
  };

  const handleNext = () => {
    if (!selectedEquipment) {
      toast({
        title: "Erro",
        description: "Selecione um equipamento para continuar",
        variant: "destructive",
      });
      return;
    }

    // Salvar o equipamento selecionado no estado
    saveChecklistState({ equipment: selectedEquipment });
    
    // Navegar para a próxima etapa
    navigate('/checklist-steps/items');
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <ChecklistHeader backUrl="/checklist-steps/operator" />

      <div className="flex-1 p-4 max-w-3xl mx-auto w-full">
        <ChecklistStepIndicator steps={steps} currentStep={1} />
        
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-4">Selecione o equipamento</h2>

          <ChecklistEquipmentSearchSelect
            equipments={equipments}
            selectedEquipment={selectedEquipment}
            onEquipmentSelect={handleEquipmentSelect}
          />
          
          {equipments.length === 0 && (
            <div className="mt-2 text-sm text-red-500">
              Nenhum equipamento disponível para seleção.
              <Button 
                onClick={() => initializeEquipments(initialEquipments)} 
                variant="link" 
                className="text-blue-600 px-1"
              >
                Recarregar equipamentos
              </Button>
            </div>
          )}

          {selectedEquipment && (
            <EquipmentDetails equipment={selectedEquipment} />
          )}
          
          <EquipmentDebugButton 
            equipments={equipments}
            onDebugClick={logEquipments}
          />
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

export default ChecklistEquipment;
