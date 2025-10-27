
import React from "react";
import ChecklistHeader from "@/components/checklist/ChecklistHeader";
import { ChecklistStepIndicator } from "@/components/checklist/ChecklistProgressBar";
import ChecklistInspectionSummary from "@/components/checklist/ChecklistInspectionSummary";
import ChecklistAttachmentsSummary from "@/components/checklist/ChecklistAttachmentsSummary";
import ChecklistSignatureSection from "@/components/checklist/ChecklistSignatureSection";
import ChecklistActionButtons from "@/components/checklist/ChecklistActionButtons";
import { useChecklistSubmit } from "@/hooks/useChecklistSubmit";

const ChecklistSubmit = () => {
  const {
    signature,
    setSignature,
    currentState,
    isSaving,
    inspectionDate,
    getChecklistSummary,
    handleBack,
    handleSubmit
  } = useChecklistSubmit();

  const steps = ["Operador", "Equipamento", "Checklist", "Mídia", "Enviar"];
  const summary = getChecklistSummary();

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <ChecklistHeader backUrl="/checklist-steps/media" />

      <div className="flex-1 p-4 max-w-3xl mx-auto w-full">
        <ChecklistStepIndicator steps={steps} currentStep={4} />
        
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-4">Confirmar e enviar inspeção</h2>
          
          <ChecklistInspectionSummary 
            operator={currentState.operator}
            equipment={currentState.equipment}
            inspectionDate={inspectionDate}
            summary={summary}
          />

          <ChecklistAttachmentsSummary 
            photos={currentState.photos}
            comments={currentState.comments}
          />

          <ChecklistSignatureSection 
            signature={signature}
            onSignatureChange={setSignature}
            initialSignature={currentState.signature}
          />
        </div>

        <ChecklistActionButtons 
          onBack={handleBack}
          onSubmit={handleSubmit}
          isSaving={isSaving}
        />
      </div>
    </div>
  );
};

export default ChecklistSubmit;
