/**
 * @file SettingsInfoScreen.tsx
 * @description Pantalla dedicada e independiente "Ajustes de la app e Información".
 * 
 * Contiene opciones para:
 * - Personalización del color y tema de la app (conduce a una pantalla dedicada al pulsar).
 * - Acceso a los Planes para la app (Hoja de ruta y mover trazos vectoriales).
 * - Preferencias táctiles y de pantalla activa.
 * - Información técnica de los motores C++23, Kotlin, Rust, SQLite OPFS y WebGPU.
 * - Versión estable de la aplicación (v1.0.0 estable).
 */

import React, { useState } from 'react';
import { 
  ArrowLeft, Palette, Rocket, Cpu, Vibrate, 
  Info, ChevronRight, HardDrive, Smartphone, Sliders 
} from 'lucide-react';
import { useAppTheme } from '../../engine/themeEngine';

interface SettingsInfoScreenProps {
  onReturnToStudio: () => void;
  onGoToThemeCustomization: () => void;
  onGoToRoadmap: () => void;
  onGoToEngine: () => void;
  onGoToGallery?: () => void;
}

export const SettingsInfoScreen: React.FC<SettingsInfoScreenProps> = ({
  onReturnToStudio,
  onGoToThemeCustomization,
  onGoToRoadmap,
  onGoToEngine,
  onGoToGallery,
}) => {
  const activeTheme = useAppTheme();
  const [hapticEnabled, setHapticEnabled] = useState<boolean>(() => {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('inkflow_haptic') !== 'false';
    }
    return true;
  });

  const triggerHaptic = (ms = 10) => {
    if (hapticEnabled && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate(ms); } catch {}
    }
  };

  const toggleHaptic = () => {
    const next = !hapticEnabled;
    setHapticEnabled(next);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('inkflow_haptic', String(next));
    }
    if (next) triggerHaptic(15);
  };

  return (
    <div 
      className="w-full h-full h-[100dvh] max-h-[100dvh] overflow-y-auto overflow-x-hidden touch-pan-y overscroll-y-contain bg-[#0e1017] text-[#e5e7eb] flex flex-col"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {/* Barra superior de navegación: Diseño ergonómico adaptado a pantallas móviles */}
      <header className="h-14 sm:h-16 px-3 sm:px-6 bg-[#151722] border-b border-[#252836] flex items-center justify-between sticky top-0 z-20 shadow-md shrink-0 gap-2">
        <button
          onClick={() => {
            triggerHaptic(8);
            onReturnToStudio();
          }}
          aria-label="Volver al Lienzo"
          className="h-9 px-2.5 sm:px-3 rounded-xl bg-[#1f2230] hover:bg-[#282b3d] text-gray-200 border border-[#2e3246] transition-colors flex items-center gap-1.5 text-xs font-semibold active:scale-95 shrink-0"
        >
          <ArrowLeft size={16} />
          <span>Volver</span>
        </button>

        <h1 className="text-xs sm:text-sm md:text-base font-bold text-white truncate flex-1 text-center min-w-0 px-1">
          Ajustes de la App e Información
        </h1>

        <div className="shrink-0 flex items-center gap-1.5">
          <span 
            className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: activeTheme.accentSoft, color: activeTheme.accentColor }}
          >
            v1.0.0 estable
          </span>
          {onGoToGallery && (
            <button
              onClick={() => {
                triggerHaptic(8);
                onGoToGallery();
              }}
              className="py-1 px-2 rounded-lg bg-[#1f2230] text-gray-300 border border-[#2e3246] text-[11px] font-medium hidden md:inline-flex"
            >
              Mis Obras
            </button>
          )}
        </div>
      </header>

      {/* Contenido principal */}
      <main className="flex-1 p-4 sm:p-6 max-w-2xl mx-auto w-full space-y-5 pb-12">
        {/* SECCIÓN 1: PERSONALIZACIÓN VISUAL (LLEVA A OTRO APARTADO) */}
        <section className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <Palette size={14} style={{ color: activeTheme.accentColor }} />
              <span>Personalización Visual</span>
            </h2>
            <span 
              className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md"
              style={{ backgroundColor: activeTheme.accentSoft, color: activeTheme.accentColor }}
            >
              Tema: {activeTheme.name.split(' ')[0]}
            </span>
          </div>

          {/* Tarjeta interactiva: Al tocarla lleva a la pantalla dedicada de temas */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic(10);
              onGoToThemeCustomization();
            }}
            className="w-full bg-[#151722] hover:bg-[#1b1e2c] border border-[#282c3e] hover:border-gray-500 rounded-2xl p-4 sm:p-4.5 flex items-center justify-between gap-3 text-left transition-all active:scale-98 shadow-md group"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div 
                className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg text-black shadow-md shrink-0 transition-transform group-hover:scale-105"
                style={{ backgroundColor: activeTheme.accentColor }}
              >
                {activeTheme.emoji}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white block truncate">
                    Cambiar Color y Tema de la App
                  </h3>
                  <span 
                    className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase shrink-0"
                    style={{ backgroundColor: activeTheme.accentSoft, color: activeTheme.accentColor }}
                  >
                    {activeTheme.name.split(' ')[0]}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">
                  {activeTheme.tagline}
                </p>
                <span 
                  className="text-[10px] font-semibold block mt-1"
                  style={{ color: activeTheme.accentColor }}
                >
                  👉 Toca para abrir el catálogo completo de colores
                </span>
              </div>
            </div>

            <div className="w-8 h-8 rounded-xl bg-[#202334] flex items-center justify-center text-gray-300 group-hover:text-white shrink-0">
              <ChevronRight size={18} />
            </div>
          </button>
        </section>

        {/* SECCIÓN 2: PLANES PARA LA APP (HOJA DE RUTA) */}
        <section className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <Rocket size={14} style={{ color: activeTheme.accentColor }} />
              <span>Futuro del Proyecto</span>
            </h2>
            <span 
              className="text-[10px] px-2 py-0.5 rounded-full font-bold"
              style={{ backgroundColor: activeTheme.accentSoft, color: activeTheme.accentColor }}
            >
              Hoja de Ruta
            </span>
          </div>

          {/* Tarjeta interactiva: Al tocarla lleva a la pantalla de planes */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic(10);
              onGoToRoadmap();
            }}
            className="w-full bg-[#151722] hover:bg-[#1b1e2c] border border-[#282c3e] rounded-2xl p-4 sm:p-4.5 flex items-center justify-between gap-3 text-left transition-all active:scale-98 shadow-md group"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div 
                className="w-12 h-12 rounded-2xl border flex items-center justify-center font-bold text-lg shrink-0 transition-transform group-hover:scale-105"
                style={{ 
                  backgroundColor: activeTheme.accentSoft, 
                  borderColor: activeTheme.accentBorder,
                  color: activeTheme.accentColor 
                }}
              >
                🚀
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white block truncate">
                    Planes para la App
                  </h3>
                  <span 
                    className="text-[9px] px-1.5 py-0.5 rounded-full font-extrabold uppercase text-black"
                    style={{ backgroundColor: activeTheme.accentColor }}
                  >
                    Próximamente
                  </span>
                </div>
                <p className="text-xs text-gray-300 mt-0.5 line-clamp-1">
                  Mover trazos vectoriales, edición Bézier, Difuminador WebGPU y Time-lapse.
                </p>
                <span 
                  className="text-[10px] font-semibold block mt-1"
                  style={{ color: activeTheme.accentColor }}
                >
                  👉 Toca para explorar todas las próximas funciones
                </span>
              </div>
            </div>

            <div className="w-8 h-8 rounded-xl bg-[#202334] flex items-center justify-center text-gray-300 group-hover:text-white shrink-0">
              <ChevronRight size={18} />
            </div>
          </button>
        </section>

        {/* SECCIÓN 3: PREFERENCIAS DE ESTUDIO TÁCTIL */}
        <section className="space-y-2">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1 flex items-center gap-1.5">
            <Sliders size={14} className="text-blue-400" />
            <span>Preferencias de Dibujo y Móvil</span>
          </h2>

          <div className="bg-[#141620] border border-[#252838] rounded-2xl p-3.5 sm:p-4 divide-y divide-[#222534] shadow-md">
            {/* Opción Háptica */}
            <div className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div 
                  className="p-2 rounded-xl shrink-0"
                  style={{ backgroundColor: activeTheme.accentSoft, color: activeTheme.accentColor }}
                >
                  <Vibrate size={18} />
                </div>
                <div>
                  <span className="text-xs font-bold text-gray-200 block">Respuesta Háptica al Tacto</span>
                  <span className="text-[10px] text-gray-400 block">
                    Micro-vibración en botones, herramientas y presets
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={toggleHaptic}
                className="w-12 h-6 rounded-full transition-colors p-0.5 flex items-center shrink-0"
                style={{ 
                  backgroundColor: hapticEnabled ? activeTheme.accentColor : '#374151',
                  justifyContent: hapticEnabled ? 'flex-end' : 'flex-start'
                }}
              >
                <div className="w-5 h-5 rounded-full bg-black shadow-md" />
              </button>
            </div>

            {/* Pantalla encendida permanente (WakeLock) */}
            <div className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-xl bg-[#202230] text-green-400 shrink-0">
                  <Smartphone size={18} />
                </div>
                <div>
                  <span className="text-xs font-bold text-gray-200 block">Pantalla Siempre Encendida (WakeLock)</span>
                  <span className="text-[10px] text-gray-400 block">
                    Evita que tu teléfono atenúe el brillo o se bloquee al dibujar o calcar
                  </span>
                </div>
              </div>

              <span className="text-[10px] font-mono font-bold text-green-400 bg-green-950/50 border border-green-500/40 px-2 py-0.5 rounded-full">
                Activo
              </span>
            </div>

            {/* Almacenamiento masivo SQLite OPFS */}
            <div className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-xl bg-[#202230] text-purple-400 shrink-0">
                  <HardDrive size={18} />
                </div>
                <div>
                  <span className="text-xs font-bold text-gray-200 block">Base de Datos SQLite Wasm (OPFS)</span>
                  <span className="text-[10px] text-gray-400 block">
                    Almacenamiento nativo privado en el teléfono sin cuotas de 5MB
                  </span>
                </div>
              </div>

              <span className="text-[10px] font-mono font-bold text-purple-300 bg-purple-950/50 border border-purple-500/40 px-2 py-0.5 rounded-full">
                ACID
              </span>
            </div>
          </div>
        </section>

        {/* SECCIÓN 4: DIAGNÓSTICO TÉCNICO DE NÚCLEOS */}
        <section className="space-y-2">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1 flex items-center gap-1.5">
            <Cpu size={14} style={{ color: activeTheme.accentColor }} />
            <span>Arquitectura y Motores</span>
          </h2>

          <button
            type="button"
            onClick={() => {
              triggerHaptic(8);
              onGoToEngine();
            }}
            className="w-full bg-[#151722] hover:bg-[#1b1e2c] border border-[#282c3e] rounded-2xl p-4 flex items-center justify-between gap-3 text-left transition-all active:scale-98 shadow-md"
          >
            <div className="flex items-center gap-3">
              <div 
                className="p-2.5 rounded-xl border"
                style={{ 
                  backgroundColor: activeTheme.accentSoft, 
                  borderColor: activeTheme.accentBorder,
                  color: activeTheme.accentColor 
                }}
              >
                <Cpu size={20} />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-white">
                  Diagnóstico Técnico del Motor Gráfico
                </h3>
                <p className="text-[11px] text-gray-400">
                  Inspeccionar WebGPU WGSL, Wasm C++23, Rust RLE y Kotlin corrutinas 240Hz
                </p>
              </div>
            </div>

            <ChevronRight size={18} className="text-gray-400" />
          </button>
        </section>

        {/* SECCIÓN 5: INFORMACIÓN DE VERSIÓN Y ARQUITECTURA (SIN LICENCIA MIT) */}
        <section className="bg-[#12141c] border border-[#222432] rounded-2xl p-4 space-y-2.5 text-xs text-gray-400">
          <div className="flex items-center justify-between border-b border-[#222534] pb-2">
            <div className="flex items-center gap-1.5 font-bold text-gray-200">
              <Info size={15} style={{ color: activeTheme.accentColor }} />
              <span>InkFlow Studio PWA</span>
            </div>
            <span 
              className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: activeTheme.accentSoft, color: activeTheme.accentColor }}
            >
              v1.0.0 estable
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <span className="text-gray-500 block">Versión:</span>
              <span className="text-white font-mono font-bold">v1.0.0 estable</span>
            </div>
            <div>
              <span className="text-gray-500 block">Arquitectura:</span>
              <span className="text-gray-300 font-mono">PWA Standalone (Wasm + WebGPU)</span>
            </div>
            <div>
              <span className="text-gray-500 block">Núcleo Vectorial:</span>
              <span className="text-gray-300 font-mono">C++23 (ISO/IEC 14882:2023)</span>
            </div>
            <div>
              <span className="text-gray-500 block">Concurrencia:</span>
              <span className="text-gray-300 font-mono">kotlinx.coroutines 240Hz</span>
            </div>
          </div>

          <div className="pt-2 border-t border-[#222534] flex items-center justify-between text-[10px] text-gray-500">
            <span>Diseñada exclusivamente para teléfonos móviles</span>
            <span className="text-green-400 font-bold">100% Offline y Privada</span>
          </div>
        </section>
      </main>
    </div>
  );
};
