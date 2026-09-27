export function validatePhotoBytes(bytes: Uint8Array, mime: string) {
  if (mime !== "image/jpeg" || bytes.length < 10 || bytes.length > 4 * 1024 * 1024 ||
    bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
    throw new Error("Use fotos JPG com até 4 MB.");
  }
}
