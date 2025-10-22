import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RefreshCw, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSupabaseData } from "@/hooks/useSupabaseData";

const AdminLeaders: React.FC = () => {
  const { toast } = useToast();
  const { leaders, loading, error, refresh } = useSupabaseData();

  const handleRefresh = async () => {
    try {
      await refresh();
      toast({
        title: "Dados atualizados",
        description: "Lista de líderes sincronizada com os operadores.",
      });
    } catch (err) {
      console.error("Erro ao atualizar líderes:", err);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar a lista de líderes.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-red-700 border-t-transparent" />
          <p className="mt-4 text-gray-600">Carregando líderes...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Erro</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Líderes cadastrados</h1>
          <p className="text-gray-600">
            Essa listagem reflete os operadores marcados como líderes. Edite um operador na tela principal
            para alterar seus dados de liderança.
          </p>
        </div>
        <Button onClick={handleRefresh} variant="outline" className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4" /> Atualizar
        </Button>
      </div>

      {leaders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center space-y-2">
            <Users className="h-12 w-12 text-muted-foreground" />
            <h3 className="text-lg font-semibold">Nenhum líder configurado</h3>
            <p className="text-muted-foreground">
              Marque um operador como líder na tela de Operadores para que ele apareça aqui.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {leaders.map((leader) => (
            <Card key={leader.operator_matricula}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  {leader.name || leader.operator_matricula}
                </CardTitle>
                <CardDescription>{leader.email || "Sem email cadastrado"}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-gray-600">
                <div>
                  <strong>Matrícula:</strong> {leader.operator_matricula}
                </div>
                <div>
                  <strong>Setor:</strong> {leader.sector || "Não informado"}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminLeaders;
