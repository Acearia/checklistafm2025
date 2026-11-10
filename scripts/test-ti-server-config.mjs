import assert from 'node:assert/strict';
import {test} from 'node:test';
import {selectTiServerConfig} from './lib/ti-server-config.mjs';

test('provisioning uses a complete URL/key pair from the same local instance', () => {
  const original = process.env.SERVICE_ROLE_KEY;
  process.env.SERVICE_ROLE_KEY = 'obsolete-private-key';
  try {
    assert.deepEqual(selectTiServerConfig({API_URL: 'http://127.0.0.1:54321/', SERVICE_ROLE_KEY: 'local-admin-key', ANON_KEY: 'local-public-key', VITE_SUPABASE_URL: 'https://old-project.test'}), {
      url: 'http://127.0.0.1:54321', key: 'local-admin-key', anonKey: 'local-public-key',
    });
    assert.throws(() => selectTiServerConfig({API_URL: 'http://127.0.0.1:54321', ANON_KEY: 'local-public-key'}), /mesma instância/);
  } finally {if (original === undefined) delete process.env.SERVICE_ROLE_KEY; else process.env.SERVICE_ROLE_KEY = original;}
});
test('incomplete and invalid configuration does not leak credentials in errors', () => {
  for (const config of [{SERVICE_ROLE_KEY: 'private-fixture'}, {API_URL: 'file:///tmp/key',SERVICE_ROLE_KEY:'private-fixture',ANON_KEY:'public-fixture'}]) {
    assert.throws(() => selectTiServerConfig(config), error => !error.message.includes('private-fixture'));
  }
});
