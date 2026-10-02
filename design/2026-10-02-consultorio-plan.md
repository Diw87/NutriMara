# Consultório completo — plano de implementação

> Para execução: usar superpowers:executing-plans e superpowers:dispatching-parallel-agents para frentes com arquivos separados.

**Objetivo:** reconstruir o consultório com todos os módulos de paciente das referências, preservando dados online.
**Arquitetura:** React e TypeScript reutilizam ClinicClient. Dados adicionais são documentos versionados na coleção clinicalEntries; anexos ficam privados. Interface, formulários e persistência têm responsáveis e arquivos distintos.
**Stack:** React 19, TypeScript, Zod 3, Vite, Supabase Edge Functions/Postgres/Storage e GitHub Pages.
**Spec:** design/2026-10-02-consultorio-completo.md.

## Restrições globais
- Identidade Marakesia Nascimento, CRN 11-6356, logo oficial verde e turquesa.
- Nenhum paciente existente é removido ou substituído.
- Nenhuma API paga ou novo serviço é necessário.
- Registros continuam privados e exigem internet para salvar.
- Módulos clínicos documentam decisões da profissional; não inventam diagnósticos, doses ou interações.

## Foco de revisão
- Atualizar um documento com outro patientId deve falhar.
- Cliente antigo não deve apagar os campos novos do paciente.
- Importar backup antigo deve resultar em clinicalEntries e attachments vazios.
- Tentar substituir uma versão antiga deve resultar em conflito, preservando a versão online.
- Anexo de tipo ou assinatura incorretos não deve gerar registro nem arquivo persistente.

## Frente 1 — persistência e anexos
Arquivos: pwa/schemas.ts, pwa/cloud-actions.ts, pwa/cloud-client.ts, pwa/recovery.ts, pwa/local-store.ts, supabase/functions/_shared/*, supabase/functions/nutri-clinic/index.ts, supabase/sql/consultorio.sql e testes correspondentes.
Interface produzida: workspace.clinicalEntries; mutation saveClinicalEntry; upload em /api/attachments; URL em /api/attachments/url?id=ID. Entrada multipart: patientId, title, recordedOn, description e file.
- [ ] Testar inclusão, atualização, arquivo, tipo, vínculo entre pacientes, conflitos e compatibilidade de backup.
- [ ] Implementar schemas, mutações e cliente; conservar campos antigos e novos.
- [ ] Implementar upload privado, URL temporária e backup/restauração dos anexos.
- [ ] Preparar expansão aditiva da restrição kind e função nutri_import.
- [ ] Rodar testes específicos antes da integração.

## Frente 2 — painel e navegação
Arquivos: components/clinic-app.tsx, components/consultorio-agenda.tsx e app/consultorio.css.
Consome ClinicalEntryPanel e os tipos comuns. Produz painel de pacientes, perfil e menu completo. Não altera schemas nem serviços.
- [ ] Reorganizar painel, lista, busca e perfil com identificação de paciente visível.
- [ ] Integrar todos os módulos e separar fotos de medidas; preservar editor e anamnese.
- [ ] Reorganizar agenda em mês/semana/lista sem alterar horários armazenados.
- [ ] Adaptar celular, foco, labels e estados vazios.
- [ ] Rodar typecheck e verificar os vínculos de navegação.

## Frente 3 — formulários por módulo
Arquivos: components/clinical-entry-panel.tsx, pwa/consultorio-modules.ts e app/clinical-entry.css.
Assinatura: ClinicalEntryPanel({client,patient,module,entries,onSaved}); patient contém id,name,phone,birthDate; module é EntryModule; entries são ClinicalEntry[].
- [ ] Criar catálogo de campos para todos os módulos complementares.
- [ ] Implementar criar/editar/finalizar/arquivar/restaurar, com histórico por paciente.
- [ ] Integrar upload e abertura de anexos privados.
- [ ] Integrar cálculo energético e resumo financeiro pelas funções da frente 4.
- [ ] Emitir documento imprimível escapando conteúdo, com logo, data, paciente e CRN.
- [ ] Confirmar mensagens de erro e salvamento real, sem formulários fictícios.

## Frente 4 — domínio, integração e publicação
Arquivos: pwa/consultorio-types.ts, pwa/consultorio-data.ts, testes/consultorio-data.test.mjs, README.md e docs/ compilados.
Funções: calculateEnergy({weightKg,heightCm,age,sex,multiplier,condition}) retorna restingKcal,totalKcal; condition é Normal/Gestante/Lactante. moneyToCents(value) valida quantia decimal positiva. financeTotals(entries) retorna valores em centavos separados por receita paga, despesa paga e recebíveis pendentes.
- [ ] Testar fórmula masculina/feminina, faixa etária, gestação, valores inválidos e centavos.
- [ ] Implementar funções puras e aplicar os ajustes da revisão anterior do gerador.
- [ ] Revisar integração, rodar suite completa, typecheck e build:pages.
- [ ] Aplicar expansão aditiva no Supabase e publicar nutri-clinic com JWT e autorização existentes.
- [ ] Confirmar schema e bucket privado, revisar código e publicar fonte e compilação no GitHub.
- [ ] Verificar a versão publicada e informar limitações de verificação visual, se houver.
