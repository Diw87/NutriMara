import {cors,reply,authorize,failure,records} from '../_shared/runtime.ts';
import {mutationFor} from '../_shared/cloud-actions.ts';
import {photoInputSchema,marksSchema,regionMarksSchema,tapeMeasuresSchema,backupSchema,idSchema,attachmentInputSchema,attachmentMetadataSchema} from '../_shared/schemas.ts';
import {estimateBodyFromPhotos} from '../_shared/photo-estimate.ts';
import {validatePhotoBytes} from '../_shared/photo-upload.ts';
import {DOCUMENT_BUCKET,validateAttachmentBytes} from '../_shared/attachment-upload.ts';
import {prepareBackupFiles,bytesToBase64} from '../_shared/backup-files.ts';
import {cleanupStagedUploads,persistUploadedFiles,type UploadFile} from '../_shared/staged-upload.ts';
import {uploadStore} from '../_shared/storage-adapter.ts';
import {workspace,publicRows,publicEntry} from '../_shared/clinic-workspace.ts';

const bucket='nutrimara-private';
async function requirePatient(client:any,patientId:number) {
  const {data,error}=await client.from('nutri_records').select('id').eq('id',patientId).eq('kind','patients').maybeSingle();
  if(error)throw error;if(!data)throw Error('invalid');
}
function attachmentKey(data:any) {
  if(data.module!=='attachments'||!attachmentMetadataSchema.safeParse(data.attachment).success||typeof data.attachmentKey!=='string'||!/^[0-9a-f-]{36}\.(?:pdf|png|jpg)$/.test(data.attachmentKey))throw Error('invalid');
  return data.attachmentKey as string;
}
function entryResult(row:any){return {ok:true,id:row.id,version:row.version,entry:publicEntry(row)};}

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return reply({error:'Método inválido.'},405);
  try{
    const {client}=await authorize(req);
    if(Number(req.headers.get('content-length'))>40*1024*1024)return reply({error:'Arquivo muito grande. Importe em lotes menores.'},413);
    const io=uploadStore(client);
    await cleanupStagedUploads(io);
    const form=req.headers.get('content-type')?.includes('multipart/form-data')?await req.formData():null;
    const b=form?{action:form.get('action')||'photo'}:await req.json();

    if(form&&b.action==='attachment'){
      const input=attachmentInputSchema.parse({patientId:Number(form.get('patientId')),title:form.get('title'),recordedOn:form.get('recordedOn'),description:form.get('description')??undefined,status:form.get('status')??undefined});
      await requirePatient(client,input.patientId);
      const file=form.get('file');if(!(file instanceof File))throw Error('invalid');
      const attachment=attachmentMetadataSchema.parse({name:file.name,contentType:file.type,size:file.size});
      const bytes=new Uint8Array(await file.arrayBuffer());
      const key=crypto.randomUUID()+'.'+validateAttachmentBytes(bytes,attachment.contentType);
      const stamp=new Date().toISOString();
      const data={patientId:input.patientId,module:'attachments',title:input.title,recordedOn:input.recordedOn,status:input.status,fields:{description:input.description},attachment,attachmentKey:key,createdAt:stamp,updatedAt:stamp};
      const result=await persistUploadedFiles(io,[{bucket:DOCUMENT_BUCKET,key,bytes,contentType:attachment.contentType}],async()=>{
        const {data:row,error}=await client.from('nutri_records').insert({kind:'clinicalEntries',data}).select('id,kind,data,version').single();
        if(error)throw error;return entryResult(row);
      },async()=>{
        const {data:row,error}=await client.from('nutri_records').select('id,kind,data,version').eq('kind','clinicalEntries').eq('data->>attachmentKey',key).maybeSingle();
        if(error)throw error;return row?entryResult(row):undefined;
      });
      return reply(result,201);
    }
    if(form&&b.action==='photo'){
      const input=photoInputSchema.parse({patientId:Number(form.get('patientId')),heightCm:Number(form.get('heightCm')),measuredOn:form.get('measuredOn')});
      if(form.get('consent')!=='yes')throw Error('invalid');
      await requirePatient(client,input.patientId);
      const marks=marksSchema.parse(JSON.parse(String(form.get('marks'))));
      const regionMarks=regionMarksSchema.parse(JSON.parse(String(form.get('regionMarks')??'{}')));
      const tapeMeasures=tapeMeasuresSchema.parse(JSON.parse(String(form.get('tapeMeasures')??'{}')));
      const result=estimateBodyFromPhotos(input.heightCm,marks.front,marks.side,regionMarks);
      const files:UploadFile[]=[];
      for(const view of ['front','side']){
        const file=form.get(view);if(!(file instanceof File)||file.size>4*1024*1024)throw Error('invalid');
        const bytes=new Uint8Array(await file.arrayBuffer());validatePhotoBytes(bytes,file.type);
        files.push({bucket,key:crypto.randomUUID()+'.jpg',bytes,contentType:'image/jpeg'});
      }
      const photo={...input,...result,marks,regionMarks,tapeMeasures,frontKey:files[0].key,sideKey:files[1].key,createdAt:new Date().toISOString()};
      return reply(await persistUploadedFiles(io,files,async()=>{
        const {data,error}=await client.from('nutri_records').insert({kind:'photoAssessments',data:photo}).select('id').single();
        if(error)throw error;return {id:data.id,...result};
      },async()=>{
        const {data,error}=await client.from('nutri_records').select('id').eq('kind','photoAssessments').eq('data->>frontKey',files[0].key).eq('data->>sideKey',files[1].key).maybeSingle();
        if(error)throw error;return data?{id:data.id,...result}:undefined;
      }),201);
    }
    if(form)throw Error('invalid');
    if(b.action==='attachmentUrl'){
      const {data:row,error:readError}=await client.from('nutri_records').select('data').eq('kind','clinicalEntries').eq('id',idSchema.parse(b.id)).maybeSingle();
      if(readError)throw readError;if(!row)throw Error('invalid');
      const {data,error}=await client.storage.from(DOCUMENT_BUCKET).createSignedUrl(attachmentKey(row.data),120);
      if(error)throw error;return reply({url:data.signedUrl});
    }
    if(b.action==='photoUrl'){
      const {data:r,error:readError}=await client.from('nutri_records').select('data').eq('kind','photoAssessments').eq('id',idSchema.parse(b.id)).single();
      if(readError)throw readError;if(!r||!['front','side'].includes(b.view))throw Error('invalid');
      const {data,error}=await client.storage.from(bucket).createSignedUrl(r.data[b.view+'Key'],120);if(error)throw error;return reply({url:data.signedUrl});
    }
    if(b.action==='deletePhoto'){
      const {data:r}=await client.from('nutri_records').select('*').eq('kind','photoAssessments').eq('id',idSchema.parse(b.id)).single();if(!r||r.version!==b.version)throw Error('CONFLICT');
      const job={id:crypto.randomUUID(),createdAt:new Date().toISOString(),files:[{bucket,key:r.data.frontKey},{bucket,key:r.data.sideKey}]};
      await io.stage(job);
      const {data,error}=await client.from('nutri_records').delete().eq('id',r.id).eq('version',b.version).select('id');
      if(error)throw error;if(!data.length)throw Error('CONFLICT');
      try{await io.remove(job.files);await io.finish(job.id);}catch{/* The durable reservation retries failed deletion. */}
      return reply({ok:true});
    }
    if(b.action==='import'){
      const backup=backupSchema.parse(b.backup), decoded=prepareBackupFiles(backup);
      const {data:done,error:checkError}=await client.from('nutri_imports').select('id').eq('id',backup.id).maybeSingle();
      if(checkError)throw checkError;if(done)return reply({error:'Este lote já foi importado.'},409);
      const imported:any=structuredClone(backup.workspace), files:UploadFile[]=[];
      for(const photo of imported.photoAssessments){
        const bytes=decoded.photos.get(photo.id)!;
        for(const view of ['front','side'] as const){const key=crypto.randomUUID()+'.jpg';photo[view+'Key']=key;files.push({bucket,key,bytes:bytes[view],contentType:'image/jpeg'});}
      }
      for(const entry of imported.clinicalEntries)if(entry.attachment){
        const bytes=decoded.attachments.get(entry.id)!;
        const key=crypto.randomUUID()+'.'+validateAttachmentBytes(bytes,entry.attachment.contentType);
        entry.attachmentKey=key;files.push({bucket:DOCUMENT_BUCKET,key,bytes,contentType:entry.attachment.contentType});
      }
      try{
        const result=await persistUploadedFiles(io,files,async()=>{
          const {data,error}=await client.rpc('nutri_import',{p_id:backup.id,p_rows:imported});
          if(error){if(error.code==='23505')throw Object.assign(Error('DUPLICATE_IMPORT'),{code:'23505'});throw error;}return {addedPatients:data};
        },async()=>{
          if((await io.references(files)).size!==files.length)return undefined;
          const {data,error}=await client.from('nutri_imports').select('id').eq('id',backup.id).maybeSingle();
          if(error)throw error;return data?{addedPatients:backup.workspace.patients.length}:undefined;
        });
        return reply(result);
      }catch(error){if(error instanceof Error&&error.message==='DUPLICATE_IMPORT')return reply({error:'Este lote já foi importado.'},409);throw error;}
    }
    if(b.action==='revision'){
      const {data,count,error}=await client.from('nutri_records').select('updated_at',{count:'exact'}).order('updated_at',{ascending:false}).limit(1);
      if(error)throw error;return reply({revision:`${count}:${data[0]?.updated_at||''}`});
    }
    const rows=await records(client);
    if(b.action==='load')return reply({rows:publicRows(rows),workspace:workspace(rows)});
    if(b.action==='export'){
      const photos=[];
      for(const row of rows.filter(r=>r.kind==='photoAssessments')){
        const out:any={id:row.id};
        for(const view of ['front','side']){const {data,error}=await client.storage.from(bucket).download(row.data[view+'Key']);if(error)throw error;out[view]=bytesToBase64(new Uint8Array(await data.arrayBuffer()));}
        photos.push(out);
      }
      const attachments=[];
      for(const row of rows.filter(r=>r.kind==='clinicalEntries'&&r.data.attachment)){
        const {data,error}=await client.storage.from(DOCUMENT_BUCKET).download(attachmentKey(row.data));if(error)throw error;
        attachments.push({id:row.id,data:bytesToBase64(new Uint8Array(await data.arrayBuffer()))});
      }
      const backup={format:'nutrimara-backup',version:3,id:crypto.randomUUID(),exportedAt:new Date().toISOString(),workspace:workspace(rows),photos,attachments};
      prepareBackupFiles(backupSchema.parse(backup));
      return reply(backup);
    }
    if(b.action!=='mutate')throw Error('invalid');
    const m=mutationFor(b.body,rows);
    if(m.version!==(b.version??null)||(b.body._version!==undefined&&(b.body._version===null?null:idSchema.parse(b.body._version))!==b.version))throw Error('CONFLICT');
    if(m.data.patientId&&!rows.some(r=>r.kind==='patients'&&r.id===m.data.patientId))throw Error('invalid');
    const operation=m.id?client.from('nutri_records').update({data:m.data,version:m.version!+1,updated_at:new Date().toISOString()}).eq('id',m.id).eq('version',m.version):client.from('nutri_records').insert({kind:m.kind,data:m.data});
    const {data,error}=await operation.select('id,version');
    if(error){if(error.code==='23505')throw Error('CONFLICT');throw error;}if(!data.length)throw Error('CONFLICT');
    const row={id:data[0].id,version:data[0].version,kind:m.kind,data:m.data};
    return reply(m.kind==='clinicalEntries'?entryResult(row):{ok:true,id:row.id,version:row.version});
  }catch(e){return failure(e);}
});
