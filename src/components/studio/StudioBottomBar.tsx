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
  Layers as LayersIcon 
} from 'lucide-react';
import { Layer, ToolType, TracingReference } from '../../engine/types';
import { StrokeGuideAssistant } from '../StrokeGuideAssistant';

export interface StudioBottomBarProps {
  activeTool: ToolType;
  lastDrawingTool: ToolType;
  brushSize: number;
  brushOpacity: number;
  brushColor: string;
  layers: Layer[];
  tracingRef: TracingReference | null;
  showStrokeGuide: boolean;
  onToggleBrushEraser: () => void;
  onOpenToolPicker: () => void;
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

export const StudioBottomBar: React.FC<StudioBottomBarProps> = ({
  activeTool,
  lastDrawingTool,
  brushSize,
  brushOpacity,
  brushColor,
  layers,
  tracingRef,
  showStrokeGuide,
  onToggleBrushEraser,
  onOpenToolPicker,
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
      </div>

      {/* Nivel Inferior: Dock de Herramientas Estilo Nativo IbisPaint */}
      <div className="h-14 px-2 grid grid-cols-5 gap-1.5 max-w-lg mx-auto w-full items-center">
        {/* 1. Herramienta Principal de Trazo / Borrador */}
        <button
          type="button"
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
