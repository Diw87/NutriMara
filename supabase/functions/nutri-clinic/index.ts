import {cors,reply,authorize,failure,records} from '../_shared/runtime.ts';
import {mutationFor} from '../_shared/cloud-actions.ts';
import {photoInputSchema,marksSchema,regionMarksSchema,tapeMeasuresSchema,backupSchema,idSchema} from '../_shared/schemas.ts';
import {estimateBodyFromPhotos} from '../_shared/photo-estimate.ts';
import {validatePhotoBytes} from '../_shared/photo-upload.ts';
import {immutableUpload} from '../_shared/immutable-upload.ts';
const bucket='nutrimara-private';
const kinds=['patients','appointments','measurements','plans','photoAssessments','clinicalRecords'];
function workspace(rows:any[]){return Object.fromEntries(kinds.map(k=>[k,rows.filter(r=>r.kind===k).map(r=>{const {frontKey,sideKey,...d}=r.data;return {...d,id:r.id,_version:r.version};}).sort((a,b)=>k==='patients'?String(a.name).localeCompare(String(b.name),'pt-BR'):String(b.measuredOn||b.startsAt||'').localeCompare(String(a.measuredOn||a.startsAt||''))||b.id-a.id)]));}
function b64(bytes:Uint8Array){let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return reply({error:'Método inválido.'},405);
 try{
  const {client}=await authorize(req);
  if(Number(req.headers.get('content-length'))>40*1024*1024)return reply({error:'Arquivo muito grande. Importe em lotes menores.'},413);
  const form=req.headers.get('content-type')?.includes('multipart/form-data')?await req.formData():null;
  const b=form?{action:'photo'}:await req.json();
  if(form){
   const input=photoInputSchema.parse({patientId:Number(form.get('patientId')),heightCm:Number(form.get('heightCm')),measuredOn:form.get('measuredOn')});
   if(form.get('consent')!=='yes')throw Error('invalid');
   const {data:patient}=await client.from('nutri_records').select('id').eq('id',input.patientId).eq('kind','patients').maybeSingle();if(!patient)throw Error('invalid');
   const marks=marksSchema.parse(JSON.parse(String(form.get('marks'))));
   const regionMarks=regionMarksSchema.parse(JSON.parse(String(form.get('regionMarks')??'{}')));
   const tapeMeasures=tapeMeasuresSchema.parse(JSON.parse(String(form.get('tapeMeasures')??'{}')));
   const result=estimateBodyFromPhotos(input.heightCm,marks.front,marks.side,regionMarks);
   const keys:string[]=[];
   try{
    for(const view of ['front','side']){const file=form.get(view);if(!(file instanceof File))throw Error('invalid');const bytes=new Uint8Array(await file.arrayBuffer());validatePhotoBytes(bytes,file.type);const key=crypto.randomUUID()+'.jpg';const {error}=await client.storage.from(bucket).upload(key,bytes,{contentType:'image/jpeg'});if(error)throw error;keys.push(key);}
    const {data,error}=await client.from('nutri_records').insert({kind:'photoAssessments',data:{...input,...result,marks,regionMarks,tapeMeasures,frontKey:keys[0],sideKey:keys[1],createdAt:new Date().toISOString()}}).select('id').single();if(error)throw error;return reply({id:data.id,...result},201);
   }catch(e){if(keys.length)await client.storage.from(bucket).remove(keys);throw e;}
  }
  if(b.action==='photoUrl'){
   const {data:r}=await client.from('nutri_records').select('data').eq('kind','photoAssessments').eq('id',idSchema.parse(b.id)).single();if(!r||!['front','side'].includes(b.view))throw Error('invalid');
   const {data,error}=await client.storage.from(bucket).createSignedUrl(r.data[b.view+'Key'],120);if(error)throw error;return reply({url:data.signedUrl});
  }
  if(b.action==='deletePhoto'){
   const {data:r}=await client.from('nutri_records').select('*').eq('kind','photoAssessments').eq('id',idSchema.parse(b.id)).single();if(!r||r.version!==b.version)throw Error('CONFLICT');
   const {data,error}=await client.from('nutri_records').delete().eq('id',r.id).eq('version',b.version).select('id');if(error)throw error;if(!data.length)throw Error('CONFLICT');await client.storage.from(bucket).remove([r.data.frontKey,r.data.sideKey]);return reply({ok:true});
  }
  if(b.action==='import'){
   const backup=backupSchema.parse(b.backup);const ids=new Set(backup.workspace.patients.map(p=>p.id));
   for(const values of Object.values(backup.workspace)){if(new Set(values.map(v=>v.id)).size!==values.length)throw Error('invalid');for(const r of values)if('patientId'in r&&!ids.has(r.patientId))throw Error('invalid');}
   if(new Set(backup.workspace.plans.map(v=>v.patientId)).size!==backup.workspace.plans.length||new Set(backup.workspace.clinicalRecords.map(v=>v.patientId)).size!==backup.workspace.clinicalRecords.length)throw Error('invalid');
   const photoIds=new Set(backup.workspace.photoAssessments.map(p=>p.id));if(backup.photos.length!==photoIds.size||new Set(backup.photos.map(p=>p.id)).size!==photoIds.size||backup.photos.some(p=>!photoIds.has(p.id)))throw Error('invalid');
   const {data:done}=await client.from('nutri_imports').select('id').eq('id',backup.id).maybeSingle();if(done)return reply({error:'Este lote já foi importado.'},409);
   for(const p of backup.photos){const row=backup.workspace.photoAssessments.find(r=>r.id===p.id)! as any;
    for(const view of ['front','side'] as const){const bytes=Uint8Array.from(atob(p[view]),c=>c.charCodeAt(0));validatePhotoBytes(bytes,'image/jpeg');const key=`imports/${backup.id}/${p.id}-${view}.jpg`;await immutableUpload(client.storage.from(bucket),key,bytes);row[view+'Key']=key;}
   }
   const {data,error}=await client.rpc('nutri_import',{p_id:backup.id,p_rows:backup.workspace});if(error)throw error;return reply({addedPatients:data});
  }
  if(b.action==='revision'){const {data,count,error}=await client.from('nutri_records').select('updated_at',{count:'exact'}).order('updated_at',{ascending:false}).limit(1);if(error)throw error;return reply({revision:`${count}:${data[0]?.updated_at||''}`});}
  const rows=await records(client);
  if(b.action==='load')return reply({rows,workspace:workspace(rows)});
  if(b.action==='export'){
   const photos=[];for(const r of rows.filter(r=>r.kind==='photoAssessments')){const out:any={id:r.id};for(const view of ['front','side']){const {data,error}=await client.storage.from(bucket).download(r.data[view+'Key']);if(error)throw error;out[view]=b64(new Uint8Array(await data.arrayBuffer()));}photos.push(out);}
   return reply({format:'nutrimara-backup',version:2,id:crypto.randomUUID(),exportedAt:new Date().toISOString(),workspace:workspace(rows),photos});
  }
  const m=mutationFor(b.body,rows);
  if(m.version!==(b.version??null))throw Error('CONFLICT');
  if(m.data.patientId&&!rows.some(r=>r.kind==='patients'&&r.id===m.data.patientId))throw Error('invalid');
  const operation=m.id?client.from('nutri_records').update({data:m.data,version:m.version!+1,updated_at:new Date().toISOString()}).eq('id',m.id).eq('version',m.version):client.from('nutri_records').insert({kind:m.kind,data:m.data});
  const {data,error}=await operation.select('id,version');if(error){if(error.code==='23505')throw Error('CONFLICT');throw error;}if(!data.length)throw Error('CONFLICT');return reply({ok:true,id:data[0].id});
 }catch(e){return failure(e);}
});
