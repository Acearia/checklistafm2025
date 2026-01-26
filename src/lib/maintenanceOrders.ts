import {
  CHECKLIST_MAINTENANCE_ORDERS_KEY,
  type MaintenanceOrder,
  type MaintenanceOrderStatus,
} from "./types";

const isBrowser =
  typeof window !== "undefined" && typeof localStorage !== "undefined";

const ensureMaintenanceOrder = (order: MaintenanceOrder): MaintenanceOrder => ({
  id: order.id,
  equipmentId: order.equipmentId,
  inspectionId: order.inspectionId,
  orderNumber: order.orderNumber,
  status: order.status,
  createdAt: order.createdAt,
  updatedAt: order.updatedAt,
  closedAt: order.closedAt,
  notes: order.notes,
});

const normalizeMaintenanceOrders = (
  orders: MaintenanceOrder[]
): MaintenanceOrder[] => orders.map(ensureMaintenanceOrder);

const emitUpdateEvent = () => {
  if (!isBrowser) return;
  try {
    window.dispatchEvent(
      new CustomEvent("checklistafm-maintenance-orders-updated")
    );
  } catch (error) {
    console.warn("Não foi possível emitir evento de atualização de OS:", error);
  }
};

const saveOrders = (orders: MaintenanceOrder[]) => {
  if (!isBrowser) return;
  try {
    localStorage.setItem(
      CHECKLIST_MAINTENANCE_ORDERS_KEY,
      JSON.stringify(normalizeMaintenanceOrders(orders))
    );
    emitUpdateEvent();
  } catch (error) {
    console.error("Erro ao salvar ordens de serviço:", error);
  }
};

export const loadMaintenanceOrders = (): MaintenanceOrder[] => {
  if (!isBrowser) return [];
  try {
    const stored = localStorage.getItem(CHECKLIST_MAINTENANCE_ORDERS_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return normalizeMaintenanceOrders(parsed as MaintenanceOrder[]);
  } catch (error) {
    console.error("Erro ao carregar ordens de serviço:", error);
    return [];
  }
};

const generateOrderId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `maintenance-${Date.now()}`;
};

interface UpsertOrderInput {
  id?: string | null;
  inspectionId: string;
  equipmentId: string;
  orderNumber: string;
  status: MaintenanceOrderStatus;
  notes?: string;
}

export const upsertMaintenanceOrder = (
  input: UpsertOrderInput
): { order: MaintenanceOrder; orders: MaintenanceOrder[] } => {
  const orders = loadMaintenanceOrders();
  const now = new Date().toISOString();

  const existingIndex = input.id
    ? orders.findIndex((order) => order.id === input.id)
    : orders.findIndex((order) => order.inspectionId === input.inspectionId);

  let savedOrder: MaintenanceOrder;

  if (existingIndex >= 0) {
    const previous = orders[existingIndex];
    savedOrder = {
      ...previous,
      orderNumber: input.orderNumber,
      status: input.status,
      notes: input.notes,
      updatedAt: now,
      closedAt:
        input.status === "closed" || input.status === "cancelled"
          ? now
          : undefined,
    };
    orders[existingIndex] = savedOrder;
  } else {
    savedOrder = {
      id: input.id ?? generateOrderId(),
      inspectionId: input.inspectionId,
      equipmentId: input.equipmentId,
      orderNumber: input.orderNumber,
      status: input.status,
      notes: input.notes,
      createdAt: now,
      updatedAt: now,
      closedAt:
        input.status === "closed" || input.status === "cancelled"
          ? now
          : undefined,
    };
    orders.unshift(savedOrder);
  }

  saveOrders(orders);
  return { order: savedOrder, orders };
};

export const getMaintenanceOrderByInspection = (
  inspectionId: string
): MaintenanceOrder | undefined => {
  const orders = loadMaintenanceOrders();
  return orders.find((order) => order.inspectionId === inspectionId);
};

export const getMaintenanceOrdersByEquipment = (
  equipmentId: string
): MaintenanceOrder[] => {
  const orders = loadMaintenanceOrders();
  return orders
    .filter((order) => order.equipmentId === equipmentId)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
};

const filterAndPersistOrders = (
  predicate: (order: MaintenanceOrder) => boolean
): MaintenanceOrder[] => {
  const orders = loadMaintenanceOrders();
  const filtered = orders.filter(predicate);

  if (filtered.length !== orders.length) {
    saveOrders(filtered);
  }

  return filtered;
};

export const deleteMaintenanceOrder = (
  orderId: string
): MaintenanceOrder[] => {
  return filterAndPersistOrders((order) => order.id !== orderId);
};

export const deleteMaintenanceOrdersByInspection = (
  inspectionId: string
): MaintenanceOrder[] => {
  return filterAndPersistOrders(
    (order) => order.inspectionId !== inspectionId
  );
};

export const deleteMaintenanceOrdersByEquipment = (
  equipmentId: string
): MaintenanceOrder[] => {
  return filterAndPersistOrders((order) => order.equipmentId !== equipmentId);
};
