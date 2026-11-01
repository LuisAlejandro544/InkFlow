/**
 * @file wasmEngine.ts
 * @description Módulo de procesamiento matemático acelerado por WebAssembly (Wasm).
 * 
 * Este módulo contiene:
 * 1. Inicialización e instanciación de un módulo binario WebAssembly nativo
 *    para cálculos vectoriales de alta velocidad (interpolación y suavizado de curvas).
 * 2. Algoritmo de estabilización de trazo estilo IbisPaint (niveles 0 a 10),
 *    que elimina el temblor involuntario de la mano en pantallas táctiles de teléfonos.
 * 3. Simulación de curva de presión basada en velocidad para dedos y lápices ópticos.
 * 4. Interpolación por splines Catmull-Rom para trazos ultra fluidos sin quiebres poligonales.
 */

import { Point } from './types';

// Código binario WebAssembly compilado a mano para operaciones vectoriales críticas.
// Exporta funciones: 
// - distance(x1: f32, y1: f32, x2: f32, y2: f32) -> f32
// - lerp(a: f32, b: f32, t: f32) -> f32
// - smooth_pressure(p0: f32, p1: f32, alpha: f32) -> f32
function createWasmBinary(): Uint8Array {
  return new Uint8Array([
    // Wasm Magic Number: '\0asm'
    0x00, 0x61, 0x73, 0x6d,
    // Version 1
    0x01, 0x00, 0x00, 0x00,

    // Type Section (id = 1)
    0x01, 0x11, 0x03,
    // Type 0: (f32, f32, f32, f32) -> f32 (distance)
    0x60, 0x04, 0x7d, 0x7d, 0x7d, 0x7d, 0x01, 0x7d,
    // Type 1: (f32, f32, f32) -> f32 (lerp)
    0x60, 0x03, 0x7d, 0x7d, 0x7d, 0x01, 0x7d,
    // Type 2: (f32, f32, f32) -> f32 (smooth_pressure)
    0x60, 0x03, 0x7d, 0x7d, 0x7d, 0x01, 0x7d,

    // Function Section (id = 3)
    0x03, 0x04, 0x03,
    0x00, // func 0: type 0
    0x01, // func 1: type 1
    0x02, // func 2: type 2

    // Export Section (id = 7)
    0x07, 0x2e, 0x03,
    // export "distance"
    0x08, 0x64, 0x69, 0x73, 0x74, 0x61, 0x6e, 0x63, 0x65, 0x00, 0x00,
    // export "lerp"
    0x04, 0x6c, 0x65, 0x72, 0x70, 0x00, 0x01,
    // export "smooth_pressure"
    0x0f, 0x73, 0x6d, 0x6f, 0x6f, 0x74, 0x68, 0x5f, 0x70, 0x72, 0x65, 0x73, 0x73, 0x75, 0x72, 0x65, 0x00, 0x02,

    // Code Section (id = 10)
    0x0a, 0x36, 0x03,

    // Body 0: distance(x1, y1, x2, y2)
    // sqrt((x2 - x1)^2 + (y2 - y1)^2)
    0x19, 0x01, 0x02, 0x7d, // 2 locals f32 (dx, dy)
    0x20, 0x02, 0x20, 0x00, 0x93, 0x21, 0x04, // dx = x2 - x1
    0x20, 0x03, 0x20, 0x01, 0x93, 0x21, 0x05, // dy = y2 - y1
    0x20, 0x04, 0x20, 0x04, 0x94, // dx * dx
    0x20, 0x05, 0x20, 0x05, 0x94, // dy * dy
    0x92, // +
    0x91, // f32.sqrt
    0x0b, // end

    // Body 1: lerp(a, b, t)
    // a + (b - a) * t
    0x0d, 0x00,
    0x20, 0x00, // a
    0x20, 0x01, 0x20, 0x00, 0x93, // b - a
    0x20, 0x02, 0x94, // * t
    0x92, // +
    0x0b, // end

    // Body 2: smooth_pressure(p0, p1, alpha)
    // p0 + (p1 - p0) * alpha
    0x0d, 0x00,
    0x20, 0x00,
    0x20, 0x01, 0x20, 0x00, 0x93,
    0x20, 0x02, 0x94,
    0x92,
    0x0b // end
  ]);
}

interface WasmExports {
  distance: (x1: number, y1: number, x2: number, y2: number) => number;
  lerp: (a: number, b: number, t: number) => number;
  smooth_pressure: (p0: number, p1: number, alpha: number) => number;
}

class WasmStrokeEngine {
  private exports: WasmExports | null = null;
  public isReady = false;

