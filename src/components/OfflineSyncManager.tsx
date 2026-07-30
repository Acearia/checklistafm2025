import { useEffect, useRef } from "react";
import {
  ENVIRONMENTAL_INSPECTION_STORAGE_EVENT,
  readLocalEnvironmentalInspections,
  removeLocalEnvironmentalInspections,
} from "@/lib/environmentalInspectionOffline";
import {
  GOLDEN_RULE_STORAGE_EVENT,
  getPendingLocalGoldenRules,
  removeLocalGoldenRules,
  toGoldenRulePayload,
} from "@/lib/goldenRuleOffline";
import {
  environmentalInspectionService,
  accidentActionPlanService,
  accidentInvestigationService,
  equipmentService,
  goldenRuleService,
  inspectionService,
  operatorService,
} from "@/lib/supabase-service";
import {
  INSPECTION_OFFLINE_STORAGE_EVENT,
  getPendingLocalInspections,
  removeLocalInspections,
  toInspectionPayload,
} from "@/lib/inspectionOffline";
import {
  ACTION_PLAN_STORAGE_EVENT,
  getPendingLocalActionPlans,
  markLocalActionPlansSynced,
} from "@/lib/actionPlanOffline";
import {
  ACCIDENT_INVESTIGATION_STORAGE_EVENT,
  getPendingLocalAccidentInvestigations,
  markLocalAccidentInvestigationsSynced,
} from "@/lib/accidentInvestigationOffline";
import { isDeviceOnline } from "@/lib/connectivity";

const SYNC_INTERVAL_MS = 15_000;
const RETRY_DELAYS_MS = [0, 2_000, 8_000];

const QUEUE_EVENTS = [
  INSPECTION_OFFLINE_STORAGE_EVENT,
  ENVIRONMENTAL_INSPECTION_STORAGE_EVENT,
  GOLDEN_RULE_STORAGE_EVENT,
  ACTION_PLAN_STORAGE_EVENT,
  ACCIDENT_INVESTIGATION_STORAGE_EVENT,
];

const syncChecklistQueue = async () => {
  const checklistRecords = getPendingLocalInspections();
  if (checklistRecords.length === 0) return;

  const needsLookup = checklistRecords.some((record) => !record.payload);
  const [operators, equipment] = needsLookup
    ? await Promise.all([operatorService.getAll(), equipmentService.getAll()])
    : [[], []];

  const syncedIds: string[] = [];

  for (const record of checklistRecords) {
    const payload = toInspectionPayload(record, operators, equipment);
    if (!payload) continue;

    try {
      if (payload.id) {
        const existing = await inspectionService.getById(payload.id).catch(() => null);
        if (existing) {
          syncedIds.push(record.id);
          continue;
        }
      }

      await inspectionService.create(payload);
      syncedIds.push(record.id);
    } catch (error) {
      console.warn("[OfflineSyncManager] Falha ao sincronizar checklist local:", error);
    }
  }

  removeLocalInspections(syncedIds);
};

const syncEnvironmentalQueue = async () => {
  const environmentalRecords = readLocalEnvironmentalInspections();
  if (environmentalRecords.length === 0) return;

  const result = await environmentalInspectionService.syncLocalRecords(environmentalRecords);
  removeLocalEnvironmentalInspections(result.syncedIds);
};

const syncGoldenRuleQueue = async () => {
  const goldenRuleRecords = getPendingLocalGoldenRules();
  if (goldenRuleRecords.length === 0) return;

  const result = await goldenRuleService.syncLocalRecords(
    goldenRuleRecords.map(toGoldenRulePayload),
  );
  removeLocalGoldenRules(result.syncedIds);
};

const syncActionPlanQueue = async () => {
  const actionPlans = getPendingLocalActionPlans();
  if (actionPlans.length === 0) return;

  const syncedIds: string[] = [];
  for (const plan of actionPlans) {
    try {
      await accidentActionPlanService.upsertFromLegacy(plan);
      syncedIds.push(plan.id);
    } catch (error) {
      console.warn("[OfflineSyncManager] Falha ao sincronizar plano de acao:", error);
    }
  }
  markLocalActionPlansSynced(syncedIds);
};

const syncAccidentInvestigationQueue = async () => {
  const investigations = getPendingLocalAccidentInvestigations();
  if (investigations.length === 0) return;

  const result = await accidentInvestigationService.syncLocalRecords(investigations);
  markLocalAccidentInvestigationsSynced(result.syncedIds);
};

const syncOfflineQueues = async () => {
  if (!(await isDeviceOnline())) return;

  const queues = [
    ["checklist", syncChecklistQueue],
    ["ambiental", syncEnvironmentalQueue],
    ["regra de ouro", syncGoldenRuleQueue],
    ["plano de acao", syncActionPlanQueue],
    ["investigacao", syncAccidentInvestigationQueue],
  ] as const;

  for (const [queueName, syncQueue] of queues) {
    try {
      await syncQueue();
    } catch (error) {
      console.warn(`[OfflineSyncManager] Falha ao processar fila ${queueName}:`, error);
    }
  }
};

const OfflineSyncManager = () => {
  const isSyncingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const runSync = async () => {
      if (cancelled || isSyncingRef.current) return;
      isSyncingRef.current = true;

      try {
        await syncOfflineQueues();
      } catch (error) {
        console.warn("[OfflineSyncManager] Falha ao sincronizar filas locais:", error);
      } finally {
        isSyncingRef.current = false;
      }
    };

    const scheduleSync = (delayMs = 0) => {
      window.setTimeout(() => {
        void runSync();
      }, delayMs);
    };

    const handleOnline = () => {
      RETRY_DELAYS_MS.forEach(scheduleSync);
    };

    const handleQueueUpdated = () => {
      scheduleSync(500);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        handleOnline();
      }
    };

    handleOnline();
    window.addEventListener("online", handleOnline);
    window.addEventListener("focus", handleOnline);
    window.addEventListener("pageshow", handleOnline);
    QUEUE_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, handleQueueUpdated);
    });
    document.addEventListener("visibilitychange", handleVisibilityChange);
    const intervalId = window.setInterval(handleOnline, SYNC_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("focus", handleOnline);
      window.removeEventListener("pageshow", handleOnline);
      QUEUE_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, handleQueueUpdated);
      });
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.clearInterval(intervalId);
    };
  }, []);

  return null;
};

export default OfflineSyncManager;
