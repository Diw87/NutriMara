import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {planTemplate,evolutionSummary,localAIRequest,type Plan} from '../pwa/free-assistant';
import {localAssistant} from '../pwa/local-ai';

export default function FreeAssistant({mode,context,plan,onApply}:{mode:'plan'|'evolution';context:string;plan?:Plan;onApply?:(plan:Plan)=>void}){
 const [open,setOpen]=useState(false);
 const [kind,setKind]=useState('three');
 const [draft,setDraft]=useState<Plan|null>(null);
 const [text,setText]=useState('');
 const [complete,setComplete]=useState(false);
 const [message,setMessage]=useState('');
 const [running,setRunning]=useState(false);
 const operation=useRef<AbortController|null>(null);
 const state=useSyncExternalStore(localAssistant.subscribe,localAssistant.getSnapshot,localAssistant.getSnapshot);
 const planKey=JSON.stringify(plan);
 const evolution=mode==='evolution'?evolutionSummary(context):null;
 const busy=state.phase==='loading'||state.phase==='generating';

 useEffect(()=>{
  setText('');setComplete(false);setMessage('');setRunning(false);
  return()=>{operation.current?.abort();operation.current=null;};
 },[context,planKey]);

 async function generate(){
  try{
   const request=localAIRequest(mode,context,plan);
   const controller=new AbortController();operation.current=controller;
   setRunning(true);setComplete(false);setText('');setMessage('');
   try{
    const answer=await localAssistant.generate(request,controller.signal,value=>{if(!controller.signal.aborted)setText(value);});
    if(!controller.signal.aborted){setText(answer);setComplete(true);}
   }catch(error){if(operation.current===controller){setText('');setMessage(controller.signal.aborted?'Geração interrompida.':error instanceof Error?error.message:'Falha na geração.');}}
   finally{if(operation.current===controller){operation.current=null;setRunning(false);}}
  }catch(error){setMessage(error instanceof Error?error.message:'Não foi possível preparar os dados.');}
 }
 async function copy(){try{await navigator.clipboard.writeText(text);setMessage('Texto copiado.');}catch{setMessage('Selecione o texto do rascunho e copie manualmente.');}}

 return <section className="surface ai-panel">
  <div className="section-heading"><h2>{mode==='plan'?'Assistente alimentar':'Assistente da evolução'}</h2><button className="button button-secondary" onClick={()=>setOpen(!open)}>{open?'Recolher':'Abrir assistente'}</button></div>
  {open&&<>
   {mode==='plan'?<div className="assistant-templates">
    <label>Modelo editável <select value={kind} onChange={e=>{setKind(e.target.value);setDraft(null);}}><option value="three">3 refeições</option><option value="six">6 refeições</option><option value="routine">Organização da rotina</option></select></label>
    <p>Preencha alimentos e porções no editor. O modelo não calcula necessidades nutricionais.</p>
    <button className="button button-secondary" onClick={()=>setDraft(planTemplate(kind))}>Preparar modelo</button>
    {draft&&<div className="ai-draft"><strong>{draft.title}</strong>{draft.meals.map((m,i)=><div key={i}><h4>{m.time} · {m.label}</h4><p>{m.foods}</p></div>)}<button className="button button-secondary" onClick={()=>onApply?.(draft)}>Levar modelo ao editor</button></div>}
   </div>:evolution&&<div className="ai-draft"><strong>Comparação calculada pelo aplicativo</strong><p>{evolution.summary}</p><ul>{evolution.observations.map((o,i)=><li key={i}>{o}</li>)}</ul></div>}
   <div className="assistant-local">
    <h3>IA local gratuita · experimental</h3>
    <p>{mode==='plan'?'Organiza o plano já preenchido abaixo, mantendo alimentos e porções definidos pela profissional.':'Transforma a comparação calculada em um resumo de texto.'} A resposta precisa de revisão da Marakesia.</p>
    <p>Sem API paga. O primeiro carregamento baixa centenas de MB e usa cerca de 2 GB de memória gráfica. Cada máquina precisa de navegador compatível com WebGPU.</p>
    {(state.phase==='idle'||state.phase==='error')&&<button className="button button-primary" onClick={()=>{setMessage('');void localAssistant.load().catch(error=>setMessage(error instanceof Error?error.message:'Falha no carregamento.'));}}>Carregar IA local</button>}
    {state.phase==='loading'&&<progress aria-label="Carregamento da IA local" value={state.progress} max={1}/>}
    <p role="status">{message||state.message}{state.phase==='loading'?` ${Math.round(state.progress*100)}%`:''}</p>
    {(state.phase==='ready'||state.phase==='generating')&&<div className="assistant-actions"><button className="button button-primary" disabled={busy} onClick={()=>void generate()}>{mode==='plan'?'Organizar plano com IA':'Resumir evolução com IA'}</button>{running&&<button className="button button-secondary" onClick={()=>operation.current?.abort()}>Parar geração</button>}</div>}
    {(text||running)&&<div className="ai-draft"><label>Rascunho para revisar<textarea value={text} onChange={e=>setText(e.target.value)} disabled={running} rows={10} maxLength={6000}/></label>{complete&&<div className="assistant-actions"><button className="button button-secondary" disabled={!text.trim()} onClick={()=>void copy()}>Copiar texto</button>{mode==='plan'&&plan&&<button className="button button-secondary" disabled={!text.trim()||text.length>2000} onClick={()=>{onApply?.({...plan,instructions:text});setMessage('Texto colocado nas orientações. Revise e clique em Salvar plano alimentar.');}}>Usar texto nas orientações</button>}</div>}<p>{running?'Aguarde a conclusão.':'Confira números, alimentos e porções antes de usar.'} {mode==='plan'?'As refeições do editor são preservadas. O plano só é salvo pelo botão Salvar plano alimentar.':''}</p>{mode==='plan'&&text.length>2000&&<p>Reduza o rascunho para até 2.000 caracteres para usá-lo nas orientações.</p>}</div>}
   </div>
  </>}
 </section>;
}
