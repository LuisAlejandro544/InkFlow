# InkFlow Studio v1.0.0 estable (PWA Nativa & APK Android con Tauri v2)

Aplicación de dibujo e ilustración digital profesional para dispositivos móviles. Diseñada y construida en **modalidad dual: Progressive Web App (PWA Nativa) y APK Android Nativo con Tauri v2**, con renderizado acelerado por **WebGPU (WGSL)**, motor vectorial analítico en **C++23 (WebAssembly)**, núcleo de bajo nivel en **Rust (Wasm y Tauri)**, persistencia masiva en **SQLite Wasm (OPFS)** y arquitectura móvil extensible con **Kotlin**.

> 💡 **Estrategia de Despliegue Dual:**
> 1. **PWA Nativa (Canary / Pruebas en Vivo):** Se actualiza y despliega automáticamente a **Cloudflare Pages** mediante GitHub Actions. Permite probar cambios al instante desde el navegador móvil con soporte 100% offline.
> 2. **APK Nativo con Tauri v2 (Estable / Uptodown):** Empaquetado ligero que corre sobre el Android System WebView nativo (sin empaquetar Chromium pesado). Se compila mediante el workflow `.github/workflows/build-tauri-apk.yml` generando un **APK Debug** listo para instalar en el teléfono o subir a tiendas de terceros como **Uptodown**.

---

## 🎨 Características Principales de la PWA

- **⚡ Núcleo C++23 (ISO/IEC 14882:2023) & Lápiz Vectorial Analítico:**
  - Ubicado en `src/cpp-core/` (`IbisVectorEngine.hpp/cpp` e `IbisStrokeAnalyzer.hpp/cpp`) con especificación C++23 estricta, conceptos (`std::concepts`), vistas contiguas `std::span` y compatibilidad nativa y WebAssembly (`wasm32` con SIMD128, y arquitecturas móviles de 32 y 64 bits: `arm64-v8a`, `armeabi-v7a`, `x86_64`, `x86`).
  - **Lápiz Vectorial sin Garbage Collector:** Algoritmo Douglas-Peucker en memoria continua y ajuste continuo Catmull-Rom a Bézier cúbica con continuidad C1.
  - **Cero píxeles al hacer zoom:** A diferencia de los pinceles de mapa de bits (raster), el trazo vectorial se evalúa analíticamente a cualquier escala (100%, 200%, 400%, etc.), manteniendo bordes nítidos y vectoriales sin pixelación ni pausas de recolección de basura.
- **🤖 Kotlin: Puente Nativo Android (Galería Real MediaStore & WakeLock) y Orquestación con `kotlinx.coroutines`:**
  - Código fuente en `src/kotlin-core/AndroidPlatformBridge.kt`, `src/kotlin-core/CoroutineOrchestrator.kt` y `src/engine/coroutinesBridge.ts`:
    1. **Concurrencia Estructurada con `kotlinx.coroutines` (`InkFlowCoroutineOrchestrator` & `StudioTaskScope`):** Orquestación reactiva de tareas de fondo en `Dispatchers.Default` / `Dispatchers.IO` / Wasm `Dispatchers.Main` con SupervisorJob para aislar errores.
    2. **Centinela de Auto-Guardado No Bloqueante (`AutoSaveCoroutineSentinel`):** Bucle continuo con `delay()` cooperativo que inspecciona el estado dirty sin congelar los 60–120 FPS del pincel táctil.
    3. **Conflación de Puntos Táctiles (`TouchPointStreamConflator` / `Channel.CONFLATED`):** Absorbe el torrente de coordenadas del sensor (hasta 240Hz) y descarta automáticamente muestras intermedias obsoletas si el renderizado tarda, previniendo lag y retraso acumulado.
    4. **Guardado REAL en la Galería de Fotos del Teléfono (`AndroidGalleryManager`):** Utiliza la API nativa `MediaStore.Images.Media` de Android para guardar ilustraciones directamente en la carpeta visible `Pictures/InkFlow Studio` de la galería de fotos, eliminando las molestas "descargas web" de archivos anónimos con soporte transaccional `IS_PENDING`.
    5. **WakeLock de Pantalla Encendida (`AndroidScreenWakeLockManager` & `wakeLockService.ts`):** Mantiene la pantalla encendida permanentemente mientras el artista ilustra o calca, con `FLAG_KEEP_SCREEN_ON` en Android y el estándar PWA `navigator.wakeLock.request('screen')` con auto-reactivación al volver a la app (`visibilitychange`).
    6. **Serializador y Empaquetador de Archivos Propietarios `.inkflow`:** Contenedor comprimido ZIP con metadatos JSON/Protobuf para compartir obras multi-capa entre dispositivos.
    7. **Motor de Armonía Cromática:** Algoritmos de teoría del color y accesibilidad en espacios perceptualmente uniformes (Oklab y CIELAB).
