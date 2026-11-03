/**
 * @file canvas2dRenderer.ts
 * @description Renderizador acelerado en Canvas 2D con soporte para texturas de pincel y curvas Kotlin/Wasm.
 * 
 * Funcionalidades:
 * - Interpolación y dibujo de trazos con dinamismo de presión (pincel, lápiz, aerógrafo, rotulador, goma).
 * - Integración con patrones continuos en espacio de lienzo (`getOrCreateTexturePattern`).
 * - Composición multicapa con modos de fusión estándar y renderizado vectorial C1 sin pixelación.
 */

import { Layer, Point, ToolType, TracingReference, BrushTextureConfig, VectorStroke } from '../types';
import { wasmEngine } from '../wasmEngine';
import { kotlinVectorEngine } from '../kotlinWasmBridge';
import { gpuBitmapCache } from '../bitmapCache';
import { getOrCreateTexturePattern } from '../brushTextureEngine';
import { hexToRgb } from '../floodFillEngine';

/**
 * Renderiza un segmento de trazo continuo o tap puntual entre p0 y p1
 */
export function renderCanvas2DStrokeSegment(
  layer: Layer,
  p0: Point,
  p1: Point,
  tool: ToolType,
  colorHex: string,
  baseSize: number,
  baseOpacity: number,
  textureConfig?: BrushTextureConfig
): void {
  const ctx = layer.ctx;
  ctx.save();

  if (tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
  } else {
    ctx.globalCompositeOperation = 'source-over';
  }

  const pattern = (textureConfig && textureConfig.id !== 'none' && tool !== 'eraser')
    ? getOrCreateTexturePattern(ctx, textureConfig, colorHex)
    : null;

  const fillSource = tool === 'eraser' ? 'rgba(0,0,0,1)' : (pattern || colorHex);
  ctx.fillStyle = fillSource;
  ctx.strokeStyle = fillSource;

  const isTap = (p0.x === p1.x && p0.y === p1.y);

  if (tool === 'airbrush') {
    // Efecto aerógrafo suave con gradiente radial
    const points = wasmEngine.interpolateStroke(p0, p1, Math.max(2, baseSize * 0.4));
    for (const pt of points) {
      const radius = Math.max(0.5, (baseSize * pt.pressure) / 2);
      const grad = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, radius * 1.5);
      const rgb = hexToRgb(colorHex);
      grad.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${baseOpacity * 0.4})`);
      grad.addColorStop(0.5, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${baseOpacity * 0.15})`);
      grad.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, radius * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (tool === 'marker') {
    // Resaltador semitransparente con punta biselada
    const points = wasmEngine.interpolateStroke(p0, p1, Math.max(2, baseSize * 0.4));
    ctx.globalAlpha = baseOpacity * 0.35;
    for (const pt of points) {
      const radius = Math.max(0.5, (baseSize * pt.pressure) / 2);
      ctx.fillRect(pt.x - radius, pt.y - radius * 1.6, radius * 2, radius * 3.2);
    }
  } else if (isTap) {
    // Tap puntual con el dedo sin desplazamiento (sello individual nítido)
    const radius = Math.max(0.5, (baseSize * p0.pressure) / 2);
    ctx.globalAlpha = baseOpacity * (tool === 'pencil' ? 0.75 : 1.0);
    ctx.beginPath();
    ctx.arc(p0.x, p0.y, radius, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Segmento de trazo continuo ultra-rápido (60-120 FPS sin lag en móviles)
    const alpha = baseOpacity * (tool === 'pencil' ? 0.75 : 1.0);
    ctx.globalAlpha = alpha;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const dist = Math.hypot(p1.x - p0.x, p1.y - p0.y);
    const pressureDiff = Math.abs(p1.pressure - p0.pressure);

    if (dist < 20 || pressureDiff < 0.1) {
      // Flujo principal continuo: 1 única llamada por evento táctil
      const avgPressure = (p0.pressure + p1.pressure) * 0.5;
      ctx.lineWidth = Math.max(0.5, baseSize * avgPressure);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    } else {
      // En movimientos muy rápidos con gran variación de presión, subdividir en pocos tramos suaves
      const points = wasmEngine.interpolateStroke(p0, p1, Math.max(8, baseSize * 0.6));
      for (let i = 0; i < points.length - 1; i++) {
        const ptA = points[i];
        const ptB = points[i + 1];
        const segPressure = (ptA.pressure + ptB.pressure) * 0.5;
        ctx.lineWidth = Math.max(0.5, baseSize * segPressure);
        ctx.beginPath();
        ctx.moveTo(ptA.x, ptA.y);
        ctx.lineTo(ptB.x, ptB.y);
        ctx.stroke();
      }
    }
  }

  ctx.restore();
}

/**
 * Compone todas las capas visibles en el targetCtx respetando opacidades, blend modes y calco de fondo
 */
export function renderCanvas2DCompositeLayers(
  targetCtx: CanvasRenderingContext2D,
  layers: Layer[],
  width: number,
  height: number,
  backgroundColor: string = '#ffffff',
  currentScale: number = 1.0,
  tracingRef?: TracingReference | null,
  liveVectorStroke?: VectorStroke | null
): void {
  targetCtx.save();
  
  // Fondo de lienzo
  if (backgroundColor === 'transparent') {
    targetCtx.clearRect(0, 0, width, height);
  } else {
    targetCtx.fillStyle = backgroundColor;
    targetCtx.fillRect(0, 0, width, height);
  }

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

    // Si hay un trazo vectorial en vivo dibujándose en esta capa, renderizarlo en tiempo real
    if (liveVectorStroke && liveVectorStroke.layerId === layer.id && liveVectorStroke.segments.length > 0) {
      kotlinVectorEngine.renderVectorStrokes(targetCtx, [liveVectorStroke], currentScale);
    }

    targetCtx.restore();
  }

  targetCtx.restore();
}
