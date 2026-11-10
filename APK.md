# APK Checklist AFM

O projeto Android usa a interface atual do repositório, empacotada localmente. Atualizar a VM não atualiza o APK instalado. O aplicativo não depende de carregar o site para abrir, mas precisa de conexão para buscar dados ainda não armazenados e sincronizar os registros pendentes.

## Arquivo verificado em 10/11/2026

- Arquivo: `Checklist-AFM-1.1.0.apk`, versionCode 2, Capacitor 6.2.3.
- Código de compilação: `4b629a8ea81a656fcd0b73f8b9afeb52eb1478de`.
- Tamanho assinado: 2.173.297 bytes (2,07 MiB), 57,8% menor que o APK anterior deste workspace.
- SHA-256: `0245edf723cd525c57b73fdde6574d3d82eef856c6baf8708666c58d343ed300`.
- Assinaturas v1/v2/v3 verificadas; certificado igual ao APK anterior; alinhamento verificado; pacote de release sem depuração.
- 39 testes de lógica passaram. Testes no navegador cobriram painel, tema, datas e retomada de envio parcial da inspeção ambiental. Não havia aparelho ou emulador Android conectado para testar instalação e câmera.

O identificador continua `br.com.afm.checklist`, com origem `https://localhost`. Preservar esses valores e a chave de assinatura permite atualizar a instalação existente sem mudar a origem dos dados offline. Não desinstalar o aplicativo para atualizar, especialmente quando houver registros aguardando envio.

## Compilar

Requisitos: Node >=20, Java 17 e Android SDK 34. Configure o caminho do SDK no arquivo local `android/local.properties`, sem versioná-lo.

Configure `.env.local` com a URL HTTPS real do servidor e apenas a chave pública do Supabase. Nunca use uma chave administrativa em `VITE_*`. O comando de build do APK rejeita configuração local/insegura ou chave administrativa.

```bash
npm ci
npm run apk:sync
cd android
./gradlew assembleRelease
```

No Windows, use `gradlew.bat assembleRelease`. A saída é `android/app/build/outputs/apk/release/app-release-unsigned.apk`.

O release usa R8 e redução de recursos, com `debuggable=false` e depuração da WebView desativada. A interface é minificada pelo Vite e suas rotas são carregadas sob demanda. O arquivo `apk-build.json`, dentro do APK, registra versão, commit e data da compilação.

Alinhe o APK com `zipalign` e assine com `apksigner`, usando a **mesma chave da instalação anterior**. Verifique com `apksigner verify --verbose --print-certs`. As chaves e os APKs gerados não são versionados. O APK anterior deste workspace foi assinado com a chave Android Debug local; a atualização interna precisa manter esse certificado. Para distribuição pública, a gestão da assinatura deve ser planejada separadamente.

```bash
python scripts/verify-apk.py caminho/Checklist-AFM-1.1.0.apk
```

Essa verificação confere integridade do ZIP, entrada da interface, funcionalidades recentes, origem local e ausência de chave administrativa. Ela complementa a validação da assinatura, sem substituir o teste de instalação em Android.

## Servidor e sincronização

A gestão de acesso aceita explicitamente a origem nativa `https://localhost` além da origem web configurada. Autenticação, permissões administrativas e RLS continuam obrigatórias. Para atualizar esse serviço na VM:

```bash
cd /opt/app &&
git pull --ff-only origin main &&
npm ci &&
bash scripts/install-ti-management.sh /opt &&
node scripts/check-ti-management.mjs /opt
```

Checklists, inspeções ambientais, regras de ouro e planos de ação mantêm suas filas persistentes. A sincronização tenta novamente ao recuperar conexão, retornar ao primeiro plano e periodicamente. Um envio incompleto conserva o registro local e seus identificadores para evitar duplicação. A área TI requer conexão e autorização; seu atalho continua oculto em celulares e tablets.

Testes de lógica e navegador cobrem retomada de inspeção ambiental com foto e múltiplos planos após falha parcial, além da autorização do cliente nativo. Sem dispositivo ou emulador conectado, instalação, câmera e comportamento do Android ao encerrar o processo devem ser conferidos no aparelho.

## Referências técnicas

A auditoria desta atualização corrigiu a dependência Android e aplicou as atualizações sem quebra de compatibilidade disponíveis. Ainda há alertas de auditoria, incluindo Zod 3 no runtime e dependências de ferramentas de desenvolvimento, como `tar` do CLI. A migração para Zod 4 e para uma nova geração do CLI precisa de validação própria; não foi aplicado `npm audit fix --force`. Esta atualização não representa uma declaração de ausência de vulnerabilidades.

- [Configuração do Capacitor](https://capacitorjs.com/docs/v6/config).
- [Otimização de release com R8](https://developer.android.com/topic/performance/app-optimization/enable-app-optimization).
- [Alinhamento e assinatura com apksigner](https://developer.android.com/tools/apksigner).
- [Correção da navegação na origem do aplicativo](https://github.com/ionic-team/capacitor/security/advisories/GHSA-rvm3-566m-v7fv), aplicada com Capacitor 6.2.3.
