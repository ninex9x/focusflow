# Estudo de caso — FocusFlow

## Visão geral

O FocusFlow é um produto multiplataforma para registrar tempo, planejar projetos
e acompanhar produtividade. A mesma experiência atende web/PWA, Windows, Linux
e Android, com regras de negócio centralizadas em uma API Node.js.

Este projeto demonstra trabalho full stack: interface responsiva, modelagem de
domínio, persistência, concorrência, autenticação, empacotamento nativo,
atualizações e automação de qualidade.

## Problema

Um controle de tempo parece simples até precisar funcionar em vários
dispositivos. O produto precisava impedir registros inconsistentes, preservar a
identidade autenticada, sincronizar edições concorrentes e continuar fácil de
executar localmente.

Os principais requisitos foram:

- registrar sessões manuais ou cronometradas no horário de Brasília;
- organizar estimativas por projeto e subtarefa;
- proteger o limite físico de 24 horas por dia e intervalos sobrepostos;
- sincronizar clientes sem sobrescrever silenciosamente mudanças recentes;
- separar dados por identidade autenticada;
- gerar clientes instaláveis sem duplicar a lógica do produto.

## Solução

```text
Web / PWA ─────┐
Windows/Linux ─┼──> API Node.js ──> domínio ──> SQLite
Android ───────┘          │
                          └──> catálogo de atualizações
```

O frontend envia comandos para a API, que valida cada transição e devolve um
estado pronto para apresentação. Windows e Linux usam um shell Electron; o
Android usa um projeto nativo com a mesma aplicação web integrada.

## Decisões técnicas

### Backend como fonte de verdade

Validações e métricas permanecem no servidor. Dessa forma, clientes diferentes
não conseguem aplicar regras divergentes, e uma atualização de interface não
altera a integridade dos dados.

### Concorrência otimista

Cada estado possui uma revisão. Uma ação enviada com revisão antiga recebe
conflito HTTP 409, e o cliente recarrega o estado atual. Isso evita a perda
silenciosa de alterações feitas em outro dispositivo.

### SQLite para uma implantação simples

SQLite oferece persistência transacional sem exigir um serviço externo. O
arquivo fica fora do Git e pode ser mantido em volume Docker. O domínio continua
isolado do armazenamento, permitindo evoluir a persistência depois.

### Autenticação fora da interface

Em produção, o backend pode validar JWT do Cloudflare Access. Clientes desktop
abrem o OAuth no navegador padrão e guardam a sessão no cofre seguro do sistema.
O e-mail exibido vem da identidade validada e não pode ser substituído pelo
frontend.

### Demo sem dados reais

No servidor, `DEMO_MODE=true` usa um banco em memória e cria uma sessão anônima
isolada por navegador. A edição publicada no GitHub Pages executa o mesmo domínio
diretamente no navegador e guarda alterações apenas em `sessionStorage`. Nos dois
casos, os projetos e lançamentos são fictícios e “Redefinir dados” restaura a
vitrine original. Nenhuma ação da demo pública envia dados para um backend.

## Segurança e privacidade

- arquivos `.env`, bancos, certificados e artefatos de build são ignorados;
- o repositório público passa por varredura automática de segredos;
- origens CORS são validadas, incluindo a própria origem local;
- CSP, `X-Frame-Options`, `nosniff` e política de referência são enviados pelo
  servidor;
- dados autenticados são particionados por identidade;
- a demo pública não depende de informações pessoais.

## Qualidade

A suíte automatizada cobre API, domínio, concorrência, autenticação, OAuth,
armazenamento seguro, notificações, atualizações, PWA e responsividade. O CI
executa testes, build web e gera APK, EXE, AppImage e DEB.

## Competências demonstradas

- JavaScript moderno e Node.js;
- design de API e regras de domínio;
- SQLite e migração de estado;
- segurança de aplicações e OAuth;
- interface responsiva e PWA;
- Electron e Android;
- Docker, Nginx e GitHub Actions;
- testes automatizados e documentação técnica.

## Próximos passos

O plano de evolução está em [ROADMAP.md](ROADMAP.md). As prioridades são ampliar
testes de acessibilidade e adicionar uma camada de testes ponta a ponta para os
fluxos críticos.
