/**
 * @file App.tsx
 * @description Componente raíz de IbisPaint WebGPU Studio.
 * Conecta el estado global, el ciclo de vida de capas, el sistema de historial (Deshacer/Rehacer),
 * el subsistema de fotos de referencia para calco (Tracing Engine) con filtros Wasm,
 * y la navegación fluida entre la pantalla de Dibujo (Studio), Galería de Obras y Diagnóstico del Motor.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Layer, ToolType, BlendMode, ProjectData, TracingReference, TracingFilterMode } from './engine/types';
import { kotlinVectorEngine } from './engine/kotlinWasmBridge';
import { 
  calculateInitialTracingFit, 
  extractLineartFromPixels, 
  applyContrastFilter, 
  extractDominantColorsFromImage 
} from './engine/tracingEngine';
import { analyzeImageStrokeThickness } from './engine/strokeAssistant';
import { DEFAULT_PROJECT } from './store/drawingStore';
import { StudioScreen } from './components/StudioScreen';
import { GalleryScreen } from './components/GalleryScreen';
import { EngineInfoScreen } from './components/EngineInfoScreen';
import { LayersModal } from './components/LayersModal';
import { ColorPickerModal } from './components/ColorPickerModal';
import { ToolPickerModal } from './components/ToolPickerModal';
import { ExportModal } from './components/ExportModal';
import { WelcomeScreen } from './components/WelcomeScreen';
import { detectIsStandalone, detectIsDevOrPreview, shouldShowWelcomeScreen } from './engine/environmentDetector';

interface UndoSnapshot {
  layerId: string;
  imageData: ImageData;
}

export default function App() {
  // Pantalla activa: 'welcome' | 'studio' | 'gallery' | 'engine'
  const [currentScreen, setCurrentScreen] = useState<'welcome' | 'studio' | 'gallery' | 'engine'>(() => {
    if (typeof window === 'undefined') return 'studio';

    // 1. Detección de standalone PWA instalada
    const isStandalone = detectIsStandalone(
      window.matchMedia('(display-mode: standalone)').matches,
      (window.navigator as unknown as { standalone?: boolean })?.standalone,
      document.referrer || ''
    );

    // 2. Detección de entorno de desarrollo / previsualización (localhost, *.run.app, aistudio)
    const isDevOrPreview = detectIsDevOrPreview(window.location.hostname, window.location.search);

    // 3. Forzar bienvenida si se especifica explícitamente en la URL
    if (window.location.search.includes('screen=welcome')) {
      return 'welcome';
    }

    // 4. Si el usuario ya entró en la sesión actual
    const hasDismissed = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('inkflow_welcome_dismissed') === 'true';

    // 5. Excepción para el entorno de desarrollo de AI Studio / localhost:
    // Permite al usuario/evaluador probar la app directamente sin obligar a instalar PWA
    if (isDevOrPreview && !window.location.search.includes('force_welcome=true')) {
      return 'studio';
    }

    // 6. En el navegador web estándar (ej: producción inkflow-ezp.pages.dev sin instalar PWA)
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

  // Capas del proyecto (Garantizado: 1 capa limpia al inicio)
  const [layers, setLayers] = useState<Layer[]>([]);
  const [activeLayerId, setActiveLayerId] = useState<string>('');

  // Foto de referencia para calco (Tracing Reference)
  const [tracingRef, setTracingRef] = useState<TracingReference | null>(null);

  // Modales
  const [isLayersModalOpen, setIsLayersModalOpen] = useState(false);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [isToolPickerOpen, setIsToolPickerOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Input oculto para galería de fotos
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Historial de Deshacer / Rehacer
  const undoStackRef = useRef<UndoSnapshot[]>([]);
  const redoStackRef = useRef<UndoSnapshot[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  /**
   * Inicializa las capas para un proyecto dado.
   * Crea exactamente 1 capa inicial limpia (Capa 1).
   */
  const initProjectLayers = useCallback((proj: ProjectData) => {
    const layerCanvas = document.createElement('canvas');
    layerCanvas.width = proj.width;
    layerCanvas.height = proj.height;
    const ctx = layerCanvas.getContext('2d')!;

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

    undoStackRef.current = [];
    redoStackRef.current = [];
    setCanUndo(false);
    setCanRedo(false);
  }, []);

  // Inicializar al cargar el componente
  useEffect(() => {
    initProjectLayers(currentProject);
  }, [initProjectLayers, currentProject]);

  /**
   * Guarda un estado en la pila de Deshacer antes de modificar la capa activa
   */
  const handleSaveUndoSnapshot = useCallback(() => {
    const activeLayer = layers.find(l => l.id === activeLayerId);
    if (!activeLayer) return;

    try {
      const snap = activeLayer.ctx.getImageData(0, 0, activeLayer.canvas.width, activeLayer.canvas.height);
      undoStackRef.current.push({ layerId: activeLayer.id, imageData: snap });
      if (undoStackRef.current.length > 25) {
        undoStackRef.current.shift();
      }
      redoStackRef.current = [];
      setCanUndo(true);
      setCanRedo(false);
    } catch {
      // Ignorar si el canvas está manchado
    }
  }, [layers, activeLayerId]);

  /**
   * Deshacer acción
   */
  const handleUndo = useCallback(() => {
    if (undoStackRef.current.length === 0) return;
    const lastSnap = undoStackRef.current.pop()!;
    const targetLayer = layers.find(l => l.id === lastSnap.layerId);

    if (targetLayer) {
      const currentSnap = targetLayer.ctx.getImageData(0, 0, targetLayer.canvas.width, targetLayer.canvas.height);
      redoStackRef.current.push({ layerId: targetLayer.id, imageData: currentSnap });

      targetLayer.ctx.putImageData(lastSnap.imageData, 0, 0);
      kotlinVectorEngine.popStrokeForLayer(targetLayer.id);
      setLayers([...layers]);
    }

    setCanUndo(undoStackRef.current.length > 0);
    setCanRedo(true);
  }, [layers]);

  /**
   * Rehacer acción
   */
  const handleRedo = useCallback(() => {
    if (redoStackRef.current.length === 0) return;
    const nextSnap = redoStackRef.current.pop()!;
    const targetLayer = layers.find(l => l.id === nextSnap.layerId);

    if (targetLayer) {
      const currentSnap = targetLayer.ctx.getImageData(0, 0, targetLayer.canvas.width, targetLayer.canvas.height);
      undoStackRef.current.push({ layerId: targetLayer.id, imageData: currentSnap });

      targetLayer.ctx.putImageData(nextSnap.imageData, 0, 0);
      setLayers([...layers]);
    }

    setCanUndo(true);
    setCanRedo(redoStackRef.current.length > 0);
  }, [layers]);

  // Referencia para recordar exactamente la herramienta activa previa antes de activar el modo Mover (Mano)
  const previousToolBeforeHandRef = useRef<ToolType>('brush');

  /**
   * Alternar rápido entre pincel y borrador (como en IbisPaint)
   * Garantiza que lastDrawingTool nunca almacene 'hand' ni 'eraser'.
   */
  const handleToggleBrushEraser = () => {
    if (activeTool === 'eraser') {
      const target = lastDrawingTool && lastDrawingTool !== 'eraser' && lastDrawingTool !== 'hand'
        ? lastDrawingTool
        : 'brush';
      setActiveTool(target);
    } else {
      // Solo preservar como lastDrawingTool si la herramienta actual es de dibujo (no hand)
      if (activeTool !== 'hand') {
        setLastDrawingTool(activeTool);
      }
      setActiveTool('eraser');
    }
  };

  /**
   * Selección protegida de herramienta.
   * Evita que 'hand' o 'eraser' corrompan lastDrawingTool y registra la herramienta previa antes de mover.
   */
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

  /**
   * Alternador exclusivo del Modo Mover (Navegación libre con 1 dedo).
   * Al dejar de moverse, restaura estrictamente la herramienta que el usuario tenía activa
   * antes de mover (brush, pencil, marker, airbrush, vector_pencil o eraser),
   * eliminando por completo cualquier cambio involuntario a 'vector_pencil'.
   */
  const handleToggleHandMode = useCallback(() => {
    if (activeTool === 'hand') {
      // Restaurar herramienta previa exacta
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
   * Gestión de Capas
   */
  const handleAddLayer = () => {
    const newCanvas = document.createElement('canvas');
    newCanvas.width = currentProject.width;
    newCanvas.height = currentProject.height;
    const newCtx = newCanvas.getContext('2d')!;

    const newLayer: Layer = {
      id: `layer_${Date.now()}`,
      name: `Capa ${layers.length + 1}`,
      visible: true,
      opacity: 1.0,
      blendMode: 'source-over',
      canvas: newCanvas,
      ctx: newCtx,
    };

    const updated = [...layers, newLayer];
    setLayers(updated);
    setActiveLayerId(newLayer.id);
  };

  const handleDuplicateLayer = (id: string) => {
    const srcLayer = layers.find(l => l.id === id);
    if (!srcLayer) return;

    const dupCanvas = document.createElement('canvas');
    dupCanvas.width = currentProject.width;
    dupCanvas.height = currentProject.height;
    const dupCtx = dupCanvas.getContext('2d')!;
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

    const idx = layers.findIndex(l => l.id === id);
    const updated = [...layers];
    updated.splice(idx + 1, 0, dupLayer);
    setLayers(updated);
    setActiveLayerId(dupLayer.id);
  };

  const handleMergeDown = (id: string) => {
    const idx = layers.findIndex(l => l.id === id);
    if (idx <= 0) return;

    handleSaveUndoSnapshot();
    const upperLayer = layers[idx];
    const lowerLayer = layers[idx - 1];

    lowerLayer.ctx.save();
    lowerLayer.ctx.globalAlpha = upperLayer.opacity;
    lowerLayer.ctx.globalCompositeOperation = upperLayer.blendMode as GlobalCompositeOperation;
    lowerLayer.ctx.drawImage(upperLayer.canvas, 0, 0);
    lowerLayer.ctx.restore();

    const updated = layers.filter(l => l.id !== upperLayer.id);
    setLayers(updated);
    setActiveLayerId(lowerLayer.id);
  };

  const handleDeleteLayer = (id: string) => {
    if (layers.length <= 1) return;
    const updated = layers.filter(l => l.id !== id);
    setLayers(updated);
    if (activeLayerId === id) {
      setActiveLayerId(updated[updated.length - 1].id);
    }
  };

  const handleClearLayer = (id: string) => {
    const layer = layers.find(l => l.id === id);
    if (!layer) return;
    handleSaveUndoSnapshot();
    layer.ctx.clearRect(0, 0, currentProject.width, currentProject.height);
    setLayers([...layers]);
  };

  const handleToggleVisibility = (id: string) => {
    setLayers(layers.map(l => l.id === id ? { ...l, visible: !l.visible } : l));
  };

  const handleChangeOpacity = (id: string, opacity: number) => {
    setLayers(layers.map(l => l.id === id ? { ...l, opacity } : l));
  };

  const handleChangeBlendMode = (id: string, mode: BlendMode) => {
    setLayers(layers.map(l => l.id === id ? { ...l, blendMode: mode } : l));
  };

  const handleMoveLayer = (id: string, direction: 'up' | 'down') => {
    const idx = layers.findIndex(l => l.id === id);
    if (idx === -1) return;
    const targetIdx = direction === 'up' ? idx + 1 : idx - 1;
    if (targetIdx < 0 || targetIdx >= layers.length) return;

    const updated = [...layers];
    const [moved] = updated.splice(idx, 1);
    updated.splice(targetIdx, 0, moved);
    setLayers(updated);
  };

  /**
   * SUBSISTEMA DE CALCO / FOTO DE REFERENCIA
   */
  const handleImportTracingPhoto = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        // Cálculo de posición centrada en la hoja y escala proporcional inicial
        const fit = calculateInitialTracingFit(img.width, img.height, currentProject.width, currentProject.height);
        
        const newTracing: TracingReference = {
          id: `trace_${Date.now()}`,
          image: img,
          src,
          x: fit.x,
          y: fit.y,
          width: img.width,
          height: img.height,
          scale: fit.scale,
          rotation: 0,
          opacity: 0.4, // Opacidad recomendada para calcar
          visible: true,
          isAdjusting: true,
          filterMode: 'original',
        };

        // Extraer automáticamente los colores dominantes y realizar análisis real de grosor de trazo
        try {
          const off = document.createElement('canvas');
          off.width = Math.min(320, img.width);
          off.height = Math.min(320, img.height);
          const oCtx = off.getContext('2d');
          if (oCtx) {
            oCtx.drawImage(img, 0, 0, off.width, off.height);
            const data = oCtx.getImageData(0, 0, off.width, off.height);
            newTracing.extractedColors = extractDominantColorsFromImage(data.data, 6);
            // Análisis real de los 4 roles de grosor de trazo en base a los píxeles de la foto
            newTracing.strokeAnalysis = analyzeImageStrokeThickness(data.data, off.width, off.height, fit.scale);
          }
        } catch {
          // Ignorar si el canvas está manchado
        }

        setTracingRef(newTracing);
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  };

  const handleUpdateTracing = (update: Partial<TracingReference>) => {
    if (!tracingRef) return;
    setTracingRef({ ...tracingRef, ...update });
  };

  const handleApplyTracingFilter = (mode: TracingFilterMode) => {
    if (!tracingRef) return;
    if (mode === 'original') {
      const orig = new Image();
      orig.onload = () => {
        setTracingRef({ ...tracingRef, image: orig, filterMode: 'original' });
      };
      orig.src = tracingRef.src;
      return;
    }

    const off = document.createElement('canvas');
    off.width = tracingRef.width;
    off.height = tracingRef.height;
    const ctx = off.getContext('2d');
    if (!ctx) return;

    const base = new Image();
    base.onload = () => {
      ctx.drawImage(base, 0, 0);
      const imgData = ctx.getImageData(0, 0, off.width, off.height);

      if (mode === 'lineart') {
        const lineart = extractLineartFromPixels(imgData.data, off.width, off.height, true, 34);
        imgData.data.set(lineart);
      } else if (mode === 'contrast') {
        const contrast = applyContrastFilter(imgData.data, 1.8);
        imgData.data.set(contrast);
      } else if (mode === 'grayscale') {
        for (let i = 0; i < imgData.data.length; i += 4) {
          const g = 0.299 * imgData.data[i] + 0.587 * imgData.data[i + 1] + 0.114 * imgData.data[i + 2];
          imgData.data[i] = g;
          imgData.data[i + 1] = g;
          imgData.data[i + 2] = g;
        }
      }

      ctx.putImageData(imgData, 0, 0);
      const filtered = new Image();
      filtered.onload = () => {
        setTracingRef({ ...tracingRef, image: filtered, filterMode: mode });
      };
      filtered.src = off.toDataURL();
    };
    base.src = tracingRef.src;
  };

  const handleCenterTracing = () => {
    if (!tracingRef) return;
    setTracingRef({
      ...tracingRef,
      x: Math.round(currentProject.width / 2),
      y: Math.round(currentProject.height / 2),
    });
  };

  const handleConfirmTracing = () => {
    if (!tracingRef) return;
    // Salir del modo de ajuste con tiradores y fijar la foto de guía
    setTracingRef({ ...tracingRef, isAdjusting: false });
  };

  const handleRemoveTracing = () => {
    setTracingRef(null);
  };

  const handleToggleTracingVisibility = () => {
    if (!tracingRef) return;
    setTracingRef({ ...tracingRef, visible: !tracingRef.visible });
  };

  const handleTriggerFileInput = () => {
    fileInputRef.current?.click();
  };

  /**
   * Gestión de Galería y Creación de Proyectos
   */
  const handleOpenProject = (proj: ProjectData) => {
    setCurrentProject(proj);
    initProjectLayers(proj);
    setTracingRef(null);
    setCurrentScreen('studio');
  };

  const handleCreateNewProject = (name: string, width: number, height: number) => {
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
    setProjects([newProj, ...projects]);
    setCurrentProject(newProj);
    initProjectLayers(newProj);
    setTracingRef(null);
    setCurrentScreen('studio');
  };

  const handleDuplicateProject = (proj: ProjectData) => {
    const dupProj: ProjectData = {
      ...proj,
      id: `proj_${Date.now()}`,
      name: `${proj.name} (Copia)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setProjects([dupProj, ...projects]);
  };

  const handleDeleteProject = (id: string) => {
    if (projects.length <= 1) return;
    const updated = projects.filter(p => p.id !== id);
    setProjects(updated);
    if (currentProject.id === id) {
      setCurrentProject(updated[0]);
      initProjectLayers(updated[0]);
      setTracingRef(null);
    }
  };

  const handleUpdateProjectThumbnail = (thumbnailUrl: string) => {
    setProjects(prev => prev.map(p => p.id === currentProject.id ? { ...p, thumbnailUrl, layerCount: layers.length } : p));
  };

  return (
    <div className="w-full h-full bg-[#0e1017]">
      {/* Input de archivo nativo para seleccionar fotos desde la galería del teléfono */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleImportTracingPhoto(e.target.files[0]);
            e.target.value = '';
          }
        }}
        className="hidden"
      />

      {/* Pantalla 0: Bienvenida y Presentación PWA (para navegadores web estándar) */}
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
          layers={layers}
          activeLayerId={activeLayerId}
          canUndo={canUndo}
          canRedo={canRedo}
          tracingRef={tracingRef}
          onSelectTool={handleSelectTool}
          onToggleHandMode={handleToggleHandMode}
          onToggleBrushEraser={handleToggleBrushEraser}
          onChangeBrushSize={setBrushSize}
          onChangeBrushOpacity={setBrushOpacity}
          onChangeBrushColor={setBrushColor}
          onChangeStabilizer={setStabilizerLevel}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onSaveUndoSnapshot={handleSaveUndoSnapshot}
          onOpenLayersModal={() => setIsLayersModalOpen(true)}
          onOpenColorPicker={() => setIsColorPickerOpen(true)}
          onOpenToolPicker={() => setIsToolPickerOpen(true)}
          onOpenExportModal={() => setIsExportModalOpen(true)}
          onGoToGallery={() => setCurrentScreen('gallery')}
          onGoToEngine={() => setCurrentScreen('engine')}
          onGoToWelcome={() => setCurrentScreen('welcome')}
          onUpdateProjectThumbnail={handleUpdateProjectThumbnail}
          onUpdateTracing={handleUpdateTracing}
          onApplyTracingFilter={handleApplyTracingFilter}
          onCenterTracing={handleCenterTracing}
          onConfirmTracing={handleConfirmTracing}
          onRemoveTracing={handleRemoveTracing}
          onToggleTracingVisibility={handleToggleTracingVisibility}
          onTriggerImportPhoto={handleTriggerFileInput}
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
          onAddLayer={handleAddLayer}
          onDuplicateLayer={handleDuplicateLayer}
          onMergeDown={handleMergeDown}
          onDeleteLayer={handleDeleteLayer}
          onClearLayer={handleClearLayer}
          onToggleVisibility={handleToggleVisibility}
          onChangeOpacity={handleChangeOpacity}
          onChangeBlendMode={handleChangeBlendMode}
          onMoveLayer={handleMoveLayer}
          onTriggerImportPhoto={handleTriggerFileInput}
          onToggleTracingVisibility={handleToggleTracingVisibility}
          onReopenTracingAdjust={() => {
            if (tracingRef) setTracingRef({ ...tracingRef, isAdjusting: true });
          }}
          onRemoveTracing={handleRemoveTracing}
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
    </div>
  );
}
