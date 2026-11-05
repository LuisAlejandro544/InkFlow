/**
 * @file ThemeCustomizationScreen.tsx
 * @description Pantalla dedicada e independiente para personalizar los colores y el tema de la aplicación.
 * Permite alternar entre 6 paletas de acento visual con respuesta táctil y preview interactivo en tiempo real.
 */

import React, { useState } from 'react';
import { ArrowLeft, Check, Sparkles, Palette } from 'lucide-react';
import { 
  getAvailableThemes, 
  getActiveThemeId, 
  applyAppTheme, 
  AppThemeId, 
  AppThemeConfig 
} from '../../engine/themeEngine';

interface ThemeCustomizationScreenProps {
  onReturnToSettings: () => void;
  onThemeChanged?: (theme: AppThemeConfig) => void;
}

export const ThemeCustomizationScreen: React.FC<ThemeCustomizationScreenProps> = ({
  onReturnToSettings,
  onThemeChanged,
}) => {
  const [selectedThemeId, setSelectedThemeId] = useState<AppThemeId>(getActiveThemeId());
  const [appliedSuccess, setAppliedSuccess] = useState<string>('');
  const themes = getAvailableThemes();

  const triggerHaptic = (ms = 10) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate(ms); } catch {}
    }
  };

  const handleSelectTheme = (themeId: AppThemeId) => {
    triggerHaptic(12);
    setSelectedThemeId(themeId);
    const theme = applyAppTheme(themeId);
    onThemeChanged?.(theme);
    setAppliedSuccess(`¡Tema "${theme.name.split(' ')[0]}" activado para toda la app!`);
    setTimeout(() => setAppliedSuccess(''), 2500);
  };

  const activeTheme = themes.find((t) => t.id === selectedThemeId) || themes[0];

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
            onReturnToSettings();
          }}
          aria-label="Volver a Ajustes"
          className="h-9 px-2.5 sm:px-3 rounded-xl bg-[#1f2230] hover:bg-[#282b3d] text-gray-200 border border-[#2e3246] transition-colors flex items-center gap-1.5 text-xs font-semibold active:scale-95 shrink-0"
        >
          <ArrowLeft size={16} />
          <span>Volver</span>
        </button>

        <h1 className="text-xs sm:text-sm md:text-base font-bold text-white truncate flex-1 text-center min-w-0 px-1">
          Color y Tema de la App
        </h1>

        <div className="shrink-0 flex items-center gap-1">
          <Palette size={16} style={{ color: activeTheme.accentColor }} />
          <span className="text-sm">{activeTheme.emoji}</span>
        </div>
      </header>

      {/* Contenido principal */}
      <main className="flex-1 p-4 sm:p-6 max-w-2xl mx-auto w-full space-y-5 pb-10">
        {/* Banner descriptivo */}
        <div className="bg-[#141620] border border-[#252838] rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{ color: activeTheme.accentColor }}>
            <Sparkles size={16} />
            <span>Personalización Visual</span>
          </div>
          <h2 className="text-base sm:text-lg font-bold text-white">
            Elige la atmósfera de tu estudio de dibujo
          </h2>
          <p className="text-xs text-gray-400 leading-relaxed">
            Personaliza el color de acento de los botones, sliders, bordes y badges de la interfaz. Tu selección se aplica inmediatamente a toda la aplicación, se guarda en tu teléfono y se mantiene activa en futuras sesiones.
          </p>

          {appliedSuccess && (
            <div className="mt-2 p-2.5 rounded-xl bg-green-950/40 border border-green-500/50 text-green-300 text-xs font-semibold flex items-center gap-2 animate-fade-in">
              <Check size={16} />
              <span>{appliedSuccess}</span>
            </div>
          )}
        </div>

        {/* Vista previa en vivo del tema seleccionado */}
        <div className="bg-[#12141c] border border-[#222432] rounded-2xl p-4 shadow-inner space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
              Vista Previa en Vivo ({activeTheme.name})
            </span>
            <span 
              className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase font-mono"
              style={{ backgroundColor: activeTheme.accentSoft, color: activeTheme.accentColor }}
            >
              Color Activo
            </span>
          </div>

          {/* Mini maqueta de interfaz demostrativa */}
          <div className="bg-[#181a24] border border-[#2a2d3d] rounded-xl p-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div 
                className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-black text-sm shrink-0 shadow-md"
                style={{ backgroundColor: activeTheme.accentColor }}
              >
                {activeTheme.emoji}
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-white block truncate">Botón Principal</span>
                <span className="text-[10px] text-gray-400 block truncate">Acento en tiempo real</span>
              </div>
            </div>

            <button
              className="py-1.5 px-3 rounded-lg text-black font-bold text-xs shadow-md shrink-0 flex items-center gap-1 active:scale-95 transition-transform"
              style={{ backgroundColor: activeTheme.accentColor }}
            >
              <span>{activeTheme.emoji} Acción</span>
            </button>
          </div>
        </div>

        {/* Catálogo de 6 Temas */}
        <div className="space-y-2.5">
          <h3 className="text-xs text-gray-400 font-bold uppercase tracking-wider px-1">
            Paletas Disponibles (Toca para activar en toda la app)
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {themes.map((theme) => {
              const isSelected = selectedThemeId === theme.id;
              return (
                <button
                  key={theme.id}
                  onClick={() => handleSelectTheme(theme.id)}
                  className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between gap-3 active:scale-98 ${
                    isSelected
                      ? 'bg-[#181b28] shadow-lg ring-2'
                      : 'bg-[#14151e] border-[#242736] hover:bg-[#1a1c2a] hover:border-gray-600'
                  }`}
                  style={{
                    borderColor: isSelected ? theme.accentColor : undefined,
                    boxShadow: isSelected ? `0 0 15px ${theme.accentSoft}` : undefined,
                  }}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2.5">
                      <div 
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-black font-bold text-sm shadow-md"
                        style={{ backgroundColor: theme.accentColor }}
                      >
                        {theme.emoji}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-white block">
                          {theme.name}
                        </span>
                        <span className="text-[10px] text-gray-400 font-mono">
                          {theme.accentColor}
                        </span>
                      </div>
                    </div>

                    {isSelected && (
                      <div 
                        className="w-6 h-6 rounded-full flex items-center justify-center text-black shadow-md shrink-0"
                        style={{ backgroundColor: theme.accentColor }}
                      >
                        <Check size={14} className="stroke-[3]" />
                      </div>
                    )}
                  </div>

                  <p className="text-[11px] text-gray-400 line-clamp-2">
                    {theme.tagline}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Nota informativa */}
        <div className="p-3 bg-[#11131b] border border-[#20222f] rounded-xl text-center text-[11px] text-gray-400">
          Configuración guardada permanentemente en el almacenamiento local de tu teléfono móvil.
        </div>
      </main>
    </div>
  );
};
