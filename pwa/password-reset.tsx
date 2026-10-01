import {useState} from 'react';
import {CLOUD_URL,PUBLIC_KEY,setSession,type Session} from './cloud-client';
export default function PasswordReset({recovery,onDone}:{recovery:Session;onDone:()=>void}){
 const [password,setPassword]=useState('');const [confirmation,setConfirmation]=useState('');const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
 async function submit(){if(password!==confirmation){setMessage('As senhas precisam ser iguais.');return;}setBusy(true);try{
  if(recovery.expires_at<=Date.now()/1000)throw Error('O link expirou. Solicite outro na tela de entrada.');
  const response=await fetch(CLOUD_URL+'/auth/v1/user',{method:'PUT',headers:{apikey:PUBLIC_KEY,Authorization:'Bearer '+recovery.access_token,'Content-Type':'application/json'},body:JSON.stringify({password})});
  if(!response.ok)throw Error('Não foi possível trocar a senha. Solicite outro link ou escolha uma senha diferente.');
  setSession(recovery);onDone();
 }catch(e){setMessage(e instanceof Error?e.message:'Falha na conexão. Tente novamente.');}finally{setBusy(false);}}
 return <main className="cloud-login surface"><h1>Definir nova senha</h1><form onSubmit={e=>{e.preventDefault();void submit();}}><label>Nova senha (mínimo 6 caracteres)<input type="password" autoComplete="new-password" required minLength={6} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)}/></label><label>Repita a senha<input type="password" autoComplete="new-password" required value={confirmation} onChange={e=>setConfirmation(e.target.value)}/></label><button className="button button-primary" disabled={busy}>{busy?'Salvando…':'Salvar nova senha'}</button></form><p role="status">{message}</p><button className="text-button" onClick={onDone} disabled={busy}>Voltar</button></main>;
}
