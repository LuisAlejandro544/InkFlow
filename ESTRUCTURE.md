# 🏛️ Estructura del Proyecto - InkFlow Studio (PWA Nativa con Kotlin/Wasm, Rust & C++23)

Este documento detalla la arquitectura de archivos, la responsabilidad de cada módulo y el flujo de datos del motor de dibujo digital basado en **PWA Nativa**, **WebGPU**, **Kotlin/Wasm**, **Rust/Wasm**, **C++23** y **React 19 / TypeScript**.

---

## 🌳 Árbol de Archivos del Proyecto

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
│   │   │   └── IbisStrokeAnalyzer.hpp # Cabecera C++23 con conceptos, std::span y exportación C-ABI
│   │   ├── src/
│   │   │   └── IbisStrokeAnalyzer.cpp # Detección de grosor por percentiles y análisis transversal
│   │   ├── CMakeLists.txt        # Configuración CMake con soporte Wasm SIMD128 y NDK 32/64 bits
│   │   └── README.md             # Documentación técnica del módulo C++23
│   ├── kotlin-core/              # Código fuente en Kotlin para WebAssembly (Kotlin/Wasm)
│   │   └── VectorEngine.kt       # Algoritmos Bézier, Catmull-Rom, Douglas-Peucker y curvas continuas
│   ├── rust-core/                # Código fuente en Rust para compilación a Wasm
│   │   ├── Cargo.toml            # Configuración de paquete Rust y perfil wasm32
│   │   └── src/
│   │       └── lib.rs            # Matemática vectorial, estabilizador y buffers VBO
│   ├── engine/                   # Motor gráfico central desacoplado de la interfaz
│   │   ├── types.ts              # Definición de tipos: Layer, ToolType, Point, VectorStroke, TracingReference
│   │   ├── wasmEngine.ts         # Binario Wasm, estabilizador S-Form y cálculo de presión
│   │   ├── wasmStreamingCompiler.ts # Compilador JIT streaming a código máquina CPU con caché nativa
│   │   ├── bitmapCache.ts        # Caché VRAM en GPU con ImageBitmap off-thread y gestión LRU
│   │   ├── transformMath.ts      # Matemática pura: zoom, rotación 2D, snapping, screenToCanvasCoords y auto-crop
│   │   ├── tracingEngine.ts      # Motor de calco: Extracción Sobel de Lineart, contraste y paletas Wasm
│   │   ├── strokeAssistant.ts    # Asistente REAL de Grosor: Visión artificial, percentiles y muestreo local
│   │   ├── kotlinWasmBridge.ts   # Puente de ejecución Kotlin/Wasm para Lápiz Vectorial (cero píxeles al zoom)
│   │   ├── environmentDetector.ts# Detección determinista de PWA Standalone vs Navegador y excepción de Preview
│   │   ├── webgpuEngine.ts       # Pipeline WebGPU con shaders WGSL, fallback y composición vectorial
│   │   └── engine.test.ts        # Suite de 32 pruebas unitarias deterministas (node:test)
│   ├── storage/                  # Motor de Persistencia Masiva SQLite Wasm & OPFS en Web Worker
│   │   ├── sqliteTypes.ts        # Tipos y contratos IPC de serialización relacional
│   │   ├── sqliteStorage.worker.ts # Web Worker dedicado ejecutando @sqlite.org/sqlite-wasm sobre OPFS
│   │   ├── sqliteStorageService.ts # Servicio cliente con auto-guardado debounced y centinela de ciclo de vida
│   │   └── storage.test.ts       # 5 pruebas unitarias deterministas de SQLite Wasm y Crash Recovery
│   ├── store/                    # Gestión de estado global
│   │   └── drawingStore.ts       # Estado del proyecto, capas, paleta y herramientas
│   ├── components/               # Componentes modulares de interfaz de usuario
│   │   ├── WelcomeScreen.tsx     # Pantalla de bienvenida, catálogo de funciones pro y descarga PWA en navegador
│   │   ├── StudioScreen.tsx      # Lienzo táctil con Pinch/Rotate/Pan a dos dedos, barra móvil anti-overflow
│   │   ├── TracingAdjuster.tsx   # Superposición táctil minimizable para mover, rotar, escalar y filtrar foto
│   │   ├── StrokeGuideAssistant.tsx # Barra ergonómica con recomendación calibrada por visión artificial
│   │   ├── GalleryScreen.tsx     # Pantalla de galería y creación de nuevos lienzos
│   │   ├── EngineInfoScreen.tsx  # Diagnóstico técnico de WebGPU, Kotlin/Wasm, Rust, C++23 y PWA
│   │   ├── LayersModal.tsx       # Gestor de capas estilo IbisPaint con importador de calco
│   │   ├── ColorPickerModal.tsx  # Rueda HSV, sliders RGB y muestras de color de la foto
│   │   ├── ToolPickerModal.tsx   # Bottom sheet nativo móvil con pestañas Herramientas y Estabilizador
│   │   ├── ExportModal.tsx       # Guardado de obra a galería con Hoja Completa vs Auto-crop y peso en KB/MB
│   │   ├── ErrorBoundary.tsx     # Captura de excepciones de interfaz para evitar pantalla blanca
│   │   └── usePWAInstall.ts      # Hook reactivo de instalación PWA en pantalla de inicio
│   ├── App.tsx                   # Componente raíz con ciclo de vida e historial de estados
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
[ Foto de Galería para Calco ]
              │
              ▼
[ TracingEngine / StrokeAssistant (C++23 & Wasm/TS) ]
              │
              ├── Convolución y Luminancia BT.709
              ├── Muestreo transversal ortogonal de líneas
              └── Cálculo de percentiles (Silueta P92, Estructura P68, Detalles P38, Tramas P12)
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
2. **Diseño Móvil Nativo:** Eliminación de patrones de formulario web (botones submit/confirmar). Selección instantánea en 1 toque con retroalimentación háptica y controles segmentados.
3. **Ergonomía Móvil Extrema:** Cero truncamientos tipográficos en selectores modales, touch targets de al menos 48×48px y soporte seguro para `viewport-fit=cover`.
4. **Manipulación Gestual Invariante:** Todo giro de la hoja mediante dedos preserva el trazo exacto bajo el puntero aplicando la transformación inversa en tiempo real sin desfasaje de píxeles.
5. **Preservación y Respeto al Arte del Usuario:** El guardado a galería permite conservar la hoja original o recortar automáticamente los márgenes sobrantes para compartir la ilustración de inmediato con conocimiento de su peso exacto.
