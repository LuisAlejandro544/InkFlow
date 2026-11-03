/**
 * @file types.ts
 * @description Definición de tipos fundamentales para el motor gráfico de dibujo IbisPaint Studio.
 * Contiene estructuras de datos para capas, herramientas, trazos, puntos con presión,
 * modos de fusión (blend modes) y configuración del motor WebGPU / WebAssembly.
 */

export type ToolType = 
  | 'brush'          // Pincel estándar
  | 'vector_pencil'  // Lápiz vectorial impulsado por Kotlin/Wasm (cero píxeles al hacer zoom)
  | 'eraser'         // Goma de borrar
  | 'airbrush'       // Aerógrafo con desvanecimiento radial
  | 'pencil'         // Lápiz de grafito texturizado
  | 'marker'         // Resaltador con transparencia fija
  | 'bucket'         // Cubo de pintura para rellenar áreas
  | 'eyedropper'     // Cuentagotas para seleccionar color
  | 'hand';          // Mano para desplazarse libremente por el lienzo y hacer zoom

export type BlendMode = 
  | 'source-over' // Normal
  | 'multiply'    // Multiplicar (sombra / entintado)
  | 'screen'      // Pantalla (luces)
  | 'overlay'     // Superponer (contraste)
  | 'lighter';    // Añadir / Resplandor (glow)

/**
 * Identificadores del catálogo de texturas de superficie del trazo
 */
export type BrushTextureId = 
  | 'none'              // Lisa (trazo sólido normal)
  | 'grain'             // Grano fino homogéneo estocástico
  | 'rough'             // Rugosa con relieve y bloques irregulares
  | 'screentone'        // Trama diagonal manga a 45 grados
  | 'splatter'          // Salpicada con micro-gotas de spray
  | 'paper'             // Papel tradicional con fibras
  | 'canvas'            // Tela con textura textil cruzada
  | 'watercolor'        // Acuarela con lavado orgánico
  | 'charcoal'          // Carbón poroso desgranado
  | 'watercolor_paper'  // Alias de compatibilidad
  | 'charcoal_noise';   // Alias de compatibilidad

/**
 * Configuración activa de la textura de pincel
 */
export interface BrushTextureConfig {
  id: BrushTextureId;
  name: string;
  scale: number; // 0.5 a 3.0 (zoom del grano)
  depth: number; // 0.1 a 1.0 (intensidad / profundidad de textura)
}

export const DEFAULT_BRUSH_TEXTURE: BrushTextureConfig = {
  id: 'none',
  name: 'Lisa',
  scale: 1.0,
  depth: 0.65,
};

export interface Point {
  x: number;
  y: number;
  pressure: number; // 0.0 a 1.0 (sensibilidad de lápiz óptico o simulada por velocidad)
  timestamp?: number;
}

/**
 * Representación matemática de un segmento de curva de Bézier cúbica para el lápiz vectorial
 */
export interface BezierSegment {
  p0: Point;
  cp1: Point;
  cp2: Point;
  p1: Point;
  width0: number;
  width1: number;
}

/**
 * Trazo vectorial continuo procesado por Kotlin/Wasm para renderizado libre de píxeles al hacer zoom
 */
export interface VectorStroke {
  id: string;
  layerId: string;
  color: string;
  baseSize: number;
  opacity: number;
  points: Point[];
  segments: BezierSegment[];
  createdAt: number;
}

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number; // 0.0 a 1.0
  blendMode: BlendMode;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  thumbnailUrl?: string;
  locked?: boolean;
}

export interface ProjectData {
  id: string;
  name: string;
  width: number;
  height: number;
  createdAt: number;
  updatedAt: number;
  thumbnailUrl: string;
  layerCount: number;
}

export interface EngineDiagnostics {
  webgpuSupported: boolean;
  webgpuActive: boolean;
  adapterName: string;
  wasmLoaded: boolean;
  kotlinWasmActive: boolean;
  wasmExecutionTimeMs: number;
  fps: number;
  stabilizerLevel: number;
}

export type TracingFilterMode = 'original' | 'lineart' | 'grayscale' | 'contrast';

export interface TracingReference {
  id: string;
  image: HTMLImageElement;
  src: string;
  x: number;          // Posición central X en coordenadas de lienzo
  y: number;          // Posición central Y en coordenadas de lienzo
  width: number;      // Ancho nativo en píxeles
  height: number;     // Alto nativo en píxeles
  scale: number;      // Multiplicador de escala
  rotation: number;   // Rotación en radianes
  opacity: number;    // 0.05 a 1.0 (0.4 por defecto)
  visible: boolean;
  isAdjusting: boolean; // Si está activo el modo interactivo de mover/escalar con tiradores
  filterMode: TracingFilterMode;
  purpose?: 'tracing' | 'accessory'; // Calco transparente de guía o Accesorio/Sticker para estampar en la obra
  extractedColors?: string[]; // Colores dominantes extraídos por Wasm
  strokeAnalysis?: {
    silhouettePx: number;
    structurePx: number;
    detailsPx: number;
    hatchingPx: number;
    minDetectedPx: number;
    maxDetectedPx: number;
    averagePx: number;
    sampledEdgesCount: number;
    isImageCalibrated: boolean;
  };
}

