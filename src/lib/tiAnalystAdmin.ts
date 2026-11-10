import {createClient} from "@supabase/supabase-js";
import {SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY} from "@/integrations/supabase/client";
export type ManagedTiAnalyst = {user_id: string; name: string; email: string; active: boolean; manager: boolean};
const storageKey = "checklistafm-ti-management-session";
export const tiManagerClient = createClient(SUPABASE_URL!, SUPABASE_PUBLISHABLE_KEY, {
  auth: {storage: sessionStorage, storageKey, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false},
});
export async function lockTiManagement() {
  try {await tiManagerClient.auth.signOut({scope: "local"});}
  finally {sessionStorage.removeItem(storageKey);}
}
export async function manageTiAnalysts(input: Record<string, unknown>): Promise<{analysts?: ManagedTiAnalyst[]; ok?: boolean}> {
  const {data, error} = await tiManagerClient.auth.getSession();
  if (error || !data.session) throw new Error("Entre com a conta gestora do TI para continuar.");
  const response = await fetch(`${SUPABASE_URL!.replace(/\/$/, "")}/functions/v1/manage-ti-analysts`, {
    method: "POST", headers: {"Content-Type": "application/json", apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${data.session.access_token}`},
    body: JSON.stringify(input), signal: AbortSignal.timeout(30000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "O serviço de cadastro do TI não está disponível. Verifique a ativação no servidor.");
  if (input.action === "list" ? !Array.isArray(body.analysts) : body.ok !== true) {
    throw new Error("O serviço não confirmou a operação. Verifique a ativação da gestão do TI no servidor.");
  }
  return body;
}
