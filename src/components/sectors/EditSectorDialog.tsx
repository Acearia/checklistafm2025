import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  sectorService,
  sectorLeaderAssignmentService,
  type Sector,
  type Leader,
  type SectorLeaderAssignment,
} from "@/lib/supabase-service";

const SHIFT_OPTIONS = [
  { value: "default", label: "Padrão" },
  { value: "1T", label: "1º Turno" },
  { value: "2T", label: "2º Turno" },
  { value: "Supervisor", label: "Supervisor" },
];

interface EditSectorDialogProps {
  sector: Sector | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSectorUpdated: () => void;
  leaders: Leader[];
  assignments: SectorLeaderAssignment[];
}

const EditSectorDialog = ({
  sector,
  open,
  onOpenChange,
  onSectorUpdated,
  leaders,
  assignments,
}: EditSectorDialogProps) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedLeaderId, setSelectedLeaderId] = useState<string | null>(null);
  const [selectedShift, setSelectedShift] = useState<string>("default");
  const [loading, setLoading] = useState(false);
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (sector) {
      setName(sector.name || "");
      setDescription(sector.description || "");
      setSelectedLeaderId(null);
      setSelectedShift("default");
    }
  }, [sector]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sector || !name.trim()) {
      toast({
        title: "Erro",
        description: "Nome do setor é obrigatório",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const normalizedDescription = description.trim();

      await sectorService.update(sector.id, {
        name: name.trim(),
        description: normalizedDescription ? normalizedDescription : null,
      });

      toast({
        title: "Sucesso",
        description: "Setor atualizado com sucesso",
      });


      onOpenChange(false);
      onSectorUpdated();
    } catch (error) {
      console.error("Erro ao atualizar setor:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o setor",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const sectorAssignments = assignments.filter(
    (assignment) => assignment.sector_id === sector?.id,
  );

  const handleAddAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sector || !selectedLeaderId) {
      toast({
        title: "Selecione um líder",
        description: "Escolha um líder para atribuir ao setor.",
        variant: "destructive",
      });
      return;
    }

    setAssignmentLoading(true);
    try {
      await sectorLeaderAssignmentService.create({
        sector_id: sector.id,
        leader_id: selectedLeaderId,
        shift: selectedShift,
      });
      toast({
        title: "Líder atribuído",
        description: "Atribuição registrada com sucesso.",
      });
      setSelectedLeaderId(null);
      setSelectedShift("default");
      onSectorUpdated();
    } catch (error) {
      console.error("Erro ao atribuir líder ao setor:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atribuir o líder ao setor.",
        variant: "destructive",
      });
    } finally {
      setAssignmentLoading(false);
    }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    setAssignmentLoading(true);
    try {
      await sectorLeaderAssignmentService.delete(assignmentId);
      toast({
        title: "Atribuição removida",
        description: "O líder foi desvinculado do setor.",
      });
      onSectorUpdated();
    } catch (error) {
      console.error("Erro ao remover atribuição de líder:", error);
      toast({
        title: "Erro",
        description: "Não foi possível remover o líder do setor.",
        variant: "destructive",
      });
    } finally {
      setAssignmentLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Editar Setor</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Nome do Setor *</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Manutenção"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="edit-description">Descrição</Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição do setor..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Atribuições de Líder</Label>
            {sectorAssignments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum líder atribuído a este setor.</p>
            ) : (
              <div className="space-y-2">
                {sectorAssignments.map((assignment) => {
                  const leader = leaders.find((item) => item.id === assignment.leader_id);
                  if (!leader) return null;
                  return (
                    <div
                      key={assignment.id}
                      className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-medium">{leader.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {leader.email} • Turno: {assignment.shift || "Padrão"}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveAssignment(assignment.id)}
                        disabled={assignmentLoading}
                      >
                        Remover
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-4 space-y-2 rounded-md border border-border/60 p-3">
              <p className="text-sm font-medium">Adicionar nova atribuição</p>
              <div className="space-y-2">
                <Select
                  value={selectedLeaderId ?? ""}
                  onValueChange={(value) => setSelectedLeaderId(value || null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um líder" />
                  </SelectTrigger>
                  <SelectContent>
                    {leaders.map((leader) => (
                      <SelectItem key={leader.id} value={leader.id}>
                        {leader.name} - {leader.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Select value={selectedShift} onValueChange={setSelectedShift}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o turno" />
                  </SelectTrigger>
                  <SelectContent>
                    {SHIFT_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                onClick={handleAddAssignment}
                disabled={assignmentLoading}
              >
                {assignmentLoading ? "Salvando..." : "Adicionar líder"}
              </Button>
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditSectorDialog;
