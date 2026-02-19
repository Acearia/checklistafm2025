
import React from "react";
import SignatureCanvas from "@/components/SignatureCanvas";

interface SignatureSectionProps {
  signature: string | null;
  onSignatureChange: (signature: string | null) => void;
  initialSignature?: string | null;
}

const ChecklistSignatureSection: React.FC<SignatureSectionProps> = ({ 
  signature,
  onSignatureChange,
  initialSignature
}) => {
  return (
    <div className="bg-white p-4 rounded-md shadow-sm border border-gray-200">
      <p className="font-medium mb-2">Assinatura do responsável:</p>
      <SignatureCanvas onSignatureChange={onSignatureChange} initialSignature={initialSignature} />
    </div>
  );
};

export default ChecklistSignatureSection;
