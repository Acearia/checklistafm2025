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
  const rows: ManagedTiAnalyst[] = [{user_id:"owner",name:"Gestor",email:"owner@qa.test",badge:null,active:true,manager:true}];
  const passwords = new Map<string,string>(); const accounts = new Map<string,string>(); let writes=0;
  const store: TiManagementStore = {
    async administratorLogin(password) {return {configured:true,session:password==="administrator-password"?{access_token:"owner-token",refresh_token:"owner-refresh",user:{id:"owner"}}:null};},
    async analystLogin(badge,password) {const row=rows.find(item=>item.badge===badge&&item.active);return row&&passwords.get(row.email)===password?{access_token:"analyst-token",refresh_token:"analyst-refresh",user:{id:row.user_id}}:null;},
    async badgeOwner(badge) {return rows.find(row=>row.badge===badge)?.user_id || null;},
    async authenticate(token) {return token === "owner-token" ? "owner" : token === "analyst-token" ? "analyst" : null;},
    async authorized(userId) {return userId === "owner";}, async list() {return rows.map(row=>({...row}));},
    async findUser(email) {return rows.find(row=>row.email===email)?.user_id || (email==="existing@qa.test"?"existing":null);},
    async createUser(email,password) {writes++;passwords.set(email,password); const id = `analyst-${accounts.size + 1}`; accounts.set(id,email); return id;},
    async deleteUser(userId) {accounts.delete(userId);},
    async link(userId,name,badge) {writes++;rows.push({user_id:userId,name,badge,email:userId==="existing"?"existing@qa.test":accounts.get(userId)!,active:true,manager:false});},
    async member(userId) {const row=rows.find(row=>row.user_id===userId);return row?{manager:row.manager}:null;},
    async update(userId,name,active,badge) {writes++;Object.assign(rows.find(row=>row.user_id===userId)!,{name,active,badge});},
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
test("administrator login establishes the server session once and never falls back to a local password", async () => {
  const {call,writes,store}=fixture();
  const success=await call({action:"administrator_login",username:"administrador",password:"administrator-password"},"public-token");
  assert.equal(success.status,200);
  assert.equal((await success.json()).session.access_token,"owner-token");
  assert.equal((await call({action:"administrator_login",username:"administrador",password:"admin123"},"public-token")).status,401);
  assert.equal((await call({action:"administrator_login",username:"admin",password:"administrator-password"},"public-token")).status,401);
  store.administratorLogin=async()=>({configured:false,session:null});
  assert.equal((await call({action:"administrator_login",username:"administrador",password:"administrator-password"},"public-token")).status,503);
  assert.equal(writes(),0);
});
test("authorized manager creates access, updates name/status and resets password without exposing credentials", async () => {
  const {call,rows,passwords}=fixture();
  assert.equal((await call({action:"create",name:"Novo TI",email:" NEW@qa.test ",badge:"001234",password:"long-password-123",manager:true})).status,200);
  assert.equal(rows[1].manager,false);
  assert.equal((await call({action:"update",user_id:"analyst-1",name:"Novo nome",badge:"001234",active:false,manager:true})).status,200);
  assert.equal(rows[1].active,false);assert.equal(rows[1].manager,false);
  assert.equal((await call({action:"reset_password",user_id:"analyst-1",password:"new-password-123"})).status,200);
  assert.equal(passwords.get("analyst-1"),"new-password-123");
  const result=await call({action:"list"});const body=await result.text();
  assert.match(body,/Novo nome/);assert.doesNotMatch(body,/long-password|new-password|password_hash/);
  assert.equal(result.headers.get("cache-control"),"no-store");
});
test("existing accounts must be linked explicitly and manager accounts cannot be modified through the UI API", async () => {
  const {call,passwords}=fixture();

  assert.equal((await call({action:"link_existing",name:"QA",email:"existing@qa.test",badge:"001234"})).status,200);
  assert.equal(passwords.size,0);
  assert.equal((await call({action:"reset_password",user_id:"owner",password:"long-password-123"})).status,403);
  assert.equal((await call({action:"update",user_id:"owner",name:"QA",active:false})).status,403);
});
test("invalid input, unsupported methods and unexpected origins never create accounts", async () => {
  const {call,handler,writes}=fixture();
  assert.equal((await call({action:"create",name:"QA",email:"new@qa.test",badge:"001234",password:"short"})).status,400);
  assert.equal((await call({action:"link_existing",name:"QA",email:"invalid",badge:"001234",password:"long-password-123"})).status,400);
  assert.equal((await call({action:"list"},"owner-token","https://other.test")).status,403);
  assert.equal((await handler(new Request("https://qa.test"))).status,405);
  assert.equal((await call({action:"create",name:"x".repeat(17000)})).status,413);
  assert.equal(writes(),0);
});
test("badge login preserves leading zeroes, requires password and denies blocked analysts", async () => {
  const {call}=fixture();
  assert.equal((await call({action:"create",name:"QA",email:"new@qa.test",badge:"001234",password:"long-password-123"})).status,200);
  const result=await call({action:"analyst_login",badge:" 001234 ",password:"long-password-123"},"public-token");
  assert.equal(result.status,200);assert.equal((await result.json()).session.user.id,"analyst-1");
  assert.equal((await call({action:"analyst_login",badge:"1234",password:"long-password-123"},"public-token")).status,401);
  assert.equal((await call({action:"analyst_login",badge:"001234",password:"wrong"},"public-token")).status,401);
  await call({action:"update",user_id:"analyst-1",name:"QA",badge:"001234",active:false});
  assert.equal((await call({action:"analyst_login",badge:"001234",password:"long-password-123"},"public-token")).status,401);
});
test("duplicate badge is rejected before creating an Auth account; administrator may set own badge without disabling own access", async () => {
  const {call,writes,rows}=fixture();
  assert.equal((await call({action:"update",user_id:"owner",name:"Administrador",badge:"000001",active:true})).status,200);
  assert.equal(rows[0].badge,"000001");
  const before=writes();
  assert.equal((await call({action:"create",name:"QA",email:"new@qa.test",badge:"000001",password:"long-password-123"})).status,409);
  assert.equal(writes(),before);
  assert.equal((await call({action:"create",name:"QA",email:"new@qa.test",badge:1234,password:"long-password-123"})).status,400);
});

test("analysts need no email; shared supplied email never identifies or overwrites another account", async () => {
  const {call,rows}=fixture();
  for (const [name,badge,email] of [["First","000010",undefined],["Second","000020","owner@qa.test"]]) {
    assert.equal((await call({action:"create",name,badge,email,password:"long-password-123"})).status,200);
    assert.equal((await call({action:"analyst_login",badge,password:"long-password-123"},"public-token")).status,200);
  }
  assert.notEqual(rows[1].email,rows[2].email);
  assert.match(rows[1].email,/@analysts\.checklist\.invalid$/);
  assert.equal(rows[0].email,"owner@qa.test");
});
test("failed new membership removes the new Auth account, never an existing account", async () => {
  const {call,store}=fixture();const deleted:string[]=[];
  store.link=async()=>{throw new Error("database unavailable");};
  store.deleteUser=async id=>{deleted.push(id);};
  assert.equal((await call({action:"create",name:"QA",badge:"001234",password:"long-password-123"})).status,500);
  assert.deepEqual(deleted,["analyst-1"]);
  assert.equal((await call({action:"link_existing",name:"QA",email:"existing@qa.test",badge:"001234"})).status,500);
  assert.deepEqual(deleted,["analyst-1"]);
});
