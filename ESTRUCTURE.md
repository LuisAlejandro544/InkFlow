# 🏛️ Estructura del Proyecto - InkFlow Studio (PWA Nativa con Kotlin/Wasm, Rust & C++23)

Este documento detalla la arquitectura de archivos, la responsabilidad de cada módulo y el flujo de datos del motor de dibujo digital basado en **PWA Nativa**, **WebGPU**, **Kotlin/Wasm**, **Rust/Wasm**, **C++23** y **React 19 / TypeScript**.

---

## 🌳 Árbol de Archivos del Proyecto (Arquitectura Modular)

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
│   │       └── lib.rs            # Matemática vectorial, estabilizador y buffers VBO
│   ├── engine/                   # Motor gráfico central desacoplado de la interfaz
│   │   ├── types.ts              # Tipos: Layer, ToolType, Point, VectorStroke, TracingReference (calco o accesorio)
│   │   ├── wasmEngine.ts         # Binario Wasm, estabilizador S-Form y cálculo de presión
│   │   ├── wasmStreamingCompiler.ts # Compilador JIT streaming a código máquina CPU con caché nativa
│   │   ├── bitmapCache.ts        # Caché VRAM en GPU con ImageBitmap off-thread y gestión LRU
│   │   ├── transformMath.ts      # Matemática pura: zoom, rotación 2D, snapping, screenToCanvasCoords y auto-crop
│   │   ├── canvasResizeMath.ts   # Matemática de expansión de lienzo: matriz de anclaje 3x3 y presets de espacio
│   │   ├── floodFillEngine.ts    # Scanline Flood Fill con dilatación 0-3px y Cierre de Huecos 0-10px (Gap Closing)
│   │   ├── tracingEngine.ts      # Motor de calco y stickers: Sobel Lineart, contraste, monocromo y paletas Wasm
│   │   ├── strokeAssistant.ts    # Asistente REAL de Grosor: Visión artificial, percentiles y muestreo local
│   │   ├── kotlinWasmBridge.ts   # Puente de ejecución Kotlin/Wasm para Lápiz Vectorial (cero píxeles al zoom)
│   │   ├── environmentDetector.ts# Detección determinista de PWA Standalone vs Navegador y excepción de Preview
│   │   ├── webgpuEngine.ts       # Pipeline WebGPU, shaders WGSL, composición multicapa, balde y trazado
│   │   └── engine.test.ts        # Suite de 38 pruebas unitarias deterministas de motor, Wasm, huecos y accesorios
│   ├── storage/                  # Motor de Persistencia Masiva SQLite Wasm & OPFS en Web Worker
│   │   ├── sqliteTypes.ts        # Tipos y contratos IPC de serialización relacional
│   │   ├── sqliteStorage.worker.ts # Web Worker dedicado ejecutando @sqlite.org/sqlite-wasm sobre OPFS
│   │   ├── sqliteStorageService.ts # Servicio cliente con auto-guardado debounced y centinela de ciclo de vida
│   │   └── storage.test.ts       # 5 pruebas unitarias deterministas de SQLite Wasm y Crash Recovery
│   ├── store/                    # Gestión de estado global
│   │   └── drawingStore.ts       # Estado del proyecto por defecto, paleta y herramientas
│   ├── hooks/                    # [MODULAR] Hooks de dominio especializados desacoplados de la raíz
│   │   ├── useLayerManager.ts    # Gestión integral de capas: creación, clonación, merge, eliminación y blend modes
│   │   ├── useDrawingHistory.ts  # Historial reactivo de Deshacer/Rehacer con instantáneas ImageData
│   │   └── useTracingManager.ts  # Ciclo de vida de fotos de calco y accesorios (moños/stickers)
│   ├── components/               # Componentes modulares de interfaz de usuario
│   │   ├── studio/               # [MODULAR] Subcomponentes especializados de StudioScreen
│   │   │   ├── StudioTopBar.tsx  # Barra superior móvil, deshacer/rehacer, zoom/rotación, calco y menú Pro
│   │   │   ├── StudioBottomBar.tsx # Barra inferior móvil, deslizadores de grosor/opacidad y dock de 5 herramientas
│   │   │   └── StudioCanvasOverlays.tsx # Píldoras de expansión/huecos, burbujas preview de pincel y modal iOS
│   │   ├── tools/                # [MODULAR] Subcomponentes especializados de selección de herramientas
│   │   │   ├── toolDefinitions.ts # Metadatos, iconos, badges y descripciones de las 9 herramientas de dibujo
│   │   │   ├── BucketSettingsCard.tsx # Configuración de expansión de borde (0 a 3px), cierre de huecos (0 a 10px) y tolerancia
│   │   │   └── StabilizerScratchpad.tsx # Calibrador S-Form con bloc táctil de pruebas y presets rápidos
│   │   ├── WelcomeScreen.tsx     # Pantalla de bienvenida, catálogo de funciones pro y descarga PWA en navegador
│   │   ├── StudioScreen.tsx      # Mesa de dibujo táctil con gestos directos a 60-120 FPS
│   │   ├── ToolPickerModal.tsx   # Modal nativo segmentado en Herramientas y Estabilizador S-Form
│   │   ├── CanvasResizeModal.tsx # Modal de expansión de hoja con matriz de anclaje 3x3 y presets rápidos
│   │   ├── TracingAdjuster.tsx   # Ajustador táctil de calco y accesorios (moños/stickers) con estampado en capas
│   │   ├── StrokeGuideAssistant.tsx # Barra ergonómica con recomendación calibrada por visión artificial
│   │   ├── GalleryScreen.tsx     # Pantalla de galería y creación de nuevos lienzos
│   │   ├── EngineInfoScreen.tsx  # Diagnóstico técnico de WebGPU, Kotlin/Wasm, Rust, C++23 y PWA
│   │   ├── LayersModal.tsx       # Gestor de capas estilo IbisPaint con importador de calco y accesorios
│   │   ├── ColorPickerModal.tsx  # Rueda HSV, sliders RGB y muestras de color de la foto
│   │   ├── ExportModal.tsx       # Guardado de obra a galería con Hoja Completa vs Auto-crop y peso en KB/MB
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
              └── Modo Accesorio/Sticker: TracingAdjuster (Transformación Táctil Móvil)
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
    [ 1 Dedo ]              [ 2 Dedos: Pinch / Rotate / Pan ]
         │                                │
         ├── Des-rotación inversa         ├── Escala focal de zoom (Z)
         │   unrotatePoint(x, y, θ)       ├── Delta angular de rotación θ
         │                                └── Snapping magnético (0°, 90°, 180°, 270°)
         ▼                                │
   [ Estabilizador S-Form ]               ▼
         │                        [ Transformación matricial de hoja ]
         ├── Lápiz Vectorial: [ KotlinVectorEngine (Catmull-Rom C1) ]
         ├── Balde de Pintura:[ FloodFillEngine (Scanline + Dilate 0-3px + Gap-Closing 0-10px) ]
         └── Pincel / Goma:   [ WebGPU WGSL Shader / Canvas ]
                                          │
                                          ▼
                         [ ExportModal: Guardar a Galería ]
                                          │
                         ├── Hoja Completa vs Auto-Crop (Bounding Box)
                         ├── Estimación de peso en tiempo real (KB / MB)
                         └── Web Share API / Guardado nativo en galería
