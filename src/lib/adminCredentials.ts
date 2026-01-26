import { supabase } from "@/integrations/supabase/client";

export type AdminRole = "admin" | "seguranca";

interface AdminAccountRecord {
  username: string;
  password_hash: string;
  role: AdminRole;
}

interface AdminAccountSession {
  username: string;
  role: AdminRole;
}

const ADMIN_TABLE = "admin_users";

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

export const ensureDefaultAdminAccounts = async (): Promise<void> => {
  const { data, error } = await supabase
    .from(ADMIN_TABLE)
    .select("username");

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
): Promise<AdminAccountSession | null> => {
  const normalized = normalizeUsername(username);

  const { data, error } = await supabase
    .from(ADMIN_TABLE)
    .select("username, role, password_hash")
    .eq("username", normalized)
    .maybeSingle();

  if (error) {
    console.error("Erro ao verificar credenciais administrativas:", error);
    return null;
  }

  if (!data) return null;

  const expectedHash = encodePassword(password);
  if (data.password_hash !== expectedHash) return null;

  return {
    username: data.username,
    role: data.role as AdminRole,
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

  if (error) {
    console.error("Erro ao atualizar senha administrativa:", error);
    return false;
  }

  return Boolean(data);
};

export const resetAdminAccounts = async (): Promise<void> => {
  const { error } = await supabase
    .from(ADMIN_TABLE)
    .upsert(DEFAULT_ACCOUNTS.map(toRow), { onConflict: "username" });

  if (error) {
    console.error("Erro ao redefinir contas administrativas:", error);
  }
};

export const listAdminAccounts = async (): Promise<
  { username: string; role: AdminRole }[]
> => {
  const { data, error } = await supabase
    .from(ADMIN_TABLE)
    .select("username, role")
    .order("username");

  if (error) {
    console.error("Erro ao listar contas administrativas:", error);
    return [];
  }

  return (data || []).map((item) => ({
    username: item.username,
    role: (item.role ?? "admin") as AdminRole,
  }));
};
