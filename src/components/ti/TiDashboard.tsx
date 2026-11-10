import {useMemo} from "react";
import {ArrowUpRight, BarChart3, CircleCheck, Clock3, Inbox, ListTodo} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {tiMonthlySummary, type TiMember, type TiRecord, type TiStatus} from "@/lib/tiHandover";

export const tiStatusLabel = (status: TiStatus) => status === "Resolvido" ? "Fechado" : status;
const cards = [
  {status: "", label: "Registros no mês", icon: BarChart3, tone: "total"},
  {status: "Aberto", label: "Abertos", icon: Inbox, tone: "open"},
  {status: "Em andamento", label: "Em andamento", icon: Clock3, tone: "progress"},
  {status: "Pendente", label: "Pendentes", icon: ListTodo, tone: "pending"},
  {status: "Resolvido", label: "Fechados", icon: CircleCheck, tone: "closed"},
] as const;

export default function TiDashboard({records, members, month, onMonthChange, onOpen}: {
  records: TiRecord[]; members: TiMember[]; month: string; onMonthChange: (value: string) => void;
  onOpen: (analyst: string, status: string) => void;
}) {
  const summary = useMemo(() => tiMonthlySummary(records, members, month), [records, members, month]);
  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="ti-eyebrow">VISÃO GERAL</p><h2 className="mt-1 text-2xl font-bold tracking-tight">O mês da equipe, em um só lugar.</h2><p className="mt-2 text-sm text-muted-foreground">Registros pela data do ocorrido e situação atual. Fechado corresponde a resolvido.</p></div>
      <div><Label htmlFor="ti-dashboard-month">Mês de referência</Label><Input id="ti-dashboard-month" className="ti-field mt-1 w-48" type="month" min="2000-01" max="2100-12" value={month} onChange={e => {if (/^\d{4}-(0[1-9]|1[0-2])$/.test(e.target.value)) onMonthChange(e.target.value);}} /></div>
    </div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{cards.map(({status,label,icon: Icon,tone}) => <button key={label} className={`ti-panel ti-stat ti-tone-${tone} text-left transition-transform hover:-translate-y-0.5`} onClick={() => onOpen("", status)} aria-label={`Ver ${label.toLowerCase()}`}>
      <div className="flex items-center justify-between gap-2"><span className="text-sm text-muted-foreground">{label}</span><Icon className="size-5 ti-stat-icon" /></div>
      <p className="mt-4 text-3xl font-bold tabular-nums">{status ? summary.counts[status] : summary.total}</p><p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">Ver registros <ArrowUpRight className="size-3" /></p>
    </button>)}</div>
    <section className="ti-panel"><div className="mb-5"><h3 className="text-lg font-semibold">Acompanhamento por analista</h3><p className="mt-1 text-sm text-muted-foreground">Selecione uma quantidade para consultar os registros daquele analista.</p></div>
      <div className="overflow-x-auto"><table className="ti-table w-full text-left text-sm"><thead><tr>{["Analista", "Abertos", "Em andamento", "Pendentes", "Fechados", "Total"].map(label => <th key={label} className="whitespace-nowrap p-3">{label}</th>)}</tr></thead><tbody>
        {summary.analysts.map(person => <tr key={person.user_id} className="border-b border-border"><td className="min-w-40 p-3"><span className="font-medium">{person.name}</span>{!person.active && <span className="ml-2 text-xs text-muted-foreground">Inativo</span>}<div className="ti-workload mt-2 flex h-1.5 w-32 overflow-hidden rounded-full" aria-hidden="true">{cards.filter(card => card.status).map(card => <span key={card.status} className={`ti-segment ti-tone-${card.tone}`} style={{width: `${person.total ? person.counts[card.status as TiStatus] / person.total * 100 : 0}%`}} />)}</div></td>
          {cards.slice(1).map(card => <td key={card.status} className="p-2"><Button variant="ghost" size="sm" className="tabular-nums" aria-label={`${person.name}: ${card.label}`} onClick={() => onOpen(person.user_id,card.status)}>{person.counts[card.status as TiStatus]}</Button></td>)}
          <td className="p-2"><Button variant="secondary" size="sm" className="font-semibold tabular-nums" aria-label={`${person.name}: total`} onClick={() => onOpen(person.user_id,"")}>{person.total}</Button></td>
        </tr>)}
      </tbody></table>{!summary.analysts.length && <p className="p-8 text-center text-muted-foreground">Nenhum analista cadastrado.</p>}</div>
      {!summary.total && <p className="mt-4 rounded-lg bg-muted p-4 text-sm text-muted-foreground">Nenhum registro neste mês. Selecione outro mês ou crie um novo registro.</p>}
    </section>
  </div>;
}
