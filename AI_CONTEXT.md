# 🤖 AI Context & Reglas del Proyecto - InkFlow Studio (PWA Nativa con Kotlin/Wasm, Rust & C++23)

Este archivo establece el contexto de desarrollo, las restricciones de ingeniería y las reglas inquebrantables que cualquier asistente de inteligencia artificial debe respetar en este repositorio.

---

## 🎯 Perfil del Usuario y Entorno

- **Dispositivo del Usuario:** El usuario opera desde un **teléfono móvil** (sin PC de escritorio). Todas las interfaces, diálogos, deslizadores y botones deben tener un área táctil mínima de 48×48 px, ser cómodos para los dedos y no desbordarse horizontalmente en resoluciones de 360–430 px de ancho.
- **Distribución Dual (PWA Nativa + APK Nativo con Tauri v2):**
  - **PWA Nativa:** Se ejecuta e instala directamente desde el navegador móvil a la pantalla de inicio con soporte standalone y funcionamiento 100% offline (desplegable en Cloudflare Pages).
  - **APK Nativo con Tauri v2:** Empaquetado ligero para Android que corre sobre el Android System WebView nativo (sin Chromium pesado incrustado), ideal para distribución libre en **Uptodown** o descarga directa. Configurado con `android:largeHeap="true"` (512MB-1GB RAM anti-OOM), `android:hardwareAccelerated="true"`, `android:configChanges="orientation|screenSize|screenLayout|keyboardHidden"`, `android:windowSoftInputMode="adjustResize|stateHidden"` y Scoped Storage seguro (compatible con Android 9 hacia atrás sin permisos peligrosos). Se compila mediante el workflow de GitHub Actions `.github/workflows/build-tauri-apk.yml` de activación **exclusivamente manual** (cero builds automáticos por push/PRs), generando un APK Debug listo para instalar con soporte para arquitecturas de 64 bits (`arm64-v8a`) y 32 bits (`armeabi-v7a`), con generación automática de Keystore y activación opcional de caché.
- **Stack Multi-Lenguaje:**
  - **C++23 Moderno:** Alojado en `src/cpp-core/` bajo estándar ISO/IEC 14882:2023 con conceptos, `std::span` y CMakeLists.txt con target WebAssembly y arquitecturas móviles de 32/64 bits (`arm64-v8a`, `armeabi-v7a`, `x86_64`, `x86`). Opera la visión artificial, percentiles de grosor, cierre morfológico de huecos y el **Motor Vectorial Analítico** (Bézier cúbica continua, Catmull-Rom C1 y Douglas-Peucker sin recolección de basura).
  - **Kotlin:** Alojado en `src/kotlin-core/AndroidPlatformBridge.kt`, `CoroutineOrchestrator.kt` y `VectorEngine.kt` para el puente nativo Android de **Guardado REAL en la Galería de Fotos (MediaStore.Images.Media en `Pictures/InkFlow Studio`)** y **WakeLock de Pantalla Encendida (`FLAG_KEEP_SCREEN_ON`)**, orquestación con **`kotlinx.coroutines` (concurrencia estructurada, conflate de eventos táctiles a 240Hz, centinela de auto-guardado no bloqueante y Jobs cancelables)**, serialización comprimida de archivos `.inkflow` y teoría cromática/armonía de color.
  - **Rust/Wasm:** Núcleo de buffers continuos, Wasm History Engine (compresión RLE 32-bit en memoria lineal para 40 niveles de deshacer) y scanline flood fill en `src/rust-core/src/lib.rs`.
  - **WebGPU (WGSL):** Shaders de sellos radiales y modos de fusión de capas acelerados por GPU.
