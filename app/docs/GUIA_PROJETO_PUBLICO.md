# Guia para transformar um projeto privado em portfólio público

Este roteiro ajuda a publicar outro projeto sem expor dados pessoais,
credenciais, bancos, histórico privado ou configurações de produção.

## 1. Preserve uma cópia privada

Antes de limpar ou reorganizar qualquer coisa:

- confirme que o projeto atual está sincronizado;
- crie um segundo repositório privado para backup;
- envie todas as branches e tags importantes;
- verifique a visibilidade como **Private** no GitHub;
- não transforme o repositório original em público antes da auditoria.

Exemplo:

```bash
git remote add private-backup https://github.com/USUARIO/PROJETO-private-backup.git
git push private-backup --all
git push private-backup --tags
```

## 2. Faça uma auditoria de informações privadas

Procure e remova:

- `.env`, tokens, senhas e chaves de API;
- certificados, arquivos `.pem`, `.pfx`, `.jks` e keystores;
- bancos SQLite, backups e exportações;
- e-mails, nomes, clientes e URLs privadas;
- endereços de servidor, SSH, domínios internos e identificadores de conta;
- instaladores, builds e arquivos temporários;
- capturas de tela com dados reais.

Use arquivos de exemplo com placeholders:

```env
API_URL=https://example.com
API_TOKEN=replace-with-your-token
REQUIRE_AUTH=false
```

Nunca copie os valores reais para o arquivo de exemplo.

## 3. Reforce o `.gitignore`

Um ponto de partida:

```gitignore
.env
.env.*
!.env.example
.secrets/
*.log
*.sqlite
*.sqlite-shm
*.sqlite-wal
*.pem
*.key
*.pfx
*.p12
*.jks
node_modules/
dist/
build/
release/
```

Adapte a lista à linguagem e às ferramentas do projeto.

## 4. Não publique automaticamente o histórico privado

Apagar um segredo no commit atual não remove esse segredo dos commits antigos.
O caminho mais seguro é criar o primeiro commit público a partir da árvore já
limpa, sem conectar o histórico privado.

Fluxo recomendado:

1. trabalhe e preserve o histórico completo no repositório privado;
2. termine a limpeza e execute os testes;
3. crie um repositório público vazio;
4. publique somente a árvore limpa como novo histórico público;
5. mantenha privado e público como destinos separados.

Se um segredo real já tiver sido publicado, revogue-o imediatamente. Remover o
arquivo do Git não substitui a rotação da credencial.

## 5. Organize a raiz do projeto

Evite dezenas de arquivos soltos. Uma estrutura simples costuma funcionar:

```text
.github/          automações, templates e segurança
app/              código e arquivos de execução
├── docs/         documentação técnica
├── scripts/      build, manutenção e publicação
├── src/          código principal
└── tests/        testes automatizados
README.md         apresentação do projeto
```

Não mova arquivos apenas por aparência. Atualize imports, scripts, Docker,
workflows e documentação, e depois execute toda a validação.

## 6. Escreva um README de portfólio

O visitante deve entender o projeto em poucos segundos. Inclua:

1. nome e frase curta explicando o produto;
2. botão para abrir a demonstração;
3. duas ou três imagens com dados fictícios;
4. problema resolvido e principais recursos;
5. arquitetura resumida;
6. tecnologias utilizadas;
7. instruções locais objetivas;
8. testes, segurança e CI;
9. link para estudo de caso, roadmap e releases.

Evite colocar endereços locais como chamada principal. `localhost` é útil na
documentação de desenvolvimento, mas não substitui uma demonstração pública.

## 7. Crie uma demonstração segura

Para uma demo pública:

- use somente nomes, clientes e e-mails fictícios;
- isole dados por sessão;
- evite persistência permanente quando não for necessária;
- não conecte a demo ao banco de produção;
- mostre claramente a indicação **Modo demonstração**;
- ofereça uma ação para restaurar os dados iniciais;
- limite sessões e requisições se houver backend público.

