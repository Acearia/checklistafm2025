
import React from "react";
import ChecklistHeader from "@/components/checklist/ChecklistHeader";
import { ChecklistStepIndicator } from "@/components/checklist/ChecklistProgressBar";
import ChecklistInspectionSummary from "@/components/checklist/ChecklistInspectionSummary";
import ChecklistAttachmentsSummary from "@/components/checklist/ChecklistAttachmentsSummary";
import ChecklistSignatureSection from "@/components/checklist/ChecklistSignatureSection";
import ChecklistActionButtons from "@/components/checklist/ChecklistActionButtons";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
    handleSubmit,
    isSubmitConfirmationOpen,
    submitConfirmationItems,
    handleConfirmSubmit,
    handleCancelSubmitConfirmation
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

      <AlertDialog
        open={isSubmitConfirmationOpen}
        onOpenChange={(open) => {
          if (!open) {
            handleCancelSubmitConfirmation();
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar envio com alerta</AlertDialogTitle>
            <AlertDialogDescription>
              Existem respostas com alerta nesta inspeção. Se você finalizar agora, o
              sistema vai registrar a falha e enviar a notificação para o
              administrativo e para os líderes.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="max-h-64 overflow-y-auto rounded-md border bg-slate-50 p-3">
            <p className="mb-3 text-sm font-medium text-slate-700">
              Itens que serão finalizados com alerta:
            </p>
            <div className="space-y-2">
              {submitConfirmationItems.map((item, index) => (
                <div key={item.id} className="rounded-md border bg-white p-3 text-sm">
                  <p className="font-medium text-slate-900">
                    {index + 1}. {item.question}
                  </p>
                  <p className="mt-1 text-slate-600">
                    Resposta: <span className="font-semibold">{item.answer || "Sem resposta"}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelSubmitConfirmation}>
              Voltar e revisar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSubmit}>
              Finalizar mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ChecklistSubmit;
