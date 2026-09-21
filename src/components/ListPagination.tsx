import { useState } from "react";
import { Button } from "@/components/ui/button";

export function useListPagination<T>(items: T[], filterKey: string, pageSize = 50) {
  const [selection, setSelection] = useState({ filterKey, page: 1 });
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const page = selection.filterKey === filterKey ? Math.min(selection.page, pageCount) : 1;
  return {
    visibleItems: items.slice((page - 1) * pageSize, page * pageSize),
    pagination: {
      page, pageCount, total: items.length, pageSize,
      onPageChange: (next: number) => setSelection({ filterKey, page: next }),
    },
  };
}

export default function ListPagination({ page, pageCount, total, pageSize, onPageChange }: {
  page: number; pageCount: number; total: number; pageSize: number;
  onPageChange: (page: number) => void;
}) {
  if (total <= pageSize) return null;
  return <div className="flex flex-wrap items-center justify-between gap-3 py-3">
    <span className="text-sm text-muted-foreground">
      {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} de {total} registros
    </span>
    <div className="flex items-center gap-2">
      <Button variant="outline" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Página anterior</Button>
      <span className="text-sm">{page} / {pageCount}</span>
      <Button variant="outline" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>Próxima página</Button>
    </div>
  </div>;
}
