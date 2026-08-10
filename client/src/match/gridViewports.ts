export interface ViewportRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Berechnet für N Match-Teilnehmer die Kamera-Viewports innerhalb eines
 * gemeinsamen Canvas. 1 → Vollbild, 2 → nebeneinander, 3–4 → 2×2 Grid.
 */
export function computeGridViewports(
  count: number,
  canvasWidth: number,
  canvasHeight: number
): ViewportRect[] {
  if (count <= 0) return [];

  if (count === 1) {
    return [{ x: 0, y: 0, width: canvasWidth, height: canvasHeight }];
  }

  if (count === 2) {
    const halfWidth = Math.floor(canvasWidth / 2);
    return [
      { x: 0, y: 0, width: halfWidth, height: canvasHeight },
      { x: halfWidth, y: 0, width: canvasWidth - halfWidth, height: canvasHeight },
    ];
  }

  const halfWidth = Math.floor(canvasWidth / 2);
  const halfHeight = Math.floor(canvasHeight / 2);
  const base = [
    { x: 0, y: 0, width: halfWidth, height: halfHeight },
    { x: halfWidth, y: 0, width: canvasWidth - halfWidth, height: halfHeight },
    { x: 0, y: halfHeight, width: halfWidth, height: canvasHeight - halfHeight },
    {
      x: halfWidth,
      y: halfHeight,
      width: canvasWidth - halfWidth,
      height: canvasHeight - halfHeight,
    },
  ];

  return base.slice(0, count);
}
