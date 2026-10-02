import test from 'node:test';
import assert from 'node:assert/strict';
import {createCloudStore,setSession} from '../pwa/cloud-client.ts';

const input={patientId:7,module:'labs',title:'Resultados',recordedOn:'2026-10-02',status:'Rascunho',fields:{description:'Exames'}};
const stamp='2026-10-02T12:00:00.000Z';
async function connected(body, run) {
  const previous={fetch:globalThis.fetch,localStorage:globalThis.localStorage,window:globalThis.window};
  const values=new Map();
  globalThis.localStorage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
  globalThis.window=new EventTarget();
  setSession({access_token:'test-token',refresh_token:'test-refresh',expires_at:9999999999});
  globalThis.fetch=body;
  try{return await run(createCloudStore());}finally{Object.assign(globalThis,previous);}
}

test('snapshot de edição antiga prevalece sobre versão atual do cache', async()=>{
  const calls=[];
  await connected(async(_url,init)=>{
    const body=JSON.parse(init.body); calls.push(body);
    if(body.action==='load')return Response.json({rows:[{id:21,kind:'clinicalEntries',version:8,data:{...input,createdAt:stamp,updatedAt:stamp}}],workspace:{clinicalEntries:[]}});
    return Response.json({error:'Outro dispositivo alterou este registro.'},{status:409});
  },async store=>{
    await store.request('/api/workspace');
    const response=await store.request('/api/workspace',{method:'POST',body:JSON.stringify({action:'saveClinicalEntry',id:21,_version:4,...input})});
    assert.equal(response.ok,false);
  });
  assert.equal(calls[1].action,'mutate');
  assert.equal(calls[1].version,4);
});

test('snapshot vazio explícito não assume a versão de um plano criado depois',async()=>{
  const calls=[];
  await connected(async(_url,init)=>{
    const body=JSON.parse(init.body);calls.push(body);
    if(body.action==='load')return Response.json({rows:[{id:41,kind:'plans',version:3,data:{patientId:7}}],workspace:{plans:[]}});
    return Response.json({error:'Outro dispositivo criou este plano.'},{status:409});
  },async store=>{
    await store.request('/api/workspace');
    const response=await store.request('/api/workspace',{method:'POST',body:JSON.stringify({action:'savePlan',_version:null,patientId:7,title:'Plano inicial',instructions:'',meals:[{time:'12:00',label:'Almoço',foods:'Arroz'}]})});
    assert.equal(response.ok,false);
  });
  assert.equal(calls.length,2);
  assert.equal(calls[1].version,null);
});

test('upload multipart e abertura por id usam ações de anexo sem enviar uma chave privada', async()=>{
  const calls=[];
  const saved={...input,module:'attachments',id:31,_version:1,createdAt:stamp,updatedAt:stamp,attachment:{name:'resultado.pdf',contentType:'application/pdf',size:20}};
  await connected(async(_url,init)=>{
    assert.equal(init.headers.Authorization,'Bearer test-token');
    calls.push(init);
    if(init.body instanceof FormData) return Response.json({id:31,version:1,entry:saved});
    return Response.json({url:'https://private.invalid/temporary-url'});
  },async store=>{
    const form=new FormData();form.set('patientId','7');form.set('title','Resultados');form.set('recordedOn','2026-10-02');form.set('description','Exame');form.set('file',new Blob(['%PDF-1.4\n%%EOF'],{type:'application/pdf'}),'resultado.pdf');
    const uploaded=await store.request('/api/attachments',{method:'POST',body:form});
    assert.equal(uploaded.status,201);
    assert.equal((await uploaded.json()).entry.attachment.name,'resultado.pdf');
    const opened=await store.request('/api/attachments/url?id=31');
    assert.equal((await opened.json()).url,'https://private.invalid/temporary-url');
  });
  assert.equal(calls[0].headers['Content-Type'],undefined);
  assert.equal(calls[0].body.get('action'),'attachment');
  assert.deepEqual(JSON.parse(calls[1].body),{action:'attachmentUrl',id:31});
});

test('sem internet anexos retornam erro visível sem afirmar salvamento', async()=>{
  await connected(async()=>{throw Error('offline');},async store=>{
    const response=await store.request('/api/attachments',{method:'POST',body:new FormData()});
    assert.equal(response.ok,false);
    assert.match((await response.json()).error,/Sem conexão.*não foram salvos/);
  });
});
