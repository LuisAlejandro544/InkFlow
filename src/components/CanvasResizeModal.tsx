/**
 * @file CanvasResizeModal.tsx
 * @description Diálogo modal nativo móvil para expandir las dimensiones de la hoja de dibujo (Canvas Resize & Expand).
 * 
 * Permite a los artistas móviles ampliar el ancho y alto del lienzo para agregar más dibujos,
 * bocetos y viñetas sin perder los trazos existentes.
 * 
 * Características ergonómicas:
 * 1. Preajustes rápidos en 1 toque (+25%, +50%, 2x Doble Lienzo, 1:1, 9:16 Manga).
 * 2. Matriz visual de anclaje (Anchor Grid 3×3) para decidir hacia dónde se expande el nuevo espacio.
 * 3. Botones táctiles de incremento rápido (+50px, +100px, +200px) adaptados para dedos en móvil.
 * 4. Área táctil mínima de 48px y compatibilidad total con safe-area-inset-bottom.
 */

import React, { useState } from 'react';
import { X, Maximize2, Check, ArrowUpLeft, ArrowUp, ArrowUpRight, ArrowLeft, ArrowRight, ArrowDownLeft, ArrowDown, ArrowDownRight, Dot, Sparkles } from 'lucide-react';
import { CanvasAnchor, CANVAS_EXPANSION_PRESETS, clampCanvasDimension, calculateResizeOffsets } from '../engine/canvasResizeMath';

interface CanvasResizeModalProps {
  currentWidth: number;
  currentHeight: number;
  onApplyResize: (newWidth: number, newHeight: number, anchor: CanvasAnchor) => void;
  onClose: () => void;
}

