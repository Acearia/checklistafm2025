# Troca de turnos do TI

Endereço: `/ti`. Login próprio por e-mail e senha, via Supabase Auth. A área possui registros de troca de turno, filtros, PDF dos registros, atualização de status, lista de analistas e checklist de formatação de computadores. Apenas contas ativas em `ti_members` conseguem ler ou gravar os dados; a restrição é aplicada no banco por RLS. A sessão fica em sessionStorage e os registros não são guardados no cache público do checklist.

## Instalação na VM

Após `git pull --ff-only origin main`, aplicar o instalador no banco Supabase local:

```bash
cd /opt/app
psql -W -h 127.0.0.1 -p 54322 -U postgres -d postgres -v ON_ERROR_STOP=1 -f supabase/install-ti.sql
npm ci
npm run build
pm2 restart checklist-frontend
```

O `psql` solicita a senha do PostgreSQL. O instalador verifica as tabelas antes de aplicar cada migração. Ele funciona tanto em uma instalação nova quanto na atualização do TI e não recria as tabelas já existentes.

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

O cadastro público no Supabase Auth, se habilitado, não concede acesso ao TI.

## Gestão dos acessos no administrativo

A seção **Analistas do TI** aparece em **Administrativo → Usuários** somente quando o usuário administrativo é `administrador` e seu perfil é `admin`. A seção permite criar analistas, vincular contas existentes, editar nomes, ativar/bloquear acesso e redefinir senhas. A aba Analistas dentro de `/ti` continua sendo uma consulta dos membros.

O administrativo legado mantém sua sessão no navegador; ela não serve como credencial para a API de criação de contas. Por isso, a seção exige autenticação adicional com uma conta gestora do TI, validada pelo Supabase Auth e pela tabela privada `ti_account_managers`. Outros analistas, perfis administrativos e sessões locais forjadas não recebem privilégios de gestão. A chave service-role fica exclusivamente na função do servidor. O cadastro e alteração das próprias contas gestoras continuam restritos ao terminal do servidor.

Ativação inicial na VM:

```bash
cd /opt/app &&
git pull --ff-only origin main &&
npm ci &&
bash scripts/activate-ti-management.sh &&
npm run build &&
pm2 restart checklist-frontend
```

O script aplica somente as migrações ainda ausentes, usando o contêiner `supabase_db_opt`. Copia a função para a instância Supabase em `/opt/supabase` e inicia `supabase functions serve manage-ti-analysts --workdir /opt` pelo PM2 (`checklist-ti-functions`). Não executa deploy em um projeto Supabase Cloud. Para caminhos diferentes, definir `TI_DB_CONTAINER` e `TI_SUPABASE_WORKDIR`. O script verifica a configuração e a instância antes de copiar os arquivos. É necessário o CLI Supabase e o PM2 no PATH do servidor.

O ativador solicita e-mail e nome da conta gestora (nome padrão: Administrador). Também aceita esses dois valores como argumentos. A conta gestora usa e-mail e senha próprios. Para conta nova, o terminal solicita uma senha com pelo menos 12 caracteres. Para conta já existente, a senha é mantida; o comando `manage-ti-user.mjs --reset-password` permite redefini-la. Na tela, o usuário `administrador` informa essas credenciais em **Autorizar gestão do TI**, depois cadastra os analistas sem precisar do terminal. Não reutilizar credenciais do administrativo legado para esta autorização.

Se a chave privada não estiver em `/opt/supabase/.env`, o script tenta obtê-la internamente com `supabase status --workdir /opt --output env`, sem imprimir essa saída. A função aceita por padrão a origem `https://checklist.afm.com.br`; para outra origem, configurar `TI_ALLOWED_ORIGIN` no ambiente das funções. A operação segue o fluxo local do [CLI Supabase](https://supabase.com/docs/reference/cli/supabase-functions-serve).

O ativador aguarda a função responder e verifica que uma credencial anônima é recusada pelo próprio manipulador da API. Uma resposta HTML ou um erro genérico do gateway não é tratado como serviço pronto. No primeiro uso, o CLI pode precisar baixar a imagem do runtime; se houver demora ou falha, consultar `pm2 logs checklist-ti-functions --lines 30` e repetir a ativação depois de corrigir. O teste local cobre o manipulador da API, as permissões no banco e a interface; a ativação do runtime na VM precisa ser conferida no ambiente real.

## Checklist de formatação

Na aba Checklist, os filtros são computador, usuário, analista e período. A tabela exibe ID, data, computador, usuário, analista responsável, contagem Sim/total, observações e ações Ver/Editar. As opções são liberadas após preencher computador e usuário; o responsável é uma conta ativa do TI. São 22 perguntas iniciais, reproduzindo o formulário enviado: domínio, Office, e-mail, Spark, FileMaker, GLPI, RustDesk, antivírus, Teams, Power BI, VPN, Adobe Reader, impressora, pastas e software adicional.

Os itens funcionam como caixas de seleção, permitindo preenchimento parcial. Software adicional marcado exige detalhamento. Perguntas extras (uma por linha) aparecem para marcação no próprio formulário e pertencem apenas àquele checklist. O botão Perguntas permite incluir, renomear, ativar e desativar o modelo para próximos checklists. Os anteriores preservam suas perguntas e contagens originais. Todos os analistas ativos podem consultar; somente o criador pode editar um checklist, e o banco também aplica essa restrição. Não há exclusão. Alterações simultâneas são detectadas para evitar sobrescrita.

Os registros de troca de turno continuam na aba Registros. Eventuais checklists antigos de passagem de turno, criados antes desta mudança, continuam consultáveis ali com suas respostas originais.

## Verificação

```bash
node --import tsx --test scripts/test-ti-handover.ts
node --import tsx --test scripts/test-ti-computer-checklist.ts
node scripts/test-ti-database.mjs
node --import tsx --test scripts/test-ti-analyst-management.ts
```

Testar na VM o login de um analista autorizado, a criação de registro e checklist e o bloqueio de uma conta Auth que não pertença ao TI. A migração usa `auth.users`, `auth.uid()` e os papéis anon/authenticated/service_role do Supabase; não é uma migração para PostgreSQL sem Supabase.

O teste de banco usa PostgreSQL em memória com PGlite, sem conexão com a VM. Ele valida a migração, as políticas RLS, a autoria e o bloqueio por desativação. PGlite é uma dependência de desenvolvimento e não entra no aplicativo publicado.