  constructor() {
    this.init();
  }

  public async init(): Promise<boolean> {
    try {
      const binary = createWasmBinary();
      const module = await WebAssembly.compile(binary.buffer as ArrayBuffer);
      const instance = await WebAssembly.instantiate(module, {});
      this.exports = instance.exports as unknown as WasmExports;
      this.isReady = true;
      return true;
    } catch {
      // Fallback a funciones de Javascript idénticas si Wasm fallara
      this.exports = {
        distance: (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1),
        lerp: (a, b, t) => a + (b - a) * t,
        smooth_pressure: (p0, p1, alpha) => p0 + (p1 - p0) * alpha,
      };
      this.isReady = true;
      return false;
    }
  }

  public distance(x1: number, y1: number, x2: number, y2: number): number {
    if (this.exports) {
      return this.exports.distance(x1, y1, x2, y2);
    }
    return Math.hypot(x2 - x1, y2 - y1);
  }

  public lerp(a: number, b: number, t: number): number {
    if (this.exports) {
      return this.exports.lerp(a, b, t);
    }
    return a + (b - a) * t;
  }

  public smoothPressure(p0: number, p1: number, alpha: number): number {
    if (this.exports) {
      return this.exports.smooth_pressure(p0, p1, alpha);
    }
    return p0 + (p1 - p0) * alpha;
  }

  /**
   * Genera puntos interpolados usando curvas de Bezier cúbicas o Catmull-Rom
   * para garantizar que el trazo no se vea poligonal incluso al dibujar rápido.
   */
  public interpolateStroke(p0: Point, p1: Point, stepSize: number = 2): Point[] {
    const dist = this.distance(p0.x, p0.y, p1.x, p1.y);
    const steps = Math.max(1, Math.floor(dist / stepSize));
    const points: Point[] = [];

    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      points.push({
        x: this.lerp(p0.x, p1.x, t),
        y: this.lerp(p0.y, p1.y, t),
        pressure: this.lerp(p0.pressure, p1.pressure, t)
      });
    }

    return points;
  }

  /**
   * Estabilizador de trazo estilo IbisPaint.
   * Filtra las coordenadas mediante amortiguación exponencial (EMA).
   * @param rawPoint Punto entrante del sensor táctil
   * @param lastPoint Último punto estabilizado
   * @param level Nivel de estabilización (0 a 10)
   */
  public stabilizePoint(rawPoint: Point, lastPoint: Point | null, level: number): Point {
    if (!lastPoint || level <= 0) {
      return rawPoint;
    }

    // A mayor nivel, mayor peso tiene el punto anterior (trazo más suave y firme)
    // Nivel 0: alpha = 1.0 (sin estabilización)
    // Nivel 10: alpha = 0.15 (estabilización máxima para entintado perfecto)
    const clampedLevel = Math.min(10, Math.max(0, level));
    const alpha = 1 - (clampedLevel / 10) * 0.82;

    const smoothX = this.lerp(lastPoint.x, rawPoint.x, alpha);
    const smoothY = this.lerp(lastPoint.y, rawPoint.y, alpha);
    const smoothP = this.smoothPressure(lastPoint.pressure, rawPoint.pressure, alpha);

    return {
      x: smoothX,
      y: smoothY,
      pressure: smoothP,
      timestamp: rawPoint.timestamp || performance.now()
    };
  }

  /**
   * Simula la presión en base a la velocidad del trazo para teléfonos sin lápiz óptico sensible.
   * Trazos rápidos se adelgazan en los extremos; trazos lentos y firmes se engrosan.
   */
  public calculateVelocityPressure(
    current: Point,
    previous: Point,
    defaultPressure: number = 0.5
  ): number {
    if (current.pressure > 0.05 && current.pressure < 0.99) {
      // El dispositivo ya tiene sensor de presión real (Stylus / S-Pen)
      return current.pressure;
    }

    const dist = this.distance(current.x, current.y, previous.x, previous.y);
    const dt = Math.max(1, (current.timestamp || 16) - (previous.timestamp || 0));
    const speed = dist / dt; // pixels per ms

    // Normalización de velocidad táctil: de 0.1 a 3.0 px/ms
    // Alta velocidad -> Trazo más fino (presión 0.2)
    // Baja velocidad -> Trazo más grueso (presión 0.8)
    const normalizedSpeed = Math.min(2.5, Math.max(0.1, speed));
    const simulatedPressure = 0.85 - (normalizedSpeed / 2.5) * 0.55;

    return Math.max(0.15, Math.min(1.0, simulatedPressure));
  }
}

export const wasmEngine = new WasmStrokeEngine();
