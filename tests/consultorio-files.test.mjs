import test from 'node:test';
import assert from 'node:assert/strict';
const attachments=await import('../supabase/functions/_shared/attachment-upload.ts').catch(()=>({}));
const uploads=await import('../supabase/functions/_shared/staged-upload.ts').catch(()=>({}));
const backups=await import('../supabase/functions/_shared/backup-files.ts').catch(()=>({}));
const pdf=new TextEncoder().encode('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n');
const jpg=new Uint8Array([255,216,255,224,0,0,0,0,0,0,255,217]);
const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64'));
const stamp='2026-10-02T12:00:00.000Z';
const attachment={patientId:7,module:'attachments',title:'Resultados',recordedOn:'2026-10-02',status:'Finalizado',fields:{description:'Exame'},id:21,createdAt:stamp,updatedAt:stamp,attachment:{name:'resultado.pdf',contentType:'application/pdf',size:pdf.length}};
function backup(){return {format:'nutrimara-backup',version:3,id:'941fcfc6-d9aa-4c58-80e6-a7bf4223b030',exportedAt:stamp,workspace:{patients:[{id:7,name:'Ana Silva'}],appointments:[],measurements:[],plans:[],photoAssessments:[],clinicalRecords:[],clinicalEntries:[structuredClone(attachment)]},photos:[],attachments:[{id:21,data:Buffer.from(pdf).toString('base64')}]};}

test('valida assinatura de PDF, PNG e JPEG contra o MIME informado',()=>{
  assert.equal(typeof attachments.validateAttachmentBytes,'function');
  for(const [bytes,mime,extension] of [[pdf,'application/pdf','pdf'],[png,'image/png','png'],[jpg,'image/jpeg','jpg']]) assert.equal(attachments.validateAttachmentBytes(bytes,mime),extension);
  for(const [bytes,mime] of [[pdf,'image/png'],[png,'application/pdf'],[jpg,'image/webp'],[new TextEncoder().encode('arquivo inválido'),'application/pdf'],[pdf.subarray(0,12),'application/pdf'],[jpg.subarray(0,10),'image/jpeg']]) assert.throws(()=>attachments.validateAttachmentBytes(bytes,mime));
});

test('permite exatamente 10 MiB e rejeita excesso de tamanho antes de persistir',()=>{
  assert.equal(typeof attachments.validateAttachmentBytes,'function');
  const boundary=new Uint8Array(10*1024*1024);boundary.set(pdf.subarray(0,8));boundary.set(new TextEncoder().encode('%%EOF'),boundary.length-5);
  assert.equal(attachments.validateAttachmentBytes(boundary,'application/pdf'),'pdf');
  const oversized=new Uint8Array(boundary.length+1);oversized.set(boundary);assert.throws(()=>attachments.validateAttachmentBytes(oversized,'application/pdf'));
});

test('backup exige todos os anexos, IDs únicos e tamanho coerente com os bytes',()=>{
  assert.equal(typeof backups.prepareBackupFiles,'function');
  const valid=backups.prepareBackupFiles(backup());
  assert.deepEqual([...valid.attachments.get(21)],[...pdf]);
  const cases=[];
  const missing=backup();missing.attachments=[];cases.push(missing);
  const extra=backup();extra.attachments.push({id:99,data:extra.attachments[0].data});cases.push(extra);
  const duplicate=backup();duplicate.attachments.push({...duplicate.attachments[0]});cases.push(duplicate);
  const badSize=backup();badSize.workspace.clinicalEntries[0].attachment.size++;cases.push(badSize);
  const badMime=backup();badMime.workspace.clinicalEntries[0].attachment.contentType='image/png';cases.push(badMime);
  const badLink=backup();badLink.workspace.clinicalEntries[0].patientId=999;cases.push(badLink);
  const badBytes=backup();badBytes.attachments[0].data='not base64!';cases.push(badBytes);
  for(const item of cases) assert.throws(()=>backups.prepareBackupFiles(item));
});

function memoryUploads(){
  const files=new Map(),jobs=new Map(),references=new Set();
  const io={
    stage:async job=>jobs.set(job.id,structuredClone(job)),
    upload:async file=>{assert.ok([...jobs.values()].some(job=>job.files.some(f=>f.key===file.key)));files.set(file.key,file.bytes.slice());},
    references:async list=>new Set(list.filter(f=>references.has(f.key)).map(f=>`${f.bucket}/${f.key}`)),
    remove:async list=>{for(const file of list)files.delete(file.key);},
    finish:async id=>jobs.delete(id),
    pending:async before=>[...jobs.values()].filter(job=>job.createdAt<before),
  };
  return {io,files,jobs,references};
}
const file={bucket:'nutrimara-documents',key:'server-generated.pdf',contentType:'application/pdf',bytes:pdf};

