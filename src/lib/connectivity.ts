export const isBrowserOnline = () =>
  typeof navigator === "undefined" || navigator.onLine;

const pingCurrentOrigin = async () => {
  if (typeof window === "undefined" || typeof fetch === "undefined") return false;

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 4000);

  try {
    const response = await fetch(
      `${window.location.origin}/manifest.webmanifest?offline_ping=${Date.now()}`,
      {
        cache: "no-store",
        method: "HEAD",
        signal: controller.signal,
      },
    );

    return response.ok || response.type === "opaque" || response.status === 0;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeoutId);
  }
};

/**
 * Em celular/tablet, o navigator.onLine pode ficar preso como false quando o
 * aparelho troca de antena/AP. Nesses casos fazemos um ping curto no proprio
 * site antes de desistir da sincronizacao.
 */
export const isDeviceOnline = async (): Promise<boolean> => {
  if (isBrowserOnline()) return true;
  return pingCurrentOrigin();
};
