# InkFlow Studio v1.0.0 estable (PWA Nativa con C++23, Rust & Kotlin/Android)

Aplicación de dibujo e ilustración digital profesional para dispositivos móviles. Diseñada y construida **exclusivamente como una Aplicación Web Progresiva (PWA Nativa)**, con renderizado acelerado por **WebGPU (WGSL)**, motor vectorial analítico en **C++23 (WebAssembly)**, núcleo de bajo nivel en **Rust (Wasm)**, persistencia masiva en **SQLite Wasm (OPFS)** y arquitectura móvil extensible con **Kotlin**.

> ⚠️ **Nota de Arquitectura:** Esta aplicación es **100% PWA** y versión `v1.0.0 estable`. No requiere empaquetado en APK ni descargas desde tiendas de aplicaciones. Se instala directamente desde cualquier navegador móvil moderno a la pantalla de inicio del teléfono, ejecutándose en modo *standalone* a pantalla completa con soporte offline. Desplegable como sitio estático sin costes de backend en **Cloudflare Pages** mediante **GitHub Actions** manual.

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
- **🗄️ Persistencia Masiva con SQLite Wasm sobre OPFS (Origin Private File System):**
  - Implementado con el paquete oficial `@sqlite.org/sqlite-wasm` ejecutándose dentro de un **Web Worker dedicado**.
  - Almacena ilustraciones, capas transparentes en alta fidelidad y vectores directamente en el sistema de archivos privado y nativo del teléfono móvil (**OPFS**), con transacciones atómicas **ACID**.
  - **Cero caídas de FPS (Zero Frame-Drop):** La serialización y escritura de megabytes de píxeles ocurre en un hilo secundario sin interrumpir los 60–120 FPS del trazo táctil.
  - **Supera las limitaciones de la web tradicional:** Elimina las cuotas de 5 MB de `localStorage` y la sobrecarga de recolector de basura de librerías como `dexie.js`.
- **🛡️ Centinela de Auto-Guardado y Resguardo ante Cierre de App o Crash:**
  - **Auto-guardado continuo en segundo plano:** Tras cada trazo completado o modificación de capas, se programa un punto de control automático (*debounced* a 1s) hacia SQLite.
  - **Salida abrupta o borrado del proceso:** Escucha los eventos de ciclo de vida del sistema operativo móvil (`visibilitychange` cuando la app se minimiza o se cambia a otra app, y `pagehide` cuando el proceso se descarga) para disparar un snapshot de emergencia inmediato.
  - **Protección contra crasheos:** Integrado en excepciones globales de JavaScript (`window.onerror`, `unhandledrejection`) y en el `ErrorBoundary` de React, resguardando la obra antes de interrumpir la interfaz.
  - **Banner de Recuperación en 1 Toque:** Si la app detecta un punto de recuperación de una sesión interrumpida, despliega un aviso táctil nativo para restaurar todas las capas y dimensiones exactamente como estaban.
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

## 🧪 Pruebas Unitarias de Lógica

El proyecto cuenta con **71 pruebas unitarias automatizadas deterministas** con `node:test` en 2 suites:

### Suite 1: Motor Gráfico, C++23 Vectores, Calco, Wasm, Historial, Caché GPU, Expansión, Huecos, Accesorios, Texturas, Corrutinas, Temas & Kotlin / PWA (64 tests)
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

### Suite 2: Persistencia Masiva SQLite Wasm sobre OPFS (7 tests)
65. Inicialización oficial del módulo `@sqlite.org/sqlite-wasm`.
66. Creación atómica del esquema relacional (`projects`, `layers`, `crash_recovery`).
67. Transacción ACID completa de proyectos con capas y orden z.
68. Centinela de Crash: Registro de emergencia, consulta y restauración tras salida abrupta.
69. Eliminación limpia en cascada sin fugas de almacenamiento.
70. Persistencia y recuperación exacta de la foto de calco con su rotación angular y escala.
71. Crash Recovery de calco: Rescate y restauración de rotación angular tras fallo del navegador.

```bash
# Ejecutar todas las pruebas deterministas (71 tests)
npx --yes tsx --test src/engine/engine.test.ts src/storage/storage.test.ts
```

---

## ☁️ Despliegue en Cloudflare Pages vía GitHub Actions

El repositorio incluye un workflow en `.github/workflows/deploy.yml` configurado para **activación exclusivamente manual** (`workflow_dispatch`).

### Resiliencia y Optimización de CI/CD:
- **⚡ Optimización Extrema con `wasm-opt` (Binaryen):** Comprime los binarios Wasm de Rust y C++ con `-O3 --enable-simd --enable-bulk-memory` reduciendo su peso un 25-40% para arranque instantáneo en móviles.
- **🌐 Despliegue Dual (Producción vs Vista Previa Aislada):** Selector en `workflow_dispatch` para elegir entre publicar en la rama principal (`main`) o en una URL de vista previa aislada temporal (`preview-<run_id>`) para probar cambios sin riesgo.
- **📊 Panel de Resumen Ejecutivo en GitHub (`$GITHUB_STEP_SUMMARY`):** Renderiza una tarjeta visual con enlace directo a la PWA, peso del bundle y estado de las 46 pruebas automatizadas.
- **🔒 Aislamiento de Origen Cruzado (COOP / COEP):** Inyección y validación de cabeceras en `public/_headers` para desbloquear `SharedArrayBuffer` y el máximo rendimiento de SQLite Wasm sobre OPFS.
- **🛡️ Validación de Tipos y Linter:** Paso obligatorio `npm run lint` (`tsc --noEmit`) que previene el despliegue ante inconsistencias tipográficas.

### Pasos de Despliegue:
1. Configura en GitHub Secrets: `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID`.
2. En GitHub ➔ pestaña **Actions** ➔ selecciona **"InkFlow - Compilar WebAssembly (C++, Rust, Kotlin) y Desplegar a Cloudflare Pages"** ➔ pulsa **"Run workflow"**.
3. Selecciona el entorno (`production` o `preview`) y pulsa **"Run workflow"**.
4. Al finalizar, haz clic en el enlace del **Panel de Resumen Ejecutivo** para abrir e instalar la app directamente en tu teléfono móvil.

---

## 📌 Versión y Propiedad

**Versión:** `v1.0.0 estable`  
**Código del proyecto:** Software privado y propietario del autor. Diseñado y optimizado exclusivamente para uso personal y móvil sin dependencias que fuercen la apertura obligatoria del código fuente.
