import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/integrations/supabase/client";

export const isBrowserOnline = () =>
  typeof navigator === "undefined" || navigator.onLine;

const withTimeout = async (
  request: Promise<Response>,
  abort: () => void,
  timeoutMs = 5000,
) => {
  if (typeof window === "undefined") return request;

  const timeoutId = window.setTimeout(abort, timeoutMs);
  try {
    return await request;
  } finally {
    window.clearTimeout(timeoutId);
  }
};

const pingSupabase = async () => {
  if (typeof fetch === "undefined") return false;

  const controller = new AbortController();

  try {
    const response = await withTimeout(
      fetch(
        `${SUPABASE_URL}/rest/v1/leaders?select=id&limit=1&online_ping=${Date.now()}`,
        {
          cache: "no-store",
          headers: {
            apikey: SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
          },
          signal: controller.signal,
        },
      ),
      () => controller.abort(),
      5000,
    );

    return response.ok;
  } catch {
    return false;
  }
};

const pingInternet = async () => {
  if (typeof fetch === "undefined") return false;

  const controller = new AbortController();

  try {
    const response = await withTimeout(
      fetch("https://www.gstatic.com/generate_204", {
        cache: "no-store",
        mode: "no-cors",
        signal: controller.signal,
      }),
      () => controller.abort(),
      3000,
    );

    return response.type === "opaque" || response.status === 204 || response.ok;
  } catch {
    return false;
  }
};

/**
 * Em celular/tablet, o navigator.onLine pode mentir quando o aparelho troca de
 * antena/AP. Por isso validamos primeiro a API do Supabase, que e o que
 * realmente importa para enviar e sincronizar registros.
 */
export const isDeviceOnline = async (): Promise<boolean> => {
  if (await pingSupabase()) return true;

  if (!isBrowserOnline()) {
    return false;
  }

  // Se houver internet mas o Supabase falhar, o envio ainda cai no catch e fica na fila.
  return pingInternet();
};
