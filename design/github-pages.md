# NutriMara no GitHub Pages

Objetivo: abrir o consultório por um link do GitHub e instalar pelo navegador, mantendo a logo, cores e ferramentas atuais.

A edição instalável usa React e Vite, com caminhos relativos ao projeto `/NutriMara/`. O banco local usa IndexedDB; pacientes e fotos nunca são incluídos na publicação. O aplicativo mostra que os dados pertencem ao dispositivo e permite exportar/importar um arquivo de backup. Importações acrescentam registros, remapeiam vínculos e rejeitam arquivos inválidos antes de gravar. A mesma cópia não é importada duas vezes.

Um manifesto com ícones PNG e um service worker permitem instalação e abertura sem internet após o primeiro acesso completo. O cache contém somente arquivos estáticos desta aplicação e nunca altera caches de outros projetos GitHub Pages. Atualizações entram após fechar as janelas antigas, evitando misturar versões.

O código servidor existente continua disponível: a interface recebe um cliente de dados, usando o servidor por padrão e o banco local apenas na edição Pages. Não há sincronização automática entre dispositivos nem migração automática dos registros da versão hospedada.

Entrega: arquivos públicos gerados em `docs/`, fonte em `pwa/`, documentação de ativação em `README.md`. Pages deve publicar `main`, pasta `/docs`. O repositório está privado e Pages desativado; sua visibilidade não será alterada automaticamente. A ativação depende dos recursos disponíveis na conta GitHub.

Validação: testes de persistência, vínculos, fotos, importação atômica e duplicada; testes existentes da estimativa; TypeScript; compilação; inspeção do aplicativo e instalação onde houver acesso a navegador.
