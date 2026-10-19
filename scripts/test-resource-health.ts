import assert from "node:assert/strict";
import { test } from "node:test";
import { readHistory, getResourceFailures } from "../src/lib/resourceHealth";
import { fetchWithOfflineCache } from "../src/lib/offlineResourceCache";

test("history handles a server cap below the requested page size without losing records", async () => {
  const source = Array.from({ length: 2105 }, (_, i) => i);
  const result = await readHistory("test-history", async (from, to) => ({
    data: source.slice(from, Math.min(to + 1, from + 300)), error: null,
  }));
  assert.deepEqual(result, source);
});

test("explicit limits remain supported", async () => {
  const source = Array.from({ length: 2000 }, (_, i) => i);
  assert.equal((await readHistory("test-limit", async (from, to) => ({data: source.slice(from, to + 1), error: null}), 1200)).length, 1200);
});

test("a failed later page rejects partial history and remains unhealthy until recovery", async () => {
  await assert.rejects(readHistory("test-failure", async from => from === 0
    ? {data: [1, 2], error: null} : {data: null, error: new Error("server unavailable")}));
  assert(getResourceFailures().includes("test-failure"));
  await readHistory("test-failure", async () => ({data: [], error: null}));
  assert(!getResourceFailures().includes("test-failure"));
});

test("cached fallback is visible as stale and a successful empty response clears it", async () => {
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", {configurable: true, value: {onLine: true}});
  const storage = new Map<string, string>();
  Object.assign(globalThis, {window: {}, localStorage: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  }});
  try {
    await fetchWithOfflineCache("test-cache", async () => [1, 2]);
    assert.deepEqual(await fetchWithOfflineCache("test-cache", async () => { throw new Error("offline"); }), [1, 2]);
    assert(getResourceFailures().includes("test-cache"));
    assert.deepEqual(await fetchWithOfflineCache("test-cache", async () => []), []);
    assert(!getResourceFailures().includes("test-cache"));
  } finally {
    if (originalNavigator) Object.defineProperty(globalThis, "navigator", originalNavigator);
    else delete (globalThis as any).navigator;
    delete (globalThis as any).window;
    delete (globalThis as any).localStorage;
  }
});
