import assert from "node:assert/strict";
import {test} from "node:test";
import {filterTiRecords, newTiChecklist, validateTiChecklist, type TiRecord} from "../src/lib/tiHandover";

test("TI checklist rejects unanswered, duplicate and irregular items without description", () => {
  const items = newTiChecklist();
  assert(validateTiChecklist(items));
  items.forEach(item => {item.answer = "Conforme";});
  assert.equal(validateTiChecklist(items), null);
  items[0].answer = "Irregular";
  assert.match(validateTiChecklist(items)!, /Descreva/);
  items[0].notes = "Link de contingência em uso";
  assert.equal(validateTiChecklist(items), null);
  items[1].id = items[0].id;
  assert(validateTiChecklist(items));
});
test("TI filters combine analyst, local dates, normalized location and status without changing records", () => {
  const row = {id: 1, created_by: "ti-1", occurred_at: new Date(2026, 10, 10, 23, 59).toISOString(), location: "Escritório", status: "Pendente"} as TiRecord;
  const others = {...row, id: 2, created_by: "ti-2"};
  const records = [row, others];
  const filters = {analyst: "ti-1", location: "escritorio", from: "2026-11-10", to: "2026-11-10", status: "Pendente"};
  assert.deepEqual(filterTiRecords(records, filters), [row]);
  assert.equal(filterTiRecords(records, {...filters, status: "Resolvido"}).length, 0);
  assert.equal(filterTiRecords(records, {...filters, from: "2026-11-11"}).length, 0);
  assert.equal(records.length, 2);
});
