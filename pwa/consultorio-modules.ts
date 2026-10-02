import {ENTRY_MODULES, type ClinicalEntry, type EntryModule, type EntryStatus} from './consultorio-types.ts';

export type EntryField = {
  key:string;
  label:string;
  kind:'text'|'textarea'|'number'|'date'|'select';
  placeholder?:string;
  options?:readonly string[];
  defaultValue?:string;
  requiredForFinal?:boolean;
  min?:number;
  max?:number;
  step?:string;
  readOnly?:boolean;
  wide?:boolean;
  hint?:string;
};
export type EntryModuleDefinition = {label:string;description:string;newTitle:string;fields:readonly EntryField[]};

export const ENTRY_MODULE_META:Record<EntryModule,EntryModuleDefinition> = {
  pharma:{label:'Fármaco-nutrientes',description:'Documente os medicamentos em uso, a relação nutricional avaliada e a conduta profissional.',newTitle:'Avaliação fármaco-nutrientes',fields:[
    {key:'medication',label:'Nome do medicamento',kind:'text',requiredForFinal:true,wide:true},
    {key:'dose',label:'Dose informada',kind:'text',placeholder:'Conforme prescrição ou relato do paciente'},
    {key:'schedule',label:'Horários de uso',kind:'text'},
    {key:'nutritionalRelation',label:'Relação nutricional avaliada',kind:'textarea'},
    {key:'source',label:'Fonte consultada',kind:'textarea',placeholder:'Referência utilizada para a avaliação'},
    {key:'conduct',label:'Conduta profissional',kind:'textarea',requiredForFinal:true},
  ]},
  assessment:{label:'Avaliação integrada',description:'Reúna os achados da avaliação e as prioridades do acompanhamento nutricional.',newTitle:'Avaliação nutricional integrada',fields:[
    {key:'assessment',label:'Síntese da avaliação',kind:'textarea',requiredForFinal:true},
    {key:'findings',label:'Achados e contexto clínico',kind:'textarea'},
    {key:'priorities',label:'Prioridades do acompanhamento',kind:'textarea'},
    {key:'conduct',label:'Conduta profissional',kind:'textarea'},
    {key:'followUp',label:'Pontos para reavaliação',kind:'textarea'},
  ]},
  consultations:{label:'Histórico de consultas',description:'Registre a consulta realizada, a conduta e a previsão de retorno.',newTitle:'Registro de consulta',fields:[
    {key:'observation',label:'Observações da consulta',kind:'textarea',requiredForFinal:true},
    {key:'conduct',label:'Conduta e acordos',kind:'textarea'},
    {key:'returnOn',label:'Retorno previsto',kind:'date'},
  ]},
  questionnaires:{label:'Questionários',description:'Registre respostas, sintomas e hábitos avaliados na consulta.',newTitle:'Questionário de acompanhamento',fields:[
    {key:'symptoms',label:'Sintomas relatados',kind:'textarea'},
    {key:'habits',label:'Hábitos e rotina',kind:'textarea'},
    {key:'responses',label:'Perguntas e respostas',kind:'textarea',requiredForFinal:true,placeholder:'Informe cada pergunta e a resposta obtida'},
    {key:'notes',label:'Notas da profissional',kind:'textarea'},
  ]},
  labs:{label:'Exames',description:'Registre o resultado e a interpretação profissional, com a referência do laboratório.',newTitle:'Registro de exame',fields:[
    {key:'examName',label:'Nome do exame',kind:'text',requiredForFinal:true},
    {key:'examDate',label:'Data do exame',kind:'date'},
    {key:'result',label:'Resultado',kind:'text',requiredForFinal:true},
    {key:'unit',label:'Unidade',kind:'text',placeholder:'Ex.: mg/dL'},
    {key:'reference',label:'Referência ou faixa do laboratório',kind:'textarea'},
    {key:'professionalInterpretation',label:'Interpretação profissional',kind:'textarea'},
    {key:'conduct',label:'Conduta e acompanhamento',kind:'textarea'},
  ]},
  gestation:{label:'Gestação',description:'Acompanhe a semana gestacional, o peso e a evolução registrada pela profissional.',newTitle:'Acompanhamento gestacional',fields:[
    {key:'weeks',label:'Semana gestacional',kind:'number',min:0,max:45,step:'0.1'},
    {key:'weightKg',label:'Peso (kg)',kind:'number',min:0.1,max:500,step:'0.1'},
    {key:'notes',label:'Evolução e observações',kind:'textarea',requiredForFinal:true},
    {key:'conduct',label:'Conduta profissional',kind:'textarea'},
  ]},
  energy:{label:'Cálculo energético',description:'Calcule Mifflin–St Jeor em adultos de 19 a 78 anos ou registre a avaliação manual.',newTitle:'Avaliação energética',fields:[
    {key:'condition',label:'Condição biológica',kind:'select',options:['Normal','Gestante','Lactante','Outro'],defaultValue:'Normal'},
    {key:'sex',label:'Sexo utilizado na fórmula',kind:'select',options:['Masculino','Feminino']},
    {key:'weightKg',label:'Peso (kg)',kind:'number',min:0.1,max:500,step:'0.1'},
    {key:'heightCm',label:'Altura (cm)',kind:'number',min:30,max:280,step:'0.1'},
    {key:'age',label:'Idade (anos)',kind:'number',min:0,max:130,step:'1'},
    {key:'multiplier',label:'Multiplicador informado',kind:'number',min:0.1,max:10,step:'0.01',hint:'Definido pela profissional conforme a avaliação.'},
    {key:'restingKcal',label:'Gasto energético de repouso (kcal/dia)',kind:'number',readOnly:true},
    {key:'totalKcal',label:'Gasto energético total (kcal/dia)',kind:'number',readOnly:true},
    {key:'targetKcal',label:'Meta energética definida (kcal/dia)',kind:'number',min:1,max:20000,step:'1'},
    {key:'notes',label:'Avaliação e justificativa profissional',kind:'textarea'},
  ]},
  supplements:{label:'Suplementos',description:'Documente o produto, a posologia informada e a justificativa profissional.',newTitle:'Registro de suplemento',fields:[
    {key:'product',label:'Produto ou suplemento',kind:'text',requiredForFinal:true,wide:true},
    {key:'dose',label:'Dose e modo de uso',kind:'text'},
    {key:'schedule',label:'Horários',kind:'text'},
    {key:'justification',label:'Justificativa profissional',kind:'textarea',requiredForFinal:true},
    {key:'notes',label:'Orientações e acompanhamento',kind:'textarea'},
  ]},
  goals:{label:'Metas',description:'Defina uma meta acordada, o prazo e a situação do acompanhamento.',newTitle:'Meta de acompanhamento',fields:[
    {key:'goal',label:'Meta acordada',kind:'textarea',requiredForFinal:true},
    {key:'deadline',label:'Prazo',kind:'date'},
    {key:'progressStatus',label:'Situação da meta',kind:'select',options:['Pendente','Em andamento','Concluída'],defaultValue:'Pendente'},
    {key:'notes',label:'Evolução e próximos passos',kind:'textarea'},
  ]},
  compounds:{label:'Manipulados',description:'Registre a composição, a posologia e as orientações definidas pela profissional.',newTitle:'Registro de manipulado',fields:[
    {key:'composition',label:'Composição informada',kind:'textarea',requiredForFinal:true},
    {key:'dosage',label:'Posologia informada',kind:'textarea'},
    {key:'directions',label:'Orientações profissionais',kind:'textarea',requiredForFinal:true},
    {key:'purpose',label:'Finalidade e acompanhamento',kind:'textarea'},
  ]},
  guidance:{label:'Orientações',description:'Organize orientações individuais para a rotina do paciente.',newTitle:'Orientações nutricionais',fields:[
    {key:'body',label:'Texto das orientações',kind:'textarea',requiredForFinal:true},
    {key:'context',label:'Contexto e acompanhamento',kind:'textarea'},
  ]},
  attachments:{label:'Arquivos',description:'Anexe um PDF ou uma imagem ao histórico privado do paciente.',newTitle:'Arquivo do paciente',fields:[
    {key:'description',label:'Descrição do arquivo',kind:'textarea'},
  ]},
  notes:{label:'Prontuário',description:'Registre notas clínicas e informações relevantes do acompanhamento.',newTitle:'Nota de prontuário',fields:[
    {key:'notes',label:'Notas de prontuário',kind:'textarea',requiredForFinal:true},
  ]},
  documents:{label:'Documentos',description:'Prepare o conteúdo, salve a revisão e emita o documento em PDF pela impressão.',newTitle:'Documento nutricional',fields:[
    {key:'documentType',label:'Tipo de documento',kind:'select',options:['Declaração','Relatório','Encaminhamento','Orientação','Outro'],defaultValue:'Relatório',wide:true},
    {key:'body',label:'Conteúdo do documento',kind:'textarea',requiredForFinal:true},
    {key:'purpose',label:'Finalidade',kind:'textarea'},
  ]},
  finance:{label:'Recibos e financeiro',description:'Registre receitas e despesas do paciente e acompanhe os pagamentos.',newTitle:'Registro financeiro',fields:[
    {key:'amount',label:'Valor (R$)',kind:'text',placeholder:'150,00',requiredForFinal:true},
    {key:'direction',label:'Tipo de lançamento',kind:'select',options:['Receita','Despesa'],defaultValue:'Receita',requiredForFinal:true},
    {key:'paymentStatus',label:'Situação do pagamento',kind:'select',options:['Pendente','Pago'],defaultValue:'Pendente',requiredForFinal:true},
    {key:'paymentMethod',label:'Forma de pagamento',kind:'text',placeholder:'Pix, dinheiro, cartão…'},
    {key:'description',label:'Descrição do lançamento',kind:'textarea',requiredForFinal:true},
  ]},
};

