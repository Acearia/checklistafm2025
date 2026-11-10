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

Por padrão, o script obtém `API_URL`, `SERVICE_ROLE_KEY` e `ANON_KEY` juntos com `supabase status --workdir /opt --output env`, sem exibir a saída. Não utiliza as chaves antigas de `.env`, `.env.local` ou do ambiente do processo para completar essa configuração. Para uma configuração explicitamente diferente, `--env /caminho/arquivo-privado` deve conter a URL e as duas chaves correspondentes à mesma instância. A senha é solicitada sem eco e deve ser confirmada. A chave privada nunca deve ser salva em variáveis `VITE_*`, no código, em comandos enviados por chat ou no Git.

Para uma conta Auth já existente, o script libera o acesso sem alterar a senha. Adicionar `--reset-password` para definir outra senha. Para bloquear acesso sem apagar o histórico:

```bash
node scripts/manage-ti-user.mjs --email analista@empresa.com.br --deactivate
```

O cadastro público no Supabase Auth, se habilitado, não concede acesso ao TI.

## Gestão dos acessos no administrativo

A página **Analistas TI** (`/admin/analistas-ti`) aparece no menu somente quando o usuário administrativo é `administrador` e seu perfil é `admin`. Ela é separada do formulário geral de usuários e permite criar analistas, vincular contas existentes, editar nomes, ativar/bloquear acesso e redefinir senhas. O endereço antigo `/admin/users#analistas-ti` redireciona para essa página. A aba Analistas dentro de `/ti` continua sendo uma consulta dos membros.

O usuário `administrador` passa a fazer um único login no administrativo, com senha validada no servidor pelo Supabase Auth. A sessão resultante autoriza a gestão do TI automaticamente; não existe outro formulário de e-mail e senha dentro do cadastro. O vínculo entre o usuário administrador e a conta Auth fica na tabela privada `ti_administrator_login`, com a autorização adicional de servidor em `ti_account_managers`. Contas comuns do TI e sessões locais forjadas não recebem privilégios de gestão. A chave service-role fica exclusivamente na função do servidor. Os outros usuários administrativos continuam com seu fluxo de login existente.

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

O ativador solicita e-mail e nome do administrador (nome padrão: Administrador). Também aceita esses dois valores como argumentos. **Nesta ativação será definida a senha única do usuário `administrador`, inclusive se a conta Auth já existir.** A senha deve ter pelo menos 12 caracteres. O e-mail identifica a conta no servidor; no login administrativo continua sendo usado o nome `administrador`. Após ativar e atualizar a interface, sair e entrar novamente com `administrador` e a senha recém-definida. Os analistas são cadastrados diretamente na nova página, sem segunda autorização. O login de `administrador` não aceita mais a senha antiga da tabela legada nem usa fallback local; não publicar a nova interface sem concluir essa ativação.

A configuração administrativa vem exclusivamente da instância local selecionada, evitando misturar a chave de um projeto antigo com a URL atual. A função aceita por padrão a origem `https://checklist.afm.com.br`; para outra origem, configurar `TI_ALLOWED_ORIGIN` no ambiente das funções. A operação segue o fluxo local do [CLI Supabase](https://supabase.com/docs/reference/cli/supabase-functions-serve).

O ativador aguarda a versão 2 da função (com suporte ao login único) e verifica que uma credencial anônima é recusada para listar contas. Uma resposta HTML, a versão anterior ou um erro genérico do gateway não é tratado como serviço pronto. No primeiro uso, o CLI pode precisar baixar a imagem do runtime; se houver demora ou falha, consultar `pm2 logs checklist-ti-functions --lines 30` e repetir a ativação depois de corrigir. O teste local cobre o manipulador da API, as permissões no banco e a interface; a ativação do runtime na VM precisa ser conferida no ambiente real.

Antes de pedir a senha, o cadastro consulta o Auth com a credencial administrativa selecionada. Se ela for recusada, o script para informando que nenhuma conta foi criada ou alterada. Após criar/redefinir a senha e liberar o acesso, ele testa a entrada por e-mail no Auth. Para o administrador, testa também o login administrativo pela função e só então confirma a conclusão. Contas existentes aprovadas pelo administrador têm seu e-mail confirmado nesse provisionamento, assim como as novas; nenhuma senha, JWT ou chave é exibida nos testes de entrada.

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
node --test scripts/test-ti-server-config.mjs
```

Testar na VM o login de um analista autorizado, a criação de registro e checklist e o bloqueio de uma conta Auth que não pertença ao TI. A migração usa `auth.users`, `auth.uid()` e os papéis anon/authenticated/service_role do Supabase; não é uma migração para PostgreSQL sem Supabase.

O teste de banco usa PostgreSQL em memória com PGlite, sem conexão com a VM. Ele valida a migração, as políticas RLS, a autoria e o bloqueio por desativação. PGlite é uma dependência de desenvolvimento e não entra no aplicativo publicado.
