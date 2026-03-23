import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { buildStoredPassword, parseStoredPassword } from "@/lib/password-utils";
import { normalizeQuestion } from "@/lib/alertRules";

// Types
export type Operator = Tables<"operators">;
export type Equipment = Tables<"equipment">;
export type Inspection = Tables<"inspections">;
export type GoldenRule = Tables<"golden_rules">;
export type GoldenRuleResponse = Tables<"golden_rule_responses">;
export type GoldenRuleAttachment = Tables<"golden_rule_attachments">;
export type AccidentActionPlan = Tables<"accident_action_plans">;
export type AccidentActionPlanComment = Tables<"accident_action_plan_comments">;
export type ChecklistItem = Tables<"checklist_items">;
export type Sector = Tables<"sectors">;
export type Leader = Tables<"leaders">;
export type InsertLeader = TablesInsert<"leaders">;
export type UpdateLeader = TablesUpdate<"leaders">;
export type SectorLeaderAssignment = Tables<"sector_leader_assignments">;
export type SectorLeaderAssignmentInsert = TablesInsert<"sector_leader_assignments">;
export type SectorLeaderAssignmentUpdate = TablesUpdate<"sector_leader_assignments">;
export type ChecklistGroup = {
  id: string;
  name: string;
  description?: string | null;
  equipment_type?: string | null;
};
export type GroupQuestion = {
  id: string;
  group_id: string;
  question: string;
  alert_on_yes?: boolean;
  alert_on_no?: boolean;
  order_number?: number;
};
export type GroupProcedure = {
  id: string;
  group_id: string;
  title: string;
  description?: string | null;
  procedure_type?: string | null;
  order_number?: number;
};

export type OperatorInsert = TablesInsert<"operators">;
export type EquipmentInsert = TablesInsert<"equipment">;
export type InspectionInsert = TablesInsert<"inspections">;
export type GoldenRuleInsert = TablesInsert<"golden_rules">;
export type AccidentActionPlanInsert = TablesInsert<"accident_action_plans">;

const normalizeSectorName = (value?: string | null) =>
  (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const parseSectorNames = (value?: string | null) =>
  (value || "")
    .split(/[,;/]/)
    .map((item) => item.trim())
    .filter(Boolean);

export interface GoldenRuleRecordPayload {
  id?: string;
  numero_inspecao?: number;
  titulo: string;
  setor: string;
  gestor: string;
  tecnico_seg: string;
  acompanhante: string;
  ass_tst?: string | null;
  ass_gestor?: string | null;
  ass_acomp?: string | null;
  created_at?: string;
  responses: Array<{
    codigo: string;
    numero: string;
    pergunta: string;
    resposta: "Sim" | "Não" | "Nao" | "N/A";
    comentario?: string;
    foto?: {
      name?: string;
      size?: number;
      type?: string;
      data_url?: string;
    } | null;
    evidencias?: Array<{
      comentario?: string;
      foto?: {
        name?: string;
        size?: number;
        type?: string;
        data_url?: string;
      } | null;
    }>;
  }>;
  attachments: Array<{
    name?: string;
    size?: number;
    type?: string;
    data_url?: string;
  }>;
}

export interface AccidentActionPlanRecordPayload {
  id?: string;
  numero_plano?: number;
  created_at?: string;
  updated_at?: string;
  numero_ocorrencia: number;
  data_ocorrencia?: string | null;
  prioridade_ocorrencia?: string | null;
  descricao_ocorrencia?: string | null;
  origem?: string;
  descricao_resumida_acao: string;
  severidade?: string | null;
  probabilidade?: string | null;
  prioridade?: string;
  status?: string;
  responsavel_execucao: string;
  inicio_planejado?: string | null;
  termino_planejado?: string | null;
  acao_iniciada?: string | null;
  acao_finalizada?: string | null;
  descricao_acao: string;
  observacoes_conclusao?: string | null;
  data_eficacia?: string | null;
  observacao_eficacia?: string | null;
  comentarios: Array<{
    id?: string;
    texto: string;
    autor?: string;
    created_at?: string;
  }>;
}

const notifyInspectionEmail = async (inspectionId: string) => {
  if (!inspectionId) return;

  try {
    const { error } = await supabase.functions.invoke("send-inspection-email", {
      body: { inspectionId },
    });

    if (error) {
      console.error("[inspectionService] Falha ao enviar e-mail de inspeção:", error);
    }
  } catch (error) {
    console.error("[inspectionService] Erro ao acionar função de e-mail:", error);
  }
};

const relationMissingError = (error: unknown, relationName: string) => {
  const message = String((error as any)?.message || "").toLowerCase();
  return message.includes("does not exist") && message.includes(relationName.toLowerCase());
};

const isUniqueViolationError = (error: unknown) => {
  const code = String((error as any)?.code || "").toLowerCase();
  const message = String((error as any)?.message || "").toLowerCase();
  return code === "23505" || message.includes("duplicate key") || message.includes("unique constraint");
};

const ensureOperatorPasswordHash = async (senha?: string | null) => {
  const trimmed = (senha || "").trim();
  if (!trimmed) {
    return null;
  }

  const [rawPassword, maybeFlag] = trimmed.split("|");
  if (!rawPassword) {
    return null;
  }

  const isAlreadyHashed = rawPassword.startsWith("sha256:");
  if (isAlreadyHashed) {
    return maybeFlag ? `${rawPassword}|${maybeFlag}` : rawPassword;
  }

  const hashed = await buildStoredPassword(rawPassword);
  return maybeFlag ? `${hashed}|${maybeFlag}` : hashed;
};

const toNullableDate = (value?: string | null) => {
  if (!value) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
};

const chunkArray = <T>(items: T[], chunkSize: number) => {
  const normalizedChunkSize = Math.max(1, chunkSize);
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += normalizedChunkSize) {
    chunks.push(items.slice(index, index + normalizedChunkSize));
  }

  return chunks;
};

