import {db,authClient,cors,reply,limit,failure} from '../_shared/runtime.ts';
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return reply({error:'Método inválido.'},405);
 try{
  if(Number(req.headers.get('content-length'))>4096)return reply({error:'Entrada muito grande.'},413);
  const b=await req.json();if(JSON.stringify(b).length>4096)throw Error('invalid');
  const service=db();
  const ip=req.headers.get('x-forwarded-for')?.split(',')[0]||'unknown';
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ip)))).map(v=>v.toString(16).padStart(2,'0')).join('');
  await limit(service,'auth:'+hash,600,25);
  const {data:a}=await service.from('nutri_access').select('email,enabled').eq('alias',String(b.username).trim().toLowerCase()).maybeSingle();
  if(!a?.enabled)return reply({error:'Usuário ou senha inválidos.'},401);
  const auth=authClient();let result;
  if(b.action==='login')result=await auth.auth.signInWithPassword({email:a.email,password:String(b.password)});
  else if(b.action==='setup'){
   if(typeof b.password!=='string'||b.password.length<6||b.password.length>128)return reply({error:'Use uma senha com 6 a 128 caracteres.'},400);
   await limit(service,'setup:'+String(b.username),3600,3);
   result=await auth.auth.signUp({email:a.email,password:b.password,options:{emailRedirectTo:'https://diw87.github.io/NutriMara/'}});
  }else if(b.action==='recover'){
   await limit(service,'recover:'+String(b.username),3600,3);
   const {error}=await auth.auth.resetPasswordForEmail(a.email,{redirectTo:'https://diw87.github.io/NutriMara/'});
   return error?reply({error:'Não foi possível enviar a recuperação. Aguarde e tente novamente.'},400):reply({message:'Verifique o e-mail cadastrado para recuperar o acesso.'});
  }else return reply({error:'Ação inválida.'},400);
  if(result.error)return reply({error:b.action==='login'?'Usuário, senha ou confirmação de e-mail inválidos.':'Não foi possível configurar. Confira seu e-mail ou use a recuperação.'},400);
  return reply({session:result.data.session,message:result.data.session?'Acesso confirmado.':'Confirme o cadastro no e-mail e depois volte aqui para entrar.'});
 }catch(e){return failure(e);}
});
