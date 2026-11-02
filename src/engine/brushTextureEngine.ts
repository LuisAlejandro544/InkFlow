/**
 * @file brushTextureEngine.ts
 * @description Motor matemático y generador de texturas de superficie para pinceles estilo IbisPaint.
 * 
 * Implementa 4 texturas de superficie clásicas de ilustración profesional:
 * 1. Papel Acuarela (Watercolor Paper): Rugosidad orgánica de fibras de papel de dibujo.
 * 2. Lienzo Artístico (Canvas): Trama textil cruzada ortogonal estilo tela de lino.
 * 3. Trama Manga (Screentone / Halftone): Puntos simétricos ordenados a 45° para manga y cómics.
 * 4. Carboncillo Poroso (Charcoal): Grano seco y desgranado con micro-porosidad estocástica.
 * 
 * Principios:
 * - Determinismo matemático: O(1) por punto de trazo. Cero caídas de FPS a 60-120 FPS en móviles.
 * - Soporte de previsualización aislada: Permite examinar y renderizar trazos de prueba sin modificar el lienzo principal.
 */

import { BrushTextureId, BrushTextureConfig } from './types';

export interface TextureDefinition {
  id: BrushTextureId;
  name: string;
  badge: string;
  badgeColor: string;
  description: string;
  defaultScale: number;
  defaultDepth: number;
  tags: string[];
}

export const TEXTURE_DEFINITIONS: TextureDefinition[] = [
  {
    id: 'none',
    name: 'Ninguna (Liso)',
    badge: 'Trazo Plano',
    badgeColor: 'bg-zinc-700/50 text-zinc-300 border-zinc-600/40',
    description: 'Trazo sólido tradicional uniforme sin rugosidad de superficie.',
    defaultScale: 1.0,
    defaultDepth: 0.0,
    tags: ['Básico', 'Limpio', 'Suave'],
  },
  {
    id: 'watercolor_paper',
    name: 'Papel Acuarela',
    badge: 'Grano Orgánico',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    description: 'Rugosidad clásica de papel Canson / Torchon con depresiones donde se acumula el pigmento.',
    defaultScale: 1.2,
    defaultDepth: 0.65,
    tags: ['Papel', 'Acuarela', 'Tradicional'],
  },
  {
    id: 'canvas',
    name: 'Lienzo Textil',
    badge: 'Trama Lino',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    description: 'Entramado cruzado de tela de lino. Ideal para técnica de óleo, acrílico e ilustración editorial.',
    defaultScale: 1.0,
    defaultDepth: 0.70,
    tags: ['Óleo', 'Pintura', 'Textil'],
  },
  {
    id: 'screentone',
    name: 'Trama Manga (Halftone)',
    badge: 'Manga / Cómic',
    badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    description: 'Puntos regulares de imprenta a 45 grados. Imprescindible para sombreados manga y retro pop art.',
    defaultScale: 1.0,
    defaultDepth: 0.85,
    tags: ['Manga', 'Screentone', 'Puntos'],
  },
  {
    id: 'charcoal_noise',
    name: 'Carboncillo Poroso',
    badge: 'Grano Seco',
    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    description: 'Grano áspero y desgranado con micro-huecos en las zonas de poca presión.',
    defaultScale: 1.1,
    defaultDepth: 0.75,
    tags: ['Boceto', 'Carbón', 'Pastel'],
  },
];

/**
 * Función matemática de pseudo-ruido determinista 2D (sin coste de Math.random)
 */
function pseudoNoise2D(x: number, y: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453123;
  return n - Math.floor(n);
}

/**
 * Evalúa la luminancia de la textura en coordenadas de lienzo (0.0 = hueco/textura oscura, 1.0 = superficie plana).
 * 
 * @param textureId Identificador de la textura
 * @param x Coordenada X del lienzo
 * @param y Coordenada Y del lienzo
 * @param scale Escala de la textura (zoom de la trama)
 * @returns Valor normalizado entre 0.0 y 1.0
 */
