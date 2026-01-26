
import React from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Operator } from "@/lib/data";

interface ChecklistDebugInfoProps {
  show: boolean;
  operators: Operator[];
  equipmentsCount: number;
  isLoadingData: boolean;
  dbStatus: 'unchecked' | 'connected' | 'error';
  onImportOperators: () => void;
}

const ChecklistDebugInfo: React.FC<ChecklistDebugInfoProps> = ({
  show,
  operators,
  equipmentsCount,
  isLoadingData,
  dbStatus,
  onImportOperators
}) => {
  if (!show) return null;

  return (
    <Alert className="mx-4 mt-4 bg-blue-50">
      <AlertTitle className="flex justify-between">
        <span>Informações de Depuração</span>
        <Button variant="outline" size="sm" onClick={onImportOperators}>
          Importar Operadores do Clipboard
        </Button>
      </AlertTitle>
      <AlertDescription>
        <div className="space-y-2 text-xs font-mono bg-gray-100 p-2 rounded mt-2 max-h-40 overflow-auto">
          <div>Operadores carregados: {operators.length}</div>
          <div>Equipamentos carregados: {equipmentsCount}</div>
          <div>Carregando dados: {isLoadingData ? "Sim" : "Não"}</div>
          <div>DB Status: {dbStatus}</div>
          <div className="font-bold mt-2">Primeiros 5 operadores:</div>
          {operators.slice(0, 5).map((op, idx) => (
            <div key={idx}>
              ID: {op.id}, Nome: {op.name}, Cargo: {op.cargo || "N/A"}, Setor: {op.setor || "N/A"}
            </div>
          ))}
        </div>
      </AlertDescription>
    </Alert>
  );
};

export default ChecklistDebugInfo;
