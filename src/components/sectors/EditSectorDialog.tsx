import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { sectorService, operatorService, type Sector } from "@/lib/supabase-service";

interface EditSectorDialogProps {
  sector: Sector | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSectorUpdated: () => void;
  leaders: Array<{ id: string; name: string; email?: string | null; operator_matricula: string; setor?: string | null }>;
}

const NO_LEADER_VALUE = "none";

const EditSectorDialog = ({ sector, open, onOpenChange, onSectorUpdated, leaders }: EditSectorDialogProps) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [leaderMatricula, setLeaderMatricula] = useState<string>(NO_LEADER_VALUE);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (sector) {
      setName(sector.name || "");
      setDescription(sector.description || "");
      setLeaderMatricula(sector.leader_operator_matricula ?? NO_LEADER_VALUE);
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
      const normalizedLeader = leaderMatricula === NO_LEADER_VALUE ? null : leaderMatricula;

      await sectorService.update(sector.id, {
        name: name.trim(),
        description: normalizedDescription ? normalizedDescription : null,
        leader_operator_matricula: normalizedLeader,
      });

      if (normalizedLeader) {
        await operatorService.update(normalizedLeader, { is_leader: true });
      }

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
            <Label htmlFor="edit-leader">Líder Responsável</Label>
            <Select
              value={leaderMatricula}
              onValueChange={setLeaderMatricula}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um líder (opcional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_LEADER_VALUE}>Nenhum líder</SelectItem>
                {leaders.map((leader) => (
                  <SelectItem key={leader.id} value={leader.operator_matricula}>
                    {leader.name} - {leader.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
