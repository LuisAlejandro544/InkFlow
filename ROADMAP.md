# 🗺️ Roadmap de Desarrollo - InkFlow Studio (PWA Nativa con Kotlin/Wasm, Rust & C++23)

Este documento establece las fases de evolución del motor gráfico, optimizaciones en bajo nivel (Kotlin/Wasm, Rust/Wasm, C++23), capacidades offline y herramientas de dibujo digital para la **Progressive Web App (PWA)** exclusiva.

---

## 📌 Fase 1: Motor Base & Validación Táctil Móvil (Completada ✅)

- [x] Motor matemático Wasm compilado para cálculo de distancias euclidianas e interpolación lineal.
- [x] Estabilizador de trazo estilo IbisPaint (S-Form niveles 0 a 10) con filtro de amortiguación exponencial.
- [x] Pipeline WebGPU inicial con shaders WGSL para sellos radiales y fallback acelerado a Canvas 2D/WebGL2.
- [x] Navegación libre del lienzo (Herramienta Mano, D-Pad omnidireccional, zoom +/- y centrado a pantalla).
- [x] Sistema de capas con modos de fusión (*Normal, Multiplicar, Pantalla, Superponer, Añadir*).
- [x] Barra de herramientas táctil móvil en 2 niveles (Sliders + dock ergonómico de acceso rápido).
- [x] Pruebas unitarias de lógica pura con `node:test` y `node:assert/strict`.
- [x] Lienzo 100% limpio listo para ilustrar sin trazos residuales (iniciando con 1 capa limpia).
- [x] Paleta visual profesional estilo estudio de arte (Grafito, Carbón y Ámbar dorado).

---

## 🚀 Fase 2: PWA Nativa & Almacenamiento Autónomo (Completada ✅)

- [x] Configuración de Progressive Web App (PWA) con Service Worker y precaché inteligente.
- [x] Manifiesto de aplicación (`manifest.webmanifest`) con `display: "standalone"` para renderizado sin barras de navegador.
- [x] Generación de iconos nativos adaptativos (`pwa-192x192.png`, `pwa-512x512.png`, `pwa-maskable-512x512.png` y `apple-touch-icon.png`).
- [x] Hook in-app `usePWAInstall` para instalación directa con un toque en la pantalla de inicio del teléfono.
- [x] Detección de entorno móvil táctil (Android Chromium e iOS Safari) y compatibilidad con vibración háptica.
- [x] Persistencia de proyectos en almacenamiento local del dispositivo.

---

## ⚡ Fase 3: Integración Kotlin/Wasm & Gestos Multitáctiles (Completada ✅)

- [x] **Motor Vectorial en Kotlin/Wasm:**
  - Código fuente en `src/kotlin-core/VectorEngine.kt` orientado a compilación `wasmJs` con Wasm-GC.
  - Puente de ejecución de alto rendimiento `src/engine/kotlinWasmBridge.ts`.
  - Algoritmo de ajuste Catmull-Rom a Bézier cúbica con continuidad C1 y decodificación de presión.
  - Algoritmo de simplificación de trazos Douglas-Peucker.
- [x] **Lápiz Vectorial (Cero Píxeles al Zoom):**
  - Renderizado vectorial dinámico e independiente de resolución. Al acercar el zoom, el trazo nunca se pixela.
- [x] **Gestos Multitáctiles con tus Propios Dedos (Pinch-to-Zoom):**
  - Acercar y alejar directamente pellizcando con dos dedos de forma ultra fluida con anclaje focal.
  - Paneo y desplazamiento continuo a dos dedos sin dejar marcas ni puntos accidentales en el lienzo.
- [x] **Alternador Inmediato Dibujar / Mover:**
  - Selector superior y botón en dock para alternar entre `[✏️ Modo Dibujo]` y `[✋ Modo Mover]` en 1 toque.

---

## 📷 Fase 4: Modo Calco, C++23 & Asistente de Grosor Real (Completada ✅)

- [x] **Integración de Núcleo C++23 (ISO/IEC 14882:2023):**
  - Módulo en `src/cpp-core/` con `IbisStrokeAnalyzer.hpp` y `IbisStrokeAnalyzer.cpp`.
  - Análisis de percentiles y estimación transversal de trazo en C++23 moderno.
  - Configuración CMakeLists.txt con target Wasm y arquitecturas 32/64 bits (`arm64-v8a`, `armeabi-v7a`, `x86_64`).
- [x] **Asistente de Grosor de Trazo 100% REAL:**
  - Calibración por visión artificial a partir de la foto de calco cargada.
  - Extracción de percentiles reales: Silueta (P92), Estructura (P68), Detalles (P38), Tramas (P12).
  - Recomendación no obligatoria en 1 toque que respeta la autonomía del artista.
  - Muestreo de grosor en tiempo real en coordenadas tocadas por el usuario.
- [x] **Rediseño Nativo de Selector de Herramientas y Estabilizador:**
  - Bottom sheet nativo con control segmentado superior: `[Herramientas]` y `[Estabilizador S-Form]`.
  - Selección táctil instantánea con retroalimentación háptica (eliminación de botones web de formulario).
  - Aislamiento del banco de pruebas del estabilizador con bloc táctil y presets.
- [x] **Rotación Libre del Lienzo a Dos Dedos con Snapping Magnético:**
  - Movimiento libre multitáctil: escala (*pinch*), desplazamiento (*pan*) y rotación (*rotate*) simultánea con dos dedos.
  - Ajuste magnético de ángulo (*angle snap*) en 0°, 90°, 180° y 270° al acercarse a la ortogonalidad.
  - Mapeo canónico exacto con `screenToCanvasCoords` para trazado milimétrico sin desvíos en el lienzo rotado.
