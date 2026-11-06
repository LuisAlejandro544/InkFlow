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

## ⚡ Fase 4.12: Migración del Motor Vectorial Analítico a C++23 (Wasm) (Completada ✅)

- [x] **C++23 Moderno — Motor Vectorial Analítico (`IbisVectorEngine`):**
  - Implementado en `src/cpp-core/include/IbisVectorEngine.hpp` y `src/cpp-core/src/IbisVectorEngine.cpp`.
  - Estructuras `VectorPoint2D` y `CubicBezier2D` en memoria lineal contigua sin recolección de basura (GC).
  - Algoritmo Douglas-Peucker de decodificación y reducción de ruido táctil en tiempo lineal.
  - Generación de segmentos Bézier cúbicos con suavizado Catmull-Rom continuo ($C^1$) y gradiente de presión táctil.
  - Enlaces C-ABI para WebAssembly y NDK móvil: `ibis_vector_simplify_points`, `ibis_vector_generate_bezier_segments`, `ibis_vector_evaluate_bezier`.
- [x] **Puente WebAssembly en TypeScript (`cppWasmVectorBridge.ts`):**
  - Módulo `src/engine/cppWasmVectorBridge.ts` con API unificada de trazos vectoriales y renderizado submétrico sin pixelación al hacer zoom en dispositivos móviles.
  - Delegación transparente en `src/engine/kotlinWasmBridge.ts` asegurando compatibilidad completa con el historial y la expansión de hoja.

---

## 📱 Fase 4.13: Puente Nativo Android (Kotlin): Guardado Real en Galería & WakeLock (Completada ✅)

- [x] **Kotlin — Guardado REAL en la Galería de Fotos del Teléfono (`AndroidGalleryManager`):**
  - Implementado en `src/kotlin-core/AndroidPlatformBridge.kt`.
  - Utiliza la API nativa `MediaStore.Images.Media` de Android para guardar ilustraciones directamente en la carpeta visible `Pictures/InkFlow Studio` de la galería de fotos, eliminando las descargas web anónimas en carpetas oscuras.
  - Control de banderas transaccionales `IS_PENDING` para escritura atómica sin corrupciones y compatibilidad con formatos PNG, JPEG y WebP.
- [x] **Kotlin & PWA — WakeLock de Pantalla Encendida (`wakeLockService.ts`):**
  - Previene que el teléfono atenúe el brillo o apague la pantalla mientras el artista está dibujando o calcando.
  - Enlace dual: `FLAG_KEEP_SCREEN_ON` en Android a través de `AndroidScreenWakeLockManager` y estándar PWA `navigator.wakeLock.request('screen')`.
  - Auto-re-adquisición automática ante eventos de visibilidad (`visibilitychange`).
- [x] **57 Pruebas Unitarias Deterministas:**
  - 52 tests de motor gráfico, C++23 vectores, Wasm, historial, texturas, calco, flood fill, Sobel y Kotlin/PWA + 5 tests de SQLite Wasm OPFS.

---

## ⚡ Fase 4.14: Concurrencia Estructurada con `kotlinx.coroutines` (Completada ✅)

- [x] **Kotlin — Orquestador de Concurrencia Estructurada (`CoroutineOrchestrator.kt`):**
  - Implementado en `src/kotlin-core/CoroutineOrchestrator.kt` mediante la librería oficial `kotlinx.coroutines`.
  - `InkFlowCoroutineOrchestrator` con `SupervisorJob` y despacho de tareas en segundo plano (`Dispatchers.Default` / `Dispatchers.IO`), evitando que el fallo de una tarea secundaria derribe el hilo del estudio.
- [x] **Centinela de Auto-Guardado No Bloqueante (`AutoSaveCoroutineSentinel`):**
  - Bucle continuo asíncrono con suspensión cooperativa (`delay`) integrado en `useProjectPersistence.ts` que monitorea el estado dirty y persiste en SQLite Wasm (OPFS) sin provocar caída de frames en pantallas de 60/120 FPS.
  - Cancelación estructurada inmediata ante cierre del lienzo o cambio de proyecto (`job.cancel()`).
