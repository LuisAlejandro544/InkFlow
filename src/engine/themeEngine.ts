/**
 * @file themeEngine.ts
 * @description Motor de gestión de temas visuales y personalización de color de InkFlow Studio.
 * 
 * Permite cambiar el color de acento y la atmósfera visual de la aplicación móvil PWA
 * sin alterar la estabilidad del motor gráfico ni el rendimiento a 60–120 FPS.
 * Soporta persistencia local, variables CSS dinámicas y suscripción reactiva vía hook `useAppTheme`.
 */

import { useState, useEffect } from 'react';

export type AppThemeId = 'amber' | 'amethyst' | 'emerald' | 'sapphire' | 'crimson' | 'cyan';

export interface AppThemeConfig {
  id: AppThemeId;
  name: string;
  tagline: string;
  accentColor: string;
  accentHover: string;
  accentSoft: string;
  accentSoft25: string;
  accentBorder: string;
  accentTextHex: string;
  accentText: string;
  borderActive: string;
  buttonBg: string;
  buttonHoverBg: string;
  gradientBadge: string;
  sliderClass: string;
  emoji: string;
}

export const APP_THEMES: Record<AppThemeId, AppThemeConfig> = {
  amber: {
    id: 'amber',
    name: 'Ámbar Estudio (Por Defecto)',
    tagline: 'Cálido, profesional y clásico de estudio de arte',
    accentColor: '#f59e0b',
    accentHover: '#d97706',
    accentSoft: 'rgba(245, 158, 11, 0.15)',
    accentSoft25: 'rgba(245, 158, 11, 0.25)',
    accentBorder: 'rgba(245, 158, 11, 0.50)',
    accentTextHex: '#fbbf24',
    accentText: 'text-amber-400',
    borderActive: 'border-amber-400',
    buttonBg: 'bg-amber-500',
    buttonHoverBg: 'hover:bg-amber-400',
    gradientBadge: 'from-amber-500 to-amber-600',
    sliderClass: 'accent-amber-500',
    emoji: '✨',
  },
  amethyst: {
    id: 'amethyst',
    name: 'Amatista Creativo',
    tagline: 'Púrpura vibrante para ilustración conceptual y manga',
    accentColor: '#a855f7',
    accentHover: '#9333ea',
    accentSoft: 'rgba(168, 85, 247, 0.15)',
    accentSoft25: 'rgba(168, 85, 247, 0.25)',
    accentBorder: 'rgba(168, 85, 247, 0.50)',
    accentTextHex: '#c084fc',
    accentText: 'text-purple-400',
    borderActive: 'border-purple-400',
    buttonBg: 'bg-purple-500',
    buttonHoverBg: 'hover:bg-purple-400',
    gradientBadge: 'from-purple-500 to-purple-600',
    sliderClass: 'accent-purple-500',
    emoji: '🔮',
  },
  emerald: {
    id: 'emerald',
    name: 'Esmeralda Manga',
    tagline: 'Verde fresco y relajante para sesiones largas de dibujo',
    accentColor: '#10b981',
    accentHover: '#059669',
    accentSoft: 'rgba(16, 185, 129, 0.15)',
    accentSoft25: 'rgba(16, 185, 129, 0.25)',
    accentBorder: 'rgba(16, 185, 129, 0.50)',
    accentTextHex: '#34d399',
    accentText: 'text-emerald-400',
    borderActive: 'border-emerald-400',
    buttonBg: 'bg-emerald-500',
    buttonHoverBg: 'hover:bg-emerald-400',
    gradientBadge: 'from-emerald-500 to-emerald-600',
    sliderClass: 'accent-emerald-500',
    emoji: '🌿',
  },
  sapphire: {
    id: 'sapphire',
    name: 'Zafiro Digital',
    tagline: 'Azul noche de alta tecnología y máxima concentración',
    accentColor: '#3b82f6',
    accentHover: '#2563eb',
    accentSoft: 'rgba(59, 130, 246, 0.15)',
    accentSoft25: 'rgba(59, 130, 246, 0.25)',
    accentBorder: 'rgba(59, 130, 246, 0.50)',
    accentTextHex: '#60a5fa',
    accentText: 'text-blue-400',
    borderActive: 'border-blue-400',
    buttonBg: 'bg-blue-500',
    buttonHoverBg: 'hover:bg-blue-400',
    gradientBadge: 'from-blue-500 to-blue-600',
    sliderClass: 'accent-blue-500',
    emoji: '💎',
  },
  crimson: {
    id: 'crimson',
    name: 'Carmesí Dinámico',
    tagline: 'Rojo rubí intenso para entintado enérgico y cómics',
    accentColor: '#ef4444',
    accentHover: '#dc2626',
    accentSoft: 'rgba(239, 68, 68, 0.15)',
    accentSoft25: 'rgba(239, 68, 68, 0.25)',
    accentBorder: 'rgba(239, 68, 68, 0.50)',
    accentTextHex: '#f87171',
    accentText: 'text-red-400',
    borderActive: 'border-red-400',
    buttonBg: 'bg-red-500',
    buttonHoverBg: 'hover:bg-red-400',
    gradientBadge: 'from-red-500 to-red-600',
    sliderClass: 'accent-red-500',
    emoji: '🔥',
  },
  cyan: {
    id: 'cyan',
    name: 'Cian Neón Cyber',
    tagline: 'Cian ultra brillante futurista para arte digital moderno',
    accentColor: '#06b6d4',
    accentHover: '#0891b2',
    accentSoft: 'rgba(6, 182, 212, 0.15)',
    accentSoft25: 'rgba(6, 182, 212, 0.25)',
    accentBorder: 'rgba(6, 182, 212, 0.50)',
    accentTextHex: '#22d3ee',
    accentText: 'text-cyan-400',
    borderActive: 'border-cyan-400',
    buttonBg: 'bg-cyan-500',
    buttonHoverBg: 'hover:bg-cyan-400',
    gradientBadge: 'from-cyan-500 to-cyan-600',
    sliderClass: 'accent-cyan-500',
    emoji: '⚡',
  },
};

