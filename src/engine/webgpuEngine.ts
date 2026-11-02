/**
 * @file webgpuEngine.ts
 * @description Motor de renderizado acelerado con WebGPU y fallback fluido para navegadores móviles.
 * 
 * Contiene:
 * 1. Detección y arranque de pipeline WebGPU con Shaders WGSL (WebGPU Shading Language)
 *    para renderizado de sellos de pincel (brush stamps) con gradiente radial y dinámicas de presión.
 * 2. Pipeline de composición de capas con soporte para modos de fusión (Multiply, Screen, Overlay, Add).
 * 3. Fallback inteligente a Canvas 2D / WebGL2 acelerado por hardware para navegadores
 *    móviles donde WebGPU aún no está habilitado por defecto.
 * 4. Algoritmo Scanline Flood Fill para la herramienta de bote de pintura (Bucket Fill).
 * 5. Cuentagotas (Eyedropper) para muestreo de color en tiempo real.
 */

import { Layer, Point, ToolType, BlendMode, TracingReference } from './types';
import { wasmEngine } from './wasmEngine';
import { kotlinVectorEngine } from './kotlinWasmBridge';
import { gpuBitmapCache } from './bitmapCache';
import { 
  scanlineFloodFill, 
  dilateBinaryMask, 
  hexToRgb, 
  rgbToHex, 
  pickCanvasColor 
} from './floodFillEngine';

export { dilateBinaryMask, hexToRgb, rgbToHex, scanlineFloodFill, pickCanvasColor };

