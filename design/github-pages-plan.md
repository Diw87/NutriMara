# GitHub Pages Implementation Plan

**Goal:** NutriMara acessível pelo GitHub e instalável pelo navegador.
**Spec:** design/github-pages.md
**Architecture:** interface existente com cliente de dados injetável; edição React/Vite estática com IndexedDB e backup. Publicação de `docs/` sem dependência de serviços Sites.

## Global Constraints
- Manter a logo oficial e a paleta existentes.
- Preservar a versão servidor e seus registros.
- Não enviar registros de pacientes ou fotos ao GitHub.
- Não alterar a visibilidade do repositório sem autorização específica.

## Tasks
1. Banco local: testes primeiro em `tests/local-store.test.mjs`; implementar `pwa/local-store.ts` e `pwa/schemas.ts`. `request(path, init)` retorna Response; `photoUrl(id, view)` fornece URL temporária; `exportBackup()` e `importBackup(value)` preservam vínculos. Verificar com `npm test`.
2. Interface e instalação: cliente padrão em `lib/clinic-client.ts`, injeção nos componentes existentes; `pwa/main.tsx`, ferramentas de instalação/backup e CSS. Compilar com `npm run build:pages` e verificar com `npm run typecheck`.
3. Entrega: gerar manifesto, ícones e cache estático, validar todos os recursos em `/NutriMara/`, revisar código, enviar fonte e `docs/` à main do NutriMara. Verificar os hashes enviados e a disponibilidade de Pages; fornecer o link apenas quando publicado.

## Review Focus
- Importação inválida não altera registros existentes.
- Repetir a mesma importação não duplica pacientes.
- Fotos e registros continuam acessíveis após nova abertura do banco.
- Caches de outros aplicativos do mesmo domínio permanecem intactos.
- Caminhos de arquivos respeitam `/NutriMara/` e o aplicativo não chama APIs de Sites.
