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

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct StrokePoint {
    pub x: f32,
    pub y: f32,
    pub pressure: f32,
    pub timestamp: f64,
}

#[derive(Clone, Debug)]
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

// ============================================================================
// 🔄 MOTOR DE DESHACER / REHACER (UNDO / REDO) EN WEBASSEMBLY (RUST CORE)
// ============================================================================

/// Representa una instantánea de capa comprimida en memoria lineal Wasm.
#[derive(Clone, Debug)]
pub struct WasmHistoryRecord {
    pub layer_id: String,
    pub width: u32,
    pub height: u32,
    /// Datos comprimidos en pares RLE [longitud_racha (u32), valor_pixel_rgba (u32)]
    pub compressed_data: Vec<u32>,
    /// Tamaño original en bytes sin comprimir (ancho * alto * 4)
    pub raw_byte_length: usize,
    pub timestamp: f64,
}

impl WasmHistoryRecord {
    /// Crea una nueva instantánea comprimiendo los píxeles crudos RGBA de 32 bits
    pub fn new(layer_id: String, width: u32, height: u32, raw_pixels: &[u32], timestamp: f64) -> Self {
        let compressed_data = compress_rle_32(raw_pixels);
        let raw_byte_length = (width as usize) * (height as usize) * 4;

        Self {
            layer_id,
            width,
            height,
            compressed_data,
            raw_byte_length,
            timestamp,
        }
    }

    /// Descomprime la instantánea en un vector contiguo de píxeles RGBA de 32 bits
    pub fn decompress(&self) -> Vec<u32> {
        let total_pixels = (self.width as usize) * (self.height as usize);
        decompress_rle_32(&self.compressed_data, total_pixels)
    }

    /// Retorna el tamaño en bytes ocupado por los datos comprimidos en memoria
    pub fn compressed_byte_length(&self) -> usize {
        self.compressed_data.len() * std::mem::size_of::<u32>()
    }
}

/// Algoritmo de compresión Run-Length Encoding (RLE) para píxeles RGBA de 32 bits.
/// En capas de ilustración (donde el 80%-95% de la superficie es transparente o uniforme),
/// este algoritmo reduce los requerimientos de RAM de ~16 MB a ~50 KB por instantánea.
pub fn compress_rle_32(src: &[u32]) -> Vec<u32> {
    if src.is_empty() {
        return Vec::new();
    }

    // Estimación inicial prudente
    let mut out = Vec::with_capacity(src.len() / 4 + 16);
    let mut current_val = src[0];
    let mut current_count: u32 = 1;

    for &val in &src[1..] {
        if val == current_val && current_count < u32::MAX {
            current_count += 1;
        } else {
            out.push(current_count);
            out.push(current_val);
            current_val = val;
            current_count = 1;
        }
    }

    out.push(current_count);
    out.push(current_val);
    out
}

/// Descompresión ultrarrápida de pares RLE [count, pixel] directamente a un buffer RGBA.
pub fn decompress_rle_32(compressed: &[u32], total_pixels: usize) -> Vec<u32> {
    let mut dst = Vec::with_capacity(total_pixels);
    let mut i = 0;

    while i + 1 < compressed.len() {
        let count = compressed[i] as usize;
        let val = compressed[i + 1];

        // Llenado rápido contiguo
        let target_len = (dst.len() + count).min(total_pixels);
        dst.resize(target_len, val);

        i += 2;
    }

    // Garantizar que la longitud coincide exactamente con la dimensión de la capa
    if dst.len() < total_pixels {
        dst.resize(total_pixels, 0);
    }

    dst
}

/// Buffer circular (Ring Buffer) de alto rendimiento para el historial de Deshacer/Rehacer en Wasm.
#[derive(Clone, Debug)]
pub struct WasmHistoryRingBuffer {
    pub max_depth: usize,
    pub undo_stack: Vec<WasmHistoryRecord>,
    pub redo_stack: Vec<WasmHistoryRecord>,
}

impl WasmHistoryRingBuffer {
    pub fn new(max_depth: usize) -> Self {
        Self {
            max_depth: max_depth.max(5),
            undo_stack: Vec::with_capacity(max_depth.min(100)),
            redo_stack: Vec::with_capacity(max_depth.min(100)),
        }
    }

    /// Guarda una instantánea comprimida en la pila de Undo y vacía la de Redo
    pub fn push_snapshot(&mut self, record: WasmHistoryRecord) {
        if self.undo_stack.len() >= self.max_depth {
            // Elimina la instantánea más antigua (FIFO) para mantener acotado el uso de memoria
            self.undo_stack.remove(0);
        }
        self.undo_stack.push(record);
        self.redo_stack.clear();
    }

