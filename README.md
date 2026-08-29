# FocusFlow

Aplicativo de controle de tempo com uma única API e clientes para web/PWA,
Android, Windows e Linux. Todas as regras de negócio e a persistência ficam no
backend; os clientes apresentam a interface e enviam comandos autenticados.

## Desenvolvimento web

```bash
npm install
npm run dev
```

Abra `http://127.0.0.1:3000`. Esse comando inicia a interface, a API e um banco
SQLite local em `data/focusflow.sqlite`. Não é necessário criar `.env`, configurar
Cloudflare ou instalar outro banco para desenvolver localmente.

O modo local escuta apenas no computador, usa o perfil `Usuário local` e não
possui autenticação. Para servir somente os arquivos estáticos, sem API, use
`npm run dev:web` e abra `http://127.0.0.1:4173`.

Para gerar os arquivos web estáticos:

```bash
npm run build
```

O resultado fica em `dist/`. Uma implantação HTTPS também pode ser instalada
como PWA no Android, Windows e Linux.

## API e autenticação

O navegador e todos os aplicativos usam a mesma API:

- `GET /api/health` — integridade do serviço;
- `GET /api/auth` — identidade validada pelo backend;
- `GET /api/state` — estado atual e revisão;
- `POST /api/action` — executa comandos com validação e controle de concorrência;
- `GET /api/export` — gera CSV ou JSON no backend.

O Cloudflare Access autentica a conta Google. O backend valida assinatura,
emissor, expiração e audiência do JWT recebido no cabeçalho
`Cf-Access-Jwt-Assertion`. O endpoint `/api/health` é a única exceção para os
health checks internos.

Cada identidade (`sub`) possui um estado SQLite próprio. O e-mail exibido no
perfil vem da conta autenticada e não pode ser trocado pelo cliente. A variável
`LEGACY_OWNER_EMAIL` permite migrar o estado único de versões anteriores apenas
para seu proprietário, sem expô-lo às demais contas.

Os clientes nativos usam OAuth 2.0 Authorization Code com PKCE e RFC 8707. O
app mostra uma tela de acesso própria e só abre o login depois do toque do
usuário. O login acontece no navegador padrão do sistema, nunca na WebView
incorporada. O cliente persiste a sessão cifrada pelo cofre do sistema no desktop
e pelo Android Keystore no celular. Os tokens nunca são gravados em texto puro;
quando a sessão é recusada, o material persistido é apagado antes de um novo
login. O token de acesso é renovado silenciosamente com uma única operação por
vez; falhas temporárias de rede não apagam a sessão. O Cloudflare converte o
token opaco em uma asserção assinada para o backend.

## Servidor

O `compose.yaml` executa a aplicação e um Nginx sem privilégios. O SQLite fica
em um volume persistente e o serviço escuta somente em `127.0.0.1:8091`.

Para iniciar localmente com Docker, sem configuração adicional:

```bash
docker compose up -d --build
```

Abra `http://127.0.0.1:8091`.

Em produção, o HTTPS pode ser terminado pelo Cloudflare e o tráfego encaminhado
por um Cloudflare Tunnel. Nesse caso, copie o modelo de configuração e preencha
os valores apenas no ambiente privado. O arquivo `.env` é ignorado pelo Git:

```bash
cp .env.example .env
```

Defina `REQUIRE_ACCESS_AUTH=true` somente em conjunto com `TEAM_DOMAIN` e
`POLICY_AUD`. `ALLOWED_ORIGINS` aceita origens adicionais separadas por vírgula;
a origem da própria aplicação é aceita automaticamente. `LEGACY_OWNER_EMAIL` é
opcional e deve ser usada somente durante uma migração de dados legados.

Nunca versione `.env`, bancos SQLite, certificados, instaladores ou arquivos de
assinatura. Consulte [SECURITY.md](SECURITY.md) antes de publicar uma cópia do
projeto.

## Android

O projeto Android está em `android/`. A interface web é empacotada no APK, mas
todas as chamadas da API passam pela ponte HTTP nativa autenticada. Requer JDK
17 e Android SDK 34.

```bash
cd android
./gradlew assembleDebug
```

APK: `android/app/build/outputs/apk/debug/app-debug.apk`.

## Windows e Linux

O shell Electron em `desktop/` serve a interface apenas em loopback, realiza o
login no navegador do sistema e encaminha `/api/*` para o backend com o token do
Access. Ele não executa regras de negócio localmente.

```bash
npm run desktop:icon
npm run desktop:windows
npm run desktop:linux
```

Os instaladores ficam em `release/`:

- Windows: instalador NSIS `.exe`;
- Linux: `.AppImage` e `.deb`.

O comando Linux deve ser executado em Linux. O workflow
`.github/workflows/build-clients.yml` testa o projeto e gera APK, EXE, AppImage e
DEB em runners nativos do GitHub Actions.

## Recursos

- cronômetro com pausar, retomar e finalizar;
- lançamentos manuais com início, fim e duração no horário de Brasília;
- criação, edição, prazo opcional, arquivamento e exclusão de projetos;
- planejamento por subtarefas, com estimativas, progresso e vínculo ao cronômetro;
- revisão, correção e exclusão de lançamentos no projeto original, com proteção contra sobreposição e limite de 24 horas por dia;
- painel operacional responsivo com navegação, cartões e gráficos em linha;
- estatísticas calculadas no backend;
- notificações do backend para timer esquecido, metas, estimativas, riscos, prazos e resumo semanal;
- notificações nativas no Android, incluindo cronômetro ativo na barra de notificações;
- perfil e exportação CSV/JSON;
- interface responsiva somente em modo escuro;
- sincronização pelo mesmo banco entre web e aplicativos.
