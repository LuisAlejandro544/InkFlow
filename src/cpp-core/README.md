# ⚡ Núcleo C++23 (Modern C++ Core) - IbisPaint WebGPU Studio

Este módulo aloja la biblioteca de visión por computadora y análisis geométrico de trazos escrita en la **última versión estándar estable de C++: ISO/IEC 14882:2023 (C++23)**.

---

## 🏛️ Propósito y Arquitectura

1. **Estándar C++23 Moderno:**
   - Hace uso de conceptos (`std::concepts`), vistas de memoria no propietarias (`std::span`), semántica de movimiento estricta y funciones no descartables (`[[nodiscard]]`).
   - Cero sobrecarga de runtime: compilado con `-fno-exceptions` y `-fno-rtti` para huella de binario ultra compacta.
2. **Análisis Real de Grosor de Trazos (*Stroke Thickness Profiling*):**
   - Muestrea imágenes o fotos de calco para medir el ancho físico transversal de las líneas de contorno.
   - Distribuye las mediciones en percentiles para recomendar los 4 roles canónicos de ilustración:
     - **Silueta (P92):** Contornos gruesos exteriores.
     - **Estructura (P68):** Ropa, cabello y anatomía general.
     - **Detalles (P38):** Facciones finas, ojos y dedos.
     - **Tramas (P12):** Micro-líneas y achurado manga.
3. **Cierre Inteligente de Huecos (*Gap-Closing Barrier Bridge*):**
   - Detección y unión de brechas de contorno abiertas en lineart mediante operaciones de dilatación morfológica y erosión topológica en memoria plana continua (`close_boundary_gaps`).
   - Función C-ABI `ibis_close_boundary_gaps` para puente WebAssembly directo (`wasm32` / `wasm64`).
   - Evita la fuga de color en el bote de pintura cuando los trazos del artista no se tocan por 1 a 10 píxeles.
4. **Motor Vectorial Analítico C++23 (*IbisVectorEngine*):**
   - Implementado en `include/IbisVectorEngine.hpp` y `src/IbisVectorEngine.cpp`.
   - Algoritmo de reducción Douglas-Peucker en memoria continua y ajuste continuo Catmull-Rom a Bézier cúbica con continuidad C1.
   - Envoltura de grosor variable adaptada a la dinámica de presión del lápiz táctil.
   - Cero recolector de basura (sin GC) con rendimiento óptimo a 120 FPS y evaluación a escala arbitraria sin pixelación al hacer zoom.
   - Funciones C-ABI: `ibis_vector_simplify_points`, `ibis_vector_generate_bezier_segments`, `ibis_vector_evaluate_bezier`.
5. **Compatibilidad de Arquitecturas:**
   - **Web:** WebAssembly 32-bit (`wasm32`) y 64-bit (`wasm64`) con aceleración vectorial SIMD de 128 bits (`-msimd128`).
   - **Móvil Android (32 y 64 bits):** `arm64-v8a`, `armeabi-v7a`, `x86_64`, `x86`.

---

## 🛠️ Compilación

### Opción 1: Compilación a WebAssembly con Emscripten
```bash
emcmake cmake -B build-wasm -DCMAKE_BUILD_TYPE=Release
cmake --build build-wasm
```

### Opción 2: Compilación Nativa (Clang 17+ o GCC 13+)
```bash
cmake -B build-native -DCMAKE_BUILD_TYPE=Release
cmake --build build-native
```

---

## 📄 Licencia
MIT / Apache-2.0 (Permisiva y comercialmente libre).
