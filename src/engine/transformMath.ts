/**
 * @file transformMath.ts
 * @description Funciones matemáticas puras para transformación geométrica del lienzo
 * (Pinch-to-Zoom anclado al punto focal, paneo táctil 1:1 y zoom con rueda de ratón).
 * Desacoplado de React para ejecución determinista y pruebas unitarias con node:test.
 */

export interface Point2D {
  x: number;
  y: number;
}

export interface TransformState {
  scale: number;
  pan: Point2D;
}

/**
 * Calcula la nueva escala y desplazamiento (pan) manteniendo fijo el punto de contacto
 * (focal point) bajo los dedos del usuario durante gestos multitáctiles.
 * 
 * Ecuación invariante del punto focal:
 * (currentCenter - nextPan) / nextScale = (initialCenter - initialPan) / initialScale
 * => nextPan = currentCenter - (initialCenter - initialPan) * (nextScale / initialScale)
 *
 * @param initialCenter Centro inicial entre los 2 dedos relativo al centro del contenedor
 * @param currentCenter Centro actual entre los 2 dedos relativo al centro del contenedor
 * @param initialDist Distancia euclidiana inicial entre los 2 dedos
 * @param currentDist Distancia euclidiana actual entre los 2 dedos
 * @param initialScale Escala al inicio del gesto
 * @param initialPan Desplazamiento al inicio del gesto
 * @param minScale Escala mínima permitida (por defecto 0.15)
 * @param maxScale Escala máxima permitida (por defecto 8.0)
 */
export function calculateFocalZoomPan(
  initialCenter: Point2D,
  currentCenter: Point2D,
  initialDist: number,
  currentDist: number,
  initialScale: number,
  initialPan: Point2D,
  minScale = 0.15,
  maxScale = 8.0
): TransformState {
  const safeInitialDist = Math.max(1, initialDist);
  const safeCurrentDist = Math.max(1, currentDist);
  const distRatio = safeCurrentDist / safeInitialDist;
  
  const rawScale = initialScale * distRatio;
  const nextScale = Math.max(minScale, Math.min(maxScale, Number(rawScale.toFixed(3))));
  const scaleRatio = nextScale / Math.max(0.0001, initialScale);

  const nextPanX = currentCenter.x - (initialCenter.x - initialPan.x) * scaleRatio;
  const nextPanY = currentCenter.y - (initialCenter.y - initialPan.y) * scaleRatio;

  return {
    scale: nextScale,
    pan: {
      x: Number(nextPanX.toFixed(1)),
      y: Number(nextPanY.toFixed(1)),
    },
  };
}

/**
 * Calcula zoom anclado al cursor del ratón (rueda de desplazamiento)
 * 
 * @param focalPoint Posición del cursor relativa al centro del contenedor
 * @param currentScale Escala actual
 * @param currentPan Desplazamiento actual
 * @param factor Factor multiplicador de zoom (ej: 1.15 o 0.85)
 * @param minScale Escala mínima
 * @param maxScale Escala máxima
 */
export function calculateWheelZoom(
  focalPoint: Point2D,
  currentScale: number,
  currentPan: Point2D,
  factor: number,
  minScale = 0.15,
  maxScale = 8.0
): TransformState {
  const nextScale = Math.max(minScale, Math.min(maxScale, Number((currentScale * factor).toFixed(3))));
  const scaleRatio = nextScale / Math.max(0.0001, currentScale);

  const nextPanX = focalPoint.x - (focalPoint.x - currentPan.x) * scaleRatio;
  const nextPanY = focalPoint.y - (focalPoint.y - currentPan.y) * scaleRatio;

  return {
    scale: nextScale,
    pan: {
      x: Number(nextPanX.toFixed(1)),
      y: Number(nextPanY.toFixed(1)),
    },
  };
}

