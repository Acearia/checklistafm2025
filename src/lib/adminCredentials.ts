import { supabase } from "@/integrations/supabase/client";

export type AdminRole = "admin" | "seguranca";
export type SystemRole = AdminRole | "investigador";

interface AdminAccountRecord {
  username: string;
  password_hash: string;
  role: SystemRole;
}

const ADMIN_TABLE = "admin_users";
const INVESTIGATOR_ROLE: SystemRole = "investigador";
const LOCAL_ACCOUNTS_STORAGE_KEY = "checklistafm-admin-users-local";

const encodePassword = (value: string): string => {
  if (typeof window !== "undefined" && typeof window.btoa === "function") {
    return window.btoa(value);
  }
  if (typeof Buffer !== "undefined") {
    return Buffer.from(value, "utf-8").toString("base64");
  }
  return value;
};

const normalizeUsername = (value: string) => value.trim().toLowerCase();
const isAdminRole = (role: string): role is AdminRole =>
  role === "admin" || role === "seguranca";
const isSystemRole = (role: string): role is SystemRole =>
  role === "admin" || role === "seguranca" || role === "investigador";

const isPrivateHost = (hostname: string) => {
  if (!hostname) return false;
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") return true;
  if (/^10\./.test(hostname)) return true;
  if (/^192\.168\./.test(hostname)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)) return true;
  return false;
};

const canUseLocalFallback = () => {
  if (typeof window === "undefined") return false;
  return isPrivateHost(window.location.hostname);
};

export const isLocalCredentialFallbackEnabled = () => canUseLocalFallback();

const DEFAULT_ACCOUNTS: AdminAccountRecord[] = [
  {
    username: normalizeUsername("administrador"),
    password_hash: encodePassword("admin123"),
    role: "admin",
  },
  {
    username: normalizeUsername("seguranca"),
    password_hash: encodePassword("seguranca123"),
    role: "seguranca",
  },
];

const toRow = (account: AdminAccountRecord) => ({
  username: normalizeUsername(account.username),
  password_hash: account.password_hash,
  role: account.role,
});

const sanitizeLocalAccount = (value: unknown): AdminAccountRecord | null => {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const username = normalizeUsername(String(row.username || ""));
  const passwordHash = String(row.password_hash || "").trim();
  const role = String(row.role || "").trim();

  if (!username || !passwordHash || !isSystemRole(role)) return null;

  return {
    username,
    password_hash: passwordHash,
    role,
  };
};

const dedupeAccounts = (accounts: AdminAccountRecord[]) => {
  const map = new Map<string, AdminAccountRecord>();
  for (const account of accounts) {
    map.set(normalizeUsername(account.username), {
      username: normalizeUsername(account.username),
      password_hash: account.password_hash,
      role: account.role,
    });
  }
  return Array.from(map.values()).sort((a, b) => a.username.localeCompare(b.username));
};

const loadLocalAccounts = (): AdminAccountRecord[] => {
  if (typeof window === "undefined") return [...DEFAULT_ACCOUNTS];

  let parsed: AdminAccountRecord[] = [];
  try {
    const raw = localStorage.getItem(LOCAL_ACCOUNTS_STORAGE_KEY);
    if (raw) {
      const source = JSON.parse(raw) as unknown[];
      parsed = Array.isArray(source)
        ? source
            .map(sanitizeLocalAccount)
            .filter((item): item is AdminAccountRecord => Boolean(item))
        : [];
    }
  } catch (error) {
    console.error("Erro ao carregar credenciais locais:", error);
  }

  const merged = dedupeAccounts([...DEFAULT_ACCOUNTS, ...parsed]);

  try {
    localStorage.setItem(LOCAL_ACCOUNTS_STORAGE_KEY, JSON.stringify(merged));
  } catch (error) {
    console.error("Erro ao salvar credenciais locais:", error);
  }

  return merged;
};

