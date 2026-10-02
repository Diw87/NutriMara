import test from 'node:test';
import assert from 'node:assert/strict';
import { mutationFor } from '../pwa/cloud-actions.ts';
import { patientSchema, workspaceSchema, backupSchema } from '../pwa/schemas.ts';

const stamp = '2026-10-02T12:00:00.000Z';
const entry = {patientId:7,module:'labs',title:'Exames iniciais',recordedOn:'2026-10-02',status:'Rascunho',fields:{description:'Revisar resultados'}};
const records = [{id:21,kind:'clinicalEntries',version:4,data:{...entry,createdAt:stamp,updatedAt:stamp}}];
const empty = {patients:[],appointments:[],measurements:[],plans:[],photoAssessments:[],clinicalRecords:[]};

test('salva um novo registro de módulo com datas e versão inicial', () => {
  const result = mutationFor({action:'saveClinicalEntry',...entry},[]);
  assert.equal(result.kind,'clinicalEntries');
  assert.equal(result.id,null);
  assert.equal(result.version,null);
  assert.deepEqual(result.data.fields,{description:'Revisar resultados'});
  assert.ok(Number.isFinite(Date.parse(result.data.createdAt)));
  assert.equal(result.data.updatedAt,result.data.createdAt);
});

test('editar, arquivar e restaurar preservam identidade, conteúdo e versão conhecida', () => {
  const archived = mutationFor({action:'saveClinicalEntry',id:21,...entry,status:'Arquivado'},records);
  assert.equal(archived.id,21);
  assert.equal(archived.version,4);
  assert.equal(archived.data.createdAt,stamp);
  assert.equal(archived.data.status,'Arquivado');
  assert.deepEqual(archived.data.fields,entry.fields);
  const restored = mutationFor({action:'saveClinicalEntry',id:21,...entry,status:'Finalizado'},[{...records[0],data:archived.data,version:5}]);
  assert.equal(restored.version,5);
  assert.equal(restored.data.status,'Finalizado');
  assert.deepEqual(restored.data.fields,entry.fields);
});

test('registro existente não pode trocar de paciente, módulo ou reutilizar id inexistente', () => {
  assert.throws(()=>mutationFor({action:'saveClinicalEntry',id:21,...entry,patientId:8},records),/vínculo/i);
  assert.throws(()=>mutationFor({action:'saveClinicalEntry',id:21,...entry,module:'goals'},records),/vínculo/i);
  assert.throws(()=>mutationFor({action:'saveClinicalEntry',id:999,...entry},records),/encontrado/i);
});

test('campos de paciente permanecem opcionais e clientes antigos os preservam', () => {
  const profile = {nickname:'Ana',email:'ana@example.com',cpf:'123.456.789-00',sex:'Feminino',biologicalCondition:'Gestante',tags:'prioridade, retorno'};
  const data = {name:'Ana Silva',phone:'',birthDate:'',goal:'',notes:'',createdAt:stamp,...profile};
  const current = [{id:7,kind:'patients',version:2,data}];
  const updated = mutationFor({action:'updatePatient',id:7,name:'Ana Souza'},current);
  for(const [key,value] of Object.entries(profile)) assert.equal(updated.data[key],value);
  assert.deepEqual(patientSchema.parse({name:'Paciente antigo'}),{name:'Paciente antigo',phone:'',birthDate:'',goal:'',notes:''});
  assert.equal(patientSchema.parse({name:'Paciente novo',...profile}).tags,'prioridade, retorno');
  assert.equal(patientSchema.safeParse({name:'Paciente novo',tags:['retorno']}).success,false);
  assert.equal(patientSchema.safeParse({name:'Paciente novo',sex:'Não informado'}).success,false);
  assert.equal(patientSchema.safeParse({name:'Paciente novo',biologicalCondition:'Outra'}).success,false);
});

test('workspace inclui módulos e metadados públicos, sem aceitar chave privada do backup', () => {
  const saved = {...entry,module:'attachments',id:21,createdAt:stamp,updatedAt:stamp,attachment:{name:'resultado.pdf',contentType:'application/pdf',size:20},attachmentKey:'outro-paciente.pdf'};
  const result = workspaceSchema.parse({...empty,clinicalEntries:[saved]});
  assert.ok(Array.isArray(result.clinicalEntries));
  assert.equal(result.clinicalEntries[0].attachment.name,'resultado.pdf');
  assert.equal(result.clinicalEntries[0].attachmentKey,undefined);
  assert.deepEqual(workspaceSchema.parse(empty).clinicalEntries,[]);
  assert.equal(workspaceSchema.safeParse({...empty,clinicalEntries:[{...saved,module:'unknown'}]}).success,false);
  assert.equal(workspaceSchema.safeParse({...empty,clinicalEntries:[{...saved,fields:{description:42}}]}).success,false);
});

test('backup v3 inclui anexos e versões anteriores recebem coleções vazias', () => {
  const common = {format:'nutrimara-backup',id:'941fcfc6-d9aa-4c58-80e6-a7bf4223b030',exportedAt:stamp,workspace:empty,photos:[]};
  const result = backupSchema.parse({...common,version:3,attachments:[{id:21,data:'JVBERi0xLjQKJSVFT0Y='}]});
  assert.equal(result.version,3);
  assert.equal(result.attachments[0].id,21);
  for(const version of [1,2]) {
    const old = backupSchema.parse({...common,version});
    assert.deepEqual(old.workspace.clinicalEntries,[]);
    assert.deepEqual(old.attachments,[]);
  }
  assert.equal(backupSchema.safeParse({...common,version:3,attachments:[{id:21,data:'not base64!'}]}).success,false);
});

test('finalizar financeiro valida moeda, direção e situação; rascunho e arquivo mantêm campos incompletos', () => {
  const input = {action:'saveClinicalEntry',...entry,module:'finance',fields:{amount:'120,50',direction:'Receita',paymentStatus:'Pago'},status:'Finalizado'};
  assert.equal(mutationFor(input,[]).data.fields.amount,'120,50');
  for(const fields of [{...input.fields,amount:'-20'},{...input.fields,amount:'100000001'},{...input.fields,amount:'1,234'},{...input.fields,direction:'Transferência'},{...input.fields,paymentStatus:'Outro'}]) {
    assert.throws(()=>mutationFor({...input,fields},[]));
  }
  for(const status of ['Rascunho','Arquivado']) assert.equal(mutationFor({...input,status,fields:{amount:'',direction:'',paymentStatus:''}},[]).data.status,status);
});
