import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';

let handler;
const runtimeURL='data:text/javascript,'+encodeURIComponent(`
export const cors={};
export const reply=(data,status=200)=>Response.json(data,{status});
export const authorize=req=>globalThis.__nutriEdge.authorize(req);
export const records=client=>globalThis.__nutriEdge.records(client);
export const failure=error=>Response.json({error:error.message||'invalid'},{status:error.message==='CONFLICT'?409:error.message==='UNAUTHORIZED'?401:400});
`);
const hook=registerHooks({resolve(specifier,context,next){
  if(specifier==='npm:zod@3.25.76')return next('zod',context);
  if(specifier==='../_shared/runtime.ts'&&context.parentURL?.includes('/nutri-clinic/index.ts'))return {url:runtimeURL,shortCircuit:true};
  return next(specifier,context);
}});
const previousDeno=globalThis.Deno;
globalThis.Deno={serve:fn=>{handler=fn;}};
try{await import('../supabase/functions/nutri-clinic/index.ts');}finally{hook.deregister();globalThis.Deno=previousDeno;}

const stamp='2026-10-02T12:00:00.000Z';
const pdf=new TextEncoder().encode('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n');
function dbFixture(){
  const tables={nutri_records:[{id:7,kind:'patients',data:{name:'Ana Silva',phone:'',birthDate:'',goal:'',notes:'',createdAt:stamp},version:1,updated_at:stamp}],nutri_uploads:[],nutri_imports:[]};
  const objects=new Map();let serial=30;
  class Query {
    constructor(table){this.table=table;this.filters=[];this.mode='read';this.value=undefined;this.max=Infinity;this.from=0;this.orderBy=undefined;this.options={};}
    select(_columns,options={}){this.options=options;return this;}
    eq(key,value){this.filters.push(row=>field(row,key)===value);return this;}
    in(key,values){this.filters.push(row=>values.includes(field(row,key)));return this;}
    lt(key,value){this.filters.push(row=>field(row,key)<value);return this;}
    or(expression){const clauses=expression.split(',').map(clause=>{const [key,op,...value]=clause.split('.');assert.equal(op,'eq');return row=>String(field(row,key))===value.join('.');});this.filters.push(row=>clauses.some(f=>f(row)));return this;}
    order(key,{ascending=true}={}){this.orderBy={key,ascending};return this;}
    limit(n){this.max=n;return this;}
    range(from,to){this.from=from;this.max=to-from+1;return this;}
    insert(value){this.mode='insert';this.value=value;return this;}
    update(value){this.mode='update';this.value=value;return this;}
    delete(){this.mode='delete';return this;}
    async run(single=false){
      let selected=tables[this.table].filter(row=>this.filters.every(f=>f(row)));
      if(this.mode==='insert'){
        if(this.table==='nutri_records'&&client.failInsert)return {data:null,error:{code:'XX000',message:'insert failed'}};
        const row=this.table==='nutri_records'?{id:++serial,version:1,updated_at:stamp,...structuredClone(this.value)}:{created_at:stamp,...structuredClone(this.value)};
        tables[this.table].push(row);selected=[row];
      }else if(this.mode==='update'){for(const row of selected)Object.assign(row,structuredClone(this.value));}
      else if(this.mode==='delete'){tables[this.table]=tables[this.table].filter(row=>!selected.includes(row));}
      if(this.orderBy){const {key,ascending}=this.orderBy;selected.sort((a,b)=>String(field(a,key)).localeCompare(String(field(b,key)))*(ascending?1:-1));}
      const count=selected.length;selected=selected.slice(this.from,this.from+this.max);
      return {data:single?(selected[0]??null):selected,error:null,count};
    }
    single(){return this.run(true);}
    maybeSingle(){return this.run(true);}
    then(resolve,reject){return this.run().then(resolve,reject);}
  }
  function field(row,key){if(key.startsWith('data->>'))return row.data[key.slice(7)];return row[key];}
  const client={
    from:table=>new Query(table),
    storage:{from:bucket=>({
      upload:async(key,bytes,options)=>{assert.equal(options.upsert,false);const id=`${bucket}/${key}`;if(objects.has(id))return {data:null,error:{statusCode:'409'}};objects.set(id,{bytes:bytes.slice(),contentType:options.contentType});return {data:{path:key},error:null};},
      download:async key=>{const value=objects.get(`${bucket}/${key}`);return value?{data:new Blob([value.bytes],{type:value.contentType}),error:null}:{data:null,error:{statusCode:'404'}};},
      remove:async keys=>{for(const key of keys)objects.delete(`${bucket}/${key}`);return {data:[],error:null};},
      createSignedUrl:async(key,seconds)=>{assert.equal(seconds,120);return objects.has(`${bucket}/${key}`)?{data:{signedUrl:`https://private.invalid/${key}?temporary`},error:null}:{data:null,error:{statusCode:'404'}};},
    })},
    rpc:async(name,args)=>{assert.equal(name,'nutri_import');client.lastImport=structuredClone(args);if(client.failImport)return {data:null,error:{code:'XX000',message:'import failed'}};tables.nutri_imports.push({id:args.p_id,created_at:stamp});return {data:args.p_rows.patients.length,error:null};},
  };
  return {client,tables,objects};
}
async function run(fixture,body,authorized=true){
  globalThis.__nutriEdge={authorize:async()=>{if(!authorized)throw Error('UNAUTHORIZED');return {client:fixture.client,user:{id:'approved'}};},records:async()=>structuredClone(fixture.tables.nutri_records)};
  const multipart=body instanceof FormData;
  return handler(new Request('https://edge.invalid/nutri-clinic',{method:'POST',headers:multipart?{}:{'Content-Type':'application/json'},body:multipart?body:JSON.stringify(body)}));
}
function attachmentForm(overrides={}){
  const form=new FormData();for(const [key,value] of Object.entries({action:'attachment',patientId:'7',title:'Resultados',recordedOn:'2026-10-02',description:'Exame de acompanhamento',...overrides}))form.set(key,value);
  form.set('file',new Blob([pdf],{type:'application/pdf'}),'resultado.pdf');return form;
}
function entryData(overrides={}){return {patientId:7,module:'attachments',title:'Resultados',recordedOn:'2026-10-02',status:'Finalizado',fields:{description:'Exame'},createdAt:stamp,updatedAt:stamp,attachment:{name:'resultado.pdf',contentType:'application/pdf',size:pdf.length},...overrides};}

