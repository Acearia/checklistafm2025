import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface InspectionBoardEquipmentSource {
  id?: string | null;
  name?: string | null;
  kp?: string | null;
  bridgeNumber?: string | null;
  sector?: string | null;
}

export interface InspectionBoardInspectionEntry<TInspection> {
  id: string;
  label: string;
  isToday: boolean;
  hasProblems: boolean;
  hasOpenOrder: boolean;
  inspection: TInspection;
}

export interface InspectionBoardEquipmentEntry<TInspection> {
  id: string;
  name: string;
  kp: string;
  inspections: InspectionBoardInspectionEntry<TInspection>[];
}

export interface InspectionBoardSectorEntry<TInspection> {
  sector: string;
  equipments: InspectionBoardEquipmentEntry<TInspection>[];
}

export interface InspectionBoardStats {
  sectorCount: number;
  equipmentCount: number;
  inspectionsToday: number;
  inspectionsWithProblemsToday: number;
}

export interface BuildInspectionBoardParams<TInspection> {
  equipments: InspectionBoardEquipmentSource[];
  inspections: TInspection[];
  maxInspectionsPerEquipment?: number;
  getInspectionEquipmentId: (
    inspection: TInspection,
    index: number,
  ) => string | null | undefined;
  getInspectionEquipmentMeta?: (
    inspection: TInspection,
  ) => InspectionBoardEquipmentSource | null | undefined;
  getInspectionDate: (
    inspection: TInspection,
  ) => string | Date | null | undefined;
  getInspectionHasProblems: (inspection: TInspection) => boolean;
  getInspectionHasOpenOrder: (inspection: TInspection) => boolean;
}

const DEFAULT_MAX_INSPECTIONS = 12;

const normalizeText = (value: string | null | undefined, fallback: string) => {
  const trimmed = String(value ?? "").trim();
  return trimmed.length > 0 ? trimmed : fallback;
};

const parseDate = (value: string | Date | null | undefined): Date | null => {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isSameCalendarDay = (date: Date, reference: Date) =>
  date.getDate() === reference.getDate() &&
  date.getMonth() === reference.getMonth() &&
  date.getFullYear() === reference.getFullYear();

export const buildInspectionBoard = <TInspection>({
  equipments,
  inspections,
  maxInspectionsPerEquipment = DEFAULT_MAX_INSPECTIONS,
  getInspectionEquipmentId,
  getInspectionEquipmentMeta,
  getInspectionDate,
  getInspectionHasProblems,
  getInspectionHasOpenOrder,
}: BuildInspectionBoardParams<TInspection>): InspectionBoardSectorEntry<TInspection>[] => {
  const sectorMap = new Map<
    string,
    Map<string, InspectionBoardEquipmentEntry<TInspection>>
  >();
  const equipmentById = new Map<string, InspectionBoardEquipmentSource>();
  const today = new Date();

  const ensureEquipmentEntry = (
    sectorName: string,
    equipmentId: string,
    equipmentName: string,
    equipmentKp: string,
  ) => {
    let sectorEquipments = sectorMap.get(sectorName);
    if (!sectorEquipments) {
      sectorEquipments = new Map<string, InspectionBoardEquipmentEntry<TInspection>>();
      sectorMap.set(sectorName, sectorEquipments);
    }

    let equipmentEntry = sectorEquipments.get(equipmentId);
    if (!equipmentEntry) {
      equipmentEntry = {
        id: equipmentId,
        name: equipmentName,
        kp: equipmentKp,
        inspections: [],
      };
      sectorEquipments.set(equipmentId, equipmentEntry);
    }

    return equipmentEntry;
  };

  equipments.forEach((equipment) => {
    const equipmentId = normalizeText(equipment.id, "");
    if (!equipmentId) return;

    equipmentById.set(equipmentId, equipment);

    ensureEquipmentEntry(
      normalizeText(equipment.sector, "Sem setor"),
      equipmentId,
      normalizeText(equipment.name, equipmentId),
      normalizeText(equipment.kp ?? equipment.bridgeNumber, "-"),
    );
  });

  inspections.forEach((inspection, index) => {
    const rawEquipmentId = getInspectionEquipmentId(inspection, index);
    const equipmentId = normalizeText(rawEquipmentId, `equip-${index + 1}`);
    const inspectionEquipmentMeta = getInspectionEquipmentMeta?.(inspection) ?? undefined;
    const equipmentFromCatalog = equipmentById.get(equipmentId);

    const sectorName = normalizeText(
      inspectionEquipmentMeta?.sector ?? equipmentFromCatalog?.sector,
      "Sem setor",
    );
    const equipmentName = normalizeText(
      inspectionEquipmentMeta?.name ?? equipmentFromCatalog?.name,
      equipmentId,
    );
    const equipmentKp = normalizeText(
      inspectionEquipmentMeta?.kp ??
        inspectionEquipmentMeta?.bridgeNumber ??
        equipmentFromCatalog?.kp ??
        equipmentFromCatalog?.bridgeNumber,
      "-",
    );

    const equipmentEntry = ensureEquipmentEntry(
      sectorName,
      equipmentId,
      equipmentName,
      equipmentKp,
    );

    const inspectionDate = parseDate(getInspectionDate(inspection));
    const label = inspectionDate
      ? format(inspectionDate, "dd/MM/yyyy HH:mm", { locale: ptBR })
      : "Sem data";

    equipmentEntry.inspections.push({
      id: `${equipmentId}-${index}-${label}`,
      label,
      isToday: inspectionDate ? isSameCalendarDay(inspectionDate, today) : false,
      hasProblems: getInspectionHasProblems(inspection),
      hasOpenOrder: getInspectionHasOpenOrder(inspection),
      inspection,
    });
  });

  return Array.from(sectorMap.entries())
    .map(([sector, equipmentMap]) => ({
      sector,
      equipments: Array.from(equipmentMap.values())
        .map((equipmentEntry) => ({
          ...equipmentEntry,
          inspections: equipmentEntry.inspections
            .sort((a, b) => {
              const dateA = parseDate(getInspectionDate(a.inspection));
              const dateB = parseDate(getInspectionDate(b.inspection));
              return (dateB?.getTime() ?? 0) - (dateA?.getTime() ?? 0);
            })
            .slice(0, maxInspectionsPerEquipment),
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    }))
    .sort((a, b) => a.sector.localeCompare(b.sector, "pt-BR"));
};

export const calculateInspectionBoardStats = <TInspection>(
  boardBySector: InspectionBoardSectorEntry<TInspection>[],
): InspectionBoardStats => {
  let equipmentCount = 0;
  let inspectionsToday = 0;
  let inspectionsWithProblemsToday = 0;

  boardBySector.forEach((sector) => {
    sector.equipments.forEach((equipmentEntry) => {
      equipmentCount += 1;
      equipmentEntry.inspections.forEach((inspectionEntry) => {
        if (!inspectionEntry.isToday) return;
        inspectionsToday += 1;
        if (inspectionEntry.hasProblems) {
          inspectionsWithProblemsToday += 1;
        }
      });
    });
  });

  return {
    sectorCount: boardBySector.length,
    equipmentCount,
    inspectionsToday,
    inspectionsWithProblemsToday,
  };
};
