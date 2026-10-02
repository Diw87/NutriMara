import type { CloudRecord } from './cloud-actions.ts';
export const CLINIC_KINDS = ['patients','appointments','measurements','plans','photoAssessments','clinicalRecords','clinicalEntries'];
export function publicData(data: Record<string, unknown>) {
  const { frontKey: _front, sideKey: _side, attachmentKey: _attachment, ...visible } = data;
  return visible;
}
export function publicRows(rows: CloudRecord[]) {
  return rows.map(row => ({ ...row, data: publicData(row.data) }));
}
export function publicEntry(row: CloudRecord) {
  return { ...publicData(row.data), id: row.id, _version: row.version };
}
export function workspace(rows: CloudRecord[]) {
  return Object.fromEntries(CLINIC_KINDS.map(kind => [kind, rows.filter(row => row.kind === kind).map(publicEntry).sort((a: any,b: any) => kind === 'patients'
    ? String(a.name).localeCompare(String(b.name),'pt-BR')
    : String(b.recordedOn || b.measuredOn || b.startsAt || '').localeCompare(String(a.recordedOn || a.measuredOn || a.startsAt || '')) || b.id - a.id)]));
}