test('upload cria registro versionado com status escolhido e chave aleatória somente no servidor',async()=>{
  const fixture=dbFixture();
  const response=await run(fixture,attachmentForm({status:'Rascunho',attachmentKey:'injected.pdf'}));
  assert.equal(response.status,201);
  const result=await response.json();assert.equal(result.version,1);assert.equal(result.entry._version,1);assert.equal(result.entry.status,'Rascunho');
  assert.equal(result.entry.attachmentKey,undefined);assert.equal(result.entry.attachment.size,pdf.length);
  const saved=fixture.tables.nutri_records.find(r=>r.id===result.id);
  assert.equal(saved.kind,'clinicalEntries');assert.equal(saved.data.patientId,7);assert.match(saved.data.attachmentKey,/^[0-9a-f-]{36}\.pdf$/);assert.notEqual(saved.data.attachmentKey,'injected.pdf');
  assert.deepEqual([...fixture.objects.get(`nutrimara-documents/${saved.data.attachmentKey}`).bytes],[...pdf]);assert.equal(fixture.tables.nutri_uploads.length,0);
});

test('upload inválido, paciente inexistente e sessão sem autorização não persistem arquivos',async()=>{
  for(const [form,authorized] of [[attachmentForm({patientId:'999'}),true],[attachmentForm(),false],[attachmentForm({status:'Outro'}),true]]){
    const fixture=dbFixture();assert.equal((await run(fixture,form,authorized)).ok,false);assert.equal(fixture.objects.size,0);assert.equal(fixture.tables.nutri_records.length,1);
  }
  const form=attachmentForm();form.set('file',new Blob([pdf],{type:'image/png'}),'fake.png');
  const fixture=dbFixture();assert.equal((await run(fixture,form)).ok,false);assert.equal(fixture.objects.size,0);assert.equal(fixture.tables.nutri_records.length,1);
});

test('falha no banco após upload remove o objeto e conserva pacientes existentes',async()=>{
  const fixture=dbFixture();fixture.client.failInsert=true;
  assert.equal((await run(fixture,attachmentForm())).ok,false);assert.equal(fixture.objects.size,0);assert.equal(fixture.tables.nutri_records.length,1);assert.equal(fixture.tables.nutri_uploads.length,0);
});

test('URL resolve somente a chave do registro autorizado e workspace não expõe chaves',async()=>{
  const fixture=dbFixture();const key='bf1163cf-1b68-4dc7-84ec-ab81de88828b.pdf';
  fixture.tables.nutri_records.push({id:21,kind:'clinicalEntries',version:4,updated_at:stamp,data:entryData({attachmentKey:key})});
  fixture.objects.set(`nutrimara-documents/${key}`,{bytes:pdf,contentType:'application/pdf'});
  const response=await run(fixture,{action:'attachmentUrl',id:21,key:'foreign.pdf',patientId:999});assert.equal(response.status,200);assert.equal((await response.json()).url,`https://private.invalid/${key}?temporary`);
  assert.equal((await run(fixture,{action:'attachmentUrl',id:7})).ok,false);
  assert.equal((await run(fixture,{action:'attachmentUrl',id:21},false)).status,401);
  const loaded=await (await run(fixture,{action:'load'})).json();
  assert.ok(Array.isArray(loaded.workspace.clinicalEntries));assert.equal(loaded.workspace.clinicalEntries[0].attachmentKey,undefined);assert.equal(loaded.rows.find(r=>r.id===21).data.attachmentKey,undefined);
});

