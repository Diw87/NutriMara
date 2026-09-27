import { z } from "zod";
import { mutationFor, type CloudRecord } from './cloud-actions.ts';
import type { Backup } from './schemas';
export const CLOUD_URL='https://bzsmbceilsondqnbtcfy.supabase.co';
export const PUBLIC_KEY='sb_publishable_dDq8gSfS91AAT7uPG37eMQ_TulvqEbb';
const sessionKey='nutrimara-cloud-session';
const sessionSchema=z.object({access_token:z.string().min(1),refresh_token:z.string().min(1),expires_at:z.number().finite()});
export type Session=z.infer<typeof sessionSchema>;
let generation=0;
let refreshing:Promise<Session>|null=null;
export function session(){try{const raw=JSON.parse(localStorage.getItem(sessionKey)||'null');return raw?sessionSchema.parse(raw):null;}catch{return null;}}
export function setSession(value:Session|null){generation++;if(value)localStorage.setItem(sessionKey,JSON.stringify(value));else localStorage.removeItem(sessionKey);window.dispatchEvent(new Event('nutri-session'));}
export async function token(){let value=session();if(!value)throw Error('Entre na conta para continuar.');if(value.expires_at<Date.now()/1000+60){
 if(!refreshing){const started=generation;const refreshToken=value.refresh_token;refreshing=(async()=>{const r=await fetch(CLOUD_URL+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:PUBLIC_KEY,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:value!.refresh_token})});const next=await r.json();if(started!==generation||session()?.refresh_token!==refreshToken)throw Error('Sessão encerrada.');if(!r.ok){setSession(null);throw Error('Sua sessão expirou. Entre novamente.');}const checked=sessionSchema.parse(next);setSession(checked);return checked;})();}
 try{value=await refreshing;}finally{refreshing=null;}
 }if(!value)throw Error("Sessão encerrada.");return value.access_token;}
export async function call(name:string,body:unknown,anonymous=false){
 const headers:Record<string,string>={apikey:PUBLIC_KEY};if(!anonymous)headers.Authorization='Bearer '+await token();
 if(!(body instanceof FormData))headers['Content-Type']='application/json';
 let response:Response;try{response=await fetch(`${CLOUD_URL}/functions/v1/${name}`,{method:'POST',headers,body:body instanceof FormData?body:JSON.stringify(body)});}catch{throw Error('Sem conexão com o servidor. Seus dados não foram salvos.');}
 const data=await response.json() as Record<string, any>;if(!response.ok)throw Error(data.error||'Não foi possível acessar o servidor.');return data;
}
export async function signOut(){const old=session();setSession(null);if(old)void fetch(CLOUD_URL+'/auth/v1/logout?scope=local',{method:'POST',headers:{apikey:PUBLIC_KEY,Authorization:'Bearer '+old.access_token}}).catch(()=>{});}
export function createCloudStore(){let rows:CloudRecord[]=[];let revision='';
 async function request(path:string,init:RequestInit={}){try{
  if(path==='/api/workspace'&&(!init.method||init.method==='GET')){const data=await call('nutri-clinic',{action:'load'});rows=data.rows;revision=`${rows.length}:${data.rows.map((r:{updated_at:string})=>r.updated_at).sort().at(-1)||''}`;return Response.json(data.workspace);}
  if(path==='/api/workspace'){const body=JSON.parse(String(init.body));const m=mutationFor(body,rows);return Response.json(await call('nutri-clinic',{action:'mutate',body,version:m.version}));}
  if(path==='/api/photos'&&init.body instanceof FormData)return Response.json(await call('nutri-clinic',init.body));
  if(path.startsWith('/api/photos?')&&init.method==='DELETE'){const id=Number(new URL(path,'https://local.invalid').searchParams.get('id'));const r=rows.find(r=>r.id===id&&r.kind==='photoAssessments');return Response.json(await call('nutri-clinic',{action:'deletePhoto',id,version:r?.version}));}
  throw Error('Operação indisponível.');
 }catch(e){return Response.json({error:e instanceof Error?e.message:'Não foi possível salvar.'},{status:400});}}
 return {request,hasRemoteChanges:async()=>revision!==''&&(await call('nutri-clinic',{action:'revision'})).revision!==revision,photoUrl:async(id:number,view:'front'|'side')=>(await call('nutri-clinic',{action:'photoUrl',id,view})).url as string,exportBackup:async()=>await call('nutri-clinic',{action:'export'}) as Backup,importBackup:async(backup:unknown)=>await call('nutri-clinic',{action:'import',backup}) as {addedPatients:number}};
}
