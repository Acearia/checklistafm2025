import { supabase } from "@/integrations/supabase/client";
import type { Json, TablesInsert } from "@/integrations/supabase/types";

export type WorkPermitAnswer = "Sim" | "N/A" | "";

export interface WorkPermitExecutor {
  id: string;
  nome: string;
  funcao: string;
  data: string;
  hora: string;
  assinatura: string | null;
}

export interface WorkPermitRecord {
  id: string;
  numero_permissao?: number;
  empresa: string;
  setor: string;
  data_permissao: string;
  hora_permissao: string;
  descricao_servico: string;
  tipos_servico: string[];
  detalhes_tipo: Record<string, string | string[]>;
  riscos: string[];
  riscos_outros: string;
  medidas_controle: string[];
  medidas_outros: string;
  procedimento_auxiliar: string;
  respostas: Record<string, WorkPermitAnswer>;
  detalhes_respostas: Record<string, string | string[]>;
  executores: WorkPermitExecutor[];
  emissor_nome: string;
  emissor_assinatura: string | null;
  emissor_data: string;
  emissor_hora: string;
  verificador_nome: string;
  verificador_assinatura: string | null;
  verificador_data: string;
  verificador_hora: string;
  status: string;
  encerramento_emissor: Record<string, string | null>;
  encerramento_executor: Record<string, string | null>;
  observacoes_emissor: string;
  observacoes_verificador: string;
  created_at: string;
  updated_at?: string;
  _sync_status?: "pending";
  _saved_local_at?: string;
}

export interface PermitQuestion {
  id: string;
  text: string;
}

export const WORK_PERMIT_SERVICE_TYPES = [
  { id: "psq", label: "Oxicorte, solda ou ferramenta manual com força motriz", code: "PSQ" },
  { id: "area_classificada", label: "Área classificada, com risco de explosão", code: "PSQ" },
  { id: "altura", label: "Trabalho em altura", code: "LVTA" },
  { id: "carga", label: "Movimentação de carga", code: "LVMC" },
  { id: "eletrico", label: "Serviço elétrico acima de 50 V e abaixo de 1.000 V", code: "PSE" },
  { id: "escavacao", label: "Trabalho de escavação", code: "LVE" },
  { id: "outros", label: "Outros trabalhos", code: "" },
] as const;

export const WORK_PERMIT_RISKS = [
  "Incêndio/explosão", "Perfuração", "Derramamento/vazamento", "Radiações ionizantes",
  "Queimadura", "Queda de pessoas/objetos", "Ruídos", "Radiações não ionizantes",
  "Tombamento", "Riscos ergonômicos", "Agentes biológicos", "Desmoronamento",
  "Choque/arco elétrico", "Produtos químicos", "Prensagem", "Asfixia/intoxicação",
  "Altas temperaturas", "Outros",
];

export const WORK_PERMIT_CONTROLS = [
  "Calçado de segurança", "Protetor auricular", "Touca", "Protetor facial", "Escoramento",
  "Ventilador/Exaustor", "Procedimento auxiliar", "Capacete", "Luvas", "Mangote de raspa",
  "Cinto de segurança", "Ferramenta isolante", "Biombo", "Óculos de proteção",
  "Avental de raspa", "Perneira de raspa", "Proteção respiratória",
  "Ferramenta anti-faiscante", "Outros",
];

export const GENERAL_PERMIT_QUESTIONS: PermitQuestion[] = [
  { id: "geral_1", text: "O local está desobstruído, com boa visibilidade e acesso seguro?" },
  { id: "geral_2", text: "O local está isolado e sinalizado adequadamente?" },
  { id: "geral_3", text: "As interfaces entre as equipes envolvidas foram avaliadas?" },
  { id: "geral_4", text: "As atividades que impedem a execução segura foram suspensas?" },
  { id: "geral_5", text: "Os executores estão aptos, treinados e autorizados?" },
  { id: "geral_6", text: "As medidas de controle estão disponíveis e em perfeitas condições?" },
  { id: "geral_7", text: "Os equipamentos e ferramentas estão disponíveis e em perfeitas condições?" },
  { id: "geral_8", text: "Os bloqueios e isolamentos elétricos/mecânicos necessários foram realizados?" },
];

