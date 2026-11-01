/**
 * @file strokeAssistant.ts
 * @description Lógica pura y reglas de ilustración para el Asistente Inteligente de Grosor de Trazo.
 * 
 * En ilustración digital, manga y calco profesional (estilo IbisPaint/ClipStudio),
 * el peso de línea (line-weight) define la profundidad, volumen y jerarquía visual:
 * 1. Silueta / Contorno Exterior (P92): Línea perimetral gruesa que despega al personaje del fondo.
 * 2. Estructura / Ropa / Cabello (P68): Líneas intermedias para volumen anatómico y pliegues.
 * 3. Detalles / Rostro / Ojos (P38): Líneas finas para expresiones, pupilas, nariz y dedos.
 * 4. Micro-Trazo / Tramas / Achurado (P12): Líneas microscópicas para sombras cruzadas y texturas.
 * 
 * Este módulo analiza directamente los píxeles de la foto de calco o imagen de referencia
 * para medir la distribución física real del grosor de trazo y recomendar los valores exactos
 * sin forzar al usuario.
 */

export type StrokeRoleType = 'silhouette' | 'structure' | 'details' | 'hatching';

export interface StrokeRoleInfo {
  id: StrokeRoleType;
  title: string;
  shortLabel: string;
  recommendedPx: number;
  minPx: number;
  maxPx: number;
  badge: string;
  description: string;
  exampleUses: string[];
  isCalibrated?: boolean;
}

/**
 * Perfil analítico resultante del análisis por visión artificial de una imagen de referencia
 */
export interface ImageStrokeAnalysis {
  silhouettePx: number;
  structurePx: number;
  detailsPx: number;
  hatchingPx: number;
  minDetectedPx: number;
  maxDetectedPx: number;
  averagePx: number;
  sampledEdgesCount: number;
  isImageCalibrated: boolean;
}

export const CANONICAL_STROKE_ROLES: StrokeRoleInfo[] = [
  {
    id: 'silhouette',
    title: 'Silueta y Contorno Exterior',
    shortLabel: 'Silueta',
    recommendedPx: 24,
    minPx: 19,
    maxPx: 48,
    badge: '24px • Grueso',
    description: 'Borde perimetral exterior que despega la figura del fondo y aporta peso visual.',
    exampleUses: ['Contorno general del personaje', 'Borde exterior de cabello', 'Líneas de choque'],
    isCalibrated: false,
  },
  {
    id: 'structure',
    title: 'Estructura, Ropa y Cabello',
    shortLabel: 'Estructura',
    recommendedPx: 14,
    minPx: 10,
    maxPx: 18,
    badge: '14px • Medio',
    description: 'Líneas principales internas para delimitar prendas de ropa, mechones y articulaciones.',
    exampleUses: ['Pliegues de tela', 'Mechones de cabello', 'Contornos corporales internos'],
    isCalibrated: false,
  },
  {
    id: 'details',
    title: 'Detalles, Rostro y Ojos',
    shortLabel: 'Detalles',
    recommendedPx: 6,
    minPx: 4,
    maxPx: 9,
    badge: '6px • Fino',
    description: 'Trazo expresivo de precisión para facciones del rostro, iris, pestañas y manos.',
    exampleUses: ['Ojos y pupilas', 'Pestañas y cejas', 'Nariz, labios y dedos'],
    isCalibrated: false,
  },
  {
    id: 'hatching',
    title: 'Tramas, Achurado y Texturas',
    shortLabel: 'Tramas',
    recommendedPx: 2,
    minPx: 1,
    maxPx: 3,
    badge: '2px • Micro',
    description: 'Micro-líneas de máxima precisión para degradados manuales estilo manga y sombreados.',
    exampleUses: ['Sombreado cruzado manga', 'Brillos finos', 'Costuras y tramas'],
    isCalibrated: false,
  },
];

/**
 * Analiza una imagen RGBA para calcular el grosor real de las líneas de dibujo.
 * Mide secciones transversales ortogonales y calcula percentiles reales (Silueta, Estructura, Detalles, Tramas).
 */
