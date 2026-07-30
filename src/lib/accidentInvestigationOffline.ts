import type { AccidentInvestigationRecordPayload } from "@/lib/supabase-service";

export const ACCIDENT_INVESTIGATION_STORAGE_KEY = "checklistafm-investigacoes-acidente";
export const ACCIDENT_INVESTIGATION_STORAGE_EVENT = "checklistafm-investigacao-acidente-updated";

export type LocalAccidentInvestigation = AccidentInvestigationRecordPayload & {
  id: string;
  _sync_status?: "pending";
  _saved_local_at?: string;
};

const canUseLocalStorage = () => typeof window !== "undefined" && typeof localStorage !== "undefined";

export const readLocalAccidentInvestigations = (): LocalAccidentInvestigation[] => {
  if (!canUseLocalStorage()) return [];

  try {
    const parsed = JSON.parse(localStorage.getItem(ACCIDENT_INVESTIGATION_STORAGE_KEY) || "[]");
    return Array.isArray(parsed)
      ? parsed.filter((item): item is LocalAccidentInvestigation => Boolean(item?.id))
      : [];
  } catch (error) {
    console.warn("[accidentInvestigationOffline] Falha ao ler investigacoes locais:", error);
    return [];
  }
};

export const writeLocalAccidentInvestigations = (records: LocalAccidentInvestigation[]) => {
  if (!canUseLocalStorage()) return;

  localStorage.setItem(ACCIDENT_INVESTIGATION_STORAGE_KEY, JSON.stringify(records));
  window.dispatchEvent(new Event(ACCIDENT_INVESTIGATION_STORAGE_EVENT));
};

export const markLocalAccidentInvestigationPending = <
  T extends AccidentInvestigationRecordPayload & { id: string },
>(
  record: T,
): T & { _sync_status: "pending"; _saved_local_at: string } => ({
  ...record,
  _sync_status: "pending",
  _saved_local_at: new Date().toISOString(),
});

export const getPendingLocalAccidentInvestigations = () =>
  readLocalAccidentInvestigations().filter((record) => record._sync_status === "pending");

export const markLocalAccidentInvestigationsSynced = (ids: string[]) => {
  if (ids.length === 0) return;

  const synced = new Set(ids.map(String));
  writeLocalAccidentInvestigations(
    readLocalAccidentInvestigations().map((record) => {
      if (!synced.has(String(record.id))) return record;
      const { _sync_status, _saved_local_at, ...clean } = record;
      return clean as LocalAccidentInvestigation;
    }),
  );
};
