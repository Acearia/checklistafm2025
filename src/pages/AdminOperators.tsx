
import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Search } from "lucide-react";
import { useSupabaseData } from "@/hooks/useSupabaseData";
import { AddOperatorDialog } from "@/components/operators/AddOperatorDialog";
import { EditOperatorDialog } from "@/components/operators/EditOperatorDialog";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { operatorService, leaderService } from "@/lib/supabase-service";
import { convertSupabaseOperatorToLegacy } from "@/lib/types-compat";
import type { TablesUpdate } from "@/integrations/supabase/types";
import type { Operator } from "@/lib/types-compat";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHead,
  TableRow
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious
} from "@/components/ui/pagination";

const AdminOperators = () => {
  const { operators: supabaseOperators, sectors: supabaseSectors, leaders: supabaseLeaders, refresh, loading } = useSupabaseData();
  const [operators, setOperators] = useState<Operator[]>([]);
  const [displayedOperators, setDisplayedOperators] = useState<Operator[]>([]);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [currentOperator, setCurrentOperator] = useState<Operator | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const { toast } = useToast();
  
  // Convert Supabase operators e combinar com informação de líderes
  useEffect(() => {
    if (supabaseOperators.length > 0) {
      const convertedOperators = supabaseOperators.map(convertSupabaseOperatorToLegacy);
      const leaderByOperatorId = new Map<string, any>();

      (supabaseLeaders || []).forEach((leader: any) => {
        if (leader?.operator_matricula) {
          leaderByOperatorId.set(leader.operator_matricula, leader);
          return;
        }

        const matched = convertedOperators.find(
          (operator) => operator.name?.toUpperCase() === (leader?.name || "").toUpperCase(),
        );
        if (matched) {
          leaderByOperatorId.set(matched.id, leader);
        }
      });

      const enrichedOperators = convertedOperators.map((operator) => {
        const leader = leaderByOperatorId.get(operator.id);
        return {
          ...operator,
          isLeader: Boolean(leader),
          leaderEmail: leader?.email || undefined,
          leaderSector: leader?.sector || undefined,
          leaderId: leader?.id || undefined,
        };
      });

      setOperators(enrichedOperators);
    } else {
      setOperators([]);
    }
  }, [supabaseOperators, supabaseLeaders]);
  
  const sectorOptions = useMemo(
    () =>
      supabaseSectors.map((sector) => ({
        id: sector.id,
        name: sector.name,
      })),
    [supabaseSectors]
  );

  // Função para importar operadores do texto
  const processOperatorText = async (operatorText: string) => {
    try {
      // Dividimos o texto em linhas
      const lines = operatorText
        .split('\n')
        .map((line) => line.replace(/\r/g, '').trim())
        .filter((line) => line.length > 0);
      
      // Para cada linha, criamos um operador
      const parsedOperators = lines
        .map((line, index) => {
          // Ignore header rows
          if (/nome/i.test(line) && /setor/i.test(line)) {
            return null;
          }

          let parts = line.split('\t').map((part) => part.trim());
          if (parts.length < 3) {
            // fallback: split by 2+ spaces
            parts = line.split(/\s{2,}/).map((part) => part.trim());
          }

          if (parts.length < 2) {
            console.warn(`Linha ${index + 1} ignorada: formato inválido`, line);
            return null;
          }

          const [name, matricula, setorRaw = "", cargoRaw = ""] = parts;
          if (!matricula) {
            console.warn(`Linha ${index + 1} ignorada: matrícula vazia`, line);
            return null;
          }

          const matchedSector = setorRaw
            ? sectorOptions.find(
                (opt) => opt.name.toLowerCase() === setorRaw.toLowerCase(),
              )
            : undefined;

          return {
            matricula: matricula.trim(),
            name: name.trim().toUpperCase(),
            cargo: cargoRaw ? cargoRaw.trim().toUpperCase() : null,
            setor: matchedSector?.name || (setorRaw ? setorRaw.trim() : null),
            rawSector: setorRaw.trim(),
            matchedSector: matchedSector?.name ?? null,
          };
        })
        .filter((op): op is NonNullable<typeof op> => op !== null);

      if (parsedOperators.length === 0) {
        toast({
          title: "Nenhum operador válido",
          description: "Verifique o formato da lista e tente novamente.",
          variant: "destructive",
        });
        return { created: 0, updated: 0, invalid: lines.length };
      }

      let createdCount = 0;
      let updatedCount = 0;
      let failedCount = 0;
      const unmatchedSectors = new Set<string>();
      
      // Salvar no Supabase
      for (const operator of parsedOperators) {
        if (!operator.matchedSector && operator.rawSector) {
          unmatchedSectors.add(operator.rawSector);
        }

        try {
          await operatorService.create({
            matricula: operator.matricula,
            name: operator.name,
            cargo: operator.cargo ?? null,
            setor: operator.matchedSector ?? operator.setor ?? null,
            senha: null,
          });
          createdCount += 1;
        } catch (error: any) {
          const message = String(error?.message ?? "");
          if (message.includes("duplicate key value") || message.includes("already exists")) {
            try {
              await operatorService.update(operator.matricula, {
                name: operator.name,
                cargo: operator.cargo ?? null,
                setor: operator.matchedSector ?? operator.setor ?? null,
              });
              updatedCount += 1;
            } catch (updateError) {
              console.error("Erro ao atualizar operador existente:", updateError);
              failedCount += 1;
            }
          } else {
            console.error("Erro ao criar operador:", error);
            failedCount += 1;
          }
        }
      }
      
      const totalProcessed = createdCount + updatedCount;
      if (totalProcessed > 0) {
        const parts = [];
        if (createdCount) parts.push(`${createdCount} novo(s)`);
        if (updatedCount) parts.push(`${updatedCount} atualizado(s)`);
        toast({
          title: "Importação concluída",
          description: `Processados ${totalProcessed} operadores (${parts.join(", ")}).`,
        });
      }

      if (failedCount > 0) {
        toast({
          title: "Operadores não processados",
          description: `${failedCount} linha(s) não puderam ser importadas.`,
          variant: "destructive",
        });
      }

      if (unmatchedSectors.size > 0) {
        toast({
          title: "Setores não reconhecidos",
          description: `Ajuste os nomes dos setores: ${Array.from(unmatchedSectors).join(", ")}.`,
        });
      }

      await refresh(); // Refresh data from Supabase
      return {
        created: createdCount,
        updated: updatedCount,
        failed: failedCount,
        unmatchedSectors: Array.from(unmatchedSectors),
      };
    } catch (e) {
      console.error('Erro ao processar texto de operadores:', e);
      toast({
        title: "Erro ao importar",
        description: "Não foi possível processar o texto de operadores.",
        variant: "destructive",
      });
      return { created: 0, updated: 0, failed: 0, unmatchedSectors: [] };
    }
  };
  
  // Filter operators based on search term
  useEffect(() => {
    if (operators.length === 0) {
      setDisplayedOperators([]);
      setCurrentPage(1);
      return;
    }
    
    if (searchTerm.trim() === '') {
      setDisplayedOperators(operators);
      setCurrentPage(1);
    } else {
      const filtered = operators.filter(op => 
        op.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        op.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (op.setor && op.setor.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (op.cargo && op.cargo.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      setDisplayedOperators(filtered);
      setCurrentPage(1);
    }
  }, [searchTerm, operators]);
  
  // Calculate the next available ID - removed as we use Supabase auto-generated IDs

  const handleAddOperator = async (data: {
    id: string;
    name: string;
    cargo?: string;
    setor?: string;
    senha?: string;
    isLeader?: boolean;
    leaderEmail?: string;
    leaderPassword?: string;
  }) => {
    try {
      await operatorService.create({
        matricula: data.id,
        name: data.name.toUpperCase(),
        cargo: data.cargo?.toUpperCase() || null,
        setor: data.setor || null,
        senha: data.senha ? data.senha.trim() : null,
      });

      if (data.isLeader && data.leaderEmail && data.leaderPassword) {
        const leaderPayload = {
          name: data.name.toUpperCase(),
          email: data.leaderEmail.trim(),
          sector: data.data.setor || "",
          password_hash: btoa(data.leaderPassword),
          operator_matricula: data.id,
        };

        const existingLeader = (supabaseLeaders || []).find(
          (leader: any) => leader?.operator_matricula === data.id,
        );

        if (existingLeader) {
          if (
            existingLeader.email === leaderPayload.email &&
            existingLeader.operator_matricula === leaderPayload.operator_matricula
          ) {
            await leaderService.update(existingLeader.id, leaderPayload);
          } else {
            await leaderService.delete(existingLeader.id);
            await leaderService.create(leaderPayload);
          }
        } else if (
          !(supabaseLeaders || []).some(
            (leader: any) => leader?.email?.toLowerCase() === leaderPayload.email.toLowerCase(),
          )
        ) {
          await leaderService.update(existingLeader.id, leaderPayload);
        } else {
          await leaderService.create(leaderPayload);
        }
      }
      
      toast({
        title: "Operador adicionado",
        description: `${data.name} foi adicionado com sucesso.`,
      });

      
      await refresh(); // Refresh data from Supabase
    } catch (error) {
      console.error('Erro ao adicionar operador:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Não foi possível adicionar o operador.",
        variant: "destructive",
      });
    }
  };

  const handleEditOperator = async (data: {
    id: string;
    name: string;
    cargo?: string;
    setor?: string;
    senha?: string;
    isLeader?: boolean;
    leaderEmail?: string;
    leaderPassword?: string;
  }) => {
    try {
      const updates: TablesUpdate<"operators"> = {
        name: data.name.toUpperCase(),
        cargo: data.cargo?.toUpperCase() || null,
        setor: data.setor || null,
      };

      if (data.senha && data.senha.trim().length === 4) {
        updates.senha = data.senha.trim();
      }

      await operatorService.update(data.id, updates);

      const existingLeader = (supabaseLeaders || []).find(
        (leader: any) => leader?.operator_matricula === data.id,
      );

      if (data.isLeader && data.leaderEmail) {
        if (existingLeader) {
          const leaderUpdate: any = {
            name: data.name.toUpperCase(),
            email: data.leaderEmail.trim(),
            sector: data.data.setor || "",
            operator_matricula: data.id,
          };
          if (data.leaderPassword) {
            leaderUpdate.password_hash = btoa(data.leaderPassword);
          }
          if (
            existingLeader.email === leaderUpdate.email &&
            existingLeader.operator_matricula === leaderUpdate.operator_matricula
          ) {
            await leaderService.update(existingLeader.id, leaderUpdate);
          } else {
            await leaderService.delete(existingLeader.id);
            await leaderService.create({
              ...leaderUpdate,
              password_hash: btoa(data.leaderPassword || ""),
            });
          }
        } else {
          if (!data.leaderPassword) {
            toast({
              title: "Senha do líder obrigatória",
              description: "Defina uma senha para o líder antes de salvar.",
              variant: "destructive",
            });
            return;
          }
          const duplicateEmail = (supabaseLeaders || []).find(
            (leader: any) => leader?.email?.toLowerCase() === data.leaderEmail!.toLowerCase(),
          );
          if (duplicateEmail) {
            await leaderService.update(duplicateEmail.id, {
              name: data.name.toUpperCase(),
              email: data.leaderEmail.trim(),
              sector: data.data.setor || "",
              password_hash: btoa(data.leaderPassword),
              operator_matricula: data.id,
            });
          } else {
            await leaderService.create({
              name: data.name.toUpperCase(),
              email: data.leaderEmail.trim(),
              sector: data.data.setor || "",
              password_hash: btoa(data.leaderPassword),
              operator_matricula: data.id,
            });
          }
        }
      } else if (!data.isLeader && existingLeader) {
        await leaderService.delete(existingLeader.id);
      }
      
      toast({
        title: "Operador atualizado",
        description: "Os dados do operador foram atualizados com sucesso.",
      });

      
      setEditDialogOpen(false);
      setCurrentOperator(null);
      await refresh(); // Refresh data from Supabase
    } catch (error) {
      console.error('Erro ao editar operador:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Não foi possível editar o operador.",
        variant: "destructive",
      });
    }
  };

  const handleRemoveOperator = async (matricula: string) => {
    const operatorToRemove = operators.find(op => op.id === matricula);
    if (!operatorToRemove) return;
    
    try {
      const existingLeader = (supabaseLeaders || []).find(
        (leader: any) =>
          leader?.operator_matricula === matricula ||
          (operatorToRemove.leaderEmail && leader?.email?.toLowerCase() === operatorToRemove.leaderEmail.toLowerCase()),
      );

      await operatorService.delete(matricula);

      if (existingLeader) {
        await leaderService.delete(existingLeader.id);
      }
      
      toast({
        title: "Operador removido",
        description: `${operatorToRemove.name} foi removido com sucesso.`,
      });

      
      await refresh(); // Refresh data from Supabase
    } catch (error) {
      console.error('Erro ao remover operador:', error);
      toast({
        title: "Erro",
        description: "Não foi possível remover o operador.",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (operator: Operator) => {
    setCurrentOperator(operator);
    setEditDialogOpen(true);
  };

  // Pagination
  const totalPages = Math.ceil(displayedOperators.length / itemsPerPage);
  const paginatedOperators = displayedOperators.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Gerenciar Operadores - Checklist AFM</h1>
        <Button 
          className="bg-red-700 hover:bg-red-800"
          onClick={() => setAddDialogOpen(true)}
        >
          <PlusCircle size={16} className="mr-2" />
          Novo Operador
        </Button>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
          <Input
            type="search"
            placeholder="Buscar operador por nome, ID, setor ou cargo..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Lista de Operadores ({displayedOperators.length})</CardTitle>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={async () => {
                try {
                  const text = await navigator.clipboard.readText();
                  if (text && text.trim().length > 0) {
                    await processOperatorText(text);
                  } else {
                    toast({
                      title: "Texto inválido",
                      description: "Cole uma lista de operadores com colunas Nome, Matrícula e Setor.",
                      variant: "destructive",
                    });
                  }
                } catch (err) {
                  console.error("Erro ao acessar a área de transferência:", err);
                  toast({
                    title: "Erro",
                    description: "Não foi possível acessar a área de transferência",
                    variant: "destructive",
                  });
                }
              }}
            >
              Importar do Clipboard
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Matrícula</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Setor</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedOperators.length > 0 ? (
                  paginatedOperators.map((operator) => (
                    <TableRow key={operator.id} className="hover:bg-gray-50">
                       <TableCell>{operator.id}</TableCell>
                      <TableCell>{operator.name}</TableCell>
                      <TableCell>{operator.cargo || "-"}</TableCell>
                      <TableCell>{operator.setor || "-"}</TableCell>
                      <TableCell className="text-center">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="mr-2"
                          onClick={() => openEditDialog(operator)}
                        >
                          Editar
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600"
                          onClick={() => handleRemoveOperator(operator.id)}
                        >
                          Remover
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      {operators.length === 0 
                        ? "Nenhum operador cadastrado ainda." 
                        : "Nenhum operador encontrado com a busca atual."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                  
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(page => 
                      page === 1 || 
                      page === totalPages || 
                      Math.abs(page - currentPage) <= 1
                    )
                    .map((page, index, array) => (
                      <React.Fragment key={page}>
                        {index > 0 && array[index - 1] !== page - 1 && (
                          <PaginationItem>
                            <span className="flex h-9 w-9 items-center justify-center">...</span>
                          </PaginationItem>
                        )}
                        <PaginationItem>
                          <PaginationLink 
                            isActive={page === currentPage}
                            onClick={() => setCurrentPage(page)}
                          >
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      </React.Fragment>
                    ))
                  }
                  
                  <PaginationItem>
                    <PaginationNext 
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
          
          <div className="mt-4 text-center text-sm text-gray-500">
            Mostrando {paginatedOperators.length} de {displayedOperators.length} operadores
          </div>
        </CardContent>
      </Card>

      {/* Add Operator Dialog */}
      <AddOperatorDialog 
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onAddOperator={handleAddOperator}
        sectors={sectorOptions}
      />

      {/* Edit Operator Dialog */}
      {currentOperator && (
      <EditOperatorDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        operator={currentOperator}
        onEditOperator={handleEditOperator}
        sectors={sectorOptions}
      />
    )}

    </div>
  );
};

export default AdminOperators;