/**
 * Calcula el ángulo de rotación continuo (en grados) entre dos dedos durante un gesto táctil.
 * Normaliza la diferencia angular para evitar quiebres o saltos bruscos de 360° al cruzar el eje horizontal.
 */
export function calculateTouchRotation(
  t0Initial: Point2D,
  t1Initial: Point2D,
  t0Current: Point2D,
  t1Current: Point2D,
  initialRotationDeg: number
): number {
  const initialAngle = Math.atan2(t1Initial.y - t0Initial.y, t1Initial.x - t0Initial.x);
  const currentAngle = Math.atan2(t1Current.y - t0Current.y, t1Current.x - t0Current.x);
  let deltaRad = currentAngle - initialAngle;
  while (deltaRad > Math.PI) deltaRad -= 2 * Math.PI;
  while (deltaRad < -Math.PI) deltaRad += 2 * Math.PI;
  const deltaAngleDeg = deltaRad * (180 / Math.PI);
  let totalAngle = (initialRotationDeg + deltaAngleDeg) % 360;
  if (totalAngle < 0) totalAngle += 360;
  return Number(totalAngle.toFixed(1));
}

/**
 * Ajusta magnéticamente el ángulo de rotación si está cerca de múltiplos cardinales (0°, 90°, 180°, 270°, 360°).
 */
export function snapRotationDegrees(angleDeg: number, threshold = 4.5): number {
  const norm = ((angleDeg % 360) + 360) % 360;
  const targets = [0, 90, 180, 270, 360];
  for (const target of targets) {
    if (Math.abs(norm - target) <= threshold) {
      return target === 360 ? 0 : target;
    }
  }
  return Number(norm.toFixed(1));
}

/**
 * Deshace la rotación de un punto de pantalla respecto a un centro de giro dado.
 */
export function unrotatePoint(
  screenX: number,
  screenY: number,
  centerX: number,
  centerY: number,
  rotationDeg: number
): Point2D {
  if (rotationDeg === 0) {
    return { x: screenX, y: screenY };
  }
  const rad = -(rotationDeg * Math.PI) / 180;
  const dx = screenX - centerX;
  const dy = screenY - centerY;
  const unrotatedX = dx * Math.cos(rad) - dy * Math.sin(rad);
  const unrotatedY = dx * Math.sin(rad) + dy * Math.cos(rad);
  return {
    x: centerX + unrotatedX,
    y: centerY + unrotatedY,
  };
}

/**
 * Mapeo canónico exacto de coordenadas de pantalla (clientX, clientY) a coordenadas reales
 * del lienzo (píxeles internos del canvas), teniendo en cuenta el centro visual, el zoom y la rotación.
 *
 * Resuelve definitivamente el error de desplazamiento y dirección invertida que ocurre al usar
 * getBoundingClientRect() en rectángulos rotados (donde la caja AABB distorsiona la relación de aspecto).
 *
 * @param screenX Coordenada X del evento de puntero (clientX)
 * @param screenY Coordenada Y del evento de puntero (clientY)
 * @param centerX Coordenada X del centro del lienzo en la pantalla
 * @param centerY Coordenada Y del centro del lienzo en la pantalla
 * @param scale Factor de zoom actual del lienzo (ej: 1.0, 2.5)
 * @param rotationDeg Ángulo de rotación del lienzo en grados (0° a 360°, sentido horario)
 * @param canvasWidth Ancho intrínseco del proyecto/lienzo en píxeles (ej: 800)
 * @param canvasHeight Alto intrínseco del proyecto/lienzo en píxeles (ej: 1200)
 */