export function sampleTextureLuminance(
  textureId: BrushTextureId,
  x: number,
  y: number,
  scale: number = 1.0
): number {
  if (textureId === 'none') {
    return 1.0;
  }

  const safeScale = Math.max(0.2, scale);
  const sx = x / safeScale;
  const sy = y / safeScale;

  switch (textureId) {
    case 'watercolor_paper': {
      // Síntesis armónica multiescala (fibras orgánicas de papel)
      const freq1 = (Math.sin(sx * 0.28) + Math.cos(sy * 0.28)) * 0.25;
      const freq2 = (Math.sin(sx * 0.75 + sy * 0.45) + Math.cos(sy * 0.75 - sx * 0.45)) * 0.15;
      const noise = pseudoNoise2D(Math.floor(sx * 0.8), Math.floor(sy * 0.8)) * 0.25;
      const raw = 0.5 + freq1 + freq2 + noise;
      return Math.max(0.05, Math.min(1.0, raw));
    }

    case 'canvas': {
      // Trama textil cruzada ortogonal
      const period = 8.0;
      const u = (sx % period) / period;
      const v = (sy % period) / period;
      const warp = Math.sin(u * Math.PI * 2); // Hilo horizontal
      const weft = Math.sin(v * Math.PI * 2); // Hilo vertical
      const weave = (warp * 0.5 + 0.5) * (weft * 0.5 + 0.5);
      const microNoise = pseudoNoise2D(Math.floor(sx * 0.5), Math.floor(sy * 0.5)) * 0.12;
      const val = 0.25 + weave * 0.65 + microNoise;
      return Math.max(0.1, Math.min(1.0, val));
    }

    case 'screentone': {
      // Malla de semitonos Halftone inclinada a 45 grados (estilo manga japonés)
      const dotSpacing = 10.0;
      // Rotar coordenadas 45° (cos 45 = sin 45 = 0.7071)
      const rx = (sx * 0.7071 - sy * 0.7071);
      const ry = (sx * 0.7071 + sy * 0.7071);
      
      const cx = (Math.abs(rx) % dotSpacing) - dotSpacing * 0.5;
      const cy = (Math.abs(ry) % dotSpacing) - dotSpacing * 0.5;
      const distFromDotCenter = Math.sqrt(cx * cx + cy * cy);
      const dotRadius = dotSpacing * 0.35;
      
      if (distFromDotCenter < dotRadius) {
        // En el centro del punto manga la tinta es densa
        return Math.max(0.15, (distFromDotCenter / dotRadius) * 0.7);
      }
      return 1.0;
    }

    case 'charcoal_noise': {
      // Porosidad estocástica seca de carboncillo
      const grainA = pseudoNoise2D(Math.floor(sx * 1.2), Math.floor(sy * 1.2));
      const grainB = pseudoNoise2D(Math.floor(sx * 2.4 + 3.1), Math.floor(sy * 2.4 + 7.9));
      const combined = grainA * 0.65 + grainB * 0.35;
      // Mayor probabilidad de huecos (grano disperso)
      return combined > 0.4 ? combined : combined * 0.4;
    }

    default:
      return 1.0;
  }
}

/**
 * Modula la opacidad del punto de trazo según la textura activa y su intensidad
 */
export function modulateAlphaByTexture(
  baseAlpha: number,
  textureConfig: BrushTextureConfig,
  x: number,
  y: number
): number {
  if (textureConfig.id === 'none' || textureConfig.depth <= 0.01) {
    return baseAlpha;
  }

  const lum = sampleTextureLuminance(textureConfig.id, x, y, textureConfig.scale);
  const factor = 1.0 - textureConfig.depth * (1.0 - lum);
  return Math.max(0.01, Math.min(1.0, baseAlpha * factor));
}

/**
 * Genera una muestra de demostración en un canvas HTML para previsualizar
 * la textura en vivo (estilo IbisPaint) antes de que el usuario decida seleccionarla.
 */
