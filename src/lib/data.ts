export interface Operator {
  id: string;
  matricula: string;
  name: string;
  cargo?: string;
  setor?: string;
  senha?: string;
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
  answer: "Sim" | "Não" | "P" | "N/A" | "Selecione" | null;
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
    name: "JosÃ© Edmilton",
    cargo: "Operador",
    setor: "ManutenÃ§Ã£o",
    senha: "1234",
  },
];

export const equipments: Equipment[] = [
  { id: "eq-1", name: "Ponte Rolante A", kp: "1234", type: "1", sector: "ManutenÃ§Ã£o", capacity: "5" },
  { id: "eq-2", name: "Talha ElÃ©trica B", kp: "5678", type: "2", sector: "ProduÃ§Ã£o", capacity: "2" },
  { id: "eq-3", name: "PÃ³rtico C", kp: "9012", type: "3", sector: "ArmazÃ©m", capacity: "10" },
];

export const sectors: Sector[] = [
  { id: "sector-1", name: "ManutenÃ§Ã£o", description: "Setor responsÃ¡vel pela manutenÃ§Ã£o de equipamentos" },
  { id: "sector-2", name: "ProduÃ§Ã£o", description: "Setor de produÃ§Ã£o industrial" },
  { id: "sector-3", name: "ArmazÃ©m", description: "Setor de armazenamento e logÃ­stica" },
  { id: "sector-4", name: "SeguranÃ§a", description: "Setor de seguranÃ§a do trabalho" },
];

export const leaders: Leader[] = [
  {
    id: "leader-1",
    name: "Ana Pereira",
    email: "ana.pereira@checklistafm.com",
    sector: "ManutenÃ§Ã£o",
    password_hash: "bGlkZXIxMjM=", // senha: lider123
  },
  {
    id: "leader-2",
    name: "Bruno Santos",
    email: "bruno.santos@checklistafm.com",
    sector: "ProduÃ§Ã£o",
    password_hash: "Z3VhcmRhMTIz", // senha: guarda123
  },
];

export const checklistItems: ChecklistItem[] = [
  { id: "1", question: "O sistema de freios do guincho estÃ¡ funcionando?", answer: null, alertOnYes: false, alertOnNo: true },
  { id: "2", question: "O gancho estÃ¡ girando sem dificuldades?", answer: null, alertOnYes: false, alertOnNo: true },
  { id: "3", question: "O gancho possui trava de seguranÃ§a funcionando?", answer: null, alertOnYes: false, alertOnNo: true },
  { id: "4", question: "O gancho possui sinais de alongamento?", answer: null, alertOnYes: true, alertOnNo: false },
  { id: "5", question: "Os ganchos da corrente possuem sinais de desgaste?", answer: null, alertOnYes: true, alertOnNo: false },
  { id: "6", question: "As travas de seguranÃ§a dos ganchos estÃ£o funcionando?", answer: null, alertOnYes: false, alertOnNo: true },
  { id: "7", question: "A corrente possui a plaqueta de identificaÃ§Ã£o instalada?", answer: null, alertOnYes: false, alertOnNo: false },
  { id: "8", question: "As polias estÃ£o girando sem dificuldades?", answer: null, alertOnYes: false, alertOnNo: true },
  { id: "9", question: "A sinalizaÃ§Ã£o sonora funciona durante a movimentaÃ§Ã£o?", answer: null, alertOnYes: false, alertOnNo: true },
  { id: "10", question: "O controle possui botÃ£o danificado?", answer: null, alertOnYes: true, alertOnNo: false },
  { id: "11", question: "O botÃ£o de emergÃªncia estÃ¡ funcionando?", answer: null, alertOnYes: false, alertOnNo: true },
  { id: "12", question: "A estrutura possui grandes danos?", answer: null, alertOnYes: true, alertOnNo: false },
  { id: "13", question: "O sistema de freios do Troller estÃ¡ funcionando?", answer: null, alertOnYes: false, alertOnNo: true },
  { id: "14", question: "Os elos da corrente possuem sinais de desgaste?", answer: null, alertOnYes: true, alertOnNo: false },
  { id: "15", question: "Os elos da corrente possuem sinais de \"alargamento\"?", answer: null, alertOnYes: true, alertOnNo: false },
  { id: "16", question: "Os elos da corrente possuem sinais de \"alongamento\"?", answer: null, alertOnYes: true, alertOnNo: false },
  { id: "17", question: "O fim de curso superior estÃ¡ funcionando?", answer: null, alertOnYes: false, alertOnNo: true },
  { id: "18", question: "O fim de curso inferior estÃ¡ funcionando?", answer: null, alertOnYes: false, alertOnNo: true },
  { id: "19", question: "O fim de curso direito estÃ¡ funcionando?", answer: null, alertOnYes: false, alertOnNo: true },
  { id: "20", question: "O fim de curso esquerdo estÃ¡ funcionando?", answer: null, alertOnYes: false, alertOnNo: true },
  { id: "21", question: "O equipamento apresenta ruÃ­dos estranhos?", answer: null, alertOnYes: true, alertOnNo: false },
  { id: "22", question: "Os cabos de aÃ§o apresentam fios partidos?", answer: null, alertOnYes: true, alertOnNo: false },
  { id: "23", question: "Os cabos de aÃ§o apresentam pontos de amassamento?", answer: null, alertOnYes: true, alertOnNo: false },
  { id: "24", question: "Os cabos de aÃ§o apresentam alguma dobra?", answer: null, alertOnYes: true, alertOnNo: false },
  { id: "25", question: "Ao movimentar o equipamento, Ã© possÃ­vel perceber balanÃ§o?", answer: null, alertOnYes: true, alertOnNo: false },
  { id: "26", question: "O batente de giro estÃ¡ em boas condiÃ§Ãµes de uso?", answer: null, alertOnYes: false, alertOnNo: true },
  { id: "27", question: "O saco recolhedor da corrente possui furos ou rasgos?", answer: null, alertOnYes: true, alertOnNo: false },
  { id: "28", question: "O freio do pÃ³rtico estÃ¡ funcionando?", answer: null, alertOnYes: false, alertOnNo: true },
  { id: "29", question: "Os trilhos do pÃ³rtico estÃ£o desobstruÃ­dos?", answer: null, alertOnYes: false, alertOnNo: true },
  { id: "30", question: "Os sensores antiesmagamento do pÃ³rtico estÃ£o funcionando?", answer: null, alertOnYes: false, alertOnNo: true },
];

