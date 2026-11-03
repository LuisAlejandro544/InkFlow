/**
 * @file useDrawingHistory.ts
 * @description Hook modular para el historial de Deshacer (Undo) y Rehacer (Redo) potenciado por WebAssembly (Wasm).
 * 
 * Gestiona pilas LIFO de instantáneas comprimidas en memoria lineal WebAssembly mediante `wasmHistoryEngine`.
 * Elimina el desbordamiento de memoria RAM (OOM) en teléfonos móviles sustituyendo los objetos ImageData crudos
 * por palabras comprimidas RLE de 32 bits, reduciendo el consumo de memoria en un 90-98%.
 * Conecta con `kotlinVectorEngine.popStrokeForLayer` para el Lápiz Vectorial analítico.
 */

import { useState, useCallback } from 'react';
import { Layer } from '../engine/types';
import { kotlinVectorEngine } from '../engine/kotlinWasmBridge';
import { wasmHistoryEngine, WasmHistoryStats } from '../engine/wasmHistoryEngine';

export interface UndoSnapshot {
  layerId: string;
  imageData: ImageData;
}

export function useDrawingHistory(
  layers: Layer[],
  activeLayerId: string,
  setLayers: React.Dispatch<React.SetStateAction<Layer[]>>
) {
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  /**
   * Guarda una instantánea de la capa activa en la memoria lineal WebAssembly
   */
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

      // Delegar almacenamiento y compresión a Wasm
      wasmHistoryEngine.saveSnapshot(activeLayer.id, snap);

      setCanUndo(wasmHistoryEngine.canUndo());
      setCanRedo(wasmHistoryEngine.canRedo());
    } catch {
      // Ignorar restricciones en caso de canvas protegido
    }
  }, [layers, activeLayerId]);

  /**
   * Ejecuta la operación de Deshacer (Undo) recuperando la instantánea desde Wasm
   */
  const undo = useCallback(() => {
    if (!wasmHistoryEngine.canUndo()) return;

    // Localizar la capa activa o última modificada para resguardar su estado actual en Redo
    const activeLayer = layers.find((l) => l.id === activeLayerId) || layers[0];
    let currentSnapshot: { layerId: string; imageData: ImageData } | undefined;

    if (activeLayer) {
      try {
        const currentData = activeLayer.ctx.getImageData(
          0,
          0,
          activeLayer.canvas.width,
          activeLayer.canvas.height
        );
        currentSnapshot = { layerId: activeLayer.id, imageData: currentData };
      } catch {}
    }

    const restored = wasmHistoryEngine.undo(currentSnapshot);
    if (restored) {
      const targetLayer = layers.find((l) => l.id === restored.layerId);
      if (targetLayer) {
        targetLayer.ctx.putImageData(restored.imageData, 0, 0);
        kotlinVectorEngine.popStrokeForLayer(targetLayer.id);
        setLayers([...layers]);
      }
    }

    setCanUndo(wasmHistoryEngine.canUndo());
    setCanRedo(wasmHistoryEngine.canRedo());
  }, [layers, activeLayerId, setLayers]);

  /**
   * Ejecuta la operación de Rehacer (Redo) recuperando la instantánea desde Wasm
   */
  const redo = useCallback(() => {
    if (!wasmHistoryEngine.canRedo()) return;

    const activeLayer = layers.find((l) => l.id === activeLayerId) || layers[0];
    let currentSnapshot: { layerId: string; imageData: ImageData } | undefined;

    if (activeLayer) {
      try {
        const currentData = activeLayer.ctx.getImageData(
          0,
          0,
          activeLayer.canvas.width,
          activeLayer.canvas.height
        );
        currentSnapshot = { layerId: activeLayer.id, imageData: currentData };
      } catch {}
    }

    const restored = wasmHistoryEngine.redo(currentSnapshot);
    if (restored) {
      const targetLayer = layers.find((l) => l.id === restored.layerId);
      if (targetLayer) {
        targetLayer.ctx.putImageData(restored.imageData, 0, 0);
        setLayers([...layers]);
      }
    }

    setCanUndo(wasmHistoryEngine.canUndo());
    setCanRedo(wasmHistoryEngine.canRedo());
  }, [layers, activeLayerId, setLayers]);

  /**
   * Reinicia las pilas de deshacer y rehacer en Wasm
   */
  const resetHistory = useCallback(() => {
    wasmHistoryEngine.clear();
    setCanUndo(false);
    setCanRedo(false);
  }, []);

  /**
   * Retorna métricas de compresión del motor Wasm
   */
  const getStats = useCallback((): WasmHistoryStats => {
    return wasmHistoryEngine.getStats();
  }, []);

  return {
    canUndo,
    canRedo,
    saveUndoSnapshot,
    undo,
    redo,
    resetHistory,
    getStats,
  };
}

