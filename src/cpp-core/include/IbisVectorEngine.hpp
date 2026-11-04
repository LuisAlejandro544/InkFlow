/**
 * @file IbisVectorEngine.hpp
 * @brief Motor vectorial analítico en C++23 (ISO/IEC 14882:2023).
 * 
 * Implementa la computación geométrica de trazos para el Lápiz Vectorial:
 * 1. Estructuras de datos contiguas sin overhead de recolección de basura (VectorPoint2D, CubicBezier2D).
 * 2. Algoritmo de reducción de ruido y simplificación Douglas-Peucker en memoria continua.
 * 3. Generación de curvas Bézier cúbicas con tangentes continuas Catmull-Rom (Continuidad C1).
 * 4. Dinámicas de grosor adaptativo basadas en la presión del sensor táctil (Stylus / Touch).
 * 5. Evaluación analítica de puntos y vectores normales para renderizado nítido a cualquier nivel de zoom.
 * 
 * Arquitecturas soportadas:
 * - WebAssembly (wasm32 / wasm64) con SIMD128.
 * - Android NDK nativo (arm64-v8a, armeabi-v7a, x86_64, x86).
 * 
 * Licencia: MIT / Apache-2.0 (Permisiva sin restricciones copyleft).
 */

#pragma once

#include <cstdint>
#include <cstddef>
#include <cmath>
#include <vector>
#include <span>
#include <concepts>
#include <utility>
#include <algorithm>

namespace ibis::vision::vector {

/**
 * @concept FloatingPointCoord
 * @brief Concepto C++23 para restringir tipos escalares a coma flotante
 */
template <typename T>
concept FloatingPointCoord = std::is_floating_point_v<T>;

/**
 * @struct VectorPoint2D
 * @brief Coordenada puntual plana con presión y marca de tiempo
 */
struct VectorPoint2D {
    float x{0.0f};
    float y{0.0f};
    float pressure{0.5f};
    float timestamp{0.0f};

    [[nodiscard]] constexpr float distance_to(const VectorPoint2D& other) const noexcept {
        const float dx = other.x - x;
        const float dy = other.y - y;
        return std::sqrt(dx * dx + dy * dy);
    }

    [[nodiscard]] constexpr VectorPoint2D lerp(const VectorPoint2D& other, float t) const noexcept {
        return VectorPoint2D{
            .x = x + (other.x - x) * t,
            .y = y + (other.y - y) * t,
            .pressure = pressure + (other.pressure - pressure) * t,
            .timestamp = timestamp + (other.timestamp - timestamp) * t
        };
    }
};

/**
 * @struct CubicBezier2D
 * @brief Segmento Bézier cúbico paramétrico con grosor variable en extremos
 */
struct CubicBezier2D {
    VectorPoint2D p0{};
    VectorPoint2D cp1{};
    VectorPoint2D cp2{};
    VectorPoint2D p1{};
    float width0{1.0f};
    float width1{1.0f};

    /**
     * @brief Evalúa el punto en la curva para t en [0.0, 1.0]
     */
    [[nodiscard]] constexpr VectorPoint2D evaluate(float t) const noexcept {
        const float u = 1.0f - t;
        const float tt = t * t;
        const float uu = u * u;
        const float uuu = uu * u;
        const float ttt = tt * t;

        const float x = uuu * p0.x + 3.0f * uu * t * cp1.x + 3.0f * u * tt * cp2.x + ttt * p1.x;
        const float y = uuu * p0.y + 3.0f * uu * t * cp1.y + 3.0f * u * tt * cp2.y + ttt * p1.y;
        const float pressure = u * p0.pressure + t * p1.pressure;

        return VectorPoint2D{.x = x, .y = y, .pressure = pressure, .timestamp = 0.0f};
    }

