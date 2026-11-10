# Troca de turnos do TI

Endereço: `/ti`. Login próprio por e-mail e senha, via Supabase Auth. A área possui registros, filtros, PDF, atualização de status, lista de analistas e checklist de passagem de turno. Apenas contas ativas em `ti_members` conseguem ler ou gravar os dados; a restrição é aplicada no banco por RLS. A sessão fica em sessionStorage e os registros não são guardados no cache público do checklist.

## Instalação na VM

Após `git pull --ff-only origin main`, aplicar apenas a nova migração no banco Supabase local:

```bash
cd /opt/app
psql -W -h 127.0.0.1 -p 54322 -U postgres -d postgres -v ON_ERROR_STOP=1 -f supabase/migrations/20261110120000_create_ti_handover.sql
npm ci
npm run build
pm2 restart checklist-frontend
```

O `psql` solicita a senha do PostgreSQL. Não executar novamente essa migração em um banco onde as tabelas já foram criadas.

## Contas do TI

No terminal da VM, cadastrar cada analista:

```bash
cd /opt/app
node scripts/manage-ti-user.mjs --email analista@empresa.com.br --name "Nome do analista"
```

O script lê a URL do `.env` da aplicação e a chave privada `SERVICE_ROLE_KEY` ou `SUPABASE_SERVICE_ROLE_KEY` de `/opt/supabase/.env`. Se necessário, usar `--env /caminho/arquivo-privado`. A senha é solicitada sem eco no terminal. A chave privada nunca deve ser salva em variáveis `VITE_*`, no código, em comandos enviados por chat ou no Git.

Para uma conta Auth já existente, o script libera o acesso sem alterar a senha. Adicionar `--reset-password` para definir outra senha. Para bloquear acesso sem apagar o histórico:

```bash
node scripts/manage-ti-user.mjs --email analista@empresa.com.br --deactivate
```

O cadastro e a liberação de contas são feitos no servidor. A aba Analistas mostra as contas autorizadas; o login administrativo antigo não libera o módulo automaticamente. O cadastro público no Supabase Auth, se habilitado, também não concede acesso ao TI.

## Checklist inicial

Rede, servidores/monitoramento, backups, sistemas essenciais, chamados prioritários e pendências para o próximo turno. Todas as perguntas devem ser respondidas; irregularidades exigem descrição. Cada checklist concluído cria um registro com suas respostas originais preservadas. O status e as observações podem ser atualizados posteriormente. Alterações simultâneas são detectadas para evitar sobrescrever o trabalho de outro analista.

## Verificação

```bash
node --import tsx --test scripts/test-ti-handover.ts
node scripts/test-ti-database.mjs
```

Testar na VM o login de um analista autorizado, a criação de registro e checklist e o bloqueio de uma conta Auth que não pertença ao TI. A migração usa `auth.users`, `auth.uid()` e os papéis anon/authenticated/service_role do Supabase; não é uma migração para PostgreSQL sem Supabase.

O teste de banco usa PostgreSQL em memória com PGlite, sem conexão com a VM. Ele valida a migração, as políticas RLS, a autoria e o bloqueio por desativação. PGlite é uma dependência de desenvolvimento e não entra no aplicativo publicado.