export function analyzeImageStrokeThickness(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  imageScale: number = 1.0
): ImageStrokeAnalysis {
  const safeScale = Math.max(0.1, imageScale);

  if (!pixels || width <= 2 || height <= 2 || pixels.length < width * height * 4) {
    return {
      silhouettePx: Math.round(24 * safeScale),
      structurePx: Math.round(14 * safeScale),
      detailsPx: Math.max(3, Math.round(6 * safeScale)),
      hatchingPx: Math.max(1, Math.round(2 * safeScale)),
      minDetectedPx: 1,
      maxDetectedPx: 32,
      averagePx: 10,
      sampledEdgesCount: 0,
      isImageCalibrated: false,
    };
  }

  const totalPixels = width * height;
  const luminance = new Uint8Array(totalPixels);

  // 1. Escala de grises por luminancia BT.709
  for (let i = 0, p = 0; p < totalPixels; i += 4, p++) {
    const a = pixels[i + 3];
    if (a < 64) {
      luminance[p] = 255; // Fondo transparente = claro
    } else {
      luminance[p] = (pixels[i] * 54 + pixels[i + 1] * 183 + pixels[i + 2] * 19) >> 8;
    }
  }

  // 2. Muestreo de trazos oscuros y cálculo de anchura transversal
  const detectedWidths: number[] = [];
  const stepY = Math.max(2, Math.floor(height / 160));
  const stepX = Math.max(2, Math.floor(width / 160));

  for (let y = 2; y < height - 2; y += stepY) {
    const rowOffset = y * width;
    for (let x = 2; x < width - 2; x += stepX) {
      const lum = luminance[rowOffset + x];
      if (lum > 140) continue; // Solo píxeles de línea o trazo

      // Ancho horizontal
      let lx = x;
      while (lx > 0 && luminance[rowOffset + lx] <= 155 && x - lx < 70) lx--;
      let rx = x;
      while (rx < width - 1 && luminance[rowOffset + rx] <= 155 && rx - x < 70) rx++;
      const spanH = rx - lx;

      // Ancho vertical
      let ty = y;
      while (ty > 0 && luminance[ty * width + x] <= 155 && y - ty < 70) ty--;
      let by = y;
      while (by < height - 1 && luminance[by * width + x] <= 155 && by - y < 70) by++;
      const spanV = by - ty;

      // El grosor de una línea es el menor de los dos ejes ortogonales
      const localThickness = Math.min(spanH, spanV);
      if (localThickness >= 1 && localThickness <= 60) {
        detectedWidths.push(localThickness * safeScale);
      }
    }
  }

  // Si no hay suficientes trazos (ejemplo: foto vacía o fondo liso)
  if (detectedWidths.length < 8) {
    return {
      silhouettePx: Math.max(16, Math.round(24 * safeScale)),
      structurePx: Math.max(8, Math.round(14 * safeScale)),
      detailsPx: Math.max(3, Math.round(6 * safeScale)),
      hatchingPx: Math.max(1, Math.round(2 * safeScale)),
      minDetectedPx: 1,
      maxDetectedPx: 32,
      averagePx: 10,
      sampledEdgesCount: detectedWidths.length,
      isImageCalibrated: false,
    };
  }

  // 3. Ordenar para percentiles
  detectedWidths.sort((a, b) => a - b);

  const getPercentile = (p: number): number => {
    const idx = Math.min(detectedWidths.length - 1, Math.max(0, Math.floor(p * (detectedWidths.length - 1))));
    return detectedWidths[idx];
  };

  // Silueta: Contornos más gruesos (P92)
  const sil = Math.min(64, Math.max(14, Math.round(getPercentile(0.92))));
  // Estructura: Líneas intermedias de ropa/cuerpo (P68)
  const str = Math.min(sil - 2, Math.max(7, Math.round(getPercentile(0.68))));
  // Detalles: Facciones del rostro, ojos (P38)
  const det = Math.min(str - 2, Math.max(3, Math.round(getPercentile(0.38))));
  // Tramas: Sombreado y líneas mínimas (P12)
  const hat = Math.min(det - 1, Math.max(1, Math.round(getPercentile(0.12))));

  const sum = detectedWidths.reduce((acc, v) => acc + v, 0);

  return {
    silhouettePx: Math.max(14, sil),
    structurePx: Math.max(8, str),
    detailsPx: Math.max(3, det),
    hatchingPx: Math.max(1, hat),
    minDetectedPx: Number(detectedWidths[0].toFixed(1)),
    maxDetectedPx: Number(detectedWidths[detectedWidths.length - 1].toFixed(1)),
    averagePx: Number((sum / detectedWidths.length).toFixed(1)),
    sampledEdgesCount: detectedWidths.length,
    isImageCalibrated: true,
  };
}

