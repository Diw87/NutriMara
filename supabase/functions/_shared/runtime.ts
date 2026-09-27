import { createClient } from 'npm:@supabase/supabase-js@2.95.0';
export const cors = {'Access-Control-Allow-Origin':'https://diw87.github.io','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store'};
export const db = () => createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
export const authClient = () => createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
export function reply(data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json'}});}
export async function authorize(req:Request){
 const token=req.headers.get('Authorization')?.replace(/^Bearer /,'');
 if(!token)throw Error('UNAUTHORIZED');
 const client=db();const {data:{user},error}=await client.auth.getUser(token);
 if(error||!user||!user.email_confirmed_at)throw Error('UNAUTHORIZED');
 const {data:access}=await client.from('nutri_access').select('*').eq('email',user.email).eq('enabled',true).maybeSingle();
 if(!access||(access.user_id&&access.user_id!==user.id))throw Error('UNAUTHORIZED');
 if(!access.user_id){const {error}=await client.from('nutri_access').update({user_id:user.id}).eq('alias',access.alias).is('user_id',null);if(error)throw Error('UNAUTHORIZED');}
 return {client,user};
}
export async function limit(client:ReturnType<typeof db>,key:string,seconds:number,max:number){const {data,error}=await client.rpc('nutri_rate_limit',{p_key:key,p_seconds:seconds,p_max:max});if(error||!data)throw Error('LIMIT');}
export async function records(client:ReturnType<typeof db>){const all=[];for(let from=0;from<200000;from+=1000){const {data,error}=await client.from('nutri_records').select('*').order('id').range(from,from+999);if(error)throw error;all.push(...data);if(data.length<1000)return all;}throw Error('Limite de registros.');}
export function failure(error:unknown){const message=error instanceof Error?error.message:'';if(message==='UNAUTHORIZED')return reply({error:'Sessão inválida ou conta sem autorização.'},401);if(message==='LIMIT')return reply({error:'Muitas tentativas. Aguarde alguns minutos.'},429);if(message==='CONFLICT')return reply({error:'Outro dispositivo alterou este registro. Copie seu texto, atualize os dados e revise antes de salvar.'},409);return reply({error:'Não foi possível concluir. Confira os dados e tente novamente.'},400);}
