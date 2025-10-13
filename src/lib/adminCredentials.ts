const STORAGE_KEY = "checklistafm-admin-users";

export type AdminRole = "admin" | "seguranca";

export interface AdminAccount {
  username: string;
  password: string;
  role: AdminRole;
}

const DEFAULT_ACCOUNTS: AdminAccount[] = [
  {
    username: "admin",
    password: encodePassword("admin123"),
    role: "admin",
  },
  {
    username: "seguranca",
    password: encodePassword("seguranca123"),
    role: "seguranca",
  },
];

function encodePassword(value: string): string {
  if (typeof window !== "undefined" && typeof window.btoa === "function") {
    return window.btoa(value);
  }
  if (typeof Buffer !== "undefined") {
    return Buffer.from(value, "utf-8").toString("base64");
  }
  return value;
}

function decodeAccounts(raw: unknown): AdminAccount[] | null {
  if (!Array.isArray(raw)) return null;
  const accounts: AdminAccount[] = [];
  for (const item of raw) {
    if (
      item &&
      typeof item === "object" &&
      typeof (item as any).username === "string" &&
      typeof (item as any).password === "string" &&
      (item as any).role &&
      ["admin", "seguranca"].includes((item as any).role)
    ) {
      accounts.push({
        username: (item as any).username,
        password: (item as any).password,
        role: (item as any).role,
      });
    }
  }
  return accounts;
}

export const getStoredAdminAccounts = (): AdminAccount[] => {
  if (typeof window === "undefined") {
    return DEFAULT_ACCOUNTS.map((acc) => ({ ...acc }));
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return DEFAULT_ACCOUNTS.map((acc) => ({ ...acc }));
    }
    const parsed = JSON.parse(stored);
    const accounts = decodeAccounts(parsed);
    if (!accounts || accounts.length === 0) {
      return DEFAULT_ACCOUNTS.map((acc) => ({ ...acc }));
    }
    return accounts;
  } catch (error) {
    console.error("Failed to parse admin accounts:", error);
    return DEFAULT_ACCOUNTS.map((acc) => ({ ...acc }));
  }
};

function saveAdminAccounts(accounts: AdminAccount[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
}

export const ensureDefaultAdminAccounts = () => {
  if (typeof window === "undefined") return;
  const accounts = getStoredAdminAccounts();
  let changed = false;

  DEFAULT_ACCOUNTS.forEach((defaultAccount) => {
    const exists = accounts.some(
      (acc) =>
        acc.username.toLowerCase() === defaultAccount.username.toLowerCase(),
    );
    if (!exists) {
      accounts.push({ ...defaultAccount });
      changed = true;
    }
  });

  if (changed) {
    saveAdminAccounts(accounts);
  }
};

export const verifyAdminCredentials = (
  username: string,
  password: string,
): { username: string; role: AdminRole } | null => {
  ensureDefaultAdminAccounts();
  const accounts = getStoredAdminAccounts();
  const normalized = username.trim().toLowerCase();
  const account = accounts.find(
    (acc) => acc.username.toLowerCase() === normalized,
  );
  if (!account) return null;
  if (encodePassword(password) !== account.password) return null;
  return {
    username: account.username,
    role: account.role,
  };
};

export const updateAdminPassword = (
  username: string,
  newPassword: string,
) => {
  ensureDefaultAdminAccounts();
  const accounts = getStoredAdminAccounts();
  const normalized = username.trim().toLowerCase();
  const accountIndex = accounts.findIndex(
    (acc) => acc.username.toLowerCase() === normalized,
  );
  if (accountIndex === -1) return false;
  accounts[accountIndex] = {
    ...accounts[accountIndex],
    password: encodePassword(newPassword),
  };
  saveAdminAccounts(accounts);
  return true;
};

export const resetAdminAccounts = () => {
  if (typeof window === "undefined") return;
  saveAdminAccounts(DEFAULT_ACCOUNTS.map((acc) => ({ ...acc })));
};
