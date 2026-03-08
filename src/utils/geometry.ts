/** All coordinate transforms go through this module. Never do math elsewhere. */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Convert canvas pixel rect to normalised [0,1] rect */
export function pixelToNorm(pixel: Rect, canvasWidth: number, canvasHeight: number): Rect {
  return {
    x: pixel.x / canvasWidth,
    y: pixel.y / canvasHeight,
    width: pixel.width / canvasWidth,
    height: pixel.height / canvasHeight,
  };
}

/** Convert normalised [0,1] rect to canvas pixel rect */
export function normToPixel(norm: Rect, canvasWidth: number, canvasHeight: number): Rect {
  return {
    x: norm.x * canvasWidth,
    y: norm.y * canvasHeight,
    width: norm.width * canvasWidth,
    height: norm.height * canvasHeight,
  };
}

/** Clamp a normalised rect to [0,1] bounds */
export function clampNorm(rect: Rect): Rect {
  const x = Math.max(0, Math.min(1, rect.x));
  const y = Math.max(0, Math.min(1, rect.y));
  const width = Math.max(0, Math.min(1 - x, rect.width));
  const height = Math.max(0, Math.min(1 - y, rect.height));
  return { x, y, width, height };
}

/** Normalise a rect from two corner points (handles negative width/height) */
export function rectFromPoints(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): Rect {
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  };
}

/** Check if two rects intersect */
export function intersects(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

/** Crop a canvas region to a new offscreen canvas */
export function cropCanvas(
  source: HTMLCanvasElement,
  pixelRect: Rect
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(pixelRect.width));
  canvas.height = Math.max(1, Math.round(pixelRect.height));
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(
    source,
    Math.round(pixelRect.x),
    Math.round(pixelRect.y),
    Math.round(pixelRect.width),
    Math.round(pixelRect.height),
    0,
    0,
    canvas.width,
    canvas.height
  );
  return canvas;
}