test('mutações devolvem versão atual e rejeitam snapshot antigo sem substituir dados',async()=>{
  const fixture=dbFixture();const data=entryData({module:'labs',attachment:undefined});
  fixture.tables.nutri_records.push({id:21,kind:'clinicalEntries',version:4,updated_at:stamp,data});
  const body={action:'saveClinicalEntry',id:21,patientId:7,module:'labs',title:'Revisão',recordedOn:'2026-10-02',status:'Arquivado',fields:{description:'Revisado'},_version:4};
  const result=await (await run(fixture,{action:'mutate',body,version:4})).json();assert.equal(result.version,5);assert.equal(result.entry._version,5);assert.equal(result.entry.status,'Arquivado');
  assert.equal((await run(fixture,{action:'mutate',body:{...body,title:'Não salvar'},version:4})).status,409);
  assert.equal(fixture.tables.nutri_records.find(r=>r.id===21).data.title,'Revisão');
  assert.equal((await run(fixture,{action:'mutate',body:{...body,patientId:999},version:5})).ok,false);
});

test('snapshot vazio permite criar plano e rejeita registro concorrente existente',async()=>{
  const fixture=dbFixture();const body={action:'savePlan',_version:null,patientId:7,title:'Plano inicial',instructions:'',meals:[{time:'12:00',label:'Almoço',foods:'Arroz'}]};
  const response=await run(fixture,{action:'mutate',body,version:null});assert.equal(response.status,200);
  assert.equal((await response.json()).version,1);
  assert.equal((await run(fixture,{action:'mutate',body:{...body,title:'Não sobrescrever'},version:null})).status,409);
  assert.equal(fixture.tables.nutri_records.find(r=>r.kind==='plans').data.title,'Plano inicial');
});

test('exportação v3 contém os bytes de anexos privados e nunca inclui chave de storage',async()=>{
  const fixture=dbFixture();const key='bf1163cf-1b68-4dc7-84ec-ab81de88828b.pdf';
  fixture.tables.nutri_records.push({id:21,kind:'clinicalEntries',version:4,updated_at:stamp,data:entryData({attachmentKey:key})});fixture.objects.set(`nutrimara-documents/${key}`,{bytes:pdf,contentType:'application/pdf'});
  const backup=await (await run(fixture,{action:'export'})).json();assert.equal(backup.version,3);assert.deepEqual(backup.attachments,[{id:21,data:Buffer.from(pdf).toString('base64')}]);assert.equal(backup.workspace.clinicalEntries[0].attachmentKey,undefined);
});

function backupFixture(fixture){return {format:'nutrimara-backup',version:3,id:'941fcfc6-d9aa-4c58-80e6-a7bf4223b030',exportedAt:stamp,workspace:{patients:[{id:7,...fixture.tables.nutri_records[0].data}],appointments:[],measurements:[],plans:[],photoAssessments:[],clinicalRecords:[],clinicalEntries:[{id:21,...entryData({attachmentKey:'injected.pdf'})}]},photos:[],attachments:[{id:21,data:Buffer.from(pdf).toString('base64')}]};}

test('importação valida arquivos antes de gravar e gera novas chaves sem confiar no backup',async()=>{
  const fixture=dbFixture();const backup=backupFixture(fixture);
  const response=await run(fixture,{action:'import',backup});assert.equal(response.status,200);assert.equal((await response.json()).addedPatients,1);
  const sent=fixture.client.lastImport.p_rows.clinicalEntries[0];assert.equal(sent.patientId,7);assert.match(sent.attachmentKey,/^[0-9a-f-]{36}\.pdf$/);assert.notEqual(sent.attachmentKey,'injected.pdf');assert.equal(fixture.objects.size,1);assert.equal(fixture.tables.nutri_uploads.length,0);
  const invalid=dbFixture();const broken=backupFixture(invalid);broken.workspace.clinicalEntries[0].attachment.size++;
  assert.equal((await run(invalid,{action:'import',backup:broken})).ok,false);assert.equal(invalid.objects.size,0);assert.equal(invalid.client.lastImport,undefined);
});

test('importação repetida não cria arquivos e falha de transação remove staging do lote',async()=>{
  const fixture=dbFixture();const backup=backupFixture(fixture);fixture.tables.nutri_imports.push({id:backup.id,created_at:stamp});
  assert.equal((await run(fixture,{action:'import',backup})).status,409);assert.equal(fixture.objects.size,0);
  const failed=dbFixture();failed.client.failImport=true;
  assert.equal((await run(failed,{action:'import',backup:backupFixture(failed)})).ok,false);assert.equal(failed.objects.size,0);assert.equal(failed.tables.nutri_uploads.length,0);assert.equal(failed.tables.nutri_records.length,1);
});
