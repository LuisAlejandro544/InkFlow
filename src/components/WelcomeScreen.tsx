/**
 * @file WelcomeScreen.tsx
 * @description Pantalla de bienvenida y presentación para InkFlow Studio.
 * Se muestra cuando se detecta un navegador web estándar en lugar de la PWA instalada,
 * presentando todas las capacidades del motor (Kotlin/Wasm, WebGPU, C++23, Calco con Visión Artificial)
 * y ofreciendo un botón destacado para instalar la PWA en la pantalla de inicio,
 * junto con la opción de entrar al estudio directamente en el navegador con excepción para entornos de desarrollo.
 */

import React, { useState } from 'react';
import { 
  Sparkles, Download, Smartphone, ArrowRight, PenTool, 
  Layers, ShieldCheck, WifiOff, Camera, Cpu, Move, Check, 
  Share, X, Globe, Eye, Maximize2, Zap
} from 'lucide-react';
import { usePWAInstall } from './usePWAInstall';

interface WelcomeScreenProps {
  onEnterStudio: () => void;
  onGoToGallery?: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onEnterStudio,
  onGoToGallery,
}) => {
  const { isInstallable, isInstalled, isIOS, isDevOrPreview, install } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSModal(true);
      return;
    }
    const success = await install();
    if (success) {
      setInstallSuccess(true);
    } else if (!isInstallable) {
      // Si el navegador no permite beforeinstallprompt programático, mostrar guía directa
      alert('Para instalar en Android:\n1. Pulsa en los 3 puntos superiores del navegador (⋮)\n2. Selecciona "Instalar aplicación" o "Añadir a la pantalla de inicio".');
    }
  };

  return (
    <div className="min-h-screen min-h-[100dvh] bg-[#0c0d12] text-[#e5e7eb] flex flex-col font-sans selection:bg-amber-500 selection:text-black">
      
      {/* 1. BARRA SUPERIOR ELEGANTE */}
      <header className="h-14 px-4 sm:px-6 bg-[#12131a]/90 backdrop-blur-md border-b border-[#20222f] flex items-center justify-between sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-2.5">
          <img
            src="/icon.svg"
            alt="InkFlow Studio"
            className="w-8 h-8 rounded-xl shadow-md shadow-amber-500/20 object-contain"
          />
          <div>
            <h1 className="text-sm font-bold text-white tracking-wide flex items-center gap-1.5">
              <span>InkFlow Studio</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                PWA
              </span>
            </h1>
          </div>
        </div>

        {/* Botón rápido para entrar al estudio */}
        <button
          onClick={onEnterStudio}
          className="h-9 px-3.5 rounded-xl bg-[#1c1d27] hover:bg-[#252735] text-amber-400 border border-[#2c2f42] text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition-all shadow-xs"
        >
          <span>Entrar al Estudio</span>
          <ArrowRight size={14} />
        </button>
      </header>

      {/* 2. CONTENIDO PRINCIPAL */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-6 pb-28 flex flex-col gap-8">
        
        {/* BANNER DE DETECCIÓN Y EXCEPCIÓN DE ENTORNO */}
        <div className="rounded-2xl p-4 bg-[#141520] border border-[#27293a] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30 shrink-0">
              <Globe size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Navegador Web Detectado
                </span>
                {isDevOrPreview && (
                  <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/40">
                    Vista Previa / Dev
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                {isDevOrPreview ? (
                  <span>
                    <strong>Excepción activa:</strong> En este entorno de previsualización no se requiere instalar la PWA. Puedes probar el estudio de inmediato o instalarla en tu teléfono.
                  </span>
                ) : (
                  <span>
                    Estás navegando en la web. Para disfrutar del lienzo a pantalla completa sin barras del navegador y con respuesta táctil nativa, te recomendamos instalar la <strong>PWA en tu pantalla de inicio</strong>.
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* HERO SECTION DE PRESENTACIÓN */}
        <div className="text-center flex flex-col items-center gap-4 pt-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-medium">
            <Sparkles size={14} className="text-amber-400" />
            <span>Suite de Ilustración Digital de Alto Rendimiento</span>
          </div>

          <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight max-w-2xl leading-tight">
            Dibuja con la precisión de una app nativa, directo en tu teléfono.
          </h2>

          <p className="text-sm sm:text-base text-gray-300 max-w-xl leading-relaxed">
            InkFlow Studio combina un <strong>Lápiz Vectorial en Kotlin/Wasm</strong> (con cero píxeles al hacer zoom), shaders acelerados por <strong>WebGPU</strong>, análisis de grosor por <strong>visión artificial en C++23</strong> y gestos multitáctiles con tus propios dedos.
          </p>

          {/* BOTONES PRINCIPALES HERO */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto pt-2">
            <button
              onClick={handleInstallClick}
              disabled={isInstalled || installSuccess}
              className={`w-full sm:w-auto px-6 py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2.5 shadow-xl transition-all active:scale-95 ${
                isInstalled || installSuccess
                  ? 'bg-emerald-600 text-white cursor-default'
                  : 'bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-black shadow-amber-500/20'
              }`}
            >
              {isInstalled || installSuccess ? (
                <>
                  <Check size={18} className="stroke-[3]" />
                  <span>¡PWA Instalada en Pantalla de Inicio!</span>
                </>
              ) : (
                <>
                  <Download size={18} className="stroke-[2.5]" />
                  <span>Instalar PWA en Pantalla de Inicio</span>
                </>
              )}
            </button>

            <button
              onClick={onEnterStudio}
              className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-[#191b26] hover:bg-[#232534] text-white border border-[#2e3146] font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md"
            >
              <PenTool size={16} className="text-amber-400" />
              <span>Continuar en el Navegador</span>
            </button>
          </div>
        </div>

        {/* COMPARATIVA: NAVEGADOR WEB VS PWA NATIVA */}
        <div className="bg-[#13141e] border border-[#222434] rounded-3xl p-5 sm:p-6 shadow-xl">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
            <Maximize2 size={16} className="text-amber-400" />
            <span>¿Por qué instalar InkFlow Studio como PWA?</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Tarjeta Web Tradicional */}
            <div className="bg-[#181926]/60 border border-[#26283b] rounded-2xl p-4 flex flex-col gap-2.5">
              <div className="flex items-center gap-2 text-gray-400">
                <Globe size={16} />
                <h4 className="text-xs font-bold text-gray-300">En Navegador Web Normal</h4>
              </div>
              <ul className="text-xs text-gray-400 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-red-400 font-bold shrink-0">✕</span>
                  <span>La barra superior de URL roba espacio útil de dibujo.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400 font-bold shrink-0">✕</span>
                  <span>Riesgo de recargar la página por gestos accidentales del navegador.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400 font-bold shrink-0">✕</span>
                  <span>Sin icono directo en tu pantalla de aplicaciones.</span>
                </li>
              </ul>
            </div>

            {/* Tarjeta PWA Nativa */}
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex flex-col gap-2.5">
              <div className="flex items-center gap-2 text-amber-400">
                <Smartphone size={16} />
                <h4 className="text-xs font-bold text-amber-300">Como PWA Nativa Instalada</h4>
              </div>
              <ul className="text-xs text-gray-300 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 font-bold shrink-0">✓</span>
                  <span><strong>100% Pantalla Completa:</strong> Toda la pantalla se convierte en lienzo de dibujo.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 font-bold shrink-0">✓</span>
                  <span><strong>Botones siempre visibles:</strong> Dock de herramientas inferior al alcance del pulgar.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 font-bold shrink-0">✓</span>
                  <span><strong>Acceso Directo:</strong> Icono nativo en tu pantalla de inicio y launcher.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 font-bold shrink-0">✓</span>
                  <span><strong>100% Offline:</strong> Abre y dibuja en cualquier lugar sin internet.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* CATÁLOGO DE FUNCIONALIDADES (7 PILARES DE LA APP) */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold text-white tracking-wide">
              Todo lo que ofrece InkFlow Studio
            </h3>
            <span className="text-xs text-amber-400 font-mono font-bold">7 Pilares Pro</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            
            {/* 1. Lápiz Vectorial Kotlin/Wasm */}
            <div className="bg-[#151622] border border-[#252738] rounded-2xl p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  <Zap size={16} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Lápiz Vectorial (Kotlin/Wasm)</h4>
                  <span className="text-[10px] text-amber-300/80 font-mono">Cero píxeles al hacer zoom</span>
                </div>
              </div>
              <p className="text-xs text-gray-300 leading-relaxed">
                Trazos matemáticos analíticos basados en curvas Bézier cúbicas con continuidad C1. Al acercar el zoom al 200%, 400% o 600%, la línea se reevalúa en WebAssembly sin pixelación alguna.
              </p>
            </div>

            {/* 2. Asistente Real de Grosor de Trazo (C++23) */}
            <div className="bg-[#151622] border border-[#252738] rounded-2xl p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  <Cpu size={16} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Asistente Real de Grosor (C++23)</h4>
                  <span className="text-[10px] text-amber-300/80 font-mono">Calibrado por Visión Artificial</span>
                </div>
              </div>
              <p className="text-xs text-gray-300 leading-relaxed">
                Mide automáticamente la distribución real de líneas en la foto de calco mediante percentiles: Silueta (P92), Estructura (P68), Detalles (P38) y Tramas (P12). Adopta grosores ideales en 1 toque.
              </p>
            </div>

            {/* 3. Modo Calco Ergonómico */}
            <div className="bg-[#151622] border border-[#252738] rounded-2xl p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  <Camera size={16} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Modo Calco con Filtros Wasm</h4>
                  <span className="text-[10px] text-amber-300/80 font-mono">Panel minimizable y extracción Sobel</span>
                </div>
              </div>
              <p className="text-xs text-gray-300 leading-relaxed">
                Importa fotos de la galería para calcar. El panel se minimiza a una micro-píldora para despejar el 100% del lienzo, con botón directo <code className="text-amber-300 font-mono">[👁️]</code> para comparar tus líneas limpias.
              </p>
            </div>

            {/* 4. Gestos Multitáctiles con Dedos */}
            <div className="bg-[#151622] border border-[#252738] rounded-2xl p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  <Move size={16} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Gestos Multitáctiles con tus Dedos</h4>
                  <span className="text-[10px] text-amber-300/80 font-mono">Pinch, Paneo y Rotación Magnética</span>
                </div>
              </div>
              <p className="text-xs text-gray-300 leading-relaxed">
                Pellizca con 2 dedos para zoom focal, rota libremente la hoja con snapping a 0°, 90°, 180° y 270°, y alterna en 1 toque entre Modo Dibujo y Modo Mover con 1 dedo.
              </p>
            </div>

            {/* 5. Pipeline WebGPU y Shaders WGSL */}
            <div className="bg-[#151622] border border-[#252738] rounded-2xl p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  <Sparkles size={16} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">WebGPU & Estabilizador S-Form</h4>
                  <span className="text-[10px] text-amber-300/80 font-mono">Shaders de sellos y anti-temblor</span>
                </div>
              </div>
              <p className="text-xs text-gray-300 leading-relaxed">
                Shaders acelerados por GPU para dinámicas de presión y modos de fusión de capas (Multiplicar, Pantalla, Superponer, Añadir), complementados con estabilizador exponencial S-Form (niveles 0 a 10).
              </p>
            </div>

            {/* 6. Capas Profesionales y Auto-Crop */}
            <div className="bg-[#151622] border border-[#252738] rounded-2xl p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  <Layers size={16} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Capas y Guardado con Auto-Crop</h4>
                  <span className="text-[10px] text-amber-300/80 font-mono">Estimación de peso exacto en KB/MB</span>
                </div>
              </div>
              <p className="text-xs text-gray-300 leading-relaxed">
                Gestión de capas estilo IbisPaint y modal de guardado que permite elegir entre Hoja Completa o Auto-Crop inteligente de los trazos reales, guardando directo en la galería con Web Share API.
              </p>
            </div>

            {/* 7. Privacidad y Funcionamiento 100% Offline */}
            <div className="bg-[#151622] border border-[#252738] rounded-2xl p-4 flex flex-col gap-2 sm:col-span-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <ShieldCheck size={16} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">100% Offline, Seguro y Privado</h4>
                  <span className="text-[10px] text-emerald-300/80 font-mono">Cero anuncios • Cero suscripciones • Sin servidores externos</span>
                </div>
              </div>
              <p className="text-xs text-gray-300 leading-relaxed">
                Tus dibujos se almacenan localmente en el almacenamiento del dispositivo. La app no envía tus obras a ningún servidor externo, no contiene rastreadores ni suscripciones mensuales abusivas.
              </p>
            </div>

          </div>
        </div>

      </main>

      {/* 3. BARRA INFERIOR STICKY (Siempre al alcance del pulgar) */}
      <footer className="fixed bottom-0 inset-x-0 p-3 bg-[#111218]/95 backdrop-blur-lg border-t border-[#20222f] z-30 flex items-center justify-center gap-3">
        <button
          onClick={handleInstallClick}
          disabled={isInstalled || installSuccess}
          className={`flex-1 max-w-xs h-12 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all ${
            isInstalled || installSuccess
              ? 'bg-emerald-600 text-white cursor-default'
              : 'bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-black shadow-amber-500/20'
          }`}
        >
          {isInstalled || installSuccess ? (
            <>
              <Check size={16} className="stroke-[3]" />
              <span>PWA Ya Instalada</span>
            </>
          ) : (
            <>
              <Download size={16} className="stroke-[2.5]" />
              <span>Instalar PWA</span>
            </>
          )}
        </button>

        <button
          onClick={onEnterStudio}
          className="flex-1 max-w-xs h-12 rounded-xl bg-[#1d1f2b] hover:bg-[#262838] text-white border border-[#2e3146] font-bold text-xs sm:text-sm flex items-center justify-center gap-2 active:scale-95 transition-all"
        >
          <PenTool size={16} className="text-amber-400" />
          <span>Entrar al Estudio</span>
        </button>
      </footer>

      {/* MODAL DE GUÍA PARA IOS SAFARI */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-[#181922] border border-[#2e313f] rounded-3xl p-5 max-w-sm w-full text-white shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[#272935] pb-2">
              <div className="flex items-center gap-2 text-amber-400">
                <Smartphone size={20} />
                <h3 className="font-bold text-base">Instalar en iPhone / iPad</h3>
              </div>
              <button
                onClick={() => setShowIOSModal(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            <div className="text-xs space-y-2.5 text-gray-300">
              <p>1. Pulsa el botón <strong>Compartir</strong> (icono <Share size={13} className="inline text-amber-400" />) en la barra de Safari.</p>
              <p>2. Desplázate hacia abajo y selecciona <strong>"Añadir a la pantalla de inicio"</strong>.</p>
              <p>3. Pulsa <strong>"Añadir"</strong> en la esquina superior derecha.</p>
              <p className="text-amber-400 pt-1 font-semibold">¡Listo! La app se ejecutará a pantalla completa como una app nativa.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowIOSModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs active:scale-95 transition-transform"
              >
                Entendido
              </button>
              <button
                onClick={() => {
                  setShowIOSModal(false);
                  onEnterStudio();
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#232532] text-white font-bold text-xs active:scale-95 transition-transform"
              >
                Probar en la Web
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
