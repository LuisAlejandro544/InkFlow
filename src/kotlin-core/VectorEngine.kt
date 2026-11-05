/**
 * @file VectorEngine.kt
 * @package com.ibispaint.webgpu.vector
 * @description Motor vectorial nativo en Kotlin diseñado para compilación a WebAssembly (Kotlin/Wasm wasmJs).
 * 
 * Implementa:
 * 1. Estructuras de datos inmutables y de alto rendimiento para puntos vectoriales (VectorPoint),
 *    segmentos cúbicos de Bézier (CubicBezierSegment) y trazos continuos (VectorStroke).
 * 2. Algoritmo de ajuste de curvas Catmull-Rom a Bézier con curvatura continua (C1 continuity).
 * 3. Envoltura de grosor variable adaptada a la dinámica de presión del lápiz táctil.
 * 4. Simplificación de curvas Douglas-Peucker para reducir puntos redundantes sin perder fidelidad.
 * 5. Evaluación de trazos a escala arbitraria (zero-pixelation al hacer zoom en PWA móvil).
 * 
 * Arquitectura de compilación PWA:
 * Target: wasmJs (WebAssembly with Wasm-GC)
 */

package com.ibispaint.webgpu.vector

import kotlin.math.*

data class VectorPoint(
    val x: Double,
    val y: Double,
    val pressure: Double = 0.5,
    val timestamp: Double = 0.0
) {
    fun distanceTo(other: VectorPoint): Double {
        val dx = other.x - x
        val dy = other.y - y
        return sqrt(dx * dx + dy * dy)
    }

    fun lerp(other: VectorPoint, t: Double): VectorPoint {
        return VectorPoint(
            x = x + (other.x - x) * t,
            y = y + (other.y - y) * t,
            pressure = pressure + (other.pressure - pressure) * t,
            timestamp = timestamp + (other.timestamp - timestamp) * t
        )
    }
}

data class CubicBezierSegment(
    val p0: VectorPoint,
    val cp1: VectorPoint,
    val cp2: VectorPoint,
    val p1: VectorPoint,
    val widthStart: Double,
    val widthEnd: Double
) {
    /**
     * Evalúa el punto sobre la curva de Bézier para un parámetro t en [0.0, 1.0]
     */
    fun evaluate(t: Double): VectorPoint {
        val u = 1.0 - t
        val tt = t * t
        val uu = u * u
        val uuu = uu * u
        val ttt = tt * t

        val x = uuu * p0.x + 3.0 * uu * t * cp1.x + 3.0 * u * tt * cp2.x + ttt * p1.x
        val y = uuu * p0.y + 3.0 * uu * t * cp1.y + 3.0 * u * tt * cp2.y + ttt * p1.y
        val pressure = u * p0.pressure + t * p1.pressure

        return VectorPoint(x, y, pressure)
    }

    /**
     * Calcula la tangente normal en el punto t para generar la malla poligonal de bordes limpios
     */
    fun normalAt(t: Double): Pair<Double, Double> {
        val u = 1.0 - t
        // Primera derivada de la curva de Bézier cúbica
        val dx = 3.0 * u * u * (cp1.x - p0.x) + 6.0 * u * t * (cp2.x - cp1.x) + 3.0 * t * t * (p1.x - cp2.x)
        val dy = 3.0 * u * u * (cp1.y - p0.y) + 6.0 * u * t * (cp2.y - cp1.y) + 3.0 * t * t * (p1.y - cp2.y)
        val len = sqrt(dx * dx + dy * dy)
        if (len < 1e-6) return Pair(0.0, 1.0)
        return Pair(-dy / len, dx / len)
    }
}

class KotlinVectorEngine(
    var tension: Double = 0.5,
    var simplificationTolerance: Double = 0.5
) {
    /**
     * Convierte una secuencia de puntos discretos muestreados por el sensor táctil
     * en una serie continua de segmentos Bézier suaves con grosor variable.
     */
    fun generateVectorSegments(
        points: List<VectorPoint>,
        baseWidth: Double
    ): List<CubicBezierSegment> {
        if (points.size < 2) return emptyList()

        val simplified = simplifyPoints(points, simplificationTolerance)
        if (simplified.size < 2) return emptyList()

        val segments = mutableListOf<CubicBezierSegment>()

        for (i in 0 until simplified.size - 1) {
            val p0 = simplified[i]
            val p1 = simplified[i + 1]

            val pPrev = if (i > 0) simplified[i - 1] else p0
            val pNext = if (i + 2 < simplified.size) simplified[i + 2] else p1

            // Puntos de control calculados con aproximación Catmull-Rom
            val d1 = p0.distanceTo(pPrev)
            val d2 = p0.distanceTo(p1)
            val d3 = p1.distanceTo(pNext)

            val cp1X = p0.x + (p1.x - pPrev.x) * (tension / 3.0)
            val cp1Y = p0.y + (p1.y - pPrev.y) * (tension / 3.0)
            val cp2X = p1.x - (pNext.x - p0.x) * (tension / 3.0)
            val cp2Y = p1.y - (pNext.y - p0.y) * (tension / 3.0)

            val cp1 = VectorPoint(cp1X, cp1Y, (p0.pressure * 2.0 + p1.pressure) / 3.0)
            val cp2 = VectorPoint(cp2X, cp2Y, (p0.pressure + p1.pressure * 2.0) / 3.0)

            val width0 = max(0.8, baseWidth * p0.pressure)
            val width1 = max(0.8, baseWidth * p1.pressure)

            segments.add(
                CubicBezierSegment(
                    p0 = p0,
                    cp1 = cp1,
                    cp2 = cp2,
                    p1 = p1,
                    widthStart = width0,
                    widthEnd = width1
                )
            )
        }

        return segments
    }

    /**
     * Reducción de puntos redundantes con el algoritmo Douglas-Peucker
     */
    private fun simplifyPoints(points: List<VectorPoint>, epsilon: Double): List<VectorPoint> {
        if (points.size <= 2) return points

        var maxDist = 0.0
        var index = 0
        val pFirst = points.first()
        val pLast = points.last()

        for (i in 1 until points.size - 1) {
            val d = perpendicularDistance(points[i], pFirst, pLast)
            if (d > maxDist) {
                maxDist = d
                index = i
            }
        }

        return if (maxDist > epsilon) {
            val left = simplifyPoints(points.subList(0, index + 1), epsilon)
            val right = simplifyPoints(points.subList(index, points.size), epsilon)
            left.dropLast(1) + right
        } else {
            listOf(pFirst, pLast)
        }
    }

    private fun perpendicularDistance(pt: VectorPoint, lineStart: VectorPoint, lineEnd: VectorPoint): Double {
        val dx = lineEnd.x - lineStart.x
        val dy = lineEnd.y - lineStart.y
        val len = sqrt(dx * dx + dy * dy)
        if (len < 1e-6) return pt.distanceTo(lineStart)
        return abs((pt.x - lineStart.x) * dy - (pt.y - lineStart.y) * dx) / len
    }
}
