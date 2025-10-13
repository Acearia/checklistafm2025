import { useQueries } from "@tanstack/react-query";
import {
  operatorService,
  equipmentService,
  inspectionService,
  checklistService,
  sectorService,
  leaderService,
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
    ],
  });

  const [
    operatorsQuery,
    equipmentQuery,
    inspectionsQuery,
    checklistQuery,
    sectorsQuery,
    leadersQuery,
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
    loading,
    error,
    refresh,
  };
};
