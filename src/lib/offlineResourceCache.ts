const CACHE_PREFIX = "checklistafm-resource-cache-v1:";

const canUseStorage = () =>
  typeof window !== "undefined" && typeof localStorage !== "undefined";

const readCache = <T>(resource: string): T | null => {
  if (!canUseStorage()) return null;
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${resource}`);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const writeCache = <T>(resource: string, value: T) => {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(`${CACHE_PREFIX}${resource}`, JSON.stringify(value));
  } catch (error) {
    console.warn(`[offlineResourceCache] Não foi possível guardar ${resource}:`, error);
  }
};

export const fetchWithOfflineCache = async <T>(
  resource: string,
  fetchRemote: () => Promise<T>,
): Promise<T> => {
  const cached = readCache<T>(resource);
  const offline = typeof navigator !== "undefined" && !navigator.onLine;

  if (offline) {
    if (cached !== null) return cached;
    throw new Error(`Sem conexão e sem dados locais para ${resource}.`);
  }

  try {
    const fresh = await fetchRemote();
    writeCache(resource, fresh);
    return fresh;
  } catch (error) {
    if (cached !== null) {
      console.warn(`[offlineResourceCache] Usando cache local de ${resource}.`, error);
      return cached;
    }
    throw error;
  }
};
