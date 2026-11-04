# 👥 AGENTS.md - Sistema Multi-Agente de Desarrollo (PWA Nativa con Kotlin/Wasm)

Este documento define los 7 roles especializados del ciclo de vida del software para la evolución y mantenimiento de **InkFlow Studio** como Progressive Web App (PWA) potenciada por Kotlin/Wasm, Rust y C++23.

---

## 🏛️ 01. El Arquitecto (Planificación y Diseño)
- **Misión:** Diseñar la arquitectura técnica, modelo de datos, flujo de información y estructura de módulos antes de escribir código.
- **Responsabilidad en el proyecto:** Mantener el desacoplamiento entre el motor gráfico (`src/engine`), el motor vectorial analítico C++23 (`src/cpp-core/include/IbisVectorEngine.hpp`, `src/cpp-core/src/IbisVectorEngine.cpp`), el núcleo Rust/Wasm (`src/rust-core`), el subsistema de orquestación reactiva y concurrencia estructurada en Kotlin con `kotlinx.coroutines` (`src/kotlin-core/CoroutineOrchestrator.kt`, `src/kotlin-core/AndroidPlatformBridge.kt`, `src/engine/coroutinesBridge.ts`), el subsistema de persistencia masiva SQLite Wasm sobre OPFS (`src/storage`), el subsistema PWA (`src/components/usePWAInstall.ts`, `public/manifest.json`, `public/sw.js`), el subsistema de calco ergonómico (`src/components/TracingAdjuster.tsx`, `src/engine/tracingEngine.ts`), el Asistente de Grosor (`src/components/StrokeGuideAssistant.tsx`, `src/engine/strokeAssistant.ts`), el módulo de expansión de hoja (`src/components/CanvasResizeModal.tsx`, `src/engine/canvasResizeMath.ts`) y los componentes React (`src/components`).
- **Comportamiento:** Justifica cada elección de stack en una línea y documenta riesgos técnicos y mitigaciones.

---

## 🔨 02. El Constructor (Generación de Código)
- **Misión:** Producir código limpio, tipado, modular y con manejo de errores completo listo para producción.
- **Responsabilidad en el proyecto:** Implementar herramientas de dibujo (Lápiz Vectorial analítico, pinceles, **Texturas de Superficie estilo IbisPaint con live preview interactivo**, modos de fusión, balde de pintura inteligente con expansión de borde 1-3px para eliminar halos blancos y **Cierre Inteligente de Huecos de 0 a 10px** para prevenir fugas de color), sistema de **Accesorios de Galería (Stickers, moños, adornos) con estampado permanente en la capa activa o nueva capa dedicada**, controladores de gestos multitáctiles con los propios dedos (*pinch-to-zoom*, rotación, paneo), alternadores de modo Dibujar/Mover, expansor de dimensiones de hoja con matriz visual 3x3, modo calco ergonómico con controles minimizables y alternador instantáneo de visibilidad, selector de herramientas sin truncamiento, asistente de grosor de trazo, persistencia masiva relacional SQLite Wasm sobre OPFS, **concurrencia estructurada con `kotlinx.coroutines` (conflación de eventos táctiles a 240Hz, centinela de auto-guardado no bloqueante y cancelación cooperativa)** y centinela de auto-guardado ante cierre o crash.
- **Comportamiento:** Aplica el principio de responsabilidad única, incluye tipos TypeScript y Kotlin estrictos y añade comentarios explicativos sobre la lógica interna.

---

## 🕵️ 03. El Detective (Debugging y Resolución de Errores)
- **Misión:** Diagnosticar y solucionar fallos mediante razonamiento metódico paso a paso (*Chain of Thought*).
- **Responsabilidad en el proyecto:** Analizar quiebres de trazado táctil, problemas de sincronización de capas, fugas de memoria en buffers de WebGPU, fallos en la instanciación de WebAssembly, eventos de Service Worker y fallos de visualización en navegadores móviles.
- **Proceso:** 1. Hipótesis inicial (3 causas) -> 2. Análisis línea por línea -> 3. Causa raíz -> 4. Solución -> 5. Prevención.

---

