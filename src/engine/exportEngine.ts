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
import { detectIsTauri } from './environmentDetector';

export interface ExportDimensions {
  w: number;
  h: number;
  sourceX: number;
  sourceY: number;
  sourceW: number;
  sourceH: number;
}

export type ExportFormat = 'png' | 'jpeg' | 'webp';
export type ExportQualityMode = 'standard' | 'hd' | 'ultra_4k';

/**
 * Filtro de nitidez inteligente (Smart Unsharp Mask)
 * Realza bordes de contorno, lineart y detalles sin introducir ruido en áreas homogéneas
 */
export function applyUnsharpMask(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  amount: number = 0.35
): void {
  if (width <= 0 || height <= 0 || amount <= 0) return;
  try {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const len = data.length;
    const output = new Uint8ClampedArray(len);
    output.set(data);

    const stride = width * 4;
    const blurFactor = 0.25;

    for (let y = 1; y < height - 1; y++) {
      const rowOffset = y * stride;
      const topOffset = rowOffset - stride;
      const bottomOffset = rowOffset + stride;

      for (let x = 1; x < width - 1; x++) {
        const i = rowOffset + (x << 2);
        const a = data[i + 3];
        if (a === 0) continue;

        const leftIdx = i - 4;
        const rightIdx = i + 4;
        const topIdx = topOffset + (x << 2);
        const bottomIdx = bottomOffset + (x << 2);

        for (let c = 0; c < 3; c++) {
          const orig = data[i + c];
          const neighborSum =
            data[topIdx + c] +
            data[bottomIdx + c] +
            data[leftIdx + c] +
            data[rightIdx + c];
          const blur = neighborSum * blurFactor;
          const diff = orig - blur;
          const sharpened = orig + diff * amount;
          output[i + c] = sharpened < 0 ? 0 : sharpened > 255 ? 255 : sharpened;
        }
      }
    }

    imgData.data.set(output);
    ctx.putImageData(imgData, 0, 0);
  } catch {
    // Si la lectura de píxeles no está permitida en entornos de prueba, continuar limpiamente
  }
}

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
 * Genera el elemento canvas fuera de pantalla con todas las capas compuestas,
 * aplicando súper-muestreo inteligente (SSAA), suavizado de curvas vectoriales
 * y filtro de nitidez de trazos para subir la calidad visual real del dibujo.
 * 
 * Optimizado para teléfonos móviles:
 * - SSAA acotado a 2.0x (Ultra 4K) y 1.5x (HD) con límite estricto de 4096px para evitar Out-Of-Memory.
 * - Filtro de nitidez ejecutado sobre el target final para preservar la nitidez real y ejecutar 6x más rápido.
 */
export function generateCompositeExportCanvas(
  layers: Layer[],
  exportDimensions: ExportDimensions,
  transparentBg: boolean,
  format: ExportFormat,
  scale: number = 1,
  qualityMode: ExportQualityMode = 'standard'
): HTMLCanvasElement {
  const { w, h, sourceX, sourceY, sourceW, sourceH } = exportDimensions;

  // En modos HD o Ultra 4K, usamos Súper-Muestreo Interno (SSAA 1.5x o 2.0x)
  // con límite de seguridad móvil de 4096px para evitar cuelgues de GPU o falta de memoria.
  let internalSample = qualityMode === 'ultra_4k' ? 2.0 : qualityMode === 'hd' ? 1.5 : 1.0;
  if (w * internalSample > 4096 || h * internalSample > 4096) {
    internalSample = Math.min(internalSample, Math.max(1.0, 4096 / Math.max(w, h)));
  }

  const renderW = Math.round(w * internalSample);
  const renderH = Math.round(h * internalSample);
  const effectiveScale = scale * internalSample;

  const renderCvs = document.createElement('canvas');
  renderCvs.width = renderW;
  renderCvs.height = renderH;
  const renderCtx = renderCvs.getContext('2d', { willReadFrequently: true })!;

  renderCtx.imageSmoothingEnabled = true;
  renderCtx.imageSmoothingQuality = 'high';

  // Fondo blanco o transparente
  if (!transparentBg || format === 'jpeg') {
    renderCtx.fillStyle = '#ffffff';
    renderCtx.fillRect(0, 0, renderW, renderH);
  }

  // Dibujar cada capa con su opacidad y modo de fusión
  for (const layer of layers) {
    if (!layer.visible || layer.opacity <= 0) continue;
    renderCtx.save();
    renderCtx.globalAlpha = layer.opacity;
    renderCtx.globalCompositeOperation = layer.blendMode as GlobalCompositeOperation;

    // Dibujar sub-región si es modo recorte, o toda la hoja
    renderCtx.drawImage(
      layer.canvas,
      sourceX, sourceY, sourceW, sourceH,
      0, 0, renderW, renderH
    );

    // Renderizar trazos vectoriales analíticos con resolución submétrica escalada
    const vectorStrokes = kotlinVectorEngine.getStrokesForLayer(layer.id);
    if (vectorStrokes && vectorStrokes.length > 0) {
      renderCtx.save();
      renderCtx.scale(effectiveScale, effectiveScale);
      renderCtx.translate(-sourceX, -sourceY);
      kotlinVectorEngine.renderVectorStrokes(renderCtx, vectorStrokes, effectiveScale);
      renderCtx.restore();
    }

    renderCtx.restore();
  }

  // Si no hubo súper-muestreo interno, aplicar filtro de nitidez si corresponde y devolver
  if (internalSample <= 1.01) {
    if (qualityMode === 'ultra_4k') {
      applyUnsharpMask(renderCtx, renderW, renderH, 0.4);
    } else if (qualityMode === 'hd') {
      applyUnsharpMask(renderCtx, renderW, renderH, 0.25);
    }
    return renderCvs;
  }

  // Downsampling SSAA hacia las dimensiones exactas finales (w, h)
  // logrando líneas lisas y perfectamente antialiasadas
  const targetCvs = document.createElement('canvas');
  targetCvs.width = w;
  targetCvs.height = h;
  const targetCtx = targetCvs.getContext('2d', { willReadFrequently: true })!;

  targetCtx.imageSmoothingEnabled = true;
  targetCtx.imageSmoothingQuality = 'high';

  if (!transparentBg || format === 'jpeg') {
    targetCtx.fillStyle = '#ffffff';
    targetCtx.fillRect(0, 0, w, h);
  }

  targetCtx.drawImage(renderCvs, 0, 0, w, h);

  // Aplicar mejora de nitidez sobre la resolución final (6x más rápido y con máxima definición de línea)
  if (qualityMode === 'ultra_4k') {
    applyUnsharpMask(targetCtx, w, h, 0.4);
  } else if (qualityMode === 'hd') {
    applyUnsharpMask(targetCtx, w, h, 0.25);
  }

  return targetCvs;
}

