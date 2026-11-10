import {createClient} from "@supabase/supabase-js";
import {SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY} from "@/integrations/supabase/client";
export type ManagedTiAnalyst = {user_id: string; name: string; email: string; badge: string | null; active: boolean; manager: boolean};
export class TiAdminRequestError extends Error {constructor(message: string, public status: number) {super(message);}}
const storageKey = "checklistafm-ti-management-session";
export const tiManagerClient = createClient(SUPABASE_URL!, SUPABASE_PUBLISHABLE_KEY, {
  auth: {storage: sessionStorage, storageKey, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false},
});
export async function lockTiManagement() {
  try {await tiManagerClient.auth.signOut({scope: "local"});}
  finally {sessionStorage.removeItem(storageKey);}
}
export async function administratorSignIn(username: string, password: string) {
  const response = await fetch(`${SUPABASE_URL!.replace(/\/$/, "")}/functions/v1/manage-ti-analysts`, {
    method: "POST", headers: {"Content-Type": "application/json", apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`},
    body: JSON.stringify({action: "administrator_login", username, password}), signal: AbortSignal.timeout(30000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.session?.access_token || !body.session?.refresh_token) {
    throw new Error(typeof body.error === "string" ? body.error : "O login do administrador não está disponível. Verifique a ativação no servidor.");
  }
  const {error} = await tiManagerClient.auth.setSession({access_token: body.session.access_token, refresh_token: body.session.refresh_token});
  if (error) throw new Error("Não foi possível validar a sessão do administrador. Entre novamente.");
  return {username: "administrador", role: "admin" as const};
}
export async function manageTiAnalysts(input: Record<string, unknown>): Promise<{analysts?: ManagedTiAnalyst[]; ok?: boolean}> {
  const {data, error} = await tiManagerClient.auth.getSession();
  if (error || !data.session) throw new TiAdminRequestError("Entre novamente como administrador para atualizar sua sessão e cadastrar os analistas.", 401);
  const response = await fetch(`${SUPABASE_URL!.replace(/\/$/, "")}/functions/v1/manage-ti-analysts`, {
    method: "POST", headers: {"Content-Type": "application/json", apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${data.session.access_token}`},
    body: JSON.stringify(input), signal: AbortSignal.timeout(30000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new TiAdminRequestError(typeof body.error === "string" ? body.error : "O serviço de cadastro do TI não está disponível. Verifique a ativação no servidor.", response.status);
  if (input.action === "list" ? !Array.isArray(body.analysts) : body.ok !== true) {
    throw new Error("O serviço não confirmou a operação. Verifique a ativação da gestão do TI no servidor.");
  }
  return body;
}
