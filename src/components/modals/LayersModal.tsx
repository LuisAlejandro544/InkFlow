/**
 * @file LayersModal.tsx
 * @description Gestor de capas nativo móvil inspirado en IbisPaint X y Procreate.
 * 
 * Mejoras de diseño y ergonomía móvil:
 * - Formato Bottom Sheet deslizable con respeto estricto de Safe Areas (`env(safe-area-inset-bottom)`).
 * - Previsualizaciones en tiempo real del dibujo en cada miniatura de capa (LayerThumbnail con checkerboard).
 * - Selector nativo de Modo de Fusión mediante pills horizontales táctiles (elimina el diálogo HTML genérico).
 * - Botones de importación de Calco y Accesorio estilizados e integrados en la cabecera sin robar espacio.
 * - Objetivos táctiles mínimos de 44-48px y micro-interacciones inmediatas (`active:scale-95`).
 */

import React, { useRef, useEffect } from 'react';
import { 
  X, Plus, Copy, Trash2, Eye, EyeOff, 
  ArrowDown, ArrowUp, Layers as LayersIcon, Eraser,
  Camera, Sliders, Sparkles, Check
} from 'lucide-react';
import { Layer, BlendMode, TracingReference } from '../../engine/types';
import { useAppTheme } from '../../engine/themeEngine';

interface LayersModalProps {
  layers: Layer[];
  activeLayerId: string;
  tracingRef?: TracingReference | null;
  onSelectLayer: (id: string) => void;
  onAddLayer: () => void;
  onDuplicateLayer: (id: string) => void;
  onMergeDown: (id: string) => void;
  onDeleteLayer: (id: string) => void;
  onClearLayer: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onChangeOpacity: (id: string, opacity: number) => void;
  onChangeBlendMode: (id: string, mode: BlendMode) => void;
  onMoveLayer: (id: string, direction: 'up' | 'down') => void;
  onTriggerImportPhoto?: () => void;
  onTriggerImportAccessory?: () => void;
  onToggleTracingVisibility?: () => void;
  onReopenTracingAdjust?: () => void;
  onRemoveTracing?: () => void;
  onClose: () => void;
}

const BLEND_MODES: { mode: BlendMode; label: string; tag: string; icon: string }[] = [
  { mode: 'source-over', label: 'Normal', tag: 'Estándar', icon: '🎨' },
  { mode: 'multiply', label: 'Multiplicar', tag: 'Sombras', icon: '🌑' },
  { mode: 'screen', label: 'Pantalla', tag: 'Luces', icon: '☀️' },
  { mode: 'overlay', label: 'Superponer', tag: 'Contraste', icon: '🌗' },
  { mode: 'lighter', label: 'Añadir', tag: 'Brillo', icon: '✨' },
];

/**
 * Componente que renderiza la miniatura real del contenido de la capa sobre un fondo cuadriculado
 */
const LayerThumbnail: React.FC<{ layer: Layer }> = ({ layer }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, 48, 48);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'medium';

    try {
      if (layer.canvas && layer.canvas.width > 0 && layer.canvas.height > 0) {
        ctx.drawImage(layer.canvas, 0, 0, 48, 48);
      }
    } catch {
      // Ignorar restricciones en entornos sin canvas completo
    }
  }, [layer, layer.canvas]);

  return (
    <div className="w-12 h-12 rounded-xl bg-[#0b0c12] relative overflow-hidden border border-white/10 shrink-0 shadow-inner flex items-center justify-center">
      {/* Patrón de transparencia checkerboard profesional */}
      <div 
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(45deg, #666 25%, transparent 25%), linear-gradient(-45deg, #666 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #666 75%), linear-gradient(-45deg, transparent 75%, #666 75%)',
          backgroundSize: '8px 8px',
          backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px'
        }}
      />
      <canvas ref={canvasRef} width={48} height={48} className="relative z-10 w-full h-full object-contain" />
    </div>
  );
};