export const CONDITIONAL_PERMIT_QUESTIONS: Record<string, PermitQuestion[]> = {
  psq: [
    { id: "psq_1", text: "Foram adotadas medidas para evitar fogo não intencional ou explosão?" },
    { id: "psq_2", text: "Drenos e canaletas próximos estão cobertos ou selados?" },
    { id: "psq_3", text: "Há equipamento de combate a incêndio disponível?" },
  ],
  altura: [
    { id: "altura_1", text: "Existe proteção contra quedas e a equipe permanecerá 100% atrelada?" },
    { id: "altura_2", text: "O ponto de ancoragem é adequado e seguro?" },
    { id: "altura_3", text: "O cabo-guia está instalado corretamente?" },
    { id: "altura_4", text: "A superfície é estável e nivelada?" },
    { id: "altura_5", text: "Escadas possuem bases antideslizantes e estão amarradas?" },
    { id: "altura_6", text: "A escada utilizada próxima a eletricidade é não condutiva?" },
    { id: "altura_7", text: "A montagem do andaime será feita com cinto de segurança?" },
    { id: "altura_8", text: "O andaime está completo, inspecionado e devidamente fixado?" },
    { id: "altura_9", text: "Os equipamentos de trabalho em altura foram inspecionados?" },
    { id: "altura_10", text: "A distância de redes elétricas é adequada?" },
  ],
  carga: [
    { id: "carga_1", text: "O equipamento de movimentação é adequado para a carga?" },
    { id: "carga_2", text: "O equipamento e seus acessórios foram inspecionados?" },
    { id: "carga_3", text: "Dimensões, geometria e peso da carga são conhecidos?" },
    { id: "carga_4", text: "Ângulos da lança e raio de operação foram avaliados?" },
    { id: "carga_5", text: "O peso dos acessórios foi considerado?" },
    { id: "carga_6", text: "Patolas, chassi e solo oferecem sustentação segura?" },
    { id: "carga_7", text: "Os pontos de pega e apoio da carga são seguros?" },
    { id: "carga_8", text: "Foi avaliada a necessidade de desligar redes elétricas?" },
    { id: "carga_9", text: "Há medidas para impedir derramamentos perigosos?" },
  ],
  eletrico: [
    { id: "eletrico_1", text: "Executores conhecem os procedimentos e estão autorizados?" },
    { id: "eletrico_2", text: "Ferramentas, EPIs e EPCs são adequados ao risco?" },
    { id: "eletrico_3", text: "Isolamento e aterramento foram verificados?" },
    { id: "eletrico_4", text: "Há pessoa de prontidão para atendimento em caso de choque?" },
    { id: "eletrico_5", text: "Materiais condutivos desnecessários foram removidos?" },
    { id: "eletrico_6", text: "Elementos energizados ou energizáveis estão protegidos?" },
    { id: "eletrico_7", text: "Aterramento temporário e pontos de seccionamento estão adequados?" },
    { id: "eletrico_8", text: "A ausência de tensão foi testada?" },
  ],
  escavacao: [
    { id: "escavacao_1", text: "Tubulações e cabos enterrados foram identificados?" },
    { id: "escavacao_2", text: "A sinalização noturna está visível?" },
    { id: "escavacao_3", text: "Foi impedida a entrada de gases, vapores ou líquidos?" },
    { id: "escavacao_4", text: "Estruturas e materiais próximos foram estabilizados?" },
    { id: "escavacao_5", text: "Escavações acima de 1,25 m possuem proteção contra desmoronamento?" },
    { id: "escavacao_6", text: "Escavações acima de 1,25 m possuem acesso seguro?" },
  ],
};

