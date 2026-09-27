/** Retrying an import must never replace a photo committed by another request. */
export async function immutableUpload(storage: {
 upload: (key: string, bytes: Uint8Array, options: {contentType:string;upsert:boolean}) => Promise<{error:unknown}>;
 download: (key: string) => Promise<{data:Blob|null;error:unknown}>;
}, key:string, bytes:Uint8Array) {
 const result=await storage.upload(key,bytes,{contentType:'image/jpeg',upsert:false});
 if(!result.error)return;
 const existing=await storage.download(key);
 if(existing.error||!existing.data)throw result.error;
 const saved=new Uint8Array(await existing.data.arrayBuffer());
 if(saved.length!==bytes.length||saved.some((value,index)=>value!==bytes[index]))throw Error('CONFLICT');
}
