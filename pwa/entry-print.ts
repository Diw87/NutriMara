import {ENTRY_MODULE_META} from './consultorio-modules.ts';
import type {ClinicalEntry, EntryPatient} from './consultorio-types.ts';

const escape = (value:string):string=>value.replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]!));
const text = (value:unknown):string=>typeof value==='string' ? value : '';

export function printableEntryHTML({patient,entry,logoUrl}:{patient:EntryPatient;entry:ClinicalEntry;logoUrl:string}):string {
  if(!entry || !Number.isSafeInteger(entry.id) || entry.id<=0) throw new Error('O registro precisa estar salvo antes da impressão.');
  if(!patient || patient.id!==entry.patientId) throw new Error('O registro não pertence ao paciente selecionado.');
  const definition=ENTRY_MODULE_META[entry.module];
  if(!definition) throw new Error('Módulo de registro inválido.');
  let logo:URL;
  try {
    if(typeof logoUrl!=='string' || !logoUrl.trim()) throw new Error();
    logo=new URL(logoUrl);
    if(!['https:','http:'].includes(logo.protocol) || logo.username || logo.password) throw new Error();
  } catch { throw new Error('Logo inválida.'); }
  const recordedOn=text(entry.recordedOn);
  const date=/^\d{4}-\d{2}-\d{2}$/.test(recordedOn) ? recordedOn.split('-').reverse().join('/') : recordedOn;
  const fields=entry.fields ?? {};
  const content=definition.fields.filter(field=>text(fields[field.key]).trim()).map(field=>
    `<section class="field"><h2>${escape(field.label)}</h2><p>${escape(text(fields[field.key]))}</p></section>`).join('');
  const attachment=entry.attachment ? `<section class="field"><h2>Arquivo anexado</h2><p>${escape(text(entry.attachment.name))}</p><p class="muted">${escape(text(entry.attachment.contentType))} · ${Number.isFinite(entry.attachment.size) && entry.attachment.size>=0 ? Math.ceil(entry.attachment.size/1024).toLocaleString('pt-BR')+' KiB' : 'Tamanho não informado'}</p></section>` : '';
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(text(entry.title))} - ${escape(text(patient.name))}</title><style>
@page{size:A4;margin:16mm 14mm}*{box-sizing:border-box}body{font:11pt/1.5 Arial,sans-serif;color:#264a49;background:#fff;margin:0}header{display:flex;align-items:center;gap:16px;padding-bottom:14px;border-bottom:2px solid #168b87}header img{width:70px;height:70px;object-fit:contain}header h1{font-size:17pt;color:#276e61;margin:0}header p{font-size:9pt;margin:4px 0 0}.patient{margin:18px 0;padding:12px 14px;background:#f2f9f4;border-left:4px solid #78b63a}.patient p{margin:2px 0;overflow-wrap:anywhere}.module{font-size:9pt;text-transform:uppercase;letter-spacing:.06em;color:#168b87;margin:18px 0 4px}.title{font-size:15pt;line-height:1.3;color:#276e61;margin:0 0 18px;overflow-wrap:anywhere}.field{padding:0 0 14px;margin:0 0 14px;border-bottom:1px solid #dbe9e1}.field h2{font-size:10pt;color:#168b87;margin:0 0 5px;break-after:avoid}.field p{white-space:pre-wrap;overflow-wrap:anywhere;margin:0;orphans:3;widows:3}.muted{font-size:9pt;color:#607e75}footer{margin-top:25px;padding-top:12px;border-top:2px solid #168b87;font-size:8pt;color:#607e75}.actions{padding:14px;margin-bottom:20px;border-radius:8px;background:#f2f9f4}.actions button{font:inherit;padding:10px 16px;border:0;border-radius:8px;background:#276e61;color:white;cursor:pointer}.actions p{font-size:10pt;margin:8px 0 0}@media screen{body{max-width:850px;margin:24px auto;padding:20px}}@media print{.actions{display:none}body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
</style></head><body><div class="actions"><button type="button" onclick="window.print()">Imprimir / Salvar como PDF</button><p>Revise o documento e escolha Salvar como PDF no destino da impressão. Se a janela de impressão não abrir, use o botão acima.</p></div><header><img src="${escape(logo.href)}" alt="Logo oficial de Marakesia Nascimento"><div><h1>Marakesia Nascimento</h1><p>Nutricionista · CRN 11-6356</p></div></header><section class="patient"><p><strong>Paciente:</strong> ${escape(text(patient.name))}</p><p><strong>Data:</strong> ${escape(date)}</p><p><strong>Status do registro:</strong> ${escape(text(entry.status))}</p></section><p class="module">${escape(definition.label)}</p><h2 class="title">${escape(text(entry.title))}</h2>${content}${attachment}<footer>Marakesia Nascimento · CRN 11-6356 · NutriMara</footer><script>window.addEventListener('load',()=>window.print(),{once:true});</script></body></html>`;
}
