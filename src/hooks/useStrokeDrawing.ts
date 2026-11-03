/**
 * @file useStrokeDrawing.ts
 * @description Hook especializado en la captura de trazos táctiles, estabilización S-Form y despacho a motores gráficos.
 * 
 * Gestiona:
 * - Conversión de coordenadas de pantalla a píxeles exactos del lienzo considerando rotación y escala (`screenToCanvasCoords`).
 * - Decodificación de presión y amortiguación por velocidad.
 * - Estabilización de trazo en WebAssembly (niveles 0 a 10).
 * - Trazado analítico Bézier para Lápiz Vectorial Kotlin/Wasm.
 * - Despacho de sellos de pincel, aerógrafo y rotulador a WebGPU / Canvas 2D con texturas de superficie.
 * - Bote de pintura (Bucket Fill) con expansión morfológica de borde y cierre de huecos.
 * - Muestreo puntual de color (Eyedropper).
 */

import { useRef, useCallback } from 'react';
import { 
  Point, 
  ToolType, 
  Layer, 
  VectorStroke, 
  BrushTextureConfig, 
  TracingReference 
} from '../engine/types';
import { wasmEngine } from '../engine/wasmEngine';
import { drawingEngine } from '../engine/webgpuEngine';
import { kotlinVectorEngine } from '../engine/kotlinWasmBridge';
import { screenToCanvasCoords } from '../engine/transformMath';

interface UseStrokeDrawingProps {
  projectWidth: number;
  projectHeight: number;
  activeLayer: Layer;
  activeTool: ToolType;
  lastDrawingTool: ToolType;
  brushColor: string;
  brushSize: number;
  brushOpacity: number;
  brushTexture?: BrushTextureConfig;
  stabilizerLevel: number;
  bucketTolerance: number;
  bucketExpansion: number;
  bucketGapClosing: number;
  scaleRef: React.MutableRefObject<number>;
  panRef: React.MutableRefObject<{ x: number; y: number }>;
  rotationRef: React.MutableRefObject<number>;
  suppressDrawingRef: React.MutableRefObject<boolean>;
  displayCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  tracingRef: TracingReference | null;
  onSelectTool: (tool: ToolType) => void;
  onChangeBrushColor: (color: string) => void;
  onSaveUndoSnapshot: () => void;
  onStrokeEnd?: () => void;
  renderComposite: () => void;
  updateThumbnail: () => void;
  applyTransformDirect: (scale: number, pan: { x: number; y: number }, rotation: number) => void;
  setPan: (pan: { x: number; y: number }) => void;
  triggerHaptic: (duration?: number) => void;
}

