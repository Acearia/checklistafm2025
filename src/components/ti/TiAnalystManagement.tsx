import {useEffect, useRef, useState} from "react";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {useToast} from "@/hooks/use-toast";
import {canManageTiAnalysts} from "@/lib/adminSession";
import {lockTiManagement, manageTiAnalysts, tiManagerClient, type ManagedTiAnalyst} from "@/lib/tiAnalystAdmin";

export default function TiAnalystManagement() {
  const {toast} = useToast();
  const [authorized, setAuthorized] = useState(false); const [busy, setBusy] = useState(false);
  const [loginEmail, setLoginEmail] = useState(""); const [loginPassword, setLoginPassword] = useState("");
  const [rows, setRows] = useState<ManagedTiAnalyst[]>([]); const [error, setError] = useState("");
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [linkExisting, setLinkExisting] = useState(false); const [selected, setSelected] = useState<ManagedTiAnalyst | null>(null);
  const [active, setActive] = useState(true); const [resetTarget, setResetTarget] = useState<ManagedTiAnalyst | null>(null);
  const [newPassword, setNewPassword] = useState(""); const generation = useRef(0);
  useEffect(() => () => {generation.current++; void lockTiManagement().catch(() => {});}, []);
  if (!canManageTiAnalysts()) return null;
  const explain = (e: unknown) => String((e as {message?: string})?.message || "Não foi possível concluir a operação.");
  const clearForm = () => {setSelected(null); setName(""); setEmail(""); setPassword(""); setActive(true); setLinkExisting(false);};
  const unlock = async (event: React.FormEvent) => {
    event.preventDefault(); if (busy) return; setBusy(true); setError(""); const current = generation.current;
    try {
      const {error: loginError} = await tiManagerClient.auth.signInWithPassword({email: loginEmail.trim(), password: loginPassword});
      if (loginError) throw new Error("Confira o e-mail e a senha da conta gestora do TI.");
      const data = await manageTiAnalysts({action: "list"});
      if (current !== generation.current) return;
      setRows(data.analysts || []); setAuthorized(true);
    } catch (e) {if (current === generation.current) {setError(explain(e)); await lockTiManagement().catch(() => {});}}
    finally {if (current === generation.current) {setLoginPassword(""); setBusy(false);}}
  };
  const reload = async () => {
    if (busy) return; setBusy(true); const current = generation.current;
    try {const data = await manageTiAnalysts({action: "list"}); if (current === generation.current) {setRows(data.analysts || []); setError("");}}
    catch (e) {if (current === generation.current) setError(explain(e));}
    finally {if (current === generation.current) setBusy(false);}
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); if (busy) return; setBusy(true); setError(""); const current = generation.current;
    let saved = false;
    try {
      await manageTiAnalysts(selected ? {action: "update", user_id: selected.user_id, name, active}
        : {action: linkExisting ? "link_existing" : "create", name, email, ...(linkExisting ? {} : {password})});
      saved = true;
      if (current !== generation.current) return;
      clearForm(); toast({title: "Acesso do TI salvo"});
      const data = await manageTiAnalysts({action: "list"});
      if (current !== generation.current) return;
      setRows(data.analysts || []);
    } catch (e) {if (current === generation.current) setError(saved ? `O acesso foi salvo, mas a lista não pôde ser atualizada. ${explain(e)}` : explain(e));}
    finally {if (current === generation.current) {setPassword(""); setBusy(false);}}
  };
  const reset = async (event: React.FormEvent) => {
    event.preventDefault(); if (busy || !resetTarget) return;
    setBusy(true); setError(""); const current = generation.current;
    try {await manageTiAnalysts({action: "reset_password", user_id: resetTarget.user_id, password: newPassword}); if (current === generation.current) {setResetTarget(null); toast({title: "Senha do analista redefinida"});}}
    catch (e) {if (current === generation.current) setError(explain(e));}
    finally {if (current === generation.current) {setNewPassword(""); setBusy(false);}}
  };
  const lock = async () => {
    if (busy) return; generation.current++; setAuthorized(false); setRows([]); clearForm(); setResetTarget(null); setNewPassword(""); setError("");
    await lockTiManagement().catch(() => {});
  };
  return <Card><CardHeader><CardTitle>Analistas do TI</CardTitle><CardDescription>Cadastro e controle dos acessos à troca de turnos e ao checklist de formatação.</CardDescription></CardHeader>
    <CardContent className="space-y-4">
      {error && <p role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-red-800">{error}</p>}
      {!authorized ? <form onSubmit={unlock} className="space-y-3">
        <p className="text-sm text-muted-foreground">Confirme sua conta gestora do TI para administrar os acessos.</p>
        <div className="grid gap-3 md:grid-cols-2"><div><Label htmlFor="ti-manager-email">E-mail da conta gestora TI</Label><Input id="ti-manager-email" type="email" autoComplete="username" required value={loginEmail} onChange={e => setLoginEmail(e.target.value)} /></div>
          <div><Label htmlFor="ti-manager-password">Senha da conta gestora TI</Label><Input id="ti-manager-password" type="password" autoComplete="current-password" required value={loginPassword} onChange={e => setLoginPassword(e.target.value)} /></div></div>
        <Button type="submit" disabled={busy}>{busy ? "Validando..." : "Autorizar gestão do TI"}</Button>
      </form> : <>
        <div className="flex gap-2"><Button variant="outline" disabled={busy} onClick={() => void reload()}>Atualizar analistas TI</Button><Button variant="outline" disabled={busy} onClick={() => void lock()}>Encerrar autorização</Button></div>
        <form onSubmit={save} className="space-y-3 rounded border p-4"><h3 className="font-semibold">{selected ? "Editar analista TI" : "Novo analista TI"}</h3>
          <div className="grid gap-3 md:grid-cols-2"><div><Label htmlFor="ti-analyst-name">Nome do analista TI</Label><Input id="ti-analyst-name" required maxLength={120} value={name} onChange={e => setName(e.target.value)} /></div>
            <div><Label htmlFor="ti-analyst-email">E-mail do analista TI</Label><Input id="ti-analyst-email" type="email" required disabled={!!selected} maxLength={254} value={email} onChange={e => setEmail(e.target.value)} /></div></div>
          {!selected && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={linkExisting} onChange={e => {setLinkExisting(e.target.checked); setPassword("");}} />Vincular conta de e-mail já existente</label>}
          {!selected && !linkExisting && <div><Label htmlFor="ti-analyst-password">Senha inicial do analista TI</Label><Input id="ti-analyst-password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} /><p className="text-xs text-muted-foreground">Entre 12 e 128 caracteres.</p></div>}
          {selected && <label className="flex items-center gap-2"><input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />Acesso ao TI ativo</label>}
          <div className="flex gap-2"><Button type="submit" disabled={busy}>Salvar acesso TI</Button>{selected && <Button type="button" variant="outline" disabled={busy} onClick={clearForm}>Cancelar edição</Button>}</div>
        </form>
        {resetTarget && <form onSubmit={reset} className="space-y-3 rounded border p-4"><h3 className="font-semibold">Redefinir senha de {resetTarget.name}</h3><Label htmlFor="ti-reset-password">Nova senha do analista TI</Label><Input id="ti-reset-password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={newPassword} onChange={e => setNewPassword(e.target.value)} /><div className="flex gap-2"><Button disabled={busy} type="submit">Confirmar nova senha TI</Button><Button disabled={busy} type="button" variant="outline" onClick={() => {setResetTarget(null); setNewPassword("");}}>Cancelar</Button></div></form>}
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{["Nome", "E-mail", "Situação", "Ações"].map(label => <th className="border-b p-2" key={label}>{label}</th>)}</tr></thead><tbody>
          {rows.map(row => <tr key={row.user_id}><td className="border-b p-2">{row.name}</td><td className="border-b p-2">{row.email}</td><td className="border-b p-2">{row.active ? "Ativo" : "Bloqueado"}{row.manager ? " — Gestor" : ""}</td><td className="border-b p-2"><div className="flex gap-2"><Button size="sm" variant="outline" disabled={busy || row.manager} onClick={() => {setSelected(row); setName(row.name); setEmail(row.email); setActive(row.active); setPassword("");}}>Editar acesso TI</Button><Button size="sm" variant="outline" disabled={busy || row.manager} onClick={() => {setResetTarget(row); setNewPassword("");}}>Redefinir senha TI</Button></div></td></tr>)}
        </tbody></table>{!rows.length && <p className="p-3 text-muted-foreground">Nenhum analista cadastrado.</p>}</div>
      </>}
    </CardContent>
  </Card>;
}
