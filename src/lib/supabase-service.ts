import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

// Types
export type Operator = Tables<"operators">;
export type Equipment = Tables<"equipment">;
export type Inspection = Tables<"inspections">;
export type ChecklistItem = Tables<"checklist_items">;
export type Sector = Tables<"sectors">;

export type OperatorInsert = TablesInsert<"operators">;
export type EquipmentInsert = TablesInsert<"equipment">;
export type InspectionInsert = TablesInsert<"inspections">;

// Operators
const isMissingSenhaColumnError = (error: any) => {
  if (typeof error?.message !== "string") return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes('column "senha" does not exist') ||
    msg.includes("could not find the 'senha' column")
  );
};

export const operatorService = {
  async getAll() {
    const { data, error } = await supabase
      .from("operators")
      .select("*")
      .order("name");
    
    if (error) throw error;
    return data || [];
  },

  async create(operator: OperatorInsert) {
    const payload: OperatorInsert = {
      ...operator,
      senha: operator.senha ? operator.senha.trim() : null,
      leader_email: operator.leader_email ? operator.leader_email.trim() : null,
      leader_password_hash: operator.leader_password_hash || null,
    };

    const { data, error } = await supabase
      .from("operators")
      .insert(payload)
      .select()
      .single();

    if (error) {
      if (isMissingSenhaColumnError(error)) {
        console.warn(
          "[operatorService.create] Coluna 'senha' não encontrada. Inserindo sem a coluna. Execute a migration mais recente para habilitar armazenamento de senha."
        );
        const { senha, ...fallbackPayload } = payload;
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("operators")
          .insert(fallbackPayload)
          .select()
          .single();
        if (fallbackError) throw fallbackError;
        return fallbackData;
      }
      throw error;
    }
    return data;
  },

  async update(matricula: string, updates: TablesUpdate<"operators">) {
    const payload: TablesUpdate<"operators"> = {
      ...updates,
    };

    if (payload.senha !== undefined) {
      payload.senha = payload.senha ? payload.senha.trim() : null;
    }

    if (payload.leader_email !== undefined) {
      payload.leader_email = payload.leader_email ? payload.leader_email.trim() : null;
    }

    const { data, error } = await supabase
      .from("operators")
      .update(payload)
      .eq("matricula", matricula)
      .select()
      .single();
    
    if (error) {
      if (isMissingSenhaColumnError(error)) {
        console.warn(
          "[operatorService.update] Coluna 'senha' não encontrada. Atualizando sem a coluna. Execute a migration mais recente para habilitar armazenamento de senha."
        );
        const { senha, ...fallbackPayload } = payload;
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("operators")
          .update(fallbackPayload)
          .eq("matricula", matricula)
          .select()
          .single();
        if (fallbackError) throw fallbackError;
        return fallbackData;
      }
      throw error;
    }
    return data;
  },

  async delete(matricula: string) {
    const { error } = await supabase
      .from("operators")
      .delete()
      .eq("matricula", matricula);
    
    if (error) throw error;
  }
};

// Equipment
export const equipmentService = {
  async getAll() {
    const { data, error } = await supabase
      .from("equipment")
      .select("*")
      .order("name");
    
    if (error) throw error;
    return data || [];
  },

  async create(equipment: EquipmentInsert) {
    const { data, error } = await supabase
      .from("equipment")
      .insert(equipment)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: TablesUpdate<"equipment">) {
    const { data, error } = await supabase
      .from("equipment")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async delete(id: string) {
    const { error } = await supabase
      .from("equipment")
      .delete()
      .eq("id", id);
    
    if (error) throw error;
  }
};

// Checklist Items
const isUuid = (value: unknown): boolean => {
  if (typeof value !== "string") return false;
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
    value,
  );
};