const saveLocalAccounts = (accounts: AdminAccountRecord[]) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      LOCAL_ACCOUNTS_STORAGE_KEY,
      JSON.stringify(dedupeAccounts(accounts)),
    );
  } catch (error) {
    console.error("Erro ao persistir credenciais locais:", error);
  }
};

const verifyLocalCredentials = (
  username: string,
  password: string,
  roleFilter: (role: SystemRole) => boolean,
): { username: string; role: SystemRole } | null => {
  const normalized = normalizeUsername(username);
  const expectedHash = encodePassword(password);
  const account = loadLocalAccounts().find(
    (item) => item.username === normalized && roleFilter(item.role),
  );
  if (!account) return null;
  if (account.password_hash !== expectedHash) return null;
  return {
    username: account.username,
    role: account.role,
  };
};

const listLocalAccounts = (roleFilter: (role: SystemRole) => boolean) =>
  loadLocalAccounts().filter((account) => roleFilter(account.role));

export const ensureDefaultAdminAccounts = async (): Promise<void> => {
  if (canUseLocalFallback()) {
    loadLocalAccounts();
  }

  const { data, error } = await supabase.from(ADMIN_TABLE).select("username");

  if (error) {
    console.error("Erro ao verificar contas administrativas:", error);
    return;
  }

  const existing = new Set((data || []).map((item) => item.username.toLowerCase()));
  const missing = DEFAULT_ACCOUNTS.filter(
    (account) => !existing.has(account.username.toLowerCase()),
  );

  if (missing.length === 0) return;

  const { error: insertError } = await supabase
    .from(ADMIN_TABLE)
    .upsert(missing.map(toRow), { onConflict: "username" });

  if (insertError) {
    console.error("Erro ao inserir contas padrão:", insertError);
  }
};

export const verifyAdminCredentials = async (
  username: string,
  password: string,
): Promise<{ username: string; role: AdminRole } | null> => {
  const normalized = normalizeUsername(username);
  const expectedHash = encodePassword(password);

  const { data, error } = await supabase
    .from(ADMIN_TABLE)
    .select("username, role, password_hash")
    .eq("username", normalized)
    .maybeSingle();

  if (error || !data) {
    if (!canUseLocalFallback()) {
      if (error) console.error("Erro ao verificar credenciais administrativas:", error);
      return null;
    }
    const localAuth = verifyLocalCredentials(username, password, (role) => isAdminRole(role));
    if (!localAuth || !isAdminRole(localAuth.role)) return null;
    return {
      username: localAuth.username,
      role: localAuth.role,
    };
  }

  if (!isAdminRole(data.role)) return null;
  if (data.password_hash !== expectedHash) return null;

  return {
    username: data.username,
    role: data.role,
  };
};

export const verifyInvestigatorCredentials = async (
  username: string,
  password: string,
): Promise<{ username: string; role: "investigador" } | null> => {
  const normalized = normalizeUsername(username);
  const expectedHash = encodePassword(password);

  const { data, error } = await supabase
    .from(ADMIN_TABLE)
    .select("username, role, password_hash")
    .eq("username", normalized)
    .eq("role", INVESTIGATOR_ROLE)
    .maybeSingle();

  if (error || !data) {
    if (!canUseLocalFallback()) {
      if (error) console.error("Erro ao verificar credenciais de investigador:", error);
      return null;
    }
    const localAuth = verifyLocalCredentials(
      username,
      password,
      (role) => role === INVESTIGATOR_ROLE,
    );
    if (!localAuth) return null;
    return {
      username: localAuth.username,
      role: INVESTIGATOR_ROLE,
    };
  }

  if (data.password_hash !== expectedHash) return null;

  return {
    username: data.username,
    role: INVESTIGATOR_ROLE,
  };
};