- [x] **Conflación de Puntos Táctiles (`TouchPointStreamConflator` / `Channel.CONFLATED`):**
  - Canal confluente integrado en caliente en `useStrokeDrawing.ts` que absorbe el torrente de coordenadas del lápiz o stylus a alta velocidad (hasta 240Hz).
  - Descarta automáticamente muestras intermedias obsoletas si el hilo de renderizado está procesando un cuadro previo, erradicando el lag y acumulaciones de latencia táctil.
- [x] **Despacho Asíncrono de I/O en Galería (`AndroidPlatformBridge.kt`):**
  - Inserciones en `MediaStore` y escritura a disco desacopladas en `withContext(Dispatchers.IO)` para que el hilo principal (MainLooper) jamás sufra bloqueos de interfaz.
- [x] **61 Pruebas Unitarias Deterministas:**
  - 56 tests de motor gráfico, C++23 vectores, Wasm, historial, texturas, calco, flood fill, Sobel, Kotlin/PWA y corrutinas + 5 tests de SQLite Wasm OPFS.

---

## 🛡️ Fase 4.15: Blindaje Anti-OOM en Móviles & Persistencia Integral del Calco (Completada ✅)

- [x] **Deduplicación Estricta de Decodificación en VRAM (`GPUBitmapCache`):**
  - Implementación de bloqueo de estado en vuelo (`pendingCreations` lock) para `createImageBitmap`.
  - Erradica la invocación concurrente masiva (hasta 60–120 llamadas simultáneas durante el trazo táctil) que disparaba el *Low Memory Killer* de Android y provocaba la pantalla "¡Oh, no!" de Chrome.
  - Reducción del límite de VRAM móvil a 32 MB y 12 entradas máximas con política de desalojo LRU para estabilidad garantizada en teléfonos con memoria reducida.
- [x] **Persistencia Masiva y Resguardo Total de la Foto de Calco (Ángulo, Escala y Posición):**
  - Creación de tabla relacional `project_tracings` en SQLite Wasm con clave foránea hacia proyectos.
  - Persistencia del modelo `SerializedTracingData` incluyendo el ángulo de rotación exacto (`rotation`), escala, posición (`x, y`), opacidad, visibilidad y filtro Wasm aplicado.
  - Sincronización continua en `useProjectPersistence.ts` y centinela de emergencia: si la app se minimiza, se cierra o el navegador se interrumpe, la foto se restaura en el ángulo milimétrico exacto para continuar calcando inmediatamente.
- [x] **Timeout Defensivo en Inicialización WebGPU:**
  - Carrera con timeout de 1200ms en `navigator.gpu.requestAdapter()` y `requestDevice()` para prevenir congelamientos del proceso GPU en SoCs móviles con drivers Vulkan incompletos.
- [x] **68 Pruebas Unitarias Deterministas:**
  - 61 tests de motor gráfico, transformaciones, Wasm y texturas + 7 tests de persistencia SQLite Wasm OPFS, deduplicación VRAM y restauración de calco ante crash.

---

## 🎨 Fase 4.16: Ajustes de la App, Personalización de Temas & Planes Futuros (Completada ✅)

- [x] **Apartado "Ajustes de la App e Información" (`SettingsInfoScreen.tsx`):**
  - Pantalla dedicada accesible desde el menú Pro `[⋯]` de la barra superior y desde la galería de proyectos.
  - Bloque de personalización visual con indicador del tema activo y acceso directo a la sub-pantalla de temas.
  - Bloque de acceso directo a la pantalla "Planes para la app" (Hoja de ruta).
  - Bloque de preferencias táctiles (Micro-vibración háptica, WakeLock de pantalla siempre encendida y SQLite Wasm OPFS).
  - Enlace al diagnóstico de bajo nivel del motor gráfico y especificaciones de la versión (v1.0.0 estable).
