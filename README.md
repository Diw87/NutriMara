# NutriMara

Aplicativo da nutricionista **Marakesia Nascimento — CRN 11-6356**, com pacientes, agenda, fichas clínicas, planos alimentares, medidas e acompanhamento por fotos.

## Abrir e instalar

Depois de ativar o GitHub Pages, a interface fica em **https://diw87.github.io/NutriMara/**.

Abra esse endereço no Chrome ou Edge e toque em **Instalar aplicativo**. No iPhone/iPad, abra no Safari e use **Compartilhar → Adicionar à Tela de Início**. Após o primeiro carregamento completo, a versão instalada também abre sem internet. O botão mostra instruções quando o navegador não disponibiliza uma instalação direta.

## Ativar a publicação

Os arquivos compilados já estão em `docs/`. Não é necessário configurar GitHub Actions.

1. No repositório, abra **Settings → Pages**.
2. Em **Source**, selecione **Deploy from a branch**.
3. Escolha **main** e a pasta **/docs**; clique em **Save**.
4. Aguarde o GitHub terminar a publicação e use **Visit site**.

O GitHub Free oferece Pages em repositórios públicos. Um repositório privado requer um plano compatível, como GitHub Pro. A visibilidade deste repositório não é alterada pelo aplicativo ou pelos scripts.

## Onde ficam os registros

- A edição GitHub Pages guarda pacientes e fotos **neste navegador/dispositivo**, usando IndexedDB. Ela não usa a conta GitHub como banco de dados e não exige login no ChatGPT.
- A aba **Fichas** guarda uma ficha clínica por paciente, com anamnese, histórico, rotina alimentar, antropometria, IMC calculado, metas e conduta. O botão **Imprimir / PDF** abre a impressão do navegador para imprimir ou escolher **Salvar como PDF**.
- Não há sincronização automática entre computadores, celulares ou navegadores. Para transferir dados, use **Exportar cópia** e **Importar cópia**.
- A cópia inclui cadastros, consultas, medidas, planos e fotos. Importar acrescenta os registros e preserva os existentes; repetir o mesmo arquivo é bloqueado. Cópias exportadas em momentos diferentes podem conter pacientes em comum.
- Guarde o backup com cuidado: ele contém os dados clínicos e fotografias. Exporte antes de limpar os dados do navegador ou trocar de aparelho. Não trabalhe em navegação anônima se precisa manter os registros.
- Registros da antiga versão hospedada continuam naquele ambiente; eles não são migrados automaticamente.
- O GitHub recebe somente código e recursos visuais. Nenhum registro real ou fotografia de paciente acompanha esta publicação.

## Desenvolvimento

Requer Node.js **22.18 ou superior** (inclui suporte aos testes TypeScript).

```bash
npm ci
npm run dev
```

Abra o endereço exibido, com o caminho `/NutriMara/`. A instalação e o cache sem internet usam a compilação de produção servida em HTTPS ou localhost.

```bash
npm test
npm run typecheck
npm run build:pages
npm run preview:pages
```

Depois de alterar a aplicação, gere novamente `docs/` com `npm run build:pages` e envie fonte e compilação ao GitHub. O service worker atualiza o aplicativo após fechar todas as janelas da versão anterior e abrir de novo. Atualizações não apagam o banco local.

## Estrutura

- `components/`: interface compartilhada com o cliente de dados injetável.
- `lib/clinic-client.ts`: cliente servidor usado pela edição antiga.
- `pwa/`: aplicativo instalável, validação, banco local, backups, manifesto e ícones.
- `scripts/build-pages.mjs`: compilação estática e inventário do cache.
- `docs/`: versão pronta para GitHub Pages.
- `app/`, `db/`, `drizzle/`: edição original, com autenticação e recursos Sites/D1/R2; comandos `dev:sites`, `build:sites` e `start`.

A avaliação por fotos é uma estimativa geométrica com marcações manuais. Ela não mede hidratação nem percentual de gordura; confirme a cintura com fita métrica.

Referências: [publicação no GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site) · [instalação de aplicativos web](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable).


### Medidas por fotos
Na edição GitHub Pages, a avaliação registra estimativas geométricas de cintura,
abdômen e quadril a partir de pontos marcados nas duas vistas. O zoom e o ajuste
com Shift + setas ajudam a posicionar os pontos. Os campos opcionais de fita
métrica são independentes e a tabela mostra foto menos fita, em centímetros.
Não há validação de precisão clínica nem medição de composição corporal por IA.
Avaliações antigas exibem apenas a cintura, sem preencher outras medidas.
Backups novos usam versão 2 para evitar perda silenciosa ao importar em versões
antigas do aplicativo; esta versão também aceita backups de versão 1.
