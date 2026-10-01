import test from 'node:test';
import assert from 'node:assert/strict';
import * as helpers from '../pwa/free-assistant.ts';

// Catch thought leakage while chunks arrive, including unfinished tags.
test('oculta blocos de pensamento completos e parciais sem apagar a resposta', () => {
 assert.equal(typeof helpers.cleanLocalAnswer, 'function');
 for (const [input,want] of [['<think>interno</think>\nResumo: -10 kg.', 'Resumo: -10 kg.'], ['<think>interno', ''], ['Resumo\n<th', 'Resumo'], ['</think>\nCintura: 100 cm.', 'Cintura: 100 cm.'], ['Quantidade < 5 g', 'Quantidade < 5 g']]) {
  assert.equal(helpers.cleanLocalAnswer(input), want);
 }
});
const plan={title:'Plano alimentar',instructions:'Porções definidas pela profissional.',meals:[{time:'07:00',label:'Café',foods:'Banana 80 g e aveia 20 g'}]};
// Catch accidental transmission of a full patient record or use of photo estimates.
test('a solicitação local usa somente o plano ou a evolução calculada', () => {
 assert.equal(typeof helpers.localAIRequest, 'function');
 const context=JSON.stringify({nome:'NOME PRIVADO',ficha:{telefone:'TELEFONE PRIVADO'},medidas:[{data:'2026-10-01',pesoKg:90},{data:'2026-09-01',pesoKg:100}],estimativasPorFotos:[{cinturaEstimadaCm:777}]});
 const p=helpers.localAIRequest('plan',context,plan);
 assert.match(p, /Banana 80 g e aveia 20 g/);
 const e=helpers.localAIRequest('evolution',context);
 assert.match(e, /-10 kg \(-10%\)/);
 for(const r of [p,e]) assert.doesNotMatch(r,/NOME PRIVADO|TELEFONE PRIVADO|777/);
});
// Catch silent truncation that drops portions or restrictions.
test('não gera plano vazio nem corta dados para caber no modelo', () => {
 assert.equal(typeof helpers.localAIRequest, 'function');
 assert.throws(()=>helpers.localAIRequest('plan','{}',{...plan,meals:[{time:'',label:'',foods:''}]}), /Preencha/);
 assert.throws(()=>helpers.localAIRequest('plan','{}',{...plan,instructions:'x'.repeat(5000)}), /longo/);
});

const service=await import('../pwa/local-ai.ts');
// External model execution is substituted; scheduling, cancellation and cleanup are real.
test('compartilha o carregamento e bloqueia gerações simultâneas',async()=>{
 assert.equal(typeof service.BrowserAssistant,'function');
 let loads=0,finish;const waiting=new Promise(resolve=>finish=resolve);
 const engine={chat:{completions:{create:async()=> (async function*(){await waiting;yield {choices:[{delta:{content:'<think>interno</think>Resumo.'}}]};})()}},resetChat:async()=>{},interruptGenerate(){},unload:async()=>{}};
 const ai=new service.BrowserAssistant(async()=>{loads++;return engine;});
 await Promise.all([ai.load(),ai.load()]);assert.equal(loads,1);
 const result=ai.generate('dados',new AbortController().signal,()=>{});
 await assert.rejects(ai.generate('outro',new AbortController().signal,()=>{}),/andamento/);
 finish();assert.equal(await result,'Resumo.');assert.equal(ai.getSnapshot().phase,'ready');
});
test('cancelar não devolve rascunho e limpa o contexto do modelo',async()=>{
 assert.equal(typeof service.BrowserAssistant,'function');
 let release,resets=0,interrupts=0;const pending=new Promise(resolve=>release=resolve);
 const engine={chat:{completions:{create:async()=> (async function*(){await pending;yield {choices:[{delta:{content:'Paciente anterior'}}]};})()}},resetChat:async()=>{resets++;},interruptGenerate(){interrupts++;release();},unload:async()=>{}};
 const ai=new service.BrowserAssistant(async()=>engine);await ai.load();
 const controller=new AbortController();const result=ai.generate('dados',controller.signal,()=>{assert.fail('não deve publicar texto cancelado');});controller.abort();
 await assert.rejects(result,/interrompida/);assert.equal(interrupts,1);assert.equal(resets,1);assert.equal(ai.getSnapshot().phase,'ready');
});
test('erro fatal exige novo carregamento em vez de reutilizar recurso descartado',async()=>{
 assert.equal(typeof service.BrowserAssistant,'function');
 let unloaded=0;
 const engine={chat:{completions:{create:async()=>{throw Error('Object has already been disposed');}}},resetChat:async()=>{},interruptGenerate(){},unload:async()=>{unloaded++;}};
 const ai=new service.BrowserAssistant(async()=>engine);await ai.load();
 await assert.rejects(ai.generate('dados',new AbortController().signal,()=>{}),/disposed/);
 assert.equal(ai.getSnapshot().phase,'error');assert.equal(unloaded,1);
 await assert.rejects(ai.generate('dados',new AbortController().signal,()=>{}),/Carregue/);
});
