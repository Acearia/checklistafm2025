import { useQueries } from "@tanstack/react-query";
import {
  operatorService,
  equipmentService,
  inspectionService,
  checklistService,
  sectorService,
  leaderService,
  sectorLeaderAssignmentService,
  checklistGroupService,
  goldenRuleQuestionService,
  groupQuestionService,
  groupProcedureService,
  equipmentGroupService,
} from "@/lib/supabase-service";
import { fetchWithOfflineCache, readResourceCache } from "@/lib/offlineResourceCache";

const EMPTY_DATA = [];

const STALE_TIME_MS = 1000 * 60; // 1 minute

const RESOURCE_LIST = [
  "operators",
  "equipment",
  "inspections",
  "checklistItems",
  "sectors",
  "leaders",
  "sectorLeaderAssignments",
  "groups",
  "groupQuestions",
  "groupProcedures",
  "goldenRuleQuestions",
  "equipmentGroups",
] as const;

export type SupabaseDataResource = (typeof RESOURCE_LIST)[number];

const RESOURCE_INDEX: Record<SupabaseDataResource, number> = {
  operators: 0,
  equipment: 1,
  inspections: 2,
  checklistItems: 3,
  sectors: 4,
  leaders: 5,
  sectorLeaderAssignments: 6,
  groups: 7,
  groupQuestions: 8,
  groupProcedures: 9,
  goldenRuleQuestions: 10,
  equipmentGroups: 11,
};

const normalizeResources = (resources?: readonly SupabaseDataResource[]) => {
  if (!resources || resources.length === 0) {
    return new Set<SupabaseDataResource>(RESOURCE_LIST);
  }
  return new Set<SupabaseDataResource>(resources);
};

