import type { EnvironmentalInspectionRecordPayload, AccidentActionPlanRecordPayload } from "./supabase-service";

export interface QuestionActionPlanDraft {
  id: string;
  descricao_resumida_acao: string;
  responsavel_execucao: string;
  inicio_planejado: string;
  termino_planejado: string;
  descricao_acao: string;
}

export const createQuestionActionPlanDraft = (numero: number | string, responsavel = ""): QuestionActionPlanDraft => ({
  id: crypto.randomUUID(),
  descricao_resumida_acao: `Tratar irregularidade da pergunta ${numero}`,
  responsavel_execucao: responsavel,
  inicio_planejado: "", termino_planejado: "", descricao_acao: "",
});

export const validateEnvironmentalIrregularity = (
  numero: number | string, comment: string, photos: Array<{ data_url?: string }>, plans: QuestionActionPlanDraft[],
) => {
  if (!comment.trim() || !photos.some(photo => photo.data_url)) return `Adicione comentário e pelo menos uma foto da irregularidade na pergunta ${numero}.`;
  if (!plans.length) return `Adicione pelo menos um plano de ação na pergunta ${numero}.`;
  for (const [index, plan] of plans.entries()) {
    if (!plan.descricao_resumida_acao.trim() || !plan.responsavel_execucao.trim() || !plan.descricao_acao.trim()) {
      return `Preencha resumo, responsável e descrição da ação do plano ${index + 1} da pergunta ${numero}.`;
    }
    if (plan.inicio_planejado && plan.termino_planejado && plan.termino_planejado < plan.inicio_planejado) {
      return `O término do plano ${index + 1} da pergunta ${numero} deve ser igual ou posterior ao início.`;
    }
  }
  return null;
};

// UUIDs are assigned when the drafts are added, so retries reuse the same plans.
export const buildEnvironmentalQuestionPlans = (
  inspection: EnvironmentalInspectionRecordPayload, numero: number,
): AccidentActionPlanRecordPayload[] => {
  if (!numero) throw new Error("A inspeção precisa estar sincronizada antes de vincular os planos.");
  const now = new Date().toISOString();
  return inspection.responses.filter(response => response.irregular).flatMap(response =>
    (response.action_plans || []).map(draft => ({
      ...draft, created_at: inspection.created_at || now, updated_at: now,
      numero_ocorrencia: numero, data_ocorrencia: inspection.data_inspecao,
      origem: "Inspeção Ambiental", prioridade_ocorrencia: "Baixa", prioridade: "Baixa", status: "Aberta",
      severidade: "", probabilidade: "", acao_iniciada: "", acao_finalizada: "",
      observacoes_conclusao: "", data_eficacia: "", observacao_eficacia: "",
      descricao_ocorrencia: `Inspeção Ambiental #${numero} — Setor: ${inspection.setor}\nPergunta ${response.numero}: ${response.pergunta}\nResposta registrada: ${response.resposta}\n${String(response.comentario || "").split("__ENVIRONMENTAL_EXTRA_PHOTOS__=")[0].trim()}`,
      comentarios: [{id: draft.id, autor: inspection.realizado_por, created_at: now,
        texto: `Inspeção Ambiental ${numero} (${inspection.id}). Pergunta ${response.numero}: ${response.pergunta}`}],
    })),
  );
};
