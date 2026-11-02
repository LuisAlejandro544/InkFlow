/**
 * @file App.tsx
 * @description Componente raíz de IbisPaint WebGPU Studio.
 * 
 * Modularizado:
 * - Gestión de capas extraída a `useLayerManager.ts`.
 * - Historial y pila de Deshacer/Rehacer extraídos a `useDrawingHistory.ts`.
 * - Subsistema de fotos de referencia y filtros Wasm extraído a `useTracingManager.ts`.
 * - Conecta persistencia SQLite Wasm sobre OPFS, centinela de crash y navegación por pantallas.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ToolType, ProjectData, Layer } from './engine/types';
import { kotlinVectorEngine } from './engine/kotlinWasmBridge';
import { DEFAULT_PROJECT } from './store/drawingStore';
import { StudioScreen } from './components/StudioScreen';
import { GalleryScreen } from './components/GalleryScreen';
import { EngineInfoScreen } from './components/EngineInfoScreen';
import { LayersModal } from './components/LayersModal';
import { ColorPickerModal } from './components/ColorPickerModal';
import { ToolPickerModal } from './components/ToolPickerModal';
import { ExportModal } from './components/ExportModal';
import { CanvasResizeModal } from './components/CanvasResizeModal';
import { CanvasAnchor, calculateResizeOffsets } from './engine/canvasResizeMath';
import { WelcomeScreen } from './components/WelcomeScreen';
import { detectIsStandalone, detectIsDevOrPreview, shouldShowWelcomeScreen } from './engine/environmentDetector';
import { sqliteStorageService } from './storage/sqliteStorageService';
import { CrashRecoveryRecord, StoredProjectPayload } from './storage/sqliteTypes';
import { gpuBitmapCache } from './engine/bitmapCache';
import { useLayerManager } from './hooks/useLayerManager';
import { useDrawingHistory } from './hooks/useDrawingHistory';
import { useTracingManager } from './hooks/useTracingManager';

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
  
  // Proyectos guardados
  const [projects, setProjects] = useState<ProjectData[]>([DEFAULT_PROJECT]);
  const [currentProject, setCurrentProject] = useState<ProjectData>(DEFAULT_PROJECT);

  // Parámetros de dibujo
  const [activeTool, setActiveTool] = useState<ToolType>('brush');
  const [lastDrawingTool, setLastDrawingTool] = useState<ToolType>('brush');
  const [brushSize, setBrushSize] = useState<number>(12);
  const [brushOpacity, setBrushOpacity] = useState<number>(1.0);
  const [brushColor, setBrushColor] = useState<string>('#18181b');
  const [stabilizerLevel, setStabilizerLevel] = useState<number>(3);
  
  // Configuración del Bote de Pintura (Bucket Fill con Expansión de Borde y Cierre de Huecos)
  const [bucketExpansion, setBucketExpansion] = useState<number>(2); // 0 a 3 px (default 2px)
  const [bucketTolerance, setBucketTolerance] = useState<number>(32); // 0 a 100
  const [bucketGapClosing, setBucketGapClosing] = useState<number>(3); // 0 a 10 px (default 3px)

  // Hooks modulares de arquitectura
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

  // Modales
  const [isLayersModalOpen, setIsLayersModalOpen] = useState(false);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [isToolPickerOpen, setIsToolPickerOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isCanvasResizeModalOpen, setIsCanvasResizeModalOpen] = useState(false);

  // Input oculto para galería de fotos y accesorios
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const galleryImportModeRef = useRef<'tracing' | 'accessory'>('tracing');

  // Centinela de Crash y Recuperación de Emergencia
  const [crashRecovery, setCrashRecovery] = useState<CrashRecoveryRecord | null>(null);

  /**
   * Carga un proyecto con todas sus capas reconstruidas fielmente desde SQLite Wasm (OPFS)
   */
  const loadProjectWithLayers = useCallback(async (proj: ProjectData) => {
    try {
      const stored = await sqliteStorageService.loadProject(proj.id);
      if (stored && stored.layers && stored.layers.length > 0) {
        const reconstructedLayers: Layer[] = await Promise.all(
          stored.layers.map((sl) => {
            return new Promise<Layer>((resolve) => {
              const canvas = document.createElement('canvas');
              canvas.width = proj.width;
              canvas.height = proj.height;
              const ctx = canvas.getContext('2d')!;

              if (sl.imageDataUrl) {
                if (typeof createImageBitmap === 'function') {
                  gpuBitmapCache
                    .getOrCreate(`layer_${sl.id}_${sl.orderIndex}`, sl.imageDataUrl)
                    .then((bmp) => {
                      ctx.drawImage(bmp, 0, 0);
                      resolve({
                        id: sl.id,
                        name: sl.name,
                        visible: sl.visible,
                        opacity: sl.opacity,
                        blendMode: sl.blendMode,
                        locked: sl.locked,
                        canvas,
                        ctx,
                      });
                    })
                    .catch(() => {
                      const img = new Image();
                      img.onload = () => {
                        ctx.drawImage(img, 0, 0);
                        resolve({
                          id: sl.id,
                          name: sl.name,
                          visible: sl.visible,
                          opacity: sl.opacity,
                          blendMode: sl.blendMode,
                          locked: sl.locked,
                          canvas,
                          ctx,
                        });
                      };
                      img.onerror = () => {
                        resolve({
                          id: sl.id,
                          name: sl.name,
                          visible: sl.visible,
                          opacity: sl.opacity,
                          blendMode: sl.blendMode,
                          locked: sl.locked,
                          canvas,
                          ctx,
                        });
                      };
                      img.src = sl.imageDataUrl;
                    });
                } else {
                  const img = new Image();
                  img.onload = () => {
                    ctx.drawImage(img, 0, 0);
                    resolve({
                      id: sl.id,
                      name: sl.name,
                      visible: sl.visible,
                      opacity: sl.opacity,
                      blendMode: sl.blendMode,
                      locked: sl.locked,
                      canvas,
                      ctx,
                    });
                  };
                  img.onerror = () => {
                    resolve({
                      id: sl.id,
                      name: sl.name,
                      visible: sl.visible,
                      opacity: sl.opacity,
                      blendMode: sl.blendMode,
                      locked: sl.locked,
                      canvas,
                      ctx,
                    });
                  };
                  img.src = sl.imageDataUrl;
                }
              } else {
                resolve({
                  id: sl.id,
                  name: sl.name,
                  visible: sl.visible,
                  opacity: sl.opacity,
                  blendMode: sl.blendMode,
                  locked: sl.locked,
                  canvas,
                  ctx,
                });
              }
            });
          })
        );

        setLayers(reconstructedLayers);
        setActiveLayerId(reconstructedLayers[0]?.id || '');
        resetHistory();
        return;
      }
    } catch (err) {
      console.warn('[SQLite Wasm] No se encontraron capas previas, iniciando limpias:', err);
    }

    const created = initProjectLayers(proj);
    resetHistory();
    sqliteStorageService.scheduleAutoSave(proj, created, 800);
  }, [initProjectLayers, resetHistory, setActiveLayerId, setLayers]);

  // Arranque del motor SQLite Wasm & Comprobación de Crash previo
  useEffect(() => {
    let isCancelled = false;

    async function bootstrap() {
      try {
        if (typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.persist === 'function') {
          navigator.storage.persist().catch(() => {});
        }

        await sqliteStorageService.init();

        const recovery = await sqliteStorageService.checkCrashRecovery();
        if (recovery && !isCancelled) {
          setCrashRecovery(recovery);
        }

        const dbProjects = await sqliteStorageService.getAllProjects();
        if (!isCancelled && dbProjects && dbProjects.length > 0) {
          setProjects(dbProjects);
          const latestProj = dbProjects[0];
          setCurrentProject(latestProj);
          await loadProjectWithLayers(latestProj);
          return;
        }

        if (!isCancelled) {
          const created = initProjectLayers(DEFAULT_PROJECT);
          resetHistory();
          sqliteStorageService.saveProject(DEFAULT_PROJECT, created);
        }
      } catch (err) {
        console.warn('Fallo en inicialización de almacenamiento SQLite:', err);
        if (!isCancelled) {
          initProjectLayers(DEFAULT_PROJECT);
          resetHistory();
        }
      }
    }

    bootstrap();

    return () => {
      isCancelled = true;
    };
  }, [initProjectLayers, loadProjectWithLayers, resetHistory]);

  /**
   * Restaura la obra de arte desde el punto de guardado de emergencia ante crash
   */
  const handleRestoreCrash = useCallback(async () => {
    if (!crashRecovery) return;

    try {
      const payload: StoredProjectPayload = JSON.parse(crashRecovery.payloadJson);
      setCurrentProject(payload.project);

      const restoredLayers: Layer[] = await Promise.all(
        payload.layers.map((sl) => {
          return new Promise<Layer>((resolve) => {
            const canvas = document.createElement('canvas');
            canvas.width = payload.project.width;
            canvas.height = payload.project.height;
            const ctx = canvas.getContext('2d')!;

            if (sl.imageDataUrl) {
              const img = new Image();
              img.onload = () => {
                ctx.drawImage(img, 0, 0);
                resolve({
                  id: sl.id,
                  name: sl.name,
                  visible: sl.visible,
                  opacity: sl.opacity,
                  blendMode: sl.blendMode,
                  locked: sl.locked,
                  canvas,
                  ctx,
                });
              };
              img.onerror = () => {
                resolve({
                  id: sl.id,
                  name: sl.name,
                  visible: sl.visible,
                  opacity: sl.opacity,
                  blendMode: sl.blendMode,
                  locked: sl.locked,
                  canvas,
                  ctx,
                });
              };
              img.src = sl.imageDataUrl;
            } else {
              resolve({
                id: sl.id,
                name: sl.name,
                visible: sl.visible,
                opacity: sl.opacity,
                blendMode: sl.blendMode,
                locked: sl.locked,
                canvas,
                ctx,
              });
            }
          });
        })
      );

      setLayers(restoredLayers);
      setActiveLayerId(restoredLayers[0]?.id || '');
      resetHistory();
      setCrashRecovery(null);
      await sqliteStorageService.clearCrashRecovery();
      setCurrentScreen('studio');
    } catch (err) {
      console.error('Error al restaurar sesión recuperada:', err);
    }
  }, [crashRecovery, resetHistory, setActiveLayerId, setLayers]);

  const handleDismissCrash = useCallback(async () => {
    setCrashRecovery(null);
    await sqliteStorageService.clearCrashRecovery();
  }, []);

  /**
   * Auto-guardado en segundo plano tras cada trazo finalizado
   */
  const handleStrokeEnd = useCallback(() => {
    if (currentProject && layers.length > 0) {
      sqliteStorageService.scheduleAutoSave(currentProject, layers, 1000);
    }
  }, [currentProject, layers]);

  // Herramienta previa antes de activar el modo Mano
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

  /**
   * Expansión de dimensiones del lienzo (Canvas Resize & Expansion).
   */
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
    [currentProject, layers, tracingRef, saveUndoSnapshot, setLayers, setTracingRef]
  );

  const handleTriggerTracingInput = () => {
    galleryImportModeRef.current = 'tracing';
    fileInputRef.current?.click();
  };

  const handleTriggerAccessoryInput = () => {
    galleryImportModeRef.current = 'accessory';
    fileInputRef.current?.click();
  };

  /**
   * Estampa el accesorio / sticker colocado sobre el lienzo de forma permanente en la obra maestra
   */
  const handleStampAccessory = useCallback((asNewLayer: boolean) => {
    if (!tracingRef || !tracingRef.image) return;
    saveUndoSnapshot();

    const drawWidth = tracingRef.width * tracingRef.scale;
    const drawHeight = tracingRef.height * tracingRef.scale;

    if (asNewLayer) {
      const newCanvas = document.createElement('canvas');
      newCanvas.width = currentProject.width;
      newCanvas.height = currentProject.height;
      const newCtx = newCanvas.getContext('2d')!;

      newCtx.save();
      newCtx.translate(tracingRef.x, tracingRef.y);
      if (tracingRef.rotation) {
        newCtx.rotate(tracingRef.rotation);
      }
      newCtx.globalAlpha = Math.max(0.01, Math.min(1.0, tracingRef.opacity));
      newCtx.drawImage(
        tracingRef.image,
        -drawWidth / 2,
        -drawHeight / 2,
        drawWidth,
        drawHeight
      );
      newCtx.restore();

      const newLayer: Layer = {
        id: `layer_${Date.now()}`,
        name: tracingRef.purpose === 'accessory' ? 'Accesorio (Moño)' : 'Calco Estampado',
        visible: true,
        opacity: 1.0,
        blendMode: 'source-over',
        canvas: newCanvas,
        ctx: newCtx,
      };

      const updatedLayers = [...layers, newLayer];
      setLayers(updatedLayers);
      setActiveLayerId(newLayer.id);
      sqliteStorageService.scheduleAutoSave(currentProject, updatedLayers, 500);
    } else {
      const activeLayer = layers.find((l) => l.id === activeLayerId) || layers[0];
      if (activeLayer) {
        const ctx = activeLayer.ctx;
        ctx.save();
        ctx.translate(tracingRef.x, tracingRef.y);
        if (tracingRef.rotation) {
          ctx.rotate(tracingRef.rotation);
        }
        ctx.globalAlpha = Math.max(0.01, Math.min(1.0, tracingRef.opacity));
        ctx.drawImage(
          tracingRef.image,
          -drawWidth / 2,
          -drawHeight / 2,
          drawWidth,
          drawHeight
        );
        ctx.restore();
        sqliteStorageService.scheduleAutoSave(currentProject, layers, 500);
      }
    }

    removeTracing();
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate(15); } catch {}
    }
  }, [tracingRef, currentProject, layers, activeLayerId, saveUndoSnapshot, setLayers, setActiveLayerId, removeTracing]);

  /**
   * Gestión de Galería y Creación de Proyectos en SQLite Wasm
   */
  const handleOpenProject = async (proj: ProjectData) => {
    setCurrentProject(proj);
    await loadProjectWithLayers(proj);
    removeTracing();
    setCurrentScreen('studio');
  };

  const handleCreateNewProject = async (name: string, width: number, height: number) => {
    const newProj: ProjectData = {
      id: `proj_${Date.now()}`,
      name,
      width,
      height,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      thumbnailUrl: '',
      layerCount: 1,
    };
    const updated = [newProj, ...projects];
    setProjects(updated);
    setCurrentProject(newProj);
    const createdLayers = initProjectLayers(newProj);
    resetHistory();
    removeTracing();
    setCurrentScreen('studio');

    try {
      await sqliteStorageService.saveProject(newProj, createdLayers);
    } catch (e) {
      console.warn('Error al guardar nuevo proyecto en SQLite:', e);
    }
  };

  const handleDuplicateProject = async (proj: ProjectData) => {
    try {
      const newId = `proj_${Date.now()}`;
      const newName = `${proj.name} (Copia)`;
      const dupProj = await sqliteStorageService.duplicateProject(proj.id, newId, newName);
      setProjects([dupProj, ...projects]);
    } catch (err) {
      console.warn('Error al duplicar en SQLite:', err);
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (projects.length <= 1) return;
    try {
      await sqliteStorageService.deleteProject(id);
    } catch (e) {
      console.warn('Error al eliminar proyecto de SQLite:', e);
    }
    const updated = projects.filter(p => p.id !== id);
    setProjects(updated);
    if (currentProject.id === id) {
      setCurrentProject(updated[0]);
      await loadProjectWithLayers(updated[0]);
      removeTracing();
    }
  };

  const handleUpdateProjectThumbnail = (thumbnailUrl: string) => {
    setProjects(prev => prev.map(p => p.id === currentProject.id ? { ...p, thumbnailUrl, layerCount: layers.length } : p));
    if (currentProject && layers.length) {
      sqliteStorageService.scheduleAutoSave({ ...currentProject, thumbnailUrl }, layers, 400);
    }
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
          onStrokeEnd={handleStrokeEnd}
          onRestoreCrash={handleRestoreCrash}
          onDismissCrash={handleDismissCrash}
          onOpenLayersModal={() => setIsLayersModalOpen(true)}
          onOpenColorPicker={() => setIsColorPickerOpen(true)}
          onOpenToolPicker={() => setIsToolPickerOpen(true)}
          onOpenExportModal={() => setIsExportModalOpen(true)}
          onOpenCanvasResizeModal={() => setIsCanvasResizeModalOpen(true)}
          onGoToGallery={() => setCurrentScreen('gallery')}
          onGoToEngine={() => setCurrentScreen('engine')}
          onGoToWelcome={() => setCurrentScreen('welcome')}
          onUpdateProjectThumbnail={handleUpdateProjectThumbnail}
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
          onClose={() => setIsToolPickerOpen(false)}
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
