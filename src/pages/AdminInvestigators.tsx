import React, { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  deleteInvestigatorAccount,
  listInvestigatorAccounts,
  upsertInvestigatorAccount,
} from "@/lib/adminCredentials";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const AdminInvestigators = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [investigators, setInvestigators] = useState<Array<{ username: string }>>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const loadInvestigators = async () => {
    setLoading(true);
    try {
      const data = await listInvestigatorAccounts();
      setInvestigators(data.map((item) => ({ username: item.username })));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadInvestigators();
  }, []);

  const handleSave = async () => {
    const normalizedUsername = username.trim().toLowerCase();
    if (!normalizedUsername || !password.trim()) {
      toast({
        title: "Dados obrigatorios",
        description: "Informe usuario e senha para salvar o investigador.",
        variant: "destructive",
      });
      return;
    }

    if (password.trim().length < 4) {
      toast({
        title: "Senha invalida",
        description: "A senha deve ter ao menos 4 caracteres.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const ok = await upsertInvestigatorAccount(normalizedUsername, password.trim());
      if (!ok) {
        toast({
          title: "Erro ao salvar",
          description: "Nao foi possivel salvar o investigador.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Investigador salvo",
        description: "Usuario de investigador atualizado com sucesso.",
      });
      setUsername("");
      setPassword("");
      await loadInvestigators();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (targetUsername: string) => {
    const confirmDelete =
      typeof window === "undefined"
        ? true
        : window.confirm(`Excluir investigador ${targetUsername}?`);
    if (!confirmDelete) return;

    setDeleting(targetUsername);
    try {
      const ok = await deleteInvestigatorAccount(targetUsername);
      if (!ok) {
        toast({
          title: "Erro ao remover",
          description: "Nao foi possivel excluir o investigador.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Investigador removido",
        description: "Usuario removido com sucesso.",
      });
      await loadInvestigators();
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Investigadores</h1>
        <p className="text-gray-600">
          Cadastre usuarios de investigacao para assinatura da ficha de acidente.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Novo Investigador</CardTitle>
          <CardDescription>
            Use este formulario para criar ou atualizar a senha de um investigador.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="investigator-username">Usuario</Label>
            <Input
              id="investigator-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ex: joao.silva"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="investigator-password">Senha</Label>
            <Input
              id="investigator-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nova senha"
            />
          </div>

          <div className="flex items-end">
            <Button
              type="button"
              className="w-full bg-red-700 hover:bg-red-800"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Salvando..." : "Salvar Investigador"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Investigadores Cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-gray-600">Carregando investigadores...</div>
          ) : investigators.length === 0 ? (
            <div className="text-sm text-gray-600">Nenhum investigador cadastrado.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead className="text-right">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {investigators.map((investigator) => (
                  <TableRow key={investigator.username}>
                    <TableCell>{investigator.username}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(investigator.username)}
                        disabled={deleting === investigator.username}
                      >
                        {deleting === investigator.username ? "Removendo..." : "Excluir"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminInvestigators;
