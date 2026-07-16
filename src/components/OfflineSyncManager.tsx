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
  goldenRuleService,
} from "@/lib/supabase-service";

const SYNC_INTERVAL_MS = 60_000;

const isBrowserOnline = () => typeof navigator === "undefined" || navigator.onLine;

const syncOfflineQueues = async () => {
  if (!isBrowserOnline()) return;

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

    void runSync();
    window.addEventListener("online", handleOnline);
    window.addEventListener("focus", handleOnline);
    const intervalId = window.setInterval(handleOnline, SYNC_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("focus", handleOnline);
      window.clearInterval(intervalId);
    };
  }, []);

  return null;
};

export default OfflineSyncManager;
