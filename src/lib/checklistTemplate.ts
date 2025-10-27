import { checklistItems as defaultChecklistItems, type ChecklistItem } from "./data";
import { 
  CHECKLIST_TEMPLATE_KEY, 
  CHECKLIST_ALERTS_KEY, 
  type ChecklistAlert 
} from "./types";

const isBrowser = typeof window !== "undefined" && typeof localStorage !== "undefined";

const ensureBoolean = (value: unknown): boolean => value === true;

const sanitizeChecklistItems = (items: ChecklistItem[]): ChecklistItem[] => {
  return items.map((item) => ({
    id: item.id,
    question: item.question,
    answer: item.answer ?? null,
    alertOnYes: ensureBoolean(item.alertOnYes),
    alertOnNo: ensureBoolean(item.alertOnNo),
  }));
};

export const loadChecklistTemplate = (): ChecklistItem[] => {
  if (!isBrowser) {
    return sanitizeChecklistItems(defaultChecklistItems);
  }

  try {
    const stored = localStorage.getItem(CHECKLIST_TEMPLATE_KEY);
    if (!stored) {
      return sanitizeChecklistItems(defaultChecklistItems);
    }

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      return sanitizeChecklistItems(defaultChecklistItems);
    }

    return sanitizeChecklistItems(parsed as ChecklistItem[]);
  } catch (error) {
    console.error("Erro ao carregar checklist template:", error);
    return sanitizeChecklistItems(defaultChecklistItems);
  }
};

export const saveChecklistTemplate = (items: ChecklistItem[]) => {
  if (!isBrowser) return;
  try {
    localStorage.setItem(
      CHECKLIST_TEMPLATE_KEY, 
      JSON.stringify(sanitizeChecklistItems(items))
    );
  } catch (error) {
    console.error("Erro ao salvar checklist template:", error);
  }
};

export const resetChecklistTemplate = () => {
  if (!isBrowser) return;
  saveChecklistTemplate(defaultChecklistItems);
};

const normalizeAlerts = (alerts: ChecklistAlert[]): ChecklistAlert[] => {
  return alerts.map((alert) => ({
    ...alert,
    seenByAdmin: alert.seenByAdmin ?? false,
    seenByLeaders: alert.seenByLeaders ?? [],
  }));
};

export const loadChecklistAlerts = (): ChecklistAlert[] => {
  if (!isBrowser) return [];

  try {
    const stored = localStorage.getItem(CHECKLIST_ALERTS_KEY);
    if (!stored) return [];

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];

    return normalizeAlerts(parsed as ChecklistAlert[]);
  } catch (error) {
    console.error("Erro ao carregar alertas do checklist:", error);
    return [];
  }
};

export const saveChecklistAlerts = (alerts: ChecklistAlert[]) => {
  if (!isBrowser) return;
  try {
    localStorage.setItem(
      CHECKLIST_ALERTS_KEY, 
      JSON.stringify(normalizeAlerts(alerts))
    );
  } catch (error) {
    console.error("Erro ao salvar alertas do checklist:", error);
  }
};

export const appendChecklistAlert = (alert: ChecklistAlert) => {
  if (!isBrowser) return;
  const alerts = loadChecklistAlerts();
  alerts.unshift(alert);
  saveChecklistAlerts(alerts);
};

export const markAlertSeenByAdmin = (alertId: string) => {
  if (!isBrowser) return;
  const alerts = loadChecklistAlerts();
  const updated = alerts.map((alert) =>
    alert.id === alertId ? { ...alert, seenByAdmin: true } : alert
  );
  saveChecklistAlerts(updated);
};

export const markAlertSeenByLeader = (alertId: string, leaderId: string) => {
  if (!isBrowser) return;
  const alerts = loadChecklistAlerts();
  const updated = alerts.map((alert) => {
    if (alert.id !== alertId) return alert;
    const seenByLeaders = new Set(alert.seenByLeaders || []);
    seenByLeaders.add(leaderId);
    return { ...alert, seenByLeaders: Array.from(seenByLeaders) };
  });
  saveChecklistAlerts(updated);
};
