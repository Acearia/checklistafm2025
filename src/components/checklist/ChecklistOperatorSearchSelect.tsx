import React, { useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Operator } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";

interface ChecklistOperatorSearchSelectProps {
  operators: Operator[];
  selectedOperator: Operator | null;
  onOperatorSelect: (operatorId: string) => void;
}

const ChecklistOperatorSearchSelect: React.FC<ChecklistOperatorSearchSelectProps> = ({ 
  operators, 
  selectedOperator, 
  onOperatorSelect 
}) => {
  const [open, setOpen] = useState(false);
  const [matriculaInput, setMatriculaInput] = useState("");
  const { toast } = useToast();

  const handleMatriculaSearch = () => {
    if (!matriculaInput.trim()) {
      toast({
        title: "Erro",
        description: "Digite um código de matrícula",
        variant: "destructive",
      });
      return;
    }

    console.log(`[LOG] Buscando operador por matrícula: ${matriculaInput}`);
    
    const operator = operators.find(op => {
      const normalized = matriculaInput.trim();
      const opMatricula = (op as any).matricula ?? op.id;
      return opMatricula === normalized || op.id === normalized;
    });
    
    if (operator) {
      const operatorMatricula = (operator as any).matricula || operator.id;
      console.log(`[LOG] Operador encontrado: ${operator.name} (Matrícula: ${operatorMatricula})`);
      onOperatorSelect(operatorMatricula);
      setMatriculaInput("");
      toast({
        title: "Operador encontrado",
        description: `${operator.name} selecionado com sucesso`,
      });
    } else {
      console.log(`[LOG] Nenhum operador encontrado com a matrícula: ${matriculaInput}`);
      toast({
        title: "Operador não encontrado",
        description: `Nenhum operador com matrícula ${matriculaInput}`,
        variant: "destructive",
      });
    }
  };

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
      <div className="w-full space-y-4">
        {/* Campo de entrada por matrícula */}
        <div className="flex gap-2">
          <Input
            placeholder="Digite o código da matrícula"
            value={matriculaInput}
            onChange={(e) => setMatriculaInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleMatriculaSearch();
              }
            }}
            className="flex-1"
          />
          <Button 
            onClick={handleMatriculaSearch}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Search className="h-4 w-4" />
            Buscar
          </Button>
        </div>

        {/* Separador */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              Ou selecione da lista
            </span>
          </div>
        </div>

        {/* Seletor existente */}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between bg-white h-10"
            >
              {selectedOperator
                ? `${(selectedOperator as any).matricula || selectedOperator.id} - ${selectedOperator.name}`
                : "Selecione um operador..."}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0" style={{ width: 'var(--radix-popover-trigger-width)' }}>
            <Command>
              <CommandInput placeholder="Buscar operador..." />
              <CommandList className="max-h-60">
                <CommandEmpty>Nenhum operador encontrado.</CommandEmpty>
                {Object.entries(operatorsBySector).map(([sector, sectorOperators]) => (
                  <CommandGroup key={sector} heading={sector}>
                    {sectorOperators.map((operator) => (
                      <CommandItem
                        key={(operator as any).matricula || operator.id}
                        value={`${(operator as any).matricula || operator.id} ${operator.name} ${operator.cargo || ''}`}
                        onSelect={() => {
                          const value = (operator as any).matricula || operator.id;
                          onOperatorSelect(value);
                          setOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            ((selectedOperator as any)?.matricula || selectedOperator?.id) === ((operator as any).matricula || operator.id)
                              ? "opacity-100"
                              : "opacity-0"
                          )}
                        />
                        <div className="flex items-center justify-between w-full">
                          <span>{(operator as any).matricula || operator.id} - {operator.name}</span>
                          {operator.cargo && (
                            <Badge variant="secondary" className="ml-2 text-xs">
                              {operator.cargo}
                            </Badge>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {operators.length === 0 && (
          <div className="mt-2 text-sm text-red-500">
            Nenhum operador cadastrado. Adicione um operador clicando no botão + acima.
          </div>
        )}
      </div>
      
      {selectedOperator && (
        <div className="mt-3 grid grid-cols-1 gap-3">
          <div className="flex flex-col p-3 bg-blue-50 rounded-md border border-blue-200">
            <span className="text-sm text-blue-700 font-semibold">Matrícula:</span>
            <span className="text-sm">{(selectedOperator as any).matricula || selectedOperator.id}</span>
          </div>
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

export default ChecklistOperatorSearchSelect;
