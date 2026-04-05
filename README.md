# Financeiro PWA

Versao web instalavel do app financeiro, criada em pasta separada para rodar no iPhone sem App Store.

## O que tem aqui

- `index.html`: estrutura principal da interface.
- `styles.css`: visual responsivo com cara de app.
- `app.js`: logica, armazenamento local e renderizacao.
- `auth.js`: camada de login Google via Firebase Auth.
- `firebase-config.js`: configuracao ativa do Firebase para o site.
- `firebase-config.example.js`: modelo para preencher as credenciais.
- `manifest.webmanifest`: metadados de instalacao.
- `service-worker.js`: cache offline da app shell.
- `icons/`: icones para Home Screen e manifest.

## Como testar no navegador

1. Sirva esta pasta em um servidor estatico.
2. Abra a URL no navegador.
3. Para o iPhone, use uma URL HTTPS no Safari.

## Como ativar login com Google

1. Crie um projeto no Firebase.
2. Em `Authentication`, ative o provedor `Google`.
3. Em `Authentication -> Settings -> Authorized domains`, adicione:
   - `joaodavim1.github.io`
4. Em `Project settings`, copie a configuracao Web do app.
5. Substitua o conteudo de `firebase-config.js` com base em `firebase-config.example.js`.
6. Se quiser exigir login antes de entrar no app, deixe `requireLogin: true`.
7. Faça commit e push novamente para o GitHub Pages.

## Como instalar no iPhone

1. Publique a pasta em uma hospedagem HTTPS.
2. Abra a URL no Safari do iPhone.
3. Toque em Compartilhar.
4. Toque em `Adicionar a Tela de Inicio`.
5. Confirme em `Open as Web App`.

## Observacoes

- Os dados ficam salvos localmente no navegador do aparelho.
- Com login Google ativo, os dados ficam separados por conta neste navegador.
- O app funciona offline para os arquivos principais depois da primeira carga.
- Como e uma PWA, o acesso a recursos nativos do iOS e mais limitado do que em um app SwiftUI.
