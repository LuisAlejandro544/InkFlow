/**
 * @file useCanvasResizeHandler.ts
 * @description Hook especializado en la expansión y redimensionado del lienzo (Canvas Resize & Expansion).
 * 
 * Gestiona:
 * - Cálculo de offsets según la matriz de anclaje 3x3.
 * - Reubicación de los mapas de bits de todas las capas en nuevos canvas del tamaño de destino.
 * - Desplazamiento simultáneo de las curvas vectoriales analíticas de Kotlin/Wasm (`offsetAllStrokes`).
 * - Reubicación de la foto de calco activa.
 * - Actualización de estado y persistencia en SQLite Wasm.
 */

import { useCallback } from 'react';
import { Layer, ProjectData, TracingReference } from '../engine/types';
import { CanvasAnchor, calculateResizeOffsets } from '../engine/canvasResizeMath';
import { kotlinVectorEngine } from '../engine/kotlinWasmBridge';
import { sqliteStorageService } from '../storage/sqliteStorageService';

interface UseCanvasResizeHandlerProps {
  currentProject: ProjectData;
  layers: Layer[];
  tracingRef: TracingReference | null;
  saveUndoSnapshot: () => void;
  setCurrentProject: React.Dispatch<React.SetStateAction<ProjectData>>;
  setLayers: React.Dispatch<React.SetStateAction<Layer[]>>;
  setProjects: React.Dispatch<React.SetStateAction<ProjectData[]>>;
  setTracingRef: React.Dispatch<React.SetStateAction<TracingReference | null>>;
}

export function useCanvasResizeHandler({
  currentProject,
  layers,
  tracingRef,
  saveUndoSnapshot,
  setCurrentProject,
  setLayers,
  setProjects,
  setTracingRef,
}: UseCanvasResizeHandlerProps) {
  const handleApplyCanvasResize = useCallback(
    (newWidth: number, newHeight: number, anchor: CanvasAnchor) => {
      const oldWidth = currentProject.width;
      const oldHeight = currentProject.height;

      if (newWidth === oldWidth && newHeight === oldHeight) return;

      const { offsetX, offsetY } = calculateResizeOffsets(oldWidth, oldHeight, newWidth, newHeight, anchor);

      saveUndoSnapshot();

      const resizedLayers: Layer[] = layers.map((layer) => {
        const newCanvas = document.createElement('canvas');
        newCanvas.width = newWidth;
        newCanvas.height = newHeight;
        const newCtx = newCanvas.getContext('2d')!;

        newCtx.drawImage(layer.canvas, offsetX, offsetY);

        return {
          ...layer,
          canvas: newCanvas,
          ctx: newCtx,
        };
      });

      kotlinVectorEngine.offsetAllStrokes(offsetX, offsetY);

      if (tracingRef && (offsetX !== 0 || offsetY !== 0)) {
        setTracingRef({
          ...tracingRef,
          x: tracingRef.x + offsetX,
          y: tracingRef.y + offsetY,
        });
      }

      const updatedProj: ProjectData = {
        ...currentProject,
        width: newWidth,
        height: newHeight,
        updatedAt: Date.now(),
      };

      setCurrentProject(updatedProj);
      setLayers(resizedLayers);

      setProjects((prev) => prev.map((p) => (p.id === updatedProj.id ? updatedProj : p)));
      sqliteStorageService.scheduleAutoSave(updatedProj, resizedLayers, 500);
    },
    [currentProject, layers, tracingRef, saveUndoSnapshot, setCurrentProject, setLayers, setProjects, setTracingRef]
  );

  return { handleApplyCanvasResize };
}
