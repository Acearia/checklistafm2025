import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import SearchableStringSelect from "@/components/ui/searchable-string-select";
import type { QuestionActionPlanDraft } from "@/lib/environmentalQuestionPlans";

export default function QuestionActionPlans({plans, people, onChange, onAdd}: {
  plans: QuestionActionPlanDraft[]; people: string[];
  onChange: (plans: QuestionActionPlanDraft[]) => void; onAdd: () => void;
}) {
  const update = (id: string, patch: Partial<QuestionActionPlanDraft>) => onChange(plans.map(plan => plan.id === id ? {...plan, ...patch} : plan));
  return <div className="mt-4 space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/40 p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><p className="text-sm font-semibold text-emerald-900">Planos de ação da irregularidade</p>
        <p className="text-xs text-emerald-800">Cada plano será salvo separadamente no painel de planos de ação.</p></div>
      <Button type="button" variant="secondary" size="sm" onClick={onAdd}>Adicionar outro plano</Button>
    </div>
    {plans.map((plan, index) => <div key={plan.id} className="space-y-3 rounded-lg border border-emerald-200 bg-background p-3" data-testid="environmental-question-plan">
      <div className="flex items-center justify-between"><p className="text-sm font-semibold text-emerald-900">Plano {index + 1}</p>
        {plans.length > 1 && <Button type="button" variant="ghost" size="sm" onClick={() => onChange(plans.filter(item => item.id !== plan.id))}>Remover plano</Button>}</div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2"><Label htmlFor={`summary-${plan.id}`}>Resumo da ação *</Label><Input id={`summary-${plan.id}`} value={plan.descricao_resumida_acao} onChange={e => update(plan.id, {descricao_resumida_acao: e.target.value})} /></div>
        <div className="space-y-2"><Label>Responsável *</Label><SearchableStringSelect value={plan.responsavel_execucao} onValueChange={value => update(plan.id, {responsavel_execucao: value})}
          options={[...new Set([...people, plan.responsavel_execucao].filter(Boolean))].map(name => ({value: name, label: name}))} placeholder="Selecionar responsável" searchPlaceholder="Buscar responsável..." emptyText="Nenhuma pessoa encontrada." /></div>
        <div className="space-y-2"><Label htmlFor={`start-${plan.id}`}>Início planejado</Label><Input id={`start-${plan.id}`} type="date" value={plan.inicio_planejado} onChange={e => update(plan.id, {inicio_planejado: e.target.value})} /></div>
        <div className="space-y-2"><Label htmlFor={`end-${plan.id}`}>Término planejado</Label><Input id={`end-${plan.id}`} type="date" min={plan.inicio_planejado || undefined} value={plan.termino_planejado} onChange={e => update(plan.id, {termino_planejado: e.target.value})} /></div>
      </div>
      <div className="space-y-2"><Label htmlFor={`action-${plan.id}`}>Descrição da ação *</Label><Textarea id={`action-${plan.id}`} value={plan.descricao_acao} onChange={e => update(plan.id, {descricao_acao: e.target.value})} placeholder="Descreva a ação que será executada para evitar recorrência." /></div>
    </div>)}
  </div>;
}
