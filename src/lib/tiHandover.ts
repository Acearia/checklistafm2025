export const TI_STATUSES = ["Aberto", "Em andamento", "Pendente", "Resolvido"] as const;
export type TiStatus = typeof TI_STATUSES[number];
export const TI_CHECKLIST_ITEMS = [
  {id: "rede", question: "Links de internet e rede estão operando normalmente?"},
  {id: "servidores", question: "Servidores e monitoramento foram verificados?"},
  {id: "backups", question: "O resultado dos backups foi conferido?"},
  {id: "sistemas", question: "Sistemas e serviços essenciais estão disponíveis?"},
  {id: "chamados", question: "Chamados prioritários e atendimentos em andamento foram revisados?"},
  {id: "pendencias", question: "Pendências e orientações foram registradas para o próximo turno?"},
] as const;
export type TiChecklistAnswer = {id: string; question: string; answer: "Conforme" | "Irregular" | "Não se aplica" | ""; notes: string};
export type TiMember = {user_id: string; name: string; active: boolean};
export type TiRecord = {
  id: number; created_by: string; created_at: string; occurred_at: string; updated_at: string;
  analyst_name: string; location: string; problem: string; status: TiStatus; notes: string;
  kind: "ocorrencia" | "checklist"; checklist: TiChecklistAnswer[];
};
export const newTiChecklist = (): TiChecklistAnswer[] => TI_CHECKLIST_ITEMS.map(item => ({...item, answer: "", notes: ""}));
export const validateTiChecklist = (items: TiChecklistAnswer[]): string | null => {
  if (items.length !== TI_CHECKLIST_ITEMS.length || new Set(items.map(item => item.id)).size !== items.length) return "Preencha todos os itens do checklist.";
  for (const expected of TI_CHECKLIST_ITEMS) {
    const item = items.find(answer => answer.id === expected.id);
    if (!item || !["Conforme", "Irregular", "Não se aplica"].includes(item.answer)) return `Responda: ${expected.question}`;
    if (item.answer === "Irregular" && !item.notes.trim()) return `Descreva a irregularidade: ${expected.question}`;
  }
  return null;
};
export type TiFilters = {analyst: string; location: string; from: string; to: string; status: string};
const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export const tiLocalDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
export const filterTiRecords = (records: TiRecord[], filters: TiFilters) => records.filter(record => {
  const day = tiLocalDate(record.occurred_at);
  return (!filters.analyst || record.created_by === filters.analyst)
    && normalize(record.location).includes(normalize(filters.location.trim()))
    && (!filters.status || record.status === filters.status)
    && (!filters.from || day >= filters.from) && (!filters.to || day <= filters.to);
});
