import { validatePhotoBytes } from './photo-upload.ts';
import { validateAttachmentBytes } from './attachment-upload.ts';

type BackupFilesInput = {
  workspace: {
    [kind: string]: { id: number; patientId?: number }[];
    patients: { id: number }[];
    plans: { id: number; patientId: number }[];
    clinicalRecords: { id: number; patientId: number }[];
    photoAssessments: { id: number; patientId: number }[];
    clinicalEntries: { id: number; patientId: number; attachment?: { contentType: string; size: number } }[];
  };
  photos: { id: number; front: string; side: string }[];
  attachments: { id: number; data: string }[];
};

export function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}
export function base64ToBytes(value: string) {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value) || !value.length) throw Error('O backup contém um arquivo inválido.');
  return Uint8Array.from(atob(value), c => c.charCodeAt(0));
}
function sameIds(actual: number[], expected: Set<number>) {
  return actual.length === expected.size && new Set(actual).size === expected.size && actual.every(id => expected.has(id));
}
/** Validate the entire batch before uploads or DB changes; IDs are backup-local only. */
export function prepareBackupFiles(backup: BackupFilesInput) {
  const patients = new Set(backup.workspace.patients.map(p => p.id));
  for (const values of Object.values(backup.workspace)) {
    if (new Set(values.map(r => r.id)).size !== values.length) throw Error('O backup contém registros duplicados.');
    for (const record of values) if ('patientId' in record && !patients.has(record.patientId!)) throw Error('O backup contém um vínculo de paciente inválido.');
  }
  for (const records of [backup.workspace.plans, backup.workspace.clinicalRecords]) if (new Set(records.map(r => r.patientId)).size !== records.length) throw Error('O backup contém registros únicos duplicados.');
  const photoIds = new Set(backup.workspace.photoAssessments.map(r => r.id));
  if (!sameIds(backup.photos.map(p => p.id), photoIds)) throw Error('O backup não contém todas as fotografias.');
  const attached = backup.workspace.clinicalEntries.filter(r => r.attachment);
  const attachmentIds = new Set(attached.map(r => r.id));
  if (!sameIds(backup.attachments.map(p => p.id), attachmentIds)) throw Error('O backup não contém todos os anexos.');
  const photos = new Map<number, { front: Uint8Array; side: Uint8Array }>();
  for (const photo of backup.photos) {
    const front = base64ToBytes(photo.front), side = base64ToBytes(photo.side);
    validatePhotoBytes(front, 'image/jpeg'); validatePhotoBytes(side, 'image/jpeg');
    photos.set(photo.id, { front, side });
  }
  const attachments = new Map<number, Uint8Array>();
  const metadata = new Map(attached.map(r => [r.id, r.attachment!]));
  for (const file of backup.attachments) {
    const bytes = base64ToBytes(file.data), record = metadata.get(file.id)!;
    validateAttachmentBytes(bytes, record.contentType);
    if (bytes.length !== record.size) throw Error('O backup contém um anexo com tamanho incorreto.');
    attachments.set(file.id, bytes);
  }
  return { photos, attachments };
}
