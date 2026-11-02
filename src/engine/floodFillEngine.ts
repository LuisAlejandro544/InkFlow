/**
 * @file floodFillEngine.ts
 * @description Motor modularizado para el Bote de Pintura (Bucket Fill) con Scanline Flood Fill,
 * dilatación morfológica isotrópica (Border Expansion de 1 a 3 px) para eliminar halos blancos
 * y muestreo de color cromático (Eyedropper).
 */

import { Layer } from './types';

/**
 * Convierte un color hexadecimal (#rrggbb o #rgb) a componentes RGB.
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map((c) => c + c).join('');
  }
  const num = parseInt(cleanHex, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

/**
 * Convierte componentes RGB (0-255) a cadena hexadecimal #rrggbb.
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const h = Math.max(0, Math.min(255, Math.round(n))).toString(16);
    return h.length === 1 ? '0' + h : h;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Dilata una máscara binaria (1 = marcado, 0 = no marcado) en `radius` píxeles.
 * Usado para la expansión de borde en el bote de pintura para eliminar halos blancos y anti-aliasing.
 */
export function dilateBinaryMask(
  mask: Uint8Array,
  width: number,
  height: number,
  radius: number,
  bounds?: { minX: number; maxX: number; minY: number; maxY: number }
): Uint8Array {
  if (radius <= 0) return mask;

  let current = new Uint8Array(mask);
  let minX = bounds ? Math.max(0, bounds.minX) : 0;
  let maxX = bounds ? Math.min(width - 1, bounds.maxX) : width - 1;
  let minY = bounds ? Math.max(0, bounds.minY) : 0;
  let maxY = bounds ? Math.min(height - 1, bounds.maxY) : height - 1;

  for (let r = 0; r < radius; r++) {
    const next = new Uint8Array(current);
    const curMinX = Math.max(0, minX - 1);
    const curMaxX = Math.min(width - 1, maxX + 1);
    const curMinY = Math.max(0, minY - 1);
    const curMaxY = Math.min(height - 1, maxY + 1);

    for (let y = minY; y <= maxY; y++) {
      const rowOffset = y * width;
      for (let x = minX; x <= maxX; x++) {
        if (current[rowOffset + x] === 1) {
          // 4-vecinos y diagonales para expansión suave isotrópica
          if (x > 0) next[rowOffset + (x - 1)] = 1;
          if (x < width - 1) next[rowOffset + (x + 1)] = 1;
          if (y > 0) next[(y - 1) * width + x] = 1;
          if (y < height - 1) next[(y + 1) * width + x] = 1;
          // Diagonales
          if (x > 0 && y > 0) next[(y - 1) * width + (x - 1)] = 1;
          if (x < width - 1 && y > 0) next[(y - 1) * width + (x + 1)] = 1;
          if (x > 0 && y < height - 1) next[(y + 1) * width + (x - 1)] = 1;
          if (x < width - 1 && y < height - 1) next[(y + 1) * width + (x + 1)] = 1;
        }
      }
    }
    current = next;
    minX = curMinX;
    maxX = curMaxX;
    minY = curMinY;
    maxY = curMaxY;
  }

  return current;
}

/**
 * Algoritmo Scanline Flood Fill de alto rendimiento con tolerancia cromática
 * y expansión de borde configurable (1 a 3 px) para eliminar rebordes blancos bajo el lineart.
 */
