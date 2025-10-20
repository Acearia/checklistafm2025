export interface Operator {
  id: string;
  matricula: string;
  name: string;
  cargo?: string;
  setor?: string;
  senha?: string;
  isLeader?: boolean;
  leaderEmail?: string;
  leaderSector?: string;
  leaderId?: string;
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

export interface Sector {
  id: string;
  name: string;
  description?: string;
  leaderId?: string;
}

export interface Leader {
  id: string;
  name: string;
  email: string;
  sector: string;
  password_hash: string;
}

export const operators: Operator[] = [
  {
    id: "3675",
    matricula: "3675",
    name: "José Edmilton",
    cargo: "Operador",
    setor: "Manutenção",
    senha: "1234",
  },
];

export const equipments: Equipment[] = [
  { id: "eq-1", name: "Ponte Rolante A", kp: "1234", type: "1", sector: "Manutenção", capacity: "5" },
  { id: "eq-2", name: "Talha Elétrica B", kp: "5678", type: "2", sector: "Produção", capacity: "2" },
  { id: "eq-3", name: "Pórtico C", kp: "9012", type: "3", sector: "Armazém", capacity: "10" },
];

export const sectors: Sector[] = [
  { id: "sector-1", name: "Manutenção", description: "Setor responsável pela manutenção de equipamentos" },
  { id: "sector-2", name: "Produção", description: "Setor de produção industrial" },
  { id: "sector-3", name: "Armazém", description: "Setor de armazenamento e logística" },
  { id: "sector-4", name: "Segurança", description: "Setor de segurança do trabalho" },
];

export const leaders: Leader[] = [
  {
    id: "leader-1",
    name: "Ana Pereira",
    email: "ana.pereira@checklistafm.com",
    sector: "Manutenção",
    password_hash: "bGlkZXIxMjM=", // senha: lider123
  },
  {
    id: "leader-2",
    name: "Bruno Santos",
    email: "bruno.santos@checklistafm.com",
    sector: "Produção",
    password_hash: "Z3VhcmRhMTIz", // senha: guarda123
  },
];

export const checklistItems: ChecklistItem[] = [
  { id: "1", question: "O sistema de freios do guincho está funcionando?", answer: null, alertOnYes: false, alertOnNo: false },
  { id: "2", question: "O gancho está girando sem dificuldades?", answer: null, alertOnYes: false, alertOnNo: false },
  { id: "3", question: "O gancho possui trava de segurança funcionando?", answer: null, alertOnYes: false, alertOnNo: false },
  { id: "4", question: "O gancho possui sinais de alongamento?", answer: null, alertOnYes: false, alertOnNo: false },
  { id: "5", question: "Os ganchos da corrente possuem sinais de desgaste?", answer: null, alertOnYes: false, alertOnNo: false },
  { id: "6", question: "As travas de segurança dos ganchos estão funcionando?", answer: null, alertOnYes: false, alertOnNo: false },
  { id: "7", question: "A corrente possui a plaqueta de identificação instalada?", answer: null, alertOnYes: false, alertOnNo: false },
  { id: "8", question: "As polias estão girando sem dificuldades?", answer: null, alertOnYes: false, alertOnNo: false },
  { id: "9", question: "A sinalização sonora funciona durante a movimentação?", answer: null, alertOnYes: false, alertOnNo: false },
  { id: "10", question: "O controle possui botão danificado?", answer: null, alertOnYes: false, alertOnNo: false },
  { id: "11", question: "O botão de emergência está funcionando?", answer: null, alertOnYes: false, alertOnNo: false },
  { id: "12", question: "A estrutura possui grandes danos?", answer: null, alertOnYes: false, alertOnNo: false },
  { id: "13", question: "O sistema de freios do Troller está funcionando?", answer: null, alertOnYes: false, alertOnNo: false },
  { id: "14", question: "Os elos da corrente possuem sinais de desgaste?", answer: null, alertOnYes: false, alertOnNo: false },
  { id: "15", question: "Os elos da corrente possuem sinais de \"alargamento\"?", answer: null, alertOnYes: false, alertOnNo: false },
  { id: "16", question: "Os elos da corrente possuem sinais de \"alongamento\"?", answer: null, alertOnYes: false, alertOnNo: false },
  { id: "17", question: "O fim de curso superior está funcionando?", answer: null, alertOnYes: false, alertOnNo: false },
  { id: "18", question: "O fim de curso inferior está funcionando?", answer: null, alertOnYes: false, alertOnNo: false },
  { id: "19", question: "O fim de curso direito está funcionando?", answer: null, alertOnYes: false, alertOnNo: false },
  { id: "20", question: "O fim de curso esquerdo está funcionando?", answer: null, alertOnYes: false, alertOnNo: false },
  { id: "21", question: "O equipamento apresenta ruídos estranhos?", answer: null, alertOnYes: false, alertOnNo: false },
];
