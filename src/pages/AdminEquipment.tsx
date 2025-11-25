
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, FileText, Search } from "lucide-react";
import { useSupabaseData } from "@/hooks/useSupabaseData";
import { AddEquipmentDialog } from "@/components/equipment/AddEquipmentDialog";
import { EditEquipmentDialog } from "@/components/equipment/EditEquipmentDialog";
import { useToast } from "@/hooks/use-toast";
import { equipmentService } from "@/lib/supabase-service";
import { convertSupabaseEquipmentToLegacy } from "@/lib/types-compat"; 
import type { Equipment } from "@/lib/types-compat";
import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { loadMaintenanceOrders, upsertMaintenanceOrder, deleteMaintenanceOrdersByEquipment } from "@/lib/maintenanceOrders";
import type { MaintenanceOrder } from "@/lib/types";

const AdminEquipment = () => {
  const { equipment: supabaseEquipments, sectors, refresh, loading } = useSupabaseData();
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [displayedEquipments, setDisplayedEquipments] = useState<Equipment[]>([]);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [currentEquipment, setCurrentEquipment] = useState<Equipment | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [maintenanceOrders, setMaintenanceOrders] = useState<MaintenanceOrder[]>([]);
  const [maintenanceDialogOpen, setMaintenanceDialogOpen] = useState(false);
  const [maintenanceEquipment, setMaintenanceEquipment] = useState<Equipment | null>(null);
  const [maintenanceOrderId, setMaintenanceOrderId] = useState<string | null>(null);
  const [maintenanceOrderNumber, setMaintenanceOrderNumber] = useState("");
  const [maintenanceStatus, setMaintenanceStatus] = useState<MaintenanceOrder["status"]>("open");
  const [maintenanceNotes, setMaintenanceNotes] = useState("");
  const itemsPerPage = 10;
  const { toast } = useToast();
  const [osFilter, setOsFilter] = useState<"all" | "with-open" | "without-open">("all");
  
  // Convert Supabase equipment to legacy format
  useEffect(() => {
    if (supabaseEquipments.length > 0) {
      const convertedEquipments = supabaseEquipments.map(convertSupabaseEquipmentToLegacy);
      setEquipments(convertedEquipments);
    } else {
      setEquipments([]);
    }
  }, [supabaseEquipments]);

  // Filter equipments based on search term
  useEffect(() => {
    let filtered = equipments;
    if (searchTerm.trim() !== '') {
      filtered = filtered.filter(eq => 
        eq.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        eq.kp.toLowerCase().includes(searchTerm.toLowerCase()) ||
        eq.sector.toLowerCase().includes(searchTerm.toLowerCase()) ||
        eq.capacity.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (osFilter === "with-open") {
      filtered = filtered.filter((eq) =>
        maintenanceOrders.some(
          (order) => order.equipmentId === eq.id && order.status === "open"
        )
      );
    } else if (osFilter === "without-open") {
      filtered = filtered.filter(
        (eq) =>
          !maintenanceOrders.some(
            (order) => order.equipmentId === eq.id && order.status === "open"
          )
      );
    }

    setDisplayedEquipments(filtered);
    setCurrentPage(1);
  }, [searchTerm, equipments, osFilter, maintenanceOrders]);
  
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
  
  // Calculate the next available ID - removed as we use Supabase auto-generated IDs

  const handleAddEquipment = async (data: { name: string; kp: string; sector: string; capacity: string; type: string }) => {
    try {
      await equipmentService.create({
        name: data.name,
        kp: data.kp,
        sector: data.sector,
        capacity: data.capacity,
        type: data.type,
      });
      
      toast({
        title: "Equipamento adicionado",
        description: "O equipamento foi adicionado com sucesso.",
      });

      
      refresh(); // Refresh data from Supabase
    } catch (error) {
      console.error('Erro ao adicionar equipamento:', error);
      toast({
        title: "Erro",
        description: "Não foi possível adicionar o equipamento.",
        variant: "destructive",
      });
    }
  };

  const handleEditEquipment = async (data: Equipment) => {
    try {
      await equipmentService.update(data.id, {
        name: data.name,
        kp: data.kp,
        sector: data.sector,
        capacity: data.capacity,
        type: data.type,
      });
      
      toast({
        title: "Equipamento atualizado",
        description: "O equipamento foi atualizado com sucesso.",
      });

      
      setEditDialogOpen(false);
      setCurrentEquipment(null);
      refresh(); // Refresh data from Supabase
    } catch (error) {
      console.error('Erro ao editar equipamento:', error);
      toast({
        title: "Erro",
        description: "Não foi possível editar o equipamento.",
        variant: "destructive",
      });
    }
  };

  const handleRemoveEquipment = async (id: string) => {
    try {
      await equipmentService.delete(id);
      
      toast({
        title: "Equipamento removido",
        description: "O equipamento foi removido com sucesso.",
      });

      
      refresh(); // Refresh data from Supabase
    } catch (error) {
      console.error('Erro ao remover equipamento:', error);
      toast({
        title: "Erro",
        description: "Não foi possível remover o equipamento.",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (equipment: Equipment) => {
    setCurrentEquipment(equipment);
    setEditDialogOpen(true);
  };

  const exportToPDF = () => {
    try {
      const doc = new jsPDF();
      
      // Cabeçalho
      doc.setFontSize(20);
      doc.text("Lista de Equipamentos - Checklist AFM", 20, 20);
      
      doc.setFontSize(12);
      doc.text(`Data do relatório: ${format(new Date(), "PP", { locale: ptBR })}`, 20, 30);
      
      // Adicionar dados ao PDF
      doc.setFontSize(14);
      doc.text("Equipamentos", 20, 45);
      
      let yPosition = 55;
      
      equipments.forEach((equipment, index) => {
        if (yPosition > 270) {
          doc.addPage();
          yPosition = 20;
        }
        
        const typeText = equipment.type === "1" ? "Ponte" : 
                          equipment.type === "2" ? "Talha" : 
                          equipment.type === "3" ? "Pórtico" : "Outro";
        
        doc.setFontSize(12);
        doc.text(`${index + 1}. Nome: ${equipment.name}`, 20, yPosition);
        doc.text(`   KP: ${equipment.kp}`, 30, yPosition + 7);
        doc.text(`   Setor: ${equipment.sector}`, 30, yPosition + 14);
        doc.text(`   Capacidade: ${equipment.capacity}`, 30, yPosition + 21);
        doc.text(`   Tipo: ${typeText}`, 30, yPosition + 28);
        
        yPosition += 40;
      });
      
      // Salvar o PDF
      doc.save(`lista-equipamentos-${format(new Date(), "dd-MM-yyyy")}.pdf`);
      
      toast({
        title: "PDF gerado com sucesso",
        description: "A lista de equipamentos foi exportada para PDF",
      });
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast({
        title: "Erro ao gerar PDF",
        description: "Não foi possível gerar o relatório",
        variant: "destructive",
      });
    }
  };

  const getMaintenanceStatusLabel = (status: MaintenanceOrder["status"]) => {
    switch (status) {
      case "open":
        return "Em andamento";
      case "closed":
        return "Finalizada";
      case "cancelled":
        return "Cancelada";
      default:
        return "Indefinida";
    }
  };

  const formatOrderDate = (isoDate?: string) => {
    if (!isoDate) return "-";
    try {
      return format(new Date(isoDate), "dd/MM/yyyy HH:mm", { locale: ptBR });
    } catch (error) {
      console.warn("Não foi possível formatar data da OS:", error);
      return "-";
    }
  };

  const handleOpenMaintenanceDialog = (equipment: Equipment) => {
    const equipmentOrders = maintenanceOrders
      .filter(order => order.equipmentId === equipment.id)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    const activeOrder = equipmentOrders.find(order => order.status === "open");
    const latestOrder = equipmentOrders[0];

    setMaintenanceEquipment(equipment);
    setMaintenanceOrderId(activeOrder?.id ?? latestOrder?.id ?? null);
    setMaintenanceOrderNumber(activeOrder?.orderNumber ?? latestOrder?.orderNumber ?? "");
    setMaintenanceStatus(activeOrder?.status ?? "open");
    setMaintenanceNotes(activeOrder?.notes ?? latestOrder?.notes ?? "");
    setMaintenanceDialogOpen(true);
  };

  const handleSaveMaintenanceOrder = () => {
    if (!maintenanceEquipment) return;

    const orderNumber = maintenanceOrderNumber.trim();
    if (!orderNumber) {
      toast({
        title: "Número da OS obrigatório",
        description: "Informe o número da ordem de serviço para continuar.",
        variant: "destructive",
      });
      return;
    }

    const notes = maintenanceNotes.trim();
    const existingOrder = maintenanceOrders.find(order => order.id === maintenanceOrderId);
    const inspectionId =
      existingOrder?.inspectionId ?? `equipment-${maintenanceEquipment.id}-${Date.now()}`;

    const { order, orders } = upsertMaintenanceOrder({
      id: maintenanceOrderId,
      inspectionId,
      equipmentId: maintenanceEquipment.id,
      orderNumber,
      status: maintenanceStatus,
      notes: notes || undefined,
    });

    setMaintenanceOrders(orders);
    setMaintenanceOrderId(order.id);
    setMaintenanceDialogOpen(false);

    toast({
      title: maintenanceStatus === "closed" ? "OS finalizada" : "OS atualizada",
      description: `OS #${order.orderNumber} marcada como ${getMaintenanceStatusLabel(order.status)}.`,
    });
  };
  const handleDeleteMaintenanceOrders = () => {
    if (!maintenanceEquipment) return;
    const confirmationMessage = `Remover todas as ordens de serviço do equipamento "${maintenanceEquipment.name}"?`;
    const confirmed =
      typeof window === "undefined" ? true : window.confirm(confirmationMessage);
    if (!confirmed) {
      return;
    }

    const updatedOrders = deleteMaintenanceOrdersByEquipment(maintenanceEquipment.id);
    setMaintenanceOrders(updatedOrders);
    setMaintenanceOrderId(null);
    setMaintenanceOrderNumber("");
    setMaintenanceStatus("open");
    setMaintenanceNotes("");
    setMaintenanceDialogOpen(false);

    toast({
      title: "OS removidas",
      description: `Todas as OS do equipamento ${maintenanceEquipment.name} foram excluídas.`,
    });
  };
  // Pagination
  const totalPages = Math.ceil(displayedEquipments.length / itemsPerPage);
  const paginatedEquipments = displayedEquipments.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  const hasOrdersForSelectedEquipment = maintenanceEquipment
    ? maintenanceOrders.some(order => order.equipmentId === maintenanceEquipment.id)
    : false;
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Gerenciar Equipamentos - Checklist AFM</h1>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={exportToPDF}
            className="flex items-center gap-2"
          >
            <FileText size={16} />
            Exportar PDF
          </Button>
          <Button 
            className="bg-red-700 hover:bg-red-800"
            onClick={() => setAddDialogOpen(true)}
          >
            <PlusCircle size={16} className="mr-2" />
            Novo Equipamento
          </Button>
        </div>
      </div>

      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
          <Input
            type="search"
            placeholder="Buscar equipamento por nome, KP, setor ou capacidade..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="w-full md:w-60">
          <Select value={osFilter} onValueChange={(value) => setOsFilter(value as "all" | "with-open" | "without-open")}>
            <SelectTrigger className="bg-white">
              <SelectValue placeholder="Filtrar por OS" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os equipamentos</SelectItem>
              <SelectItem value="with-open">Com OS em andamento</SelectItem>
              <SelectItem value="without-open">Sem OS em andamento</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Lista de Equipamentos</CardTitle>
          <div className="text-sm text-muted-foreground">
            Total: {displayedEquipments.length} equipamento(s)
          </div>
        </CardHeader>
        <CardContent>
          {displayedEquipments.length === 0 ? (
            <div className="text-center p-8 border rounded-md bg-gray-50">
              <p className="text-gray-500">Nenhum equipamento encontrado. Ajuste os termos da busca ou adicione equipamentos usando o botão acima.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4">KP</th>
                    <th className="text-left py-3 px-4">Nome</th>
                    <th className="text-left py-3 px-4">Setor</th>
                    <th className="text-left py-3 px-4">Capacidade</th>
                    <th className="text-left py-3 px-4">Tipo</th>
                    <th className="text-left py-3 px-4">OS / Manutenção</th>
                    <th className="text-center py-3 px-4">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedEquipments.map((equipment) => {
                    const ordersForEquipment = maintenanceOrders
                      .filter(order => order.equipmentId === equipment.id)
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                    const activeOrder = ordersForEquipment.find(order => order.status === "open");
                    const latestOrder = ordersForEquipment[0];

                    return (
                      <tr key={equipment.id} className="border-b border-gray-200 hover:bg-gray-50 align-top">
                        <td className="py-3 px-4">{equipment.kp}</td>
                        <td className="py-3 px-4">{equipment.name}</td>
                        <td className="py-3 px-4">{equipment.sector}</td>
                        <td className="py-3 px-4">{equipment.capacity}</td>
                        <td className="py-3 px-4">
                          {equipment.type === "1" ? "Ponte" : 
                          equipment.type === "2" ? "Talha" : 
                          equipment.type === "3" ? "Pórtico" : "Outro"}
                        </td>
                        <td className="py-3 px-4">
                          {activeOrder ? (
                            <div className="space-y-1">
                              <Badge variant="destructive" className="text-xs">
                                OS #{activeOrder.orderNumber} • Em andamento
                              </Badge>
                              <p className="text-[11px] text-gray-500">
                                Aberta em {formatOrderDate(activeOrder.createdAt)}
                              </p>
                              {activeOrder.notes && (
                                <p className="text-[11px] text-gray-500">
                                  Obs.: {activeOrder.notes}
                                </p>
                              )}
                            </div>
                          ) : latestOrder ? (
                            <div className="space-y-1">
                              <Badge variant="secondary" className="text-xs">
                                Última OS #{latestOrder.orderNumber} • {getMaintenanceStatusLabel(latestOrder.status)}
                              </Badge>
                              <p className="text-[11px] text-gray-500">
                                Atualizada em {formatOrderDate(latestOrder.updatedAt)}
                              </p>
                              {latestOrder.notes && (
                                <p className="text-[11px] text-gray-500">
                                  Obs.: {latestOrder.notes}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-500">Sem OS registradas</span>
                          )}

                          {ordersForEquipment.length > 1 && (
                            <div className="mt-2 text-[11px] text-gray-500">
                              Histórico recente:
                              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                                {ordersForEquipment.slice(0, 3).map(order => (
                                  <span key={order.id}>
                                    #{order.orderNumber} {getMaintenanceStatusLabel(order.status)}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="mt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs"
                              onClick={() => handleOpenMaintenanceDialog(equipment)}
                            >
                              Gerenciar OS
                            </Button>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="mr-2"
                            onClick={() => openEditDialog(equipment)}
                          >
                            Editar
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600"
                            onClick={() => handleRemoveEquipment(equipment.id)}
                          >
                            Remover
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center space-x-2 mt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                Anterior
              </Button>
              <span className="text-sm text-gray-600">
                Página {currentPage} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
              >
                Próxima
              </Button>
            </div>
          )}
          
          <div className="mt-4 text-center text-sm text-gray-500">
            Mostrando {paginatedEquipments.length} de {displayedEquipments.length} equipamentos
          </div>
        </CardContent>
      </Card>

      {/* Add Equipment Dialog */}
      <AddEquipmentDialog 
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onAddEquipment={handleAddEquipment}
      />

      {/* Edit Equipment Dialog */}
      {currentEquipment && (
        <EditEquipmentDialog 
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          equipment={currentEquipment}
          onEditEquipment={handleEditEquipment}
          sectors={sectors}
        />
      )}

      <Dialog open={maintenanceDialogOpen} onOpenChange={setMaintenanceDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Gerenciar OS do equipamento</DialogTitle>
            <DialogDescription>
              {maintenanceEquipment ? (
                <>
                  Equipamento <strong>{maintenanceEquipment.name}</strong> (KP {maintenanceEquipment.kp}) — Setor {maintenanceEquipment.sector}
                </>
              ) : (
                "Selecione um equipamento para registrar a OS."
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-gray-600">
                Número da OS
              </label>
              <Input
                value={maintenanceOrderNumber}
                onChange={(event) => setMaintenanceOrderNumber(event.target.value)}
                placeholder="Informe o número da OS"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-gray-600">
                Status
              </label>
              <Select
                value={maintenanceStatus}
                onValueChange={(value) => setMaintenanceStatus(value as MaintenanceOrder["status"])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Em andamento</SelectItem>
                  <SelectItem value="closed">Finalizada</SelectItem>
                  <SelectItem value="cancelled">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-gray-600">
                Observações (opcional)
              </label>
              <Textarea
                value={maintenanceNotes}
                onChange={(event) => setMaintenanceNotes(event.target.value)}
                rows={3}
                placeholder="Descreva ações, prazos ou responsáveis"
              />
            </div>
          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex w-full sm:w-auto gap-2">
              <Button className="flex-1 sm:flex-none" variant="outline" onClick={() => setMaintenanceDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                className="flex-1 sm:flex-none"
                variant="destructive"
                onClick={handleDeleteMaintenanceOrders}
                disabled={!maintenanceEquipment || !hasOrdersForSelectedEquipment}
              >
                Excluir OS
              </Button>
            </div>
            <Button onClick={handleSaveMaintenanceOrder} disabled={!maintenanceEquipment}>
              Salvar OS
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminEquipment;
