/**
 * @file StudioScreen.tsx
 * @description Pantalla principal de dibujo para IbisPaint WebGPU Studio.
 * 
 * Modularizado:
 * - Barra superior, menús Pro y alertas de crash extraídos a `studio/StudioTopBar.tsx`.
 * - Barra inferior, deslizadores y dock de herramientas extraídos a `studio/StudioBottomBar.tsx`.
 * - Overlays flotantes (expansión balde, previews de grosor/opacidad, modal iOS) a `studio/StudioCanvasOverlays.tsx`.
 * - Navegación espacial, gestos multitáctiles y snapping magnético extraídos a `useCanvasGestures.ts`.
 * - Captura del trazo táctil, estabilización S-Form y despacho a motores gráficos extraídos a `useStrokeDrawing.ts`.
 * - Cero caídas de frames con aceleración por GPU a 60-120 FPS.
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { 
  Layer, 
  ToolType, 
  ProjectData, 
  TracingReference, 
  TracingFilterMode, 
  BrushTextureConfig 
} from '../../engine/types';
import { drawingEngine } from '../../engine/webgpuEngine';
import { kotlinVectorEngine } from '../../engine/kotlinWasmBridge';
import { gpuBitmapCache } from '../../engine/bitmapCache';
import { wakeLockService } from '../../engine/wakeLockService';
import { TracingAdjuster } from '../assistants/TracingAdjuster';
import { CrashRecoveryRecord } from '../../storage/sqliteTypes';
import { StudioTopBar } from '../studio/StudioTopBar';
import { StudioBottomBar } from '../studio/StudioBottomBar';
import { StudioCanvasOverlays } from '../studio/StudioCanvasOverlays';
import { useCanvasGestures } from '../../hooks/useCanvasGestures';
import { useStrokeDrawing } from '../../hooks/useStrokeDrawing';

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
  const tracingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Previsualizaciones y modales
  const [showSizePreview, setShowSizePreview] = useState(false);
  const [showOpacityPreview, setShowOpacityPreview] = useState(false);
  const [showStrokeGuide, setShowStrokeGuide] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);

  const triggerHaptic = useCallback((duration = 10) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(duration);
      } catch {
        // Ignorar si no está soportado
      }
    }
  }, []);

  const fallbackLayerRef = useRef<Layer | null>(null);
  if (!fallbackLayerRef.current && typeof document !== 'undefined') {
    const fallbackCanvas = document.createElement('canvas');
    fallbackCanvas.width = project.width;
    fallbackCanvas.height = project.height;
    const fallbackCtx = fallbackCanvas.getContext('2d');
    if (fallbackCtx) {
      fallbackLayerRef.current = {
        id: 'layer_default_1',
        name: 'Capa 1',
        visible: true,
        opacity: 1.0,
        blendMode: 'source-over',
        canvas: fallbackCanvas,
        ctx: fallbackCtx,
      };
    }
  }

  const activeLayer = layers.find(l => l.id === activeLayerId) || layers[0] || fallbackLayerRef.current!;

  // Hook modular de navegación espacial y gestos de lienzo
  const {
    scale,
    pan,
    rotation,
    scaleRef,
    panRef,
    rotationRef,
    containerRef,
    canvasWrapperRef,
    zoomHudRef,
    suppressDrawingRef,
    applyTransformDirect,
    fitToScreen,
    toggleFitOr100,
    resetRotation,
    handleWheel,
    setPan,
  } = useCanvasGestures({
    projectWidth: project.width,
    projectHeight: project.height,
    tracingRef,
    canUndo,
    onUndo,
    triggerHaptic,
  });

  /**
   * Renderiza la capa de fondo y foto de calco en su propio canvas acelerado por GPU.
   * Se ejecuta ÚNICAMENTE cuando cambian las propiedades de la foto de calco o dimensiones del lienzo.
   */
  const renderTracingLayer = useCallback(() => {
    const canvas = tracingCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (canvas.width !== project.width || canvas.height !== project.height) {
      canvas.width = project.width;
      canvas.height = project.height;
    }

    ctx.save();
    ctx.imageSmoothingEnabled = true;

    // Fondo blanco del lienzo
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, project.width, project.height);

    // Si hay foto de calco activa, visible y no está en modo de ajuste manual por tiradores DOM
    if (tracingRef && !tracingRef.isAdjusting && tracingRef.visible && tracingRef.image) {
      ctx.save();
      ctx.globalAlpha = Math.max(0.01, Math.min(1.0, tracingRef.opacity));
      ctx.translate(tracingRef.x, tracingRef.y);
      if (tracingRef.rotation) {
        ctx.rotate(tracingRef.rotation);
      }
      const drawW = tracingRef.width * tracingRef.scale;
      const drawH = tracingRef.height * tracingRef.scale;

      const cacheKey = `tracing_${tracingRef.id}_${tracingRef.filterMode}`;
      const cachedBitmap = gpuBitmapCache.get(cacheKey);
      if (cachedBitmap) {
        ctx.drawImage(cachedBitmap, -drawW / 2, -drawH / 2, drawW, drawH);
      } else {
        ctx.drawImage(tracingRef.image, -drawW / 2, -drawH / 2, drawW, drawH);
        if (typeof createImageBitmap === 'function' && !gpuBitmapCache.isPending(cacheKey)) {
          gpuBitmapCache.markPending(cacheKey);
          createImageBitmap(tracingRef.image)
            .then((bmp) => {
              gpuBitmapCache.set(cacheKey, bmp);
            })
            .catch(() => {})
            .finally(() => {
              gpuBitmapCache.unmarkPending(cacheKey);
            });
        }
      }
      ctx.restore();
    }

    ctx.restore();
  }, [project.width, project.height, tracingRef]);

  useEffect(() => {
    renderTracingLayer();
  }, [renderTracingLayer]);

  /**
   * Redibuja la composición de capas transparentes y trazos vectoriales en el displayCanvas.
   */
  const renderComposite = useCallback(() => {
    const displayCanvas = displayCanvasRef.current;
    if (!displayCanvas) return;
    const ctx = displayCanvas.getContext('2d');
    if (!ctx) return;

    if (displayCanvas.width !== project.width || displayCanvas.height !== project.height) {
      displayCanvas.width = project.width;
      displayCanvas.height = project.height;
    }

    ctx.save();
    ctx.imageSmoothingEnabled = true;

    // Canvas transparente para que el calco subyacente se aprecie con total claridad
    ctx.clearRect(0, 0, project.width, project.height);

    // Dibujar cada capa visible respetando opacidad y modo de fusión
    for (const layer of layers) {
      if (!layer || !layer.canvas || !layer.visible || layer.opacity <= 0) continue;

      ctx.save();
      ctx.globalAlpha = layer.opacity;
      ctx.globalCompositeOperation = layer.blendMode as GlobalCompositeOperation;
      ctx.drawImage(layer.canvas, 0, 0, project.width, project.height);

      // Renderizar trazos vectoriales procesados por Kotlin/Wasm para esta capa
      const vectorStrokes = kotlinVectorEngine.getStrokesForLayer(layer.id);
      if (vectorStrokes && vectorStrokes.length > 0) {
        kotlinVectorEngine.renderVectorStrokes(ctx, vectorStrokes, 1.0);
      }

      // Si hay un trazo vectorial en vivo dibujándose en esta capa, renderizarlo en tiempo real
      if (
        strokeDrawing.currentVectorStrokeRef.current && 
        strokeDrawing.currentVectorStrokeRef.current.layerId === layer.id && 
        strokeDrawing.currentVectorStrokeRef.current.segments.length > 0
      ) {
        kotlinVectorEngine.renderVectorStrokes(
          ctx, 
          [strokeDrawing.currentVectorStrokeRef.current], 
          1.0
        );
      }

      ctx.restore();
    }

    ctx.restore();
  }, [layers, project.width, project.height]);

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

  // Manejador de estampado con redibujado inmediato garantizado en displayCanvas
  const handleStampAccessory = useCallback((asNewLayer: boolean) => {
    if (onStampAccessory) {
      onStampAccessory(asNewLayer);
      requestAnimationFrame(() => {
        renderComposite();
        updateThumbnail();
      });
    }
  }, [onStampAccessory, renderComposite, updateThumbnail]);

  // Hook modular de captura del trazo, estabilización y despacho gráfico
  const strokeDrawing = useStrokeDrawing({
    projectWidth: project.width,
    projectHeight: project.height,
    activeLayer,
    layers,
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
  });

  useEffect(() => {
    renderComposite();
  }, [renderComposite]);

  // Centinela de Pantalla Encendida (WakeLock / Keep-Alive): evita que el teléfono se apague mientras dibujas
  useEffect(() => {
    wakeLockService.acquireWakeLock().catch(() => {});
    return () => {
      wakeLockService.releaseWakeLock().catch(() => {});
    };
  }, []);

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
          {/* Capa 1: Canvas dedicado para Fondo y Foto de Calco (Acelerado en GPU, CERO re-cálculos durante el trazo) */}
          <canvas
            ref={tracingCanvasRef}
            width={project.width}
            height={project.height}
            className="absolute inset-0 w-full h-full block pointer-events-none"
            style={{ zIndex: 1 }}
          />

          {/* Capa 2: Canvas interactivo de capas de dibujo y trazos transparentes */}
          <canvas
            ref={displayCanvasRef}
            width={project.width}
            height={project.height}
            onPointerDown={strokeDrawing.handlePointerDown}
            onPointerMove={strokeDrawing.handlePointerMove}
            onPointerUp={strokeDrawing.handlePointerUp}
            onPointerCancel={strokeDrawing.handlePointerUp}
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
              onStampToActiveLayer={() => handleStampAccessory(false)}
              onStampAsNewLayer={() => handleStampAccessory(true)}
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

      {/* 3. BARRA INFERIOR MODULAR ERGONÓMICA */}
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
