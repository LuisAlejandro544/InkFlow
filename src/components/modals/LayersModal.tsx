/**
 * @file LayersModal.tsx
 * @description Gestor de capas inspirado fielmente en el panel de capas de IbisPaint.
 * Permite agregar, duplicar, combinar hacia abajo, reordenar, ajustar opacidad,
 * ocultar/mostrar y cambiar modos de fusión (Multiplicar, Pantalla, Superponer, Añadir),
 * además de gestionar e importar fotos de la galería para calco.
 */

import React, { useRef } from 'react';
import { 
  X, Plus, Copy, Trash2, Eye, EyeOff, 
  ArrowDown, ArrowUp, Layers as LayersIcon, Eraser,
  Camera, Sliders, Image, RotateCcw
} from 'lucide-react';
import { Layer, BlendMode, TracingReference } from '../../engine/types';

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
  const activeLayer = layers.find(l => l.id === activeLayerId) || layers[0];
  const activeIndex = layers.findIndex(l => l.id === activeLayerId);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-xs p-0 sm:p-4 animate-fade-in select-none">
      <div className="w-full sm:max-w-md bg-[#16171d] border-t sm:border border-[#2e313c] rounded-t-3xl sm:rounded-2xl p-4 sm:p-5 text-white shadow-2xl flex flex-col gap-3.5 max-h-[90vh] pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {/* Tirador táctil nativo para móviles */}
        <div className="w-12 h-1.5 rounded-full bg-neutral-600/70 mx-auto -mt-1 sm:hidden" />

        {/* Cabecera */}
        <div className="flex items-center justify-between border-b border-[#262832] pb-2.5">
          <div className="flex items-center gap-2">
            <LayersIcon size={20} className="text-amber-400" />
            <h2 className="text-base sm:text-lg font-bold">Capas de Dibujo ({layers.length})</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar panel de capas"
            className="p-2 rounded-xl bg-[#23252d] hover:bg-[#2c2f3a] text-gray-300 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Botones de Importación de Galería: Calco y Accesorios (Moño, etc.) */}
        <div className="grid grid-cols-2 gap-2">
          {onTriggerImportPhoto && (
            <button
              onClick={() => {
                onTriggerImportPhoto();
                onClose();
              }}
              className="py-2.5 px-2 rounded-xl bg-[#1c1e28] hover:bg-[#252838] border border-amber-500/40 text-amber-300 font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-98 transition-all"
            >
              <Camera size={15} />
              <span>📷 Calcar Foto</span>
            </button>
          )}

          {onTriggerImportAccessory && (
            <button
              onClick={() => {
                onTriggerImportAccessory();
                onClose();
              }}
              className="py-2.5 px-2 rounded-xl bg-gradient-to-r from-pink-500/20 to-rose-500/20 hover:from-pink-500/30 hover:to-rose-500/30 border border-pink-500/40 text-pink-300 font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-98 transition-all"
            >
              <span className="text-sm">🎀</span>
              <span>Poner Accesorio</span>
            </button>
          )}
        </div>

        {/* Barra de acciones de capa */}
        <div className="grid grid-cols-5 gap-2 bg-[#121316] p-2 rounded-xl border border-[#262832]">
          <button
            onClick={onAddLayer}
            className="flex flex-col items-center justify-center py-2 px-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs gap-1 transition-colors"
            title="Añadir nueva capa vacía"
          >
            <Plus size={16} />
            <span>Nueva</span>
          </button>

          <button
            onClick={() => onDuplicateLayer(activeLayerId)}
            className="flex flex-col items-center justify-center py-2 px-1 rounded-lg bg-[#23252d] hover:bg-[#2c2f3a] text-gray-300 text-xs gap-1 transition-colors"
            title="Duplicar capa activa"
          >
            <Copy size={16} />
            <span>Duplicar</span>
          </button>

          <button
            onClick={() => onMergeDown(activeLayerId)}
            disabled={activeIndex <= 0}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg text-xs gap-1 transition-colors ${
              activeIndex <= 0 
                ? 'bg-[#1b1c22] text-gray-600 cursor-not-allowed' 
                : 'bg-[#23252d] hover:bg-[#2c2f3a] text-gray-300'
            }`}
            title="Combinar con la capa inferior"
          >
            <ArrowDown size={16} />
            <span>Combinar</span>
          </button>

          <button
            onClick={() => onClearLayer(activeLayerId)}
            className="flex flex-col items-center justify-center py-2 px-1 rounded-lg bg-[#23252d] hover:bg-[#2c2f3a] text-yellow-400 text-xs gap-1 transition-colors"
            title="Limpiar contenido de la capa"
          >
            <Eraser size={16} />
            <span>Limpiar</span>
          </button>

          <button
            onClick={() => onDeleteLayer(activeLayerId)}
            disabled={layers.length <= 1}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg text-xs gap-1 transition-colors ${
              layers.length <= 1 
                ? 'bg-[#1b1c22] text-gray-600 cursor-not-allowed' 
                : 'bg-red-950/40 hover:bg-red-900/60 text-red-400'
            }`}
            title="Eliminar capa"
          >
            <Trash2 size={16} />
            <span>Borrar</span>
          </button>
        </div>

        {/* Sección de Foto de Calco Activa (Si existe) */}
        {tracingRef && (
          <div className="bg-[#121316] border border-amber-500/40 p-2.5 rounded-xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-lg overflow-hidden bg-black/40 border border-[#313440] shrink-0">
                <img src={tracingRef.src} alt="Calco" className="w-full h-full object-cover" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-amber-300 truncate">Foto de Calco</span>
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 font-mono px-1.5 rounded">
                    {Math.round(tracingRef.opacity * 100)}%
                  </span>
                </div>
                <p className="text-[10px] text-gray-400">Guía de referencia para calquear</p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {onToggleTracingVisibility && (
                <button
                  onClick={onToggleTracingVisibility}
                  aria-label={tracingRef.visible ? "Ocultar calco" : "Mostrar calco"}
                  className="p-1.5 rounded-lg bg-[#23252d] hover:bg-[#2c2f3a] text-gray-300"
                >
                  {tracingRef.visible ? <Eye size={16} className="text-amber-400" /> : <EyeOff size={16} />}
                </button>
              )}
              {onReopenTracingAdjust && (
                <button
                  onClick={() => {
                    onReopenTracingAdjust();
                    onClose();
                  }}
                  className="px-2 py-1.5 rounded-lg bg-amber-500 text-black text-[11px] font-bold flex items-center gap-1"
                >
                  <Sliders size={12} />
                  <span>Mover</span>
                </button>
              )}
              {onRemoveTracing && (
                <button
                  onClick={onRemoveTracing}
                  aria-label="Eliminar calco"
                  className="p-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-400"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Ajustes de la capa activa: Opacidad y Modo de Fusión */}
        {activeLayer && (
          <div className="bg-[#121316] p-3 rounded-xl border border-[#262832] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Opacidad de capa activa:</span>
              <span className="font-mono font-bold text-amber-400">
                {Math.round(activeLayer.opacity * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={Math.round(activeLayer.opacity * 100)}
              onChange={(e) => onChangeOpacity(activeLayer.id, Number(e.target.value) / 100)}
              className="w-full accent-amber-500 h-2 bg-[#2a2c36] rounded-lg cursor-pointer"
            />

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-gray-400">Modo de Fusión:</span>
              <select
                value={activeLayer.blendMode}
                onChange={(e) => onChangeBlendMode(activeLayer.id, e.target.value as BlendMode)}
                className="bg-[#23252d] border border-[#313440] text-white text-xs rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:border-amber-500"
              >
                <option value="source-over">Normal</option>
                <option value="multiply">Multiplicar (Sombras)</option>
                <option value="screen">Pantalla (Luces)</option>
                <option value="overlay">Superponer (Contraste)</option>
                <option value="lighter">Añadir (Resplandor)</option>
              </select>
            </div>
          </div>
        )}

        {/* Lista de Capas */}
        <div className="flex-1 overflow-y-auto space-y-2 max-h-[30vh] pr-1">
          {[...layers].reverse().map((layer) => {
            const isSelected = layer.id === activeLayerId;
            return (
              <div
                key={layer.id}
                onClick={() => onSelectLayer(layer.id)}
                className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-amber-500/10 border-amber-500/80 ring-1 ring-amber-500/40'
                    : 'bg-[#121316] border-[#262832] hover:border-[#383a48]'
                }`}
              >
                {/* Botón Visibilidad (Ojo) */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleVisibility(layer.id);
                  }}
                  aria-label={layer.visible ? "Ocultar capa" : "Mostrar capa"}
                  className={`p-1.5 rounded-lg ${
                    layer.visible ? 'text-amber-400 hover:bg-amber-500/20' : 'text-gray-600 hover:bg-[#23252d]'
                  }`}
                >
                  {layer.visible ? <Eye size={18} /> : <EyeOff size={18} />}
                </button>

                {/* Miniatura de capa */}
                <div className="w-10 h-10 rounded-lg bg-[repeating-conic-gradient(#18191f_0%_25%,#262832_0%_50%)] bg-[length:10px_10px] border border-[#313440] overflow-hidden shrink-0 flex items-center justify-center">
                  <span className="text-[10px] font-mono text-gray-400 font-bold">
                    {layer.name.slice(0, 3)}
                  </span>
                </div>

                {/* Nombre y detalles de capa */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{layer.name}</p>
                  <p className="text-[10px] text-gray-400">
                    {layer.blendMode === 'source-over' ? 'Normal' : layer.blendMode} • {Math.round(layer.opacity * 100)}%
                  </p>
                </div>

                {/* Controles de subida/bajada de orden */}
                <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => onMoveLayer(layer.id, 'up')}
                    aria-label="Subir capa"
                    className="p-1 rounded bg-[#23252d] hover:bg-[#2c2f3a] text-gray-400 hover:text-white"
                  >
                    <ArrowUp size={12} />
                  </button>
                  <button
                    onClick={() => onMoveLayer(layer.id, 'down')}
                    aria-label="Bajar capa"
                    className="p-1 rounded bg-[#23252d] hover:bg-[#2c2f3a] text-gray-400 hover:text-white"
                  >
                    <ArrowDown size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Botón de cierre */}
        <button
          onClick={onClose}
          className="w-full py-2.5 bg-[#23252d] hover:bg-[#2c2f3a] text-gray-200 font-medium rounded-xl transition-all border border-[#313440]"
        >
          Listo
        </button>
      </div>
    </div>
  );
};
