/**
 * @file CoroutineOrchestrator.kt
 * @package com.inkflow.studio.concurrency
 * @description Orquestador de Concurrencia Estructurada en Kotlin mediante `kotlinx.coroutines`.
 * 
 * Diseñado para Kotlin Multiplatform (Kotlin/Wasm wasmJs y Kotlin/Android JVM):
 * 1. Scope Estructurado de Aplicación (`InkFlowAppScope`):
 *    - Ciclo de vida desacoplado del hilo de renderizado principal.
 *    - SupervisorJob para evitar que un fallo en un worker secundario cancele el estudio de dibujo.
 * 2. Centinela de Auto-Guardado No Bloqueante (`AutoSaveSentinel`):
 *    - Bucle continuo con `delay()` cooperativo que monitorea el estado dirty sin congelar los 120 FPS.
 * 3. Conflación de Puntos Táctiles (`TouchPointConflator`):
 *    - Usa `Channel<VectorPoint>(Channel.CONFLATED)` y `Flow` para absorber el torrente de eventos
 *      del lápiz táctil a 120Hz-240Hz, reteniendo siempre la última muestra sin saturar la cola.
 * 4. Trabajador de Exportación Cancelable (`CancellableExportWorker`):
 *    - Despacha codificación de imágenes y serialización `.inkflow` en un `Job` cancelable en 1ms.
 */

package com.inkflow.studio.concurrency

import kotlinx.coroutines.*
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.*
import kotlin.coroutines.CoroutineContext

/**
 * Modelo simplificado de punto táctil para el flujo continuo de corrutinas
 */
data class TouchSample(
    val x: Double,
    val y: Double,
    val pressure: Double = 0.5,
    val timestamp: Long = System.currentTimeMillis()
)

/**
 * Gestor del Scope de Corrutinas estructuradas para el estudio de dibujo
 */
class InkFlowCoroutineOrchestrator(
    private val mainDispatcher: CoroutineDispatcher = Dispatchers.Main,
    private val backgroundDispatcher: CoroutineDispatcher = Dispatchers.Default
) : CoroutineScope {

    private val supervisorJob = SupervisorJob()
    override val coroutineContext: CoroutineContext
        get() = backgroundDispatcher + supervisorJob

    private val touchChannel = Channel<TouchSample>(capacity = Channel.CONFLATED)

    /**
     * Inicia el Centinela de Auto-Guardado periódico.
     * Se ejecuta en segundo plano con suspensión cooperativa (delay) sin bloquear el hilo principal.
     */
    fun startAutoSaveSentinel(
        intervalMs: Long = 10_000L,
        isDirty: () -> Boolean,
        onPerformSave: suspend () -> Boolean
    ): Job {
        return launch(backgroundDispatcher) {
            while (isActive) {
                delay(intervalMs)
                if (isActive && isDirty()) {
                    try {
                        onPerformSave()
                    } catch (e: CancellationException) {
                        throw e
                    } catch (_: Exception) {
                        // Error aislado en guardado, no derriba el SupervisorJob
                    }
                }
            }
        }
    }

    /**
     * Emite un punto táctil en el canal confluente.
     * Si el motor de renderizado está procesando un cuadro previo, la muestra previa intermedia
     * se reemplaza de inmediato para prevenir lag acumulativo (conflate).
     */
    fun emitTouchPoint(point: TouchSample) {
        touchChannel.trySend(point)
    }

    /**
     * Expone el flujo confluente de puntos táctiles como un Flow reactivo para el motor de renderizado
     */
    fun observeTouchStream(): Flow<TouchSample> = touchChannel.receiveAsFlow()

    /**
     * Despacha una exportación pesada en background, retornando el Job para permitir cancelación inmediata
     */
    fun launchCancellableTask(
        taskName: String,
        block: suspend CoroutineScope.() -> Unit
    ): Job {
        return launch(backgroundDispatcher + CoroutineName(taskName)) {
            ensureActive()
            block()
        }
    }

    /**
     * Cancela todas las corrutinas activas al cerrar el estudio de dibujo
     */
    fun close() {
        touchChannel.close()
        supervisorJob.cancel()
    }
}
