/**
 * @file StudioScreen.tsx
 * @description Pantalla principal de dibujo para IbisPaint WebGPU Studio.
 * 
 * Mejoras arquitectónicas de alto rendimiento:
 * 1. Focal-Point Locked Pinch-to-Zoom: El lienzo se expande y contrae anclado con precisión
 *    matemática al punto medio de los dedos del usuario, eliminando el desplazamiento o deriva indeseada.
 * 2. Gestos Multitáctiles a 60–120 FPS: Escucha de eventos con `{ passive: false }` y manipulación
 *    directa del DOM vía `translate3d + scale` en `requestAnimationFrame`, sin re-renderizados de React
 *    durante el movimiento continuo.
 * 3. Modo Calco / Foto de Referencia Interactiva: Importación directa desde la galería del teléfono,
 *    posicionamiento automático en el medio de la hoja, manipulación táctil con 1 dedo para mover,
 *    2 dedos para escalar/rotar, tiradores de esquina, ajuste de opacidad y filtros Wasm de extracción de Lineart.
 * 4. Atajo gestual nativo: Toque rápido con 2 dedos para Deshacer (Undo) y con 3 dedos para Rehacer (Redo).
 * 5. Barra superior e inferior ergonómicas estilo estudio nativo móvil (44px+ de área táctil por control).
 * 6. Soporte completo para Lápiz Vectorial Kotlin/Wasm analítico (cero pixelación al zoom) y pinceles WebGPU.
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { 
  ArrowLeft, Undo2, Redo2, Sliders, 
  Layers as LayersIcon, Paintbrush, Eraser, 
  Download, Cpu, Hand, Move, Smartphone, X, Share, PenTool, Check,
  Camera, Image as ImageIcon, Eye, EyeOff, Sparkles, MoreHorizontal, RotateCcw
} from 'lucide-react';
import { Layer, ToolType, Point, ProjectData, VectorStroke, TracingReference, TracingFilterMode } from '../engine/types';
import { wasmEngine } from '../engine/wasmEngine';
import { drawingEngine } from '../engine/webgpuEngine';
import { kotlinVectorEngine } from '../engine/kotlinWasmBridge';
import { 
  calculateFocalZoomPan, 
  calculateWheelZoom, 
  calculateTouchRotation, 
  snapRotationDegrees, 
  unrotatePoint,
  screenToCanvasCoords 
} from '../engine/transformMath';
import { usePWAInstall } from './usePWAInstall';
import { TracingAdjuster } from './TracingAdjuster';
import { StrokeGuideAssistant } from './StrokeGuideAssistant';

interface StudioScreenProps {
  project: ProjectData;
  activeTool: ToolType;
  lastDrawingTool: ToolType;
  brushSize: number;
  brushOpacity: number;
  brushColor: string;
  stabilizerLevel: number;
  layers: Layer[];
  activeLayerId: string;
  canUndo: boolean;
  canRedo: boolean;
  tracingRef: TracingReference | null;
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
  onOpenLayersModal: () => void;
  onOpenColorPicker: () => void;
  onOpenToolPicker: () => void;
  onOpenExportModal: () => void;
  onGoToGallery: () => void;
  onGoToEngine: () => void;
  onUpdateProjectThumbnail: (thumbnailUrl: string) => void;
  onUpdateTracing: (update: Partial<TracingReference>) => void;
  onApplyTracingFilter: (mode: TracingFilterMode) => void;
  onCenterTracing: () => void;
  onConfirmTracing: () => void;
  onRemoveTracing: () => void;
  onToggleTracingVisibility: () => void;
  onTriggerImportPhoto: () => void;
}

export const StudioScreen: React.FC<StudioScreenProps> = ({
  project,
  activeTool,
  lastDrawingTool,
  brushSize,
  brushOpacity,
  brushColor,
  stabilizerLevel,
  layers,
  activeLayerId,
  canUndo,
  canRedo,
  tracingRef,
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
  onOpenLayersModal,
  onOpenColorPicker,
  onOpenToolPicker,
  onOpenExportModal,
  onGoToGallery,
  onGoToEngine,
  onUpdateProjectThumbnail,
  onUpdateTracing,
  onApplyTracingFilter,
  onCenterTracing,
  onConfirmTracing,
  onRemoveTracing,
  onToggleTracingVisibility,
  onTriggerImportPhoto,
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
    initialAngle: number;
    startTime: number;
    hasMoved: boolean;
    active: boolean;
  } | null>(null);

  // Control de rAF para 120 FPS
  const rafIdRef = useRef<number | null>(null);

  // Previsualizaciones y menús emergentes
  const [showSizePreview, setShowSizePreview] = useState(false);
  const [showOpacityPreview, setShowOpacityPreview] = useState(false);
  const [showStabilizerMenu, setShowStabilizerMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [showStrokeGuide, setShowStrokeGuide] = useState(false);

  // Hook de instalación PWA
  const { isInstallable, isInstalled, isIOS, install: installPWA } = usePWAInstall();

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

  // Vibración háptica sutil para feedback en teléfono móvil
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
   * Redibuja la composición de todas las capas en el canvas de visualización,
   * incluyendo la foto de calco activa si existe.
   */
  const renderComposite = useCallback(() => {
    const displayCanvas = displayCanvasRef.current;
    if (!displayCanvas) return;
    const ctx = displayCanvas.getContext('2d');
    if (!ctx) return;

    drawingEngine.compositeLayers(
      ctx,
      layers,
      project.width,
      project.height,
      '#ffffff',
      scaleRef.current,
      tracingRef
    );
  }, [layers, project.width, project.height, tracingRef]);

  useEffect(() => {
    renderComposite();
  }, [renderComposite]);

  const updateThumbnail = useCallback(() => {
    const displayCanvas = displayCanvasRef.current;
    if (!displayCanvas) return;
    try {
      const thumb = displayCanvas.toDataURL('image/jpeg', 0.5);
      onUpdateProjectThumbnail(thumb);
    } catch {
      // Ignorar restricciones
    }
  }, [onUpdateProjectThumbnail]);

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
   * Conversión de coordenadas de puntero a píxeles exactos del lienzo,
   * desrotando el punto y compensando escala y centro para que el trazo se pinte
   * exactamente debajo del dedo del usuario en cualquier ángulo de rotación.
   */
  const getCanvasCoords = (clientX: number, clientY: number, pressureValue = 0.5): Point => {
    const canvas = displayCanvasRef.current;
    if (!canvas) return { x: 0, y: 0, pressure: 0.5 };

    const rect = canvas.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Mapeo analítico canónico exacto: elimina la distorsión del AABB bounding box en lienzos rotados
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
      // Si el calco está en modo interactivo de ajuste, dejamos que el usuario interactúe con él
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
        const initialAngle = Math.atan2(t1.clientY - t0.clientY, t1.clientX - t0.clientX);

        touchPinchRef.current = {
          initialDist: Math.max(10, dist),
          initialScale: scaleRef.current,
          initialPan: { ...panRef.current },
          initialCenter: { x: centerX, y: centerY },
          initialRotation: rotationRef.current,
          initialAngle,
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

        const deltaDist = Math.abs(currentDist - touchPinchRef.current.initialDist);
        const deltaCenter = Math.hypot(
          currentCenterX - touchPinchRef.current.initialCenter.x,
          currentCenterY - touchPinchRef.current.initialCenter.y
        );

        // Rotación continua con 2 dedos con normalización angular
        const currentAngle = Math.atan2(t1.clientY - t0.clientY, t1.clientX - t0.clientX);
        let deltaRad = currentAngle - touchPinchRef.current.initialAngle;
        while (deltaRad > Math.PI) deltaRad -= 2 * Math.PI;
        while (deltaRad < -Math.PI) deltaRad += 2 * Math.PI;
        const deltaAngleDeg = deltaRad * (180 / Math.PI);
        let nextRot = (touchPinchRef.current.initialRotation + deltaAngleDeg) % 360;
        if (nextRot < 0) nextRot += 360;
        rotationRef.current = Number(nextRot.toFixed(1));

        if (deltaDist > 8 || deltaCenter > 8 || Math.abs(deltaAngleDeg) > 4) {
          touchPinchRef.current.hasMoved = true;
        }

        const result = calculateFocalZoomPan(
          touchPinchRef.current.initialCenter,
          { x: currentCenterX, y: currentCenterY },
          touchPinchRef.current.initialDist,
          currentDist,
          touchPinchRef.current.initialScale,
          touchPinchRef.current.initialPan,
          0.15,
          8.0
        );

        scaleRef.current = result.scale;
        panRef.current = result.pan;

        if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = requestAnimationFrame(() => {
          applyTransformDirect(result.scale, result.pan, rotationRef.current);
          updateZoomHUD(result.scale, rotationRef.current, true);
        });
      }
    };

    const onNativeTouchEnd = (e: TouchEvent) => {
      if (touchPinchRef.current?.active) {
        const pinchData = touchPinchRef.current;
        const elapsed = performance.now() - pinchData.startTime;

        if (!pinchData.hasMoved && elapsed < 280 && canUndo) {
          triggerHaptic(15);
          onUndo();
        }

        const snappedRot = snapRotationDegrees(rotationRef.current, 4.5);
        rotationRef.current = snappedRot;
        setRotation(snappedRot);
        setScale(scaleRef.current);
        setPan(panRef.current);
        applyTransformDirect(scaleRef.current, panRef.current, snappedRot);
        updateZoomHUD(scaleRef.current, snappedRot, true);
        touchPinchRef.current = null;

        suppressDrawingRef.current = true;
        setTimeout(() => {
          suppressDrawingRef.current = false;
        }, 120);

        setTimeout(() => {
          if (zoomHudRef.current) zoomHudRef.current.style.opacity = '0';
        }, 1000);
      }

      if (e.touches.length === 0 && e.changedTouches.length === 3 && canRedo) {
        triggerHaptic(15);
        onRedo();
      }
    };

    container.addEventListener('touchstart', onNativeTouchStart, { passive: false });
    container.addEventListener('touchmove', onNativeTouchMove, { passive: false });
    container.addEventListener('touchend', onNativeTouchEnd, { passive: false });
    container.addEventListener('touchcancel', onNativeTouchEnd, { passive: false });

    return () => {
      container.removeEventListener('touchstart', onNativeTouchStart);
      container.removeEventListener('touchmove', onNativeTouchMove);
      container.removeEventListener('touchend', onNativeTouchEnd);
      container.removeEventListener('touchcancel', onNativeTouchEnd);
    };
  }, [canUndo, canRedo, onUndo, onRedo, tracingRef]);

  /**
   * Manejador PointerDown en el lienzo
   */
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (suppressDrawingRef.current) return;
    if (tracingRef && tracingRef.isAdjusting) return;

    if (activeTool === 'hand') {
      try {
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        // Ignorar
      }
      isPanningRef.current = true;
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        panX: panRef.current.x,
        panY: panRef.current.y,
      };
      return;
    }

    if (!activeLayer || !activeLayer.visible || activeLayer.locked) return;

    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // Ignorar
    }
    isDrawingRef.current = true;

    const point = getCanvasCoords(e.clientX, e.clientY, e.pressure);
    lastPointRef.current = point;

    if (activeTool === 'bucket') {
      onSaveUndoSnapshot();
      drawingEngine.floodFill(activeLayer, point.x, point.y, brushColor, 32);
      renderComposite();
      updateThumbnail();
      isDrawingRef.current = false;
      return;
    }

    if (activeTool === 'eyedropper') {
      const displayCanvas = displayCanvasRef.current;
      if (displayCanvas) {
        const ctx = displayCanvas.getContext('2d');
        if (ctx) {
          const picked = drawingEngine.pickColor(ctx, point.x, point.y);
          onChangeBrushColor(picked);
          const returnTool = lastDrawingTool && lastDrawingTool !== 'hand' && lastDrawingTool !== 'eyedropper'
            ? lastDrawingTool
            : 'brush';
          onSelectTool(returnTool);
          triggerHaptic(10);
        }
      }
      isDrawingRef.current = false;
      return;
    }

    onSaveUndoSnapshot();

    if (activeTool === 'vector_pencil') {
      currentVectorStrokeRef.current = {
        id: `vstroke_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        layerId: activeLayer.id,
        color: brushColor,
        baseSize: brushSize,
        opacity: brushOpacity,
        points: [point],
        segments: [],
        createdAt: Date.now(),
      };
    }

    drawingEngine.drawStrokeSegment(
      activeLayer,
      point,
      point,
      activeTool,
      brushColor,
      brushSize,
      brushOpacity
    );
    renderComposite();
  };

  /**
   * Manejador PointerMove
   */
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isPanningRef.current && panStartRef.current) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      const nextPan = {
        x: panStartRef.current.panX + dx,
        y: panStartRef.current.panY + dy,
      };
      panRef.current = nextPan;
      applyTransformDirect(scaleRef.current, nextPan);
      return;
    }

    if (!isDrawingRef.current || !lastPointRef.current || !activeLayer || activeTool === 'hand') return;

    const rawPoint = getCanvasCoords(e.clientX, e.clientY, e.pressure);
    const smoothPoint = wasmEngine.stabilizePoint(rawPoint, lastPointRef.current, stabilizerLevel);

    if (activeTool === 'vector_pencil' && currentVectorStrokeRef.current) {
      currentVectorStrokeRef.current.points.push(smoothPoint);
      const segments = kotlinVectorEngine.generateBezierSegments(
        currentVectorStrokeRef.current.points,
        brushSize
      );
      currentVectorStrokeRef.current.segments = segments;

      drawingEngine.drawStrokeSegment(
        activeLayer,
        lastPointRef.current,
        smoothPoint,
        activeTool,
        brushColor,
        brushSize,
        brushOpacity
      );
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
      brushOpacity
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

  const handleInstallClick = async () => {
    triggerHaptic(15);
    if (isIOS) {
      setShowIOSModal(true);
    } else {
      const ok = await installPWA();
      if (!ok && !isInstallable) {
        alert('Para instalar: Pulsa en los tres puntos del navegador (⋮) y selecciona "Instalar aplicación" o "Añadir a la pantalla de inicio".');
      }
    }
  };

  return (
    <div className="relative w-screen h-screen bg-[#0d0e12] text-[#e5e7eb] flex flex-col overflow-hidden select-none touch-none">
      
      {/* 1. BARRA SUPERIOR ELEGANTE Y ESPACIOSA ESTILO APP NATIVA MÓVIL */}
      {/* 1. BARRA SUPERIOR MÓVIL NATIVA ESTILO IBISPAINT (CERO DESBORDES) */}
      <header className="h-12 px-2 bg-[#111217]/95 border-b border-[#1e2029] flex items-center justify-between z-30 shrink-0 shadow-sm backdrop-blur-md gap-1 max-w-full overflow-x-auto no-scrollbar">
        
        {/* Lado Izquierdo: Volver, Deshacer y Rehacer */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => {
              triggerHaptic(8);
              onGoToGallery();
            }}
            aria-label="Ir a galería de proyectos"
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#191a22] hover:bg-[#232530] text-gray-300 hover:text-white border border-[#262835] flex items-center justify-center transition-all active:scale-90 shrink-0"
            title="Galería"
          >
            <ArrowLeft size={16} />
          </button>

          <button
            onClick={() => {
              triggerHaptic(8);
              onUndo();
            }}
            disabled={!canUndo}
            aria-label="Deshacer trazo"
            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl border flex items-center justify-center transition-all shrink-0 ${
              canUndo 
                ? 'bg-[#191a22] hover:bg-[#232530] text-amber-400 border-[#262835] active:scale-90' 
                : 'bg-[#14151b] text-gray-600 border-transparent cursor-not-allowed opacity-30'
            }`}
            title="Deshacer (Toque con 2 dedos)"
          >
            <Undo2 size={16} />
          </button>

          <button
            onClick={() => {
              triggerHaptic(8);
              onRedo();
            }}
            disabled={!canRedo}
            aria-label="Rehacer trazo"
            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl border flex items-center justify-center transition-all shrink-0 ${
              canRedo 
                ? 'bg-[#191a22] hover:bg-[#232530] text-amber-400 border-[#262835] active:scale-90' 
                : 'bg-[#14151b] text-gray-600 border-transparent cursor-not-allowed opacity-30'
            }`}
            title="Rehacer (Toque con 3 dedos)"
          >
            <Redo2 size={16} />
          </button>
        </div>

        {/* Centro: Indicador interactivo de Zoom/Rotación y Botón de Calco */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={toggleFitOr100}
            aria-label="Ajustar o centrar lienzo y enderezar rotación"
            className="h-8 px-2 rounded-full bg-[#181922] hover:bg-[#222430] border border-[#272937] text-xs font-mono font-bold text-amber-400 active:scale-95 transition-all shadow-xs flex items-center gap-1 shrink-0"
            title="Toca para ajustar o enderezar rotación a 0°"
          >
            <span>{Math.round(scale * 100)}%</span>
            {Math.round(rotation) !== 0 && (
              <span className="text-[10px] text-amber-300 font-semibold">• {Math.round(rotation)}°</span>
            )}
          </button>

          {/* BOTÓN CALCO (Compacto / Nativo) */}
          <button
            onClick={() => {
              triggerHaptic(10);
              if (!tracingRef) {
                onTriggerImportPhoto();
              } else {
                onUpdateTracing({ isAdjusting: !tracingRef.isAdjusting });
              }
            }}
            aria-label="Calcar foto"
            className={`h-8 px-2 rounded-xl border text-xs font-bold active:scale-95 transition-all flex items-center gap-1 shrink-0 ${
              tracingRef
                ? tracingRef.isAdjusting
                  ? 'bg-amber-500 text-black border-amber-400 shadow-sm'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-[#191a22] hover:bg-[#232530] text-gray-300 border-[#262835]'
            }`}
            title={tracingRef ? 'Calco activo (Toca para ajustar)' : 'Calcar foto de galería'}
          >
            <Camera size={13} className={tracingRef?.isAdjusting ? 'text-black' : 'text-amber-400'} />
            <span className="text-[11px]">Calco</span>
            {tracingRef && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            )}
          </button>

          {/* CONMUTADOR DE VISIBILIDAD DE CALCO */}
          {tracingRef && (
            <button
              onClick={() => {
                triggerHaptic(10);
                onToggleTracingVisibility();
              }}
              aria-label={tracingRef.visible ? 'Ocultar calco' : 'Ver calco'}
              className={`w-8 h-8 rounded-xl border flex items-center justify-center transition-all active:scale-95 shrink-0 ${
                tracingRef.visible
                  ? 'bg-[#191a22] text-gray-300 border-[#262835]'
                  : 'bg-amber-500 text-black border-amber-400 shadow-sm'
              }`}
              title={tracingRef.visible ? 'Ocultar foto de calco' : 'Mostrar foto de calco'}
            >
              {tracingRef.visible ? <Eye size={13} /> : <EyeOff size={13} />}
            </button>
          )}
        </div>

        {/* Lado Derecho: Estabilizador, Menú Más Opciones y Botón Guardar SIEMPRE VISIBLE */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Estabilizador S-Form en 1 sola línea */}
          <button
            onClick={() => {
              triggerHaptic(8);
              setShowStabilizerMenu(!showStabilizerMenu);
              setShowMoreMenu(false);
            }}
            aria-label="Estabilizador S-Form"
            className={`h-8 px-2 rounded-xl border text-xs font-semibold active:scale-95 transition-all flex items-center gap-1 shrink-0 ${
              showStabilizerMenu
                ? 'bg-amber-500 text-black border-amber-400 font-bold'
                : 'bg-[#191a22] hover:bg-[#232530] text-amber-400 border-[#262835]'
            }`}
            title="Ajustar Estabilizador S-Form"
          >
            <Sliders size={12} />
            <span className="font-mono font-bold text-[11px] whitespace-nowrap">S{stabilizerLevel}</span>
          </button>

          {/* Menú Más Opciones (Agrupa Asistente IA, Enderezar Lienzo y Diagnóstico) */}
          <button
            onClick={() => {
              triggerHaptic(8);
              setShowMoreMenu(!showMoreMenu);
              setShowStabilizerMenu(false);
            }}
            aria-label="Más herramientas y opciones"
            className={`w-8 h-8 rounded-xl border flex items-center justify-center transition-all active:scale-95 shrink-0 ${
              showMoreMenu || showStrokeGuide
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                : 'bg-[#191a22] hover:bg-[#232530] text-gray-300 hover:text-white border-[#262835]'
            }`}
            title="Más opciones de estudio"
          >
            <MoreHorizontal size={15} />
          </button>

          {/* BOTÓN GUARDAR OBRA MAESTRA - SIEMPRE VISIBLE Y RESALTADO */}
          <button
            onClick={() => {
              triggerHaptic(10);
              onOpenExportModal();
            }}
            aria-label="Guardar obra maestra en tu galería"
            className="h-8 px-2.5 sm:px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs flex items-center gap-1.5 shadow-md shrink-0 active:scale-95 transition-all"
            title="Guardar / Exportar Obra Maestra"
          >
            <Download size={14} className="stroke-[2.5]" />
            <span className="tracking-wide">Guardar</span>
          </button>
        </div>
      </header>

      {/* POPUP FLOTANTE NATIVO: ESTABILIZADOR S-FORM (EN CONTENEDOR CON KEY PARA RECONCILIACIÓN SEGURA) */}
      {showStabilizerMenu && (
        <div key="stabilizer-menu-modal" className="fixed inset-0 z-50 pointer-events-auto">
          <div 
            onClick={() => setShowStabilizerMenu(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-xs animate-fade-in"
          />
          <div className="fixed top-13 right-16 z-50 bg-[#181922] border border-[#2e313f] rounded-2xl p-3 shadow-2xl w-52 flex flex-col gap-1.5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-1.5 border-b border-[#272935]">
              <span className="text-[11px] font-bold text-gray-200">Estabilizador S-Form</span>
              <button 
                onClick={() => setShowStabilizerMenu(false)} 
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X size={14} />
              </button>
            </div>
            {[
              { level: 0, label: 'S-0: Directo' },
              { level: 3, label: 'S-3: Natural (Boceto)' },
              { level: 6, label: 'S-6: Suave (Ilustración)' },
              { level: 10, label: 'S-10: Manga (Firme)' },
            ].map((item) => (
              <button
                key={item.level}
                onClick={() => {
                  triggerHaptic(10);
                  onChangeStabilizer(item.level);
                  setShowStabilizerMenu(false);
                }}
                className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                  stabilizerLevel === item.level
                    ? 'bg-amber-500 text-black font-bold shadow-xs'
                    : 'text-gray-200 hover:bg-[#232530] active:scale-95'
                }`}
              >
                <span>{item.label}</span>
                {stabilizerLevel === item.level && <Check size={14} className="stroke-[3]" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* POPUP FLOTANTE NATIVO: MENÚ MÁS OPCIONES [ ... ] (EN CONTENEDOR CON KEY PARA RECONCILIACIÓN SEGURA) */}
      {showMoreMenu && (
        <div key="more-menu-modal" className="fixed inset-0 z-50 pointer-events-auto">
          <div 
            onClick={() => setShowMoreMenu(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-xs animate-fade-in"
          />
          <div className="fixed top-13 right-2 z-50 bg-[#161720] border border-[#2b2d3d] rounded-2xl p-2.5 shadow-2xl w-60 flex flex-col gap-1.5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between px-2 py-1 border-b border-[#242635] mb-0.5">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Herramientas Pro</span>
              <button 
                onClick={() => setShowMoreMenu(false)} 
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X size={14} />
              </button>
            </div>

            {/* Opción 1: Asistente de Grosor de Trazo por IA */}
            <button
              onClick={() => {
                triggerHaptic(8);
                setShowStrokeGuide(!showStrokeGuide);
                setShowMoreMenu(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all text-left active:scale-98 ${
                showStrokeGuide
                  ? 'bg-amber-500 text-black font-bold shadow-xs'
                  : 'text-gray-200 hover:bg-[#20222f]'
              }`}
            >
              <Sparkles size={16} className={showStrokeGuide ? 'text-black' : 'text-amber-400'} />
              <div className="flex-1 min-w-0">
                <span className="block leading-tight">Guía de Grosor IA</span>
                <span className={`text-[9px] block ${showStrokeGuide ? 'text-black/80 font-medium' : 'text-gray-400'}`}>
                  {showStrokeGuide ? 'Activo en barra inferior' : 'Calibración por visión'}
                </span>
              </div>
            </button>

            {/* Opción 2: Enderezar Lienzo a 0° */}
            <button
              onClick={() => {
                resetRotation();
                setShowMoreMenu(false);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-gray-200 hover:bg-[#20222f] active:scale-98 transition-all text-left"
            >
              <RotateCcw size={16} className="text-amber-400" />
              <div className="flex-1 min-w-0">
                <span className="block leading-tight">Enderezar Lienzo</span>
                <span className="text-[9px] text-gray-400 block">
                  Restablecer rotación a 0°
                </span>
              </div>
            </button>

            {/* Opción 3: Diagnóstico del Motor */}
            <button
              onClick={() => {
                triggerHaptic(8);
                setShowMoreMenu(false);
                onGoToEngine();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-gray-200 hover:bg-[#20222f] active:scale-98 transition-all text-left"
            >
              <Cpu size={16} className="text-amber-400" />
              <div className="flex-1 min-w-0">
                <span className="block leading-tight">Diagnóstico Motor</span>
                <span className="text-[9px] text-gray-400 block">
                  WebGPU, Kotlin/Wasm & Rust
                </span>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* 2. ÁREA DE MESA DE DIBUJO LIMPIA, EXPANSIVA Y SIN OBSTRUCCIONES */}
      <main 
        ref={containerRef}
        onWheel={handleWheel}
        className="flex-1 relative overflow-hidden bg-[#0c0d11] flex items-center justify-center p-0"
        style={{
          cursor: activeTool === 'hand' ? 'grab' : 'crosshair'
        }}
      >
        {/* HUD flotante de porcentaje de zoom y rotación ultra fluido (controlado 100% por ref, sin hijos React para prevenir removeChild error) */}
        <div 
          ref={zoomHudRef}
          className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-[#161722e0] backdrop-blur-md border border-amber-500/60 text-amber-300 px-3.5 py-1 rounded-full text-xs font-mono font-bold shadow-2xl pointer-events-none opacity-0 transition-opacity duration-200"
        />

        {/* Conmutador flotante rápido para alternar calco y ver las líneas limpias al instante */}
        {tracingRef && !tracingRef.isAdjusting && (
          <button
            onClick={() => {
              triggerHaptic(10);
              onToggleTracingVisibility();
            }}
            className={`absolute top-4 right-4 z-40 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-2xl backdrop-blur-md border transition-all active:scale-95 ${
              tracingRef.visible
                ? 'bg-[#14151df0] border-gray-700/80 text-gray-300 hover:text-white'
                : 'bg-amber-500 text-black border-amber-300 shadow-amber-500/40 ring-2 ring-amber-400/40'
            }`}
            title="Toca para ocultar o mostrar la foto de calco y comparar tu dibujo"
          >
            {tracingRef.visible ? <Eye size={14} className="text-amber-400" /> : <EyeOff size={14} />}
            <span>{tracingRef.visible ? 'Calco Visible' : 'Calco Oculto'}</span>
          </button>
        )}

        {/* Contenedor del Lienzo con aceleración por hardware pura y rotación */}
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
            className="w-full h-full block touch-none"
          />

          {/* Superposición interactiva para mover, escalar y calibrar la foto de calco */}
          {tracingRef && tracingRef.isAdjusting && (
            <TracingAdjuster
              canvasWidth={project.width}
              canvasHeight={project.height}
              screenScale={scale}
              tracing={tracingRef}
              onChangeTransform={onUpdateTracing}
              onApplyFilter={onApplyTracingFilter}
              onCenterImage={onCenterTracing}
              onConfirm={onConfirmTracing}
              onCancel={onRemoveTracing}
            />
          )}
        </div>

        {/* Burbuja flotante de previsualización de grosor al ajustar slider */}
        {showSizePreview && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-40 bg-[#161722f0] border border-amber-500/80 rounded-2xl p-3.5 flex flex-col items-center gap-2 shadow-2xl backdrop-blur-md pointer-events-none animate-fade-in">
            <div 
              className="rounded-full bg-amber-500 border-2 border-white shadow-md"
              style={{ width: `${Math.min(80, Math.max(4, brushSize))}px`, height: `${Math.min(80, Math.max(4, brushSize))}px` }}
            />
            <span className="text-xs font-bold font-mono text-white">{brushSize} px</span>
          </div>
        )}

        {/* Burbuja flotante de previsualización de opacidad al ajustar slider */}
        {showOpacityPreview && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-40 bg-[#161722f0] border border-amber-500/80 rounded-2xl px-5 py-2.5 text-xs font-bold font-mono text-white shadow-2xl backdrop-blur-md pointer-events-none animate-fade-in">
            Opacidad: {Math.round(brushOpacity * 100)}%
          </div>
        )}
      </main>

      {/* 3. BARRA INFERIOR ERGONÓMICA ESTILO IBISPAINT CON CONTROLES TÁCTILES CÓMODOS */}
      <footer className="bg-[#13141a] border-t border-[#22242e] flex flex-col z-30 shrink-0 shadow-2xl pb-[max(0.35rem,env(safe-area-inset-bottom))]">
        
        {/* Asistente Inteligente de Grosor de Trazo (Opcional y Calibrado por Imagen) */}
        {showStrokeGuide && (
          <StrokeGuideAssistant
            currentBrushSize={brushSize}
            hasTracingPhoto={!!tracingRef}
            imageAnalysis={tracingRef?.strokeAnalysis}
            onSelectSize={(size) => {
              triggerHaptic(8);
              onChangeBrushSize(size);
            }}
            onClose={() => setShowStrokeGuide(false)}
          />
        )}

        {/* Nivel Superior: Deslizadores Ergonómicos de Grosor y Opacidad (Filas dedicadas estilo IbisPaint) */}
        <div className="px-3 py-2 border-b border-[#1c1d28] bg-[#0d0e14]/95 flex flex-col gap-2 max-w-lg mx-auto w-full">
          {/* Fila 1: Grosor de Trazo con Recorrido Amplio para el Pulgar */}
          <div className="flex items-center gap-2.5 w-full">
            <div className="flex items-center gap-1.5 w-16 shrink-0">
              <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0 shadow-xs" />
              <span className="text-[10px] text-gray-300 font-bold tracking-wider uppercase">Grosor</span>
            </div>
            <input
              type="range"
              min="1"
              max="100"
              value={brushSize}
              onMouseDown={() => setShowSizePreview(true)}
              onMouseUp={() => setShowSizePreview(false)}
              onTouchStart={() => setShowSizePreview(true)}
              onTouchEnd={() => setShowSizePreview(false)}
              onChange={(e) => onChangeBrushSize(Number(e.target.value))}
              className="flex-1 accent-amber-500 h-2 bg-[#1f212c] rounded-lg cursor-pointer touch-pan-x"
            />
            <span className="text-[11px] font-mono font-bold text-amber-300 bg-[#161722] border border-[#262836] px-2 py-0.5 rounded-md min-w-[44px] text-center shrink-0">
              {brushSize}px
            </span>
          </div>

          {/* Fila 2: Opacidad de Trazo con Recorrido Amplio para el Pulgar */}
          <div className="flex items-center gap-2.5 w-full">
            <div className="flex items-center gap-1.5 w-16 shrink-0">
              <span className="w-2 h-2 rounded-full border border-amber-400/80 shrink-0" />
              <span className="text-[10px] text-gray-300 font-bold tracking-wider uppercase">Opacidad</span>
            </div>
            <input
              type="range"
              min="1"
              max="100"
              value={Math.round(brushOpacity * 100)}
              onMouseDown={() => setShowOpacityPreview(true)}
              onMouseUp={() => setShowOpacityPreview(false)}
              onTouchStart={() => setShowOpacityPreview(true)}
              onTouchEnd={() => setShowOpacityPreview(false)}
              onChange={(e) => onChangeBrushOpacity(Number(e.target.value) / 100)}
              className="flex-1 accent-amber-500 h-2 bg-[#1f212c] rounded-lg cursor-pointer touch-pan-x"
            />
            <span className="text-[11px] font-mono font-bold text-amber-300 bg-[#161722] border border-[#262836] px-2 py-0.5 rounded-md min-w-[44px] text-center shrink-0">
              {Math.round(brushOpacity * 100)}%
            </span>
          </div>
        </div>

        {/* Nivel Inferior: Dock de Herramientas Estilo Nativo IbisPaint (Grid de 5 columnas balanceadas, cero truncamiento) */}
        <div className="h-14 px-2 grid grid-cols-5 gap-1.5 max-w-lg mx-auto w-full items-center">
          
          {/* 1. Herramienta Principal de Trazo / Borrador (Alternador rápido en 1 toque) */}
          <button
            onClick={() => {
              triggerHaptic(10);
              onToggleBrushEraser();
            }}
            aria-label="Alternar entre pincel y borrador"
            className={`h-11 rounded-xl border flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 ${
              activeTool === 'eraser' 
                ? 'bg-red-950/40 border-red-500/60 text-red-300' 
                : activeTool === 'vector_pencil'
                ? 'bg-amber-500/15 border-amber-400/70 text-amber-300'
                : 'bg-amber-500/10 border-amber-500/40 text-amber-400'
            }`}
            title="Alternar Trazo / Goma"
          >
            {activeTool === 'eraser' ? (
              <Eraser size={18} />
            ) : activeTool === 'vector_pencil' ? (
              <PenTool size={18} className="text-amber-300" />
            ) : (
              <Paintbrush size={18} />
            )}
            <span className="text-[9px] font-bold uppercase tracking-wider">
              {activeTool === 'eraser' ? 'Goma' : activeTool === 'vector_pencil' ? 'Vector' : 'Pincel'}
            </span>
          </button>

          {/* 2. Catálogo de Herramientas */}
          <button
            onClick={() => {
              triggerHaptic(10);
              onOpenToolPicker();
            }}
            aria-label="Abrir panel de herramientas"
            className="h-11 rounded-xl bg-[#171821] hover:bg-[#20222d] text-gray-300 border border-[#242634] transition-all flex flex-col items-center justify-center gap-0.5 active:scale-95"
            title="Herramientas y Pinceles"
          >
            <Sliders size={18} className="text-gray-300" />
            <span className="text-[9px] font-bold text-gray-400 tracking-wider">Pinceles</span>
          </button>

          {/* 3. Alternador de Navegación Libre (Mover con 1 dedo) */}
          <button
            onClick={() => {
              triggerHaptic(10);
              if (onToggleHandMode) {
                onToggleHandMode();
              } else if (activeTool === 'hand') {
                const safeTarget = lastDrawingTool && lastDrawingTool !== 'hand' ? lastDrawingTool : 'brush';
                onSelectTool(safeTarget);
              } else {
                onSelectTool('hand');
              }
            }}
            aria-label="Alternar modo mover lienzo"
            className={`h-11 rounded-xl border flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 ${
              activeTool === 'hand'
                ? 'bg-amber-500/25 border-amber-400 text-amber-300 shadow-sm'
                : 'bg-[#171821] border-[#242634] text-gray-300 hover:text-white'
            }`}
            title="Mover con 1 dedo"
          >
            {activeTool === 'hand' ? <Hand size={18} /> : <Move size={18} />}
            <span className="text-[9px] font-bold tracking-wider">
              {activeTool === 'hand' ? 'Moviendo' : 'Mover'}
            </span>
          </button>

          {/* 4. Selector de Color Actual */}
          <button
            onClick={() => {
              triggerHaptic(10);
              onOpenColorPicker();
            }}
            aria-label="Abrir selector de color"
            className="h-11 rounded-xl bg-[#171821] hover:bg-[#20222d] border border-[#242634] transition-all flex flex-col items-center justify-center gap-0.5 active:scale-95"
            title="Color Actual"
          >
            <div 
              className="w-4 h-4 rounded-full border border-white shadow-sm shrink-0"
              style={{ backgroundColor: brushColor }}
            />
            <span className="text-[9px] font-bold text-gray-400 tracking-wider font-mono truncate max-w-full px-1">
              {brushColor.toUpperCase()}
            </span>
          </button>

          {/* 5. Gestor de Capas */}
          <button
            onClick={() => {
              triggerHaptic(10);
              onOpenLayersModal();
            }}
            aria-label="Abrir gestor de capas"
            className="h-11 rounded-xl bg-[#171821] border border-[#242634] text-gray-200 hover:text-white relative transition-all active:scale-95 flex flex-col items-center justify-center gap-0.5 shrink-0"
            title="Capas del Lienzo"
          >
            <div className="relative">
              <LayersIcon size={18} className="text-amber-400" />
              <span className="absolute -top-1 -right-2 text-[8px] font-bold font-mono bg-amber-500 text-black px-1 rounded-full">
                {layers.length}
              </span>
            </div>
            <span className="text-[9px] font-bold text-gray-300">
              {layers.length === 1 ? '1 Capa' : `${layers.length} Capas`}
            </span>
          </button>
        </div>
      </footer>

      {/* Modal de Guía de Instalación para iOS Safari */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-[#181922] border border-[#2e313f] rounded-3xl p-5 max-w-sm w-full text-white shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[#272935] pb-2">
              <div className="flex items-center gap-2 text-amber-400">
                <Smartphone size={20} />
                <h3 className="font-bold text-base">Instalar en iPhone / iPad</h3>
              </div>
              <button
                onClick={() => setShowIOSModal(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            <div className="text-xs space-y-2 text-gray-300">
              <p>1. Pulsa el botón <strong>Compartir</strong> (icono <Share size={13} className="inline text-amber-400" />) en la barra de Safari.</p>
              <p>2. Desplázate hacia abajo y selecciona <strong>"Añadir a la pantalla de inicio"</strong>.</p>
              <p>3. Pulsa <strong>"Añadir"</strong> en la esquina superior derecha.</p>
              <p className="text-amber-400 pt-1 font-medium">¡Listo! La app se ejecutará a pantalla completa como una app nativa.</p>
            </div>
            <button
              onClick={() => setShowIOSModal(false)}
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs active:scale-95 transition-transform"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
