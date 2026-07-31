const SENSITIVE_KEY_PATTERN = /(password|senha|token|secret|service[_-]?role|authorization|apikey|api[_-]?key|jwt)/i;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const SUPABASE_SECRET_PATTERN = /\bsb_secret_[A-Za-z0-9_-]+\b/g;

const redactString = (value: string) =>
  value
    .replace(JWT_PATTERN, "[jwt-redacted]")
    .replace(SUPABASE_SECRET_PATTERN, "[secret-redacted]");

const redactValue = (value: unknown): unknown => {
  if (typeof value === "string") {
    return redactString(value);
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message),
    };
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(redactValue);
  }

  const safe: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    safe[key] = SENSITIVE_KEY_PATTERN.test(key) ? "[redacted]" : redactValue(item);
  }
  return safe;
};

export const installProductionConsoleGuard = () => {
  if (!import.meta.env.PROD || typeof window === "undefined") {
    return;
  }

  const originalWarn = console.warn.bind(console);
  const originalError = console.error.bind(console);
  const quiet = () => undefined;

  console.log = quiet;
  console.debug = quiet;
  console.info = quiet;
  console.warn = (...args: unknown[]) => originalWarn(...args.map(redactValue));
  console.error = (...args: unknown[]) => originalError(...args.map(redactValue));
};