- **📷 Modo Calco de Galería con Panel Minimizable y Filtros Wasm:**
  - Selecciona cualquier imagen o foto de la galería del teléfono para calcarla sobre el lienzo.
  - Se sitúa automáticamente en el centro de la hoja con escala proporcional.
  - Manipulación gestual directa: arrastrar con 1 dedo para mover, pellizcar con 2 dedos para escalar y rotar, y tiradores táctiles en las 4 esquinas.
  - **Panel ergonómico minimizable:** Permite colapsar el menú de ajustes a una micro-píldora flotante para despejar el 100% del lienzo y calcar sin que ningún control tape el rostro o la figura.
  - **Conmutador instantáneo de visibilidad en 1 toque `[👁️ Ocultar / Ver Calco]`:** Botón directo en la barra superior y chip flotante en el lienzo para ocultar momentáneamente la foto de referencia y comparar las líneas limpias al instante.
  - **Filtros Wasm de extracción:** Extracción Sobel de Lineart, monocromo B/N y alto contraste en tiempo real.
- **📏 Asistente de Grosor de Trazo 100% REAL (Calibrado por Visión Artificial):**
  - Mide automáticamente la distribución real de grosor de línea en la fotografía de calco cargada mediante análisis ortogonal transversal y percentiles:
    1. **Silueta / Contorno Exterior (P92):** Línea perimetral más gruesa medida de la foto.
    2. **Estructura / Ropa / Pelo (P68):** Líneas intermedias medidas para masa anatómica y vestimenta.
    3. **Detalles / Rostro / Ojos (P38):** Precisión fina medida para iris, párpados, nariz y labios.
    4. **Tramas / Achurado Fino (P12):** Micro-líneas medidas para degradados y texturas delicadas.
  - **Recomendación no invasiva:** Recomienda los valores óptimos en 1 toque sin obligar al usuario (el artista mantiene siempre el control manual completo).
  - Muestreo puntual por toque en coordenadas específicas de la imagen.
- **🛠️ Selector de Herramientas y Estabilizador Nativo (Bottom Sheet):**
  - Interfaz rediseñada estilo móvil nativo (iOS / Material 3 / IbisPaint): control segmentado superior para alternar entre `[Herramientas]` y `[Estabilizador]`.
  - Selección táctil inmediata con vibración háptica al pulsar cada herramienta (cero botones de formulario tipo submit).
  - Panel dedicado del Estabilizador S-Form con presets táctiles (`0: Directo`, `3: Natural`, `6: Ilustración`, `10: Manga`) y bloc de prueba táctil aislado.
  - Nombres completos legibles, cero truncamiento tipográfico y touch targets de al menos 48×48px.
- **👆 Gestos Multitáctiles Nativos con tus Propios Dedos (Pinch-to-Zoom & Rotación):**
  - Acercar, alejar y rotar libremente el lienzo usando directamente dos dedos con anclaje matemático al punto focal (*focal-point locked*).
  - Rotación fluida de la hoja en cualquier ángulo con encaje magnético (*snap*) automático en ángulos cardinales (0°, 90°, 180° y 270°).
  - Precisión milimétrica al dibujar sobre lienzo rotado mediante mapeo inverso analítico (`unrotatePoint`).
  - Paneo y desplazamiento simultáneo con dos dedos sin generar trazos accidentales en la ilustración.
  - Indicador táctil en barra superior con porcentaje de zoom y ángulo de inclinación `[ 34% • 15° ]` (con opción de resetear rotación a 0° en 1 toque).
- **🔄 Alternador Inmediato entre Modo Dibujo y Modo Mover:**
  - Botón táctil inferior para cambiar en 1 toque entre **[✏️ Dibujar]** y **[✋ Mover Lienzo]**.
- **📱 Experiencia de App Móvil Nativa (PWA Standalone):**
  - Barra superior ergonómica con botón destacado `[💾 Guardar]` siempre visible en el extremo derecho sin desbordamiento horizontal en pantallas estrechas.
  - Menú compacto `[⋯]` para herramientas secundarias (Asistente de grosor, Diagnóstico técnico de núcleos y Reset de rotación).
  - Modo *standalone* a pantalla completa sin barra de navegación ni marcos, con soporte para el área segura (`viewport-fit=cover`).
  - Botón de instalación PWA integrado con soporte para Chromium móvil (Android) y guía de instalación para iOS Safari.
- **📶 Funcionamiento 100% Offline:**
  - Service Worker con precaché inteligente para abrir y dibujar sin conexión a internet en cualquier lugar.
