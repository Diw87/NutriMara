# NutriMara online — desenho para revisão

## Objetivo aprovado
Uma conta compartilhada por Dill e Marakesia, com sessões simultâneas em computadores diferentes. Ambos acessam o mesmo consultório. Login visível por usuário `dill`; e-mail de recuperação já informado pelo responsável, mantido na configuração privada do servidor. Não haverá acesso para pacientes nem cadastro público na interface.

O aplicativo continua em GitHub Pages, com a identidade visual atual. Supabase fornece autenticação, banco e fotos privadas; funções no servidor conectam a IA. A publicação atual permanece funcionando até os testes da integração.

## Acesso
A conta será criada pelo mecanismo administrativo oficial de Auth. Configuração e recuperação de senha usarão o e-mail autorizado; nenhuma senha ou chave secreta ficará no código público. O nome de usuário será resolvido no servidor, sem expor um diretório de e-mails. A senha definitiva será definida pelo titular no fluxo seguro.

O banco terá uma lista administrativa de usuários permitidos por identificador de Auth. A conta não poderá alterar essa lista. Todas as operações exigirão autenticação e autorização no banco, incluindo fotos e chamadas de IA. Outras contas, mesmo autenticadas, não terão acesso ao consultório.

A sessão compartilhada não permite identificar se uma alteração foi feita por Dill ou Marakesia. Registrar data, versão e conta responsável, sem atribuir autoria individual.

## Dados e sincronização
Preservar pacientes, agenda, medidas, planos alimentares, fichas clínicas e avaliações por fotos. Armazenar registros por entidade, com identificadores estáveis, vínculo ao consultório e versão de atualização. Fotos em armazenamento privado, abertas por autorização temporária.

Salvar no servidor a cada ação explícita de salvar. Mostrar confirmação somente após resposta positiva. Recarregar dados ao voltar à janela e após alterações remotas, sem substituir formulários que tenham alterações não salvas. Ao detectar versão concorrente, pedir revisão antes de sobrescrever.

A primeira versão online exige internet para ler e salvar prontuários. A interface continua instalável. Falhas de rede preservam o formulário na sessão e exibem que o salvamento não ocorreu. Não misturar gravações locais com gravações remotas silenciosamente. Logout remove dados clínicos da interface e revoga URLs temporárias locais; o cache da instalação conterá apenas arquivos públicos do aplicativo.

## Migração dos dados existentes
Os prontuários atuais estão nos navegadores dos usuários, não no repositório. Oferecer, no navegador que contém os dados, exportação e importação para o consultório online. Antes de enviar, exibir contagem de pacientes e fotos e pedir confirmação da transferência.

Importação validada, com identificação de lote e prevenção de repetição. Remapear vínculos de pacientes e fotografias. Preparar upload das fotos antes de confirmar o lote de registros; se houver falha, o lote fica incompleto e recuperável, sem aparecer como importado com sucesso. Manter o original local e o arquivo exportado. Não apagar automaticamente dados antigos nem mesclar pacientes apenas pelo nome.

## Assistente de planos alimentares
Gerar um rascunho com refeições, opções de substituição e orientações a partir de dados selecionados pela profissional. Mostrar os dados que serão enviados à IA. Excluir nome, telefone, fotos e identificadores diretos do pedido quando não forem necessários.

O resultado não altera automaticamente o plano salvo. A profissional revisa, edita e aprova. Informações ausentes devem ser apontadas; não inventar diagnósticos, exames ou medidas. Restrições e alergias informadas devem ser verificadas na revisão. Não produzir prescrição de medicamentos.

## Assistente de evolução
Resumir diferenças entre registros datados e destacar dados ausentes. Cálculos numéricos de variações são feitos pelo aplicativo; a IA explica os resultados. Diferenciar medidas de fita, estimativas geométricas por fotos e valores registrados manualmente. Sem diagnóstico automático ou promessa de precisão clínica das fotos.

## Infraestrutura de IA
Chave da API somente nos segredos do servidor. Endpoint exige sessão autorizada, limita tamanho da entrada, quantidade de pedidos e tempo de execução. Conteúdo clínico não será incluído nos logs de erro. Usar configuração de modelo no servidor e opção de não armazenamento quando suportada. Falta de chave, saldo ou disponibilidade gera mensagem explícita; não simular respostas de IA.

A conta da API e o segredo ainda precisam ser configurados pelo responsável em um canal seguro. O custo informado de US$ 0/mês para o projeto Supabase não cobre a API de IA nem garante gratuidade além dos limites do plano.

## Verificação antes de publicar
- Conta permitida acessa; visitante e segunda conta não autorizada não acessam registros nem fotos.
- Cadastro e alteração feitos em uma sessão aparecem na outra.
- Edição concorrente é detectada, sem sobrescrever silenciosamente.
- Importação com fotos conserva todos os vínculos; repetição não duplica o lote.
- Falha de rede não aparece como salvamento bem-sucedido.
- Backup antigo e versão 2 continuam sendo reconhecidos.
- Assistentes funcionam com credencial no servidor e rejeitam chamadas não autorizadas.
- Rascunhos de IA só viram planos após aprovação explícita na interface.
- PDF, impressão e instalação são conferidos após a integração.

## Entrega
Primeiro concluir e validar autenticação, dados e migração. Depois conectar os dois assistentes e validar com casos fictícios. Publicar no mesmo link do GitHub após os testes, sem enviar pacientes reais como dados de teste. Nenhuma sincronização ou IA deve ser anunciada como ativa antes dessas verificações.