/**
 * Muestrea el grosor exacto de trazo en un punto específico tocado por el usuario
 */
export function sampleStrokeThicknessAtPoint(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  ptX: number,
  ptY: number,
  imageScale: number = 1.0
): number | null {
  const x = Math.floor(ptX);
  const y = Math.floor(ptY);
  if (x < 0 || x >= width || y < 0 || y >= height) return null;

  const idx = (y * width + x) * 4;
  if (idx + 3 >= pixels.length) return null;

  // Comprobar luminancia
  const lum = (pixels[idx] * 54 + pixels[idx + 1] * 183 + pixels[idx + 2] * 19) >> 8;
  if (lum > 165) return null; // No es trazo oscuro

  let lx = x;
  while (lx > 0 && ((pixels[(y * width + lx) * 4] * 54 + pixels[(y * width + lx) * 4 + 1] * 183 + pixels[(y * width + lx) * 4 + 2] * 19) >> 8) <= 165 && x - lx < 60) lx--;
  let rx = x;
  while (rx < width - 1 && ((pixels[(y * width + rx) * 4] * 54 + pixels[(y * width + rx) * 4 + 1] * 183 + pixels[(y * width + rx) * 4 + 2] * 19) >> 8) <= 165 && rx - x < 60) rx++;

  let ty = y;
  while (ty > 0 && ((pixels[(ty * width + x) * 4] * 54 + pixels[(ty * width + x) * 4 + 1] * 183 + pixels[(ty * width + x) * 4 + 2] * 19) >> 8) <= 165 && y - ty < 60) ty--;
  let by = y;
  while (by < height - 1 && ((pixels[(by * width + x) * 4] * 54 + pixels[(by * width + x) * 4 + 1] * 183 + pixels[(by * width + x) * 4 + 2] * 19) >> 8) <= 165 && by - y < 60) by++;

  const rawThick = Math.min(rx - lx, by - ty);
  if (rawThick < 1) return null;

  return Math.max(1, Math.round(rawThick * imageScale));
}

/**
 * Devuelve la lista de roles ajustada con los grosores reales analizados de la imagen
 */
export function getCalibratedStrokeRoles(analysis: ImageStrokeAnalysis | null): StrokeRoleInfo[] {
  if (!analysis || !analysis.isImageCalibrated) {
    return CANONICAL_STROKE_ROLES;
  }

  return [
    {
      id: 'silhouette',
      title: 'Silueta y Contorno Exterior',
      shortLabel: 'Silueta',
      recommendedPx: analysis.silhouettePx,
      minPx: Math.max(10, Math.round(analysis.structurePx * 1.1)),
      maxPx: Math.max(48, Math.round(analysis.silhouettePx * 1.5)),
      badge: `${analysis.silhouettePx}px • Calibrado`,
      description: 'Grosor medido del contorno exterior de tu imagen de referencia.',
      exampleUses: ['Borde exterior medido en foto', 'Contorno de personaje', 'Silueta'],
      isCalibrated: true,
    },
    {
      id: 'structure',
      title: 'Estructura, Ropa y Cabello',
      shortLabel: 'Estructura',
      recommendedPx: analysis.structurePx,
      minPx: Math.max(6, Math.round(analysis.detailsPx * 1.1)),
      maxPx: Math.max(18, analysis.silhouettePx - 1),
      badge: `${analysis.structurePx}px • Calibrado`,
      description: 'Grosor medido para pliegues de ropa y masas de cabello de tu foto.',
      exampleUses: ['Pliegues de tela de la foto', 'Mechones de pelo', 'Articulaciones'],
      isCalibrated: true,
    },
    {
      id: 'details',
      title: 'Detalles, Rostro y Ojos',
      shortLabel: 'Detalles',
      recommendedPx: analysis.detailsPx,
      minPx: Math.max(2, Math.round(analysis.hatchingPx * 1.1)),
      maxPx: Math.max(8, analysis.structurePx - 1),
      badge: `${analysis.detailsPx}px • Calibrado`,
      description: 'Grosor medido para facciones del rostro, ojos, nariz y labios de la foto.',
      exampleUses: ['Ojos y pestañas medidos', 'Nariz y labios', 'Dedos'],
      isCalibrated: true,
    },
    {
      id: 'hatching',
      title: 'Tramas, Achurado y Texturas',
      shortLabel: 'Tramas',
      recommendedPx: analysis.hatchingPx,
      minPx: 1,
      maxPx: Math.max(3, analysis.detailsPx - 1),
      badge: `${analysis.hatchingPx}px • Calibrado`,
      description: 'Micro-línea medida para texturas y sombreados finos en la imagen.',
      exampleUses: ['Tramas de la foto', 'Sombreados', 'Líneas finas'],
      isCalibrated: true,
    },
  ];
}

