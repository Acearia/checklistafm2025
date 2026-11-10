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

export const tiTodayFilters = (date = new Date()): TiFilters => ({analyst: "", location: "", from: tiLocalDate(date.toISOString()), to: tiLocalDate(date.toISOString()), status: ""});
export const tiMonthRange = (month: string) => {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Selecione um mês válido.");
  const [year, value] = month.split("-").map(Number);
  return {from: `${month}-01`, to: `${month}-${new Date(year, value, 0).getDate()}`};
};
export const tiOccurrenceTimestamp = (day: string, now = new Date()) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("Informe a data do ocorrido.");
  const date = new Date(`${day}T12:00:00`);
  if (Number.isNaN(date.getTime()) || tiLocalDate(date.toISOString()) !== day) throw new Error("Informe uma data válida.");
  date.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), 0);
  return date.toISOString();
};
export const tiMonthlySummary = (records: TiRecord[], members: TiMember[], month: string) => {
  const range = tiMonthRange(month);
  const rows = filterTiRecords(records, {...range, analyst: "", location: "", status: ""});
  const emptyCounts = () => ({Aberto: 0, "Em andamento": 0, Pendente: 0, Resolvido: 0});
  const people = new Map(members.map(person => [person.user_id, {...person, counts: emptyCounts(), total: 0}]));
  const counts = emptyCounts();
  for (const record of rows) {
    let person = people.get(record.created_by);
    if (!person) {person = {user_id: record.created_by, name: record.analyst_name, active: false, counts: emptyCounts(), total: 0}; people.set(person.user_id, person);}
    person.counts[record.status]++; person.total++; counts[record.status]++;
  }
  return {counts, total: rows.length, analysts: [...people.values()].sort((a,b) => b.total-a.total || a.name.localeCompare(b.name,"pt-BR"))};
};
