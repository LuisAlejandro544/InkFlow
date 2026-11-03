# 🏛️ Estructura del Proyecto - InkFlow Studio (PWA Nativa con Kotlin/Wasm, Rust & C++23)

Este documento detalla la arquitectura de archivos, la responsabilidad de cada módulo y el flujo de datos del motor de dibujo digital basado en **PWA Nativa**, **WebGPU**, **Kotlin/Wasm**, **Rust/Wasm**, **C++23** y **React 19 / TypeScript**.

---

## 🌳 Árbol de Archivos del Proyecto (Arquitectura Modular de Alto Rendimiento)

```text
/
├── .github/
│   └── workflows/
│       └── deploy.yml            # Pipeline GitHub Actions (activación manual, Wasm C++/Rust/Kotlin & Cloudflare Pages)
├── public/                       # Activos estáticos públicos e iconos PWA
│   ├── favicon.ico               # Favicon estándar para navegadores
│   ├── icon.svg                  # Gráfico vectorial base del icono de la app
│   ├── manifest.json             # Manifiesto Web App (display: standalone, theme-color)
│   ├── sw.js                     # Service Worker con precaché para soporte offline completo
│   ├── _headers                  # Cabeceras Cloudflare Pages: inmutabilidad (1 año) para /assets/* y *.wasm
│   ├── pwa-192x192.png           # Icono de pantalla de inicio Android PWA (192px)
│   ├── pwa-512x512.png           # Icono de alta resolución para splash screen PWA (512px)
│   ├── pwa-maskable-512x512.png  # Icono con zona segura para launchers móviles adaptativos
│   └── apple-touch-icon.png      # Icono para dispositivos Apple iOS (180px)
├── src/
│   ├── cpp-core/                 # Código fuente en C++23 moderno (ISO/IEC 14882:2023)
│   │   ├── include/
│   │   │   └── IbisStrokeAnalyzer.hpp # Cabecera C++23 con conceptos, std::span, cierre de huecos y C-ABI
│   │   ├── src/
│   │   │   └── IbisStrokeAnalyzer.cpp # Detección de percentiles y cierre morfológico de huecos (gap closing)
│   │   ├── CMakeLists.txt        # Configuración CMake con soporte Wasm SIMD128 y NDK 32/64 bits
│   │   └── README.md             # Documentación técnica del módulo C++23
│   ├── kotlin-core/              # Código fuente en Kotlin para WebAssembly (Kotlin/Wasm)
│   │   └── VectorEngine.kt       # Algoritmos Bézier, Catmull-Rom, Douglas-Peucker y curvas continuas
│   ├── rust-core/                # Código fuente en Rust para compilación a Wasm
│   │   ├── Cargo.toml            # Configuración de paquete Rust y perfil wasm32
│   │   └── src/
│   │       └── lib.rs            # Matemática vectorial, estabilizador, flood fill y buffers VBO
│   ├── engine/                   # Motor gráfico central desacoplado de la interfaz
│   │   ├── types.ts              # Tipos: Layer, ToolType, Point, VectorStroke, TracingReference (calco o accesorio)
│   │   ├── wasmEngine.ts         # Binario Wasm, estabilizador S-Form y cálculo de presión
│   │   ├── wasmStreamingCompiler.ts # Compilador JIT streaming a código máquina CPU con caché nativa
│   │   ├── wasmHistoryEngine.ts  # Motor de Deshacer/Rehacer en Wasm con memoria lineal y compresión RLE 32-bit
│   │   ├── bitmapCache.ts        # Caché VRAM en GPU con ImageBitmap off-thread y gestión LRU
│   │   ├── transformMath.ts      # Matemática pura: zoom, rotación 2D, snapping, screenToCanvasCoords y auto-crop
│   │   ├── canvasResizeMath.ts   # Matemática de expansión de lienzo: matriz de anclaje 3x3 y presets de espacio
│   │   ├── floodFillEngine.ts    # Scanline Flood Fill con dilatación 0-3px y Cierre de Huecos 0-10px (Gap Closing)
│   │   ├── exportEngine.ts       # [MODULAR] Motor desacoplado de composición offscreen, estimación de peso y Web Share API
│   │   ├── brushTextureEngine.ts # Motor matemático de 9 texturas estilo IbisPaint y proyección en espacio de lienzo
│   │   ├── tracingEngine.ts      # Motor de calco y stickers: Sobel Lineart, contraste, monocromo y paletas Wasm
│   │   ├── strokeAssistant.ts    # Asistente REAL de Grosor: Visión artificial, percentiles y muestreo local
│   │   ├── kotlinWasmBridge.ts   # Puente de ejecución Kotlin/Wasm para Lápiz Vectorial (cero píxeles al zoom)
│   │   ├── environmentDetector.ts# Detección determinista de PWA Standalone vs Navegador y excepción de Preview
│   │   ├── webgpuEngine.ts       # [MODULAR] Coordinador central WebGPU/Canvas y despacho de herramientas
│   │   ├── shaders/              # [MODULAR] Shaders de aceleración por GPU
│   │   │   └── brushShader.wgsl.ts # Shaders WGSL para sellos radiales y gradientes de atenuación
│   │   ├── renderers/            # [MODULAR] Renderizadores gráficos especializados
│   │   │   └── canvas2dRenderer.ts # Renderizado acelerado 2D de trazos, patrones continuos y composición de capas
│   │   └── engine.test.ts        # Suite de 50 pruebas unitarias deterministas de motor, Wasm, historial, accesorios y texturas
│   ├── storage/                  # Motor de Persistencia Masiva SQLite Wasm & OPFS en Web Worker
│   │   ├── sqliteTypes.ts        # Tipos y contratos IPC de serialización relacional
│   │   ├── sqliteStorage.worker.ts # Web Worker dedicado ejecutando @sqlite.org/sqlite-wasm sobre OPFS
│   │   ├── sqliteStorageService.ts # Servicio cliente con auto-guardado debounced y centinela de ciclo de vida
│   │   └── storage.test.ts       # 5 pruebas unitarias deterministas de SQLite Wasm y Crash Recovery
│   ├── store/                    # Gestión de estado global
│   │   └── drawingStore.ts       # Estado del proyecto por defecto, paleta y herramientas
│   ├── hooks/                    # [MODULAR] Hooks de dominio especializados desacoplados
│   │   ├── useLayerManager.ts    # Gestión integral de capas: creación, clonación, merge, eliminación y blend modes
│   │   ├── useDrawingHistory.ts  # Historial reactivo de Deshacer/Rehacer con instantáneas ImageData y Wasm RLE
│   │   ├── useTracingManager.ts  # Ciclo de vida de fotos de calco y accesorios (moños/stickers)
│   │   ├── useCanvasGestures.ts  # [MODULAR] Gestos multitáctiles directos (pinch-to-zoom, rotación libre, snapping y paneo)
│   │   ├── useStrokeDrawing.ts   # [MODULAR] Captura de trazo, estabilización S-Form, presión y despacho gráfico
│   │   ├── useTracingGestures.ts # [MODULAR] Manipulación táctil con GPU transform en tiempo real para fotos y stickers
│   │   ├── useProjectPersistence.ts # [MODULAR] Ciclo de vida SQLite Wasm, auto-guardado debounced y centinela de crash
│   │   ├── useCanvasResizeHandler.ts # [MODULAR] Expansión y redimensionado de lienzo con matriz 3x3 y curvas Kotlin
│   │   ├── useAccessoryStamper.ts # [MODULAR] Estampado permanente de adornos/moños en capa activa o capa dedicada
│   │   └── useStudioModals.ts    # [MODULAR] Gestión limpia de apertura/cierre de los 6 modales del estudio
│   ├── components/               # Componentes modulares de interfaz de usuario
│   │   ├── studio/               # [MODULAR] Subcomponentes especializados de StudioScreen
│   │   │   ├── StudioTopBar.tsx  # Barra superior móvil, deshacer/rehacer, zoom/rotación, calco y menú Pro
│   │   │   ├── StudioBottomBar.tsx # Barra inferior móvil, deslizadores de grosor/opacidad y dock de 5 herramientas
│   │   │   └── StudioCanvasOverlays.tsx # Píldoras de expansión/huecos, burbujas preview de pincel y modal iOS
│   │   ├── tools/                # [MODULAR] Subcomponentes especializados de selección de herramientas
│   │   │   ├── toolDefinitions.ts # Metadatos, iconos, badges y descripciones de las 9 herramientas de dibujo
│   │   │   ├── BucketSettingsCard.tsx # Configuración de expansión de borde (0 a 3px), cierre de huecos (0 a 10px) y tolerancia
│   │   │   └── StabilizerScratchpad.tsx # Calibrador S-Form con bloc táctil de pruebas y presets rápidos
│   │   ├── tracing/              # [MODULAR] Subcomponentes especializados del calco y accesorios
│   │   │   ├── TracingControlBar.tsx # Barra de calibración inferior compacta (~105px) con cero desbordamiento
│   │   │   └── TracingMinimizedPill.tsx # Píldora ultra compacta flotante que despeja el 100% del lienzo
│   │   ├── WelcomeScreen.tsx     # Pantalla de bienvenida, catálogo de funciones pro y descarga PWA en navegador
│   │   ├── StudioScreen.tsx      # [MODULAR] Mesa de dibujo táctil orquestada a 60-120 FPS
│   │   ├── ToolPickerModal.tsx   # Modal nativo segmentado en Herramientas y Estabilizador S-Form
│   │   ├── BrushTextureModal.tsx # Modal de 9 texturas de pincel estilo IbisPaint con live preview interactivo
│   │   ├── CanvasResizeModal.tsx # Modal de expansión de hoja con matriz de anclaje 3x3 y presets rápidos
│   │   ├── TracingAdjuster.tsx   # [MODULAR] Ajustador táctil de calco y stickers con aceleración GPU pura
│   │   ├── StrokeGuideAssistant.tsx # Barra ergonómica con recomendación calibrada por visión artificial
│   │   ├── GalleryScreen.tsx     # Pantalla de galería y creación de nuevos lienzos
│   │   ├── EngineInfoScreen.tsx  # Diagnóstico técnico de WebGPU, Kotlin/Wasm, Rust, C++23 y PWA
│   │   ├── LayersModal.tsx       # Gestor de capas estilo IbisPaint con importador de calco y accesorios
│   │   ├── ColorPickerModal.tsx  # Rueda HSV, sliders RGB y muestras de color de la foto
│   │   ├── ExportModal.tsx       # [MODULAR] Guardado de obra a galería con Hoja Completa vs Auto-crop y peso en KB/MB
│   │   ├── ErrorBoundary.tsx     # Captura de excepciones de interfaz para evitar pantalla blanca
│   │   └── usePWAInstall.ts      # Hook reactivo de instalación PWA en pantalla de inicio
│   ├── App.tsx                   # [MODULAR] Componente orquestador limpio y desacoplado vía Custom Hooks
│   ├── main.tsx                  # Punto de entrada de React 19
│   └── index.css                 # Estilos globales y Tailwind CSS
├── index.html                    # Documento HTML principal con metaetiquetas PWA nativas
├── metadata.json                 # Metadatos del applet en Google AI Studio
├── package.json                  # Dependencias del proyecto y scripts de compilación
├── tsconfig.json                 # Configuración de TypeScript con soporte de cliente PWA
├── vite.config.ts                # Configuración de Vite y Tailwind CSS
├── README.md                     # Documentación general del proyecto (PWA Nativa)
├── ROADMAP.md                    # Hoja de ruta de desarrollo técnico
├── ESTRUCTURE.md                 # Arquitectura de carpetas y flujo de datos
├── AI_CONTEXT.md                 # Contexto de desarrollo para asistentes de IA
├── AGENTS.md                     # Roles y prompts de agentes especializados
└── README_AI.md                  # Guía técnica para modelos de lenguaje
```