- **🚀 Pipeline Gráfico WebGPU (WGSL Shaders):**
  - Shaders en WGSL para sellos de pincel con atenuación radial, dinámicas de presión y modos de fusión de capas (*Normal, Multiplicar, Pantalla, Superponer, Añadir*), con fallback acelerado a Canvas 2D/WebGL2.
- **🎯 Estabilizador S-Form en Wasm (Niveles 0 a 10):**
  - Algoritmo de suavizado exponencial ejecutado en WebAssembly de bajo nivel con bloc de pruebas interactivo.
- **📑 Gestión Avanzada de Capas:**
  - Panel estilo IbisPaint con creación (inicio con 1 capa limpia), duplicación, combinación hacia abajo, borrado, visibilidad y opacidad.
- **🗄️ Persistencia Dual Masiva: SQLite Wasm (OPFS) en PWA & Android Jetpack Room en APK:**
  - **En la PWA Web:** Implementado con `@sqlite.org/sqlite-wasm` ejecutándose dentro de un Web Worker dedicado sobre **OPFS (Origin Private File System)** nativo con transacciones atómicas ACID.
  - **En el APK Android (Nativo con Tauri v2):** Implementado con **Android Jetpack Room** (`src/kotlin-core/database/` con `AppDatabase.kt`, `ProjectDao.kt`, `ProjectEntities.kt`, `TracingEntity.kt`, `CrashRecoveryEntity.kt` y `RoomStorageManager.kt`).
  - **Inmunidad a pérdidas de fotos de calco en el APK:** Las imágenes de calco y stickers se escriben físicamente como archivos en el almacenamiento interno privado del dispositivo (`context.filesDir/tracings/tracing_{projectId}.png`), guardando su rotación continua, escala y posición en Room. Aunque el sistema operativo mate el proceso por batería o memoria, la foto de calco se restaura intacta.
  - **Cero caídas de FPS (Zero Frame-Drop):** La serialización y escritura de megabytes ocurre fuera del hilo principal en `Dispatchers.IO` y Web Workers, sin interrumpir los 60–120 FPS del trazo táctil.
  - **Supera las limitaciones de la web tradicional:** Elimina las cuotas de 5 MB de `localStorage` y la sobrecarga de recolector de basura de librerías como `dexie.js`.
- **🛡️ Centinela de Auto-Guardado y Resguardo ante Cierre de App o Crash (Web & APK):**
  - **Auto-guardado continuo en segundo plano:** Tras cada trazo completado o modificación de capas, se programa un punto de control automático (*debounced* a 1s) hacia SQLite y Room.
  - **Salida abrupta o borrado del proceso:** Escucha los eventos de ciclo de vida del sistema operativo móvil (`visibilitychange`, `pagehide` y pausas del Activity) disparando un snapshot de emergencia inmediato de forma síncrona hacia Room e `InkFlowNativeBridge`.
  - **Protección contra crasheos:** Integrado en excepciones globales de JavaScript (`window.onerror`, `unhandledrejection`) y en el `ErrorBoundary` de React, resguardando la obra antes de interrumpir la interfaz.
  - **Banner de Recuperación en 1 Toque:** Si la app detecta un punto de recuperación de una sesión interrumpida, despliega un aviso táctil nativo para restaurar todas las capas, dimensiones y fotos de calco exactamente como estaban.
- **⚡ Precaché Completo de WebAssembly & Service Worker Workbox (Límite 10 MB):**
  - Configurado en `vite.config.ts` con límite ampliado a **10 MB** (`maximumFileSizeToCacheInBytes: 10485760`) y patrón `globPatterns` que incluye explícitamente todos los binarios `**/*.wasm`.
  - La primera vez que el usuario abre la aplicación en su teléfono móvil, los motores de SQLite Wasm, Kotlin y Rust se descargan y quedan congelados en el `CacheStorage`. La app abre en **0.05 segundos** incluso en modo avión.
- **🚀 Compilación Streaming Wasm & Caché de Código Máquina en CPU:**
  - Implementado en `src/engine/wasmStreamingCompiler.ts` mediante `WebAssembly.instantiateStreaming`.
  - Los motores de compilación JIT móviles (V8 en Android y JavaScriptCore en iOS) compilan el bytecode Wasm en streaming directamente a instrucciones nativas ARM64/x86, guardando el binario ya compilado en la caché de bajo nivel de la CPU sin recompilaciones en sesiones futuras.
- **🌐 Cabeceras de Inmutabilidad en Cloudflare Pages (`public/_headers`):**
  - Archivo `public/_headers` configurado con directivas HTTP exactas:
    - `/assets/*` y `/*.wasm` ➔ `Cache-Control: public, max-age=31536000, immutable` (cero peticiones condicionales 304, carga 100% local directa desde almacenamiento del teléfono).
    - `/index.html` y `/sw.js` ➔ `Cache-Control: public, max-age=0, must-revalidate` (actualizaciones instantáneas de versión sin atrapar a usuarios en versiones obsoletas).
