import assert from "node:assert/strict";
import { test } from "node:test";
import { buildEnvironmentalActionPlanContext } from "../src/lib/environmentalActionPlan";

test("environmental plan preserves origin and inspection reference and includes only irregular answers", () => {
  const context = buildEnvironmentalActionPlanContext({id: "inspection-uuid", numero_inspecao: 12,
    data_inspecao: "2026-10-27", setor: "Oficina", realizado_por: "Pessoa",
    responses: [
      {numero: "01", pergunta: "Resíduos separados?", resposta: "Não", irregular: true, comentario: 'Separar recipientes\n__ENVIRONMENTAL_EXTRA_PHOTOS__=[{"data_url":"large-image"}]'},
      {numero: "02", pergunta: "Questão conforme", resposta: "Sim", irregular: false},
    ]});
  assert.equal(context.fonte, "ambiental");
  assert.equal(context.origem, "Inspeção Ambiental");
  assert.equal(context.registro_id, "inspection-uuid");
  assert.equal(context.numero_referencia, 12);
  assert.equal(context.data_referencia, "2026-10-27");
  assert.match(context.descricao_ocorrencia, /Resíduos separados\?/);
  assert.match(context.descricao_ocorrencia, /Separar recipientes/);
  assert.doesNotMatch(context.descricao_ocorrencia, /large-image|Questão conforme/);
});

test("pending inspections and inspections without irregularities cannot start a plan", () => {
  assert.throws(() => buildEnvironmentalActionPlanContext({id: "local", responses: [{irregular: true}]}), /sincronização/);
  assert.throws(() => buildEnvironmentalActionPlanContext({id: "synced", numero_inspecao: 2, responses: []}), /não possui irregularidades/);
});
