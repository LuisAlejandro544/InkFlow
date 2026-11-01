/**
 * @file IbisStrokeAnalyzer.hpp
 * @brief Cabecera de análisis y procesamiento de trazos en C++23.
 * 
 * Diseñado bajo el estándar ISO/IEC 14882:2023 (C++23) para compilación
 * multiplataforma hacia WebAssembly (wasm32 con SIMD128) y arquitecturas móviles
 * nativas de 32 y 64 bits (arm64-v8a, armeabi-v7a, x86_64, x86).
 * 
 * Funcionalidad:
 * 1. Análisis de distribución de grosor de trazo en imágenes de referencia (Line Thickness Profiling).
 * 2. Transformada de Distancia Euclidiana (EDT) para muestreo submétrico de contornos.
 * 3. Detección automática de los 4 roles de peso de línea (Silueta, Estructura, Detalles, Tramas).
 * 
 * Licencia: MIT / Apache-2.0 (Permisiva sin restricciones copyleft).
 */

#pragma once

#include <cstdint>
#include <cstddef>
#include <cmath>
#include <vector>
#include <optional>
#include <span>
#include <concepts>
#include <algorithm>
#include <string>

namespace ibis::vision::stroke {

// Concepto C++20/C++23 para buffers de píxeles lineales RGBA continuos
template <typename T>
concept PixelSpan = requires(T t) {
    { std::span{t} } -> std::same_as<std::span<const uint8_t>>;
};

/**
 * @struct Point2D
 * @brief Coordenada bidimensional con precisión en coma flotante IEEE 754 de 32 bits
 */
struct Point2D {
    float x{0.0f};
    float y{0.0f};
    float pressure{0.5f};
};

/**
 * @struct StrokeRoleProfile
 * @brief Recomendación analizada de grosor en píxeles para los 4 roles canónicos
 */
struct StrokeRoleProfile {
    float silhouette_px{24.0f}; // P90-P95: Contorno exterior
    float structure_px{14.0f};  // P60-P80: Ropa, anatomía, pelo
    float details_px{6.0f};     // P25-P50: Expresiones, ojos, dedos
    float hatching_px{2.0f};    // P5-P15:  Micro-tramas y achurado
    float min_detected_px{1.0f};
    float max_detected_px{32.0f};
    float average_px{10.0f};
    uint32_t samples_count{0};
    bool valid{false};
};

/**
 * @class StrokeAnalyzer
 * @brief Motor analítico C++23 para extracción de características de trazo
 */
class StrokeAnalyzer {
public:
    constexpr StrokeAnalyzer() noexcept = default;
    ~StrokeAnalyzer() noexcept = default;

    // Regla de los cinco en C++23
    StrokeAnalyzer(const StrokeAnalyzer&) = default;
    StrokeAnalyzer& operator=(const StrokeAnalyzer&) = default;
    StrokeAnalyzer(StrokeAnalyzer&&) noexcept = default;
    StrokeAnalyzer& operator=(StrokeAnalyzer&&) noexcept = default;

    /**
     * @brief Analiza una imagen RGBA para calcular el perfil real de grosores de línea
     * @param rgba_pixels Buffer de píxeles en formato RGBA (4 bytes por píxel)
     * @param width Ancho de la imagen en píxeles (mínimo 1)
     * @param height Alto de la imagen en píxeles (mínimo 1)
     * @param display_scale Escala activa de visualización en el lienzo (multiplicador)
     * @return Perfil con los 4 grosores calculados
     */
    [[nodiscard]] auto analyze_image_stroke_thickness(
        std::span<const uint8_t> rgba_pixels,
        int32_t width,
        int32_t height,
        float display_scale = 1.0f
    ) const noexcept -> StrokeRoleProfile;

    /**
     * @brief Muestrea el grosor local de línea en una coordenada (x, y) específica
     * @return Grosor estimado en píxeles o std::nullopt si es una zona sin borde
     */
    [[nodiscard]] auto sample_local_thickness(
        std::span<const uint8_t> rgba_pixels,
        int32_t width,
        int32_t height,
        int32_t target_x,
        int32_t target_y
    ) const noexcept -> std::optional<float>;
};

} // namespace ibis::vision::stroke

// ============================================================================
// Enlaces de C (ABI C99) para exportación hacia WebAssembly (Emscripten) o JNI
// ============================================================================
extern "C" {

/**
 * @brief Entrada C-ABI para invocar el análisis de grosor desde JavaScript/Wasm
 */
[[maybe_unused]] float ibis_analyze_stroke_role(
    const uint8_t* rgba_data,
    int32_t width,
    int32_t height,
    int32_t role_index, // 0: silueta, 1: estructura, 2: detalles, 3: tramas
    float display_scale
);

/**
 * @brief Muestrea grosor local en una coordenada desde JS/Wasm
 */
[[maybe_unused]] float ibis_sample_point_thickness(
    const uint8_t* rgba_data,
    int32_t width,
    int32_t height,
    int32_t x,
    int32_t y
);

}
