import React, { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
import { Equipment } from "@/lib/data";

interface ChecklistEquipmentSearchSelectProps {
  equipments: Equipment[];
  selectedEquipment: Equipment | null;
  onEquipmentSelect: (equipmentId: string) => void;
}

const ChecklistEquipmentSearchSelect: React.FC<ChecklistEquipmentSearchSelectProps> = ({ 
  equipments, 
  selectedEquipment, 
  onEquipmentSelect 
}) => {
  const [open, setOpen] = useState(false);

  const getEquipmentTypeText = (type: string) => {
    switch (type) {
      case "1": return "Ponte";
      case "2": return "Talha";
      case "3": return "Pórtico";
      default: return "Outro";
    }
  };

  // Agrupar equipamentos por setor
  const equipmentsBySector = equipments.reduce((acc, equipment) => {
    const sector = equipment.sector || "Sem Setor";
    if (!acc[sector]) {
      acc[sector] = [];
    }
    acc[sector].push(equipment);
    return acc;
  }, {} as Record<string, Equipment[]>);

  return (
    <div className="mb-4 grid grid-cols-1 gap-4">
      <div className="w-full">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between bg-white"
            >
              {selectedEquipment
                ? `${selectedEquipment.name} (KP: ${selectedEquipment.kp})`
                : "Selecione o equipamento..."}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0" style={{ width: 'var(--radix-popover-trigger-width)' }}>
            <Command>
              <CommandInput placeholder="Buscar equipamento..." />
              <CommandList className="max-h-60">
                <CommandEmpty>Nenhum equipamento encontrado.</CommandEmpty>
                {Object.entries(equipmentsBySector).map(([sector, sectorEquipments]) => (
                  <CommandGroup key={sector} heading={sector}>
                    {sectorEquipments.map((equipment) => (
                      <CommandItem
                        key={equipment.id}
                        value={`${equipment.name} ${equipment.kp} ${getEquipmentTypeText(equipment.type)}`}
                        onSelect={() => {
                          onEquipmentSelect(equipment.id);
                          setOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedEquipment?.id === equipment.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <div className="flex flex-col">
                          <span>{equipment.name}</span>
                          <span className="text-xs text-gray-500">
                            KP: {equipment.kp} | {getEquipmentTypeText(equipment.type)}
                          </span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {selectedEquipment && (
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col">
            <span className="text-sm text-gray-500 mb-1">KP</span>
            <input 
              type="text" 
              value={selectedEquipment.kp} 
              className="px-4 py-2 border border-gray-300 rounded bg-gray-100" 
              readOnly 
            />
          </div>

          <div className="flex flex-col">
            <span className="text-sm text-gray-500 mb-1">Tipo</span>
            <input 
              type="text" 
              value={getEquipmentTypeText(selectedEquipment.type)} 
              className="px-4 py-2 border border-gray-300 rounded bg-gray-100" 
              readOnly 
            />
          </div>

          <div className="flex flex-col">
            <span className="text-sm text-gray-500 mb-1">Setor</span>
            <input 
              type="text" 
              value={selectedEquipment.sector} 
              className="px-4 py-2 border border-gray-300 rounded bg-gray-100" 
              readOnly 
            />
          </div>

          <div className="flex flex-col">
            <span className="text-sm text-gray-500 mb-1">Capacidade</span>
            <input 
              type="text" 
              value={selectedEquipment.capacity} 
              className="px-4 py-2 border border-gray-300 rounded bg-gray-100" 
              readOnly 
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ChecklistEquipmentSearchSelect;