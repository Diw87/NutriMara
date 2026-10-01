export type Plan={title:string;instructions:string;meals:{time:string;label:string;foods:string}[]};
export function planTemplate(kind:string):Plan {
 const three=[['07:00','Café da manhã'],['12:00','Almoço'],['19:00','Jantar']];
 const six=[three[0],['10:00','Lanche da manhã'],three[1],['15:00','Lanche da tarde'],three[2],['21:00','Ceia']];
 const slots=kind==='six'?six:three;
 return {title:kind==='six'?'Modelo de 6 refeições':kind==='routine'?'Organização da rotina alimentar':'Modelo de 3 refeições',instructions:'Modelo para preenchimento profissional. Defina alimentos, porções, substituições e orientações considerando avaliação, preferências, alergias e restrições do paciente.',meals:slots.map(([time,label])=>({time,label,foods:'Alimentos: [preencher]\nQuantidade / porção: [preencher]\nSubstituição e quantidade equivalente: [preencher]'}))};
}
export function evolutionSummary(context:string):{summary:string;observations:string[]} {
 const data=JSON.parse(context);
 const rows=Array.isArray(data.medidas)?data.medidas.filter((r:any)=>typeof r.data==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(r.data)).sort((a:any,b:any)=>a.data.localeCompare(b.data)):[];
 const observations:string[]=[];
 for(const [field,label,unit] of [['pesoKg','Peso','kg'],['cinturaFitaCm','Cintura medida com fita','cm']]){
  const values=rows.filter((r:any)=>typeof r[field]==='number'&&Number.isFinite(r[field])&&r[field]>0);
  if(values.length<2){observations.push(`${label}: registre pelo menos duas medidas para comparar.`);continue;}
  const first=values[0],last=values.at(-1),delta=Number((last[field]-first[field]).toFixed(2));
  if(first.data===last.data){observations.push(`${label}: as medidas estão na mesma data; registre datas diferentes para comparar.`);continue;}
  const pct=Number((delta/first[field]*100).toFixed(2));
  observations.push(`${label}: ${first[field]} ${unit} (${first.data}) → ${last[field]} ${unit} (${last.data}). Variação: ${delta>0?'+':''}${delta} ${unit} (${pct>0?'+':''}${pct}%).`);
 }
 observations.push('Estimativas por fotos não entram na comparação com medidas feitas por fita.');
 return {summary:'Resumo calculado a partir dos registros. As diferenças não indicam, por si só, melhora clínica ou causa da mudança.',observations};
}

export function cleanLocalAnswer(text:string):string {
 return text.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi,'')
  .replace(/<\/?think>/gi,'').replace(/<\/?(?:t(?:h(?:i(?:n(?:k)?)?)?)?)?$/i,'').trim();
}
export function localAIRequest(mode:'plan'|'evolution',context:string,plan?:Plan):string {
 let request:string;
 if(mode==='plan'){
  if(!plan?.meals.some(meal=>meal.foods.trim()&&!meal.foods.includes('[preencher]')))throw new Error('Preencha primeiro os alimentos e as quantidades no editor.');
  const data={titulo:plan.title,refeicoes:plan.meals.map(m=>({horario:m.time,refeicao:m.label,alimentos:m.foods})),orientacoes:plan.instructions};
  request='Organize o plano abaixo em português, com um título por refeição. Preserve todos os alimentos, porções, horários e orientações. Apresente somente o texto final, sem comentários sobre a tarefa. Dados do plano:\n'+JSON.stringify(data);
 }else{
  const data=evolutionSummary(context);
  request='Escreva um resumo curto em português das medidas abaixo. Os cálculos já estão prontos. Preserve números e datas. Apresente somente o resumo, sem copiar instruções e sem inferir causas ou diagnósticos. Dados calculados:\n'+[data.summary,...data.observations].join('\n');
 }
 if(request.length>4200)throw new Error('O plano está muito longo para esta IA pequena. Reduza o texto antes de tentar; nenhum dado foi cortado.');
 return request+' /no_think';
}
