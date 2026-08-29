# Atualizações desktop

O FocusFlow 1.3.0 é a versão-base do atualizador. Ela consulta o catálogo autenticado no backend, baixa o pacote da plataforma e valida tamanho e SHA-256 antes de permitir a instalação.

## Publicar uma nova versão

1. Atualize a versão em `package.json` e, quando aplicável, em `android/app/build.gradle`.
2. Gere o instalador Windows em Windows com `npm run desktop:windows`.
3. Gere AppImage e DEB em Linux com `npm run desktop:linux`.
4. Reúna os três artefatos em `release/`, defina opcionalmente `FOCUSFLOW_UPDATE_NOTES` e execute `npm run updates:prepare`.
5. Defina `FOCUSFLOW_UPDATE_HOST` e `FOCUSFLOW_UPDATE_REMOTE_DIR` somente no
   ambiente privado, ou informe `--host` e `--remote-dir` na linha de comando.
6. Confira sem alterar o servidor com `npm run updates:publish -- --dry-run`.
7. Publique com `npm run updates:publish`.

Os pacotes são enviados antes do `catalog.json`. Como o backend lê o catálogo a cada consulta, não é necessário reconstruir nem reiniciar os contêineres para uma versão que altera somente o cliente desktop.

No Windows, o instalador validado é aberto e o FocusFlow é encerrado. No AppImage, o executável atual é substituído e preservado com o sufixo `.previous`. No DEB, o gerenciador de pacotes do sistema solicita a confirmação do usuário.
