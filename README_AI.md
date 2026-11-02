# 🧠 README_AI.md - Directrices Técnicas para Modelos de Lenguaje (PWA Nativa con Kotlin/Wasm, Rust & C++23)

Este documento proporciona instrucciones de compilación, patrones de arquitectura y comandos de prueba para agentes y modelos de IA que interactúen con el código de **InkFlow Studio**.

---

## 🛠️ Stack Tecnológico

| Capa | Tecnología | Archivo Clave |
|---|---|---|
| **Frontend UI** | React 19 + Tailwind CSS + Lucide Icons | `src/App.tsx`, `src/components/*` |
| **Núcleo C++23** | ISO/IEC 14882:2023 (`std::span`, conceptos, C-ABI Wasm) | `src/cpp-core/include/IbisStrokeAnalyzer.hpp`, `src/cpp-core/CMakeLists.txt` |
| **Lápiz Vectorial (Zoom Infinito)** | Kotlin/Wasm (`wasmJs` / Wasm-GC) + Curvas Bézier | `src/kotlin-core/VectorEngine.kt`, `src/engine/kotlinWasmBridge.ts` |
| **Pipeline Gráfico** | WebGPU (WGSL Shaders) + Fallback Canvas 2D | `src/engine/webgpuEngine.ts` |
| **Matemática Vectorial Wasm** | WebAssembly (Bytecode Wasm en memoria) + Estabilizador | `src/engine/wasmEngine.ts` |
| **Filtros de Calco Wasm** | Sobel Lineart, Contraste y Monocromo en Wasm/TS | `src/engine/tracingEngine.ts` |
| **Asistente de Grosor Real** | Visión artificial de imagen, percentiles P92/P68/P38/P12 y muestreo local | `src/engine/strokeAssistant.ts` |
| **Núcleo de Vértices** | Rust (Targets wasm32-unknown-unknown / SIMD128) | `src/rust-core/src/lib.rs`, `src/rust-core/Cargo.toml` |
| **Gestos Multitáctiles & Mapeo Canónico** | Pinch-to-Zoom, Paneo, Rotación a 2 dedos y `screenToCanvasCoords` | `src/components/StudioScreen.tsx`, `src/engine/transformMath.ts` |
| **Bote de Pintura & Cierre de Huecos** | Scanline Flood Fill + Dilatación morfológica (1-3px) + Gap Closing C++23/TS (0-10px) | `src/engine/floodFillEngine.ts`, `src/engine/webgpuEngine.ts` |
| **Accesorios y Stickers de Galería** | Estampado de moños y adornos en capa activa o nueva capa (`TracingAdjuster`) | `src/components/TracingAdjuster.tsx`, `src/hooks/useTracingManager.ts` |
| **Expansión y Redimensionado de Hoja** | Matriz visual 3x3, cálculo de offsets y presets de espacio (+25%, +50%, 2x, 1:1, 9:16) | `src/components/CanvasResizeModal.tsx`, `src/engine/canvasResizeMath.ts` |
| **Guardado de Obra a Galería** | Hoja Completa vs Auto-Crop + Cálculo de peso KB/MB en tiempo real | `src/components/ExportModal.tsx`, `src/engine/transformMath.ts` |
| **Persistencia Masiva SQLite Wasm** | Base de datos ACID sobre OPFS en Web Worker dedicado + Centinela Crash | `src/storage/sqliteStorage.worker.ts`, `src/storage/sqliteStorageService.ts` |
| **Caché Integral & Aceleración VRAM** | Workbox 10MB + Wasm Streaming JIT + Inmutabilidad Cloudflare + GPU ImageBitmap | `vite.config.ts`, `public/_headers`, `src/engine/wasmStreamingCompiler.ts`, `src/engine/bitmapCache.ts` |
| **Arquitectura de App & CI/CD** | Progressive Web App (PWA) + GitHub Actions Wasm Resiliente + Cloudflare Pages | `.github/workflows/deploy.yml`, `public/manifest.json`, `public/sw.js` |
| **Suite de Tests** | Node.js Test Runner (`node:test`) + `tsx` (43 tests deterministas en 2 suites) | `src/engine/engine.test.ts`, `src/storage/storage.test.ts` |

---

## ⚡ Comandos Críticos de Verificación

```bash
# 1. Compilación TypeScript y linter estricto:
npm run lint

# 2. Pruebas unitarias de matemática de curvas, C++23/TS, Kotlin/Wasm, calco, flood fill, expansión y SQLite Wasm OPFS:
npx --yes tsx --test src/engine/engine.test.ts src/storage/storage.test.ts

# 3. Compilación de producción con Vite:
npm run build

# 4. Servidor de desarrollo:
npm run dev
```

---

## 📐 Patrones Arquitectónicos Requeridos

