
import React from "react";
import { Equipment } from "@/lib/data";

interface EquipmentDetailsProps {
  equipment: Equipment;
}

const EquipmentDetails: React.FC<EquipmentDetailsProps> = ({ equipment }) => {
  const getEquipmentTypeText = (type: string) => {
    switch (type) {
      case "1": return "Ponte";
      case "2": return "Talha";
      case "3": return "Pórtico";
      default: return "Outro";
    }
  };

  return (
    <div className="mt-4 grid grid-cols-2 gap-4">
      <div className="flex flex-col">
        <span className="text-sm text-gray-500 mb-1">KP</span>
        <input 
          type="text" 
          value={equipment.kp} 
          className="px-4 py-2 border border-gray-300 rounded bg-gray-100" 
          readOnly 
        />
      </div>

      <div className="flex flex-col">
        <span className="text-sm text-gray-500 mb-1">Tipo</span>
        <input 
          type="text" 
          value={getEquipmentTypeText(equipment.type)} 
          className="px-4 py-2 border border-gray-300 rounded bg-gray-100" 
          readOnly 
        />
      </div>

      <div className="flex flex-col">
        <span className="text-sm text-gray-500 mb-1">Setor</span>
        <input 
          type="text" 
          value={equipment.sector} 
          className="px-4 py-2 border border-gray-300 rounded bg-gray-100" 
          readOnly 
        />
      </div>

      <div className="flex flex-col">
        <span className="text-sm text-gray-500 mb-1">Capacidade</span>
        <input 
          type="text" 
          value={equipment.capacity} 
          className="px-4 py-2 border border-gray-300 rounded bg-gray-100" 
          readOnly 
        />
      </div>
    </div>
  );
};

export default EquipmentDetails;
