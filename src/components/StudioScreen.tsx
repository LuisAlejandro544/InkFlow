/**
 * @file StudioScreen.tsx
 * @description Pantalla principal de dibujo para IbisPaint WebGPU Studio.
 * 
 * Modularizado:
 * - Barra superior, menús Pro y alertas de crash extraídos a `studio/StudioTopBar.tsx`.
 * - Barra inferior, deslizadores y dock de herramientas extraídos a `studio/StudioBottomBar.tsx`.
 * - Overlays flotantes (expansión balde, previews de grosor/opacidad, modal iOS) a `studio/StudioCanvasOverlays.tsx`.
 * - Motor de gestos multitáctiles directos a 60-120 FPS sin re-renders en rAF.
 * - Soporte para Lápiz Vectorial analítico Kotlin/Wasm, Pinceles WebGPU y TracingAdjuster.
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Layer, ToolType, Point, ProjectData, VectorStroke, TracingReference, TracingFilterMode, BrushTextureConfig } from '../engine/types';
import { wasmEngine } from '../engine/wasmEngine';
import { drawingEngine } from '../engine/webgpuEngine';
import { kotlinVectorEngine } from '../engine/kotlinWasmBridge';
import { gpuBitmapCache } from '../engine/bitmapCache';
import { 
  calculateFocalZoomPan, 
  calculateWheelZoom, 
  calculateTouchRotation, 
  snapRotationDegrees, 
  screenToCanvasCoords 
} from '../engine/transformMath';
import { TracingAdjuster } from './TracingAdjuster';
import { CrashRecoveryRecord } from '../storage/sqliteTypes';
import { StudioTopBar } from './studio/StudioTopBar';
import { StudioBottomBar } from './studio/StudioBottomBar';
import { StudioCanvasOverlays } from './studio/StudioCanvasOverlays';

interface StudioScreenProps {
  project: ProjectData;
  activeTool: ToolType;
  lastDrawingTool: ToolType;
  brushSize: number;
  brushOpacity: number;
  brushColor: string;
  stabilizerLevel: number;
  bucketExpansion?: number;
  onChangeBucketExpansion?: (expansion: number) => void;
  bucketTolerance?: number;
  onChangeBucketTolerance?: (tolerance: number) => void;
  layers: Layer[];
  activeLayerId: string;
  canUndo: boolean;
  canRedo: boolean;
  tracingRef: TracingReference | null;
  crashRecovery?: CrashRecoveryRecord | null;
  onSelectTool: (tool: ToolType) => void;
  onToggleHandMode?: () => void;
  onToggleBrushEraser: () => void;
  onChangeBrushSize: (size: number) => void;
  onChangeBrushOpacity: (opacity: number) => void;
  onChangeBrushColor: (color: string) => void;
  onChangeStabilizer: (level: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onSaveUndoSnapshot: () => void;
  onStrokeEnd?: () => void;
  onRestoreCrash?: () => void;
  onDismissCrash?: () => void;
  onOpenLayersModal: () => void;
  onOpenColorPicker: () => void;
  onOpenToolPicker: () => void;
  onOpenExportModal: () => void;
  onOpenCanvasResizeModal?: () => void;
  onGoToGallery: () => void;
  onGoToEngine: () => void;
  onGoToWelcome?: () => void;
  onUpdateProjectThumbnail: (thumbnailUrl: string) => void;
  onUpdateTracing: (update: Partial<TracingReference>) => void;
  onApplyTracingFilter: (mode: TracingFilterMode) => void;
  onCenterTracing: () => void;
  onConfirmTracing: () => void;
  onRemoveTracing: () => void;
  onToggleTracingVisibility: () => void;
  onTriggerImportPhoto: () => void;
  onTriggerImportAccessory?: () => void;
  onStampAccessory?: (asNewLayer: boolean) => void;
  bucketGapClosing?: number;
  onChangeBucketGapClosing?: (gap: number) => void;
  brushTexture?: BrushTextureConfig;
  onOpenTextureModal?: () => void;
}

export const StudioScreen: React.FC<StudioScreenProps> = ({
  project,
  activeTool,
  lastDrawingTool,
  brushSize,
  brushOpacity,
  brushColor,
  brushTexture,
  stabilizerLevel,
  bucketExpansion = 2,
  onChangeBucketExpansion,
  bucketTolerance = 32,
  onChangeBucketTolerance,
  bucketGapClosing = 3,
  onChangeBucketGapClosing,
  layers,
  activeLayerId,
  canUndo,
  canRedo,
  tracingRef,
  crashRecovery,
  onSelectTool,
  onToggleHandMode,
  onToggleBrushEraser,
  onChangeBrushSize,
  onChangeBrushOpacity,
  onChangeBrushColor,
  onChangeStabilizer,
  onUndo,
  onRedo,
  onSaveUndoSnapshot,
  onStrokeEnd,
  onRestoreCrash,
  onDismissCrash,
  onOpenLayersModal,
  onOpenColorPicker,
  onOpenToolPicker,
  onOpenTextureModal,
  onOpenExportModal,
  onOpenCanvasResizeModal,
  onGoToGallery,
  onGoToEngine,
  onGoToWelcome,
  onUpdateProjectThumbnail,
  onUpdateTracing,
  onApplyTracingFilter,
  onCenterTracing,
  onConfirmTracing,
  onRemoveTracing,
  onToggleTracingVisibility,
  onTriggerImportPhoto,
  onTriggerImportAccessory,
  onStampAccessory,
}) => {
  const displayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasWrapperRef = useRef<HTMLDivElement | null>(null);
  const zoomHudRef = useRef<HTMLDivElement | null>(null);

  // Estados de dibujo
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<Point | null>(null);
  const currentVectorStrokeRef = useRef<VectorStroke | null>(null);
  const suppressDrawingRef = useRef<boolean>(false);

  // Transformación geométrica: Escala, Paneo y Rotación de la Hoja
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const scaleRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const rotationRef = useRef(0);

  // Paneo con 1 dedo en Modo Mover
  const isPanningRef = useRef(false);
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  // Gestos multitáctiles directos (Pinch-to-Zoom, Paneo y Rotación a 2 dedos)
  const touchPinchRef = useRef<{
    initialDist: number;
    initialScale: number;
    initialPan: { x: number; y: number };
    initialCenter: { x: number; y: number };
    initialRotation: number;
    t0Initial: { x: number; y: number };
    t1Initial: { x: number; y: number };
    startTime: number;
    hasMoved: boolean;
    active: boolean;
  } | null>(null);

  // Control de rAF para 120 FPS
  const rafIdRef = useRef<number | null>(null);

  // Previsualizaciones y modales
  const [showSizePreview, setShowSizePreview] = useState(false);
  const [showOpacityPreview, setShowOpacityPreview] = useState(false);
  const [showStrokeGuide, setShowStrokeGuide] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);

  // Sincronizar referencias
  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  useEffect(() => {
    rotationRef.current = rotation;
  }, [rotation]);

  const triggerHaptic = (duration = 10) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(duration);
      } catch {
        // Ignorar si no está soportado
      }
    }
  };

  const activeLayer = layers.find(l => l.id === activeLayerId) || layers[0];

  /**
   * Redibuja la composición de capas y trazos en el canvas de visualización con
   * súper-resolución dinámica. Al estar desacoplado de la foto de calco (que corre en su
   * propia capa GPU), el trazo del lápiz corre a 120 FPS ultra fluidos sin saturar la VRAM.
   */
  const renderComposite = useCallback(() => {
    const displayCanvas = displayCanvasRef.current;
    if (!displayCanvas) return;
    const ctx = displayCanvas.getContext('2d');
    if (!ctx) return;

    // Aceleración de nitidez: Super-resolución adaptada al zoom y a la densidad de píxeles del móvil
    const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
    const currentZoom = Math.max(1, scaleRef.current);
    const superScale = Math.min(Math.max(dpr, 1) * Math.min(currentZoom, 3), 3.5);

    const targetW = Math.round(project.width * superScale);
    const targetH = Math.round(project.height * superScale);

    if (displayCanvas.width !== targetW || displayCanvas.height !== targetH) {
      displayCanvas.width = targetW;
      displayCanvas.height = targetH;
    }

    ctx.save();
    ctx.setTransform(superScale, 0, 0, superScale, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Durante el modo interactivo de ajuste, TracingAdjuster maneja la imagen directamente en el DOM
    // mediante CSS transform acelerado por hardware a 120 FPS sin saturar la VRAM ni el hilo de dibujo.
    const activeTracingForCanvas = (tracingRef && !tracingRef.isAdjusting) ? tracingRef : null;

    drawingEngine.compositeLayers(
      ctx,
      layers,
      project.width,
      project.height,
      '#ffffff',
      scaleRef.current * superScale,
      activeTracingForCanvas,
      currentVectorStrokeRef.current
    );

    ctx.restore();
  }, [layers, project.width, project.height, tracingRef]);

  useEffect(() => {
    renderComposite();
  }, [renderComposite]);

  const updateThumbnail = useCallback(() => {
    const displayCanvas = displayCanvasRef.current;
    if (!displayCanvas) return;
    try {
      if (tracingRef && tracingRef.visible && tracingRef.image) {
        const thumbCanvas = document.createElement('canvas');
        thumbCanvas.width = project.width;
        thumbCanvas.height = project.height;
        const tctx = thumbCanvas.getContext('2d');
        if (tctx) {
          drawingEngine.compositeLayers(
            tctx,
            layers,
            project.width,
            project.height,
            '#ffffff',
            1.0,
            tracingRef,
            null
          );
          const thumb = thumbCanvas.toDataURL('image/jpeg', 0.5);
          onUpdateProjectThumbnail(thumb);
          return;
        }
      }
      const thumb = displayCanvas.toDataURL('image/jpeg', 0.5);
      onUpdateProjectThumbnail(thumb);
    } catch {
      // Ignorar restricciones
    }
  }, [layers, onUpdateProjectThumbnail, project.height, project.width, tracingRef]);

  /**
   * Aplica la transformación directamente al estilo CSS del DOM mediante GPU sin latencia
   */
  const applyTransformDirect = (newScale: number, newPan: { x: number; y: number }, newRot = rotationRef.current) => {
    if (canvasWrapperRef.current) {
      canvasWrapperRef.current.style.transform = `translate3d(${newPan.x}px, ${newPan.y}px, 0) scale(${newScale}) rotate(${newRot}deg)`;
    }
  };

  /**
   * Muestra el porcentaje de zoom y ángulo de rotación en el HUD flotante sin causar re-renderizados
   */
  const updateZoomHUD = (newScale: number, newRot = rotationRef.current, show = true) => {
    if (zoomHudRef.current) {
      const roundedRot = Math.round(newRot);
      const rotText = roundedRot !== 0 ? ` • ${roundedRot}°` : '';
      zoomHudRef.current.textContent = `${Math.round(newScale * 100)}%${rotText}`;
      if (show) {
        zoomHudRef.current.style.opacity = '1';
        zoomHudRef.current.style.pointerEvents = 'none';
      }
    }
  };

  /**
   * Ajusta el tamaño del lienzo perfectamente al centro de la pantalla del teléfono móvil
   */
  const fitToScreen = useCallback((withHaptic = false) => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const padding = 24;
    const availW = container.clientWidth - padding * 2;
    const availH = container.clientHeight - padding * 2;

    const scaleW = availW / project.width;
    const scaleH = availH / project.height;
    const newScale = Number(Math.min(scaleW, scaleH, 1.0).toFixed(2));
    const newPan = { x: 0, y: 0 };

    setScale(newScale);
    setPan(newPan);
    setRotation(0);
    rotationRef.current = 0;
    applyTransformDirect(newScale, newPan, 0);
    updateZoomHUD(newScale, 0, false);
    if (withHaptic) {
      triggerHaptic(8);
    }
  }, [project.width, project.height]);

  useEffect(() => {
    fitToScreen(false);
    const onResize = () => fitToScreen(false);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [fitToScreen]);

  /**
   * Alterna entre 100% y Ajustar a Pantalla con un toque, restableciendo la rotación a 0°
   */
  const toggleFitOr100 = () => {
    triggerHaptic(12);
    if (Math.abs(rotation) > 0.5 || Math.abs(scale - 1.0) < 0.05) {
      fitToScreen(true);
    } else {
      setScale(1.0);
      setPan({ x: 0, y: 0 });
      setRotation(0);
      rotationRef.current = 0;
      applyTransformDirect(1.0, { x: 0, y: 0 }, 0);
      updateZoomHUD(1.0, 0, true);
      setTimeout(() => {
        if (zoomHudRef.current) zoomHudRef.current.style.opacity = '0';
      }, 1000);
    }
  };

  /**
   * Restablece la rotación a 0° manteniendo la escala y paneo
   */
  const resetRotation = () => {
    triggerHaptic(10);
    setRotation(0);
    rotationRef.current = 0;
    applyTransformDirect(scaleRef.current, panRef.current, 0);
    updateZoomHUD(scaleRef.current, 0, true);
    setTimeout(() => {
      if (zoomHudRef.current) zoomHudRef.current.style.opacity = '0';
    }, 1000);
  };

  /**
   * Conversión de coordenadas de puntero a píxeles exactos del lienzo
   */
  const getCanvasCoords = (clientX: number, clientY: number, pressureValue = 0.5): Point => {
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
      project.width,
      project.height
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
  };

  /**
   * Vinculación nativa de gestos táctiles mediante addEventListener con { passive: false }.
   */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onNativeTouchStart = (e: TouchEvent) => {
      if (tracingRef && tracingRef.isAdjusting) {
        return;
      }

      if (e.touches.length === 2) {
        if (isDrawingRef.current) {
          isDrawingRef.current = false;
          lastPointRef.current = null;
          currentVectorStrokeRef.current = null;
          if (canUndo) {
            onUndo();
          }
        }
        suppressDrawingRef.current = true;

        const t0 = e.touches[0];
        const t1 = e.touches[1];
        const rect = container.getBoundingClientRect();

        const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
        const centerX = (t0.clientX + t1.clientX) / 2 - rect.left - rect.width / 2;
        const centerY = (t0.clientY + t1.clientY) / 2 - rect.top - rect.height / 2;

        touchPinchRef.current = {
          initialDist: Math.max(10, dist),
          initialScale: scaleRef.current,
          initialPan: { ...panRef.current },
          initialCenter: { x: centerX, y: centerY },
          initialRotation: rotationRef.current,
          t0Initial: { x: t0.clientX, y: t0.clientY },
          t1Initial: { x: t1.clientX, y: t1.clientY },
          startTime: performance.now(),
          hasMoved: false,
          active: true,
        };
      } else if (e.touches.length === 3) {
        isDrawingRef.current = false;
        suppressDrawingRef.current = true;
      }
    };

    const onNativeTouchMove = (e: TouchEvent) => {
      if (tracingRef && tracingRef.isAdjusting) {
        return;
      }

      if (e.cancelable) {
        e.preventDefault();
      }

      if (touchPinchRef.current && touchPinchRef.current.active && e.touches.length === 2) {
        const t0 = e.touches[0];
        const t1 = e.touches[1];
        const rect = container.getBoundingClientRect();

        const currentDist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
        const currentCenterX = (t0.clientX + t1.clientX) / 2 - rect.left - rect.width / 2;
        const currentCenterY = (t0.clientY + t1.clientY) / 2 - rect.top - rect.height / 2;

        const rawRot = calculateTouchRotation(
          touchPinchRef.current.t0Initial,
          touchPinchRef.current.t1Initial,
          { x: t0.clientX, y: t0.clientY },
          { x: t1.clientX, y: t1.clientY },
          touchPinchRef.current.initialRotation
        );

        const currentFocal = { x: currentCenterX, y: currentCenterY };
        const { scale: targetScale, pan: targetPan } = calculateFocalZoomPan(
          touchPinchRef.current.initialCenter,
          currentFocal,
          touchPinchRef.current.initialDist,
          currentDist,
          touchPinchRef.current.initialScale,
          touchPinchRef.current.initialPan,
          0.15,
          8.0
        );

        const targetRot = snapRotationDegrees(rawRot, 3.5);

        scaleRef.current = targetScale;
        panRef.current = targetPan;
        rotationRef.current = targetRot;

        if (
          Math.abs(currentDist - touchPinchRef.current.initialDist) > 8 || 
          Math.abs(rawRot - touchPinchRef.current.initialRotation) > 2.5
        ) {
          touchPinchRef.current.hasMoved = true;
        }

        if (rafIdRef.current === null) {
          rafIdRef.current = requestAnimationFrame(() => {
            applyTransformDirect(scaleRef.current, panRef.current, rotationRef.current);
            updateZoomHUD(scaleRef.current, rotationRef.current, true);
            rafIdRef.current = null;
          });
        }
      }
    };

    const onNativeTouchEnd = (e: TouchEvent) => {
      if (touchPinchRef.current && touchPinchRef.current.active) {
        const wasQuickDoubleTap = 
          !touchPinchRef.current.hasMoved && 
          performance.now() - touchPinchRef.current.startTime < 320;

        if (wasQuickDoubleTap && canUndo) {
          triggerHaptic(15);
          onUndo();
        }

        touchPinchRef.current = null;
        setScale(scaleRef.current);
        setPan({ ...panRef.current });
        setRotation(rotationRef.current);

        setTimeout(() => {
          if (zoomHudRef.current) {
            zoomHudRef.current.style.opacity = '0';
          }
        }, 1200);
      }

      if (e.touches.length === 0) {
        setTimeout(() => {
          suppressDrawingRef.current = false;
        }, 80);
      }
    };

    container.addEventListener('touchstart', onNativeTouchStart, { passive: false });
    container.addEventListener('touchmove', onNativeTouchMove, { passive: false });
    container.addEventListener('touchend', onNativeTouchEnd, { passive: true });
    container.addEventListener('touchcancel', onNativeTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', onNativeTouchStart);
      container.removeEventListener('touchmove', onNativeTouchMove);
      container.removeEventListener('touchend', onNativeTouchEnd);
      container.removeEventListener('touchcancel', onNativeTouchEnd);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [canUndo, onUndo, tracingRef]);

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

    // Modo Mano / Paneo táctil
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

      renderComposite();
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

    renderComposite();
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

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const focalPoint = {
      x: e.clientX - rect.left - rect.width / 2,
      y: e.clientY - rect.top - rect.height / 2,
    };
    const factor = e.deltaY < 0 ? 1.15 : 0.85;

    const result = calculateWheelZoom(
      focalPoint,
      scaleRef.current,
      panRef.current,
      factor,
      0.15,
      8.0
    );

    scaleRef.current = result.scale;
    panRef.current = result.pan;
    setScale(result.scale);
    setPan(result.pan);
    applyTransformDirect(result.scale, result.pan);
    updateZoomHUD(result.scale, rotationRef.current, true);

    setTimeout(() => {
      if (zoomHudRef.current) zoomHudRef.current.style.opacity = '0';
    }, 1000);
  };

  return (
    <div className="relative w-screen h-screen h-[100dvh] max-h-[100dvh] bg-[#0d0e12] text-[#e5e7eb] flex flex-col overflow-hidden select-none touch-none pb-[env(safe-area-inset-bottom)]">
      {/* 1. BARRA SUPERIOR MODULAR NATIVA */}
      <StudioTopBar
        project={project}
        canUndo={canUndo}
        canRedo={canRedo}
        scale={scale}
        rotation={rotation}
        tracingRef={tracingRef}
        stabilizerLevel={stabilizerLevel}
        showStrokeGuide={showStrokeGuide}
        crashRecovery={crashRecovery}
        onGoToGallery={onGoToGallery}
        onUndo={onUndo}
        onRedo={onRedo}
        onToggleFitOr100={toggleFitOr100}
        onTriggerImportPhoto={onTriggerImportPhoto}
        onTriggerImportAccessory={onTriggerImportAccessory}
        onUpdateTracing={onUpdateTracing}
        onToggleTracingVisibility={onToggleTracingVisibility}
        onChangeStabilizer={onChangeStabilizer}
        onToggleStrokeGuide={() => setShowStrokeGuide(!showStrokeGuide)}
        onResetRotation={resetRotation}
        onOpenCanvasResizeModal={onOpenCanvasResizeModal}
        onGoToEngine={onGoToEngine}
        onGoToWelcome={onGoToWelcome}
        onOpenExportModal={onOpenExportModal}
        onRestoreCrash={onRestoreCrash}
        onDismissCrash={onDismissCrash}
        triggerHaptic={triggerHaptic}
      />

      {/* 2. ÁREA DE MESA DE DIBUJO LIMPIA Y EXPANSIVA */}
      <main 
        ref={containerRef}
        onWheel={handleWheel}
        className="flex-1 relative overflow-hidden bg-[#0c0d11] flex items-center justify-center p-0"
        style={{
          cursor: activeTool === 'hand' ? 'grab' : 'crosshair'
        }}
      >
        {/* HUD flotante de zoom y rotación directo en DOM por ref */}
        <div 
          ref={zoomHudRef}
          className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-[#161722e0] backdrop-blur-md border border-amber-500/60 text-amber-300 px-3.5 py-1 rounded-full text-xs font-mono font-bold shadow-2xl pointer-events-none opacity-0 transition-opacity duration-200"
        />

        {/* Contenedor del Lienzo con aceleración por hardware pura */}
        <div 
          ref={canvasWrapperRef}
          className="relative shrink-0 select-none"
          style={{
            width: `${project.width}px`,
            height: `${project.height}px`,
            transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${scale}) rotate(${rotation}deg)`,
            transformOrigin: 'center center',
            backgroundColor: '#ffffff',
            willChange: 'transform',
            boxShadow: '0 25px 60px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.08)',
          }}
        >
          <canvas
            ref={displayCanvasRef}
            width={project.width}
            height={project.height}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="relative w-full h-full block touch-none"
            style={{ zIndex: 2 }}
          />

          {/* Calibrador y transformador de foto de calco o accesorio */}
          {tracingRef && tracingRef.isAdjusting && (
            <TracingAdjuster
              canvasWidth={project.width}
              canvasHeight={project.height}
              screenScale={scale}
              canvasRotation={rotation}
              tracing={tracingRef}
              onChangeTransform={onUpdateTracing}
              onApplyFilter={onApplyTracingFilter}
              onCenterImage={onCenterTracing}
              onConfirm={onConfirmTracing}
              onCancel={onRemoveTracing}
              onStampToActiveLayer={() => onStampAccessory?.(false)}
              onStampAsNewLayer={() => onStampAccessory?.(true)}
            />
          )}
        </div>

        {/* Overlays flotantes (Píldora del balde, previews de sliders, guía iOS) */}
        <StudioCanvasOverlays
          activeTool={activeTool}
          tracingRef={tracingRef}
          bucketExpansion={bucketExpansion}
          onChangeBucketExpansion={onChangeBucketExpansion}
          bucketGapClosing={bucketGapClosing}
          onChangeBucketGapClosing={onChangeBucketGapClosing}
          showSizePreview={showSizePreview}
          brushSize={brushSize}
          showOpacityPreview={showOpacityPreview}
          brushOpacity={brushOpacity}
          showIOSModal={showIOSModal}
          setShowIOSModal={setShowIOSModal}
          onToggleTracingVisibility={onToggleTracingVisibility}
          triggerHaptic={triggerHaptic}
        />
      </main>

      {/* 3. BARRA INFERIOR MODULAR ERGONÓMICA (Oculta mientras se calibra el calco para dar prioridad a la Hoja Inferior nativa) */}
      {(!tracingRef || !tracingRef.isAdjusting) && (
        <StudioBottomBar
          activeTool={activeTool}
          lastDrawingTool={lastDrawingTool}
          brushSize={brushSize}
          brushOpacity={brushOpacity}
          brushColor={brushColor}
          brushTexture={brushTexture}
          layers={layers}
          tracingRef={tracingRef}
          showStrokeGuide={showStrokeGuide}
          onToggleBrushEraser={onToggleBrushEraser}
          onOpenToolPicker={onOpenToolPicker}
          onOpenTextureModal={onOpenTextureModal}
          onToggleHandMode={onToggleHandMode}
          onSelectTool={onSelectTool}
          onOpenColorPicker={onOpenColorPicker}
          onOpenLayersModal={onOpenLayersModal}
          onChangeBrushSize={onChangeBrushSize}
          onChangeBrushOpacity={onChangeBrushOpacity}
          onCloseStrokeGuide={() => setShowStrokeGuide(false)}
          setShowSizePreview={setShowSizePreview}
          setShowOpacityPreview={setShowOpacityPreview}
          triggerHaptic={triggerHaptic}
        />
      )}
    </div>
  );
};
