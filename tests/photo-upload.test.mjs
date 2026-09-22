import test from "node:test";
import assert from "node:assert/strict";
import { validatePhotoBytes } from "../lib/photo-upload.ts";

test("aceita JPEG compacto produzido pela câmera do navegador", () => {
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
  assert.doesNotThrow(() => validatePhotoBytes(bytes, "image/jpeg"));
});

test("rejeita arquivo com tipo ou assinatura diferente da imagem permitida", () => {
  assert.throws(() => validatePhotoBytes(new Uint8Array([60, 115, 118, 103, 62]), "image/jpeg"));
  assert.throws(() => validatePhotoBytes(new Uint8Array([0xff, 0xd8, 0xff]), "image/svg+xml"));
});

test("rejeita fotografia acima do limite de tamanho", () => {
  const bytes = new Uint8Array(4 * 1024 * 1024 + 1);
  bytes.set([0xff, 0xd8, 0xff]);
  assert.throws(() => validatePhotoBytes(bytes, "image/jpeg"));
});
