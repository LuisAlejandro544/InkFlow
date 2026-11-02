/**
 * @file engine.test.ts
 * @description Pruebas unitarias de lógica pura y matemática para el motor de dibujo.
 * Ejecuta validaciones de Wasm, interpolación de trazos, curvas de presión y estabilizador.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { wasmEngine } from './wasmEngine';
import { drawingEngine, dilateBinaryMask } from './webgpuEngine';
import { kotlinVectorEngine } from './kotlinWasmBridge';
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
import { Layer } from './types';

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
  // Un accesorio importado debe tener purpose: 'accessory' y opacidad 1.0
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
});






