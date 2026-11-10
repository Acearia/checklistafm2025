// Run only on the server. The service-role key must never be put in VITE_*.
import {parseArgs} from 'node:util';
import {emitKeypressEvents} from 'node:readline';
import {createClient} from '@supabase/supabase-js';
import {loadTiServerConfig} from './lib/ti-server-config.mjs';

async function passwordPrompt(label = 'Senha inicial (mínimo de 12 caracteres): ') {
  if (!process.stdin.isTTY) throw new Error('Use um terminal interativo para definir a senha.');
  process.stdout.write(label);
  emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true); process.stdin.resume();
  return new Promise((resolve, reject) => {
    let value = '';
    const finish = () => {process.stdin.off('keypress', onKey); process.stdin.setRawMode(false); process.stdin.pause(); process.stdout.write('\n');};
    const onKey = (text, key) => {
      if (key?.ctrl && key.name === 'c') {finish(); reject(new Error('Cancelado.'));}
      else if (key?.name === 'return' || key?.name === 'enter') {finish(); resolve(value);}
      else if (key?.name === 'backspace') value = value.slice(0, -1);
      else if (text && !key?.ctrl && !key?.meta) value += text;
    };
    process.stdin.on('keypress', onKey);
  });
}

try {
  const {values} = parseArgs({options: {
    email: {type: 'string'}, name: {type: 'string'}, env: {type: 'string'},
    badge: {type: 'string'},
    deactivate: {type: 'boolean', default: false}, 'reset-password': {type: 'boolean', default: false},
    manager: {type: 'boolean', default: false},
    administrator: {type: 'boolean', default: false},
    stack: {type: 'string', default: '/opt'},
  }});
  if (!values.email || (!values.deactivate && !values.name)) throw new Error('Use --email email@empresa.com --name "Nome do analista". Para bloquear: --email email@empresa.com --deactivate.');
  if (values.administrator && (!values.manager || values.deactivate)) throw new Error('A configuração do administrador exige --manager e uma conta ativa.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) throw new Error('Informe um e-mail válido.');
  if (!values.deactivate && (!values.name.trim() || values.name.trim().length > 120)) throw new Error('O nome deve ter entre 1 e 120 caracteres.');
  const {url, key, anonKey} = loadTiServerConfig({stack: values.stack, envFile: values.env});
  const client = createClient(url, key, {auth: {persistSession: false, autoRefreshToken: false}});
  const email = values.email.trim().toLowerCase();
  let user = null;
  for (let page = 1; ; page++) {
    const {data, error} = await client.auth.admin.listUsers({page, perPage: 200});
    if (error) throw new Error(`A instância recusou a credencial administrativa. Nenhuma conta foi criada ou alterada. ${error.message}`);
    user = data.users.find(candidate => candidate.email?.toLowerCase() === email);
    if (user || data.users.length < 200) break;
  }
  if (values.deactivate) {
    if (!user) throw new Error('Conta não encontrada.');
    const {error} = await client.from('ti_members').update({active: false}).eq('user_id', user.id);
    if (error) throw error;
    console.log('Acesso ao módulo de TI bloqueado. Os registros foram preservados.');
  } else {
    const existing = user ? await client.from('ti_members').select('badge').eq('user_id', user.id).maybeSingle() : {data: null, error: null};
    if (existing.error) throw existing.error;
    const badge = values.badge === undefined ? existing.data?.badge || null : values.badge.trim().toUpperCase();
    if (badge && !/^[A-Z0-9._-]{1,40}$/.test(badge)) throw new Error('Crachá inválido. Use até 40 letras ou números, ponto, hífen ou sublinhado.');
    if (!badge && (!values.manager || values.badge !== undefined)) throw new Error('Informe o crachá do analista com --badge, preservando os zeros à esquerda.');
    if (badge) {
      const {data: owner, error: badgeError} = await client.from('ti_members').select('user_id').eq('badge', badge).maybeSingle();
      if (badgeError) throw badgeError;
      if (owner && owner.user_id !== user?.id) throw new Error('Este crachá já está vinculado a outro analista. Nenhuma conta foi alterada.');
    }
    let passwordForVerification = null;
    if (!user || values['reset-password']) {
      const password = await passwordPrompt(values.administrator ? 'Defina a senha única do administrador (mínimo de 12 caracteres): ' : undefined);
      if (password.length < 12 || password.length > 128) throw new Error('A senha deve ter entre 12 e 128 caracteres.');
      const confirmation = await passwordPrompt('Confirme a senha: ');
      if (confirmation !== password) throw new Error('As senhas não coincidem. Nenhuma senha foi alterada. Execute novamente.');
      const {data, error} = user
        ? await client.auth.admin.updateUserById(user.id, {password, email_confirm: true})
        : await client.auth.admin.createUser({email, password, email_confirm: true});
      if (error) throw error;
      user = data.user;
      passwordForVerification = password;
    }
    const {error} = await client.from('ti_members').upsert({user_id: user.id, name: values.name.trim(), active: true, ...(badge ? {badge} : {})});
    if (error) throw error;
    if (values.manager) {
      const {error: managerError} = await client.from('ti_account_managers').upsert({user_id: user.id, active: true});
      if (managerError) throw managerError;
    }
    if (values.administrator) {
      const {error: loginError} = await client.from('ti_administrator_login').upsert({username: 'administrador', user_id: user.id, updated_at: new Date().toISOString()});
      if (loginError) throw loginError;
    }
    if (passwordForVerification) {
      const auth = createClient(url, anonKey, {auth: {persistSession: false, autoRefreshToken: false}});
      const {error: signInError} = await auth.auth.signInWithPassword({email, password: passwordForVerification});
      if (signInError) throw new Error(`A conta foi salva, mas o teste de entrada no TI falhou: ${signInError.message}`);
      await auth.auth.signOut({scope: 'local'});
      console.log('Autenticação da conta verificada no Supabase local.');
      const verifyEntry = async (input, label) => {
        const response = await fetch(`${url}/functions/v1/manage-ti-analysts`, {
          method: 'POST', headers: {apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json'},
          body: JSON.stringify({...input, password: passwordForVerification}), signal: AbortSignal.timeout(20000),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || result.session?.user?.id !== user.id) throw new Error(`A conta foi salva, mas ${label} ainda não foi confirmado. Confira o serviço checklist-ti-functions.`);
        // Discard the temporary verification session without persisting tokens.
        await fetch(`${url}/auth/v1/logout?scope=local`, {method: 'POST', headers: {apikey: anonKey, Authorization: `Bearer ${result.session.access_token}`}, signal: AbortSignal.timeout(5000)}).catch(() => {});
        console.log(`${label} verificado com a senha definida agora.`);
      };
      if (badge) await verifyEntry({action: 'analyst_login', badge}, 'Login do TI por crachá');
      if (values.administrator) await verifyEntry({action: 'administrator_login', username: 'administrador'}, 'Login administrativo (usuário administrador)');
    }
    console.log(badge ? 'Analista autorizado. Entrada no TI por crachá e senha.' : 'Administrador configurado. Para entrar também no TI, cadastre seu crachá em Editar acesso TI.');
    if (values.manager) console.log('Conta preparada para gestão no servidor.');
  }
} catch (error) {
  console.error(error.message || 'Falha no cadastro do analista.');
  process.exitCode = 1;
}