/**
 * Parsea color hex a componentes RGB para evaluar luminancia
 */
function parseHexToRgb(hex: string): { r: number; g: number; b: number } {
  let c = hex.replace('#', '');
  if (c.length === 3) {
    c = c.split('').map(x => x + x).join('');
  }
  const num = parseInt(c, 16);
  if (isNaN(num)) return { r: 24, g: 24, b: 27 };
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

/**
 * Genera una muestra de demostración en un canvas HTML para previsualizar
 * la textura en vivo (estilo IbisPaint) antes de que el usuario decida seleccionarla.
 * Por defecto renderiza sobre papel en blanco premium de ilustración para un contraste nítido y apariencia nativa.
 */
export function renderTexturePreviewStroke(
  canvas: HTMLCanvasElement,
  textureId: BrushTextureId,
  colorHex: string = '#18181b',
  depth: number = 0.7,
  scale: number = 1.0,
  isWhitePaper: boolean = true
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;

  ctx.clearRect(0, 0, width, height);

  if (isWhitePaper) {
    // Fondo de Papel Blanco Premium de Dibujo Artístico (Warm Ivory Cotton / Canson Bristol 250g)
    const paperGrad = ctx.createLinearGradient(0, 0, width, height);
    paperGrad.addColorStop(0, '#FFFFFF');
    paperGrad.addColorStop(0.45, '#FAF9F5');
    paperGrad.addColorStop(1, '#F3F2EB');
    ctx.fillStyle = paperGrad;
    ctx.fillRect(0, 0, width, height);

    // Micro-fibras orgánicas de algodón (textura táctil microscópica del papel físico de boceto)
    ctx.save();
    ctx.fillStyle = '#E8E6DB';
    for (let py = 4; py < height - 4; py += 8) {
      for (let px = 4; px < width - 4; px += 8) {
        const n = pseudoNoise2D(px * 1.3, py * 1.3);
        if (n > 0.65) {
          ctx.globalAlpha = (n - 0.65) * 0.4;
          ctx.fillRect(px, py, 1.5, 1.5);
        }
      }
    }
    ctx.restore();

    // Cuadrícula técnica tenue de papel milimetrado (estilo bloc de bocetos profesional)
    ctx.strokeStyle = 'rgba(215, 222, 232, 0.55)';
    ctx.lineWidth = 1;
    for (let x = 16; x < width; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 16; y < height; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Biselado perimetral sutil que simula el borde cortado de una hoja de papel
    ctx.strokeStyle = 'rgba(203, 213, 225, 0.75)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, width - 1, height - 1);
  } else {
    // Fondo oscuro alternativo
    ctx.fillStyle = '#0f1016';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#1b1d28';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 16) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 16) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }

  // Evaluación de contraste inteligente: si el artista tiene color blanco puro sobre papel blanco,
  // adaptamos sutilmente el tono para que nunca sea invisible
  const rgb = parseHexToRgb(colorHex);
  const lum = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  const effectiveColor = (isWhitePaper && lum > 0.85) ? '#1E293B' : colorHex;

  // Si no hay textura, dibujar un trazo suave estándar
  const cfg: BrushTextureConfig = {
    id: textureId,
    name: 'Preview',
    depth,
    scale,
  };

  // Trazo curvo elegante de prueba tipo caligrafía (Curva S amplia)
  const steps = 180;
  const baseSize = Math.max(14, height * 0.24);

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // Curva S centrada en el canvas con suavizado
    const x = 24 + t * (width - 48);
    const y = (height * 0.5) + Math.sin(t * Math.PI * 2) * (height * 0.26);

    // Modulación de grosor por posición (punta fina - cuerpo grueso - punta fina)
    const envelope = Math.sin(t * Math.PI);
    const radius = Math.max(2.5, (baseSize * envelope) / 2);

    // Muestreo de textura en esta coordenada
    const alpha = modulateAlphaByTexture(0.95, cfg, x, y);

    ctx.save();
    ctx.fillStyle = effectiveColor;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
