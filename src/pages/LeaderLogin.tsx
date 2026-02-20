import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useSupabaseData } from "@/hooks/useSupabaseData";
import { leaderService } from "@/lib/supabase-service";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const LeaderLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { leaders, loading: leadersLoading } = useSupabaseData(["leaders"]);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [pendingLeaderId, setPendingLeaderId] = useState<string | null>(null);
  const [pendingLeaderName, setPendingLeaderName] = useState<string>("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  const DEFAULT_PASSWORD_HASH = btoa("1234");
  const LOCAL_SUPER_EMAIL = "teste@local";
  const LOCAL_SUPER_PASSWORD = "teste123";
  const LOCAL_PROFILE_KEY = "checklistafm-leader-local-profile";

  const isPrivateHost = (hostname: string) => {
    if (!hostname) return false;
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") return true;
    if (/^10\./.test(hostname)) return true;
    if (/^192\.168\./.test(hostname)) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)) return true;
    return false;
  };

  const isLocalMode = () =>
    typeof window !== "undefined" && isPrivateHost(window.location.hostname);

  useEffect(() => {
    // Check if already logged in
    const isAuthenticated = localStorage.getItem("checklistafm-leader-auth");
    if (isAuthenticated) {
      navigate("/leader/dashboard");
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast({
        title: "Erro",
        description: "Por favor, informe email e senha",
        variant: "destructive",
      });
      setErrorMessage("Informe email e senha para continuar.");
      return;
    }

    setLoading(true);

    try {
      const isLocalSuperUser =
        isLocalMode() &&
        email.trim().toLowerCase() === LOCAL_SUPER_EMAIL &&
        password === LOCAL_SUPER_PASSWORD;

      if (isLocalSuperUser) {
        localStorage.setItem("checklistafm-leader-auth", "true");
        localStorage.setItem("checklistafm-leader-id", "__local_super__");
        localStorage.setItem("checklistafm-leader-sector", "TODOS");
        localStorage.setItem(
          LOCAL_PROFILE_KEY,
          JSON.stringify({
            id: "__local_super__",
            name: "Usuario Local",
            email: LOCAL_SUPER_EMAIL,
            sector: "TODOS",
          }),
        );

        toast({
          title: "Login local realizado",
          description: "Acesso local liberado com permissao total.",
        });
        setErrorMessage(null);
        navigate("/leader/dashboard");
        return;
      }

      // Wait for leaders data to load if still loading
      if (leadersLoading) {
        toast({
          title: "Aguarde",
          description: "Carregando dados dos líderes...",
        });
        setLoading(false);
        return;
      }
      
      // Find leader by email and validate password
      const leader = leaders.find(l => l.email.toLowerCase() === email.toLowerCase());

      // Simple password validation (in production, use proper hashing)
      const passwordHash = btoa(password); // Base64 encoding for simplicity
      
      if (leader && leader.password_hash === passwordHash) {
        if (leader.password_hash === DEFAULT_PASSWORD_HASH) {
          setPendingLeaderId(leader.id);
          setPendingLeaderName(leader.name);
          setResetDialogOpen(true);
          setLoading(false);
          setPassword("");
          toast({
            title: "Nova senha necessária",
            description: "Defina uma nova senha para continuar.",
          });
          return;
        }

        // Simulate login delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Set authentication data
        localStorage.setItem("checklistafm-leader-auth", "true");
        localStorage.setItem("checklistafm-leader-id", leader.id);
        localStorage.setItem("checklistafm-leader-sector", leader.sector);
        
        toast({
          title: "Login realizado com sucesso",
          description: `Bem-vindo(a), ${leader.name}`,
        });
        setErrorMessage(null);
        navigate("/leader/dashboard");
      } else {
        const message = leader ? "Senha incorreta. Verifique e tente novamente." : "Email não encontrado. Verifique suas credenciais.";
        setErrorMessage(message);
        toast({
          title: "Erro",
          description: message,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Erro ao realizar login:", error);
      setErrorMessage("Erro ao realizar login. Tente novamente.");
      toast({
        title: "Erro",
        description: "Erro ao realizar login",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingLeaderId) return;

    if (newPassword.trim().length < 4) {
      toast({
        title: "Senha inválida",
        description: "A nova senha deve ter pelo menos 4 caracteres.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmNewPassword) {
      toast({
        title: "Senhas não coincidem",
        description: "Digite a mesma senha nos dois campos.",
        variant: "destructive",
      });
      return;
    }

    try {
      setResetLoading(true);
      const newHash = btoa(newPassword.trim());
      await leaderService.update(pendingLeaderId, {
        password_hash: newHash,
      });

      localStorage.setItem("checklistafm-leader-auth", "true");
      localStorage.setItem("checklistafm-leader-id", pendingLeaderId);
      const pendingLeader = leaders.find((leader) => leader.id === pendingLeaderId);
      if (pendingLeader) {
        localStorage.setItem("checklistafm-leader-sector", pendingLeader.sector);
      }
      toast({
        title: "Senha definida",
        description: "Senha atualizada com sucesso. Entrando...",
      });
      navigate("/leader/dashboard");
    } catch (error) {
      console.error("Erro ao atualizar senha do líder:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar a senha. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setResetLoading(false);
      setResetDialogOpen(false);
      setNewPassword("");
      setConfirmNewPassword("");
      setPendingLeaderId(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div className="h-20 bg-red-700 w-full">
        <Link to="/" className="flex items-center h-full px-4 md:px-6">
          <h1 className="text-white text-xl font-bold">Checklist AFM</h1>
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl font-bold">Painel de Líderes</CardTitle>
            <CardDescription>
              Acesse o painel de líderes usando seu email
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Input
                  id="email"
                  placeholder="Seu email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Input
                  id="password"
                  placeholder="Sua senha"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                {errorMessage && (
                  <p className="text-sm text-red-600">{errorMessage}</p>
                )}
              </div>

               <Button
                 className="w-full bg-red-700 hover:bg-red-800"
                 type="submit"
                 disabled={loading || leadersLoading}
               >
                 {(loading || leadersLoading) ? (
                   <span className="flex items-center gap-2">
                     <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                     {leadersLoading ? "Carregando..." : "Entrando..."}
                   </span>
                ) : (
                  "Entrar"
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="border-t px-6 py-4">
            <div className="flex flex-col md:flex-row items-center justify-center w-full text-sm gap-2">
              <Link to="/" className="text-blue-700 hover:underline">
                Voltar para página inicial
              </Link>
              <span className="hidden md:inline">•</span>
              <Link to="/admin/login" className="text-blue-700 hover:underline">
                Acesso administrativo
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>

      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Definir nova senha</DialogTitle>
            <DialogDescription>
              Por segurança, defina uma nova senha para continuar o acesso, {pendingLeaderName || "líder"}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Nova senha"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={4}
                required
              />
            </div>
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Confirme a nova senha"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                minLength={4}
                required
              />
            </div>
            <DialogFooter className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setResetDialogOpen(false)}
                disabled={resetLoading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={resetLoading}>
                {resetLoading ? "Salvando..." : "Salvar nova senha"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LeaderLogin;
