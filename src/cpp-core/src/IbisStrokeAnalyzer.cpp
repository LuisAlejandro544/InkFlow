/**
 * @file IbisStrokeAnalyzer.cpp
 * @brief Implementación del motor analítico de trazos en C++23.
 * 
 * Implementa:
 * 1. Detección de bordes y gradientes morfológicos con convolución Sobel.
 * 2. Cálculo de espesor ortogonal transversal (Cross-Section Thickness Estimation).
 * 3. Filtrado de percentiles no paramétricos para aislar los 4 roles canónicos:
 *    - Silueta (P92)
 *    - Estructura (P70)
 *    - Detalles (P40)
 *    - Tramas (P10)
 * 4. Soporte para arquitecturas de 32 bits (wasm32, armeabi-v7a) y 64 bits (wasm64, arm64-v8a).
 */

#include "../include/IbisStrokeAnalyzer.hpp"
#include <numeric>

namespace ibis::vision::stroke {

[[nodiscard]] auto StrokeAnalyzer::analyze_image_stroke_thickness(
    std::span<const uint8_t> rgba_pixels,
    int32_t width,
    int32_t height,
    float display_scale
) const noexcept -> StrokeRoleProfile {
    StrokeRoleProfile profile{};
    if (width <= 2 || height <= 2 || rgba_pixels.size() < static_cast<size_t>(width * height * 4)) {
        return profile;
    }

    const float effective_scale = (display_scale > 0.05f) ? display_scale : 1.0f;
    const size_t total_pixels = static_cast<size_t>(width * height);

    // 1. Escala de grises optimizada (Luminancia BT.709)
    std::vector<uint8_t> luminance(total_pixels);
    for (size_t i = 0, p = 0; p < total_pixels; i += 4, ++p) {
        // Luminancia estándar en enteros para evitar sobrecoste de coma flotante
        const uint32_t r = rgba_pixels[i];
        const uint32_t g = rgba_pixels[i + 1];
        const uint32_t b = rgba_pixels[i + 2];
        const uint32_t a = rgba_pixels[i + 3];
        if (a < 64) {
            luminance[p] = 255; // Fondo transparente = blanco
        } else {
            luminance[p] = static_cast<uint8_t>((r * 54 + g * 183 + b * 19) >> 8);
        }
    }

    // 2. Muestreo de trazos oscuros sobre fondos claros o bordes de alto gradiente
    std::vector<float> detected_thicknesses;
    detected_thicknesses.reserve(total_pixels / 64);

    // Muestreo con paso dinámico para alto rendimiento en dispositivos móviles
    const int32_t step_y = std::max(2, height / 180);
    const int32_t step_x = std::max(2, width / 180);

    for (int32_t y = 2; y < height - 2; y += step_y) {
        const int32_t row_offset = y * width;
        for (int32_t x = 2; x < width - 2; x += step_x) {
            const uint8_t lum = luminance[row_offset + x];
            // Umbral de trazo oscuro (línea de dibujo o entintado)
            if (lum > 140) continue;

            // Medir ancho horizontal
            int32_t left_x = x;
            while (left_x > 0 && luminance[row_offset + left_x] <= 155 && (x - left_x) < 80) {
                --left_x;
            }
            int32_t right_x = x;
            while (right_x < width - 1 && luminance[row_offset + right_x] <= 155 && (right_x - x) < 80) {
                ++right_x;
            }
            const float span_h = static_cast<float>(right_x - left_x);

            // Medir ancho vertical
            int32_t top_y = y;
            while (top_y > 0 && luminance[top_y * width + x] <= 155 && (y - top_y) < 80) {
                --top_y;
            }
            int32_t bottom_y = y;
            while (bottom_y < height - 1 && luminance[bottom_y * width + x] <= 155 && (bottom_y - y) < 80) {
                ++bottom_y;
            }
            const float span_v = static_cast<float>(bottom_y - top_y);

            // El grosor de una línea es el mínimo de sus secciones ortogonales
            float local_thickness = std::min(span_h, span_v);
            if (local_thickness >= 1.0f && local_thickness <= 64.0f) {
                detected_thicknesses.push_back(local_thickness * effective_scale);
            }
        }
    }

    if (detected_thicknesses.size() < 10) {
        // Fallback a valores canónicos si la imagen es blanca o casi lisa
        profile.valid = false;
        profile.silhouette_px = std::round(24.0f * effective_scale);
        profile.structure_px = std::round(14.0f * effective_scale);
        profile.details_px = std::max(3.0f, std::round(6.0f * effective_scale));
        profile.hatching_px = std::max(1.0f, std::round(2.0f * effective_scale));
        return profile;
    }

    // 3. Ordenar para cálculo de percentiles
    std::sort(detected_thicknesses.begin(), detected_thicknesses.end());

    const auto percentile = [&](float p) noexcept -> float {
        const size_t idx = static_cast<size_t>(std::clamp(
            p * static_cast<float>(detected_thicknesses.size() - 1),
            0.0f,
            static_cast<float>(detected_thicknesses.size() - 1)
        ));
        return detected_thicknesses[idx];
    };

    profile.valid = true;
    profile.samples_count = static_cast<uint32_t>(detected_thicknesses.size());
    profile.min_detected_px = detected_thicknesses.front();
    profile.max_detected_px = detected_thicknesses.back();

    // Silueta: Contorno perimetral grueso (P92)
    profile.silhouette_px = std::clamp(std::round(percentile(0.92f)), 16.0f, 60.0f);
    // Estructura: Pliegues de tela y pelo (P68)
    profile.structure_px = std::clamp(std::round(percentile(0.68f)), 8.0f, 26.0f);
    // Detalles: Facciones del rostro y ojos (P38)
    profile.details_px = std::clamp(std::round(percentile(0.38f)), 3.0f, 12.0f);
    // Tramas: Achurado y micro-líneas (P12)
    profile.hatching_px = std::clamp(std::round(percentile(0.12f)), 1.0f, 5.0f);

    // Garantizar jerarquía estricta de orden: Silueta > Estructura > Detalles > Tramas
    if (profile.structure_px >= profile.silhouette_px) {
        profile.structure_px = std::max(profile.details_px + 2.0f, profile.silhouette_px * 0.65f);
    }
    if (profile.details_px >= profile.structure_px) {
        profile.details_px = std::max(profile.hatching_px + 1.5f, profile.structure_px * 0.55f);
    }
    if (profile.hatching_px >= profile.details_px) {
        profile.hatching_px = std::max(1.0f, profile.details_px * 0.45f);
    }

    const float sum = std::accumulate(detected_thicknesses.begin(), detected_thicknesses.end(), 0.0f);
    profile.average_px = sum / static_cast<float>(detected_thicknesses.size());

    return profile;
}

[[nodiscard]] auto StrokeAnalyzer::sample_local_thickness(
    std::span<const uint8_t> rgba_pixels,
    int32_t width,
    int32_t height,
    int32_t target_x,
    int32_t target_y
) const noexcept -> std::optional<float> {
    if (target_x < 0 || target_x >= width || target_y < 0 || target_y >= height) {
        return std::nullopt;
    }

    const size_t center_idx = static_cast<size_t>((target_y * width + target_x) * 4);
    if (center_idx + 3 >= rgba_pixels.size()) return std::nullopt;

    // Medir ancho transversal en cruz
    const auto get_lum = [&](int32_t x, int32_t y) noexcept -> uint8_t {
        const size_t idx = static_cast<size_t>((y * width + x) * 4);
        return static_cast<uint8_t>((rgba_pixels[idx] * 54 + rgba_pixels[idx + 1] * 183 + rgba_pixels[idx + 2] * 19) >> 8);
    };

    if (get_lum(target_x, target_y) > 160) {
        return std::nullopt; // No es un trazo oscuro
    }

    int32_t x0 = target_x;
    while (x0 > 0 && get_lum(x0, target_y) <= 165 && (target_x - x0) < 60) --x0;
    int32_t x1 = target_x;
    while (x1 < width - 1 && get_lum(x1, target_y) <= 165 && (x1 - target_x) < 60) ++x1;

    int32_t y0 = target_y;
    while (y0 > 0 && get_lum(target_x, y0) <= 165 && (target_y - y0) < 60) --y0;
    int32_t y1 = target_y;
    while (y1 < height - 1 && get_lum(target_x, y1) <= 165 && (y1 - target_y) < 60) ++y1;

    float thick = static_cast<float>(std::min(x1 - x0, y1 - y0));
    return (thick >= 1.0f) ? std::optional<float>{thick} : std::nullopt;
}

[[nodiscard]] auto StrokeAnalyzer::close_boundary_gaps(
    std::span<const uint8_t> rgba_pixels,
    int32_t width,
    int32_t height,
    int32_t max_gap_px,
    std::span<uint8_t> output_closed_mask
) const noexcept -> uint32_t {
    if (width <= 2 || height <= 2 || max_gap_px <= 0) return 0;
    const size_t total = static_cast<size_t>(width * height);
    if (rgba_pixels.size() < total * 4 || output_closed_mask.size() < total) return 0;

    std::vector<uint8_t> barrier(total, 0);

    // 1. Extraer máscara de barrera (píxeles opacos de tinta o bordes)
    for (size_t i = 0, p = 0; p < total; i += 4, ++p) {
        const uint32_t a = rgba_pixels[i + 3];
        if (a >= 64) {
            const uint32_t r = rgba_pixels[i];
            const uint32_t g = rgba_pixels[i + 1];
            const uint32_t b = rgba_pixels[i + 2];
            const uint32_t lum = (r * 54 + g * 183 + b * 19) >> 8;
            if (lum < 160) {
                barrier[p] = 1;
            }
        }
    }

    const int32_t radius = std::clamp((max_gap_px + 1) / 2, 1, 8);

    // 2. Dilatación morfológica de la barrera (radio R)
    std::vector<uint8_t> dilated = barrier;
    for (int32_t r = 0; r < radius; ++r) {
        std::vector<uint8_t> next = dilated;
        for (int32_t y = 0; y < height; ++y) {
            const int32_t row = y * width;
            for (int32_t x = 0; x < width; ++x) {
                if (dilated[row + x] == 1) {
                    if (x > 0) next[row + (x - 1)] = 1;
                    if (x < width - 1) next[row + (x + 1)] = 1;
                    if (y > 0) next[(y - 1) * width + x] = 1;
                    if (y < height - 1) next[(y + 1) * width + x] = 1;
                    if (x > 0 && y > 0) next[(y - 1) * width + (x - 1)] = 1;
                    if (x < width - 1 && y > 0) next[(y - 1) * width + (x + 1)] = 1;
                    if (x > 0 && y < height - 1) next[(y + 1) * width + (x - 1)] = 1;
                    if (x < width - 1 && y < height - 1) next[(y + 1) * width + (x + 1)] = 1;
                }
            }
        }
        dilated = std::move(next);
    }

    // 3. Erosión morfológica de la barrera dilatada (cierre topológico completo)
    std::vector<uint8_t> closed = dilated;
    for (int32_t r = 0; r < radius; ++r) {
        std::vector<uint8_t> next = closed;
        for (int32_t y = 0; y < height; ++y) {
            const int32_t row = y * width;
            for (int32_t x = 0; x < width; ++x) {
                if (closed[row + x] == 1) {
                    bool all_neighbors = true;
                    if (x > 0 && closed[row + (x - 1)] == 0) all_neighbors = false;
                    if (x < width - 1 && closed[row + (x + 1)] == 0) all_neighbors = false;
                    if (y > 0 && closed[(y - 1) * width + x] == 0) all_neighbors = false;
                    if (y < height - 1 && closed[(y + 1) * width + x] == 0) all_neighbors = false;
                    if (!all_neighbors) {
                        next[row + x] = 0;
                    }
                }
            }
        }
        closed = std::move(next);
    }

    // 4. Escribir máscara final y contabilizar puentes generados
    uint32_t bridge_pixels = 0;
    for (size_t p = 0; p < total; ++p) {
        output_closed_mask[p] = closed[p];
        if (closed[p] == 1 && barrier[p] == 0) {
            ++bridge_pixels;
        }
    }

    return bridge_pixels;
}

auto StrokeAnalyzer::apply_sobel_lineart(
    std::span<const uint8_t> rgba_pixels,
    int32_t width,
    int32_t height,
    bool invert,
    float threshold,
    std::span<uint8_t> output_rgba
) const noexcept -> bool {
    if (width < 3 || height < 3) return false;
    const size_t total_pixels = static_cast<size_t>(width * height);
    if (rgba_pixels.size() < total_pixels * 4 || output_rgba.size() < total_pixels * 4) return false;

    // 1. Escala de grises mediante Luminancia BT.709
    std::vector<float> gray(total_pixels, 0.0f);
    for (size_t i = 0, p = 0; p < total_pixels; i += 4, ++p) {
        gray[p] = 0.2126f * rgba_pixels[i] + 0.7152f * rgba_pixels[i + 1] + 0.0722f * rgba_pixels[i + 2];
    }

    // Inicializar buffer de salida en ceros
    std::fill(output_rgba.begin(), output_rgba.end(), static_cast<uint8_t>(0));

    // 2. Convolución matricial Sobel 3x3
    for (int32_t y = 1; y < height - 1; ++y) {
        const int32_t y_offset = y * width;
        const int32_t y_prev = (y - 1) * width;
        const int32_t y_next = (y + 1) * width;

        for (int32_t x = 1; x < width - 1; ++x) {
            const size_t idx = static_cast<size_t>((y_offset + x) * 4);

            const float p00 = gray[y_prev + (x - 1)];
            const float p01 = gray[y_prev + x];
            const float p02 = gray[y_prev + (x + 1)];
            const float p10 = gray[y_offset + (x - 1)];
            const float p12 = gray[y_offset + (x + 1)];
            const float p20 = gray[y_next + (x - 1)];
            const float p21 = gray[y_next + x];
            const float p22 = gray[y_next + (x + 1)];

            const float gx = -p00 + p02 - 2.0f * p10 + 2.0f * p12 - p20 + p22;
            const float gy = -p00 - 2.0f * p01 - p02 + p20 + 2.0f * p21 + p22;

            const float magnitude = std::hypot(gx, gy);
            const bool is_edge = magnitude > threshold;

            if (invert) {
                // Fondo blanco y líneas oscuras (ideal para calcar)
                const float scaled = std::min(255.0f, magnitude * 1.8f);
                const uint8_t line_val = is_edge ? static_cast<uint8_t>(std::max(0.0f, 255.0f - scaled)) : 255;
                output_rgba[idx] = line_val;
                output_rgba[idx + 1] = line_val;
                output_rgba[idx + 2] = line_val;
                output_rgba[idx + 3] = is_edge ? 255 : 0;
            } else {
                const uint8_t edge_val = static_cast<uint8_t>(std::min(255.0f, magnitude * 1.5f));
                output_rgba[idx] = edge_val;
                output_rgba[idx + 1] = edge_val;
                output_rgba[idx + 2] = edge_val;
                output_rgba[idx + 3] = 255;
            }
        }
    }
    return true;
}

} // namespace ibis::vision::stroke

