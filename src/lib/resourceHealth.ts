const failures = new Set<string>();
const listeners = new Set<() => void>();
let snapshot: string[] = [];
export const getResourceFailures = () => snapshot;
export const subscribeResourceHealth = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
export const reportResourceHealth = (resource: string, ok: boolean) => {
  if (ok ? !failures.has(resource) : failures.has(resource)) return;
  if (ok) failures.delete(resource); else failures.add(resource);
  snapshot = [...failures];
  listeners.forEach(listener => listener());
};

// Advance by the actual number returned: server page caps may be lower than
// the requested size. Only an empty page proves the history is complete.
export async function readHistory<T>(
  resource: string,
  load: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  limit?: number,
): Promise<T[]> {
  const rows: T[] = [];
  const maximum = limit && limit > 0 ? Math.floor(limit) : Infinity;
  try {
    while (rows.length < maximum) {
      const { data, error } = await load(rows.length, Math.min(rows.length + 999, maximum - 1));
      if (error) throw error;
      if (!data?.length) break;
      rows.push(...data);
    }
    reportResourceHealth(resource, true);
    return rows;
  } catch (error) {
    reportResourceHealth(resource, false);
    throw error;
  }
}
