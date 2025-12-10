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

export const useSupabaseData = () => {
  const queryResults = useQueries({
    queries: [
      {
        queryKey: ["operators"],
        queryFn: () => operatorService.getAll(),
        staleTime: STALE_TIME_MS,
      },
      {
        queryKey: ["equipment"],
        queryFn: () => equipmentService.getAll(),
        staleTime: STALE_TIME_MS,
      },
      {
        queryKey: ["inspections"],
        queryFn: () => inspectionService.getAll(),
        staleTime: STALE_TIME_MS / 2,
      },
      {
        queryKey: ["checklist-items"],
        queryFn: () => checklistService.getAll(),
        staleTime: STALE_TIME_MS * 5,
      },
      {
        queryKey: ["sectors"],
        queryFn: () => sectorService.getAll(),
        staleTime: STALE_TIME_MS * 5,
      },
      {
        queryKey: ["leaders"],
        queryFn: () => leaderService.getAll(),
        staleTime: STALE_TIME_MS,
      },
      {
        queryKey: ["sector-leader-assignments"],
        queryFn: () => sectorLeaderAssignmentService.getAll(),
        staleTime: STALE_TIME_MS,
      },
      {
        queryKey: ["checklist-groups"],
        queryFn: () => checklistGroupService.getAll(),
        staleTime: STALE_TIME_MS * 5,
      },
      {
        queryKey: ["group-questions"],
        queryFn: () => groupQuestionService.getAll(),
        staleTime: STALE_TIME_MS * 5,
      },
      {
        queryKey: ["group-procedures"],
        queryFn: () => groupProcedureService.getAll(),
        staleTime: STALE_TIME_MS * 5,
      },
      {
        queryKey: ["equipment-groups"],
        queryFn: () => equipmentGroupService.getAll(),
        staleTime: STALE_TIME_MS,
      },
    ],
  });

  const [
    operatorsQuery,
    equipmentQuery,
    inspectionsQuery,
    checklistQuery,
    sectorsQuery,
    leadersQuery,
    sectorLeaderAssignmentsQuery,
    groupsQuery,
    groupQuestionsQuery,
    groupProceduresQuery,
    equipmentGroupsQuery,
  ] = queryResults;

  const loading = queryResults.some((result) => result.isLoading);
  const errorResult = queryResults.find((result) => result.isError);
  const error =
    errorResult && errorResult.error instanceof Error
      ? errorResult.error.message
      : null;

  const refresh = () =>
    Promise.all(queryResults.map((result) => result.refetch()));

  return {
    operators: operatorsQuery.data ?? [],
    equipment: equipmentQuery.data ?? [],
    inspections: inspectionsQuery.data ?? [],
    checklistItems: checklistQuery.data ?? [],
    sectors: sectorsQuery.data ?? [],
    leaders: leadersQuery.data ?? [],
    sectorLeaderAssignments: sectorLeaderAssignmentsQuery.data ?? [],
    groups: groupsQuery.data ?? [],
    groupQuestions: groupQuestionsQuery.data ?? [],
    groupProcedures: groupProceduresQuery.data ?? [],
    equipmentGroups: equipmentGroupsQuery.data ?? [],
    loading,
    error,
    refresh,
  };
};