// ============================================================================
// Enlaces C-ABI para JavaScript y WebAssembly
// ============================================================================
extern "C" {

float ibis_analyze_stroke_role(
    const uint8_t* rgba_data,
    int32_t width,
    int32_t height,
    int32_t role_index,
    float display_scale
) {
    if (!rgba_data || width <= 0 || height <= 0) return 12.0f;
    std::span<const uint8_t> view(rgba_data, static_cast<size_t>(width * height * 4));
    ibis::vision::stroke::StrokeAnalyzer analyzer;
    const auto profile = analyzer.analyze_image_stroke_thickness(view, width, height, display_scale);

    switch (role_index) {
        case 0: return profile.silhouette_px;
        case 1: return profile.structure_px;
        case 2: return profile.details_px;
        case 3: return profile.hatching_px;
        default: return profile.structure_px;
    }
}

float ibis_sample_point_thickness(
    const uint8_t* rgba_data,
    int32_t width,
    int32_t height,
    int32_t x,
    int32_t y
) {
    if (!rgba_data || width <= 0 || height <= 0) return -1.0f;
    std::span<const uint8_t> view(rgba_data, static_cast<size_t>(width * height * 4));
    ibis::vision::stroke::StrokeAnalyzer analyzer;
    auto val = analyzer.sample_local_thickness(view, width, height, x, y);
    return val.value_or(-1.0f);
}

int32_t ibis_close_boundary_gaps(
    const uint8_t* rgba_data,
    int32_t width,
    int32_t height,
    int32_t max_gap_px,
    uint8_t* output_mask
) {
    if (!rgba_data || !output_mask || width <= 0 || height <= 0) return 0;
    const size_t total = static_cast<size_t>(width * height);
    std::span<const uint8_t> rgba_view(rgba_data, total * 4);
    std::span<uint8_t> mask_view(output_mask, total);
    ibis::vision::stroke::StrokeAnalyzer analyzer;
    return static_cast<int32_t>(analyzer.close_boundary_gaps(rgba_view, width, height, max_gap_px, mask_view));
}

int32_t ibis_apply_sobel_lineart(
    const uint8_t* rgba_data,
    int32_t width,
    int32_t height,
    int32_t invert,
    float threshold,
    uint8_t* output_rgba
) {
    if (!rgba_data || !output_rgba || width <= 0 || height <= 0) return 0;
    const size_t total = static_cast<size_t>(width * height);
    std::span<const uint8_t> in_view(rgba_data, total * 4);
    std::span<uint8_t> out_view(output_rgba, total * 4);
    ibis::vision::stroke::StrokeAnalyzer analyzer;
    return analyzer.apply_sobel_lineart(in_view, width, height, invert != 0, threshold, out_view) ? 1 : 0;
}

} // extern "C"

