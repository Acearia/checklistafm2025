import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";
import type { TiMember, TiRecord, TiStatus, TiChecklistAnswer } from "./tiHandover";

export const tiClient = createClient(SUPABASE_URL!, SUPABASE_PUBLISHABLE_KEY, {
  auth: {storage: sessionStorage, storageKey: "checklistafm-ti-session", persistSession: true, autoRefreshToken: true, detectSessionInUrl: false},
});
export async function signInTiWithBadge(badge: string, password: string) {
  const response = await fetch(`${SUPABASE_URL!.replace(/\/$/, "")}/functions/v1/manage-ti-analysts`, {
    method: "POST", headers: {"Content-Type": "application/json", apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`},
    body: JSON.stringify({action: "analyst_login", badge: badge.trim().toUpperCase(), password}), signal: AbortSignal.timeout(30000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.session?.access_token || !body.session?.refresh_token) throw new Error(typeof body.error === "string" ? body.error : "O serviço de entrada do TI não está disponível. Verifique a ativação no servidor.");
  const {error} = await tiClient.auth.setSession({access_token: body.session.access_token, refresh_token: body.session.refresh_token});
  if (error) throw new Error("Não foi possível validar a sessão do TI. Entre novamente.");
}

export const tiHandoverService = {
  async member(userId: string): Promise<TiMember | null> {
    const {data, error} = await tiClient.from("ti_members").select("user_id,name,active").eq("user_id", userId).eq("active", true).maybeSingle();
    if (error) throw error;
    return data;
  },
  async members(): Promise<TiMember[]> {
    const {data, error} = await tiClient.from("ti_members").select("user_id,name,active").order("name");
    if (error) throw error;
    return data || [];
  },
  async records(): Promise<TiRecord[]> {
    const rows: TiRecord[] = [];
    for (;;) {
      const {data, error} = await tiClient.from("ti_handover_records").select("*").order("occurred_at", {ascending: false}).order("id", {ascending: false}).range(rows.length, rows.length + 499);
      if (error) throw error;
      if (!data?.length) return rows;
      rows.push(...data as TiRecord[]);
    }
  },
  async create(input: {created_by: string; location: string; occurred_at: string; problem: string; status: TiStatus; notes: string; kind: "ocorrencia" | "checklist"; checklist: TiChecklistAnswer[]}) {
    const {data, error} = await tiClient.from("ti_handover_records").insert({...input, analyst_name: ""}).select().single();
    if (error) throw error;
    return data as TiRecord;
  },
  async update(id: number, status: TiStatus, notes: string, updatedAt: string) {
    const {data, error} = await tiClient.from("ti_handover_records").update({status, notes}).eq("id", id).eq("updated_at", updatedAt).select().maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Este registro foi alterado por outro analista. Atualize a lista antes de salvar.");
    return data as TiRecord;
  },
};

export async function exportTiRecordsPdf(records: TiRecord[]) {
  const {jsPDF} = await import("jspdf");
  const doc = new jsPDF();
  let y = 18;
  doc.setFontSize(16); doc.text("AFM - Troca de Turnos TI", 14, y); y += 10;
  doc.setFontSize(9); doc.text(`Emitido em ${new Date().toLocaleString("pt-BR")} | ${records.length} registro(s)`, 14, y); y += 10;
  const line = (text: string) => {
    for (const part of doc.splitTextToSize(text, 180)) {
      if (y > 280) {doc.addPage(); y = 16;}
      doc.text(part, 14, y); y += 5;
    }
  };
  for (const record of records) {
    line(`#${record.id} | ${new Date(record.occurred_at).toLocaleString("pt-BR")} | ${record.analyst_name}`);
    line(`Local: ${record.location} | Status: ${record.status}`);
    line(`Problema/Resumo: ${record.problem}`);
    if (record.notes) line(`Observacao: ${record.notes}`);
    for (const item of record.checklist || []) {
      line(`${item.question}: ${item.answer}${item.notes ? ` - ${item.notes}` : ""}`);
    }
    y += 6;
  }
  doc.save("troca-de-turnos-ti.pdf");
}