- [x] **Guardado de la Obra Maestra a Galería con Auto-Crop y Peso en Tiempo Real:**
  - Selector entre "Hoja Completa" (lienzo entero) o "Recortar al Dibujo (Auto-crop)" para eliminar bordes sobrantes.
  - Detección algorítmica de la caja delimitadora (*bounding box*) del dibujo en todas las capas con margen estético.
  - Estimación y visualización en tiempo real del peso del archivo en KB/MB antes de exportar.
  - Soporte de guardado en la galería del dispositivo mediante la Web Share API y descarga directa.
- [x] **Barra Superior Ergonómica Móvil Anti-Desbordamiento:**
  - Botón principal de guardado `[💾 Guardar]` siempre al alcance y sin recortes en pantallas de 360–412px.
  - Menú desplegable `[⋯]` con herramientas auxiliares y botón de reseteo de rotación a 0°.
- [x] **35 Pruebas Unitarias Automatizadas** con validación de análisis de imagen, muestreo local, rotación, mapeo exacto pantalla-lienzo, reversibilidad biyectiva, auto-crop, algoritmos Wasm y motor relacional SQLite OPFS con transacciones ACID.
- [x] **Compilación y Despliegue Manual en Cloudflare Pages con GitHub Actions** compilando C++23 y Rust a Wasm.

---

## 🗄️ Fase 4.5: Persistencia Masiva SQLite Wasm (OPFS) & Centinela de Crash (Completada ✅)

- [x] **Motor Relacional Oficial `@sqlite.org/sqlite-wasm`:**
  - Desacoplamiento total ejecutándose en un **Web Worker dedicado**.
  - Backend sobre **OPFS (Origin Private File System)** nativo del sistema operativo móvil (`FileSystemSyncAccessHandle`).
  - Cero cuotas de 5 MB de `localStorage` y cero sobrecarga de recolector de basura de librerías como `dexie.js`.
  - Transacciones ACID para consistencia íntegra de proyectos y capas en alta resolución.
- [x] **Centinela de Salida Abrupta y Cierre de Proceso Móvil:**
  - Captura y persistencia de emergencia inmediata al minimizar la app o cambiar de ventana (`visibilitychange` a `hidden`).
  - Salvaguarda al descargar el proceso de memoria (`pagehide`).
- [x] **Protección Contra Crasheos de Renderizado:**
  - Registro de checkpoints ante excepciones globales de JavaScript (`window.onerror`, `unhandledrejection`).
  - Integración en `ErrorBoundary` de React con resguardo seguro antes de interrumpir la UI.
- [x] **Banner de Restauración Automática en 1 Toque:**
  - Detección al iniciar la app de sesiones interrumpidas o dibujos sin guardar con restauración instantánea.
- [x] **Suite de Pruebas Automatizadas de Almacenamiento:**
  - 5 pruebas unitarias deterministas verificando inicialización Wasm, transacciones ACID, tablas relacionales y ciclo de recuperación de crash.

---

## ⚡ Fase 4.6: Aceleración por Caché al 100% & Compilación Streaming Wasm (Completada ✅)

- [x] **Precaché Workbox Ampliado a 10 MB:**
  - Configurado en `vite.config.ts` con `maximumFileSizeToCacheInBytes: 10485760` y patrón `globPatterns` que incluye todos los archivos `**/*.wasm`.
  - Arranque instantáneo offline en 0.05 segundos con Service Worker precargado.
- [x] **Compilación Streaming Wasm (`WebAssembly.instantiateStreaming`):**
  - Módulo `src/engine/wasmStreamingCompiler.ts` para compilar bytecode Wasm directamente a código máquina nativo de la CPU móvil (ARM64/x86).
  - Almacena el binario ya compilado en la caché de bajo nivel de la CPU evitando recompilaciones.
- [x] **Cabeceras de Inmutabilidad en Cloudflare Pages (`public/_headers`):**
  - Directiva `Cache-Control: public, max-age=31536000, immutable` para `/assets/*` y `/*.wasm`.
  - Cero peticiones de red innecesarias en visitas recurrentes.
- [x] **Caché VRAM en GPU con `ImageBitmap` (Cero Re-decodificación):**
  - `src/engine/bitmapCache.ts` (`GPUBitmapCache`) para capas y fotos de calco.
  - Decodificación fuera del hilo de UI y retención directa en memoria de texturas VRAM para 60–120 FPS sin consumo de CPU.
  - Gestión LRU y liberación explícita de memoria GPU mediante `.close()`.
- [x] **Persistencia Permanente del Almacenamiento Móvil:**
  - Invocación de `navigator.storage.persist()` para evitar purgas del sistema operativo en móviles con bajo espacio.
- [x] **37 Pruebas Unitarias Deterministas** automatizadas con `node:test`.

---

## 🎨 Fase 5: Pipeline WebGPU Avanzado & Herramientas de Ilustración

- [ ] Soporte para mapas de bits como puntas de pincel personalizadas (*Brush Dabs*).
- [ ] Bote de pintura con cierre automático de huecos (*Gap Closing Flood Fill*).
- [ ] Difuminador / Mezclador de color húmedo (*Smudge Tool*) acelerado en GPU.
- [ ] Herramienta de Lazo de Selección (*Lasso Tool*) con transformación libre (rotación, escala y distorsión).
- [ ] Grabación de lapso de tiempo (*Time-lapse Video Recorder*) del proceso de dibujo usando `MediaRecorder` o `WebCodecs`.