export function screenToCanvasCoords(
  screenX: number,
  screenY: number,
  centerX: number,
  centerY: number,
  scale: number,
  rotationDeg: number,
  canvasWidth: number,
  canvasHeight: number
): Point2D {
  // 1. Vector relativo al centro de giro y zoom en la pantalla
  const dx = screenX - centerX;
  const dy = screenY - centerY;

  // 2. Desrotación analítica 2D (inversa del ángulo de rotación -θ)
  let unrotDx = dx;
  let unrotDy = dy;
  if (rotationDeg !== 0) {
    const rad = -(rotationDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    unrotDx = dx * cos - dy * sin;
    unrotDy = dx * sin + dy * cos;
  }

  // 3. Compensación del factor de escala (zoom)
  const safeScale = Math.max(0.0001, scale);
  const canvasDx = unrotDx / safeScale;
  const canvasDy = unrotDy / safeScale;

  // 4. Mapeo final al origen del lienzo (esquina superior izquierda 0, 0)
  return {
    x: canvasWidth / 2 + canvasDx,
    y: canvasHeight / 2 + canvasDy,
  };
}

/**
 * Operación inversa: Mapea una coordenada del lienzo (canvasX, canvasY) a la posición visual
 * en pantalla (clientX, clientY) considerando centro, escala y rotación.
 */
export function canvasToScreenCoords(
  canvasX: number,
  canvasY: number,
  centerX: number,
  centerY: number,
  scale: number,
  rotationDeg: number,
  canvasWidth: number,
  canvasHeight: number
): Point2D {
  const canvasDx = (canvasX - canvasWidth / 2) * scale;
  const canvasDy = (canvasY - canvasHeight / 2) * scale;

  let rotDx = canvasDx;
  let rotDy = canvasDy;
  if (rotationDeg !== 0) {
    const rad = (rotationDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    rotDx = canvasDx * cos - canvasDy * sin;
    rotDy = canvasDx * sin + canvasDy * cos;
  }

  return {
    x: centerX + rotDx,
    y: centerY + rotDy,
  };
}

export interface BoundingBoxResult {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  hasContent: boolean;
}

/**
 * Calcula la caja delimitadora (Bounding Box) exacta del dibujo útil en las capas dadas.
 * Permite recortar automáticamente la obra maestra excluyendo el lienzo vacío no utilizado.
 */
export function calculateArtworkBoundingBox(
  layersData: Uint8ClampedArray[],
  canvasWidth: number,
  canvasHeight: number,
  padding = 24
): BoundingBoxResult {
  let minX = canvasWidth;
  let minY = canvasHeight;
  let maxX = -1;
  let maxY = -1;

  for (const data of layersData) {
    // Escaneo acelerado mediante palabras de 32 bits (4 bytes por ciclo)
    const u32 = new Uint32Array(data.buffer, data.byteOffset, canvasWidth * canvasHeight);
    
    for (let y = 0; y < canvasHeight; y++) {
      const rowOffset = y * canvasWidth;
      for (let x = 0; x < canvasWidth; x++) {
        const pixel = u32[rowOffset + x];
        // En little-endian RGBA, el canal alfa ocupa el byte más significativo (bits 24-31)
        if (pixel !== 0) {
          const alpha = (pixel >>> 24) & 0xff;
          if (alpha > 8) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
    }
  }

  // Si no se encontró ningún trazo en las capas (lienzo limpio)
  if (maxX === -1 || maxY === -1) {
    return {
      minX: 0,
      minY: 0,
      maxX: canvasWidth,
      maxY: canvasHeight,
      width: canvasWidth,
      height: canvasHeight,
      hasContent: false,
    };
  }

  // Añadir margen estético (padding) sin exceder las dimensiones de la hoja
  const paddedMinX = Math.max(0, minX - padding);
  const paddedMinY = Math.max(0, minY - padding);
  const paddedMaxX = Math.min(canvasWidth, maxX + padding);
  const paddedMaxY = Math.min(canvasHeight, maxY + padding);

  return {
    minX: paddedMinX,
    minY: paddedMinY,
    maxX: paddedMaxX,
    maxY: paddedMaxY,
    width: Math.max(32, paddedMaxX - paddedMinX),
    height: Math.max(32, paddedMaxY - paddedMinY),
    hasContent: true,
  };
}