export const ENTRY_MODULE_LABELS = Object.fromEntries(ENTRY_MODULES.map(module=>[module,ENTRY_MODULE_META[module].label])) as Record<EntryModule,string>;

export function patientModuleEntries(entries:readonly ClinicalEntry[],patientId:number,module:EntryModule):ClinicalEntry[] {
  return entries.filter(entry=>entry.patientId===patientId && entry.module===module).sort((a,b)=>
    b.recordedOn.localeCompare(a.recordedOn) || b.updatedAt.localeCompare(a.updatedAt) || b.id-a.id);
}

export function validateEntryFields(module:EntryModule,fields:Record<string,string>,status:EntryStatus):string[] {
  const errors:string[]=[];
  for(const field of ENTRY_MODULE_META[module].fields) {
    const value=typeof fields[field.key]==='string' ? fields[field.key].trim() : '';
    if(status==='Finalizado' && field.requiredForFinal && !value) errors.push(`Preencha ${field.label}.`);
    if(!value) continue;
    if(field.kind==='number') {
      const parsed=Number(value);
      if(!Number.isFinite(parsed) || (field.min!==undefined && parsed<field.min) || (field.max!==undefined && parsed>field.max)) {
        errors.push(`${field.label}: informe um valor válido${field.min!==undefined ? ` a partir de ${field.min.toLocaleString('pt-BR')}` : ''}${field.max!==undefined ? ` e até ${field.max.toLocaleString('pt-BR')}` : ''}.`);
      }
    }
    if(field.options && !field.options.includes(value)) errors.push(`${field.label}: escolha uma opção da lista.`);
  }
  return errors;
}

export function attachmentSelectionError(file:Pick<File,'type'|'size'|'name'>):string {
  if(!['application/pdf','image/png','image/jpeg'].includes(file.type)) return 'Escolha um arquivo PDF, PNG ou JPEG.';
  if(file.size<=0) return 'O arquivo está vazio. Escolha outro arquivo.';
  if(file.size>10*1024*1024) return 'O limite por arquivo é 10 MiB.';
  return '';
}