// Operators
const isMissingSenhaColumnError = (error: any) => {
  if (typeof error?.message !== "string") return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes('column "senha" does not exist') ||
    msg.includes("could not find the 'senha' column")
  );
};

export const operatorService = {
  async getAll() {
    const { data, error } = await supabase
      .from("operators")
      .select("*")
      .order("name");
    
    if (error) throw error;
    return data || [];
  },

  async create(operator: OperatorInsert) {
    const password = await ensureOperatorPasswordHash(operator.senha);
    const payload: OperatorInsert = {
      ...operator,
      senha: password,
    };

    const { data, error } = await supabase
      .from("operators")
      .insert(payload)
      .select()
      .single();

    if (error) {
      if (isMissingSenhaColumnError(error)) {
        console.warn(
          "[operatorService.create] Coluna 'senha' não encontrada. Inserindo sem a coluna. Execute a migration mais recente para habilitar armazenamento de senha."
        );
        const { senha, ...fallbackPayload } = payload;
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("operators")
          .insert(fallbackPayload)
          .select()
          .single();
        if (fallbackError) throw fallbackError;
        return fallbackData;
      }
      throw error;
    }
    return data;
  },

  async update(matricula: string, updates: TablesUpdate<"operators">) {
    const payload: TablesUpdate<"operators"> = {
      ...updates,
    };

    if (payload.senha !== undefined) {
      payload.senha = await ensureOperatorPasswordHash(payload.senha as string | null);
    }

    const { data, error } = await supabase
      .from("operators")
      .update(payload)
      .eq("matricula", matricula)
      .select()
      .single();
    
    if (error) {
      if (isMissingSenhaColumnError(error)) {
        console.warn(
          "[operatorService.update] Coluna 'senha' não encontrada. Atualizando sem a coluna. Execute a migration mais recente para habilitar armazenamento de senha."
        );
        const { senha, ...fallbackPayload } = payload;
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("operators")
          .update(fallbackPayload)
          .eq("matricula", matricula)
          .select()
          .single();
        if (fallbackError) throw fallbackError;
        return fallbackData;
      }
      throw error;
    }
    return data;
  },

  async delete(matricula: string) {
    const { error } = await supabase
      .from("operators")
      .delete()
      .eq("matricula", matricula);
    
    if (error) throw error;
  }
};

// Equipment
export const equipmentService = {
  async getAll() {
    const { data, error } = await supabase
      .from("equipment")
      .select("*")
      .order("name");
    
    if (error) throw error;
    return data || [];
  },

  async create(equipment: EquipmentInsert) {
    const { data, error } = await supabase
      .from("equipment")
      .insert(equipment)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: TablesUpdate<"equipment">) {
    const { data, error } = await supabase
      .from("equipment")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async delete(id: string) {
    const { error } = await supabase
      .from("equipment")
      .delete()
      .eq("id", id);
    
    if (error) throw error;
  }
};

// Checklist Items
const isUuid = (value: unknown): boolean => {
  if (typeof value !== "string") return false;
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
    value,
  );
};

export const checklistService = {
  async getAll() {
    const { data, error } = await supabase
      .from("checklist_items")
      .select("*")
      .order("order_number");
    
    if (error) throw error;
    return data || [];
  },

  async replaceAll(items: Array<{ id?: string; question: string; alertOnYes?: boolean; alertOnNo?: boolean }>) {
    const formattedItems = items
      .map((item, index) => {
        const payload: Record<string, any> = {
          question: item.question.trim(),
          order_number: index + 1,
          alert_on_yes: Boolean(item.alertOnYes),
          alert_on_no: Boolean(item.alertOnNo),
        };

        if (isUuid(item.id)) {
          payload.id = item.id;
        }

        return payload;
      })
      .filter((item) => item.question.length > 0);

    const { error: deleteError } = await supabase
      .from("checklist_items")
      .delete()
      .neq("id", "");
    
    if (deleteError) throw deleteError;

    if (formattedItems.length === 0) {
      return [];
    }

    const { data, error } = await supabase
      .from("checklist_items")
      .insert(formattedItems)
      .select()
      .order("order_number");
    
    if (error) throw error;
    return data || [];
  },
};