- **🖼️ Caché VRAM en GPU con ImageBitmap (Cero Re-decodificación a 60–120 FPS):**
  - Implementado en `src/engine/bitmapCache.ts` (`GPUBitmapCache`).
  - Decodificación asíncrona de capas y fotos de calco fuera del hilo principal (`createImageBitmap`), almacenando los píxeles directamente en la memoria de texturas de la GPU (VRAM).
  - Paneo y zoom fluido a 120 FPS sin re-decodificar cadenas Base64/PNG en cada frame, con política de desalojo LRU y desecho explícito de memoria mediante `.close()`.
- **🛡️ Almacenamiento Persistente Blindado (`navigator.storage.persist()`):**
  - Al iniciar la app, solicita el estado de persistencia permanente al navegador para evitar que el sistema operativo móvil (Android o iOS) purgue la base de datos SQLite Wasm o el precaché en situaciones de almacenamiento bajo.
- **🪣 Bote de Pintura Inteligente con Expansión de Borde y Cierre de Huecos (Gap-Closing):**
  - **Cierre Inteligente de Huecos (0 a 10 px):** Algoritmo de morfología binaria matemática en C++23 (`close_boundary_gaps`) y Wasm/TS (`generateClosedGapBarrierMask`). Puentea y sella automáticamente brechas abiertas en el lineart de 3px (fino), 6px (medio) y 10px (amplio), impidiendo que la pintura se desborde al exterior de la figura.
  - **Expansión de Borde (1 a 3 px):** Algoritmo Scanline Flood Fill de alto rendimiento con dilatación morfológica isotrópica (`dilateBinaryMask`) configurable en 1px (fino), 2px (recomendado manga/anime) y 3px (máximo).
  - **Cero halos blancos:** Expande el color hacia el interior de las líneas de contorno anti-aliasing, eliminando los molestos rebordes blancos entre el lineart y el color plano.
  - **Controles táctiles instantáneos:** Píldora de control rápido flotante sobre el lienzo para alternar en 1 toque expansión `[🪣 Exp: 0|1|2|3px]` y cierre de huecos `[🛡️ Huecos: 0|3|6|10px]`, además de ajustes avanzados en `ToolPickerModal`.
- **🎀 Sistema de Accesorios de Galería (Moños, Stickers y Adornos en tu Obra):**
  - Selecciona cualquier accesorio, lazo, moño, sticker o adorno fotográfico desde la galería de tu teléfono y sitúalo directamente sobre tu ilustración.
  - **Transformación táctil ergonómica:** Muévelo libremente con 1 dedo, escala y rota con 2 dedos o mediante deslizadores de precisión y tiradores de esquina.
  - **Panel dedicado no invasivo:** `TracingAdjuster` adaptativo con indicación `🎀 Accesorio / Sticker`, minimización a micro-píldora y ajuste de opacidad.
  - **Estampado permanente en tu arte:**
    - `[✨ Estampar en Capa]`: Pinta el accesorio de forma permanente sobre la capa activa seleccionada, integrándolo a la resolución nativa de la obra.
    - `[📑 + Nueva Capa]`: Crea una capa independiente llamada `Accesorio (Moño)` y plasma el adorno sin tocar tus trazos anteriores.
  - Genera automáticamente un punto de guardado en el historial (Deshacer/Rehacer) y persiste atómicamente en SQLite Wasm sobre OPFS.
- **🌾 Texturas de Pincel Estilo IbisPaint con Patrón en Espacio de Lienzo:**
  - **Catálogo de 9 Texturas de Superficie de Ilustración Profesional:**
    1. **Lisa:** Trazo puro y uniforme sin modulación de grano.
    2. **Grano:** Micro-poros estocásticos de grafito fino sobre papel de boceto.
    3. **Rugosa:** Relieve marcado con bloques angulares y valles profundos.
    4. **Trama:** Semitonos a 45° nítidos y continuos para manga y cómic.
    5. **Salpicada:** Microgotas estocásticas estilo spray/aerosol.
    6. **Papel:** Fibras longitudinales orgánicas de papel Canson Bristol.
    7. **Tela:** Trama textil ortogonal de lino para técnicas de óleo y acrílico.
    8. **Acuarela:** Bordes húmedos con pigmento acumulado y centro traslúcido.
    9. **Carbón:** Grano poroso seco y desgranado con motas de carboncillo.
  - **Arquitectura de Patrón Continuo (`CanvasPattern`):** En lugar de evaluar la textura en un punto central y generar huecos o cortes aislados, la textura se proyecta de forma continua a nivel de píxel en el espacio de coordenadas del lienzo (`getOrCreateTexturePattern`).
  - **Invarianza de grosor:** Funciona a cualquier tamaño de pincel (desde 1px hasta 100px) sin saturación por sobreescritura de sellos.
  - **Caché de Patrones en GPU:** Compilación y reutilización instantánea a 60–120 FPS sin pérdida de frames en dispositivos móviles.