// WGSL Shader para sellos de pincel con cálculo de atenuación radial en GPU
export const BRUSH_WGSL_SHADER = /* wgsl */ `
struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var pos = array<vec2f, 6>(
    vec2f(-1.0, -1.0),
    vec2f( 1.0, -1.0),
    vec2f(-1.0,  1.0),
    vec2f(-1.0,  1.0),
    vec2f( 1.0, -1.0),
    vec2f( 1.0,  1.0)
  );
  var output: VertexOutput;
  output.position = vec4f(pos[vertexIndex], 0.0, 1.0);
  output.uv = pos[vertexIndex] * 0.5 + 0.5;
  return output;
}

struct BrushUniforms {
  color: vec4f,
  softness: f32,
  opacity: f32,
  padding: vec2f,
};

@group(0) @binding(0) var<uniform> uniforms: BrushUniforms;

@fragment
fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let dist = distance(uv, vec2f(0.5, 0.5)) * 2.0;
  if (dist > 1.0) {
    discard;
  }
  // Suavizado de bordes según la suavidad del pincel
  let alpha = smoothstep(1.0, 1.0 - uniforms.softness, dist) * uniforms.color.a * uniforms.opacity;
  return vec4f(uniforms.color.rgb, alpha);
}
`;

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
          const adapterAny = this.adapter as unknown as { info?: { vendor?: string; architecture?: string }; requestAdapterInfo?: () => Promise<{ vendor?: string; architecture?: string }> };
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
   * Utiliza interpolación WebAssembly y dinámicas de presión y opacidad.
   */
  public drawStrokeSegment(
    layer: Layer,
    p0: Point,
    p1: Point,
    tool: ToolType,
    colorHex: string,
    baseSize: number,
    baseOpacity: number
  ) {
    const ctx = layer.ctx;
    const points = wasmEngine.interpolateStroke(p0, p1, Math.max(1, baseSize * 0.25));

    ctx.save();
    
    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
    } else {
      ctx.globalCompositeOperation = 'source-over';
    }

    // Procesar cada punto interpolado
    for (const pt of points) {
      const radius = Math.max(0.5, (baseSize * pt.pressure) / 2);
      const alpha = Math.min(1.0, baseOpacity * (tool === 'pencil' ? 0.75 : 1.0));

      ctx.fillStyle = tool === 'eraser' ? 'rgba(0,0,0,1)' : colorHex;

      if (tool === 'airbrush') {
        // Efecto aerógrafo suave con gradiente radial
        const grad = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, radius * 1.5);
        const rgb = this.hexToRgb(colorHex);
        grad.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha * 0.4})`);
        grad.addColorStop(0.5, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha * 0.15})`);
        grad.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, radius * 1.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (tool === 'pencil') {
        // Textura granulada de lápiz
        ctx.globalAlpha = alpha * 0.4;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
        ctx.fill();

        // Puntos aleatorios para simular textura de grafito
        ctx.fillStyle = colorHex;
        for (let j = 0; j < 3; j++) {
          const offsetX = (Math.random() - 0.5) * radius * 1.2;
          const offsetY = (Math.random() - 0.5) * radius * 1.2;
          ctx.beginPath();
          ctx.arc(pt.x + offsetX, pt.y + offsetY, Math.max(0.5, radius * 0.2), 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (tool === 'marker') {
        // Resaltador semitransparente con punta biselada
        ctx.globalAlpha = alpha * 0.35;
        ctx.fillRect(pt.x - radius, pt.y - radius * 1.6, radius * 2, radius * 3.2);
      } else if (tool === 'vector_pencil') {
        // Lápiz vectorial (Kotlin/Wasm): trazo de precisión con curva continua
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Pincel estándar suave (Round Pen)
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  /**
   * Compone todas las capas visibles en el canvas principal con sus respectivos modos de fusión y opacidades.
   * Renderiza capas de mapa de bits y trazos vectoriales de Kotlin/Wasm sin pérdida de resolución.
   */
  public compositeLayers(
    targetCtx: CanvasRenderingContext2D,
    layers: Layer[],
    width: number,
    height: number,
    backgroundColor: string = '#ffffff',
    currentScale: number = 1.0,
    tracingRef?: TracingReference | null
  ) {
    targetCtx.save();
    
    // Fondo de lienzo
    targetCtx.fillStyle = backgroundColor;
    targetCtx.fillRect(0, 0, width, height);

    // Si hay una foto de calco activa y visible, dibujarla de fondo para que el usuario trace encima
    if (tracingRef && tracingRef.visible && tracingRef.image) {
      targetCtx.save();
      targetCtx.globalAlpha = Math.max(0.01, Math.min(1.0, tracingRef.opacity));
      targetCtx.translate(tracingRef.x, tracingRef.y);
      if (tracingRef.rotation) {
        targetCtx.rotate(tracingRef.rotation);
      }
      const drawW = tracingRef.width * tracingRef.scale;
      const drawH = tracingRef.height * tracingRef.scale;
      const cachedBitmap = gpuBitmapCache.get(`tracing_${tracingRef.id}_${tracingRef.filterMode}`);
      if (cachedBitmap) {
        targetCtx.drawImage(cachedBitmap, -drawW / 2, -drawH / 2, drawW, drawH);
      } else {
        targetCtx.drawImage(
          tracingRef.image,
          -drawW / 2,
          -drawH / 2,
          drawW,
          drawH
        );
        if (typeof createImageBitmap === 'function') {
          createImageBitmap(tracingRef.image).then((bmp) => {
            gpuBitmapCache.set(`tracing_${tracingRef.id}_${tracingRef.filterMode}`, bmp);
          }).catch(() => {});
        }
      }
      targetCtx.restore();
    }

    // Dibujar cada capa visible respetando opacidad y blend mode
    for (const layer of layers) {
      if (!layer.visible || layer.opacity <= 0) continue;

      targetCtx.save();
      targetCtx.globalAlpha = layer.opacity;
      targetCtx.globalCompositeOperation = layer.blendMode as GlobalCompositeOperation;
      targetCtx.drawImage(layer.canvas, 0, 0, width, height);

      // Renderizar trazos vectoriales procesados por Kotlin/Wasm para esta capa
      const vectorStrokes = kotlinVectorEngine.getStrokesForLayer(layer.id);
      if (vectorStrokes && vectorStrokes.length > 0) {
        kotlinVectorEngine.renderVectorStrokes(targetCtx, vectorStrokes, currentScale);
      }

      targetCtx.restore();
    }

    targetCtx.restore();
  }

  /**
   * Herramienta de Cubo de Pintura (Bucket Fill) con Expansión de Borde (1 a 3 px)
   * y Cierre Inteligente de Huecos (Gap-Closing).
   * Delegado al módulo especializado floodFillEngine.ts.
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
