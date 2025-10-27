# Checklist AFM – Configuração do CT (Proxmox)

Este documento resume o estado atual do contêiner Linux responsável por hospedar o checklist em produção. Use-o como referência para manter o ambiente local (macOS) alinhado com o CT e vice-versa.

## Visão geral

- **Supabase local** iniciado com `supabase start`
  - Tabela `admin_users` armazena credenciais administrativas (usuários `admin` e `seguranca`).
  - API disponível em `http://172.16.1.230:54321`
  - Banco exposto em `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
  - Arquivo `/opt/supabase/.env` contém:
    ```
    POSTGRES_PASSWORD=Dgp9f2dryr#
    ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...zRwelhfwRSguWRvq6eFg2vH7
    SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...IDGjA6VkACR0dwM9-mwoZVrb4b8JcWeQCEEEBuMR6SU
    ```
- **Frontend (Vite)** servido com `npm run preview -- --host 0.0.0.0 --port 4174`
  - Gerenciado pelo PM2: `pm2 start "npm run preview -- --host 0.0.0.0 --port 4174" --name checklist-frontend`
- **Backup automático** via cron às 02h:
  ```
  0 2 * * * supabase db dump -f /opt/backups/$(date +\%Y\%m\%d-\%H\%M)_snapshot.sql >/tmp/supabase_dump.log 2>&1
  ```

## Variáveis do frontend

O arquivo `.env` do projeto deve refletir os valores do contêiner para que, ao publicar via `git`, nada precise ser editado manualmente:

```
VITE_SUPABASE_URL=http://172.16.1.230:54321
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
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
   npm run build
   pm2 restart checklist-frontend
   ```
5. Caso altere a estrutura de banco, execute `supabase db migration up` ou restaure `~/backup.dump` conforme necessário.

## Dicas rápidas

- Snapshot manual: `supabase db dump -f /opt/backups/$(date +%Y%m%d-%H%M)_snapshot.sql`
- Listar backups: `ls -lh /opt/backups`
- Verificar serviço: `pm2 status` e `supabase status`
- Restaurar último dump: `PGPASSWORD=postgres pg_restore -h 127.0.0.1 -p 54322 -U supabase_admin -d postgres /opt/backups/<arquivo>.sql`

Mantenha este arquivo atualizado sempre que o CT receber mudanças estruturais (novos serviços, portas diferentes, etc.).
