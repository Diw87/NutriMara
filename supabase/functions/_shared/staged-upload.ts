export type FileKey = { bucket: string; key: string };
export type UploadFile = FileKey & { bytes: Uint8Array; contentType: string };
export type UploadJob = { id: string; createdAt: string; files: FileKey[] };
export type UploadStore = {
  stage(job: UploadJob): Promise<void>;
  upload(file: UploadFile): Promise<void>;
  references(files: FileKey[]): Promise<Set<string>>;
  remove(files: FileKey[]): Promise<void>;
  finish(id: string): Promise<void>;
  pending(before: string, limit: number): Promise<UploadJob[]>;
};
const fileId = (file: FileKey) => `${file.bucket}/${file.key}`;
function rejectedTransaction(error: unknown) {
  const code = error && typeof error === 'object' ? (error as {code?: unknown}).code : undefined;
  // PostgreSQL statement/transaction failures prove rollback. Connection failures do not.
  return typeof code === 'string' && /^(?:22|23|40|42|XX)[0-9A-Z]{3}$/.test(code);
}
async function settleJob(io: UploadStore, job: UploadJob) {
  const linked = await io.references(job.files);
  const unused = job.files.filter(file => !linked.has(fileId(file)));
  if (unused.length) await io.remove(unused);
  await io.finish(job.id);
}
/** A private durable reservation makes interrupted uploads discoverable for cleanup. */
export async function persistUploadedFiles<T>(io: UploadStore, files: UploadFile[], commit: () => Promise<T>, recover?: () => Promise<T | undefined>): Promise<T> {
  if (!files.length) return commit();
  const job: UploadJob = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), files: files.map(({ bucket, key }) => ({ bucket, key })) };
  await io.stage(job);
  let commitStarted = false;
  try {
    for (const file of files) await io.upload(file);
    commitStarted = true;
    const result = await commit();
    try { await io.finish(job.id); } catch { /* A later cleanup verifies references. */ }
    return result;
  } catch (error) {
    if (commitStarted && recover) {
      try { const saved = await recover(); if (saved !== undefined) { try { await io.finish(job.id); } catch {} return saved; } } catch { /* Preserve data when commit status is unknown. */ }
    }
    // A negative recovery read does not prove an in-flight request will never commit.
    // Keep uncertain uploads and commits reserved until the delayed reference check.
    if (commitStarted && rejectedTransaction(error)) {
      try { await settleJob(io, job); } catch { /* Keep the reservation until DB and storage are reachable. */ }
    }
    throw error;
  }
}
export async function cleanupStagedUploads(io: UploadStore, now = Date.now()) {
  let jobs: UploadJob[];
  try { jobs = await io.pending(new Date(now - 24 * 60 * 60 * 1000).toISOString(), 20); } catch { return; }
  for (const job of jobs) try { await settleJob(io, job); } catch { /* Retry on a later authorized request. */ }
}
