import type { EnvironmentalInspectionDetail } from "@/components/environmental/EnvironmentalInspectionDetailsDialog";

export const ENVIRONMENTAL_PLAN_ORIGIN = "Inspeção Ambiental";
export const buildEnvironmentalActionPlanContext = (record: EnvironmentalInspectionDetail) => {
  if (!record.id || !Number(record.numero_inspecao)) {
    throw new Error("Aguarde a sincronização da inspeção antes de abrir o plano de ação.");
  }
  const irregular = (record.responses || []).filter(response => response.irregular);
  if (!irregular.length) throw new Error("Esta inspeção não possui irregularidades para abrir um plano de ação.");
  const description = irregular.map(response => {
    const comment = String(response.comentario || "").split("__ENVIRONMENTAL_EXTRA_PHOTOS__=")[0].trim();
    return `Pergunta ${response.numero || ""}: ${response.pergunta || ""}\nResposta: ${response.resposta || ""}${comment ? `\nObservação: ${comment}` : ""}`;
  }).join("\n\n");
  return {
    fonte: "ambiental" as const,
    registro_id: record.id,
    numero_referencia: Number(record.numero_inspecao),
    data_referencia: record.data_inspecao || record.created_at || "",
    titulo: `Inspeção Ambiental ${record.numero_inspecao}`,
    setor: record.setor || "",
    tecnico: record.realizado_por || "",
    descricao_ocorrencia: `Inspeção Ambiental #${record.numero_inspecao} — Setor: ${record.setor || "N/A"}\n\n${description}`,
    descricao_resumida_acao: "Tratar irregularidades da inspeção ambiental",
    origem: ENVIRONMENTAL_PLAN_ORIGIN,
  };
};
