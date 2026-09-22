export type Point = { x: number; y: number };
export type MarkedPhoto = {
  width: number;
  height: number;
  head: Point;
  feet: Point;
  left: Point;
  right: Point;
};

function calibratedWidth(heightCm: number, photo: MarkedPhoto) {
  if (!Number.isInteger(photo.width) || !Number.isInteger(photo.height) || photo.width < 200 || photo.height < 400 || photo.width > 5000 || photo.height > 5000) {
    throw new Error("A imagem não tem dimensões válidas.");
  }
  const points = [photo.head, photo.feet, photo.left, photo.right];
  if (points.some((point) => !point || !Number.isFinite(point.x) || !Number.isFinite(point.y) || point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1)) {
    throw new Error("Confira os pontos marcados na foto.");
  }
  const bodyHeight = photo.feet.y - photo.head.y;
  if (bodyHeight < 0.5 || photo.left.x >= photo.right.x ||
    photo.left.y <= photo.head.y || photo.right.y <= photo.head.y ||
    photo.left.y >= photo.feet.y || photo.right.y >= photo.feet.y ||
    Math.abs(photo.left.y - photo.right.y) > 0.08) {
    throw new Error("Marque o corpo inteiro e as duas bordas da cintura na mesma altura.");
  }
  return ((photo.right.x - photo.left.x) * photo.width / (bodyHeight * photo.height)) * heightCm;
}

export function estimateWaistFromPhotos(heightCm: number, front: MarkedPhoto, side: MarkedPhoto) {
  if (!Number.isFinite(heightCm) || heightCm < 60 || heightCm > 230) throw new Error("Informe uma altura entre 60 e 230 cm.");
  const frontWidth = calibratedWidth(heightCm, front);
  const sideDepth = calibratedWidth(heightCm, side);
  if (frontWidth < 10 || frontWidth > 120 || sideDepth < 8 || sideDepth > 110) {
    throw new Error("A largura calculada ficou fora do esperado. Confira as marcações e o enquadramento.");
  }
  // Aproximação geométrica de uma elipse, adequada apenas para comparação visual.
  const a = frontWidth / 2;
  const b = sideDepth / 2;
  const perimeter = Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
  return {
    frontWidthCm: Math.round(frontWidth * 10) / 10,
    sideDepthCm: Math.round(sideDepth * 10) / 10,
    waistEstimateCm: Math.round(perimeter),
  };
}
