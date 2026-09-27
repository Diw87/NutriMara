import test from 'node:test';
import assert from 'node:assert/strict';
import { session, setSession, token } from '../pwa/cloud-client.ts';
import { recoveryFromHash } from '../pwa/recovery.ts';
test('sair durante a renovação não restaura a sessão', async()=>{
 const values=new Map();globalThis.localStorage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};globalThis.window=new EventTarget();
 setSession({access_token:'old',refresh_token:'refresh',expires_at:0});
 const original=globalThis.fetch;let release;
 globalThis.fetch=()=>new Promise(resolve=>{release=resolve;});
 try{const pending=token();setSession(null);release(Response.json({access_token:'new',refresh_token:'new-refresh',expires_at:9999999999}));await assert.rejects(pending);assert.equal(session(),null);}finally{globalThis.fetch=original;}
});
test('recuperação aceita apenas callback completo e prazo limitado',()=>{
 assert.equal(recoveryFromHash('#type=recovery&access_token=x'),null);
 assert.equal(recoveryFromHash('#type=signup&access_token=x&refresh_token=y&expires_in=3600'),null);
 assert.equal(recoveryFromHash('#type=recovery&access_token=x&refresh_token=y&expires_in=NaN'),null);
 const result=recoveryFromHash('#type=recovery&access_token=x&refresh_token=y&expires_in=3600',100);
 assert.deepEqual(result,{access_token:'x',refresh_token:'y',expires_at:3700});
});
