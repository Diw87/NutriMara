# NutriMara

Aplicativo da nutricionista **Marakesia Nascimento — CRN 11-6356**, com painel de pacientes, prontuário por paciente, agenda, planos alimentares e documentação do consultório.

## Abrir e instalar

A interface fica em **https://diw87.github.io/NutriMara/**.

Abra esse endereço no Chrome ou Edge e toque em **Instalar aplicativo**. No iPhone/iPad, abra no Safari e use **Compartilhar → Adicionar à Tela de Início**. A instalação mantém um atalho; os registros online exigem internet. O botão mostra instruções quando o navegador não disponibiliza uma instalação direta.

## Ativar a publicação

Os arquivos compilados já estão em `docs/`. Não é necessário configurar GitHub Actions.

1. No repositório, abra **Settings → Pages**.
2. Em **Source**, selecione **Deploy from a branch**.
3. Escolha **main** e a pasta **/docs**; clique em **Save**.
4. Aguarde o GitHub terminar a publicação e use **Visit site**.

O GitHub Free oferece Pages em repositórios públicos. Um repositório privado requer um plano compatível, como GitHub Pro. A visibilidade deste repositório não é alterada pelo aplicativo ou pelos scripts.

## Consultório online

O painel foi reorganizado com base nas referências enviadas do WebDiet, mantendo a identidade da Marakesia. Em **Pacientes**, busque e abra um cadastro para acessar o menu lateral do prontuário. O perfil reúne os dados básicos e os atalhos da consulta. A agenda oferece mês, semana e lista.

O menu inclui perfil, fármaco-nutrientes, acompanhamento, avaliação integrada, histórico de consultas, anamnese, questionários, exames, evolução fotográfica, antropometria, gestação, cálculo energético, planos, suplementos, metas, manipulados, orientações, anexos, notas do prontuário, documentos e financeiro. Nos módulos de documentação, crie um registro, preencha os campos e salve como rascunho ou finalizado. **Arquivar** preserva o registro e permite restauração. Cada registro e arquivo permanece associado ao paciente escolhido.

Documentos e planos salvos possuem **Imprimir / PDF**. Na janela de impressão, selecione **Salvar como PDF** para baixar. A ficha clínica também mantém sua impressão timbrada. A composição visual usa a logo oficial, verde e turquesa.

O cálculo energético estima repouso pela fórmula de Mifflin–St Jeor, com multiplicador informado pela profissional. A faixa automática é 19–78 anos; gestação e lactação usam avaliação manual. O financeiro soma registros finalizados em centavos, separando receitas pagas, despesas pagas e recebimentos pendentes. Os demais módulos clínicos documentam avaliação e conduta profissional.

A interface usa uma conta compartilhada autorizada no servidor. No primeiro acesso, escolha **Configurar senha** e confirme o e-mail. O apelido é resolvido pelo servidor; o endereço privado não faz parte do repositório.

- Cadastros, fichas, medidas, planos e fotos ficam no Supabase; o GitHub publica somente código e recursos visuais.
- As tabelas bloqueiam acesso direto de visitantes e de usuários autenticados. As funções verificam o usuário, a confirmação de e-mail e a autorização da conta antes de acessar dados.
- Fotos usam armazenamento privado e links temporários. Edições com versão desatualizada são recusadas para evitar sobrescrever o trabalho de outro dispositivo.
- A interface verifica atualizações ao retornar à janela e a cada 30 segundos. Após interação com a página, avisa para salvar e atualizar manualmente, preservando formulários.
- **Pacientes → Abrir cadastro → Anamnese geral → Imprimir / PDF** permite imprimir ou escolher **Salvar como PDF** no navegador.
- **Trazer cadastros deste navegador** importa os dados antigos após confirmação, mantendo o original. **Exportar cadastros antigos deste navegador** funciona também antes do login.
- **Exportar cópia** gera backup dos dados online, incluindo fotos, módulos do prontuário e anexos. **Importar cópia** acrescenta registros e bloqueia a repetição do mesmo lote. Cópias diferentes podem conter pacientes em comum. Backup versão 3 preserva os novos módulos; esta edição também aceita versões 1 e 2.
- Anexos PDF, PNG e JPEG de até 10 MiB ficam em armazenamento privado, com abertura por link temporário dentro da conta autorizada.
- É necessária conexão para acessar e salvar registros online. A instalação no dispositivo não muda essa exigência.

## Configuração do servidor

O esquema está em `supabase/sql/online.sql`. O registro autorizado de `nutri_access` deve ser configurado privadamente pelo administrador, nunca por código público. As três funções estão em `supabase/functions/`.

A expansão do consultório está em `supabase/sql/consultorio.sql`. Ela acrescenta os novos registros e o armazenamento privado sem apagar os dados existentes. Fonte e funções compartilhadas devem permanecer sincronizadas ao publicar `nutri-clinic`.

1. Em **Authentication → URL Configuration**, configure Site URL e Redirect URLs para `https://diw87.github.io/NutriMara/`. Mantenha a confirmação de e-mail habilitada. Use SMTP próprio se o serviço de e-mail do projeto exigir.
2. A função `nutri-auth` permite login/cadastro/recuperação por apelido com limites de tentativas. Ela usa `verify_jwt=false`, pois autentica a senha com o serviço Auth. As funções `nutri-clinic` e `nutri-ai` usam `verify_jwt=true` e validam a conta autorizada internamente.
3. A versão gratuita inclui modelos editáveis, resumo aritmético e IA local experimental (Qwen3 0.6B / WebLLM fixado em 0.2.82). Em Planejamento alimentar ou Acompanhamento, abra o assistente e clique em Carregar IA local. O modelo baixa arquivos de CDN/Hugging Face/GitHub e executa a geração no navegador, sem OpenAI, chave ou créditos. Requer WebGPU e cerca de 2 GB de memória gráfica por máquina.
4. Em **Planejamento alimentar → Abrir assistente → Criar plano do zero**, o gerador gratuito monta 3 ou 6 refeições, porções em gramas e substituições a partir de 20 alimentos com composição TACO/UNICAMP. Não precisa de WebGPU ou IA. Escolha preferência, exclusões e, opcionalmente, a meta energética definida pela profissional (1.200–3.200 kcal). Sem meta usa porções de referência; não calcula necessidades individuais. Alergias/restrições da ficha são mostradas para conferência e algumas palavras apenas pré-marcam exclusões, sem interpretação clínica. É obrigatório conferir e marcar exclusões antes de gerar. Cada rascunho exige revisão profissional. **Levar rascunho ao editor** preenche as refeições; **Salvar plano alimentar** salva online. Totais do rascunho são estimativas das porções principais, não incluem substituições e não acompanham edições manuais. Consulte `pwa/food-sources.md` para referência e limites. Os modelos vazios continuam disponíveis. A evolução compara peso e cintura com fita em datas diferentes; estimativas por fotos ficam separadas.
5. A IA organiza somente planos já preenchidos ou resume cálculos prontos; não cria prescrição personalizada. O pedido usa apenas refeições/orientações ou comparação numérica, sem a ficha completa ou fotos. Revise o rascunho; copiar ou colocar o texto nas orientações não salva o plano automaticamente. Trocar paciente/dados interrompe a geração e descarta o rascunho anterior.
6. Fichas, dados online, impressão/PDF e importação continuam disponíveis. GitHub Pages e Supabase ficam sujeitos aos limites de seus planos. O código antigo da função de IA permanece no repositório, sem uso pela interface gratuita.

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
Backups novos usam versão 3 para preservar módulos e anexos; esta edição também
aceita backups de versões 1 e 2.