// Inspections
export const inspectionService = {
  async getAll() {
    const { data, error } = await supabase
      .from("inspections")
      .select(`
        *,
        operator:operators!inspections_operator_matricula_fkey(*),
        equipment:equipment(*)
      `)
      .order("created_at", { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  async create(inspection: InspectionInsert, options?: { notifyEmail?: boolean }) {
    const { data, error } = await supabase
      .from("inspections")
      .insert(inspection)
      .select(`
        *,
        operator:operators!inspections_operator_matricula_fkey(*),
        equipment:equipment(*)
      `)
      .single();
    
    if (error) throw error;
    if (options?.notifyEmail !== false && data?.id) {
      void notifyInspectionEmail(data.id);
    }
    return data;
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from("inspections")
      .select(`
        *,
        operator:operators!inspections_operator_matricula_fkey(*),
        equipment:equipment(*)
      `)
      .eq("id", id)
      .maybeSingle();
    
    if (error) throw error;
    return data;
  },

  async delete(id: string) {
    const { error } = await supabase
      .from("inspections")
      .delete()
      .eq("id", id);

    if (error) throw error;
  }
};

// Sectors
export const sectorService = {
  async getAll() {
    const { data, error } = await supabase
      .from("sectors")
      .select("*")
      .order("name");
    
    if (error) throw error;
    return data || [];
  },

  async create(sector: TablesInsert<"sectors">) {
    const { data, error } = await supabase
      .from("sectors")
      .insert(sector)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: TablesUpdate<"sectors">) {
    const { data, error } = await supabase
      .from("sectors")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async delete(id: string) {
    const { error } = await supabase
      .from("sectors")
      .delete()
      .eq("id", id);
    
    if (error) throw error;
  }
};

// Leaders
export const leaderService = {
  async getAll() {
    const { data, error } = await supabase
      .from("leaders")
      .select("*")
      .order("name");
    
    if (error) throw error;
    return data || [];
  },

  async create(leader: InsertLeader) {
    const { data, error } = await supabase
      .from("leaders")
      .insert(leader)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async update(id: string, leader: UpdateLeader) {
    const { data, error } = await supabase
      .from("leaders")
      .update(leader)
      .eq("id", id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async delete(id: string) {
    const { error } = await supabase
      .from("leaders")
      .delete()
      .eq("id", id);
    
    if (error) throw error;
  }
};

// Sector leader assignments (supports multiple leaders per sector with shift)
export const sectorLeaderAssignmentService = {
  async getAll() {
    const { data, error } = await supabase
      .from("sector_leader_assignments")
      .select("*");

    if (error) throw error;

    let assignments = data || [];

    // Recover legacy mappings from leaders.sector / sectors.leader_id whenever there are gaps.
    const repaired = await this.repairLegacyAssignments();
    if (repaired > 0) {
      const { data: refreshedData, error: refreshedError } = await supabase
        .from("sector_leader_assignments")
        .select("*");

      if (refreshedError) throw refreshedError;
      assignments = refreshedData || [];
    }

    return assignments;
  },

  async create(assignment: SectorLeaderAssignmentInsert) {
    const { data, error } = await supabase
      .from("sector_leader_assignments")
      .upsert(assignment, { onConflict: "sector_id,leader_id,shift" })
      .select()
      .single();

    if (error) throw error;
    await this.syncLegacyLeaderAndSectorFields({
      leaderIds: [data.leader_id],
      sectorIds: [data.sector_id],
    });
    return data;
  },

  async upsertMany(assignments: SectorLeaderAssignmentInsert[]) {
    if (assignments.length === 0) {
      return [] as SectorLeaderAssignment[];
    }

    const { data, error } = await supabase
      .from("sector_leader_assignments")
      .upsert(assignments, { onConflict: "sector_id,leader_id,shift" })
      .select();

    if (error) throw error;
    await this.syncLegacyLeaderAndSectorFields({
      leaderIds: assignments.map((assignment) => assignment.leader_id),
      sectorIds: assignments.map((assignment) => assignment.sector_id),
    });
    return data || [];
  },

  async update(id: string, updates: SectorLeaderAssignmentUpdate) {
    const { data, error } = await supabase
      .from("sector_leader_assignments")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async delete(id: string) {
    const { data, error } = await supabase
      .from("sector_leader_assignments")
      .delete()
      .eq("id", id)
      .select("leader_id, sector_id")
      .single();

    if (error) throw error;

    await this.syncLegacyLeaderAndSectorFields({
      leaderIds: [data.leader_id],
      sectorIds: [data.sector_id],
    });
  },

  async syncDefaultAssignmentsForLeader({
    leaderId,
    sectorNames,
    sectors,
    currentAssignments,
  }: {
    leaderId: string;
    sectorNames: string[];
    sectors?: Sector[];
    currentAssignments?: SectorLeaderAssignment[];
  }) {
    const sectorList = sectors || (await sectorService.getAll());
    const assignmentList = currentAssignments || (await this.getAll());

    const sectorMap = new Map<string, Sector>();
    sectorList.forEach((sector) => {
      sectorMap.set(normalizeSectorName(sector.name), sector);
    });

    const desiredSectorIds = Array.from(
      new Set(
        sectorNames
          .map((sectorName) => sectorMap.get(normalizeSectorName(sectorName))?.id || null)
          .filter((sectorId): sectorId is string => Boolean(sectorId)),
      ),
    );

    const leaderAssignments = assignmentList.filter(
      (assignment) => assignment.leader_id === leaderId,
    );

    const defaultAssignments = leaderAssignments.filter(
      (assignment) => (assignment.shift || "default") === "default",
    );

    const defaultSectorIds = new Set(defaultAssignments.map((assignment) => assignment.sector_id));

    const assignmentsToDelete = defaultAssignments.filter(
      (assignment) => !desiredSectorIds.includes(assignment.sector_id),
    );

    for (const assignment of assignmentsToDelete) {
      await this.delete(assignment.id);
    }

    const assignmentsToCreate = desiredSectorIds
      .filter((sectorId) => !defaultSectorIds.has(sectorId))
      .map((sectorId) => ({
        sector_id: sectorId,
        leader_id: leaderId,
        shift: "default",
      }));

    if (assignmentsToCreate.length > 0) {
      await this.upsertMany(assignmentsToCreate);
    }

    await this.syncLegacyLeaderAndSectorFields({
      leaderIds: [leaderId],
      sectorIds: Array.from(
        new Set([
          ...desiredSectorIds,
          ...defaultAssignments.map((assignment) => assignment.sector_id),
        ]),
      ),
      sectors: sectorList,
      assignments: await this.getAllWithoutRepair(),
    });
  },

  async getAllWithoutRepair() {
    const { data, error } = await supabase
      .from("sector_leader_assignments")
      .select("*");

    if (error) throw error;
    return data || [];
  },

  async syncLegacyLeaderAndSectorFields({
    leaderIds,
    sectorIds,
    leaders,
    sectors,
    assignments,
  }: {
    leaderIds?: string[];
    sectorIds?: string[];
    leaders?: Leader[];
    sectors?: Sector[];
    assignments?: SectorLeaderAssignment[];
  }) {
    const uniqueLeaderIds = Array.from(new Set((leaderIds || []).filter(Boolean)));
    const uniqueSectorIds = Array.from(new Set((sectorIds || []).filter(Boolean)));

    if (uniqueLeaderIds.length === 0 && uniqueSectorIds.length === 0) {
      return;
    }

    const [leaderList, sectorList, assignmentList] = await Promise.all([
      leaders ? Promise.resolve(leaders) : leaderService.getAll(),
      sectors ? Promise.resolve(sectors) : sectorService.getAll(),
      assignments ? Promise.resolve(assignments) : this.getAllWithoutRepair(),
    ]);

    const sectorsById = new Map(sectorList.map((sector) => [sector.id, sector]));

    for (const leaderId of uniqueLeaderIds) {
      const leader = leaderList.find((item) => item.id === leaderId);
      if (!leader) continue;

      const sectorNames = assignmentList
        .filter(
          (assignment) =>
            assignment.leader_id === leaderId && (assignment.shift || "default") === "default",
        )
        .map((assignment) => sectorsById.get(assignment.sector_id)?.name || "")
        .filter(Boolean);

      const normalizedSectorValue = Array.from(new Set(sectorNames)).join(", ");
      const currentSectorValue = String(leader.sector || "");

      if (currentSectorValue !== normalizedSectorValue) {
        await leaderService.update(leaderId, {
          sector: normalizedSectorValue,
        });
      }
    }

    for (const sectorId of uniqueSectorIds) {
      const defaultAssignment = assignmentList.find(
        (assignment) =>
          assignment.sector_id === sectorId && (assignment.shift || "default") === "default",
      );

      const sector = sectorsById.get(sectorId);
      if (!sector) continue;

      const nextLeaderId = defaultAssignment?.leader_id || null;
      if ((sector.leader_id || null) !== nextLeaderId) {
        await sectorService.update(sectorId, {
          leader_id: nextLeaderId,
        });
      }
    }
  },

  async repairLegacyAssignments() {
    const [
      { data: leaders, error: leadersError },
      { data: sectors, error: sectorsError },
      { data: assignments, error: assignmentsError },
    ] = await Promise.all([
      supabase.from("leaders").select("id, sector"),
      supabase.from("sectors").select("id, name, leader_id"),
      supabase.from("sector_leader_assignments").select("sector_id, leader_id, shift"),
    ]);

    if (leadersError) throw leadersError;
    if (sectorsError) throw sectorsError;
    if (assignmentsError) throw assignmentsError;

    const sectorMap = new Map<string, { id: string; leader_id: string | null }>();
    (sectors || []).forEach((sector) => {
      sectorMap.set(normalizeSectorName(sector.name), {
        id: sector.id,
        leader_id: sector.leader_id,
      });
    });

    const existingKeys = new Set(
      (assignments || []).map(
        (assignment) => `${assignment.sector_id}::${assignment.leader_id}::${assignment.shift || "default"}`,
      ),
    );

    const recordsToUpsert: SectorLeaderAssignmentInsert[] = [];

    (leaders || []).forEach((leader) => {
      parseSectorNames(leader.sector).forEach((sectorName) => {
        const matchedSector = sectorMap.get(normalizeSectorName(sectorName));
        if (!matchedSector) return;

        const key = `${matchedSector.id}::${leader.id}::default`;
        if (existingKeys.has(key)) return;

        existingKeys.add(key);
        recordsToUpsert.push({
          sector_id: matchedSector.id,
          leader_id: leader.id,
          shift: "default",
        });
      });
    });

    (sectors || []).forEach((sector) => {
      if (!sector.leader_id) return;
      const key = `${sector.id}::${sector.leader_id}::default`;
      if (existingKeys.has(key)) return;

      existingKeys.add(key);
      recordsToUpsert.push({
        sector_id: sector.id,
        leader_id: sector.leader_id,
        shift: "default",
      });
    });

    if (recordsToUpsert.length === 0) {
      return 0;
    }

    await this.upsertMany(recordsToUpsert);
    return recordsToUpsert.length;
  },
};

// Checklist groups
export const checklistGroupService = {
  async getAll() {
    const { data, error } = await supabase.from("checklist_groups").select("*").order("name");
    if (error) throw error;
    return data || [];
  },
  async create(group: { name: string; description?: string | null; equipment_type?: string | null }) {
    const { data, error } = await supabase.from("checklist_groups").insert(group as any).select().single();
    if (error) throw error;
    return data;
  },
  async update(
    id: string,
    updates: Partial<{ name: string; description?: string | null; equipment_type?: string | null }>,
  ) {
    const { data, error } = await supabase
      .from("checklist_groups")
      .update(updates as any)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  async delete(id: string) {
    const { error } = await supabase.from("checklist_groups").delete().eq("id", id);
    if (error) throw error;
  },
};

export const groupQuestionService = {
  async getAll() {
    const { data, error } = await supabase.from("group_questions").select("*").order("order_number");
    if (error) throw error;
    const rows = data || [];

    const uniqueMap = new Map<string, GroupQuestion>();
    rows.forEach((row) => {
      const key = `${row.group_id}::${normalizeQuestion(String(row.question || ""))}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, row);
      }
    });

    return Array.from(uniqueMap.values());
  },
  async upsert(question: Partial<GroupQuestion>) {
    const { data, error } = await supabase.from("group_questions").upsert(question).select().single();
    if (error) throw error;
    return data;
  },
  async upsertMany(questions: Partial<GroupQuestion>[]) {
    if (!questions || questions.length === 0) return [];
    const { data, error } = await supabase
      .from("group_questions")
      .upsert(questions, { onConflict: "group_id,question" })
      .select();
    if (error) throw error;
    return data || [];
  },
  async delete(id: string) {
    const { error } = await supabase.from("group_questions").delete().eq("id", id);
    if (error) throw error;
  },
};

export const groupProcedureService = {
  async getAll() {
    const { data, error } = await supabase.from("group_procedures").select("*").order("order_number");
    if (error) throw error;
    return data || [];
  },
  async upsert(proc: Partial<GroupProcedure>) {
    const { data, error } = await supabase.from("group_procedures").upsert(proc).select().single();
    if (error) throw error;
    return data;
  },
  async delete(id: string) {
    const { error } = await supabase.from("group_procedures").delete().eq("id", id);
    if (error) throw error;
  },
};

export const equipmentGroupService = {
  async getAll() {
    const { data, error } = await supabase.from("equipment_groups").select("*");
    if (error) throw error;
    return data || [];
  },
  async setGroups(equipmentId: string, groupIds: string[]) {
    const { error: delError } = await supabase.from("equipment_groups").delete().eq("equipment_id", equipmentId);
    if (delError) throw delError;
    if (groupIds.length === 0) return [];
    const rows = groupIds.map((gid) => ({ equipment_id: equipmentId, group_id: gid }));
    const { data, error } = await supabase.from("equipment_groups").insert(rows).select();
    if (error) throw error;
    return data;
  },
  async setGroupsForGroup(groupId: string, equipmentIds: string[]) {
    const { error: delError } = await supabase.from("equipment_groups").delete().eq("group_id", groupId);
    if (delError) throw delError;
    if (equipmentIds.length === 0) return [];
    const rows = equipmentIds.map((eid) => ({ equipment_id: eid, group_id: groupId }));
    const { data, error } = await supabase.from("equipment_groups").insert(rows).select();
    if (error) throw error;
    return data;
  },
};

export const goldenRuleService = {
  async getNextInspectionNumber() {
    const { data, error } = await supabase
      .from("golden_rules")
      .select("numero_inspecao")
      .order("numero_inspecao", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      if (relationMissingError(error, "golden_rules")) return 1;
      throw error;
    }

    return (Number(data?.numero_inspecao) || 0) + 1;
  },

  async appendResponseEvidences(responseIds: string[], rows: any[], includeImageData = true) {
    if (responseIds.length === 0) return rows;

    try {
      const evidenceRows: any[] = [];

      for (const batchIds of chunkArray(responseIds, 10)) {
        const { data, error } = await (supabase as any)
          .from("golden_rule_response_evidences")
          .select(
            includeImageData
              ? "*"
              : "id,response_id,order_index,comentario,foto_name,foto_size,foto_type,created_at",
          )
          .in("response_id", batchIds)
          .order("order_index", { ascending: true });

        if (error) {
          if (relationMissingError(error, "golden_rule_response_evidences")) return rows;
          throw error;
        }

        evidenceRows.push(...(data || []));
      }

      const grouped = new Map<string, any[]>();
      evidenceRows.forEach((item: any) => {
        const current = grouped.get(item.response_id) || [];
        current.push(item);
        grouped.set(item.response_id, current);
      });

      return rows.map((row: any) => ({
        ...row,
        responses: Array.isArray(row.responses)
          ? row.responses.map((response: any) => ({
              ...response,
              evidences: grouped.get(response.id) || [],
            }))
          : [],
      }));
    } catch (error) {
      console.warn("[goldenRuleService] Falha ao carregar evidencias das respostas:", error);
      return rows;
    }
  },

  async hydrateRulesWithRelations(
    ruleRows: any[],
    options?: {
      includeAttachments?: boolean;
      includeEvidencePayloads?: boolean;
      includeResponseImageData?: boolean;
      includeAttachmentImageData?: boolean;
    },
  ) {
    const rows = Array.isArray(ruleRows) ? ruleRows : [];
    if (rows.length === 0) return [];

    const {
      includeAttachments = true,
      includeEvidencePayloads = true,
      includeResponseImageData = true,
      includeAttachmentImageData = true,
    } = options || {};

    const ruleIds = rows.map((rule: any) => rule?.id).filter(Boolean);
    const responseMap = new Map<string, any[]>();
    const attachmentMap = new Map<string, any[]>();

    try {
      for (const batchIds of chunkArray(ruleIds, 5)) {
        const { data: responseRows, error: responsesError } = await supabase
          .from("golden_rule_responses")
          .select(
            includeResponseImageData
              ? "*"
              : "id,regra_id,codigo,numero,pergunta,resposta,comentario,foto_name,foto_size,foto_type,created_at",
          )
          .in("regra_id", batchIds)
          .order("numero", { ascending: true });

        if (responsesError) {
          if (!relationMissingError(responsesError, "golden_rule_responses")) {
            console.warn("[goldenRuleService] Falha ao carregar respostas das regras de ouro:", responsesError);
          }
          continue;
        }

        (responseRows || []).forEach((response: any) => {
          const current = responseMap.get(response.regra_id) || [];
          current.push(response);
          responseMap.set(response.regra_id, current);
        });
      }
    } catch (error) {
      console.warn("[goldenRuleService] Erro ao hidratar respostas das regras de ouro:", error);
    }

    if (includeAttachments) {
      try {
        for (const batchIds of chunkArray(ruleIds, 5)) {
          const { data: attachmentRows, error: attachmentsError } = await supabase
            .from("golden_rule_attachments")
            .select(
              includeAttachmentImageData
                ? "*"
                : "id,regra_id,file_name,file_size,file_type,created_at",
            )
            .in("regra_id", batchIds)
            .order("created_at", { ascending: true });

          if (attachmentsError) {
            if (!relationMissingError(attachmentsError, "golden_rule_attachments")) {
              console.warn("[goldenRuleService] Falha ao carregar anexos das regras de ouro:", attachmentsError);
            }
            continue;
          }

          (attachmentRows || []).forEach((attachment: any) => {
            const current = attachmentMap.get(attachment.regra_id) || [];
            current.push(attachment);
            attachmentMap.set(attachment.regra_id, current);
          });
        }
      } catch (error) {
        console.warn("[goldenRuleService] Erro ao hidratar anexos das regras de ouro:", error);
      }
    }

    const hydratedRows = rows.map((rule: any) => ({
      ...rule,
      responses: responseMap.get(rule.id) || [],
      attachments: includeAttachments ? attachmentMap.get(rule.id) || [] : [],
    }));

    if (!includeEvidencePayloads) {
      return hydratedRows.map((row: any) => ({
        ...row,
        responses: Array.isArray(row.responses)
          ? row.responses.map((response: any) => ({
              ...response,
              evidences: [],
            }))
          : [],
      }));
    }

    const responseIds = hydratedRows.flatMap((rule: any) =>
      Array.isArray(rule.responses)
        ? rule.responses.map((response: any) => response?.id).filter(Boolean)
        : [],
    );

    return this.appendResponseEvidences(responseIds, hydratedRows, includeResponseImageData);
  },

  async getAll() {
    const { data, error } = await supabase
      .from("golden_rules")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return this.hydrateRulesWithRelations(data || [], {
      includeAttachments: false,
      includeEvidencePayloads: false,
      includeResponseImageData: false,
      includeAttachmentImageData: false,
    });
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from("golden_rules")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return data;

    const [hydrated] = await this.hydrateRulesWithRelations([data as any], {
      includeAttachments: true,
      includeEvidencePayloads: true,
      includeResponseImageData: true,
      includeAttachmentImageData: true,
    });
    return hydrated;
  },

  async upsertFromLegacy(payload: GoldenRuleRecordPayload) {
    let savedRule: any = null;
    let lastError: unknown = null;
    const requestedInspectionNumber = Number(payload.numero_inspecao) || 0;
    const triedNumbers = new Set<number>();

    const buildRuleInsert = (numeroInspecao?: number): GoldenRuleInsert => ({
      id: payload.id,
      ...(numeroInspecao ? { numero_inspecao: numeroInspecao } : {}),
      titulo: payload.titulo,
      setor: payload.setor,
      gestor: payload.gestor,
      tecnico_seg: payload.tecnico_seg,
      acompanhante: payload.acompanhante,
      ass_tst: payload.ass_tst ?? null,
      ass_gestor: payload.ass_gestor ?? null,
      ass_acomp: payload.ass_acomp ?? null,
      created_at: payload.created_at,
    });

    const trySaveRule = async (numeroInspecao?: number) => {
      if (numeroInspecao) {
        triedNumbers.add(numeroInspecao);
      }

      return supabase
        .from("golden_rules")
        .upsert(buildRuleInsert(numeroInspecao), { onConflict: "id" })
        .select()
        .single();
    };

    const attempts: Array<number | undefined> = [];
    if (requestedInspectionNumber > 0) {
      attempts.push(requestedInspectionNumber);
    }
    attempts.push(undefined);

    for (const attemptNumber of attempts) {
      const { data, error } = await trySaveRule(attemptNumber);
      if (!error) {
        savedRule = data;
        break;
      }

      lastError = error;
      if (!isUniqueViolationError(error)) {
        throw error;
      }
    }

    for (let attempt = 0; !savedRule && attempt < 5; attempt += 1) {
      let nextInspectionNumber = 0;

      try {
        nextInspectionNumber = await this.getNextInspectionNumber();
      } catch (error) {
        if (!relationMissingError(error, "golden_rules")) {
          throw error;
        }
        nextInspectionNumber = requestedInspectionNumber + attempt + 1;
      }

      while (triedNumbers.has(nextInspectionNumber)) {
        nextInspectionNumber += 1;
      }

      const { data, error } = await trySaveRule(nextInspectionNumber);
      if (!error) {
        savedRule = data;
        break;
      }

      lastError = error;
      if (!isUniqueViolationError(error)) {
        throw error;
      }
    }

    if (!savedRule) throw lastError;

    const { error: deleteResponsesError } = await supabase
      .from("golden_rule_responses")
      .delete()
      .eq("regra_id", savedRule.id);
    if (deleteResponsesError) throw deleteResponsesError;

    if (payload.responses.length > 0) {
      const responseRows = payload.responses.map((item) => ({
        regra_id: savedRule.id,
        codigo: item.codigo,
        numero: item.numero,
        pergunta: item.pergunta,
        resposta: item.resposta === "Nao" ? "Não" : item.resposta,
        comentario: item.comentario || item.evidencias?.[0]?.comentario || null,
        foto_name: item.foto?.name || item.evidencias?.[0]?.foto?.name || null,
        foto_size: Number(item.foto?.size || item.evidencias?.[0]?.foto?.size || 0) || null,
        foto_type: item.foto?.type || item.evidencias?.[0]?.foto?.type || null,
        foto_data_url: item.foto?.data_url || item.evidencias?.[0]?.foto?.data_url || null,
      }));

      const { data: insertedResponses, error: insertResponsesError } = await supabase
        .from("golden_rule_responses")
        .insert(responseRows)
        .select("id, codigo");
      if (insertResponsesError) throw insertResponsesError;

      try {
        const responseIds = (insertedResponses || []).map((response: any) => response.id);
        if (responseIds.length > 0) {
          await (supabase as any)
            .from("golden_rule_response_evidences")
            .delete()
            .in("response_id", responseIds);
        }

        const evidenceRows = (insertedResponses || []).flatMap((response: any) => {
          const source = payload.responses.find((item) => item.codigo === response.codigo);
          return (source?.evidencias || [])
            .filter((evidence) => evidence?.comentario?.trim() || evidence?.foto?.data_url)
            .map((evidence, index) => ({
              response_id: response.id,
              order_index: index,
              comentario: evidence.comentario?.trim() || null,
              foto_name: evidence.foto?.name || null,
              foto_size: Number(evidence.foto?.size || 0) || null,
              foto_type: evidence.foto?.type || null,
              foto_data_url: evidence.foto?.data_url || null,
            }));
        });

        if (evidenceRows.length > 0) {
          const { error: evidenceInsertError } = await (supabase as any)
            .from("golden_rule_response_evidences")
            .insert(evidenceRows);
          if (evidenceInsertError && !relationMissingError(evidenceInsertError, "golden_rule_response_evidences")) {
            throw evidenceInsertError;
          }
        }
      } catch (error) {
        if (!relationMissingError(error, "golden_rule_response_evidences")) {
          throw error;
        }
      }
    }

    const { error: deleteAttachmentsError } = await supabase
      .from("golden_rule_attachments")
      .delete()
      .eq("regra_id", savedRule.id);
    if (deleteAttachmentsError) throw deleteAttachmentsError;

    if (payload.attachments.length > 0) {
      const attachmentRows = payload.attachments.map((item) => ({
        regra_id: savedRule.id,
        file_name: item.name || "arquivo",
        file_size: Number(item.size || 0),
        file_type: item.type || null,
        file_data_url: item.data_url || null,
      }));

      const { error: insertAttachmentsError } = await supabase
        .from("golden_rule_attachments")
        .insert(attachmentRows);
      if (insertAttachmentsError) throw insertAttachmentsError;
    }

    return this.getById(savedRule.id);
  },

  async delete(id: string) {
    const { error } = await supabase
      .from("golden_rules")
      .delete()
      .eq("id", id);
    if (error) throw error;
  },

  async safeGetAllWithFallback() {
    try {
      return await this.getAll();
    } catch (error) {
      if (relationMissingError(error, "golden_rules")) return [];
      throw error;
    }
  },

  async syncLocalRecords(records: GoldenRuleRecordPayload[]) {
    const syncedIds: string[] = [];
    const failedIds: string[] = [];

    for (const record of records) {
      try {
        const saved = await this.upsertFromLegacy(record);
        const savedId = String((saved as any)?.id || record.id || "").trim();
        if (savedId) {
          syncedIds.push(savedId);
        }
      } catch (error) {
        console.error("[goldenRuleService] Falha ao sincronizar regra de ouro local:", error);
        if (record.id) {
          failedIds.push(record.id);
        }
      }
    }

    return { syncedIds, failedIds };
  },
};
export const accidentActionPlanService = {
  async getAll() {
    const { data, error } = await supabase
      .from("accident_action_plans")
      .select(`
        *,
        comments:accident_action_plan_comments(*)
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from("accident_action_plans")
      .select(`
        *,
        comments:accident_action_plan_comments(*)
      `)
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async upsertFromLegacy(payload: AccidentActionPlanRecordPayload) {
    const planInsert: AccidentActionPlanInsert = {
      id: payload.id,
      numero_plano: payload.numero_plano,
      numero_ocorrencia: payload.numero_ocorrencia,
      data_ocorrencia: toNullableDate(payload.data_ocorrencia),
      prioridade_ocorrencia: payload.prioridade_ocorrencia || null,
      descricao_ocorrencia: payload.descricao_ocorrencia || null,
      origem: payload.origem || "Acidente",
      descricao_resumida_acao: payload.descricao_resumida_acao,
      severidade: payload.severidade || null,
      probabilidade: payload.probabilidade || null,
      prioridade: payload.prioridade || "Baixa",
      status: payload.status || "Aberta",
      responsavel_execucao: payload.responsavel_execucao,
      inicio_planejado: toNullableDate(payload.inicio_planejado),
      termino_planejado: toNullableDate(payload.termino_planejado),
      acao_iniciada: toNullableDate(payload.acao_iniciada),
      acao_finalizada: toNullableDate(payload.acao_finalizada),
      descricao_acao: payload.descricao_acao,
      observacoes_conclusao: payload.observacoes_conclusao || null,
      data_eficacia: toNullableDate(payload.data_eficacia),
      observacao_eficacia: payload.observacao_eficacia || null,
      created_at: payload.created_at,
      updated_at: payload.updated_at,
    };

    const { data: savedPlan, error: upsertError } = await supabase
      .from("accident_action_plans")
      .upsert(planInsert)
      .select()
      .single();
    if (upsertError) throw upsertError;

    const { error: deleteCommentsError } = await supabase
      .from("accident_action_plan_comments")
      .delete()
      .eq("plan_id", savedPlan.id);
    if (deleteCommentsError) throw deleteCommentsError;

    if (payload.comentarios.length > 0) {
      const commentRows = payload.comentarios.map((item) => ({
        id: item.id,
        plan_id: savedPlan.id,
        texto: item.texto,
        autor: item.autor || "Sistema",
        created_at: item.created_at,
      }));

      const { error: insertCommentsError } = await supabase
        .from("accident_action_plan_comments")
        .insert(commentRows);
      if (insertCommentsError) throw insertCommentsError;
    }

    return this.getById(savedPlan.id);
  },

  async deleteByOccurrence(numeroOcorrencia: number) {
    const { error } = await supabase
      .from("accident_action_plans")
      .delete()
      .eq("numero_ocorrencia", numeroOcorrencia);
    if (error) throw error;
  },

  async safeGetAllWithFallback() {
    try {
      return await this.getAll();
    } catch (error) {
      if (relationMissingError(error, "accident_action_plans")) return [];
      throw error;
    }
  },
};

// Migration helper - move data from localStorage to Supabase
export const migrationService = {
  async migrateFromLocalStorage() {
    try {
      // Check if we already migrated
      const existingData = await operatorService.getAll();
      if (existingData.length > 0) {
        console.log('Data already exists in Supabase, skipping migration');
        return { success: true, message: 'Data already migrated' };
      }

      // Migrate inspections from localStorage
      const localInspections = localStorage.getItem('checklistafm-inspections');
      if (localInspections) {
        const inspections = JSON.parse(localInspections);
        console.log(`Found ${inspections.length} inspections in localStorage`);
        
        for (const inspection of inspections) {
          // Find matching operator and equipment in Supabase
          const operators = await operatorService.getAll();
          const equipment = await equipmentService.getAll();
          
          const operator = operators.find(op => op.name === inspection.operator?.name);
          const equipmentMatch = equipment.find(eq => eq.name === inspection.equipment?.name);
          
          if (operator && equipmentMatch) {
            await inspectionService.create({
              operator_matricula: operator.matricula,
              equipment_id: equipmentMatch.id,
              inspection_date: inspection.inspectionDate,
              submission_date: inspection.submissionDate || new Date().toISOString(),
              comments: inspection.comments || '',
              signature: inspection.signature,
              photos: inspection.photos || [],
              checklist_answers: inspection.checklist || []
            }, { notifyEmail: false });
          }
        }
      }

      return { success: true, message: 'Migration completed successfully' };
    } catch (error) {
      console.error('Migration failed:', error);
      return { success: false, message: 'Migration failed', error };
    }
  }
};


