// Read-only API checks using the same public credentials as the application.
// Does not print keys, names, answers, photos or signatures.
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const base = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!base || !key) {
  console.error('Faltam VITE_SUPABASE_URL ou VITE_SUPABASE_PUBLISHABLE_KEY no .env.');
  process.exit(1);
}

const checks = [
  ['environmental_inspections', 'id'],
  ['environmental_inspections', 'id,gestor,assinatura_realizado_por,assinatura_acompanhante,assinatura_gestor'],
  ['environmental_inspection_responses', 'id,environmental_inspection_id'],
];
if (process.argv.includes('--all')) {
  for (const table of ['inspections', 'golden_rules', 'golden_rule_responses',
    'accident_investigations', 'accident_action_plans', 'work_permits']) {
    checks.push([table, 'id']);
  }
}
for (const [table, columns] of checks) {
  try {
    const url = new URL(`${base.replace(/\/$/, '')}/rest/v1/${table}`);
    url.searchParams.set('select', columns);
    url.searchParams.set('limit', '0');
    const response = await fetch(url, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: 'count=exact' },
      signal: AbortSignal.timeout(15000),
    });
    if (response.ok) {
      console.log(`${table} [${columns}]: OK; registros visíveis=${response.headers.get('content-range')?.split('/')[1] ?? 'desconhecido'}`);
    } else {
      const error = await response.json().catch(() => ({}));
      console.error(`${table} [${columns}]: HTTP ${response.status}; código=${error.code || '-'}; ${error.message || 'Falha na consulta'}`);
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(`${table}: conexão indisponível (${error.name}).`);
    process.exitCode = 1;
  }
}
