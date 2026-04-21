
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ClipboardCheck, Search, ShieldAlert } from "lucide-react";
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
import AppFooter from "@/components/AppFooter";
import { useSupabaseData } from "@/hooks/useSupabaseData";
import { useToast } from "@/hooks/use-toast";
import { saveChecklistState } from "@/lib/checklistState";
import { parseStoredPassword, verifyPassword } from "@/lib/password-utils";
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

  const handleValidateMatricula = async () => {
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
    const parsed = parseStoredPassword(operatorSenhaStr);
    const operatorSenha = parsed.raw;
    const requiresReset = parsed.requiresReset;
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
        description: "Crie uma senha com no mínimo 4 dígitos para continuar.",
      });
      return;
    }

    if (!/^\d{4,}$/.test(senhaInformada)) {
      setValidatedOperator(null);
      setPasswordError("Informe uma senha numérica com no mínimo 4 dígitos.");
      toast({
        title: "Senha obrigatória",
        description: "Digite uma senha numérica com no mínimo 4 dígitos.",
        variant: "destructive",
      });
      return;
    }

    const verification = await verifyPassword(operatorSenhaStr, senhaInformada);
    if (!verification.valid) {
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
        description: "Defina uma nova senha com no mínimo 4 dígitos para continuar.",
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

    // Atualizar para hash em segundo plano se ainda for legacy plain text
    if (verification.isLegacyPlain) {
      try {
        const { operatorService } = await import("@/lib/supabase-service");
        await operatorService.update(operatorMatricula, { senha: senhaInformada });
        void refresh();
      } catch (error) {
        console.error("Erro ao migrar senha para hash:", error);
      }
    }

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

    if (!/^\d{4,}$/.test(newPassword)) {
      setPasswordSetupError("A senha deve ter no mínimo 4 dígitos numéricos.");
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
      <Card className="mt-6 border border-white/50 bg-white/85 shadow-lg backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/75">
      <CardContent className="pt-6 flex flex-col items-center">
        <div className="text-center mb-8">
          <h2 className="mb-2 text-2xl font-bold text-gray-800 dark:text-slate-50">Bem-vindo ao Checklist AFM</h2>
          <p className="text-gray-600 dark:text-slate-300">Sistema de inspeção de equipamentos</p>
        </div>
        
        <div className="w-full space-y-4">
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-slate-200">
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
              <label className="text-sm font-medium text-gray-700 dark:text-slate-200">
                Senha (mínimo 4 dígitos)
              </label>
              <Input
                type="password"
                placeholder="••••"
                value={senha}
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
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/40">
              <p className="text-sm font-medium text-green-900">
                {validatedOperator.name}
              </p>
                    <p className="text-xs text-green-700 dark:text-green-300">
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
      <header className="flex items-center justify-between bg-red-700 px-4 py-3 text-white shadow-md dark:border-b dark:border-slate-800 dark:bg-slate-950/95">
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
              <div className="grid w-full grid-cols-1 gap-2 pt-2 sm:grid-cols-2">
                <Link to="/leader/login" className="w-full">
                  <Button
                    variant="ghost"
                    className="h-11 w-full justify-center text-[15px] font-medium text-gray-700 hover:text-gray-900 dark:text-slate-200 dark:hover:text-slate-50 sm:text-base"
                  >
                    Acesso de Líderes
                  </Button>
                </Link>
                <Link to="/admin/login" className="w-full">
                  <Button
                    variant="ghost"
                    className="h-11 w-full justify-center text-[15px] font-medium text-gray-700 hover:text-gray-900 dark:text-slate-200 dark:hover:text-slate-50 sm:text-base"
                  >
                    Acesso Administrativo
                  </Button>
                </Link>
              </div>
              <div className="grid w-full grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
                <Link
                  to="/investigacao-acidente"
                  className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900 shadow-sm transition-colors hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-950/60"
                >
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-5 w-5 shrink-0" />
                    <span className="text-base font-semibold sm:text-lg">Investigação de Acidente</span>
                  </div>
                  <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">Abrir formulário de investigação.</p>
                </Link>
                <Link
                  to="/regras-de-ouro"
                  className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-blue-900 shadow-sm transition-colors hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100 dark:hover:bg-blue-950/60"
                >
                  <div className="flex items-center gap-2">
                    <ClipboardCheck className="h-5 w-5 shrink-0" />
                    <span className="text-base font-semibold sm:text-lg">Regras de Ouro</span>
                  </div>
                  <p className="mt-1 text-sm text-blue-800 dark:text-blue-200">Abrir formulário de regras de ouro.</p>
                </Link>
              </div>
            </>
          ) : (
            <Tabs defaultValue="home" className="w-full">
              <TabsList className="grid h-auto w-full grid-cols-5 rounded-lg border border-white/40 bg-white/75 backdrop-blur-md">
                <TabsTrigger value="home" className="px-2 py-2.5 text-[15px] md:text-base">Início</TabsTrigger>
                <TabsTrigger value="leader" className="px-2 py-2.5 text-[15px] md:text-base">Líderes</TabsTrigger>
                <TabsTrigger value="admin" className="px-2 py-2.5 text-[15px] md:text-base">Administrativo</TabsTrigger>
                <TabsTrigger value="investigacao" className="mx-0.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-2.5 text-[15px] font-semibold text-amber-900 data-[state=active]:border-amber-700 data-[state=active]:bg-amber-700 data-[state=active]:text-white md:text-base">Investigação</TabsTrigger>
                <TabsTrigger value="regras-ouro" className="mx-0.5 rounded-md border border-blue-200 bg-blue-50 px-2 py-2.5 text-[15px] font-semibold text-blue-900 data-[state=active]:border-blue-700 data-[state=active]:bg-blue-700 data-[state=active]:text-white md:text-base">Regras de Ouro</TabsTrigger>
              </TabsList>

              <TabsContent value="home" className="mt-6">
                {HomeCard}
              </TabsContent>

              <TabsContent value="leader" className="mt-6">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center mb-6">
                      <h2 className="mb-2 text-2xl font-bold text-gray-800 dark:text-slate-50">Área de Líderes</h2>
                      <p className="mb-6 text-gray-600 dark:text-slate-300">Acesse o dashboard de líderes do sistema</p>
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
                      <h2 className="mb-2 text-2xl font-bold text-gray-800 dark:text-slate-50">Área Administrativa</h2>
                      <p className="mb-6 text-gray-600 dark:text-slate-300">Acesse as funções administrativas do sistema</p>
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
                      <h2 className="mb-2 text-2xl font-bold text-gray-800 dark:text-slate-50">Investigação de Acidente</h2>
                      <p className="mb-6 text-gray-600 dark:text-slate-300">Acesse o formulário de investigação.</p>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      <Link to="/investigacao-acidente">
                        <Button
                          className="w-full py-8 bg-blue-700 hover:bg-blue-800 text-white text-lg flex flex-col items-center gap-2"
                        >
                          <span>Abrir Investigação</span>
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="regras-ouro" className="mt-6">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center mb-6">
                      <h2 className="mb-2 text-2xl font-bold text-gray-800 dark:text-slate-50">Regras de Ouro</h2>
                      <p className="mb-6 text-gray-600 dark:text-slate-300">Acesse o formulário de regras de ouro.</p>
                    </div>

                    <Link to="/regras-de-ouro">
                      <Button
                        className="w-full py-8 bg-blue-700 hover:bg-blue-800 text-white text-lg flex flex-col items-center gap-2"
                      >
                        <span>Abrir Regras de Ouro</span>
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
              Crie uma senha com no mínimo 4 dígitos para o operador {passwordSetupOperator?.name || ""}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              type="password"
              placeholder="Nova senha (mínimo 4 dígitos)"
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
      <AppFooter className="border-white/40 bg-white/88" />
    </div>
  );
};

export default Index;



