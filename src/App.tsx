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

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ToolType, BrushTextureConfig, DEFAULT_BRUSH_TEXTURE } from './engine/types';
import { StudioScreen } from './components/screens/StudioScreen';
import { GalleryScreen } from './components/screens/GalleryScreen';
import { EngineInfoScreen } from './components/screens/EngineInfoScreen';
import { SettingsInfoScreen } from './components/screens/SettingsInfoScreen';
import { ThemeCustomizationScreen } from './components/screens/ThemeCustomizationScreen';
import { AppRoadmapScreen } from './components/screens/AppRoadmapScreen';
import { LayersModal } from './components/modals/LayersModal';
import { ColorPickerModal } from './components/modals/ColorPickerModal';
import { ToolPickerModal } from './components/modals/ToolPickerModal';
import { BrushTextureModal } from './components/modals/BrushTextureModal';
import { ExportModal } from './components/modals/ExportModal';
import { CanvasResizeModal } from './components/modals/CanvasResizeModal';
import { WelcomeScreen } from './components/screens/WelcomeScreen';
import { detectIsStandalone, detectIsDevOrPreview, shouldShowWelcomeScreen } from './engine/environmentDetector';
import { initializeAppTheme } from './engine/themeEngine';
import { useLayerManager } from './hooks/useLayerManager';
import { useDrawingHistory } from './hooks/useDrawingHistory';
import { useTracingManager } from './hooks/useTracingManager';
import { useProjectPersistence } from './hooks/useProjectPersistence';
import { useCanvasResizeHandler } from './hooks/useCanvasResizeHandler';
import { useAccessoryStamper } from './hooks/useAccessoryStamper';
import { useStudioModals } from './hooks/useStudioModals';
import { sqliteStorageService } from './storage/sqliteStorageService';
import { useOnlineStatus } from './hooks/useOnlineStatus';

export default function App() {
  const isOnline = useOnlineStatus();
  const [offlineReadyToast, setOfflineReadyToast] = useState(false);

  // Escuchar cuando el Service Worker ha cacheado todos los recursos para modo 100% offline
  useEffect(() => {
    const handleOfflineReady = () => {
      setOfflineReadyToast(true);
      const timer = setTimeout(() => setOfflineReadyToast(false), 4500);
      return () => clearTimeout(timer);
    };
    window.addEventListener('pwa-offline-ready', handleOfflineReady);
    return () => window.removeEventListener('pwa-offline-ready', handleOfflineReady);
  }, []);

  // Inicializar tema visual de la app
  useEffect(() => {
    initializeAppTheme();
  }, []);

  // Pantalla activa: 'welcome' | 'studio' | 'gallery' | 'engine' | 'settings' | 'theme' | 'roadmap'
  const [currentScreen, setCurrentScreen] = useState<'welcome' | 'studio' | 'gallery' | 'engine' | 'settings' | 'theme' | 'roadmap'>(() => {
    if (typeof window === 'undefined') return 'studio';

    // 1. Detectar si corre en modo standalone (PWA instalada en pantalla de inicio del teléfono)
    const isStandalone = detectIsStandalone(
      window.matchMedia('(display-mode: standalone)').matches,
      (window.navigator as unknown as { standalone?: boolean })?.standalone,
      document.referrer || ''
    );

    // En la PWA instalada, NUNCA mostrar la bienvenida -> directo al estudio de dibujo
    if (isStandalone) {
      return 'studio';
    }

    // En la web, si el usuario ya pulsó "Usar Estudio en la Web" durante esta sesión -> ir directo al estudio
    const hasDismissed = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('inkflow_welcome_dismissed') === 'true';
    if (hasDismissed) {
      return 'studio';
    }

    // En la web (navegador normal), mostrar la página de bienvenida con la recomendación de descargar la PWA
    return 'welcome';
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
    tracingRef,
    setTracingRef,
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

  // Sincronizar permanentemente la foto de calco con el almacenamiento SQLite Wasm
  // asegurando que cualquier cambio de rotación, escala o posición quede resguardado ante cierre o crash
  useEffect(() => {
    sqliteStorageService.setCurrentTracing(tracingRef);
    if (tracingRef && currentProject && layers.length > 0) {
      sqliteStorageService.scheduleAutoSave(currentProject, layers, tracingRef, 1200);
    }
  }, [tracingRef, currentProject, layers]);

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
    <div className="w-full h-full h-[100dvh] max-h-[100dvh] overflow-hidden bg-[#0e1017]">
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
          onOpenSettings={() => setCurrentScreen('settings')}
          onOpenRoadmap={() => setCurrentScreen('roadmap')}
          onGoToGallery={() => setCurrentScreen('gallery')}
          onGoToEngine={() => setCurrentScreen('engine')}
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
          onGoToSettings={() => setCurrentScreen('settings')}
          onGoToRoadmap={() => setCurrentScreen('roadmap')}
        />
      )}

      {/* Pantalla 3: Diagnóstico y Arquitectura WebGPU / Rust / Kotlin */}
      {currentScreen === 'engine' && (
        <EngineInfoScreen
          onReturnToStudio={() => setCurrentScreen('studio')}
        />
      )}

      {/* Pantalla 4: Ajustes de la App e Información */}
      {currentScreen === 'settings' && (
        <SettingsInfoScreen
          onReturnToStudio={() => setCurrentScreen('studio')}
          onGoToThemeCustomization={() => setCurrentScreen('theme')}
          onGoToRoadmap={() => setCurrentScreen('roadmap')}
          onGoToEngine={() => setCurrentScreen('engine')}
          onGoToGallery={() => setCurrentScreen('gallery')}
        />
      )}

      {/* Pantalla 5: Personalización de Color y Estilo */}
      {currentScreen === 'theme' && (
        <ThemeCustomizationScreen
          onReturnToSettings={() => setCurrentScreen('settings')}
        />
      )}

      {/* Pantalla 6: Planes para la App (Hoja de Ruta y Mover Trazos de Vectores) */}
      {currentScreen === 'roadmap' && (
        <AppRoadmapScreen
          onReturnToPrevious={() => setCurrentScreen('settings')}
          onGoToStudio={() => setCurrentScreen('studio')}
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

      {/* Indicador Ergonómico de Estado Offline: Garantiza al usuario que su app funciona 100% sin internet */}
      {!isOnline && (
        <aside
          role="status"
          aria-live="polite"
          className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-[#14151e]/95 border border-emerald-500/60 text-emerald-300 text-[11px] font-bold px-3 py-1.5 rounded-full shadow-2xl backdrop-blur-md flex items-center gap-1.5 pointer-events-none animate-in fade-in slide-in-from-top-2"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <span>Modo 100% Offline • Todo se guarda en tu teléfono</span>
        </aside>
      )}

      {/* Aviso de confirmación cuando el precaché inicial se completa con éxito */}
      {isOnline && offlineReadyToast && (
        <aside
          role="status"
          aria-live="polite"
          className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-[#14151e]/95 border border-amber-500/60 text-amber-300 text-[11px] font-bold px-3 py-1.5 rounded-full shadow-2xl backdrop-blur-md flex items-center gap-1.5 pointer-events-none animate-in fade-in slide-in-from-top-2"
        >
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
          <span>✨ App descargada localmente • Lista para usar sin internet</span>
        </aside>
      )}
    </div>
  );
}
