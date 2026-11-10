import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Textarea} from "@/components/ui/textarea";
import {useToast} from "@/hooks/use-toast";
import ListPagination, {useListPagination} from "@/components/ListPagination";
import {computerChecklistAnswers, filterComputerChecklists, validateComputerChecklist, type TiComputerChecklist, type TiComputerQuestion, type TiComputerAnswer} from "@/lib/tiComputerChecklist";
import {tiComputerChecklistService as api} from "@/lib/tiComputerChecklistService";
import type {TiMember} from "@/lib/tiHandover";

const panel = "ti-panel";
const input = "ti-field";
const blankFilters = {computer: "", user: "", analyst: "", from: "", to: ""};
const message = (error: unknown) => String((error as {message?: string})?.message || "Não foi possível consultar o servidor.");

export default function TiComputerChecklists({member, members}: {member: TiMember; members: TiMember[]}) {
  const {toast} = useToast();
  const [records, setRecords] = useState<TiComputerChecklist[]>([]);
  const [questions, setQuestions] = useState<TiComputerQuestion[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"list"|"form"|"view"|"questions">("list");
  const [selected, setSelected] = useState<TiComputerChecklist | null>(null);
  const [computer, setComputer] = useState(""); const [user, setUser] = useState(""); const [analyst, setAnalyst] = useState("");
  const [answers, setAnswers] = useState<TiComputerAnswer[]>([]); const [software, setSoftware] = useState(""); const [notes, setNotes] = useState("");
  const [extraQuestions, setExtraQuestions] = useState(""); const [newQuestion, setNewQuestion] = useState("");
  const [extraMarked, setExtraMarked] = useState<Record<string, boolean>>({});
  const [questionEdits, setQuestionEdits] = useState<Record<string, string>>({});
  const [draftFilters, setDraftFilters] = useState(blankFilters); const [filters, setFilters] = useState(blankFilters);
  const generation = useRef(0); const refreshing = useRef(false);
  const visible = useMemo(() => filterComputerChecklists(records, filters), [records, filters]);
  const paging = useListPagination(visible, JSON.stringify(filters));
  const ready = !!computer.trim() && !!user.trim();
  const additions = useMemo(() => [...new Set(extraQuestions.split(/\r?\n/).map(line => line.trim()).filter(Boolean))], [extraQuestions]);
  const refresh = useCallback(async () => {
    if (refreshing.current) return;
    refreshing.current = true; const current = generation.current;
    try {
      const [rows, items] = await Promise.all([api.list(), api.questions()]);
      if (current !== generation.current) return;
      setRecords(rows); setQuestions(items); setError("");
    } catch (e) {if (current === generation.current) setError(`Não foi possível atualizar os checklists. Os dados podem estar desatualizados. ${message(e)}`);}
    finally {if (current === generation.current) setLoading(false); refreshing.current = false;}
  }, []);
  useEffect(() => {
    void refresh(); const onFocus = () => {if (document.visibilityState === "visible") void refresh();};
    window.addEventListener("focus", onFocus); const timer = window.setInterval(onFocus, 60000);
    return () => {generation.current++; window.removeEventListener("focus", onFocus); window.clearInterval(timer);};
  }, [refresh]);
  useEffect(() => {
    if (mode !== "form" || selected) return;
    setAnswers(previous => computerChecklistAnswers(questions).map(item => ({...item, answer: previous.find(answer => answer.id === item.id)?.answer || false})));
  }, [questions, mode, selected]);

  const openForm = (record?: TiComputerChecklist) => {
    if (!record && (loading || error)) {toast({title: "Atualize as perguntas antes de criar um checklist.", variant: "destructive"}); return;}
    setSelected(record || null); setComputer(record?.computer || ""); setUser(record?.user_name || ""); setAnalyst(record?.analyst_id || "");
    setAnswers(record ? record.answers.map(item => ({...item})) : computerChecklistAnswers(questions));
    setSoftware(record?.additional_software || ""); setNotes(record?.notes || ""); setExtraQuestions(""); setExtraMarked({}); setMode("form");
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); if (busy) return;
    if (additions.some(label => label.length > 500) || additions.length + answers.length > 200) {
      toast({title: "Limite de perguntas", description: "Use até 200 perguntas, com no máximo 500 caracteres por pergunta.", variant: "destructive"}); return;
    }
    const payloadAnswers = [...answers, ...additions.map(question => ({id: `custom-${crypto.randomUUID()}`, question, answer: !!extraMarked[question], custom: true}))];
    const invalid = validateComputerChecklist(computer, user, analyst, payloadAnswers, software);
    if (invalid) {toast({title: "Checklist incompleto", description: invalid, variant: "destructive"}); return;}
    setBusy(true); const current = generation.current;
    try {
      const saved = await api.save({created_by: selected?.created_by || member.user_id, computer: computer.trim(), user_name: user.trim(), analyst_id: analyst, answers: payloadAnswers, additional_software: software.trim(), notes: notes.trim()}, selected || undefined);
      if (current !== generation.current) return;
      setRecords(rows => [saved, ...rows.filter(row => row.id !== saved.id)].sort((a,b) => b.created_at.localeCompare(a.created_at) || b.id-a.id));
      setFilters(blankFilters); setDraftFilters(blankFilters); setMode("list"); setSelected(null);
      toast({title: "Checklist salvo", description: `${saved.answers.filter(item => item.answer).length} / ${saved.answers.length} itens marcados.`});
    } catch (e) {toast({title: "Falha ao salvar", description: message(e), variant: "destructive"});}
    finally {setBusy(false);}
  };
  const saveQuestion = async (question?: TiComputerQuestion, active?: boolean) => {
    if (busy) return;
    const label = (question ? questionEdits[question.id] ?? question.label : newQuestion).trim();
    if (!label) {toast({title: "Informe o texto da pergunta.", variant: "destructive"}); return;}
    setBusy(true); const current = generation.current;
    try {
      const saved = await api.saveQuestion({label, position: question?.position ?? Math.max(0, ...questions.map(row => row.position))+1, active: active ?? question?.active ?? true}, question?.id);
      if (current !== generation.current) return;
      setQuestions(items => [...items.filter(item => item.id !== saved.id), saved].sort((a,b) => a.position-b.position || a.id.localeCompare(b.id)));
      setNewQuestion(""); toast({title: "Pergunta salva", description: "Os checklists anteriores preservam as perguntas originais."});
      setQuestionEdits(edits => {const next = {...edits}; delete next[saved.id]; return next;});
    } catch (e) {toast({title: "Falha ao salvar pergunta", description: message(e), variant: "destructive"});}
    finally {setBusy(false);}
  };
  return <div className="space-y-4">
    {error && <p role="alert" className="ti-error">{error}</p>}
    <div className="flex flex-wrap justify-end gap-2"><Button variant="secondary" size="sm" disabled={busy} onClick={() => {setMode("list"); void refresh();}}>Ver checklists</Button><Button variant="secondary" size="sm" disabled={busy} onClick={() => void refresh()}>Atualizar checklists</Button></div>
    {mode === "list" && <>
      <form className={`${panel} grid gap-3 md:grid-cols-5`} onSubmit={event => {event.preventDefault(); if (draftFilters.from && draftFilters.to && draftFilters.from > draftFilters.to) {toast({title: "Período inválido", variant: "destructive"}); return;} setFilters({...draftFilters});}}>
        <div><Label htmlFor="tc-filter-computer">Computador</Label><Input className={input} id="tc-filter-computer" value={draftFilters.computer} onChange={e => setDraftFilters({...draftFilters, computer: e.target.value})} /></div>
        <div><Label htmlFor="tc-filter-user">Usuário</Label><Input className={input} id="tc-filter-user" value={draftFilters.user} onChange={e => setDraftFilters({...draftFilters, user: e.target.value})} /></div>
        <div><Label htmlFor="tc-filter-analyst">Analista</Label><select className={input} id="tc-filter-analyst" value={draftFilters.analyst} onChange={e => setDraftFilters({...draftFilters, analyst: e.target.value})}><option value="">Todos</option>{members.map(person => <option key={person.user_id} value={person.user_id}>{person.name}{person.active ? "" : " (inativo)"}</option>)}</select></div>
        <div><Label htmlFor="tc-filter-from">Data inicial</Label><Input className={input} id="tc-filter-from" type="date" value={draftFilters.from} onChange={e => setDraftFilters({...draftFilters, from: e.target.value})} /></div>
        <div><Label htmlFor="tc-filter-to">Data final</Label><Input className={input} id="tc-filter-to" type="date" value={draftFilters.to} onChange={e => setDraftFilters({...draftFilters, to: e.target.value})} /></div>
        <div className="flex flex-wrap gap-2 md:col-span-5"><Button type="submit">Filtrar</Button><Button type="button" variant="secondary" onClick={() => {setDraftFilters(blankFilters); setFilters(blankFilters);}}>Limpar</Button><Button type="button" className="ml-auto bg-emerald-700 text-white hover:bg-emerald-600" onClick={() => openForm()} disabled={loading || !!error}>+ Novo checklist</Button><Button type="button" variant="secondary" onClick={() => setMode("questions")} disabled={loading || !!error}>Perguntas</Button></div>
      </form>
      <section className={panel}><div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-semibold">Checklists ({visible.length})</h2><Button variant="secondary" size="sm" onClick={() => openForm()} disabled={loading || !!error}>Novo</Button></div>
        {loading ? <p>Carregando checklists...</p> : <div className="overflow-x-auto"><table className="ti-table w-full text-left text-sm"><thead><tr>{["ID","Data","Computador","Usuário","Analista","Sim","Obs.",""].map((label,index) => <th key={index} className="border-b p-2">{label}</th>)}</tr></thead><tbody>
          {paging.visibleItems.map(row => <tr key={row.id} className="border-b"><td className="p-2">{row.id}</td><td className="whitespace-nowrap p-2">{new Date(row.created_at).toLocaleString("pt-BR")}</td><td className="p-2">{row.computer}</td><td className="p-2">{row.user_name}</td><td className="p-2">{row.analyst_name}</td><td className="whitespace-nowrap p-2">{row.answers.filter(item => item.answer).length} / {row.answers.length}</td><td className="max-w-xs break-words p-2">{row.notes}</td><td className="p-2"><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => {setSelected(row); setMode("view");}}>Ver</Button><Button size="sm" variant="outline" disabled={row.created_by !== member.user_id} onClick={() => openForm(row)}>Editar</Button></div></td></tr>)}
        </tbody></table>{!visible.length && <p className="p-6 text-center">Nenhum checklist encontrado.</p>}</div>}
        <ListPagination {...paging.pagination} />
      </section>
    </>}
    {mode === "form" && <form className={`${panel} space-y-5`} onSubmit={save}>
      <h2 className="text-xl font-semibold">Checklist de Formatação{selected ? ` #${selected.id}` : ""}</h2>
      <div className="grid gap-4 md:grid-cols-2"><div><Label htmlFor="tc-computer">Computador *</Label><Input className={input} id="tc-computer" maxLength={100} required value={computer} onChange={e => setComputer(e.target.value)} /></div><div><Label htmlFor="tc-user">Usuário *</Label><Input className={input} id="tc-user" maxLength={200} required value={user} onChange={e => setUser(e.target.value)} /></div><div><Label htmlFor="tc-analyst">Analista responsável *</Label><select className={input} id="tc-analyst" required value={analyst} onChange={e => setAnalyst(e.target.value)}><option value="">Selecione</option>{members.filter(person => person.active || person.user_id === selected?.analyst_id).map(person => <option key={person.user_id} value={person.user_id}>{person.name}{person.active ? "" : " (inativo)"}</option>)}</select></div></div>
      <div className="border-t border-border pt-4"><h3 className="mb-4 font-semibold">Checklist <span className="text-sm font-normal">{ready ? "Marque os itens realizados." : "Preencha computador e usuário para liberar as opções."}</span></h3>
        <div className="grid gap-3 md:grid-cols-2">{answers.map(item => <label key={item.id} className={`flex items-start gap-2 ${ready ? "" : "text-slate-500"}`}><input type="checkbox" className="mt-1 h-4 w-4" disabled={!ready || busy} checked={item.answer} onChange={e => setAnswers(rows => rows.map(row => row.id === item.id ? {...row, answer: e.target.checked} : row))} /><span>{item.question}</span></label>)}</div>
      </div>
      <div><Label htmlFor="tc-software">Detalhe o software adicional (se aplicável)</Label><Textarea className="border-input bg-background" id="tc-software" maxLength={5000} required={answers.some(item => item.id === "extra-software" && item.answer)} value={software} onChange={e => setSoftware(e.target.value)} placeholder="Ex.: AutoCAD, Totvs, etc." /></div>
      <div className="space-y-3"><Label htmlFor="tc-extra">Perguntas adicionais (uma por linha)</Label><Textarea className="border-input bg-background" id="tc-extra" value={extraQuestions} onChange={e => setExtraQuestions(e.target.value)} placeholder="Ex.: Conferiu acesso ao SharePoint?" /><p className="text-xs text-muted-foreground">Essas perguntas pertencem somente a este checklist. Marque abaixo as realizadas.</p>
        {additions.map(question => <label key={question} className="flex items-start gap-2"><input type="checkbox" disabled={!ready || busy} checked={!!extraMarked[question]} onChange={e => setExtraMarked(values => ({...values, [question]: e.target.checked}))} /><span>{question}</span></label>)}
      </div>
      <div><Label htmlFor="tc-notes">Observações</Label><Textarea className="border-input bg-background" id="tc-notes" maxLength={20000} value={notes} onChange={e => setNotes(e.target.value)} /></div>
      <Button type="submit" disabled={busy}>{busy ? "Salvando..." : "Salvar checklist"}</Button>
    </form>}
    {mode === "view" && selected && <section className={`${panel} space-y-4`}><h2 className="text-xl font-semibold">Checklist #{selected.id} — {selected.computer}</h2><p>Usuário: {selected.user_name} | Analista: {selected.analyst_name} | {new Date(selected.created_at).toLocaleString("pt-BR")}</p><p>{selected.answers.filter(item => item.answer).length} / {selected.answers.length} itens marcados</p>
      <ul className="grid gap-3 md:grid-cols-2">{selected.answers.map(item => <li key={item.id}><strong>{item.answer ? "Sim" : "Não"}</strong> — {item.question}</li>)}</ul><p className="whitespace-pre-wrap">Software adicional: {selected.additional_software || "Não informado"}</p><p className="whitespace-pre-wrap">Observações: {selected.notes || "Não informadas"}</p><Button disabled={selected.created_by !== member.user_id} onClick={() => openForm(selected)}>Editar checklist</Button></section>}
    {mode === "questions" && <section className={`${panel} space-y-4`}><h2 className="text-xl font-semibold">Perguntas do checklist de formatação</h2><p className="text-sm text-muted-foreground">Alterações valem para os próximos checklists. Os anteriores preservam suas perguntas originais.</p>
      {questions.map(question => <div key={question.id} className="flex flex-wrap items-center gap-2 rounded border border-border p-3"><Input className={`${input} min-w-48 flex-1`} aria-label={`Pergunta ${question.position}`} maxLength={500} value={questionEdits[question.id] ?? question.label} onChange={e => setQuestionEdits(edits => ({...edits, [question.id]: e.target.value}))} /><span>{question.active ? "Ativa" : "Inativa"}</span><Button disabled={busy} onClick={() => void saveQuestion(question)}>Salvar pergunta</Button><Button variant="secondary" disabled={busy} onClick={() => void saveQuestion(question, !question.active)}>{question.active ? "Desativar" : "Ativar"}</Button></div>)}
      <form className="flex flex-wrap gap-2" onSubmit={event => {event.preventDefault(); void saveQuestion();}}><Input className={`${input} min-w-48 flex-1`} aria-label="Nova pergunta" maxLength={500} required value={newQuestion} onChange={e => setNewQuestion(e.target.value)} /><Button type="submit" disabled={busy}>Adicionar pergunta</Button></form>
    </section>}
  </div>;
}
