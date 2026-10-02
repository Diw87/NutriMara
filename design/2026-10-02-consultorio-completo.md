# NutriMara — reconstrução do consultório

## Objetivo e referência
Reconstruir o NutriMara com base na organização das capturas do WebDiet enviadas em 02/10/2026. Dill escolheu todos os módulos para a primeira versão. A identidade é da Nutricionista Marakesia Nascimento, CRN 11-6356: logo oficial, verde e turquesa, superfícies claras e cabeçalho discreto.

## Estrutura da interface
Painel inicial com pacientes recentes, agenda e contadores reais. Lista de pacientes com busca por nome, apelido, telefone, CPF e tags, filtros disponíveis e ordenação. Ao abrir um paciente, mostrar identificação fixa, perfil básico, atalhos de consulta e menu lateral. No celular, a navegação do paciente vira um seletor acessível.

Menu completo: perfil; fármaco-nutrientes; acompanhamento; avaliação integrada; histórico de consultas; anamnese; questionários; exames; evolução fotográfica; antropometria; gestação; cálculo energético; planejamento alimentar; suplementos; metas; manipulados; orientações; arquivos; prontuário; documentos; recibos e financeiro. Cada item abre um fluxo funcional, com estado vazio, preenchimento, salvamento e histórico quando aplicável.

Agenda com mês, semana e lista. Os horários já armazenados mantêm seu significado local. A lista continua permitindo concluir e cancelar consultas. A consulta registrada no prontuário é um documento separado do agendamento.

## Dados e compatibilidade
Reutilizar a conta compartilhada e o Supabase existente. Preservar todos os cadastros, fichas, planos e fotos. Acrescentar dados opcionais ao paciente (apelido, e-mail, CPF, gênero, condição biológica e tags) sem exigir atualização dos cadastros antigos.

Os módulos complementares usam a coleção clinicalEntries em nutri_records. Um registro contém patientId, module, title, recordedOn, status, fields, createdAt e updatedAt. Identificador e versão seguem o mecanismo atual. Formulários oferecem campos específicos para cada módulo; valores livres são anotações da profissional. Arquivamento é reversível. Atualização exige o mesmo paciente e módulo do registro original e a versão conhecida.

Arquivos PDF, PNG e JPEG ficam num bucket privado separado, com limite de 10 MiB por arquivo. A função valida assinatura de arquivo e tipo, cria uma chave aleatória e devolve links temporários apenas após autorização. Backup versão 3 inclui novos módulos e anexos; versões 1 e 2 continuam aceitas com as novas coleções vazias. Importação remapeia vínculos e bloqueia lotes repetidos.

## Funções nutricionais
Manter o editor de plano, rascunhos por catálogo TACO, exclusões e revisão profissional. O rascunho não é uma prescrição clínica autônoma. Manter o organizador local opcional e o resumo da evolução calculada. Medidas obtidas por marcação de fotos continuam identificadas como estimativas geométricas.

O cálculo energético usa Mifflin–St Jeor para adultos de 19 a 78 anos, conforme a população do artigo original de 1990 (PubMed 2305711). Fórmula masculina: 10 × peso + 6,25 × altura − 5 × idade + 5; feminina: mesmo cálculo − 161. O multiplicador e a meta são informados pela profissional. Fora dessa faixa, gestação e lactação usam registro manual, sem cálculo automático. Nenhum déficit ou diagnóstico é inferido.

Fármaco-nutrientes, exames, suplementos, manipulados e gestação registram avaliação e conduta profissional. Não há base validada para gerar interações, doses ou diagnósticos automaticamente. Documentos e PDFs preservam o conteúdo informado, com revisão antes da emissão. Não criar links públicos de prontuário ou acesso do paciente nesta reconstrução; os acessos continuam de Dill e Marakesia.

## Contratos entre frentes
pwa/consultorio-types.ts define ENTRY_MODULES, EntryModule, ClinicalEntry e EntryInput. ClinicalEntryPanel recebe client, patient, module, entries e onSaved; persistência usa action saveClinicalEntry com id opcional. O cliente oferece /api/attachments para upload multipart e /api/attachments/url?id=ID para link temporário. A interface recebe clinicalEntries no workspace. Campos financeiros: amount, direction (Receita/Despesa), paymentStatus (Pendente/Pago), paymentMethod e description. Campos energéticos: weightKg, heightCm, age, sex (Masculino/Feminino), multiplier, targetKcal e notes.

## Critérios de conclusão
Todos os itens do menu abrem formulários ou dados reais e permanecem vinculados ao paciente. Salvar falha de forma visível quando offline. Trocar paciente descarta o rascunho do paciente anterior. Arquivar e restaurar preservam dados. Backups incluem anexos e novos registros, sem perda de versões anteriores. Tabelas e buckets permanecem privados. Verificar schemas, mutações, limites, vínculo, importação, cálculos, tipos e compilação; revisão independente antes de publicar fonte e docs no GitHub.
