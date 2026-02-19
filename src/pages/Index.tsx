
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ClipboardCheck, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import SupabaseStatus from "@/components/SupabaseStatus";
import { useSupabaseData } from "@/hooks/useSupabaseData";
import { useToast } from "@/hooks/use-toast";
import { saveChecklistState } from "@/lib/checklistState";
import logoUrl from "@/assets/afm-logo.png";
import { cn } from "@/lib/utils";

const Index = () => {
  const { loading, error, operators, refresh } = useSupabaseData(["operators"]);
  const [matricula, setMatricula] = useState("");
  const [senha, setSenha] = useState("");
  const [validatedOperator, setValidatedOperator] = useState<any>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    const ua = navigator.userAgent || "";
    const touch = typeof navigator !== "undefined" && navigator.maxTouchPoints > 1;
    const smallWidth = window.innerWidth < 1024;
    const isIpad = /iPad|Tablet|Macintosh/.test(ua) && touch;
    return smallWidth || isIpad;
  });
  const operatorSectors = useMemo(() => {
    const raw = validatedOperator?.setor || "";
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }, [validatedOperator]);
  const [passwordSetupDialogOpen, setPasswordSetupDialogOpen] = useState(false);
  const [passwordSetupOperator, setPasswordSetupOperator] = useState<any>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSetupError, setPasswordSetupError] = useState<string | null>(null);
  const [isSettingPassword, setIsSettingPassword] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const ua = navigator.userAgent || "";
      const touch = navigator.maxTouchPoints > 1;
      const smallWidth = window.innerWidth < 1024;
      const isIpad = /iPad|Tablet|Macintosh/.test(ua) && touch;
      setIsMobile(smallWidth || isIpad);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleValidateMatricula = () => {
    if (!matricula.trim()) {
      toast({
        title: "Erro",
        description: "Digite o número da matrícula",
        variant: "destructive",
      });
      return;
    }

    console.log(`[LOG] Validando matrícula: ${matricula} com senha`);

    const normalizedMatricula = matricula.trim();
    const operator = operators.find((op) => {
      const opMatricula = (op as any).matricula ?? op.id;
      return opMatricula === normalizedMatricula || op.id === normalizedMatricula;
    });

    if (!operator) {
      console.log(`[LOG] Matrícula não encontrada: ${matricula}`);
      setValidatedOperator(null);
      setPasswordError("Matrícula não encontrada. Verifique o número informado.");
      toast({
        title: "Matrícula não encontrada",
        description: "Verifique o número e tente novamente",
        variant: "destructive",
      });
      return;
    }

    // Verificar senha cadastrada
    const operatorSenhaRaw = (operator as any).senha;
    const operatorSenhaStr =
      operatorSenhaRaw === null || operatorSenhaRaw === undefined
        ? ""
        : String(operatorSenhaRaw).trim();
    const [operatorSenha, senhaFlag] = operatorSenhaStr.split("|");
    const requiresReset = (senhaFlag || "").toUpperCase() === "RESET";
    const senhaInformada = senha.trim();

    if (!operatorSenha) {
      console.log(`[LOG] Operador sem senha cadastrada, solicitando criação: ${matricula}`);
      setValidatedOperator(null);
      setPasswordError(null);
      setPasswordSetupOperator(operator);
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSetupError(null);
      setPasswordSetupDialogOpen(true);
      toast({
        title: "Defina uma senha",
        description: "Crie uma senha de 4 dígitos para continuar.",
      });
      return;
    }

    if (!senhaInformada || senhaInformada.length !== 4) {
      setValidatedOperator(null);
      setPasswordError("Informe a senha de 4 dígitos para continuar.");
      toast({
        title: "Senha obrigatória",
        description: "Digite a senha de 4 dígitos.",
        variant: "destructive",
      });
      return;
    }

    if (operatorSenha !== senhaInformada) {
      console.log(`[LOG] Senha incorreta para matrícula: ${matricula}`);
      setValidatedOperator(null);
      setPasswordError("Senha incorreta. Verifique e tente novamente.");
      toast({
        title: "Senha incorreta",
        description: "Verifique a senha e tente novamente",
        variant: "destructive",
      });
      return;
    }

    if (requiresReset) {
      console.log(`[LOG] Senha marcada para troca. Solicitando redefinição: ${matricula}`);
      setValidatedOperator(null);
      setPasswordError(null);
      setPasswordSetupOperator(operator);
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSetupError(null);
      setPasswordSetupDialogOpen(true);
      toast({
        title: "Troque sua senha",
        description: "Defina uma nova senha de 4 dígitos para continuar.",
      });
      return;
    }

    const operatorMatricula = (operator as any).matricula || operator.id;
    console.log(`[LOG] Operador encontrado: ${operator.name} (Matrícula: ${operatorMatricula})`);
    const normalizedOperator = {
      ...operator,
      id: operatorMatricula,
      matricula: operatorMatricula,
    };
    setValidatedOperator(normalizedOperator);
    setPasswordError(null);
    toast({
      title: "Matrícula validada",
      description: `Bem-vindo, ${operator.name}!`,
    });
  };

  const handlePasswordSetupDialogChange = (open: boolean) => {
    setPasswordSetupDialogOpen(open);
    if (!open) {
      setPasswordSetupOperator(null);
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSetupError(null);
      setIsSettingPassword(false);
    }
  };

  const handlePasswordSetupSubmit = async () => {
    if (!passwordSetupOperator) {
      setPasswordSetupError("Operador não encontrado.");
      return;
    }

    if (!newPassword || newPassword.length !== 4) {
      setPasswordSetupError("A senha deve ter 4 dígitos.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordSetupError("As senhas informadas não coincidem.");
      return;
    }

    try {
      setIsSettingPassword(true);
      const { operatorService } = await import("@/lib/supabase-service");
      const operatorMatricula = (passwordSetupOperator as any).matricula ?? passwordSetupOperator.id;

      await operatorService.update(operatorMatricula, { senha: newPassword });
      await refresh();

      toast({
        title: "Senha definida",
        description: "Senha criada com sucesso. Você já pode iniciar o checklist.",
      });

      const updatedOperator = {
        ...passwordSetupOperator,
        senha: newPassword,
        matricula: operatorMatricula,
        id: operatorMatricula,
      };

      setSenha(newPassword);
      setValidatedOperator(updatedOperator);
      setPasswordError(null);
      handlePasswordSetupDialogChange(false);
    } catch (error) {
      console.error("Erro ao definir senha do operador:", error);
      setPasswordSetupError("Não foi possível salvar a senha. Tente novamente.");
    } finally {
      setIsSettingPassword(false);
    }
  };

  const handleStartChecklist = () => {
    if (validatedOperator) {
      console.log(`[LOG] Iniciando checklist com operador: ${validatedOperator.name}`);
      saveChecklistState({ operator: validatedOperator });
      navigate("/checklist/equipment");
    }
  };
  
  const HomeCard = (
    <Card className="bg-white/85 backdrop-blur-md border border-white/50 shadow-lg mt-6">
      <CardContent className="pt-6 flex flex-col items-center">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Bem-vindo ao Checklist AFM</h2>
          <p className="text-gray-600">Sistema de inspeção de equipamentos</p>
        </div>
        
        <div className="w-full space-y-4">
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Matrícula
              </label>
              <Input
                placeholder="Número da matrícula"
                value={matricula}
                onChange={(e) => {
                  setMatricula(e.target.value);
                  setValidatedOperator(null);
                  setPasswordError(null);
                }}
                className="w-full"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Senha (4 dígitos)
              </label>
              <Input
                type="password"
                placeholder="••••"
                value={senha}
                maxLength={4}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  setSenha(value);
                  setValidatedOperator(null);
                  setPasswordError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleValidateMatricula();
                  }
                }}
                className="w-full"
                disabled={loading}
              />
            </div>

            {passwordError && (
              <p className="text-sm text-red-600 text-center">{passwordError}</p>
            )}

            <Button 
              onClick={handleValidateMatricula}
              variant="outline"
              disabled={loading || !matricula.trim()}
              className="w-full"
            >
              <Search className="h-4 w-4 mr-2" />
              Validar
            </Button>
          </div>

          {validatedOperator && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm font-medium text-green-900">
                {validatedOperator.name}
              </p>
                    <p className="text-xs text-green-700">
                      {validatedOperator.cargo} {operatorSectors.length > 0 ? `- ${operatorSectors.join(", ")}` : ""}
                    </p>
                  </div>
                )}

          <Button 
            onClick={handleStartChecklist}
            disabled={!validatedOperator}
            className="w-full py-8 bg-red-700 hover:bg-red-800 text-white text-lg flex flex-col items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ClipboardCheck size={40} />
            <span>Iniciar Checklist</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div
      className={cn(
        "min-h-screen flex flex-col transition-colors duration-300",
        "home-background"
      )}
    >
      <header className="bg-red-700 text-white px-4 py-3 shadow-md flex justify-between items-center">
        <div className="flex items-center gap-4">
          <img src={logoUrl} alt="Checklist AFM" className="h-16 w-auto md:h-24 drop-shadow-md" />
          <div className="leading-tight text-white">
            <h1 className="font-extrabold text-2xl md:text-3xl tracking-wide">Checklist AFM</h1>
            <p className="text-sm md:text-base font-semibold uppercase tracking-[0.35em] md:tracking-[0.45em] text-red-100">
              Inspeção de Equipamentos
            </p>
          </div>
        </div>
        <SupabaseStatus 
          isConnected={!error && !loading}
          loading={loading}
          error={error}
        />
      </header>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-3xl mx-auto space-y-4">
          {isMobile ? (
            <>
              {HomeCard}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 text-sm text-gray-600 pt-2">
                <Link to="/leader/login">
                  <Button variant="ghost" className="text-gray-600 hover:text-gray-900">
                    Acesso de Líderes
                  </Button>
                </Link>
                <Link to="/admin/login">
                  <Button variant="ghost" className="text-gray-600 hover:text-gray-900">
                    Acesso Administrativo
                  </Button>
                </Link>
                <Link to="/investigacao-acidente">
                  <Button variant="ghost" className="text-gray-600 hover:text-gray-900">
                    Investigação de Acidente
                  </Button>
                </Link>
              </div>
            </>
          ) : (
            <Tabs defaultValue="home" className="w-full">
              <TabsList className="grid w-full grid-cols-4 bg-white/75 backdrop-blur-md rounded-lg border border-white/40">
                <TabsTrigger value="home">Início</TabsTrigger>
                <TabsTrigger value="leader">Líderes</TabsTrigger>
                <TabsTrigger value="admin">Administrativo</TabsTrigger>
                <TabsTrigger value="investigacao">Investigação</TabsTrigger>
              </TabsList>

              <TabsContent value="home" className="mt-6">
                {HomeCard}
              </TabsContent>

              <TabsContent value="leader" className="mt-6">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center mb-6">
                      <h2 className="text-2xl font-bold text-gray-800 mb-2">Área de Líderes</h2>
                      <p className="text-gray-600 mb-6">Acesse o dashboard de líderes do sistema</p>
                    </div>
                    
                    <Link to="/leader/login">
                      <Button 
                        className="w-full py-8 bg-blue-700 hover:bg-blue-800 text-white text-lg flex flex-col items-center gap-2"
                      >
                        <span>Dashboard de Líderes</span>
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="admin" className="mt-6">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center mb-6">
                      <h2 className="text-2xl font-bold text-gray-800 mb-2">Área Administrativa</h2>
                      <p className="text-gray-600 mb-6">Acesse as funções administrativas do sistema</p>
                    </div>
                    
                    <Link to="/admin/login">
                      <Button
                        className="w-full py-8 bg-blue-700 hover:bg-blue-800 text-white text-lg flex flex-col items-center gap-2"
                      >
                        <span>Dashboard Administrativo</span>
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="investigacao" className="mt-6">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center mb-6">
                      <h2 className="text-2xl font-bold text-gray-800 mb-2">Investigação de Acidente</h2>
                      <p className="text-gray-600 mb-6">Acesse o formulário de investigação.</p>
                    </div>

                    <Link to="/investigacao-acidente">
                      <Button
                        className="w-full py-8 bg-blue-700 hover:bg-blue-800 text-white text-lg flex flex-col items-center gap-2"
                      >
                        <span>Abrir Investigação</span>
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>

      <Dialog open={passwordSetupDialogOpen} onOpenChange={handlePasswordSetupDialogChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Definir senha de acesso</DialogTitle>
            <DialogDescription>
              Crie uma senha de 4 dígitos para o operador {passwordSetupOperator?.name || ""}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              type="password"
              placeholder="Nova senha (4 dígitos)"
              maxLength={4}
              value={newPassword}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, "");
                setNewPassword(value);
                setPasswordSetupError(null);
              }}
            />
            <Input
              type="password"
              placeholder="Confirmar senha"
              maxLength={4}
              value={confirmPassword}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, "");
                setConfirmPassword(value);
                setPasswordSetupError(null);
              }}
            />
            {passwordSetupError && (
              <p className="text-sm text-red-600">{passwordSetupError}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handlePasswordSetupDialogChange(false)}
              disabled={isSettingPassword}
            >
              Cancelar
            </Button>
            <Button onClick={handlePasswordSetupSubmit} disabled={isSettingPassword}>
              {isSettingPassword ? "Salvando..." : "Salvar senha"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;