const THEME_STORAGE_KEY = 'inkflow_app_theme';

/**
 * Obtiene la lista completa de temas disponibles
 */
export function getAvailableThemes(): AppThemeConfig[] {
  return Object.values(APP_THEMES);
}

/**
 * Obtiene el identificador del tema activo desde el almacenamiento local
 */
export function getActiveThemeId(): AppThemeId {
  if (typeof window === 'undefined') return 'amber';
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved && saved in APP_THEMES) {
      return saved as AppThemeId;
    }
  } catch {
    // Si localStorage está bloqueado, fallback seguro
  }
  return 'amber';
}

/**
 * Obtiene el objeto de configuración del tema activo actual
 */
export function getCurrentAppTheme(): AppThemeConfig {
  const id = getActiveThemeId();
  return APP_THEMES[id] || APP_THEMES.amber;
}

/**
 * Aplica el tema seleccionado inyectando las variables CSS y persistiendo en disco
 */
export function applyAppTheme(themeId: AppThemeId): AppThemeConfig {
  const theme = APP_THEMES[themeId] || APP_THEMES.amber;

  if (typeof document !== 'undefined' && document.documentElement) {
    const root = document.documentElement;
    root.style.setProperty('--color-app-accent', theme.accentColor);
    root.style.setProperty('--color-app-accent-hover', theme.accentHover);
    root.style.setProperty('--color-app-accent-soft', theme.accentSoft);
    root.style.setProperty('--color-app-accent-soft25', theme.accentSoft25);
    root.style.setProperty('--color-app-accent-border', theme.accentBorder);
    root.style.setProperty('--color-app-accent-text', theme.accentTextHex);
    root.style.setProperty('--app-accent', theme.accentColor);
    root.style.setProperty('--app-accent-hover', theme.accentHover);
    root.style.setProperty('--app-accent-soft', theme.accentSoft);
    root.style.setProperty('--app-accent-soft25', theme.accentSoft25);
    root.style.setProperty('--app-accent-border', theme.accentBorder);
    root.style.setProperty('--app-accent-text', theme.accentTextHex);
  }

  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme.id);
    } catch {}
  }

  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('inkflow-theme-changed', { detail: theme }));
    } catch {}
  }

  return theme;
}

/**
 * Inicializa el tema al arrancar la aplicación
 */
export function initializeAppTheme(): AppThemeConfig {
  const activeId = getActiveThemeId();
  return applyAppTheme(activeId);
}

/**
 * Hook reactivo para consumir el tema en cualquier componente React.
 * Se actualiza inmediatamente cuando el usuario selecciona un nuevo color en Ajustes.
 */
export function useAppTheme(): AppThemeConfig {
  const [theme, setTheme] = useState<AppThemeConfig>(() => getCurrentAppTheme());

  useEffect(() => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<AppThemeConfig>;
      if (customEvent.detail) {
        setTheme(customEvent.detail);
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('inkflow-theme-changed', handler);
      return () => window.removeEventListener('inkflow-theme-changed', handler);
    }
  }, []);

  return theme;
}
