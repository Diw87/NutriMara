import { DOCUMENT_BUCKET } from './attachment-upload.ts';
import type { FileKey, UploadJob, UploadStore } from './staged-upload.ts';
const PHOTO_BUCKET = 'nutrimara-private';
function validFiles(files: FileKey[]) {
  if (!Array.isArray(files) || !files.length || files.some(file => ![DOCUMENT_BUCKET, PHOTO_BUCKET].includes(file.bucket) || typeof file.key !== 'string' || !/^[A-Za-z0-9/_-]+\.(?:pdf|png|jpg)$/.test(file.key))) throw Error('invalid');
}
/** Only the service client returned by authorize may construct this adapter. */
export function uploadStore(client: any): UploadStore {
  return {
    async stage(job) {
      validFiles(job.files);
      const { error } = await client.from('nutri_uploads').insert({id:job.id,files:job.files,created_at:job.createdAt});
      if (error) throw error;
    },
    async upload(file) {
      const { error } = await client.storage.from(file.bucket).upload(file.key,file.bytes,{contentType:file.contentType,upsert:false});
      if (error) throw error;
    },
    async references(files) {
      validFiles(files);
      const linked = new Set<string>();
      for (const file of files) {
        let query = client.from('nutri_records').select('id');
        query = file.bucket === DOCUMENT_BUCKET ? query.eq('kind','clinicalEntries').eq('data->>attachmentKey',file.key)
          : query.eq('kind','photoAssessments').or(`data->>frontKey.eq.${file.key},data->>sideKey.eq.${file.key}`);
        const { data, error } = await query.limit(1);
        if (error) throw error;
        if (data.length) linked.add(`${file.bucket}/${file.key}`);
      }
      return linked;
    },
    async remove(files) {
      validFiles(files);
      for (const bucket of new Set(files.map(file => file.bucket))) {
        const { error } = await client.storage.from(bucket).remove(files.filter(file => file.bucket === bucket).map(file => file.key));
        if (error) throw error;
      }
    },
    async finish(id) {
      const { error } = await client.from('nutri_uploads').delete().eq('id',id);
      if (error) throw error;
    },
    async pending(before,limit) {
      const { data, error } = await client.from('nutri_uploads').select('id,files,created_at').lt('created_at',before).order('created_at').limit(limit);
      if (error) throw error;
      return data.map((row: any): UploadJob => { validFiles(row.files); return {id:row.id,files:row.files,createdAt:row.created_at}; });
    },
  };
}