Uma aplicação compatível pode ser publicada estaticamente no GitHub Pages. Se a
interface depender de API, crie um adaptador exclusivo para a demo ou hospede um
backend isolado. Nunca coloque credenciais administrativas no frontend.

## 8. Use imagens reais do projeto

As melhores imagens mostram o produto funcionando:

- tela inicial;
- recurso principal;
- estatísticas ou resultado final;
- visual para celular quando ele for relevante.

Antes de publicar, confira cada canto da imagem. Remova notificações pessoais,
abas, e-mails, nomes reais, arquivos recentes e endereços privados.

## 9. Conte a história técnica

Crie um estudo de caso com:

- contexto e problema;
- requisitos e limitações;
- arquitetura;
- decisões técnicas e seus motivos;
- desafios e correções importantes;
- segurança e privacidade;
- testes e automação;
- próximos passos.

Explique decisões e resultados. Apenas listar tecnologias diz pouco sobre sua
capacidade de engenharia.

## 10. Automatize qualidade e segurança

No mínimo, cada push público deve executar:

- instalação reproduzível de dependências;
- testes automatizados;
- build da aplicação;
- scan de segredos;
- geração de artefatos quando houver clientes instaláveis.

Também são úteis:

- templates de bug e melhoria;
- template de pull request;
- `CONTRIBUTING.md`;
- `SECURITY.md` com canal privado para vulnerabilidades;
- atualização automática da demo.

## 11. Publique uma release

Uma release torna o projeto fácil de experimentar sem ambiente de
desenvolvimento.

Inclua:

- número da versão;
- resumo das funcionalidades;
- instaladores com nomes claros;
- plataforma e arquitetura de cada arquivo;
- hashes SHA-256;
- aviso quando o pacote ainda não tiver assinatura comercial.

Exemplos de nomes:

```text
MeuProjeto-1.0.0-win-x64.exe
MeuProjeto-1.0.0-linux-x86_64.AppImage
MeuProjeto-1.0.0-android-debug.apk
```

## 12. Configure a página do GitHub

Revise:

- descrição curta;
- URL da demonstração no campo **Website**;
- tópicos relacionados às tecnologias e ao problema;
- visibilidade pública;
- branch padrão;
- releases e workflows aprovados;
- imagem de apresentação, se desejar usar o Social Preview do GitHub.

## 13. Escolha uma licença conscientemente

Um repositório público sem licença pode ser lido, mas não concede
automaticamente permissão para copiar, modificar ou redistribuir o código.

Use uma licença somente depois de decidir o que deseja permitir. MIT, Apache-2.0
e GPL possuem objetivos diferentes. Se houver dúvida jurídica, não escolha por
automação.

## Checklist antes de anunciar

- [ ] Backup privado completo e verificado
- [ ] Repositório público com histórico separado e limpo
- [ ] Nenhum segredo ou dado pessoal no estado atual ou histórico público
- [ ] `.gitignore` e `.env.example` revisados
- [ ] Estrutura de pastas compreensível
- [ ] README com problema, recursos, imagens e arquitetura
- [ ] Demo pública abre sem instalação e sem precisar atualizar a página
- [ ] Imagens usam somente dados fictícios
- [ ] Testes e build passam localmente
- [ ] CI e scan de segredos passam no GitHub
- [ ] Release possui arquivos e hashes corretos
- [ ] Descrição, website e tópicos do repositório estão configurados
- [ ] Política de segurança e templates estão disponíveis
- [ ] Licença foi escolhida conscientemente ou a ausência foi documentada

## Sequência recomendada

```text
Backup privado
      ↓
Auditoria de dados e segredos
      ↓
Organização e testes
      ↓
Histórico público limpo
      ↓
README + imagens + estudo de caso
      ↓
Demo pública segura
      ↓
CI + scan de segredos
      ↓
Release + divulgação
```

Faça uma etapa por vez e valide antes de publicar a próxima. Isso reduz o risco
de expor informações e facilita descobrir exatamente qual alteração causou um
problema.
