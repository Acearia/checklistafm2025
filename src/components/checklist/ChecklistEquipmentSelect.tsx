
import React from "react";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Equipment } from "@/lib/data";

interface ChecklistEquipmentSelectProps {
  equipments: Equipment[];
  selectedEquipment: Equipment | null;
  onEquipmentSelect: (equipmentId: string) => void;
  disabled?: boolean;
  emptyMessage?: string;
}

const ChecklistEquipmentSelect: React.FC<ChecklistEquipmentSelectProps> = ({ 
  equipments, 
  selectedEquipment, 
  onEquipmentSelect,
  disabled = false,
  emptyMessage,
}) => {
  const getEquipmentTypeText = (type: string) => {
    switch (type) {
      case "1": return "Ponte";
      case "2": return "Talha";
      case "3": return "Pórtico";
      default: return "Outro";
    }
  };

  return (
    <div className="mb-4 grid grid-cols-1 gap-4">
      <div className="w-full">
        <Select onValueChange={onEquipmentSelect} disabled={disabled || equipments.length === 0}>
          <SelectTrigger className="w-full bg-white" disabled={disabled || equipments.length === 0}>
            <SelectValue placeholder={disabled ? "Selecione o operador primeiro" : "Selecione o equipamento"} />
          </SelectTrigger>
          <SelectContent>
            {equipments.map(equipment => (
              <SelectItem key={equipment.id} value={equipment.id}>
                {equipment.name} (KP: {equipment.kp} • Capacidade: {equipment.capacity})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {emptyMessage && equipments.length === 0 && (
          <p className="mt-2 text-xs text-gray-500">{emptyMessage}</p>
        )}
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

export default ChecklistEquipmentSelect;
