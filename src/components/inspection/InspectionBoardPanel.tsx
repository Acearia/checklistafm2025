import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type {
  InspectionBoardInspectionEntry,
  InspectionBoardSectorEntry,
  InspectionBoardStats,
} from "@/lib/inspectionBoard";

interface InspectionBoardPanelProps<TInspection> {
  title: string;
  description: string;
  emptyMessage: string;
  boardBySector: InspectionBoardSectorEntry<TInspection>[];
  boardStats: InspectionBoardStats;
  onInspectionClick: (inspection: TInspection) => void;
  getRowClass: (entry: InspectionBoardInspectionEntry<TInspection>) => string;
  getDotClass: (entry: InspectionBoardInspectionEntry<TInspection>) => string;
  dateFrom?: string;
  dateTo?: string;
  onDateFromChange?: (value: string) => void;
  onDateToChange?: (value: string) => void;
  onApplyToday?: () => void;
  onApplyLast7Days?: () => void;
  onClearDateFilter?: () => void;
}

const InspectionBoardPanel = <TInspection,>({
  title,
  description,
  emptyMessage,
  boardBySector,
  boardStats,
  onInspectionClick,
  getRowClass,
  getDotClass,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  onApplyToday,
  onApplyLast7Days,
  onClearDateFilter,
}: InspectionBoardPanelProps<TInspection>) => {
  const hasDateControls = Boolean(onDateFromChange && onDateToChange);

  return (
    <Card className="border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:shadow-none">
      <CardHeader className="space-y-1">
        <CardTitle className="text-xl text-slate-900 dark:text-slate-50">{title}</CardTitle>
        <CardDescription className="text-sm text-slate-600 dark:text-slate-400">{description}</CardDescription>
        {hasDateControls && (
          <div className="mt-2 flex flex-wrap items-end gap-2 rounded-md border border-slate-200 bg-slate-50/60 p-2.5 dark:border-slate-800 dark:bg-slate-900/80">
            <div className="min-w-[150px] flex-1 space-y-1">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400">De</p>
              <Input
                type="date"
                value={dateFrom || ""}
                onChange={(event) => onDateFromChange?.(event.target.value)}
                className="dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:[color-scheme:dark]"
              />
            </div>
            <div className="min-w-[150px] flex-1 space-y-1">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Até</p>
              <Input
                type="date"
                value={dateTo || ""}
                onChange={(event) => onDateToChange?.(event.target.value)}
                className="dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:[color-scheme:dark]"
              />
            </div>
            <div className="flex w-full flex-wrap gap-2 pt-1 sm:w-auto sm:pt-0">
              <Button type="button" variant="outline" size="sm" onClick={onApplyToday} className="dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900">
                Hoje
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={onApplyLast7Days} className="dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900">
                7 dias
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={onClearDateFilter} className="dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-slate-100">
                Limpar
              </Button>
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/70">
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Setores</p>
            <p className="text-xl font-semibold text-slate-900 dark:text-slate-50">{boardStats.sectorCount}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/70">
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Equipamentos</p>
            <p className="text-xl font-semibold text-slate-900 dark:text-slate-50">{boardStats.equipmentCount}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/70">
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Inspeções hoje</p>
            <p className="text-xl font-semibold text-slate-900 dark:text-slate-50">{boardStats.inspectionsToday}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/70">
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Não conforme hoje</p>
            <p className="text-xl font-semibold text-red-700 dark:text-red-400">{boardStats.inspectionsWithProblemsToday}</p>
          </div>
        </div>

        {boardBySector.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            {emptyMessage}
          </div>
        ) : (
          <div className="overflow-x-auto pb-2">
            <div className="flex min-w-max gap-3">
              {boardBySector.map((sectorEntry) => (
                <div
                  key={sectorEntry.sector}
                  className="w-[260px] shrink-0 rounded-lg border border-slate-200 bg-white shadow-sm xl:w-[236px] 2xl:w-[228px] dark:border-slate-800 dark:bg-slate-900 dark:shadow-none"
                >
                  <div className="border-b border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-950/80">
                    <p className="text-[15px] font-semibold uppercase tracking-wide text-slate-800 dark:text-slate-100">
                      {sectorEntry.sector}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      {sectorEntry.equipments.length} equipamento(s)
                    </p>
                  </div>
                  <div className="max-h-[70vh] space-y-2.5 overflow-y-auto p-2.5">
                    {sectorEntry.equipments.map((equipmentEntry) => (
                      <div key={equipmentEntry.id} className="rounded-md border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/70">
                        <div className="border-b border-slate-200 bg-slate-50/70 px-2.5 py-2 dark:border-slate-800 dark:bg-slate-900/70">
                          <p className="font-semibold text-slate-900 dark:text-slate-50">{equipmentEntry.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">KP: {equipmentEntry.kp}</p>
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                          {equipmentEntry.inspections.length === 0 ? (
                            <p className="px-2.5 py-2.5 text-xs text-slate-500 dark:text-slate-400">
                              Sem inspeções registradas.
                            </p>
                          ) : (
                            equipmentEntry.inspections.map((inspectionEntry) => (
                              <button
                                key={inspectionEntry.id}
                                type="button"
                                onClick={() => onInspectionClick(inspectionEntry.inspection)}
                                className={`flex w-full items-center gap-2 border-b border-slate-200 px-2.5 py-1.5 text-left text-[13px] transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900 ${getRowClass(inspectionEntry)}`}
                              >
                                <span
                                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${getDotClass(inspectionEntry)}`}
                                />
                                <span className="flex-1 text-slate-800 dark:text-slate-100">{inspectionEntry.label}</span>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-wrap items-center gap-4 border-t border-slate-200 text-sm text-slate-700 dark:border-slate-800 dark:text-slate-300">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm border border-green-200 bg-green-100 dark:border-green-900 dark:bg-green-900/40" />
          <span>Checklist OK hoje</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm border border-red-200 bg-red-100 dark:border-red-900 dark:bg-red-900/40" />
          <span>Checklist não conforme hoje</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm border border-amber-200 bg-amber-100 dark:border-amber-900 dark:bg-amber-900/40" />
          <span>Checklist com OS</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
          <span>Checklist sem OS</span>
        </div>
      </CardFooter>
    </Card>
  );
};

export default InspectionBoardPanel;
