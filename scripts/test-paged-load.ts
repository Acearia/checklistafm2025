import assert from "node:assert/strict";
import { test } from "node:test";
import { mapConcurrent, readAllPages } from "../src/lib/pagedLoad";

test("loads in parallel with bounded concurrency and preserves order", async () => {
  let active = 0;
  let peak = 0;
  const values = await mapConcurrent([0, 1, 2, 3, 4, 5, 6], async value => {
    active++;
    peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, value % 2 ? 1 : 8));
    active--;
    return value * 2;
  }, 3);
  assert.equal(peak, 3);
  assert.deepEqual(values, [0, 2, 4, 6, 8, 10, 12]);
});

test("preserves responses beyond the API page limit", async () => {
  const source = Array.from({ length: 2105 }, (_, id) => ({ id }));
  const ranges: number[][] = [];
  const rows = await readAllPages(async (from, to) => {
    ranges.push([from, to]);
    return { data: source.slice(from, to + 1), error: null };
  });
  assert.deepEqual(rows, source);
  assert.deepEqual(ranges, [[0, 999], [1000, 1999], [2000, 2999]]);
});

test("handles exact page multiples and empty lists", async () => {
  let calls = 0;
  const rows = await readAllPages(async from => {
    calls++;
    return { data: from === 0 ? [1, 2] : [], error: null };
  }, 2);
  assert.deepEqual(rows, [1, 2]);
  assert.equal(calls, 2);
  assert.deepEqual(await mapConcurrent([], async item => item), []);
});

test("rejects failed pages instead of returning a partial history", async () => {
  await assert.rejects(readAllPages(async from => ({
    data: from === 0 ? [1, 2] : null,
    error: from === 0 ? null : new Error("API unavailable"),
  }), 2), /API unavailable/);
});
