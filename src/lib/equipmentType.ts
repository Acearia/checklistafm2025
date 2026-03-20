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
    default:
      return "Outro";
  }
};

