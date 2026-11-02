/**
 * @file StudioTopBar.tsx
 * @description Barra superior ergonómica estilo app nativa móvil para StudioScreen.
 * 
 * Contiene:
 * - Botón de retroceso a la galería.
 * - Controles de Deshacer (Undo) y Rehacer (Redo).
 * - Indicador táctil de Zoom/Rotación con auto-centrado al tocar.
 * - Acceso directo a foto de Calco (importar, alternar ajuste y visibilidad).
 * - Calibrador emergente del Estabilizador S-Form.
 * - Menú Pro flotante (Guía IA de trazo, Enderezar lienzo a 0°, Expandir hoja, Diagnóstico motor y PWA).
 * - Botón destacado y siempre visible "Guardar".
 * - Banner contextual de rescate de crash o salida abrupta con SQLite Wasm OPFS.
 */

import React, { useState } from 'react';
import { 
  ArrowLeft, Undo2, Redo2, Sliders, 
  Download, Smartphone, X, PenTool, Check,
  Camera, Eye, EyeOff, Sparkles, MoreHorizontal, RotateCcw,
  Maximize2
} from 'lucide-react';
import { ProjectData, TracingReference } from '../../engine/types';
import { CrashRecoveryRecord } from '../../storage/sqliteTypes';

export interface StudioTopBarProps {
  project: ProjectData;
  canUndo: boolean;
  canRedo: boolean;
  scale: number;
  rotation: number;
  tracingRef: TracingReference | null;
  stabilizerLevel: number;
  showStrokeGuide: boolean;
  crashRecovery?: CrashRecoveryRecord | null;
  onGoToGallery: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onToggleFitOr100: () => void;
  onTriggerImportPhoto: () => void;
  onUpdateTracing: (update: Partial<TracingReference>) => void;
  onToggleTracingVisibility: () => void;
  onChangeStabilizer: (level: number) => void;
  onToggleStrokeGuide: () => void;
  onResetRotation: () => void;
  onOpenCanvasResizeModal?: () => void;
  onGoToEngine?: () => void;
  onGoToWelcome?: () => void;
  onOpenExportModal: () => void;
  onRestoreCrash?: () => void;
  onDismissCrash?: () => void;
  triggerHaptic: (duration?: number) => void;
}