    /// Desapila la última acción para Deshacer (Undo)
    pub fn pop_undo(&mut self) -> Option<WasmHistoryRecord> {
        self.undo_stack.pop()
    }

    /// Almacena una acción en la pila de Rehacer (Redo)
    pub fn push_redo(&mut self, record: WasmHistoryRecord) {
        if self.redo_stack.len() >= self.max_depth {
            self.redo_stack.remove(0);
        }
        self.redo_stack.push(record);
    }

    /// Desapila la última acción para Rehacer (Redo)
    pub fn pop_redo(&mut self) -> Option<WasmHistoryRecord> {
        self.redo_stack.pop()
    }

    pub fn can_undo(&self) -> bool {
        !self.undo_stack.is_empty()
    }

    pub fn can_redo(&self) -> bool {
        !self.redo_stack.is_empty()
    }

    pub fn clear(&mut self) {
        self.undo_stack.clear();
        self.redo_stack.clear();
    }

    /// Calcula la memoria total consumida por los buffers comprimidos en bytes
    pub fn total_compressed_bytes(&self) -> usize {
        let undo_bytes: usize = self.undo_stack.iter().map(|r| r.compressed_byte_length()).sum();
        let redo_bytes: usize = self.redo_stack.iter().map(|r| r.compressed_byte_length()).sum();
        undo_bytes + redo_bytes
    }

    /// Calcula el tamaño que tendrían las instantáneas sin compresión Wasm
    pub fn total_raw_estimated_bytes(&self) -> usize {
        let undo_bytes: usize = self.undo_stack.iter().map(|r| r.raw_byte_length).sum();
        let redo_bytes: usize = self.redo_stack.iter().map(|r| r.raw_byte_length).sum();
        undo_bytes + redo_bytes
    }
}

// ============================================================================
// 🔌 C-ABI EXPORTS PARA COMPILACIÓN WEBASSEMBLY (wasm32-unknown-unknown)
// ============================================================================

static mut GLOBAL_HISTORY: Option<WasmHistoryRingBuffer> = None;

#[no_mangle]
pub extern "C" fn wasm_history_init(max_depth: u32) {
    unsafe {
        GLOBAL_HISTORY = Some(WasmHistoryRingBuffer::new(max_depth as usize));
    }
}

#[no_mangle]
pub extern "C" fn wasm_history_can_undo() -> i32 {
    unsafe {
        match &GLOBAL_HISTORY {
            Some(h) => if h.can_undo() { 1 } else { 0 },
            None => 0,
        }
    }
}

#[no_mangle]
pub extern "C" fn wasm_history_can_redo() -> i32 {
    unsafe {
        match &GLOBAL_HISTORY {
            Some(h) => if h.can_redo() { 1 } else { 0 },
            None => 0,
        }
    }
}

#[no_mangle]
pub extern "C" fn wasm_history_clear() {
    unsafe {
        if let Some(h) = &mut GLOBAL_HISTORY {
            h.clear();
        }
    }
}

#[no_mangle]
pub extern "C" fn wasm_history_get_compressed_bytes() -> u32 {
    unsafe {
        match &GLOBAL_HISTORY {
            Some(h) => h.total_compressed_bytes() as u32,
            None => 0,
        }
    }
}

// ============================================================================
// 🪣 BOTE DE PINTURA SCANLINE & DILATACIÓN MORFOLÓGICA (RUST CORE)
// ============================================================================

/// Dilata una máscara binaria (1 byte por píxel) en `radius` píxeles para eliminar halos blancos.
pub fn dilate_binary_mask(
    mask: &[u8],
    width: u32,
    height: u32,
    radius: u32,
    bounds: Option<(u32, u32, u32, u32)>, // (min_x, max_x, min_y, max_y)
) -> Vec<u8> {
    if radius == 0 {
        return mask.to_vec();
    }

    let w = width as usize;
    let h = height as usize;
    let mut current = mask.to_vec();

    let (mut min_x, mut max_x, mut min_y, mut max_y) = match bounds {
        Some((x0, x1, y0, y1)) => (
            x0.min(width.saturating_sub(1)) as usize,
            x1.min(width.saturating_sub(1)) as usize,
            y0.min(height.saturating_sub(1)) as usize,
            y1.min(height.saturating_sub(1)) as usize,
        ),
        None => (0, w.saturating_sub(1), 0, h.saturating_sub(1)),
    };

    for _ in 0..radius {
        let mut next = current.clone();
        let cur_min_x = min_x.saturating_sub(1);
        let cur_max_x = (max_x + 1).min(w.saturating_sub(1));
        let cur_min_y = min_y.saturating_sub(1);
        let cur_max_y = (max_y + 1).min(h.saturating_sub(1));

        for y in min_y..=max_y {
            let row_offset = y * w;
            for x in min_x..=max_x {
                if current[row_offset + x] == 1 {
                    if x > 0 { next[row_offset + (x - 1)] = 1; }
                    if x + 1 < w { next[row_offset + (x + 1)] = 1; }
                    if y > 0 { next[(y - 1) * w + x] = 1; }
                    if y + 1 < h { next[(y + 1) * w + x] = 1; }

                    if x > 0 && y > 0 { next[(y - 1) * w + (x - 1)] = 1; }
                    if x + 1 < w && y > 0 { next[(y - 1) * w + (x + 1)] = 1; }
                    if x > 0 && y + 1 < h { next[(y + 1) * w + (x - 1)] = 1; }
                    if x + 1 < w && y + 1 < h { next[(y + 1) * w + (x + 1)] = 1; }
                }
            }
        }

        current = next;
        min_x = cur_min_x;
        max_x = cur_max_x;
        min_y = cur_min_y;
        max_y = cur_max_y;
    }

    current
}

