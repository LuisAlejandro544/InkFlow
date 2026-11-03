/**
 * @file TracingControlBar.tsx
 * @description Barra de calibración compacta inferior estilo IbisPaint X para ajustar calco o accesorios.
 */

import React, { useState } from 'react';
import { 
  Check, X, RotateCcw, Sliders, Sparkles, Eye, EyeOff, 
  ChevronDown, Layers, RotateCw, Maximize2 
} from 'lucide-react';
import { TracingReference, TracingFilterMode } from '../../engine/types';

interface TracingControlBarProps {
  tracing: TracingReference;
  isAccessory: boolean;
  onChangeTransform: (update: Partial<TracingReference>) => void;
  onApplyFilter: (mode: TracingFilterMode) => void;
  onCenterImage: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  onStampToActiveLayer?: () => void;
  onStampAsNewLayer?: () => void;
  onMinimize: () => void;
}

export const TracingControlBar: React.FC<TracingControlBarProps> = ({
  tracing,
  isAccessory,
  onChangeTransform,
  onApplyFilter,
  onCenterImage,
  onConfirm,
  onCancel,
  onStampToActiveLayer,
  onStampAsNewLayer,
  onMinimize,
}) => {
  const [showFiltersMenu, setShowFiltersMenu] = useState<boolean>(false);

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 pointer-events-auto select-none">
      {/* Menú flotante emergente de Filtros Wasm (si está activo) */}
      {showFiltersMenu && (
        <div className="px-3 pb-1.5 flex justify-center animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="bg-[#12131bf6] border border-amber-500/50 rounded-2xl p-1.5 shadow-2xl backdrop-blur-2xl flex items-center gap-1.5 max-w-sm w-full">
            {[
              { mode: 'original', label: 'Color', icon: '🎨' },
              { mode: 'lineart', label: 'Lineart', icon: '✒️' },
              { mode: 'grayscale', label: 'B/N', icon: '⬛' },
              { mode: 'contrast', label: 'Contraste', icon: '☀️' },
            ].map((f) => (
              <button
                key={f.mode}
                type="button"
                onClick={() => {
                  onApplyFilter(f.mode as TracingFilterMode);
                  setShowFiltersMenu(false);
                }}
                className={`flex-1 py-1 px-1 rounded-xl text-xs font-bold flex flex-col items-center gap-0.5 transition-all active:scale-95 ${
                  tracing.filterMode === f.mode
                    ? 'bg-amber-500 text-black shadow-md'
                    : 'bg-[#1b1d28] text-gray-300 hover:text-white border border-[#2b2e40]'
                }`}
              >
                <span className="text-sm">{f.icon}</span>
                <span className="text-[10px]">{f.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* BARRA COMPACTA NATIVA ESTILO IBISPAINT (~105px) CON ZERO DESBORDAMIENTO EN 320PX-430PX */}
      <div className={`bg-[#12131bf6] border-t ${
        isAccessory ? 'border-pink-500/50' : 'border-amber-500/50'
      } shadow-[0_-8px_30px_rgba(0,0,0,0.85)] backdrop-blur-2xl flex flex-col gap-1.5 text-white w-full px-2.5 pt-2 pb-[max(0.6rem,env(safe-area-inset-bottom))] animate-in slide-in-from-bottom duration-150`}>
        
        {/* FILA 1: Slider de Opacidad + Botones Icono Auxiliares (Ajuste Perfecto) */}
        <div className="flex items-center gap-1.5 max-w-md mx-auto w-full overflow-hidden">
          {/* Badge de Título y % */}
          <div className="flex items-center gap-1 bg-[#1a1c26] px-2 py-1 rounded-lg border border-[#2e3143] shrink-0">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${
              isAccessory ? 'text-pink-300' : 'text-amber-400'
            }`}>
              {isAccessory ? '🎀' : '📷'}
            </span>
            <span className="text-xs font-mono font-black text-white">
              {Math.round(tracing.opacity * 100)}%
            </span>
          </div>

          {/* Slider de Opacidad Táctil Fluido */}
          <div className="flex-1 min-w-[50px] px-1 flex items-center">
            <input
              type="range"
              min="5"
              max="100"
              value={Math.round(tracing.opacity * 100)}
              onChange={(e) => onChangeTransform({ opacity: Number(e.target.value) / 100 })}
              className="w-full accent-amber-500 h-2 bg-[#202230] rounded-lg cursor-pointer"
            />
          </div>

          {/* Botón Visibilidad Instantánea (Visible vs Oculto) */}
          <button
            type="button"
            onClick={() => onChangeTransform({ visible: !tracing.visible })}
            className={`w-8 h-8 rounded-xl border flex items-center justify-center transition-all active:scale-95 shrink-0 ${
              tracing.visible 
                ? 'bg-[#1c1e2a] border-amber-500/50 text-amber-300 shadow-sm' 
                : 'bg-red-500/20 text-red-300 border-red-500/40'
            }`}
            title={tracing.visible ? 'Ocultar foto temporalmente' : 'Mostrar foto de calco'}
          >
            {tracing.visible ? <Eye size={15} className="text-amber-400" /> : <EyeOff size={15} />}
          </button>

          {/* Botón Centrar */}
          <button
            type="button"
            onClick={onCenterImage}
            className="w-8 h-8 rounded-xl bg-[#1c1e2a] hover:bg-[#252837] text-gray-300 border border-[#2e3143] flex items-center justify-center transition-colors active:scale-95 shrink-0"
            title="Centrar en el lienzo"
          >
            <RotateCcw size={14} />
          </button>

          {/* Botón Filtros Wasm */}
          <button
            type="button"
            onClick={() => setShowFiltersMenu(!showFiltersMenu)}
            className={`w-8 h-8 rounded-xl border flex items-center justify-center transition-colors active:scale-95 shrink-0 ${
              showFiltersMenu || tracing.filterMode !== 'original'
                ? 'bg-amber-500 text-black border-amber-400 font-bold'
                : 'bg-[#1c1e2a] hover:bg-[#252837] text-gray-300 border-[#2e3143]'
            }`}
            title="Filtros inteligentes Wasm"
          >
            <Sparkles size={14} />
          </button>

          {/* Minimizar */}
          <button
            type="button"
            onClick={onMinimize}
            className="w-8 h-8 rounded-xl bg-[#1c1e2a] hover:bg-[#252837] text-gray-300 border border-[#2e3143] flex items-center justify-center transition-colors active:scale-95 shrink-0"
            title="Minimizar barra para ver todo el lienzo"
          >
            <ChevronDown size={16} />
          </button>
        </div>

        {/* FILA 2: Acciones Principales en la Zona del Pulgar (100% Accesible sin Recorte) */}
        <div className="flex items-center gap-1.5 max-w-md mx-auto w-full pt-0.5">
          {/* Descartar: Botón icono compacto con acento rojo para no quitar espacio */}
          <button
            type="button"
            onClick={onCancel}
            className="h-10 w-10 min-w-[38px] rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 flex items-center justify-center active:scale-95 transition-all shrink-0"
            title="Eliminar foto de calco"
            aria-label="Descartar calco"
          >
            <X size={18} />
          </button>

          {/* Restablecer Rotación a 0° */}
          <button
            type="button"
            onClick={() => onChangeTransform({ rotation: 0 })}
            className="h-10 px-2 min-w-[36px] rounded-xl bg-[#181a24] text-[11px] font-semibold text-gray-300 border border-[#2b2d3d] flex items-center justify-center gap-0.5 active:scale-95 transition-all shrink-0"
            title="Enderezar rotación a 0°"
          >
            <RotateCw size={12} className="text-amber-400" />
            <span>0°</span>
          </button>

          {/* Restablecer Escala 100% */}
          <button
            type="button"
            onClick={() => onChangeTransform({ scale: 1.0 })}
            className="h-10 px-2 min-w-[40px] rounded-xl bg-[#181a24] text-[11px] font-semibold text-gray-300 border border-[#2b2d3d] flex items-center justify-center gap-0.5 active:scale-95 transition-all shrink-0"
            title="Escala 100%"
          >
            <Maximize2 size={12} className="text-amber-400" />
            <span>100%</span>
          </button>

          {/* Acciones principales según tipo de calco o accesorio */}
          {isAccessory ? (
            <>
              <button
                type="button"
                onClick={onStampAsNewLayer}
                className="h-10 px-2.5 bg-[#202332] text-pink-300 border border-pink-500/40 rounded-xl font-bold text-xs flex items-center justify-center gap-1 active:scale-95 transition-all shrink-0"
                title="Crear capa dedicada con este accesorio"
              >
                <Layers size={13} />
                <span>+ Capa</span>
              </button>
              <button
                type="button"
                onClick={onStampToActiveLayer}
                className="flex-1 min-w-[90px] h-10 bg-gradient-to-r from-pink-500 to-rose-600 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1 shadow-lg active:scale-95 transition-all"
              >
                <Sparkles size={14} />
                <span>Estampar</span>
              </button>
            </>
          ) : (
            <>
              {/* Botón secundario estampar si aplica */}
              {onStampToActiveLayer && (
                <button
                  type="button"
                  onClick={onStampToActiveLayer}
                  className="h-10 px-2.5 min-w-[38px] rounded-xl bg-[#1c1e2a] hover:bg-[#252838] text-amber-300 border border-amber-500/40 font-semibold text-xs flex items-center justify-center gap-1 active:scale-95 transition-all shrink-0"
                  title="Estampar como trazo permanente en la capa activa"
                  aria-label="Estampar trazo permanente"
                >
                  <Sparkles size={14} />
                  <span className="hidden sm:inline">Estampar</span>
                </button>
              )}

              {/* BOTÓN PRINCIPAL: SIEMPRE VISIBLE, EXPANDIBLE Y ACCESIBLE */}
              <button
                type="button"
                onClick={onConfirm}
                className="flex-1 min-w-[105px] h-10 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:brightness-110 text-black rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/25 active:scale-95 transition-all"
              >
                <Check size={16} className="stroke-[3]" />
                <span>Fijar Calco</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
