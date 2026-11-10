import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import dotenv from 'dotenv';

// URL, public key and administrative key must always come from one source.
// Never combine a local key with a URL/key left in the frontend .env.
export function selectTiServerConfig(source) {
  const url = source.API_URL || source.SUPABASE_URL;
  const key = source.SERVICE_ROLE_KEY || source.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = source.ANON_KEY || source.SUPABASE_ANON_KEY;
  if (!url || !key || !anonKey) throw new Error('A configuração deve informar API_URL, SERVICE_ROLE_KEY e ANON_KEY da mesma instância. Nenhuma conta foi alterada.');
  let parsed;
  try {parsed = new URL(url);} catch {throw new Error('A URL da instância Supabase é inválida.');}
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error('A URL da instância Supabase é inválida.');
  return {url: url.replace(/\/$/, ''), key, anonKey};
}

export function loadTiServerConfig({stack = '/opt', envFile} = {}) {
  if (envFile) return selectTiServerConfig(dotenv.parse(readFileSync(envFile)));
  let output;
  try {
    output = execFileSync('supabase', ['status', '--workdir', stack, '--output', 'env'], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']});
  } catch {
    throw new Error('Não foi possível obter as credenciais da instância local. Confira supabase status na pasta da instância. A saída com chaves privadas não foi exibida.');
  }
  return selectTiServerConfig(dotenv.parse(output));
}
