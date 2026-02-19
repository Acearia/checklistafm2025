import React, { useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useSupabaseData } from "@/hooks/useSupabaseData";
import { useToast } from "@/hooks/use-toast";
import {
  checklistGroupService,
  groupQuestionService,
  equipmentGroupService,
} from "@/lib/supabase-service";

const AdminGroups = () => {
  const { groups, groupQuestions, equipment, equipmentGroups, refresh, loading } = useSupabaseData([
    "groups",
    "groupQuestions",
    "equipment",
    "equipmentGroups",
  ]);
  const { toast } = useToast();
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [groupForm, setGroupForm] = useState({ name: "", description: "" });
  const [questionForm, setQuestionForm] = useState({ question: "", alertOnYes: false, alertOnNo: false, order: 0 });
  const [selectedEquipments, setSelectedEquipments] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [expanded, setExpanded] = useState<string[]>([]);

  useEffect(() => {
    if (groups.length > 0 && !selectedGroupId) {
      setSelectedGroupId(groups[0].id);
    }
  }, [groups, selectedGroupId]);

  useEffect(() => {
    if (!selectedGroupId) return;
    const grp = groups.find((g: any) => g.id === selectedGroupId);
    if (grp) {
      setGroupForm({ name: grp.name, description: grp.description || "" });
    }
    const eqIds = equipmentGroups
      .filter((eg: any) => eg.group_id === selectedGroupId)
      .map((eg: any) => eg.equipment_id);
    setSelectedEquipments(eqIds);
  }, [selectedGroupId, groups, equipmentGroups]);

  const questionsForGroup = useMemo(
    () =>
      groupQuestions
        .filter((q: any) => q.group_id === selectedGroupId)
        .sort((a: any, b: any) => (a.order_number || 0) - (b.order_number || 0)),
    [groupQuestions, selectedGroupId],
  );

  const summary = useMemo(() => {
    return groups.map((g: any) => {
      const eqIds = equipmentGroups
        .filter((eg: any) => eg.group_id === g.id)
        .map((eg: any) => eg.equipment_id);
      const eqNames = equipment.filter((eq: any) => eqIds.includes(eq.id)).map((eq: any) => eq.name);
      const qs = groupQuestions
        .filter((q: any) => q.group_id === g.id)
        .sort((a: any, b: any) => (a.order_number || 0) - (b.order_number || 0));
      return { ...g, equipments: eqNames, questions: qs };
    });
  }, [groups, equipmentGroups, equipment, groupQuestions]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSaveGroup = async () => {
    if (!groupForm.name.trim()) {
      toast({ title: "Nome obrigatório", description: "Informe o nome do grupo.", variant: "destructive" });
      return;
    }
    try {
      setIsSaving(true);
      if (selectedGroupId) {
        await checklistGroupService.update(selectedGroupId, {
          name: groupForm.name.trim(),
          description: groupForm.description.trim() || null,
        });
      } else {
        const created = await checklistGroupService.create({
          name: groupForm.name.trim(),
          description: groupForm.description.trim() || null,
        });
        setSelectedGroupId(created.id);
      }
      toast({ title: "Grupo salvo", description: "Informações do grupo atualizadas." });
      await refresh();
    } catch (error) {
      console.error("Erro ao salvar grupo:", error);
      toast({ title: "Erro", description: "Não foi possível salvar o grupo.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!selectedGroupId) return;
    if (!confirm("Excluir este grupo e suas perguntas?")) return;
    try {
      setIsSaving(true);
      await checklistGroupService.delete(selectedGroupId);
      setSelectedGroupId(null);
      setGroupForm({ name: "", description: "" });
      toast({ title: "Grupo removido", description: "O grupo foi excluído." });
      await refresh();
    } catch (error) {
      console.error("Erro ao excluir grupo:", error);
      toast({ title: "Erro", description: "Não foi possível excluir o grupo.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddQuestion = async () => {
    if (!selectedGroupId) return;
    if (!questionForm.question.trim()) {
      toast({ title: "Pergunta obrigatória", description: "Informe o texto da pergunta.", variant: "destructive" });
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
      toast({ title: "Pergunta adicionada", description: "Pergunta salva no grupo." });
      await refresh();
    } catch (error) {
      console.error("Erro ao adicionar pergunta:", error);
      toast({ title: "Erro", description: "Não foi possível adicionar a pergunta.", variant: "destructive" });
    }
  };

  const handleDeleteQuestion = async (id: string) => {
    if (!confirm("Excluir esta pergunta?")) return;
    try {
      await groupQuestionService.delete(id);
      toast({ title: "Pergunta removida", description: "Pergunta excluída." });
      await refresh();
    } catch (error) {
      console.error("Erro ao excluir pergunta:", error);
      toast({ title: "Erro", description: "Não foi possível excluir a pergunta.", variant: "destructive" });
    }
  };

  const handleSaveEquipments = async () => {
    if (!selectedGroupId) return;
    try {
      setIsSaving(true);
      await equipmentGroupService.setGroupsForGroup(selectedGroupId, selectedEquipments);
      toast({ title: "Equipamentos atualizados", description: "Associação de equipamentos salva." });
      await refresh();
    } catch (error) {
      console.error("Erro ao salvar equipamentos do grupo:", error);
      toast({ title: "Erro", description: "Não foi possível salvar os equipamentos.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <h1 className="text-2xl font-bold">Grupos de Equipamentos</h1>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              setSelectedGroupId(null);
              setGroupForm({ name: "", description: "" });
            }}
            variant="outline"
          >
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
        {summary.map((g) => (
          <Card key={g.id} className={selectedGroupId === g.id ? "border-red-300 shadow-md" : ""}>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center justify-between">
                <span>{g.name}</span>
                <Badge variant="outline">{g.equipments.length} eq.</Badge>
              </CardTitle>
              {g.description && <p className="text-sm text-gray-600">{g.description}</p>}
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-sm text-gray-700">
                <strong>Perguntas:</strong> {g.questions.length}
              </div>
              <div className="text-xs text-gray-600">
                <strong>Equipamentos:</strong>{" "}
                {g.equipments.length > 0 ? g.equipments.join(", ") : "Nenhum"}
              </div>
              <div className="text-xs text-gray-700 space-y-1">
                <strong>Lista de perguntas:</strong>
                <ul className="list-disc list-inside">
                  {(expanded.includes(g.id) ? g.questions : g.questions.slice(0, 5)).map((q: any) => (
                    <li key={q.id}>
                      {q.question}{" "}
                      {q.alert_on_yes ? "(Alerta SIM) " : ""}{q.alert_on_no ? "(Alerta NÃO)" : ""}
                    </li>
                  ))}
                  {g.questions.length === 0 && <li className="text-gray-500">Nenhuma pergunta</li>}
                </ul>
              </div>
              {g.questions.length > 5 && (
                <Button variant="ghost" size="sm" onClick={() => toggleExpand(g.id)}>
                  {expanded.includes(g.id) ? "Ocultar perguntas" : "Ver todas as perguntas"}
                </Button>
              )}
              <Button
                size="sm"
                className="w-full mt-2"
                variant={selectedGroupId === g.id ? "default" : "outline"}
                onClick={() => setSelectedGroupId(g.id)}
              >
                Editar grupo
              </Button>
            </CardContent>
          </Card>
        ))}
        <Card
          className="border-dashed border-2 flex items-center justify-center cursor-pointer hover:border-red-300"
          onClick={() => {
            setSelectedGroupId(null);
            setGroupForm({ name: "", description: "" });
          }}
        >
          <CardContent className="flex flex-col items-center justify-center py-8 space-y-2">
            <div className="h-10 w-10 rounded-full border border-red-400 text-red-600 flex items-center justify-center text-xl">
              +
            </div>
            <p className="text-sm text-gray-700 text-center">Adicionar novo grupo</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados do Grupo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {groups.map((g: any) => (
              <Badge
                key={g.id}
                variant={selectedGroupId === g.id ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setSelectedGroupId(g.id)}
              >
                {g.name}
              </Badge>
            ))}
            {groups.length === 0 && <p className="text-sm text-gray-500">Nenhum grupo cadastrado.</p>}
          </div>
          <div className="grid gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700">Nome</label>
              <Input
                value={groupForm.name}
                onChange={(e) => setGroupForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Nome do grupo (ex.: Talha, Ponte, Pórtico...)"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Descrição</label>
              <Textarea
                value={groupForm.description}
                onChange={(e) => setGroupForm((prev) => ({ ...prev, description: e.target.value }))}
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
            <div className="md:col-span-2 space-y-3">
              {questionsForGroup.length === 0 && <p className="text-sm text-gray-500">Nenhuma pergunta cadastrada.</p>}
              {questionsForGroup.map((q: any) => (
                <div key={q.id} className="border rounded-md p-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-gray-800">{q.question}</p>
                    <p className="text-xs text-gray-500">Ordem: {q.order_number ?? 0}</p>
                    <div className="flex gap-2 mt-1">
                      {q.alert_on_yes && <Badge variant="destructive">Alerta no SIM</Badge>}
                      {q.alert_on_no && <Badge variant="secondary">Alerta no NÃO</Badge>}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteQuestion(q.id)}>
                    Remover
                  </Button>
                </div>
              ))}
            </div>
            <div className="border rounded-md p-3 space-y-3">
              <h4 className="font-semibold text-gray-800 text-sm">Adicionar pergunta</h4>
              <Input
                value={questionForm.question}
                onChange={(e) => setQuestionForm((prev) => ({ ...prev, question: e.target.value }))}
                placeholder="Pergunta"
              />
              <div className="flex gap-2 text-sm">
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={questionForm.alertOnYes}
                    onChange={(e) => setQuestionForm((prev) => ({ ...prev, alertOnYes: e.target.checked }))}
                  />
                  Alerta no SIM
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={questionForm.alertOnNo}
                    onChange={(e) => setQuestionForm((prev) => ({ ...prev, alertOnNo: e.target.checked }))}
                  />
                  Alerta no NÃO
                </label>
              </div>
              <div>
                <label className="text-xs text-gray-600">Ordem</label>
                <Input
                  type="number"
                  value={questionForm.order}
                  onChange={(e) => setQuestionForm((prev) => ({ ...prev, order: Number(e.target.value) || 0 }))}
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
          <div className="flex flex-wrap gap-2">
            {equipment.map((eq: any) => (
              <label key={eq.id} className="flex items-center gap-2 text-sm border rounded-md px-3 py-2">
                <input
                  type="checkbox"
                  checked={selectedEquipments.includes(eq.id)}
                  onChange={() => {
                    setSelectedEquipments((prev) =>
                      prev.includes(eq.id) ? prev.filter((id) => id !== eq.id) : [...prev, eq.id]
                    );
                  }}
                />
                <span>{eq.name} ({eq.sector})</span>
              </label>
            ))}
            {equipment.length === 0 && <p className="text-sm text-gray-500">Nenhum equipamento cadastrado.</p>}
          </div>
          <Button onClick={handleSaveEquipments} disabled={!selectedGroupId || isSaving}>
            {isSaving ? "Salvando..." : "Salvar equipamentos do grupo"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminGroups;
