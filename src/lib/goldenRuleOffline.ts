import type { GoldenRuleRecordPayload } from "@/lib/supabase-service";

export const GOLDEN_RULE_STORAGE_KEY = "checklistafm-regras-de-ouro";
export const GOLDEN_RULE_STORAGE_EVENT = "checklistafm-regras-de-ouro-updated";

export type GoldenRuleLocalRecord = {
  id: string;
  numero_inspecao?: number;
  created_at?: string;
  titulo?: string;
  setor?: string;
  gestor?: string;
  tecnico_seg?: string;
  acompanhante?: string;
  ass_tst?: string | null;
  ass_gestor?: string | null;
  ass_acomp?: string | null;
  respostas?: GoldenRuleRecordPayload["responses"];
  anexos?: GoldenRuleRecordPayload["attachments"];
  _sync_status?: "pending";
  _saved_local_at?: string;
};

const canUseLocalStorage = () => typeof window !== "undefined" && typeof localStorage !== "undefined";

export const readLocalGoldenRules = (): GoldenRuleLocalRecord[] => {
  if (!canUseLocalStorage()) return [];

  try {
    const raw = localStorage.getItem(GOLDEN_RULE_STORAGE_KEY);
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed)
      ? parsed.filter((item): item is GoldenRuleLocalRecord => Boolean(item?.id))
      : [];
  } catch (error) {
    console.warn("[goldenRuleOffline] Falha ao ler regras locais:", error);
    return [];
  }
};

export const writeLocalGoldenRules = (records: GoldenRuleLocalRecord[]) => {
  if (!canUseLocalStorage()) return;

  localStorage.setItem(GOLDEN_RULE_STORAGE_KEY, JSON.stringify(records));
  window.dispatchEvent(new Event(GOLDEN_RULE_STORAGE_EVENT));
};

export const upsertLocalGoldenRule = (record: GoldenRuleLocalRecord) => {
  const current = readLocalGoldenRules();
  writeLocalGoldenRules([
    {
      ...record,
      _sync_status: "pending",
      _saved_local_at: record._saved_local_at || new Date().toISOString(),
    },
    ...current.filter((item) => item.id !== record.id),
  ]);
};

export const removeLocalGoldenRules = (ids: string[]) => {
  if (ids.length === 0) return;
  const idSet = new Set(ids.map(String));
  writeLocalGoldenRules(readLocalGoldenRules().filter((item) => !idSet.has(item.id)));
};

export const getPendingLocalGoldenRules = () =>
  readLocalGoldenRules().filter((record) => {
    if (record._sync_status === "pending") return true;
    // Compatibilidade com registros que foram salvos offline antes da fila ganhar status.
    return Array.isArray(record.respostas) && record.respostas.length > 0;
  });

export const toGoldenRulePayload = (record: GoldenRuleLocalRecord): GoldenRuleRecordPayload => ({
  id: record.id,
  numero_inspecao: Number(record.numero_inspecao) || undefined,
  titulo: String(record.titulo || "Regra de ouro").trim(),
  setor: String(record.setor || "").trim(),
  gestor: String(record.gestor || "").trim(),
  tecnico_seg: String(record.tecnico_seg || "").trim(),
  acompanhante: String(record.acompanhante || "").trim(),
  ass_tst: record.ass_tst || null,
  ass_gestor: record.ass_gestor || null,
  ass_acomp: record.ass_acomp || null,
  created_at: record.created_at || new Date().toISOString(),
  responses: Array.isArray(record.respostas) ? record.respostas : [],
  attachments: Array.isArray(record.anexos) ? record.anexos : [],
});
