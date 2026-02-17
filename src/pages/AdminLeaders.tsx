import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { RefreshCw, Plus, Edit, Trash2, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSupabaseData } from "@/hooks/useSupabaseData";
import { leaderService } from "@/lib/supabase-service";
import AddLeaderDialog from "@/components/leaders/AddLeaderDialog";
import EditLeaderDialog from "@/components/leaders/EditLeaderDialog";

interface Leader {
  id: string;
  name: string;
  email: string;
  sector: string;
  password?: string;
  created_at?: string;
  updated_at?: string;
}

const AdminLeaders = () => {
  const { toast } = useToast();
  const {
    leaders,
    sectors,
    sectorLeaderAssignments,
    loading,
    error,
    refresh,
  } = useSupabaseData([
    "leaders",
    "sectors",
    "sectorLeaderAssignments",
  ]);
  
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedLeader, setSelectedLeader] = useState<Leader | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const handleAddLeader = async (leaderData: Omit<Leader, 'id'>) => {
    try {
      const passwordHash = btoa(leaderData.password || 'admin123'); // Base64 encoding
      
      await leaderService.create({
        name: leaderData.name,
        email: leaderData.email,
        sector: leaderData.sector,
        password_hash: passwordHash
      });
      
      toast({
        title: "Líder adicionado",
        description: "Líder criado com sucesso",
      });

      
      setShowAddDialog(false);
      refresh();
    } catch (error) {
      console.error('Error creating leader:', error);
      toast({
        title: "Erro",
        description: "Erro ao criar líder",
        variant: "destructive",
      });
    }
  };

  const handleEditLeader = async (leaderData: Leader & { newPassword?: string }) => {
    try {
      const updateData: any = {
        name: leaderData.name,
        email: leaderData.email,
        sector: leaderData.sector,
      };
      
      // Only update password if a new one was provided
      if (leaderData.newPassword) {
        updateData.password_hash = btoa(leaderData.newPassword);
      }
      
      await leaderService.update(leaderData.id, updateData);
      
      toast({
        title: "Líder atualizado",
        description: "Dados do líder atualizados com sucesso",
      });

      
      setShowEditDialog(false);
      setSelectedLeader(null);
      refresh();
    } catch (error) {
      console.error('Error updating leader:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar líder",
        variant: "destructive",
      });
    }
  };

  const handleDeleteLeader = async (leaderId: string) => {
    if (!confirm('Tem certeza que deseja excluir este líder?')) {
      return;
    }

    setIsDeleting(leaderId);
    try {
      await leaderService.delete(leaderId);
      
      toast({
        title: "Líder removido",
        description: "Líder excluído com sucesso",
      });

      
      refresh();
    } catch (error) {
      console.error('Error deleting leader:', error);
      toast({
        title: "Erro",
        description: "Erro ao excluir líder",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(null);
    }
  };

  const openEditDialog = (leader: Leader) => {
    setSelectedLeader(leader);
    setShowEditDialog(true);
  };

  const assignmentsByLeader = sectorLeaderAssignments.reduce<Record<string, typeof sectorLeaderAssignments>>(
    (acc, assignment) => {
      if (!acc[assignment.leader_id]) {
        acc[assignment.leader_id] = [];
      }
      acc[assignment.leader_id].push(assignment);
      return acc;
    },
    {},
  );

  const getLeaderSectors = (leaderId: string) => {
    const assignments = assignmentsByLeader[leaderId] ?? [];
    return assignments
      .map((assignment) => {
        const sector = sectors.find((item) => item.id === assignment.sector_id);
        if (!sector) return null;
        const shiftLabel = assignment.shift && assignment.shift !== "default" ? ` (${assignment.shift})` : "";
        return `${sector.name}${shiftLabel}`;
      })
      .filter((value): value is string => Boolean(value));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-red-700 border-t-transparent"></div>
          <p className="mt-4 text-gray-600">Carregando líderes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Gerenciar Líderes</h1>
        <div className="flex gap-2">
          <Button 
            onClick={refresh} 
            variant="outline" 
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </Button>
          <Button 
            onClick={() => setShowAddDialog(true)}
            className="flex items-center gap-2 bg-red-700 hover:bg-red-800"
          >
            <Plus className="h-4 w-4" />
            Adicionar Líder
          </Button>
        </div>
      </div>
      
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Erro ao carregar dados</AlertTitle>
          <AlertDescription>
            {error}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {leaders.map((leader) => {
          const leaderSectors = getLeaderSectors(leader.id);
          return (
          <Card key={leader.id}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                {leader.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-gray-600">
                <strong>Email:</strong> {leader.email}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Setores:</strong> {leaderSectors.length > 0 ? (
                  <span className="flex flex-wrap gap-1 mt-1">
                    {leaderSectors.map((sectorLabel) => (
                      <Badge key={`${leader.id}-${sectorLabel}`} variant="outline" className="text-xs">
                        {sectorLabel}
                      </Badge>
                    ))}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Sem vínculo registrado</span>
                )}
              </p>
              
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openEditDialog(leader)}
                  className="flex items-center gap-1"
                >
                  <Edit className="h-3 w-3" />
                  Editar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteLeader(leader.id)}
                  disabled={isDeleting === leader.id}
                  className="flex items-center gap-1 text-red-600 border-red-200 hover:bg-red-50"
                >
                  <Trash2 className="h-3 w-3" />
                  {isDeleting === leader.id ? "Excluindo..." : "Excluir"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )})}
      </div>

      {leaders.length === 0 && !loading && (
        <Card>
          <CardContent className="text-center py-8">
            <Users className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Nenhum líder encontrado
            </h3>
            <p className="text-gray-500 mb-4">
              Comece adicionando um líder ao sistema.
            </p>
            <Button 
              onClick={() => setShowAddDialog(true)}
              className="bg-red-700 hover:bg-red-800"
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Primeiro Líder
            </Button>
          </CardContent>
        </Card>
      )}

      <AddLeaderDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSubmit={handleAddLeader}
        sectors={sectors}
      />

      {selectedLeader && (
        <EditLeaderDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          onSubmit={handleEditLeader}
          leader={selectedLeader}
          sectors={sectors}
        />
      )}
    </div>
  );
};

export default AdminLeaders;
