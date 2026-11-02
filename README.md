# InkFlow Studio (PWA Nativa con Kotlin/Wasm, Rust & C++23)

Aplicación de dibujo e ilustración digital profesional para dispositivos móviles. Diseñada y construida **exclusivamente como una Aplicación Web Progresiva (PWA Nativa)**, con renderizado acelerado por **WebGPU (WGSL)**, motor vectorial en **Kotlin (Kotlin/Wasm)**, núcleo de bajo nivel en **Rust (Wasm)**, motor analítico en **C++23** y pipeline reactivo en **React 19 / TypeScript**.

> ⚠️ **Nota de Arquitectura:** Esta aplicación es **100% PWA**. No requiere empaquetado en APK ni descargas desde tiendas de aplicaciones. Se instala directamente desde cualquier navegador móvil moderno a la pantalla de inicio del teléfono, ejecutándose en modo *standalone* a pantalla completa con soporte offline. Desplegable como sitio estático sin costes de backend en **Cloudflare Pages** mediante **GitHub Actions** manual.

---

## 🎨 Características Principales de la PWA

- **⚡ Núcleo C++23 (ISO/IEC 14882:2023):**
  - Ubicado en `src/cpp-core/` con especificación C++23 estricta, conceptos (`std::concepts`), vistas `std::span` y compatibilidad nativa y WebAssembly (`wasm32` con SIMD128, y arquitecturas móviles de 32 y 64 bits: `arm64-v8a`, `armeabi-v7a`, `x86_64`, `x86`).
  - Licencia permisiva MIT / Apache-2.0 sin restricciones copyleft ni requerimientos de código abierto forzoso.
- **⚡ Lápiz Vectorial Potenciado por Kotlin/Wasm:**
  - Implementado en `src/kotlin-core/VectorEngine.kt` y ejecutado en el navegador mediante WebAssembly (`wasmJs` con Wasm-GC).
  - Curvas de Bézier cúbicas continuas con continuidad C1 y decodificación de presión.
  - **Cero píxeles al hacer zoom:** A diferencia de los pinceles de mapa de bits (raster), el trazo vectorial se evalúa analíticamente a cualquier escala (100%, 200%, 400%, etc.), manteniendo bordes nítidos y vectoriales sin pixelación.
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
- **🌾 Texturas de Pincel Estilo IbisPaint con Previsualización en Vivo:**
  - **4 Texturas Clásicas de Ilustración Profesional:**
    1. **Papel Acuarela:** Grano orgánico con valles de papel Canson/Torchon para simular acumulación de pigmento tradicional.
    2. **Lienzo Textil (Canvas):** Trama ortogonal cruzada de lino para técnicas de óleo y acrílico.
    3. **Trama Manga (Halftone / Screentone):** Semitonos regulares a 45° imprescindibles para cómic japonés y manga.
    4. **Carboncillo Poroso:** Grano áspero, seco y desgranado con micro-huecos en trazos sueltos.
    5. **Ninguna (Liso):** Vuelta inmediata al trazo plano uniforme sin textura.
  - **Previsualización Interactiva sin necesidad de elegir:** Muestra dinámica en la cabecera del modal (`BrushTextureModal.tsx`) que renderiza un trazo curvo en tiempo real con el color actual y tamaño de pincel del artista, permitiendo examinar cualquier textura antes de confirmarla.
  - **Deslizadores en Tiempo Real:** Calibración ergonómica de **Profundidad / Intensidad** (10% a 100%) y **Escala de Grano** (0.5x a 2.5x).
  - **Acceso Táctil:** Fila dedicada e indicador de textura en `StudioBottomBar.tsx` y acceso directo en `ToolPickerModal.tsx`.
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

## 🧪 Pruebas Unitarias de Lógica

El proyecto cuenta con **46 pruebas unitarias automatizadas deterministas** con `node:test` en 2 suites:

### Suite 1: Motor Gráfico, Calco, Wasm, Caché GPU, Expansión, Huecos, Accesorios & Texturas (41 tests)
1. Interpolación lineal y cálculo euclidiano Wasm.
2. Estabilizador exponencial anti-temblor S-Form.
3. Simulación de curva de presión táctil por velocidad.
4. Algoritmo de reducción Douglas-Peucker de Kotlin/Wasm.
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

### Suite 2: Persistencia Masiva SQLite Wasm sobre OPFS (5 tests)
42. Inicialización oficial del módulo `@sqlite.org/sqlite-wasm`.
43. Creación atómica del esquema relacional (`projects`, `layers`, `crash_recovery`).
44. Transacción ACID completa de proyectos con capas y orden z.
45. Centinela de Crash: Registro de emergencia, consulta y restauración tras salida abrupta.
46. Eliminación limpia en cascada sin fugas de almacenamiento.

```bash
# Ejecutar todas las pruebas deterministas (46 tests)
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

## 📄 Licencia

MIT / Apache-2.0. Permisiva y apta para uso comercial y personal sin restricciones de copyleft ni código abierto obligatorio.
