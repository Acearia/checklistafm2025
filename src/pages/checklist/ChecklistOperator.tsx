import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ChecklistHeader from "@/components/checklist/ChecklistHeader";
import { ChecklistStepIndicator } from "@/components/checklist/ChecklistProgressBar";
import { operators as initialOperators, Operator, sectors as initialSectors } from "@/lib/data";
import { getChecklistState, saveChecklistState } from "@/lib/checklistStore";
import { AddOperatorDialog } from "@/components/operators/AddOperatorDialog";
import ChecklistOperatorSearchSelect from "@/components/checklist/ChecklistOperatorSearchSelect";

const ChecklistOperator = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [operators, setOperators] = useState<Operator[]>([]);
  const [selectedOperator, setSelectedOperator] = useState<Operator | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);

  const steps = ["Operador", "Equipamento", "Checklist", "Mídia", "Enviar"];

  useEffect(() => {
    loadOperators();
    
    // Carregar operador selecionado anteriormente se existir
    const currentState = getChecklistState();
    if (currentState.operator) {
      setSelectedOperator(currentState.operator);
    }
  }, []);

  const loadOperators = () => {
    setIsLoadingData(true);
    
    try {
      const storedOperators = localStorage.getItem('checklistafm-operators');
      if (storedOperators) {
        const parsedOperators = JSON.parse(storedOperators);
        const normalizedOperators = parsedOperators.map((op: any, index: number) => ({
          ...op,
          id: op.id || op.matricula || `local-operator-${index}`,
          matricula: op.matricula || op.id || `9${(index + 1).toString().padStart(3, '0')}`,
        }));
        setOperators(normalizedOperators);
        localStorage.setItem('checklistafm-operators', JSON.stringify(normalizedOperators));
      } else {
        localStorage.setItem('checklistafm-operators', JSON.stringify(initialOperators));
        setOperators(initialOperators);
      }
    } catch (e) {
      console.error('Error loading operators:', e);
      setOperators(initialOperators);
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleOperatorSelect = (operatorId: string) => {
    console.log("Operator selected with ID:", operatorId);
    const operator = operators.find(op => {
      const opMatricula = (op as any).matricula || op.id;
      return opMatricula === operatorId || op.id === operatorId;
    });
    if (operator) {
      console.log("Found operator:", operator);
      setSelectedOperator(operator);
    } else {
      console.error("Operator not found with ID:", operatorId);
    }
  };

  const handleAddOperator = (data: { id: string; name: string; cargo?: string; setor?: string; senha?: string }) => {
    const uppercaseName = data.name.toUpperCase();
    const formattedMatricula = data.id.trim();
    const newOperator: Operator = {
      id: formattedMatricula,
      matricula: formattedMatricula,
      name: uppercaseName,
      cargo: data.cargo?.toUpperCase(),
      setor: data.setor,
      senha: data.senha,
    };
    
    const updatedOperators = [newOperator, ...operators];
    setOperators(updatedOperators);
    
    // Store the updated list in localStorage
    localStorage.setItem('checklistafm-operators', JSON.stringify(updatedOperators));
    
    toast({
      title: "Operador adicionado",
      description: `O operador ${data.name} foi adicionado com sucesso.`,
    });
  };

  const handleNext = () => {
    if (!selectedOperator) {
      toast({
        title: "Erro",
        description: "Selecione um operador para continuar",
        variant: "destructive",
      });
      return;
    }

    // Salvar o operador selecionado no estado
    saveChecklistState({ operator: selectedOperator });
    
    // Navegar para a próxima etapa
    navigate('/checklist-steps/equipment');
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <ChecklistHeader backUrl="/" />

      <div className="flex-1 p-4 max-w-3xl mx-auto w-full">
        <ChecklistStepIndicator steps={steps} currentStep={0} />
        
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-4">Selecione um operador</h2>
          
          <ChecklistOperatorSearchSelect
            operators={operators}
            selectedOperator={selectedOperator}
            onOperatorSelect={handleOperatorSelect}
          />
          
          <div className="mt-4 flex justify-center">
            <Button 
              variant="outline"
              onClick={() => setDialogOpen(true)}
              className="flex items-center gap-1"
            >
              <PlusCircle size={16} />
              Adicionar novo operador
            </Button>
          </div>
        </div>

        <div className="mt-8 flex justify-end">
          <Button 
            onClick={handleNext}
            className="bg-red-700 hover:bg-red-800 text-white px-6 py-2"
            disabled={!selectedOperator}
          >
            Próximo
          </Button>
        </div>
      </div>
      
      <AddOperatorDialog 
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onAddOperator={handleAddOperator}
        sectors={initialSectors}
      />
    </div>
  );
};

export default ChecklistOperator;
