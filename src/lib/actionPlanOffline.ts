import type { AccidentActionPlanRecordPayload } from "@/lib/supabase-service";

export const ACTION_PLAN_STORAGE_KEY = "checklistafm-planos-acao-acidente";
export const ACTION_PLAN_STORAGE_EVENT = "checklistafm-plano-acao-updated";

export type LocalActionPlan = AccidentActionPlanRecordPayload & {
  id: string;
  _sync_status?: "pending";
  _saved_local_at?: string;
};

const readAll = (): LocalActionPlan[] => {
  if (typeof localStorage === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(ACTION_PLAN_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => Boolean(item?.id)) : [];
  } catch {
    return [];
  }
};

const writeAll = (records: LocalActionPlan[]) => {
  localStorage.setItem(ACTION_PLAN_STORAGE_KEY, JSON.stringify(records));
  window.dispatchEvent(new Event(ACTION_PLAN_STORAGE_EVENT));
};

export const getPendingLocalActionPlans = () =>
  readAll().filter((record) => record._sync_status === "pending");

export const markLocalActionPlanPending = <T extends { id: string }>(record: T): T & {
  _sync_status: "pending";
  _saved_local_at: string;
} => ({
  ...record,
  _sync_status: "pending",
  _saved_local_at: new Date().toISOString(),
});

export const markLocalActionPlansSynced = (ids: string[]) => {
  if (ids.length === 0) return;
  const synced = new Set(ids.map(String));
  writeAll(
    readAll().map((record) => {
      if (!synced.has(String(record.id))) return record;
      const { _sync_status, _saved_local_at, ...clean } = record;
      return clean as LocalActionPlan;
    }),
  );
};
