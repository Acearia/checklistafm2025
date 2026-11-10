import assert from "node:assert/strict";
import {test} from "node:test";
import {canManageTiAnalysts} from "../src/lib/adminSession";
import {createTiManagementHandler, type TiManagementStore, type ManagedTiAnalyst} from "../supabase/functions/_shared/tiAnalystManagement";

test("only the administrador admin account sees analyst management", () => {
  assert(canManageTiAnalysts({username:" Administrador ",role:"admin"}));
  for (const username of ["admin","adm","seguranca","tecnico","coordenador"]) assert(!canManageTiAnalysts({username,role:"admin"}));
  assert(!canManageTiAnalysts({username:"administrador",role:"coordenador"}));
  assert(!canManageTiAnalysts(null));
});
const fixture = () => {
  const rows: ManagedTiAnalyst[] = [{user_id:"owner",name:"Gestor",email:"owner@qa.test",active:true,manager:true}];
  const passwords = new Map<string,string>();let writes=0;
  const store: TiManagementStore = {
    async authenticate(token) {return token === "owner-token" ? "owner" : token === "analyst-token" ? "analyst" : null;},
    async authorized(userId) {return userId === "owner";}, async list() {return rows.map(row=>({...row}));},
    async findUser(email) {return rows.find(row=>row.email===email)?.user_id || (email==="existing@qa.test"?"existing":null);},
    async createUser(email,password) {writes++;passwords.set(email,password);return "new-analyst";},
    async link(userId,name) {writes++;rows.push({user_id:userId,name,email:userId==="existing"?"existing@qa.test":"new@qa.test",active:true,manager:false});},
    async member(userId) {const row=rows.find(row=>row.user_id===userId);return row?{manager:row.manager}:null;},
    async update(userId,name,active) {writes++;Object.assign(rows.find(row=>row.user_id===userId)!,{name,active});},
    async resetPassword(userId,password) {writes++;passwords.set(userId,password);},
  };
  const handler=createTiManagementHandler(store,"https://checklist.afm.com.br");
  const call=(body:unknown,token="owner-token",origin="https://checklist.afm.com.br")=>handler(new Request("https://qa.test/manage",{
    method:"POST",headers:{authorization:`Bearer ${token}`,origin,"content-type":"application/json"},body:JSON.stringify(body),
  }));
  return {call,handler,rows,passwords,writes:()=>writes,store};
};
test("forged local administrator identity and regular TI tokens cannot provision accounts", async () => {
  const {call,writes}=fixture();
  for (const [token,expected] of [["forged",401],["analyst-token",403]] as const) {
    const result=await call({action:"create",admin_username:"administrador",role:"admin",email:"new@qa.test",name:"QA",password:"long-password"},token);
    assert.equal(result.status,expected);
  }
  assert.equal(writes(),0);
});
test("authorized manager creates access, updates name/status and resets password without exposing credentials", async () => {
  const {call,rows,passwords}=fixture();
  assert.equal((await call({action:"create",name:"Novo TI",email:" NEW@qa.test ",password:"long-password-123",manager:true})).status,200);
  assert.equal(rows[1].manager,false);
  assert.equal((await call({action:"update",user_id:"new-analyst",name:"Novo nome",active:false,manager:true})).status,200);
  assert.equal(rows[1].active,false);assert.equal(rows[1].manager,false);
  assert.equal((await call({action:"reset_password",user_id:"new-analyst",password:"new-password-123"})).status,200);
  assert.equal(passwords.get("new-analyst"),"new-password-123");
  const result=await call({action:"list"});const body=await result.text();
  assert.match(body,/Novo nome/);assert.doesNotMatch(body,/long-password|new-password|password_hash/);
  assert.equal(result.headers.get("cache-control"),"no-store");
});
test("existing accounts must be linked explicitly and manager accounts cannot be modified through the UI API", async () => {
  const {call,passwords}=fixture();
  assert.equal((await call({action:"create",name:"QA",email:"existing@qa.test",password:"long-password-123"})).status,409);
  assert.equal((await call({action:"link_existing",name:"QA",email:"existing@qa.test"})).status,200);
  assert.equal(passwords.size,0);
  assert.equal((await call({action:"reset_password",user_id:"owner",password:"long-password-123"})).status,403);
  assert.equal((await call({action:"update",user_id:"owner",name:"QA",active:false})).status,403);
});
test("invalid input, unsupported methods and unexpected origins never create accounts", async () => {
  const {call,handler,writes}=fixture();
  assert.equal((await call({action:"create",name:"QA",email:"new@qa.test",password:"short"})).status,400);
  assert.equal((await call({action:"create",name:"QA",email:"invalid",password:"long-password-123"})).status,400);
  assert.equal((await call({action:"list"},"owner-token","https://other.test")).status,403);
  assert.equal((await handler(new Request("https://qa.test"))).status,405);
  assert.equal((await call({action:"create",name:"x".repeat(17000)})).status,413);
  assert.equal(writes(),0);
});
