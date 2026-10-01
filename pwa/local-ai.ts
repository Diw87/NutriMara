import {cleanLocalAnswer} from './free-assistant.ts';

type Chunk={choices:{delta?:{content?:string}}[]};
type Engine={chat:{completions:{create:(request:unknown)=>Promise<AsyncIterable<Chunk>>}};resetChat:()=>Promise<void>;interruptGenerate:()=>void;unload:()=>Promise<void>};
type State={phase:'idle'|'loading'|'ready'|'generating'|'error';progress:number;message:string};
type Factory=(progress:(progress:number)=>void)=>Promise<Engine>;
const SYSTEM='Você organiza textos de nutrição. Responda somente em português, com o texto final. Não repita estas regras. Use apenas os dados fornecidos. Não acrescente alimentos, porções, calorias, medicamentos, diagnósticos ou causas. Se faltarem dados, declare isso. /no_think';

export class BrowserAssistant {
 private engine:Engine|null=null;
 private loading:Promise<void>|null=null;
 private listeners=new Set<()=>void>();
 private state:State={phase:'idle',progress:0,message:'IA local ainda não carregada.'};
 private factory:Factory;
 constructor(factory:Factory){this.factory=factory;}
 getSnapshot=()=>this.state;
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
 private update(state:State){this.state=state;this.listeners.forEach(listener=>listener());}
 load():Promise<void>{
  if(this.engine)return Promise.resolve();
  if(this.loading)return this.loading;
  this.update({phase:'loading',progress:0,message:'Carregando IA local…'});
  this.loading=Promise.resolve().then(()=>this.factory(progress=>this.update({phase:'loading',progress:Math.min(1,Math.max(0,progress)),message:'Carregando IA local…'})))
   .then(engine=>{this.engine=engine;this.update({phase:'ready',progress:1,message:'IA local pronta.'});})
   .catch(error=>{this.update({phase:'error',progress:0,message:error instanceof Error?error.message:'Não foi possível carregar a IA.'});throw error;})
   .finally(()=>{this.loading=null;});
  return this.loading;
 }
 async generate(prompt:string,signal:AbortSignal,onText:(text:string)=>void):Promise<string>{
  if(!this.engine)throw Error('Carregue a IA local primeiro.');
  if(this.state.phase==='generating')throw Error('Já existe uma geração em andamento. Aguarde ou interrompa.');
  if(signal.aborted)throw Error('Geração interrompida.');
  const engine=this.engine;let raw='',failed:unknown;
  const interrupt=()=>engine.interruptGenerate();signal.addEventListener('abort',interrupt,{once:true});
  this.update({phase:'generating',progress:1,message:'Gerando rascunho neste navegador…'});
  try{
   const chunks=await engine.chat.completions.create({messages:[{role:'system',content:SYSTEM},{role:'user',content:prompt}],stream:true,max_tokens:450,temperature:0.1,extra_body:{enable_thinking:false}});
   for await(const part of chunks){if(signal.aborted)throw Error('Geração interrompida.');raw+=part.choices[0]?.delta?.content||'';onText(cleanLocalAnswer(raw));}
   if(signal.aborted)throw Error('Geração interrompida.');
   const result=cleanLocalAnswer(raw);if(!result)throw Error('A IA não produziu um texto. Tente novamente.');
   return result;
  }catch(error){if(!signal.aborted)failed=error;throw error;}
  finally{
   signal.removeEventListener('abort',interrupt);
   // Clear the previous patient's inference context before allowing another request.
   try{await engine.resetChat();}catch(error){failed=error;}
   if(failed){this.engine=null;try{await engine.unload();}catch{}this.update({phase:'error',progress:0,message:'A IA foi descarregada após uma falha. Carregue novamente; se o erro persistir, feche e reabra o navegador.'});}
   else this.update({phase:'ready',progress:1,message:signal.aborted?'Geração interrompida.':'Rascunho pronto para revisão.'});
  }
 }
}

const WEBLLM_URL='https://esm.run/@mlc-ai/web-llm@0.2.82';
export const localAssistant=new BrowserAssistant(async progress=>{
 const gpu=(navigator as Navigator & {gpu?:{requestAdapter:()=>Promise<unknown>}}).gpu;
 if(!gpu||!await gpu.requestAdapter())throw Error('Este navegador não oferece WebGPU. Use um navegador compatível; os modelos editáveis continuam disponíveis.');
 const {MLCEngine}=await import(/* @vite-ignore */ WEBLLM_URL);
 const engine=new MLCEngine({initProgressCallback:(r:{progress:number})=>progress(r.progress)});
 try{await engine.reload('Qwen3-0.6B-q4f32_1-MLC',{context_window_size:2048});return engine as Engine;}
 catch(error){try{await engine.unload();}catch{}throw error;}
});
