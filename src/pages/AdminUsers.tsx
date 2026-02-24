import React, { useEffect, useMemo, useState } from "react";
import { KeyRound, RefreshCw, Save, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSupabaseData } from "@/hooks/useSupabaseData";
import { operatorService, leaderService } from "@/lib/supabase-service";
import { supabase } from "@/integrations/supabase/client";
import { upsertInvestigatorAccount } from "@/lib/adminCredentials";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type UnifiedRole =
  | "operador"
  | "lider"
  | "investigador"
  | "supervisor"
  | "tec_seguranca"
  | "inspetor";

interface UnifiedUser {
  matricula: string;
  name: string;
  cargo: string;
  setor: string;
  email: string;
  roles: UnifiedRole[];
}

interface AdminAccount {
  username: string;
  role: "admin" | "seguranca" | "investigador";
  password_hash: string;
}

const SECURITY_ROLES: UnifiedRole[] = ["supervisor", "tec_seguranca", "inspetor"];
const SECURITY_ROLE_STORAGE_KEY = "checklistafm-users-security-role-tags";
const DEFAULT_PASSWORD = "1234";

const parseSectorList = (value: string): string[] => {
  if (!value) return [];
  return value
    .split(/[,;/]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item, index, list) => list.indexOf(item) === index);
};

const stringifySectorList = (values: string[]): string => {
  return values
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item, index, list) => list.indexOf(item) === index)
    .join(", ");
};

const mergeSectorValues = (currentValue: string, incomingValue: string) => {
  return stringifySectorList([...parseSectorList(currentValue), ...parseSectorList(incomingValue)]);
};

const ROLE_LABEL: Record<UnifiedRole, string> = {
  operador: "Operador",
  lider: "Líder",
  investigador: "Investigador",
  supervisor: "Supervisor",
  tec_seguranca: "Téc. Segurança",
  inspetor: "Inspetor",
};

const encodePassword = (value: string): string => {
  if (typeof window !== "undefined" && typeof window.btoa === "function") {
    return window.btoa(value);
  }
  return value;
};

const loadSecurityRoleTags = () => {
  if (typeof window === "undefined") return {} as Record<string, UnifiedRole[]>;
  try {
    const raw = localStorage.getItem(SECURITY_ROLE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};

    return Object.entries(parsed).reduce<Record<string, UnifiedRole[]>>((acc, [key, value]) => {
      if (!Array.isArray(value)) return acc;
      const roles = value.filter((role): role is UnifiedRole =>
        SECURITY_ROLES.includes(role as UnifiedRole),
      );
      if (roles.length > 0) {
        acc[key] = roles;
      }
      return acc;
    }, {});
  } catch {
    return {};
  }
};

const saveSecurityRoleTags = (tags: Record<string, UnifiedRole[]>) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(SECURITY_ROLE_STORAGE_KEY, JSON.stringify(tags));
};

