
import { ChecklistItem, Equipment, Operator } from "./data";

export interface ChecklistFormState {
  operator: Operator | null;
  equipment: Equipment | null;
  checklist: ChecklistItem[];
  photos: { id: string, data: string }[];
  comments: string;
  signature: string | null;
  inspectionDate: string;
}

// Interface para setores
export interface Sector {
  id: string;
  name: string;
  description?: string;
  leaderId?: string;
}

// Interface para configuração do banco de dados
export interface DatabaseConfig {
  host: string;
  port: string;
  database: string;
  user: string;
  password: string;
  connectionSuccess: boolean;
}

// Chaves para armazenar no localStorage
export const CHECKLIST_STORE_KEY = 'checklistafm-current-checklist';
export const CHECKLIST_TEMPLATE_KEY = 'checklistafm-checklist-questions';
export const CHECKLIST_ALERTS_KEY = 'checklistafm-alerts';
export const CHECKLIST_MAINTENANCE_ORDERS_KEY = 'checklistafm-maintenance-orders';
export const DB_CONFIG_KEY = 'checklistafm-db-config';
export const INITIAL_DATA_LOADED_KEY = 'checklistafm-initial-data-loaded';
export const SECTORS_STORE_KEY = 'checklistafm-sectors';

// Estado inicial do checklist
export const initialChecklistState: ChecklistFormState = {
  operator: null,
  equipment: null,
  checklist: [],
  photos: [],
  comments: '',
  signature: null,
  inspectionDate: new Date().toISOString().split('T')[0],
};

// Configuração padrão do banco de dados
export const defaultDbConfig: DatabaseConfig = {
  host: "localhost",
  port: "5432",
  database: "postgres",
  user: "postgres",
  password: "",
  connectionSuccess: false
};

// Setores padrão
export const defaultSectors: Sector[] = [
  { id: "1", name: "Manutenção", description: "Setor responsável pela manutenção de equipamentos" },
  { id: "2", name: "Produção", description: "Setor de produção industrial" },
  { id: "3", name: "Armazém", description: "Setor de armazenamento e logística" },
  { id: "4", name: "Segurança", description: "Setor de segurança do trabalho" },
];

export interface ChecklistAlert {
  id: string;
  questionId: string;
  question: string;
  answer: string;
  inspectionId?: string;
  operatorName?: string;
  operatorMatricula?: string;
  equipmentId?: string;
  equipmentName?: string;
  sector?: string;
  createdAt: string;
  seenByAdmin?: boolean;
  seenByLeaders?: string[];
}

export type MaintenanceOrderStatus = "open" | "closed" | "cancelled";

export interface MaintenanceOrder {
  id: string;
  equipmentId: string;
  inspectionId: string;
  orderNumber: string;
  status: MaintenanceOrderStatus;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  notes?: string;
}
