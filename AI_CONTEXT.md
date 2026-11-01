# 🤖 AI Context & Reglas del Proyecto - InkFlow Studio (PWA Nativa con Kotlin/Wasm, Rust & C++23)

Este archivo establece el contexto de desarrollo, las restricciones de ingeniería y las reglas inquebrantables que cualquier asistente de inteligencia artificial debe respetar en este repositorio.

---

## 🎯 Perfil del Usuario y Entorno

- **Dispositivo del Usuario:** El usuario opera desde un **teléfono móvil** (sin PC de escritorio). Todas las interfaces, diálogos, deslizadores y botones deben tener un área táctil mínima de 48×48 px, ser cómodos para los dedos y no desbordarse horizontalmente en resoluciones de 360–430 px de ancho.
- **Distribución Exclusiva:** La aplicación es **100% una Progressive Web App (PWA) nativa**. **NO se empaqueta en formato APK ni se distribuye en tiendas de aplicaciones**. Se instala directamente desde el navegador a la pantalla de inicio con soporte standalone (sin barras de URL del navegador).
- **Stack Multi-Lenguaje:**
  - **C++23 Moderno:** Alojado en `src/cpp-core/` bajo estándar ISO/IEC 14882:2023 con conceptos, `std::span` y CMakeLists.txt con target WebAssembly y arquitecturas móviles de 32/64 bits (`arm64-v8a`, `armeabi-v7a`, `x86_64`, `x86`).
  - **Kotlin/Wasm:** Kotlin compila directamente a WebAssembly (`wasmJs` con Wasm-GC) para operar el motor de Lápiz Vectorial analítico sin pixelación al hacer zoom.
  - **Rust/Wasm:** Núcleo de buffers continuos y matemática acelerada en `src/rust-core/src/lib.rs`.
  - **WebGPU (WGSL):** Shaders de sellos radiales y modos de fusión de capas acelerados por GPU.
- **Preferencia de Diseño:** El usuario no tolera el minimalismo extremo ni interfaces amontonadas en una sola pantalla. Se requieren pantallas y apartados independientes para tareas complejas y popups/modales estilo **Bottom Sheet nativo móvil** (sin patrones obsoletos de formulario web como botones de submit tipo "Confirmar y Dibujar"; la selección de herramientas debe ser táctil, inmediata y con vibración háptica).
- **Asistente de Grosor de Trazo 100% REAL:** Mide automáticamente la distribución real de contornos en la foto de calco mediante visión artificial (percentiles Silueta P92, Estructura P68, Detalles P38, Tramas P12) y permite adopción en 1 toque sin obligar al usuario.
- **Paleta y Acabado Visual:** Acabado profesional estilo estudio de arte digital (Grafito oscuro, carbón mate, acentos ámbar dorado y coral). Evitar colores chillones o fondos planos desprovistos de profundidad táctil.
- **Prohibición de Bloqueos en Lienzo:** Ningún menú o cuadro de diálogo debe flotar de forma rígida tapando el lienzo o el dibujo del usuario. Los paneles (como el ajustador de calco) deben ser minimizables o colapsables en 1 toque.
- **Cero Truncamiento en Herramientas:** Los selectores modales (`ToolPickerModal`) deben estructurarse con suficiente ancho o diseño de lista/tarjetas para mostrar el nombre completo de la herramienta sin `truncate` que corte los títulos.
- **Rotación de Lienzo Táctil & Mapeo Inverso:** Al girar el lienzo con dos dedos, los puntos de dibujo deben transformarse inversamente con `unrotatePoint(screenX, screenY, centerX, centerY, rotationDeg)` para que el trazo se dibuje exactamente bajo el dedo sin descalibración.
- **Guardado Inteligente a Galería:** El modal de exportación debe calcular el peso estimado del archivo en tiempo real y permitir tanto la exportación de la "Hoja Completa" como el recorte automático delimitado ("Auto-Crop") detectando los píxeles reales dibujados.

---

## 🛑 Reglas Inmutables de Ingeniería

1. **Arquitectura Exclusivamente PWA:**
   - La aplicación debe funcionar de forma autónoma en el navegador móvil mediante Service Workers y Web App Manifest.
   - Jamás reintroducir archivos o referencias a APK, Gradle, Android Studio o SDKs dependientes de tiendas de aplicaciones.
2. **Integración de Kotlin, Rust y C++23:**
   - C++23 opera en `src/cpp-core/` para visión artificial y muestreo de trazos.
   - Kotlin opera en `src/kotlin-core/` y `src/engine/kotlinWasmBridge.ts`.
   - Rust opera en `src/rust-core/`.
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
   - Siempre verificar cambios de lógica con pruebas unitarias deterministas (`npx --yes tsx --test src/engine/engine.test.ts`) antes de dar por completada la tarea (27 tests pasando).
