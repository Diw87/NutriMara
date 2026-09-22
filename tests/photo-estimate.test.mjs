import test from "node:test";
import assert from "node:assert/strict";
import { estimateWaistFromPhotos } from "../lib/photo-estimate.ts";

const front = {
  width: 600, height: 1200,
  head: { x: 0.5, y: 0.1 }, feet: { x: 0.5, y: 0.9 },
  left: { x: 0.3, y: 0.5 }, right: { x: 0.7, y: 0.5 },
};
const side = {
  width: 600, height: 1200,
  head: { x: 0.5, y: 0.1 }, feet: { x: 0.5, y: 0.9 },
  left: { x: 0.4, y: 0.5 }, right: { x: 0.6, y: 0.5 },
};

test("calibra as larguras nas duas fotos pela altura e estima o contorno aproximado", () => {
  const result = estimateWaistFromPhotos(180, front, side);
  assert.equal(result.frontWidthCm, 45);
  assert.equal(result.sideDepthCm, 22.5);
  assert.ok(result.waistEstimateCm >= 109 && result.waistEstimateCm <= 110);
});

test("rejeita marcações invertidas ou corpo parcialmente fora do enquadramento", () => {
  assert.throws(() => estimateWaistFromPhotos(180, { ...front, left: front.right, right: front.left }, side));
  assert.throws(() => estimateWaistFromPhotos(180, { ...front, feet: { x: 0.5, y: 0.28 } }, side));
});

test("rejeita altura e pontos sem escala plausível", () => {
  assert.throws(() => estimateWaistFromPhotos(0, front, side));
  assert.throws(() => estimateWaistFromPhotos(180, { ...front, left: { x: -0.1, y: 0.5 } }, side));
});
