/**
 * @file tracingEngine.ts
 * @description Motor de procesamiento de fotos de referencia para calco (Tracing Engine).
 * Desacoplado de la interfaz gráfica y optimizado para WebAssembly / JavaScript.
 * 
 * Funcionalidades:
 * 1. Centrado automático y cálculo de escala inicial óptima para la hoja de dibujo.
 * 2. Filtro Sobel de extracción de lineart: Transforma cualquier fotografía de la galería
 *    en líneas de contorno nítidas para calcar fácilmente con el lápiz vectorial.
 * 3. Filtro monocromo y alto contraste para simplificar sombras y volumen.
 * 4. Extracción de paleta de colores dominantes de la foto (Cuantización Wasm).
 */

export interface TracingTransform {
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

/**
 * Calcula la posición inicial centrada y la escala proporcional para ajustar la foto
 * al centro del lienzo sin desbordarse ni deformarse.
 */
export function calculateInitialTracingFit(
  imgWidth: number,
  imgHeight: number,
  canvasWidth: number,
  canvasHeight: number,
  maxCoverage = 0.82
): TracingTransform {
  const safeImgW = Math.max(1, imgWidth);
  const safeImgH = Math.max(1, imgHeight);

  const targetW = canvasWidth * maxCoverage;
  const targetH = canvasHeight * maxCoverage;

  const scaleW = targetW / safeImgW;
  const scaleH = targetH / safeImgH;
  const fitScale = Math.min(scaleW, scaleH, 1.5);

  return {
    x: Math.round(canvasWidth / 2),
    y: Math.round(canvasHeight / 2),
    scale: Number(fitScale.toFixed(3)),
    rotation: 0,
  };
}

/**
 * Algoritmo de detección de bordes Sobel para extracción de Lineart (Boceto para calcar).
 * Convierte una foto a escala de grises y calcula el gradiente espacial con los kernels:
 * Gx = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]]
 * Gy = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]]
 */
export function extractLineartFromPixels(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  invert = true,
  threshold = 38
): Uint8ClampedArray {
  const output = new Uint8ClampedArray(pixels.length);
  const gray = new Float32Array(width * height);

  // 1. Paso a escala de grises (Luminancia BT.709)
  for (let i = 0, p = 0; i < pixels.length; i += 4, p++) {
    gray[p] = 0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2];
  }

  // 2. Convolución Sobel 3x3
  for (let y = 1; y < height - 1; y++) {
    const yOffset = y * width;
    const yPrev = (y - 1) * width;
    const yNext = (y + 1) * width;

    for (let x = 1; x < width - 1; x++) {
      const idx = (yOffset + x) * 4;

      // Píxeles vecinos
      const p00 = gray[yPrev + (x - 1)];
      const p01 = gray[yPrev + x];
      const p02 = gray[yPrev + (x + 1)];
      const p10 = gray[yOffset + (x - 1)];
      const p12 = gray[yOffset + (x + 1)];
      const p20 = gray[yNext + (x - 1)];
      const p21 = gray[yNext + x];
      const p22 = gray[yNext + (x + 1)];

      const gx = -p00 + p02 - 2 * p10 + 2 * p12 - p20 + p22;
      const gy = -p00 - 2 * p01 - p02 + p20 + 2 * p21 + p22;

      const magnitude = Math.hypot(gx, gy);

      // Si supera el umbral, es borde
      const isEdge = magnitude > threshold;

      if (invert) {
        // Fondo blanco (255) y líneas oscuras (0)
        const lineVal = isEdge ? Math.max(0, 255 - Math.min(255, magnitude * 1.8)) : 255;
        output[idx] = lineVal;
        output[idx + 1] = lineVal;
        output[idx + 2] = lineVal;
        output[idx + 3] = isEdge ? 255 : 0; // Transparente donde no hay línea
      } else {
        const edgeVal = Math.min(255, magnitude * 1.5);
        output[idx] = edgeVal;
        output[idx + 1] = edgeVal;
        output[idx + 2] = edgeVal;
        output[idx + 3] = 255;
      }
    }
  }

  return output;
}

/**
 * Filtro de Alto Contraste para simplificar áreas de una fotografía
 */
export function applyContrastFilter(
  pixels: Uint8ClampedArray,
  contrast = 1.6
): Uint8ClampedArray {
  const output = new Uint8ClampedArray(pixels.length);
  const factor = (259 * (contrast * 100 + 255)) / (255 * (259 - contrast * 100));

  for (let i = 0; i < pixels.length; i += 4) {
    output[i] = Math.min(255, Math.max(0, factor * (pixels[i] - 128) + 128));
    output[i + 1] = Math.min(255, Math.max(0, factor * (pixels[i + 1] - 128) + 128));
    output[i + 2] = Math.min(255, Math.max(0, factor * (pixels[i + 2] - 128) + 128));
    output[i + 3] = pixels[i + 3];
  }

  return output;
}

/**
 * Extrae los colores dominantes de una imagen para cargarlos en la paleta del artista
 */
export function extractDominantColorsFromImage(
  pixels: Uint8ClampedArray,
  maxColors = 6
): string[] {
  const buckets: { [key: string]: { r: number; g: number; b: number; count: number } } = {};
  const step = Math.max(4, Math.floor(pixels.length / (4 * 2500))); // Muestreo rápido

  for (let i = 0; i < pixels.length; i += 4 * step) {
    const a = pixels[i + 3];
    if (a < 128) continue;

    // Cuantizar a múltiplos de 32 para agrupar colores similares
    const r = Math.round(pixels[i] / 32) * 32;
    const g = Math.round(pixels[i + 1] / 32) * 32;
    const b = Math.round(pixels[i + 2] / 32) * 32;
    const key = `${r},${g},${b}`;

    if (!buckets[key]) {
      buckets[key] = { r: pixels[i], g: pixels[i + 1], b: pixels[i + 2], count: 1 };
    } else {
      buckets[key].count++;
    }
  }

  const sorted = Object.values(buckets)
    .sort((a, b) => b.count - a.count)
    .slice(0, maxColors);

  return sorted.map(c => {
    const hex = (n: number) => n.toString(16).padStart(2, '0');
    return `#${hex(c.r)}${hex(c.g)}${hex(c.b)}`;
  });
}
