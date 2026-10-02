"use client";

import {type FormEvent, useId, useMemo, useRef, useState} from 'react';
import {Archive, Calculator, Check, CheckCircle2, ExternalLink, FileText, Pencil, Plus, Printer, RotateCcw, Save, Upload} from 'lucide-react';
import type {ClinicClient} from '@/lib/clinic-client';
import {attachmentSelectionError, ENTRY_MODULE_META, patientModuleEntries, validateEntryFields, type EntryField} from '../pwa/consultorio-modules';
import {calculateEnergy, financeTotals, moneyToCents} from '../pwa/consultorio-data';
import {printableEntryHTML} from '../pwa/entry-print';
import type {ClinicalEntry, EntryInput, EntryModule, EntryPatient, EntryStatus} from '../pwa/consultorio-types';
import '../app/clinical-entry.css';

type Props = {client:ClinicClient;patient:EntryPatient;module:EntryModule;entries:ClinicalEntry[];onSaved:()=>Promise<void>|void};
type Draft = Pick<EntryInput,'title'|'recordedOn'|'status'|'fields'>;
type OperationResult = {error?:string;id?:number;version?:number;_version?:number;entry?:ClinicalEntry;url?:string};
type HistoryFilter = 'Ativos'|'Todos'|'Arquivados';

