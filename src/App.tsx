/**
 * @file App.tsx
 * @description Componente raíz orquestador de IbisPaint WebGPU Studio.
 * 
 * Modularizado:
 * - Gestión de capas extraída a `useLayerManager.ts`.
 * - Historial y pila de Deshacer/Rehacer extraídos a `useDrawingHistory.ts`.
 * - Subsistema de fotos de referencia y filtros Wasm extraído a `useTracingManager.ts`.
 * - Persistencia masiva SQLite Wasm (OPFS), auto-guardado y centinela de crash en `useProjectPersistence.ts`.
 * - Expansión de hoja con matriz de anclaje 3x3 en `useCanvasResizeHandler.ts`.
 * - Estampado de stickers y accesorios fotográficos en `useAccessoryStamper.ts`.
 * - Estados de apertura y cierre de ventanas modales en `useStudioModals.ts`.
 */

import React, { useState, useRef, useCallback } from 'react';
import { ToolType, BrushTextureConfig, DEFAULT_BRUSH_TEXTURE } from './engine/types';
import { StudioScreen } from './components/StudioScreen';
import { GalleryScreen } from './components/GalleryScreen';
import { EngineInfoScreen } from './components/EngineInfoScreen';
import { LayersModal } from './components/LayersModal';
import { ColorPickerModal } from './components/ColorPickerModal';
import { ToolPickerModal } from './components/ToolPickerModal';
import { BrushTextureModal } from './components/BrushTextureModal';
import { ExportModal } from './components/ExportModal';
import { CanvasResizeModal } from './components/CanvasResizeModal';
import { WelcomeScreen } from './components/WelcomeScreen';
import { detectIsStandalone, detectIsDevOrPreview, shouldShowWelcomeScreen } from './engine/environmentDetector';
import { useLayerManager } from './hooks/useLayerManager';
import { useDrawingHistory } from './hooks/useDrawingHistory';
import { useTracingManager } from './hooks/useTracingManager';
import { useProjectPersistence } from './hooks/useProjectPersistence';
import { useCanvasResizeHandler } from './hooks/useCanvasResizeHandler';
import { useAccessoryStamper } from './hooks/useAccessoryStamper';
import { useStudioModals } from './hooks/useStudioModals';