- **Preferencia de Diseño:** El usuario no tolera el minimalismo extremo ni interfaces amontonadas en una sola pantalla. Se requieren pantallas y apartados independientes para tareas complejas y popups/modales estilo **Bottom Sheet nativo móvil** (sin patrones obsoletos de formulario web como botones de submit tipo "Confirmar y Dibujar"; la selección de herramientas debe ser táctil, inmediata y con vibración háptica).
- **Asistente de Grosor de Trazo 100% REAL:** Mide automáticamente la distribución real de contornos en la foto de calco mediante visión artificial (percentiles Silueta P92, Estructura P68, Detalles P38, Tramas P12) y permite adopción en 1 toque sin obligar al usuario.
- **Paleta y Acabado Visual:** Acabado profesional estilo estudio de arte digital (Grafito oscuro, carbón mate, acentos ámbar dorado y coral). Evitar colores chillones o fondos planos desprovistos de profundidad táctil.
- **Prohibición de Bloqueos en Lienzo:** Ningún menú o cuadro de diálogo debe flotar de forma rígida tapando el lienzo o el dibujo del usuario. Los paneles (como el ajustador de calco) deben ser minimizables o colapsables en 1 toque.
- **Cero Truncamiento en Herramientas:** Los selectores modales (`ToolPickerModal`) deben estructurarse con suficiente ancho o diseño de lista/tarjetas para mostrar el nombre completo de la herramienta sin `truncate` que corte los títulos.
- **Bote de Pintura con Expansión de Borde (1 a 3 px) y Cierre de Huecos (0 a 10 px):** Dilatación morfológica de la máscara (`dilateBinaryMask`) para eliminar rebordes blancos anti-aliasing entre el color plano y el lineart, sumado al **Cierre Inteligente de Huecos (Gap-Closing)** que une automáticamente extremos abiertos de trazo en 3px, 6px y 10px sin fugas de pintura. Con selectores táctiles rápidos flotantes en el lienzo.
- **Accesorios y Stickers de Galería en tu Obra (Moños, Lazos, Adornos):** Permite importar cualquier imagen de la galería como accesorio, manipularla con gestos multitáctiles independientes (mover, escalar, rotar, opacidad) y estamparla de forma permanente en la capa activa o en una nueva capa dedicada (`Accesorio (Moño)`), registrando el paso en el historial de deshacer/rehacer y persistiendo atómicamente en SQLite Wasm sobre OPFS.
- **Expansión de Hoja (Canvas Resize & Expand):** Modal ergonómico `CanvasResizeModal` con matriz visual de anclaje 3x3, presets en 1 toque (+25%, +50%, 2x, 1:1, 9:16) y reubicación sin pérdidas de capas, trazos vectoriales de Kotlin/Wasm (`offsetAllStrokes`) y foto de calco.
- **Rotación de Lienzo Táctil & Mapeo Inverso:** Al girar el lienzo con dos dedos, los puntos de dibujo deben transformarse inversamente con `unrotatePoint(screenX, screenY, centerX, centerY, rotationDeg)` para que el trazo se dibuje exactamente bajo el dedo sin descalibración.
- **Texturas de Pincel Estilo IbisPaint con Live Preview:** Catálogo de 4 texturas clásicas (`watercolor_paper`, `canvas`, `screentone`, `charcoal_noise`) más `none`. Modal `BrushTextureModal.tsx` con lienzo de prueba en vivo para inspeccionar y calibrar profundidad/escala antes de aplicar, sin alterar el pincel de trabajo hasta confirmación.
- **Guardado Inteligente a Galería:** El modal de exportación debe calcular el peso estimado del archivo en tiempo real de forma debounced y permitir tanto la exportación de la "Hoja Completa" como el recorte automático delimitado ("Auto-Crop") detectando los píxeles reales dibujados sin congelar la interfaz.
- **Ajustes de la App e Información (`SettingsInfoScreen`):** Pantalla dedicada que desacopla la configuración de la app de la mesa de dibujo. Incluye accesos directos al diagnóstico de núcleos, versión v1.0.0 estable del proyecto y preferencias hápticas/WakeLock.
- **Sub-Pantalla Dedicada para Cambiar el Color de la App (`ThemeCustomizationScreen`):** Permite cambiar el color del tema a través de una pantalla independiente (no amontonada) con 6 paletas de acento (Ámbar Estudio por defecto, Amatista Creativo, Esmeralda Manga, Zafiro Digital, Carmesí Dinámico y Cian Neón) con preview interactivo y persistencia local en `localStorage`.
- **Planes para la App y Superpoderes de Vectores (`AppRoadmapScreen`):** Pantalla dedicada que explica la evolución futura de la herramienta de vectores analítica en C++23: funciones para mover trazos vectoriales ya dibujados con el dedo, edición de nodos y tiradores Bézier Catmull-Rom C1, re-colorización y escalado de grosor no destructivo, lazo vectorial y reubicación entre capas.

---

## 🛑 Reglas Inmutables de Ingeniería

1. **Arquitectura Dual: PWA Nativa y APK Nativo con Tauri v2:**
   - La aplicación funciona de forma autónoma en el navegador móvil mediante Service Workers y Web App Manifest (despliegue continuo en Cloudflare Pages).
   - Simultáneamente, se compila a APK Debug para Android mediante Tauri v2 (`src-tauri/` y `.github/workflows/build-tauri-apk.yml`) usando el Android System WebView nativo sin empaquetar Chromium pesado, optimizado para tiendas de terceros como Uptodown o instalación directa.
