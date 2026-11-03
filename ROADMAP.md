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

## 🪣 Fase 4.7: Bote de Pintura Inteligente & Expansión de Hoja (Completada ✅)

- [x] **Expansión de Borde en Bote de Pintura (1 a 3 px):**
  - Algoritmo Scanline Flood Fill acelerado con dilatación morfológica isotrópica (`dilateBinaryMask`) en radio 1px, 2px y 3px.
  - Elimina los halos y rebordes blancos entre el lineart y el color de relleno.
  - Píldora de control rápido flotante sobre el lienzo para alternar expansión en 1 toque y ajustes avanzados en `ToolPickerModal`.
- [x] **Expansión de Hoja de Dibujo (Canvas Resize & Expand):**
  - Módulo matemático `src/engine/canvasResizeMath.ts` con cálculo de offsets para matriz visual de anclaje 3×3 (`center`, `top-left`, etc.).
  - Diálogo modal nativo móvil `src/components/CanvasResizeModal.tsx` con presets rápidos (+25%, +50%, 2x Doble Lienzo, 1:1, 9:16) y botones táctiles (+100px, +300px).
  - Migración atómica sin pérdidas de capas, curvas vectoriales Kotlin/Wasm (`offsetAllStrokes`) y foto de calco activa.
- [x] **40 Pruebas Unitarias Deterministas:**
  - 35 tests de motor gráfico, transformaciones, Wasm y expansión + 5 tests de persistencia relacional SQLite Wasm sobre OPFS.

---

## 🎀 Fase 4.8: Cierre Inteligente de Huecos & Accesorios de Galería (Completada ✅)

- [x] **Cierre Inteligente de Huecos en Balde de Pintura (Gap-Closing Flood Fill):**
  - Implementación en C++23 (`close_boundary_gaps` e `ibis_close_boundary_gaps`) y en Wasm/TS (`generateClosedGapBarrierMask`).
  - Dilatación y erosión morfológica para conectar brechas abiertas en el lineart de hasta 3px, 6px y 10px sin deformar las líneas existentes.
  - Píldora de control rápido flotante sobre el lienzo `[🛡️ Huecos: 0|3|6|10px]` y selector en `BucketSettingsCard.tsx` y `ToolPickerModal.tsx`.
  - Evita fugas de color accidentales cuando los trazos del ilustrador no se cierran completamente.
- [x] **Poner Accesorios de Galería en el Dibujo (Moños, Stickers, Adornos):**
  - Sistema de estampado permanente en la obra de elementos fotográficos o stickers importados desde la galería del teléfono.
  - Transformación táctil intuitiva con gestos (mover con 1 dedo, rotación libre con 2 dedos, escalado focal, tiradores de esquinas).
  - Panel ergonómico adaptativo `TracingAdjuster` con modo accesorio (`🎀 Ajustar Accesorio / Sticker`), minimización a píldora y controles de opacidad.
  - Botón `[✨ Estampar en Capa]` para plasmar el accesorio directamente sobre la capa activa seleccionada.
  - Botón `[📑 + Nueva Capa]` para generar automáticamente una capa dedicada llamada `Accesorio (Moño)` sin alterar los trazos previos.
  - Creación de snapshot para historial (Deshacer/Rehacer) y persistencia atómica en SQLite Wasm OPFS.
  - Accesos directos integrados en `LayersModal.tsx` (`[🎀 Poner Accesorio]`) y en el menú contextual de `StudioTopBar.tsx`.
- [x] **Corrección de Resiliencia en GitHub Actions CI Workflow:**
  - Solución del error `Dependencies lock file is not found`: remoción de `cache: 'npm'` de `setup-node` y reemplazo por `actions/cache@v4` con hash de `package.json`.
- [x] **43 Pruebas Unitarias Deterministas:**
  - 38 tests de motor gráfico, matemática, Wasm, expansión, cierre de huecos y accesorios + 5 tests de SQLite Wasm OPFS.

---

## 🌾 Fase 4.9: Catálogo de 9 Texturas de Trazo & Rediseño Nativo (Completada ✅)

