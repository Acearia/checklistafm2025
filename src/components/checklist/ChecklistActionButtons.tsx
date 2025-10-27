
import React from "react";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";

interface ActionButtonsProps {
  onBack: () => void;
  onSubmit: () => void;
  isSaving: boolean;
}

const ChecklistActionButtons: React.FC<ActionButtonsProps> = ({ 
  onBack, 
  onSubmit, 
  isSaving 
}) => {
  return (
    <div className="mt-8 flex justify-between">
      <Button 
        onClick={onBack}
        variant="outline"
        className="px-6 py-2"
      >
        Voltar
      </Button>
      
      <Button 
        onClick={onSubmit}
        className="bg-red-700 hover:bg-red-800 text-white px-6 py-2 flex items-center gap-2"
        disabled={isSaving}
      >
        {isSaving ? (
          <>
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Salvando...
          </>
        ) : (
          <>
            <Save size={18} />
            Enviar Inspeção
          </>
        )}
      </Button>
    </div>
  );
};

export default ChecklistActionButtons;