    /**
     * @brief Calcula la normal unitaria perpendicular a la tangente en t
     */
    [[nodiscard]] std::pair<float, float> normal_at(float t) const noexcept {
        const float u = 1.0f - t;
        // Primera derivada de la curva de Bézier cúbica
        const float dx = 3.0f * u * u * (cp1.x - p0.x) + 6.0f * u * t * (cp2.x - cp1.x) + 3.0f * t * t * (p1.x - cp2.x);
        const float dy = 3.0f * u * u * (cp1.y - p0.y) + 6.0f * u * t * (cp2.y - cp1.y) + 3.0f * t * t * (p1.y - cp2.y);
        const float len = std::sqrt(dx * dx + dy * dy);
        if (len < 1e-6f) return {0.0f, 1.0f};
        return {-dy / len, dx / len};
    }
};

/**
 * @class CppVectorEngine
 * @brief Motor geométrico en C++23 para cálculo y suavizado de curvas de trazo
 */
class CppVectorEngine {
public:
    constexpr CppVectorEngine() noexcept = default;
    ~CppVectorEngine() noexcept = default;

    // Regla de los cinco en C++23
    CppVectorEngine(const CppVectorEngine&) = default;
    CppVectorEngine& operator=(const CppVectorEngine&) = default;
    CppVectorEngine(CppVectorEngine&&) noexcept = default;
    CppVectorEngine& operator=(CppVectorEngine&&) noexcept = default;

    /**
     * @brief Simplifica la nube de puntos mediante Douglas-Peucker en memoria continua
     * @param points Vista de puntos de entrada
     * @param epsilon Tolerancia de distancia perpendicular
     * @return Vector de puntos clave simplificados
     */
    [[nodiscard]] auto simplify_points(
        std::span<const VectorPoint2D> points,
        float epsilon = 0.4f
    ) const -> std::vector<VectorPoint2D>;

    /**
     * @brief Genera segmentos Bézier cúbicos continuos con Catmull-Rom
     * @param points Puntos discretos muestreados por el sensor táctil
     * @param base_width Grosor nominal base del pincel en píxeles
     * @param tension Tensión de curva (0.5 recomendada)
     * @return Lista de segmentos Bézier calculados
     */
    [[nodiscard]] auto generate_bezier_segments(
        std::span<const VectorPoint2D> points,
        float base_width,
        float tension = 0.5f
    ) const -> std::vector<CubicBezier2D>;

private:
    [[nodiscard]] static float perpendicular_distance(
        const VectorPoint2D& pt,
        const VectorPoint2D& line_start,
        const VectorPoint2D& line_end
    ) noexcept;
};

} // namespace ibis::vision::vector

// ============================================================================
// Enlaces de C (ABI C99) para exportación hacia WebAssembly (Emscripten / Wasm)
// ============================================================================
extern "C" {

/**
 * @brief Simplifica puntos táctiles desde JavaScript/Wasm
 * Formato del buffer: [x0, y0, p0, x1, y1, p1, ...] (3 floats por punto)
 * @return Cantidad de puntos resultantes
 */
[[maybe_unused]] int32_t ibis_vector_simplify_points(
    const float* in_pts_data,
    int32_t in_count,
    float epsilon,
    float* out_pts_data
);

/**
 * @brief Genera segmentos Bézier cúbicos continuos
 * Formato de salida: 10 floats por segmento (p0.x, p0.y, cp1.x, cp1.y, cp2.x, cp2.y, p1.x, p1.y, width0, width1)
 * @return Cantidad de segmentos Bézier generados
 */
[[maybe_unused]] int32_t ibis_vector_generate_bezier_segments(
    const float* in_pts_data,
    int32_t in_count,
    float base_width,
    float tension,
    float* out_segments_data
);

/**
 * @brief Evalúa analíticamente un punto t en una curva Bézier cúbica
 */
[[maybe_unused]] void ibis_vector_evaluate_bezier(
    float p0x, float p0y,
    float cp1x, float cp1y,
    float cp2x, float cp2y,
    float p1x, float p1y,
    float t,
    float* out_xy
);

}
