# Financeiro PWA

Versao web instalavel do app financeiro, criada em pasta separada para rodar no iPhone sem App Store.

## O que tem aqui

- `index.html`: estrutura principal da interface.
- `styles.css`: visual responsivo com cara de app.
- `app.js`: logica, armazenamento local, renderizacao e modo demo.
- `auth.js`: camada de login Google e sincronizacao via Supabase.
- `supabase-config.js`: configuracao ativa do Supabase para o site.
- `supabase-config.example.js`: modelo para preencher as credenciais.
- `manifest.webmanifest`: metadados de instalacao.
- `service-worker.js`: cache offline da app shell.
- `icons/`: icones para Home Screen e manifest.

## Como testar no navegador

1. Sirva esta pasta em um servidor estatico.
2. Abra a URL no navegador.
3. Para o iPhone, use uma URL HTTPS no Safari.

## Como ativar login com Google e puxar os dados do Android

1. Use o mesmo projeto Supabase do app Android.
2. Preencha `supabase-config.js` com:
   - `url`
   - `anonKey`
   - `googleClientId`
3. No Google Cloud do client web usado pelo Supabase, autorize a origem:
   - `https://joaodavim1.github.io`
4. Entre no site com a mesma conta Google usada no Android.
5. A PWA vai ler as tabelas `people`, `transactions` e `account_settings`.
6. Novas transacoes criadas aqui tambem sobem para o mesmo Supabase.

## Como instalar no iPhone

1. Publique a pasta em uma hospedagem HTTPS.
2. Abra a URL no Safari do iPhone.
3. Toque em Compartilhar.
4. Toque em `Adicionar a Tela de Inicio`.
5. Confirme em `Open as Web App`.

## Versao estavel para iPhone

- A trilha estavel do iPhone fica na pasta `ios-estavel/`.
- As versoes estaveis anteriores ficam arquivadas em `old/`.
- Para gerar uma nova versao estavel depois dos testes, rode:
  - `.\scripts\publish_ios_stable.ps1`
- O fluxo recomendado fica assim:
  - testar primeiro na raiz do projeto
  - quando aprovar, gerar a nova copia em `ios-estavel/`
  - a copia anterior sera movida automaticamente para `old/`
  - publicar e reinstalar/atualizar no iPhone usando o link estavel

## Observacoes

- Os dados ficam salvos localmente no navegador do aparelho.
- Com login Google ativo, os dados financeiros passam a usar o mesmo Supabase do Android.
- O app funciona offline para os arquivos principais depois da primeira carga.
- Como e uma PWA, o acesso a recursos nativos do iOS e mais limitado do que em um app SwiftUI.