export const useSupabaseData = (resources?: readonly SupabaseDataResource[]) => {
  const enabledResources = normalizeResources(resources);

  const queryResults = useQueries({
    queries: [
      {
        queryKey: ["operators"],
        initialData: () => enabledResources.has("operators") ? readResourceCache<any[]>("operators") ?? undefined : undefined,
        initialDataUpdatedAt: 0,
        queryFn: () => fetchWithOfflineCache("operators", () => operatorService.getAll()),
        staleTime: STALE_TIME_MS,
        enabled: enabledResources.has("operators"),
      },
      {
        queryKey: ["equipment"],
        initialData: () => enabledResources.has("equipment") ? readResourceCache<any[]>("equipment") ?? undefined : undefined,
        initialDataUpdatedAt: 0,
        queryFn: () => fetchWithOfflineCache("equipment", () => equipmentService.getAll()),
        staleTime: STALE_TIME_MS,
        enabled: enabledResources.has("equipment"),
      },
      {
        queryKey: ["inspections"],
        initialData: () => enabledResources.has("inspections") ? readResourceCache<any[]>("inspections") ?? undefined : undefined,
        initialDataUpdatedAt: 0,
        queryFn: () => fetchWithOfflineCache("inspections", () => inspectionService.getList()),
        staleTime: STALE_TIME_MS / 2,
        enabled: enabledResources.has("inspections"),
      },
      {
        queryKey: ["checklist-items"],
        initialData: () => enabledResources.has("checklistItems") ? readResourceCache<any[]>("checklist-items") ?? undefined : undefined,
        initialDataUpdatedAt: 0,
        queryFn: () => fetchWithOfflineCache("checklist-items", () => checklistService.getAll()),
        staleTime: STALE_TIME_MS * 5,
        enabled: enabledResources.has("checklistItems"),
      },
      {
        queryKey: ["sectors"],
        initialData: () => enabledResources.has("sectors") ? readResourceCache<any[]>("sectors") ?? undefined : undefined,
        initialDataUpdatedAt: 0,
        queryFn: () => fetchWithOfflineCache("sectors", () => sectorService.getAll()),
        staleTime: STALE_TIME_MS * 5,
        enabled: enabledResources.has("sectors"),
      },
      {
        queryKey: ["leaders"],
        initialData: () => enabledResources.has("leaders") ? readResourceCache<any[]>("leaders") ?? undefined : undefined,
        initialDataUpdatedAt: 0,
        queryFn: () => fetchWithOfflineCache("leaders", () => leaderService.getAll()),
        staleTime: STALE_TIME_MS,
        enabled: enabledResources.has("leaders"),
      },
      {
        queryKey: ["sector-leader-assignments"],
        initialData: () => enabledResources.has("sectorLeaderAssignments") ? readResourceCache<any[]>("sector-leader-assignments") ?? undefined : undefined,
        initialDataUpdatedAt: 0,
        queryFn: () =>
          fetchWithOfflineCache("sector-leader-assignments", () =>
            sectorLeaderAssignmentService.getAll(),
          ),
        staleTime: STALE_TIME_MS,
        enabled: enabledResources.has("sectorLeaderAssignments"),
      },
      {
        queryKey: ["checklist-groups"],
        initialData: () => enabledResources.has("groups") ? readResourceCache<any[]>("checklist-groups") ?? undefined : undefined,
        initialDataUpdatedAt: 0,
        queryFn: () => fetchWithOfflineCache("checklist-groups", () => checklistGroupService.getAll()),
        staleTime: STALE_TIME_MS * 5,
        enabled: enabledResources.has("groups"),
      },
      {
        queryKey: ["group-questions"],
        initialData: () => enabledResources.has("groupQuestions") ? readResourceCache<any[]>("group-questions") ?? undefined : undefined,
        initialDataUpdatedAt: 0,
        queryFn: () => fetchWithOfflineCache("group-questions", () => groupQuestionService.getAll()),
        staleTime: STALE_TIME_MS * 5,
        enabled: enabledResources.has("groupQuestions"),
      },
      {
        queryKey: ["group-procedures"],
        initialData: () => enabledResources.has("groupProcedures") ? readResourceCache<any[]>("group-procedures") ?? undefined : undefined,
        initialDataUpdatedAt: 0,
        queryFn: () => fetchWithOfflineCache("group-procedures", () => groupProcedureService.getAll()),
        staleTime: STALE_TIME_MS * 5,
        enabled: enabledResources.has("groupProcedures"),
      },
      {
        queryKey: ["golden-rule-questions"],
        initialData: () => enabledResources.has("goldenRuleQuestions") ? readResourceCache<any[]>("golden-rule-questions") ?? undefined : undefined,
        initialDataUpdatedAt: 0,
        queryFn: () =>
          fetchWithOfflineCache("golden-rule-questions", () =>
            goldenRuleQuestionService.safeGetAllWithFallback(),
          ),
        staleTime: STALE_TIME_MS * 5,
        enabled: enabledResources.has("goldenRuleQuestions"),
      },
      {
        queryKey: ["equipment-groups"],
        initialData: () => enabledResources.has("equipmentGroups") ? readResourceCache<any[]>("equipment-groups") ?? undefined : undefined,
        initialDataUpdatedAt: 0,
        queryFn: () => fetchWithOfflineCache("equipment-groups", () => equipmentGroupService.getAll()),
        staleTime: STALE_TIME_MS,
        enabled: enabledResources.has("equipmentGroups"),
      },
    ],
  });

  const getQueryResult = (resource: SupabaseDataResource) =>
    queryResults[RESOURCE_INDEX[resource]];

  const loading = RESOURCE_LIST.some((resource) => {
    if (!enabledResources.has(resource)) return false;
    return getQueryResult(resource).isLoading;
  });

  const errorResult = RESOURCE_LIST.map((resource) => {
    if (!enabledResources.has(resource)) return null;
    const result = getQueryResult(resource);
    return result.isError ? result : null;
  }).find(Boolean);

  const error =
    errorResult && errorResult.error instanceof Error
      ? errorResult.error.message
      : null;

  const refresh = () =>
    Promise.all(
      RESOURCE_LIST.filter((resource) => enabledResources.has(resource)).map(
        (resource) => getQueryResult(resource).refetch(),
      ),
    );

  return {
    operators: getQueryResult("operators").data ?? EMPTY_DATA,
    equipment: getQueryResult("equipment").data ?? EMPTY_DATA,
    inspections: getQueryResult("inspections").data ?? EMPTY_DATA,
    checklistItems: getQueryResult("checklistItems").data ?? EMPTY_DATA,
    sectors: getQueryResult("sectors").data ?? EMPTY_DATA,
    leaders: getQueryResult("leaders").data ?? EMPTY_DATA,
    sectorLeaderAssignments: getQueryResult("sectorLeaderAssignments").data ?? EMPTY_DATA,
    groups: getQueryResult("groups").data ?? EMPTY_DATA,
    groupQuestions: getQueryResult("groupQuestions").data ?? EMPTY_DATA,
    groupProcedures: getQueryResult("groupProcedures").data ?? EMPTY_DATA,
    goldenRuleQuestions: getQueryResult("goldenRuleQuestions").data ?? EMPTY_DATA,
    equipmentGroups: getQueryResult("equipmentGroups").data ?? EMPTY_DATA,
    loading,
    error,
    refresh,
    refreshInspections: () => getQueryResult("inspections").refetch(),
  };
};
