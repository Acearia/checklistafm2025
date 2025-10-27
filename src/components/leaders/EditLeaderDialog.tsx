import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Leader {
  id: string;
  name: string;
  email: string;
  sector: string;
}

interface Sector {
  id: string;
  name: string;
  description?: string;
}

interface EditLeaderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (leader: Leader) => void;
  leader: Leader;
  sectors: Sector[];
}

const EditLeaderDialog = ({ open, onOpenChange, onSubmit, leader, sectors }: EditLeaderDialogProps) => {
  const [formData, setFormData] = useState<Leader>(leader);
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    setFormData(leader);
  }, [leader]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.sector) {
      return;
    }

    const submitData = { ...formData };
    if (newPassword) {
      (submitData as any).newPassword = newPassword;
    }

    onSubmit(submitData);
  };

  const handleChange = (field: keyof Leader, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Editar Líder</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Nome</Label>
            <Input
              id="edit-name"
              placeholder="Nome completo do líder"
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-email">Email</Label>
            <Input
              id="edit-email"
              type="email"
              placeholder="email@empresa.com"
              value={formData.email}
              onChange={(e) => handleChange("email", e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-sector">Setor</Label>
            <Select value={formData.sector} onValueChange={(value) => handleChange("sector", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um setor" />
              </SelectTrigger>
              <SelectContent>
                {sectors.map((sector) => (
                  <SelectItem key={sector.id} value={sector.name}>
                    {sector.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-password">Nova Senha (deixe em branco para manter a atual)</Label>
            <Input
              id="edit-password"
              type="password"
              placeholder="Digite nova senha (opcional)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-red-700 hover:bg-red-800"
            >
              Salvar Alterações
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditLeaderDialog;