/**
 * @file IbisVectorEngine.cpp
 * @brief Implementación del motor vectorial en C++23 (ISO/IEC 14882:2023).
 * 
 * Implementa:
 * 1. Algoritmo Douglas-Peucker de decodificación y reducción de ruido táctil en memoria continua.
 * 2. Ajuste Catmull-Rom a Bézier cúbica con continuidad C1 y gradiente de presión.
 * 3. Envoltura de grosor variable por velocidad y presión de entrada.
 * 4. Exportaciones C-ABI para enlace directo en WebAssembly (Wasm) y Android NDK.
 */

#include "../include/IbisVectorEngine.hpp"

namespace ibis::vision::vector {

float CppVectorEngine::perpendicular_distance(
    const VectorPoint2D& pt,
    const VectorPoint2D& line_start,
    const VectorPoint2D& line_end
) noexcept {
    const float dx = line_end.x - line_start.x;
    const float dy = line_end.y - line_start.y;
    const float len = std::sqrt(dx * dx + dy * dy);
    if (len < 1e-6f) {
        return pt.distance_to(line_start);
    }
    return std::abs((pt.x - line_start.x) * dy - (pt.y - line_start.y) * dx) / len;
}

[[nodiscard]] auto CppVectorEngine::simplify_points(
    std::span<const VectorPoint2D> points,
    float epsilon
) const -> std::vector<VectorPoint2D> {
    if (points.size() <= 2) {
        return std::vector<VectorPoint2D>(points.begin(), points.end());
    }

    float max_dist = 0.0f;
    size_t index = 0;
    const auto& p_first = points.front();
    const auto& p_last = points.back();

    for (size_t i = 1; i < points.size() - 1; ++i) {
        const float d = perpendicular_distance(points[i], p_first, p_last);
        if (d > max_dist) {
            max_dist = d;
            index = i;
        }
    }

    if (max_dist > epsilon) {
        auto left = simplify_points(points.subspan(0, index + 1), epsilon);
        auto right = simplify_points(points.subspan(index, points.size() - index), epsilon);
        
        if (!left.empty()) {
            left.pop_back(); // Eliminar punto duplicado de unión
        }
        left.insert(left.end(), right.begin(), right.end());
        return left;
    }

    return std::vector<VectorPoint2D>{p_first, p_last};
}

[[nodiscard]] auto CppVectorEngine::generate_bezier_segments(
    std::span<const VectorPoint2D> points,
    float base_width,
    float tension
) const -> std::vector<CubicBezier2D> {
    if (points.size() < 2) {
        return {};
    }

    const auto simplified = simplify_points(points, 0.4f);
    if (simplified.size() < 2) {
        return {};
    }

    std::vector<CubicBezier2D> segments;
    segments.reserve(simplified.size() - 1);

    const float tension_factor = tension / 3.0f;

    for (size_t i = 0; i < simplified.size() - 1; ++i) {
        const auto& p0 = simplified[i];
        const auto& p1 = simplified[i + 1];

        const auto& p_prev = (i > 0) ? simplified[i - 1] : p0;
        const auto& p_next = (i + 2 < simplified.size()) ? simplified[i + 2] : p1;

        // Puntos de control Bézier derivados de tangentes Catmull-Rom continuas
        const float cp1_x = p0.x + (p1.x - p_prev.x) * tension_factor;
        const float cp1_y = p0.y + (p1.y - p_prev.y) * tension_factor;
        const float cp2_x = p1.x - (p_next.x - p0.x) * tension_factor;
        const float cp2_y = p1.y - (p_next.y - p0.y) * tension_factor;

        const float p0_press = p0.pressure;
        const float p1_press = p1.pressure;

        const VectorPoint2D cp1{
            .x = cp1_x,
            .y = cp1_y,
            .pressure = (p0_press * 2.0f + p1_press) / 3.0f,
            .timestamp = 0.0f
        };

        const VectorPoint2D cp2{
            .x = cp2_x,
            .y = cp2_y,
            .pressure = (p0_press + p1_press * 2.0f) / 3.0f,
            .timestamp = 0.0f
        };

        const float width0 = std::max(0.75f, base_width * p0_press);
        const float width1 = std::max(0.75f, base_width * p1_press);

        segments.push_back(CubicBezier2D{
            .p0 = p0,
            .cp1 = cp1,
            .cp2 = cp2,
            .p1 = p1,
            .width0 = width0,
            .width1 = width1
        });
    }

    return segments;
}

} // namespace ibis::vision::vector

// ============================================================================
// Enlaces de C (ABI C99) para exportación hacia WebAssembly (Emscripten / Wasm)
// ============================================================================
extern "C" {

using namespace ibis::vision::vector;

static const CppVectorEngine g_vector_engine{};

int32_t ibis_vector_simplify_points(
    const float* in_pts_data,
    int32_t in_count,
    float epsilon,
    float* out_pts_data
) {
    if (!in_pts_data || in_count <= 0 || !out_pts_data) {
        return 0;
    }

    std::vector<VectorPoint2D> input_pts;
    input_pts.reserve(static_cast<size_t>(in_count));
    for (int32_t i = 0; i < in_count; ++i) {
        input_pts.push_back(VectorPoint2D{
            .x = in_pts_data[i * 3],
            .y = in_pts_data[i * 3 + 1],
            .pressure = in_pts_data[i * 3 + 2],
            .timestamp = 0.0f
        });
    }

    const auto result = g_vector_engine.simplify_points(input_pts, epsilon);
    const int32_t out_count = static_cast<int32_t>(result.size());
    for (int32_t i = 0; i < out_count; ++i) {
        out_pts_data[i * 3] = result[i].x;
        out_pts_data[i * 3 + 1] = result[i].y;
        out_pts_data[i * 3 + 2] = result[i].pressure;
    }

    return out_count;
}

int32_t ibis_vector_generate_bezier_segments(
    const float* in_pts_data,
    int32_t in_count,
    float base_width,
    float tension,
    float* out_segments_data
) {
    if (!in_pts_data || in_count < 2 || !out_segments_data) {
        return 0;
    }

    std::vector<VectorPoint2D> input_pts;
    input_pts.reserve(static_cast<size_t>(in_count));
    for (int32_t i = 0; i < in_count; ++i) {
        input_pts.push_back(VectorPoint2D{
            .x = in_pts_data[i * 3],
            .y = in_pts_data[i * 3 + 1],
            .pressure = in_pts_data[i * 3 + 2],
            .timestamp = 0.0f
        });
    }

    const auto segments = g_vector_engine.generate_bezier_segments(input_pts, base_width, tension);
    const int32_t seg_count = static_cast<int32_t>(segments.size());

    // 10 floats por segmento:
    // [0]: p0.x, [1]: p0.y, [2]: cp1.x, [3]: cp1.y, [4]: cp2.x, [5]: cp2.y,
    // [6]: p1.x, [7]: p1.y, [8]: width0, [9]: width1
    for (int32_t i = 0; i < seg_count; ++i) {
        const auto& s = segments[i];
        const int32_t offset = i * 10;
        out_segments_data[offset]     = s.p0.x;
        out_segments_data[offset + 1] = s.p0.y;
        out_segments_data[offset + 2] = s.cp1.x;
        out_segments_data[offset + 3] = s.cp1.y;
        out_segments_data[offset + 4] = s.cp2.x;
        out_segments_data[offset + 5] = s.cp2.y;
        out_segments_data[offset + 6] = s.p1.x;
        out_segments_data[offset + 7] = s.p1.y;
        out_segments_data[offset + 8] = s.width0;
        out_segments_data[offset + 9] = s.width1;
    }

    return seg_count;
}

void ibis_vector_evaluate_bezier(
    float p0x, float p0y,
    float cp1x, float cp1y,
    float cp2x, float cp2y,
    float p1x, float p1y,
    float t,
    float* out_xy
) {
    if (!out_xy) return;
    const float u = 1.0f - t;
    const float tt = t * t;
    const float uu = u * u;
    const float uuu = uu * u;
    const float ttt = tt * t;

    out_xy[0] = uuu * p0x + 3.0f * uu * t * cp1x + 3.0f * u * tt * cp2x + ttt * p1x;
    out_xy[1] = uuu * p0y + 3.0f * uu * t * cp1y + 3.0f * u * tt * cp2y + ttt * p1y;
}

}