function currentDay():string {
  return new Date().toLocaleDateString('sv-SE',{timeZone:'America/Sao_Paulo'});
}
function displayDay(value:string):string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.split('-').reverse().join('/') : value || 'Sem data';
}
function currency(cents:number):string {
  return (cents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
}
function initialDraft(module:EntryModule,patient:EntryPatient):Draft {
  const meta=ENTRY_MODULE_META[module];
  const fields=Object.fromEntries(meta.fields.map(field=>[field.key,field.defaultValue ?? '']));
  if(module==='energy' && ['Normal','Gestante','Lactante','Outro'].includes(patient.biologicalCondition ?? '')) fields.condition=patient.biologicalCondition!;
  return {title:meta.newTitle,recordedOn:currentDay(),status:module==='attachments' ? 'Finalizado' : 'Rascunho',fields};
}
function draftFromEntry(entry:ClinicalEntry):Draft {
  return {title:entry.title,recordedOn:entry.recordedOn,status:entry.status,fields:Object.fromEntries(Object.entries(entry.fields ?? {}).map(([key,value])=>[key,typeof value==='string' ? value : '']))};
}
function errorMessage(error:unknown,fallback:string):string {
  if(error instanceof TypeError) return 'Sem conexão com o servidor. Sua edição foi mantida; tente salvar novamente quando a conexão voltar.';
  return error instanceof Error ? error.message : fallback;
}
async function responseResult(response:Response):Promise<OperationResult> {
  const result=await response.json().catch(()=>({})) as OperationResult;
  if(!response.ok) throw new Error(result.error || 'Não foi possível salvar. Sua edição foi mantida.');
  return result;
}

function EntryInputField({field,value,id,onChange,finalized}:{field:EntryField;value:string;id:string;onChange:(value:string)=>void;finalized:boolean}) {
  const hintId=`${id}-hint`;
  const common={id,value,onChange:(event:{target:{value:string}})=>onChange(event.target.value),required:finalized && !!field.requiredForFinal,readOnly:field.readOnly,'aria-describedby':field.hint ? hintId : undefined};
  return <div className={`entry-field${field.wide || field.kind==='textarea' ? ' entry-field-wide' : ''}${field.readOnly ? ' entry-field-result' : ''}`}>
    <label htmlFor={id}>{field.label}{field.requiredForFinal && <span className="entry-final-required"> (ao finalizar)</span>}</label>
    {field.kind==='textarea' ? <textarea {...common} rows={field.key==='body' || field.key==='notes' ? 6 : 4} placeholder={field.placeholder} maxLength={20000} />
      : field.kind==='select' ? <select id={id} value={value} onChange={common.onChange} required={common.required} aria-describedby={common['aria-describedby']}><option value="">Selecione</option>{field.options?.map(option=><option key={option} value={option}>{option}</option>)}</select>
      : <input {...common} type={field.kind==='number' ? 'number' : field.kind==='date' ? 'date' : 'text'} min={field.min} max={field.max} step={field.step ?? (field.kind==='number' ? 'any' : undefined)} placeholder={field.placeholder || (field.readOnly ? 'Calcule para preencher' : undefined)} inputMode={field.key==='amount' ? 'decimal' : undefined} maxLength={field.kind==='text' ? 500 : undefined} />}
    {field.hint && <small id={hintId}>{field.hint}</small>}
  </div>;
}

// The keyed editor guarantees that a draft or selected file cannot carry into another patient or module.
export default function ClinicalEntryPanel(props:Props) {
  return <PatientModuleEditor key={`${props.patient.id}:${props.module}`} {...props} />;
}

function PatientModuleEditor({client,patient,module,entries,onSaved}:Props) {
  const meta=ENTRY_MODULE_META[module];
  const formId=useId();
  const fileRef=useRef<HTMLInputElement>(null);
  const [draft,setDraft]=useState<Draft>(()=>initialDraft(module,patient));
  const [editing,setEditing]=useState<ClinicalEntry|null>(null);
  const [file,setFile]=useState<File|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const [historyFilter,setHistoryFilter]=useState<HistoryFilter>('Ativos');
  const [reloadPending,setReloadPending]=useState(false);
  const patientEntries=useMemo(()=>patientModuleEntries(entries,patient.id,module),[entries,patient.id,module]);
  const history=patientEntries.filter(entry=>historyFilter==='Todos' || (historyFilter==='Arquivados' ? entry.status==='Arquivado' : entry.status!=='Arquivado'));
  const archived=editing?.status==='Arquivado';
  const finance=useMemo(()=>{
    if(module!=='finance') return null;
    try { return {totals:financeTotals(patientEntries),error:''}; }
    catch(cause) { return {totals:null,error:errorMessage(cause,'Revise os lançamentos antes de calcular o resumo financeiro.')}; }
  },[module,patientEntries]);
  const energyCondition=patient.biologicalCondition && patient.biologicalCondition!=='Normal' ? patient.biologicalCondition : draft.fields.condition || 'Normal';
  const energyAge=draft.fields.age ? Number(draft.fields.age) : null;
  const manualEnergy=module==='energy' && (energyCondition!=='Normal' || (energyAge!==null && (!Number.isInteger(energyAge) || energyAge<19 || energyAge>78)));

  function updateDraft(key:'title'|'recordedOn'|'status',value:string) {
    setDraft(current=>({...current,[key]:value}));
    setError('');setMessage('');
  }
  function updateField(key:string,value:string) {
    setDraft(current=>{
      const fields={...current.fields,[key]:value};
      if(module==='energy' && ['weightKg','heightCm','age','sex','multiplier','condition'].includes(key)) { fields.restingKcal='';fields.totalKcal=''; }
      return {...current,fields};
    });
    setError('');setMessage('');
  }
  function startNew() {
    setDraft(initialDraft(module,patient));setEditing(null);setFile(null);setError('');setMessage('');
    if(fileRef.current) fileRef.current.value='';
  }
  function editEntry(entry:ClinicalEntry) {
    if(entry.patientId!==patient.id || entry.module!==module) return;
    setEditing(entry);setDraft(draftFromEntry(entry));setFile(null);setError('');setMessage('');
    if(fileRef.current) fileRef.current.value='';
    document.getElementById(`${formId}-title`)?.focus();
  }
  async function refreshHistory() {
    setBusy(true);
    try { await onSaved();setReloadPending(false);setError('');setMessage('Histórico recarregado.'); }
    catch(cause) { setError(errorMessage(cause,'Não foi possível recarregar o histórico.')); }
    finally { setBusy(false); }
  }
  async function reloadAfterSave() {
    try { await onSaved();setReloadPending(false); }
    catch(cause) { setReloadPending(true);throw new Error(`O registro foi salvo, mas não foi possível atualizar o histórico. ${errorMessage(cause,'Tente recarregar o histórico.')}`); }
  }
  function calculate() {
    try {
      if(!['weightKg','heightCm','age','sex','multiplier'].every(key=>draft.fields[key]?.trim())) throw new Error('Preencha peso, altura, idade, sexo da fórmula e multiplicador para calcular.');
      const result=calculateEnergy({weightKg:Number(draft.fields.weightKg),heightCm:Number(draft.fields.heightCm),age:Number(draft.fields.age),sex:draft.fields.sex as 'Masculino'|'Feminino',multiplier:Number(draft.fields.multiplier),condition:energyCondition});
      setDraft(current=>({...current,fields:{...current.fields,restingKcal:String(result.restingKcal),totalKcal:String(result.totalKcal)}}));
      setError('');setMessage('Cálculo atualizado. Defina a meta e salve a avaliação.');
    } catch(cause) { setError(errorMessage(cause,'Não foi possível calcular. Registre a avaliação manualmente.')); }
  }
  async function save(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitStatus=(event.nativeEvent as SubmitEvent).submitter?.getAttribute('data-status');
    const status:EntryStatus=submitStatus==='Finalizado' ? 'Finalizado' : draft.status;
    if(status==='Arquivado' || archived) return;
    const validation=validateEntryFields(module,draft.fields,status);
    if(draft.title.trim().length<2 || draft.title.trim().length>120) validation.unshift('Informe um título com 2 a 120 caracteres.');
    if(!draft.recordedOn) validation.unshift('Informe a data do registro.');
    if(module==='finance' && draft.fields.amount?.trim()) {
      try { moneyToCents(draft.fields.amount); } catch(cause) { validation.push(errorMessage(cause,'Informe um valor monetário válido.')); }
    }
    if(module==='attachments' && !editing) {
      if(!file) validation.push('Escolha um arquivo PDF, PNG ou JPEG para anexar.');
      else { const fileError=attachmentSelectionError(file);if(fileError) validation.push(fileError); }
    }
    if(validation.length) { setError(validation.join(' '));return; }
    if(editing && (editing.patientId!==patient.id || editing.module!==module)) { setError('O registro não pertence a este paciente e módulo.');return; }
    setBusy(true);setError('');setMessage('');
    try {
      const input:EntryInput={patientId:patient.id,module,title:draft.title.trim(),recordedOn:draft.recordedOn,status,fields:{...draft.fields}};
      let result:OperationResult;
      if(module==='attachments' && !editing && file) {
        const upload=new FormData();
        upload.set('patientId',String(patient.id));upload.set('title',input.title);upload.set('recordedOn',input.recordedOn);upload.set('description',input.fields.description || '');upload.set('status',status);upload.set('file',file);
        result=await responseResult(await client.request('/api/attachments',{method:'POST',body:upload}));
      } else {
        result=await responseResult(await client.request('/api/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'saveClinicalEntry',...input,...(editing ? {id:editing.id,...(editing._version!==undefined ? {_version:editing._version} : {})} : {})})}));
      }
      const savedId=result.entry?.id ?? result.id ?? editing?.id;
      if(!savedId) throw new Error('O servidor não confirmou o identificador do registro. Recarregue o histórico antes de tentar novamente.');
      const saved:ClinicalEntry=result.entry && result.entry.patientId===patient.id && result.entry.module===module ? result.entry : {
        ...input,id:savedId,createdAt:editing?.createdAt || new Date().toISOString(),updatedAt:new Date().toISOString(),
        ...(editing?.attachment ? {attachment:editing.attachment} : {}),
        ...(result.version!==undefined || result._version!==undefined ? {_version:result.version ?? result._version} : {}),
      };
      // Keep the confirmed target before reloading, so a failed reload cannot turn a retry into a duplicate upload.
      setEditing(saved);setDraft(draftFromEntry(saved));setFile(null);
      if(fileRef.current) fileRef.current.value='';
      await reloadAfterSave();
      setMessage(status==='Finalizado' ? 'Registro finalizado e salvo.' : 'Rascunho salvo.');
    } catch(cause) { setError(errorMessage(cause,'Não foi possível salvar. Sua edição foi mantida.')); }
    finally { setBusy(false); }
  }
  async function changeStatus(entry:ClinicalEntry,status:'Arquivado'|'Rascunho') {
    if(entry.patientId!==patient.id || entry.module!==module) return;
    setBusy(true);setError('');setMessage('');
    try {
      const result=await responseResult(await client.request('/api/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'saveClinicalEntry',id:entry.id,patientId:entry.patientId,module:entry.module,title:entry.title,recordedOn:entry.recordedOn,fields:entry.fields,status,...(entry._version!==undefined ? {_version:entry._version} : {})})}));
      if(editing?.id===entry.id) {
        const saved={...entry,status,...(result.version!==undefined || result._version!==undefined ? {_version:result.version ?? result._version} : {})};
        setEditing(saved);setDraft(draftFromEntry(saved));
      }
      await reloadAfterSave();setMessage(status==='Arquivado' ? 'Registro arquivado. Ele permanece disponível no histórico.' : 'Registro restaurado como rascunho.');
    } catch(cause) { setError(errorMessage(cause,'Não foi possível alterar o status. A edição foi mantida.')); }
    finally { setBusy(false); }
  }
  function printEntry(entry:ClinicalEntry) {
    if(entry.patientId!==patient.id || entry.module!==module) return;
    try {
      const html=printableEntryHTML({patient,entry,logoUrl:new URL(client.assetUrl('marakesia-logo.png'),window.location.href).href});
      const popup=window.open('','_blank');
      if(!popup) throw new Error('Permita a janela de impressão neste navegador e tente novamente.');
      popup.opener=null;popup.document.write(html);popup.document.close();popup.focus();setError('');
    } catch(cause) { setError(errorMessage(cause,'Não foi possível preparar a impressão.')); }
  }
  async function openAttachment(entry:ClinicalEntry) {
    if(entry.patientId!==patient.id || entry.module!=='attachments' || !entry.attachment) return;
    const popup=window.open('','_blank');
    if(!popup) { setError('Permita a abertura da janela do arquivo neste navegador e tente novamente.');return; }
    popup.opener=null;
    setBusy(true);setError('');
    try {
      const result=await responseResult(await client.request(`/api/attachments/url?id=${encodeURIComponent(String(entry.id))}`,{cache:'no-store'}));
      if(typeof result.url!=='string') throw new Error('O servidor não retornou o link temporário do arquivo.');
      const url=new URL(result.url);
      if(!['https:','http:'].includes(url.protocol) || url.username || url.password) throw new Error('O servidor retornou um link de arquivo inválido.');
      popup.location.replace(result.url);
    } catch(cause) { popup.close();setError(errorMessage(cause,'Não foi possível abrir o arquivo. Tente novamente.')); }
    finally { setBusy(false); }
  }

  return <section className="clinical-entry-panel" aria-labelledby={`${formId}-heading`}>
    <header className="entry-panel-header"><div className="entry-panel-intro"><span className="entry-module-icon"><FileText size={21} aria-hidden="true" /></span><div><span className="entry-eyebrow">ACOMPANHAMENTO DO PACIENTE</span><h2 id={`${formId}-heading`}>{meta.label}</h2><p>{meta.description}</p></div></div><button type="button" className="entry-button entry-button-secondary" onClick={startNew} disabled={busy}><Plus size={17} aria-hidden="true" />Novo registro</button></header>
    {finance && <section className="entry-finance-summary" aria-label="Resumo financeiro do paciente">{finance.totals ? <>
      <div><span>Receitas pagas</span><strong>{currency(finance.totals.incomePaid)}</strong></div><div><span>Despesas pagas</span><strong>{currency(finance.totals.expensePaid)}</strong></div><div><span>Receitas pendentes</span><strong>{currency(finance.totals.pendingIncome)}</strong></div><div className="entry-finance-balance"><span>Saldo recebido</span><strong>{currency(finance.totals.balance)}</strong></div>
      <p>O resumo considera somente lançamentos finalizados deste paciente.</p></> : <p role="alert">{finance.error} Abra os lançamentos finalizados para corrigir os valores.</p>}</section>}
    {error && <div className="entry-feedback entry-feedback-error" role="alert"><p>{error}</p>{reloadPending && <button type="button" className="entry-button entry-button-secondary" onClick={()=>void refreshHistory()} disabled={busy}><RotateCcw size={15} aria-hidden="true" />Recarregar histórico</button>}</div>}
    {message && <div className="entry-feedback entry-feedback-success" role="status"><CheckCircle2 size={18} aria-hidden="true" /><p>{message}</p></div>}
    <div className="entry-workspace">
      <form id={formId} className="entry-editor" onSubmit={save}>
        <div className="entry-card-heading"><div><span className="entry-eyebrow">{editing ? `REGISTRO ${editing.id}` : 'NOVO REGISTRO'}</span><h3>{archived ? 'Registro arquivado' : editing ? 'Editar registro' : 'Registrar acompanhamento'}</h3></div>{editing && <span className={`entry-status entry-status-${editing.status.toLowerCase()}`}>{editing.status}</span>}</div>
        {archived && <p className="entry-context-note">Restaure o registro como rascunho para editar o conteúdo.</p>}
        <fieldset disabled={busy || archived} className="entry-fields-container"><legend className="entry-sr-only">Dados de {meta.label}</legend>
          <div className="entry-form-grid">
            <div className="entry-field entry-field-wide"><label htmlFor={`${formId}-title`}>Título *</label><input id={`${formId}-title`} value={draft.title} onChange={event=>updateDraft('title',event.target.value)} minLength={2} maxLength={120} required /></div>
            <div className="entry-field"><label htmlFor={`${formId}-date`}>Data do registro *</label><input id={`${formId}-date`} type="date" value={draft.recordedOn} onChange={event=>updateDraft('recordedOn',event.target.value)} required /></div>
            <div className="entry-field"><label htmlFor={`${formId}-status`}>Status</label><select id={`${formId}-status`} value={draft.status} onChange={event=>updateDraft('status',event.target.value)}><option>Rascunho</option><option>Finalizado</option>{archived && <option>Arquivado</option>}</select></div>
            {meta.fields.map(field=><EntryInputField key={field.key} field={field} id={`${formId}-${field.key}`} value={draft.fields[field.key] || ''} onChange={value=>updateField(field.key,value)} finalized={draft.status==='Finalizado'} />)}
          </div>
          {module==='energy' && <div className="entry-energy-tools"><p>{manualEnergy ? 'Use avaliação manual nesta condição ou faixa etária. Registre a meta e a justificativa profissional.' : 'O cálculo usa Mifflin–St Jeor. O multiplicador e a meta energética são definidos pela profissional.'}</p><button type="button" className="entry-button entry-button-secondary" onClick={calculate} disabled={busy || manualEnergy}><Calculator size={17} aria-hidden="true" />Calcular gasto energético</button></div>}
          {module==='attachments' && <div className="entry-upload">{editing?.attachment ? <><FileText size={23} aria-hidden="true" /><div><strong>{editing.attachment.name}</strong><span>{editing.attachment.contentType} · {(editing.attachment.size/(1024*1024)).toLocaleString('pt-BR',{maximumFractionDigits:2})} MiB</span><small>Para outro arquivo, crie um novo registro.</small></div></> : !editing ? <><Upload size={24} aria-hidden="true" /><div><label htmlFor={`${formId}-file`}>Arquivo PDF, PNG ou JPEG *</label><input ref={fileRef} id={`${formId}-file`} type="file" accept="application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg" onChange={event=>{const chosen=event.target.files?.[0] ?? null;setFile(chosen);setError(chosen ? attachmentSelectionError(chosen) : '');setMessage('');}} /><small>Até 10 MiB. O arquivo permanece no histórico privado do paciente.</small></div></> : <p>Este registro não contém arquivo anexado.</p>}</div>}
        </fieldset>
        <footer className="entry-editor-footer"><p>{editing ? 'Ao salvar, a versão deste registro será atualizada.' : 'Salve o registro para incluí-lo no histórico.'} Requer conexão.</p><div className="entry-editor-actions">{archived && editing ? <button type="button" className="entry-button entry-button-primary" onClick={()=>void changeStatus(editing,'Rascunho')} disabled={busy}><RotateCcw size={17} aria-hidden="true" />Restaurar rascunho</button> : <><button type="submit" className="entry-button entry-button-primary" disabled={busy}><Save size={17} aria-hidden="true" />{busy ? 'Salvando…' : draft.status==='Finalizado' ? 'Salvar finalizado' : 'Salvar rascunho'}</button>{draft.status==='Rascunho' && <button type="submit" data-status="Finalizado" className="entry-button entry-button-secondary" disabled={busy}><Check size={17} aria-hidden="true" />Salvar e finalizar</button>}</>}</div></footer>
      </form>
      <aside className="entry-history" aria-labelledby={`${formId}-history`}>
        <div className="entry-card-heading"><div><span className="entry-eyebrow">REGISTROS SALVOS</span><h3 id={`${formId}-history`}>Histórico <span className="entry-count">{patientEntries.length}</span></h3></div><label className="entry-history-filter"><span className="entry-sr-only">Filtrar histórico</span><select value={historyFilter} onChange={event=>setHistoryFilter(event.target.value as HistoryFilter)}><option>Ativos</option><option>Todos</option><option>Arquivados</option></select></label></div>
        {!history.length ? <div className="entry-empty"><FileText size={29} aria-hidden="true" /><strong>{historyFilter==='Arquivados' ? 'Nenhum registro arquivado' : 'Nenhum registro neste filtro'}</strong><p>{patientEntries.length ? 'Escolha outro filtro para consultar o histórico.' : `O primeiro registro de ${meta.label.toLocaleLowerCase('pt-BR')} aparecerá aqui depois de salvo.`}</p></div> : <div className="entry-history-list">{history.map(entry=><article key={entry.id} className={`entry-history-item${editing?.id===entry.id ? ' entry-history-selected' : ''}`}>
          <div className="entry-history-meta"><time dateTime={entry.recordedOn}>{displayDay(entry.recordedOn)}</time><span className={`entry-status entry-status-${entry.status.toLowerCase()}`}>{entry.status}</span></div><h4>{entry.title}</h4>
          <details className="entry-history-content"><summary>Conteúdo salvo</summary><dl>{meta.fields.filter(field=>entry.fields?.[field.key]?.trim()).map(field=><div key={field.key}><dt>{field.label}</dt><dd>{entry.fields[field.key]}</dd></div>)}{entry.attachment && <div><dt>Arquivo</dt><dd>{entry.attachment.name}<small>{entry.attachment.contentType} · {Math.ceil(entry.attachment.size/1024).toLocaleString('pt-BR')} KiB</small></dd></div>}</dl></details>
          <div className="entry-history-actions"><button type="button" onClick={()=>editEntry(entry)} disabled={busy}><Pencil size={15} aria-hidden="true" />{entry.status==='Arquivado' ? 'Ver registro' : 'Editar'}</button><button type="button" onClick={()=>printEntry(entry)} disabled={busy}><Printer size={15} aria-hidden="true" />PDF salvo</button>{entry.attachment && <button type="button" onClick={()=>void openAttachment(entry)} disabled={busy}><ExternalLink size={15} aria-hidden="true" />Abrir arquivo</button>}{entry.status==='Arquivado' ? <button type="button" onClick={()=>void changeStatus(entry,'Rascunho')} disabled={busy}><RotateCcw size={15} aria-hidden="true" />Restaurar</button> : <button type="button" onClick={()=>void changeStatus(entry,'Arquivado')} disabled={busy}><Archive size={15} aria-hidden="true" />Arquivar</button>}</div>
        </article>)}</div>}
      </aside>
    </div>
  </section>;
}
