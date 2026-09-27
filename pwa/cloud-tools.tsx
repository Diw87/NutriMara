import LocalBackup from './local-backup';
import {useState,useEffect,useRef} from 'react';
import {createCloudStore,signOut} from './cloud-client';
import {createLocalStore} from './local-store';
import PwaTools from './pwa-tools';
export default function CloudTools({store,onRefresh}:{store:ReturnType<typeof createCloudStore>;onRefresh:()=>void}){
 const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);
 const dirty=useRef(false);const checking=useRef(false);const refreshRef=useRef(onRefresh);refreshRef.current=onRefresh;
 useEffect(()=>{
  const mark=()=>{dirty.current=true;};
  const check=async()=>{if(document.hidden||checking.current)return;checking.current=true;try{if(await store.hasRemoteChanges()){
   if(dirty.current||document.querySelector('[role="dialog"]')||document.activeElement?.matches('input,textarea,select'))setMessage('Há alterações de outro dispositivo. Salve suas edições e clique em Atualizar dados.');
   else refreshRef.current();
  }}catch{setMessage('Não foi possível conferir atualizações. Verifique sua conexão.');}finally{checking.current=false;}};
  document.addEventListener('input',mark,true);document.addEventListener('change',mark,true);document.addEventListener('pointerdown',mark,true);
  window.addEventListener('focus',check);const timer=setInterval(check,30000);
  return()=>{document.removeEventListener('input',mark,true);document.removeEventListener('change',mark,true);document.removeEventListener('pointerdown',mark,true);window.removeEventListener('focus',check);clearInterval(timer);};
 },[store]);
 async function transfer(){setBusy(true);try{const backup=await createLocalStore().exportBackup();if(!backup.workspace.patients.length){setMessage('Nenhum cadastro local neste navegador.');return;}
 const key='nutrimara-migration-batch';let id=localStorage.getItem(key);if(!id){id=crypto.randomUUID();localStorage.setItem(key,id);}backup.id=id;
 if(!confirm(`Enviar ${backup.workspace.patients.length} paciente(s) e ${backup.photos.length} par(es) de fotos deste navegador para o consultório online? O original local será mantido.`))return;
 const result=await store.importBackup(backup);setMessage(`${result.addedPatients} paciente(s) transferidos.`);onRefresh();
 }catch(e){setMessage(e instanceof Error?e.message:'Falha na transferência.');}finally{setBusy(false);}}
 return <><div className="cloud-toolbar"><strong>Consultório online · conta compartilhada</strong><button className="button button-secondary" onClick={()=>{if(confirm('Atualizar os dados? Salve ou copie as alterações de formulários antes de continuar.'))onRefresh();}}>Atualizar dados</button><button className="button button-secondary" disabled={busy} onClick={()=>void transfer()}>{busy?'Transferindo…':'Trazer cadastros deste navegador'}</button><button className="button button-secondary" onClick={()=>{if(confirm('Sair desta sessão? Alterações não salvas serão descartadas.'))void signOut();}}>Sair</button><p role="status">{message}</p></div><LocalBackup/><PwaTools store={store} cloud onImported={onRefresh}/></>;
}
