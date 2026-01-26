import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Save, KeyRound, Bell, Database, Shield, Server, AlertCircle, Briefcase, ExternalLink } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Link } from "react-router-dom";
import {
  ensureDefaultAdminAccounts,
  listAdminAccounts,
  updateAdminPassword,
  verifyAdminCredentials,
} from "@/lib/adminCredentials";

interface Leader {
  id: string;
  name: string;
  email: string;
  sector: string;
  password?: string;
  assignedOperators: string[];
  assignedEquipments: string[];
}

const AdminSettings = () => {
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [notifyNewInspections, setNotifyNewInspections] = useState(true);
  const [notifyIssues, setNotifyIssues] = useState(true);
  const [proxmoxOpen, setProxmoxOpen] = useState(false);
  const [testDbConnection, setTestDbConnection] = useState(false);
  const [dbConnectionResult, setDbConnectionResult] = useState("");
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [session, setSession] = useState<{ username: string; role: string } | null>(null);

  const [selectedLeader, setSelectedLeader] = useState<Leader | null>(null);
  const [leaderPassword, setLeaderPassword] = useState("");
  const [confirmLeaderPassword, setConfirmLeaderPassword] = useState("");
  const [adminAccounts, setAdminAccounts] = useState<{ username: string; role: string }[]>([]);
  const [selectedAdminAccount, setSelectedAdminAccount] = useState("");
  const [adminAccountPassword, setAdminAccountPassword] = useState("");
  const [adminAccountConfirmPassword, setAdminAccountConfirmPassword] = useState("");

  useEffect(() => {
    const init = async () => {
      await ensureDefaultAdminAccounts();
      const accounts = await listAdminAccounts();
      setAdminAccounts(accounts);
      if (!selectedAdminAccount && accounts.length > 0) {
        setSelectedAdminAccount(accounts[0].username);
      }
      const savedLeaders = localStorage.getItem("checklistafm-leaders");
      const leadersList = savedLeaders ? JSON.parse(savedLeaders) : [];
      setLeaders(leadersList);

      if (typeof window !== "undefined") {
        const storedSession = sessionStorage.getItem("checklistafm-admin-session");
        if (storedSession) {
          try {
            setSession(JSON.parse(storedSession));
          } catch (error) {
            console.error("Erro ao ler sessão administrativa:", error);
            sessionStorage.removeItem("checklistafm-admin-session");
          }
        }
      }
    };

    void init();
  }, []);

  const isAdminUser = session?.role === "admin";

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !isAdminUser) {
      toast({
        title: "Acesso restrito",
        description: "Somente o usuário ADMIN pode alterar esta senha.",
        variant: "destructive",
      });
      return;
    }

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({
        title: "Erro",
        description: "Todos os campos são obrigatórios",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Erro",
        description: "As senhas não coincidem",
        variant: "destructive",
      });
      return;
    }

    try {
      const verified = await verifyAdminCredentials(session.username, currentPassword);
      if (!verified) {
        toast({
          title: "Erro",
          description: "Senha atual incorreta",
          variant: "destructive",
        });
        return;
      }

      const updated = await updateAdminPassword(session.username, newPassword);
      if (!updated) {
        toast({
          title: "Erro",
          description: "Não foi possível atualizar a senha agora.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Senha Atualizada",
        description: "Sua senha foi atualizada com sucesso",
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error("Erro ao atualizar senha administrativa:", error);
      toast({
        title: "Erro inesperado",
        description: "Não foi possível atualizar a senha agora. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleSaveAdminAccountPassword = async () => {
    if (!isAdminUser) {
      toast({
        title: "Acesso restrito",
        description: "Somente o usuário ADMIN pode alterar outras contas.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedAdminAccount) {
      toast({
        title: "Selecione uma conta",
        description: "Escolha qual usuário deseja atualizar.",
        variant: "destructive",
      });
      return;
    }

    if (!adminAccountPassword || !adminAccountConfirmPassword) {
      toast({
        title: "Erro",
        description: "Todos os campos são obrigatórios",
        variant: "destructive",
      });
      return;
    }

    if (adminAccountPassword !== adminAccountConfirmPassword) {
      toast({
        title: "Erro",
        description: "As senhas não coincidem",
        variant: "destructive",
      });
      return;
    }

    try {
      const updated = await updateAdminPassword(selectedAdminAccount, adminAccountPassword);
      if (!updated) {
        toast({
          title: "Erro",
          description: "Não foi possível atualizar a senha dessa conta agora.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Senha Atualizada",
        description: `Senha da conta ${selectedAdminAccount} atualizada com sucesso`,
      });
      setAdminAccountPassword("");
      setAdminAccountConfirmPassword("");
    } catch (error) {
      console.error("Erro ao atualizar senha de outra conta:", error);
      toast({
        title: "Erro inesperado",
        description: "Não foi possível atualizar a senha agora. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleSaveLeaderPassword = () => {
    if (!selectedLeader) return;
    if (!leaderPassword || !confirmLeaderPassword) {
      toast({
        title: "Erro",
        description: "Todos os campos são obrigatórios",
        variant: "destructive",
      });
      return;
    }
    if (leaderPassword !== confirmLeaderPassword) {
      toast({
        title: "Erro",
        description: "As senhas não coincidem",
        variant: "destructive",
      });
      return;
    }

    const updatedLeaders = leaders.map((leader) => {
      if (leader.id === selectedLeader.id) {
        return {
          ...leader,
          password: leaderPassword,
        };
      }
      return leader;
    });
    setLeaders(updatedLeaders);
    localStorage.setItem("checklistafm-leaders", JSON.stringify(updatedLeaders));
    toast({
      title: "Senha Definida",
      description: `Senha para ${selectedLeader.name} foi definida com sucesso`,
    });
    setLeaderPassword("");
    setConfirmLeaderPassword("");
    setSelectedLeader(null);
  };

  const handleSaveNotifications = () => {
    toast({
      title: "Configurações Salvas",
      description: "Suas preferências de notificação foram atualizadas",
    });
  };

  const handleSaveDatabase = () => {
    setTestDbConnection(true);

    setTimeout(() => {
      setTestDbConnection(false);
      setDbConnectionResult("error");
      toast({
        title: "Erro de Conexão",
        description:
          "Não foi possível conectar ao banco de dados com as configurações fornecidas. Verifique os parâmetros e tente novamente.",
        variant: "destructive",
      });
    }, 2000);
  };

  const handleRemoveLeader = (leaderId: string) => {
    const updatedLeaders = leaders.filter((leader) => leader.id !== leaderId);
    setLeaders(updatedLeaders);
    localStorage.setItem("checklistafm-leaders", JSON.stringify(updatedLeaders));
    toast({
      title: "Líder Removido",
      description: "O líder foi removido com sucesso",
    });
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Configurações</h1>

      <Tabs defaultValue="account">
        <TabsList className="mb-6">
          <TabsTrigger value="account" className="flex items-center">
            <KeyRound className="mr-2 h-4 w-4" />
            Conta
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center">
            <Bell className="mr-2 h-4 w-4" />
            Notificações
          </TabsTrigger>

          <TabsTrigger value="security" className="flex items-center">
            <Shield className="mr-2 h-4 w-4" />
            Segurança
          </TabsTrigger>
        </TabsList>

        <TabsContent value="account">
          <Card>
            <form onSubmit={handleSavePassword}>
              <CardHeader>
                <CardTitle>Alterar Senha</CardTitle>
                <CardDescription>
                  Atualize sua senha de acesso à área administrativa
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current-password">Senha Atual</Label>
                  <Input
                    id="current-password"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    disabled={!isAdminUser}
                  />
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label htmlFor="new-password">Nova Senha</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={!isAdminUser}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={!isAdminUser}
                  />
                  {!isAdminUser && (
                    <p className="text-xs text-muted-foreground">
                      Apenas o usuário ADMIN pode atualizar esta senha.
                    </p>
                  )}
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  type="submit"
                  className="bg-red-700 hover:bg-red-800"
                  disabled={!isAdminUser}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Salvar Alterações
                </Button>
          </CardFooter>
        </form>
      </Card>
      {isAdminUser && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Redefinir Senha de Outros Usuários</CardTitle>
            <CardDescription>
              Atualize a senha de qualquer conta administrativa sem realizar login separado.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-account-select">Usuário</Label>
              <select
                id="admin-account-select"
                value={selectedAdminAccount}
                onChange={(e) => setSelectedAdminAccount(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {adminAccounts.map((account) => (
                  <option key={account.username} value={account.username}>
                    {account.username} ({account.role})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-account-password">Nova Senha</Label>
              <Input
                id="admin-account-password"
                type="password"
                value={adminAccountPassword}
                onChange={(e) => setAdminAccountPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-account-confirm-password">Confirmar Nova Senha</Label>
              <Input
                id="admin-account-confirm-password"
                type="password"
                value={adminAccountConfirmPassword}
                onChange={(e) => setAdminAccountConfirmPassword(e.target.value)}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="button" variant="outline" onClick={handleSaveAdminAccountPassword}>
              <Save className="mr-2 h-4 w-4" />
              Atualizar Conta Selecionada
            </Button>
          </CardFooter>
        </Card>
      )}
    </TabsContent>

    <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Preferências de Notificação</CardTitle>
              <CardDescription>
                Gerencie como você deseja receber notificações do sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="notify-inspections">Novas Inspeções</Label>
                  <p className="text-sm text-gray-500">
                    Receber notificações quando novas inspeções forem registradas
                  </p>
                </div>
                <Switch
                  id="notify-inspections"
                  checked={notifyNewInspections}
                  onCheckedChange={setNotifyNewInspections}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="notify-issues">Problemas Detectados</Label>
                  <p className="text-sm text-gray-500">
                    Receber alertas quando problemas forem encontrados nas inspeções
                  </p>
                </div>
                <Switch
                  id="notify-issues"
                  checked={notifyIssues}
                  onCheckedChange={setNotifyIssues}
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button
                onClick={handleSaveNotifications}
                className="bg-red-700 hover:bg-red-800"
              >
                <Save className="mr-2 h-4 w-4" />
                Salvar Preferências
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Gerenciamento de Líderes</CardTitle>
                <CardDescription>
                  Defina ou remova senhas dos líderes cadastrados no sistema
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {leaders.length === 0 ? (
                  <div className="text-sm text-gray-500">
                    Nenhum líder cadastrado.
                  </div>
                ) : (
                  leaders.map((leader) => (
                    <div
                      key={leader.id}
                      className="border rounded-md p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                    >
                      <div>
                        <h3 className="font-semibold text-base">
                          {leader.name}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {leader.email} · {leader.sector}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Dialog
                          open={selectedLeader?.id === leader.id}
                          onOpenChange={(open) => {
                            if (open) {
                              setSelectedLeader(leader);
                            } else {
                              setSelectedLeader(null);
                              setLeaderPassword("");
                              setConfirmLeaderPassword("");
                            }
                          }}
                        >
                          <DialogTrigger asChild>
                            <Button variant="outline">Definir senha</Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>
                                Definir senha para {leader.name}
                              </DialogTitle>
                              <DialogDescription>
                                Informe a nova senha para este líder
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-3">
                              <div className="space-y-2">
                                <Label>Nova senha</Label>
                                <Input
                                  type="password"
                                  value={leaderPassword}
                                  onChange={(e) =>
                                    setLeaderPassword(e.target.value)
                                  }
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Confirmar senha</Label>
                                <Input
                                  type="password"
                                  value={confirmLeaderPassword}
                                  onChange={(e) =>
                                    setConfirmLeaderPassword(e.target.value)
                                  }
                                />
                              </div>
                            </div>
                            <DialogFooter>
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setSelectedLeader(null);
                                  setLeaderPassword("");
                                  setConfirmLeaderPassword("");
                                }}
                              >
                                Cancelar
                              </Button>
                              <Button onClick={handleSaveLeaderPassword}>
                                Salvar senha
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                        <Button
                          variant="outline"
                          className="text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => handleRemoveLeader(leader.id)}
                        >
                          Remover
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Ferramentas Externas</CardTitle>
                <CardDescription>
                  Acesse rapidamente os recursos de suporte e integração
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="border rounded-md p-4 space-y-2">
                  <h3 className="font-semibold flex items-center gap-2">
                    <ExternalLink className="h-4 w-4" />
                    Guia de Instalação Proxmox
                  </h3>
                  <p className="text-sm text-gray-600">
                    Acesse o passo a passo completo para configurar o ambiente
                    Proxmox.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() =>
                      window.open("https://proxmox.com/en/", "_blank")
                    }
                  >
                    Abrir documentação
                  </Button>
                </div>
                <div className="border rounded-md p-4 space-y-2">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Briefcase className="h-4 w-4" />
                    Suporte Checklist AFM
                  </h3>
                  <p className="text-sm text-gray-600">
                    Canal direto com o time de suporte para dúvidas e
                    configurações.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => window.open("mailto:support@checklistafm.com")}
                  >
                    Enviar e-mail
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="database">
          <Card>
            <CardHeader>
              <CardTitle>Configurações do Banco de Dados</CardTitle>
              <CardDescription>
                Gerencie a conexão com o banco de dados da aplicação
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {dbConnectionResult === "error" && (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Erro de Conexão</AlertTitle>
                  <AlertDescription>
                    Não foi possível conectar ao banco de dados. Verifique se o
                    serviço PostgreSQL está rodando e se as credenciais estão
                    corretas.
                  </AlertDescription>
                </Alert>
              )}

              <div className="bg-blue-50 p-4 rounded-md border border-blue-100 mb-4">
                <h3 className="text-blue-800 font-medium flex items-center">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Configuração de Banco de Dados
                </h3>
                <p className="text-sm text-blue-700 mt-2">
                  Para uma configuração mais detalhada do banco de dados com
                  opções avançadas, recomendamos utilizar a ferramenta completa
                  de conexão ao banco de dados.
                </p>
                <Link to="/admin/database">
                  <Button
                    variant="outline"
                    className="mt-2 bg-white border-blue-200 text-blue-700 hover:bg-blue-100"
                  >
                    <Database className="mr-2 h-4 w-4" />
                    Abrir Ferramenta de Conexão ao Banco de Dados
                  </Button>
                </Link>
              </div>

              <div className="space-y-2">
                <Label htmlFor="db-host">Host</Label>
                <Input id="db-host" placeholder="localhost" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="db-port">Porta</Label>
                <Input id="db-port" placeholder="5432" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="db-name">Nome do Banco</Label>
                <Input id="db-name" placeholder="checklistafm_db" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="db-user">Usuário</Label>
                <Input id="db-user" placeholder="admin" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="db-password">Senha</Label>
                <Input id="db-password" type="password" placeholder="••••••••" />
              </div>

              <div className="mt-6">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full flex items-center justify-center">
                      <Server className="mr-2 h-4 w-4" />
                      Configurar Banco de Dados no Proxmox
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Configuração do Banco de Dados no Proxmox</DialogTitle>
                      <DialogDescription>
                        Siga estas etapas para configurar um banco de dados
                        PostgreSQL no Proxmox
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <h3 className="text-sm font-medium">
                          1. Crie um Container (LXC) no Proxmox
                        </h3>
                        <ul className="list-disc pl-5 text-sm text-muted-foreground">
                          <li>Acesse o dashboard do Proxmox</li>
                          <li>Crie um novo container (LXC) com sistema Debian ou Ubuntu</li>
                          <li>Aloque pelo menos 2GB de RAM e 10GB de armazenamento</li>
                          <li>Configure uma rede com IP estático para facilitar o acesso</li>
                        </ul>
                      </div>

                      <div className="space-y-2">
                        <h3 className="text-sm font-medium">
                          2. Instale o PostgreSQL no Container
                        </h3>
                        <div className="bg-gray-100 p-2 rounded text-sm font-mono">
                          apt update<br />
                          apt install postgresql postgresql-contrib -y
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h3 className="text-sm font-medium">
                          3. Configure o PostgreSQL para Aceitar Conexões Remotas
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Edite o arquivo postgresql.conf:
                        </p>
                        <div className="bg-gray-100 p-2 rounded text-sm font-mono">
                          nano /etc/postgresql/*/main/postgresql.conf
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Altere a linha listen_addresses para:
                        </p>
                        <div className="bg-gray-100 p-2 rounded text-sm font-mono">
                          listen_addresses = '*'
                        </div>

                        <p className="text-sm text-muted-foreground mt-2">
                          Edite o arquivo pg_hba.conf:
                        </p>
                        <div className="bg-gray-100 p-2 rounded text-sm font-mono">
                          nano /etc/postgresql/*/main/pg_hba.conf
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Adicione esta linha ao final:
                        </p>
                        <div className="bg-gray-100 p-2 rounded text-sm font-mono">
                          host all all 0.0.0.0/0 md5
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h3 className="text-sm font-medium">
                          4. Reinicie o serviço PostgreSQL
                        </h3>
                        <div className="bg-gray-100 p-2 rounded text-sm font-mono">
                          systemctl restart postgresql
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setProxmoxOpen(false)}
                      >
                        Fechar
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              <CardFooter className="flex flex-col gap-3 items-start">
                <Button
                  onClick={handleSaveDatabase}
                  className="bg-red-700 hover:bg-red-800"
                  disabled={testDbConnection}
                >
                  {testDbConnection ? "Testando conexão..." : "Salvar Configurações"}
                </Button>
                <div className="text-sm text-muted-foreground">
                  <p>
                    As configurações de banco de dados são utilizadas para
                    relatórios avançados e integrações externas.
                  </p>
                  <p className="mt-1">
                    Certifique-se de que as credenciais estão corretas antes de
                    salvar.
                  </p>
                </div>
              </CardFooter>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminSettings;
