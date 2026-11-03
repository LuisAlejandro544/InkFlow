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
    name: 'Lisa',
    badge: 'Trazo Sólido',
    badgeColor: 'bg-zinc-700/50 text-zinc-300 border-zinc-600/40',
    description: 'Trazo sólido tradicional uniforme sin rugosidad de superficie.',
    defaultScale: 1.0,
    defaultDepth: 0.0,
    tags: ['Lisa', 'Plano', 'Básico'],
  },
  {
    id: 'grain',
    name: 'Grano',
    badge: 'Grano Fino',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    description: 'Micro-grano homogéneo estocástico que simula pigmento fino sobre papel suave.',
    defaultScale: 1.0,
    defaultDepth: 0.65,
    tags: ['Grano', 'Lápiz', 'Textura'],
  },
  {
    id: 'rough',
    name: 'Rugosa',
    badge: 'Relieve',
    badgeColor: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
    description: 'Textura con depresiones y bloques de grano irregular para trazos ásperos.',
    defaultScale: 1.2,
    defaultDepth: 0.75,
    tags: ['Rugosa', 'Áspero', 'Relieve'],
  },
  {
    id: 'screentone',
    name: 'Trama',
    badge: 'Manga 45°',
    badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    description: 'Trama diagonal manga continua inclinada a 45 grados para sombreado clásico.',
    defaultScale: 1.0,
    defaultDepth: 0.85,
    tags: ['Trama', 'Manga', 'Cómic'],
  },
  {
    id: 'splatter',
    name: 'Salpicada',
    badge: 'Spray Puntos',
    badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    description: 'Micro-salpicaduras dispersas estilo aerosol con puntos variables.',
    defaultScale: 1.1,
    defaultDepth: 0.70,
    tags: ['Salpicada', 'Spray', 'Gotas'],
  },
  {
    id: 'paper',
    name: 'Papel',
    badge: 'Fibra Orgánica',
    badgeColor: 'bg-amber-600/20 text-amber-200 border-amber-600/40',
    description: 'Fibras orgánicas de papel de ilustración Canson con valles de absorción.',
    defaultScale: 1.2,
    defaultDepth: 0.65,
    tags: ['Papel', 'Tradicional', 'Fibras'],
  },
  {
    id: 'canvas',
    name: 'Tela',
    badge: 'Trama Textil',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    description: 'Entramado cruzado ortogonal de lino para técnicas de pintura y óleo.',
    defaultScale: 1.0,
    defaultDepth: 0.70,
    tags: ['Tela', 'Lino', 'Textil'],
  },
  {
    id: 'watercolor',
    name: 'Acuarela',
    badge: 'Lavado Húmedo',
    badgeColor: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
    description: 'Efecto de acumulación de agua y pigmento con gradientes tonales suaves.',
    defaultScale: 1.3,
    defaultDepth: 0.60,
    tags: ['Acuarela', 'Agua', 'Pigmento'],
  },
  {
    id: 'charcoal',
    name: 'Carbón',
    badge: 'Poroso Seco',
    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    description: 'Carboncillo seco y desgranado con micro-huecos en los valles del trazo.',
    defaultScale: 1.1,
    defaultDepth: 0.80,
    tags: ['Carbón', 'Boceto', 'Pastel'],
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
    case 'grain': {
      // Grano fino estocástico uniforme
      const n1 = pseudoNoise2D(Math.floor(sx * 1.5), Math.floor(sy * 1.5));
      const n2 = pseudoNoise2D(Math.floor(sx * 3.0 + 1.3), Math.floor(sy * 3.0 + 4.7));
      const combined = n1 * 0.7 + n2 * 0.3;
      return 0.35 + combined * 0.65;
    }

    case 'rough': {
      // Rugosa con bloques irregulares de grano grueso y relieve
      const bx = Math.floor(sx * 0.45);
      const by = Math.floor(sy * 0.45);
      const bNoise = pseudoNoise2D(bx, by);
      const micro = pseudoNoise2D(Math.floor(sx * 1.8), Math.floor(sy * 1.8)) * 0.25;
      return bNoise > 0.45 ? 0.95 : 0.25 + micro;
    }

    case 'screentone': {
      // Trama diagonal manga a 45 grados (rayas paralelas uniformes)
      const rot = (sx * 0.7071 + sy * 0.7071);
      const period = 6.0;
      const mod = Math.abs(rot) % period;
      return (mod < period * 0.38) ? 0.18 : 1.0;
    }

    case 'splatter': {
      // Salpicada con micro-gotas dispersas
      const cellX = Math.floor(sx * 0.6);
      const cellY = Math.floor(sy * 0.6);
      const dropProb = pseudoNoise2D(cellX, cellY);
      const microNoise = pseudoNoise2D(Math.floor(sx * 2.2), Math.floor(sy * 2.2));
      return (dropProb > 0.62) ? 0.25 : (microNoise > 0.85 ? 0.4 : 1.0);
    }

    case 'paper':
    case 'watercolor_paper': {
      // Fibras orgánicas de papel
      const freq1 = (Math.sin(sx * 0.28) + Math.cos(sy * 0.28)) * 0.25;
      const freq2 = (Math.sin(sx * 0.75 + sy * 0.45) + Math.cos(sy * 0.75 - sx * 0.45)) * 0.15;
      const noise = pseudoNoise2D(Math.floor(sx * 0.8), Math.floor(sy * 0.8)) * 0.25;
      const raw = 0.5 + freq1 + freq2 + noise;
      return Math.max(0.05, Math.min(1.0, raw));
    }

    case 'canvas': {
      // Trama textil cruzada ortogonal estilo tela de lino
      const period = 7.0;
      const u = (Math.abs(sx) % period) / period;
      const v = (Math.abs(sy) % period) / period;
      const warp = Math.sin(u * Math.PI * 2);
      const weft = Math.sin(v * Math.PI * 2);
      const weave = (warp * 0.5 + 0.5) * (weft * 0.5 + 0.5);
      const microNoise = pseudoNoise2D(Math.floor(sx * 0.6), Math.floor(sy * 0.6)) * 0.15;
      const val = 0.25 + weave * 0.65 + microNoise;
      return Math.max(0.1, Math.min(1.0, val));
    }

    case 'watercolor': {
      // Acuarela con lavado orgánico de pigmento
      const wave = Math.sin(sx * 0.2 + Math.cos(sy * 0.2)) * 0.35;
      const n = pseudoNoise2D(Math.floor(sx * 0.5), Math.floor(sy * 0.5)) * 0.35;
      const raw = 0.45 + wave + n;
      return Math.max(0.15, Math.min(1.0, raw));
    }

    case 'charcoal':
    case 'charcoal_noise': {
      // Porosidad estocástica seca de carboncillo
      const grainA = pseudoNoise2D(Math.floor(sx * 1.2), Math.floor(sy * 1.2));
      const grainB = pseudoNoise2D(Math.floor(sx * 2.4 + 3.1), Math.floor(sy * 2.4 + 7.9));
      const combined = grainA * 0.65 + grainB * 0.35;
      return combined > 0.4 ? combined : combined * 0.35;
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
 * Determina si en las coordenadas (x, y) el pigmento debe penetrar el relieve del papel
 * o si corresponde a un valle microscópico que permanece libre de tinta.
 * Evita la sobre-saturación del trazo continuo que borraba la sensación táctil de textura.
 */
export function shouldDepositTexturePigment(
  textureConfig: BrushTextureConfig | undefined,
  x: number,
  y: number
): boolean {
  if (!textureConfig || textureConfig.id === 'none' || textureConfig.depth <= 0.05) {
    return true;
  }
  const lum = sampleTextureLuminance(textureConfig.id, x, y, textureConfig.scale);
  // Para texturas con hendiduras pronunciadas (trama, carbón, rugosa, tela), los valles profundos no reciben pigmento
  const threshold = 0.30 * textureConfig.depth;
  return lum >= threshold;
}

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

// Caché de patrones CanvasPattern para renderizado continuo a 60-120 FPS
const patternCache = new Map<string, CanvasPattern>();

/**
 * Limpia la caché de patrones de textura (útil para pruebas o cambio radical de proyecto)
 */
export function clearTexturePatternCache(): void {
  patternCache.clear();
}

/**
 * Genera o recupera un patrón repetible CanvasPattern para rellenar trazos con la textura seleccionada.
 * Ancla la textura a las coordenadas del lienzo (World-space), permitiendo que la trama,
 * el grano, el carbón y la tela se proyecten con nitidez milimétrica en cualquier grosor de pincel
 * sin sufrir de saturación destructiva por solapamiento de sellos.
 */
export function getOrCreateTexturePattern(
  ctx: CanvasRenderingContext2D,
  textureConfig: BrushTextureConfig | undefined,
  colorHex: string
): CanvasPattern | null {
  if (!textureConfig || textureConfig.id === 'none' || textureConfig.depth <= 0.01) {
    return null;
  }

  const depthKey = textureConfig.depth.toFixed(2);
  const scaleKey = (textureConfig.scale || 1.0).toFixed(2);
  const cacheKey = `${textureConfig.id}_${colorHex.toLowerCase()}_${depthKey}_${scaleKey}`;

  const cached = patternCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // Dimensión en mosaico (64x64 px potencia de dos para GPU)
  const patternSize = 64;
  let patternCanvas: HTMLCanvasElement | null = null;
  
  if (typeof document !== 'undefined') {
    patternCanvas = document.createElement('canvas');
    patternCanvas.width = patternSize;
    patternCanvas.height = patternSize;
  }

  if (!patternCanvas) {
    return null;
  }

  const pCtx = patternCanvas.getContext('2d');
  if (!pCtx) {
    return null;
  }

  const imgData = pCtx.createImageData(patternSize, patternSize);
  const data = imgData.data;
  const rgb = parseHexToRgb(colorHex);
  const depth = textureConfig.depth;

  for (let y = 0; y < patternSize; y++) {
    for (let x = 0; x < patternSize; x++) {
      let texVal = 1.0;

      if (textureConfig.id === 'grain') {
        const n = pseudoNoise2D(x * 2.2, y * 2.2);
        texVal = n > 0.40 ? 0.95 : 0.12;
      } else if (textureConfig.id === 'rough') {
        const bx = Math.floor(x * 0.4);
        const by = Math.floor(y * 0.4);
        const b = pseudoNoise2D(bx, by);
        const micro = pseudoNoise2D(Math.floor(x * 1.6), Math.floor(y * 1.6)) * 0.2;
        texVal = b > 0.45 ? 0.95 : (0.15 + micro);
      } else if (textureConfig.id === 'screentone') {
        // Trama Manga: diagonales a 45° limpias (periodo 8 divide exactamente a 64)
        const rot = (x * 0.7071 + y * 0.7071);
        const period = 8.0;
        const mod = (Math.abs(rot) + 1000) % period;
        texVal = mod < 3.8 ? 0.95 : 0.05;
      } else if (textureConfig.id === 'splatter') {
        const drop = pseudoNoise2D(Math.floor(x * 0.7), Math.floor(y * 0.7));
        const micro = pseudoNoise2D(Math.floor(x * 2.5), Math.floor(y * 2.5));
        texVal = (drop > 0.58 && micro > 0.35) ? 0.95 : 0.10;
      } else if (textureConfig.id === 'paper' || textureConfig.id === 'watercolor_paper') {
        const fiber = (Math.sin((x / patternSize) * Math.PI * 4) + Math.cos((y / patternSize) * Math.PI * 4)) * 0.3;
        const noise = pseudoNoise2D(Math.floor(x * 1.2), Math.floor(y * 1.2)) * 0.4;
        const val = 0.5 + fiber + noise;
        texVal = val > 0.45 ? Math.min(1.0, val) : 0.15;
      } else if (textureConfig.id === 'canvas') {
        // Tela: urdimbre y trama ortogonal (periodo 8 divide a 64)
        const period = 8.0;
        const modX = Math.abs(x) % period;
        const modY = Math.abs(y) % period;
        const isThread = (modX < 2.5) || (modY < 2.5);
        texVal = isThread ? 0.95 : 0.15;
      } else if (textureConfig.id === 'watercolor') {
        const wash = Math.sin((x / patternSize) * Math.PI * 4) * 0.25 + Math.cos((y / patternSize) * Math.PI * 4) * 0.25;
        texVal = Math.max(0.2, Math.min(1.0, 0.7 + wash));
      } else if (textureConfig.id === 'charcoal' || textureConfig.id === 'charcoal_noise') {
        const c1 = pseudoNoise2D(Math.floor(x * 1.8), Math.floor(y * 1.8));
        const c2 = pseudoNoise2D(Math.floor(x * 3.2), Math.floor(y * 3.2));
        const combined = c1 * 0.6 + c2 * 0.4;
        texVal = combined > 0.42 ? 0.95 : 0.05;
      }

      // El canal alfa del patrón modula la presencia del pigmento
      const alpha = Math.max(0, Math.min(255, Math.round(255 * (1.0 - depth * (1.0 - texVal)))));

      const idx = (y * patternSize + x) * 4;
      data[idx] = rgb.r;
      data[idx + 1] = rgb.g;
      data[idx + 2] = rgb.b;
      data[idx + 3] = alpha;
    }
  }

  pCtx.putImageData(imgData, 0, 0);

  try {
    const pattern = ctx.createPattern(patternCanvas, 'repeat');
    if (pattern) {
      if (patternCache.size > 20) {
        patternCache.clear();
      }
      patternCache.set(cacheKey, pattern);
      return pattern;
    }
  } catch {
    // Entorno de test o soporte limitado
  }

  return null;
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

  // Evaluación de contraste inteligente
  const rgb = parseHexToRgb(colorHex);
  const lum = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  const effectiveColor = (isWhitePaper && lum > 0.85) ? '#1E293B' : colorHex;

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
    const x = 24 + t * (width - 48);
    const y = (height * 0.5) + Math.sin(t * Math.PI * 2) * (height * 0.26);

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

/**
 * Renderiza la muestra del trazo ondeado para las tarjetas individuales de textura.
 * Utiliza generación analítica por píxel de alto contraste sobre un buffer ImageData,
 * eliminando el problema de sobre-saturación de círculos superpuestos que hacía ver
 * todos los trazos como líneas negras uniformes.
 */
export function renderMiniStrokePreview(
  canvas: HTMLCanvasElement,
  textureId: BrushTextureId,
  colorHex: string = '#18181b',
  depth: number = 0.8,
  scale: number = 1.0
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;

  // Crear ImageData para renderizado nítido píxel por píxel
  const imgData = ctx.createImageData(width, height);
  const data = imgData.data;

  // Llenar fondo blanco puro
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255;     // R
    data[i + 1] = 255; // G
    data[i + 2] = 255; // B
    data[i + 3] = 255; // A
  }

  const rgb = parseHexToRgb(colorHex);
  const targetR = rgb.r;
  const targetG = rgb.g;
  const targetB = rgb.b;

  const marginX = 8;
  const activeW = width - marginX * 2;
  const centerY = height * 0.5;
  const waveAmp = height * 0.22;
  const baseRadius = 5.2;

  // Recorrer cada columna x
  for (let x = 0; x < width; x++) {
    if (x < marginX || x >= width - marginX) continue;

    const u = (x - marginX) / activeW; // 0..1
    // Curva senoidal elegante en S
    const curveY = centerY + Math.sin(u * Math.PI * 2) * waveAmp;

    // Modulación caligráfica: puntas afiladas, centro con cuerpo
    const envelope = Math.sin(u * Math.PI);
    const radius = Math.max(1.8, baseRadius * (0.35 + 0.65 * envelope));

    const minY = Math.max(0, Math.floor(curveY - radius - 2));
    const maxY = Math.min(height - 1, Math.ceil(curveY + radius + 2));

    for (let y = minY; y <= maxY; y++) {
      const dy = Math.abs(y - curveY);
      if (dy > radius + 0.8) continue;

      // Antialiasing en el contorno del trazo
      const edgeFactor = Math.min(1.0, Math.max(0.0, (radius + 0.8 - dy) / 0.8));

      // Evaluación nítida de textura de superficie
      let texVal = 1.0;

      if (textureId === 'none') {
        texVal = 1.0;
      } else if (textureId === 'grain') {
        // Grano fino de lápiz: ruido de alta frecuencia
        const n = pseudoNoise2D(x * 2.2, y * 2.2);
        texVal = n > 0.40 ? 0.95 : 0.12;
      } else if (textureId === 'rough') {
        // Rugosa: bloques angulares y relieve marcado
        const bx = Math.floor(x * 0.4);
        const by = Math.floor(y * 0.4);
        const b = pseudoNoise2D(bx, by);
        const micro = pseudoNoise2D(Math.floor(x * 1.6), Math.floor(y * 1.6)) * 0.2;
        texVal = b > 0.45 ? 0.95 : (0.15 + micro);
      } else if (textureId === 'screentone') {
        // Trama Manga: diagonales a 45° limpias con espacios en blanco contrastados
        const rot = (x * 0.7071 + y * 0.7071);
        const period = 5.2;
        const mod = (Math.abs(rot) + 100) % period;
        texVal = mod < 2.3 ? 0.95 : 0.05;
      } else if (textureId === 'splatter') {
        // Salpicada: microgotas estocásticas y salpicaduras
        const drop = pseudoNoise2D(Math.floor(x * 0.7), Math.floor(y * 0.7));
        const micro = pseudoNoise2D(Math.floor(x * 2.5), Math.floor(y * 2.5));
        texVal = (drop > 0.58 && micro > 0.35) ? 0.95 : 0.10;
      } else if (textureId === 'paper' || textureId === 'watercolor_paper') {
        // Fibras de papel Canson: vetas longitudinales suaves
        const fiber = (Math.sin(x * 0.35) + Math.cos(y * 0.2)) * 0.3;
        const noise = pseudoNoise2D(Math.floor(x * 1.2), Math.floor(y * 1.2)) * 0.4;
        const val = 0.5 + fiber + noise;
        texVal = val > 0.45 ? Math.min(1.0, val) : 0.15;
      } else if (textureId === 'canvas') {
        // Tela: urdimbre y trama ortogonal textil estilo lino
        const period = 5.0;
        const modX = Math.abs(x) % period;
        const modY = Math.abs(y) % period;
        const isThread = (modX < 1.6) || (modY < 1.6);
        texVal = isThread ? 0.95 : 0.15;
      } else if (textureId === 'watercolor') {
        // Acuarela: bordes oscuros de pigmento húmedo y centro translúcido
        const normDist = dy / radius; // 0 centro, 1 borde
        const edgeDarkening = normDist > 0.65 ? 0.95 : 0.55;
        const wash = Math.sin(x * 0.25) * 0.2;
        texVal = Math.max(0.2, Math.min(1.0, edgeDarkening + wash));
      } else if (textureId === 'charcoal' || textureId === 'charcoal_noise') {
        // Carbón: polvo seco y desgranado con poros vacíos
        const c1 = pseudoNoise2D(Math.floor(x * 1.8), Math.floor(y * 1.8));
        const c2 = pseudoNoise2D(Math.floor(x * 3.2), Math.floor(y * 3.2));
        const combined = c1 * 0.6 + c2 * 0.4;
        texVal = combined > 0.42 ? 0.95 : 0.05;
      }

      // Aplicar profundidad
      const effDepth = textureId === 'none' ? 0.0 : depth;
      const darkness = edgeFactor * (1.0 - effDepth * (1.0 - texVal));

      const idx = (y * width + x) * 4;
      // Mezclar con el fondo blanco (255)
      data[idx] = Math.round(255 - darkness * (255 - targetR));
      data[idx + 1] = Math.round(255 - darkness * (255 - targetG));
      data[idx + 2] = Math.round(255 - darkness * (255 - targetB));
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // Borde sutil del recuadro
  ctx.strokeStyle = '#e2ddea';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, width - 1, height - 1);
}

