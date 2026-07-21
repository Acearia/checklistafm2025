import { useEffect, useRef } from "react";
import {
  readLocalEnvironmentalInspections,
  removeLocalEnvironmentalInspections,
} from "@/lib/environmentalInspectionOffline";
import {
  getPendingLocalGoldenRules,
  removeLocalGoldenRules,
  toGoldenRulePayload,
} from "@/lib/goldenRuleOffline";
import {
  environmentalInspectionService,
  equipmentService,
  goldenRuleService,
  inspectionService,
  operatorService,
} from "@/lib/supabase-service";
import {
  getPendingLocalInspections,
  removeLocalInspections,
  toInspectionPayload,
} from "@/lib/inspectionOffline";

const SYNC_INTERVAL_MS = 30_000;

const isBrowserOnline = () => typeof navigator === "undefined" || navigator.onLine;

const syncOfflineQueues = async () => {
  if (!isBrowserOnline()) return;

  const checklistRecords = getPendingLocalInspections();
  if (checklistRecords.length > 0) {
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
  }

  const environmentalRecords = readLocalEnvironmentalInspections();
  if (environmentalRecords.length > 0) {
    const result = await environmentalInspectionService.syncLocalRecords(environmentalRecords);
    removeLocalEnvironmentalInspections(result.syncedIds);
  }

  const goldenRuleRecords = getPendingLocalGoldenRules();
  if (goldenRuleRecords.length > 0) {
    const result = await goldenRuleService.syncLocalRecords(
      goldenRuleRecords.map(toGoldenRulePayload),
    );
    removeLocalGoldenRules(result.syncedIds);
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

    const handleOnline = () => {
      void runSync();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void runSync();
      }
    };

    void runSync();
    window.addEventListener("online", handleOnline);
    window.addEventListener("focus", handleOnline);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    const intervalId = window.setInterval(handleOnline, SYNC_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("focus", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.clearInterval(intervalId);
    };
  }, []);

  return null;
};

export default OfflineSyncManager;