- [x] **Sub-Pantalla Dedicada "Personalizar Color y Tema" (`ThemeCustomizationScreen.tsx`):**
  - Pantalla independiente para evitar amontonar interfaces en una sola pantalla.
  - Catálogo de 6 temas con acentos cromáticos y preview en tiempo real:
    1. `Ámbar Estudio (Por Defecto)`: Dorado cálido `#f59e0b`.
    2. `Amatista Creativo`: Púrpura conceptual `#a855f7`.
    3. `Esmeralda Manga`: Verde ilustrador `#10b981`.
    4. `Zafiro Digital`: Azul noche `#3b82f6`.
    5. `Carmesí Dinámico`: Rojo rubí intenso `#ef4444`.
    6. `Cian Neón Cyber`: Cian brillante `#06b6d4`.
  - Inyección de variables CSS en tiempo real y persistencia local (`localStorage`).
- [x] **Apartado "Planes para la App" (`AppRoadmapScreen.tsx`):**
  - Pantalla detallada e ilustrada con la hoja de ruta oficial y prioridades técnicas.
  - **Superpoderes en Camino para la Herramienta de Vectores:**
    1. *Mover y Transformar Trazos Individuales:* Tocar cualquier trazo vectorial ya dibujado para moverlo libremente con el dedo, rotarlo o escalarlo sin alterar los trazos vecinos.
    2. *Edición de Nodos y Tiradores Bézier:* Control interactivo de puntos Catmull-Rom/Bézier C1 en C++23 para corregir líneas y afinar curvaturas milimétricas.
    3. *Cambio de Color y Grosor No Destructivo:* Modificar el color y el grosor de trazos vectoriales tiempo después de haberlos dibujado.
    4. *Lazo de Selección Vectorial:* Seleccionar conjuntos de trazos para mover facciones (ojos, cejas, pelo, ropa) en bloque.
    5. *Reasignación de Trazos por Capas:* Trasladar trazos específicos a una nueva capa sin tener que redibujar.
- [x] **73 Pruebas Unitarias Deterministas:**
  - 66 tests de motor gráfico, C++23 vectores, Wasm, historial, texturas, corrutinas, exportación rápida, personalización de temas y detección de Tauri + 7 tests de almacenamiento SQLite Wasm OPFS y Crash Recovery.

---

## 📱 Fase 4.17: Empaquetado Nativo Android con Tauri v2 & Pipeline de APK Debug en GitHub Actions (Completada ✅)

- [x] **Contenedor Nativo Tauri v2 Mobile (`src-tauri/`):**
  - Manifiesto de Rust (`Cargo.toml`) y configuración (`tauri.conf.json`) con paquete Android `com.inkflow.studio`.
  - Empaquetado ligero que corre sobre el **Android System WebView** nativo del sistema operativo (sin incrustar copias pesadas de Chromium como Electron).
  - Integración nativa de los mismos binarios WebAssembly de **C++23**, **Rust** y **SQLite Wasm sobre OPFS** con 100% de paridad funcional.
- [x] **Detección Automática de Entorno (`detectIsTauri()`):**
  - Detección transparente en `src/engine/environmentDetector.ts` (`__TAURI_INTERNALS__`).
  - Desactivación inteligente del Service Worker dentro del APK: al estar los archivos ya instalados físicamente en la memoria interna del teléfono, no se requiere intercepción de caché de navegador.
