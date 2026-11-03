/**
 * @file webgpuEngine.ts
 * @description Motor de renderizado acelerado con WebGPU y fallback fluido para navegadores móviles.
 * 
 * Modularizado:
 * - Shaders WGSL extraídos a `shaders/brushShader.wgsl.ts`.
 * - Lógica de renderizado y composición Canvas 2D extraída a `renderers/canvas2dRenderer.ts`.
 * - Algoritmo Scanline Flood Fill y Cierre de Huecos delegado a `floodFillEngine.ts`.
 * - Caché de texturas VRAM delegada a `bitmapCache.ts`.
 */

import { Layer, Point, ToolType, TracingReference, BrushTextureConfig, VectorStroke } from './types';
import { BRUSH_WGSL_SHADER } from './shaders/brushShader.wgsl';
import { renderCanvas2DStrokeSegment, renderCanvas2DCompositeLayers } from './renderers/canvas2dRenderer';
import { 
  scanlineFloodFill, 
  dilateBinaryMask, 
  hexToRgb, 
  rgbToHex, 
  pickCanvasColor 
} from './floodFillEngine';

export { BRUSH_WGSL_SHADER, dilateBinaryMask, hexToRgb, rgbToHex, scanlineFloodFill, pickCanvasColor };

export class DrawingEngine {
  private device: GPUDevice | null = null;
  private adapter: GPUAdapter | null = null;
  private webgpuSupported = false;
  private webgpuActive = false;
  private adapterInfo = 'N/A';

  constructor() {
    this.initWebGPU();
  }

  public async initWebGPU(): Promise<boolean> {
    try {
      if (typeof navigator !== 'undefined' && 'gpu' in navigator && navigator.gpu) {
        this.adapter = await navigator.gpu.requestAdapter();
        if (this.adapter) {
          this.device = await this.adapter.requestDevice();
          this.webgpuSupported = true;
          this.webgpuActive = true;
          const adapterAny = this.adapter as unknown as { 
            info?: { vendor?: string; architecture?: string }; 
            requestAdapterInfo?: () => Promise<{ vendor?: string; architecture?: string }> 
          };
          const info = adapterAny.info || (adapterAny.requestAdapterInfo ? await adapterAny.requestAdapterInfo() : null);
          this.adapterInfo = info?.vendor || info?.architecture || 'Hardware WebGPU Device';
          return true;
        }
      }
    } catch {
      // Entorno sin soporte directo de WebGPU o banderas no habilitadas
    }
    this.webgpuSupported = false;
    this.webgpuActive = false;
    this.adapterInfo = 'Fallback 2D/WebGL2 Canvas Engine';
    return false;
  }

  public isWebGPUActive(): boolean {
    return this.webgpuActive;
  }

  public getAdapterInfo(): string {
    return this.adapterInfo;
  }

  /**
   * Dibuja un segmento de trazo entre dos puntos sobre la capa activa.
   * Delega al renderizador Canvas 2D con aceleración WebAssembly y dinámicas de textura.
   */
  public drawStrokeSegment(
    layer: Layer,
    p0: Point,
    p1: Point,
    tool: ToolType,
    colorHex: string,
    baseSize: number,
    baseOpacity: number,
    textureConfig?: BrushTextureConfig
  ): void {
    renderCanvas2DStrokeSegment(
      layer,
      p0,
      p1,
      tool,
      colorHex,
      baseSize,
      baseOpacity,
      textureConfig
    );
  }

  /**
   * Compone todas las capas visibles en el canvas principal con sus respectivos modos de fusión y opacidades.
   */
  public compositeLayers(
    targetCtx: CanvasRenderingContext2D,
    layers: Layer[],
    width: number,
    height: number,
    backgroundColor: string = '#ffffff',
    currentScale: number = 1.0,
    tracingRef?: TracingReference | null,
    liveVectorStroke?: VectorStroke | null
  ): void {
    renderCanvas2DCompositeLayers(
      targetCtx,
      layers,
      width,
      height,
      backgroundColor,
      currentScale,
      tracingRef,
      liveVectorStroke
    );
  }

  /**
   * Herramienta de Cubo de Pintura (Bucket Fill) con Expansión de Borde y Cierre de Huecos.
   */
  public floodFill(
    layer: Layer,
    startX: number,
    startY: number,
    fillColorHex: string,
    tolerance: number = 32,
    borderExpansion: number = 0,
    gapClosing: number = 0
  ): boolean {
    return scanlineFloodFill(layer, startX, startY, fillColorHex, tolerance, borderExpansion, gapClosing);
  }

  /**
   * Muestrea el color RGB en un punto específico de un canvas (Eyedropper).
   */
  public pickColor(ctx: CanvasRenderingContext2D, x: number, y: number): string {
    return pickCanvasColor(ctx, x, y);
  }

  public hexToRgb(hex: string): { r: number; g: number; b: number } {
    return hexToRgb(hex);
  }

  public rgbToHex(r: number, g: number, b: number): string {
    return rgbToHex(r, g, b);
  }
}

export const drawingEngine = new DrawingEngine();
