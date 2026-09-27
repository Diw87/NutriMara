import test from 'node:test';
import assert from 'node:assert/strict';
import { mutationFor } from '../pwa/cloud-actions.ts';
test('plano e ficha exigem a versão lida e não misturam pacientes', () => {
 const records=[{id:5,kind:'plans',version:3,data:{patientId:7}}];
 assert.equal(mutationFor({action:'savePlan',patientId:7,title:'Plano',instructions:'',meals:[{time:'12',label:'Almoço',foods:'Arroz'}]},records).version,3);
 assert.equal(mutationFor({action:'savePlan',patientId:8,title:'Plano',instructions:'',meals:[{time:'12',label:'Almoço',foods:'Arroz'}]},records).id,null);
});
test('ações desconhecidas e medidas inválidas são rejeitadas', () => {
 assert.throws(()=>mutationFor({action:'unknown'},[]));
 assert.throws(()=>mutationFor({action:'addMeasurement',patientId:1,measuredOn:'2026-09-24',weightKg:-1,waistCm:null},[]));
});

test('importação repetida não pode sobrescrever uma foto de outro pedido', async () => {
 const { immutableUpload } = await import('../supabase/functions/_shared/immutable-upload.ts');
 const files=new Map();
 const storage={upload:async(k,v)=>{if(files.has(k))return {error:{statusCode:'409'}};files.set(k,v.slice());return {error:null};},download:async(k)=>({data:new Blob([files.get(k)]),error:null})};
 await immutableUpload(storage,'batch/photo',new Uint8Array([1,2,3]));
 await immutableUpload(storage,'batch/photo',new Uint8Array([1,2,3]));
 await assert.rejects(immutableUpload(storage,'batch/photo',new Uint8Array([7,8,9])));
 assert.deepEqual([...files.get('batch/photo')],[1,2,3]);
});
