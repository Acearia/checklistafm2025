
import React, { useState } from "react";
import { useSupabaseData } from "@/hooks/useSupabaseData";
import { sectorService, type Sector } from "@/lib/supabase-service";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Edit, Trash2, Building2 } from "lucide-react";
import AddSectorDialog from "./AddSectorDialog";
import EditSectorDialog from "./EditSectorDialog";

const SectorManagement = () => {
  const { toast } = useToast();
  const {
    sectors,
    leaders,
    sectorLeaderAssignments,
    loading,
    error,
    refresh,
  } = useSupabaseData([
    "sectors",
    "leaders",
    "sectorLeaderAssignments",
  ]);

  const [editingSector, setEditingSector] = useState<Sector | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const handleEdit = (sector: Sector) => {
    setEditingSector(sector);
    setEditDialogOpen(true);
  };

  const handleDelete = async (sectorId: string) => {
    try {
      await sectorService.delete(sectorId);
      toast({
        title: "Sucesso",
        description: "Setor removido com sucesso",
      });
      refresh();
    } catch (error) {
      console.error("Erro ao remover setor:", error);
      toast({
        title: "Erro",
        description: "Não foi possível remover o setor",
        variant: "destructive",
      });
    }
  };

  const assignmentsBySector = sectorLeaderAssignments.reduce<Record<string, typeof sectorLeaderAssignments>>(
    (acc, assignment) => {
      if (!acc[assignment.sector_id]) {
        acc[assignment.sector_id] = [];
      }
      acc[assignment.sector_id].push(assignment);
      return acc;
    },
    {},
  );

  const getLeadersForSector = (sectorId: string) => {
    const assignments = assignmentsBySector[sectorId] ?? [];
    return assignments
      .map((assignment) => {
        const leader = leaders.find((item) => item.id === assignment.leader_id);
        if (!leader) return null;
        const shiftLabel = assignment.shift && assignment.shift !== "default" ? ` (${assignment.shift})` : "";
        return `${leader.name}${shiftLabel}`;
      })
      .filter((value): value is string => Boolean(value));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-destructive p-4 border border-destructive/20 rounded bg-destructive/10">
        Erro ao carregar setores: {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Setores da Empresa</h2>
          <p className="text-muted-foreground">
            Gerencie os setores e atribua líderes responsáveis
          </p>
        </div>
        <AddSectorDialog onSectorAdded={refresh} leaders={leaders} />
      </div>

      {sectors.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum setor cadastrado</h3>
            <p className="text-muted-foreground text-center mb-4">
              Comece adicionando o primeiro setor da sua empresa
            </p>
            <AddSectorDialog onSectorAdded={refresh} leaders={leaders} />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Setores Cadastrados</CardTitle>
            <CardDescription>
              Total de {sectors.length} setores cadastrados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Líderes</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sectors.map((sector) => (
                  <TableRow key={sector.id}>
                    <TableCell className="font-medium">{sector.name}</TableCell>
                    <TableCell>
                      {sector.description || (
                        <span className="text-muted-foreground italic">
                          Sem descrição
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const leadersForSector = getLeadersForSector(sector.id);
                        if (leadersForSector.length === 0) {
                          return <Badge variant="outline">Sem líder</Badge>;
                        }

                        return (
                          <div className="flex flex-wrap gap-1">
                            {leadersForSector.map((label) => (
                              <Badge key={`${sector.id}-${label}`} variant="secondary">
                                {label}
                              </Badge>
                            ))}
                          </div>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(sector)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja excluir o setor "{sector.name}"? 
                                Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(sector.id)}>
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <EditSectorDialog
        sector={editingSector}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSectorUpdated={refresh}
        leaders={leaders}
        assignments={sectorLeaderAssignments}
      />
    </div>
  );
};

export default SectorManagement;
