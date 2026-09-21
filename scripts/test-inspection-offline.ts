import assert from "node:assert/strict";
import { test } from "node:test";
import { toInspectionPayload, type LocalInspectionRecord } from "../src/lib/inspectionOffline";
import type { Operator, Equipment } from "../src/lib/supabase-service";

const operators = [
  { id: "op-1", matricula: "100", name: "Maria" },
  { id: "op-2", matricula: "200", name: "Maria" },
] as Operator[];
const equipment = [
  { id: "eq-1", kp: "10", name: "Ponte" },
  { id: "eq-2", kp: "20", name: "Ponte" },
] as Equipment[];
const record = (operator: object, selectedEquipment: object): LocalInspectionRecord => ({
  id: "inspection-1",
  _sync_status: "pending",
  _saved_local_at: "2026-09-21T12:00:00Z",
  legacy: {
    operator, equipment: selectedEquipment,
    inspectionDate: "2026-09-21", submissionDate: "2026-09-21T12:00:00Z",
    checklist: [{ question: "Freio", answer: "Sim" }],
  },
});

test("preserves selected identities when names are duplicated or renamed", () => {
  const payload = toInspectionPayload(record(
    { matricula: "200", name: "Nome antigo" },
    { id: "eq-2", name: "Nome antigo" },
  ), operators, equipment);
  assert.equal(payload?.operator_matricula, "200");
  assert.equal(payload?.equipment_id, "eq-2");
  assert.equal(payload?.submission_date, "2026-09-21T12:00:00Z");
  assert.equal(payload?.id, "inspection-1");
});

test("resolves legacy equipment by KP", () => {
  const payload = toInspectionPayload(record({ id: "op-2" }, { kp: "20" }), operators, equipment);
  assert.equal(payload?.equipment_id, "eq-2");
});

test("does not send an ambiguous legacy record to the first matching name", () => {
  assert.equal(toInspectionPayload(record({ name: "Maria" }, { name: "Ponte" }), operators, equipment), null);
});

test("still resolves unique legacy names with spaces and different case", () => {
  const payload = toInspectionPayload(record({ name: " maria " }, { name: " PONTE " }), operators.slice(1), equipment.slice(1));
  assert.equal(payload?.operator_matricula, "200");
  assert.equal(payload?.equipment_id, "eq-2");
});

test("retries preserve the queued payload without requiring lookup data", () => {
  const queued = record({}, {});
  queued.payload = {
    id: queued.id, operator_matricula: "200", equipment_id: "eq-2",
    inspection_date: "2026-09-21", checklist_answers: [],
  };
  assert.deepEqual(toInspectionPayload(queued, [], []), queued.payload);
});
