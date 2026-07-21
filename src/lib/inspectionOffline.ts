import type { InspectionInsert, Operator, Equipment } from "@/lib/supabase-service";

export const INSPECTION_OFFLINE_STORAGE_KEY = "checklistafm-inspections-pendentes";
export const INSPECTION_OFFLINE_STORAGE_EVENT = "checklistafm-inspections-pendentes-updated";

export type LocalInspectionRecord = {
  id: string;
  payload?: InspectionInsert;
  legacy?: any;
  _sync_status: "pending";
  _saved_local_at: string;
};

const canUseLocalStorage = () => typeof window !== "undefined" && typeof localStorage !== "undefined";

export const createLocalInspectionId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const readLocalInspections = (): LocalInspectionRecord[] => {
  if (!canUseLocalStorage()) return [];

  try {
    const raw = localStorage.getItem(INSPECTION_OFFLINE_STORAGE_KEY);
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed)
      ? parsed.filter((item): item is LocalInspectionRecord => Boolean(item?.id))
      : [];
  } catch (error) {
    console.warn("[inspectionOffline] Falha ao ler fila local de inspeções:", error);
    return [];
  }
};

export const writeLocalInspections = (records: LocalInspectionRecord[]) => {
  if (!canUseLocalStorage()) return;

  localStorage.setItem(INSPECTION_OFFLINE_STORAGE_KEY, JSON.stringify(records));
  window.dispatchEvent(new Event(INSPECTION_OFFLINE_STORAGE_EVENT));
};

export const upsertLocalInspection = (record: Omit<LocalInspectionRecord, "_sync_status" | "_saved_local_at">) => {
  const current = readLocalInspections();
  writeLocalInspections([
    {
      ...record,
      _sync_status: "pending",
      _saved_local_at: new Date().toISOString(),
    },
    ...current.filter((item) => item.id !== record.id),
  ]);
};

export const removeLocalInspections = (ids: string[]) => {
  if (ids.length === 0) return;
  const idSet = new Set(ids.map(String));
  writeLocalInspections(readLocalInspections().filter((item) => !idSet.has(item.id)));
};

export const getPendingLocalInspections = () =>
  readLocalInspections().filter((record) => record._sync_status === "pending");

const findByName = <T extends { name?: string | null }>(items: T[], name?: string | null) => {
  const normalizedName = String(name || "").trim().toLocaleLowerCase("pt-BR");
  if (!normalizedName) return null;
  return items.find((item) => String(item.name || "").trim().toLocaleLowerCase("pt-BR") === normalizedName) || null;
};

export const toInspectionPayload = (
  record: LocalInspectionRecord,
  operators: Operator[],
  equipment: Equipment[],
): InspectionInsert | null => {
  if (record.payload) {
    return {
      ...record.payload,
      id: record.payload.id || record.id,
    };
  }

  const legacy = record.legacy;
  if (!legacy) return null;

  const operator = findByName(operators, legacy.operator?.name);
  const equipmentMatch = findByName(equipment, legacy.equipment?.name);
  if (!operator || !equipmentMatch) return null;

  return {
    id: record.id,
    operator_matricula: operator.matricula || operator.id,
    equipment_id: equipmentMatch.id,
    inspection_date: legacy.inspectionDate,
    submission_date: legacy.submissionDate || new Date().toISOString(),
    comments: legacy.comments || "",
    signature: legacy.signature || null,
    photos: legacy.photos || [],
    checklist_answers: legacy.checklist || [],
  };
};
