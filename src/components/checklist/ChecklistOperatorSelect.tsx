
import React from "react";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Operator } from "@/lib/data";

interface ChecklistOperatorSelectProps {
  operators: Operator[];
  selectedOperator: Operator | null;
  onOperatorSelect: (operatorId: string) => void;
}

const ChecklistOperatorSelect: React.FC<ChecklistOperatorSelectProps> = ({ 
  operators, 
  selectedOperator, 
  onOperatorSelect 
}) => {
  // Agrupar operadores por setor
  const operatorsBySector = operators.reduce((acc, operator) => {
    const sector = operator.setor || "Sem Setor";
    if (!acc[sector]) {
      acc[sector] = [];
    }
    acc[sector].push(operator);
    return acc;
  }, {} as Record<string, Operator[]>);

  return (
    <div className="mb-6">
      <div className="w-full">
        <Select
          onValueChange={onOperatorSelect}
          value={
            (selectedOperator as any)?.matricula ||
            selectedOperator?.id ||
            ""
          }
        >
          <SelectTrigger className="w-full bg-white h-10">
            <SelectValue placeholder="Selecione um operador" />
          </SelectTrigger>
          <SelectContent>
            {operators && operators.length > 0 ? (
              Object.entries(operatorsBySector).map(([sector, sectorOperators]) => (
                <div key={sector}>
                  <div className="px-2 py-1 text-xs font-semibold text-gray-500 bg-gray-100">
                    {sector}
                  </div>
                  {sectorOperators.map((operator) => {
                    const operatorId = (operator as any).matricula || operator.id;
                    return (
                      <SelectItem key={operatorId} value={operatorId}>
                        <div className="flex items-center justify-between w-full">
                          <span>
                            {operatorId} - {operator.name}
                          </span>
                          {operator.cargo && (
                            <Badge variant="secondary" className="ml-2 text-xs">
                              {operator.cargo}
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    );
                  })}
                </div>
              ))
            ) : (
              <SelectItem value="no-operators" disabled>
                Nenhum operador encontrado
              </SelectItem>
            )}
          </SelectContent>
        </Select>
        {operators.length === 0 && (
          <div className="mt-2 text-sm text-red-500">
            Nenhum operador cadastrado. Adicione um operador clicando no botão + acima.
          </div>
        )}
      </div>
      
      {selectedOperator && (
        <div className="mt-3 grid grid-cols-1 gap-3">
          <div className="flex flex-col p-3 bg-blue-50 rounded-md border border-blue-200">
            <span className="text-sm text-blue-700 font-semibold">Nome:</span>
            <span className="text-sm">{selectedOperator.name}</span>
          </div>
          {selectedOperator.cargo && (
            <div className="flex flex-col p-3 bg-blue-50 rounded-md border border-blue-200">
              <span className="text-sm text-blue-700 font-semibold">Cargo:</span>
              <span className="text-sm">{selectedOperator.cargo}</span>
            </div>
          )}
          <div className="flex flex-col p-3 bg-blue-50 rounded-md border border-blue-200">
            <span className="text-sm text-blue-700 font-semibold">Setor:</span>
            <span className="text-sm">{selectedOperator.setor || "Não informado"}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChecklistOperatorSelect;
