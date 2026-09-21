# Atualização de segurança das dependências

Atualiza jsPDF para 4.2.1, React Router para 7.18.4 e Vite para 6.4.3,
com plugins compatíveis e correções das dependências transitivas no lockfile.
As alterações do aplicativo Android não fazem parte desta atualização.

## Requisito e publicação

Node.js 20 ou superior é necessário para o React Router 7.
Execute no diretório da aplicação na VM, preservando o `.env` de produção:

```bash
cd /opt/app &&
node -e 'if (Number(process.versions.node.split(".")[0]) < 20) { console.error("Atualize o Node.js para 20 ou superior antes de continuar."); process.exit(1); }' &&
git pull --ff-only origin main &&
npm ci &&
npm run build &&
pm2 restart checklist-frontend &&
npm audit
```

Não há migração de banco. Use npm e o `package-lock.json` atualizado para
reproduzir as versões verificadas; o lockfile antigo do Bun não foi atualizado.

## Validação

- Instalação limpa com `npm ci` concluída.
- `npm audit` e `npm audit --omit=dev`: zero vulnerabilidades reportadas
  no momento da validação (não equivale a uma auditoria completa da aplicação).
- Compilação de produção concluída com Vite 6.
- Cinco testes de sincronização passaram:
  `npx tsx --test scripts/test-inspection-offline.ts`.
- Teste no Microsoft Edge sem interface, com API simulada: redirecionamento
  de rota protegida, login administrativo, carregamento das inspeções,
  abertura do checklist e da visão administrativa.
- Exportação real pelo botão de relatórios: download de PDF válido,
  com cabeçalho `%PDF-`, contendo a inspeção simulada.
- Nenhum erro de execução do JavaScript nesses cenários de navegador.
- A checagem TypeScript continua com os mesmos 58 diagnósticos da versão
  anterior; ela ainda não passa integralmente, independentemente desta atualização.

O teste usa dados simulados e não confirma acesso ao banco da VM.
Após publicar, conferir login, checklist e exportação com dados reais.

Referências de migração:
- https://reactrouter.com/7.9.6/upgrading/v6
- https://v6.vite.dev/guide/migration
- https://github.com/parallax/jsPDF/releases
