
import React, { useState, useEffect } from "react";
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
import { Eye, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSupabaseData } from "@/hooks/useSupabaseData";

const AdminInspections = () => {
  const { toast } = useToast();
  const { 
    inspections, 
    operators, 
    equipment, 
    loading, 
    error, 
    refresh 
  } = useSupabaseData();
  
  const [selectedInspection, setSelectedInspection] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [filterEquipment, setFilterEquipment] = useState<string>("all");
  const [filterOperator, setFilterOperator] = useState<string>("all");


  const handleViewDetails = (inspection: any) => {
    setSelectedInspection(inspection);
    setIsDialogOpen(true);
  };

  const handleExportCSV = () => {
    // Lógica para exportar para CSV
    toast({
      title: "Exportação iniciada",
      description: "Os dados das inspeções estão sendo exportados para CSV.",
    });
  };

  const filteredInspections = inspections.filter((inspection) => {
    let matchesEquipment = filterEquipment === "all" || inspection.equipment_id === filterEquipment;
    let matchesOperator = filterOperator === "all" || inspection.operator_matricula === filterOperator;
    return matchesEquipment && matchesOperator;
  });

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
        <Button onClick={handleExportCSV} className="bg-green-600 hover:bg-green-700">
          <Download className="mr-2 h-4 w-4" />
          Exportar CSV
        </Button>
      </div>


      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Filtre as inspeções por equipamento ou operador</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          </div>
        </CardContent>
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
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInspections.map((inspection, index) => {
                    // Find operator and equipment by IDs for display
                    const inspectionOperator = operators.find(op => op.matricula === inspection.operator_matricula);
                    const inspectionEquipment = equipment.find(eq => eq.id === inspection.equipment_id);
                    
                    return (
                      <TableRow key={index}>
                        <TableCell>
                          {new Date(inspection.submission_date || inspection.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>{inspectionEquipment?.name || "N/A"}</TableCell>
                        <TableCell>{inspectionEquipment?.kp || "N/A"}</TableCell>
                        <TableCell>{inspectionOperator?.name || "N/A"}</TableCell>
                        <TableCell>
                          <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                            Concluído
                          </span>
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes da Inspeção</DialogTitle>
            <DialogDescription>
              {selectedInspection && (
                <div className="text-sm">
                  {(() => {
                    const inspectionOperator = operators.find(op => op.id === selectedInspection.operator_id);
                    const inspectionEquipment = equipment.find(eq => eq.id === selectedInspection.equipment_id);
                    
                    return (
                      <>
                        Data: {new Date(selectedInspection.submission_date || selectedInspection.created_at).toLocaleDateString()} | 
                        Equipamento: {inspectionEquipment?.name || selectedInspection.equipment?.name || "N/A"} | 
                        Operador: {inspectionOperator?.name || selectedInspection.operator?.name || "N/A"}
                      </>
                    );
                  })()}
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          
          {selectedInspection && (() => {
            const inspectionOperator = operators.find(op => op.id === selectedInspection.operator_id);
            const inspectionEquipment = equipment.find(eq => eq.id === selectedInspection.equipment_id);
            
            return (
              <div className="space-y-4">
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
                      {selectedInspection.checklist_answers && selectedInspection.checklist_answers.map((item: any, index: number) => (
                        <TableRow key={index}>
                          <TableCell>{item.question || `Item ${index + 1}`}</TableCell>
                          <TableCell className="text-right">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              item.answer === 'Sim' ? 'bg-green-100 text-green-800' : 
                              item.answer === 'Não' ? 'bg-red-100 text-red-800' : 
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {item.answer || 'N/A'}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
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
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Fechar
            </Button>
            <Button className="bg-red-700 hover:bg-red-800">
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
