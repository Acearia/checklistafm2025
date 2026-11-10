import {tiClient} from "./tiHandoverService";
import type {TiComputerChecklist, TiComputerQuestion} from "./tiComputerChecklist";

async function allRows<T>(table: string, sort: string, ascending: boolean): Promise<T[]> {
  const rows: T[] = [];
  for (;;) {
    const {data, error} = await tiClient.from(table).select("*").order(sort, {ascending}).order("id", {ascending}).range(rows.length, rows.length + 499);
    if (error) throw error;
    if (!data?.length) return rows;
    rows.push(...data as T[]);
  }
}
export const tiComputerChecklistService = {
  list: () => allRows<TiComputerChecklist>("ti_computer_checklists", "created_at", false),
  questions: () => allRows<TiComputerQuestion>("ti_computer_questions", "position", true),
  async save(input: Omit<TiComputerChecklist, "id" | "created_at" | "updated_at" | "analyst_name">, existing?: TiComputerChecklist) {
    const query = existing
      ? tiClient.from("ti_computer_checklists").update(input).eq("id", existing.id).eq("updated_at", existing.updated_at)
      : tiClient.from("ti_computer_checklists").insert({...input, analyst_name: ""});
    const {data, error} = await query.select().maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Este checklist foi alterado por outro analista. Atualize a lista antes de editar.");
    return data as TiComputerChecklist;
  },
  async saveQuestion(input: {label: string; position: number; active: boolean}, id?: string) {
    const query = id ? tiClient.from("ti_computer_questions").update(input).eq("id", id) : tiClient.from("ti_computer_questions").insert(input);
    const {data, error} = await query.select().single();
    if (error) throw error;
    return data as TiComputerQuestion;
  },
};
