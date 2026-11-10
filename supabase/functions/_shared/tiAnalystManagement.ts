export type ManagedTiAnalyst = {user_id: string; name: string; email: string; active: boolean; manager: boolean};
export interface TiManagementStore {
  authenticate(token: string): Promise<string | null>;
  authorized(userId: string): Promise<boolean>;
  list(): Promise<ManagedTiAnalyst[]>;
  findUser(email: string): Promise<string | null>;
  createUser(email: string, password: string): Promise<string>;
  link(userId: string, name: string): Promise<void>;
  member(userId: string): Promise<{manager: boolean} | null>;
  update(userId: string, name: string, active: boolean): Promise<void>;
  resetPassword(userId: string, password: string): Promise<void>;
}
class ApiError extends Error {constructor(public status: number, message: string) {super(message);}}
const requiredText = (value: unknown, label: string, maximum: number) => {
  if (typeof value !== "string" || !value.trim() || value.trim().length > maximum) throw new ApiError(400, `Informe ${label} válido.`);
  return value.trim();
};
const validPassword = (value: unknown) => {
  if (typeof value !== "string" || value.length < 12 || value.length > 128) throw new ApiError(400, "A senha deve ter entre 12 e 128 caracteres.");
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

export const createTiManagementHandler = (store: TiManagementStore, allowedOrigin: string) => async (req: Request): Promise<Response> => {
  const headers = {"Content-Type": "application/json", "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin", "Cache-Control": "no-store"};
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), {status, headers});
  try {
    if (req.headers.get("origin") && req.headers.get("origin") !== allowedOrigin) throw new ApiError(403, "Origem não autorizada.");
    if (req.method === "OPTIONS") return new Response(null, {status: 204, headers});
    if (req.method !== "POST") throw new ApiError(405, "Método não permitido.");
    const token = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) throw new ApiError(401, "Entre com a conta gestora do TI.");
    const actor = await store.authenticate(token);
    if (!actor) throw new ApiError(401, "Sessão inválida. Entre novamente.");
    if (!await store.authorized(actor)) throw new ApiError(403, "Esta conta não tem permissão para gerenciar os analistas do TI.");
    const body = await readBody(req);
    if (body.action === "list") return reply(200, {analysts: await store.list()});
    if (body.action === "create" || body.action === "link_existing") {
      const name = requiredText(body.name, "um nome", 120);
      const email = requiredText(body.email, "um e-mail", 254).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError(400, "Informe um e-mail válido.");
      const password = body.action === "create" ? validPassword(body.password) : "";
      let userId = await store.findUser(email);
      if (body.action === "create") {
        if (userId) throw new ApiError(409, "Este e-mail já possui uma conta. Edite o analista ou use Vincular conta existente.");
        userId = await store.createUser(email, password);
      } else if (!userId) throw new ApiError(404, "Não existe uma conta com este e-mail.");
      const existing = await store.member(userId!);
      if (existing) throw new ApiError(409, "Esta conta já pertence ao TI. Use a lista para administrá-la.");
      try {await store.link(userId!, name);} catch {throw new ApiError(500, "A conta existe, mas o acesso ao TI não foi liberado. Tente Vincular conta existente.");}
      return reply(200, {ok: true});
    }
    if (body.action === "update" || body.action === "reset_password") {
      const userId = requiredText(body.user_id, "um analista", 100);
      const target = await store.member(userId);
      if (!target) throw new ApiError(404, "Analista não encontrado.");
      if (target.manager) throw new ApiError(403, "Contas gestoras são administradas somente no servidor.");
      if (body.action === "update") {
        const name = requiredText(body.name, "um nome", 120);
        if (typeof body.active !== "boolean") throw new ApiError(400, "Informe a situação do acesso.");
        await store.update(userId, name, body.active);
      } else await store.resetPassword(userId, validPassword(body.password));
      return reply(200, {ok: true});
    }
    throw new ApiError(400, "Operação inválida.");
  } catch (error) {
    return error instanceof ApiError ? reply(error.status, {error: error.message}) : reply(500, {error: "Não foi possível concluir a operação. Tente novamente."});
  }
};