const AdminUsers = () => {
  const { toast } = useToast();
  const { operators, leaders, sectors, loading, refresh } = useSupabaseData([
    "operators",
    "leaders",
    "sectors",
  ]);

  const [searchTerm, setSearchTerm] = useState("");
  const [adminAccounts, setAdminAccounts] = useState<AdminAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resettingUserMatricula, setResettingUserMatricula] = useState<string | null>(null);
  const [securityRoleTags, setSecurityRoleTags] = useState<Record<string, UnifiedRole[]>>(
    loadSecurityRoleTags(),
  );

  const [matricula, setMatricula] = useState("");
  const [name, setName] = useState("");
  const [cargo, setCargo] = useState("");
  const [setor, setSetor] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<Set<UnifiedRole>>(new Set(["operador"]));
  const selectedSetores = useMemo(() => parseSectorList(setor), [setor]);

  const loadAdminAccounts = async () => {
    setLoadingAccounts(true);
    try {
      const { data, error } = await supabase
        .from("admin_users")
        .select("username, role, password_hash")
        .in("role", ["seguranca", "investigador"]);

      if (error) {
        console.error("Erro ao carregar contas administrativas:", error);
        setAdminAccounts([]);
        return;
      }

      setAdminAccounts((data || []) as AdminAccount[]);
    } finally {
      setLoadingAccounts(false);
    }
  };

  useEffect(() => {
    void loadAdminAccounts();
  }, []);

  useEffect(() => {
    saveSecurityRoleTags(securityRoleTags);
  }, [securityRoleTags]);

  const users = useMemo(() => {
    const map = new Map<string, UnifiedUser>();

    const ensureUser = (key: string, fallbackName = "") => {
      const normalized = key.trim();
      if (!normalized) return null;
      if (!map.has(normalized)) {
        map.set(normalized, {
          matricula: normalized,
          name: fallbackName || normalized,
          cargo: "",
          setor: "",
          email: "",
          roles: [],
        });
      }
      return map.get(normalized) || null;
    };

    operators.forEach((operator) => {
      const user = ensureUser(String(operator.matricula || "").trim(), operator.name || "");
      if (!user) return;

      user.name = operator.name || user.name;
      user.cargo = operator.cargo || user.cargo;
      user.setor = mergeSectorValues(user.setor, operator.setor || "");
      if (!user.roles.includes("operador")) user.roles.push("operador");
    });

    leaders.forEach((leader) => {
      const leaderMatricula =
        String(leader.operator_matricula || "").trim() ||
        String(leader.email || "").split("@")[0].trim();

      const user = ensureUser(leaderMatricula, leader.name || "");
      if (!user) return;

      user.name = leader.name || user.name;
      user.setor = mergeSectorValues(user.setor, leader.sector || "");
      user.email = leader.email || user.email;
      if (!user.roles.includes("lider")) user.roles.push("lider");
    });

    adminAccounts.forEach((account) => {
      const user = ensureUser(account.username, account.username);
      if (!user) return;

      if (account.role === "investigador") {
        if (!user.roles.includes("investigador")) user.roles.push("investigador");
      }

      if (account.role === "seguranca") {
        const taggedRoles = securityRoleTags[account.username] || ["supervisor"];
        taggedRoles.forEach((role) => {
          if (!user.roles.includes(role)) user.roles.push(role);
        });
      }
    });

    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name, "pt-BR"),
    );
  }, [operators, leaders, adminAccounts, securityRoleTags]);

  const filteredUsers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!normalizedSearch) return users;

    return users.filter((user) =>
      user.name.toLowerCase().includes(normalizedSearch) ||
      user.matricula.toLowerCase().includes(normalizedSearch) ||
      user.setor.toLowerCase().includes(normalizedSearch),
    );
  }, [users, searchTerm]);

  const clearForm = () => {
    setMatricula("");
    setName("");
    setCargo("");
    setSetor("");
    setEmail("");
    setPassword("");
    setSelectedRoles(new Set(["operador"]));
  };

  const setRole = (role: UnifiedRole, checked: boolean) => {
    setSelectedRoles((previous) => {
      const next = new Set(previous);
      if (checked) {
        next.add(role);
      } else {
        next.delete(role);
      }
      return next;
    });
  };

  const setSectorSelection = (sectorName: string, checked: boolean) => {
    setSetor((previous) => {
      const next = new Set(parseSectorList(previous));
      if (checked) {
        next.add(sectorName);
      } else {
        next.delete(sectorName);
      }
      return stringifySectorList(Array.from(next));
    });
  };

  const loadUserInForm = (user: UnifiedUser) => {
    setMatricula(user.matricula);
    setName(user.name);
    setCargo(user.cargo);
    setSetor(user.setor);
    setEmail(user.email);
    setPassword("");
    setSelectedRoles(new Set(user.roles));
  };

  const findLeaderByMatricula = (targetMatricula: string) =>
    leaders.find((leader) => {
      const leaderMatricula = String(leader.operator_matricula || "").trim();
      const fallbackMatricula = String(leader.email || "").split("@")[0].trim();
      return leaderMatricula === targetMatricula || fallbackMatricula === targetMatricula;
    });

  const saveUser = async () => {
    const matriculaTrim = matricula.trim();
    const nameTrim = name.trim();
    const passwordTrim = password.trim();
    const setorNormalized = stringifySectorList(parseSectorList(setor));
    const roleList = Array.from(selectedRoles);

    if (!matriculaTrim || !nameTrim) {
      toast({
        title: "Campos obrigatórios",
        description: "Informe matrícula e nome do usuário.",
        variant: "destructive",
      });
      return;
    }

    if (roleList.length === 0) {
      toast({
        title: "Perfil obrigatório",
        description: "Selecione ao menos um perfil para o usuário.",
        variant: "destructive",
      });
      return;
    }

    const hasOperator = roleList.includes("operador");
    const hasInvestigator = roleList.includes("investigador");
    const hasSecurity = roleList.some((role) => SECURITY_ROLES.includes(role));

    if (passwordTrim) {
      if (hasOperator && !/^\d{4,}$/.test(passwordTrim)) {
        toast({
          title: "Senha inválida para operador",
          description: "Para operador, a senha deve conter no mínimo 4 dígitos numéricos.",
          variant: "destructive",
        });
        return;
      }

      if (!hasOperator && passwordTrim.length < 4) {
        toast({
          title: "Senha inválida",
          description: "Para este perfil, a senha deve ter no mínimo 4 caracteres.",
          variant: "destructive",
        });
        return;
      }
    }

    if (hasInvestigator && hasSecurity) {
      toast({
        title: "Conflito de perfil",
        description:
          "No banco atual, a matrícula aceita somente 1 perfil administrativo. Use Investigador ou Segurança.",
        variant: "destructive",
      });
      return;
    }

    if (roleList.includes("lider") && !setorNormalized) {
      toast({
        title: "Setor obrigatório",
        description: "Para perfil de líder, informe o setor.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const existingOperator = operators.find(
        (operator) => String(operator.matricula || "").trim() === matriculaTrim,
      );
      const existingLeader = findLeaderByMatricula(matriculaTrim);
      const existingAdmin = adminAccounts.find(
        (account) => account.username === matriculaTrim,
      );

      if (roleList.includes("operador")) {
        if (existingOperator) {
          await operatorService.update(matriculaTrim, {
            name: nameTrim,
            cargo: cargo.trim() || null,
            setor: setorNormalized || null,
            ...(passwordTrim ? { senha: passwordTrim } : {}),
          });
        } else {
          await operatorService.create({
            matricula: matriculaTrim,
            name: nameTrim,
            cargo: cargo.trim() || null,
            setor: setorNormalized || null,
            senha: passwordTrim || null,
          });
        }
      }

      if (roleList.includes("lider")) {
        const leaderEmail = email.trim() || existingLeader?.email || `${matriculaTrim}@afm.local`;
        const passwordHash =
          passwordTrim.length > 0
            ? encodePassword(passwordTrim)
            : existingLeader?.password_hash || encodePassword(DEFAULT_PASSWORD);

        if (existingLeader) {
          await leaderService.update(existingLeader.id, {
            name: nameTrim,
            email: leaderEmail,
            sector: setorNormalized,
            operator_matricula: matriculaTrim,
            password_hash: passwordHash,
          });
        } else {
          await leaderService.create({
            name: nameTrim,
            email: leaderEmail,
            sector: setorNormalized,
            operator_matricula: matriculaTrim,
            password_hash: passwordHash,
          });
        }
      }

      if (hasInvestigator) {
        const canKeepCurrentPassword = existingAdmin?.role === "investigador" && !passwordTrim;

        if (!canKeepCurrentPassword) {
          if (!passwordTrim) {
            toast({
              title: "Senha obrigatória",
              description: "Informe senha para perfil investigador.",
              variant: "destructive",
            });
            setSaving(false);
            return;
          }

          if (passwordTrim.length < 4) {
            toast({
              title: "Senha inválida",
              description: "A senha do investigador deve ter no mínimo 4 caracteres.",
              variant: "destructive",
            });
            setSaving(false);
            return;
          }

          const ok = await upsertInvestigatorAccount(matriculaTrim, passwordTrim);
          if (!ok) {
            toast({
              title: "Erro ao salvar investigador",
              description: "Não foi possível atualizar as credenciais do investigador.",
              variant: "destructive",
            });
            setSaving(false);
            return;
          }
        }
      }

      if (hasSecurity) {
        const canKeepCurrentPassword = existingAdmin?.role === "seguranca" && !passwordTrim;

        if (!canKeepCurrentPassword) {
          if (!passwordTrim) {
            toast({
              title: "Senha obrigatória",
              description: "Informe senha para perfil de supervisor/segurança.",
              variant: "destructive",
            });
            setSaving(false);
            return;
          }

          if (passwordTrim.length < 4) {
            toast({
              title: "Senha inválida",
              description: "A senha de supervisor/segurança deve ter no mínimo 4 caracteres.",
              variant: "destructive",
            });
            setSaving(false);
            return;
          }

          const { error } = await supabase
            .from("admin_users")
            .upsert(
              [
                {
                  username: matriculaTrim,
                  role: "seguranca",
                  password_hash: encodePassword(passwordTrim),
                },
              ],
              { onConflict: "username" },
            );

          if (error) {
            toast({
              title: "Erro ao salvar segurança",
              description: "Não foi possível atualizar as credenciais de segurança.",
              variant: "destructive",
            });
            setSaving(false);
            return;
          }
        }

        setSecurityRoleTags((previous) => ({
          ...previous,
          [matriculaTrim]: roleList.filter((role): role is UnifiedRole =>
            SECURITY_ROLES.includes(role),
          ),
        }));
      }

      toast({
        title: "Usuário salvo",
        description: "Perfis atualizados com sucesso.",
      });

      await Promise.all([refresh(), loadAdminAccounts()]);
      clearForm();
    } catch (error) {
      console.error("Erro ao salvar usuário:", error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível concluir o cadastro do usuário.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleResetUserPassword = async (user: UnifiedUser) => {
    const hasSecurityRole = user.roles.some((role) => SECURITY_ROLES.includes(role));
    const hasAnyResettableProfile =
      user.roles.includes("operador") ||
      user.roles.includes("lider") ||
      user.roles.includes("investigador") ||
      hasSecurityRole;

    if (!hasAnyResettableProfile) {
      toast({
        title: "Perfil sem autenticação",
        description: "Esse usuário não possui perfil com senha para resetar.",
        variant: "destructive",
      });
      return;
    }

    if (typeof window !== "undefined") {
      const confirmed = window.confirm(
        `Resetar a senha do usuário ${user.name} (${user.matricula}) para ${DEFAULT_PASSWORD}?`,
      );
      if (!confirmed) return;
    }

    setResettingUserMatricula(user.matricula);
    const updatedProfiles: string[] = [];
    const errors: string[] = [];

    try {
      if (user.roles.includes("operador")) {
        try {
          await operatorService.update(user.matricula, {
            senha: `${DEFAULT_PASSWORD}|RESET`,
          });
          updatedProfiles.push("Operador");
        } catch (error) {
          console.error("Erro ao resetar senha de operador:", error);
          errors.push("Operador");
        }
      }

      if (user.roles.includes("lider")) {
        const existingLeader = findLeaderByMatricula(user.matricula);
        if (!existingLeader) {
          errors.push("Líder");
        } else {
          try {
            await leaderService.update(existingLeader.id, {
              password_hash: encodePassword(DEFAULT_PASSWORD),
            });
            updatedProfiles.push("Líder");
          } catch (error) {
            console.error("Erro ao resetar senha de líder:", error);
            errors.push("Líder");
          }
        }
      }

      if (user.roles.includes("investigador")) {
        const ok = await upsertInvestigatorAccount(user.matricula, DEFAULT_PASSWORD);
        if (ok) {
          updatedProfiles.push("Investigador");
        } else {
          errors.push("Investigador");
        }
      }

      if (hasSecurityRole) {
        const { error } = await supabase
          .from("admin_users")
          .upsert(
            [
              {
                username: user.matricula,
                role: "seguranca",
                password_hash: encodePassword(DEFAULT_PASSWORD),
              },
            ],
            { onConflict: "username" },
          );

        if (error) {
          console.error("Erro ao resetar senha de segurança:", error);
          errors.push("Segurança");
        } else {
          updatedProfiles.push("Segurança");
        }
      }

      if (updatedProfiles.length > 0) {
        toast({
          title: "Senha resetada",
          description: `Perfis atualizados: ${updatedProfiles.join(", ")}. Senha padrão: ${DEFAULT_PASSWORD}.`,
        });
      }

      if (errors.length > 0) {
        toast({
          title: "Reset parcial",
          description: `Não foi possível resetar: ${errors.join(", ")}.`,
          variant: "destructive",
        });
      }

      await Promise.all([refresh(), loadAdminAccounts()]);
    } finally {
      setResettingUserMatricula(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Usuários</h1>
          <p className="text-sm text-gray-600">
            Cadastro unificado de operador, líder e perfis administrativos.
          </p>
        </div>
        <Button variant="outline" onClick={() => Promise.all([refresh(), loadAdminAccounts()])}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Novo usuário</CardTitle>
          <CardDescription>
            Selecione os perfis que este usuário vai ter. Um usuário pode acumular funções.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Matrícula *</Label>
              <Input
                value={matricula}
                onChange={(event) => setMatricula(event.target.value)}
                placeholder="Ex: 3789"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Nome *</Label>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Nome completo"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Setores</Label>
            <div className="max-h-44 overflow-y-auto rounded-md border p-3">
              {sectors.length === 0 ? (
                <p className="text-sm text-gray-500">Nenhum setor cadastrado.</p>
              ) : (
                <div className="grid gap-2 md:grid-cols-2">
                  {sectors.map((item) => (
                    <label key={item.id} className="flex items-center gap-2 rounded border px-3 py-2">
                      <Checkbox
                        checked={selectedSetores.includes(item.name)}
                        onCheckedChange={(checked) => setSectorSelection(item.name, Boolean(checked))}
                      />
                      <span className="text-sm">{item.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {selectedSetores.length === 0 ? (
                <p className="text-xs text-gray-500">Nenhum setor selecionado.</p>
              ) : (
                selectedSetores.map((sectorName) => (
                  <Badge key={sectorName} variant="secondary">
                    {sectorName}
                  </Badge>
                ))
              )}
              {selectedSetores.length > 0 && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setSetor("")}>
                  Limpar setores
                </Button>
              )}
            </div>
            <p className="text-xs text-gray-500">
              Um mesmo usuário pode ter mais de um setor.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Cargo</Label>
              <Input
                value={cargo}
                onChange={(event) => setCargo(event.target.value)}
                placeholder="Ex: Operador de ponte"
              />
            </div>
            <div className="space-y-2">
              <Label>Email (líder)</Label>
              <Input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="opcional@empresa.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Senha</Label>
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Operador: mínimo 4 dígitos | Demais: mínimo 4 caracteres"
            />
          </div>

          <div className="space-y-2">
            <Label>Perfis</Label>
            <div className="grid gap-2 md:grid-cols-3">
              {(
                [
                  "operador",
                  "lider",
                  "investigador",
                  "supervisor",
                  "tec_seguranca",
                  "inspetor",
                ] as UnifiedRole[]
              ).map((role) => (
                <label key={role} className="flex items-center gap-2 rounded border px-3 py-2">
                  <Checkbox
                    checked={selectedRoles.has(role)}
                    onCheckedChange={(checked) => setRole(role, Boolean(checked))}
                  />
                  <span className="text-sm">{ROLE_LABEL[role]}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-500">
              Observação: no banco atual, perfis administrativos aceitam apenas uma credencial por matrícula.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={saveUser} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Salvando..." : "Salvar usuário"}
            </Button>
            <Button variant="outline" onClick={clearForm}>
              <UserPlus className="mr-2 h-4 w-4" />
              Limpar formulário
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Usuários cadastrados</CardTitle>
          <CardDescription>
            Clique em uma linha para carregar o usuário no formulário.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Buscar por nome, matrícula ou setor"
          />

          {loading || loadingAccounts ? (
            <div className="text-sm text-gray-600">Carregando usuários...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="rounded border bg-gray-50 p-4 text-sm text-gray-600">
              Nenhum usuário encontrado.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Matrícula</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Setor</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Perfis</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow
                      key={user.matricula}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => loadUserInForm(user)}
                    >
                      <TableCell>{user.matricula}</TableCell>
                      <TableCell>{user.name}</TableCell>
                      <TableCell>{user.setor || "N/A"}</TableCell>
                      <TableCell>{user.cargo || "N/A"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {user.roles.map((role) => (
                            <Badge key={`${user.matricula}-${role}`} variant="outline">
                              {ROLE_LABEL[role]}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={resettingUserMatricula === user.matricula}
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleResetUserPassword(user);
                          }}
                        >
                          <KeyRound className="mr-2 h-4 w-4" />
                          {resettingUserMatricula === user.matricula ? "Resetando..." : "Resetar senha"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminUsers;

