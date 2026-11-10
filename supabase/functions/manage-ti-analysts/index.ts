import {createClient} from "https://esm.sh/@supabase/supabase-js@2.58.0";
import {createTiManagementHandler} from "../_shared/tiAnalystManagement.ts";

const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {auth: {persistSession: false, autoRefreshToken: false}});
const assertOk = <T>(result: {data: T; error: unknown}): T => {if (result.error) throw result.error; return result.data;};
async function allUsers() {
  const users: Array<{id: string; email?: string}> = [];
  for (let page = 1; ; page++) {
    const data = assertOk(await client.auth.admin.listUsers({page, perPage: 200}));
    users.push(...data.users); if (data.users.length < 200) return users;
  }
}
async function rows(table: string) {
  const all: any[] = [];
  for (;;) {
    const data = assertOk(await client.from(table).select("*").order("user_id").range(all.length, all.length + 499)) || [];
    if (!data.length) return all;
    all.push(...data);
  }
}
async function authorizedAdministrator(userId: string) {
  const login = assertOk(await client.from("ti_administrator_login").select("user_id").eq("username", "administrador").maybeSingle());
  if (login?.user_id !== userId) return false;
  const manager = assertOk(await client.from("ti_account_managers").select("active").eq("user_id", userId).maybeSingle());
  if (!manager?.active) return false;
  const member = assertOk(await client.from("ti_members").select("active").eq("user_id", userId).maybeSingle());
  return !!member?.active;
}
Deno.serve(createTiManagementHandler({
  async analystLogin(badge, password) {
    const member = assertOk(await client.from("ti_members").select("user_id").eq("badge", badge).eq("active", true).maybeSingle());
    if (!member) return null;
    const account = assertOk(await client.auth.admin.getUserById(member.user_id)).user;
    if (!account?.email) return null;
    const auth = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {auth: {persistSession: false, autoRefreshToken: false}});
    const {data, error} = await auth.auth.signInWithPassword({email: account.email, password});
    return !error && data.user?.id === member.user_id ? data.session : null;
  },
  async badgeOwner(badge) {return assertOk(await client.from("ti_members").select("user_id").eq("badge", badge).maybeSingle())?.user_id || null;},
  async administratorLogin(password) {
    const login = assertOk(await client.from("ti_administrator_login").select("user_id").eq("username", "administrador").maybeSingle());
    if (!login) return {configured: false, session: null};
    if (!await authorizedAdministrator(login.user_id)) return {configured: true, session: null};
    const account = assertOk(await client.auth.admin.getUserById(login.user_id)).user;
    if (!account?.email) return {configured: true, session: null};
    const auth = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {auth: {persistSession: false, autoRefreshToken: false}});
    const {data, error} = await auth.auth.signInWithPassword({email: account.email, password});
    return {configured: true, session: !error && data.user?.id === login.user_id ? data.session : null};
  },
  async authenticate(token) {
    const {data, error} = await client.auth.getUser(token);
    return error ? null : data.user?.id || null;
  },
  async authorized(userId) {
    return authorizedAdministrator(userId);
  },
  async list() {
    const [members, administrators, users] = await Promise.all([rows("ti_members"), rows("ti_administrator_login"), allUsers()]);
    const emails = new Map(users.map(user => [user.id, user.email || ""]));
    const managerIds = new Set(administrators.map(administrator => administrator.user_id));
    return members.map(member => ({user_id: member.user_id, name: member.name, badge: member.badge || null, active: member.active, email: emails.get(member.user_id) || "", manager: managerIds.has(member.user_id)})).sort((a,b) => a.name.localeCompare(b.name, "pt-BR"));
  },
  async findUser(email) {return (await allUsers()).find(user => user.email?.toLowerCase() === email)?.id || null;},
  async createUser(email, password) {return assertOk(await client.auth.admin.createUser({email, password, email_confirm: true})).user!.id;},
  async deleteUser(userId) {assertOk(await client.auth.admin.deleteUser(userId));},
  async link(userId, name, badge) {assertOk(await client.from("ti_members").insert({user_id: userId, name, badge, active: true}));},
  async member(userId) {
    const member = assertOk(await client.from("ti_members").select("user_id").eq("user_id", userId).maybeSingle());
    if (!member) return null;
    const manager = assertOk(await client.from("ti_administrator_login").select("user_id").eq("user_id", userId).maybeSingle());
    return {manager: !!manager};
  },
  async update(userId, name, active, badge) {assertOk(await client.from("ti_members").update({name, active, badge}).eq("user_id", userId));},
  async resetPassword(userId, password) {assertOk(await client.auth.admin.updateUserById(userId, {password}));},
}, Deno.env.get("TI_ALLOWED_ORIGIN") || "https://checklist.afm.com.br", ["https://localhost"]));
