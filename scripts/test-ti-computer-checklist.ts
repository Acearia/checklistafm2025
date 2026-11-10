import assert from "node:assert/strict";
import {test} from "node:test";
import {computerChecklistAnswers, validateComputerChecklist, filterComputerChecklists, type TiComputerChecklist} from "../src/lib/tiComputerChecklist";
test("computer checklist uses active questions and allows partial completion without losing its denominator", () => {
  const answers=computerChecklistAnswers([{id:"domain",label:"Domínio",position:1,active:true},{id:"old",label:"Antiga",position:2,active:false},{id:"office",label:"Office",position:3,active:true}]);
  assert.equal(answers.length,2);assert(answers.every(item=>!item.answer));answers[0].answer=true;
  assert.equal(answers.filter(item=>item.answer).length,1);
  assert.equal(validateComputerChecklist("T0126","usuario","ti-id",answers,""),null);
  assert.match(validateComputerChecklist(" ","usuario","ti-id",answers,"")!,/computador/);
  assert.match(validateComputerChecklist("T0126","usuario","ti-id",[{id:"extra-software",question:"Adicional",answer:true}],"")!,/software/);
});
test("computer checklist filters combine computer, user, responsible analyst and date", () => {
  const row={id:1,computer:"T0126",user_name:"Pessoa.QA",analyst_id:"ti-id",created_at:new Date(2026,10,10,15).toISOString()} as TiComputerChecklist;
  const filters={computer:"t012",user:"pessoa",analyst:"ti-id",from:"2026-11-10",to:"2026-11-10"};
  assert.deepEqual(filterComputerChecklists([row],filters),[row]);
  assert.equal(filterComputerChecklists([row],{...filters,analyst:"other"}).length,0);
  assert.equal(filterComputerChecklists([row],{...filters,to:"2026-11-09"}).length,0);
});