export const updateAdminPassword = async (
  username: string,
  newPassword: string,
): Promise<boolean> => {
  const normalized = normalizeUsername(username);
  const newHash = encodePassword(newPassword);

  const { data, error } = await supabase
    .from(ADMIN_TABLE)
    .update({ password_hash: newHash })
    .eq("username", normalized)
    .select("username")
    .maybeSingle();

  if (!error && data) {
    return true;
  }

  if (!canUseLocalFallback()) {
    if (error) console.error("Erro ao atualizar senha administrativa:", error);
    return false;
  }

  const local = loadLocalAccounts();
  const index = local.findIndex(
    (item) => item.username === normalized && isAdminRole(item.role),
  );
  if (index === -1) return false;
  local[index] = {
    ...local[index],
    password_hash: newHash,
  };
  saveLocalAccounts(local);
  return true;
};

export const resetAdminAccounts = async (): Promise<void> => {
  const { error } = await supabase
    .from(ADMIN_TABLE)
    .upsert(DEFAULT_ACCOUNTS.map(toRow), { onConflict: "username" });

  if (error) {
    console.error("Erro ao redefinir contas administrativas:", error);
  }

  if (canUseLocalFallback()) {
    const existing = loadLocalAccounts().filter((account) => !isAdminRole(account.role));
    saveLocalAccounts([...existing, ...DEFAULT_ACCOUNTS]);
  }
};

export const listAdminAccounts = async (): Promise<
  { username: string; role: AdminRole }[]
> => {
  const { data, error } = await supabase
    .from(ADMIN_TABLE)
    .select("username, role")
    .order("username");

  if (!error && data) {
    return data
      .filter((item) => isAdminRole(item.role))
      .map((item) => ({
        username: item.username,
        role: item.role,
      }));
  }

  if (!canUseLocalFallback()) {
    if (error) console.error("Erro ao listar contas administrativas:", error);
    return [];
  }

  return listLocalAccounts((role) => isAdminRole(role)).map((item) => ({
    username: item.username,
    role: item.role as AdminRole,
  }));
};

export const listInvestigatorAccounts = async (): Promise<
  { username: string; role: "investigador" }[]
> => {
  const { data, error } = await supabase
    .from(ADMIN_TABLE)
    .select("username, role")
    .eq("role", INVESTIGATOR_ROLE)
    .order("username");

  if (!error && data) {
    return data.map((item) => ({
      username: item.username,
      role: INVESTIGATOR_ROLE,
    }));
  }

  if (!canUseLocalFallback()) {
    if (error) console.error("Erro ao listar investigadores:", error);
    return [];
  }

  return listLocalAccounts((role) => role === INVESTIGATOR_ROLE).map((item) => ({
    username: item.username,
    role: INVESTIGATOR_ROLE,
  }));
};

export const upsertInvestigatorAccount = async (
  username: string,
  password: string,
): Promise<boolean> => {
  const normalized = normalizeUsername(username);
  if (!normalized) return false;

  const payload = {
    username: normalized,
    password_hash: encodePassword(password),
    role: INVESTIGATOR_ROLE,
  };

  const { error } = await supabase
    .from(ADMIN_TABLE)
    .upsert([payload], { onConflict: "username" });

  if (!error) return true;

  if (!canUseLocalFallback()) {
    console.error("Erro ao salvar investigador:", error);
    return false;
  }

  const local = loadLocalAccounts();
  const index = local.findIndex((item) => item.username === normalized);
  if (index >= 0) {
    local[index] = payload;
  } else {
    local.push(payload);
  }
  saveLocalAccounts(local);
  return true;
};

export const deleteInvestigatorAccount = async (username: string): Promise<boolean> => {
  const normalized = normalizeUsername(username);

  const { error } = await supabase
    .from(ADMIN_TABLE)
    .delete()
    .eq("username", normalized)
    .eq("role", INVESTIGATOR_ROLE);

  if (!error) return true;

  if (!canUseLocalFallback()) {
    console.error("Erro ao remover investigador:", error);
    return false;
  }

  const local = loadLocalAccounts().filter(
    (item) => !(item.username === normalized && item.role === INVESTIGATOR_ROLE),
  );
  saveLocalAccounts(local);
  return true;
};
