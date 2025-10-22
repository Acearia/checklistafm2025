import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { sectorService } from "@/lib/supabase-service";

interface AddSectorDialogProps {
  onSectorAdded: () => void;
  leaders: Array<{ id: string; name: string; email?: string | null; operator_matricula: string; setor?: string | null }>;
}

const NO_LEADER_VALUE = "none";

const AddSectorDialog = ({ onSectorAdded, leaders }: AddSectorDialogProps) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [leaderMatricula, setLeaderMatricula] = useState<string>(NO_LEADER_VALUE);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
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

      await sectorService.create({
        name: name.trim(),
        description: normalizedDescription ? normalizedDescription : null,
        leader_operator_matricula: normalizedLeader,
      });

      toast({
        title: "Sucesso",
        description: "Setor adicionado com sucesso",
      });


      setName("");
      setDescription("");
      setLeaderMatricula(NO_LEADER_VALUE);
      setOpen(false);
      onSectorAdded();
    } catch (error) {
      console.error("Erro ao adicionar setor:", error);
      toast({
        title: "Erro",
        description: "Não foi possível adicionar o setor",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Adicionar Setor
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Adicionar Novo Setor</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome do Setor *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Manutenção"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição do setor..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="leader">Líder Responsável</Label>
            <Select value={leaderMatricula} onValueChange={setLeaderMatricula}>
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
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Adicionando..." : "Adicionar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddSectorDialog;