export const checklistService = {
  async getAll() {
    const { data, error } = await supabase
      .from("checklist_items")
      .select("*")
      .order("order_number");
    
    if (error) throw error;
    return data || [];
  },

  async replaceAll(items: Array<{ id?: string; question: string; alertOnYes?: boolean; alertOnNo?: boolean }>) {
    const formattedItems = items
      .map((item, index) => {
        const payload: Record<string, any> = {
          question: item.question.trim(),
          order_number: index + 1,
          alert_on_yes: Boolean(item.alertOnYes),
          alert_on_no: Boolean(item.alertOnNo),
        };

        if (isUuid(item.id)) {
          payload.id = item.id;
        }

        return payload;
      })
      .filter((item) => item.question.length > 0);

    const { error: deleteError } = await supabase
      .from("checklist_items")
      .delete()
      .neq("id", "");
    
    if (deleteError) throw deleteError;

    if (formattedItems.length === 0) {
      return [];
    }

    const { data, error } = await supabase
      .from("checklist_items")
      .insert(formattedItems)
      .select()
      .order("order_number");
    
    if (error) throw error;
    return data || [];
  },
};

// Inspections
export const inspectionService = {
  async getAll() {
    const { data, error } = await supabase
      .from("inspections")
      .select(`
        *,
        operator:operators!inspections_operator_matricula_fkey(*),
        equipment:equipment(*)
      `)
      .order("created_at", { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  async create(inspection: InspectionInsert) {
    const { data, error } = await supabase
      .from("inspections")
      .insert(inspection)
      .select(`
        *,
        operator:operators!inspections_operator_matricula_fkey(*),
        equipment:equipment(*)
      `)
      .single();
    
    if (error) throw error;
    return data;
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from("inspections")
      .select(`
        *,
        operator:operators!inspections_operator_matricula_fkey(*),
        equipment:equipment(*)
      `)
      .eq("id", id)
      .maybeSingle();
    
    if (error) throw error;
    return data;
  }
};

// Sectors
export const sectorService = {
  async getAll() {
    const { data, error } = await supabase
      .from("sectors")
      .select("*")
      .order("name");
    
    if (error) throw error;
    return data || [];
  },

  async create(sector: TablesInsert<"sectors">) {
    const { data, error } = await supabase
      .from("sectors")
      .insert(sector)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: TablesUpdate<"sectors">) {
    const { data, error } = await supabase
      .from("sectors")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async delete(id: string) {
    const { error } = await supabase
      .from("sectors")
      .delete()
      .eq("id", id);
    
    if (error) throw error;
  }
};

// Migration helper - move data from localStorage to Supabase
export const migrationService = {
  async migrateFromLocalStorage() {
    try {
      // Check if we already migrated
      const existingData = await operatorService.getAll();
      if (existingData.length > 0) {
        console.log('Data already exists in Supabase, skipping migration');
        return { success: true, message: 'Data already migrated' };
      }

      // Migrate inspections from localStorage
      const localInspections = localStorage.getItem('checklistafm-inspections');
      if (localInspections) {
        const inspections = JSON.parse(localInspections);
        console.log(`Found ${inspections.length} inspections in localStorage`);
        
        for (const inspection of inspections) {
          // Find matching operator and equipment in Supabase
          const operators = await operatorService.getAll();
          const equipment = await equipmentService.getAll();
          
          const operator = operators.find(op => op.name === inspection.operator?.name);
          const equipmentMatch = equipment.find(eq => eq.name === inspection.equipment?.name);
          
          if (operator && equipmentMatch) {
            await inspectionService.create({
              operator_matricula: operator.matricula,
              equipment_id: equipmentMatch.id,
              inspection_date: inspection.inspectionDate,
              submission_date: inspection.submissionDate || new Date().toISOString(),
              comments: inspection.comments || '',
              signature: inspection.signature,
              photos: inspection.photos || [],
              checklist_answers: inspection.checklist || []
            });
          }
        }
      }

      return { success: true, message: 'Migration completed successfully' };
    } catch (error) {
      console.error('Migration failed:', error);
      return { success: false, message: 'Migration failed', error };
    }
  }
};
