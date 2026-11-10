import assert from "node:assert/strict";
import {test} from "node:test";
import {filterTiRecords, newTiChecklist, validateTiChecklist, tiLocalDate, tiTodayFilters, tiMonthRange, tiMonthlySummary, tiOccurrenceTimestamp, type TiRecord} from "../src/lib/tiHandover";

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

test("monthly dashboard groups by user ID, uses occurrence month and current status, and keeps inactive analysts", () => {
  const members = [{user_id:"a",name:"Mesmo nome",active:true},{user_id:"b",name:"Mesmo nome",active:false},{user_id:"c",name:"Sem registros",active:true}];
  const row = (id:number, user:string, month:number, day:number, status:TiRecord["status"]):TiRecord => ({id,created_by:user,analyst_name:"Nome antigo",location:"CPD",occurred_at:new Date(2026,month-1,day,12).toISOString(),status} as TiRecord);
  const rows = [row(1,"a",11,1,"Aberto"),row(2,"a",11,30,"Resolvido"),row(3,"b",11,5,"Em andamento"),row(4,"legacy",11,6,"Pendente"),row(5,"a",10,31,"Aberto"),row(6,"a",12,1,"Resolvido")];
  const result = tiMonthlySummary(rows,members,"2026-11");
  assert.equal(result.total,4);
  assert.deepEqual(result.counts,{Aberto:1,"Em andamento":1,Pendente:1,Resolvido:1});
  assert.equal(result.analysts.find(person=>person.user_id==="a")?.total,2);
  assert.equal(result.analysts.find(person=>person.user_id==="b")?.counts["Em andamento"],1);
  assert.equal(result.analysts.find(person=>person.user_id==="c")?.total,0);
  assert.equal(result.analysts.find(person=>person.user_id==="legacy")?.name,"Nome antigo");
  assert.equal(tiMonthlySummary(rows,members,"2027-01").total,0);
  assert.equal(rows.length,6);
});

test("month ranges include leap days and occurrence date conversion preserves the selected local day", () => {
  assert.deepEqual(tiMonthRange("2028-02"),{from:"2028-02-01",to:"2028-02-29"});
  assert.deepEqual(tiMonthRange("2026-02"),{from:"2026-02-01",to:"2026-02-28"});
  assert.throws(()=>tiMonthRange("2026-13"));
  const now = new Date(2026,10,10,23,59,30);
  assert.equal(tiTodayFilters(now).from,"2026-11-10");
  const timestamp = tiOccurrenceTimestamp("2026-10-31",now);
  assert.equal(tiLocalDate(timestamp),"2026-10-31");
  assert.throws(()=>tiOccurrenceTimestamp("2026-02-30",now));
  assert.throws(()=>tiOccurrenceTimestamp("",now));
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
