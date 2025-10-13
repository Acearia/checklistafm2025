
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ClipboardCheck, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SupabaseStatus from "@/components/SupabaseStatus";
import { useSupabaseData } from "@/hooks/useSupabaseData";
import { useToast } from "@/hooks/use-toast";
import { saveChecklistState } from "@/lib/checklistState";
import logoUrl from "@/assets/afm-logo.png";

const Index = () => {
  const { loading, error, operators } = useSupabaseData();
  const [matricula, setMatricula] = useState("");
  const [senha, setSenha] = useState("");
  const [validatedOperator, setValidatedOperator] = useState<any>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleValidateMatricula = () => {
    if (!matricula.trim()) {
      toast({
        title: "Erro",
        description: "Digite o número da matrícula",
        variant: "destructive",
      });
      return;
    }

    if (!senha.trim() || senha.length !== 4) {
      toast({
        title: "Erro",
        description: "Digite uma senha de 4 dígitos",
        variant: "destructive",
      });
      return;
    }

    console.log(`[LOG] Validando matrícula: ${matricula} com senha`);
    
    const normalizedMatricula = matricula.trim();
    const operator = operators.find(op => {
      const opMatricula = (op as any).matricula ?? op.id;
      return opMatricula === normalizedMatricula || op.id === normalizedMatricula;
    });
    
    if (operator) {
      // Verificar se a senha está correta
      const operatorSenhaRaw = (operator as any).senha;
      const operatorSenha =
        operatorSenhaRaw === null || operatorSenhaRaw === undefined
          ? ""
          : String(operatorSenhaRaw).trim();
      const senhaInformada = senha.trim();

      if (!operatorSenha) {
        console.log(`[LOG] Operador sem senha cadastrada: ${matricula}`);
        setValidatedOperator(null);
        setPasswordError("Operador sem senha cadastrada. Peça ao administrador para definir uma senha.");
        toast({
          title: "Senha não cadastrada",
          description: "Entre em contato com o administrador para definir uma senha.",
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
    } else {
      console.log(`[LOG] Matrícula não encontrada: ${matricula}`);
      setValidatedOperator(null);
      setPasswordError("Matrícula não encontrada. Verifique o número informado.");
      toast({
        title: "Matrícula não encontrada",
        description: "Verifique o número e tente novamente",
        variant: "destructive",
      });
    }
  };

  const handleStartChecklist = () => {
    if (validatedOperator) {
      console.log(`[LOG] Iniciando checklist com operador: ${validatedOperator.name}`);
      saveChecklistState({ operator: validatedOperator });
      navigate("/checklist/equipment");
    }
  };
  
  return (
    <div className="min-h-screen flex flex-col bg-transparent">
      <header className="bg-red-700 text-white px-4 py-3 shadow-md flex justify-between items-center">
        <div className="flex items-center gap-4">
          <img src={logoUrl} alt="Checklist AFM" className="h-24 w-auto drop-shadow-md" />
          <div className="leading-tight text-white">
            <h1 className="font-extrabold text-3xl tracking-wide">Checklist AFM</h1>
            <p className="text-base font-semibold uppercase tracking-[0.45em] text-red-100">
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
          
          <Tabs defaultValue="home" className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-white/75 backdrop-blur-md rounded-lg border border-white/40">
              <TabsTrigger value="home">Início</TabsTrigger>
              <TabsTrigger value="leader">Líderes</TabsTrigger>
              <TabsTrigger value="admin">Administrativo</TabsTrigger>
            </TabsList>
          
            <TabsContent value="home" className="mt-6">
              <Card className="bg-white/85 backdrop-blur-md border border-white/50 shadow-lg">
                <CardContent className="pt-6 flex flex-col items-center">
                  <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Bem-vindo ao Checklist AFM</h2>
                    <p className="text-gray-600">Sistema de inspeção de equipamentos</p>
                  </div>
                  
                  <div className="w-full space-y-4">
                    {/* Campo de matrícula e senha */}
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
                        disabled={loading || !matricula.trim() || senha.length !== 4}
                        className="w-full"
                      >
                        <Search className="h-4 w-4 mr-2" />
                        Validar
                      </Button>
                    </div>

                    {/* Informações do operador validado */}
                    {validatedOperator && (
                      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-sm font-medium text-green-900">
                          {validatedOperator.name}
                        </p>
                        <p className="text-xs text-green-700">
                          {validatedOperator.cargo} - {validatedOperator.setor}
                        </p>
                      </div>
                    )}

                    {/* Botão Iniciar Checklist */}
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
                      variant="outline" 
                      className="w-full py-4 text-base flex justify-center items-center"
                    >
                      <span>Login Administrativo</span>
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Index;
