import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSupabaseData } from "@/hooks/useSupabaseData";
import { useToast } from "@/hooks/use-toast";
import {
  checklistGroupService,
  equipmentGroupService,
  groupQuestionService,
} from "@/lib/supabase-service";
import {
  EQUIPMENT_TYPE_OPTIONS,
  getEquipmentTypeLabel,
  isEquipmentTypeMatch,
} from "@/lib/equipmentType";

const MANUAL_GROUP_TYPE = "manual";

type GroupFormState = {
  name: string;
  description: string;
  equipmentType: string;
};

const AdminGroups = () => {
  const { groups, groupQuestions, equipment, equipmentGroups, refresh } = useSupabaseData([
    "groups",
    "groupQuestions",
    "equipment",
    "equipmentGroups",
  ]);
  const { toast } = useToast();

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [isCreatingNewGroup, setIsCreatingNewGroup] = useState(false);
  const [groupForm, setGroupForm] = useState<GroupFormState>({
    name: "",
    description: "",
    equipmentType: MANUAL_GROUP_TYPE,
  });
  const [questionForm, setQuestionForm] = useState({
    question: "",
    alertOnYes: false,
    alertOnNo: false,
    order: 0,
  });
  const [selectedEquipments, setSelectedEquipments] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [expanded, setExpanded] = useState<string[]>([]);

  const getEquipmentIdsForType = (equipmentType?: string | null) => {
    if (!equipmentType) return [];
    return equipment
      .filter((item: any) => isEquipmentTypeMatch(item, equipmentType))
      .map((item: any) => item.id);
  };

  const getExplicitEquipmentIds = (groupId: string) =>
    equipmentGroups
      .filter((item: any) => item.group_id === groupId)
      .map((item: any) => item.equipment_id);

  const getResolvedEquipmentIds = (group: any) => {
    const linkedType = String(group?.equipment_type || "").trim();
    return linkedType ? getEquipmentIdsForType(linkedType) : getExplicitEquipmentIds(group.id);
  };

  useEffect(() => {
    if (groups.length > 0 && !selectedGroupId && !isCreatingNewGroup) {
      setSelectedGroupId(groups[0].id);
    }
  }, [groups, selectedGroupId, isCreatingNewGroup]);

  useEffect(() => {
    if (!selectedGroupId) return;

    const currentGroup = groups.find((group: any) => group.id === selectedGroupId);
    if (!currentGroup) return;

    const linkedType = String((currentGroup as any).equipment_type || "").trim();

    setGroupForm({
      name: currentGroup.name || "",
      description: currentGroup.description || "",
      equipmentType: linkedType || MANUAL_GROUP_TYPE,
    });
    setSelectedEquipments(getResolvedEquipmentIds(currentGroup));
  }, [selectedGroupId, groups, equipmentGroups, equipment]);

  const selectedGroup = useMemo(
    () => groups.find((group: any) => group.id === selectedGroupId) || null,
    [groups, selectedGroupId],
  );

  const questionsForGroup = useMemo(
    () =>
      groupQuestions
        .filter((question: any) => question.group_id === selectedGroupId)
        .sort((a: any, b: any) => (a.order_number || 0) - (b.order_number || 0)),
    [groupQuestions, selectedGroupId],
  );

  const summary = useMemo(() => {
    return groups.map((group: any) => {
      const equipmentIds = getResolvedEquipmentIds(group);
      const equipmentNames = equipment
        .filter((item: any) => equipmentIds.includes(item.id))
        .map((item: any) => item.name);
      const questions = groupQuestions
        .filter((question: any) => question.group_id === group.id)
        .sort((a: any, b: any) => (a.order_number || 0) - (b.order_number || 0));

      return {
        ...group,
        equipmentType: String((group as any).equipment_type || "").trim() || null,
        equipments: equipmentNames,
        questions,
      };
    });
  }, [groups, equipment, equipmentGroups, groupQuestions]);

  const linkedEquipmentsByType = useMemo(() => {
    const linkedType =
      groupForm.equipmentType !== MANUAL_GROUP_TYPE ? groupForm.equipmentType : null;

    if (!linkedType) return [];

    return equipment.filter((item: any) => isEquipmentTypeMatch(item, linkedType));
  }, [groupForm.equipmentType, equipment]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id],
    );
  };

  const handleNewGroup = () => {
    setIsCreatingNewGroup(true);
    setSelectedGroupId(null);
    setGroupForm({ name: "", description: "", equipmentType: MANUAL_GROUP_TYPE });
    setSelectedEquipments([]);
    setQuestionForm({ question: "", alertOnYes: false, alertOnNo: false, order: 0 });
  };

  const handleSaveGroup = async () => {
    if (!groupForm.name.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Informe o nome do grupo.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSaving(true);

      const payload = {
        name: groupForm.name.trim(),
        description: groupForm.description.trim() || null,
        equipment_type:
          groupForm.equipmentType !== MANUAL_GROUP_TYPE ? groupForm.equipmentType : null,
      };

      const savedGroup = selectedGroupId
        ? await checklistGroupService.update(selectedGroupId, payload)
        : await checklistGroupService.create(payload);

      const targetGroupId = savedGroup.id;
      const equipmentIdsToPersist =
        payload.equipment_type !== null
          ? getEquipmentIdsForType(payload.equipment_type)
          : selectedEquipments;

      await equipmentGroupService.setGroupsForGroup(targetGroupId, equipmentIdsToPersist);

      setSelectedGroupId(targetGroupId);
      setIsCreatingNewGroup(false);
      toast({
        title: "Grupo salvo",
        description:
          payload.equipment_type !== null
            ? "Grupo salvo e vinculado automaticamente ao tipo selecionado."
            : "Informações do grupo atualizadas.",
      });
      await refresh();
    } catch (error) {
      console.error("Erro ao salvar grupo:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar o grupo.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!selectedGroupId) return;
    if (!window.confirm("Excluir este grupo e suas perguntas?")) return;
    setIsCreatingNewGroup(false);

    try {
      setIsSaving(true);
      await checklistGroupService.delete(selectedGroupId);
      handleNewGroup();
      toast({
        title: "Grupo removido",
        description: "O grupo foi excluído.",
      });
      await refresh();
    } catch (error) {
      console.error("Erro ao excluir grupo:", error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir o grupo.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddQuestion = async () => {
    if (!selectedGroupId) return;
    if (!questionForm.question.trim()) {
      toast({
        title: "Pergunta obrigatória",
        description: "Informe o texto da pergunta.",
        variant: "destructive",
      });
      return;
    }

    try {
      await groupQuestionService.upsert({
        group_id: selectedGroupId,
        question: questionForm.question.trim(),
        alert_on_yes: questionForm.alertOnYes,
        alert_on_no: questionForm.alertOnNo,
        order_number: questionForm.order,
      });
      setQuestionForm({ question: "", alertOnYes: false, alertOnNo: false, order: 0 });
      toast({
        title: "Pergunta adicionada",
        description: "Pergunta salva no grupo.",
      });
      await refresh();
    } catch (error) {
      console.error("Erro ao adicionar pergunta:", error);
      toast({
        title: "Erro",
        description: "Não foi possível adicionar a pergunta.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteQuestion = async (id: string) => {
    if (!window.confirm("Excluir esta pergunta?")) return;

    try {
      await groupQuestionService.delete(id);
      toast({
        title: "Pergunta removida",
        description: "Pergunta excluída.",
      });
      await refresh();
    } catch (error) {
      console.error("Erro ao excluir pergunta:", error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir a pergunta.",
        variant: "destructive",
      });
    }
  };

  const handleSaveEquipments = async () => {
    if (!selectedGroupId) return;

    try {
      setIsSaving(true);
      const linkedType =
        groupForm.equipmentType !== MANUAL_GROUP_TYPE ? groupForm.equipmentType : null;
      const equipmentIdsToPersist = linkedType
        ? getEquipmentIdsForType(linkedType)
        : selectedEquipments;

      await equipmentGroupService.setGroupsForGroup(selectedGroupId, equipmentIdsToPersist);

      toast({
        title: linkedType ? "Equipamentos sincronizados" : "Equipamentos atualizados",
        description: linkedType
          ? "Os equipamentos do tipo vinculado foram sincronizados no grupo."
          : "Associação manual de equipamentos salva.",
      });
      await refresh();
    } catch (error) {
      console.error("Erro ao salvar equipamentos do grupo:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar os equipamentos.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-bold">Grupos de Equipamentos</h1>
        <div className="flex gap-2">
          <Button onClick={handleNewGroup} variant="outline">
            Novo Grupo
          </Button>
          <Button onClick={handleSaveGroup} disabled={isSaving}>
            {isSaving ? "Salvando..." : "Salvar Grupo"}
          </Button>
          {selectedGroupId && (
            <Button variant="destructive" onClick={handleDeleteGroup} disabled={isSaving}>
              Excluir Grupo
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {summary.map((group: any) => (
          <Card key={group.id} className={selectedGroupId === group.id ? "border-red-300 shadow-md" : ""}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-lg">
                <span>{group.name}</span>
                <Badge variant="outline">{group.equipments.length} eq.</Badge>
              </CardTitle>
              {group.description && <p className="text-sm text-gray-600">{group.description}</p>}
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-sm text-gray-700">
                <strong>Perguntas:</strong> {group.questions.length}
              </div>
              <div className="text-xs text-gray-600">
                <strong>Tipo vinculado:</strong>{" "}
                {group.equipmentType ? getEquipmentTypeLabel(group.equipmentType) : "Manual"}
              </div>
              <div className="text-xs text-gray-600">
                <strong>Equipamentos:</strong>{" "}
                {group.equipments.length > 0 ? group.equipments.join(", ") : "Nenhum"}
              </div>
              <div className="space-y-1 text-xs text-gray-700">
                <strong>Lista de perguntas:</strong>
                <ul className="list-inside list-disc">
                  {(expanded.includes(group.id) ? group.questions : group.questions.slice(0, 5)).map((question: any) => (
                    <li key={question.id}>
                      {question.question}{" "}
                      {question.alert_on_yes ? "(Alerta SIM) " : ""}
                      {question.alert_on_no ? "(Alerta NÃO)" : ""}
                    </li>
                  ))}
                  {group.questions.length === 0 && <li className="text-gray-500">Nenhuma pergunta</li>}
                </ul>
              </div>
              {group.questions.length > 5 && (
                <Button variant="ghost" size="sm" onClick={() => toggleExpand(group.id)}>
                  {expanded.includes(group.id) ? "Ocultar perguntas" : "Ver todas as perguntas"}
                </Button>
              )}
              <Button
                size="sm"
                className="mt-2 w-full"
                variant={selectedGroupId === group.id ? "default" : "outline"}
                onClick={() => {
                  setSelectedGroupId(group.id);
                  setIsCreatingNewGroup(false);
                }}
              >
                Editar grupo
              </Button>
            </CardContent>
          </Card>
        ))}

        <Card
          className="flex cursor-pointer items-center justify-center border-2 border-dashed hover:border-red-300"
          onClick={handleNewGroup}
        >
          <CardContent className="flex flex-col items-center justify-center space-y-2 py-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-red-400 text-xl text-red-600">
              +
            </div>
            <p className="text-center text-sm text-gray-700">Adicionar novo grupo</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados do Grupo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {groups.map((group: any) => (
              <Badge
                key={group.id}
                variant={selectedGroupId === group.id ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => {
                  setSelectedGroupId(group.id);
                  setIsCreatingNewGroup(false);
                }}
              >
                {group.name}
              </Badge>
            ))}
            {groups.length === 0 && <p className="text-sm text-gray-500">Nenhum grupo cadastrado.</p>}
          </div>

          <div className="grid gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700">Nome</label>
              <Input
                value={groupForm.name}
                onChange={(event) => setGroupForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Nome do grupo (ex.: Empilhadeira, Ponte, Transpaleteira...)"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Tipo vinculado</label>
              <Select
                value={groupForm.equipmentType}
                onValueChange={(value) => setGroupForm((prev) => ({ ...prev, equipmentType: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo vinculado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={MANUAL_GROUP_TYPE}>Sem vínculo automático</SelectItem>
                  {EQUIPMENT_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-gray-500">
                Se um tipo for vinculado, os equipamentos desse tipo entram automaticamente no grupo.
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Descrição</label>
              <Textarea
                value={groupForm.description}
                onChange={(event) => setGroupForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Descrição opcional"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Perguntas do Grupo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-3 md:col-span-2">
              {questionsForGroup.length === 0 && (
                <p className="text-sm text-gray-500">Nenhuma pergunta cadastrada.</p>
              )}
              {questionsForGroup.map((question: any) => (
                <div key={question.id} className="flex items-start justify-between gap-3 rounded-md border p-3">
                  <div>
                    <p className="font-medium text-gray-800">{question.question}</p>
                    <p className="text-xs text-gray-500">Ordem: {question.order_number ?? 0}</p>
                    <div className="mt-1 flex gap-2">
                      {question.alert_on_yes && <Badge variant="destructive">Alerta no SIM</Badge>}
                      {question.alert_on_no && <Badge variant="secondary">Alerta no NÃO</Badge>}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteQuestion(question.id)}>
                    Remover
                  </Button>
                </div>
              ))}
            </div>

            <div className="space-y-3 rounded-md border p-3">
              <h4 className="text-sm font-semibold text-gray-800">Adicionar pergunta</h4>
              <Input
                value={questionForm.question}
                onChange={(event) => setQuestionForm((prev) => ({ ...prev, question: event.target.value }))}
                placeholder="Pergunta"
              />
              <div className="flex gap-2 text-sm">
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={questionForm.alertOnYes}
                    onChange={(event) => setQuestionForm((prev) => ({ ...prev, alertOnYes: event.target.checked }))}
                  />
                  Alerta no SIM
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={questionForm.alertOnNo}
                    onChange={(event) => setQuestionForm((prev) => ({ ...prev, alertOnNo: event.target.checked }))}
                  />
                  Alerta no NÃO
                </label>
              </div>
              <div>
                <label className="text-xs text-gray-600">Ordem</label>
                <Input
                  type="number"
                  value={questionForm.order}
                  onChange={(event) => setQuestionForm((prev) => ({ ...prev, order: Number(event.target.value) || 0 }))}
                />
              </div>
              <Button onClick={handleAddQuestion} disabled={!selectedGroupId}>
                Adicionar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Equipamentos do Grupo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {groupForm.equipmentType !== MANUAL_GROUP_TYPE ? (
            <>
              <p className="text-sm text-gray-600">
                Este grupo está vinculado ao tipo <strong>{getEquipmentTypeLabel(groupForm.equipmentType)}</strong>.
                Os equipamentos abaixo entram automaticamente no grupo.
              </p>
              <div className="flex flex-wrap gap-2">
                {linkedEquipmentsByType.map((item: any) => (
                  <Badge key={item.id} variant="outline" className="px-3 py-2 text-sm">
                    {item.name} ({item.kp})
                  </Badge>
                ))}
                {linkedEquipmentsByType.length === 0 && (
                  <p className="text-sm text-gray-500">Nenhum equipamento cadastrado para este tipo.</p>
                )}
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600">
                Grupo manual. Marque quais equipamentos devem usar este checklist.
              </p>
              <div className="flex flex-wrap gap-2">
                {equipment.map((item: any) => (
                  <label key={item.id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedEquipments.includes(item.id)}
                      onChange={() => {
                        setSelectedEquipments((prev) =>
                          prev.includes(item.id)
                            ? prev.filter((value) => value !== item.id)
                            : [...prev, item.id],
                        );
                      }}
                    />
                    <span>
                      {item.name} ({item.sector})
                    </span>
                  </label>
                ))}
                {equipment.length === 0 && (
                  <p className="text-sm text-gray-500">Nenhum equipamento cadastrado.</p>
                )}
              </div>
            </>
          )}

          <Button onClick={handleSaveEquipments} disabled={!selectedGroupId || isSaving}>
            {isSaving
              ? "Salvando..."
              : groupForm.equipmentType !== MANUAL_GROUP_TYPE
                ? "Sincronizar equipamentos do tipo"
                : "Salvar equipamentos do grupo"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminGroups;
