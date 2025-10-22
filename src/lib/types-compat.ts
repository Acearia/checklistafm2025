// Types for backward compatibility between localStorage and Supabase
import type { Tables } from "@/integrations/supabase/types";

export interface Operator {
  id: string; // This is actually matricula now
  name: string;
  cargo?: string;
  setor?: string;
  senha?: string;
  isLeader?: boolean;
  leaderEmail?: string;
  leaderPasswordHash?: string;
}

export interface Equipment {
  id: string;
  name: string;
  kp: string;
  type: string;
  sector: string;
  capacity: string;
}

export interface ChecklistItem {
  id: string;
  question: string;
  answer: "Sim" | "Não" | "N/A" | "Selecione" | null;
  alertOnYes?: boolean;
  alertOnNo?: boolean;
}

// Conversion functions between legacy and Supabase types
export const convertSupabaseOperatorToLegacy = (supabaseOperator: any): Operator => ({
  id: supabaseOperator.matricula,
  name: supabaseOperator.name,
  cargo: supabaseOperator.cargo || undefined,
  setor: supabaseOperator.setor || undefined,
  senha: supabaseOperator.senha || undefined,
  isLeader: Boolean(supabaseOperator.is_leader),
  leaderEmail: supabaseOperator.leader_email || undefined,
  leaderPasswordHash: supabaseOperator.leader_password_hash || undefined,
});

export const convertSupabaseEquipmentToLegacy = (supabaseEquipment: Tables<"equipment">): Equipment => ({
  id: supabaseEquipment.id,
  name: supabaseEquipment.name,
  kp: supabaseEquipment.kp,
  type: supabaseEquipment.type,
  sector: supabaseEquipment.sector,
  capacity: supabaseEquipment.capacity,
});

export const convertSupabaseChecklistItemToLegacy = (supabaseItem: Tables<"checklist_items">): ChecklistItem => ({
  id: supabaseItem.id,
  question: supabaseItem.question,
  answer: null, // Default answer state
  alertOnYes: Boolean(supabaseItem.alert_on_yes),
  alertOnNo: Boolean(supabaseItem.alert_on_no),
});
