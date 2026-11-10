import {tiLocalDate} from "./tiHandover";
export type TiComputerQuestion = {id: string; label: string; position: number; active: boolean};
export type TiComputerAnswer = {id: string; question: string; answer: boolean; custom?: boolean};
export type TiComputerChecklist = {
  id: number; created_by: string; created_at: string; updated_at: string;
  computer: string; user_name: string; analyst_id: string; analyst_name: string;
  answers: TiComputerAnswer[]; additional_software: string; notes: string;
};
export const computerChecklistAnswers = (questions: TiComputerQuestion[]): TiComputerAnswer[] => questions
  .filter(question => question.active).map(question => ({id: question.id, question: question.label, answer: false}));
export const validateComputerChecklist = (computer: string, user: string, analyst: string, answers: TiComputerAnswer[], software: string) => {
  if (!computer.trim() || !user.trim() || !analyst) return "Informe computador, usuário e analista responsável.";
  if (!answers.length) return "Cadastre pelo menos uma pergunta antes de salvar o checklist.";
  if (answers.some(item => item.id === "extra-software" && item.answer) && !software.trim()) return "Detalhe o software adicional utilizado pelo usuário.";
  return null;
};
export const filterComputerChecklists = (records: TiComputerChecklist[], filters: {computer: string; user: string; analyst: string; from: string; to: string}) => records.filter(row => {
  const day = tiLocalDate(row.created_at);
  return row.computer.toLowerCase().includes(filters.computer.trim().toLowerCase())
    && row.user_name.toLowerCase().includes(filters.user.trim().toLowerCase())
    && (!filters.analyst || row.analyst_id === filters.analyst)
    && (!filters.from || day >= filters.from) && (!filters.to || day <= filters.to);
});
