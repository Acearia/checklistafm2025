import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {CalendarDays, Moon, Sun, Monitor, LayoutDashboard, Plus, ClipboardList, Users, LogOut, RefreshCw} from "lucide-react";
import TiDashboard, {tiStatusLabel} from "@/components/ti/TiDashboard";
import "@/components/ti/ti-workspace.css";
import type { Session } from "@supabase/supabase-js";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import ListPagination, { useListPagination } from "@/components/ListPagination";
import { tiClient, tiHandoverService, exportTiRecordsPdf, signInTiWithBadge } from "@/lib/tiHandoverService";
import { filterTiRecords, tiLocalDate, tiMonthRange, tiTodayFilters, tiOccurrenceTimestamp, TI_STATUSES, type TiFilters, type TiRecord, type TiMember, type TiStatus } from "@/lib/tiHandover";
import TiComputerChecklists from "@/components/ti/TiComputerChecklists";

const emptyFilters: TiFilters = {analyst: "", location: "", from: "", to: "", status: ""};
const fieldClass = "ti-field";
const panelClass = "ti-panel";
const tabIcons = {"Painel": LayoutDashboard, "Registros": ClipboardList, "Novo Registro": Plus, "Checklist": Monitor, "Analistas": Users};
const statusTone = {"Aberto": "open", "Em andamento": "progress", "Pendente": "pending", "Resolvido": "closed"};
const errorMessage = (error: unknown) => String((error as {message?: string})?.message || "Não foi possível consultar o servidor.");