---

## 🔄 Flujo de Datos y Análisis de Grosor Real

```text
[ Foto de Galería para Calco o Accesorio/Moño ]
              │
              ├── Modo Calco: TracingEngine / StrokeAssistant (C++23 & Wasm/TS)
              │   ├── Convolución y Luminancia BT.709
              │   ├── Muestreo transversal ortogonal de líneas
              │   └── Cálculo de percentiles (Silueta P92, Estructura P68, Detalles P38, Tramas P12)
              │
              └── Modo Accesorio/Sticker: useAccessoryStamper (Transformación Táctil Móvil)
                  ├── Gestos a 1 y 2 dedos (Pan, Pinch Scale, Rotación libre)
                  ├── [✨ Estampar en Capa Activa]
                  └── [📑 + Nueva Capa Dedicada ("Accesorio (Moño)")]
              │
              ▼
[ StrokeGuideAssistant ] ──> Recomienda los 4 grosores medidos de tu foto en 1 toque
              │
              ▼
[ Pantalla Táctil del Teléfono (PointerEvent / TouchEvent) ]
              │
         ┌────┴───────────────────────────┐
         ▼                                ▼
    [ 1 Dedo: useStrokeDrawing ]    [ 2 Dedos: useCanvasGestures ]
         │                                │
         ├── Des-rotación inversa         ├── Escala focal de zoom (Z)
         │   unrotatePoint(x, y, θ)       ├── Delta angular de rotación θ
         │                                └── Snapping magnético (0°, 90°, 180°, 270°)
         ▼                                │
   [ Estabilizador S-Form ]               ▼
         │                        [ Transformación matricial de hoja ]
         ├── Lápiz Vectorial: [ KotlinVectorEngine (Catmull-Rom C1) ]
         ├── Balde de Pintura:[ FloodFillEngine (Scanline + Dilate 0-3px + Gap-Closing 0-10px) ]
         └── Pincel / Goma:   [ WebGPU WGSL Shader / Canvas 2D Renderer ]
                                          │
                                          ▼
                         [ ExportModal / exportEngine.ts ]
                                          │
                         ├── Hoja Completa vs Auto-Crop (Bounding Box)
                         ├── Estimación de peso en tiempo real (KB / MB)
                         └── Web Share API / Guardado nativo en galería
```