### 1. Invarianza de la Lógica Gráfica
Nunca embeber cálculos trigonométricos o de amortiguación de trazos dentro de componentes JSX. Toda función matemática debe agregarse a `wasmEngine.ts`, `kotlinWasmBridge.ts`, `strokeAssistant.ts` o `webgpuEngine.ts` y acompañarse de su test unitario en `engine.test.ts`.

### 2. Ergonomía en Pantallas Táctiles Móviles
- Los cuadros de control y superposiciones sobre el lienzo (como `TracingAdjuster`) deben disponer de minimización inmediata para que el artista pueda ver y calcar toda el área sin estorbos.
- La foto de calco cuenta con un conmutador directo de visibilidad (`visible: boolean`) para alternar en 1 toque entre ver y ocultar la referencia.
- Las herramientas en `ToolPickerModal` se organizan en un **Bottom Sheet nativo** con control segmentado superior (`[Herramientas]` y `[Estabilizador S-Form]`). La selección es táctil e instantánea con vibración háptica, eliminando botones tipo formulario web.
- El `StrokeGuideAssistant` calibra automáticamente los grosores reales analizados por visión artificial de la foto de calco cargada, permitiendo al usuario adoptar la recomendación en 1 toque sin obligarlo.

### 3. Lápiz Vectorial Analítico (Kotlin/Wasm)
A diferencia de los pinceles raster que pintan píxeles en un mapa de bits estático, el Lápiz Vectorial almacena los puntos y segmentos cúbicos de Bézier $B(t)$. Cuando el usuario hace zoom, `drawingEngine.compositeLayers` re-evalúa los trazos vectoriales a la resolución nativa del dispositivo, logrando **cero pixelación**.

### 4. Persistencia Masiva SQLite Wasm sobre OPFS & Centinela de Crash
- Todo el I/O pesado de píxeles y vectores corre en el Web Worker `sqliteStorage.worker.ts` sin tocar el hilo de UI.
- Si el usuario minimiza la PWA o el sistema operativo móvil descarga el proceso de memoria (`visibilitychange` o `pagehide`), se ejecuta un snapshot atómico en la tabla `crash_recovery`.
- Los errores de JavaScript se interceptan en `window.onerror`, `unhandledrejection` y `ErrorBoundary.tsx`, permitiendo recuperar la ilustración intacta en 1 toque al reiniciar.

### 5. Caché Integral al 100% y Aceleración VRAM
- Las fuentes compiladas Wasm se prealmacenan en el Service Worker con Workbox configurado a 10MB en `vite.config.ts`.
- `wasmStreamingCompiler.ts` utiliza `WebAssembly.instantiateStreaming` para compilar bytecode directo a la caché de código máquina de la CPU móvil.
- Las cabeceras `public/_headers` aplican inmutabilidad (`max-age=31536000, immutable`) en Cloudflare Pages.
- `GPUBitmapCache` (`bitmapCache.ts`) procesa imágenes con `createImageBitmap` fuera del hilo principal y almacena texturas directamente en la VRAM de la GPU con liberación explícita vía `.close()`.

### 6. Bote de Pintura con Expansión de Borde & Expansión de Hoja sin Pérdidas
- `dilateBinaryMask` (`src/engine/webgpuEngine.ts`): Dilata morfológicamente la máscara de Flood Fill en radio de 1 a 3 px para cubrir el antialiasing y evitar los halos blancos bajo el contorno. Dispone de píldora rápida en el lienzo (`StudioScreen.tsx`) y ajustes en `ToolPickerModal.tsx`.
- `CanvasResizeModal.tsx` & `src/engine/canvasResizeMath.ts`: Aplican traslación de píxeles en todas las capas con matriz de anclaje 3x3, desplazan las curvas vectoriales analíticas de Kotlin/Wasm (`offsetAllStrokes`), re-alinean el calco activo y sincronizan atómicamente con SQLite Wasm sobre OPFS sin pérdidas.

### 7. Cierre Inteligente de Huecos & Accesorios / Stickers de Galería
- `generateClosedGapBarrierMask` (`src/engine/floodFillEngine.ts`) & `close_boundary_gaps` (`src/cpp-core/`): Implementan cierre morfológico (dilatación y erosión topológica) sobre la máscara binaria de barrera con radio $R = \lceil \text{gapClosing} / 2 \rceil$. Une brechas abiertas de hasta 3, 6 y 10px antes del recorrido Scanline, conteniendo la inundación de pintura sin modificar el lineart dibujado.
- `TracingAdjuster.tsx` & `useTracingManager.ts`: Soporta tanto imágenes de calco (`purpose: 'tracing'`) como accesorios / moños / stickers (`purpose: 'accessory'`). Permite manipular con gestos multitáctiles o deslizadores y estampar de forma permanente en la capa activa (`[✨ Estampar en Capa]`) o en una capa nueva (`[📑 + Nueva Capa]`), guardando el paso en el historial de deshacer y persistiendo atómicamente en SQLite Wasm sobre OPFS.
