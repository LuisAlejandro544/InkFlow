/**
 * @file canvasResizeMath.ts
 * @description Módulo matemático y utilidades de expansión de lienzo (Canvas Expansion & Resizing)
 * para InkFlow Studio.
 * 
 * Permite expandir el ancho y alto de la hoja de trabajo en cualquier dirección manteniendo
 * el dibujo intacto, re-mapeando las capas de píxeles, trazos vectoriales de Kotlin/Wasm
 * y fotos de calco sin pérdidas.
 */

export type CanvasAnchor = 
  | 'center' 
  | 'top-left' 
  | 'top' 
  | 'top-right' 
  | 'left' 
  | 'right' 
  | 'bottom-left' 
  | 'bottom' 
  | 'bottom-right';

export interface CanvasResizeResult {
  newWidth: number;
  newHeight: number;
  offsetX: number;
  offsetY: number;
}

export interface CanvasDimensionPreset {
  id: string;
  label: string;
  category: 'increment' | 'ratio' | 'social';
  calculate: (currentW: number, currentH: number) => { width: number; height: number };
}

/**
 * Calcula los desplazamientos X e Y (offsets) para reubicar el contenido existente
 * dentro de las nuevas dimensiones del lienzo según el punto de anclaje seleccionado.
 */
export function calculateResizeOffsets(
  oldWidth: number,
  oldHeight: number,
  newWidth: number,
  newHeight: number,
  anchor: CanvasAnchor = 'center'
): { offsetX: number; offsetY: number } {
  const deltaX = newWidth - oldWidth;
  const deltaY = newHeight - oldHeight;

  let offsetX = 0;
  let offsetY = 0;

  switch (anchor) {
    case 'top-left':
      offsetX = 0;
      offsetY = 0;
      break;
    case 'top':
      offsetX = Math.round(deltaX / 2);
      offsetY = 0;
      break;
    case 'top-right':
      offsetX = deltaX;
      offsetY = 0;
      break;
    case 'left':
      offsetX = 0;
      offsetY = Math.round(deltaY / 2);
      break;
    case 'center':
      offsetX = Math.round(deltaX / 2);
      offsetY = Math.round(deltaY / 2);
      break;
    case 'right':
      offsetX = deltaX;
      offsetY = Math.round(deltaY / 2);
      break;
    case 'bottom-left':
      offsetX = 0;
      offsetY = deltaY;
      break;
    case 'bottom':
      offsetX = Math.round(deltaX / 2);
      offsetY = deltaY;
      break;
    case 'bottom-right':
      offsetX = deltaX;
      offsetY = deltaY;
      break;
    default:
      offsetX = Math.round(deltaX / 2);
      offsetY = Math.round(deltaY / 2);
      break;
  }

  return { offsetX, offsetY };
}

/**
 * Limita y normaliza las dimensiones del lienzo dentro de límites seguros de hardware móvil.
 * Mínimo 100x100px, máximo 4096x4096px (para asegurar compatibilidad con WebGPU/WebGL en móviles).
 */
export function clampCanvasDimension(val: number, min: number = 100, max: number = 4096): number {
  if (isNaN(val) || !isFinite(val)) return min;
  return Math.min(max, Math.max(min, Math.round(val)));
}

/**
 * Presets de expansión rápida orientados a artistas móviles:
 * - Espacio extra (+25%, +50%, +100% doble lienzo)
 * - Proporciones estándar (Cuadrado 1:1, Story/Manga 9:16, Panorámica 16:9, A4)
 */
export const CANVAS_EXPANSION_PRESETS: CanvasDimensionPreset[] = [
  {
    id: 'plus_25',
    label: '+25% Espacio',
    category: 'increment',
    calculate: (w, h) => ({
      width: clampCanvasDimension(Math.round(w * 1.25)),
      height: clampCanvasDimension(Math.round(h * 1.25)),
    }),
  },
  {
    id: 'plus_50',
    label: '+50% Espacio',
    category: 'increment',
    calculate: (w, h) => ({
      width: clampCanvasDimension(Math.round(w * 1.5)),
      height: clampCanvasDimension(Math.round(h * 1.5)),
    }),
  },
  {
    id: 'double',
    label: '2x (Duplicar)',
    category: 'increment',
    calculate: (w, h) => ({
      width: clampCanvasDimension(w * 2),
      height: clampCanvasDimension(h * 2),
    }),
  },
  {
    id: 'square_1_1',
    label: '1:1 Cuadrado',
    category: 'ratio',
    calculate: (w, h) => {
      const maxSide = Math.max(w, h);
      return {
        width: clampCanvasDimension(maxSide),
        height: clampCanvasDimension(maxSide),
      };
    },
  },
  {
    id: 'story_9_16',
    label: '9:16 Móvil / Manga',
    category: 'social',
    calculate: (w, _h) => {
      const newH = Math.round((w * 16) / 9);
      return {
        width: clampCanvasDimension(w),
        height: clampCanvasDimension(Math.max(_h, newH)),
      };
    },
  },
  {
    id: 'wide_16_9',
    label: '16:9 Panorámica',
    category: 'social',
    calculate: (w, h) => {
      const newW = Math.round((h * 16) / 9);
      return {
        width: clampCanvasDimension(Math.max(w, newW)),
        height: clampCanvasDimension(h),
      };
    },
  },
];
