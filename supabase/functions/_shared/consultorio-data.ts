import type {ClinicalEntry} from './consultorio-types.ts';

export const ENERGY_SOURCE='https://pubmed.ncbi.nlm.nih.gov/2305711/';
export type EnergyInput={weightKg:number;heightCm:number;age:number;sex:'Masculino'|'Feminino';multiplier:number;condition?:string};
export function calculateEnergy(input:EnergyInput):{restingKcal:number;totalKcal:number}{
 const {weightKg,heightCm,age,sex,multiplier,condition='Normal'}=input;
 if(![weightKg,heightCm,age,multiplier].every(Number.isFinite))throw Error('Preencha peso, altura, idade e multiplicador válidos.');
 if(!Number.isInteger(age)||age<19||age>78)throw Error('A referência automática desta ferramenta é para adultos de 19 a 78 anos. Registre a avaliação manualmente para outras idades.');
 if(condition!=='Normal')throw Error('Gestação, lactação e outras condições exigem avaliação energética manual da profissional.');
 if(weightKg<30||weightKg>300||heightCm<120||heightCm>230)throw Error('Os valores estão fora dos limites deste calculador. Use avaliação manual.');
 if(multiplier<1||multiplier>2.5)throw Error('Informe o multiplicador definido pela profissional, entre 1 e 2,5.');
 if(sex!=='Masculino'&&sex!=='Feminino')throw Error('Escolha o coeficiente da fórmula ou registre a avaliação manualmente.');
 const resting=10*weightKg+6.25*heightCm-5*age+(sex==='Masculino'?5:-161);
 const round=(n:number)=>Math.round(n*10)/10;
 return {restingKcal:round(resting),totalKcal:round(resting*multiplier)};
}

export function moneyToCents(value:string):number{
 if(typeof value!=='string')throw Error('Informe um valor monetário válido.');
 const raw=value.trim().replace(/^R\$\s*/, '');
 let normalized:string;
 if(raw.includes(',')){
  if(!/^(?:\d+|\d{1,3}(?:\.\d{3})+),\d{1,2}$/.test(raw))throw Error('Use até duas casas decimais, por exemplo 120,50.');
  normalized=raw.replace(/\./g,'').replace(',','.');
 }else{
  if(!/^\d+(?:\.\d{1,2})?$/.test(raw))throw Error('Use um valor positivo com até duas casas decimais.');
  normalized=raw;
 }
 const [whole,fraction='']=normalized.split('.');
 const cents=Number(whole)*100+Number(fraction.padEnd(2,'0'));
 if(!Number.isSafeInteger(cents)||cents<=0||cents>10000000000)throw Error('Informe um valor positivo até R$ 100.000.000,00.');
 return cents;
}

export function financeTotals(entries:ClinicalEntry[]):{incomePaid:number;expensePaid:number;pendingIncome:number;balance:number}{
 let incomePaid=0,expensePaid=0,pendingIncome=0;
 for(const entry of entries.filter(e=>e.module==='finance'&&e.status==='Finalizado')){
  const {amount,direction,paymentStatus}=entry.fields;
  const cents=moneyToCents(amount);
  if(!['Receita','Despesa'].includes(direction)||!['Pendente','Pago'].includes(paymentStatus))throw Error('Revise o tipo e a situação do registro financeiro.');
  if(paymentStatus==='Pago'){if(direction==='Receita')incomePaid+=cents;else expensePaid+=cents;}
  else if(direction==='Receita')pendingIncome+=cents;
 }
 if(![incomePaid,expensePaid,pendingIncome].every(Number.isSafeInteger))throw Error('O total excedeu o limite de cálculo financeiro.');
 return {incomePaid,expensePaid,pendingIncome,balance:incomePaid-expensePaid};
}
