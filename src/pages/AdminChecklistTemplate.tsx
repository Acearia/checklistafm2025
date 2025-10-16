import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  loadChecklistTemplate,
  saveChecklistTemplate,
  resetChecklistTemplate,
} from "@/lib/checklistTemplate";
import type { ChecklistItem } from "@/lib/data";
import { Plus, RefreshCw, Save, Trash2 } from "lucide-react";

const createEmptyItem = (nextIndex: number): ChecklistItem => ({
  id: `item-${Date.now()}-${nextIndex}`,
  question: "",
  answer: null,
  alertOnYes: false,
  alertOnNo: false,
});

const AdminChecklistTemplate: React.FC = () => {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDirty, setIsDirty] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const template = loadChecklistTemplate();
    setItems(template);
    setLoading(false);
  }, []);

  const totalQuestions = useMemo(() => items.length, [items]);

  const updateItem = (id: string, updater: (item: ChecklistItem) => ChecklistItem) => {
    setItems((prev) => prev.map((item) => (item.id === id ? updater(item) : item)));
    setIsDirty(true);
  };

  const handleQuestionChange = (id: string, value: string) => {
    updateItem(id, (item) => ({ ...item, question: value }));
  };

  const handleToggleChange = (id: string, key: "alertOnYes" | "alertOnNo", checked: boolean) => {
    updateItem(id, (item) => ({ ...item, [key]: checked }));
  };

  const handleAddQuestion = () => {
    setItems((prev) => {
      const next = [...prev, createEmptyItem(prev.length + 1)];
      return next;
    });
    setIsDirty(true);
  };

  const handleRemoveQuestion = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    setIsDirty(true);
  };

  const handleSave = () => {
    saveChecklistTemplate(items);
    setIsDirty(false);
    toast({
      title: "Template atualizado",
      description: "As perguntas do checklist foram salvas com sucesso.",
    });
  };

  const handleReset = () => {
    const confirmed = window.confirm(
      "Tem certeza que deseja restaurar o checklist para o padrão? Todas as personalizações serão perdidas.",
    );
    if (!confirmed) return;

    resetChecklistTemplate();
    const template = loadChecklistTemplate();
    setItems(template);
    setIsDirty(false);
    toast({
      title: "Template restaurado",
      description: "O checklist voltou para o padrão original.",
    });
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
          <Button variant="outline" onClick={handleReset} className="flex items-center gap-2">
            <RefreshCw size={16} />
            Restaurar padrão
          </Button>
          <Button onClick={handleAddQuestion} className="flex items-center gap-2">
            <Plus size={16} />
            Adicionar pergunta
          </Button>
          <Button
            onClick={handleSave}
            disabled={!isDirty}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
          >
            <Save size={16} />
            Salvar alterações
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-gray-500">
          Nenhuma pergunta cadastrada. Clique em "Adicionar pergunta" para começar.
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item, index) => (
            <div key={item.id} className="rounded-lg border-2 border-gray-200 bg-white p-4 shadow-sm space-y-4">
              <div className="flex items-start gap-3">
                <span className="text-lg font-semibold text-gray-700">{index + 1}.</span>
                <Input
                  value={item.question}
                  onChange={(e) => handleQuestionChange(item.id, e.target.value)}
                  placeholder={`Pergunta ${index + 1}`}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => handleRemoveQuestion(item.id)}
                  disabled={items.length === 1}
                >
                  <Trash2 size={16} />
                </Button>
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