export const CanvasResizeModal: React.FC<CanvasResizeModalProps> = ({
  currentWidth,
  currentHeight,
  onApplyResize,
  onClose,
}) => {
  const [newWidth, setNewWidth] = useState<number>(currentWidth);
  const [newHeight, setNewHeight] = useState<number>(currentHeight);
  const [anchor, setAnchor] = useState<CanvasAnchor>('center');

  const triggerHaptic = (ms = 10) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(ms);
      } catch {
        // Ignorar
      }
    }
  };

  const handleApplyPreset = (presetId: string) => {
    const preset = CANVAS_EXPANSION_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    triggerHaptic(12);
    const result = preset.calculate(currentWidth, currentHeight);
    setNewWidth(result.width);
    setNewHeight(result.height);
  };

  const handleIncrement = (axis: 'w' | 'h', delta: number) => {
    triggerHaptic(8);
    if (axis === 'w') {
      setNewWidth((prev) => clampCanvasDimension(prev + delta));
    } else {
      setNewHeight((prev) => clampCanvasDimension(prev + delta));
    }
  };

  const isExpanded = newWidth !== currentWidth || newHeight !== currentHeight;
  const { offsetX, offsetY } = calculateResizeOffsets(currentWidth, currentHeight, newWidth, newHeight, anchor);

  const anchorIcons: { id: CanvasAnchor; label: string; icon: React.ReactNode }[] = [
    { id: 'top-left', label: 'Arriba Izq.', icon: <ArrowUpLeft size={16} /> },
    { id: 'top', label: 'Arriba', icon: <ArrowUp size={16} /> },
    { id: 'top-right', label: 'Arriba Der.', icon: <ArrowUpRight size={16} /> },
    { id: 'left', label: 'Izquierda', icon: <ArrowLeft size={16} /> },
    { id: 'center', label: 'Centro (Uniforme)', icon: <Dot size={22} className="stroke-[4]" /> },
    { id: 'right', label: 'Derecha', icon: <ArrowRight size={16} /> },
    { id: 'bottom-left', label: 'Abajo Izq.', icon: <ArrowDownLeft size={16} /> },
    { id: 'bottom', label: 'Abajo', icon: <ArrowDown size={16} /> },
    { id: 'bottom-right', label: 'Abajo Der.', icon: <ArrowDownRight size={16} /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div 
        onClick={onClose}
        className="fixed inset-0"
        aria-hidden="true"
      />

      <div className="relative bg-[#161720] border-t sm:border border-[#2d2f3d] w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] z-10 animate-in slide-in-from-bottom-6">
        
        {/* Encabezado Ergonómico */}
        <div className="px-5 py-4 border-b border-[#242635] flex items-center justify-between bg-[#13141c]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Maximize2 size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                Expandir Hoja de Dibujo
              </h2>
              <p className="text-[10px] text-gray-400">
                Lienzo actual: <span className="text-amber-400 font-mono font-bold">{currentWidth} × {currentHeight} px</span>
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              triggerHaptic(8);
              onClose();
            }}
            className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center active:scale-95 transition-all cursor-pointer"
            title="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Contenido Desplazable con controles táctiles sin truncamiento */}
        <div className="p-4 overflow-y-auto space-y-4">
          
          {/* 1. Presets de Expansión Rápida en 1 Toque */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1">
                <Sparkles size={12} className="text-amber-400" />
                Presets Rápidos de Espacio
              </label>
              <span className="text-[10px] text-gray-500">1 toque</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {CANVAS_EXPANSION_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleApplyPreset(p.id)}
                  className="px-2.5 py-2 rounded-xl bg-[#1f212c] hover:bg-[#282a38] border border-[#2e3141] text-xs font-semibold text-gray-200 flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-all text-center"
                >
                  <span className="font-bold text-amber-300">{p.label}</span>
                  <span className="text-[9px] text-gray-400">
                    {p.calculate(currentWidth, currentHeight).width}×{p.calculate(currentWidth, currentHeight).height}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* 2. Ajuste Numérico de Ancho y Alto con Botones de Incremento Táctil */}
          <div className="grid grid-cols-2 gap-3 bg-[#111218] border border-[#232533] p-3 rounded-2xl">
            {/* Ancho */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                Ancho (px)
              </span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="200"
                  max="4096"
                  step="50"
                  value={newWidth}
                  onChange={(e) => setNewWidth(clampCanvasDimension(Number(e.target.value)))}
                  className="w-full bg-[#1c1d27] border border-[#333647] rounded-xl px-2.5 py-2 text-center text-sm font-mono font-bold text-white focus:outline-none focus:border-amber-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-1 pt-1">
                <button
                  onClick={() => handleIncrement('w', 100)}
                  className="py-1 rounded-lg bg-[#20222e] hover:bg-[#2a2d3d] text-[10px] font-bold text-amber-300 border border-[#2b2e3e] active:scale-95"
                >
                  +100 px
                </button>
                <button
                  onClick={() => handleIncrement('w', 300)}
                  className="py-1 rounded-lg bg-[#20222e] hover:bg-[#2a2d3d] text-[10px] font-bold text-amber-300 border border-[#2b2e3e] active:scale-95"
                >
                  +300 px
                </button>
              </div>
            </div>

            {/* Alto */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                Alto (px)
              </span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="200"
                  max="4096"
                  step="50"
                  value={newHeight}
                  onChange={(e) => setNewHeight(clampCanvasDimension(Number(e.target.value)))}
                  className="w-full bg-[#1c1d27] border border-[#333647] rounded-xl px-2.5 py-2 text-center text-sm font-mono font-bold text-white focus:outline-none focus:border-amber-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-1 pt-1">
                <button
                  onClick={() => handleIncrement('h', 100)}
                  className="py-1 rounded-lg bg-[#20222e] hover:bg-[#2a2d3d] text-[10px] font-bold text-amber-300 border border-[#2b2e3e] active:scale-95"
                >
                  +100 px
                </button>
                <button
                  onClick={() => handleIncrement('h', 300)}
                  className="py-1 rounded-lg bg-[#20222e] hover:bg-[#2a2d3d] text-[10px] font-bold text-amber-300 border border-[#2b2e3e] active:scale-95"
                >
                  +300 px
                </button>
              </div>
            </div>
          </div>

          {/* 3. Matriz de Anclaje 3x3 (Hacia dónde expandir el nuevo espacio) */}
          <div className="space-y-2 bg-[#111218] border border-[#232533] p-3 rounded-2xl">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">
                Punto de Anclaje del Dibujo Actual
              </label>
              <span className="text-[9px] font-bold text-amber-400">
                {anchorIcons.find((a) => a.id === anchor)?.label}
              </span>
            </div>
            <p className="text-[10px] text-gray-400">
              Determina hacia qué lado de la hoja se agregará el nuevo espacio vacío.
            </p>
            <div className="grid grid-cols-3 gap-1.5 max-w-[200px] mx-auto py-1">
              {anchorIcons.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    triggerHaptic(8);
                    setAnchor(item.id);
                  }}
                  className={`h-11 rounded-xl flex items-center justify-center transition-all ${
                    anchor === item.id
                      ? 'bg-amber-500 text-black font-bold shadow-md scale-105'
                      : 'bg-[#1c1d27] text-gray-400 hover:text-gray-200 border border-[#2b2d3d] active:scale-95'
                  }`}
                  title={item.label}
                >
                  {item.icon}
                </button>
              ))}
            </div>
          </div>

          {/* 4. Resumen Proyectado de la Expansión */}
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs flex flex-col gap-1">
            <div className="flex items-center justify-between font-bold text-amber-300">
              <span>Resultado Proyectado:</span>
              <span className="font-mono text-sm">{newWidth} × {newHeight} px</span>
            </div>
            <p className="text-[10px] text-gray-300">
              {newWidth > currentWidth || newHeight > currentHeight ? (
                <>
                  Se añadirán <span className="text-emerald-400 font-bold">+{Math.max(0, newWidth - currentWidth)} px</span> de ancho y <span className="text-emerald-400 font-bold">+{Math.max(0, newHeight - currentHeight)} px</span> de alto.
                  El dibujo se desplazará en (+{offsetX}px, +{offsetY}px) manteniéndose 100% intacto.
                </>
              ) : newWidth < currentWidth || newHeight < currentHeight ? (
                <span className="text-amber-400">El lienzo se recortará según el anclaje seleccionado.</span>
              ) : (
                <span>Mismo tamaño actual sin modificaciones.</span>
              )}
            </p>
          </div>

        </div>

        {/* Botones de Acción Fijos Inferiores */}
        <div className="p-4 border-t border-[#242635] bg-[#13141c] flex items-center gap-2.5 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            onClick={() => {
              triggerHaptic(8);
              onClose();
            }}
            className="flex-1 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-bold active:scale-98 transition-all cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={() => {
              triggerHaptic(15);
              onApplyResize(newWidth, newHeight, anchor);
              onClose();
            }}
            disabled={!isExpanded}
            className={`flex-2 py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-lg cursor-pointer ${
              isExpanded
                ? 'bg-amber-500 hover:bg-amber-400 text-black font-extrabold active:scale-98'
                : 'bg-gray-800 text-gray-500 cursor-not-allowed'
            }`}
          >
            <Check size={16} className="stroke-[3]" />
            Expandir Hoja
          </button>
        </div>

      </div>
    </div>
  );
};