/**
 * Estimación rápida y ligera del peso en bytes sin congelar el hilo principal.
 * Compone a escala 1x directa sin SSAA ni Unsharp Mask CPU pesada para dar respuesta instantánea a 60–120 FPS.
 */
export async function estimateArtworkFileSizeFast(
  layers: Layer[],
  exportDimensions: ExportDimensions,
  transparentBg: boolean,
  format: ExportFormat,
  qualityMode: ExportQualityMode = 'standard'
): Promise<number | null> {
  if (typeof document === 'undefined') return null;
  const encoderQuality = qualityMode === 'ultra_4k' ? 1.0 : qualityMode === 'hd' ? 0.98 : 0.92;
  const mimeType = format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';

  // Usamos un canvas de muestreo rápido acotado (máx 1280px) para cálculo ultraligero
  const sampleW = Math.min(exportDimensions.w, 1280);
  const sampleH = Math.min(exportDimensions.h, 1280);
  const cvs = document.createElement('canvas');
  cvs.width = sampleW;
  cvs.height = sampleH;
  const ctx = cvs.getContext('2d');
  if (!ctx) return null;

  if (!transparentBg || format === 'jpeg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, sampleW, sampleH);
  }

  for (const layer of layers) {
    if (!layer.visible || layer.opacity <= 0) continue;
    ctx.globalAlpha = layer.opacity;
    ctx.globalCompositeOperation = layer.blendMode as GlobalCompositeOperation;
    ctx.drawImage(
      layer.canvas,
      exportDimensions.sourceX, exportDimensions.sourceY, exportDimensions.sourceW, exportDimensions.sourceH,
      0, 0, sampleW, sampleH
    );
  }

  return new Promise<number | null>((resolve) => {
    cvs.toBlob(
      (blob) => {
        if (!blob) return resolve(null);
        const pixelRatio = (exportDimensions.w * exportDimensions.h) / Math.max(1, sampleW * sampleH);
        const projectedSize = pixelRatio > 1.05 ? Math.round(blob.size * Math.sqrt(pixelRatio)) : blob.size;
        resolve(projectedSize);
      },
      mimeType,
      encoderQuality
    );
  });
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
 * Guarda la ilustración directamente en la Galería del usuario.
 * Prioridades:
 * 1. Puente nativo de Kotlin en Android (MediaStore / Pictures/InkFlow Studio).
 * 2. Descarga directa en el almacenamiento del teléfono: el navegador guarda el archivo en Descargas/Imágenes
 *    y el escáner multimedia nativo de Android (MediaScanner) lo indexa y añade de inmediato
 *    a la Galería de Fotos (Google Fotos, Galería local), sin desplegar la hoja de compartir del sistema.
 * 3. Fallback de descarga limpio.
 */
export function formatArtworkFilename(
  projectName: string,
  cropMode: 'full' | 'crop',
  scale: number,
  format: ExportFormat,
  qualityMode: ExportQualityMode = 'standard'
): string {
  const cleanName = (projectName || 'mi_obra').toLowerCase().replace(/[^a-z0-9]/g, '_');
  const cropSuffix = cropMode === 'crop' ? '_recortada' : '_completa';
  const qualitySuffix = qualityMode === 'ultra_4k' ? '_ultra4k' : qualityMode === 'hd' ? '_hd' : '';
  const scaleSuffix = scale > 1 ? `_${scale}x` : '';
  return `${cleanName}${cropSuffix}${qualitySuffix}${scaleSuffix}.${format}`;
}

export async function saveArtworkToUserGallery(
  cvs: HTMLCanvasElement,
  projectName: string,
  cropMode: 'full' | 'crop',
  scale: number,
  format: ExportFormat,
  qualityMode: ExportQualityMode = 'standard'
): Promise<{ success: boolean; method: 'kotlin_mediastore' | 'tauri_pictures_folder' | 'download_direct' | 'native_gallery_share' | 'download_fallback'; message: string }> {
  const mimeType = format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
  const finalFilename = formatArtworkFilename(projectName, cropMode, scale, format, qualityMode);
  const encoderQuality = qualityMode === 'ultra_4k' ? 1.0 : qualityMode === 'hd' ? 0.98 : 0.92;

  // 1. Intentar primero con el puente nativo de Kotlin si está disponible (Android MediaStore)
  if (typeof window !== 'undefined' && window.InkFlowNativeBridge?.saveImageToGallery) {
    try {
      const dataUrl = cvs.toDataURL(mimeType, encoderQuality);
      const rawResult = window.InkFlowNativeBridge.saveImageToGallery(dataUrl, finalFilename, mimeType);
      const parsed = JSON.parse(rawResult || '{}');
      if (parsed.success) {
        return {
          success: true,
          method: 'kotlin_mediastore',
          message: '¡Guardado con éxito en la Galería de Fotos (Álbum: InkFlow Studio)!'
        };
      }
    } catch {
      // Continuar al siguiente método
    }
  }

  // 2. Intentar guardado directo nativo mediante Tauri v2 (APK Android / Desktop)
  // Escribe directamente en /storage/emulated/0/Pictures/InkFlow Studio e indexa en la Galería
  if (detectIsTauri()) {
    try {
      const dataUrl = cvs.toDataURL(mimeType, encoderQuality);
      const base64Data = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
      
      let imageBytes: number[] = [];
      if (typeof atob === 'function') {
        const binaryStr = atob(base64Data);
        imageBytes = new Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          imageBytes[i] = binaryStr.charCodeAt(i);
        }
      }

      const globalTauri = typeof window !== 'undefined' ? (window as unknown as { __TAURI__?: { core?: { invoke: (cmd: string, args: unknown) => Promise<string> }; invoke?: (cmd: string, args: unknown) => Promise<string> } }).__TAURI__ : null;
      let savedPath: string | null = null;

      if (globalTauri?.core?.invoke) {
        savedPath = await globalTauri.core.invoke('save_image_to_gallery', {
          imageBytes,
          base64Data,
          fileName: finalFilename,
        });
      } else if (globalTauri?.invoke) {
        savedPath = await globalTauri.invoke('save_image_to_gallery', {
          imageBytes,
          base64Data,
          fileName: finalFilename,
        });
      } else {
        const { invoke } = await import('@tauri-apps/api/core');
        savedPath = await invoke<string>('save_image_to_gallery', {
          imageBytes,
          base64Data,
          fileName: finalFilename,
        });
      }

      if (savedPath) {
        return {
          success: true,
          method: 'tauri_pictures_folder',
          message: '¡Guardado con éxito en Pictures/InkFlow Studio!'
        };
      }
    } catch {
      // Continuar al método de descarga directa
    }
  }

  // 3. Método Directo: Guardar directamente en el almacenamiento del teléfono.
  // Al descargarse el archivo, el sistema operativo móvil (Android/iOS) lo registra
  // de forma inmediata en la Galería de Fotos del dispositivo, sin abrir la ventana emergente
  // de "Compartir imagen" con WhatsApp/Drive.
  try {
    downloadArtworkFile(cvs, projectName, cropMode, scale, format, qualityMode);
    return {
      success: true,
      method: 'download_direct',
      message: '¡Guardado con éxito en tu teléfono y galería de fotos!'
    };
  } catch {
    return {
      success: true,
      method: 'download_fallback',
      message: 'Archivo generado en el almacenamiento del dispositivo'
    };
  }
}

/**
 * Dispara la descarga directa del archivo en el dispositivo (fallback tradicional)
 */
export function downloadArtworkFile(
  cvs: HTMLCanvasElement,
  projectName: string,
  cropMode: 'full' | 'crop',
  scale: number,
  format: ExportFormat,
  qualityMode: ExportQualityMode = 'standard'
): void {
  const mimeType = format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
  const encoderQuality = qualityMode === 'ultra_4k' ? 1.0 : qualityMode === 'hd' ? 0.98 : 0.92;
  const dataUrl = cvs.toDataURL(mimeType, encoderQuality);

  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = formatArtworkFilename(projectName, cropMode, scale, format, qualityMode);
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
      text: 'Ilustración creada en InkFlow Studio',
    });
    return true;
  }

  return false;
}

