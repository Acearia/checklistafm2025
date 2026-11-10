import {build, loadEnv} from 'vite';
import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync} from 'node:fs';

// APK assets must use the real HTTPS backend, never the phone's localhost.
const env = loadEnv('production', process.cwd(), 'VITE_');
const url = new URL(env.VITE_SUPABASE_URL || 'http://localhost');
if (url.protocol !== 'https:' || ['localhost', '127.0.0.1', '::1'].includes(url.hostname)) throw new Error('Configure a URL HTTPS real do servidor antes de gerar o APK.');
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
let publicKey = key.startsWith('sb_publishable_');
try {publicKey ||= JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role === 'anon';} catch {}
if (!publicKey) throw new Error('O APK exige uma chave pública do Supabase. Chaves administrativas não são permitidas.');
await build({mode: 'production'});
const gradle = readFileSync('android/app/build.gradle', 'utf8');
const metadata = {
  version: gradle.match(/versionName "([^"]+)"/)[1],
  versionCode: Number(gradle.match(/versionCode (\d+)/)[1]),
  capacitor: JSON.parse(readFileSync('node_modules/@capacitor/android/package.json', 'utf8')).version,
  commit: execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim(),
  builtAt: new Date().toISOString(),
};
writeFileSync('dist/apk-build.json', JSON.stringify(metadata, null, 2) + '\n');
console.log(`APK ${metadata.version}: interface compilada com configuração HTTPS.`);
