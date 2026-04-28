const RULES_ONLY_SECTORS = new Set([
  "rh",
  "comercial",
  "pcp",
  "ambulatorio",
  "facilites",
  "dt",
  "qualidade laboratorio",
]);

const normalizeSector = (value?: string | null) =>
  (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const splitLeaderSectors = (sector?: string | null) =>
  String(sector || "")
    .split(/[,;/]/)
    .map((value) => normalizeSector(value))
    .filter((value): value is string => Boolean(value));

export const isRulesOnlyLeaderSector = (sector?: string | null) => {
  const normalizedSectors = splitLeaderSectors(sector);
  if (normalizedSectors.length === 0) return false;
  if (normalizedSectors.includes("todos")) return false;
  return normalizedSectors.every((item) => RULES_ONLY_SECTORS.has(item));
};

export const getLeaderLandingRoute = (sector?: string | null) =>
  isRulesOnlyLeaderSector(sector) ? "/leader/registros" : "/leader/dashboard";

