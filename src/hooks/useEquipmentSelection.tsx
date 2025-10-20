
import { useState, useEffect } from "react";
import { Equipment } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";

export const useEquipmentSelection = (initialEquipment: Equipment | null = null) => {
  const { toast } = useToast();
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(initialEquipment);
  const [isLoadingData, setIsLoadingData] = useState(true);

  useEffect(() => {
    loadEquipments();
  }, []);

  const loadEquipments = () => {
    try {
      // Load equipments from localStorage
      const storedEquipments = localStorage.getItem('checklistafm-equipments');
      if (storedEquipments) {
        const parsedEquipments = JSON.parse(storedEquipments);
        console.log(`Loaded ${parsedEquipments.length} equipments from localStorage`);
        setEquipments(parsedEquipments);
      } else {
        console.log("No equipments found in localStorage");
        // This will be handled by the initializeEquipments function if needed
      }
    } catch (e) {
      console.error('Error loading equipments:', e);
    }
    
    setIsLoadingData(false);
  };

  const handleEquipmentSelect = (equipmentId: string) => {
    console.log("Equipment selected with ID:", equipmentId);
    const equipment = equipments.find(eq => eq.id === equipmentId);
    if (equipment) {
      console.log("Found equipment:", equipment);
      setSelectedEquipment(equipment);
    } else {
      console.error("Equipment not found with ID:", equipmentId);
    }
  };

  const initializeEquipments = (initialEquipments: Equipment[]) => {
    console.log("Forcing equipment initialization...");
    localStorage.setItem('checklistafm-equipments', JSON.stringify(initialEquipments));
    setEquipments(initialEquipments);
    
    toast({
      title: "Equipamentos recarregados",
      description: `${initialEquipments.length} equipamentos foram carregados.`,
    });
  };

  return {
    equipments,
    selectedEquipment,
    isLoadingData,
    handleEquipmentSelect,
    initializeEquipments
  };
};
