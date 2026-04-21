const HASH_PREFIX = "sha256:";

const toHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

export const hashPassword = async (password: string): Promise<string> => {
  const normalized = String(password || "").trim();
  if (!normalized) {
    throw new Error("Invalid password");
  }

  const encoded = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return `${HASH_PREFIX}${toHex(digest)}`;
};

export const isHashedPassword = (value: string) =>
  typeof value === "string" && value.startsWith(HASH_PREFIX);

export const parseStoredPassword = (value?: string | null) => {
  const raw = (value || "").trim();
  const [base, flag] = raw.split("|");
  const requiresReset = (flag || "").toUpperCase() === "RESET";
  return {
    raw:
      base && base.length > 0
        ? base
        : "",
    requiresReset,
    isHashed: isHashedPassword(base || ""),
    isLegacyPlain: Boolean(base && !isHashedPassword(base)),
  };
};

export const verifyPassword = async (
  stored: string | null | undefined,
  candidate: string,
): Promise<{ valid: boolean; isLegacyPlain: boolean; requiresReset: boolean }> => {
  const { raw, requiresReset, isHashed, isLegacyPlain } = parseStoredPassword(stored);

  if (!raw) return { valid: false, isLegacyPlain: false, requiresReset };

  if (isHashed) {
    try {
      const candidateHash = await hashPassword(candidate);
      return {
        valid: candidateHash === raw,
        isLegacyPlain: false,
        requiresReset,
      };
    } catch {
      return { valid: false, isLegacyPlain: false, requiresReset };
    }
  }

  // Legacy plain text password fallback
  return {
    valid: raw === String(candidate || "").trim(),
    isLegacyPlain: true,
    requiresReset,
  };
};

export const buildStoredPassword = async (
  plainPassword: string,
  reset = false,
): Promise<string> => {
  const hashed = await hashPassword(plainPassword);
  return reset ? `${hashed}|RESET` : hashed;
};
