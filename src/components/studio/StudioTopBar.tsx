/**
 * @file StudioTopBar.tsx
 * @description Barra superior del estudio de dibujo optimizada para teléfonos móviles.
 * 
 * Diseñada para pantallas táctiles estrechas (360-430px) y altas:
 * - Botones esenciales visibles en una sola fila compacta (h-12).
 * - Calco y Visibilidad integrados en el centro sin desbordamiento.
 * - Conmutador S-Form (Estabilizador) y Guardar en la esquina derecha.
 * - Menú [⋯] nativo para Guía de Grosor, Rotación 0°, Expandir Hoja, Accesorios, Ajustes y Planes.
 * - Totalmente reactiva al tema visual seleccionado por el usuario.
 */

import React, { useState } from 'react';
import { 
  ArrowLeft, Undo2, Redo2, Download, MoreHorizontal, 
  Sparkles, RotateCcw, Camera, Eye, EyeOff, Sliders, Maximize2, 
  X, Check, Settings, Rocket 
} from 'lucide-react';
import { ProjectData, TracingReference } from '../../engine/types';
import { useAppTheme } from '../../engine/themeEngine';

export interface StudioTopBarProps {
  project: ProjectData;
  canUndo: boolean;
  canRedo: boolean;
  scale: number;
  rotation: number;
  tracingRef: TracingReference | null;
  stabilizerLevel: number;
  showStrokeGuide: boolean;
  crashRecovery: { layerCount: number; timestamp: number } | null;
  onReturnToGallery: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onToggleFitOr100: () => void;
  onTriggerImportPhoto: () => void;
  onUpdateTracing: (partial: Partial<TracingReference>) => void;
  onToggleTracingVisibility: () => void;
  onChangeStabilizer: (level: number) => void;
  onToggleStrokeGuide: () => void;
  onResetRotation: () => void;
  onOpenExportModal: () => void;
  onOpenCanvasResizeModal?: () => void;
  onTriggerImportAccessory?: () => void;
  onOpenSettings?: () => void;
  onOpenRoadmap?: () => void;
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
  onReturnToGallery,
  onUndo,
  onRedo,
  onToggleFitOr100,
  onTriggerImportPhoto,
  onUpdateTracing,
  onToggleTracingVisibility,
  onChangeStabilizer,
  onToggleStrokeGuide,
  onResetRotation,
  onOpenExportModal,
  onOpenCanvasResizeModal,
  onTriggerImportAccessory,
  onOpenSettings,
  onOpenRoadmap,
  onRestoreCrash,
  onDismissCrash,
  triggerHaptic,
}) => {
  const theme = useAppTheme();
  const [showStabilizerMenu, setShowStabilizerMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  return (
    <>
      <header 
        role="banner" 
        aria-label="Barra de herramientas superior" 
        className="fixed top-0 left-0 right-0 z-30 h-12 bg-[#12131b]/95 backdrop-blur-md border-b border-[#222432] select-none pt-[env(safe-area-inset-top)] transition-colors overflow-hidden"
      >
        {/* Contenedor deslizable horizontalmente para móviles de cualquier tamaño */}
        <div className="w-full h-full overflow-x-auto no-scrollbar touch-pan-x overscroll-x-contain flex items-center px-1.5 sm:px-2">
          <div className="flex items-center justify-between gap-1 sm:gap-2 min-w-full shrink-0">
            {/* Lado Izquierdo: Volver a Galería, Deshacer y Rehacer */}
            <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
          <button
            type="button"
            onClick={() => {
              triggerHaptic(8);
              onReturnToGallery();
            }}
            aria-label="Ir a galería de proyectos"
            className="w-8 h-8 rounded-xl bg-[#191a22] hover:bg-[#232530] text-gray-300 hover:text-white border border-[#262835] flex items-center justify-center transition-all active:scale-95 shrink-0"
            title="Volver a Galería"
          >
            <ArrowLeft size={16} />
          </button>

          <button
            type="button"
            onClick={() => {
              if (canUndo) {
                triggerHaptic(6);
                onUndo();
              }
            }}
            disabled={!canUndo}
            aria-label="Deshacer trazo"
            className={`w-8 h-8 rounded-xl border flex items-center justify-center transition-all shrink-0 ${
              canUndo
                ? 'bg-[#191a22] hover:bg-[#232530] text-gray-200 hover:text-white border-[#262835] active:scale-95'
                : 'bg-[#14151c] text-gray-600 border-[#1d1f2a] cursor-not-allowed opacity-50'
            }`}
            title="Deshacer (Ctrl+Z)"
          >
            <Undo2 size={15} />
          </button>

          <button
            type="button"
            onClick={() => {
              if (canRedo) {
                triggerHaptic(6);
                onRedo();
              }
            }}
            disabled={!canRedo}
            aria-label="Rehacer trazo"
            className={`w-8 h-8 rounded-xl border flex items-center justify-center transition-all shrink-0 ${
              canRedo
                ? 'bg-[#191a22] hover:bg-[#232530] text-gray-200 hover:text-white border-[#262835] active:scale-95'
                : 'bg-[#14151c] text-gray-600 border-[#1d1f2a] cursor-not-allowed opacity-50'
            }`}
            title="Rehacer (Ctrl+Y)"
          >
            <Redo2 size={15} />
          </button>
        </div>

        {/* Centro: Indicador interactivo de Zoom/Rotación y Botón de Calco */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onToggleFitOr100}
            aria-label="Ajustar o centrar lienzo y enderezar rotación"
            className="h-8 px-2 rounded-full bg-[#181922] hover:bg-[#222430] border border-[#272937] text-xs font-mono font-bold active:scale-95 transition-all shadow-xs flex items-center gap-1 shrink-0"
            style={{ color: theme.accentTextHex }}
            title="Toca para ajustar o enderezar rotación a 0°"
          >
            <span>{Math.round(scale * 100)}%</span>
            {Math.round(rotation) !== 0 && (
              <span className="text-[10px] font-semibold" style={{ color: theme.accentColor }}>• {Math.round(rotation)}°</span>
            )}
          </button>

          {/* BOTÓN CALCO */}
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
                  ? 'text-black shadow-sm'
                  : ''
                : 'bg-[#191a22] hover:bg-[#232530] text-gray-300 border-[#262835]'
            }`}
            style={tracingRef ? (
              tracingRef.isAdjusting ? {
                backgroundColor: theme.accentColor,
                borderColor: theme.accentColor,
                color: '#000000',
              } : {
                backgroundColor: theme.accentSoft,
                borderColor: theme.accentBorder,
                color: theme.accentTextHex,
              }
            ) : undefined}
            title={tracingRef ? 'Calco activo (Toca para ajustar)' : 'Calcar foto de galería'}
          >
            <Camera size={13} style={{ color: tracingRef?.isAdjusting ? '#000000' : theme.accentColor }} />
            <span className="text-[11px]">Calco</span>
            {tracingRef && (
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: theme.accentColor }} />
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
                  : 'text-black shadow-sm'
              }`}
              style={!tracingRef.visible ? {
                backgroundColor: theme.accentColor,
                borderColor: theme.accentColor,
                color: '#000000',
              } : undefined}
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
                ? 'text-black font-bold'
                : 'bg-[#191a22] hover:bg-[#232530] border-[#262835]'
            }`}
            style={showStabilizerMenu ? {
              backgroundColor: theme.accentColor,
              borderColor: theme.accentColor,
              color: '#000000',
            } : {
              color: theme.accentColor,
            }}
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
                ? ''
                : 'bg-[#191a22] hover:bg-[#232530] text-gray-300 hover:text-white border-[#262835]'
            }`}
            style={(showMoreMenu || showStrokeGuide) ? {
              backgroundColor: theme.accentSoft,
              borderColor: theme.accentBorder,
              color: theme.accentTextHex,
            } : undefined}
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
            className="h-8 px-2.5 sm:px-3 rounded-xl text-black font-bold text-xs flex items-center gap-1.5 shadow-md shrink-0 active:scale-95 transition-all"
            style={{ 
              backgroundColor: theme.accentColor,
              boxShadow: `0 2px 10px ${theme.accentSoft25}`
            }}
            title="Guardar / Exportar Obra Maestra"
          >
            <Download size={14} className="stroke-[2.5]" />
            <span className="tracking-wide">Guardar</span>
          </button>
        </div>
          </div>
        </div>
      </header>

      {/* BANNER DE RECUPERACIÓN TRAS SALIDA ABRUPTA O CRASH */}
      {crashRecovery && (
        <aside
          aria-label="Aviso de dibujo recuperado de sesión anterior"
          className="fixed top-14 left-3 right-3 sm:left-1/2 sm:-translate-x-1/2 sm:max-w-md z-40 bg-[#191a24] border rounded-2xl p-2.5 shadow-2xl flex items-center justify-between gap-2.5 animate-in fade-in slide-in-from-top-2 backdrop-blur-md"
          style={{ borderColor: theme.accentBorder }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div 
              className="w-8 h-8 rounded-xl border flex items-center justify-center shrink-0"
              style={{ backgroundColor: theme.accentSoft, borderColor: theme.accentBorder, color: theme.accentColor }}
            >
              <Sparkles size={16} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold truncate" style={{ color: theme.accentTextHex }}>
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
              className="px-2.5 py-1.5 rounded-xl text-black text-xs font-bold shadow-sm active:scale-95 transition-all cursor-pointer"
              style={{ backgroundColor: theme.accentColor }}
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
                    ? 'text-black font-bold shadow-xs'
                    : 'text-gray-200 hover:bg-[#232530] active:scale-95'
                }`}
                style={stabilizerLevel === item.level ? {
                  backgroundColor: theme.accentColor,
                  color: '#000000',
                } : undefined}
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
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: theme.accentColor }}>
                Herramientas Pro
              </span>
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
                  ? 'text-black font-bold shadow-xs'
                  : 'text-gray-200 hover:bg-[#20222f]'
              }`}
              style={showStrokeGuide ? {
                backgroundColor: theme.accentColor,
                color: '#000000',
              } : undefined}
            >
              <Sparkles size={16} style={{ color: showStrokeGuide ? '#000000' : theme.accentColor }} />
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
              <RotateCcw size={16} style={{ color: theme.accentColor }} />
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
              <Maximize2 size={16} style={{ color: theme.accentColor }} />
              <div className="flex-1 min-w-0">
                <span className="block leading-tight">Expandir Hoja</span>
                <span className="text-[9px] text-gray-400 block font-mono">
                  {project.width} × {project.height} px • Añadir espacio
                </span>
              </div>
            </button>

            {/* Opción 3.5: Poner Accesorio de Galería (Moño, Sticker, etc.) */}
            {onTriggerImportAccessory && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(8);
                  setShowMoreMenu(false);
                  onTriggerImportAccessory();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-pink-200 hover:bg-[#20222f] active:scale-98 transition-all text-left"
              >
                <span className="text-base">🎀</span>
                <div className="flex-1 min-w-0">
                  <span className="block leading-tight font-bold text-pink-300">Poner Accesorio (Galería)</span>
                  <span className="text-[9px] text-gray-400 block">
                    Moño, sticker o adorno en tu obra
                  </span>
                </div>
              </button>
            )}

            <div className="h-px bg-[#262838] my-1" />

            {/* Opción 4: Ajustes de la App e Información */}
            {onOpenSettings && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(8);
                  setShowMoreMenu(false);
                  onOpenSettings();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-gray-200 hover:bg-[#20222f] active:scale-98 transition-all text-left"
              >
                <Settings size={16} style={{ color: theme.accentColor }} />
                <div className="flex-1 min-w-0">
                  <span className="block leading-tight font-bold text-white">Ajustes e Información</span>
                  <span className="text-[9px] text-gray-400 block">
                    Color del tema, WakeLock y motores
                  </span>
                </div>
              </button>
            )}

            {/* Opción 5: Planes para la App */}
            {onOpenRoadmap && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(8);
                  setShowMoreMenu(false);
                  onOpenRoadmap();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-gray-200 hover:bg-[#20222f] active:scale-98 transition-all text-left"
              >
                <Rocket size={16} style={{ color: theme.accentColor }} />
                <div className="flex-1 min-w-0">
                  <span className="block leading-tight font-bold" style={{ color: theme.accentTextHex }}>
                    Planes para la App
                  </span>
                  <span className="text-[9px] text-gray-400 block">
                    Mover trazos de vectores y novedades
                  </span>
                </div>
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
};
