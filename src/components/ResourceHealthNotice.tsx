import { useSyncExternalStore } from "react";
import { getResourceFailures, subscribeResourceHealth } from "@/lib/resourceHealth";

export default function ResourceHealthNotice() {
  const failures = useSyncExternalStore(subscribeResourceHealth, getResourceFailures);
  if (!failures.length) return null;
  return <div role="alert" className="mb-4 rounded-md border border-destructive p-4 text-destructive">
    Não foi possível atualizar algumas consultas do servidor. Os registros e totais podem estar
    incompletos ou desatualizados. Verifique a conexão e atualize a página para tentar novamente.
  </div>;
}
