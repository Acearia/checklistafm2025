import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { 
  RefreshCw, 
  Users, 
  UserCheck, 
  Building2, 
  TrendingUp,
  Activity,
  Plus,
  Settings,
  AlertCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSupabaseData } from "@/hooks/useSupabaseData";

const AdminLeaderDashboard = () => {
  const { toast } = useToast();
  const {
    leaders,
    sectors,
    sectorLeaderAssignments,
    operators,
    equipment,
    inspections,
    loading,
    error,
    refresh,
  } = useSupabaseData([
    "leaders",
    "sectors",
    "sectorLeaderAssignments",
    "operators",
    "equipment",
    "inspections",
  ]);

  // Calculate statistics
  const getLeaderStats = () => {
    const uniqueLeaderIds = new Set(sectorLeaderAssignments.map((assignment) => assignment.leader_id));
    const totalLeaders = uniqueLeaderIds.size;
    const totalSectors = sectors.length;
    const sectorsWithLeaders = sectors.filter((sector) =>
      sectorLeaderAssignments.some((assignment) => assignment.sector_id === sector.id),
    ).length;
    const sectorsWithoutLeaders = totalSectors - sectorsWithLeaders;

    const leadersBySector = sectors.map((sector) => {
      const assignmentsForSector = sectorLeaderAssignments.filter(
        (assignment) => assignment.sector_id === sector.id,
      );
      const sectorLeaders = assignmentsForSector
        .map((assignment) => {
          const leader = leaders.find((item) => item.id === assignment.leader_id);
          if (!leader) return null;
          return { leader, shift: assignment.shift };
        })
        .filter((value): value is { leader: typeof leaders[number]; shift: string | null } => Boolean(value));
      const sectorOperators = operators.filter(op => op.setor === sector.name);
      const sectorEquipment = equipment.filter(eq => eq.sector === sector.name);
      
      // Get inspections for this sector
      const sectorEquipmentIds = sectorEquipment.map(eq => eq.id);
      const sectorInspections = inspections.filter(insp => 
        sectorEquipmentIds.includes(insp.equipment_id)
      );

      return {
        sector: sector.name,
        description: sector.description,
        leaders: sectorLeaders,
        operatorCount: sectorOperators.length,
        equipmentCount: sectorEquipment.length,
        inspectionCount: sectorInspections.length,
        hasLeader: sectorLeaders.length > 0
      };
    });

    return {
      totalLeaders,
      totalSectors,
      sectorsWithLeaders,
      sectorsWithoutLeaders,
      leadersBySector
    };
  };

  const stats = getLeaderStats();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-red-700 border-t-transparent"></div>
          <p className="mt-4 text-gray-600">Carregando dados dos líderes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Dashboard de Líderes</h1>
          <p className="text-gray-600">
            Visão geral da liderança por setores
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={refresh} 
            variant="outline" 
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </Button>
          <Link to="/admin/leaders">
            <Button className="flex items-center gap-2 bg-red-700 hover:bg-red-800">
              <Settings className="h-4 w-4" />
              Definir Líderes
            </Button>
          </Link>
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

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" />
              Total de Líderes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.totalLeaders}</div>
            <p className="text-xs text-gray-500">Líderes cadastrados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Building2 className="h-4 w-4 text-green-600" />
              Setores com Líderes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.sectorsWithLeaders}</div>
            <p className="text-xs text-gray-500">de {stats.totalSectors} setores</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-orange-600" />
              Setores sem Líder
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.sectorsWithoutLeaders}</div>
            <p className="text-xs text-gray-500">precisam de líderes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4 text-purple-600" />
              Cobertura
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {stats.totalSectors > 0 ? Math.round((stats.sectorsWithLeaders / stats.totalSectors) * 100) : 0}%
            </div>
            <p className="text-xs text-gray-500">setores cobertos</p>
          </CardContent>
        </Card>
      </div>

      {/* Sectors Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Visão Geral por Setor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {stats.leadersBySector.map((sectorData) => (
              <div key={sectorData.sector} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold">{sectorData.sector}</h3>
                    <Badge variant={sectorData.hasLeader ? "default" : "secondary"}>
                    {sectorData.hasLeader ? "Com Líder" : "Sem Líder"}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600 mb-2">{sectorData.description}</p>
                  
                  {sectorData.leaders.length > 0 && (
                    <div className="mb-2">
                      <p className="text-sm font-medium">Líderes:</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {sectorData.leaders.map(({ leader, shift }) => (
                          <Badge key={`${leader.id}-${shift}`} variant="outline" className="text-xs">
                            {leader.name}
                            {shift && shift !== "default" ? ` (${shift})` : ""}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="flex gap-4 text-sm text-gray-500">
                    <span>{sectorData.operatorCount} operadores</span>
                    <span>{sectorData.equipmentCount} equipamentos</span>
                    <span>{sectorData.inspectionCount} inspeções</span>
                  </div>
                </div>
                
                <div className="flex flex-col gap-2">
                  {!sectorData.hasLeader && (
                    <Link to="/admin/leaders">
                      <Button size="sm" variant="outline" className="text-xs">
                        <Plus className="h-3 w-3 mr-1" />
                        Definir líder
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          {stats.leadersBySector.length === 0 && (
            <div className="text-center py-8">
              <Building2 className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Nenhum setor encontrado
              </h3>
              <p className="text-gray-500 mb-4">
                Configure setores primeiro para atribuir líderes.
              </p>
              <Link to="/admin/sectors">
                <Button variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Configurar Setores
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminLeaderDashboard;