export const WORK_PERMIT_STORAGE_KEY = "checklistafm-permissoes-trabalho-pendentes";
export const WORK_PERMIT_STORAGE_EVENT = "checklistafm-permissoes-trabalho-updated";

export const readLocalWorkPermits = (): WorkPermitRecord[] => {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(WORK_PERMIT_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => item?.id) : [];
  } catch {
    return [];
  }
};

export const upsertLocalWorkPermit = (record: WorkPermitRecord) => {
  const records = readLocalWorkPermits();
  const pending = { ...record, _sync_status: "pending" as const, _saved_local_at: new Date().toISOString() };
  localStorage.setItem(WORK_PERMIT_STORAGE_KEY, JSON.stringify([pending, ...records.filter((item) => item.id !== record.id)]));
  window.dispatchEvent(new Event(WORK_PERMIT_STORAGE_EVENT));
};

export const removeLocalWorkPermits = (ids: string[]) => {
  if (typeof window === "undefined" || ids.length === 0) return;
  const synced = new Set(ids);
  localStorage.setItem(WORK_PERMIT_STORAGE_KEY, JSON.stringify(readLocalWorkPermits().filter((item) => !synced.has(item.id))));
  window.dispatchEvent(new Event(WORK_PERMIT_STORAGE_EVENT));
};

const toJson = (value: unknown): Json => JSON.parse(JSON.stringify(value)) as Json;

const toDatabaseRow = (record: WorkPermitRecord): TablesInsert<"work_permits"> => ({
  id: record.id,
  ...(record.numero_permissao ? { numero_permissao: record.numero_permissao } : {}),
  empresa: record.empresa,
  setor: record.setor,
  data_permissao: record.data_permissao,
  hora_permissao: record.hora_permissao,
  descricao_servico: record.descricao_servico,
  tipos_servico: toJson(record.tipos_servico),
  detalhes_tipo: toJson(record.detalhes_tipo),
  riscos: toJson(record.riscos),
  riscos_outros: record.riscos_outros,
  medidas_controle: toJson(record.medidas_controle),
  medidas_outros: record.medidas_outros,
  procedimento_auxiliar: record.procedimento_auxiliar,
  respostas: toJson(record.respostas),
  detalhes_respostas: toJson(record.detalhes_respostas),
  executores: toJson(record.executores),
  emissor_nome: record.emissor_nome,
  emissor_assinatura: record.emissor_assinatura,
  emissor_data: record.emissor_data,
  emissor_hora: record.emissor_hora,
  verificador_nome: record.verificador_nome,
  verificador_assinatura: record.verificador_assinatura,
  verificador_data: record.verificador_data,
  verificador_hora: record.verificador_hora,
  status: record.status,
  encerramento_emissor: toJson(record.encerramento_emissor),
  encerramento_executor: toJson(record.encerramento_executor),
  observacoes_emissor: record.observacoes_emissor,
  observacoes_verificador: record.observacoes_verificador,
  created_at: record.created_at,
});

export const workPermitService = {
  async getAll() {
    const { data, error } = await supabase
      .from("work_permits")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []) as unknown as WorkPermitRecord[];
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from("work_permits")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data as unknown as WorkPermitRecord | null;
  },

  async create(record: WorkPermitRecord) {
    const { data, error } = await supabase
      .from("work_permits")
      .insert(toDatabaseRow(record))
      .select()
      .single();
    if (error) throw error;
    return data as unknown as WorkPermitRecord;
  },

  async delete(id: string) {
    const { error } = await supabase.from("work_permits").delete().eq("id", id);
    if (error) throw error;
  },

  async syncLocalRecords(records: WorkPermitRecord[]) {
    const syncedIds: string[] = [];
    for (const record of records.filter((item) => item._sync_status === "pending")) {
      try {
        const existing = await this.getById(record.id).catch(() => null);
        if (!existing) await this.create(record);
        syncedIds.push(record.id);
      } catch (error) {
        console.warn("[workPermitService] Falha ao sincronizar permissão:", error);
      }
    }
    return { syncedIds };
  },
};
