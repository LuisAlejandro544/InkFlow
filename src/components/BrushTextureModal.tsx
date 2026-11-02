/**
 * @file BrushTextureModal.tsx
 * @description Diálogo modal nativo estilo IbisPaint para inspeccionar y seleccionar texturas de pincel.
 * 
 * Permite explorar y previsualizar en vivo las 4 texturas clásicas de dibujo sin necesidad
 * de aplicarlas obligatoriamente a la herramienta de trabajo, con visualizador interactivo,
 * miniaturas de trazo y ajuste fino de escala y profundidad de grano.
 */

import React, { useState, useEffect, useRef } from 'react';
import { X, Check, Sparkles, Sliders, Eye, RefreshCw, Layers } from 'lucide-react';
import { BrushTextureConfig, BrushTextureId } from '../engine/types';
import { 
  TEXTURE_DEFINITIONS, 
  TextureDefinition, 
  renderTexturePreviewStroke 
} from '../engine/brushTextureEngine';

export interface BrushTextureModalProps {
  currentTexture: BrushTextureConfig;
  brushColor: string;
  onApplyTexture: (config: BrushTextureConfig) => void;
  onClose: () => void;
}

export const BrushTextureModal: React.FC<BrushTextureModalProps> = ({
  currentTexture,
  brushColor,
  onApplyTexture,
  onClose,
}) => {
  // Estado local para inspeccionar sin alterar inmediatamente la textura de trabajo
  const [inspectedTextureId, setInspectedTextureId] = useState<BrushTextureId>(currentTexture.id);
  const [depth, setDepth] = useState<number>(currentTexture.depth);
  const [scale, setScale] = useState<number>(currentTexture.scale);
  const [isWhitePaper, setIsWhitePaper] = useState<boolean>(true); // Papel blanco premium por defecto

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const triggerHaptic = (ms = 10) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate(ms); } catch {}
    }
  };

  // Renderizar la muestra en vivo cuando cambia la textura inspeccionada, color, profundidad, escala o fondo de papel
  useEffect(() => {
    if (previewCanvasRef.current) {
      renderTexturePreviewStroke(
        previewCanvasRef.current,
        inspectedTextureId,
        brushColor,
        depth,
        scale,
        isWhitePaper
      );
    }
  }, [inspectedTextureId, brushColor, depth, scale, isWhitePaper]);

  const handleSelectToInspect = (def: TextureDefinition) => {
    triggerHaptic(8);
    setInspectedTextureId(def.id);
    if (def.id !== 'none' && depth <= 0.05) {
      setDepth(def.defaultDepth);
      setScale(def.defaultScale);
    }
  };

  const handleApply = (idToApply: BrushTextureId = inspectedTextureId) => {
    triggerHaptic(12);
    const def = TEXTURE_DEFINITIONS.find((d) => d.id === idToApply);
    onApplyTexture({
      id: idToApply,
      name: def?.name || 'Textura',
      depth: idToApply === 'none' ? 0.0 : depth,
      scale: idToApply === 'none' ? 1.0 : scale,
    });
    onClose();
  };

  const activeInspectedDef = TEXTURE_DEFINITIONS.find((d) => d.id === inspectedTextureId) || TEXTURE_DEFINITIONS[0];

  return (
    <div 
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          triggerHaptic(8);
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-md p-0 sm:p-4 animate-fade-in"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-[#12131a] border-t sm:border border-[#262836] rounded-t-3xl sm:rounded-3xl text-white shadow-2xl flex flex-col max-h-[92vh] overflow-hidden pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        {/* Tirador táctil superior para móvil */}
        <div 
          onClick={() => {
            triggerHaptic(8);
            onClose();
          }}
          className="pt-2.5 pb-1 flex justify-center sm:hidden cursor-pointer active:opacity-75 transition-opacity"
          title="Toca para cerrar"
        >
          <div className="w-10 h-1.5 rounded-full bg-neutral-600/70" />
        </div>

        {/* Encabezado */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#21232f]">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                triggerHaptic(8);
                onClose();
              }}
              aria-label="Cerrar modal de texturas"
              className="w-9 h-9 rounded-xl bg-[#1a1b25] hover:bg-[#242634] border border-[#2b2d3d] flex items-center justify-center text-gray-300 hover:text-white active:scale-95 transition-all"
              title="Cerrar"
            >
              <X size={18} />
            </button>
            <div>
              <div className="flex items-center gap-1.5">
                <Layers size={16} className="text-amber-400" />
                <h2 className="text-sm sm:text-base font-bold text-gray-100">Texturas de Pincel</h2>
              </div>
              <span className="text-[10px] text-gray-400">Estilo IbisPaint • Visualiza sin aplicar</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleApply(inspectedTextureId)}
            className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-all active:scale-95 flex items-center gap-1 shadow-sm"
          >
            <Check size={14} />
            <span>Aplicar</span>
          </button>
        </div>

        {/* Panel Superior Fijo de Previsualización en Vivo sobre Papel Blanco */}
        <div className="px-4 pt-3 pb-2.5 bg-[#141620] border-b border-[#222434] shrink-0 flex flex-col gap-2">
          {/* Tarjeta de Inspección y Previsualización en Vivo */}
          <div className="bg-[#181a24] border border-[#282a3c] rounded-2xl p-3 shadow-inner flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <Eye size={15} className="text-amber-400 shrink-0" />
                <span className="text-xs font-bold text-gray-200">
                  Previsualización: <span className="text-amber-300 font-extrabold">{activeInspectedDef.name}</span>
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(6);
                    setIsWhitePaper(!isWhitePaper);
                  }}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-[#1f212e] hover:bg-[#272a3a] border border-[#2d3043] text-gray-300 flex items-center gap-1 active:scale-95 transition-all shadow-2xs"
                  title="Alternar fondo entre papel blanco y papel oscuro"
                >
                  {isWhitePaper ? '📄 Papel Blanco' : '⬛ Papel Oscuro'}
                </button>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${activeInspectedDef.badgeColor}`}>
                  {activeInspectedDef.badge}
                </span>
              </div>
            </div>

            {/* Hoja de Papel en Blanco Premium para Muestra de Pincel */}
            <div className={`w-full h-24 rounded-xl overflow-hidden border flex items-center justify-center relative shadow-md transition-all ${
              isWhitePaper 
                ? 'bg-[#FAF9F5] border-neutral-300 ring-1 ring-black/5 shadow-[0_3px_10px_rgba(0,0,0,0.2)]' 
                : 'bg-[#0c0d12] border-[#212330]'
            }`}>
              <canvas
                ref={previewCanvasRef}
                width={640}
                height={160}
                className="w-full h-full object-cover"
              />
              <span className={`absolute bottom-1.5 right-2 text-[9px] font-mono px-2 py-0.5 rounded-full shadow-xs border backdrop-blur-xs font-semibold ${
                isWhitePaper
                  ? 'bg-white/95 text-neutral-800 border-neutral-300'
                  : 'bg-black/70 text-gray-300 border-neutral-700'
              }`}>
                {isWhitePaper ? '📄 Papel Canson 250g' : '⬛ Fondo Oscuro'} ({brushColor.toUpperCase()})
              </span>
            </div>

            {/* Deslizadores de Calibración de la Textura (Profundidad y Escala) */}
            {inspectedTextureId !== 'none' ? (
              <div className="pt-1.5 space-y-2 border-t border-[#232534]">
                {/* Deslizador de Profundidad / Intensidad */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-300 font-bold w-20 shrink-0">Profundidad:</span>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={Math.round(depth * 100)}
                    onChange={(e) => setDepth(Number(e.target.value) / 100)}
                    className="flex-1 accent-amber-500 h-1.5 bg-[#252837] rounded-lg cursor-pointer"
                  />
                  <span className="text-[10px] font-mono font-bold text-amber-300 min-w-[36px] text-right">
                    {Math.round(depth * 100)}%
                  </span>
                </div>

                {/* Deslizador de Escala / Tamaño de Trama */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-300 font-bold w-20 shrink-0">Escala Grano:</span>
                  <input
                    type="range"
                    min="5"
                    max="25"
                    value={Math.round(scale * 10)}
                    onChange={(e) => setScale(Number(e.target.value) / 10)}
                    className="flex-1 accent-amber-500 h-1.5 bg-[#252837] rounded-lg cursor-pointer"
                  />
                  <span className="text-[10px] font-mono font-bold text-amber-300 min-w-[36px] text-right">
                    {scale.toFixed(1)}x
                  </span>
                </div>
              </div>
            ) : (
              <div className="pt-1 text-center text-[10px] text-gray-400">
                Trazo uniforme continuo sin grano • Toca una textura abajo para previsualizar relieve
              </div>
            )}
          </div>
        </div>

        {/* Contenido scrolleable con el catálogo de texturas */}
        <div className="p-4 overflow-y-auto space-y-3 flex-1 min-h-0">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-300 uppercase tracking-wider">
              Seleccionar Textura ({TEXTURE_DEFINITIONS.length - 1} texturas clásicas)
            </span>
            <span className="text-[10px] text-gray-400">Toca para previsualizar arriba</span>
          </div>

          <div className="space-y-2">
              {TEXTURE_DEFINITIONS.map((def) => {
                const isInspecting = inspectedTextureId === def.id;
                const isApplied = currentTexture.id === def.id;

                return (
                  <div
                    key={def.id}
                    onClick={() => handleSelectToInspect(def)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex flex-col gap-2 ${
                      isInspecting
                        ? 'bg-[#1b1d2a] border-amber-500/70 shadow-md ring-1 ring-amber-500/30'
                        : 'bg-[#15161f] border-[#222432] hover:bg-[#1a1c27]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${def.badgeColor}`}>
                          {def.badge}
                        </span>
                        <h3 className="text-xs sm:text-sm font-bold text-gray-100">{def.name}</h3>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {isApplied && (
                          <span className="text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full">
                            En Uso
                          </span>
                        )}
                        {isInspecting && (
                          <span className="text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                            <Eye size={10} /> Previsualizando
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-[11px] text-gray-400 leading-tight">
                      {def.description}
                    </p>

                    <div className="flex items-center justify-between pt-1 border-t border-[#1f2130]">
                      <div className="flex items-center gap-1">
                        {def.tags.map((tag) => (
                          <span key={tag} className="text-[9px] text-gray-400 bg-[#0f1017] px-1.5 py-0.5 rounded">
                            #{tag}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectToInspect(def);
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all flex items-center gap-1 ${
                            isInspecting
                              ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                              : 'bg-[#1b1c26] border-[#2b2d3d] text-gray-300 hover:text-white'
                          }`}
                        >
                          <Eye size={11} />
                          <span>Ver</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleApply(def.id);
                          }}
                          className="px-3 py-1 rounded-lg text-[10px] font-bold bg-amber-500 hover:bg-amber-400 text-black transition-all flex items-center gap-1 shadow-xs active:scale-95"
                        >
                          <Sparkles size={11} />
                          <span>Aplicar</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        {/* Barra de acción inferior */}
        <div className="p-3 border-t border-[#21232f] bg-[#0d0e14] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              triggerHaptic(8);
              onClose();
            }}
            className="flex-1 py-2.5 rounded-xl bg-[#181923] hover:bg-[#20212e] text-gray-300 border border-[#2a2c3a] text-xs font-bold transition-all text-center"
          >
            Cerrar sin cambiar
          </button>

          <button
            type="button"
            onClick={() => handleApply(inspectedTextureId)}
            className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-all shadow-md text-center flex items-center justify-center gap-1.5 active:scale-95"
          >
            <Check size={15} />
            <span>Usar "{activeInspectedDef.name}"</span>
          </button>
        </div>
      </div>
    </div>
  );
};