export const LayersModal: React.FC<LayersModalProps> = ({
  layers,
  activeLayerId,
  tracingRef,
  onSelectLayer,
  onAddLayer,
  onDuplicateLayer,
  onMergeDown,
  onDeleteLayer,
  onClearLayer,
  onToggleVisibility,
  onChangeOpacity,
  onChangeBlendMode,
  onMoveLayer,
  onTriggerImportPhoto,
  onTriggerImportAccessory,
  onToggleTracingVisibility,
  onReopenTracingAdjust,
  onRemoveTracing,
  onClose,
}) => {
  const theme = useAppTheme();
  const activeLayer = layers.find(l => l.id === activeLayerId) || layers[0];
  const activeIndex = layers.findIndex(l => l.id === activeLayerId);

  const triggerHaptic = (ms = 10) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate(ms); } catch {}
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-xs select-none animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* HOJA INFERIOR DESLIZABLE NATIVA (BOTTOM SHEET) */}
      <div 
        className="w-full sm:max-w-md bg-[#13141c] border-t sm:border border-white/10 rounded-t-[32px] sm:rounded-3xl p-4 sm:p-5 text-white shadow-[0_-12px_40px_rgba(0,0,0,0.85)] flex flex-col gap-3 max-h-[88dvh] pb-[max(1.25rem,env(safe-area-inset-bottom))] animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Tirador táctil ergonómico */}
        <div className="w-12 h-1.5 rounded-full bg-white/20 mx-auto -mt-1 mb-1 shrink-0" />

        {/* 1. CABECERA NATIVA COMPACTA */}
        <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <div 
              className="w-8 h-8 rounded-xl border flex items-center justify-center shrink-0"
              style={{ backgroundColor: theme.accentSoft, borderColor: theme.accentBorder, color: theme.accentColor }}
            >
              <LayersIcon size={17} />
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <h2 className="text-sm font-black text-white tracking-wide">Capas</h2>
              <span 
                className="text-[11px] font-mono px-1.5 py-0.2 rounded-md font-bold shrink-0"
                style={{ backgroundColor: theme.accentSoft, color: theme.accentTextHex }}
              >
                {layers.length}
              </span>
            </div>
          </div>

          {/* Acciones Rápidas de Galería (Calco y Accesorios) */}
          <div className="flex items-center gap-1.5 shrink-0">
            {onTriggerImportPhoto && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(10);
                  onTriggerImportPhoto();
                  onClose();
                }}
                className="h-8 px-2.5 rounded-xl border font-bold text-[11px] flex items-center gap-1 active:scale-95 transition-all shadow-xs"
                style={{ backgroundColor: theme.accentSoft, borderColor: theme.accentBorder, color: theme.accentTextHex }}
                title="Importar foto de calco desde galería"
              >
                <Camera size={13} style={{ color: theme.accentColor }} />
                <span>Calco</span>
              </button>
            )}

            {onTriggerImportAccessory && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(10);
                  onTriggerImportAccessory();
                  onClose();
                }}
                className="h-8 px-2.5 rounded-xl bg-gradient-to-r from-pink-500/20 to-rose-500/20 hover:from-pink-500/30 border border-pink-500/40 text-pink-300 font-bold text-[11px] flex items-center gap-1 active:scale-95 transition-all shadow-xs"
                title="Poner accesorio, lazo o sticker"
              >
                <Sparkles size={13} className="text-pink-400" />
                <span>Accesorio</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar panel de capas"
              className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/15 text-gray-300 flex items-center justify-center transition-colors active:scale-95 ml-0.5"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* 2. BARRA DE ACCIONES DE CAPA (Estilo Segmentado Nativo) */}
        <div className="grid grid-cols-5 gap-1.5 bg-[#0c0d14] p-1.5 rounded-2xl border border-white/5 shadow-inner">
          <button
            type="button"
            onClick={() => {
              triggerHaptic(10);
              onAddLayer();
            }}
            className="flex flex-col items-center justify-center py-2 px-1 rounded-xl text-[11px] font-bold gap-1 active:scale-95 transition-all shadow-xs"
            style={{ backgroundColor: theme.accentSoft, color: theme.accentTextHex }}
            title="Añadir nueva capa vacía"
          >
            <Plus size={16} className="stroke-[2.5]" />
            <span>Nueva</span>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic(10);
              onDuplicateLayer(activeLayerId);
            }}
            className="flex flex-col items-center justify-center py-2 px-1 rounded-xl bg-[#1a1b24] hover:bg-[#242634] text-gray-200 text-[11px] font-semibold gap-1 active:scale-95 transition-all"
            title="Duplicar capa activa"
          >
            <Copy size={15} />
            <span>Duplicar</span>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic(10);
              onMergeDown(activeLayerId);
            }}
            disabled={activeIndex <= 0}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl text-[11px] font-semibold gap-1 active:scale-95 transition-all ${
              activeIndex <= 0 
                ? 'bg-[#12131a] text-gray-600 opacity-40 cursor-not-allowed' 
                : 'bg-[#1a1b24] hover:bg-[#242634] text-gray-200'
            }`}
            title="Combinar con la capa inferior"
          >
            <ArrowDown size={15} />
            <span>Combinar</span>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic(10);
              onClearLayer(activeLayerId);
            }}
            className="flex flex-col items-center justify-center py-2 px-1 rounded-xl bg-[#1a1b24] hover:bg-[#242634] text-yellow-300 text-[11px] font-semibold gap-1 active:scale-95 transition-all"
            title="Limpiar trazos de la capa activa"
          >
            <Eraser size={15} />
            <span>Limpiar</span>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic(15);
              onDeleteLayer(activeLayerId);
            }}
            disabled={layers.length <= 1}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl text-[11px] font-semibold gap-1 active:scale-95 transition-all ${
              layers.length <= 1 
                ? 'bg-[#12131a] text-gray-600 opacity-40 cursor-not-allowed' 
                : 'bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/20'
            }`}
            title="Eliminar capa"
          >
            <Trash2 size={15} />
            <span>Borrar</span>
          </button>
        </div>

        {/* 3. LISTA DE CAPAS HERO (Centro Scrollable Amplio con Miniaturas Reales) */}
        <div className="flex-1 overflow-y-auto space-y-2 max-h-[38dvh] min-h-[140px] pr-1 no-scrollbar">
          {/* Tarjeta de Foto de Calco (si está cargada en el proyecto) */}
          {tracingRef && (
            <div className={`p-2.5 rounded-2xl border flex items-center justify-between gap-3 transition-all ${
              tracingRef.purpose === 'accessory' 
                ? 'bg-gradient-to-r from-pink-500/10 via-[#181924] to-[#12131a] border-pink-500/40 shadow-sm'
                : 'bg-gradient-to-r from-amber-500/10 via-[#181924] to-[#12131a] border-amber-500/40 shadow-sm'
            }`}>
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-black/60 border border-white/10 shrink-0 shadow-inner">
                  <img src={tracingRef.src} alt="Referencia" className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-bold truncate ${
                      tracingRef.purpose === 'accessory' ? 'text-pink-300' : 'text-amber-300'
                    }`}>
                      {tracingRef.purpose === 'accessory' ? '🎀 Accesorio' : '📷 Foto de Calco'}
                    </span>
                    <span className="text-[10px] font-mono font-bold bg-white/10 text-white px-1.5 py-0.2 rounded">
                      {Math.round(tracingRef.opacity * 100)}%
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-400 truncate">
                    {tracingRef.purpose === 'accessory' ? 'Sticker / Adorno' : 'Referencia para calcar'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {onToggleTracingVisibility && (
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic(8);
                      onToggleTracingVisibility();
                    }}
                    aria-label={tracingRef.visible ? "Ocultar calco" : "Mostrar calco"}
                    className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/15 text-gray-200 flex items-center justify-center active:scale-95 transition-all"
                  >
                    {tracingRef.visible ? <Eye size={15} className="text-amber-400" /> : <EyeOff size={15} className="text-gray-500" />}
                  </button>
                )}
                {onReopenTracingAdjust && (
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic(8);
                      onReopenTracingAdjust();
                      onClose();
                    }}
                    className={`h-8 px-2.5 rounded-xl text-[11px] font-bold flex items-center gap-1 active:scale-95 transition-all ${
                      tracingRef.purpose === 'accessory'
                        ? 'bg-pink-500 text-white shadow-xs'
                        : 'bg-amber-500 text-black shadow-xs'
                    }`}
                  >
                    <Sliders size={12} />
                    <span>Calibrar</span>
                  </button>
                )}
                {onRemoveTracing && (
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic(12);
                      onRemoveTracing();
                    }}
                    aria-label="Eliminar calco"
                    className="w-8 h-8 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-400 flex items-center justify-center active:scale-95 transition-all"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Capas de Dibujo (Orden descendente natural: capa superior arriba) */}
          {[...layers].reverse().map((layer) => {
            const isSelected = layer.id === activeLayerId;
            return (
              <div
                key={layer.id}
                onClick={() => {
                  triggerHaptic(6);
                  onSelectLayer(layer.id);
                }}
                className={`flex items-center gap-2.5 p-2 rounded-2xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'border-white/20 shadow-md'
                    : 'bg-[#151620] border-white/5 hover:border-white/10'
                }`}
                style={isSelected ? {
                  backgroundColor: theme.accentSoft,
                  borderColor: theme.accentColor,
                  boxShadow: `0 0 15px ${theme.accentSoft}`
                } : undefined}
              >
                {/* Botón Visibilidad (Ojo con área táctil cómoda) */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerHaptic(8);
                    onToggleVisibility(layer.id);
                  }}
                  aria-label={layer.visible ? "Ocultar capa" : "Mostrar capa"}
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 active:scale-90 transition-all text-gray-300"
                >
                  {layer.visible ? (
                    <Eye size={18} style={{ color: theme.accentColor }} />
                  ) : (
                    <EyeOff size={18} className="text-gray-600" />
                  )}
                </button>

                {/* Miniatura Real del Canvas de la Capa */}
                <LayerThumbnail layer={layer} />

                {/* Nombre y detalles de capa */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                      {layer.name}
                    </p>
                    {isSelected && (
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: theme.accentColor }} />
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-gray-400 mt-0.5">
                    <span className="px-1.5 py-0.2 rounded-md bg-white/5 font-mono text-gray-300">
                      {Math.round(layer.opacity * 100)}%
                    </span>
                    <span>•</span>
                    <span className="truncate">
                      {BLEND_MODES.find(b => b.mode === layer.blendMode)?.label || 'Normal'}
                    </span>
                  </div>
                </div>

                {/* Controles de subida/bajada de orden en la pila */}
                <div className="flex flex-col gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic(6);
                      onMoveLayer(layer.id, 'up');
                    }}
                    aria-label="Subir capa"
                    className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center active:scale-90 transition-all"
                  >
                    <ArrowUp size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic(6);
                      onMoveLayer(layer.id, 'down');
                    }}
                    aria-label="Bajar capa"
                    className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center active:scale-90 transition-all"
                  >
                    <ArrowDown size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* 4. INSPECTOR CONTEXTUAL DE CAPA ACTIVA (Opacidad + Selector Nativo de Modos de Fusión) */}
        {activeLayer && (
          <div className="bg-[#0c0d14] p-3 rounded-2xl border border-white/5 space-y-2.5">
            {/* Control de Opacidad de Capa */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400 font-medium">Opacidad de capa activa:</span>
                <span className="font-mono font-black text-xs" style={{ color: theme.accentTextHex }}>
                  {Math.round(activeLayer.opacity * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={Math.round(activeLayer.opacity * 100)}
                onChange={(e) => onChangeOpacity(activeLayer.id, Number(e.target.value) / 100)}
                style={{ accentColor: theme.accentColor }}
                className="w-full h-2 bg-[#1f202b] rounded-lg cursor-pointer"
                title="Ajustar opacidad de la capa activa"
              />
            </div>

            {/* Selector Nativo de Modo de Fusión (Pills Táctiles Horizontales sin Ventana Emergente) */}
            <div className="space-y-1.5 pt-0.5">
              <span className="text-xs text-gray-400 font-medium block">Modo de Fusión:</span>
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 -mx-0.5 px-0.5">
                {BLEND_MODES.map((b) => {
                  const isCurrent = activeLayer.blendMode === b.mode;
                  return (
                    <button
                      key={b.mode}
                      type="button"
                      onClick={() => {
                        triggerHaptic(8);
                        onChangeBlendMode(activeLayer.id, b.mode);
                      }}
                      className={`h-8 px-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-all active:scale-95 shrink-0 ${
                        isCurrent
                          ? 'text-black shadow-md font-black'
                          : 'bg-[#181923] text-gray-300 hover:text-white border border-white/5 hover:border-white/10'
                      }`}
                      style={isCurrent ? {
                        backgroundColor: theme.accentColor,
                        color: '#000000',
                      } : undefined}
                    >
                      <span className="text-xs">{b.icon}</span>
                      <span>{b.label}</span>
                      <span className={`text-[10px] font-normal ${isCurrent ? 'text-black/80 font-semibold' : 'text-gray-500'}`}>
                        ({b.tag})
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 5. BOTÓN PRINCIPAL DE CONFIRMACIÓN */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic(10);
            onClose();
          }}
          className="w-full py-3 bg-[#1c1e28] hover:bg-[#252838] text-white font-bold text-xs tracking-wider rounded-2xl transition-all border border-white/10 active:scale-98 shadow-md flex items-center justify-center gap-1.5"
        >
          <Check size={16} className="stroke-[2.5]" style={{ color: theme.accentColor }} />
          <span>Listo</span>
        </button>
      </div>
    </div>
  );
};
