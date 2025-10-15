
import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Lock, LogIn, ArrowLeft } from "lucide-react";
import {
  ensureDefaultAdminAccounts,
  verifyAdminCredentials,
} from "@/lib/adminCredentials";

const AdminLogin = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectPath = searchParams.get("redirect") || "/admin";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const init = async () => {
      await ensureDefaultAdminAccounts();
      localStorage.removeItem("gearcheck-admin-auth");
      const auth = sessionStorage.getItem("checklistafm-admin-auth");
      if (auth === "true") {
        navigate(redirectPath);
      }
    };

    void init();
  }, [navigate, redirectPath]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await verifyAdminCredentials(username, password);

      if (result) {
        sessionStorage.setItem("checklistafm-admin-auth", "true");
        sessionStorage.setItem(
          "checklistafm-admin-session",
          JSON.stringify(result),
        );

        toast({
          title: "Login realizado com sucesso",
          description: `Bem-vindo ao painel administrativo, ${result.username}`
        });

        navigate(redirectPath);
      } else {
        toast({
          title: "Falha no login",
          description: "Usuário ou senha incorretos",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Erro no login administrativo:", error);
      toast({
        title: "Erro inesperado",
        description: "Não foi possível realizar o login agora. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToChecklist = () => {
    navigate("/");
    toast({
      title: "Retornando ao Checklist",
      description: "Você foi redirecionado para a página de checklist",
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            <div className="h-12 w-12 rounded-full bg-red-700 text-white flex items-center justify-center">
              <Lock size={24} />
            </div>
          </div>
          <CardTitle className="text-2xl text-center">Checklist AFM Admin</CardTitle>
          <CardDescription className="text-center">
            Entre com suas credenciais de administrador
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Usuário</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-2">
            <Button 
              type="submit" 
              className="w-full bg-red-700 hover:bg-red-800"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center gap-1">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Entrando...
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <LogIn size={16} />
                  Entrar
                </span>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full border-red-700 text-red-700 hover:bg-red-50"
              onClick={handleBackToChecklist}
            >
              <ArrowLeft size={16} className="mr-1" />
              Voltar ao Checklist
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default AdminLogin;
