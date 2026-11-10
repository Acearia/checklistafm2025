export type ManagedTiAnalyst = {user_id: string; name: string; email: string; badge: string | null; active: boolean; manager: boolean};
export interface TiManagementStore {
  administratorLogin(password: string): Promise<{configured: boolean; session: {access_token: string; refresh_token: string; user: {id: string}} | null}>;
  analystLogin(badge: string, password: string): Promise<{access_token: string; refresh_token: string; user: {id: string}} | null>;
  badgeOwner(badge: string): Promise<string | null>;
  authenticate(token: string): Promise<string | null>;
  authorized(userId: string): Promise<boolean>;
  list(): Promise<ManagedTiAnalyst[]>;
  findUser(email: string): Promise<string | null>;
  createUser(email: string, password: string): Promise<string>;
  deleteUser(userId: string): Promise<void>;
  link(userId: string, name: string, badge: string): Promise<void>;
  member(userId: string): Promise<{manager: boolean} | null>;
  update(userId: string, name: string, active: boolean, badge: string | null): Promise<void>;
  resetPassword(userId: string, password: string): Promise<void>;
}
class ApiError extends Error {constructor(public status: number, message: string) {super(message);}}
const normalizeBadge = (value: unknown, required = true): string | null => {
  const badge = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (!badge && !required) return null;
  if (!/^[A-Z0-9._-]{1,40}$/.test(badge)) throw new ApiError(400, "Informe o número do crachá (até 40 letras ou números, ponto, hífen ou sublinhado).");
  return badge;
};
const requiredText = (value: unknown, label: string, maximum: number) => {
  if (typeof value !== "string" || !value.trim() || value.trim().length > maximum) throw new ApiError(400, `Informe ${label} válido.`);
  return value.trim();
};
const validPassword = (value: unknown) => {
  if (typeof value !== "string" || value.length < 6 || value.length > 8) throw new ApiError(400, "A senha deve ter entre 6 e 8 caracteres.");
  return value;
};
async function readBody(req: Request) {
  const reader = req.body?.getReader();
  if (!reader) throw new ApiError(400, "Pedido inválido.");
  let length = 0; const chunks: Uint8Array[] = [];
  for (;;) {
    const {done, value} = await reader.read(); if (done) break;
    length += value.length;
    if (length > 16384) {await reader.cancel(); throw new ApiError(413, "Pedido muito grande.");}
    chunks.push(value);
  }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) {bytes.set(chunk, offset); offset += chunk.length;}
  try {
    const value = JSON.parse(new TextDecoder().decode(bytes));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value as Record<string, unknown>;
  } catch {throw new ApiError(400, "Pedido inválido.");}
}

