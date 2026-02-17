
import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Eye, Download, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSupabaseData } from "@/hooks/useSupabaseData";
import { Badge } from "@/components/ui/badge";
import { applyAlertRuleToItem, shouldTriggerAlert } from "@/lib/alertRules";
import { loadMaintenanceOrders } from "@/lib/maintenanceOrders";
import type { MaintenanceOrder } from "@/lib/types";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import jsPDF from "jspdf";

const AdminInspections = () => {
  const { toast } = useToast();
  const { 
    inspections, 
    operators, 
    equipment, 
    loading, 
    error, 
    refresh 
  } = useSupabaseData([
    "inspections",
    "operators",
    "equipment",
  ]);
  
  const [selectedInspection, setSelectedInspection] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [filterEquipment, setFilterEquipment] = useState<string>("all");
  const [filterOperator, setFilterOperator] = useState<string>("all");
  const [sectorFilter, setSectorFilter] = useState<string>("all");
  const [osFilter, setOsFilter] = useState<"all" | "with-open" | "without-open">("all");
  const [maintenanceOrders, setMaintenanceOrders] = useState<MaintenanceOrder[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const equipmentById = useMemo(() => {
    return new Map((equipment || []).map((item: any) => [item.id, item]));
  }, [equipment]);

  useEffect(() => {
    const updateOrders = () => {
      setMaintenanceOrders(loadMaintenanceOrders());
    };
    updateOrders();
    window.addEventListener(
      "checklistafm-maintenance-orders-updated",
      updateOrders as EventListener
    );
    return () => {
      window.removeEventListener(
        "checklistafm-maintenance-orders-updated",
        updateOrders as EventListener
      );
    };
  }, []);


  const handleViewDetails = (inspection: any) => {
    setSelectedInspection(inspection);
    setIsDialogOpen(true);
  };

  const handleExportPDF = () => {
    if (loading) {
      toast({
        title: "Carregando dados",
        description: "Aguarde enquanto carregamos as inspeções.",
      });
      return;
    }

    if (filteredInspections.length === 0) {
      toast({
        title: "Nenhuma inspeção encontrada",
        description: "Não há inspeções com os filtros selecionados.",
        variant: "destructive",
      });
      return;
    }

    try {
      const doc = new jsPDF();
      const reportDate = format(new Date(), "PP", { locale: ptBR });

      doc.setFontSize(20);
      doc.text("Relatório de Inspeções", 20, 20);
      doc.setFontSize(12);
      doc.text(`Data do relatório: ${reportDate}`, 20, 30);

      let yPosition = 45;

      filteredInspections.forEach((inspection: any, index: number) => {
        if (yPosition > 270) {
          doc.addPage();
          yPosition = 20;
        }

        const inspectionEquipment =
          inspection.equipment ?? equipmentById.get(inspection.equipment_id);
        const inspectionOperator = operators.find(
          (op) =>
            op.matricula === inspection.operator_matricula ||
            op.id === inspection.operator_id
        );
        const dateValue =
          inspection.submission_date ||
          inspection.created_at ||
          inspection.inspection_date;
        const formattedDate = dateValue
          ? format(new Date(dateValue), "dd/MM/yyyy", { locale: ptBR })
          : "N/A";
        const hasProblems = (inspection as any).problemCount > 0;
        const statusLabel = hasProblems
          ? `${(inspection as any).problemCount} alerta(s)`
          : "Sem alertas";
        const osStatus = hasProblems
          ? (inspection as any).hasOpenOrder
            ? "OS em andamento"
            : "Sem OS"
          : "N/A";

        doc.setFontSize(12);
        doc.text(`${index + 1}. Equipamento: ${inspectionEquipment?.name || "N/A"}`, 20, yPosition);
        doc.text(`   KP: ${inspectionEquipment?.kp || "N/A"}`, 30, yPosition + 6);
        doc.text(`   Operador: ${inspectionOperator?.name || "N/A"}`, 30, yPosition + 12);
        doc.text(`   Data: ${formattedDate}`, 30, yPosition + 18);
        doc.text(`   Status: ${statusLabel} | OS: ${osStatus}`, 30, yPosition + 24);

        yPosition += 32;
      });

      doc.save(`inspecoes-${format(new Date(), "yyyy-MM-dd")}.pdf`);

      toast({
        title: "PDF gerado com sucesso",
        description: "O relatório foi baixado para o seu computador.",
      });
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast({
        title: "Erro ao gerar PDF",
        description: "Não foi possível gerar o relatório.",
        variant: "destructive",
      });
    }
  };

  const openOrdersByInspection = useMemo(() => {
    return new Set(
      maintenanceOrders
        .filter((order) => order.status === "open")
        .map((order) => order.inspectionId)
    );
  }, [maintenanceOrders]);

  const processedInspections = useMemo(() => {
    return inspections.map((inspection: any) => {
      const rawAnswers = Array.isArray(inspection.checklist_answers)
        ? inspection.checklist_answers
        : [];
      const answersWithFlags = rawAnswers.map((answer, index) => {
        const answerWithRules = applyAlertRuleToItem({
          ...answer,
          question:
            answer?.question && String(answer.question).trim().length > 0
              ? answer.question
              : `Pergunta ${index + 1}`,
        });

        const triggersAlert = shouldTriggerAlert(
          answerWithRules.question,
          answerWithRules.answer,
          {
            onYes: answerWithRules.alertOnYes,
            onNo: answerWithRules.alertOnNo,
          }
        );

        return {
          ...answerWithRules,
          triggersAlert,
        };
      });
      const problemItems = answersWithFlags.filter((answer) => answer.triggersAlert);

      const hasOpenOrder = openOrdersByInspection.has(inspection.id);

      return {
        ...inspection,
        checklist_answers: answersWithFlags,
        problemItems,
        problemCount: problemItems.length,
        hasOpenOrder,
      };
    });
  }, [inspections, openOrdersByInspection]);

  const filteredInspections = processedInspections.filter((inspection: any) => {
    const matchesEquipment =
      filterEquipment === "all" || inspection.equipment_id === filterEquipment;

    const matchesOperator =
      filterOperator === "all" ||
      inspection.operator_matricula === filterOperator ||
      inspection.operator_id === filterOperator;

    const inspectionEquipment =
      inspection.equipment && inspection.equipment.sector
        ? inspection.equipment
        : equipmentById.get(inspection.equipment_id);
    const inspectionOperator = operators.find(
      (op) =>
        op.matricula === inspection.operator_matricula ||
        op.id === inspection.operator_id
    );
    const inspectionSector = inspectionEquipment?.sector || "Sem setor";
    const matchesSector = sectorFilter === "all" || inspectionSector === sectorFilter;

    const matchesOs =
      osFilter === "all" ||
      (osFilter === "with-open" && inspection.hasOpenOrder) ||
      (osFilter === "without-open" &&
        inspection.problemCount > 0 &&
        !inspection.hasOpenOrder);

    const normalizedSearch = searchTerm.trim().toLowerCase();
    const matchesSearch =
      normalizedSearch.length === 0 ||
      (inspectionEquipment?.name || "").toLowerCase().includes(normalizedSearch) ||
      (inspectionEquipment?.kp || "").toLowerCase().includes(normalizedSearch) ||
      (inspectionOperator?.name || "").toLowerCase().includes(normalizedSearch) ||
      (inspection.operator_matricula || inspection.operator_id || "").toLowerCase().includes(normalizedSearch);

    const dateValue =
      inspection.submission_date ||
      inspection.created_at ||
      inspection.inspection_date;
    const inspectionDate = dateValue ? new Date(dateValue) : null;
    const fromDate = dateFrom ? new Date(dateFrom) : null;
    const toDate = dateTo ? new Date(dateTo) : null;

    if (fromDate) {
      fromDate.setHours(0, 0, 0, 0);
    }
    if (toDate) {
      toDate.setHours(23, 59, 59, 999);
    }

    const matchesDate =
      (!fromDate || (inspectionDate && inspectionDate >= fromDate)) &&
      (!toDate || (inspectionDate && inspectionDate <= toDate));

    return (
      matchesEquipment &&
      matchesOperator &&
      matchesSector &&
      matchesOs &&
      matchesSearch &&
      matchesDate
    );
  });

  const sectorSummary = useMemo(() => {
    if (!processedInspections || processedInspections.length === 0) {
      return {
        sectors: [],
        total: 0,
        totalWithProblems: 0,
      };
    }

    const summaryMap = new Map<
      string,
      {
        sector: string;
        totalInspections: number;
        inspectionsWithProblems: number;
        inspectionsWithoutOS: number;
      }
    >();

    let inspectionsWithProblemsTotal = 0;
    let inspectionsWithoutOSTotal = 0;
    let inspectionsWithoutProblemsTotal = 0;

    processedInspections.forEach((inspection: any) => {
      const equipmentItem = equipmentById.get(inspection.equipment_id);
      const sectorName = equipmentItem?.sector || "Sem setor";
      const answers = Array.isArray(inspection.checklist_answers)
        ? (inspection.checklist_answers as any[])
        : [];

      const hasProblems =
        inspection.problemCount > 0 ||
        answers.some((answer) => Boolean(answer?.triggersAlert));
      if (hasProblems) {
        inspectionsWithProblemsTotal += 1;
        if (!inspection.hasOpenOrder) {
          inspectionsWithoutOSTotal += 1;
        }
      } else {
        inspectionsWithoutProblemsTotal += 1;
      }

      const existing = summaryMap.get(sectorName);
      if (existing) {
        existing.totalInspections += 1;
        if (hasProblems) {
          existing.inspectionsWithProblems += 1;
          if (!inspection.hasOpenOrder) {
            existing.inspectionsWithoutOS += 1;
          }
        }
      } else {
        summaryMap.set(sectorName, {
          sector: sectorName,
          totalInspections: 1,
          inspectionsWithProblems: hasProblems ? 1 : 0,
          inspectionsWithoutOS: hasProblems && !inspection.hasOpenOrder ? 1 : 0,
        });
      }
    });

    const sectors = Array.from(summaryMap.values()).sort((a, b) =>
      a.sector.localeCompare(b.sector, "pt-BR")
    );

    return {
      sectors,
      total: processedInspections.length,
      totalWithProblems: inspectionsWithProblemsTotal,
      totalWithoutOS: inspectionsWithoutOSTotal,
      totalWithoutProblems: inspectionsWithoutProblemsTotal,
    };
  }, [processedInspections, equipment]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-red-700 border-t-transparent"></div>
          <p className="mt-4 text-gray-600">Carregando inspeções...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Inspeções</h1>
        <Button onClick={handleExportPDF} className="bg-green-600 hover:bg-green-700">
          <Download className="mr-2 h-4 w-4" />
          Exportar PDF
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resumo por setor</CardTitle>
          <CardDescription>
            Acompanhe a quantidade de checklists finalizados e quantos apresentaram problemas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sectorSummary.sectors.length === 0 ? (
            <p className="text-sm text-gray-600">
              Nenhuma inspeção registrada até o momento.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Setor</TableHead>
                    <TableHead className="text-center">Checklists concluídos</TableHead>
                    <TableHead className="text-center">Com problemas</TableHead>
                    <TableHead className="text-center">Com OS</TableHead>
                    <TableHead className="text-center">% com problemas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sectorSummary.sectors.map((sector) => {
                    const percentage =
                      sector.totalInspections === 0
                        ? 0
                        : Math.round(
                            (sector.inspectionsWithProblems /
                              sector.totalInspections) *
                              100
                          );
                    const problemTagVariant =
                      sector.inspectionsWithProblems > 0
                        ? "bg-red-100 text-red-800"
                        : "bg-green-100 text-green-800";
                    const isActive = sectorFilter === sector.sector;

                    return (
                      <TableRow
                        key={sector.sector}
                        className={`cursor-pointer transition-colors ${
                          isActive ? "bg-red-50/70" : "hover:bg-gray-50"
                        }`}
                        onClick={() => setSectorFilter(sector.sector)}
                      >
                        <TableCell className="font-medium">
                          {sector.sector}
                          {isActive && (
                            <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700">
                              filtrando
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {sector.totalInspections.toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-center">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${problemTagVariant}`}
                          >
                            {sector.inspectionsWithProblems.toLocaleString("pt-BR")}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                              sector.inspectionsWithoutOS > 0
                                ? "bg-amber-100 text-amber-800"
                                : "bg-green-100 text-green-800"
                            }`}
                          >
                            {(sector.inspectionsWithProblems - sector.inspectionsWithoutOS).toLocaleString("pt-BR")}
                          </span>
                        </TableCell>
                        <TableCell className="text-center text-sm text-muted-foreground">
                          {percentage}%
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
        {sectorSummary.sectors.length > 0 && (
          <CardFooter className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm text-muted-foreground">
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4">
              <span>
                Total de inspeções:{" "}
                <strong>{sectorSummary.total.toLocaleString("pt-BR")}</strong>
              </span>
              <span>
                Com problemas:{" "}
                <strong>
                  {sectorSummary.totalWithProblems.toLocaleString("pt-BR")}
                </strong>
              </span>
              <span>
                Sem problemas:{" "}
                <strong>
                  {sectorSummary.totalWithoutProblems.toLocaleString("pt-BR")}
                </strong>
              </span>
            </div>
            {sectorFilter !== "all" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSectorFilter("all")}
              >
                Remover filtro de setor
              </Button>
            )}
          </CardFooter>
        )}
      </Card>


      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Filtre as inspeções por equipamento, operador ou texto</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Busca rápida</label>
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Equipamento, KP, operador..."
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Data início</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Data fim</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Equipamento</label>
              <Select 
                value={filterEquipment} 
                onValueChange={setFilterEquipment}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos os equipamentos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os equipamentos</SelectItem>
                  {equipment && equipment.map(equipmentItem => (
                    <SelectItem key={equipmentItem.id} value={equipmentItem.id}>
                      {equipmentItem.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Operador</label>
              <Select 
                value={filterOperator} 
                onValueChange={setFilterOperator}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos os operadores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os operadores</SelectItem>
                  {operators && operators.map(operator => (
                    <SelectItem key={operator.id} value={operator.id}>
                      {operator.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Status de OS</label>
              <Select value={osFilter} onValueChange={(value) => setOsFilter(value as "all" | "with-open" | "without-open")}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as inspeções" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as inspeções</SelectItem>
                  <SelectItem value="with-open">Com OS em andamento</SelectItem>
                  <SelectItem value="without-open">Sem OS aberta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
        {sectorSummary.sectors.length > 0 && (
          <CardFooter className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>
              Total de inspeções:{" "}
              <strong>{sectorSummary.total.toLocaleString("pt-BR")}</strong>
            </span>
            <span>
              Inspeções com problemas:{" "}
              <strong>{sectorSummary.totalWithProblems.toLocaleString("pt-BR")}</strong>
            </span>
            <span>
              Sem abertura de OS:{" "}
              <strong>{sectorSummary.totalWithoutOS.toLocaleString("pt-BR")}</strong>
            </span>
          </CardFooter>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Inspeções</CardTitle>
          <CardDescription>
            {filteredInspections.length === 0 
              ? "Nenhuma inspeção encontrada" 
              : `Mostrando ${filteredInspections.length} inspeção(ões)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredInspections.length === 0 ? (
            <div className="text-center p-8 border rounded-md bg-gray-50">
              <p className="text-gray-500">Nenhuma inspeção encontrada com os filtros selecionados.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Equipamento</TableHead>
                    <TableHead>KP</TableHead>
                    <TableHead>Operador</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>OS</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInspections.map((inspection, index) => {
                    // Find operator and equipment by IDs for display
                    const inspectionOperator = operators.find(op => op.matricula === inspection.operator_matricula);
                    const inspectionEquipment = equipment.find(eq => eq.id === inspection.equipment_id);
                    const hasProblems = (inspection as any).problemCount > 0;
                    const statusLabel = hasProblems
                      ? `${(inspection as any).problemCount} alerta(s)`
                      : "Sem alertas";
                    const statusClasses = hasProblems
                      ? "bg-red-100 text-red-800"
                      : "bg-green-100 text-green-800";
                    
                    return (
                      <TableRow key={index}>
                        <TableCell>
                          {format(new Date(inspection.submission_date || inspection.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell>{inspectionEquipment?.name || "N/A"}</TableCell>
                        <TableCell>{inspectionEquipment?.kp || "N/A"}</TableCell>
                        <TableCell>{inspectionOperator?.name || "N/A"}</TableCell>
                        <TableCell>
                          <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${statusClasses}`}>
                            {statusLabel}
                          </span>
                        </TableCell>
                        <TableCell>
                          {((inspection as any).problemCount ?? 0) > 0 ? (
                            (inspection as any).hasOpenOrder ? (
                              <Badge variant="secondary">OS em andamento</Badge>
                            ) : (
                              <Badge variant="outline" className="border-amber-300 text-amber-700">
                                Sem OS
                              </Badge>
                            )
                          ) : (
                            <span className="text-xs text-gray-500">N/A</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            onClick={() => handleViewDetails(inspection)} 
                            variant="ghost" 
                            size="sm"
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Detalhes
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de detalhes */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Detalhes da Inspeção</DialogTitle>
            <DialogDescription>
              {selectedInspection && (
                <div className="text-sm">
                  {(() => {
                    const inspectionOperator = operators.find(
                      (op) =>
                        op.matricula === selectedInspection.operator_matricula ||
                        op.id === selectedInspection.operator_id
                    );
                    const inspectionEquipment = equipment.find(eq => eq.id === selectedInspection.equipment_id);
                    const problemCount = selectedInspection.problemCount || 0;
                    
                    return (
                      <>
                        Data: {format(new Date(selectedInspection.submission_date || selectedInspection.created_at), "dd/MM/yyyy", { locale: ptBR })} | 
                        Equipamento: {inspectionEquipment?.name || selectedInspection.equipment?.name || "N/A"} | 
                        Operador: {inspectionOperator?.name || selectedInspection.operator?.name || "N/A"} | 
                        Alertas: {problemCount}
                      </>
                    );
                  })()}
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {selectedInspection && (() => {
            const inspectionOperator = operators.find(
              (op) =>
                op.matricula === selectedInspection.operator_matricula ||
                op.id === selectedInspection.operator_id
            );
            const inspectionEquipment = equipment.find(eq => eq.id === selectedInspection.equipment_id);
            
            const problemItems = Array.isArray(selectedInspection.problemItems)
              ? selectedInspection.problemItems
              : [];
            const hasProblems = problemItems.length > 0;

            return (
              <div className="space-y-4">
                {hasProblems && (
                  <div className="rounded border border-red-200 bg-red-50 p-3">
                    <div className="flex items-center gap-2 text-red-800 font-semibold">
                      <AlertTriangle className="h-4 w-4" />
                      {problemItems.length} alerta(s) identificado(s) nesta inspeção
                    </div>
                    <ul className="mt-2 space-y-2 text-sm text-red-700">
                      {problemItems.map((item: any, index: number) => (
                        <li key={item.id || item.question || index}>
                          <span className="font-medium">
                            {item.question || `Item ${index + 1}`}
                          </span>{" "}
                          — resposta: <span className="uppercase">{item.answer || "N/A"}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="border rounded p-3">
                    <h3 className="font-medium text-sm mb-1">Equipamento</h3>
                    <p className="text-sm">{inspectionEquipment?.name || selectedInspection.equipment?.name || "N/A"}</p>
                    <p className="text-xs text-gray-500">KP: {inspectionEquipment?.kp || selectedInspection.equipment?.kp || "N/A"}</p>
                  </div>
                  <div className="border rounded p-3">
                    <h3 className="font-medium text-sm mb-1">Operador</h3>
                    <p className="text-sm">{inspectionOperator?.name || selectedInspection.operator?.name || "N/A"}</p>
                    <p className="text-xs text-gray-500">
                      {inspectionOperator?.cargo && `Cargo: ${inspectionOperator.cargo}`}
                      {inspectionOperator?.setor && ` | Setor: ${inspectionOperator.setor}`}
                    </p>
                  </div>
                </div>
                
                <h3 className="font-medium">Itens do Checklist</h3>
                <div className="max-h-80 overflow-y-auto border rounded">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">Resposta</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedInspection.checklist_answers &&
                        selectedInspection.checklist_answers.map((item: any, index: number) => {
                          const triggersAlert = Boolean(item.triggersAlert);
                          const answer = item.answer || "N/A";
                          const highlightClasses = triggersAlert
                            ? "bg-red-50"
                            : "";
                          const answerClasses = triggersAlert
                            ? "bg-red-100 text-red-800 border border-red-200"
                            : answer === "Sim"
                            ? "bg-green-100 text-green-800"
                            : answer === "Não"
                            ? "bg-gray-200 text-gray-800"
                            : "bg-gray-100 text-gray-800";
                          return (
                            <TableRow key={index} className={highlightClasses}>
                              <TableCell className="flex flex-col gap-1">
                                <span>{item.question || `Item ${index + 1}`}</span>
                                {triggersAlert && (
                                  <Badge variant="destructive" className="w-fit">
                                    Alerta
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <span
                                  className={`px-2 py-1 rounded-full text-xs font-medium ${answerClasses}`}
                                >
                                  {answer}
                                </span>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                </div>
                
                <div>
                  <h3 className="font-medium mb-2">Observações</h3>
                  <div className="border p-3 rounded bg-gray-50">
                    <p className="text-sm">{selectedInspection.comments || "Sem observações"}</p>
                  </div>
                </div>

                {Array.isArray(selectedInspection.photos) && selectedInspection.photos.length > 0 && (
                  <div>
                    <h3 className="font-medium mb-2">Anexos</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {selectedInspection.photos.map((photo: any, index: number) => {
                        const src = typeof photo === "string" ? photo : photo?.data || photo?.url || "";
                        if (!src) return null;
                        return (
                          <div key={photo.id || index} className="border rounded-md bg-gray-50 p-2">
                            <img
                              src={src}
                              alt={`Anexo ${index + 1}`}
                              className="h-40 w-full rounded object-cover"
                            />
                            <a
                              href={src}
                              download={`anexo-${index + 1}.png`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-2 block text-center text-sm text-red-700 hover:underline"
                            >
                              Abrir em nova guia
                            </a>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                {selectedInspection.signature && (
                  <div>
                    <h3 className="font-medium mb-2">Assinatura</h3>
                    <div className="border p-2 rounded bg-gray-50">
                      <img 
                        src={selectedInspection.signature} 
                        alt="Assinatura" 
                        className="max-h-16"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
          </div>
          
          <DialogFooter className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              className="w-full sm:w-auto"
            >
              Fechar
            </Button>
            <Button className="bg-red-700 hover:bg-red-800 w-full sm:w-auto">
              <Download className="mr-2 h-4 w-4" />
              Exportar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminInspections;


