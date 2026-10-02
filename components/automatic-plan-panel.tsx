import {useMemo,useState} from 'react';
import {ALLERGENS,FOODS,TACO_URL,createAutomaticPlan,plannerProfile,type Allergen,type AutomaticDraft} from '../pwa/automatic-plan';
import type {Plan} from '../pwa/free-assistant';
const number=(value:number)=>value.toLocaleString('pt-BR',{maximumFractionDigits:1});

export default function AutomaticPlanPanel({context,onApply}:{context:string;onApply?:(plan:Plan)=>void}){
 const profile=useMemo(()=>plannerProfile(context),[context]);
 return <ProfilePlanner key={JSON.stringify(profile)} profile={profile} onApply={onApply}/>;
}
function ProfilePlanner({profile,onApply}:{profile:ReturnType<typeof plannerProfile>;onApply?:(plan:Plan)=>void}){
 const [count,setCount]=useState<3|6>(6);
 const [pattern,setPattern]=useState<'mixed'|'vegetarian'>('mixed');
 const [target,setTarget]=useState('');
 const [excluded,setExcluded]=useState<Allergen[]>(profile.suggestedTags);
 const [excludedFoods,setExcludedFoods]=useState<string[]>([]);
 const [reviewed,setReviewed]=useState(false);
 const [draft,setDraft]=useState<AutomaticDraft|null>(null);
 const [message,setMessage]=useState('');
 const [variant,setVariant]=useState(0);
 function clearDraft(){setDraft(null);setMessage('');setVariant(0);}
 function generate(next=0){
  try{
   const kcal=target.trim()===''?null:Number(target.replace(',','.'));
   const result=createAutomaticPlan({meals:count,pattern,targetKcal:kcal,excluded,excludedFoods,reviewed,variant:next});
   setDraft(result);setVariant(next);setMessage('Rascunho criado. Revise as refeições antes de levar ao editor.');
  }catch(error){setVariant(next);setMessage(error instanceof Error?error.message:'Não foi possível criar o rascunho.');}
 }
 function toggle(id:Allergen,checked:boolean){setExcluded(v=>checked?[...new Set([...v,id])]:v.filter(x=>x!==id));setReviewed(false);clearDraft();}
 return <div className="automatic-planner">
  <div><span className="eyebrow">REFEIÇÕES, PORÇÕES E SUBSTITUIÇÕES</span><h3>Criar plano do zero</h3><p>Monta um rascunho completo com alimentos do catálogo. Funciona sem API paga e sem carregar a IA.</p></div>
  <div className="planner-profile"><p><strong>Objetivo registrado:</strong> {profile.goal}</p><p><strong>Alergias:</strong> {profile.allergies}</p><p><strong>Restrições:</strong> {profile.restrictions}</p>{profile.diagnoses!=='Não informado'&&<p><strong>Diagnósticos registrados:</strong> {profile.diagnoses}</p>}</div>
  <p>A meta e a adequação clínica são definidas pela Marakesia. O gerador aplica as exclusões marcadas abaixo; não interpreta automaticamente diagnósticos ou textos da ficha.</p>
  <div className="planner-fields">
   <label>Refeições<select value={count} onChange={e=>{setCount(Number(e.target.value) as 3|6);clearDraft();}}><option value="3">3 refeições</option><option value="6">6 refeições</option></select></label>
   <label>Preferência alimentar<select value={pattern} onChange={e=>{setPattern(e.target.value as 'mixed'|'vegetarian');setReviewed(false);clearDraft();}}><option value="mixed">Onívora</option><option value="vegetarian">Vegetariana com ovos e leite</option></select></label>
   <label>Meta energética (kcal/dia, opcional)<input type="number" min={1200} max={3200} step={50} value={target} placeholder="Definida pela profissional" onChange={e=>{setTarget(e.target.value);clearDraft();}}/></label>
  </div>
  <p>{target.trim()?'As porções serão aproximadas à meta escolhida (faixa disponível: 1.200 a 3.200 kcal).':'Sem meta, usa porções de referência; não estima a necessidade calórica do paciente.'}</p>
  <fieldset className="planner-exclusions"><legend>Excluir alérgenos / ingredientes</legend><div className="planner-checks">{ALLERGENS.map(a=><label key={a.id}><input type="checkbox" checked={excluded.includes(a.id)} onChange={e=>toggle(a.id,e.target.checked)}/><span>{a.label}</span></label>)}</div></fieldset>
  <details className="planner-foods"><summary>Excluir outros alimentos ou preferências</summary><div className="planner-checks">{FOODS.map(f=><label key={f.id}><input type="checkbox" checked={excludedFoods.includes(f.id)} onChange={e=>{setExcludedFoods(v=>e.target.checked?[...v,f.id]:v.filter(id=>id!==f.id));setReviewed(false);clearDraft();}}/><span>{f.name}</span></label>)}</div></details>
  <label className="planner-review"><input type="checkbox" checked={reviewed} onChange={e=>{setReviewed(e.target.checked);if(!e.target.checked)setDraft(null);}}/><span>Conferi as alergias e restrições da ficha e marquei todas as exclusões necessárias, inclusive as descritas em texto livre.</span></label>
  <button className="button button-primary" disabled={!reviewed} onClick={()=>generate()}>Criar rascunho automático</button>
  <p role="status">{message}</p>
  {draft&&<div className="planner-result">
   <h4>Rascunho alimentar para revisão</h4>
   <p>{draft.targetKcal===null?'Porções de referência':'Meta escolhida: '+number(draft.targetKcal)+' kcal'} · Estimativa das porções principais:</p>
   <div className="planner-totals"><span><strong>{number(draft.totals.kcal)}</strong> kcal</span><span><strong>{number(draft.totals.protein)} g</strong> proteínas</span><span><strong>{number(draft.totals.carbs)} g</strong> carboidratos</span><span><strong>{number(draft.totals.fat)} g</strong> gorduras</span><span><strong>{number(draft.totals.fiber)} g</strong> fibras</span></div>
   <p>Totais do rascunho acima; não incluem as alternativas nem óleo ou ingredientes adicionais. Substituições têm energia aproximada, com nutrientes diferentes.</p>
   {draft.plan.meals.map((m,i)=><article className="planner-meal" key={i}><h4>{m.time} · {m.label}</h4><p>{m.foods}</p><small>Porções principais: aproximadamente {number(draft.meals[i].totals.kcal)} kcal</small></article>)}
   <div className="assistant-actions"><button className="button button-primary" onClick={()=>{onApply?.(draft.plan);setMessage('Rascunho no editor. Revise, ajuste e clique em Salvar plano alimentar.');}}>Levar rascunho ao editor</button><button className="button button-secondary" onClick={()=>generate(variant+1)}>Gerar outra opção</button></div>
   <p>Levar ao editor substitui as refeições em edição. O plano só será salvo ao clicar em <strong>Salvar plano alimentar</strong>. Depois, use a visão do paciente para imprimir ou salvar como PDF.</p>
  </div>}
  <p className="planner-source">Composição estimada: <a href={TACO_URL} target="_blank" rel="noopener noreferrer">TACO, 4ª edição · NEPA/UNICAMP</a>. Porções em gramas da parte comestível e no preparo indicado. Confira rótulos e contaminação cruzada dos produtos.</p>
 </div>;
}
