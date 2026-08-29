# FocusFlow

[![Build clients](https://github.com/ninex9x/tempo-app-public/actions/workflows/build-clients.yml/badge.svg)](https://github.com/ninex9x/tempo-app-public/actions/workflows/build-clients.yml)
[![Secret scan](https://github.com/ninex9x/tempo-app-public/actions/workflows/secret-scan.yml/badge.svg)](https://github.com/ninex9x/tempo-app-public/actions/workflows/secret-scan.yml)

Aplicativo de controle de tempo e projetos com clientes para web/PWA, Windows,
Linux e Android. O backend centraliza regras de negócio, sincronização e
persistência em SQLite.

## Recursos

- cronômetro com pausa, retomada, finalização e revisão;
- lançamentos manuais no horário de Brasília;
- projetos, prazos, estimativas e subtarefas;
- proteção contra horários sobrepostos e mais de 24 horas registradas no dia;
- painel responsivo com métricas e gráficos;
- notificações de metas, riscos, prazos e cronômetros esquecidos;
- exportação em CSV e JSON;
- sincronização entre os clientes pelo mesmo backend;
- interface responsiva em modo escuro.

## Início rápido

### Requisitos

- Node.js 22.13 ou superior;
- npm 10 ou superior;
- Git.

### Executar localmente

```bash
git clone https://github.com/ninex9x/tempo-app-public.git
cd tempo-app-public
npm install
npm run dev
```

Abra [http://127.0.0.1:3000](http://127.0.0.1:3000).

O comando inicia a interface, a API e o SQLite. O banco local é criado em
`data/focusflow.sqlite`, diretório ignorado pelo Git. Não é necessário criar um
arquivo `.env`, configurar Cloudflare ou instalar um banco separado.

O modo local:

- escuta apenas em `127.0.0.1`;
- usa o perfil `Usuário local`;
- mantém os dados somente na máquina;
- executa sem autenticação externa.

## Comandos

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Inicia interface, API e SQLite em `127.0.0.1:3000` |
| `npm start` | Inicia a aplicação completa, igual ao modo local |
| `npm run dev:web` | Serve somente a interface em `127.0.0.1:4173` |
| `npm test` | Executa os testes automatizados |
| `npm run build` | Gera a versão web estática em `dist/` |
| `npm run desktop:windows` | Gera o instalador NSIS no Windows |
| `npm run desktop:linux` | Gera os pacotes AppImage e DEB no Linux |

## Arquitetura

```text
Web / PWA ─────┐
Windows/Linux ─┼──> API Node.js ──> regras de negócio ──> SQLite
Android ───────┘
```

Os clientes apresentam a interface e enviam comandos para a API. Validações,
estatísticas, notificações e persistência são processadas no backend.

Principais endpoints:

| Método | Endpoint | Finalidade |
| --- | --- | --- |
| `GET` | `/api/health` | Verifica a integridade do serviço |
| `GET` | `/api/auth` | Retorna a identidade validada pelo backend |
| `GET` | `/api/state` | Carrega o estado e a revisão atuais |
| `POST` | `/api/action` | Executa uma ação com controle de concorrência |
| `GET` | `/api/export` | Exporta os registros em CSV ou JSON |

## Executar com Docker

Docker Compose inicia a aplicação e um Nginx sem privilégios. O SQLite fica em
um volume persistente e a porta é exposta somente no computador local.

```bash
docker compose up -d --build
```

Abra [http://127.0.0.1:8091](http://127.0.0.1:8091).

Para acompanhar ou encerrar:

```bash
docker compose logs -f
docker compose down
```

## Configuração de produção

O modo de produção pode usar Cloudflare Tunnel e Cloudflare Access. Copie o
modelo e mantenha os valores reais somente no ambiente privado:

```bash
cp .env.example .env
```

| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| `REQUIRE_ACCESS_AUTH` | Não | Use `true` para ativar o Cloudflare Access |
| `TEAM_DOMAIN` | Com autenticação | Domínio da equipe no Cloudflare Access |
| `POLICY_AUD` | Com autenticação | Audiência da política do Access |
| `ALLOWED_ORIGINS` | Não | Origens adicionais, separadas por vírgula |
| `LEGACY_OWNER_EMAIL` | Não | Migração controlada de dados legados |

Quando `REQUIRE_ACCESS_AUTH=true`, o backend valida assinatura, emissor,
expiração e audiência do JWT enviado pelo Cloudflare Access. Cada identidade
possui dados isolados no SQLite. O e-mail do perfil vem da conta autenticada e
não pode ser alterado pelo cliente.

Nunca envie `.env`, tokens, bancos SQLite, certificados, instaladores ou chaves
de assinatura ao Git.

## Windows e Linux

O cliente desktop usa Electron e mantém a sessão OAuth cifrada pelo cofre do
sistema. O login é aberto no navegador padrão, fora da janela do aplicativo.

```bash
npm run desktop:icon
npm run desktop:windows
```

No Linux:

```bash
npm run desktop:icon
npm run desktop:linux
```

Os artefatos são gravados em `release/`:

- Windows: instalador NSIS `.exe`;
- Linux: `.AppImage` e `.deb`.

## Android

O projeto Android requer JDK 17 e Android SDK 34.

No Linux ou macOS:

```bash
cd android
./gradlew assembleDebug
```

No Windows:

```powershell
cd android
.\gradlew.bat assembleDebug
```

O APK é gerado em `android/app/build/outputs/apk/debug/app-debug.apk`.

## Estrutura do projeto

```text
android/                 cliente Android nativo
desktop/                 shell Electron, OAuth e atualizador
server/                  API, autenticação e regras de negócio
scripts/                 build e publicação de atualizações
tests/                   testes automatizados
updates/                 catálogo local de atualizações
app.js                   interface e integração com a API
compose.yaml             ambiente Docker local
config.js                configuração do cliente web
index.html               documento principal
styles.css               estilos responsivos
```

## Qualidade e segurança

Cada push e pull request executa:

- testes da API, domínio, OAuth, interface e atualizações;
- build da versão web;
- geração de APK, EXE, AppImage e DEB;
- varredura de segredos com Gitleaks.

Leia [SECURITY.md](SECURITY.md) antes de publicar uma alteração. Vulnerabilidades
devem ser relatadas de forma privada por um GitHub Security Advisory, nunca em
uma issue pública.

O processo de atualização dos clientes desktop está documentado em
[UPDATES.md](UPDATES.md).

## Contribuindo

1. Crie uma branch para a alteração.
2. Implemente a mudança sem adicionar dados ou credenciais reais.
3. Execute `npm test` e `npm run build`.
4. Abra um pull request descrevendo o comportamento alterado.