test('falha de gravação desfaz objetos recém-enviados e reserva de upload',async()=>{
  assert.equal(typeof uploads.persistUploadedFiles,'function');
  const {io,files,jobs}=memoryUploads();
  await assert.rejects(uploads.persistUploadedFiles(io,[file],async()=>{throw Object.assign(Error('database failed'),{code:'23514'});}),/database failed/);
  assert.equal(files.size,0);assert.equal(jobs.size,0);
});

test('resposta perdida depois do commit recupera resultado e preserva arquivo vinculado',async()=>{
  assert.equal(typeof uploads.persistUploadedFiles,'function');
  const {io,files,jobs,references}=memoryUploads();
  const result=await uploads.persistUploadedFiles(io,[file],async()=>{references.add(file.key);throw Error('response lost');},async()=>({id:31,version:1}));
  assert.deepEqual(result,{id:31,version:1});assert.deepEqual([...files.get(file.key)],[...pdf]);assert.equal(jobs.size,0);
});

test('commit em voo conserva bytes e reserva se transporte falhar e recuperação ainda não achar vínculo',async()=>{
  const state=memoryUploads();let lateCommit;
  await assert.rejects(uploads.persistUploadedFiles(state.io,[file],async()=>{
    lateCommit=()=>state.references.add(file.key);
    throw new TypeError('transport failed');
  },async()=>undefined),/transport failed/);
  lateCommit();
  assert.equal(state.references.has(file.key),true);
  assert.deepEqual([...state.files.get(file.key)??[]],[...pdf]);
  assert.equal(state.jobs.size,1);
  const createdAt=Date.parse([...state.jobs.values()][0].createdAt);
  await uploads.cleanupStagedUploads(state.io,createdAt+23*60*60*1000);
  assert.equal(state.jobs.size,1);
  await uploads.cleanupStagedUploads(state.io,createdAt+25*60*60*1000);
  assert.deepEqual([...state.files.get(file.key)],[...pdf]);assert.equal(state.jobs.size,0);
});

test('erro genérico ou timeout no commit conserva reserva mesmo sem resultado recuperável',async()=>{
  for(const error of [new Error('unknown commit status'),new Error('timeout'),{code:'',message:'TypeError: Failed to fetch'},{code:'08006',message:'connection lost'}]){
    const state=memoryUploads();
    await assert.rejects(uploads.persistUploadedFiles(state.io,[file],async()=>{throw error;},async()=>undefined));
    assert.equal(state.files.size,1);assert.equal(state.jobs.size,1);
    const createdAt=Date.parse([...state.jobs.values()][0].createdAt);
    await uploads.cleanupStagedUploads(state.io,createdAt+25*60*60*1000);
    assert.equal(state.files.size,0);assert.equal(state.jobs.size,0);
  }
});

test('falha de transporte no upload conserva reserva para limpar um envio tardio',async()=>{
  const state=memoryUploads();let commitStarted=false;
  let lateUpload;
  state.io.upload=async value=>{lateUpload=()=>state.files.set(value.key,value.bytes.slice());throw new TypeError('upload response lost');};
  await assert.rejects(uploads.persistUploadedFiles(state.io,[file],async()=>{commitStarted=true;return {id:31};}),/upload response lost/);
  assert.equal(commitStarted,false);assert.equal(state.jobs.size,1);
  lateUpload();
  const createdAt=Date.parse([...state.jobs.values()][0].createdAt);
  await uploads.cleanupStagedUploads(state.io,createdAt+25*60*60*1000);
  assert.equal(state.files.size,0);assert.equal(state.jobs.size,0);
});

test('limpeza conserva arquivo já vinculado e remove somente staging antigo sem vínculo',async()=>{
  assert.equal(typeof uploads.cleanupStagedUploads,'function');
  const {io,files,jobs,references}=memoryUploads();
  for(const [id,key] of [['committed','saved.pdf'],['orphan','unused.pdf']]){jobs.set(id,{id,createdAt:'2026-09-30T12:00:00.000Z',files:[{bucket:file.bucket,key}]});files.set(key,pdf);}
  references.add('saved.pdf');
  await uploads.cleanupStagedUploads(io,Date.parse(stamp));
  assert.equal(files.has('saved.pdf'),true);assert.equal(files.has('unused.pdf'),false);assert.equal(jobs.size,0);
});

test('falha ao consultar vínculos ou limpar storage mantém reserva para nova tentativa',async()=>{
  assert.equal(typeof uploads.persistUploadedFiles,'function');
  const state=memoryUploads();state.io.references=async()=>{throw Error('offline');};
  await assert.rejects(uploads.persistUploadedFiles(state.io,[file],async()=>{throw Error('database failed');}),/database failed/);
  assert.equal(state.files.size,1);assert.equal(state.jobs.size,1);
  state.io.references=async()=>new Set();state.io.remove=async()=>{throw Error('storage offline');};
  for(const job of state.jobs.values())job.createdAt='2026-09-30T12:00:00.000Z';
  await uploads.cleanupStagedUploads(state.io,Date.parse(stamp));
  assert.equal(state.files.size,1);assert.equal(state.jobs.size,1);
});
