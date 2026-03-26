export const FIXED_FORM_SECTORS = [
  "FECHAMENTO",
  "SUCUTA",
  "VAZAMENTO",
  "FORNO",
  "MACHARIA",
  "MOLDAGEM COLDBOX",
  "LINHA MOLDAGEM",
  "ACABAMENTO",
  "SOLDA",
  "TRATAMENTO T\u00c9RMICO",
  "CQF",
  "MODELARIA",
  "USINAGEM",
  "MEC\u00c2NICA",
  "EXPEDI\u00c7\u00c3O",
  "MONTAGEM",
  "ALMOXARIFADO",
  "CQD",
] as const;

const normalizeSectorKey = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

const FIXED_SECTOR_MAP = new Map(
  FIXED_FORM_SECTORS.map((sector) => [normalizeSectorKey(sector), sector]),
);

const LEGACY_SECTOR_ALIASES: Record<string, (typeof FIXED_FORM_SECTORS)[number]> = {
  FECHAMENTO: "FECHAMENTO",
  SUCATA: "SUCUTA",
  SUCUTA: "SUCUTA",
  VAZAMENTO: "VAZAMENTO",
  FORNO: "FORNO",
  MACHARIA: "MACHARIA",
  "MOLDAGEM COLDBOX": "MOLDAGEM COLDBOX",
  "LINHA MOLDAGEM": "LINHA MOLDAGEM",
  "LINHA DE MOLDAGEM E FECHAMENTO": "LINHA MOLDAGEM",
  ACABAMENTO: "ACABAMENTO",
  "ACABAMENTO DE PE\u00c7AS": "ACABAMENTO",
  "ACABAMENTO DE PECAS": "ACABAMENTO",
  SOLDA: "SOLDA",
  "TRATAMENTO TERMICO": "TRATAMENTO T\u00c9RMICO",
  "TRATAMENTO T\u00c9RMICO": "TRATAMENTO T\u00c9RMICO",
  CQF: "CQF",
  MODELARIA: "MODELARIA",
  "MODELA\u00c7\u00c3O": "MODELARIA",
  MODELACAO: "MODELARIA",
  USINAGEM: "USINAGEM",
  MECANICA: "MEC\u00c2NICA",
  "MEC\u00c2NICA": "MEC\u00c2NICA",
  EXPEDICAO: "EXPEDI\u00c7\u00c3O",
  "EXPEDI\u00c7\u00c3O": "EXPEDI\u00c7\u00c3O",
  EXPEDIO: "EXPEDI\u00c7\u00c3O",
  MONTAGEM: "MONTAGEM",
  ALMOXARIFADO: "ALMOXARIFADO",
  CQD: "CQD",
  FUSAO: "FORNO",
  "FUS\u00c3O": "FORNO",
  MOLDAGEM: "MOLDAGEM COLDBOX",
};

export const resolveFixedSectorName = (value: unknown) => {
  const rawValue = value == null ? "" : String(value).trim();
  if (!rawValue) return "";

  const normalizedKey = normalizeSectorKey(rawValue);
  const directMatch = FIXED_SECTOR_MAP.get(normalizedKey);
  if (directMatch) return directMatch;

  const aliasedMatch = LEGACY_SECTOR_ALIASES[normalizedKey];
  if (aliasedMatch) return aliasedMatch;

  return rawValue;
};