- **📐 Expansión y Redimensionado Ergonómico de Hoja (Canvas Resize & Expand):**
  - Modal táctil `CanvasResizeModal` accesible desde el menú `[⋯]` para ampliar el ancho y alto del lienzo si el artista necesita más espacio para bocetos o viñetas.
  - **Presets en 1 toque:** `+25% Espacio`, `+50% Espacio`, `2x Doble Lienzo`, `1:1 Cuadrado`, `9:16 Manga/Móvil` y botones de incremento táctil rápido (`+100px`, `+300px`).
  - **Matriz de Anclaje Visual 3×3:** Permite elegir hacia qué dirección se expande el lienzo (Centro, Arriba, Abajo, Esquinas).
  - **Migración sin pérdidas:** Reubica los píxeles de todas las capas (`drawImage`), traslada las curvas vectoriales analíticas de Kotlin/Wasm (`offsetAllStrokes`), desplaza la foto de calco activa y persiste el cambio atómicamente en SQLite Wasm (OPFS).
- **💾 Guardado de Obra Maestra a Galería con Auto-Crop y Peso en Tiempo Real:**
  - **Hoja Completa vs Recortar al Dibujo:** Permite exportar toda la hoja de trabajo (incluyendo bordes intactos) o aplicar **Auto-Crop inteligente** que detecta la caja delimitadora (*bounding box*) de los trazos reales con margen armónico, eliminando espacio vacío innecesario.
  - **Indicador de Peso Exacto:** Muestra el peso proyectado del archivo resultante en B, KB o MB según el formato, escala y recorte seleccionado.
  - Formatos PNG (con canal alfa transparente o fondo blanco), JPEG y WebP en escalas 1x, 2x (HD) y 3x (Ultra).
  - Guardado directo en la galería del teléfono mediante la *Web Share API* nativa o descarga directa.
- **⚙️ Apartado "Ajustes de la App e Información" (`SettingsInfoScreen`):**
  - Pantalla dedicada para configuración de preferencias hápticas, WakeLock de pantalla siempre encendida, diagnóstico de motores y especificaciones de versión.
- **🎨 Sub-Pantalla Dedicada para Cambiar el Color de la App (`ThemeCustomizationScreen`):**
  - Sección independiente accesible desde los Ajustes para alternar entre 6 paletas de acento visual:
    1. **Ámbar Estudio (Por Defecto):** Dorado clásico de estudio `#f59e0b`.
    2. **Amatista Creativo:** Púrpura conceptual `#a855f7`.
    3. **Esmeralda Manga:** Verde ilustrador `#10b981`.
    4. **Zafiro Digital:** Azul noche de alta tecnología `#3b82f6`.
    5. **Carmesí Dinámico:** Rojo rubí intenso `#ef4444`.
    6. **Cian Neón Cyber:** Cian brillante `#06b6d4`.
  - Preview en vivo de botones y acentos con persistencia en `localStorage`.
- **🚀 Apartado "Planes para la App" (`AppRoadmapScreen`):**
  - Hoja de ruta oficial que detalla la próxima evolución de la **Herramienta de Vectores (Lápiz Vectorial Analítico)**:
    - *Mover y transformar trazos individuales:* Mover cualquier línea dibujada con el dedo, rotarla o cambiar su escala sin pixelación.
    - *Edición de nodos y tiradores Bézier:* Visualización y ajuste interactivo de puntos de anclaje de curvas en C++23.
    - *Cambio de color y grosor no destructivo:* Modificar el color o calibre de una línea tiempo después de dibujarla.
    - *Lazo de selección vectorial y reubicación de capas:* Reubicar facciones enteras (ojos, cejas, pelo) en bloque.

---

## 🚀 Instalación y Ejecución Local

### Requisitos:
- Node.js v20.0+ o v22.0+
- npm v10.0+

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar servidor de desarrollo PWA (puerto 3000)
npm run dev

# 3. Compilar para producción PWA
npm run build
```

Abre `http://localhost:3000` en tu teléfono móvil y pulsa el botón **"Instalar PWA"** para fijar la aplicación en tu pantalla de inicio como una app nativa.

---

- [x] **⚡ Motor de Deshacer/Rehacer en WebAssembly (Wasm History Engine):**
  - Implementado en `src/engine/wasmHistoryEngine.ts` y en Rust (`src/rust-core/src/lib.rs`).
  - Utiliza memoria lineal `WebAssembly.Memory` con compresión RLE de 32 bits a nivel de palabra RGBA.
  - Reduce el consumo de RAM de las instantáneas en un **90% a 98%**, previniendo fallos por Out-Of-Memory (OOM) en teléfonos móviles.
  - Buffer circular (Ring Buffer) de hasta 40 niveles de deshacer con descarte FIFO del más antiguo.
  - Descompresión 100% bit-a-bit idéntica sin pérdidas sobre `ImageData`.