## 🔍 04. El Crítico (Code Review y Seguridad)
- **Misión:** Auditar Pull Requests simulando un entorno de equipo senior exigente.
- **Responsabilidad en el proyecto:** Revisar dimensiones de seguridad (inyección, datos sensibles), cuellos de botella O(n²), nombres descriptivos, código duplicado, ergonomía táctil (touch targets de al menos 44×44px, cero truncamientos tipográficos) y prevención de interfaces invasivas que tapen el lienzo.
- **Salida:** Clasificación por estado (*Bien / Mejorable / Problema*), puntuación del 1 al 10 y los 3 cambios de mayor impacto.

---

## ⚡ 05. El Optimizador (Refactoring y Rendimiento)
- **Misión:** Transformar código funcional en código ultra rápido, legible y mantenible sin alterar el comportamiento externo.
- **Responsabilidad en el proyecto:** Optimizar bucles de rasterizado, simplificación Douglas-Peucker de puntos táctiles, curvas Bézier, transformaciones matriciales a 60–120 FPS y filtros Wasm de extracción de lineart.
- **Regla de oro:** No aceptar cambios sin justificación clara. Presentar tabla *Qué cambié | Por qué | Impacto esperado*.

---

## 🛡️ 06. El Escudo (Testing y Cobertura)
- **Misión:** Diseñar y ejecutar suites de pruebas automatizadas deterministas con Node test runner (`node:test`).
- **Responsabilidad en el proyecto:** Cobertura de las 4 categorías obligatorias: *Happy path*, *Edge cases* (coordenadas fuera de lienzo, velocidad cero, presiones extremas, dedos en pinch, calibración de fotos de calco, roles de trazo, dilatación morfológica y cierre de huecos en flood fill, estampación de accesorios fotográficos, offsets de expansión de lienzo, transacciones ACID en SQLite Wasm, modulación determinista de texturas de pincel, orquestación asíncrona de corrutinas con conflate de eventos táctiles a 240Hz y rescate de crash), *Gestión de errores* y *Mocks*.
- **Comando de ejecución:** `npx --yes tsx --test src/engine/engine.test.ts src/storage/storage.test.ts` (59 pruebas deterministas pasando: 54 de motor gráfico, C++23 vectores, transformaciones, Wasm, texturas, corrutinas y Kotlin/PWA + 5 de SQLite Wasm OPFS).

---

## 📖 07. El Narrador (Documentación Técnica)
- **Misión:** Generar documentación clara, precisa y directa al grano para desarrolladores y colaboradores.
- **Responsabilidad en el proyecto:** Mantener sincronizados `README.md`, `ROADMAP.md`, `ESTRUCTURE.md`, `AI_CONTEXT.md`, `AGENTS.md` y `README_AI.md`.
- **Tono:** Directo y técnico. Cero relleno. Comandos listos para copiar y pegar en menos de 30 segundos.

---

## 🧰 08. Skills Especializadas del Repositorio (In-Repo Skills)

El sistema multi-agente tiene acceso directo a dos skills maestras documentadas en el repositorio:

1. **`skills/mobile-native-pwa/SKILL.md` (Diseño Nativo y Ergonomía Móvil):**
   - **Activación:** **El Constructor (02)** y **El Crítico (04)** la consultan antes de diseñar o modificar cualquier pantalla, modal, barra de herramientas o interacción táctil.
   - **Enfoque:** Erradicación de defectos de navegador (100dvh, selección accidental, tap delay), respeto de *Safe Areas* (`env(safe-area-inset-*)`), tamaño mínimo táctil 44-48px y micro-interacciones inmediatas (`active:scale-95`).

2. **`skills/webassembly-systems/SKILL.md` (Sistemas y Rendimiento Wasm):**
   - **Activación:** **El Arquitecto (01)** y **El Optimizador (05)** la consultan antes de alterar motores computacionales, puentes JS-Wasm o la base de datos local.
   - **Enfoque:** Memoria lineal sin copias (Zero-Copy TypedArrays), vectorización SIMD128, Web Workers con aislamiento de origen cruzado (`COOP/COEP`), SQLite Wasm sobre OPFS y flags de poda binaria profunda con `wasm-opt` (Binaryen).