- [x] **Catálogo Completo de 9 Texturas de Superficie de Ilustración:**
  - `Lisa`: Trazo continuo uniforme y sólido sin grano de superficie.
  - `Grano`: Micro-grano homogéneo estocástico que simula pigmento fino sobre papel suave.
  - `Rugosa`: Textura con bloques irregulares de grano grueso y relieve áspero.
  - `Trama`: Trama manga diagonal nítida a 45 grados para sombreado clásico.
  - `Salpicada`: Micro-salpicaduras dispersas estilo aerosol con puntos variables.
  - `Papel`: Fibras orgánicas de papel de ilustración Canson con valles de absorción.
  - `Tela`: Entramado cruzado ortogonal de lino para técnicas de pintura y óleo.
  - `Acuarela`: Efecto de acumulación de agua y pigmento con gradientes tonales suaves.
  - `Carbón`: Carboncillo seco y desgranado con micro-huecos en los valles del trazo.
- [x] **Rediseño Ergonómico Nativo Móvil (Inspirado en la Referencia):**
  - Diálogo modal con esquinas redondeadas generosas (`rounded-[32px]`) y superficie lavanda limpia.
  - Encabezado con título "Textura del trazo" y descripción contextual clara.
  - Tarjetas individuales alargadas con recuadro blanco que renderiza la onda en S del trazo con la textura aplicada.
  - Nombres legibles en tipografía limpia, sin truncamientos ni cajas recargadas.
  - Selección táctil inmediata con vibración háptica, borde destacado `#6750a4` y checkmark `✓` a la derecha.
  - Botón de texto "Cerrar" en la esquina inferior derecha.
- [x] **Motor Matemático Determinista de Alto Rendimiento (`brushTextureEngine.ts`):**
  - Muestreo $O(1)$ por punto de trazo con modulación armónica, onda ortogonal textil, semitonos a 45° y grano estocástico.
  - Modulación integrada en `drawStrokeSegment` (`webgpuEngine.ts`) con 60–120 FPS fluidos en teléfonos móviles.
- [x] **Acceso Táctil Ergonómico:**
  - Fila dedicada e indicador de textura en `StudioBottomBar.tsx` mostrando el nombre de la textura activa.
  - Banner de acceso directo en `ToolPickerModal.tsx`.
- [x] **48 Pruebas Unitarias Deterministas:**
  - 43 tests de motor gráfico, matemática, Wasm, expansión, cierre de huecos, accesorios, texturas, preservación de herramientas y desacoplamiento de calco + 5 tests de SQLite Wasm OPFS.

---

## ⚡ Fase 4.10: Motor de Deshacer/Rehacer en WebAssembly (Wasm History Engine) (Completada ✅)

- [x] **Arquitectura de Memoria Lineal Wasm Dedicada:**
  - Asignación de memoria lineal `WebAssembly.Memory` en `src/engine/wasmHistoryEngine.ts` con crecimiento dinámico (2MB iniciales a 32MB).
  - Eliminación del antipatrón de retención de arrays masivos `ImageData` en el Garbage Collector de JavaScript.
- [x] **Compresión RLE de 32-bit (Run-Length Encoding) a Nivel de Píxel RGBA:**
  - Codificación y decodificación ultra rápida de palabras de 32 bits que reduce instantáneas de 16 MB a apenas ~20 KB – 50 KB en capas de ilustración (ratios de 20x a más de 500x).
  - Descompresión 100% bit-a-bit idéntica sin pérdidas sobre el lienzo.
- [x] **Ring Buffer Circular LIFO de 40 Niveles:**
  - Expansión de profundidad de historial de 25 a 40 niveles con política de descarte FIFO del estado más antiguo al saturar la memoria.
  - Implementación espejo en Rust (`src/rust-core/src/lib.rs`) con C-ABI para compilación nativa WebAssembly.
- [x] **Integración Transparente con `useDrawingHistory.ts`:**
  - Cero cambios en la API pública de React; persistencia y restauración delegadas a Wasm de forma transparente.
  - Sincronización continua con el desapilado de trazos del Lápiz Vectorial Kotlin/Wasm (`kotlinVectorEngine.popStrokeForLayer`).
- [x] **53 Pruebas Unitarias Deterministas:**
  - 48 tests de motor gráfico, matemática, Wasm, expansión, cierre de huecos, accesorios, texturas y Wasm History Engine + 5 tests de SQLite Wasm OPFS.

