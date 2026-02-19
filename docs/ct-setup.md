# Checklist AFM – Configuração do CT (Proxmox)

Resumo do estado atual do contêiner Linux responsável por hospedar o checklist em produção. Use-o como referência para manter o ambiente local (macOS) alinhado com o CT e vice-versa.

## Visão geral

- **Supabase local** iniciado com `supabase start`
  - API exposta via Nginx em `https://checklist.afm.com.br` (proxy para `127.0.0.1:54321`).
  - Banco exposto em `postgresql://postgres:postgres@127.0.0.1:54322/postgres`.
  - Tabela `admin_users` armazena credenciais administrativas (usuários `admin` e `seguranca`).
  - `/opt/supabase/.env` mantém as chaves (anon/service role).
- **Frontend (Vite)** servido por trás do Nginx em `https://checklist.afm.com.br` → `127.0.0.1:8080` (PM2/serve).
- **Backup automático** via cron às 02h:
  ```
  0 2 * * * supabase db dump -f /opt/backups/$(date +\%Y\%m\%d-\%H\%M)_snapshot.sql >/tmp/supabase_dump.log 2>&1
  ```

## Variáveis do frontend

O arquivo `.env` do projeto deve refletir os valores de produção. No CT:

```
VITE_SUPABASE_URL=https://checklist.afm.com.br
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzYwMzg3NTQzLCJleHAiOjQ5MTYxNDc1NDN9.zRwelhfwRSguWRvq6eFg2vH7RvAq6-8GSoRUwse42Ak
VITE_SUPABASE_PROJECT_ID=local
```

Para desenvolvimento no macOS, recomendamos manter um arquivo `.env.local` (ignorado pelo Git) com as credenciais da instância Supabase local (`http://localhost:54321`) caso queira rodar tudo na máquina.

## Fluxo de atualização

1. Faça alterações no macOS com as mesmas variáveis do `.env` acima.
2. Gere o build local (`npm run build`) para validar.
3. Versione e suba as mudanças (`git commit && git push`).
4. No CT:
   ```bash
   cd /opt/app
   git pull
   npm install
   npm run build  # embute as variáveis atuais (.env)
   pm2 restart checklist-frontend
   ```
5. Caso altere a estrutura de banco, execute `supabase db migration up` ou restaure `~/backup.dump` conforme necessário.

## Dicas rápidas

- Snapshot manual: `supabase db dump -f /opt/backups/$(date +%Y%m%d-%H%M)_snapshot.sql`
- Listar backups: `ls -lh /opt/backups`
- Verificar serviço: `pm2 status` e `supabase status`
- Restaurar último dump: `PGPASSWORD=postgres pg_restore -h 127.0.0.1 -p 54322 -U supabase_admin -d postgres /opt/backups/<arquivo>.sql`
- Proxy em Nginx (checklist.afm.com.br):
  - Adicione no `http {}` de `nginx.conf`:
    ```
    map $http_upgrade $connection_upgrade {
      default upgrade;
      ''      close;
    }
    ```
  - No host `checklist.afm.com.br`:
    ```
    location / { proxy_pass http://127.0.0.1:8080; ... }
    location ~ ^/(rest|auth|storage|realtime|functions)/ {
      proxy_pass http://127.0.0.1:54321;
      proxy_set_header Host $host;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_http_version 1.1;
      proxy_set_header Connection $connection_upgrade;
      proxy_set_header Upgrade $http_upgrade;
    }
    ```
  - Teste: `curl -I https://checklist.afm.com.br/rest/v1/` deve retornar `application/openapi+json`.

Mantenha este arquivo atualizado sempre que o CT receber mudanças estruturais (novos serviços, portas diferentes, etc.).