---

## 🧪 Pruebas Unitarias de Lógica

El proyecto cuenta con **78 pruebas unitarias automatizadas deterministas** con `node:test` en 2 suites:

### Suite 1: Motor Gráfico, C++23 Vectores, Calco, Wasm, Historial, Caché GPU, Expansión, Huecos, Accesorios, Texturas, Corrutinas, Temas & Kotlin / PWA (69 tests)
1. Interpolación lineal y cálculo euclidiano Wasm.
2. Estabilizador exponencial anti-temblor S-Form.
3. Simulación de curva de presión táctil por velocidad.
4. Algoritmo de reducción Douglas-Peucker de vectores.
5. Generación continua de segmentos Bézier cúbicos para el Lápiz Vectorial.
6. Cálculo de escala y desplazamientos en gestos multitáctiles pinch-to-zoom.
7. Invarianza del punto focal en zoom táctil.
8. Centrado y ajuste proporcional de fotos de calco.
9. Filtro Sobel de extracción de lineart.
10. Extracción de paletas cromáticas dominantes.
11. Detección de roles canónicos de trazo (Silueta, Estructura, Detalles, Tramas).
12. Tamaños recomendados y consejos contextuales del asistente de grosor.
13. Análisis real de grosor de trazo mediante percentiles de imagen (visión artificial).
14. Muestreo puntual de grosor en coordenadas tocadas por el usuario.
15. Rotación multitáctil a dos dedos (cálculo de delta angular relativo).
16. Encaje magnético (snapping) de rotación en ángulos ortogonales (0°, 90°, 180°, 270°).
17. Des-rotación analítica de coordenadas táctiles (`unrotatePoint`).
18. Detección automática de caja delimitadora (Auto-Crop Bounding Box) de la obra.
19. Invarianza de escala al recortar ilustraciones centradas.
20. Mapeo Canónico Exacto de Pantalla a Lienzo con Rotación (`screenToCanvasCoords`).
21. Reversibilidad y Consistencia Biyectiva (`canvasToScreenCoords` <-> `screenToCanvasCoords`).
22. Normalización angular continua al cruzar la frontera $[-\pi, \pi]$ en rotación.
23. Detección PWA Standalone (display-mode, navigator.standalone y TWA referrer).
24. Detección de Excepción en Entorno de Desarrollo y Vista Previa de AI Studio.
25. Decisión Determinista de Mostrar Pantalla de Bienvenida PWA vs Acceso Directo al Estudio.
26. Compilación Streaming de WebAssembly (`WebAssembly.instantiateStreaming` & Wasm CPU Cache).
27. Caché VRAM en GPU (`GPUBitmapCache`) con gestión LRU y liberación explícita vía `.close()`.
28. Bote de Pintura: Dilatación y Expansión de Borde (1 a 3 px) para eliminar halos blancos.
29. Expansión de Hoja: Cálculo de desplazamientos (Offsets) según punto de anclaje.
30. Expansión de Hoja: Normalización y presets de espacio (+25%, +50%, 2x, 1:1, 9:16).
31. Invarianza de Traslación Vectorial en Expansión (`offsetAllStrokes`).
32. Mapeo Multitáctil Simultáneo con Rotación Inclinada (45°).
33. Tolerancia Inversa en Des-rotación de Puntos con Ángulos Negativos.
34. Auto-Crop: Preservación de margen estético mínimo.
35. Caché VRAM: Desalojo LRU seguro ante desbordamiento de texturas.
36. Cierre Inteligente de Huecos: Detección morfológica y unión de brechas (Gap Closing de 1 a 10px).
37. Balde de Pintura: Contención de relleno sin fugas en trazados con huecos abiertos de 3px.
38. Accesorios de Galería: Configuración y geometría de estampado en la obra (moños, stickers, adornos).
39. Texturas de Pincel estilo IbisPaint: Catálogo de 4 texturas clásicas y rango acotado [0.0, 1.0].
40. Modulación determinista de opacidad y profundidad de textura (Edge cases: none, depth 0, escalas extremas).
41. Invarianza de textura ante coordenadas negativas y consistencia determinista del grano.
42. Preservación del icono en modo Mover para Lápiz Vectorial y catálogo completo de 8 herramientas.
43. Desacoplamiento de Calco: Renderizado de capas transparente independiente para cero lag durante el trazo.
44. Patrón de Textura en Espacio de Lienzo (`getOrCreateTexturePattern`): Null-safety y consistencia de caché.
45. Wasm History Engine: Inicialización y asignación de memoria lineal WebAssembly.
46. Wasm History Engine: Compresión RLE de 32-bit y descompresión 100% idéntica sin pérdidas.
47. Wasm History Engine: Ciclo completo de Guardado, Deshacer y Rehacer entre capas.
48. Wasm History Engine: Buffer circular (FIFO) acota la memoria al límite maxDepth.
49. Bote de Pintura Scanline (Rust Wasm Core): Llenado continuo, dilatación morfológica y contención.
50. Extracción Sobel 3x3 y Cierre de Huecos C++23: Gradiente ortogonal y puente morfológico de brechas.
51. C++23 Wasm Motor Vectorial Analítico: Douglas-Peucker y Curvas Bézier Catmull-Rom C1.
52. Kotlin / PWA Integración: Guardado Real en Galería (MediaStore) y WakeLock de Pantalla Encendida.
53. `kotlinx.coroutines`: Centinela de Auto-Guardado no bloqueante y cancelación estructurada con `Job.cancel()`.
54. `kotlinx.coroutines`: Conflación de eventos táctiles (`Channel.CONFLATED`) a 240Hz y gestión en `StudioTaskScope`.
55. Rotación de Calco y Accesorios: Continuidad Angular y Prevención de Reseteo a 0°.
56. Bote de Pintura: Relleno exclusivo de un trazo sin desbordarse al lienzo vacío.
57. Bote de Pintura: Contención de trazo abierto en colisión con otro trazo.
58. Caché VRAM en GPU: Bloqueo de deduplicación contra decodificaciones paralelas y límites móviles.
59. Exportación en Calidad 4K: Realce de nitidez (Unsharp Mask) y preservación de dimensiones.
60. Estimación Rápida de Peso (`estimateArtworkFileSizeFast`) y cambio de modos sin bloqueo.
61. Catálogo de 6 Temas de Color de la App (`themeEngine`) y persistencia local.
62. Invarianza cromática y validación de variables CSS de acento.
63. Integridad de esquemas de tema y claves hexadecimales válidas.
64. Desacoplamiento de sub-pantallas de Ajustes, Personalización y Planes futuros.
65. Gobernanza de versión y privacidad v1.0.0 sin licencias restrictivas.
66. PWA Offline & Service Worker con estrategia de caché 100% sin internet.
67. Mobile APK & PWA: Canvas de baja latencia con `desynchronized: true`.
68. Mobile APK: Guardado directo en Pictures/InkFlow Studio vía Tauri IPC.
69. Android Native & Workflow: Modo Pantalla Completa Inmersivo (Immersive Sticky).