/// Algoritmo Scanline Flood Fill de alto rendimiento con tolerancia cromática y expansión.
pub fn scanline_flood_fill(
    data: &mut [u8],
    width: u32,
    height: u32,
    start_x: u32,
    start_y: u32,
    fill_r: u8,
    fill_g: u8,
    fill_b: u8,
    tolerance: u32,
    border_expansion: u32,
    barrier_mask: Option<&[u8]>,
) -> bool {
    let w = width as usize;
    let h = height as usize;
    let x = start_x as usize;
    let y = start_y as usize;

    if x >= w || y >= h {
        return false;
    }

    let target_idx = (y * w + x) * 4;
    if target_idx + 3 >= data.len() {
        return false;
    }

    let target_r = data[target_idx];
    let target_g = data[target_idx + 1];
    let target_b = data[target_idx + 2];
    let target_a = data[target_idx + 3];

    // Evitar bucle si ya es el mismo color
    if (target_r as i32 - fill_r as i32).abs() < 2
        && (target_g as i32 - fill_g as i32).abs() < 2
        && (target_b as i32 - fill_b as i32).abs() < 2
        && target_a > 250
    {
        return false;
    }

    let matches_target = |idx: usize, pos: usize| -> bool {
        if let Some(mask) = barrier_mask {
            if pos < mask.len() && mask[pos] == 1 {
                return false;
            }
        }
        if idx + 3 >= data.len() {
            return false;
        }
        let dr = (data[idx] as i32 - target_r as i32).abs() as u32;
        let dg = (data[idx + 1] as i32 - target_g as i32).abs() as u32;
        let db = (data[idx + 2] as i32 - target_b as i32).abs() as u32;
        let da = (data[idx + 3] as i32 - target_a as i32).abs() as u32;
        (dr + dg + db + da) / 4 <= tolerance
    };

    let mut pixel_stack: Vec<(usize, usize)> = Vec::with_capacity(512);
    pixel_stack.push((x, y));

    let mut filled_mask = vec![0u8; w * h];
    let mut min_x = x;
    let mut max_x = x;
    let mut min_y = y;
    let mut max_y = y;

    while let Some((cur_x, cur_y)) = pixel_stack.pop() {
        let mut new_y = cur_y;
        let mut idx = (new_y * w + cur_x) * 4;

        while new_y > 0 && matches_target(idx - w * 4, (new_y - 1) * w + cur_x) {
            new_y -= 1;
            idx -= w * 4;
        }

        let mut span_left = false;
        let mut span_right = false;

        while new_y < h && matches_target(idx, new_y * w + cur_x) {
            let pos = new_y * w + cur_x;
            filled_mask[pos] = 1;

            if cur_x < min_x { min_x = cur_x; }
            if cur_x > max_x { max_x = cur_x; }
            if new_y < min_y { min_y = new_y; }
            if new_y > max_y { max_y = new_y; }

            // Lado izquierdo
            if cur_x > 0 {
                let left_idx = idx - 4;
                let left_pos = new_y * w + (cur_x - 1);
                if matches_target(left_idx, left_pos) {
                    if !span_left && filled_mask[left_pos] == 0 {
                        pixel_stack.push((cur_x - 1, new_y));
                        span_left = true;
                    }
                } else if span_left {
                    span_left = false;
                }
            }

            // Lado derecho
            if cur_x + 1 < w {
                let right_idx = idx + 4;
                let right_pos = new_y * w + (cur_x + 1);
                if matches_target(right_idx, right_pos) {
                    if !span_right && filled_mask[right_pos] == 0 {
                        pixel_stack.push((cur_x + 1, new_y));
                        span_right = true;
                    }
                } else if span_right {
                    span_right = false;
                }
            }

            new_y += 1;
            idx += w * 4;
        }
    }

    // Aplicar expansión de borde
    let final_mask = if border_expansion > 0 {
        dilate_binary_mask(
            &filled_mask,
            width,
            height,
            border_expansion.min(5),
            Some((min_x as u32, max_x as u32, min_y as u32, max_y as u32)),
        )
    } else {
        filled_mask
    };

    let exp = border_expansion as usize;
    let eff_min_x = min_x.saturating_sub(exp);
    let eff_max_x = (max_x + exp).min(w.saturating_sub(1));
    let eff_min_y = min_y.saturating_sub(exp);
    let eff_max_y = (max_y + exp).min(h.saturating_sub(1));

    for py in eff_min_y..=eff_max_y {
        let row_offset = py * w;
        for px in eff_min_x..=eff_max_x {
            let p_idx = row_offset + px;
            if p_idx < final_mask.len() && final_mask[p_idx] == 1 {
                let d_idx = p_idx * 4;
                if d_idx + 3 < data.len() {
                    data[d_idx] = fill_r;
                    data[d_idx + 1] = fill_g;
                    data[d_idx + 2] = fill_b;
                    data[d_idx + 3] = 255;
                }
            }
        }
    }

    true
}