export const StudioTopBar: React.FC<StudioTopBarProps> = ({
  project,
  canUndo,
  canRedo,
  scale,
  rotation,
  tracingRef,
  stabilizerLevel,
  showStrokeGuide,
  crashRecovery,
  onGoToGallery,
  onUndo,
  onRedo,
  onToggleFitOr100,
  onTriggerImportPhoto,
  onUpdateTracing,
  onToggleTracingVisibility,
  onChangeStabilizer,
  onToggleStrokeGuide,
  onResetRotation,
  onOpenCanvasResizeModal,
  onGoToEngine,
  onGoToWelcome,
  onOpenExportModal,
  onRestoreCrash,
  onDismissCrash,
  triggerHaptic,
}) => {
  const [showStabilizerMenu, setShowStabilizerMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  return (
    <>
      <header className="h-12 px-2 bg-[#111217]/95 border-b border-[#1e2029] flex items-center justify-between z-30 shrink-0 shadow-sm backdrop-blur-md gap-1 max-w-full overflow-x-auto no-scrollbar">
        {/* Lado Izquierdo: Volver, Deshacer y Rehacer */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => {
              triggerHaptic(8);
              onGoToGallery();
            }}
            aria-label="Ir a galería de proyectos"
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#191a22] hover:bg-[#232530] text-gray-300 hover:text-white border border-[#262835] flex items-center justify-center transition-all active:scale-90 shrink-0"
            title="Galería"
          >
            <ArrowLeft size={16} />
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic(8);
              onUndo();
            }}
            disabled={!canUndo}
            aria-label="Deshacer trazo"
            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl border flex items-center justify-center transition-all shrink-0 ${
              canUndo 
                ? 'bg-[#191a22] hover:bg-[#232530] text-amber-400 border-[#262835] active:scale-90' 
                : 'bg-[#14151b] text-gray-600 border-transparent cursor-not-allowed opacity-30'
            }`}
            title="Deshacer (Toque con 2 dedos)"
          >
            <Undo2 size={16} />
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic(8);
              onRedo();
            }}
            disabled={!canRedo}
            aria-label="Rehacer trazo"
            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl border flex items-center justify-center transition-all shrink-0 ${
              canRedo 
                ? 'bg-[#191a22] hover:bg-[#232530] text-amber-400 border-[#262835] active:scale-90' 
                : 'bg-[#14151b] text-gray-600 border-transparent cursor-not-allowed opacity-30'
            }`}
            title="Rehacer (Toque con 3 dedos)"
          >
            <Redo2 size={16} />
          </button>
        </div>

        {/* Centro: Indicador interactivo de Zoom/Rotación y Botón de Calco */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onToggleFitOr100}
            aria-label="Ajustar o centrar lienzo y enderezar rotación"
            className="h-8 px-2 rounded-full bg-[#181922] hover:bg-[#222430] border border-[#272937] text-xs font-mono font-bold text-amber-400 active:scale-95 transition-all shadow-xs flex items-center gap-1 shrink-0"
            title="Toca para ajustar o enderezar rotación a 0°"
          >
            <span>{Math.round(scale * 100)}%</span>
            {Math.round(rotation) !== 0 && (
              <span className="text-[10px] text-amber-300 font-semibold">• {Math.round(rotation)}°</span>
            )}
          </button>

          {/* BOTÓN CALCO (Compacto / Nativo) */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic(10);
              if (!tracingRef) {
                onTriggerImportPhoto();
              } else {
                onUpdateTracing({ isAdjusting: !tracingRef.isAdjusting });
              }
            }}
            aria-label="Calcar foto"
            className={`h-8 px-2 rounded-xl border text-xs font-bold active:scale-95 transition-all flex items-center gap-1 shrink-0 ${
              tracingRef
                ? tracingRef.isAdjusting
                  ? 'bg-amber-500 text-black border-amber-400 shadow-sm'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-[#191a22] hover:bg-[#232530] text-gray-300 border-[#262835]'
            }`}
            title={tracingRef ? 'Calco activo (Toca para ajustar)' : 'Calcar foto de galería'}
          >
            <Camera size={13} className={tracingRef?.isAdjusting ? 'text-black' : 'text-amber-400'} />
            <span className="text-[11px]">Calco</span>
            {tracingRef && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            )}
          </button>

          {/* CONMUTADOR DE VISIBILIDAD DE CALCO */}
          {tracingRef && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic(10);
                onToggleTracingVisibility();
              }}
              aria-label={tracingRef.visible ? 'Ocultar calco' : 'Ver calco'}
              className={`w-8 h-8 rounded-xl border flex items-center justify-center transition-all active:scale-95 shrink-0 ${
                tracingRef.visible
                  ? 'bg-[#191a22] text-gray-300 border-[#262835]'
                  : 'bg-amber-500 text-black border-amber-400 shadow-sm'
              }`}
              title={tracingRef.visible ? 'Ocultar foto de calco' : 'Mostrar foto de calco'}
            >
              {tracingRef.visible ? <Eye size={13} /> : <EyeOff size={13} />}
            </button>
          )}
        </div>

        {/* Lado Derecho: Estabilizador, Menú Más Opciones y Botón Guardar */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => {
              triggerHaptic(8);
              setShowStabilizerMenu(!showStabilizerMenu);
              setShowMoreMenu(false);
            }}
            aria-label="Estabilizador S-Form"
            className={`h-8 px-2 rounded-xl border text-xs font-semibold active:scale-95 transition-all flex items-center gap-1 shrink-0 ${
              showStabilizerMenu
                ? 'bg-amber-500 text-black border-amber-400 font-bold'
                : 'bg-[#191a22] hover:bg-[#232530] text-amber-400 border-[#262835]'
            }`}
            title="Ajustar Estabilizador S-Form"
          >
            <Sliders size={12} />
            <span className="font-mono font-bold text-[11px] whitespace-nowrap">S{stabilizerLevel}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic(8);
              setShowMoreMenu(!showMoreMenu);
              setShowStabilizerMenu(false);
            }}
            aria-label="Más herramientas y opciones"
            className={`w-8 h-8 rounded-xl border flex items-center justify-center transition-all active:scale-95 shrink-0 ${
              showMoreMenu || showStrokeGuide
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                : 'bg-[#191a22] hover:bg-[#232530] text-gray-300 hover:text-white border-[#262835]'
            }`}
            title="Más opciones de estudio"
          >
            <MoreHorizontal size={15} />
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic(10);
              onOpenExportModal();
            }}
            aria-label="Guardar obra maestra en tu galería"
            className="h-8 px-2.5 sm:px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs flex items-center gap-1.5 shadow-md shrink-0 active:scale-95 transition-all"
            title="Guardar / Exportar Obra Maestra"
          >
            <Download size={14} className="stroke-[2.5]" />
            <span className="tracking-wide">Guardar</span>
          </button>
        </div>
      </header>

      {/* BANNER DE RECUPERACIÓN TRAS SALIDA ABRUPTA O CRASH */}
      {crashRecovery && (
        <aside
          aria-label="Aviso de dibujo recuperado de sesión anterior"
          className="fixed top-14 left-3 right-3 sm:left-1/2 sm:-translate-x-1/2 sm:max-w-md z-40 bg-[#191a24] border border-amber-500/60 rounded-2xl p-2.5 shadow-2xl flex items-center justify-between gap-2.5 animate-in fade-in slide-in-from-top-2 backdrop-blur-md"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <Sparkles size={16} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-amber-300 truncate">
                ¡Dibujo recuperado de sesión anterior!
              </p>
              <p className="text-[10px] text-gray-400 truncate">
                Resguardado en SQLite Wasm (OPFS) • {crashRecovery.layerCount} capa(s)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                triggerHaptic(12);
                onRestoreCrash?.();
              }}
              className="px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold shadow-sm active:scale-95 transition-all cursor-pointer"
            >
              Restaurar
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic(8);
                onDismissCrash?.();
              }}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all cursor-pointer"
              title="Descartar"
            >
              <X size={14} />
            </button>
          </div>
        </aside>
      )}

      {/* POPUP FLOTANTE NATIVO: ESTABILIZADOR S-FORM */}
      {showStabilizerMenu && (
        <div key="stabilizer-menu-modal" className="fixed inset-0 z-50 pointer-events-auto">
          <div 
            onClick={() => setShowStabilizerMenu(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-xs animate-fade-in"
          />
          <div className="fixed top-13 right-16 z-50 bg-[#181922] border border-[#2e313f] rounded-2xl p-3 shadow-2xl w-52 flex flex-col gap-1.5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-1.5 border-b border-[#272935]">
              <span className="text-[11px] font-bold text-gray-200">Estabilizador S-Form</span>
              <button 
                type="button"
                onClick={() => setShowStabilizerMenu(false)} 
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X size={14} />
              </button>
            </div>
            {[
              { level: 0, label: 'S-0: Directo' },
              { level: 3, label: 'S-3: Natural (Boceto)' },
              { level: 6, label: 'S-6: Suave (Ilustración)' },
              { level: 10, label: 'S-10: Manga (Firme)' },
            ].map((item) => (
              <button
                key={item.level}
                type="button"
                onClick={() => {
                  triggerHaptic(10);
                  onChangeStabilizer(item.level);
                  setShowStabilizerMenu(false);
                }}
                className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                  stabilizerLevel === item.level
                    ? 'bg-amber-500 text-black font-bold shadow-xs'
                    : 'text-gray-200 hover:bg-[#232530] active:scale-95'
                }`}
              >
                <span>{item.label}</span>
                {stabilizerLevel === item.level && <Check size={14} className="stroke-[3]" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* POPUP FLOTANTE NATIVO: MENÚ MÁS OPCIONES */}
      {showMoreMenu && (
        <div key="more-menu-modal" className="fixed inset-0 z-50 pointer-events-auto">
          <div 
            onClick={() => setShowMoreMenu(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-xs animate-fade-in"
          />
          <div className="fixed top-13 right-2 z-50 bg-[#161720] border border-[#2b2d3d] rounded-2xl p-2.5 shadow-2xl w-60 flex flex-col gap-1.5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between px-2 py-1 border-b border-[#242635] mb-0.5">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Herramientas Pro</span>
              <button 
                type="button"
                onClick={() => setShowMoreMenu(false)} 
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X size={14} />
              </button>
            </div>

            {/* Opción 1: Asistente de Grosor de Trazo por IA */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic(8);
                onToggleStrokeGuide();
                setShowMoreMenu(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all text-left active:scale-98 ${
                showStrokeGuide
                  ? 'bg-amber-500 text-black font-bold shadow-xs'
                  : 'text-gray-200 hover:bg-[#20222f]'
              }`}
            >
              <Sparkles size={16} className={showStrokeGuide ? 'text-black' : 'text-amber-400'} />
              <div className="flex-1 min-w-0">
                <span className="block leading-tight">Guía de Grosor IA</span>
                <span className={`text-[9px] block ${showStrokeGuide ? 'text-black/80 font-medium' : 'text-gray-400'}`}>
                  {showStrokeGuide ? 'Activo en barra inferior' : 'Calibración por visión'}
                </span>
              </div>
            </button>

            {/* Opción 2: Enderezar Lienzo a 0° */}
            <button
              type="button"
              onClick={() => {
                onResetRotation();
                setShowMoreMenu(false);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-gray-200 hover:bg-[#20222f] active:scale-98 transition-all text-left"
            >
              <RotateCcw size={16} className="text-amber-400" />
              <div className="flex-1 min-w-0">
                <span className="block leading-tight">Enderezar Lienzo</span>
                <span className="text-[9px] text-gray-400 block">
                  Restablecer rotación a 0°
                </span>
              </div>
            </button>

            {/* Opción 3: Expandir Hoja / Tamaño de Lienzo */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic(8);
                setShowMoreMenu(false);
                onOpenCanvasResizeModal?.();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-gray-200 hover:bg-[#20222f] active:scale-98 transition-all text-left"
            >
              <Maximize2 size={16} className="text-amber-400" />
              <div className="flex-1 min-w-0">
                <span className="block leading-tight">Expandir Hoja</span>
                <span className="text-[9px] text-gray-400 block font-mono">
                  {project.width} × {project.height} px • Añadir espacio
                </span>
              </div>
            </button>

            {/* Opción 4: Acerca de / Instalar PWA */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic(8);
                setShowMoreMenu(false);
                if (onGoToWelcome) onGoToWelcome();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-gray-200 hover:bg-[#20222f] active:scale-98 transition-all text-left"
            >
              <Smartphone size={16} className="text-amber-400" />
              <div className="flex-1 min-w-0">
                <span className="block leading-tight">Presentación & PWA</span>
                <span className="text-[9px] text-gray-400 block">
                  Instalar en pantalla de inicio
                </span>
              </div>
            </button>

            {/* Estado de Persistencia SQLite Wasm / OPFS */}
            <div className="mt-1 pt-2 border-t border-[#252737] px-2 flex items-center justify-between text-[10px]">
              <div className="flex items-center gap-1.5 text-gray-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="font-semibold">SQLite Wasm (OPFS)</span>
              </div>
              <span className="text-emerald-400 font-mono text-[9px] bg-emerald-950/60 border border-emerald-500/20 px-1.5 py-0.5 rounded-md">
                Auto-Guardado
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
