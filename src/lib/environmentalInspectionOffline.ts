import type { EnvironmentalInspectionRecordPayload } from "@/lib/supabase-service";

export const ENVIRONMENTAL_INSPECTION_STORAGE_KEY = "checklistafm-inspecoes-ambientais-pendentes";
export const ENVIRONMENTAL_INSPECTION_STORAGE_EVENT = "checklistafm-inspecoes-ambientais-updated";

export type EnvironmentalInspectionLocalRecord = EnvironmentalInspectionRecordPayload & {
  id: string;
  _sync_status?: "pending";
  _saved_local_at?: string;
};

const canUseLocalStorage = () => typeof window !== "undefined" && typeof localStorage !== "undefined";

export const readLocalEnvironmentalInspections = (): EnvironmentalInspectionLocalRecord[] => {
  if (!canUseLocalStorage()) return [];

  try {
    const raw = localStorage.getItem(ENVIRONMENTAL_INSPECTION_STORAGE_KEY);
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed)
      ? parsed.filter((item): item is EnvironmentalInspectionLocalRecord => Boolean(item?.id))
      : [];
  } catch (error) {
    console.warn("[environmentalInspectionOffline] Falha ao ler fila local:", error);
    return [];
  }
};

export const writeLocalEnvironmentalInspections = (records: EnvironmentalInspectionLocalRecord[]) => {
  if (!canUseLocalStorage()) return;

  localStorage.setItem(ENVIRONMENTAL_INSPECTION_STORAGE_KEY, JSON.stringify(records));
  window.dispatchEvent(new Event(ENVIRONMENTAL_INSPECTION_STORAGE_EVENT));
};

export const upsertLocalEnvironmentalInspection = (record: EnvironmentalInspectionLocalRecord) => {
  const current = readLocalEnvironmentalInspections();
  writeLocalEnvironmentalInspections([
    {
      ...record,
      _sync_status: "pending",
      _saved_local_at: record._saved_local_at || new Date().toISOString(),
    },
    ...current.filter((item) => item.id !== record.id),
  ]);
};

export const removeLocalEnvironmentalInspections = (ids: string[]) => {
  if (ids.length === 0) return;
  const idSet = new Set(ids.map(String));
  writeLocalEnvironmentalInspections(readLocalEnvironmentalInspections().filter((item) => !idSet.has(item.id)));
};
