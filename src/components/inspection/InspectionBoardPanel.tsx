import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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
}: InspectionBoardPanelProps<TInspection>) => {
  return (
    <Card className="border border-slate-200 bg-white shadow-sm">
      <CardHeader className="space-y-1">
        <CardTitle className="text-xl text-slate-900">{title}</CardTitle>
        <CardDescription className="text-sm text-slate-600">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Setores</p>
            <p className="text-xl font-semibold text-slate-900">{boardStats.sectorCount}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Equipamentos</p>
            <p className="text-xl font-semibold text-slate-900">{boardStats.equipmentCount}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Inspeções hoje</p>
            <p className="text-xl font-semibold text-slate-900">{boardStats.inspectionsToday}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">NOK hoje</p>
            <p className="text-xl font-semibold text-red-700">{boardStats.inspectionsWithProblemsToday}</p>
          </div>
        </div>

        {boardBySector.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-gray-500">
            {emptyMessage}
          </div>
        ) : (
          <div className="overflow-x-auto pb-2">
            <div className="flex min-w-max gap-4">
              {boardBySector.map((sectorEntry) => (
                <div
                  key={sectorEntry.sector}
                  className="w-[320px] shrink-0 rounded-lg border border-slate-200 bg-white shadow-sm"
                >
                  <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-base font-semibold uppercase tracking-wide text-slate-800">
                      {sectorEntry.sector}
                    </p>
                    <p className="text-xs text-slate-600">
                      {sectorEntry.equipments.length} equipamento(s)
                    </p>
                  </div>
                  <div className="max-h-[70vh] space-y-3 overflow-y-auto p-3">
                    {sectorEntry.equipments.map((equipmentEntry) => (
                      <div key={equipmentEntry.id} className="rounded-md border border-slate-200 bg-white">
                        <div className="border-b border-slate-200 bg-slate-50/70 px-3 py-2">
                          <p className="font-semibold text-slate-900">{equipmentEntry.name}</p>
                          <p className="text-xs text-slate-500">KP: {equipmentEntry.kp}</p>
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                          {equipmentEntry.inspections.length === 0 ? (
                            <p className="px-3 py-3 text-xs text-slate-500">
                              Sem inspeções registradas.
                            </p>
                          ) : (
                            equipmentEntry.inspections.map((inspectionEntry) => (
                              <button
                                key={inspectionEntry.id}
                                type="button"
                                onClick={() => onInspectionClick(inspectionEntry.inspection)}
                                className={`flex w-full items-center gap-2 border-b border-slate-200 px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50 ${getRowClass(inspectionEntry)}`}
                              >
                                <span
                                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${getDotClass(inspectionEntry)}`}
                                />
                                <span className="flex-1 text-slate-800">{inspectionEntry.label}</span>
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
      <CardFooter className="flex flex-wrap items-center gap-4 border-t border-slate-200 text-sm">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm border bg-green-100" />
          <span>Checklist OK hoje</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm border bg-red-100" />
          <span>Checklist NOK hoje</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm border bg-amber-100" />
          <span>Checklist NOK com OS</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
          <span>Checklist NOK sem OS</span>
        </div>
      </CardFooter>
    </Card>
  );
};

export default InspectionBoardPanel;

