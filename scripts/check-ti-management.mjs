import {execFileSync} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import dotenv from 'dotenv';

try {
  let config;
  try {config = dotenv.parse(execFileSync('supabase', ['status', '--workdir', process.argv[2] || '/opt', '--output', 'env'], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}));}
  catch {throw new Error('Não foi possível consultar a instância local do Supabase.');}
  if (!config.API_URL || !config.ANON_KEY) throw new Error('A instância não informou a URL e a chave pública para verificar o serviço.');
  console.log('Aguardando o serviço de gestão do TI...');
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const request = action => fetch(`${config.API_URL.replace(/\/$/, '')}/functions/v1/manage-ti-analysts`, {
        method: 'POST', headers: {apikey: config.ANON_KEY, Authorization: `Bearer ${config.ANON_KEY}`, 'Content-Type': 'application/json'},
        body: JSON.stringify({action}), signal: AbortSignal.timeout(2000),
      });
      const health = await request('health');
      const version = await health.json().catch(() => ({}));
      if (health.status !== 200 || version.service !== 'ti-analyst-management' || version.protocol !== 3) throw new Error('Aguardando a versão com entrada por crachá.');
      const response = await request('list');
      const body = await response.json().catch(() => ({}));
      // The function itself must deny an anonymous credential. A generic
      // gateway 401 or SPA HTML response does not prove it is running.
      if (response.status === 401 && body.error === 'Sessão inválida. Entre novamente.') {ready = true; break;}
    } catch { /* Startup can involve downloading the local Edge Runtime image. */ }
    if ((attempt + 1) % 10 === 0) console.log('O serviço ainda está iniciando...');
    await delay(1000);
  }
  if (!ready) throw new Error('O serviço ainda não respondeu como esperado. Confira: pm2 logs checklist-ti-functions --lines 30. Depois execute a ativação novamente.');
  console.log('Serviço de gestão do TI respondendo e recusando acesso anônimo corretamente.');
} catch (error) {
  console.error(error.message || 'Falha ao verificar o serviço.'); process.exitCode = 1;
}
