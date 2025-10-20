import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { saveChecklistTemplate } from "@/lib/checklistTemplate";
import type { ChecklistItem } from "@/lib/data";
import { Save } from "lucide-react";
import { useChecklistData } from "@/hooks/useChecklistData";
import { checklistService } from "@/lib/supabase-service";
import { checklistItems as defaultChecklistItems } from "@/lib/data";
import { convertSupabaseChecklistItemToLegacy } from "@/lib/types-compat";

const AdminChecklistTemplate: React.FC = () => {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const { checklistItems: supabaseChecklistItems, refresh, isLoadingData } = useChecklistData();

  const normalizeItems = (sourceItems: ChecklistItem[]): ChecklistItem[] =>
    sourceItems.map((item) => ({
      id: item.id,
      question: item.question,
      answer: null,
      alertOnYes: Boolean(item.alertOnYes),
      alertOnNo: Boolean(item.alertOnNo),
    }));

  useEffect(() => {
    if (isLoadingData) {
      return;
    }

    if (supabaseChecklistItems.length > 0) {
      const normalized = normalizeItems(supabaseChecklistItems);
      setItems(normalized);
      setIsDirty(false);
      setLoading(false);
      saveChecklistTemplate(normalized);
    } else if (loading) {
      const normalizedDefaults = normalizeItems(defaultChecklistItems);
      setItems(normalizedDefaults);
      setIsDirty(false);
      setLoading(false);
      saveChecklistTemplate(normalizedDefaults);
    }
  }, [supabaseChecklistItems, isLoadingData, loading]);

  const totalQuestions = useMemo(() => items.length, [items]);

  const updateItem = (id: string, updater: (item: ChecklistItem) => ChecklistItem) => {
    setItems((prev) => prev.map((item) => (item.id === id ? updater(item) : item)));
    setIsDirty(true);
  };

  const handleToggleChange = (id: string, key: "alertOnYes" | "alertOnNo", checked: boolean) => {
    updateItem(id, (item) => ({ ...item, [key]: checked }));
  };

  const handleSave = async () => {
    const sanitizedItems = items
      .map((item) => ({
        ...item,
        question: item.question.trim(),
      }))
      .filter((item) => item.question.length > 0);

    if (sanitizedItems.length === 0) {
      toast({
        title: "Nada para salvar",
        description: "Adicione pelo menos uma pergunta antes de salvar.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSaving(true);
      const updatedRows = await checklistService.replaceAll(sanitizedItems);
      const normalized = normalizeItems(
        updatedRows.map(convertSupabaseChecklistItemToLegacy),
      );
      setItems(normalized);
      setIsDirty(false);
      saveChecklistTemplate(normalized);
      toast({
        title: "Template atualizado",
        description: "As perguntas do checklist foram salvas no banco de dados.",
      });
      refresh();
    } catch (error) {
      console.error("Erro ao salvar checklist template:", error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível atualizar as perguntas. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-gray-500">Carregando template do checklist...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Configurar Checklist</h2>
          <p className="text-sm text-gray-600">
            Ajuste as perguntas que compõem o checklist, defina geração de alertas e mantenha a sequência organizada.
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Total de perguntas: <strong>{totalQuestions}</strong>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={handleSave}
            disabled={!isDirty || isSaving}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
          >
            <Save size={16} />
            {isSaving ? "Salvando..." : "Salvar alterações"}
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-gray-500">
          Nenhuma pergunta cadastrada. Cadastre perguntas diretamente no banco de dados.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-md border border-blue-100 bg-blue-50 p-4 text-sm text-blue-700">
            As perguntas são gerenciadas diretamente no banco de dados. Utilize esta tela apenas para definir quando cada resposta deve gerar alertas automáticos.
          </div>
          {items.map((item, index) => (
            <div key={item.id} className="rounded-lg border-2 border-gray-200 bg-white p-4 shadow-sm space-y-4">
              <div className="flex items-start gap-3">
                <span className="text-lg font-semibold text-gray-700">{index + 1}.</span>
                <Input
                  value={item.question}
                  readOnly
                  className="flex-1 bg-gray-50 text-gray-700"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <Switch
                    checked={Boolean(item.alertOnYes)}
                    onCheckedChange={(checked) => handleToggleChange(item.id, "alertOnYes", checked)}
                  />
                  Gerar alerta quando a resposta for "Sim"
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <Switch
                    checked={Boolean(item.alertOnNo)}
                    onCheckedChange={(checked) => handleToggleChange(item.id, "alertOnNo", checked)}
                  />
                  Gerar alerta quando a resposta for "Não"
                </label>
              </div>
            </div>
          ))}
        </div>
      )}

      {isDirty && (
        <div className="rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800">
          Existem alterações não salvas. Clique em "Salvar alterações" para aplicar no checklist usado pelos operadores.
        </div>
      )}
    </div>
  );
};

export default AdminChecklistTemplate;
