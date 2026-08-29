# Segurança

Não abra uma issue pública para relatar uma vulnerabilidade ou possível
exposição de dados. Use o recurso **Security advisories** do GitHub para enviar
um relato privado aos mantenedores.

Nunca inclua no relato tokens, chaves privadas, bancos de dados reais ou dados
pessoais. Revogue imediatamente qualquer credencial que tenha sido publicada
por engano, mesmo que o commit seja removido depois.

## Configuração local

- mantenha credenciais somente em `.env` ou no gerenciador de segredos do
  ambiente de implantação;
- use `.env.example` apenas como modelo, sempre com valores fictícios;
- execute um scanner de segredos antes de publicar branches ou releases;
- não versione instaladores, APKs, bancos SQLite ou certificados de assinatura.
