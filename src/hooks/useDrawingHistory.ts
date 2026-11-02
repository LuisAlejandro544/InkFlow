/**
 * @file useDrawingHistory.ts
 * @description Hook modular para el historial de Deshacer (Undo) y Rehacer (Redo).
 * 
 * Gestiona pilas LIFO de instantáneas ImageData por capa, integración con kotlinVectorEngine
 * y banderas reactivas `canUndo` / `canRedo`.
 */

import { useRef, useState, useCallback } from 'react';
import { Layer } from '../engine/types';
import { kotlinVectorEngine } from '../engine/kotlinWasmBridge';

export interface UndoSnapshot {
  layerId: string;
  imageData: ImageData;
}

export function useDrawingHistory(
  layers: Layer[],
  activeLayerId: string,
  setLayers: React.Dispatch<React.SetStateAction<Layer[]>>
) {
  const undoStackRef = useRef<UndoSnapshot[]>([]);
  const redoStackRef = useRef<UndoSnapshot[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const saveUndoSnapshot = useCallback(() => {
    const activeLayer = layers.find((l) => l.id === activeLayerId);
    if (!activeLayer) return;

    try {
      const snap = activeLayer.ctx.getImageData(
        0,
        0,
        activeLayer.canvas.width,
        activeLayer.canvas.height
      );
      undoStackRef.current.push({ layerId: activeLayer.id, imageData: snap });
      if (undoStackRef.current.length > 25) {
        undoStackRef.current.shift();
      }
      redoStackRef.current = [];
      setCanUndo(true);
      setCanRedo(false);
    } catch {
      // Ignorar restricciones de canvas manchado
    }
  }, [layers, activeLayerId]);

  const undo = useCallback(() => {
    if (undoStackRef.current.length === 0) return;
    const lastSnap = undoStackRef.current.pop()!;
    const targetLayer = layers.find((l) => l.id === lastSnap.layerId);

    if (targetLayer) {
      const currentSnap = targetLayer.ctx.getImageData(
        0,
        0,
        targetLayer.canvas.width,
        targetLayer.canvas.height
      );
      redoStackRef.current.push({ layerId: targetLayer.id, imageData: currentSnap });

      targetLayer.ctx.putImageData(lastSnap.imageData, 0, 0);
      kotlinVectorEngine.popStrokeForLayer(targetLayer.id);
      setLayers([...layers]);
    }

    setCanUndo(undoStackRef.current.length > 0);
    setCanRedo(true);
  }, [layers, setLayers]);

  const redo = useCallback(() => {
    if (redoStackRef.current.length === 0) return;
    const nextSnap = redoStackRef.current.pop()!;
    const targetLayer = layers.find((l) => l.id === nextSnap.layerId);

    if (targetLayer) {
      const currentSnap = targetLayer.ctx.getImageData(
        0,
        0,
        targetLayer.canvas.width,
        targetLayer.canvas.height
      );
      undoStackRef.current.push({ layerId: targetLayer.id, imageData: currentSnap });

      targetLayer.ctx.putImageData(nextSnap.imageData, 0, 0);
      setLayers([...layers]);
    }

    setCanUndo(true);
    setCanRedo(redoStackRef.current.length > 0);
  }, [layers, setLayers]);

  const resetHistory = useCallback(() => {
    undoStackRef.current = [];
    redoStackRef.current = [];
    setCanUndo(false);
    setCanRedo(false);
  }, []);

  return {
    canUndo,
    canRedo,
    saveUndoSnapshot,
    undo,
    redo,
    resetHistory,
  };
}