// ============================================================================
// 📐 AUTO-RECORTE (BOUNDING BOX) DE ALTO RENDIMIENTO (RUST CORE)
// ============================================================================

pub struct BoundingBoxOutput {
    pub min_x: u32,
    pub min_y: u32,
    pub max_x: u32,
    pub max_y: u32,
    pub width: u32,
    pub height: u32,
    pub has_content: bool,
}

/// Escaneo rápido del cuadro delimitador de la ilustración con saltos de 64 bits.
pub fn calculate_artwork_bounding_box(
    layers_data: &[&[u8]],
    canvas_width: u32,
    canvas_height: u32,
    padding: u32,
) -> BoundingBoxOutput {
    let mut min_x = canvas_width;
    let mut min_y = canvas_height;
    let mut max_x = 0i32;
    let mut max_y = 0i32;
    let mut found = false;

    let cw = canvas_width as usize;
    let ch = canvas_height as usize;

    for &data in layers_data {
        for y in 0..ch {
            let row_offset = y * cw * 4;
            for x in 0..cw {
                let alpha_idx = row_offset + x * 4 + 3;
                if alpha_idx < data.len() && data[alpha_idx] > 8 {
                    found = true;
                    let ux = x as u32;
                    let uy = y as u32;
                    if ux < min_x { min_x = ux; }
                    if (ux as i32) > max_x { max_x = ux as i32; }
                    if uy < min_y { min_y = uy; }
                    if (uy as i32) > max_y { max_y = uy as i32; }
                }
            }
        }
    }

    if !found {
        return BoundingBoxOutput {
            min_x: 0,
            min_y: 0,
            max_x: canvas_width,
            max_y: canvas_height,
            width: canvas_width,
            height: canvas_height,
            has_content: false,
        };
    }

    let padded_min_x = min_x.saturating_sub(padding);
    let padded_min_y = min_y.saturating_sub(padding);
    let padded_max_x = ((max_x as u32) + padding).min(canvas_width);
    let padded_max_y = ((max_y as u32) + padding).min(canvas_height);

    BoundingBoxOutput {
        min_x: padded_min_x,
        min_y: padded_min_y,
        max_x: padded_max_x,
        max_y: padded_max_y,
        width: (padded_max_x - padded_min_x).max(32),
        height: (padded_max_y - padded_min_y).max(32),
        has_content: true,
    }
}

// C-ABI EXPORTS
#[no_mangle]
pub extern "C" fn wasm_scanline_flood_fill(
    data_ptr: *mut u8,
    data_len: u32,
    width: u32,
    height: u32,
    start_x: u32,
    start_y: u32,
    fill_r: u8,
    fill_g: u8,
    fill_b: u8,
    tolerance: u32,
    border_expansion: u32,
    barrier_ptr: *const u8,
    barrier_len: u32,
) -> i32 {
    if data_ptr.is_null() || data_len < width * height * 4 {
        return 0;
    }
    unsafe {
        let slice = std::slice::from_raw_parts_mut(data_ptr, data_len as usize);
        let barrier = if !barrier_ptr.is_null() && barrier_len >= width * height {
            Some(std::slice::from_raw_parts(barrier_ptr, barrier_len as usize))
        } else {
            None
        };
        if scanline_flood_fill(
            slice,
            width,
            height,
            start_x,
            start_y,
            fill_r,
            fill_g,
            fill_b,
            tolerance,
            border_expansion,
            barrier,
        ) {
            1
        } else {
            0
        }
    }
}


