import assert from "node:assert/strict";
import { test } from "node:test";
import { buildEnvironmentalQuestionPlans, createQuestionActionPlanDraft, validateEnvironmentalIrregularity } from "../src/lib/environmentalQuestionPlans";
import type { EnvironmentalInspectionRecordPayload } from "../src/lib/supabase-service";

const completePlan = () => ({...createQuestionActionPlanDraft(5, "QA"), descricao_acao: "Separar resíduos"});
test("irregular answers require comment, photo and complete plans; comments cannot replace photos", () => {
  const plan = completePlan();
  assert.match(validateEnvironmentalIrregularity(5, "Descrição", [], [plan])!, /foto/);
  assert.match(validateEnvironmentalIrregularity(5, "", [{data_url: "photo"}], [plan])!, /comentário/);
  assert.match(validateEnvironmentalIrregularity(5, "Descrição", [{data_url: "photo"}], [])!, /plano/);
  assert.match(validateEnvironmentalIrregularity(5, "Descrição", [{data_url: "photo"}], [plan, {...plan, descricao_acao: ""}])!, /plano 2/);
  assert.match(validateEnvironmentalIrregularity(5, "Descrição", [{data_url: "photo"}], [{...plan, responsavel_execucao: ""}])!, /responsável/);
  assert.equal(validateEnvironmentalIrregularity(5, "Descrição", [{data_url: "photo"}], [plan, completePlan()]), null);
});
test("planned dates must follow chronological order", () => {
  assert.match(validateEnvironmentalIrregularity(5, "Descrição", [{data_url: "photo"}], [{...completePlan(), inicio_planejado: "2026-11-12", termino_planejado: "2026-11-11"}])!, /posterior/);
});
test("multiple plans on one question keep stable independent IDs through offline retries and use the server inspection number", () => {
  const drafts = [completePlan(), completePlan()];
  const inspection: EnvironmentalInspectionRecordPayload = {id: "env-uuid", realizado_por: "QA", data_inspecao: "2026-11-10", setor: "Oficina", responses: [
    {codigo: "q5", numero: "05", secao: "Resíduos", pergunta: "Resíduos separados?", resposta: "Não", resposta_esperada: "Sim", irregular: true, comentario: 'Descrição\n__ENVIRONMENTAL_EXTRA_PHOTOS__=[{"data_url":"photo"}]', action_plans: drafts},
    {codigo: "q7", numero: "07", secao: "Resíduos", pergunta: "Conforme?", resposta: "Sim", resposta_esperada: "Sim", irregular: false, action_plans: [completePlan()]},
  ]};
  const restored = JSON.parse(JSON.stringify(inspection));
  const first = buildEnvironmentalQuestionPlans(inspection, 103);
  const retry = buildEnvironmentalQuestionPlans(restored, 103);
  assert.equal(first.length, 2);
  assert.notEqual(first[0].id, first[1].id);
  assert.deepEqual(first.map(plan => plan.id), retry.map(plan => plan.id));
  first.forEach(plan => {
    assert.equal(plan.numero_ocorrencia, 103);
    assert.equal(plan.numero_plano, undefined); // number assigned centrally, not from a browser counter
    assert.equal(plan.origem, "Inspeção Ambiental");
    assert.match(plan.descricao_ocorrencia!, /Pergunta 05/);
    assert.match(plan.comentarios[0].texto, /env-uuid/);
    assert.doesNotMatch(plan.descricao_ocorrencia!, /data_url/);
  });
  assert.throws(() => buildEnvironmentalQuestionPlans(inspection, 0), /sincronizada/);
});
