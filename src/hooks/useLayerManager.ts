/**
 * @file useLayerManager.ts
 * @description Hook modular para la gestión integral de capas del lienzo en InkFlow Studio.
 * 
 * Gestiona:
 * - Creación de la capa limpia inicial de proyecto.
 * - Operaciones CRUD: Añadir, Duplicar, Fusionar hacia abajo (Merge Down), Borrar contenido y Eliminar capa.
 * - Ajustes de Visibilidad, Opacidad (0 a 1) y Modos de Fusión (BlendMode).
 * - Reordenación de capas hacia arriba y abajo en la pila de composición.
 */

import { useState, useCallback } from 'react';
import { Layer, BlendMode, ProjectData } from '../engine/types';

export function createInitialLayer(width: number = 800, height: number = 1200): Layer | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { desynchronized: true });
  if (!ctx) return null;
  return {
    id: 'layer_default_1',
    name: 'Capa 1',
    visible: true,
    opacity: 1.0,
    blendMode: 'source-over',
    canvas,
    ctx,
  };
}

export function useLayerManager() {
  const [layers, setLayers] = useState<Layer[]>(() => {
    const init = createInitialLayer();
    return init ? [init] : [];
  });
  const [activeLayerId, setActiveLayerId] = useState<string>('layer_default_1');

  /**
   * Inicializa exactamente 1 capa limpia por defecto para el proyecto
   */
  const initProjectLayers = useCallback((proj: ProjectData): Layer[] => {
    const layerCanvas = document.createElement('canvas');
    layerCanvas.width = proj.width;
    layerCanvas.height = proj.height;
    const ctx = layerCanvas.getContext('2d', { desynchronized: true })!;

    const initialLayer: Layer = {
      id: `layer_${Date.now()}_1`,
      name: 'Capa 1',
      visible: true,
      opacity: 1.0,
      blendMode: 'source-over',
      canvas: layerCanvas,
      ctx: ctx,
    };

    setLayers([initialLayer]);
    setActiveLayerId(initialLayer.id);
    return [initialLayer];
  }, []);

  /**
   * Añadir nueva capa encima
   */
  const addLayer = useCallback((width: number, height: number) => {
    const newCanvas = document.createElement('canvas');
    newCanvas.width = width;
    newCanvas.height = height;
    const newCtx = newCanvas.getContext('2d', { desynchronized: true })!;

    const newLayer: Layer = {
      id: `layer_${Date.now()}`,
      name: `Capa ${layers.length + 1}`,
      visible: true,
      opacity: 1.0,
      blendMode: 'source-over',
      canvas: newCanvas,
      ctx: newCtx,
    };

    setLayers((prev) => [...prev, newLayer]);
    setActiveLayerId(newLayer.id);
  }, [layers.length]);

  /**
   * Duplicar capa existente
   */
  const duplicateLayer = useCallback((id: string, width: number, height: number) => {
    const srcLayer = layers.find((l) => l.id === id);
    if (!srcLayer) return;

    const dupCanvas = document.createElement('canvas');
    dupCanvas.width = width;
    dupCanvas.height = height;
    const dupCtx = dupCanvas.getContext('2d', { desynchronized: true })!;
    dupCtx.drawImage(srcLayer.canvas, 0, 0);

    const dupLayer: Layer = {
      id: `layer_${Date.now()}`,
      name: `${srcLayer.name} (Copia)`,
      visible: srcLayer.visible,
      opacity: srcLayer.opacity,
      blendMode: srcLayer.blendMode,
      canvas: dupCanvas,
      ctx: dupCtx,
    };

    const idx = layers.findIndex((l) => l.id === id);
    const updated = [...layers];
    updated.splice(idx + 1, 0, dupLayer);
    setLayers(updated);
    setActiveLayerId(dupLayer.id);
  }, [layers]);

  /**
   * Fusionar capa hacia abajo (Merge Down)
   */
  const mergeDown = useCallback((id: string, onSaveUndoSnapshot: () => void) => {
    const idx = layers.findIndex((l) => l.id === id);
    if (idx <= 0) return;

    onSaveUndoSnapshot();
    const upperLayer = layers[idx];
    const lowerLayer = layers[idx - 1];

    lowerLayer.ctx.save();
    lowerLayer.ctx.globalAlpha = upperLayer.opacity;
    lowerLayer.ctx.globalCompositeOperation = upperLayer.blendMode as GlobalCompositeOperation;
    lowerLayer.ctx.drawImage(upperLayer.canvas, 0, 0);
    lowerLayer.ctx.restore();

    const updated = layers.filter((l) => l.id !== upperLayer.id);
    setLayers(updated);
    setActiveLayerId(lowerLayer.id);
  }, [layers]);

  /**
   * Eliminar capa (mantiene al menos 1 capa)
   */
  const deleteLayer = useCallback((id: string) => {
    if (layers.length <= 1) return;
    const updated = layers.filter((l) => l.id !== id);
    setLayers(updated);
    if (activeLayerId === id) {
      setActiveLayerId(updated[updated.length - 1].id);
    }
  }, [layers, activeLayerId]);

  /**
   * Limpiar contenido de la capa actual
   */
  const clearLayer = useCallback((id: string, width: number, height: number, onSaveUndoSnapshot: () => void) => {
    const layer = layers.find((l) => l.id === id);
    if (!layer) return;
    onSaveUndoSnapshot();
    layer.ctx.clearRect(0, 0, width, height);
    setLayers((prev) => [...prev]);
  }, [layers]);

  /**
   * Alternar visibilidad de la capa
   */
  const toggleVisibility = useCallback((id: string) => {
    setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)));
  }, []);

  /**
   * Modificar opacidad de la capa
   */
  const changeOpacity = useCallback((id: string, opacity: number) => {
    setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, opacity } : l)));
  }, []);

  /**
   * Modificar modo de fusión
   */
  const changeBlendMode = useCallback((id: string, mode: BlendMode) => {
    setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, blendMode: mode } : l)));
  }, []);

  /**
   * Mover capa arriba o abajo
   */
  const moveLayer = useCallback((id: string, direction: 'up' | 'down') => {
    setLayers((prev) => {
      const idx = prev.findIndex((l) => l.id === id);
      if (idx === -1) return prev;
      const targetIdx = direction === 'up' ? idx + 1 : idx - 1;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;

      const updated = [...prev];
      const [moved] = updated.splice(idx, 1);
      updated.splice(targetIdx, 0, moved);
      return updated;
    });
  }, []);

  return {
    layers,
    setLayers,
    activeLayerId,
    setActiveLayerId,
    initProjectLayers,
    addLayer,
    duplicateLayer,
    mergeDown,
    deleteLayer,
    clearLayer,
    toggleVisibility,
    changeOpacity,
    changeBlendMode,
    moveLayer,
  };
}
