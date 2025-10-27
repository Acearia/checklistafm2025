
import React from "react";

interface SummaryProps {
  operator: { name?: string } | null;
  equipment: { name?: string, kp?: string } | null;
  inspectionDate: string;
  summary: { sim: number, nao: number, na: number };
}

const ChecklistInspectionSummary: React.FC<SummaryProps> = ({ 
  operator, 
  equipment, 
  inspectionDate, 
  summary 
}) => {
  return (
    <div className="bg-blue-50 p-4 rounded-md mb-6 space-y-2">
      <p className="font-medium">Resumo da inspeção:</p>
      <p>
        <strong>Operador:</strong> {operator?.name || ""}
      </p>
      <p>
        <strong>Equipamento:</strong> {equipment?.name || ""} (KP: {equipment?.kp || ""})
      </p>
      <p>
        <strong>Data da inspeção:</strong> {new Date(inspectionDate).toLocaleDateString()}
      </p>
      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        <div className="bg-green-100 p-2 rounded">
          <span className="block text-sm text-green-800">Respostas "Sim"</span>
          <span className="font-bold text-lg">{summary.sim}</span>
        </div>
        <div className="bg-red-100 p-2 rounded">
          <span className="block text-sm text-red-800">Respostas "Não"</span>
          <span className="font-bold text-lg">{summary.nao}</span>
        </div>
        <div className="bg-gray-100 p-2 rounded">
          <span className="block text-sm text-gray-800">Respostas "N/A"</span>
          <span className="font-bold text-lg">{summary.na}</span>
        </div>
      </div>
    </div>
  );
};

export default ChecklistInspectionSummary;
