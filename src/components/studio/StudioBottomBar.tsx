/**
 * @file StudioBottomBar.tsx
 * @description Barra inferior ergonómica y dock táctil estilo IbisPaint para StudioScreen.
 * 
 * Contiene:
 * - Asistente inteligente de grosor de trazo (StrokeGuideAssistant) si está activo.
 * - Deslizadores táctiles amplios de Grosor (1-100px) y Opacidad (1-100%) para el pulgar.
 * - Dock táctil de 5 columnas balanceadas (cero truncamiento):
 *   1. Alternador Pincel / Vector / Goma
 *   2. Catálogo de Pinceles
 *   3. Modo Mover Lienzo (Hand)
 *   4. Indicador y Selector de Color
 *   5. Gestor de Capas con contador numérico
 */

import React from 'react';
import { 
  Paintbrush, Eraser, PenTool, Sliders, Hand, Move, 
  Layers as LayersIcon, Sparkles, PaintBucket, Pipette,
  SprayCan, Feather, Highlighter
} from 'lucide-react';
import { Layer, ToolType, TracingReference, BrushTextureConfig } from '../../engine/types';
import { StrokeGuideAssistant } from '../StrokeGuideAssistant';

export interface StudioBottomBarProps {
  activeTool: ToolType;
  lastDrawingTool: ToolType;
  brushSize: number;
  brushOpacity: number;
  brushColor: string;
  brushTexture?: BrushTextureConfig;
  layers: Layer[];
  tracingRef: TracingReference | null;
  showStrokeGuide: boolean;
  onToggleBrushEraser: () => void;
  onOpenToolPicker: () => void;
  onOpenTextureModal?: () => void;
  onToggleHandMode?: () => void;
  onSelectTool: (tool: ToolType) => void;
  onOpenColorPicker: () => void;
  onOpenLayersModal: () => void;
  onChangeBrushSize: (size: number) => void;
  onChangeBrushOpacity: (opacity: number) => void;
  onCloseStrokeGuide: () => void;
  setShowSizePreview: (show: boolean) => void;
  setShowOpacityPreview: (show: boolean) => void;
  triggerHaptic: (duration?: number) => void;
}

/**
 * Retorna el icono, etiqueta legible y estilos temáticos para cada herramienta de dibujo.
 */
function getToolVisualInfo(tool: ToolType) {
  switch (tool) {
    case 'vector_pencil':
      return {
        name: 'Vector',
        icon: <PenTool size={18} className="text-amber-300" />,
        colorClass: 'bg-amber-500/15 border-amber-400/70 text-amber-300',
        activeColor: 'text-amber-300',
      };
    case 'eraser':
      return {
        name: 'Goma',
        icon: <Eraser size={18} className="text-red-300" />,
        colorClass: 'bg-red-950/40 border-red-500/60 text-red-300',
        activeColor: 'text-red-300',
      };
    case 'bucket':
      return {
        name: 'Bote',
        icon: <PaintBucket size={18} className="text-indigo-300" />,
        colorClass: 'bg-indigo-500/20 border-indigo-400/70 text-indigo-300',
        activeColor: 'text-indigo-300',
      };
    case 'eyedropper':
      return {
        name: 'Gotero',
        icon: <Pipette size={18} className="text-cyan-300" />,
        colorClass: 'bg-cyan-500/20 border-cyan-400/70 text-cyan-300',
        activeColor: 'text-cyan-300',
      };
    case 'airbrush':
      return {
        name: 'Spray',
        icon: <SprayCan size={18} className="text-purple-300" />,
        colorClass: 'bg-purple-500/20 border-purple-400/70 text-purple-300',
        activeColor: 'text-purple-300',
      };
    case 'pencil':
      return {
        name: 'Lápiz',
        icon: <Feather size={18} className="text-slate-300" />,
        colorClass: 'bg-slate-500/20 border-slate-400/70 text-slate-300',
        activeColor: 'text-slate-300',
      };
    case 'marker':
      return {
        name: 'Marcador',
        icon: <Highlighter size={18} className="text-emerald-300" />,
        colorClass: 'bg-emerald-500/20 border-emerald-400/70 text-emerald-300',
        activeColor: 'text-emerald-300',
      };
    case 'brush':
    default:
      return {
        name: 'Pincel',
        icon: <Paintbrush size={18} className="text-amber-400" />,
        colorClass: 'bg-amber-500/10 border-amber-500/40 text-amber-400',
        activeColor: 'text-amber-400',
      };
  }
}

