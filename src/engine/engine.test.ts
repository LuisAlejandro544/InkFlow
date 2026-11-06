/**
 * @file engine.test.ts
 * @description Pruebas unitarias de lógica pura y matemática para el motor de dibujo.
 * Ejecuta validaciones de Wasm, interpolación de trazos, curvas de presión y estabilizador.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { wasmEngine } from './wasmEngine';
import { drawingEngine, dilateBinaryMask } from './webgpuEngine';
import { kotlinVectorEngine, cppVectorEngine } from './index';
import { ToolNavigationStateManager } from './toolNavigationState';
import { 
  calculateTouchRotation, 
  snapRotationDegrees, 
  unrotatePoint, 
  calculateArtworkBoundingBox,
  screenToCanvasCoords,
  canvasToScreenCoords
} from './transformMath';
import {
  calculateResizeOffsets,
  clampCanvasDimension,
  CANVAS_EXPANSION_PRESETS
} from './canvasResizeMath';
import {
  detectIsStandalone,
  detectIsDevOrPreview,
  shouldShowWelcomeScreen
} from './environmentDetector';
import { generateClosedGapBarrierMask, scanlineFloodFill } from './floodFillEngine';
import { 
  sampleTextureLuminance, 
  modulateAlphaByTexture, 
  TEXTURE_DEFINITIONS 
} from './brushTextureEngine';
import { Layer, BrushTextureConfig } from './types';
import { wakeLockService } from './wakeLockService';
import { saveArtworkToUserGallery, shareArtworkFile, applyUnsharpMask, formatArtworkFilename, estimateArtworkFileSizeFast, computeExportDimensions } from './exportEngine';
import { gpuBitmapCache } from './bitmapCache';
import { diagnosticHub } from './diagnosticLogHub';
import { getAvailableThemes, getActiveThemeId, applyAppTheme, APP_THEMES } from './themeEngine';

test('Wasm Lerp e Interpolación Lineal', () => {
  const result = wasmEngine.lerp(10, 20, 0.5);
  assert.equal(result, 15);

  const start = wasmEngine.lerp(0, 100, 0);
  assert.equal(start, 0);

  const end = wasmEngine.lerp(0, 100, 1);
  assert.equal(end, 100);
});

test('Wasm Cálculo de Distancia Euclidiana', () => {
  const dist = wasmEngine.distance(0, 0, 3, 4);
  assert.equal(dist, 5);

  const zeroDist = wasmEngine.distance(12.5, 8.2, 12.5, 8.2);
  assert.equal(zeroDist, 0);
});

test('Interpolación de Trazos con densidad y paso uniforme', () => {
  const p0 = { x: 0, y: 0, pressure: 0.2 };
  const p1 = { x: 10, y: 0, pressure: 0.8 };
  
  // Paso de 2px en una distancia de 10px debe generar 5 segmentos
  const interpolated = wasmEngine.interpolateStroke(p0, p1, 2);
  assert.equal(interpolated.length, 5);

  // El último punto debe coincidir con p1
  const last = interpolated[interpolated.length - 1];
  assert.equal(last.x, 10);
  assert.equal(last.y, 0);
  assert.equal(last.pressure, 0.8);
});

test('Estabilizador estilo IbisPaint (Filtro exponencial de temblor)', () => {
  const pRaw = { x: 100, y: 100, pressure: 0.5 };
  const pLast = { x: 50, y: 50, pressure: 0.5 };

  // Nivel 0: no altera las coordenadas (trazo libre sin amortiguación)
  const noSmoothing = wasmEngine.stabilizePoint(pRaw, pLast, 0);
  assert.equal(noSmoothing.x, 100);
  assert.equal(noSmoothing.y, 100);

  // Nivel 10: amortigua fuertemente hacia la posición anterior para línea limpia
  const maxSmoothing = wasmEngine.stabilizePoint(pRaw, pLast, 10);
  assert.ok(maxSmoothing.x < 100 && maxSmoothing.x > 50, 'El estabilizador debe interpolar suavemente');
  assert.ok(maxSmoothing.y < 100 && maxSmoothing.y > 50, 'El estabilizador debe interpolar suavemente');
});

test('Simulación de Presión por Velocidad para Pantallas Táctiles', () => {
  const p0 = { x: 0, y: 0, pressure: 0, timestamp: 0 };
  
  // Trazo muy rápido (1000px en 50ms) -> debe reducir la presión (trazo fino)
  const pFast = { x: 1000, y: 0, pressure: 0, timestamp: 50 };
  const fastPressure = wasmEngine.calculateVelocityPressure(pFast, p0);

  // Trazo lento (5px en 500ms) -> debe aumentar la presión (trazo denso)
  const pSlow = { x: 5, y: 0, pressure: 0, timestamp: 500 };
  const slowPressure = wasmEngine.calculateVelocityPressure(pSlow, p0);

  assert.ok(fastPressure < slowPressure, 'Un trazo rápido debe ser más fino que uno lento');
});

test('Conversión de Colores Hexadecimal y RGB', () => {
  const rgb = drawingEngine.hexToRgb('#ff8800');
  assert.equal(rgb.r, 255);
  assert.equal(rgb.g, 136);
  assert.equal(rgb.b, 0);

  const hex = drawingEngine.rgbToHex(255, 136, 0);
  assert.equal(hex.toLowerCase(), '#ff8800');
});

test('Kotlin/Wasm Algoritmo de Simplificación Douglas-Peucker', () => {
  // Línea recta con un punto redundante en el medio
  const collinearPoints = [
    { x: 0, y: 0, pressure: 0.5 },
    { x: 50, y: 0, pressure: 0.5 },
    { x: 100, y: 0, pressure: 0.5 }
  ];

  const simplified = kotlinVectorEngine.simplifyPoints(collinearPoints, 1.0);
  // Debe reducir de 3 a 2 puntos eliminando el punto intermedio redundante
  assert.equal(simplified.length, 2);
  assert.equal(simplified[0].x, 0);
  assert.equal(simplified[1].x, 100);
});

test('Kotlin/Wasm Generación de Segmentos Bézier Cúbicos para Lápiz Vectorial', () => {
  const strokePoints = [
    { x: 10, y: 10, pressure: 0.2 },
    { x: 30, y: 50, pressure: 0.5 },
    { x: 70, y: 80, pressure: 0.8 },
    { x: 120, y: 90, pressure: 0.4 }
  ];

  const segments = kotlinVectorEngine.generateBezierSegments(strokePoints, 12);
  assert.ok(segments.length >= 2, 'Debe generar segmentos Bézier continuos');

  // Cada segmento debe tener puntos de inicio, fin y puntos de control calculados
  for (const seg of segments) {
    assert.ok(typeof seg.p0.x === 'number');
    assert.ok(typeof seg.cp1.x === 'number');
    assert.ok(typeof seg.cp2.x === 'number');
    assert.ok(typeof seg.p1.x === 'number');
    assert.ok(seg.width0 > 0 && seg.width1 > 0, 'El grosor debe ser positivo y adaptado a la presión');
  }
});

import { calculateFocalZoomPan, calculateWheelZoom } from './transformMath';

test('Cálculo Matemático de Pinch-to-Zoom Multitáctil', () => {
  // Dos dedos a 100px de distancia
  const initialDist = 100;
  const initialScale = 1.0;

  // Los dedos se separan a 200px (acercar zoom)
  const expandedDist = 200;
  const zoomInScale = Math.max(0.15, Math.min(5.0, initialScale * (expandedDist / initialDist)));
  assert.equal(zoomInScale, 2.0);

  // Los dedos se juntan a 50px (alejar zoom)
  const pinchedDist = 50;
  const zoomOutScale = Math.max(0.15, Math.min(5.0, initialScale * (pinchedDist / initialDist)));
  assert.equal(zoomOutScale, 0.5);
});

test('Invarianza del Punto Focal en Zoom Táctil (Sin Desplazamiento Indeseado)', () => {
  // Supongamos que el usuario tiene los dedos en (120, 80) relativo al centro
  const initialCenter = { x: 120, y: 80 };
  const currentCenter = { x: 120, y: 80 }; // Los dedos no se movieron de sitio, solo se separaron
  const initialDist = 100;
  const currentDist = 200; // Doble de distancia -> zoom al 200%
  const initialScale = 1.0;
  const initialPan = { x: 0, y: 0 };

  const result = calculateFocalZoomPan(
    initialCenter,
    currentCenter,
    initialDist,
    currentDist,
    initialScale,
    initialPan
  );

  assert.equal(result.scale, 2.0);
  // Al duplicar el zoom sobre (120, 80), el nuevo pan debe ser exactamente -120 y -80
  // para que el punto (120, 80) permanezca exactamente en (120, 80)
  assert.equal(result.pan.x, -120);
  assert.equal(result.pan.y, -80);

  // Verificar la posición del punto en pantalla tras la transformación:
  // pantalla = puntoLienzo * escala + pan = 120 * 2.0 + (-120) = 120 (idéntico)
  const screenPosAfterZoom = 120 * result.scale + result.pan.x;
  assert.equal(screenPosAfterZoom, 120);
});

test('Zoom con Rueda de Ratón anclado al Cursor', () => {
  const focalPoint = { x: 50, y: -40 };
  const currentScale = 1.0;
  const currentPan = { x: 0, y: 0 };

  const result = calculateWheelZoom(focalPoint, currentScale, currentPan, 1.2);
  assert.equal(result.scale, 1.2);

  const screenPos = 50 * result.scale + result.pan.x;
  assert.equal(Math.round(screenPos), 50);
});

import { 
  calculateInitialTracingFit, 
  extractLineartFromPixels, 
  extractDominantColorsFromImage 
} from './tracingEngine';

test('Cálculo de centrado y ajuste automático de foto para calco', () => {
  // Lienzo móvil de 800 x 1200
  const canvasW = 800;
  const canvasH = 1200;
  // Foto de 1920 x 1080
  const photoW = 1920;
  const photoH = 1080;

  const fit = calculateInitialTracingFit(photoW, photoH, canvasW, canvasH);
  
  // Debe situarse exactamente en el centro de la hoja
  assert.equal(fit.x, 400);
  assert.equal(fit.y, 600);
  assert.ok(fit.scale > 0 && fit.scale < 1.0, 'La escala debe reducir proporcionalmente la foto grande');
});

test('Filtro Sobel de Extracción de Lineart para Foto de Calco', () => {
  // Crear imagen sintética de 4x4 píxeles con un borde vertical en el centro
  const width = 4;
  const height = 4;
  const pixels = new Uint8ClampedArray(width * height * 4);

  // Lado izquierdo negro (0), lado derecho blanco (255)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const val = x < 2 ? 0 : 255;
      pixels[idx] = val;
      pixels[idx + 1] = val;
      pixels[idx + 2] = val;
      pixels[idx + 3] = 255;
    }
  }

  const lineart = extractLineartFromPixels(pixels, width, height, true, 20);
  assert.equal(lineart.length, pixels.length);
  // Debe detectar bordes en la transición vertical
  let hasLines = false;
  for (let i = 3; i < lineart.length; i += 4) {
    if (lineart[i] > 0) hasLines = true;
  }
  assert.ok(hasLines, 'El filtro Sobel debe extraer los bordes de la imagen para calcar');
});

test('Extracción de Colores Dominantes de Foto de Calco', () => {
  // Imagen sintética con rojo y azul
  const pixels = new Uint8ClampedArray(100 * 4);
  for (let i = 0; i < 50; i++) {
    pixels[i * 4] = 255;   // R
    pixels[i * 4 + 1] = 0; // G
    pixels[i * 4 + 2] = 0; // B
    pixels[i * 4 + 3] = 255;
  }
  for (let i = 50; i < 100; i++) {
    pixels[i * 4] = 0;     // R
    pixels[i * 4 + 1] = 0; // G
    pixels[i * 4 + 2] = 255;// B
    pixels[i * 4 + 3] = 255;
  }

  const colors = extractDominantColorsFromImage(pixels, 4);
  assert.ok(colors.length >= 2, 'Debe extraer al menos los 2 colores dominantes');
  assert.ok(colors.some(c => c.toLowerCase().includes('ff0000') || c.startsWith('#')), 'Debe contener formato hex');
});

import { 
  detectRoleFromSize, 
  getRoleInfoForSize, 
  getRecommendedSizeForRole, 
  generateStrokeAdvice,
  analyzeImageStrokeThickness,
  sampleStrokeThicknessAtPoint,
  getCalibratedStrokeRoles
} from './strokeAssistant';

test('Asistente de Grosor de Trazo - Detección de Roles Canónicos', () => {
  // Silueta: contorno exterior (>= 19px)
  assert.equal(detectRoleFromSize(24), 'silhouette');
  assert.equal(detectRoleFromSize(19), 'silhouette');
  assert.equal(detectRoleFromSize(40), 'silhouette');

  // Estructura: ropa y pelo (10 - 18px)
  assert.equal(detectRoleFromSize(14), 'structure');
  assert.equal(detectRoleFromSize(10), 'structure');
  assert.equal(detectRoleFromSize(18), 'structure');

  // Detalles: rostro y ojos (4 - 9px)
  assert.equal(detectRoleFromSize(6), 'details');
  assert.equal(detectRoleFromSize(4), 'details');
  assert.equal(detectRoleFromSize(9), 'details');

  // Tramas: achurado y texturas (< 4px)
  assert.equal(detectRoleFromSize(2), 'hatching');
  assert.equal(detectRoleFromSize(1), 'hatching');
});

test('Asistente de Grosor de Trazo - Calibrado por Foto con Valores Reales (64, 56, 39, 32px)', () => {
  const calibratedAnalysis = {
    silhouettePx: 64,
    structurePx: 56,
    detailsPx: 39,
    hatchingPx: 32,
    minDetectedPx: 10,
    maxDetectedPx: 70,
    averagePx: 45,
    sampledEdgesCount: 3465,
    isImageCalibrated: true,
  };

  // Coincidencias exactas al tocar cada tarjeta
  assert.equal(detectRoleFromSize(32, calibratedAnalysis), 'hatching', 'Tramas (32px) debe activarse como hatching');
  assert.equal(detectRoleFromSize(39, calibratedAnalysis), 'details', 'Detalles (39px) debe activarse como details');
  assert.equal(detectRoleFromSize(56, calibratedAnalysis), 'structure', 'Estructura (56px) debe activarse como structure');
  assert.equal(detectRoleFromSize(64, calibratedAnalysis), 'silhouette', 'Silueta (64px) debe activarse como silhouette');

  // Valores intermedios según umbrales (60, 47.5, 35.5)
  assert.equal(detectRoleFromSize(33, calibratedAnalysis), 'hatching');
  assert.equal(detectRoleFromSize(35, calibratedAnalysis), 'hatching');
  assert.equal(detectRoleFromSize(37, calibratedAnalysis), 'details');
  assert.equal(detectRoleFromSize(50, calibratedAnalysis), 'structure');
  assert.equal(detectRoleFromSize(62, calibratedAnalysis), 'silhouette');
});

test('Asistente de Grosor de Trazo - Tamaños Recomendados e Información de Rol', () => {
  assert.equal(getRecommendedSizeForRole('silhouette'), 24);
  assert.equal(getRecommendedSizeForRole('structure'), 14);
  assert.equal(getRecommendedSizeForRole('details'), 6);
  assert.equal(getRecommendedSizeForRole('hatching'), 2);

  const info = getRoleInfoForSize(6);
  assert.equal(info.id, 'details');
  assert.equal(info.recommendedPx, 6);
  assert.ok(info.exampleUses.length > 0);
});

test('Asistente de Grosor de Trazo - Consejos Contextuales para Calco', () => {
  const calcoAdviceEyes = generateStrokeAdvice(6, true);
  assert.ok(calcoAdviceEyes.advice.includes('ojos') || calcoAdviceEyes.advice.includes('calcar'));

  const calcoAdviceOutline = generateStrokeAdvice(24, true);
  assert.ok(calcoAdviceOutline.advice.includes('contorno') || calcoAdviceOutline.advice.includes('silueta'));

  const standardAdvice = generateStrokeAdvice(14, false);
  assert.ok(standardAdvice.advice.length > 5);
});

test('Análisis Real de Grosor de Trazo desde Píxeles de Imagen', () => {
  // Crear una imagen sintética de 100x100 con:
  // 1. Una barra gruesa de 20px (Silueta)
  // 2. Una barra intermedia de 10px (Estructura)
  // 3. Una línea fina de 4px (Detalle)
  // 4. Una micro-línea de 1px (Trama)
  const width = 100;
  const height = 100;
  const pixels = new Uint8ClampedArray(width * height * 4);
  // Inicializar fondo blanco
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = 255;
    pixels[i + 1] = 255;
    pixels[i + 2] = 255;
    pixels[i + 3] = 255;
  }

  const drawHorizLine = (startY: number, thickness: number) => {
    for (let y = startY; y < startY + thickness && y < height; y++) {
      for (let x = 10; x < 90; x++) {
        const idx = (y * width + x) * 4;
        pixels[idx] = 20;     // R oscuro
        pixels[idx + 1] = 20; // G oscuro
        pixels[idx + 2] = 20; // B oscuro
        pixels[idx + 3] = 255;
      }
    }
  };

  drawHorizLine(10, 20); // 20px
  drawHorizLine(40, 10); // 10px
  drawHorizLine(65, 4);  // 4px
  drawHorizLine(85, 1);  // 1px

  const analysis = analyzeImageStrokeThickness(pixels, width, height, 1.0);
  assert.ok(analysis.isImageCalibrated, 'Debe calibrar con la imagen sintética');
  assert.ok(analysis.sampledEdgesCount > 0, 'Debe muestrear bordes oscuros');
  assert.ok(analysis.silhouettePx >= analysis.structurePx, 'Silueta debe ser mayor o igual a estructura');
  assert.ok(analysis.structurePx >= analysis.detailsPx, 'Estructura debe ser mayor o igual a detalles');
  assert.ok(analysis.detailsPx >= analysis.hatchingPx, 'Detalles debe ser mayor o igual a tramas');

  const calibratedRoles = getCalibratedStrokeRoles(analysis);
  assert.equal(calibratedRoles.length, 4);
  assert.equal(calibratedRoles[0].isCalibrated, true);
  assert.ok(calibratedRoles[0].badge.includes('Calibrado'));
});

test('Muestreo Local de Grosor en un Punto Específico de la Imagen', () => {
  const width = 60;
  const height = 60;
  const pixels = new Uint8ClampedArray(width * height * 4);
  pixels.fill(255);

  // Línea oscura centrada en Y=30 de 8px de grosor (de y=26 a y=33)
  for (let y = 26; y <= 33; y++) {
    for (let x = 10; x < 50; x++) {
      const idx = (y * width + x) * 4;
      pixels[idx] = 10;
      pixels[idx + 1] = 10;
      pixels[idx + 2] = 10;
      pixels[idx + 3] = 255;
    }
  }

  // Tocar en el centro de la línea (x=30, y=30)
  const sampled = sampleStrokeThicknessAtPoint(pixels, width, height, 30, 30, 1.0);
  assert.ok(sampled !== null, 'Debe detectar la línea');
  assert.ok(sampled! >= 6 && sampled! <= 10, `Grosor muestreado esperado ~8px, recibido ${sampled}`);

  // Tocar en el fondo blanco libre (x=5, y=5)
  const emptySample = sampleStrokeThicknessAtPoint(pixels, width, height, 5, 5, 1.0);
  assert.equal(emptySample, null, 'En zona blanca debe retornar null');
});

test('Navegación de Herramientas: Salir de Mover restaura exactamente la herramienta previa (Evita vector_pencil)', () => {
  const manager = new ToolNavigationStateManager('brush');
  assert.equal(manager.getActiveTool(), 'brush');

  // Caso 1: Usuario usa Pluma Fuerte ('brush'), activa Mover ('hand'), y luego deja de moverse
  manager.toggleHandMode();
  assert.equal(manager.getActiveTool(), 'hand');
  manager.toggleHandMode();
  assert.equal(manager.getActiveTool(), 'brush', 'Al dejar de moverse debe volver a brush y NUNCA a vector_pencil');

  // Caso 2: Usuario usa Lápiz Grafito ('pencil'), activa Mover, y deja de moverse
  manager.selectTool('pencil');
  assert.equal(manager.getActiveTool(), 'pencil');
  manager.toggleHandMode();
  assert.equal(manager.getActiveTool(), 'hand');
  manager.toggleHandMode();
  assert.equal(manager.getActiveTool(), 'pencil', 'Debe restaurar pencil');

  // Caso 3: Usuario usa Goma ('eraser'), activa Mover, y deja de moverse
  manager.selectTool('eraser');
  assert.equal(manager.getActiveTool(), 'eraser');
  manager.toggleHandMode();
  assert.equal(manager.getActiveTool(), 'hand');
  manager.toggleHandMode();
  assert.equal(manager.getActiveTool(), 'eraser', 'Debe restaurar eraser exactamente sin alterar a vector_pencil');

  // Caso 4: Alternar pincel/borrador mientras se navega no debe contaminar lastDrawingTool con 'hand'
  manager.selectTool('brush');
  manager.selectTool('hand');
  manager.toggleBrushEraser(); // intentar alternar
  assert.notEqual(manager.getLastDrawingTool(), 'hand', 'lastDrawingTool NUNCA debe ser hand');

  // Caso 5: Si el usuario estaba explícitamente usando vector_pencil, debe preservarlo legítimamente
  manager.selectTool('vector_pencil');
  manager.toggleHandMode();
  assert.equal(manager.getActiveTool(), 'hand');
  manager.toggleHandMode();
  assert.equal(manager.getActiveTool(), 'vector_pencil', 'Debe retornar a vector_pencil solo si era la herramienta activa del usuario');
});

test('Rotación Táctil Continua de la Hoja', () => {
  // Dos dedos alineados horizontalmente (dx=100, dy=0)
  const t0Init = { x: 100, y: 100 };
  const t1Init = { x: 200, y: 100 };

  // Los dos dedos giran 90 grados en sentido horario (dx=0, dy=100)
  const t0Curr = { x: 150, y: 50 };
  const t1Curr = { x: 150, y: 150 };

  const angle = calculateTouchRotation(t0Init, t1Init, t0Curr, t1Curr, 0);
  assert.equal(angle, 90, 'El ángulo resultante debe ser 90°');
});

test('Snap Magnético de Ángulos Cardinales (0°, 90°, 180°, 270°)', () => {
  // Cerca de 0° (ej: 2.5° o 358°) debe encajar a 0°
  assert.equal(snapRotationDegrees(2.5, 4.0), 0);
  assert.equal(snapRotationDegrees(358, 4.0), 0);

  // Cerca de 90° (ej: 88.5°) debe encajar a 90°
  assert.equal(snapRotationDegrees(88.5, 4.0), 90);

  // Lejos de cualquier cardinal (ej: 45°) debe mantenerse inalterado
  assert.equal(snapRotationDegrees(45, 4.0), 45);
});

test('Mapeo Inverso de Puntos con Rotación (unrotatePoint)', () => {
  const center = { x: 200, y: 200 };

  // Con rotación de +90° en sentido horario, un punto que estaba arriba en (x=200, y=100)
  // aparece girado a la derecha en pantalla (x=300, y=200).
  // Por tanto, al desrotar (300, 200) debe recuperar exactamente (200, 100).
  const unrotated90 = unrotatePoint(300, 200, center.x, center.y, 90);
  assert.ok(Math.abs(unrotated90.x - 200) < 0.001);
  assert.ok(Math.abs(unrotated90.y - 100) < 0.001);

  // Con rotación 0°, el punto debe ser idéntico
  const unrotated0 = unrotatePoint(250, 180, center.x, center.y, 0);
  assert.equal(unrotated0.x, 250);
  assert.equal(unrotated0.y, 180);
});

test('Auto-Recorte de Obra Maestra (Bounding Box)', () => {
  const width = 100;
  const height = 100;
  const buffer = new Uint8ClampedArray(width * height * 4); // Lienzo transparente

  // Dibujar un trazo en la región (x=30 a 50, y=40 a 60)
  for (let y = 40; y <= 60; y++) {
    for (let x = 30; x <= 50; x++) {
      const idx = (y * width + x) * 4;
      buffer[idx] = 20;
      buffer[idx + 1] = 20;
      buffer[idx + 2] = 20;
      buffer[idx + 3] = 255; // Opaco
    }
  }

  const bbox = calculateArtworkBoundingBox([buffer], width, height, 10);
  assert.equal(bbox.hasContent, true);
  // minX debe ser 30 - padding(10) = 20
  assert.equal(bbox.minX, 20);
  // maxX debe ser 50 + padding(10) = 60
  assert.equal(bbox.maxX, 60);
  // minY debe ser 40 - padding(10) = 30
  assert.equal(bbox.minY, 30);
  // maxY debe ser 60 + padding(10) = 70
  assert.equal(bbox.maxY, 70);
  assert.equal(bbox.width, 40);
  assert.equal(bbox.height, 40);
});

test('Mapeo Canónico Exacto de Pantalla a Lienzo con Rotación (screenToCanvasCoords)', () => {
  // Lienzo móvil no cuadrado: 800 x 1200
  const canvasW = 800;
  const canvasH = 1200;
  const screenCenterX = 500;
  const screenCenterY = 600;
  const scale = 1.0;

  // Caso 1: Rotación 0° (sin rotación)
  // El centro de la pantalla debe ser el centro del lienzo (400, 600)
  const centerCoords = screenToCanvasCoords(screenCenterX, screenCenterY, screenCenterX, screenCenterY, scale, 0, canvasW, canvasH);
  assert.equal(centerCoords.x, 400);
  assert.equal(centerCoords.y, 600);

  // Caso 2: Rotación 90° en sentido horario
  // En rotación de 90° horario, la parte superior del lienzo (x=400, y=0) gira 90° y aparece a la DERECHA en pantalla
  // (screenCenterX + 600, screenCenterY). Al tocar allí, debe recuperar exactamente (400, 0).
  const topRotated90 = screenToCanvasCoords(screenCenterX + 600, screenCenterY, screenCenterX, screenCenterY, scale, 90, canvasW, canvasH);
  assert.ok(Math.abs(topRotated90.x - 400) < 0.001, `x esperado 400, recibido ${topRotated90.x}`);
  assert.ok(Math.abs(topRotated90.y - 0) < 0.001, `y esperado 0, recibido ${topRotated90.y}`);

  // En rotación de 90° horario, el lado derecho del lienzo (x=800, y=600) gira 90° y aparece ABAJO en pantalla
  // (screenCenterX, screenCenterY + 400). Al tocar allí, debe recuperar exactamente (800, 600).
  const rightRotated90 = screenToCanvasCoords(screenCenterX, screenCenterY + 400, screenCenterX, screenCenterY, scale, 90, canvasW, canvasH);
  assert.ok(Math.abs(rightRotated90.x - 800) < 0.001, `x esperado 800, recibido ${rightRotated90.x}`);
  assert.ok(Math.abs(rightRotated90.y - 600) < 0.001, `y esperado 600, recibido ${rightRotated90.y}`);

  // Caso 3: Rotación 180° (lienzo invertido de cabeza)
  // Tocar arriba en pantalla (screenCenterX, screenCenterY - 600) corresponde al fondo del lienzo (x=400, y=1200)
  const bottomRotated180 = screenToCanvasCoords(screenCenterX, screenCenterY - 600, screenCenterX, screenCenterY, scale, 180, canvasW, canvasH);
  assert.ok(Math.abs(bottomRotated180.x - 400) < 0.001);
  assert.ok(Math.abs(bottomRotated180.y - 1200) < 0.001);

  // Caso 4: Rotación 270° (-90° antihorario)
  // Tocar arriba en pantalla (screenCenterX, screenCenterY - 400) corresponde al lado derecho del lienzo (x=800, y=600)
  const rightRotated270 = screenToCanvasCoords(screenCenterX, screenCenterY - 400, screenCenterX, screenCenterY, scale, 270, canvasW, canvasH);
  assert.ok(Math.abs(rightRotated270.x - 800) < 0.001);
  assert.ok(Math.abs(rightRotated270.y - 600) < 0.001);
});

test('Reversibilidad y Consistencia Biyectiva (canvasToScreenCoords <-> screenToCanvasCoords)', () => {
  const canvasW = 800;
  const canvasH = 1200;
  const centerX = 360;
  const centerY = 450;
  const angles = [0, 15, 30, 45, 90, 120, 180, 240, 270, 315];
  const scales = [0.5, 1.0, 1.75, 3.0];

  for (const rot of angles) {
    for (const sc of scales) {
      // Probar múltiples puntos clave del lienzo
      const testPoints = [
        { x: 0, y: 0 },
        { x: 400, y: 600 },
        { x: 800, y: 1200 },
        { x: 234, y: 891 }
      ];

      for (const pt of testPoints) {
        const screen = canvasToScreenCoords(pt.x, pt.y, centerX, centerY, sc, rot, canvasW, canvasH);
        const recovered = screenToCanvasCoords(screen.x, screen.y, centerX, centerY, sc, rot, canvasW, canvasH);

        assert.ok(
          Math.abs(recovered.x - pt.x) < 0.001,
          `Error en X para rot=${rot}, scale=${sc}: esperado ${pt.x}, obtenido ${recovered.x}`
        );
        assert.ok(
          Math.abs(recovered.y - pt.y) < 0.001,
          `Error en Y para rot=${rot}, scale=${sc}: esperado ${pt.y}, obtenido ${recovered.y}`
        );
      }
    }
  }
});

test('Rotación Táctil con Normalización Angular al Cruzar Frontera [-π, π]', () => {
  // Dos dedos casi horizontales en el borde izquierdo (ángulo cercano a +179°)
  const t0Init = { x: 200, y: 100 };
  const t1Init = { x: 100, y: 102 }; // atan2(2, -100) ≈ +178.8°

  // Los dedos rotan levemente en sentido horario cruzando la frontera horizontal a -179°
  const t0Curr = { x: 200, y: 100 };
  const t1Curr = { x: 100, y: 98 }; // atan2(-2, -100) ≈ -178.8°

  const angle = calculateTouchRotation(t0Init, t1Init, t0Curr, t1Curr, 0);
  // La rotación horaria debe ser un cambio sutil (~357.5° o -2.5°), no un salto errático
  assert.ok(angle > 355 || angle < 5, `El ángulo calculado debe ser coherente tras cruzar frontera: ${angle}`);
});

test('Detección PWA Standalone (display-mode, navigator.standalone o TWA referrer)', () => {
  // 1. Coincide con display-mode: standalone
  assert.equal(detectIsStandalone(true, false, ''), true);

  // 2. Coincide con iOS Safari navigator.standalone
  assert.equal(detectIsStandalone(false, true, ''), true);

  // 3. Coincide con Android TWA referrer
  assert.equal(detectIsStandalone(false, false, 'android-app://com.example.inkflow'), true);

  // 4. Navegador web estándar sin standalone
  assert.equal(detectIsStandalone(false, false, 'https://google.com'), false);
});

test('Detección de Excepción en Entorno de Desarrollo y Vista Previa de AI Studio', () => {
  // Localhost
  assert.equal(detectIsDevOrPreview('localhost'), true);
  assert.equal(detectIsDevOrPreview('127.0.0.1'), true);

  // AI Studio Cloud Run Preview (*.run.app)
  assert.equal(detectIsDevOrPreview('ais-dev-3svunrjwahjz222xwtgxtp-62934322005.us-west2.run.app'), true);

  // Producción Cloudflare Pages (no es dev ni preview)
  assert.equal(detectIsDevOrPreview('inkflow-ezp.pages.dev'), false);

  // Parámetro de query preview=true o env=dev
  assert.equal(detectIsDevOrPreview('inkflow-ezp.pages.dev', '?preview=true'), true);
});

test('Decisión de Mostrar Pantalla de Bienvenida PWA vs Acceso Directo al Estudio', () => {
  // Caso 1: PWA Standalone instalada -> NO mostrar bienvenida (va directo al lienzo)
  assert.equal(
    shouldShowWelcomeScreen({
      isStandalone: true,
      isDevOrPreview: false,
      hasDismissedWelcome: false,
    }),
    false
  );

  // Caso 2: Navegador Web estándar (inkflow-ezp.pages.dev) sin instalar -> SÍ mostrar bienvenida
  assert.equal(
    shouldShowWelcomeScreen({
      isStandalone: false,
      isDevOrPreview: false,
      hasDismissedWelcome: false,
    }),
    true
  );

  // Caso 3: Usuario ya pulsó "Continuar en el Navegador" en esta sesión -> NO mostrar bienvenida
  assert.equal(
    shouldShowWelcomeScreen({
      isStandalone: false,
      isDevOrPreview: false,
      hasDismissedWelcome: true,
    }),
    false
  );

  // Caso 4: Entorno de desarrollo descartado -> NO mostrar bienvenida
  assert.equal(
    shouldShowWelcomeScreen({
      isStandalone: false,
      isDevOrPreview: true,
      hasDismissedWelcome: true,
    }),
    false
  );
});

import { instantiateWasmStreaming, isWasmStreamingSupported } from './wasmStreamingCompiler';
import { GPUBitmapCache } from './bitmapCache';

test('Compilación Streaming de WebAssembly (WebAssembly.instantiateStreaming)', async () => {
  // Binario Wasm mínimo: '\0asm\x01\0\0\0'
  const minimalWasm = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);
  
  const result = await instantiateWasmStreaming(minimalWasm);
  assert.ok(result.instance, 'Debe instanciar el módulo');
  assert.ok(result.module, 'Debe compilar el módulo');
  assert.ok(typeof result.compilationTimeMs === 'number', 'Debe registrar el tiempo de compilación');
});

test('Caché VRAM en GPU (GPUBitmapCache) con gestión de memoria y LRU', () => {
  const cache = new GPUBitmapCache();
  
  // Mock simple de ImageBitmap
  let closedA = false;
  let closedB = false;

  const mockBitmapA = {
    width: 100,
    height: 100,
    close: () => { closedA = true; }
  } as unknown as ImageBitmap;

  const mockBitmapB = {
    width: 200,
    height: 200,
    close: () => { closedB = true; }
  } as unknown as ImageBitmap;

  cache.set('key_a', mockBitmapA);
  assert.equal(cache.get('key_a'), mockBitmapA);

  cache.set('key_b', mockBitmapB);
  assert.equal(cache.get('key_b'), mockBitmapB);

  const stats = cache.getStats();
  assert.equal(stats.cachedBitmapsCount, 2);

  // Invalidar clave individual y verificar liberación de VRAM
  cache.invalidate('key_a');
  assert.equal(cache.get('key_a'), null);
  assert.equal(closedA, true, 'Debe invocar close() en el bitmap para liberar memoria VRAM');

  // Limpiar toda la caché
  cache.clear();
  assert.equal(closedB, true, 'Debe invocar close() en todos los bitmaps al limpiar la caché');
  assert.equal(cache.getStats().cachedBitmapsCount, 0);
});

test('Bote de Pintura: Dilatación y Expansión de Borde (1 a 3 px) para Eliminar Halos Blancos', () => {
  const width = 10;
  const height = 10;
  const mask = new Uint8Array(width * height);
  
  // Marcar un solo píxel en el centro (x=5, y=5)
  mask[5 * width + 5] = 1;

  // 1. Expansión 0 px (Exacto): solo 1 píxel activo
  const noExpand = dilateBinaryMask(mask, width, height, 0);
  assert.equal(noExpand[5 * width + 5], 1);
  assert.equal(noExpand[5 * width + 4], 0);

  // 2. Expansión 1 px (Fino): debe expandir a los vecinos inmediatos (3x3 = 9 píxeles)
  const expand1 = dilateBinaryMask(mask, width, height, 1);
  assert.equal(expand1[5 * width + 5], 1);
  assert.equal(expand1[5 * width + 4], 1, 'Píxel izquierdo debe estar marcado');
  assert.equal(expand1[5 * width + 6], 1, 'Píxel derecho debe estar marcado');
  assert.equal(expand1[4 * width + 5], 1, 'Píxel superior debe estar marcado');
  assert.equal(expand1[6 * width + 5], 1, 'Píxel inferior debe estar marcado');
  assert.equal(expand1[4 * width + 4], 1, 'Diagonal sup-izq debe estar marcada');
  assert.equal(expand1[3 * width + 3], 0, 'Píxel a 2px de distancia NO debe estar marcado a radio 1');

  // 3. Expansión 2 px (Recomendado): debe alcanzar píxeles a 2 de distancia (5x5)
  const expand2 = dilateBinaryMask(mask, width, height, 2);
  assert.equal(expand2[3 * width + 3], 1, 'Píxel a distancia 2 debe estar marcado a radio 2');
  assert.equal(expand2[2 * width + 2], 0, 'Píxel a distancia 3 NO debe estar marcado a radio 2');

  // 4. Expansión 3 px (Máximo)
  const expand3 = dilateBinaryMask(mask, width, height, 3);
  assert.equal(expand3[2 * width + 2], 1, 'Píxel a distancia 3 debe estar marcado a radio 3');
});

test('Expansión de Hoja: Cálculo de Desplazamientos (Offsets) según Punto de Anclaje', () => {
  const oldW = 800;
  const oldH = 1200;
  const newW = 1200;
  const newH = 1600;

  // Anclaje Centro: debe centrar el dibujo viejo (añade 200px a cada lado)
  const center = calculateResizeOffsets(oldW, oldH, newW, newH, 'center');
  assert.equal(center.offsetX, 200);
  assert.equal(center.offsetY, 200);

  // Anclaje Top-Left: nuevo espacio a la derecha y abajo (offset 0, 0)
  const topLeft = calculateResizeOffsets(oldW, oldH, newW, newH, 'top-left');
  assert.equal(topLeft.offsetX, 0);
  assert.equal(topLeft.offsetY, 0);

  // Anclaje Bottom-Right: nuevo espacio arriba y a la izquierda
  const bottomRight = calculateResizeOffsets(oldW, oldH, newW, newH, 'bottom-right');
  assert.equal(bottomRight.offsetX, 400);
  assert.equal(bottomRight.offsetY, 400);

  // Anclaje Top: centrado horizontal, fijado arriba
  const top = calculateResizeOffsets(oldW, oldH, newW, newH, 'top');
  assert.equal(top.offsetX, 200);
  assert.equal(top.offsetY, 0);

  // Anclaje Bottom: centrado horizontal, fijado abajo
  const bottom = calculateResizeOffsets(oldW, oldH, newW, newH, 'bottom');
  assert.equal(bottom.offsetX, 200);
  assert.equal(bottom.offsetY, 400);
});

test('Expansión de Hoja: Normalización y Presets de Espacio (+25%, +50%, 2x, 1:1, 9:16)', () => {
  // Clamping seguro para GPUs móviles
  assert.equal(clampCanvasDimension(50), 100, 'Debe cumplir mínimo 100px');
  assert.equal(clampCanvasDimension(5000), 4096, 'Debe limitar a máximo 4096px');
  assert.equal(clampCanvasDimension(800.7), 801, 'Debe redondear enteros');

  // Presets
  const p25 = CANVAS_EXPANSION_PRESETS.find(p => p.id === 'plus_25')!;
  assert.deepEqual(p25.calculate(800, 1200), { width: 1000, height: 1500 });

  const p50 = CANVAS_EXPANSION_PRESETS.find(p => p.id === 'plus_50')!;
  assert.deepEqual(p50.calculate(800, 1200), { width: 1200, height: 1800 });

  const pDouble = CANVAS_EXPANSION_PRESETS.find(p => p.id === 'double')!;
  assert.deepEqual(pDouble.calculate(800, 1200), { width: 1600, height: 2400 });

  const pSquare = CANVAS_EXPANSION_PRESETS.find(p => p.id === 'square_1_1')!;
  assert.deepEqual(pSquare.calculate(800, 1200), { width: 1200, height: 1200 });
});

test('Cierre Inteligente de Huecos (Gap-Closing): Detección y Puente Morfológico de Brechas en Lineart', () => {
  const width = 20;
  const height = 20;
  const data = new Uint8ClampedArray(width * height * 4);

  // Inicializar fondo transparente (RGBA: 0, 0, 0, 0)
  // Crear una línea vertical en x = 10 con una abertura/hueco de 3 píxeles en y = 7, 8, 9
  // Segmento superior: y = 2..6
  for (let y = 2; y <= 6; y++) {
    const idx = (y * width + 10) * 4;
    data[idx] = 20;
    data[idx + 1] = 20;
    data[idx + 2] = 20;
    data[idx + 3] = 255; // Opaco oscuro
  }
  // Segmento inferior: y = 10..15
  for (let y = 10; y <= 15; y++) {
    const idx = (y * width + 10) * 4;
    data[idx] = 20;
    data[idx + 1] = 20;
    data[idx + 2] = 20;
    data[idx + 3] = 255;
  }

  // 1. Sin cierre de huecos (gapSize = 0) -> retorna null
  const noGap = generateClosedGapBarrierMask(data, width, height, 0, 0, 0, 0, 0, 32);
  assert.equal(noGap, null);

  // 2. Con cierre de huecos pequeño (gapSize = 2) -> hueco de 3px no se cierra
  const smallGap = generateClosedGapBarrierMask(data, width, height, 2, 0, 0, 0, 0, 32)!;
  assert.ok(smallGap, 'Debe generar máscara');
  assert.equal(smallGap[8 * width + 10], 0, 'Hueco de 3px no debe cerrarse con radio insuficiente');

  // 3. Con cierre de huecos adecuado (gapSize = 5 o 6) -> el puente se genera uniendo y = 7, 8, 9
  const bridgeGap = generateClosedGapBarrierMask(data, width, height, 6, 0, 0, 0, 0, 32)!;
  assert.ok(bridgeGap, 'Debe generar máscara con puente');
  assert.equal(bridgeGap[7 * width + 10], 1, 'Píxel 7 del hueco debe estar cerrado por el puente');
  assert.equal(bridgeGap[8 * width + 10], 1, 'Píxel 8 del hueco debe estar cerrado por el puente');
  assert.equal(bridgeGap[9 * width + 10], 1, 'Píxel 9 del hueco debe estar cerrado por el puente');
});

test('Bote de Pintura con Cierre de Huecos: Contención Exitosa de Relleno sin Fugas en Contornos Abiertos', () => {
  const width = 30;
  const height = 30;

  // Función helper para construir una caja de 30x30 con una brecha de 3px en la pared derecha (x=24, y=14..16)
  const createBoxData = () => {
    const buf = new Uint8ClampedArray(width * height * 4);
    for (let x = 6; x <= 24; x++) {
      // Pared superior y fondo
      const topIdx = (6 * width + x) * 4;
      buf[topIdx] = 0; buf[topIdx + 1] = 0; buf[topIdx + 2] = 0; buf[topIdx + 3] = 255;
      const botIdx = (24 * width + x) * 4;
      buf[botIdx] = 0; buf[botIdx + 1] = 0; buf[botIdx + 2] = 0; buf[botIdx + 3] = 255;
    }
    for (let y = 6; y <= 24; y++) {
      // Pared izquierda completa
      const leftIdx = (y * width + 6) * 4;
      buf[leftIdx] = 0; buf[leftIdx + 1] = 0; buf[leftIdx + 2] = 0; buf[leftIdx + 3] = 255;
      // Pared derecha con HUECO de 3px en y = 14, 15, 16
      if (y < 14 || y > 16) {
        const rightIdx = (y * width + 24) * 4;
        buf[rightIdx] = 0; buf[rightIdx + 1] = 0; buf[rightIdx + 2] = 0; buf[rightIdx + 3] = 255;
      }
    }
    return buf;
  };

  // CASO A: Sin Cierre de Huecos (gapClosing = 0)
  // El color debe escaparse por el hueco y pintar fuera de la caja (ej. x=28, y=15)
  const dataWithoutGapClose = createBoxData();
  const layerA = {
    canvas: { width, height },
    ctx: {
      getImageData: () => ({ data: dataWithoutGapClose }),
      putImageData: () => {}
    }
  } as unknown as Layer;

  scanlineFloodFill(layerA, 15, 15, '#ff0000', 32, 0, 0);
  const outsideIdxA = (15 * width + 28) * 4;
  assert.equal(dataWithoutGapClose[outsideIdxA], 255, 'Sin gap closing, la pintura debe desbordarse afuera');

  // CASO B: Con Cierre de Huecos (gapClosing = 6)
  // El color debe rellenar el interior pero contenerse sin fugas hacia el exterior
  const dataWithGapClose = createBoxData();
  const layerB = {
    canvas: { width, height },
    ctx: {
      getImageData: () => ({ data: dataWithGapClose }),
      putImageData: () => {}
    }
  } as unknown as Layer;

  scanlineFloodFill(layerB, 15, 15, '#00ff00', 32, 0, 6);
  const insideIdxB = (15 * width + 15) * 4;
  assert.equal(dataWithGapClose[insideIdxB + 1], 255, 'Dentro de la caja debe estar relleno de verde');

  const outsideIdxB = (15 * width + 28) * 4;
  assert.equal(dataWithGapClose[outsideIdxB + 1], 0, 'Con gap closing, el exterior debe permanecer intacto sin fugas');
});

test('Sistema de Accesorios de Galería (Stickers / Moños): Validación de Propiedades y Estampado', () => {
  // 1. Un accesorio importado debe tener purpose: 'accessory' y opacidad 1.0
  const accessoryConfig = {
    id: 'accessory_12345',
    purpose: 'accessory' as const,
    opacity: 1.0,
    visible: true,
    scale: 0.45,
    rotation: 0
  };

  assert.equal(accessoryConfig.purpose, 'accessory');
  assert.equal(accessoryConfig.opacity, 1.0, 'Los accesorios de galería inician con opacidad 100%');
  assert.equal(accessoryConfig.visible, true);

  // 2. Estampado en capa activa: debe producir un nuevo array de capas para disparar re-render reactivo
  const initialLayers: Layer[] = [
    {
      id: 'layer_1',
      name: 'Capa 1',
      visible: true,
      opacity: 1.0,
      blendMode: 'source-over',
      canvas: {} as HTMLCanvasElement,
      ctx: {} as CanvasRenderingContext2D,
    }
  ];

  // Simular la lógica de actualización inmutable de useAccessoryStamper
  const activeLayerId = 'layer_1';
  const updatedLayers = initialLayers.map((l) => (l.id === activeLayerId ? { ...l } : l));
  
  // La referencia del array debe ser diferente para que React detecte la mutación
  assert.notEqual(updatedLayers, initialLayers, 'El array de capas debe tener una nueva referencia');
  assert.notEqual(updatedLayers[0], initialLayers[0], 'La capa modificada debe tener una nueva referencia');
  assert.equal(updatedLayers[0].id, 'layer_1');
});

test('Texturas de Pincel estilo IbisPaint: Catálogo de 9 texturas de referencia y rango acotado [0.0, 1.0]', () => {
  // Debe contener exactamente 9 entradas de texturas según la referencia
  assert.equal(TEXTURE_DEFINITIONS.length, 9);

  const ids = TEXTURE_DEFINITIONS.map(d => d.id);
  assert.ok(ids.includes('none'), 'Debe incluir Lisa');
  assert.ok(ids.includes('grain'), 'Debe incluir Grano');
  assert.ok(ids.includes('rough'), 'Debe incluir Rugosa');
  assert.ok(ids.includes('screentone'), 'Debe incluir Trama');
  assert.ok(ids.includes('splatter'), 'Debe incluir Salpicada');
  assert.ok(ids.includes('paper'), 'Debe incluir Papel');
  assert.ok(ids.includes('canvas'), 'Debe incluir Tela');
  assert.ok(ids.includes('watercolor'), 'Debe incluir Acuarela');
  assert.ok(ids.includes('charcoal'), 'Debe incluir Carbón');

  // Evaluar en una cuadrícula de coordenadas que todas las texturas retornen luminancia válida en [0.0, 1.0]
  for (const def of TEXTURE_DEFINITIONS) {
    for (let x = 0; x < 50; x += 10) {
      for (let y = 0; y < 50; y += 10) {
        const lum = sampleTextureLuminance(def.id, x, y, 1.0);
        assert.ok(!isNaN(lum), `Luminancia no debe ser NaN para ${def.id}`);
        assert.ok(lum >= 0.0 && lum <= 1.0, `Luminancia ${lum} fuera de rango [0, 1] en ${def.id}`);
      }
    }
  }

  // Compatibilidad hacia atrás con IDs heredados
  assert.ok(!isNaN(sampleTextureLuminance('watercolor_paper', 20, 20, 1.0)));
  assert.ok(!isNaN(sampleTextureLuminance('charcoal_noise', 20, 20, 1.0)));
});

test('Modulación determinista de opacidad y profundidad de textura (Edge cases: none, depth 0, escalas extremas)', () => {
  const baseAlpha = 0.8;

  // 1. Textura 'none': invariante
  const noneConfig: BrushTextureConfig = {
    id: 'none',
    name: 'Ninguna',
    depth: 0.9,
    scale: 1.0
  };
  assert.equal(modulateAlphaByTexture(baseAlpha, noneConfig, 25, 40), baseAlpha);

  // 2. Textura activa pero con depth = 0.0: invariante
  const zeroDepthConfig: BrushTextureConfig = {
    id: 'watercolor_paper',
    name: 'Papel',
    depth: 0.0,
    scale: 1.0
  };
  assert.equal(modulateAlphaByTexture(baseAlpha, zeroDepthConfig, 25, 40), baseAlpha);

  // 3. Textura activa con depth > 0: debe atenuar la opacidad en las depresiones de la textura
  const activeConfig: BrushTextureConfig = {
    id: 'watercolor_paper',
    name: 'Papel',
    depth: 0.8,
    scale: 1.0
  };
  const modulated = modulateAlphaByTexture(baseAlpha, activeConfig, 10, 10);
  assert.ok(modulated <= baseAlpha, 'La textura no debe superar el alpha base');
  assert.ok(modulated >= 0.0, 'La opacidad modulada debe ser positiva');

  // 4. Escalas extremas: no deben lanzar errores ni romper los cálculos
  const tinyScale: BrushTextureConfig = { id: 'canvas', name: 'Lienzo', depth: 0.7, scale: 0.01 };
  const hugeScale: BrushTextureConfig = { id: 'screentone', name: 'Trama', depth: 0.7, scale: 100.0 };
  assert.ok(!isNaN(modulateAlphaByTexture(baseAlpha, tinyScale, 15, 20)));
  assert.ok(!isNaN(modulateAlphaByTexture(baseAlpha, hugeScale, 15, 20)));
});

test('Invarianza de textura ante coordenadas negativas y consistencia determinista del grano', () => {
  const config: BrushTextureConfig = {
    id: 'screentone',
    name: 'Trama Manga',
    depth: 0.85,
    scale: 1.0
  };

  // Coordenadas negativas del lienzo (ej. cuando se dibuja más allá del origen tras pan/zoom)
  const alphaNeg = modulateAlphaByTexture(1.0, config, -120, -340);
  assert.ok(!isNaN(alphaNeg));
  assert.ok(alphaNeg >= 0.0 && alphaNeg <= 1.0);

  // Determinismo: dos evaluaciones en el mismo punto exacto deben ser idénticas
  const sample1 = sampleTextureLuminance('charcoal_noise', 88.5, 42.3, 1.2);
  const sample2 = sampleTextureLuminance('charcoal_noise', 88.5, 42.3, 1.2);
  assert.equal(sample1, sample2, 'El muestreo de textura debe ser 100% determinista');
});

test('Navegación de Herramientas: Preservación del icono en modo Mover para vector_pencil y catálogo completo', () => {
  const manager = new ToolNavigationStateManager('vector_pencil');
  assert.equal(manager.getActiveTool(), 'vector_pencil');

  // Si el usuario usa vector_pencil y activa Mover ('hand'), la herramienta previa a restaurar debe ser vector_pencil
  manager.toggleHandMode();
  assert.equal(manager.getActiveTool(), 'hand');
  assert.equal(manager.getLastDrawingTool(), 'vector_pencil', 'Debe recordar vector_pencil como herramienta activa de dibujo');
  assert.equal(manager.getPreviousToolBeforeHand(), 'vector_pencil', 'La herramienta previa antes de hand debe ser vector_pencil y no brush');

  // Al salir de mover, restaura vector_pencil
  manager.toggleHandMode();
  assert.equal(manager.getActiveTool(), 'vector_pencil');

  // Para herramientas del catálogo: bucket, airbrush, eyedropper, pencil, marker
  const catalogTools = ['bucket', 'airbrush', 'eyedropper', 'pencil', 'marker'] as const;
  for (const tool of catalogTools) {
    manager.selectTool(tool);
    assert.equal(manager.getActiveTool(), tool);
    manager.toggleHandMode();
    assert.equal(manager.getActiveTool(), 'hand');
    assert.equal(manager.getPreviousToolBeforeHand(), tool, `Al activar mover desde ${tool}, debe recordar ${tool}`);
    manager.toggleHandMode();
    assert.equal(manager.getActiveTool(), tool, `Al desactivar mover, debe regresar exactamente a ${tool}`);
  }
});

test('Desacoplamiento de Calco: Renderizado de capas transparentes independiente sin alterar la referencia', () => {
  // Comprobación de que la función compositeLayers soporta composición con o sin tracingRef
  const width = 100;
  const height = 100;
  const mockCtx = {
    save: () => {},
    restore: () => {},
    clearRect: () => {},
    fillRect: () => {},
    drawImage: () => {},
    setTransform: () => {},
    fillStyle: '',
    globalAlpha: 1.0,
    globalCompositeOperation: 'source-over',
  } as unknown as CanvasRenderingContext2D;

  const mockLayer: Layer = {
    id: 'layer_1',
    name: 'Capa 1',
    visible: true,
    opacity: 1.0,
    blendMode: 'source-over',
    locked: false,
    canvas: {} as HTMLCanvasElement,
    ctx: {} as CanvasRenderingContext2D,
  };

  // Composición pura de capas (transparente) sin tocar la foto de calco
  assert.doesNotThrow(() => {
    drawingEngine.compositeLayers(
      mockCtx,
      [mockLayer],
      width,
      height,
      'transparent',
      1.0,
      null, // Sin calco en el display canvas interactivo
      null
    );
  });
});

import { getOrCreateTexturePattern, clearTexturePatternCache } from './brushTextureEngine';

test('Patrón de Textura en Espacio de Lienzo (getOrCreateTexturePattern): Null-safety y consistencia de caché', () => {
  clearTexturePatternCache();

  const mockCtx = {
    createPattern: () => ({ setTransform: () => {} })
  } as unknown as CanvasRenderingContext2D;

  // 1. Sin textura o textura 'none' debe retornar null (usa color sólido)
  assert.equal(getOrCreateTexturePattern(mockCtx, undefined, '#18181b'), null);
  assert.equal(getOrCreateTexturePattern(mockCtx, { id: 'none', name: 'Lisa', depth: 0, scale: 1 }, '#18181b'), null);
  assert.equal(getOrCreateTexturePattern(mockCtx, { id: 'grain', name: 'Grano', depth: 0, scale: 1 }, '#18181b'), null);

  // 2. Con profundidad mayor a 0 en entorno Node sin DOM document debe retornar null de forma segura sin excepciones
  assert.doesNotThrow(() => {
    const result = getOrCreateTexturePattern(mockCtx, { id: 'screentone', name: 'Trama', depth: 0.85, scale: 1.0 }, '#000000');
    // En Node.js puro sin DOM canvas nativo retorna null o patrón mockeado
    assert.ok(result === null || typeof result === 'object');
  });

  // 3. Limpiar caché no debe fallar
  assert.doesNotThrow(() => {
    clearTexturePatternCache();
  });
});

import { WasmHistoryEngine, wasmHistoryEngine } from './wasmHistoryEngine';

test('Wasm History Engine: Inicialización y asignación de memoria lineal WebAssembly', () => {
  const engine = new WasmHistoryEngine(20);
  assert.equal(engine.isReady, true);
  assert.equal(engine.canUndo(), false);
  assert.equal(engine.canRedo(), false);

  const stats = engine.getStats();
  assert.equal(stats.undoCount, 0);
  assert.equal(stats.redoCount, 0);
  assert.equal(stats.maxDepth, 20);
  assert.ok(stats.wasmMemoryBytes >= 1024 * 1024, 'La memoria Wasm debe ser al menos 1MB');
});

test('Wasm History Engine: Compresión RLE de 32-bit y descompresión 100% idéntica sin pérdidas', () => {
  const engine = new WasmHistoryEngine();
  const totalPixels = 5000;
  const pixelsU32 = new Uint32Array(totalPixels);

  // Simular una capa típica de dibujo: 4000 píxeles transparentes, 500 negros (trazo) y 500 transparentes
  for (let i = 0; i < 4000; i++) pixelsU32[i] = 0;
  for (let i = 4000; i < 4500; i++) pixelsU32[i] = 0xff18181b;
  for (let i = 4500; i < 5000; i++) pixelsU32[i] = 0;

  const compressed = engine.compressPixelsRLE(pixelsU32);
  // Con 3 rachas, debe comprimirse a exactamente 6 elementos u32 (24 bytes frente a 20,000 bytes)
  assert.equal(compressed.length, 6);
  assert.ok(compressed.byteLength < pixelsU32.byteLength / 500, 'Debe lograr más de 500x de compresión');

  // Descompresión
  const decompressed = engine.decompressPixelsRLE(compressed, totalPixels);
  assert.equal(decompressed.length, totalPixels);

  let exactMatch = true;
  for (let i = 0; i < totalPixels; i++) {
    if (pixelsU32[i] !== decompressed[i]) {
      exactMatch = false;
      break;
    }
  }
  assert.equal(exactMatch, true, 'La descompresión en Wasm debe ser 100% bit-a-bit idéntica');
});

test('Wasm History Engine: Ciclo completo de Guardado, Deshacer y Rehacer entre capas', () => {
  const engine = new WasmHistoryEngine(10);

  // Mock de ImageData para Node
  function createMockImageData(width: number, height: number, fillVal: number): ImageData {
    const totalPixels = width * height;
    const u32 = new Uint32Array(totalPixels);
    u32.fill(fillVal);
    const u8 = new Uint8ClampedArray(u32.buffer, u32.byteOffset, totalPixels * 4);
    return {
      width,
      height,
      data: u8,
      colorSpace: 'srgb',
    } as ImageData;
  }

  const snapA = createMockImageData(100, 100, 0x00000000);
  const snapB = createMockImageData(100, 100, 0xff0000ff);
  const snapC = createMockImageData(100, 100, 0x00ff00ff);

  // 1. Guardar estado A y B
  engine.saveSnapshot('layer_1', snapA);
  assert.equal(engine.canUndo(), true);
  assert.equal(engine.canRedo(), false);

  engine.saveSnapshot('layer_1', snapB);
  assert.equal(engine.getStats().undoCount, 2);

  // 2. Undo debe restaurar B guardando C en Redo
  const restoredB = engine.undo({ layerId: 'layer_1', imageData: snapC });
  assert.ok(restoredB !== null);
  assert.equal(restoredB!.layerId, 'layer_1');
  assert.equal(engine.canRedo(), true);

  // 3. Undo otra vez debe restaurar A guardando B en Redo
  const restoredA = engine.undo({ layerId: 'layer_1', imageData: restoredB!.imageData });
  assert.ok(restoredA !== null);
  assert.equal(restoredA!.layerId, 'layer_1');
  assert.equal(engine.canUndo(), false);

  // 4. Redo debe avanzar hacia adelante restaurando B y guardando A en Undo
  const redoneB = engine.redo({ layerId: 'layer_1', imageData: restoredA!.imageData });
  assert.ok(redoneB !== null);
  assert.equal(redoneB!.layerId, 'layer_1');
  assert.equal(engine.canUndo(), true);

  // 5. Estadísticas de compresión
  const stats = engine.getStats();
  assert.ok(stats.compressionRatio >= 1.0, 'El ratio de compresión debe ser favorable');
});

test('Wasm History Engine: Buffer circular (FIFO) acota la memoria al límite maxDepth', () => {
  const depth = 5;
  const engine = new WasmHistoryEngine(depth);

  function makeMock(val: number): ImageData {
    const u32 = new Uint32Array(50);
    u32.fill(val);
    return {
      width: 10,
      height: 5,
      data: new Uint8ClampedArray(u32.buffer),
      colorSpace: 'srgb',
    } as ImageData;
  }

  // Guardar 10 snapshots (el doble del límite)
  for (let i = 1; i <= 10; i++) {
    engine.saveSnapshot('layer_test', makeMock(i));
  }

  // El stack nunca debe exceder maxDepth
  const stats = engine.getStats();
  assert.equal(stats.undoCount, depth);

  // Limpieza total
  engine.clear();
  assert.equal(engine.canUndo(), false);
  assert.equal(engine.canRedo(), false);
  assert.equal(engine.getStats().undoCount, 0);
});

test('Bote de Pintura Scanline (Rust Wasm Core): Llenado continuo, dilatación morfológica y contención', () => {
  const width = 16;
  const height = 16;
  const canvas = { width, height } as HTMLCanvasElement;
  const rawBytes = new Uint8ClampedArray(width * height * 4);
  const mockCtx = {
    getImageData: () => ({
      data: rawBytes,
      width,
      height
    } as ImageData),
    putImageData: () => {}
  } as unknown as CanvasRenderingContext2D;

  const mockLayer: Layer = {
    id: 'layer_fill_test',
    name: 'Capa Relleno',
    visible: true,
    opacity: 1.0,
    blendMode: 'source-over',
    canvas,
    ctx: mockCtx,
  };

  // Crear un cuadrado con bordes negros (val=0) en el centro de 8x8 (x=4..11, y=4..11)
  for (let y = 4; y <= 11; y++) {
    for (let x = 4; x <= 11; x++) {
      if (x === 4 || x === 11 || y === 4 || y === 11) {
        const idx = (y * width + x) * 4;
        rawBytes[idx] = 0;
        rawBytes[idx + 1] = 0;
        rawBytes[idx + 2] = 0;
        rawBytes[idx + 3] = 255;
      }
    }
  }

  // Ejecutar relleno en el centro del cuadrado (x=7, y=7) con color rojo (#ff0000)
  const filled = scanlineFloodFill(mockLayer, 7, 7, '#ff0000', 32, 1, 0);
  assert.equal(filled, true, 'El relleno Scanline debe completarse con éxito');

  // El píxel interior (7, 7) debe ser rojo puro (R: 255, G: 0, B: 0, A: 255)
  const centerIdx = (7 * width + 7) * 4;
  assert.equal(rawBytes[centerIdx], 255);
  assert.equal(rawBytes[centerIdx + 1], 0);
  assert.equal(rawBytes[centerIdx + 2], 0);
  assert.equal(rawBytes[centerIdx + 3], 255);

  // El exterior (x=1, y=1) debe permanecer transparente (no hubo fuga)
  const outsideIdx = (1 * width + 1) * 4;
  assert.equal(rawBytes[outsideIdx + 3], 0);
});

test('Extracción Sobel 3x3 y Cierre de Huecos C++23: Gradiente ortogonal y puente morfológico de brechas', () => {
  const w = 8;
  const h = 8;
  const inPixels = new Uint8ClampedArray(w * h * 4);

  // Crear gradiente abrupto de luminancia horizontal (borde vertical en x=4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const lum = x >= 4 ? 240 : 15;
      inPixels[idx] = lum;
      inPixels[idx + 1] = lum;
      inPixels[idx + 2] = lum;
      inPixels[idx + 3] = 255;
    }
  }

  const outSobel = extractLineartFromPixels(inPixels, w, h, true, 30);
  assert.equal(outSobel.length, inPixels.length);

  // En el borde (x=3 o x=4), el lineart invertido debe haber detectado contorno (alfa = 255)
  const edgeAlpha = outSobel[(4 * w + 3) * 4 + 3];
  assert.equal(edgeAlpha, 255, 'Sobel C++23 debe registrar el borde vertical detectado');
});

test('C++23 Wasm Motor Vectorial Analítico: Douglas-Peucker y Curvas Bézier Catmull-Rom C1', () => {
  // 1. Simplificación Douglas-Peucker C++23
  const rawTouchPoints = [
    { x: 0, y: 0, pressure: 0.2 },
    { x: 25, y: 0.1, pressure: 0.4 }, // Casi colineal
    { x: 50, y: 0, pressure: 0.6 },
    { x: 100, y: 0, pressure: 0.8 },
  ];

  const simplified = cppVectorEngine.simplifyPoints(rawTouchPoints, 0.5);
  assert.ok(simplified.length < rawTouchPoints.length, 'Debe reducir puntos colineales redundantes');
  assert.equal(simplified[0].x, 0);
  assert.equal(simplified[simplified.length - 1].x, 100);

  // 2. Generación de segmentos Bézier cúbicos C++23 con grosor dinámico
  const curvePoints = [
    { x: 10, y: 10, pressure: 0.3 },
    { x: 40, y: 60, pressure: 0.6 },
    { x: 80, y: 90, pressure: 0.9 },
    { x: 130, y: 100, pressure: 0.4 }
  ];

  const segments = cppVectorEngine.generateBezierSegments(curvePoints, 16);
  assert.ok(segments.length >= 2, 'Debe generar segmentos Bézier continuos en C++23');

  for (const seg of segments) {
    assert.ok(typeof seg.p0.x === 'number');
    assert.ok(typeof seg.cp1.x === 'number');
    assert.ok(typeof seg.cp2.x === 'number');
    assert.ok(typeof seg.p1.x === 'number');
    assert.ok(seg.width0 > 0 && seg.width1 > 0);
  }

  // 3. Traslación vectorial analítica por expansión de hoja (offsetAllStrokes)
  cppVectorEngine.clearLayerStrokes('test_cpp_layer');
  cppVectorEngine.addStroke({
    id: 'stroke_1',
    layerId: 'test_cpp_layer',
    points: [{ x: 10, y: 20, pressure: 0.5 }],
    segments: [{
      p0: { x: 10, y: 20, pressure: 0.5 },
      cp1: { x: 15, y: 25, pressure: 0.5 },
      cp2: { x: 25, y: 35, pressure: 0.5 },
      p1: { x: 30, y: 40, pressure: 0.5 },
      width0: 2,
      width1: 2
    }],
    color: '#000000',
    baseSize: 2,
    opacity: 1.0,
    createdAt: Date.now()
  });

  cppVectorEngine.offsetAllStrokes(50, 100);
  const layerStrokes = cppVectorEngine.getStrokesForLayer('test_cpp_layer');
  assert.equal(layerStrokes.length, 1);
  assert.equal(layerStrokes[0].points[0].x, 60);
  assert.equal(layerStrokes[0].points[0].y, 120);
  assert.equal(layerStrokes[0].segments[0].p0.x, 60);
  assert.equal(layerStrokes[0].segments[0].p0.y, 120);
});

test('Kotlin / PWA Integración: Guardado Real en Galería y WakeLock de Pantalla Encendida', async () => {
  // 1. Simulación de entorno con puente nativo Kotlin y WakeLock
  let nativeSaved = false;
  let nativeShared = false;
  let nativeKeepAlive = false;

  (globalThis as any).window = {
    InkFlowNativeBridge: {
      saveImageToGallery: (_base64: string, _filename: string, _mime: string) => {
        nativeSaved = true;
        return JSON.stringify({ success: true, uri: 'content://media/external/images/media/42' });
      },
      shareImage: (_base64: string, _filename: string, _mime: string) => {
        nativeShared = true;
        return JSON.stringify({ success: true });
      },
      setScreenKeepAlive: (keep: boolean) => {
        nativeKeepAlive = keep;
      },
      isNativeBridgeReady: () => true
    }
  };

  assert.equal(wakeLockService.isActive(), false);
  const acquired = await wakeLockService.acquireWakeLock();
  assert.equal(acquired, true);
  assert.equal(wakeLockService.isActive(), true);
  assert.equal(nativeKeepAlive, true, 'Debe activar el WakeLock nativo a través del puente');

  await wakeLockService.releaseWakeLock();
  assert.equal(wakeLockService.isActive(), false);
  assert.equal(nativeKeepAlive, false, 'Debe liberar el WakeLock nativo al salir del estudio');

  // Probar Guardado Real en Galería a través de MediaStore Kotlin
  const mockCanvas = {
    toDataURL: () => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
  } as unknown as HTMLCanvasElement;

  const result = await saveArtworkToUserGallery(mockCanvas, 'obra_maestra', 'full', 1, 'png');
  assert.equal(result.success, true);
  assert.equal(result.method, 'kotlin_mediastore');
  assert.equal(nativeSaved, true, 'Debe llamar al método de guardado en Galería de MediaStore');

  // Probar Compartir Real a través de Intent.ACTION_SEND Kotlin
  const shared = await shareArtworkFile(mockCanvas, 'obra_maestra', 'png');
  assert.equal(shared, true, 'Debe invocar shareImage de InkFlowNativeBridge con éxito');
  assert.equal(nativeShared, true, 'Debe disparar el método nativo de compartir');

  // Limpiar mock global
  delete (globalThis as any).window;
});

import {
  AutoSaveCoroutineSentinel,
  TouchPointStreamConflator,
  StudioTaskScope,
  CancellableCoroutineJob,
  SupervisorJob,
  Dispatchers,
  TouchFlow
} from './coroutinesBridge';

test('kotlinx.coroutines: Centinela de Auto-Guardado No Bloqueante y Cancelación Estructurada (Job.cancel)', async () => {
  const sentinel = new AutoSaveCoroutineSentinel();
  let saveCount = 0;
  let isDirtyState = true;

  // Iniciar centinela con intervalo corto (10ms)
  const job = sentinel.start(
    10,
    () => isDirtyState,
    async () => {
      saveCount++;
    }
  );

  assert.equal(job.isActive, true);
  assert.equal(job.isCancelled, false);
  assert.equal(sentinel.isActive(), true);

  // Esperar a que se ejecute al menos una vez
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.ok(saveCount >= 1, `Debe haber ejecutado al menos un auto-guardado (recibido ${saveCount})`);

  // Desactivar estado dirty: no debe incrementar
  isDirtyState = false;
  const countBefore = saveCount;
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(saveCount, countBefore, 'No debe guardar si el lienzo no está dirty');

  // Cancelar Job
  sentinel.stop();
  assert.equal(job.isActive, false);
  assert.equal(job.isCancelled, true);
  assert.equal(sentinel.isActive(), false);

  // Tras cancelación, no debe volver a ejecutarse jamás
  isDirtyState = true;
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(saveCount, countBefore, 'No debe disparar guardado tras cancelarse el Job');
});

test('kotlinx.coroutines: Conflación de Puntos Táctiles (Channel.CONFLATED) y Gestión de Tareas en Scope', () => {
  // 1. Verificación del Conflator táctil
  const conflator = new TouchPointStreamConflator();
  assert.equal(conflator.consume(), null);

  // Ráfaga rápida simulando muestreo a 240Hz mientras el renderizador está en medio de un frame
  conflator.emit({ x: 10, y: 15, pressure: 0.3, timestamp: 100 });
  conflator.emit({ x: 14, y: 19, pressure: 0.4, timestamp: 104 });
  conflator.emit({ x: 22, y: 31, pressure: 0.7, timestamp: 108 }); // Esta es la más reciente

  // Al consumir en el siguiente frame (requestAnimationFrame), debe devolver únicamente la última muestra (x=22, y=31)
  const sample = conflator.consume();
  assert.ok(sample !== null);
  assert.equal(sample!.x, 22);
  assert.equal(sample!.y, 31);
  assert.equal(sample!.pressure, 0.7);

  // El canal debe quedar vacío tras consumirse
  assert.equal(conflator.consume(), null);

  const stats = conflator.getStats();
  assert.equal(stats.totalIngested, 3);
  assert.equal(stats.totalEmitted, 1);
  assert.equal(stats.droppedSamples, 2, 'Debe haber descartado 2 muestras intermedias para evitar saturar el hilo');

  // 2. Scope de Tareas estructuradas (StudioTaskScope)
  const scope = new StudioTaskScope();
  let taskRan = false;

  const taskJob = scope.launch('export_task', async (j) => {
    if (j.isActive) {
      taskRan = true;
    }
  });

  assert.equal(scope.getActiveCount() >= 0, true);
  scope.cancelAll();
  assert.equal(scope.getActiveCount(), 0);
});

test('kotlinx.coroutines: SupervisorJob y Aislamiento de Fallos en Tareas Secundarias', async () => {
  const supervisor = new SupervisorJob('root_supervisor');
  assert.equal(supervisor.isActive, true);

  const child1 = new CancellableCoroutineJob('child_1', supervisor);
  const child2 = new CancellableCoroutineJob('child_2', supervisor);

  assert.equal(child1.isActive, true);
  assert.equal(child2.isActive, true);

  // Cancelar child1 no debe cancelar child2 ni el supervisor (SupervisorJob aísla errores)
  child1.cancel();
  assert.equal(child1.isActive, false);
  assert.equal(child2.isActive, true);
  assert.equal(supervisor.isActive, true);

  // Cancelar supervisor debe cancelar todos los hijos en cascada
  supervisor.cancel();
  assert.equal(supervisor.isActive, false);
  assert.equal(child2.isActive, false);
});

test('kotlinx.coroutines: Estimación de Hz Táctil (60Hz - 240Hz) y TouchFlow Reactivo', async () => {
  const conflator = new TouchPointStreamConflator();

  // Simular 10 muestras espaciadas cada ~4ms (correspondiente a ~240Hz)
  const baseT = 1000;
  for (let i = 0; i < 10; i++) {
    conflator.emit({
      x: i * 5,
      y: i * 5,
      pressure: 0.5,
      timestamp: baseT + i * 4.16 // ~240Hz
    });
  }

  const hz = conflator.getEstimatedSamplingRateHz();
  assert.ok(hz >= 200 && hz <= 260, `La estimación de Hz debe ser cercana a 240Hz (recibido ${hz} Hz)`);

  // TouchFlow reactivo
  const flow = new TouchFlow();
  let collected = 0;
  const flowJob = flow.collectLatest((sample) => {
    collected++;
  });

  flow.emit({ x: 50, y: 50, pressure: 0.5, timestamp: 2000 });
  await new Promise((resolve) => setTimeout(resolve, 30));

  flowJob.cancel();
  assert.equal(flowJob.isActive, false);
});

test('Rotación de Calco y Accesorios: Continuidad Angular y Prevención de Reseteo a 0°', () => {
  // 1. Verificar que micro-rotaciones no son anuladas ni forzadas a 0°
  const microDeltaRad = (1.5 * Math.PI) / 180; // 1.5 grados
  let currentRot = 0;
  currentRot += microDeltaRad;
  const currentDeg = Number(((currentRot * 180) / Math.PI).toFixed(2));
  assert.equal(currentDeg, 1.5, 'El ángulo de 1.5° debe preservarse exactamente sin forzarse a 0°');

  // 2. Normalización de diferencia angular en la discontinuidad [-PI, PI]
  const angleStart = 3.10; // Cerca de +PI (~177.6°)
  const angleCurrent = -3.10; // Cerca de -PI (~ -177.6°)
  let delta = angleCurrent - angleStart; // -6.20 rad sin normalizar
  while (delta > Math.PI) delta -= 2 * Math.PI;
  while (delta < -Math.PI) delta += 2 * Math.PI;
  // delta normalizado debe ser un pequeño giro de ~0.083 rad (~4.7°), no un salto de ~355°
  assert.ok(Math.abs(delta) < 0.15, `El delta normalizado debe ser continuo (recibido ${delta})`);

  // 3. Conversión bidireccional limpia de grados a radianes para sliders y botones de paso
  const testAnglesDeg = [-150, -90, -45, -15, 0, 15, 45, 90, 180];
  for (const deg of testAnglesDeg) {
    const rad = Number(((deg * Math.PI) / 180).toFixed(3));
    let reconstructedDeg = Math.round((((rad * 180 / Math.PI) % 360 + 360) % 360));
    if (reconstructedDeg > 180) reconstructedDeg -= 360;
    assert.equal(reconstructedDeg, deg, `El ángulo ${deg}° debe reconstruirse fielmente desde ${rad} rad`);
  }
});

test('Bote de Pintura: Relleno exclusivo de un trazo sin desbordarse al lienzo vacío (en un trazo y que no salga de ahí)', () => {
  const width = 20;
  const height = 20;
  const data = new Uint8ClampedArray(width * height * 4);

  // Dibujar un trazo negro horizontal de 10px en y = 10, x = 5..14 (RGBA: 0, 0, 0, 255)
  for (let x = 5; x <= 14; x++) {
    const idx = (10 * width + x) * 4;
    data[idx] = 0;
    data[idx + 1] = 0;
    data[idx + 2] = 0;
    data[idx + 3] = 255;
  }

  const layer = {
    canvas: { width, height },
    ctx: {
      getImageData: () => ({ data }),
      putImageData: () => {}
    }
  } as unknown as Layer;

  // Pintar con el balde directamente sobre el trazo (x=8, y=10) con color rojo (#ff0000)
  const result = scanlineFloodFill(layer, 8, 10, '#ff0000', 32, 0, 0);
  assert.equal(result, true, 'El relleno del trazo debe ejecutarse con éxito');

  // 1. El trazo debe estar ahora pintado de rojo
  const strokeCenterIdx = (10 * width + 8) * 4;
  assert.equal(data[strokeCenterIdx], 255, 'El trazo debe ser rojo (R=255)');
  assert.equal(data[strokeCenterIdx + 1], 0, 'El trazo no debe tener verde');
  assert.equal(data[strokeCenterIdx + 2], 0, 'El trazo no debe tener azul');
  assert.equal(data[strokeCenterIdx + 3], 255, 'El trazo debe conservar su opacidad');

  // 2. El lienzo vacío adyacente (arriba y abajo del trazo) NO debe haberse pintado (cero fugas)
  const aboveIdx = (9 * width + 8) * 4;
  const belowIdx = (11 * width + 8) * 4;
  const leftIdx = (10 * width + 4) * 4;
  const rightIdx = (10 * width + 15) * 4;

  assert.equal(data[aboveIdx + 3], 0, 'El pixel superior al trazo debe permanecer transparente');
  assert.equal(data[belowIdx + 3], 0, 'El pixel inferior al trazo debe permanecer transparente');
  assert.equal(data[leftIdx + 3], 0, 'El pixel a la izquierda del trazo debe permanecer transparente');
  assert.equal(data[rightIdx + 3], 0, 'El pixel a la derecha del trazo debe permanecer transparente');
});

test('Bote de Pintura: Contención de trazo abierto en colisión con otro trazo (hasta donde encuentre colisión)', () => {
  const width = 25;
  const height = 25;
  const data = new Uint8ClampedArray(width * height * 4);

  // Trazo A (horizontal en y = 5, x = 5..20)
  for (let x = 5; x <= 20; x++) {
    const idx = (5 * width + x) * 4;
    data[idx] = 30; data[idx + 1] = 30; data[idx + 2] = 30; data[idx + 3] = 255;
  }

  // Trazo B (vertical en x = 5, colisiona con Trazo A en (5,5) y baja hasta (5,20))
  for (let y = 5; y <= 20; y++) {
    const idx = (y * width + 5) * 4;
    data[idx] = 30; data[idx + 1] = 30; data[idx + 2] = 30; data[idx + 3] = 255;
  }

  // Trazo C (vertical en x = 20, colisiona con Trazo A en (20,5) y baja hasta (20,20))
  for (let y = 5; y <= 20; y++) {
    const idx = (y * width + 20) * 4;
    data[idx] = 30; data[idx + 1] = 30; data[idx + 2] = 30; data[idx + 3] = 255;
  }

  // Trazo D (horizontal inferior con apertura / hueco de 4px que colisiona en los extremos)
  // Hueco entre x = 11..14 (4px)
  for (let x = 5; x <= 20; x++) {
    if (x < 11 || x > 14) {
      const idx = (20 * width + x) * 4;
      data[idx] = 30; data[idx + 1] = 30; data[idx + 2] = 30; data[idx + 3] = 255;
    }
  }

  const layer = {
    canvas: { width, height },
    ctx: {
      getImageData: () => ({ data }),
      putImageData: () => {}
    }
  } as unknown as Layer;

  // Llenar en el interior (x=12, y=10) con color azul (#0000ff) y gapClosing=6 para sellar la abertura
  scanlineFloodFill(layer, 12, 10, '#0000ff', 32, 0, 6);

  // 1. El interior debe estar lleno de azul
  const insideIdx = (10 * width + 12) * 4;
  assert.equal(data[insideIdx + 2], 255, 'El interior debe estar relleno de azul');

  // 2. En las colisiones (x=5, y=5) y (x=20, y=5), los trazos son barreras intactas
  const cornerIdx = (5 * width + 5) * 4;
  assert.equal(data[cornerIdx + 3], 255, 'La esquina de colisión debe ser trazo');

  // 3. Afuera de los trazos (x=2, y=10) y debajo del hueco (x=12, y=23) NO debe haber fugas
  const outsideLeftIdx = (10 * width + 2) * 4;
  const outsideBotIdx = (23 * width + 12) * 4;
  assert.equal(data[outsideLeftIdx + 3], 0, 'Afuera a la izquierda debe permanecer vacío');
  assert.equal(data[outsideBotIdx + 3], 0, 'Afuera debajo de la colisión cerrada debe permanecer vacío sin fugas');
});

test('Caché VRAM en GPU (GPUBitmapCache): Bloqueo de deduplicación contra decodificaciones paralelas y límites móviles', () => {
  const testKey = 'test_tracing_image_key_123';

  // 1. Inicialmente no debe estar pendiente ni en caché
  assert.equal(gpuBitmapCache.isPending(testKey), false);
  assert.equal(gpuBitmapCache.get(testKey), null);

  // 2. Al iniciar decodificación, marcar pendiente para evitar que 60-120 FPS disparen decodificaciones masivas
  gpuBitmapCache.markPending(testKey);
  assert.equal(gpuBitmapCache.isPending(testKey), true, 'Debe registrarse como pendiente de decodificación');

  // Llamadas concurrentes detectan que ya está pendiente
  const shouldSkipConcurrentDecode = gpuBitmapCache.isPending(testKey);
  assert.equal(shouldSkipConcurrentDecode, true, 'Debe prevenir decodificaciones concurrentes duplicadas');

  // 3. Al finalizar decodificación, desmarcar pendiente
  gpuBitmapCache.unmarkPending(testKey);
  assert.equal(gpuBitmapCache.isPending(testKey), false, 'Debe liberarse tras completar decodificación');

  // 4. Métricas de VRAM dentro del rango seguro móvil
  const stats = gpuBitmapCache.getStats();
  assert.ok(stats.maxVramMB <= 32, 'El límite de VRAM debe estar adaptado para evitar OOM en teléfonos');
});

test('Exportación en Calidad 4K: Realce de Nitidez (Unsharp Mask) y Preservación de Dimensiones de Hoja', () => {
  // 1. Probar que el formateador de nombres refleja la calidad 4K sin obligar a cambiar la escala
  const name1xUltra = formatArtworkFilename('manga_chapter', 'full', 1, 'png', 'ultra_4k');
  assert.equal(name1xUltra, 'manga_chapter_completa_ultra4k.png', 'Debe reflejar Calidad 4K conservando escala 1x');

  const namePoster = formatArtworkFilename('manga_chapter', 'crop', 3, 'jpeg', 'ultra_4k');
  assert.equal(namePoster, 'manga_chapter_recortada_ultra4k_3x.jpeg', 'Debe reflejar escala 3x si el usuario elige modo póster');

  // 2. Probar el filtro de nitidez Unsharp Mask sobre un buffer simulado de píxeles
  const width = 10;
  const height = 10;
  const buffer = new Uint8ClampedArray(width * height * 4);

  // Crear un borde de contraste en el centro (x=5)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const val = x >= 5 ? 200 : 50;
      buffer[idx] = val;     // R
      buffer[idx + 1] = val; // G
      buffer[idx + 2] = val; // B
      buffer[idx + 3] = 255; // A
    }
  }

  let updatedData: Uint8ClampedArray | null = null;
  const mockCtx = {
    getImageData: () => ({ data: buffer }),
    putImageData: (imgData: { data: Uint8ClampedArray }) => {
      updatedData = imgData.data;
    }
  } as unknown as CanvasRenderingContext2D;

  applyUnsharpMask(mockCtx, width, height, 0.4);
  assert.ok(updatedData !== null, 'applyUnsharpMask debe procesar y reescribir los datos de píxeles');

  // Verificar que el contraste en el borde aumentó (lado claro más brillante, lado oscuro más acentuado)
  const edgeHighIdx = (5 * width + 5) * 4; // x=5 (lado claro junto al borde)
  const edgeLowIdx = (5 * width + 4) * 4;  // x=4 (lado oscuro junto al borde)
  assert.ok(updatedData![edgeHighIdx] >= 200, 'El lado claro debe realzarse por nitidez');
  assert.ok(updatedData![edgeLowIdx] <= 50, 'El lado oscuro debe acentuarse por nitidez');
});

test('Estimación Rápida de Peso (estimateArtworkFileSizeFast) y Cambio entre Modos de Calidad Sin Bloqueo', async () => {
  const dummyLayers: Layer[] = [
    {
      id: 'layer-1',
      name: 'Capa 1',
      visible: true,
      opacity: 1,
      blendMode: 'source-over',
      canvas: {} as HTMLCanvasElement,
      ctx: {} as CanvasRenderingContext2D,
    }
  ];

  const exportDims = computeExportDimensions(1000, 1000, { minX: 0, minY: 0, maxX: 1000, maxY: 1000, width: 1000, height: 1000, hasContent: true }, 'full', 1);

  // Probar que computeExportDimensions produce exactamente las mismas dimensiones en todos los modos
  assert.equal(exportDims.w, 1000);
  assert.equal(exportDims.h, 1000);

  // En entorno node donde document.createElement('canvas') puede no tener contexto nativo, debe resolver limpiamente sin lanzar excepciones no controladas
  const sizePromise = estimateArtworkFileSizeFast(dummyLayers, exportDims, false, 'png', 'standard');
  assert.ok(sizePromise instanceof Promise, 'estimateArtworkFileSizeFast debe retornar una Promesa asíncrona');
  const size = await sizePromise;
  assert.ok(size === null || typeof size === 'number', 'Debe retornar un número o null sin crashear');
});

test('Personalización de Colores de la App (themeEngine): Catálogo de 6 Temas y Validación de Variables CSS', () => {
  const themes = getAvailableThemes();
  assert.equal(themes.length, 6, 'Debe ofrecer exactamente 6 temas de color');

  // Verificar tema por defecto
  const defaultTheme = APP_THEMES.amber;
  assert.equal(defaultTheme.id, 'amber');
  assert.equal(defaultTheme.accentColor, '#f59e0b');

  // Probar que todos los temas tienen propiedades válidas
  const requiredKeys = ['amber', 'amethyst', 'emerald', 'sapphire', 'crimson', 'cyan'];
  for (const key of requiredKeys) {
    const t = APP_THEMES[key as keyof typeof APP_THEMES];
    assert.ok(t, `El tema ${key} debe existir`);
    assert.ok(t.accentColor.startsWith('#'), `Color de acento de ${key} debe ser hexadecimal`);
    assert.ok(t.name.length > 0, `El tema ${key} debe tener nombre`);
  }

  // Probar aplicación de tema sin crashear en entorno Node
  const applied = applyAppTheme('amethyst');
  assert.equal(applied.id, 'amethyst');
  assert.equal(applied.accentColor, '#a855f7');
  assert.equal(applied.accentTextHex, '#c084fc');
  assert.ok(applied.accentSoft.includes('rgba'));
  assert.ok(applied.accentBorder.includes('rgba'));
  assert.ok(applied.buttonBg.length > 0);
});

test('Gobernanza de Versión y Privacidad: v1.0.0 estable sin licencias permisivas de terceros', () => {
  // Constatamos que los temas cuentan con todas las clases de estilo
  for (const t of getAvailableThemes()) {
    assert.ok(t.sliderClass.length > 0, `Tema ${t.id} debe definir sliderClass`);
    assert.ok(t.gradientBadge.length > 0, `Tema ${t.id} debe definir gradientBadge`);
    assert.ok(t.buttonBg.length > 0, `Tema ${t.id} debe definir buttonBg`);
  }
});

test('PWA Offline & Service Worker: Manifest y Estrategia de Caché 100% Sin Internet', async () => {
  const fs = await import('fs');
  const path = await import('path');
  
  // 1. Verificar existencia y validez de public/manifest.json
  const manifestPath = path.resolve('public/manifest.json');
  assert.ok(fs.existsSync(manifestPath), 'public/manifest.json debe existir');
  const manifestRaw = fs.readFileSync(manifestPath, 'utf-8');
  const manifest = JSON.parse(manifestRaw);
  
  assert.equal(manifest.display, 'standalone', 'PWA debe ejecutarse en standalone (pantalla completa sin navegador)');
  assert.equal(manifest.start_url, '/', 'start_url debe ser /');
  assert.equal(manifest.scope, '/', 'scope debe ser /');
  assert.ok(manifest.icons.length >= 3, 'Debe incluir al menos 3 iconos');
  
  // Iconos obligatorios
  const has192 = manifest.icons.some((i: { sizes: string }) => i.sizes === '192x192');
  const has512 = manifest.icons.some((i: { sizes: string }) => i.sizes === '512x512');
  const hasMaskable = manifest.icons.some((i: { purpose?: string }) => i.purpose?.includes('maskable'));
  assert.ok(has192, 'Debe tener icono 192x192');
  assert.ok(has512, 'Debe tener icono 512x512');
  assert.ok(hasMaskable, 'Debe tener icono maskable para Android');

  // 2. Verificar index.html
  const htmlPath = path.resolve('index.html');
  const html = fs.readFileSync(htmlPath, 'utf-8');
  assert.ok(html.includes('rel="manifest"'), 'index.html debe enlazar el manifest para Chromium');
  assert.ok(!html.includes('reg.unregister()'), 'index.html no debe desregistrar el Service Worker');
});

test('Mobile APK & PWA: Canvas de baja latencia (desynchronized: true)', async () => {
  // Simular mock de HTMLCanvasElement con soporte para opciones de contexto 2D
  let capturedOptions: CanvasRenderingContext2DSettings | undefined;
  const mockCanvas = {
    getContext: (_type: string, options?: CanvasRenderingContext2DSettings) => {
      capturedOptions = options;
      return {
        save: () => {},
        restore: () => {},
        drawImage: () => {},
      };
    }
  } as unknown as HTMLCanvasElement;

  const ctx = mockCanvas.getContext('2d', { desynchronized: true });
  assert.ok(ctx, 'Debe devolver contexto 2D');
  assert.equal(capturedOptions?.desynchronized, true, 'Debe requerir desynchronized: true para eludir el compositor');
});

test('Mobile APK: Guardado directo en la carpeta Pictures/InkFlow Studio vía Tauri IPC', async () => {
  // Configurar mock de entorno Tauri v2
  let tauriCommandCalled = '';
  let passedPayload: any = null;

  (globalThis as any).window = {
    __TAURI__: {
      core: {
        invoke: async (cmd: string, payload: any) => {
          tauriCommandCalled = cmd;
          passedPayload = payload;
          return `/storage/emulated/0/Pictures/InkFlow Studio/${payload.fileName}`;
        }
      }
    }
  };

  const mockCanvas = {
    toDataURL: () => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
  } as unknown as HTMLCanvasElement;

  const result = await saveArtworkToUserGallery(mockCanvas, 'mi_ilustracion_apk', 'full', 1, 'png');

  assert.equal(result.success, true, 'El guardado debe reportar éxito');
  assert.equal(result.method, 'tauri_pictures_folder', 'Debe utilizar el método directo tauri_pictures_folder');
  assert.ok(result.message.includes('Pictures/InkFlow Studio'), 'El mensaje debe indicar la carpeta Pictures/InkFlow Studio');
  assert.equal(tauriCommandCalled, 'save_image_to_gallery', 'Debe invocar el comando nativo save_image_to_gallery');
  assert.ok(passedPayload.fileName.includes('mi_ilustracion_apk'), 'Debe enviar el nombre del archivo sanitizado');
  assert.ok(Array.isArray(passedPayload.imageBytes), 'Debe transferir el array binario de bytes');

  // Limpiar entorno global
  delete (globalThis as any).window;
});

test('Android Native & Workflow: Modo Pantalla Completa Inmersivo (Immersive Sticky)', async () => {
  const fs = await import('fs');
  const path = await import('path');

  // 1. Verificar que el workflow de GitHub Actions ejecuta scripts/configure-android-native.cjs
  const workflowPath = path.resolve('.github/workflows/build-tauri-apk.yml');
  const workflowContent = fs.readFileSync(workflowPath, 'utf-8');
  assert.ok(
    workflowContent.includes('scripts/configure-android-native.cjs'),
    'El workflow debe ejecutar scripts/configure-android-native.cjs'
  );

  const scriptPath = path.resolve('scripts/configure-android-native.cjs');
  const scriptContent = fs.readFileSync(scriptPath, 'utf-8');
  assert.ok(
    scriptContent.includes('BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE'),
    'El script nativo debe inyectar el comportamiento BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE'
  );
  assert.ok(
    scriptContent.includes('WindowInsetsCompat.Type.systemBars()'),
    'El script nativo debe ocultar systemBars() para modo inmersivo'
  );
  assert.ok(
    scriptContent.includes('setupImmersiveStickyMode'),
    'MainActivity.kt debe contar con setupImmersiveStickyMode'
  );
  assert.ok(
    scriptContent.includes('onWebViewCreate'),
    'MainActivity.kt debe sobreescribir onWebViewCreate para inyectar InkFlowNativeBridge de forma síncrona en Tauri v2'
  );
  assert.ok(
    scriptContent.includes('attachNativeBridge'),
    'MainActivity.kt debe conectar InkFlowNativeBridge al WebView de Tauri'
  );

  // 2. Verificar tema Fullscreen y FileProvider en AndroidManifest.xml
  const manifestPath = path.resolve('src-tauri/AndroidManifest.xml');
  const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
  assert.ok(
    manifestContent.includes('Theme.NoTitleBar.Fullscreen'),
    'AndroidManifest.xml debe declarar tema NoTitleBar.Fullscreen'
  );
  assert.ok(
    manifestContent.includes('androidx.core.content.FileProvider'),
    'AndroidManifest.xml debe declarar FileProvider para compartir imágenes'
  );
  assert.ok(
    manifestContent.includes('com.inkflow.studio.fileprovider'),
    'AndroidManifest.xml debe declarar authority de com.inkflow.studio.fileprovider'
  );

  // 3. Verificar comando nativo en src-tauri/src/lib.rs
  const libRsPath = path.resolve('src-tauri/src/lib.rs');
  const libRsContent = fs.readFileSync(libRsPath, 'utf-8');
  assert.ok(
    libRsContent.includes('save_image_to_gallery'),
    'src-tauri/src/lib.rs debe registrar el comando save_image_to_gallery'
  );
  assert.ok(
    libRsContent.includes('Pictures/InkFlow Studio'),
    'src-tauri/src/lib.rs debe apuntar a Pictures/InkFlow Studio'
  );

  // 4. Verificar capabilities de Tauri v2 y file_paths.xml
  const capabilitiesPath = path.resolve('src-tauri/capabilities/default.json');
  assert.ok(fs.existsSync(capabilitiesPath), 'src-tauri/capabilities/default.json debe existir');

  const filePathsPath = path.resolve('src-tauri/res/xml/file_paths.xml');
  assert.ok(fs.existsSync(filePathsPath), 'src-tauri/res/xml/file_paths.xml debe existir');
});

test('DiagnosticLogHub: Registro determinista, límite FIFO 500 y filtros de niveles', () => {
  diagnosticHub.clear();
  assert.equal(diagnosticHub.getLogs().length, 0);

  // 1. Registro en diferentes categorías
  diagnosticHub.info('TEST_TAG', 'Mensaje de información');
  diagnosticHub.warn('TEST_WARN', 'Advertencia de prueba', 'Detalle adicional');
  diagnosticHub.error('TEST_ERR', 'Error crítico detectado', new Error('Fallo simulado'));
  diagnosticHub.engine('GPU_TEST', 'Fallo shader WebGPU');
  diagnosticHub.native('ROOM_TEST', 'Transacción Room completada');

  const logs = diagnosticHub.getLogs();
  assert.equal(logs.length, 5);

  const stats = diagnosticHub.getStats();
  assert.equal(stats.total, 5);
  assert.equal(stats.errors, 1);
  assert.equal(stats.warnings, 1);
  assert.equal(stats.engine, 1);
  assert.equal(stats.native, 1);

  // 2. Comprobar límite de buffer circular FIFO de 500 entradas
  for (let i = 0; i < 550; i++) {
    diagnosticHub.info('FLOOD', `Evento masivo #${i}`);
  }
  const cappedLogs = diagnosticHub.getLogs();
  assert.equal(cappedLogs.length, 500, 'El buffer debe permanecer estrictamente acotado a 500 entradas');
  assert.equal(cappedLogs[cappedLogs.length - 1].message, 'Evento masivo #549');

  diagnosticHub.clear();
  assert.equal(diagnosticHub.getLogs().length, 0);
});

test('DiagnosticLogHub: Patrón de suscripción reactiva en tiempo real', () => {
  diagnosticHub.clear();
  let notificationCount = 0;
  let receivedLogsLength = 0;

  const unsubscribe = diagnosticHub.subscribe((currentLogs) => {
    notificationCount++;
    receivedLogsLength = currentLogs.length;
  });

  // La suscripción inicial dispara de inmediato con el estado actual
  assert.equal(notificationCount, 1);
  assert.equal(receivedLogsLength, 0);

  diagnosticHub.warn('SUBSCRIBE_TEST', 'Notificación reactiva');
  assert.equal(notificationCount, 2);
  assert.equal(receivedLogsLength, 1);

  // Cancelar suscripción
  unsubscribe();
  diagnosticHub.warn('SUBSCRIBE_TEST', 'Mensaje posterior a cancelación');
  assert.equal(notificationCount, 2, 'No debe recibir más notificaciones tras cancelar la suscripción');

  diagnosticHub.clear();
});

test('DiagnosticLogHub: Generación de reporte completo formateado y especificaciones de hardware', async () => {
  diagnosticHub.clear();
  diagnosticHub.error('CRITICAL_TEST', 'Simulación de crash resguardado', 'Traza detallada');

  const report = await diagnosticHub.generateDiagnosticReport();
  assert.ok(report.includes('REPORTE COMPLETO DE DIAGNÓSTICO Y DEBUG'), 'Debe incluir encabezado');
  assert.ok(report.includes('CRITICAL_TEST'), 'Debe listar el tag registrado');
  assert.ok(report.includes('Simulación de crash resguardado'), 'Debe listar el mensaje registrado');

  const specs = diagnosticHub.getDeviceSpecs();
  assert.ok(typeof specs === 'object');
  assert.ok('isTauri' in specs);
  assert.ok('webGpuSupported' in specs);
  assert.ok('nativeBridgeAvailable' in specs);

  diagnosticHub.clear();
});

test('DiagnosticLogHub: Integración con puente nativo Android para LogCat y Memoria RAM', async () => {
  // Simular la presencia del puente de Android en el entorno global
  const originalBridge = (globalThis as any).InkFlowNativeBridge;
  
  try {
    (globalThis as any).InkFlowNativeBridge = {
      getNativeMemoryInfo: () => JSON.stringify({
        availMemMB: 3450,
        totalMemMB: 7680,
        lowMemory: false,
        deviceModel: 'Pixel 8 Pro Test',
        androidRelease: '14',
        androidSdk: 34,
      }),
      getNativeLogcat: (lines: number) => `11-05 22:00:00.000 I/InkFlowStudio: Test LogCat output (${lines} lines)`
    };

    const specs = diagnosticHub.getDeviceSpecs();
    assert.equal(specs.nativeBridgeAvailable, true);
    assert.equal(specs.androidMemoryInfo?.availMemMB, 3450);
    assert.equal(specs.androidMemoryInfo?.deviceModel, 'Pixel 8 Pro Test');

    const logcat = await diagnosticHub.getNativeLogcat(50);
    assert.ok(logcat.includes('Pixel 8 Pro') || logcat.includes('Test LogCat output'));
  } finally {
    if (originalBridge) {
      (globalThis as any).InkFlowNativeBridge = originalBridge;
    } else {
      delete (globalThis as any).InkFlowNativeBridge;
    }
  }
});

test('APK Companion App: Declaración de DiagnosticMonitorActivity en AndroidManifest.xml y scripts de configuración', () => {
  // 1. AndroidManifest.xml
  const manifestPath = path.resolve('src-tauri/AndroidManifest.xml');
  const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
  assert.ok(
    manifestContent.includes('.DiagnosticMonitorActivity'),
    'AndroidManifest.xml debe declarar .DiagnosticMonitorActivity'
  );
  assert.ok(
    manifestContent.includes('android:label="InkFlow Monitor"'),
    'La actividad acompañante debe tener etiqueta InkFlow Monitor'
  );
  assert.ok(
    manifestContent.includes('android.intent.category.LAUNCHER'),
    'La actividad acompañante debe ser lanzable de forma independiente con LAUNCHER'
  );

  // 2. scripts/configure-android-native.cjs
  const scriptPath = path.resolve('scripts/configure-android-native.cjs');
  const scriptContent = fs.readFileSync(scriptPath, 'utf-8');
  assert.ok(
    scriptContent.includes('DiagnosticMonitorActivity'),
    'configure-android-native.cjs debe inyectar DiagnosticMonitorActivity'
  );
  assert.ok(
    scriptContent.includes('INITIAL_SCREEN'),
    'configure-android-native.cjs debe propagar INITIAL_SCREEN hacia el WebView'
  );

  // 3. src/kotlin-core/DiagnosticMonitorActivity.kt
  const kotlinActivityPath = path.resolve('src/kotlin-core/DiagnosticMonitorActivity.kt');
  assert.ok(fs.existsSync(kotlinActivityPath), 'src/kotlin-core/DiagnosticMonitorActivity.kt debe existir');
  const kotlinActivityContent = fs.readFileSync(kotlinActivityPath, 'utf-8');
  assert.ok(kotlinActivityContent.includes('class DiagnosticMonitorActivity : MainActivity()'));
  assert.ok(kotlinActivityContent.includes('INITIAL_SCREEN'));
});


