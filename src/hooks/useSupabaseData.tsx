import { useQueries } from "@tanstack/react-query";
import {
  operatorService,
  equipmentService,
  inspectionService,
  checklistService,
  sectorService,
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
    ],
  });

  const [
    operatorsQuery,
    equipmentQuery,
    inspectionsQuery,
    checklistQuery,
    sectorsQuery,
  ] = queryResults;

  const loading = queryResults.some((result) => result.isLoading);
  const errorResult = queryResults.find((result) => result.isError);
  const error =
    errorResult && errorResult.error instanceof Error
      ? errorResult.error.message
      : null;

  const refresh = () =>
    Promise.all(queryResults.map((result) => result.refetch()));

  const operators = operatorsQuery.data ?? [];
  const sectors = sectorsQuery.data ?? [];
  const derivedLeaders = operators
    .filter((op: any) => op.is_leader)
    .map((op: any) => ({
      id: op.matricula,
      name: op.name,
      email: op.leader_email,
      sector: op.setor,
      operator_matricula: op.matricula,
      password_hash: op.leader_password_hash,
    }));

  return {
    operators,
    equipment: equipmentQuery.data ?? [],
    inspections: inspectionsQuery.data ?? [],
    checklistItems: checklistQuery.data ?? [],
    sectors,
    leaders: derivedLeaders,
    loading,
    error,
    refresh,
  };
};