export const StudioBottomBar: React.FC<StudioBottomBarProps> = ({
  activeTool,
  lastDrawingTool,
  brushSize,
  brushOpacity,
  brushColor,
  brushTexture,
  layers,
  tracingRef,
  showStrokeGuide,
  onToggleBrushEraser,
  onOpenToolPicker,
  onOpenTextureModal,
  onToggleHandMode,
  onSelectTool,
  onOpenColorPicker,
  onOpenLayersModal,
  onChangeBrushSize,
  onChangeBrushOpacity,
  onCloseStrokeGuide,
  setShowSizePreview,
  setShowOpacityPreview,
  triggerHaptic,
}) => {
  // Herramienta visual a representar en el Botón 1:
  // Si estamos en modo 'hand' (Moviendo), mostramos la herramienta previa para saber exactamente qué reanudará
  const displayTool: ToolType = activeTool === 'hand'
    ? (lastDrawingTool && lastDrawingTool !== 'hand' ? lastDrawingTool : 'brush')
    : activeTool;

  const toolVisual = getToolVisualInfo(displayTool);

  return (
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
          onClose={onCloseStrokeGuide}
        />
      )}

      {/* Nivel Superior: Deslizadores Ergonómicos de Grosor y Opacidad */}
      <div className="px-3 py-2 border-b border-[#1c1d28] bg-[#0d0e14]/95 flex flex-col gap-2 max-w-lg mx-auto w-full">
        {/* Fila 1: Grosor de Trazo */}
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

        {/* Fila 2: Opacidad de Trazo */}
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

        {/* Fila 3: Textura de Superficie Activa */}
        {onOpenTextureModal && (
          <div className="flex items-center justify-between pt-1 border-t border-[#1a1c26] w-full">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Textura:</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border truncate ${
                brushTexture && brushTexture.id !== 'none'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-[#161722] text-gray-400 border-[#262836]'
              }`}>
                {brushTexture?.name || 'Lisa'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                triggerHaptic(8);
                onOpenTextureModal();
              }}
              className="px-2.5 py-1 rounded-lg bg-[#181924] hover:bg-[#222434] border border-[#27293a] text-gray-200 text-[10px] font-bold transition-all active:scale-95 flex items-center gap-1 shrink-0"
              title="Abrir catálogo de texturas de pincel"
            >
              <Sparkles size={11} className="text-amber-400" />
              <span>Texturas</span>
            </button>
          </div>
        )}
      </div>

      {/* Nivel Inferior: Dock de Herramientas Estilo Nativo IbisPaint */}
      <div className="h-14 px-2 grid grid-cols-5 gap-1.5 max-w-lg mx-auto w-full items-center">
        {/* 1. Herramienta Principal de Trazo / Borrador (Muestra siempre el icono y nombre real de la herramienta activa) */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic(10);
            if (activeTool === 'hand') {
              // Si estaba en modo mover, volver directamente a la herramienta activa previa
              const target = lastDrawingTool && lastDrawingTool !== 'hand' ? lastDrawingTool : 'brush';
              onSelectTool(target);
            } else {
              onToggleBrushEraser();
            }
          }}
          aria-label={`Herramienta activa: ${toolVisual.name}`}
          className={`h-11 rounded-xl border flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 ${
            activeTool === 'hand'
              ? 'bg-[#171821] border-[#2c2e3e] text-gray-400 opacity-90'
              : toolVisual.colorClass
          }`}
          title={activeTool === 'hand' ? `Reanudar ${toolVisual.name}` : `Alternar ${toolVisual.name} / Goma`}
        >
          {toolVisual.icon}
          <span className="text-[9px] font-bold uppercase tracking-wider">
            {toolVisual.name}
          </span>
        </button>

        {/* 2. Catálogo de Herramientas */}
        <button
          type="button"
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
          type="button"
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
          type="button"
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
          type="button"
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
  );
};
