# Carregamento das telas administrativas

## Alterações

- Inspeções: primeira página com contagem, demais páginas em até quatro consultas
  simultâneas, preservando o histórico completo e a ordenação.
- Dados já armazenados aparecem na abertura enquanto o React Query busca a
  versão atual. Recursos que a tela não utiliza não leem o cache persistido.
- Inspeções e Regras de Ouro renderizam 50 linhas por página. Filtros, totais e
  exportações continuam usando a lista completa carregada, não apenas a página visível.
- A atualização automática de Inspeções consulta somente as inspeções a cada
  minuto; o botão Atualizar continua disponível para consulta imediata.
- Regras de Ouro: respostas consultadas em lotes de 20 registros, com até quatro
  lotes simultâneos e paginação para não perder respostas acima do limite da API.
- Assinaturas de Regras de Ouro são obtidas na abertura dos detalhes, junto com
  os anexos, em vez de baixar imagens para montar a lista.
- Regras de Ouro e Planos de Ação carregam suas listas independentemente dos
  dados auxiliares. Investigações reutiliza uma única consulta de planos,
  sem carregar os comentários que a listagem não utiliza.
- A sincronização de pendências em Regras de Ouro e Inspeções Ambientais fica
  sob responsabilidade do OfflineSyncManager, sem bloquear a abertura da tela.

## Verificação

```bash
npx tsx --test scripts/test-paged-load.ts scripts/test-inspection-offline.ts
npm run build
```

Teste no Edge com API simulada, sem acesso aos dados de produção:

- 2.505 inspeções recuperadas em três consultas, com 50 linhas renderizadas.
- Paginação da lista funciona sem descartar o histórico do cache.
- Reabertura com cache em aproximadamente 0,5 segundo, enquanto a API simulada
  demorava oito segundos.
- 300 Regras de Ouro com 16.500 respostas: todas preservadas, em 30 consultas
  de respostas (antes seriam 60 consultas sequenciais), com concorrência máxima
  de quatro. Lista exibida em aproximadamente três segundos, antes da consulta
  de planos que demorava seis segundos.
- Nenhum erro JavaScript nos cenários de navegador.

Os tempos são de teste e não garantem a latência da VM ou da rede da fábrica.
Não há migração de banco nesta atualização. Publicar com o fluxo habitual:

```bash
cd /opt/app &&
git pull --ff-only origin main &&
npm ci &&
npm run build &&
pm2 restart checklist-frontend
```
