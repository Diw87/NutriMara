# NutriMara Online Implementation Plan

> Execução nativa autorizada por Dill. Usar superpowers:executing-plans.

**Goal:** Conta compartilhada com registros online e assistentes clínicos revisáveis.
**Architecture:** Supabase Auth; registros JSON por entidade com versão e RLS; fotos privadas; Edge Functions para autenticação por apelido e IA. Cliente adaptador preserva ClinicClient.
**Tech Stack:** React, TypeScript, Supabase/Postgres, Edge Functions.
**Spec:** design/nutrimara-online.md

## Global Constraints
Manter o GitHub Pages. Conta única. Nenhuma chave secreta no navegador. Não apagar dados locais. Sem diagnóstico automático. Revisar rascunhos antes de salvar.

## Review Focus
- Visitante e outra conta não autorizada: negar registros e fotos.
- Edição simultânea: rejeitar versão antiga com conflito explícito.
- Importação repetida: negar lote já importado.
- Falha de IA: mensagem real, sem resposta simulada.
- Sem internet: manter formulário, não confirmar gravação.

## Tarefas
- [x] Banco: criar membros administrados, registros com versão, funções de mutação e lote, bucket privado; testar RLS como anon e authenticated não autorizado.
- [x] Autenticação: função por apelido com recuperação e cadastro controlados; interface login, confirmação por e-mail, senha e logout. Restringir acesso aos membros permitidos.
- [x] Adaptador: traduzir ações existentes, salvar fotos privadas, backup e transferência de lote com remapeamento. Testar cálculo de ações e conflito.
- [x] Assistentes: chamadas autenticadas, dados selecionados sem identificação direta por padrão, retorno revisável e limites de uso. Implantar com erro explícito enquanto a chave OpenAI não estiver configurada.
- [x] Interface: estado online, atualização manual/ao foco sem apagar rascunhos, dados antigos acessíveis para exportação e transferência confirmada.
- [x] Verificação: testes locais, TypeScript, build, advisors, chamadas não autorizadas; GitHub Pages somente com resultado documentado. Conta e chave definitiva dependem de entrada segura do titular.

## Limites da verificação
Testes locais e bloqueio de chamadas sem sessão verificados. O titular ainda precisa configurar URLs de Auth, definir sua senha e confirmar o e-mail. A chave OpenAI ainda não foi configurada; não houve teste autenticado entre dispositivos nem chamada de IA com credenciais definitivas.