export const createTiManagementHandler = (store: TiManagementStore, allowedOrigin: string, additionalOrigins: string[] = []) => async (req: Request): Promise<Response> => {
  const origin = req.headers.get("origin");
  const permitted = new Set([allowedOrigin, ...additionalOrigins]);
  const headers = {"Content-Type": "application/json", "Access-Control-Allow-Origin": origin && permitted.has(origin) ? origin : allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin", "Cache-Control": "no-store"};
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), {status, headers});
  try {
    if (origin && !permitted.has(origin)) throw new ApiError(403, "Origem não autorizada.");
    if (req.method === "OPTIONS") return new Response(null, {status: 204, headers});
    if (req.method !== "POST") throw new ApiError(405, "Método não permitido.");
    const body = await readBody(req);
    if (body.action === "health") return reply(200, {service: "ti-analyst-management", protocol: 6});
    if (body.action === "analyst_login") {
      const badge = normalizeBadge(body.badge)!;
      const password = typeof body.password === "string" && body.password.length <= 128 ? body.password : "";
      const session = password ? await store.analystLogin(badge, password) : null;
      if (!session) throw new ApiError(401, "Crachá ou senha incorretos, ou acesso ao TI não autorizado.");
      return reply(200, {session});
    }
    if (body.action === "administrator_login") {
      if (typeof body.username !== "string" || body.username.trim().toLowerCase() !== "administrador") throw new ApiError(401, "Usuário ou senha incorretos.");
      const password = typeof body.password === "string" && body.password.length <= 128 ? body.password : "";
      if (!password) throw new ApiError(401, "Usuário ou senha incorretos.");
      const result = await store.administratorLogin(password);
      if (!result.configured) throw new ApiError(503, "O login único do administrador precisa ser ativado no servidor.");
      if (!result.session || !await store.authorized(result.session.user.id)) throw new ApiError(401, "Usuário ou senha incorretos.");
      return reply(200, {session: result.session});
    }
    const token = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) throw new ApiError(401, "Entre novamente como administrador.");
    const actor = await store.authenticate(token);
    if (!actor) throw new ApiError(401, "Sessão inválida. Entre novamente.");
    if (!await store.authorized(actor)) throw new ApiError(403, "Esta conta não tem permissão para gerenciar os analistas do TI.");
    if (body.action === "list") return reply(200, {analysts: await store.list()});
    if (body.action === "create" || body.action === "link_existing") {
      const name = requiredText(body.name, "um nome", 120);
      // Auth requires a unique internal address; analysts never provide or share it.
      const email = body.action === "create" ? `ti-${crypto.randomUUID()}@analysts.checklist.invalid` : requiredText(body.email, "um e-mail", 254).toLowerCase();
      const badge = normalizeBadge(body.badge)!;
      if (await store.badgeOwner(badge)) throw new ApiError(409, "Este crachá já está vinculado a outro analista.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError(400, "Informe um e-mail válido.");
      const password = body.action === "create" ? validPassword(body.password) : "";
      let userId = await store.findUser(email);
      if (body.action === "create") {
        if (userId) throw new ApiError(409, "Este e-mail já possui uma conta. Edite o analista ou use Vincular conta existente.");
        userId = await store.createUser(email, password);
      } else if (!userId) throw new ApiError(404, "Não existe uma conta com este e-mail.");
      const existing = await store.member(userId!);
      if (existing) throw new ApiError(409, "Esta conta já pertence ao TI. Use a lista para administrá-la.");
      try {await store.link(userId!, name, badge);} catch {
        // A failed new membership must not leave an inaccessible Auth account.
        if (body.action === "create") await store.deleteUser(userId!);
        throw new ApiError(500, "Não foi possível liberar o acesso ao TI. Confira o crachá e tente novamente.");
      }
      return reply(200, {ok: true});
    }
    if (body.action === "update" || body.action === "reset_password") {
      const userId = requiredText(body.user_id, "um analista", 100);
      const target = await store.member(userId);
      if (!target) throw new ApiError(404, "Analista não encontrado.");
      if (target.manager && (body.action !== "update" || userId !== actor || body.active !== true)) throw new ApiError(403, "A conta do administrador não pode ser bloqueada nem ter a senha alterada nesta tela.");
      if (body.action === "update") {
        const name = requiredText(body.name, "um nome", 120);
        if (typeof body.active !== "boolean") throw new ApiError(400, "Informe a situação do acesso.");
        const badge = normalizeBadge(body.badge, body.active);
        const owner = badge ? await store.badgeOwner(badge) : null;
        if (owner && owner !== userId) throw new ApiError(409, "Este crachá já está vinculado a outro analista.");
        await store.update(userId, name, body.active, badge);
      } else await store.resetPassword(userId, validPassword(body.password));
      return reply(200, {ok: true});
    }
    throw new ApiError(400, "Operação inválida.");
  } catch (error) {
    if ((error as {code?: string})?.code === "23505") return reply(409, {error: "O crachá já está em uso. Atualize a lista e confira o cadastro."});
    return error instanceof ApiError ? reply(error.status, {error: error.message}) : reply(500, {error: "Não foi possível concluir a operação. Tente novamente."});
  }
};
