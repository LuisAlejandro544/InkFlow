/**
 * @file exportEngine.ts
 * @description Motor desacoplado de composición, estimación de peso y exportación de ilustraciones.
 * 
 * Funcionalidades:
 * - Cálculo de dimensiones de exportación (Hoja Completa vs Auto-Crop recortado a trazos reales).
 * - Renderizado offscreen multicapa respetando opacidades, blend modes y curvas vectoriales Kotlin/Wasm.
 * - Estimación asíncrona de peso en bytes para formatos PNG, JPEG y WebP.
 * - Integración con Web Share API nativa de Android/iOS y descarga de archivos.
 */

import { Layer } from './types';
import { BoundingBoxResult } from './transformMath';
import { kotlinVectorEngine } from './kotlinWasmBridge';

export interface ExportDimensions {
  w: number;
  h: number;
  sourceX: number;
  sourceY: number;
  sourceW: number;
  sourceH: number;
}

export type ExportFormat = 'png' | 'jpeg' | 'webp';

/**
 * Calcula las dimensiones finales y la ventana fuente según el modo de recorte y la escala
 */
export function computeExportDimensions(
  width: number,
  height: number,
  boundingBox: BoundingBoxResult,
  cropMode: 'full' | 'crop',
  scale: number
): ExportDimensions {
  if (cropMode === 'crop' && boundingBox.hasContent) {
    return {
      w: Math.round(boundingBox.width * scale),
      h: Math.round(boundingBox.height * scale),
      sourceX: boundingBox.minX,
      sourceY: boundingBox.minY,
      sourceW: boundingBox.width,
      sourceH: boundingBox.height,
    };
  }
  return {
    w: Math.round(width * scale),
    h: Math.round(height * scale),
    sourceX: 0,
    sourceY: 0,
    sourceW: width,
    sourceH: height,
  };
}

/**
 * Genera el elemento canvas fuera de pantalla con todas las capas compuestas
 */
export function generateCompositeExportCanvas(
  layers: Layer[],
  exportDimensions: ExportDimensions,
  transparentBg: boolean,
  format: ExportFormat,
  scale: number
): HTMLCanvasElement {
  const { w, h, sourceX, sourceY, sourceW, sourceH } = exportDimensions;

  const cvs = document.createElement('canvas');
  cvs.width = w;
  cvs.height = h;
  const ctx = cvs.getContext('2d')!;

  // Fondo blanco o transparente
  if (!transparentBg || format === 'jpeg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
  }

  // Dibujar cada capa con su opacidad y modo de fusión
  for (const layer of layers) {
    if (!layer.visible || layer.opacity <= 0) continue;
    ctx.save();
    ctx.globalAlpha = layer.opacity;
    ctx.globalCompositeOperation = layer.blendMode as GlobalCompositeOperation;

    // Dibujar sub-región si es modo recorte, o toda la hoja
    ctx.drawImage(
      layer.canvas,
      sourceX, sourceY, sourceW, sourceH,
      0, 0, w, h
    );

    // Renderizar trazos vectoriales de Kotlin/Wasm para esta capa sin pérdida de resolución
    const vectorStrokes = kotlinVectorEngine.getStrokesForLayer(layer.id);
    if (vectorStrokes && vectorStrokes.length > 0) {
      ctx.save();
      ctx.scale(scale, scale);
      ctx.translate(-sourceX, -sourceY);
      kotlinVectorEngine.renderVectorStrokes(ctx, vectorStrokes, scale);
      ctx.restore();
    }

    ctx.restore();
  }

  return cvs;
}

/**
 * Calcula el tamaño en bytes de la imagen exportada
 */
export async function estimateArtworkFileSize(
  cvs: HTMLCanvasElement,
  format: ExportFormat,
  quality = 0.92
): Promise<number | null> {
  const mimeType = format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
  return new Promise<number | null>((resolve) => {
    cvs.toBlob(
      (blob) => {
        resolve(blob ? blob.size : null);
      },
      mimeType,
      quality
    );
  });
}

/**
 * Formatea un número de bytes a una cadena legible (B, KB, MB)
 */
export function formatByteSize(bytes: number | null): string {
  if (bytes === null) return 'Calculando...';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Dispara la descarga directa del archivo en el dispositivo
 */
export function downloadArtworkFile(
  cvs: HTMLCanvasElement,
  projectName: string,
  cropMode: 'full' | 'crop',
  scale: number,
  format: ExportFormat
): void {
  const mimeType = format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
  const dataUrl = cvs.toDataURL(mimeType, 0.95);

  const a = document.createElement('a');
  a.href = dataUrl;
  const cleanName = (projectName || 'mi_obra').toLowerCase().replace(/[^a-z0-9]/g, '_');
  const cropSuffix = cropMode === 'crop' ? '_recortada' : '_completa';
  const scaleSuffix = scale === 1 ? '1x' : scale === 2 ? '2x_FHD' : '3x_4K';
  a.download = `${cleanName}${cropSuffix}_${scaleSuffix}.${format}`;
  document.body.appendChild(a);
  a.click();
  if (a.parentNode) {
    a.parentNode.removeChild(a);
  } else {
    a.remove?.();
  }
}

/**
 * Comparte el archivo mediante la Web Share API si está soportada
 */
export async function shareArtworkFile(
  cvs: HTMLCanvasElement,
  projectName: string,
  format: ExportFormat
): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.share) {
    return false;
  }

  const mimeType = format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
  const blob = await new Promise<Blob | null>((resolve) => {
    cvs.toBlob(resolve, mimeType, 0.95);
  });

  if (!blob) return false;

  const cleanName = (projectName || 'mi_obra').toLowerCase().replace(/[^a-z0-9]/g, '_');
  const file = new File([blob], `${cleanName}.${format}`, { type: blob.type });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({
      files: [file],
      title: projectName || 'Mi Obra Maestra',
      text: 'Ilustración creada en IbisPaint WebGPU Studio',
    });
    return true;
  }

  return false;
}
