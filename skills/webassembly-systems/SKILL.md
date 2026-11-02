---
name: webassembly-systems
description: Ingeniería de sistemas y desarrollo de alto rendimiento con WebAssembly (Wasm). Abarca gestión de memoria lineal sin copias (Zero-Copy TypedArrays), vectorización SIMD128, multihilo con Web Workers y SharedArrayBuffer, SQLite Wasm sobre OPFS y optimización extrema de binarios con wasm-opt (Binaryen).
triggers: ["WASM", "WebAssembly", "SIMD", "OPFS", "SharedArrayBuffer", "wasm-opt", "linear memory", "Kotlin/Wasm", "Rust Wasm", "Binaryen"]
---

# ⚙️ Skill: WebAssembly Systems & High-Performance Engineering

Esta skill convierte a la IA en un **Ingeniero de Sistemas de Bajo Nivel y Compiladores WebAssembly**. Su objetivo es diseñar, compilar, optimizar y comunicar módulos Wasm (Rust, C++, Kotlin/Wasm y SQLite Wasm) con el navegador a 60–120 FPS sin cuellos de botella de memoria ni latencia en el hilo principal de la interfaz.

---

## 🎯 Objetivo de la Skill
Garantizar máximo rendimiento computacional en operaciones intensivas (dibujo vectorial analítico, mezcla de capas de mapa de bits, cálculo matricial, transformaciones afines y almacenamiento masivo ACID) mediante las extensiones más avanzadas de WebAssembly.

---

## 🧠 1. Gestión de Memoria Lineal y Cero Copia (Zero-Copy)

### A. El Antipatrón: Serialización JSON o Copias Innecesarias
- **Regla:** NUNCA serializar estructuras grandes o arrays de píxeles/puntos a JSON o cadenas string a través del puente JS-Wasm. Esto congela el hilo de la UI.
- **Protocolo Cero Copia:**
  1. El módulo Wasm exporta su buffer de memoria lineal (`instance.exports.memory.buffer`).
  2. JavaScript lee y escribe directamente en la memoria mediante vistas de arrays tipados (`Uint8Array`, `Float32Array`, `Int32Array`) usando el puntero (`offset`) y la longitud (`byteLength`).
  3. Si la memoria de WebAssembly crece (`memory.grow()`), el `buffer` se invalida automáticamente; por lo tanto, las vistas de TypedArray deben re-indexarse o crearse bajo demanda.

```typescript
// Patrón de acceso directo a memoria Wasm sin asignación de copias:
function getWasmPixelView(memory: WebAssembly.Memory, ptr: number, byteLength: number): Uint8Array {
  return new Uint8Array(memory.buffer, ptr, byteLength);
}
```

---

## ⚡ 2. Vectorización SIMD128 (Single Instruction, Multiple Data)

- **Propósito:** Procesar 4 números de punto flotante de 32 bits (o 16 enteros de 8 bits) en una sola instrucción de CPU.
- **Aplicación en el lienzo:** Cálculo de curvas Bézier, simplificación de trazos de lápiz, filtros de extracción de lineart y modulación de texturas de pincel.
- **Detección de Soporte en Runtime:**
  ```typescript
  // Comprobación de SIMD128 sin romper navegadores antiguos:
  export async function isWasmSimdSupported(): Promise<boolean> {
    try {
      // Bytecode mínimo válido de prueba con instrucción i32x4
      const bytes = new Uint8Array([
        0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
        0x01, 0x05, 0x01, 0x60, 0x00, 0x01, 0x7b, 0x03,
        0x02, 0x01, 0x00, 0x0a, 0x09, 0x01, 0x07, 0x00,
        0xfd, 0x0c, 0x00, 0x00, 0x00, 0x00, 0x0b
      ]);
      return await WebAssembly.validate(bytes);
    } catch {
      return false;
    }
  }
  ```

---

## 🧵 3. Multihilo con Web Workers y SharedArrayBuffer

- **Aislamiento de Origen Cruzado:** Para habilitar `SharedArrayBuffer` y soporte multihilo de Wasm, el servidor debe proveer obligatoriamente:
  ```http
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
  ```
- **Hilo de UI Libre de Bloqueos:** Todo procesamiento pesado (como el motor de flood fill con cierre de huecos, algoritmos de dilatación morfológica y persistencia SQLite) debe correr en un **Web Worker dedicado**.

---

## 💾 4. SQLite Wasm sobre OPFS (Origin Private File System)

- **Ventaja:** Permite almacenamiento relacional ACID a velocidad de disco nativo en el dispositivo móvil, sin el límite de 50MB de IndexedDB ni caídas por cuotas inesperadas.
- **Reglas de Integración:**
  1. Instanciar el driver oficial `@sqlite.org/sqlite-wasm`.
  2. Verificar siempre si `'opfs'` está registrado en el objeto `sqlite3.vfs`.
  3. Usar transacciones agrupadas (`BEGIN TRANSACTION; ... COMMIT;`) para operaciones masivas de guardado (evita escrituras individuales en disco que ralenticen la app).

---

## 🛠️ 5. Poda Extrema de Binarios con Binaryen (`wasm-opt`)

Para optimizar el peso del archivo `.wasm` y acelerar su tiempo de descarga e inicialización en conexiones móviles:

### Banderas de Optimización recomendadas:
```bash
wasm-opt \
  -O4 \
  --converge \
  --strip-debug \
  --strip-producers \
  --vacuum \
  --dce \
  --remove-unused-module-elements \
  --simplify-globals-optimizing \
  --low-memory-unused \
  input.wasm -o output.optimized.wasm
```

- `-O4`: Optimización de bucles e inline agresivo de funciones pequeñas.
- `--converge`: Repite los pases de optimización hasta que el binario no pueda reducirse más.
- `--strip-debug` & `--strip-producers`: Elimina metadatos, nombres de funciones y trazas de depuración del compilador para ahorrar entre un 30% y un 60% de tamaño.
- `--low-memory-unused`: Indica que las direcciones de memoria bajas no están reservadas por el kernel, permitiendo mayor compactación.

---

## 🛡️ 6. Checklist de Arquitectura Wasm

- [ ] ¿Las funciones intensivas corren en un Worker o liberan el hilo principal?
- [ ] ¿Se evita la instanciación redundante de módulos Wasm (uso de singleton o caché)?
- [ ] ¿Existe fallback elegante en caso de que el navegador no soporte SIMD o WebGPU?
- [ ] ¿Las cabeceras COOP/COEP están configuradas si se requiere `SharedArrayBuffer`?
- [ ] ¿Las lecturas y escrituras de buffers usan vistas directas sin clones de memoria innecesarios?
