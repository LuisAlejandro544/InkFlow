/**
 * @file DiagnosticMonitorScreen.tsx
 * @description Pantalla dedicada e independiente "InkFlow Monitor & Debug Console".
 * 
 * Funcionalidades:
 * 1. Monitoreo en tiempo real de todos los logs, advertencias, errores y excepciones (JS, WebGPU, Wasm, Kotlin, Room).
 * 2. Visualización en vivo de métricas de memoria RAM física del dispositivo y estado de la JVM.
 * 3. Visor integrado del LogCat nativo de Android obtenido en caliente mediante el puente Kotlin.
 * 4. Botón táctil destacado de [📋 Copiar Reporte Completo] formateado para compartir o depurar desde el teléfono.
 * 5. Botón de [📤 Compartir] que despliega la hoja nativa de Android (WhatsApp, Telegram, Google Keep).
 * 6. Filtros por categorías (Todos, Errores, Advertencias, Android MediaStore/Room, Wasm/GPU, LogCat OS).
 * 7. Búsqueda instantánea de texto en mensajes y trazas de error (stack traces).
 * 8. Copia individual de errores específicos con un solo toque.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  ArrowLeft, Bug, Copy, Share2, Trash2, RefreshCw, 
  Check, AlertTriangle, AlertCircle, Info, Smartphone, 
  Cpu, HardDrive, Terminal, Search, X, ShieldAlert, Sparkles 
} from 'lucide-react';
import { 
  diagnosticHub, 
  DiagnosticLogItem, 
  DiagnosticLogLevel, 
  DeviceDiagnosticSpecs 
} from '../../engine/diagnosticLogHub';
import { useAppTheme } from '../../engine/themeEngine';

interface DiagnosticMonitorScreenProps {
  onReturnToStudio: () => void;
  onGoToSettings?: () => void;
}

type FilterCategory = 'all' | 'error' | 'warn' | 'native' | 'engine' | 'logcat';

export const DiagnosticMonitorScreen: React.FC<DiagnosticMonitorScreenProps> = ({
  onReturnToStudio,
  onGoToSettings,
}) => {
  const theme = useAppTheme();
  const [logs, setLogs] = useState<DiagnosticLogItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<FilterCategory>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedFull, setCopiedFull] = useState<boolean>(false);
  const [copiedItemIndex, setCopiedItemIndex] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [nativeLogcatText, setNativeLogcatText] = useState<string>('Cargando LogCat nativo...');
  const [specs, setSpecs] = useState<DeviceDiagnosticSpecs>(() => diagnosticHub.getDeviceSpecs());

  const triggerHaptic = (ms = 10) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate(ms); } catch {}
    }
  };

  // Suscribirse a nuevos eventos del buffer en tiempo real
  useEffect(() => {
    const unsubscribe = diagnosticHub.subscribe((newLogs) => {
      setLogs(newLogs);
    });
    setSpecs(diagnosticHub.getDeviceSpecs());
    return () => unsubscribe();
  }, []);

  // Cargar el LogCat nativo de Android
  const refreshLogcat = useCallback(async () => {
    setIsRefreshing(true);
    triggerHaptic(8);
    try {
      const cat = await diagnosticHub.getNativeLogcat(120);
      setNativeLogcatText(cat);
      setSpecs(diagnosticHub.getDeviceSpecs());
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    refreshLogcat();
  }, [refreshLogcat]);

  // Estadísticas cuantitativas
  const stats = useMemo(() => diagnosticHub.getStats(), [logs]);

  // Filtrar logs según categoría activa y texto de búsqueda
  const filteredLogs = useMemo(() => {
    return logs
      .filter((item) => {
        if (activeCategory === 'all') return true;
        if (activeCategory === 'logcat') return false;
        return item.level === activeCategory;
      })
      .filter((item) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          item.message.toLowerCase().includes(q) ||
          item.tag.toLowerCase().includes(q) ||
          (item.details && item.details.toLowerCase().includes(q)) ||
          (item.stack && item.stack.toLowerCase().includes(q))
        );
      })
      .reverse(); // Mostrar los más recientes primero
  }, [logs, activeCategory, searchQuery]);

  // Copiar todo el reporte completo al portapapeles
  const handleCopyFullReport = async () => {
    triggerHaptic(15);
    const ok = await diagnosticHub.copyFullReport();
    if (ok) {
      setCopiedFull(true);
      setTimeout(() => setCopiedFull(false), 2500);
    }
  };

  // Compartir mediante la hoja nativa de Android / Web Share API
  const handleShareReport = async () => {
    triggerHaptic(12);
    try {
      const text = await diagnosticHub.generateDiagnosticReport();
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({
          title: 'Reporte de Diagnóstico - InkFlow Studio',
          text,
        });
      } else {
        handleCopyFullReport();
      }
    } catch {
      // Ignorar cancelación del usuario
    }
  };

  // Copiar un error individual
  const handleCopySingleItem = async (item: DiagnosticLogItem) => {
    triggerHaptic(10);
    const formatted = `[${item.timeFormatted}] [${item.level.toUpperCase()}] [${item.tag}]\nMensaje: ${item.message}${item.details ? `\nDetalles: ${item.details}` : ''}${item.stack ? `\nStack:\n${item.stack}` : ''}`;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(formatted);
        setCopiedItemIndex(item.id);
        setTimeout(() => setCopiedItemIndex(null), 2000);
      }
    } catch {
      // Fallback
    }
  };

  const handleClear = () => {
    triggerHaptic(12);
    diagnosticHub.clear();
  };

  return (
    <div 
      className="w-full h-full h-[100dvh] max-h-[100dvh] overflow-y-auto overflow-x-hidden touch-pan-y overscroll-y-contain bg-[#0c0d13] text-[#e5e7eb] flex flex-col font-sans"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {/* 1. Header Fijo Nativo */}
      <header className="h-14 sm:h-16 px-3 sm:px-6 bg-[#13151f] border-b border-[#232635] flex items-center justify-between sticky top-0 z-30 shadow-lg shrink-0 gap-2">
        <button
          onClick={() => {
            triggerHaptic(8);
            onReturnToStudio();
          }}
          aria-label="Volver al Estudio"
          className="h-10 px-3 rounded-xl bg-[#1d1f2c] hover:bg-[#26293a] text-gray-200 border border-[#2d3043] transition-all flex items-center gap-1.5 text-xs font-semibold active:scale-95 shrink-0"
        >
          <ArrowLeft size={16} />
          <span>Volver</span>
        </button>

        <div className="flex items-center gap-2 min-w-0 flex-1 justify-center">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <h1 className="text-xs sm:text-sm md:text-base font-bold text-white truncate text-center">
            InkFlow Monitor (Debug & Errores)
          </h1>
          <span 
            className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md hidden sm:inline-block"
            style={{ backgroundColor: theme.accentSoft, color: theme.accentColor }}
          >
            DEBUG
          </span>
        </div>

        <div className="shrink-0 flex items-center gap-1.5">
          {onGoToSettings && (
            <button
              onClick={() => {
                triggerHaptic(8);
                onGoToSettings();
              }}
              className="h-9 px-2.5 rounded-xl bg-[#1d1f2c] text-gray-300 hover:text-white border border-[#2d3043] text-xs font-medium hidden md:inline-flex items-center"
            >
              Ajustes
            </button>
          )}
        </div>
      </header>

      {/* 2. Contenedor Principal */}
      <main className="flex-1 p-3 sm:p-5 max-w-3xl mx-auto w-full space-y-3.5 pb-16">
        
        {/* TARJETA DE ESTADO DEL SISTEMA Y HARDWARE (MÓVIL) */}
        <section className="bg-[#141622] border border-[#262939] rounded-2xl p-3.5 shadow-md space-y-2.5">
          <div className="flex items-center justify-between border-b border-[#222434] pb-2">
            <div className="flex items-center gap-2">
              <Smartphone size={16} style={{ color: theme.accentColor }} />
              <span className="text-xs font-bold text-gray-200">
                {specs.androidMemoryInfo?.deviceModel || 'Dispositivo Móvil'} • Android {specs.androidMemoryInfo?.androidRelease || ''} (API {specs.androidMemoryInfo?.androidSdk || 'Web'})
              </span>
            </div>
            <span 
              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                specs.nativeBridgeAvailable ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-500/40' : 'bg-amber-950/70 text-amber-300 border border-amber-500/40'
              }`}
            >
              {specs.isTauri ? 'APK Tauri v2' : 'PWA Standalone'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-[11px]">
            <div className="bg-[#0f1019] p-2 rounded-xl border border-[#212332]">
              <span className="text-[10px] text-gray-400 block font-medium">RAM Disponible</span>
              <span className="text-xs font-mono font-bold text-emerald-400">
                {specs.androidMemoryInfo?.availMemMB ? `${specs.androidMemoryInfo.availMemMB} MB` : 'Disponible'}
              </span>
            </div>

            <div className="bg-[#0f1019] p-2 rounded-xl border border-[#212332]">
              <span className="text-[10px] text-gray-400 block font-medium">Puente Nativo</span>
              <span className={`text-xs font-mono font-bold ${specs.nativeBridgeAvailable ? 'text-green-400' : 'text-red-400'}`}>
                {specs.nativeBridgeAvailable ? 'Conectado ✅' : 'No inyectado'}
              </span>
            </div>

            <div className="bg-[#0f1019] p-2 rounded-xl border border-[#212332]">
              <span className="text-[10px] text-gray-400 block font-medium">Base de Datos</span>
              <span className="text-xs font-mono font-bold text-purple-300">
                {specs.roomDatabaseAvailable ? 'Jetpack Room' : 'SQLite OPFS'}
              </span>
            </div>

            <div className="bg-[#0f1019] p-2 rounded-xl border border-[#212332]">
              <span className="text-[10px] text-gray-400 block font-medium">GPU / Render</span>
              <span className="text-xs font-mono font-bold text-blue-400">
                {specs.webGpuSupported ? 'WebGPU' : 'Canvas 2D'}
              </span>
            </div>
          </div>
        </section>

        {/* BARRA DE ACCIÓN PRINCIPAL (BOTONES GRANDES PARA TELÉFONO) */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {/* Botón 1: Copiar Reporte Completo */}
          <button
            type="button"
            onClick={handleCopyFullReport}
            className="py-3 px-3 rounded-xl font-bold text-xs sm:text-sm text-black flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
            style={{ 
              backgroundColor: theme.accentColor,
              boxShadow: `0 2px 10px ${theme.accentSoft25}`
            }}
          >
            {copiedFull ? <Check size={16} className="stroke-[3]" /> : <Copy size={16} />}
            <span>{copiedFull ? '¡Copiado!' : 'Copiar Todo'}</span>
          </button>

          {/* Botón 2: Compartir Reporte */}
          <button
            type="button"
            onClick={handleShareReport}
            className="py-3 px-3 rounded-xl font-bold text-xs sm:text-sm bg-[#1e202d] hover:bg-[#27293a] text-gray-100 border border-[#2f3244] flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
          >
            <Share2 size={16} style={{ color: theme.accentColor }} />
            <span>Compartir</span>
          </button>

          {/* Botón 3: Actualizar Logcat */}
          <button
            type="button"
            onClick={refreshLogcat}
            disabled={isRefreshing}
            className="py-3 px-3 rounded-xl font-bold text-xs sm:text-sm bg-[#1e202d] hover:bg-[#27293a] text-gray-100 border border-[#2f3244] flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
          >
            <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} style={{ color: theme.accentColor }} />
            <span>Refrescar</span>
          </button>

          {/* Botón 4: Limpiar Logs */}
          <button
            type="button"
            onClick={handleClear}
            className="py-3 px-3 rounded-xl font-semibold text-xs sm:text-sm bg-[#1e202d] hover:bg-red-950/50 text-gray-300 hover:text-red-300 border border-[#2f3244] hover:border-red-500/40 flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
          >
            <Trash2 size={15} />
            <span>Limpiar</span>
          </button>
        </section>

        {/* PESTAÑAS DE FILTRO POR CATEGORÍA */}
        <section className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {[
            { id: 'all' as FilterCategory, label: `Todos (${stats.total})`, icon: null },
            { id: 'error' as FilterCategory, label: `Errores (${stats.errors})`, icon: '❌', activeColor: '#ef4444' },
            { id: 'warn' as FilterCategory, label: `Avisos (${stats.warnings})`, icon: '⚠️', activeColor: '#f59e0b' },
            { id: 'native' as FilterCategory, label: `Nativo (${stats.native})`, icon: '🤖', activeColor: '#10b981' },
            { id: 'engine' as FilterCategory, label: `Wasm/GPU (${stats.engine})`, icon: '⚡', activeColor: '#3b82f6' },
            { id: 'logcat' as FilterCategory, label: 'LogCat OS', icon: '📋', activeColor: '#a855f7' },
          ].map((tab) => {
            const isSel = activeCategory === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  triggerHaptic(6);
                  setActiveCategory(tab.id);
                }}
                className={`py-2 px-3 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 active:scale-95 flex items-center gap-1 border ${
                  isSel
                    ? 'shadow-md'
                    : 'bg-[#151722] border-[#252837] text-gray-400 hover:text-gray-200'
                }`}
                style={isSel ? {
                  backgroundColor: tab.activeColor ? `${tab.activeColor}22` : theme.accentSoft,
                  borderColor: tab.activeColor || theme.accentColor,
                  color: tab.activeColor || theme.accentTextHex,
                } : undefined}
              >
                {tab.icon && <span>{tab.icon}</span>}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </section>

        {/* CAMPO DE BÚSQUEDA INTERACTIVO */}
        {activeCategory !== 'logcat' && (
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar en mensajes, tags o stack traces..."
              className="w-full h-11 pl-9 pr-9 bg-[#131520] border border-[#262838] focus:border-gray-500 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white p-1"
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}

        {/* VISTA 1: LOGCAT NATIVO ANDROID DIRECTO */}
        {activeCategory === 'logcat' ? (
          <section className="bg-[#0a0b10] border border-[#242738] rounded-2xl p-3 shadow-inner space-y-2">
            <div className="flex items-center justify-between border-b border-[#1f2231] pb-2">
              <div className="flex items-center gap-2">
                <Terminal size={16} className="text-purple-400" />
                <span className="text-xs font-bold text-gray-200">LogCat de Android (Salida del SO)</span>
              </div>
              <button
                type="button"
                onClick={async () => {
                  triggerHaptic(8);
                  if (typeof navigator !== 'undefined' && navigator.clipboard) {
                    await navigator.clipboard.writeText(nativeLogcatText);
                    setCopiedFull(true);
                    setTimeout(() => setCopiedFull(false), 2000);
                  }
                }}
                className="py-1 px-2.5 rounded-lg bg-[#1f2232] text-xs text-gray-300 hover:text-white flex items-center gap-1 active:scale-95"
              >
                <Copy size={13} />
                <span>Copiar LogCat</span>
              </button>
            </div>

            <pre className="text-[10px] font-mono text-gray-300 bg-[#06070a] p-3 rounded-xl overflow-x-auto whitespace-pre leading-relaxed max-h-[60vh] select-text border border-[#1b1d28]">
              {nativeLogcatText}
            </pre>
          </section>
        ) : (
          /* VISTA 2: LISTA DE EVENTOS CLASIFICADOS */
          <section className="space-y-2">
            {filteredLogs.length === 0 ? (
              <div className="bg-[#141622] border border-[#232635] rounded-2xl p-8 text-center space-y-2">
                <Sparkles size={28} className="mx-auto text-gray-500" />
                <p className="text-xs font-bold text-gray-300">
                  {searchQuery ? 'No hay eventos que coincidan con la búsqueda' : 'No hay eventos en esta categoría'}
                </p>
                <p className="text-[11px] text-gray-500">
                  El motor de InkFlow Studio está corriendo de forma estable y sin fallos detectados.
                </p>
              </div>
            ) : (
              filteredLogs.map((item) => {
                const isError = item.level === 'error';
                const isWarn = item.level === 'warn';
                const isNative = item.level === 'native';
                const isEngine = item.level === 'engine';

                const borderCol = isError
                  ? 'border-red-500/50 bg-red-950/20'
                  : isWarn
                  ? 'border-amber-500/50 bg-amber-950/20'
                  : isNative
                  ? 'border-emerald-500/40 bg-emerald-950/20'
                  : isEngine
                  ? 'border-blue-500/40 bg-blue-950/20'
                  : 'border-[#242738] bg-[#141622]';

                const badgeBg = isError
                  ? 'bg-red-500/20 text-red-400 border-red-500/40'
                  : isWarn
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                  : isNative
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                  : isEngine
                  ? 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                  : 'bg-gray-800 text-gray-300 border-gray-700';

                return (
                  <article
                    key={item.id}
                    className={`border rounded-2xl p-3.5 space-y-2 shadow-sm transition-all text-left ${borderCol}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-md border shrink-0 ${badgeBg}`}>
                          {item.level}
                        </span>
                        <span className="text-[11px] font-mono font-bold text-gray-300 truncate">
                          [{item.tag}]
                        </span>
                        <span className="text-[10px] font-mono text-gray-500 shrink-0">
                          {item.timeFormatted}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleCopySingleItem(item)}
                        className="p-1.5 rounded-lg bg-[#1f2231] hover:bg-[#2a2e42] text-gray-400 hover:text-white transition-all active:scale-95 shrink-0"
                        title="Copiar este registro al portapapeles"
                      >
                        {copiedItemIndex === item.id ? (
                          <Check size={14} className="text-green-400 stroke-[3]" />
                        ) : (
                          <Copy size={14} />
                        )}
                      </button>
                    </div>

                    <p className="text-xs text-gray-100 font-mono break-words leading-relaxed select-text">
                      {item.message}
                    </p>

                    {item.details && (
                      <div className="bg-[#090a0f] p-2 rounded-xl text-[10px] font-mono text-gray-400 break-all select-text border border-[#1d202e]">
                        {item.details}
                      </div>
                    )}

                    {item.stack && (
                      <details className="text-[10px] font-mono text-gray-400 bg-[#090a0f] p-2 rounded-xl border border-[#1d202e] select-text">
                        <summary className="cursor-pointer text-red-400 font-bold mb-1">
                          Ver traza de error (Stack Trace)
                        </summary>
                        <pre className="whitespace-pre-wrap text-[9px] text-gray-400 leading-tight">
                          {item.stack}
                        </pre>
                      </details>
                    )}
                  </article>
                );
              })
            )}
          </section>
        )}

      </main>
    </div>
  );
};