export function useStrokeDrawing({
  projectWidth,
  projectHeight,
  activeLayer,
  activeTool,
  lastDrawingTool,
  brushColor,
  brushSize,
  brushOpacity,
  brushTexture,
  stabilizerLevel,
  bucketTolerance,
  bucketExpansion,
  bucketGapClosing,
  scaleRef,
  panRef,
  rotationRef,
  suppressDrawingRef,
  displayCanvasRef,
  tracingRef,
  onSelectTool,
  onChangeBrushColor,
  onSaveUndoSnapshot,
  onStrokeEnd,
  renderComposite,
  updateThumbnail,
  applyTransformDirect,
  setPan,
  triggerHaptic,
}: UseStrokeDrawingProps) {
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<Point | null>(null);
  const currentVectorStrokeRef = useRef<VectorStroke | null>(null);
  const strokeRafIdRef = useRef<number | null>(null);

  const isPanningRef = useRef(false);
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  /**
   * Conversión de coordenadas de puntero a píxeles exactos del lienzo
   */
  const getCanvasCoords = useCallback((clientX: number, clientY: number, pressureValue = 0.5): Point => {
    const canvas = displayCanvasRef.current;
    if (!canvas) return { x: 0, y: 0, pressure: 0.5 };

    const rect = canvas.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const coords = screenToCanvasCoords(
      clientX,
      clientY,
      centerX,
      centerY,
      scaleRef.current,
      rotationRef.current,
      projectWidth,
      projectHeight
    );

    let pressure = pressureValue;
    if (pressure === 0 || pressure === 0.5) {
      if (lastPointRef.current) {
        pressure = wasmEngine.calculateVelocityPressure(
          { x: coords.x, y: coords.y, pressure, timestamp: performance.now() },
          lastPointRef.current
        );
      } else {
        pressure = 0.5;
      }
    }

    return { x: coords.x, y: coords.y, pressure, timestamp: performance.now() };
  }, [displayCanvasRef, projectHeight, projectWidth, rotationRef, scaleRef]);

  /**
   * Manejador PointerDown
   */
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (suppressDrawingRef.current || (tracingRef && tracingRef.isAdjusting)) {
      return;
    }

    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // Ignorar si no está soportado
    }

    // Modo Mano / Paneo táctil con 1 dedo
    if (activeTool === 'hand') {
      isPanningRef.current = true;
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        panX: panRef.current.x,
        panY: panRef.current.y,
      };
      return;
    }

    // Herramienta Cuentagotas
    if (activeTool === 'eyedropper') {
      const coords = getCanvasCoords(e.clientX, e.clientY);
      const color = drawingEngine.pickColor(activeLayer.ctx, coords.x, coords.y);
      if (color) {
        onChangeBrushColor(color);
        triggerHaptic(12);
        const safeTarget = lastDrawingTool && lastDrawingTool !== 'eyedropper' ? lastDrawingTool : 'brush';
        onSelectTool(safeTarget);
      }
      return;
    }

    // Herramienta Bote de Pintura (Flood Fill con Expansión de Borde y Cierre Inteligente de Huecos)
    if (activeTool === 'bucket') {
      const coords = getCanvasCoords(e.clientX, e.clientY);
      onSaveUndoSnapshot();
      drawingEngine.floodFill(
        activeLayer,
        coords.x,
        coords.y,
        brushColor,
        bucketTolerance,
        bucketExpansion,
        bucketGapClosing
      );
      renderComposite();
      updateThumbnail();
      triggerHaptic(15);
      if (onStrokeEnd) onStrokeEnd();
      return;
    }

    // Herramientas de trazo
    onSaveUndoSnapshot();
    isDrawingRef.current = true;

    const pressure = e.pressure > 0.01 ? e.pressure : 0.5;
    const startPoint = getCanvasCoords(e.clientX, e.clientY, pressure);
    lastPointRef.current = startPoint;

    if (activeTool === 'vector_pencil') {
      currentVectorStrokeRef.current = {
        id: `vstroke_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        layerId: activeLayer.id,
        color: brushColor,
        baseSize: brushSize,
        opacity: brushOpacity,
        points: [startPoint],
        segments: [],
        createdAt: Date.now(),
      };
    } else {
      drawingEngine.drawStrokeSegment(
        activeLayer,
        startPoint,
        startPoint,
        activeTool,
        brushColor,
        brushSize,
        brushOpacity,
        brushTexture
      );
    }
    renderComposite();
  };

  /**
   * Manejador PointerMove
   */
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (suppressDrawingRef.current || (tracingRef && tracingRef.isAdjusting)) {
      return;
    }

    if (isPanningRef.current && panStartRef.current) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      const newPan = {
        x: panStartRef.current.panX + dx,
        y: panStartRef.current.panY + dy,
      };
      panRef.current = newPan;
      applyTransformDirect(scaleRef.current, newPan, rotationRef.current);
      return;
    }

    if (!isDrawingRef.current || !lastPointRef.current) return;

    const rawPressure = e.pressure > 0.01 ? e.pressure : 0.5;
    const rawPoint = getCanvasCoords(e.clientX, e.clientY, rawPressure);
    const smoothPoint = wasmEngine.stabilizePoint(rawPoint, lastPointRef.current, stabilizerLevel);

    if (activeTool === 'vector_pencil' && currentVectorStrokeRef.current) {
      currentVectorStrokeRef.current.points.push(smoothPoint);
      const segments = kotlinVectorEngine.generateBezierSegments(
        currentVectorStrokeRef.current.points,
        brushSize
      );
      currentVectorStrokeRef.current.segments = segments;

      if (strokeRafIdRef.current === null) {
        strokeRafIdRef.current = requestAnimationFrame(() => {
          renderComposite();
          strokeRafIdRef.current = null;
        });
      }
      lastPointRef.current = smoothPoint;
      return;
    }

    drawingEngine.drawStrokeSegment(
      activeLayer,
      lastPointRef.current,
      smoothPoint,
      activeTool,
      brushColor,
      brushSize,
      brushOpacity,
      brushTexture
    );

    if (strokeRafIdRef.current === null) {
      strokeRafIdRef.current = requestAnimationFrame(() => {
        renderComposite();
        strokeRafIdRef.current = null;
      });
    }
    lastPointRef.current = smoothPoint;
  };

  /**
   * Manejador PointerUp
   */
  const handlePointerUp = (e?: React.PointerEvent<HTMLCanvasElement>) => {
    if (e) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // Ignorar
      }
    }

    if (isPanningRef.current) {
      isPanningRef.current = false;
      panStartRef.current = null;
      setPan({ ...panRef.current });
      return;
    }

    if (isDrawingRef.current) {
      if (strokeRafIdRef.current !== null) {
        cancelAnimationFrame(strokeRafIdRef.current);
        strokeRafIdRef.current = null;
      }

      if (activeTool === 'vector_pencil' && currentVectorStrokeRef.current) {
        if (currentVectorStrokeRef.current.points.length > 1) {
          currentVectorStrokeRef.current.segments = kotlinVectorEngine.generateBezierSegments(
            currentVectorStrokeRef.current.points,
            brushSize
          );
          kotlinVectorEngine.addStroke(currentVectorStrokeRef.current);
        }
        currentVectorStrokeRef.current = null;
      }

      isDrawingRef.current = false;
      lastPointRef.current = null;
      renderComposite();
      updateThumbnail();
      if (onStrokeEnd) {
        onStrokeEnd();
      }
    }
  };

  return {
    isDrawingRef,
    currentVectorStrokeRef,
    getCanvasCoords,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  };
}
