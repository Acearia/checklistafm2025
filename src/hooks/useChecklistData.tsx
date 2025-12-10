
import { useState, useEffect } from "react";
import { useSupabaseData } from "./useSupabaseData";
import { useToast } from "@/hooks/use-toast";
import { 
  type Operator, 
  type Equipment, 
  type ChecklistItem,
  type Sector,
  type ChecklistGroup,
  type GroupQuestion,
  type GroupProcedure,
  convertSupabaseOperatorToLegacy,
  convertSupabaseEquipmentToLegacy,
  convertSupabaseChecklistItemToLegacy
} from "@/lib/types-compat";
import { saveChecklistTemplate } from "@/lib/checklistTemplate";

export const useChecklistData = () => {
  const { toast } = useToast();
  const {
    operators: supabaseOperators,
    equipment: supabaseEquipments,
    checklistItems: supabaseChecklistItems,
    sectors: supabaseSectors,
    groups: supabaseGroups,
    groupQuestions: supabaseGroupQuestions,
    groupProcedures: supabaseGroupProcedures,
    equipmentGroups: supabaseEquipmentGroups,
    loading: supabaseLoading,
    error: supabaseError,
    refresh,
  } = useSupabaseData();
  
  const [operators, setOperators] = useState<Operator[]>([]);
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [groups, setGroups] = useState<ChecklistGroup[]>([]);
  const [groupQuestions, setGroupQuestions] = useState<GroupQuestion[]>([]);
  const [groupProcedures, setGroupProcedures] = useState<GroupProcedure[]>([]);
  const [equipmentGroups, setEquipmentGroups] = useState<any[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [dbConnectionStatus, setDbConnectionStatus] = useState<'unchecked' | 'connected' | 'error'>('connected');

  // Convert Supabase data to legacy format
  useEffect(() => {
    if (supabaseOperators.length > 0) {
      setOperators(supabaseOperators.map(convertSupabaseOperatorToLegacy));
    }
  }, [supabaseOperators]);

  useEffect(() => {
    if (supabaseEquipments.length > 0) {
      setEquipments(supabaseEquipments.map(convertSupabaseEquipmentToLegacy));
    }
  }, [supabaseEquipments]);

  useEffect(() => {
    if (supabaseChecklistItems.length > 0) {
      const legacyItems = supabaseChecklistItems.map(convertSupabaseChecklistItemToLegacy);
      setChecklistItems(legacyItems);
      saveChecklistTemplate(legacyItems);
    }
  }, [supabaseChecklistItems]);

  useEffect(() => {
    setSectors(
      supabaseSectors.map((sector: any) => ({
        id: sector.id,
        name: sector.name,
        description: sector.description || undefined,
        leaderId: sector.leader_id || undefined,
      }))
    );
  }, [supabaseSectors]);

  useEffect(() => {
    // Set loading to false when Supabase data is loaded
    if (!supabaseLoading) {
      setIsLoadingData(false);
    }
  }, [supabaseLoading]);

  useEffect(() => {
    setGroups(supabaseGroups as ChecklistGroup[]);
    setGroupQuestions(supabaseGroupQuestions as GroupQuestion[]);
    setGroupProcedures(supabaseGroupProcedures as GroupProcedure[]);
    setEquipmentGroups(supabaseEquipmentGroups as any[]);
  }, [supabaseGroups, supabaseGroupQuestions, supabaseGroupProcedures, supabaseEquipmentGroups]);

  // Removed automatic toast on data load - only show in admin area

  // Process the initial operators data and save to Supabase
  const processInitialOperators = async (inputOperators: string | any[]) => {
    console.log("Processing initial operators data for Supabase");
    
    try {
      const { operatorService } = await import('@/lib/supabase-service');
      let operatorsData: any[];
      
      if (typeof inputOperators === 'string') {
        // Se é uma string, é um texto para processamento (de clipboard ou arquivo)
        try {
          // Dividimos o texto em linhas
          const lines = inputOperators.split('\n').filter(line => line.trim() !== '');
          
          // Para cada linha, criamos um operador
          operatorsData = lines.map(line => {
            const parts = line.split('\t');
            if (parts.length >= 2) {
              return {
                name: parts[1].trim().toUpperCase(),
                cargo: parts.length > 2 ? parts[2].trim() : "",
                setor: parts.length > 3 ? parts[3].trim() : ""
              };
            }
            return null;
          }).filter(op => op !== null) as any[];
          
        } catch (error) {
          console.error("Erro ao processar texto de operadores:", error);
          operatorsData = [];
        }
      } else {
        // Se não é uma string, é um array de operadores
        operatorsData = inputOperators.map(op => ({
          name: op.name.toUpperCase(),
          cargo: op.cargo || "",
          setor: op.setor || ""
        }));
      }
      
      // Salvar no Supabase
      for (const operator of operatorsData) {
        await operatorService.create(operator);
      }
      
      toast({
        title: "Operadores processados",
        description: `${operatorsData.length} operadores foram salvos no banco de dados.`,
      });
      
      // Refresh data
      refresh();
      
      return operatorsData;
    } catch (error) {
      console.error('Erro ao processar operadores no Supabase:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar operadores no banco de dados",
        variant: "destructive",
      });
      return [];
    }
  };

  const handleImportOperators = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.includes('\t')) {
        await processInitialOperators(text);
      }
    } catch (err) {
      console.error("Erro ao acessar a área de transferência:", err);
      toast({
        title: "Erro",
        description: "Não foi possível acessar a área de transferência",
        variant: "destructive",
      });
    }
  };

  return {
    operators,
    setOperators: () => {}, // Read-only for now, updates go through Supabase
    equipments,
    checklistItems,
    sectors,
    groups,
    groupQuestions,
    groupProcedures,
    equipmentGroups,
    isLoadingData,
    dbConnectionStatus,
    processInitialOperators,
    handleImportOperators,
    refresh // Add refresh function to the return
  };
};
