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
| **Guardado de Obra a Galería** | Hoja Completa vs Auto-Crop + Cálculo de peso KB/MB en tiempo real | `src/components/ExportModal.tsx`, `src/engine/transformMath.ts` |
| **Arquitectura de App & CI/CD** | Progressive Web App (PWA) + GitHub Actions Wasm + Cloudflare Pages | `.github/workflows/deploy.yml`, `public/manifest.json`, `public/sw.js` |
| **Suite de Tests** | Node.js Test Runner (`node:test`) + `tsx` (27 tests deterministas) | `src/engine/engine.test.ts` |

---

## ⚡ Comandos Críticos de Verificación

```bash
# 1. Compilación TypeScript y linter estricto:
npm run lint

# 2. Pruebas unitarias de matemática de curvas, C++23/TS análisis de grosor, Kotlin/Wasm y calco:
npx --yes tsx --test src/engine/engine.test.ts

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
