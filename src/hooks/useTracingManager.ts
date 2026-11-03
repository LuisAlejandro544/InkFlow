/**
 * @file useTracingManager.ts
 * @description Hook modular para el subsistema de fotos de referencia y calco interactivo.
 * 
 * Gestiona:
 * - Carga e importación desde la galería de fotos del dispositivo móvil.
 * - Ajuste inicial inteligente (posición centrada y escala proporcional).
 * - Extracción automática de paleta de colores dominantes.
 * - Análisis visual de los 4 roles de grosor de trazo (Contorno, Sombreado, Detalles, Base).
 * - Transformaciones geométricas (desplazamiento, escala, rotación).
 * - Filtros Wasm (Original, Extracción de Lineart, Contraste alto, Escala de grises).
 * - Modos de fijación y alternancia de visibilidad instantánea.
 */

import { useState, useCallback } from 'react';
import { TracingReference, TracingFilterMode } from '../engine/types';
import { 
  calculateInitialTracingFit, 
  extractLineartFromPixels, 
  applyContrastFilter, 
  extractDominantColorsFromImage 
} from '../engine/tracingEngine';
import { analyzeImageStrokeThickness } from '../engine/strokeAssistant';
import { gpuBitmapCache } from '../engine/bitmapCache';

export function useTracingManager() {
  const [tracingRef, setTracingRef] = useState<TracingReference | null>(null);

  /**
   * Importa una imagen desde archivo y ejecuta análisis de calco
   */
  const importTracingPhoto = useCallback((file: File, projectWidth: number, projectHeight: number) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const MAX_DIM = 2048;

        const finalizeTracing = (finalImg: HTMLImageElement, finalSrc: string, finalW: number, finalH: number) => {
          const fit = calculateInitialTracingFit(finalW, finalH, projectWidth, projectHeight);

          const newTracing: TracingReference = {
            id: `trace_${Date.now()}`,
            image: finalImg,
            src: finalSrc,
            x: fit.x,
            y: fit.y,
            width: finalW,
            height: finalH,
            scale: fit.scale,
            rotation: 0,
            opacity: 0.4,
            visible: true,
            isAdjusting: true,
            filterMode: 'original',
          };

          try {
            const off = document.createElement('canvas');
            off.width = Math.min(320, finalW);
            off.height = Math.min(320, finalH);
            const oCtx = off.getContext('2d');
            if (oCtx) {
              oCtx.drawImage(finalImg, 0, 0, off.width, off.height);
              const data = oCtx.getImageData(0, 0, off.width, off.height);
              newTracing.extractedColors = extractDominantColorsFromImage(data.data, 6);
              newTracing.strokeAnalysis = analyzeImageStrokeThickness(data.data, off.width, off.height, fit.scale);
            }
          } catch {
            // Ignorar restricciones
          }

          if (typeof createImageBitmap === 'function') {
            createImageBitmap(finalImg).then((bmp) => {
              gpuBitmapCache.set(`tracing_${newTracing.id}_original`, bmp);
            }).catch(() => {});
          }

          setTracingRef(newTracing);
        };

        if (img.width > MAX_DIM || img.height > MAX_DIM) {
          const ratio = Math.min(MAX_DIM / img.width, MAX_DIM / img.height);
          const finalW = Math.round(img.width * ratio);
          const finalH = Math.round(img.height * ratio);
          const down = document.createElement('canvas');
          down.width = finalW;
          down.height = finalH;
          const dctx = down.getContext('2d');
          if (dctx) {
            dctx.imageSmoothingEnabled = true;
            dctx.imageSmoothingQuality = 'high';
            dctx.drawImage(img, 0, 0, finalW, finalH);
            const finalSrc = down.toDataURL('image/jpeg', 0.92);
            const optImg = new Image();
            optImg.onload = () => {
              finalizeTracing(optImg, finalSrc, finalW, finalH);
            };
            optImg.src = finalSrc;
            return;
          }
        }

        // Si la imagen ya está en dimensiones seguras, img ya está cargada
        finalizeTracing(img, src, img.width, img.height);
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  }, []);

  /**
   * Importa un accesorio / sticker desde la galería (moño, accesorio, adorno, etc.)
   * para posicionarlo y estamparlo de forma permanente en la obra maestra
   */
  const importAccessoryPhoto = useCallback((file: File, projectWidth: number, projectHeight: number) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const MAX_DIM = 1536;

        const finalizeAccessory = (finalImg: HTMLImageElement, finalSrc: string, finalW: number, finalH: number) => {
          const targetSize = Math.min(projectWidth, projectHeight) * 0.45;
          const scale = Math.min(targetSize / finalW, targetSize / finalH, 1.0);

          const newAccessory: TracingReference = {
            id: `accessory_${Date.now()}`,
            image: finalImg,
            src: finalSrc,
            x: Math.round(projectWidth / 2),
            y: Math.round(projectHeight / 2),
            width: finalW,
            height: finalH,
            scale: Math.max(0.05, scale),
            rotation: 0,
            opacity: 1.0,
            visible: true,
            isAdjusting: true,
            filterMode: 'original',
            purpose: 'accessory',
          };

          setTracingRef(newAccessory);
        };

        if (img.width > MAX_DIM || img.height > MAX_DIM) {
          const ratio = Math.min(MAX_DIM / img.width, MAX_DIM / img.height);
          const finalW = Math.round(img.width * ratio);
          const finalH = Math.round(img.height * ratio);
          const down = document.createElement('canvas');
          down.width = finalW;
          down.height = finalH;
          const dctx = down.getContext('2d');
          if (dctx) {
            dctx.imageSmoothingEnabled = true;
            dctx.imageSmoothingQuality = 'high';
            dctx.drawImage(img, 0, 0, finalW, finalH);
            const finalSrc = down.toDataURL('image/png');
            const optImg = new Image();
            optImg.onload = () => {
              finalizeAccessory(optImg, finalSrc, finalW, finalH);
            };
            optImg.src = finalSrc;
            return;
          }
        }

        finalizeAccessory(img, src, img.width, img.height);
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  }, []);

  /**
   * Actualiza propiedades del calco (posición, escala, rotación, opacidad, estado de ajuste)
   */
  const updateTracing = useCallback((update: Partial<TracingReference>) => {
    setTracingRef((prev) => (prev ? { ...prev, ...update } : null));
  }, []);

  /**
   * Aplica filtros visuales (Lineart, Contraste, Blanco y Negro)
   */
  const applyTracingFilter = useCallback((mode: TracingFilterMode) => {
    setTracingRef((prev) => {
      if (!prev) return null;

      if (mode === 'original') {
        const orig = new Image();
        orig.onload = () => {
          setTracingRef((cur) => (cur ? { ...cur, image: orig, filterMode: 'original' } : null));
        };
        orig.src = prev.src;
        return prev;
      }

      const off = document.createElement('canvas');
      off.width = prev.width;
      off.height = prev.height;
      const ctx = off.getContext('2d');
      if (!ctx) return prev;

      const base = new Image();
      base.onload = () => {
        ctx.drawImage(base, 0, 0);
        const imgData = ctx.getImageData(0, 0, off.width, off.height);

        if (mode === 'lineart') {
          const lineart = extractLineartFromPixels(imgData.data, off.width, off.height, true, 34);
          imgData.data.set(lineart);
        } else if (mode === 'contrast') {
          const contrast = applyContrastFilter(imgData.data, 1.8);
          imgData.data.set(contrast);
        } else if (mode === 'grayscale') {
          for (let i = 0; i < imgData.data.length; i += 4) {
            const g = 0.299 * imgData.data[i] + 0.587 * imgData.data[i + 1] + 0.114 * imgData.data[i + 2];
            imgData.data[i] = g;
            imgData.data[i + 1] = g;
            imgData.data[i + 2] = g;
          }
        }

        ctx.putImageData(imgData, 0, 0);
        const filtered = new Image();
        filtered.onload = () => {
          if (typeof createImageBitmap === 'function') {
            createImageBitmap(filtered).then((bmp) => {
              gpuBitmapCache.set(`tracing_${prev.id}_${mode}`, bmp);
            }).catch(() => {});
          }
          setTracingRef((cur) => (cur ? { ...cur, image: filtered, filterMode: mode } : null));
        };
        filtered.src = off.toDataURL();
      };
      base.src = prev.src;
      return prev;
    });
  }, []);

  /**
   * Centra la foto de calco en el lienzo
   */
  const centerTracing = useCallback((projectWidth: number, projectHeight: number) => {
    setTracingRef((prev) =>
      prev
        ? {
            ...prev,
            x: Math.round(projectWidth / 2),
            y: Math.round(projectHeight / 2),
          }
        : null
    );
  }, []);

  /**
   * Confirma la posición y oculta los controles de ajuste
   */
  const confirmTracing = useCallback(() => {
    setTracingRef((prev) => (prev ? { ...prev, isAdjusting: false } : null));
  }, []);

  /**
   * Elimina la foto de calco
   */
  const removeTracing = useCallback(() => {
    setTracingRef(null);
  }, []);

  /**
   * Alterna la visibilidad de la foto de calco
   */
  const toggleTracingVisibility = useCallback(() => {
    setTracingRef((prev) => (prev ? { ...prev, visible: !prev.visible } : null));
  }, []);

  return {
    tracingRef,
    setTracingRef,
    importTracingPhoto,
    importAccessoryPhoto,
    updateTracing,
    applyTracingFilter,
    centerTracing,
    confirmTracing,
    removeTracing,
    toggleTracingVisibility,
  };
}
