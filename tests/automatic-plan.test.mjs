import test from 'node:test';
import assert from 'node:assert/strict';
import {planSchema} from '../pwa/schemas.ts';
const api=await import('../pwa/automatic-plan.ts');
const options={meals:6,pattern:'mixed',targetKcal:2000,excluded:[],excludedFoods:[],reviewed:true,variant:0};
// The test fails if kcal/macros use the wrong preparation or portion scale.
test('calcula composição pelas quantidades em gramas, usando alimentos preparados',()=>{
 assert.equal(typeof api.portionNutrition,'function');
 assert.deepEqual(api.portionNutrition([{foodId:'rice',grams:100},{foodId:'chicken',grams:100}]),{kcal:287,protein:34.5,carbs:28.1,fat:2.7,fiber:1.6});
});
// No editor values, browser model or external service is needed.
test('gera refeições preenchidas e um plano que o servidor aceita',()=>{
 assert.equal(typeof api.createAutomaticPlan,'function');
 for(const meals of [3,6]){
  const r=api.createAutomaticPlan({...options,meals});
  assert.equal(r.plan.meals.length,meals);
  assert.ok(r.plan.meals.every(m=>m.foods.includes(' g')&&!m.foods.includes('[preencher]')));
  assert.ok(Math.abs(r.totals.kcal-2000)<=100);
  assert.ok(planSchema.safeParse({...r.plan,patientId:1}).success);
 }
});
// Removing the allergy filter from any selection, including substitutions, must fail.
test('exclui alérgenos e alimentos selecionados também das substituições',()=>{
 assert.equal(typeof api.createAutomaticPlan,'function');
 const r=api.createAutomaticPlan({...options,excluded:['milk','eggs','gluten'],excludedFoods:['banana']});
 for(const m of r.meals){
  for(const p of [...m.portions,...m.substitutions]){
   const food=api.FOODS.find(f=>f.id===p.foodId);
   assert.ok(!food.tags.some(t=>['milk','eggs','gluten'].includes(t)));
   assert.notEqual(p.foodId,'banana');
  }
 }
});
// Must stop on insufficient choices rather than substitute a excluded food.
test('bloqueia meta inválida, restrições sem revisão e grupos sem escolhas',()=>{
 assert.equal(typeof api.createAutomaticPlan,'function');
 for(const targetKcal of [0,NaN,Infinity,-500,10000])assert.throws(()=>api.createAutomaticPlan({...options,targetKcal}));
 assert.throws(()=>api.createAutomaticPlan({...options,reviewed:false}),/Revise/);
 assert.throws(()=>api.createAutomaticPlan({...options,excludedFoods:api.FOODS.filter(f=>f.group==='fruit').map(f=>f.id)}),/frutas/);
});
// A clinical record is shown for review, never treated as automatically understood.
test('lê restrições da ficha sem supor que um campo vazio significa ausência',()=>{
 assert.equal(typeof api.plannerProfile,'function');
 const p=api.plannerProfile(JSON.stringify({objetivo:'Manutenção',ficha:{allergies:'Leite e ovo',restrictions:'Sem glúten',diagnoses:'Diabetes'},medidas:[]}));
 assert.ok(p.suggestedTags.includes('milk'));assert.ok(p.suggestedTags.includes('eggs'));assert.ok(p.suggestedTags.includes('gluten'));
 assert.equal(p.allergies,'Leite e ovo');assert.equal(p.diagnoses,'Diabetes');
 assert.equal(api.plannerProfile('{}').allergies,'Não informado');
});
// A changed reference target changes portions, without recomputing a patient's energy needs.
test('varia o cardápio e ajusta porções à meta informada com totais consistentes',()=>{
 assert.equal(typeof api.createAutomaticPlan,'function');
 const a=api.createAutomaticPlan({...options,targetKcal:1800});
 const b=api.createAutomaticPlan({...options,targetKcal:2400,variant:1});
 assert.notDeepEqual(a.plan.meals,b.plan.meals);
 assert.ok(Math.abs(a.totals.kcal-1800)<=100);assert.ok(Math.abs(b.totals.kcal-2400)<=120);
 for(const r of [a,b]){
  const actual=api.portionNutrition(r.meals.flatMap(m=>m.portions));
  assert.deepEqual(r.totals,actual);
 }
 const v=api.createAutomaticPlan({...options,pattern:'vegetarian'});
 assert.ok(v.meals.flatMap(m=>[...m.portions,...m.substitutions]).every(p=>api.FOODS.find(f=>f.id===p.foodId).vegetarian));
});
// Repeating an existing food as a swap could push its combined portion above the limit.
test('não sugere substituir por um alimento já presente na mesma refeição',()=>{
 const r=api.createAutomaticPlan({...options,targetKcal:3200,variant:1});
 for(const meal of r.meals){
  const present=new Set(meal.portions.map(p=>p.foodId));
  for(const swap of meal.substitutions)assert.ok(!present.has(swap.foodId),'Alternativa já presente: '+swap.foodId);
 }
});
