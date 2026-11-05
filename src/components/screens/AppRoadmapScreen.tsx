/**
 * @file AppRoadmapScreen.tsx
 * @description Pantalla dedicada e independiente "Planes para la app" (Hoja de Ruta de Desarrollo).
 * 
 * Explica en profundidad las próximas funcionalidades del Lápiz Vectorial analítico
 * (mover trazos, edición de nodos Bézier, re-escalado no destructivo, lazo vectorial)
 * y las próximas fases del motor de ilustración digital InkFlow Studio.
 */

import React from 'react';
import { 
  ArrowLeft, Sparkles, Move, Scissors, Sliders, Layers, 
  Video, Droplets, CheckCircle2, Rocket, Clock, Package 
} from 'lucide-react';
import { useAppTheme } from '../../engine/themeEngine';

interface AppRoadmapScreenProps {
  onReturnToPrevious: () => void;
  onGoToStudio?: () => void;
}

export const AppRoadmapScreen: React.FC<AppRoadmapScreenProps> = ({
  onReturnToPrevious,
  onGoToStudio,
}) => {
  const theme = useAppTheme();

  const triggerHaptic = (ms = 10) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate(ms); } catch {}
    }
  };

  return (
    <div 
      className="w-full h-full h-[100dvh] max-h-[100dvh] overflow-y-auto overflow-x-hidden touch-pan-y overscroll-y-contain bg-[#0e1017] text-[#e5e7eb] flex flex-col"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {/* Barra superior de navegación adaptada a móvil */}
      <header className="h-14 sm:h-16 px-3 sm:px-6 bg-[#151722] border-b border-[#252836] flex items-center justify-between sticky top-0 z-20 shadow-md shrink-0 gap-2">
        <button
          onClick={() => {
            triggerHaptic(8);
            onReturnToPrevious();
          }}
          aria-label="Volver"
          className="h-9 px-2.5 sm:px-3 rounded-xl bg-[#1f2230] hover:bg-[#282b3d] text-gray-200 border border-[#2e3246] transition-colors flex items-center gap-1.5 text-xs font-semibold active:scale-95 shrink-0"
        >
          <ArrowLeft size={16} />
          <span>Volver</span>
        </button>

        <div className="flex items-center gap-1.5 min-w-0">
          <Rocket size={16} style={{ color: theme.accentColor }} />
          <h1 className="text-xs sm:text-sm md:text-base font-bold text-white truncate">Planes para la App</h1>
        </div>

        <span 
          className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full shrink-0"
          style={{ backgroundColor: theme.accentSoft, color: theme.accentColor }}
        >
          v1.0.0 estable
        </span>
      </header>

      {/* Contenido principal */}
      <main className="flex-1 p-4 sm:p-6 max-w-2xl mx-auto w-full space-y-6 pb-12">
        {/* Banner de Presentación */}
        <div className="bg-[#141620] border border-[#252838] rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{ color: theme.accentColor }}>
            <Clock size={16} />
            <span>Hoja de Ruta Oficial • Próximas Versiones</span>
          </div>
          <h2 className="text-base sm:text-lg font-bold text-white">
            El Futuro de InkFlow Studio
          </h2>
          <p className="text-xs text-gray-400 leading-relaxed">
            Descubre las funciones profesionales de dibujo digital e ilustración que estamos preparando para transformar tu teléfono en una mesa de arte completa.
          </p>
        </div>

        {/* SECCIÓN 1: PRÓXIMAS FUNCIONES DE LA HERRAMIENTA DE VECTORES */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 border-b border-[#252838] pb-2">
            <div 
              className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm shrink-0"
              style={{ backgroundColor: theme.accentSoft, color: theme.accentColor }}
            >
              ✏️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">
                  Próximamente: Superpoderes en la Herramienta de Vectores
                </h3>
                <span 
                  className="text-[9px] text-black px-1.5 py-0.2 rounded font-extrabold uppercase shrink-0"
                  style={{ backgroundColor: theme.accentColor }}
                >
                  En Desarrollo
                </span>
              </div>
              <p className="text-[11px] text-gray-400">
                Evolución del Lápiz Vectorial analítico C++23 y Kotlin
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {/* Función 1: Mover Trazos Individuales */}
            <div className="bg-[#151722] border border-[#272b3c] rounded-2xl p-4 space-y-2 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div 
                    className="p-2 rounded-xl shrink-0"
                    style={{ backgroundColor: theme.accentSoft, color: theme.accentColor }}
                  >
                    <Move size={18} />
                  </div>
                  <h4 className="text-xs font-bold text-white">1. Mover y Transformar Trazos Individuales</h4>
                </div>
                <span 
                  className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: theme.accentSoft, color: theme.accentColor }}
                >
                  Prioridad Alta
                </span>
              </div>
              <p className="text-xs text-gray-300 leading-relaxed">
                Próximamente podrás tocar cualquier trazo vectorial ya dibujado en el lienzo para moverlo de sitio con tu dedo, rotarlo o escalar su tamaño libremente sin alterar los trazos de alrededor y manteniendo la nitidez infinita sin pixelación.
              </p>
            </div>

            {/* Función 2: Edición de Nodos Bézier */}
            <div className="bg-[#151722] border border-[#272b3c] rounded-2xl p-4 space-y-2 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-purple-500/15 text-purple-400 border border-purple-500/30 shrink-0">
                    <Sliders size={18} />
                  </div>
                  <h4 className="text-xs font-bold text-white">2. Edición de Nodos y Tiradores Bézier</h4>
                </div>
                <span className="text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold px-2 py-0.5 rounded-full">
                  Control Total
                </span>
              </div>
              <p className="text-xs text-gray-300 leading-relaxed">
                Visualización interactiva de los puntos de anclaje de la curva Catmull-Rom/Bézier C1 en C++23. Podrás arrastrar los tiradores de curvatura para corregir una línea chueca, afinar esquinas o suavizar arcos con precisión milimétrica con tus dedos.
              </p>
            </div>

            {/* Función 3: Modificación No Destructiva de Color y Grosor */}
            <div className="bg-[#151722] border border-[#272b3c] rounded-2xl p-4 space-y-2 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shrink-0">
                    <Sparkles size={18} />
                  </div>
                  <h4 className="text-xs font-bold text-white">3. Cambio de Color y Grosor No Destructivo</h4>
                </div>
                <span className="text-[9px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold px-2 py-0.5 rounded-full">
                  Sin Redibujar
                </span>
              </div>
              <p className="text-xs text-gray-300 leading-relaxed">
                Al estar almacenados como ecuaciones matemáticas vectoriales en C++23 y Kotlin, podrás cambiar el color de una línea o engrosar/adelgazar el trazo mucho después de haberlo dibujado, sin tener que borrarlo ni empezar de nuevo.
              </p>
            </div>

            {/* Función 4: Lazo Vectorial y Selección Múltiple */}
            <div className="bg-[#151722] border border-[#272b3c] rounded-2xl p-4 space-y-2 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-pink-500/15 text-pink-400 border border-pink-500/30 shrink-0">
                    <Scissors size={18} />
                  </div>
                  <h4 className="text-xs font-bold text-white">4. Lazo de Selección Vectorial y Reubicación de Capas</h4>
                </div>
                <span className="text-[9px] bg-pink-500/20 text-pink-300 border border-pink-500/40 font-bold px-2 py-0.5 rounded-full">
                  Manga & Anime
                </span>
              </div>
              <p className="text-xs text-gray-300 leading-relaxed">
                Rodea un grupo de trazos con el lazo para moverlos juntos (ideal para reubicar ojos, bocas, mechones de pelo o ropa en ilustraciones) o mover trazos específicos a una nueva capa dedicada en 1 solo toque.
              </p>
            </div>
          </div>
        </section>

        {/* SECCIÓN 2: OTRAS HERRAMIENTAS EN PLANIFICACIÓN */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 border-b border-[#252838] pb-2">
            <div className="w-8 h-8 rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold text-sm shrink-0">
              🎨
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Nuevas Herramientas de Ilustración en Camino</h3>
              <p className="text-[11px] text-gray-400">Pinceles y capacidades audiovisuales</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Difuminador Húmedo */}
            <div className="bg-[#141622] border border-[#26293a] rounded-2xl p-4 flex flex-col justify-between gap-2 shadow-sm">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/30">
                  <Droplets size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Difuminador Húmedo (Smudge)</h4>
                  <span className="text-[10px] text-blue-400 font-mono">WebGPU Shader</span>
                </div>
              </div>
              <p className="text-[11px] text-gray-300 leading-relaxed">
                Mezclador de pintura que fusiona los colores adyacentes simulando pigmento húmedo real en tiempo real.
              </p>
            </div>

            {/* Time-lapse */}
            <div className="bg-[#141622] border border-[#26293a] rounded-2xl p-4 flex flex-col justify-between gap-2 shadow-sm">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-pink-500/15 text-pink-400 border border-pink-500/30">
                  <Video size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Grabador Time-lapse en Video</h4>
                  <span className="text-[10px] text-pink-400 font-mono">MP4 / WebM</span>
                </div>
              </div>
              <p className="text-[11px] text-gray-300 leading-relaxed">
                Grabación automática del proceso creativo para compartir videos acelerados de tu dibujo en TikTok, Instagram y YouTube Shorts.
              </p>
            </div>

            {/* Motor Headless en npm */}
            <div className="bg-[#141622] border border-[#26293a] rounded-2xl p-4 flex flex-col justify-between gap-2 shadow-sm sm:col-span-2">
              <div className="flex items-center gap-2.5">
                <div 
                  className="p-2 rounded-xl border"
                  style={{ backgroundColor: theme.accentSoft, borderColor: theme.accentBorder, color: theme.accentColor }}
                >
                  <Package size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Empaquetado Headless en npm (@inkflow/core)</h4>
                  <span className="text-[10px] font-mono" style={{ color: theme.accentColor }}>Biblioteca Núcleo</span>
                </div>
              </div>
              <p className="text-[11px] text-gray-300 leading-relaxed">
                Publicación del núcleo computacional (C++23, Rust, SQLite OPFS y Kotlin) como SDK agnóstico de UI para la comunidad de desarrolladores de pizarras y apps de notas.
              </p>
            </div>
          </div>
        </section>

        {/* SECCIÓN 3: LOGROS Y CAPACIDADES YA COMPLETADAS */}
        <section className="bg-[#12141c] border border-[#222432] rounded-3xl p-4 sm:p-5 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-green-400" />
            <h3 className="text-sm font-bold text-white">Logros Consolidados en Esta Versión</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-300">
            <div className="flex items-center gap-2 bg-[#171924] p-2.5 rounded-xl border border-[#272a3a]">
              <span className="text-green-400">✓</span>
              <span>Lápiz Vectorial analítico C++23 (Bézier C1)</span>
            </div>
            <div className="flex items-center gap-2 bg-[#171924] p-2.5 rounded-xl border border-[#272a3a]">
              <span className="text-green-400">✓</span>
              <span>Concurrencia kotlinx.coroutines (240Hz)</span>
            </div>
            <div className="flex items-center gap-2 bg-[#171924] p-2.5 rounded-xl border border-[#272a3a]">
              <span className="text-green-400">✓</span>
              <span>Persistencia masiva SQLite Wasm sobre OPFS</span>
            </div>
            <div className="flex items-center gap-2 bg-[#171924] p-2.5 rounded-xl border border-[#272a3a]">
              <span className="text-green-400">✓</span>
              <span>Wasm History Engine con RLE 32-bit (40 niveles)</span>
            </div>
            <div className="flex items-center gap-2 bg-[#171924] p-2.5 rounded-xl border border-[#272a3a]">
              <span className="text-green-400">✓</span>
              <span>Bote con Cierre de Huecos (0-10px) y Expansión</span>
            </div>
            <div className="flex items-center gap-2 bg-[#171924] p-2.5 rounded-xl border border-[#272a3a]">
              <span className="text-green-400">✓</span>
              <span>Catálogo de 9 Texturas estilo IbisPaint</span>
            </div>
            <div className="flex items-center gap-2 bg-[#171924] p-2.5 rounded-xl border border-[#272a3a]">
              <span className="text-green-400">✓</span>
              <span>Accesorios de Galería con Estampado en Capa</span>
            </div>
            <div className="flex items-center gap-2 bg-[#171924] p-2.5 rounded-xl border border-[#272a3a]">
              <span className="text-green-400">✓</span>
              <span>Guardado en Galería Real Android MediaStore</span>
            </div>
          </div>
        </section>

        {/* Footer con llamada a la acción */}
        {onGoToStudio && (
          <div className="text-center pt-2">
            <button
              onClick={() => {
                triggerHaptic(10);
                onGoToStudio();
              }}
              className="py-3 px-6 text-black font-bold text-sm rounded-2xl shadow-xl transition-all active:scale-95 inline-flex items-center gap-2"
              style={{ backgroundColor: theme.accentColor }}
            >
              <span>Volver a Dibujar en el Lienzo</span>
            </button>
          </div>
        )}
      </main>
    </div>
  );
};
