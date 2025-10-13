
import React from "react";
import { Button } from "@/components/ui/button";
import { Equipment } from "@/lib/data";

interface EquipmentDebugButtonProps {
  equipments: Equipment[];
  onDebugClick: () => void;
}

const EquipmentDebugButton: React.FC<EquipmentDebugButtonProps> = ({ 
  equipments, 
  onDebugClick 
}) => {
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }
  
  return (
    <Button 
      onClick={onDebugClick}
      variant="outline"
      className="mt-3 text-xs"
      size="sm"
    >
      Debug Equipments
    </Button>
  );
};

export default EquipmentDebugButton;
