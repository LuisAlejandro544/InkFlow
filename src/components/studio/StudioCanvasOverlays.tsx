/**
 * @file StudioCanvasOverlays.tsx
 * @description Superposiciones HUD flotantes y modales auxiliares para el área de dibujo en StudioScreen.
 * 
 * Contiene:
 * - Botón flotante rápido para conmutar la visibilidad de la foto de calco.
 * - Píldora flotante ergonómica para ajustar la expansión de borde del Bote de Pintura (0 a 3 px).
 * - Burbuja flotante de previsualización de grosor de pincel.
 * - Burbuja flotante de previsualización de opacidad de pincel.
 * - Modal instructivo de instalación PWA en iOS Safari.
 */

import React from 'react';
import { Eye, EyeOff, Smartphone, X, Share } from 'lucide-react';
import { ToolType, TracingReference } from '../../engine/types';

export interface StudioCanvasOverlaysProps {
  activeTool: ToolType;
  tracingRef: TracingReference | null;
  bucketExpansion?: number;
  onChangeBucketExpansion?: (expansion: number) => void;
  bucketGapClosing?: number;
  onChangeBucketGapClosing?: (gap: number) => void;
  showSizePreview: boolean;
  brushSize: number;
  showOpacityPreview: boolean;
  brushOpacity: number;
  showIOSModal: boolean;
  setShowIOSModal: (show: boolean) => void;
  onToggleTracingVisibility: () => void;
  triggerHaptic: (duration?: number) => void;
}

export const StudioCanvasOverlays: React.FC<StudioCanvasOverlaysProps> = ({
  activeTool,
  tracingRef,
  bucketExpansion = 2,
  onChangeBucketExpansion,
  bucketGapClosing = 3,
  onChangeBucketGapClosing,
  showSizePreview,
  brushSize,
  showOpacityPreview,
  brushOpacity,
  showIOSModal,
  setShowIOSModal,
  onToggleTracingVisibility,
  triggerHaptic,
}) => {
  return (
    <>
      {/* Conmutador flotante rápido para alternar calco y ver las líneas limpias al instante */}
      {tracingRef && !tracingRef.isAdjusting && (
        <button
          type="button"
          onClick={() => {
            triggerHaptic(10);
            onToggleTracingVisibility();
          }}
          className={`absolute top-4 right-4 z-40 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-2xl backdrop-blur-md border transition-all active:scale-95 ${
            tracingRef.visible
              ? 'bg-[#14151df0] border-gray-700/80 text-gray-300 hover:text-white'
              : `${tracingRef.purpose === 'accessory' ? 'bg-pink-500 text-white border-pink-300 shadow-pink-500/40' : 'bg-amber-500 text-black border-amber-300 shadow-amber-500/40'} ring-2 ring-amber-400/40`
          }`}
          title="Toca para ocultar o mostrar la referencia y comparar tu dibujo"
        >
          {tracingRef.visible ? <Eye size={14} className="text-amber-400" /> : <EyeOff size={14} />}
          <span>{tracingRef.visible ? (tracingRef.purpose === 'accessory' ? 'Accesorio' : 'Calco') : 'Oculto'}</span>
        </button>
      )}

      {/* Píldora Flotante Ergonómica: Expansión de Borde y Cierre Inteligente de Huecos */}
      {activeTool === 'bucket' && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 bg-[#13141cf5] border border-indigo-500/50 rounded-2xl py-1.5 px-3 flex items-center gap-2.5 shadow-2xl backdrop-blur-md max-w-[96vw] animate-in fade-in slide-in-from-top-2 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[11px] font-bold text-indigo-300">🪣 Exp:</span>
            <div className="flex items-center gap-0.5 bg-[#0b0c10] p-0.5 rounded-xl border border-[#222433]">
              {[0, 1, 2, 3].map((px) => (
                <button
                  key={px}
                  type="button"
                  onClick={() => {
                    triggerHaptic(8);
                    onChangeBucketExpansion?.(px);
                  }}
                  className={`px-1.5 py-0.5 rounded-lg text-[10px] font-bold font-mono transition-all ${
                    bucketExpansion === px
                      ? 'bg-amber-500 text-black shadow-xs font-black'
                      : 'text-gray-400 hover:text-white'
                  }`}
                  title={`Expansión de ${px}px para sellar halos blancos`}
                >
                  {px}px
                </button>
              ))}
            </div>
          </div>

          <div className="w-[1px] h-3.5 bg-[#282a3c] shrink-0" />

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[11px] font-bold text-emerald-300">🛡️ Huecos:</span>
            <div className="flex items-center gap-0.5 bg-[#0b0c10] p-0.5 rounded-xl border border-[#222433]">
              {[
                { px: 0, label: '0' },
                { px: 3, label: '3px' },
                { px: 6, label: '6px' },
                { px: 10, label: '10px' },
              ].map((item) => (
                <button
                  key={item.px}
                  type="button"
                  onClick={() => {
                    triggerHaptic(8);
                    onChangeBucketGapClosing?.(item.px);
                  }}
                  className={`px-1.5 py-0.5 rounded-lg text-[10px] font-bold font-mono transition-all ${
                    bucketGapClosing === item.px
                      ? 'bg-emerald-500 text-black shadow-xs font-black'
                      : 'text-gray-400 hover:text-white'
                  }`}
                  title={`Cierre de huecos de ${item.px}px para lineart abierto`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Burbuja flotante de previsualización de grosor al ajustar slider */}
      {showSizePreview && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-40 bg-[#161722f0] border border-amber-500/80 rounded-2xl p-3.5 flex flex-col items-center gap-2 shadow-2xl backdrop-blur-md pointer-events-none animate-fade-in">
          <div 
            className="rounded-full bg-amber-500 border-2 border-white shadow-md"
            style={{ width: `${Math.min(80, Math.max(4, brushSize))}px`, height: `${Math.min(80, Math.max(4, brushSize))}px` }}
          />
          <span className="text-xs font-bold font-mono text-white">{brushSize} px</span>
        </div>
      )}

      {/* Burbuja flotante de previsualización de opacidad al ajustar slider */}
      {showOpacityPreview && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-40 bg-[#161722f0] border border-amber-500/80 rounded-2xl px-5 py-2.5 text-xs font-bold font-mono text-white shadow-2xl backdrop-blur-md pointer-events-none animate-fade-in">
          Opacidad: {Math.round(brushOpacity * 100)}%
        </div>
      )}

      {/* Modal de Guía de Instalación para iOS Safari */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-[#181922] border border-[#2e313f] rounded-3xl p-5 max-w-sm w-full text-white shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[#272935] pb-2">
              <div className="flex items-center gap-2 text-amber-400">
                <Smartphone size={20} />
                <h3 className="font-bold text-base">Instalar en iPhone / iPad</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSModal(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            <div className="text-xs space-y-2 text-gray-300">
              <p>1. Pulsa el botón <strong>Compartir</strong> (icono <Share size={13} className="inline text-amber-400" />) en la barra de Safari.</p>
              <p>2. Desplázate hacia abajo y selecciona <strong>"Añadir a la pantalla de inicio"</strong>.</p>
              <p>3. Pulsa <strong>"Añadir"</strong> en la esquina superior derecha.</p>
              <p className="text-amber-400 pt-1 font-medium">¡Listo! La app se ejecutará a pantalla completa como una app nativa.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowIOSModal(false)}
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs active:scale-95 transition-transform"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
};
