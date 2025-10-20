import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useSupabaseData } from "@/hooks/useSupabaseData";

const LeaderLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { leaders, loading: leadersLoading } = useSupabaseData();

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
    </div>
  );
};

export default LeaderLogin;
