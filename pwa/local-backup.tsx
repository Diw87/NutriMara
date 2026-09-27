import {useState} from 'react';
import {createLocalStore} from './local-store';
export default function LocalBackup(){const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
 async function download(){setBusy(true);try{const data=await createLocalStore().exportBackup();const url=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`NutriMara-cadastros-locais-${Date.now()}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);setMessage('Cópia local preparada. Guarde o arquivo baixado.');}catch(e){setMessage(e instanceof Error?e.message:'Não foi possível exportar.');}finally{setBusy(false);}}
 return <div><button className="text-button" disabled={busy} onClick={()=>void download()}>{busy?'Preparando…':'Exportar cadastros antigos deste navegador'}</button><p role="status">{message}</p></div>;
}