- [x] **Pipeline de Compilación de APK Debug en GitHub Actions (`.github/workflows/build-tauri-apk.yml`):**
  - **Activación Exclusivamente Manual:** Sin triggers automáticos por push o PRs. Solo se ejecuta al pulsar manualmente "Run workflow" desde el móvil.
  - **Optimizaciones Nativas en AndroidManifest (`src-tauri/AndroidManifest.xml`):**
    - `android:largeHeap="true"`: Memoria RAM expandida a 512MB–1GB para evitar crasheos por OOM en lienzos 2K/4K multi-capa.
    - `android:hardwareAccelerated="true"`: Aceleración GPU pura en el renderizado móvil.
    - `android:configChanges="orientation|screenSize|screenLayout|keyboardHidden"`: Inmunidad ante rotación del teléfono, sin destruir el lienzo ni reiniciar la Activity.
    - `android:windowSoftInputMode="adjustResize|stateHidden"`: Teclado virtual no invasivo.
    - **Scoped Storage Seguro:** Guardado en `Pictures/InkFlow Studio` sin permisos peligrosos, compatible con Android 13+ (`READ_MEDIA_IMAGES`), Android 10–12 (`READ_EXTERNAL_STORAGE` acotado) y Android 9 hacia atrás (`WRITE_EXTERNAL_STORAGE` con `requestLegacyExternalStorage="true"`).
  - **Generación automática de Keystore:** Crea y firma el APK con llave Android Debug Keystore de forma autónoma en el runner.
  - **Caché opcional configurable:** Interruptor manual `enable_cache` (Rust Cargo, Gradle, npm) para acelerar compilaciones sucesivas o realizar builds limpios desde cero.
  - **Soporte de Arquitecturas de 32 y 64 bits:** Opciones para `universal` (arm64-v8a + armeabi-v7a), `arm64` o `armv7`.
  - **Subida de Artefacto y Resumen Ejecutivo:** Publica el archivo `.apk` directamente en la sección Artifacts de GitHub Actions para descarga directa e instalación en el teléfono móvil o distribución en **Uptodown**.

---

## 🏛️ Fase 4.18: Persistencia Nativa en Android con Jetpack Room & Almacenamiento Físico Anti-Crash (Completada ✅)

- [x] **Arquitectura de Base de Datos Nativa con Android Jetpack Room (`src/kotlin-core/database/`):**
  - Implementación de `AppDatabase.kt` con motor SQLite nativo en disco local (`/data/user/0/com.inkflow.studio/databases/inkflow_studio_room.db`).
  - Entidades relacionales fuertemente tipadas:
    - `ProjectEntity`: Metadatos, dimensiones, timestamps y miniatura.
    - `LayerEntity`: Capas con modos de fusión, opacidad y orden z.
    - `TracingEntity`: Referencia de calco/accesorio con persistencia física de ruta en disco, ángulo de rotación continuo, escala, opacidad y filtro.
    - `CrashRecoveryEntity`: Registro permanente inviolable de sesión ante cierre inesperado o muerte del proceso por el sistema.
- [x] **Almacenamiento Físico en Disco para Fotos de Calco y Stickers (`RoomStorageManager.kt`):**
  - Resuelve el problema de pérdida de fotos en el APK: escribe los bytes de las referencias de calco directamente en `context.filesDir/tracings/tracing_{projectId}.png`.
  - Inmune al reciclaje de memoria RAM de WebView o a la inexistencia de OPFS en Android WebView.
  - Al reabrir la app o recuperar un crash, la foto se restaura con su escala y ángulo de rotación exacto.
- [x] **Puente Nativo `@JavascriptInterface` con Invocación Síncrona Inviolable:**
  - Métodos inyectados en `InkFlowJavascriptInterface` (`saveTracingToRoom`, `loadTracingFromRoom`, `saveEmergencyCrashToRoom`, `checkCrashRecoveryFromRoom`, `clearCrashRecoveryFromRoom`).
  - Al ser llamadas síncronas a nivel de Activity nativa, se ejecutan de inmediato en eventos de ciclo de vida (`visibilitychange`, `pagehide`, `error`) antes de que el kernel de Android pueda enviar SIGKILL al proceso.
- [x] **Inyección Automatizada en Gradle (`configure-android-native.cjs`):**
  - Copia automática de las entidades, DAOs y `RoomStorageManager` a `src-tauri/gen/android/app/src/main/java/com/inkflow/studio/database/`.
  - Inyección de dependencias `androidx.room:room-runtime:2.6.1`, `androidx.room:room-ktx:2.6.1` y `androidx.sqlite:sqlite-bundled:2.4.0`.
- [x] **78 Pruebas Unitarias Deterministas:**
  - 69 tests de motor gráfico, C++23 vectores, Wasm, historial, texturas, calco, flood fill, Sobel, Kotlin/PWA y corrutinas + 9 tests de almacenamiento relacional (SQLite Wasm OPFS y Android Jetpack Room).

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
  - Empaquetado modular con guía de integración para desarrolladores de apps de dibujo, notas con stylus, plataformas de IA inpainting y pizarras interactivas.
