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

El proyecto cuenta con **27 pruebas unitarias automatizadas deterministas** con `node:test` (`npx --yes tsx --test src/engine/engine.test.ts`):
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
20. **Mapeo Canónico Exacto de Pantalla a Lienzo con Rotación (`screenToCanvasCoords`).**
21. **Reversibilidad y Consistencia Biyectiva (`canvasToScreenCoords` <-> `screenToCanvasCoords`).**
22. **Normalización angular continua al cruzar la frontera $[-\pi, \pi]$ en rotación.**

```bash
npx --yes tsx --test src/engine/engine.test.ts
```

---

## ☁️ Despliegue en Cloudflare Pages vía GitHub Actions

El repositorio incluye un workflow en `.github/workflows/deploy.yml` configurado para **activación exclusivamente manual** (`workflow_dispatch`).

### Pasos:
1. Configura en GitHub Secrets: `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID`.
2. En GitHub ➔ pestaña **Actions** ➔ selecciona **"InkFlow - Compilar WebAssembly (C++, Rust, Kotlin) y Desplegar a Cloudflare Pages"** ➔ pulsa **"Run workflow"**.
3. El runner compilará los núcleos Wasm de Rust (`wasm32-unknown-unknown`), C++23 con Emscripten (`simd128`), ejecutará las 27 pruebas unitarias, generará la PWA estática y la desplegará en tu cuenta de Cloudflare con **$0 de coste** y ancho de banda ilimitado.

---

## 📄 Licencia

MIT / Apache-2.0. Permisiva y apta para uso comercial y personal sin restricciones de copyleft ni código abierto obligatorio.