/**
 * Determina el rol de ilustración correspondiente a un grosor en píxeles.
 */
export function detectRoleFromSize(sizePx: number, analysis?: ImageStrokeAnalysis | null): StrokeRoleType {
  const roles = getCalibratedStrokeRoles(analysis || null);
  const sil = roles.find(r => r.id === 'silhouette')!.recommendedPx;
  const str = roles.find(r => r.id === 'structure')!.recommendedPx;
  const det = roles.find(r => r.id === 'details')!.recommendedPx;

  const thresholdSil = (sil + str) / 2;
  const thresholdStr = (str + det) / 2;
  const thresholdDet = (det + 1) / 2;

  if (sizePx >= thresholdSil) return 'silhouette';
  if (sizePx >= thresholdStr) return 'structure';
  if (sizePx >= thresholdDet) return 'details';
  return 'hatching';
}

/**
 * Devuelve la información completa del rol actual según el grosor en píxeles.
 */
export function getRoleInfoForSize(sizePx: number, analysis?: ImageStrokeAnalysis | null): StrokeRoleInfo {
  const roles = getCalibratedStrokeRoles(analysis || null);
  const roleType = detectRoleFromSize(sizePx, analysis);
  return roles.find(r => r.id === roleType) || roles[2];
}

/**
 * Obtiene el grosor exacto recomendado para un rol determinado.
 */
export function getRecommendedSizeForRole(roleType: StrokeRoleType, analysis?: ImageStrokeAnalysis | null): number {
  const roles = getCalibratedStrokeRoles(analysis || null);
  const found = roles.find(r => r.id === roleType);
  return found ? found.recommendedPx : 12;
}

/**
 * Genera un consejo contextual de grosor para la sesión de dibujo o calco actual.
 */
export function generateStrokeAdvice(
  currentSizePx: number,
  hasTracingReference: boolean,
  analysis?: ImageStrokeAnalysis | null
): {
  roleName: string;
  advice: string;
  isCalibrated: boolean;
} {
  const role = getRoleInfoForSize(currentSizePx, analysis);
  const isCalibrated = !!(analysis && analysis.isImageCalibrated);

  if (hasTracingReference) {
    if (isCalibrated) {
      switch (role.id) {
        case 'silhouette':
          return {
            roleName: role.shortLabel,
            advice: `Foto analizada: Silueta medida en ~${role.recommendedPx}px.`,
            isCalibrated: true,
          };
        case 'structure':
          return {
            roleName: role.shortLabel,
            advice: `Foto analizada: Ropa y pelo medidos en ~${role.recommendedPx}px.`,
            isCalibrated: true,
          };
        case 'details':
          return {
            roleName: role.shortLabel,
            advice: `Foto analizada: Facciones y ojos medidos en ~${role.recommendedPx}px.`,
            isCalibrated: true,
          };
        case 'hatching':
          return {
            roleName: role.shortLabel,
            advice: `Foto analizada: Micro-tramas medidas en ~${role.recommendedPx}px.`,
            isCalibrated: true,
          };
      }
    }

    switch (role.id) {
      case 'silhouette':
        return {
          roleName: role.shortLabel,
          advice: 'Ideal para calcar el contorno exterior del cuerpo y silueta general.',
          isCalibrated: false,
        };
      case 'structure':
        return {
          roleName: role.shortLabel,
          advice: 'Excelente para calcar los pliegues de ropa y los bloques principales de pelo.',
          isCalibrated: false,
        };
      case 'details':
        return {
          roleName: role.shortLabel,
          advice: 'Grosor perfecto para calcar ojos, cejas, nariz, boca y dedos con fidelidad.',
          isCalibrated: false,
        };
      case 'hatching':
        return {
          roleName: role.shortLabel,
          advice: 'Úsalo para calcar sombreados suaves y tramas finas del dibujo original.',
          isCalibrated: false,
        };
    }
  }

  return {
    roleName: role.shortLabel,
    advice: role.description,
    isCalibrated: false,
  };
}

export const STROKE_ROLES = CANONICAL_STROKE_ROLES;