export function scanlineFloodFill(
  layer: Layer,
  startX: number,
  startY: number,
  fillColorHex: string,
  tolerance: number = 32,
  borderExpansion: number = 0
): boolean {
  const ctx = layer.ctx;
  const width = layer.canvas.width;
  const height = layer.canvas.height;

  const x = Math.floor(startX);
  const y = Math.floor(startY);

  if (x < 0 || x >= width || y < 0 || y >= height) return false;

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  const fillRgb = hexToRgb(fillColorHex);
  const targetIdx = (y * width + x) * 4;
  const targetR = data[targetIdx];
  const targetG = data[targetIdx + 1];
  const targetB = data[targetIdx + 2];
  const targetA = data[targetIdx + 3];

  // Si ya tiene el mismo color exacto, evitar bucle infinito
  if (
    Math.abs(targetR - fillRgb.r) < 2 &&
    Math.abs(targetG - fillRgb.g) < 2 &&
    Math.abs(targetB - fillRgb.b) < 2 &&
    targetA > 250
  ) {
    return false;
  }

  const matchesTarget = (idx: number) => {
    const dr = Math.abs(data[idx] - targetR);
    const dg = Math.abs(data[idx + 1] - targetG);
    const db = Math.abs(data[idx + 2] - targetB);
    const da = Math.abs(data[idx + 3] - targetA);
    return (dr + dg + db + da) / 4 <= tolerance;
  };

  const pixelStack: [number, number][] = [[x, y]];
  const filledMask = new Uint8Array(width * height);
  let minX = x;
  let maxX = x;
  let minY = y;
  let maxY = y;

  while (pixelStack.length > 0) {
    const [curX, curY] = pixelStack.pop()!;
    let newY = curY;
    let idx = (newY * width + curX) * 4;

    // Buscar el borde superior
    while (newY >= 0 && matchesTarget(idx)) {
      newY--;
      idx -= width * 4;
    }
    newY++;
    idx += width * 4;

    let spanLeft = false;
    let spanRight = false;

    while (newY < height && matchesTarget(idx)) {
      const pos = newY * width + curX;
      filledMask[pos] = 1;
      if (curX < minX) minX = curX;
      if (curX > maxX) maxX = curX;
      if (newY < minY) minY = newY;
      if (newY > maxY) maxY = newY;

      // Comprobar pixel a la izquierda
      if (curX > 0) {
        const leftIdx = idx - 4;
        const leftPos = newY * width + (curX - 1);
        if (matchesTarget(leftIdx)) {
          if (!spanLeft && !filledMask[leftPos]) {
            pixelStack.push([curX - 1, newY]);
            spanLeft = true;
          }
        } else if (spanLeft) {
          spanLeft = false;
        }
      }

      // Comprobar pixel a la derecha
      if (curX < width - 1) {
        const rightIdx = idx + 4;
        const rightPos = newY * width + (curX + 1);
        if (matchesTarget(rightIdx)) {
          if (!spanRight && !filledMask[rightPos]) {
            pixelStack.push([curX + 1, newY]);
            spanRight = true;
          }
        } else if (spanRight) {
          spanRight = false;
        }
      }

      newY++;
      idx += width * 4;
    }
  }

  // Aplicar expansión de borde (dilatación morfológica) si borderExpansion > 0
  const clampedExpansion = Math.min(5, Math.max(0, Math.round(borderExpansion)));
  const finalMask = clampedExpansion > 0
    ? dilateBinaryMask(filledMask, width, height, clampedExpansion, { minX, maxX, minY, maxY })
    : filledMask;

  // Pintar los píxeles marcados en la máscara resultante
  const effectiveMinX = Math.max(0, minX - clampedExpansion);
  const effectiveMaxX = Math.min(width - 1, maxX + clampedExpansion);
  const effectiveMinY = Math.max(0, minY - clampedExpansion);
  const effectiveMaxY = Math.min(height - 1, maxY + clampedExpansion);

  for (let py = effectiveMinY; py <= effectiveMaxY; py++) {
    const rowOffset = py * width;
    for (let px = effectiveMinX; px <= effectiveMaxX; px++) {
      const pIdx = rowOffset + px;
      if (finalMask[pIdx] === 1) {
        const dIdx = pIdx * 4;
        data[dIdx] = fillRgb.r;
        data[dIdx + 1] = fillRgb.g;
        data[dIdx + 2] = fillRgb.b;
        data[dIdx + 3] = 255;
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return true;
}

/**
 * Muestrea el color RGB en un punto específico de un canvas (Eyedropper).
 */
export function pickCanvasColor(ctx: CanvasRenderingContext2D, x: number, y: number): string {
  const px = Math.floor(x);
  const py = Math.floor(y);
  try {
    const pixel = ctx.getImageData(px, py, 1, 1).data;
    return rgbToHex(pixel[0], pixel[1], pixel[2]);
  } catch {
    return '#000000';
  }
}
