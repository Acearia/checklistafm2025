// Run only on the server. The service-role key must never be put in VITE_*.
import {readFileSync} from 'node:fs';
import {parseArgs} from 'node:util';
import {emitKeypressEvents} from 'node:readline';
import dotenv from 'dotenv';
import {createClient} from '@supabase/supabase-js';

async function passwordPrompt() {
  if (!process.stdin.isTTY) throw new Error('Use um terminal interativo para definir a senha.');
  process.stdout.write('Senha inicial (mínimo de 12 caracteres): ');
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
    deactivate: {type: 'boolean', default: false}, 'reset-password': {type: 'boolean', default: false},
  }});
  if (!values.email || (!values.deactivate && !values.name)) throw new Error('Use --email email@empresa.com --name "Nome do analista". Para bloquear: --email email@empresa.com --deactivate.');
  let config = {};
  for (const path of ['.env', '.env.local', values.env || '/opt/supabase/.env']) {
    try {config = {...config, ...dotenv.parse(readFileSync(path))};} catch (error) {if (error.code !== 'ENOENT') throw error;}
  }
  config = {...config, ...process.env};
  const url = config.VITE_SUPABASE_URL || config.SUPABASE_URL || config.API_URL;
  const key = config.SUPABASE_SERVICE_ROLE_KEY || config.SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Configure SUPABASE_SERVICE_ROLE_KEY (ou SERVICE_ROLE_KEY) no arquivo privado do servidor e VITE_SUPABASE_URL no .env da aplicação.');
  const client = createClient(url, key, {auth: {persistSession: false, autoRefreshToken: false}});
  const email = values.email.trim().toLowerCase();
  let user = null;
  for (let page = 1; ; page++) {
    const {data, error} = await client.auth.admin.listUsers({page, perPage: 200});
    if (error) throw error;
    user = data.users.find(candidate => candidate.email?.toLowerCase() === email);
    if (user || data.users.length < 200) break;
  }
  if (values.deactivate) {
    if (!user) throw new Error('Conta não encontrada.');
    const {error} = await client.from('ti_members').update({active: false}).eq('user_id', user.id);
    if (error) throw error;
    console.log('Acesso ao módulo de TI bloqueado. Os registros foram preservados.');
  } else {
    if (!user || values['reset-password']) {
      const password = await passwordPrompt();
      if (password.length < 12) throw new Error('A senha precisa ter pelo menos 12 caracteres.');
      const {data, error} = user
        ? await client.auth.admin.updateUserById(user.id, {password})
        : await client.auth.admin.createUser({email, password, email_confirm: true});
      if (error) throw error;
      user = data.user;
    }
    const {error} = await client.from('ti_members').upsert({user_id: user.id, name: values.name.trim(), active: true});
    if (error) throw error;
    console.log('Analista autorizado. Acesso: /ti, usando o e-mail e a senha da conta de TI.');
  }
} catch (error) {
  console.error(error.message || 'Falha no cadastro do analista.');
  process.exitCode = 1;
}
