export const EQUIPMENT_TYPE_OPTIONS = [
  { value: "1", label: "Ponte" },
  { value: "2", label: "Talha" },
  { value: "3", label: "Pórtico" },
  { value: "5", label: "Empilhadeira" },
  { value: "6", label: "Bobcat" },
  { value: "7", label: "Transpaleteira" },
  { value: "4", label: "Outro" },
] as const;

export const getEquipmentTypeLabel = (type?: string | null, kp?: string | null): string => {
  const normalizedType = String(type ?? "").trim();
  const normalizedKp = String(kp ?? "").trim();

  if (normalizedType === "6" || normalizedKp === "1239") {
    return "Bobcat";
  }

  switch (normalizedType) {
    case "1":
      return "Ponte";
    case "2":
      return "Talha";
    case "3":
      return "Pórtico";
    case "5":
      return "Empilhadeira";
    case "6":
      return "Bobcat";
    case "7":
      return "Transpaleteira";
    default:
      return "Outro";
  }
};

export const isEquipmentTypeMatch = (
  equipment?: { type?: string | null; kp?: string | null } | null,
  equipmentType?: string | null,
): boolean => {
  if (!equipment || !equipmentType) return false;

  const targetType = String(equipmentType).trim();
  if (!targetType) return false;

  const normalizedType = String(equipment.type ?? "").trim();
  const normalizedKp = String(equipment.kp ?? "").trim();

  if (targetType === "6") {
    return normalizedType === "6" || normalizedKp === "1239";
  }

  return normalizedType === targetType;
};
