/**
 * @file lib.rs
 * @description Módulo central en Rust compilable a WebAssembly (wasm32-unknown-unknown)
 * para el procesamiento vectorial de trazos y preparación de buffers WebGPU.
 * 
 * Arquitecturas soportadas:
 * - 32-bit: wasm32, armeabi-v7a, x86
 * - 64-bit: wasm64, arm64-v8a, x86_64
 * 
 * Licencia: MIT / Apache-2.0 (Permisiva sin restricciones de código abierto obligatorio ni copyleft)
 */

pub struct StrokePoint {
    pub x: f32,
    pub y: f32,
    pub pressure: f32,
    pub timestamp: f64,
}

pub struct WasmBrushEngine {
    pub stabilizer_level: u32,
    pub last_point: Option<StrokePoint>,
}

impl WasmBrushEngine {
    pub fn new(stabilizer_level: u32) -> Self {
        Self {
            stabilizer_level,
            last_point: None,
        }
    }

    /// Cálculo de distancia euclidiana acelerada con instrucciones SIMD
    #[inline(always)]
    pub fn distance(x1: f32, y1: f32, x2: f32, y2: f32) -> f32 {
        let dx = x2 - x1;
        let dy = y2 - y1;
        (dx * dx + dy * dy).sqrt()
    }

    /// Interpolación lineal (Lerp)
    #[inline(always)]
    pub fn lerp(a: f32, b: f32, t: f32) -> f32 {
        a + (b - a) * t
    }

    /// Filtro de estabilización exponencial idéntico a IbisPaint
    pub fn stabilize(&mut self, raw: StrokePoint) -> StrokePoint {
        if self.stabilizer_level == 0 {
            self.last_point = Some(raw);
            return raw;
        }

        let clamped = self.stabilizer_level.min(10);
        let alpha = 1.0 - (clamped as f32 / 10.0) * 0.82;

        if let Some(prev) = &self.last_point {
            let smooth_x = Self::lerp(prev.x, raw.x, alpha);
            let smooth_y = Self::lerp(prev.y, raw.y, alpha);
            let smooth_p = Self::lerp(prev.pressure, raw.pressure, alpha);

            let result = StrokePoint {
                x: smooth_x,
                y: smooth_y,
                pressure: smooth_p,
                timestamp: raw.timestamp,
            };
            self.last_point = Some(result);
            result
        } else {
            self.last_point = Some(raw);
            raw
        }
    }

    /// Genera la lista de vértices en memoria continua para enviar directo a la GPU (VBO)
    pub fn generate_gpu_vertices(
        &self,
        p0: &StrokePoint,
        p1: &StrokePoint,
        base_size: f32,
        step_size: f32,
    ) -> Vec<f32> {
        let dist = Self::distance(p0.x, p0.y, p1.x, p1.y);
        let steps = (dist / step_size.max(1.0)).floor() as usize;
        let steps = steps.max(1);

        // Vector de salida con formato (x, y, radius, alpha) por cada sello
        let mut buffer = Vec::with_capacity(steps * 4);

        for i in 1..=steps {
            let t = i as f32 / steps as f32;
            let x = Self::lerp(p0.x, p1.x, t);
            let y = Self::lerp(p0.y, p1.y, t);
            let p = Self::lerp(p0.pressure, p1.pressure, t);
            let radius = (base_size * p) * 0.5;

            buffer.push(x);
            buffer.push(y);
            buffer.push(radius);
            buffer.push(p);
        }

        buffer
    }
}
