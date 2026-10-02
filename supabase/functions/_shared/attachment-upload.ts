export const DOCUMENT_BUCKET = 'nutrimara-documents';
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/** Check declared MIME and file signatures before allocating any storage object. */
export function validateAttachmentBytes(bytes: Uint8Array, mime: string): 'pdf' | 'png' | 'jpg' {
  const invalid = () => { throw Error('Use arquivos PDF, PNG ou JPEG válidos com até 10 MiB.'); };
  if (!bytes.length || bytes.length > MAX_ATTACHMENT_BYTES) return invalid();
  if (mime === 'application/pdf') {
    const header = new TextDecoder().decode(bytes.subarray(0, 8));
    const tail = new TextDecoder().decode(bytes.subarray(Math.max(0, bytes.length - 1024)));
    if (bytes.length < 14 || !/^%PDF-(?:1\.[0-7]|2\.0)$/.test(header) || !/%%EOF\s*$/.test(tail)) return invalid();
    return 'pdf';
  }
  if (mime === 'image/png') {
    const signature = [137,80,78,71,13,10,26,10];
    const end = [0,0,0,0,73,69,78,68,174,66,96,130];
    if (bytes.length < 45 || signature.some((v,i) => bytes[i] !== v) || bytes[8] !== 0 || bytes[9] !== 0 || bytes[10] !== 0 || bytes[11] !== 13 ||
      String.fromCharCode(...bytes.subarray(12,16)) !== 'IHDR' || end.some((v,i) => bytes[bytes.length - 12 + i] !== v)) return invalid();
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (!view.getUint32(16) || !view.getUint32(20)) return invalid();
    return 'png';
  }
  if (mime === 'image/jpeg') {
    if (bytes.length < 10 || bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255 || bytes.at(-2) !== 255 || bytes.at(-1) !== 217) return invalid();
    return 'jpg';
  }
  return invalid();
}
