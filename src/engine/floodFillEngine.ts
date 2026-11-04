/**
 * @file floodFillEngine.ts
 * @description Motor modularizado para el Bote de Pintura (Bucket Fill) con Scanline Flood Fill,
 * dilatación morfológica isotrópica (Border Expansion de 1 a 3 px) para eliminar halos blancos
 * y muestreo de color cromático (Eyedropper).
 */

import { Layer } from './types';
import { kotlinVectorEngine } from './kotlinWasmBridge';

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
 * Genera una máscara de barrera con cierre morfológico de huecos (Gap-Closing).
 * Detecta líneas de contorno y crea puentes virtuales en aberturas menores a `gapSize` px
 * para evitar que el Bote de Pintura se desborde fuera del dibujo.
 */
export function generateClosedGapBarrierMask(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  gapSize: number,
  targetR: number,
  targetG: number,
  targetB: number,
  targetA: number,
  tolerance: number
): Uint8Array | null {
  if (gapSize <= 0) return null;

  const total = width * height;
  const barrier = new Uint8Array(total);
  const isTargetTransparent = targetA < 35;

  // 1. Identificar píxeles de barrera / líneas de contorno
  for (let i = 0, p = 0; p < total; i += 4, p++) {
    const curA = data[i + 3];
    if (isTargetTransparent) {
      // Si el objetivo es transparente/vacío, cualquier trazo con opacidad es barrera
      if (curA >= 35) {
        barrier[p] = 1;
      }
    } else {
      // Si el objetivo es un trazo, el fondo transparente o colores distintos son barrera
      if (curA < 35) {
        barrier[p] = 1;
      } else {
        const dr = Math.abs(data[i] - targetR);
        const dg = Math.abs(data[i + 1] - targetG);
        const db = Math.abs(data[i + 2] - targetB);
        const diff = (dr + dg + db) / 3;
        if (diff > tolerance) {
          barrier[p] = 1;
        }
      }
    }
  }

  // 2. Puenteo en todas las direcciones de trazos que colisionan o tienen abertura <= gapSize
  const closed = new Uint8Array(barrier);
  const maxD = Math.max(1, Math.min(16, Math.floor(gapSize)));

  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const p = row + x;
      if (barrier[p] === 1) {
        // Horizontal hacia la derecha
        if (x + 2 < width && barrier[p + 1] === 0) {
          for (let d = 2; d <= maxD && x + d < width; d++) {
            if (barrier[row + (x + d)] === 1) {
              for (let k = 1; k < d; k++) {
                closed[row + (x + k)] = 1;
              }
              break;
            }
          }
        }
        // Vertical hacia abajo
        if (y + 2 < height && barrier[(y + 1) * width + x] === 0) {
          for (let d = 2; d <= maxD && y + d < height; d++) {
            if (barrier[(y + d) * width + x] === 1) {
              for (let k = 1; k < d; k++) {
                closed[(y + k) * width + x] = 1;
              }
              break;
            }
          }
        }
        // Diagonal principal (abajo-derecha)
        if (x + 2 < width && y + 2 < height && barrier[(y + 1) * width + (x + 1)] === 0) {
          for (let d = 2; d <= maxD && x + d < width && y + d < height; d++) {
            if (barrier[(y + d) * width + (x + d)] === 1) {
              for (let k = 1; k < d; k++) {
                closed[(y + k) * width + (x + k)] = 1;
              }
              break;
            }
          }
        }
        // Diagonal secundaria (abajo-izquierda)
        if (x - 2 >= 0 && y + 2 < height && barrier[(y + 1) * width + (x - 1)] === 0) {
          for (let d = 2; d <= maxD && x - d >= 0 && y + d < height; d++) {
            if (barrier[(y + d) * width + (x - d)] === 1) {
              for (let k = 1; k < d; k++) {
                closed[(y + k) * width + (x - k)] = 1;
              }
              break;
            }
          }
        }
      }
    }
  }

  return closed;
}

/**
 * Algoritmo Scanline Flood Fill de alto rendimiento con tolerancia cromática,
 * expansión de borde configurable (1 a 3 px) para eliminar rebordes blancos,
 * Cierre Inteligente de Huecos (Gap-Closing de 0 a 10 px) para evitar fugas en lineart abierto
 * y soporte para referencia multicapa y trazos vectoriales analíticos.
 */
