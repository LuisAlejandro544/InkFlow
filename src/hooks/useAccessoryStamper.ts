/**
 * @file useAccessoryStamper.ts
 * @description Hook especializado en el estampado permanente de accesorios fotográficos, lazos y stickers.
 * 
 * Gestiona:
 * - Renderizado offscreen con rotación, escala, traslación y opacidad.
 * - Estampado sobre la capa activa seleccionada o generación de una nueva capa dedicada.
 * - Guardado atómico de snapshot para Deshacer/Rehacer y auto-guardado en SQLite Wasm (OPFS).
 */

import { useCallback } from 'react';
import { Layer, ProjectData, TracingReference } from '../engine/types';
import { sqliteStorageService } from '../storage/sqliteStorageService';
import { gpuBitmapCache } from '../engine/bitmapCache';

interface UseAccessoryStamperProps {
  currentProject: ProjectData;
  layers: Layer[];
  activeLayerId: string;
  tracingRef: TracingReference | null;
  saveUndoSnapshot: () => void;
  setLayers: React.Dispatch<React.SetStateAction<Layer[]>>;
  setActiveLayerId: (id: string) => void;
  removeTracing: () => void;
}

export function useAccessoryStamper({
  currentProject,
  layers,
  activeLayerId,
  tracingRef,
  saveUndoSnapshot,
  setLayers,
  setActiveLayerId,
  removeTracing,
}: UseAccessoryStamperProps) {
  const handleStampAccessory = useCallback((asNewLayer: boolean) => {
    if (!tracingRef) return;
    saveUndoSnapshot();

    // 1. Obtener la fuente gráfica: textura GPU en caché, HTMLImageElement o fallback a src
    let imgToDraw: CanvasImageSource | null = tracingRef.image;
    const cachedBmp = gpuBitmapCache.get(`tracing_${tracingRef.id}_${tracingRef.filterMode}`);
    if (cachedBmp) {
      imgToDraw = cachedBmp;
    } else if (!imgToDraw && tracingRef.src) {
      const fallbackImg = new Image();
      fallbackImg.src = tracingRef.src;
      imgToDraw = fallbackImg;
    }

    if (!imgToDraw) return;

    // 2. Cálculo seguro y proporcional de dimensiones con escala aplicada
    const naturalW = tracingRef.width || (imgToDraw as any).naturalWidth || (imgToDraw as any).width || 300;
    const naturalH = tracingRef.height || (imgToDraw as any).naturalHeight || (imgToDraw as any).height || 300;
    const scale = tracingRef.scale || 1.0;
    const drawWidth = naturalW * scale;
    const drawHeight = naturalH * scale;

    if (asNewLayer) {
      // Estampar en una nueva capa transparente dedicada
      const newCanvas = document.createElement('canvas');
      newCanvas.width = currentProject.width;
      newCanvas.height = currentProject.height;
      const newCtx = newCanvas.getContext('2d', { desynchronized: true })!;

      newCtx.save();
      newCtx.imageSmoothingEnabled = true;
      newCtx.imageSmoothingQuality = 'high';
      newCtx.translate(tracingRef.x, tracingRef.y);
      if (tracingRef.rotation) {
        newCtx.rotate(tracingRef.rotation);
      }
      newCtx.globalAlpha = Math.max(0.01, Math.min(1.0, tracingRef.opacity));
      newCtx.drawImage(
        imgToDraw,
        -drawWidth / 2,
        -drawHeight / 2,
        drawWidth,
        drawHeight
      );
      newCtx.restore();

      const newLayer: Layer = {
        id: `layer_${Date.now()}`,
        name: tracingRef.purpose === 'accessory' ? 'Accesorio' : 'Calco Estampado',
        visible: true,
        opacity: 1.0,
        blendMode: 'source-over',
        canvas: newCanvas,
        ctx: newCtx,
      };

      const updatedLayers = [...layers, newLayer];
      setLayers(updatedLayers);
      setActiveLayerId(newLayer.id);
      sqliteStorageService.scheduleAutoSave(currentProject, updatedLayers, 500);
    } else {
      // Estampar directamente sobre la capa activa seleccionada
      const activeLayer = layers.find((l) => l.id === activeLayerId) || layers[0];
      if (activeLayer) {
        const ctx = activeLayer.ctx;
        ctx.save();
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.translate(tracingRef.x, tracingRef.y);
        if (tracingRef.rotation) {
          ctx.rotate(tracingRef.rotation);
        }
        ctx.globalAlpha = Math.max(0.01, Math.min(1.0, tracingRef.opacity));
        ctx.drawImage(
          imgToDraw,
          -drawWidth / 2,
          -drawHeight / 2,
          drawWidth,
          drawHeight
        );
        ctx.restore();

        // CRUCIAL: Notificar a React con un nuevo array de capas clonadas para forzar
        // que renderComposite y los componentes dependientes actualicen el canvas de pantalla
        const updatedLayers = layers.map((l) => (l.id === activeLayer.id ? { ...l } : l));
        setLayers(updatedLayers);
        sqliteStorageService.scheduleAutoSave(currentProject, updatedLayers, 500);
      }
    }

    removeTracing();
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate(15); } catch {}
    }
  }, [tracingRef, currentProject, layers, activeLayerId, saveUndoSnapshot, setLayers, setActiveLayerId, removeTracing]);

  return { handleStampAccessory };
}