export default function App() {
  // Pantalla activa: 'welcome' | 'studio' | 'gallery' | 'engine'
  const [currentScreen, setCurrentScreen] = useState<'welcome' | 'studio' | 'gallery' | 'engine'>(() => {
    if (typeof window === 'undefined') return 'studio';

    const isStandalone = detectIsStandalone(
      window.matchMedia('(display-mode: standalone)').matches,
      (window.navigator as unknown as { standalone?: boolean })?.standalone,
      document.referrer || ''
    );

    const isDevOrPreview = detectIsDevOrPreview(window.location.hostname, window.location.search);

    if (window.location.search.includes('screen=welcome')) {
      return 'welcome';
    }

    const hasDismissed = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('inkflow_welcome_dismissed') === 'true';

    if (isDevOrPreview && !window.location.search.includes('force_welcome=true')) {
      return 'studio';
    }

    const showWelcome = shouldShowWelcomeScreen({
      isStandalone,
      isDevOrPreview,
      hasDismissedWelcome: hasDismissed,
    });

    return showWelcome ? 'welcome' : 'studio';
  });

  // Parámetros de dibujo
  const [activeTool, setActiveTool] = useState<ToolType>('brush');
  const [lastDrawingTool, setLastDrawingTool] = useState<ToolType>('brush');
  const [brushSize, setBrushSize] = useState<number>(12);
  const [brushOpacity, setBrushOpacity] = useState<number>(1.0);
  const [brushColor, setBrushColor] = useState<string>('#18181b');
  const [stabilizerLevel, setStabilizerLevel] = useState<number>(3);
  const [brushTexture, setBrushTexture] = useState<BrushTextureConfig>(DEFAULT_BRUSH_TEXTURE);
  
  // Configuración del Bote de Pintura (Bucket Fill con Expansión de Borde y Cierre de Huecos)
  const [bucketExpansion, setBucketExpansion] = useState<number>(2); // 0 a 3 px (default 2px)
  const [bucketTolerance, setBucketTolerance] = useState<number>(32); // 0 a 100
  const [bucketGapClosing, setBucketGapClosing] = useState<number>(3); // 0 a 10 px (default 3px)

  // Sub-hooks de dominio especializados
  const {
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
  } = useLayerManager();

  const {
    canUndo,
    canRedo,
    saveUndoSnapshot,
    undo,
    redo,
    resetHistory,
  } = useDrawingHistory(layers, activeLayerId, setLayers);

  const {
    tracingRef,
    setTracingRef,
    importTracingPhoto,
    importAccessoryPhoto,
    updateTracing,
    applyTracingFilter,
    centerTracing,
    confirmTracing,
    removeTracing,
    toggleTracingVisibility,
  } = useTracingManager();

  const {
    projects,
    setProjects,
    currentProject,
    setCurrentProject,
    crashRecovery,
    handleRestoreCrash,
    handleDismissCrash,
    handleStrokeEnd,
    handleOpenProject,
    handleCreateNewProject,
    handleDuplicateProject,
    handleDeleteProject,
    handleUpdateProjectThumbnail,
  } = useProjectPersistence({
    initProjectLayers,
    resetHistory,
    setLayers,
    setActiveLayerId,
    removeTracing,
    setCurrentScreen,
  });

  const { handleApplyCanvasResize } = useCanvasResizeHandler({
    currentProject,
    layers,
    tracingRef,
    saveUndoSnapshot,
    setCurrentProject,
    setLayers,
    setProjects,
    setTracingRef,
  });

  const { handleStampAccessory } = useAccessoryStamper({
    currentProject,
    layers,
    activeLayerId,
    tracingRef,
    saveUndoSnapshot,
    setLayers,
    setActiveLayerId,
    removeTracing,
  });

  const {
    isLayersModalOpen,
    setIsLayersModalOpen,
    isColorPickerOpen,
    setIsColorPickerOpen,
    isToolPickerOpen,
    setIsToolPickerOpen,
    isTextureModalOpen,
    setIsTextureModalOpen,
    isExportModalOpen,
    setIsExportModalOpen,
    isCanvasResizeModalOpen,
    setIsCanvasResizeModalOpen,
  } = useStudioModals();

  // Input oculto para galería de fotos y accesorios
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const galleryImportModeRef = useRef<'tracing' | 'accessory'>('tracing');
  const previousToolBeforeHandRef = useRef<ToolType>('brush');

  const handleToggleBrushEraser = () => {
    if (activeTool === 'eraser') {
      const target = lastDrawingTool && lastDrawingTool !== 'eraser' && lastDrawingTool !== 'hand'
        ? lastDrawingTool
        : 'brush';
      setActiveTool(target);
    } else {
      if (activeTool !== 'hand') {
        setLastDrawingTool(activeTool);
      }
      setActiveTool('eraser');
    }
  };

  const handleSelectTool = useCallback((tool: ToolType) => {
    if (tool === 'hand') {
      if (activeTool !== 'hand') {
        previousToolBeforeHandRef.current = activeTool;
      }
    } else {
      if (tool !== 'eraser') {
        setLastDrawingTool(tool);
      }
    }
    setActiveTool(tool);
  }, [activeTool]);

  const handleToggleHandMode = useCallback(() => {
    if (activeTool === 'hand') {
      const restoreTool = previousToolBeforeHandRef.current && previousToolBeforeHandRef.current !== 'hand'
        ? previousToolBeforeHandRef.current
        : (lastDrawingTool && lastDrawingTool !== 'hand' ? lastDrawingTool : 'brush');
      setActiveTool(restoreTool);
    } else {
      previousToolBeforeHandRef.current = activeTool;
      setActiveTool('hand');
    }
  }, [activeTool, lastDrawingTool]);

  const handleTriggerTracingInput = () => {
    galleryImportModeRef.current = 'tracing';
    fileInputRef.current?.click();
  };

  const handleTriggerAccessoryInput = () => {
    galleryImportModeRef.current = 'accessory';
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full h-full bg-[#0e1017]">
      {/* Input de archivo nativo para seleccionar fotos o accesorios desde la galería */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            if (galleryImportModeRef.current === 'accessory') {
              importAccessoryPhoto(e.target.files[0], currentProject.width, currentProject.height);
            } else {
              importTracingPhoto(e.target.files[0], currentProject.width, currentProject.height);
            }
            e.target.value = '';
          }
        }}
        className="hidden"
      />

      {/* Pantalla 0: Bienvenida y Presentación PWA */}
      {currentScreen === 'welcome' && (
        <WelcomeScreen
          onEnterStudio={() => {
            if (typeof sessionStorage !== 'undefined') {
              sessionStorage.setItem('inkflow_welcome_dismissed', 'true');
            }
            setCurrentScreen('studio');
          }}
          onGoToGallery={() => {
            if (typeof sessionStorage !== 'undefined') {
              sessionStorage.setItem('inkflow_welcome_dismissed', 'true');
            }
            setCurrentScreen('gallery');
          }}
        />
      )}

      {/* Pantalla 1: Estudio de Dibujo Principal */}
      {currentScreen === 'studio' && (
        <StudioScreen
          project={currentProject}
          activeTool={activeTool}
          lastDrawingTool={lastDrawingTool}
          brushSize={brushSize}
          brushOpacity={brushOpacity}
          brushColor={brushColor}
          brushTexture={brushTexture}
          stabilizerLevel={stabilizerLevel}
          bucketExpansion={bucketExpansion}
          onChangeBucketExpansion={setBucketExpansion}
          bucketTolerance={bucketTolerance}
          onChangeBucketTolerance={setBucketTolerance}
          bucketGapClosing={bucketGapClosing}
          onChangeBucketGapClosing={setBucketGapClosing}
          layers={layers}
          activeLayerId={activeLayerId}
          canUndo={canUndo}
          canRedo={canRedo}
          tracingRef={tracingRef}
          crashRecovery={crashRecovery}
          onSelectTool={handleSelectTool}
          onToggleHandMode={handleToggleHandMode}
          onToggleBrushEraser={handleToggleBrushEraser}
          onChangeBrushSize={setBrushSize}
          onChangeBrushOpacity={setBrushOpacity}
          onChangeBrushColor={setBrushColor}
          onChangeStabilizer={setStabilizerLevel}
          onUndo={undo}
          onRedo={redo}
          onSaveUndoSnapshot={saveUndoSnapshot}
          onStrokeEnd={() => handleStrokeEnd(layers)}
          onRestoreCrash={handleRestoreCrash}
          onDismissCrash={handleDismissCrash}
          onOpenLayersModal={() => setIsLayersModalOpen(true)}
          onOpenColorPicker={() => setIsColorPickerOpen(true)}
          onOpenToolPicker={() => setIsToolPickerOpen(true)}
          onOpenTextureModal={() => setIsTextureModalOpen(true)}
          onOpenExportModal={() => setIsExportModalOpen(true)}
          onOpenCanvasResizeModal={() => setIsCanvasResizeModalOpen(true)}
          onGoToGallery={() => setCurrentScreen('gallery')}
          onGoToEngine={() => setCurrentScreen('engine')}
          onGoToWelcome={() => setCurrentScreen('welcome')}
          onUpdateProjectThumbnail={(thumb) => handleUpdateProjectThumbnail(thumb, layers)}
          onUpdateTracing={updateTracing}
          onApplyTracingFilter={applyTracingFilter}
          onCenterTracing={() => centerTracing(currentProject.width, currentProject.height)}
          onConfirmTracing={confirmTracing}
          onRemoveTracing={removeTracing}
          onToggleTracingVisibility={toggleTracingVisibility}
          onTriggerImportPhoto={handleTriggerTracingInput}
          onTriggerImportAccessory={handleTriggerAccessoryInput}
          onStampAccessory={handleStampAccessory}
        />
      )}

      {/* Pantalla 2: Galería de Obras y Proyectos */}
      {currentScreen === 'gallery' && (
        <GalleryScreen
          projects={projects}
          currentProjectId={currentProject.id}
          onOpenProject={handleOpenProject}
          onCreateNewProject={handleCreateNewProject}
          onDuplicateProject={handleDuplicateProject}
          onDeleteProject={handleDeleteProject}
          onReturnToStudio={() => setCurrentScreen('studio')}
          onGoToWelcome={() => setCurrentScreen('welcome')}
        />
      )}

      {/* Pantalla 3: Diagnóstico y Arquitectura WebGPU / Rust / Kotlin */}
      {currentScreen === 'engine' && (
        <EngineInfoScreen
          onReturnToStudio={() => setCurrentScreen('studio')}
        />
      )}

      {/* Modales y Paneles Desplegables */}
      {isLayersModalOpen && (
        <LayersModal
          layers={layers}
          activeLayerId={activeLayerId}
          tracingRef={tracingRef}
          onSelectLayer={setActiveLayerId}
          onAddLayer={() => addLayer(currentProject.width, currentProject.height)}
          onDuplicateLayer={(id) => duplicateLayer(id, currentProject.width, currentProject.height)}
          onMergeDown={(id) => mergeDown(id, saveUndoSnapshot)}
          onDeleteLayer={deleteLayer}
          onClearLayer={(id) => clearLayer(id, currentProject.width, currentProject.height, saveUndoSnapshot)}
          onToggleVisibility={toggleVisibility}
          onChangeOpacity={changeOpacity}
          onChangeBlendMode={changeBlendMode}
          onMoveLayer={moveLayer}
          onTriggerImportPhoto={handleTriggerTracingInput}
          onTriggerImportAccessory={handleTriggerAccessoryInput}
          onToggleTracingVisibility={toggleTracingVisibility}
          onReopenTracingAdjust={() => {
            if (tracingRef) updateTracing({ isAdjusting: true });
          }}
          onRemoveTracing={removeTracing}
          onClose={() => setIsLayersModalOpen(false)}
        />
      )}

      {isColorPickerOpen && (
        <ColorPickerModal
          currentColor={brushColor}
          tracingColors={tracingRef?.extractedColors}
          onSelectColor={setBrushColor}
          onClose={() => setIsColorPickerOpen(false)}
        />
      )}

      {isToolPickerOpen && (
        <ToolPickerModal
          activeTool={activeTool}
          onSelectTool={(tool) => {
            handleSelectTool(tool);
            setIsToolPickerOpen(false);
          }}
          stabilizerLevel={stabilizerLevel}
          onChangeStabilizer={setStabilizerLevel}
          bucketExpansion={bucketExpansion}
          onChangeBucketExpansion={setBucketExpansion}
          bucketTolerance={bucketTolerance}
          onChangeBucketTolerance={setBucketTolerance}
          bucketGapClosing={bucketGapClosing}
          onChangeBucketGapClosing={setBucketGapClosing}
          onOpenTextureModal={() => setIsTextureModalOpen(true)}
          onClose={() => setIsToolPickerOpen(false)}
        />
      )}

      {isTextureModalOpen && (
        <BrushTextureModal
          currentTexture={brushTexture}
          brushColor={brushColor}
          onApplyTexture={setBrushTexture}
          onClose={() => setIsTextureModalOpen(false)}
        />
      )}

      {isExportModalOpen && (
        <ExportModal
          layers={layers}
          width={currentProject.width}
          height={currentProject.height}
          projectName={currentProject.name}
          onClose={() => setIsExportModalOpen(false)}
        />
      )}

      {isCanvasResizeModalOpen && (
        <CanvasResizeModal
          currentWidth={currentProject.width}
          currentHeight={currentProject.height}
          onApplyResize={handleApplyCanvasResize}
          onClose={() => setIsCanvasResizeModalOpen(false)}
        />
      )}
    </div>
  );
}
