# Checklist AFM - endurecimento seguro

Este arquivo lista ajustes de seguranca que podem ser aplicados sem mudar as
regras de negocio do app. Aplique primeiro em uma janela curta, depois valide
login, checklist, regras de ouro, inspecao ambiental e planos de acao.

## Nginx

Adicionar no bloco `server` do `checklist.afm.com.br`:

```nginx
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(self), microphone=(), geolocation=()" always;

# CSP conservadora para nao quebrar fotos/data URLs nem Supabase.
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://checklist.afm.com.br https://*.supabase.co wss://checklist.afm.com.br wss://*.supabase.co; worker-src 'self' blob:; frame-ancestors 'self'; base-uri 'self'; form-action 'self'" always;
```

Teste apos recarregar o Nginx:

```bash
nginx -t
systemctl reload nginx
curl -I https://checklist.afm.com.br/
curl -I https://checklist.afm.com.br/rest/v1/
```

Se alguma tela parar de carregar, remova temporariamente apenas a linha
`Content-Security-Policy` e mantenha os outros headers.

## Prioridade fora do horario

1. Revisar politicas RLS do Supabase.
2. Remover `delete/update` anonimo das tabelas criticas.
3. Trocar senhas administrativas para hash forte no servidor.
4. Rotacionar chaves depois que as politicas estiverem fechadas.
5. Criar trilha de auditoria para exclusao e alteracao.