2. **Integración de C++23, Rust y Kotlin:**
   - C++23 opera en `src/cpp-core/` para el motor vectorial analítico (Bézier cúbica y Douglas-Peucker sin GC), visión artificial, percentiles de grosor y cierre morfológico de huecos.
   - Kotlin opera en `src/kotlin-core/AndroidPlatformBridge.kt` y `VectorEngine.kt` para el puente nativo Android de Guardado Real en Galería (`AndroidGalleryManager`), WakeLock de Pantalla Encendida (`AndroidScreenWakeLockManager`), serialización `.inkflow` y teoría del color.
   - Rust opera en `src/rust-core/` para buffers de memoria lineal, compresión RLE 32-bit (Wasm History Engine) y scanline flood fill.
3. **Gestos Táctiles con los Propios Dedos:**
   - Soporte multitáctil directo: *pinch-to-zoom*, rotación libre con snapping magnético y desplazamiento continuo a dos dedos sin dejar marcas residuales.
   - Alternador inmediato entre Modo Dibujo y Modo Mover para navegación rápida con un solo dedo.
4. **Modo Calco Avanzado y Asistente Real:**
   - Panel minimizable a micro-píldora, alternador instantáneo de visibilidad `[👁️ Ocultar / Ver Calco]` y recomendación calibrada por la imagen.
5. **Seguridad del Sistema Operativo:**
   - **NUNCA** utilizar comandos o propiedades que modifiquen `persist.sys.*`. Ningún script o código debe tocar configuraciones del sistema reservadas.
6. **Licenciamiento de Dependencias:**
   - No agregar bibliotecas con licencias virales copyleft (GPL estricto, AGPL) que obliguen a publicar el código o infrinjan derechos. Priorizar licencias MIT, Apache-2.0 o BSD.
7. **Comentarios Explicativos:**
   - Todos los archivos de código fuente deben incluir un encabezado JSDoc/RustDoc/KDoc/Doxygen explicando la lógica que contienen y su propósito en la arquitectura.
8. **Conservación de Diseño y Lógica:**
   - No cambiar el diseño ni la lógica existente a menos que el usuario lo solicite explícitamente. Las modificaciones deben ser quirúrgicas y modulares.
9. **Pruebas de Lógica Obligatorias:**
   - Siempre verificar cambios de lógica con pruebas unitarias deterministas (`npx --yes tsx --test src/engine/engine.test.ts src/storage/storage.test.ts`) antes de dar por completada la tarea (61 tests pasando: 56 en motor gráfico/transformaciones/calco/Wasm/historial/VRAM/expansión/huecos/accesorios/texturas/C++23 vectores/Kotlin PWA/corrutinas/conflation 240Hz y 5 en persistencia SQLite Wasm).
10. **Persistencia Masiva en SQLite Wasm & OPFS:**
   - Queda terminantemente prohibido utilizar `localStorage` (límite 5MB y síncrono bloqueante) o `dexie.js` para persistencia gráfica.
   - El almacenamiento de proyectos y capas en alta resolución se realiza exclusivamente mediante `@sqlite.org/sqlite-wasm` ejecutándose en un Web Worker dedicado sobre OPFS (Origin Private File System) con transacciones ACID.
11. **Centinela de Auto-Guardado y Resguardo ante Crasheos:**
   - Todo trabajo del usuario debe auto-guardarse de manera debounced en segundo plano.
   - El sistema debe interceptar `visibilitychange`, `pagehide`, `window.onerror` y React `ErrorBoundary` para salvar un checkpoint de emergencia si el usuario mata el proceso o la app crashea, permitiendo restauración inmediata en 1 toque.
12. **Caché Integral al 100% y Aceleración de Recursos:**
   - Precaché de Service Worker / Workbox configurado con límite ampliado a 10MB en `vite.config.ts` (`maximumFileSizeToCacheInBytes: 10 * 1024 * 1024`) abarcando `.wasm` y `.webmanifest`.
   - Compilación JIT de Wasm a código máquina de CPU mediante `WebAssembly.instantiateStreaming` / `compileStreaming` (`wasmStreamingCompiler.ts`).
   - Cabeceras de inmutabilidad en Cloudflare Pages (`public/_headers`) con `Cache-Control: public, max-age=31536000, immutable` para activos fingerprinted y `.wasm`.
   - Caché VRAM en GPU (`GPUBitmapCache`) mediante `createImageBitmap` asíncrono off-thread y liberación explícita con `.close()` para evitar fugas de memoria.