```

---

## ⚙️ Principios de Arquitectura PWA Nativa

1. **Desacoplamiento Estricto:** La lógica matemática pura se aloja en `src/engine/`, `src/cpp-core/` y `src/kotlin-core/`. Los componentes de React únicamente renderizan y gestionan eventos.
2. **Modularización de Componentes Complejos:**
   - `webgpuEngine.ts` delega el algoritmo de flood fill, dilatación morfológica y cierre de huecos a `src/engine/floodFillEngine.ts`.
   - `ToolPickerModal.tsx` delega en `src/components/tools/` (`toolDefinitions.ts`, `BucketSettingsCard.tsx`, `StabilizerScratchpad.tsx`).
   - `StudioScreen.tsx` delega en `src/components/studio/` (`StudioTopBar.tsx`, `StudioBottomBar.tsx`, `StudioCanvasOverlays.tsx`).
   - `App.tsx` delega en hooks dedicados en `src/hooks/` (`useLayerManager.ts`, `useDrawingHistory.ts`, `useTracingManager.ts`).
3. **Diseño Móvil Nativo:** Eliminación de patrones de formulario web (botones submit/confirmar). Selección instantánea en 1 toque con retroalimentación háptica y controles segmentados.
4. **Ergonomía Móvil Extrema:** Cero truncamientos tipográficos en selectores modales, touch targets de al menos 48×48px y soporte seguro para `viewport-fit=cover`.
5. **Manipulación Gestual Invariante:** Todo giro de la hoja mediante dedos preserva el trazo exacto bajo el puntero aplicando la transformación inversa en tiempo real sin desfasaje de píxeles.
6. **Preservación y Respeto al Arte del Usuario:** El guardado a galería permite conservar la hoja original o recortar automáticamente los márgenes sobrantes para compartir la ilustración de inmediato con conocimiento de su peso exacto.
7. **Estampado No Destructivo de Accesorios:** Los elementos de galería (moños, stickers) pueden estamparse de forma definitiva en la capa de trabajo o derivarse a una nueva capa separada con instantánea automática para deshacer/rehacer y almacenamiento ACID en SQLite Wasm sobre OPFS.