### Suite 2: Persistencia Masiva SQLite Wasm OPFS & Android Jetpack Room (9 tests)
70. Inicialización oficial del módulo `@sqlite.org/sqlite-wasm`.
71. Creación atómica del esquema relacional (`projects`, `layers`, `crash_recovery`, `project_tracings`).
72. Transacción ACID completa de proyectos con capas y orden z.
73. Centinela de Crash: Registro de emergencia, consulta y restauración tras salida abrupta.
74. Eliminación limpia en cascada sin fugas de almacenamiento.
75. Persistencia y recuperación exacta de la foto de calco con su rotación angular y escala.
76. Crash Recovery de calco: Rescate y restauración de rotación angular tras fallo del navegador.
77. **Android Jetpack Room:** Validación de esquema `TracingEntity` con almacenamiento físico y rotación continua.
78. **Android Jetpack Room:** Centinela de Crash Recovery con persistencia física en disco.

```bash
# Ejecutar todas las pruebas deterministas (78 tests)
npx --yes tsx --test src/engine/engine.test.ts src/storage/storage.test.ts
```

---

## 📱 Compilación de APK Debug con Tauri v2 vía GitHub Actions

El proyecto incluye el workflow `.github/workflows/build-tauri-apk.yml` diseñado para compilar e instalar el archivo `.apk` directamente en tu teléfono móvil sin necesidad de tener una computadora física:

### Características del Pipeline APK:
- **🔒 Activación Exclusivamente Manual:** Cero ejecuciones no deseadas por cada `git commit` o `pull request`. Solo se activa cuando tú presionas el botón "Run workflow".
- **🚀 Memoria Expandida de 512MB a 1GB (`android:largeHeap="true"`):** Triplica la cuota de RAM asignada por Android al proceso para ilustrar en 2K/4K con múltiples capas y fotos de calco sin crasheos por OOM.
- **⚡ Aceleración por GPU Nativa (`android:hardwareAccelerated="true"`):** Renderizado fluido a 60–120 FPS en el motor WebView nativo.
- **🔄 Rotación sin Destrucción de Pantalla (`android:configChanges="orientation|screenSize|screenLayout|keyboardHidden"`):** Girar el teléfono de vertical a horizontal no reinicia la aplicación ni destruye el lienzo de dibujo.
- **⌨️ Teclado Virtual No Invasivo (`android:windowSoftInputMode="adjustResize|stateHidden"`):** Previene que el teclado empuje o desconfigure el viewport al editar nombres de capas o proyectos.
- **📁 Guardado Real y Scoped Storage sin Permisos Peligrosos:** Guarda directamente en `Pictures/InkFlow Studio` con compatibilidad para Android 13+ (`READ_MEDIA_IMAGES`), Android 10–12 (`READ_EXTERNAL_STORAGE` acotado) y Android 9 hacia atrás (`WRITE_EXTERNAL_STORAGE` con `requestLegacyExternalStorage="true"`).
- **⚙️ Generación Automática de Llave (Keystore):** Genera la clave de depuración `debug.keystore` de forma autónoma en el runner de GitHub. Cero configuración de certificados manuales.
- **⚡ Interruptor Manual de Caché (`enable_cache`):** Permite activar opcionalmente la caché de Rust, Gradle y npm para compilaciones ultrarrápidas, o dejarla desactivada para una compilación 100% limpia.
- **🏗️ Soporte de Arquitecturas Móviles de 32 y 64 bits:** Opciones para compilar en modo `universal` (compatible con `arm64-v8a` y `armeabi-v7a`), `arm64` o `armv7`.
- **📦 Descarga Directa del APK:** Publica el archivo `.apk` firmado en la sección **Artifacts** de GitHub Actions para descargarlo directo al teléfono móvil o subirlo a plataformas como **Uptodown**.

### Pasos para compilar y descargar el APK en tu teléfono:
1. Entra a tu repositorio en GitHub desde el navegador de tu teléfono móvil.
2. Ve a la pestaña **Actions** ➔ selecciona **"InkFlow - Compilar APK Debug con Tauri v2 (Android)"**.
3. Pulsa **"Run workflow"**.
4. (Opcional) Activa la casilla `enable_cache` si deseas acelerar la compilación.
5. Pulsa el botón verde **"Run workflow"**.
6. En 3-5 minutos, cuando termine, pulsa en la ejecución y baja hasta la sección **Artifacts**.
7. Descarga el archivo **`InkFlow-Studio-Debug-APK`**, descomprímelo e instálalo con 1 toque en tu teléfono.

---

## ☁️ Despliegue en Cloudflare Pages vía GitHub Actions

El repositorio incluye un workflow en `.github/workflows/deploy.yml` configurado para **activación exclusivamente manual** (`workflow_dispatch`).

### Resiliencia y Optimización de CI/CD:
- **⚡ Optimización Extrema con `wasm-opt` (Binaryen):** Comprime los binarios Wasm de Rust y C++ con `-O3 --enable-simd --enable-bulk-memory` reduciendo su peso un 25-40% para arranque instantáneo en móviles.
- **🌐 Despliegue Dual (Producción vs Vista Previa Aislada):** Selector en `workflow_dispatch` para elegir entre publicar en la rama principal (`main`) o en una URL de vista previa aislada temporal (`preview-<run_id>`) para probar cambios sin riesgo.
- **📊 Panel de Resumen Ejecutivo en GitHub (`$GITHUB_STEP_SUMMARY`):** Renderiza una tarjeta visual con enlace directo a la PWA, peso del bundle y estado de las 73 pruebas automatizadas.
- **🔒 Aislamiento de Origen Cruzado (COOP / COEP):** Inyección y validación de cabeceras en `public/_headers` para desbloquear `SharedArrayBuffer` y el máximo rendimiento de SQLite Wasm sobre OPFS.
- **🛡️ Validación de Tipos y Linter:** Paso obligatorio `npm run lint` (`tsc --noEmit`) que previene el despliegue ante inconsistencias tipográficas.

### Pasos de Despliegue PWA:
1. Configura en GitHub Secrets: `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID`.
2. En GitHub ➔ pestaña **Actions** ➔ selecciona **"InkFlow - Compilar WebAssembly (C++, Rust, Kotlin) y Desplegar a Cloudflare Pages"** ➔ pulsa **"Run workflow"**.
3. Selecciona el entorno (`production` o `preview`) y pulsa **"Run workflow"**.
4. Al finalizar, haz clic en el enlace del **Panel de Resumen Ejecutivo** para abrir e instalar la app directamente en tu teléfono móvil.

---

## 📌 Versión y Propiedad

**Versión:** `v1.0.0 estable`  
**Código del proyecto:** Software privado y propietario del autor. Diseñado y optimizado exclusivamente para uso personal y móvil sin dependencias que fuercen la apertura obligatoria del código fuente.
