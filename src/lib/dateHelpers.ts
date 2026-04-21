const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const parseLocalDateValue = (value: string | Date | null | undefined): Date | null => {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  }

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (DATE_ONLY_PATTERN.test(trimmed)) {
    const [year, month, day] = trimmed.split("-").map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const getLocalDateKey = (value: string | Date | null | undefined): string | null => {
  const parsed = parseLocalDateValue(value);
  if (!parsed) return null;

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

export const getTodayLocalDateKey = () => getLocalDateKey(new Date());
