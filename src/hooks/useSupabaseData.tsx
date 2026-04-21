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
  groupQuestionService,
  groupProcedureService,
  equipmentGroupService,
} from "@/lib/supabase-service";

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
  equipmentGroups: 10,
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
        queryFn: () => operatorService.getAll(),
        staleTime: STALE_TIME_MS,
        enabled: enabledResources.has("operators"),
      },
      {
        queryKey: ["equipment"],
        queryFn: () => equipmentService.getAll(),
        staleTime: STALE_TIME_MS,
        enabled: enabledResources.has("equipment"),
      },
      {
        queryKey: ["inspections"],
        queryFn: () => inspectionService.getAll(),
        staleTime: STALE_TIME_MS / 2,
        enabled: enabledResources.has("inspections"),
      },
      {
        queryKey: ["checklist-items"],
        queryFn: () => checklistService.getAll(),
        staleTime: STALE_TIME_MS * 5,
        enabled: enabledResources.has("checklistItems"),
      },
      {
        queryKey: ["sectors"],
        queryFn: () => sectorService.getAll(),
        staleTime: STALE_TIME_MS * 5,
        enabled: enabledResources.has("sectors"),
      },
      {
        queryKey: ["leaders"],
        queryFn: () => leaderService.getAll(),
        staleTime: STALE_TIME_MS,
        enabled: enabledResources.has("leaders"),
      },
      {
        queryKey: ["sector-leader-assignments"],
        queryFn: () => sectorLeaderAssignmentService.getAll(),
        staleTime: STALE_TIME_MS,
        enabled: enabledResources.has("sectorLeaderAssignments"),
      },
      {
        queryKey: ["checklist-groups"],
        queryFn: () => checklistGroupService.getAll(),
        staleTime: STALE_TIME_MS * 5,
        enabled: enabledResources.has("groups"),
      },
      {
        queryKey: ["group-questions"],
        queryFn: () => groupQuestionService.getAll(),
        staleTime: STALE_TIME_MS * 5,
        enabled: enabledResources.has("groupQuestions"),
      },
      {
        queryKey: ["group-procedures"],
        queryFn: () => groupProcedureService.getAll(),
        staleTime: STALE_TIME_MS * 5,
        enabled: enabledResources.has("groupProcedures"),
      },
      {
        queryKey: ["equipment-groups"],
        queryFn: () => equipmentGroupService.getAll(),
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
    operators: getQueryResult("operators").data ?? [],
    equipment: getQueryResult("equipment").data ?? [],
    inspections: getQueryResult("inspections").data ?? [],
    checklistItems: getQueryResult("checklistItems").data ?? [],
    sectors: getQueryResult("sectors").data ?? [],
    leaders: getQueryResult("leaders").data ?? [],
    sectorLeaderAssignments: getQueryResult("sectorLeaderAssignments").data ?? [],
    groups: getQueryResult("groups").data ?? [],
    groupQuestions: getQueryResult("groupQuestions").data ?? [],
    groupProcedures: getQueryResult("groupProcedures").data ?? [],
    equipmentGroups: getQueryResult("equipmentGroups").data ?? [],
    loading,
    error,
    refresh,
  };
};