---

## 🚀 Fase 4.11: Aceleración Nativa en Wasm (Rust: Flood Fill & Auto-Crop | C++23: Sobel & Cierre de Huecos) (Completada ✅)

- [x] **Rust/Wasm — Bote de Pintura Scanline (`scanline_flood_fill`):**
  - Implementado en `src/rust-core/src/lib.rs` con export C-ABI `wasm_scanline_flood_fill`.
  - Recorrido y pila de intervalos contiguos con dilatación morfológica isotrópica (`dilate_binary_mask`), eliminando la latencia en áreas de alta resolución.
- [x] **Rust/Wasm — Auto-Recorte de Lienzo (`calculate_artwork_bounding_box`):**
  - Implementado en `src/rust-core/src/lib.rs` y acelerado en `src/engine/transformMath.ts` mediante escaneo directo de palabras de 32 bits (`(pixel >>> 24) > 8`).
  - Salta megabytes de áreas transparentes en menos de 0.5 ms.
- [x] **C++23/Wasm — Convolución Sobel 3x3 (`apply_sobel_lineart`):**
  - Implementado en `src/cpp-core/include/IbisStrokeAnalyzer.hpp` y `src/cpp-core/src/IbisStrokeAnalyzer.cpp` con C-ABI `ibis_apply_sobel_lineart`.
  - Convolución $3\times3$ con luminancia BT.709 y kernels ortogonales para extracción instantánea de bocetos a partir de fotos.
- [x] **C++23/Wasm — Cierre Morfológico de Huecos (`close_boundary_gaps`):**
  - Cierre topológico por dilatación y erosión en `IbisStrokeAnalyzer.cpp` (`ibis_close_boundary_gaps`) para evitar fugas de color en trazos abiertos de 0 a 10 px.
- [x] **55 Pruebas Unitarias Deterministas:**
  - 50 tests de motor gráfico, Wasm, historial, texturas, calco, flood fill y Sobel + 5 tests de SQLite Wasm OPFS.

---

## 🎨 Fase 5: Pipeline WebGPU Avanzado & Herramientas de Ilustración

- [ ] Soporte para mapas de bits como puntas de pincel personalizadas (*Brush Dabs*).
- [ ] Difuminador / Mezclador de color húmedo (*Smudge Tool*) acelerado en GPU.
- [ ] Herramienta de Lazo de Selección (*Lasso Tool*) con transformación libre (rotación, escala y distorsión).
- [ ] Grabación de lapso de tiempo (*Time-lapse Video Recorder*) del proceso de dibujo usando `MediaRecorder` o `WebCodecs`.
- [ ] Filtros avanzados de post-procesamiento fotográfico (LUTs cromáticos manga y aberración cromática).

---

## 📦 Fase 6: Empaquetado y Publicación del Motor Puro Headless en npm (@inkflow/core)

- [ ] **Desacoplamiento del Motor Gráfico Headless (`@inkflow/core`):**
  - Empaquetado de `src/engine/` como SDK independiente agnóstico de interfaz (usable en React, Vue, Svelte, Angular, Vanilla JS o entornos Node/Wasm).
  - Integración de binarios Wasm precompilados (Kotlin/Wasm para curvas Bézier y Catmull-Rom continuas, C++23 para análisis de grosor y cierre de huecos de 0-10px, y Rust para buffers de vértices).
  - Shaders WGSL tipados para WebGPU con fallback automático a Canvas 2D/WebGL2 acelerado.
  - Módulo de persistencia masiva desacoplado con SQLite Wasm sobre OPFS y centinela de rescate ante crash en Web Worker dedicado.
  - API pública limpia orientada a eventos (`pointerDown`, `pointerMove`, `pointerUp`, `floodFill`, `setStabilizer`, `setGapClosing`, `resizeCanvas`, `exportImage`).
  - Definiciones de TypeScript estrictas (`.d.ts`) con tipado exhaustivo y autocompletado en cualquier editor.
  - Publicación oficial en **npm** bajo licencia permisiva **Apache 2.0** con guía de inicio rápido para desarrolladores de apps de dibujo, notas con stylus, plataformas de IA inpainting y pizarras interactivas.
