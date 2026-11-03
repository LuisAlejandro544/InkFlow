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
    if (!tracingRef || !tracingRef.image) return;
    saveUndoSnapshot();

    const drawWidth = tracingRef.width * tracingRef.scale;
    const drawHeight = tracingRef.height * tracingRef.scale;

    if (asNewLayer) {
      const newCanvas = document.createElement('canvas');
      newCanvas.width = currentProject.width;
      newCanvas.height = currentProject.height;
      const newCtx = newCanvas.getContext('2d')!;

      newCtx.save();
      newCtx.translate(tracingRef.x, tracingRef.y);
      if (tracingRef.rotation) {
        newCtx.rotate(tracingRef.rotation);
      }
      newCtx.globalAlpha = Math.max(0.01, Math.min(1.0, tracingRef.opacity));
      newCtx.drawImage(
        tracingRef.image,
        -drawWidth / 2,
        -drawHeight / 2,
        drawWidth,
        drawHeight
      );
      newCtx.restore();

      const newLayer: Layer = {
        id: `layer_${Date.now()}`,
        name: tracingRef.purpose === 'accessory' ? 'Accesorio (Moño)' : 'Calco Estampado',
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
      const activeLayer = layers.find((l) => l.id === activeLayerId) || layers[0];
      if (activeLayer) {
        const ctx = activeLayer.ctx;
        ctx.save();
        ctx.translate(tracingRef.x, tracingRef.y);
        if (tracingRef.rotation) {
          ctx.rotate(tracingRef.rotation);
        }
        ctx.globalAlpha = Math.max(0.01, Math.min(1.0, tracingRef.opacity));
        ctx.drawImage(
          tracingRef.image,
          -drawWidth / 2,
          -drawHeight / 2,
          drawWidth,
          drawHeight
        );
        ctx.restore();
        sqliteStorageService.scheduleAutoSave(currentProject, layers, 500);
      }
    }

    removeTracing();
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate(15); } catch {}
    }
  }, [tracingRef, currentProject, layers, activeLayerId, saveUndoSnapshot, setLayers, setActiveLayerId, removeTracing]);

  return { handleStampAccessory };
}
