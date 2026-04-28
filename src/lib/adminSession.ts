export interface AdminSessionRecord {
  username: string;
  role: string;
}

export const ADMIN_AUTH_STORAGE_KEY = "checklistafm-admin-auth";
export const ADMIN_SESSION_STORAGE_KEY = "checklistafm-admin-session";

const normalizeAdminSessionValue = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

const ROOT_ADMIN_USERNAMES = new Set(["adm", "administrador"]);

export const getStoredAdminSession = (): AdminSessionRecord | null => {
  if (typeof window === "undefined") return null;

  const rawSession = sessionStorage.getItem(ADMIN_SESSION_STORAGE_KEY);
  if (!rawSession) return null;

  try {
    const parsed = JSON.parse(rawSession);
    const username = String(parsed?.username ?? "").trim();
    const role = String(parsed?.role ?? "").trim();

    if (!username || !role) return null;

    return { username, role };
  } catch (error) {
    console.error("Erro ao ler sessao administrativa:", error);
    return null;
  }
};

export const isRootAdminUser = (session: AdminSessionRecord | null = getStoredAdminSession()) => {
  if (!session) return false;

  const username = normalizeAdminSessionValue(session.username);
  const role = normalizeAdminSessionValue(session.role);
  return ROOT_ADMIN_USERNAMES.has(username) || role === "admin" && ROOT_ADMIN_USERNAMES.has(username);
};

export const canManageGoldenRuleQuestions = (
  session: AdminSessionRecord | null = getStoredAdminSession(),
) => {
  if (!session) return false;

  return ROOT_ADMIN_USERNAMES.has(normalizeAdminSessionValue(session.username));
};

export const isCoordinatorAdminUser = (
  session: AdminSessionRecord | null = getStoredAdminSession(),
) => {
  if (!session) return false;
  return normalizeAdminSessionValue(session.role) === "coordenador";
};

export const canAccessAdminSettings = (
  session: AdminSessionRecord | null = getStoredAdminSession(),
) => {
  if (!session) return false;
  return !isCoordinatorAdminUser(session);
};

export const canDeleteAdminRecords = (
  session: AdminSessionRecord | null = getStoredAdminSession(),
) => isRootAdminUser(session) || isCoordinatorAdminUser(session);
