import type {Plan} from './free-assistant.ts';

export type Allergen='milk'|'eggs'|'gluten'|'soy'|'nuts'|'peanuts'|'fish'|'shellfish';
export type Nutrition={kcal:number;protein:number;carbs:number;fat:number;fiber:number};
export type Food={id:string;name:string;taco:number;group:'starch'|'legume'|'protein'|'fruit'|'vegetable'|'fat';tags:Allergen[];vegetarian:boolean;per100:Nutrition;maxGrams:number};
export const TACO_URL='https://nepa.unicamp.br/wp-content/uploads/sites/27/2023/10/taco_4_edicao_ampliada_e_revisada.pdf';
export const ALLERGENS:{id:Allergen;label:string}[]=[{id:'milk',label:'Leite e derivados / lactose'},{id:'eggs',label:'Ovos'},{id:'gluten',label:'Glúten / trigo / aveia comum'},{id:'soy',label:'Soja'},{id:'nuts',label:'Castanhas'},{id:'peanuts',label:'Amendoim'},{id:'fish',label:'Peixes'},{id:'shellfish',label:'Crustáceos e moluscos'}];
const food=(id:string,name:string,taco:number,group:Food['group'],kcal:number,protein:number,carbs:number,fat:number,fiber:number,tags:Allergen[]=[],vegetarian=true,maxGrams=400):Food=>({id,name,taco,group,tags,vegetarian,maxGrams,per100:{kcal,protein,carbs,fat,fiber}});
// TACO 4ª edição, NEPA/UNICAMP, 2011: valores por 100 g de parte comestível.
// Tr (traços) e NA de fibras dos alimentos animais/óleo são aproximados como zero.
// Pão/aveia têm marcação conservadora; rótulos e contaminação cruzada exigem revisão.
export const FOODS:Food[]=[
 food('rice','Arroz branco cozido',3,'starch',128,2.5,28.1,.2,1.6),
 food('brownRice','Arroz integral cozido',1,'starch',124,2.6,25.8,1,2.7),
 food('oats','Aveia em flocos (peso seco)',7,'starch',394,13.9,66.6,8.5,9.1,['gluten'],true,100),
 food('bread','Pão integral de trigo',52,'starch',253,9.4,49.9,3.7,6.9,['gluten','milk','eggs','soy'],true,180),
 food('sweetPotato','Batata-doce cozida',88,'starch',77,.6,18.4,.1,2.2),
 food('potato','Batata inglesa cozida',91,'starch',52,1.2,11.9,0,1.3),
 food('beans','Feijão carioca cozido',561,'legume',76,4.8,13.6,.5,8.5),
 food('lentils','Lentilha cozida',577,'legume',93,6.3,16.3,.5,7.9),
 food('chicken','Peito de frango sem pele grelhado',410,'protein',159,32,0,2.5,0,[],false,250),
 food('egg','Ovo de galinha cozido',488,'protein',146,13.3,.6,9.5,0,['eggs'],true,200),
 food('yogurt','Iogurte natural sem açúcar',448,'protein',51,4.1,1.9,3,0,['milk']),
 food('ricotta','Ricota',469,'protein',140,12.6,3.8,8.1,0,['milk'],true,150),
 food('banana','Banana-prata sem casca',182,'fruit',98,1.3,26,.1,2),
 food('apple','Maçã Fuji com casca',222,'fruit',56,.3,15.2,0,1.3),
 food('papaya','Mamão Formosa sem casca e sementes',225,'fruit',45,.8,11.6,.1,1.8),
 food('broccoli','Brócolis cozido',100,'vegetable',25,2.1,4.4,.5,3.4),
 food('carrot','Cenoura cozida',109,'vegetable',30,.8,6.7,.2,2.6),
 food('zucchini','Abobrinha italiana cozida',70,'vegetable',15,1.1,3,.2,1.6),
 food('oliveOil','Azeite de oliva extra virgem',260,'fat',884,0,0,100,0,[],true,20),
 food('avocado','Abacate sem casca e caroço',163,'fat',96,1.2,6,8.4,6.3,[],true,160),
];
export type Portion={foodId:string;grams:number};
export type Substitution=Portion & {replaces:string};
export type DraftMeal={time:string;label:string;portions:Portion[];substitutions:Substitution[];totals:Nutrition};
export type AutomaticDraft={plan:Plan;meals:DraftMeal[];totals:Nutrition;targetKcal:number|null};
export type DraftOptions={meals:3|6;pattern:'mixed'|'vegetarian';targetKcal:number|null;excluded:Allergen[];excludedFoods:string[];reviewed:boolean;variant:number};
const byId=(id:string)=>{const f=FOODS.find(f=>f.id===id);if(!f)throw Error('Alimento desconhecido.');return f;};
const round=(n:number)=>Math.round((n+Number.EPSILON)*10)/10;
export function portionNutrition(portions:Portion[]):Nutrition {
 const totals:Nutrition={kcal:0,protein:0,carbs:0,fat:0,fiber:0};
 for(const p of portions){if(!Number.isFinite(p.grams)||p.grams<=0)throw Error('Quantidade inválida.');const f=byId(p.foodId);for(const key of Object.keys(totals) as (keyof Nutrition)[])totals[key]+=f.per100[key]*p.grams/100;}
 for(const key of Object.keys(totals) as (keyof Nutrition)[])totals[key]=round(totals[key]);
 return totals;
}
function quantity(id:string,grams:number){const f=byId(id),step=id==='oliveOil'?1:5;return Math.max(step,Math.min(f.maxGrams,Math.round(grams/step)*step));}
const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function plannerProfile(context:string){
 const data=JSON.parse(context);const ficha=data.ficha??{};
 const value=(key:string)=>typeof ficha[key]==='string'&&ficha[key].trim()?ficha[key].trim():'Não informado';
 const allergies=value('allergies'),restrictions=value('restrictions');const raw=normalize(allergies+' '+restrictions);
 const rules:[Allergen,RegExp][]=[['milk',/leite|lactose|lacteo/],['eggs',/\bovos?\b/],['gluten',/gluten|trigo|celiac|aveia/],['soy',/soja/],['nuts',/castanh|nozes|amendoa/],['peanuts',/amendoim/],['fish',/peixe/],['shellfish',/camarao|crustace|molusco|frutos do mar/]];
 return {goal:typeof data.objetivo==='string'?data.objetivo:'Não informado',allergies,restrictions,diagnoses:value('diagnoses'),suggestedTags:rules.filter(([,rule])=>rule.test(raw)).map(([id])=>id)};
}