---

## ⚙️ Principios de Arquitectura PWA Nativa

1. **Desacoplamiento Estricto:** La lógica matemática pura se aloja en `src/engine/`, `src/cpp-core/` y `src/kotlin-core/`. Los componentes de React únicamente renderizan y gestionan eventos.
2. **Modularización de Componentes Complejos:**
   - `webgpuEngine.ts` delega sus shaders a `src/engine/shaders/brushShader.wgsl.ts` y su renderizado 2D a `src/engine/renderers/canvas2dRenderer.ts`.
   - `ExportModal.tsx` delega la composición offscreen, cálculo de auto-crop y estimación de bytes a `src/engine/exportEngine.ts`.
   - `TracingAdjuster.tsx` delega su manipulación gestual acelerada por GPU a `src/hooks/useTracingGestures.ts`, su barra inferior a `src/components/tracing/TracingControlBar.tsx` y su modo minimizado a `src/components/tracing/TracingMinimizedPill.tsx`.
   - `StudioScreen.tsx` delega la navegación espacial y gestos multitáctiles a `src/hooks/useCanvasGestures.ts` y el despacho del trazo táctil a `src/hooks/useStrokeDrawing.ts`.
   - `App.tsx` delega en hooks dedicados en `src/hooks/` (`useLayerManager.ts`, `useDrawingHistory.ts`, `useTracingManager.ts`, `useProjectPersistence.ts`, `useCanvasResizeHandler.ts`, `useAccessoryStamper.ts`, `useStudioModals.ts`).
3. **Diseño Móvil Nativo:** Eliminación de patrones de formulario web (botones submit/confirmar). Selección instantánea en 1 toque con retroalimentación háptica y controles segmentados.
4. **Ergonomía Móvil Extrema:** Cero truncamientos tipográficos en selectores modales, touch targets de al menos 48×48px y soporte seguro para `viewport-fit=cover`.
5. **Manipulación Gestual Invariante:** Todo giro de la hoja mediante dedos preserva el trazo exacto bajo el puntero aplicando la transformación inversa en tiempo real sin desfasaje de píxeles.
6. **Preservación y Respeto al Arte del Usuario:** El guardado a galería permite conservar la hoja original o recortar automáticamente los márgenes sobrantes para compartir la ilustración de inmediato con conocimiento de su peso exacto.
7. **Estampado No Destructivo de Accesorios:** Los elementos de galería (moños, stickers) pueden estamparse de forma definitiva en la capa de trabajo o derivarse a una nueva capa separada con instantánea automática para deshacer/rehacer y almacenamiento ACID en SQLite Wasm sobre OPFS.