export default function TiHandover() {
  const {toast} = useToast();
  const [theme, setTheme] = useState<"light" | "dark">(() => {try {return localStorage.getItem("checklistafm-ti-theme") === "light" ? "light" : "dark";} catch {return "dark";}});
  const [clock, setClock] = useState(() => new Date());
  const [month, setMonth] = useState(() => tiLocalDate(new Date().toISOString()).slice(0,7));
  const [occurredDate, setOccurredDate] = useState(() => tiLocalDate(new Date().toISOString()));
  useEffect(() => {try {localStorage.setItem("checklistafm-ti-theme",theme);} catch {}}, [theme]);
  useEffect(() => {const timer = window.setInterval(() => setClock(new Date()), 30000); return () => window.clearInterval(timer);}, []);
  const themeButton = <Button type="button" variant="secondary" onClick={() => setTheme(value => value === "dark" ? "light" : "dark")} aria-label={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}>{theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}{theme === "dark" ? "Modo claro" : "Modo escuro"}</Button>;
  const openNewRecord = () => {setOccurredDate(tiLocalDate(new Date().toISOString())); setTab("Novo Registro");};

  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [member, setMember] = useState<TiMember | null>(null);
  const [members, setMembers] = useState<TiMember[]>([]);
  const [records, setRecords] = useState<TiRecord[]>([]);
  const [tab, setTab] = useState("Painel");
  const [error, setError] = useState("");
  const [loginError, setLoginError] = useState("");
  const [busy, setBusy] = useState(false);
  const [badge, setBadge] = useState(""); const [password, setPassword] = useState("");
  const [draftFilters, setDraftFilters] = useState(tiTodayFilters); const [filters, setFilters] = useState(tiTodayFilters);
  const [location, setLocation] = useState(""); const [problem, setProblem] = useState(""); const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<TiStatus>("Aberto");
  const [selected, setSelected] = useState<TiRecord | null>(null);
  const [editNotes, setEditNotes] = useState(""); const [editStatus, setEditStatus] = useState<TiStatus>("Aberto");
  const generation = useRef(0);
  const refreshRunning = useRef<number | null>(null);
  const userIdRef = useRef("");
  const filtered = useMemo(() => filterTiRecords(records, filters), [records, filters]);
  const pagination = useListPagination(filtered, JSON.stringify(filters));

  useEffect(() => {
    let alive = true;
    const {data: {subscription}} = tiClient.auth.onAuthStateChange((_event, value) => {
      if (!alive) return;
      const nextUser = value?.user.id || "";
      if (userIdRef.current !== nextUser) {
        userIdRef.current = nextUser;
        generation.current++;
        setMember(null); setMembers([]); setRecords([]); setSelected(null); setError(""); setDraftFilters(tiTodayFilters()); setFilters(tiTodayFilters());
        setLocation(""); setProblem(""); setNotes(""); setStatus("Aberto"); setPassword(""); setTab("Painel");
      }
      setSession(value); setInitializing(false);
    });
    return () => {alive = false; generation.current++; subscription.unsubscribe();};
  }, []);

  const refresh = useCallback(async () => {
    if (!session || refreshRunning.current === generation.current) return;
    const current = generation.current;
    refreshRunning.current = current;
    try {
      const ownMember = await tiHandoverService.member(session.user.id);
      if (current !== generation.current) return;
      if (!ownMember) {
        setMember(null); setRecords([]); setMembers([]); setSelected(null);
        setError("Sua conta não está autorizada a acessar a área de TI.");
        return;
      }
      const [rows, analysts] = await Promise.all([tiHandoverService.records(), tiHandoverService.members()]);
      if (current !== generation.current) return;
      setMember(ownMember); setRecords(rows); setMembers(analysts); setError("");
    } catch (e) {
      if (current === generation.current) setError(`Falha na atualização. Os dados podem estar desatualizados. ${errorMessage(e)}`);
    } finally {if (refreshRunning.current === current) refreshRunning.current = null;}
  }, [session?.user.id]);

  useEffect(() => {
    void refresh();
    const onFocus = () => {if (document.visibilityState === "visible") void refresh();};
    window.addEventListener("focus", onFocus); window.addEventListener("online", onFocus);
    const timer = window.setInterval(onFocus, 60000);
    return () => {window.clearInterval(timer); window.removeEventListener("focus", onFocus); window.removeEventListener("online", onFocus);};
  }, [refresh]);

  const login = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setLoginError("");
    try {
      await signInTiWithBadge(badge, password);
      setPassword("");
    } catch (e) {setLoginError(errorMessage(e));}
    finally {setBusy(false);}
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); if (busy || !member || !session) return;
    if (!location.trim() || !problem.trim()) {
      toast({title: "Campos obrigatórios", description: "Informe o local e a descrição da ocorrência.", variant: "destructive"}); return;
    }
    setBusy(true);
    const current = generation.current;
    try {
      const occurredAt = tiOccurrenceTimestamp(occurredDate);
      const saved = await tiHandoverService.create({created_by: session.user.id, location: location.trim(), occurred_at: occurredAt,
        problem: problem.trim(), status, notes: notes.trim(), kind: "ocorrencia", checklist: []});
      if (current !== generation.current) return;
      setRecords(rows => [saved, ...rows.filter(row => row.id !== saved.id)]);
      setLocation(""); setProblem(""); setNotes(""); setStatus("Aberto");
      const savedFilters = {...emptyFilters, from: occurredDate, to: occurredDate}; setDraftFilters(savedFilters); setFilters(savedFilters); setTab("Registros");
      toast({title: "Registro salvo", description: "Disponível para os analistas de TI."});
    } catch (e) {toast({title: "Falha ao salvar", description: errorMessage(e), variant: "destructive"});}
    finally {setBusy(false);}
  };
  const update = async () => {
    if (!selected || busy) return;
    setBusy(true); const current = generation.current;
    try {
      const saved = await tiHandoverService.update(selected.id, editStatus, editNotes.trim(), selected.updated_at);
      if (current !== generation.current) return;
      setRecords(rows => rows.map(row => row.id === saved.id ? saved : row)); setSelected(null);
      toast({title: "Registro atualizado"});
    } catch (e) {toast({title: "Falha ao atualizar", description: errorMessage(e), variant: "destructive"});}
    finally {setBusy(false);}
  };
  const logout = async () => {
    setBusy(true);
    try {const {error: signOutError} = await tiClient.auth.signOut({scope: "local"}); if (signOutError) throw signOutError;}
    catch (e) {toast({title: "Falha ao sair", description: errorMessage(e), variant: "destructive"});}
    finally {setBusy(false);}
  };
  if (initializing) return <div data-ti-theme={theme} className="ti-workspace min-h-screen p-8">Carregando área de TI...</div>;
  if (!session) return <main data-ti-theme={theme} className="ti-workspace flex min-h-screen items-center justify-center p-4">
    <form onSubmit={login} className={`${panelClass} w-full max-w-md space-y-4`}>
      <div className="flex justify-end">{themeButton}</div><h1 className="text-2xl font-bold">AFM Troca de Turnos — TI</h1><p className="text-sm text-muted-foreground">Acesso exclusivo aos analistas autorizados.</p>
      <div><Label htmlFor="ti-badge">Crachá</Label><Input className={fieldClass} id="ti-badge" type="text" autoComplete="username" autoCapitalize="characters" maxLength={40} placeholder="Número do crachá" required value={badge} onChange={e => setBadge(e.target.value)} /></div>
      <div><Label htmlFor="ti-password">Senha</Label><Input className={fieldClass} id="ti-password" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></div>
      {loginError && <p role="alert" className="text-destructive">{loginError}</p>}
      <Button type="submit" disabled={busy}>{busy ? "Entrando..." : "Entrar"}</Button>
      <Link className="ml-4 text-sm underline" to="/">Voltar ao Checklist AFM</Link>
    </form>
  </main>;

  return <div data-ti-theme={theme} className="ti-workspace min-h-screen">
    <header className="ti-header px-4 py-4 sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3"><span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Monitor className="size-6" /></span><div><p className="ti-eyebrow">TECNOLOGIA DA INFORMAÇÃO</p><h1 className="text-lg font-bold tracking-tight">AFM Troca de Turnos — TI</h1></div></div>
        <div className="flex items-center gap-2">{themeButton}<Button variant="ghost" onClick={() => void logout()} disabled={busy}><LogOut className="size-4" />Sair</Button></div>
      </div>
      <nav className="mx-auto mt-4 flex max-w-7xl gap-2 overflow-x-auto pb-1" aria-label="Área de TI">
        {member && Object.entries(tabIcons).map(([name,Icon]) => <Button key={name} variant={tab === name ? "default" : "ghost"} aria-current={tab === name ? "page" : undefined} onClick={() => name === "Novo Registro" ? openNewRecord() : setTab(name)} disabled={busy}><Icon className="size-4" />{name}</Button>)}
      </nav>
    </header>
    <main className="mx-auto max-w-7xl space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground"><div><span className="font-medium text-foreground">{member?.name || "Área de TI"}</span><span className="mx-2 hidden sm:inline">/</span><span className="mt-1 flex items-center gap-2 sm:inline-flex"><CalendarDays className="size-4" /><time dateTime={tiLocalDate(clock.toISOString())}>{clock.toLocaleDateString("pt-BR", {weekday: "long", day: "2-digit", month: "long", year: "numeric"})}</time></span></div><Button variant="secondary" size="sm" onClick={() => void refresh()}><RefreshCw className="size-4" />Atualizar</Button></div>
      {error && <div role="alert" className="ti-error">{error}</div>}
      {!member && !error && <p>Verificando acesso...</p>}
      {member && tab === "Painel" && <TiDashboard records={records} members={members} month={month} onMonthChange={setMonth} onOpen={(analyst,status) => {const next = {...emptyFilters, ...tiMonthRange(month), analyst, status}; setDraftFilters(next); setFilters(next); setTab("Registros");}} />}
      {member && tab === "Registros" && <>
        <form className={`${panelClass} grid gap-3 md:grid-cols-5`} onSubmit={event => {event.preventDefault(); if (draftFilters.from && draftFilters.to && draftFilters.from > draftFilters.to) {toast({title: "Período inválido", variant: "destructive"}); return;} setFilters({...draftFilters});}}>
          <div><Label htmlFor="ti-filter-analyst">Analista</Label><select className={fieldClass} id="ti-filter-analyst" value={draftFilters.analyst} onChange={e => setDraftFilters({...draftFilters, analyst: e.target.value})}><option value="">Todos</option>{members.map(person => <option key={person.user_id} value={person.user_id}>{person.name}{person.active ? "" : " (inativo)"}</option>)}</select></div>
          <div><Label htmlFor="ti-filter-location">Local</Label><Input className={fieldClass} id="ti-filter-location" placeholder="Ex.: CPD, Escritório" value={draftFilters.location} onChange={e => setDraftFilters({...draftFilters, location: e.target.value})} /></div>
          <div><Label htmlFor="ti-filter-from">Data inicial</Label><Input className={fieldClass} id="ti-filter-from" type="date" value={draftFilters.from} onChange={e => setDraftFilters({...draftFilters, from: e.target.value})} /></div>
          <div><Label htmlFor="ti-filter-to">Data final</Label><Input className={fieldClass} id="ti-filter-to" type="date" value={draftFilters.to} onChange={e => setDraftFilters({...draftFilters, to: e.target.value})} /></div>
          <div><Label htmlFor="ti-filter-status">Status</Label><select className={fieldClass} id="ti-filter-status" value={draftFilters.status} onChange={e => setDraftFilters({...draftFilters, status: e.target.value})}><option value="">Todos</option>{TI_STATUSES.map(value => <option key={value} value={value}>{tiStatusLabel(value)}</option>)}</select></div>
          <div className="flex flex-wrap gap-2 md:col-span-5"><Button type="submit">Filtrar</Button><Button type="button" variant="secondary" onClick={() => {setDraftFilters(emptyFilters); setFilters(emptyFilters);}}>Limpar</Button>
            <Button type="button" className="ml-auto bg-emerald-700 text-white hover:bg-emerald-600" disabled={!filtered.length || busy} onClick={async () => {setBusy(true); try {await exportTiRecordsPdf(filtered);} catch {toast({title: "Falha ao gerar PDF", variant: "destructive"});} finally {setBusy(false);}}}>Gerar PDF</Button></div>
        </form>
        <section className={panelClass}><div className="mb-4 flex justify-between"><h2 className="text-lg font-semibold">Registros ({filtered.length})</h2><Button variant="secondary" size="sm" onClick={openNewRecord}>+ Novo</Button></div>
          <div className="overflow-x-auto"><table className="ti-table w-full text-left text-sm"><thead><tr>{["ID", "Data", "Analista", "Local", "Problema", "Status", "Observação", ""].map((name, i) => <th key={i} className="p-2">{name}</th>)}</tr></thead>
            <tbody>{pagination.visibleItems.map(row => <tr key={row.id} className="border-b border-border"><td className="p-2">{row.id}</td><td className="whitespace-nowrap p-2">{new Date(row.occurred_at).toLocaleString("pt-BR")}</td><td className="p-2">{row.analyst_name}</td><td className="p-2">{row.location}</td><td className="max-w-xs whitespace-pre-wrap break-words p-2">{row.problem}</td><td className="p-2"><span className={`ti-status ti-tone-${statusTone[row.status]}`}>{tiStatusLabel(row.status)}</span></td><td className="max-w-xs whitespace-pre-wrap break-words p-2">{row.notes}</td><td className="p-2"><Button variant="secondary" size="sm" onClick={() => {setSelected(row); setEditNotes(row.notes); setEditStatus(row.status);}}>Abrir</Button></td></tr>)}</tbody>
          </table>{!filtered.length && <p className="p-8 text-center text-muted-foreground">Nenhum registro encontrado.</p>}</div>
          <ListPagination {...pagination.pagination} />
        </section>
      </>}
      {member && tab === "Checklist" && <TiComputerChecklists key={member.user_id} member={member} members={members} />}
      {member && tab === "Novo Registro" && <form onSubmit={save} className={`${panelClass} space-y-4`}>
        <h2 className="text-xl font-bold">Novo registro</h2>
        <p className="text-sm text-muted-foreground">Registre a ocorrência e deixe as orientações para o próximo turno.</p>
        <div className="grid gap-4 md:grid-cols-3"><div><Label htmlFor="ti-record-analyst">Analista</Label><Input className={fieldClass} id="ti-record-analyst" readOnly value={member.name} /></div>
          <div><Label htmlFor="ti-location">Local *</Label><Input className={fieldClass} id="ti-location" value={location} maxLength={200} required onChange={e => setLocation(e.target.value)} /></div>
          <div><Label htmlFor="ti-occurred-date">Data do ocorrido *</Label><Input className={fieldClass} id="ti-occurred-date" type="date" required value={occurredDate} onChange={e => setOccurredDate(e.target.value)} /></div>
        </div>
        <>
          <div><Label htmlFor="ti-problem">Problema / ocorrência *</Label><Textarea className="border-input bg-background" id="ti-problem" value={problem} required maxLength={10000} onChange={e => setProblem(e.target.value)} /></div>
          <div><Label htmlFor="ti-status">Status</Label><select className={fieldClass} id="ti-status" value={status} onChange={e => setStatus(e.target.value as TiStatus)}>{TI_STATUSES.map(value => <option key={value} value={value}>{tiStatusLabel(value)}</option>)}</select></div>
        </>
        <div><Label htmlFor="ti-notes">Observação / orientações para o próximo turno</Label><Textarea className="border-input bg-background" id="ti-notes" value={notes} maxLength={20000} onChange={e => setNotes(e.target.value)} /></div>
        <div className="flex gap-2"><Button type="submit" disabled={busy}>{busy ? "Salvando..." : "Salvar registro"}</Button><Button type="button" variant="secondary" disabled={busy} onClick={() => setTab("Registros")}>Cancelar</Button></div>
      </form>}
      {member && tab === "Analistas" && <section className={`${panelClass} space-y-4`}><h2 className="text-xl font-bold">Analistas do TI</h2><p className="text-sm text-muted-foreground">Contas autorizadas para a troca de turnos.</p><ul className="space-y-2">{members.map(person => <li key={person.user_id} className="flex justify-between border-b border-border p-2"><span>{person.name}</span><span>{person.active ? "Ativo" : "Inativo"}</span></li>)}</ul></section>}
    </main>
    <Dialog open={!!selected} onOpenChange={open => {if (!open && !busy) setSelected(null);}}><DialogContent data-ti-theme={theme} className="ti-workspace max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Registro #{selected?.id}</DialogTitle></DialogHeader>
      {selected && <div className="space-y-4"><p>{selected.analyst_name} — {selected.location} — {new Date(selected.occurred_at).toLocaleString("pt-BR")}</p><p className="whitespace-pre-wrap">{selected.problem}</p>
        {(selected.checklist || []).map(item => <div key={item.id} className="rounded border p-3"><p className="font-medium">{item.question}</p><p>{item.answer}</p>{item.notes && <p className="whitespace-pre-wrap">{item.notes}</p>}</div>)}
        <div><Label htmlFor="ti-edit-status">Status</Label><select className="h-10 w-full rounded border bg-background px-3" id="ti-edit-status" value={editStatus} onChange={e => setEditStatus(e.target.value as TiStatus)}>{TI_STATUSES.map(value => <option key={value} value={value}>{tiStatusLabel(value)}</option>)}</select></div>
        <div><Label htmlFor="ti-edit-notes">Observação</Label><Textarea id="ti-edit-notes" maxLength={20000} value={editNotes} onChange={e => setEditNotes(e.target.value)} /></div><Button onClick={() => void update()} disabled={busy}>Salvar alterações</Button>
      </div>}
    </DialogContent></Dialog>
  </div>;
}