type Role={choices:[string,number][];label:string};
const role=(choices:[string,number][],label:string):Role=>({choices,label});
const fruit=role([['banana',120],['apple',180],['papaya',220]],'frutas');
const starch=role([['rice',150],['brownRice',160],['sweetPotato',250],['potato',300]],'cereais ou tubérculos');
const legume=role([['beans',100],['lentils',100]],'leguminosas');
const protein=role([['chicken',120],['egg',150],['lentils',220]],'fontes proteicas');
const breakfastProtein=role([['egg',100],['ricotta',80],['yogurt',200],['lentils',180]],'fontes proteicas');
const vegetable=role([['broccoli',120],['carrot',120],['zucchini',180]],'hortaliças');
const fat=role([['oliveOil',8],['avocado',80]],'fontes de gordura');
const breakfastStarch=role([['bread',60],['oats',40],['sweetPotato',200],['rice',150]],'cereais ou tubérculos');
const snackProtein=role([['yogurt',170],['ricotta',60],['egg',50],['lentils',80]],'fontes proteicas');

export function createAutomaticPlan(options:DraftOptions):AutomaticDraft {
 if(!options.reviewed)throw Error('Revise as alergias, restrições e exclusões antes de gerar.');
 if(![3,6].includes(options.meals)||!['mixed','vegetarian'].includes(options.pattern)||!Number.isInteger(options.variant)||options.variant<0)throw Error('Opções do rascunho inválidas.');
 if(options.targetKcal!==null&&(!Number.isFinite(options.targetKcal)||options.targetKcal<1200||options.targetKcal>3200))throw Error('A meta desta ferramenta deve estar entre 1.200 e 3.200 kcal, definida pela profissional.');
 if(options.excluded.some(id=>!ALLERGENS.some(a=>a.id===id))||options.excludedFoods.some(id=>!FOODS.some(f=>f.id===id)))throw Error('Exclusão desconhecida.');
 const allowed=(f:Food)=>!f.tags.some(t=>options.excluded.includes(t))&&!options.excludedFoods.includes(f.id)&&(options.pattern!=='vegetarian'||f.vegetarian);
 const pick=(r:Role,index:number):Portion=>{const candidates=r.choices.filter(([id])=>allowed(byId(id)));if(!candidates.length)throw Error('Não há escolhas disponíveis para '+r.label+'. Revise as exclusões ou monte o plano manualmente.');const [foodId,grams]=candidates[index%candidates.length];return {foodId,grams};};
 const slots=options.meals===6?[
  {time:'07:00',label:'Café da manhã',share:.22,roles:[breakfastStarch,breakfastProtein,fruit]},
  {time:'10:00',label:'Lanche da manhã',share:.08,roles:[fruit]},
  {time:'12:00',label:'Almoço',share:.30,roles:[starch,legume,protein,vegetable,fat]},
  {time:'15:00',label:'Lanche da tarde',share:.12,roles:[fruit,snackProtein]},
  {time:'19:00',label:'Jantar',share:.24,roles:[starch,legume,protein,vegetable,fat]},
  {time:'21:00',label:'Ceia',share:.04,roles:[fruit]},
 ]:[
  {time:'07:00',label:'Café da manhã',share:.27,roles:[breakfastStarch,breakfastProtein,fruit]},
  {time:'12:00',label:'Almoço',share:.40,roles:[starch,legume,protein,vegetable,fat]},
  {time:'19:00',label:'Jantar',share:.33,roles:[starch,legume,protein,vegetable,fat]},
 ];
 const meals:DraftMeal[]=slots.map((slot,index)=>{
  const merged=new Map<string,number>();
  // Rotate between cardápios; avoid duplicate items if a legume fills two roles.
  const selected=slot.roles.map((r,i)=>pick(r,options.variant+index+i));
  for(const p of selected)merged.set(p.foodId,(merged.get(p.foodId)??0)+p.grams);
  let portions=[...merged].map(([foodId,grams])=>({foodId,grams:quantity(foodId,grams)}));
  if(options.targetKcal!==null){
   const target=options.targetKcal*slot.share;
   const scale=target/portionNutrition(portions).kcal;
   portions=portions.map(p=>({...p,grams:quantity(p.foodId,p.grams*scale)}));
   // Correct rounding/bounds using small changes; never silently claim the target was met.
   for(let attempt=0;attempt<300;attempt++){
    const current=portionNutrition(portions).kcal,error=target-current;if(Math.abs(error)<5)break;
    let best:Portion[]|null=null,bestError=Math.abs(error);
    for(let i=0;i<portions.length;i++){
     const p=portions[i],step=p.foodId==='oliveOil'?1:5;
     const grams=quantity(p.foodId,p.grams+(error>0?step:-step));if(grams===p.grams)continue;
     const candidate=portions.map((v,j)=>j===i?{...v,grams}:v);const delta=Math.abs(target-portionNutrition(candidate).kcal);
     if(delta<bestError){best=candidate;bestError=delta;}
    }
    if(!best)break;portions=best;
   }
  }
  const substitutions:Substitution[]=[];
  // Energy is an approximate matching aid, never a claim of identical nutrients.
  for(const p of portions.filter(p=>['starch','fruit','legume'].includes(byId(p.foodId).group)).slice(0,2)){
   const f=byId(p.foodId);const candidates=FOODS.filter(other=>other.id!==f.id&&!portions.some(p=>p.foodId===other.id)&&other.group===f.group&&allowed(other));if(!candidates.length)continue;
   const other=candidates[(options.variant+index)%candidates.length];
   const grams=quantity(other.id,f.per100.kcal*p.grams/other.per100.kcal);
   const energyDiff=Math.abs(other.per100.kcal*grams/100-f.per100.kcal*p.grams/100);
   if(energyDiff<=Math.max(10,.1*f.per100.kcal*p.grams/100))substitutions.push({foodId:other.id,grams,replaces:f.id});
  }
  return {time:slot.time,label:slot.label,portions,substitutions,totals:portionNutrition(portions)};
 });
 const totals=portionNutrition(meals.flatMap(m=>m.portions));
 if(options.targetKcal!==null&&Math.abs(totals.kcal-options.targetKcal)>Math.max(60,options.targetKcal*.05))throw Error('As escolhas e limites de porção não permitiram aproximar a meta. Altere as opções ou monte o plano manualmente.');
 const portionText=(p:Portion)=>`${byId(p.foodId).name}: ${p.grams} g`;
 const plan:Plan={title:'Plano alimentar · rascunho',instructions:'Rascunho para revisão da nutricionista. Porções em gramas de parte comestível, no preparo indicado; pesar depois do preparo quando constar cozido ou grelhado. Não adicionar óleo além da porção indicada. Substituições são sugestões por energia aproximada e não equivalem em todos os nutrientes. Verificar alergias, ingredientes dos produtos, preferências e adequação clínica antes de usar. Fonte de composição: TACO, 4ª edição, NEPA/UNICAMP (2011).',meals:meals.map(m=>({time:m.time,label:m.label,foods:m.portions.map(portionText).join('\n')+(m.substitutions.length?'\n\nSubstituições sugeridas (escolher uma troca):\n'+m.substitutions.map(s=>`Em vez de ${byId(s.replaces).name.toLocaleLowerCase('pt-BR')}, usar ${portionText(s)}.`).join('\n'):'')}))};
 return {plan,meals,totals,targetKcal:options.targetKcal};
}