export function scanlineFloodFill(
  layer: Layer,
  startX: number,
  startY: number,
  fillColorHex: string,
  tolerance: number = 32,
  borderExpansion: number = 0,
  gapClosing: number = 0,
  referenceLayers?: Layer[]
): boolean {
  const ctx = layer.ctx;
  const width = layer.canvas.width;
  const height = layer.canvas.height;

  const x = Math.floor(startX);
  const y = Math.floor(startY);

  if (x < 0 || x >= width || y < 0 || y >= height) return false;

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  // Obtener datos de referencia para detección de bordes (capas visibles + trazos vectoriales)
  let refData: Uint8ClampedArray = data;

  if (typeof document !== 'undefined') {
    try {
      const refCanvas = document.createElement('canvas');
      refCanvas.width = width;
      refCanvas.height = height;
      const refCtx = refCanvas.getContext('2d');
      if (refCtx) {
        if (referenceLayers && referenceLayers.length > 0) {
          for (const l of referenceLayers) {
            if (!l.visible || l.opacity <= 0) continue;
            refCtx.save();
            refCtx.globalAlpha = l.opacity;
            refCtx.drawImage(l.canvas, 0, 0);
            try {
              const vStrokes = kotlinVectorEngine.getStrokesForLayer(l.id);
              if (vStrokes && vStrokes.length > 0) {
                kotlinVectorEngine.renderVectorStrokes(refCtx, vStrokes, 1.0);
              }
            } catch {
              // Si no hay motor vectorial inicializado, continuar
            }
            refCtx.restore();
          }
        } else {
          refCtx.drawImage(layer.canvas, 0, 0);
          try {
            const vStrokes = kotlinVectorEngine.getStrokesForLayer(layer.id);
            if (vStrokes && vStrokes.length > 0) {
              kotlinVectorEngine.renderVectorStrokes(refCtx, vStrokes, 1.0);
            }
          } catch {
            // Ignorar en entorno sin bridge
          }
        }
        refData = refCtx.getImageData(0, 0, width, height).data;
      }
    } catch {
      refData = data;
    }
  }

  const fillRgb = hexToRgb(fillColorHex);
  const targetIdx = (y * width + x) * 4;
  const targetR = refData[targetIdx];
  const targetG = refData[targetIdx + 1];
  const targetB = refData[targetIdx + 2];
  const targetA = refData[targetIdx + 3];

  // Si ya tiene el mismo color exacto, evitar bucle infinito
  if (
    Math.abs(targetR - fillRgb.r) < 2 &&
    Math.abs(targetG - fillRgb.g) < 2 &&
    Math.abs(targetB - fillRgb.b) < 2 &&
    targetA > 250
  ) {
    return false;
  }

  const isTargetTransparent = targetA < 35;

  // Si se solicita cierre de huecos, calcular barrera morfológica virtual
  const barrierMask = gapClosing > 0
    ? generateClosedGapBarrierMask(refData, width, height, gapClosing, targetR, targetG, targetB, targetA, tolerance)
    : null;

  const matchesTarget = (idx: number, pos: number = idx >> 2) => {
    // Si la máscara de cierre de huecos detectó una barrera o puente virtual, actuar como borde
    if (barrierMask && barrierMask[pos] === 1) {
      return false;
    }

    const curA = refData[idx + 3];

    if (isTargetTransparent) {
      // Estamos rellenando un área vacía / transparente dentro de un trazo cerrado o entre trazos
      // Cualquier trazo existente (curA >= 35) es un límite impenetrable (barrera)
      return curA < 35;
    } else {
      // Estamos rellenando un trazo existente o un área previamente coloreada
      // El fondo transparente NO coincide (el color no debe fugarse al lienzo vacío)
      if (curA < 35) {
        return false;
      }
      const dr = Math.abs(refData[idx] - targetR);
      const dg = Math.abs(refData[idx + 1] - targetG);
      const db = Math.abs(refData[idx + 2] - targetB);
      const diff = (dr + dg + db) / 3;
      return diff <= tolerance;
    }
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

    // Buscar el borde superior sin re-visitar píxeles ya marcados
    while (newY >= 0 && matchesTarget(idx, newY * width + curX) && !filledMask[newY * width + curX]) {
      newY--;
      idx -= width * 4;
    }
    newY++;
    idx += width * 4;

    let spanLeft = false;
    let spanRight = false;

    while (newY < height && matchesTarget(idx, newY * width + curX) && !filledMask[newY * width + curX]) {
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
        if (matchesTarget(leftIdx, leftPos) && !filledMask[leftPos]) {
          if (!spanLeft) {
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
        if (matchesTarget(rightIdx, rightPos) && !filledMask[rightPos]) {
          if (!spanRight) {
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

  // Aplicar expansión de borde (dilatación morfológica) SOLO en relleno de áreas transparentes
  // Si se está pintando un trazo, no dilatar para no engrosar el trazo hacia el vacío
  const clampedExpansion = isTargetTransparent ? Math.min(5, Math.max(0, Math.round(borderExpansion))) : 0;
  const finalMask = clampedExpansion > 0
    ? dilateBinaryMask(filledMask, width, height, clampedExpansion, { minX, maxX, minY, maxY })
    : filledMask;

  // Pintar los píxeles marcados en la capa destino
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
