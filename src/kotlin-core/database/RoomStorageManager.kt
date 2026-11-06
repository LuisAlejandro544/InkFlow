/**
 * @file RoomStorageManager.kt
 * @package com.inkflow.studio.database
 * @description Gestor de persistencia física en disco y Room Database para InkFlow Studio.
 * 
 * Resuelve definitivamente los problemas de pérdida de fotos de calco y auto-guardado en el APK:
 * 1. Escribe los bytes reales de las fotos de calco directamente en el almacenamiento interno privado
 *    del dispositivo (context.filesDir/tracings/), inmune a la volatilidad de la RAM del WebView.
 * 2. Guarda los metadatos precisos (ángulo de rotación exacto, escala, opacidad, visibilidad, coordenadas)
 *    en la tabla relacional de Room en disco local (inkflow_studio_room.db).
 * 3. Ejecuta guardados de emergencia atómicos ante excepciones y pausas del ciclo de vida de Android.
 */

package com.inkflow.studio.database

import android.content.Context
import android.util.Base64
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream

class RoomStorageManager(private val context: Context) {

    private val db = AppDatabase.getInstance(context)
    private val tracingsDir = File(context.filesDir, "tracings").apply {
        if (!exists()) mkdirs()
    }

    /**
     * Guarda la foto de calco o accesorio escribiendo físicamente el archivo en disco
     * y registrando sus metadatos (incluyendo ángulo de rotación continuo) en Room.
     */
    suspend fun saveTracing(
        projectId: String,
        tracingJson: String,
        imageBase64: String? = null
    ): Boolean = withContext(Dispatchers.IO) {
        try {
            val json = JSONObject(tracingJson)
            val tracingId = json.optString("id", "trace_${System.currentTimeMillis()}")
            val rotation = json.optDouble("rotation", 0.0).toFloat()
            val scale = json.optDouble("scale", 1.0).toFloat()
            val x = json.optDouble("x", 0.0).toFloat()
            val y = json.optDouble("y", 0.0).toFloat()
            val width = json.optInt("width", 800)
            val height = json.optInt("height", 600)
            val opacity = json.optDouble("opacity", 0.4).toFloat()
            val visible = json.optBoolean("visible", true)
            val filterMode = json.optString("filterMode", "original")
            val purpose = json.optString("purpose", "tracing")
            val extractedColors = json.optJSONArray("extractedColors")?.toString() ?: "[]"

            // 1. Guardar la imagen física en disco si viene en Base64 o en el JSON
            val rawSrc = imageBase64 ?: json.optString("src", "")
            val targetFile = File(tracingsDir, "tracing_${projectId}.png")

            if (rawSrc.isNotEmpty()) {
                val cleanBase64 = if (rawSrc.contains(",")) rawSrc.substringAfter(",") else rawSrc
                val bytes = Base64.decode(cleanBase64, Base64.DEFAULT)
                FileOutputStream(targetFile).use { fos ->
                    fos.write(bytes)
                    fos.flush()
                }
            }

            // 2. Insertar o actualizar registro en Room
            val entity = TracingEntity(
                projectId = projectId,
                tracingId = tracingId,
                filePath = targetFile.absolutePath,
                x = x,
                y = y,
                width = width,
                height = height,
                scale = scale,
                rotation = rotation,
                opacity = opacity,
                visible = visible,
                filterMode = filterMode,
                purpose = purpose,
                extractedColorsJson = extractedColors,
                updatedAt = System.currentTimeMillis()
            )

            db.tracingDao().insertOrUpdate(entity)
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    /**
     * Carga la foto de calco desde Room y reconstruye el Base64 desde el archivo en disco.
     */
    suspend fun loadTracing(projectId: String): String? = withContext(Dispatchers.IO) {
        try {
            val entity = db.tracingDao().getTracingForProject(projectId) ?: return@withContext null
            val file = File(entity.filePath)
            if (!file.exists()) return@withContext null

            val bytes = file.readBytes()
            val base64 = Base64.encodeToString(bytes, Base64.NO_WRAP)
            val mimeType = if (entity.purpose == "accessory") "image/png" else "image/jpeg"
            val src = "data:$mimeType;base64,$base64"

            val json = JSONObject().apply {
                put("id", entity.tracingId)
                put("src", src)
                put("x", entity.x)
                put("y", entity.y)
                put("width", entity.width)
                put("height", entity.height)
                put("scale", entity.scale)
                put("rotation", entity.rotation)
                put("opacity", entity.opacity)
                put("visible", entity.visible)
                put("filterMode", entity.filterMode)
                put("purpose", entity.purpose)
                put("isAdjusting", false)
                try {
                    put("extractedColors", JSONArray(entity.extractedColorsJson))
                } catch (_: Exception) {
                    put("extractedColors", JSONArray())
                }
            }

            json.toString()
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    /**
     * Guarda un checkpoint de emergencia ante crash o cierre de la aplicación
     */
    suspend fun saveEmergencyCrash(payloadJson: String): Boolean = withContext(Dispatchers.IO) {
        try {
            val payload = JSONObject(payloadJson)
            val projectObj = payload.getJSONObject("project")
            val projectId = projectObj.getString("id")
            val projectName = projectObj.optString("name", "Obra sin título")
            val width = projectObj.getInt("width")
            val height = projectObj.getInt("height")
            val layersArray = payload.optJSONArray("layers")
            val layerCount = layersArray?.length() ?: 1
            val thumb = projectObj.optString("thumbnailUrl", "")

            val record = CrashRecoveryEntity(
                id = "latest_emergency_checkpoint",
                projectId = projectId,
                projectName = projectName,
                width = width,
                height = height,
                timestamp = System.currentTimeMillis(),
                layerCount = layerCount,
                previewThumbnailUrl = thumb,
                payloadJson = payloadJson
            )

            db.crashRecoveryDao().saveEmergencyCheckpoint(record)

            // Respaldo adicional en archivo de rescate en disco físico
            val backupFile = File(context.filesDir, "crash_recovery_backup.json")
            backupFile.writeText(payloadJson)

            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    /**
     * Verifica si existe un punto de rescate de una sesión previa
     */
    suspend fun checkCrashRecovery(): String? = withContext(Dispatchers.IO) {
        try {
            val record = db.crashRecoveryDao().getLatestEmergencyCheckpoint()
            if (record != null) {
                val json = JSONObject().apply {
                    put("projectId", record.projectId)
                    put("projectName", record.projectName)
                    put("width", record.width)
                    put("height", record.height)
                    put("timestamp", record.timestamp)
                    put("layerCount", record.layerCount)
                    put("previewThumbnailUrl", record.previewThumbnailUrl)
                    put("payloadJson", record.payloadJson)
                }
                return@withContext json.toString()
            }

            // Fallback de rescate desde archivo físico si Room aún no arrancaba
            val backupFile = File(context.filesDir, "crash_recovery_backup.json")
            if (backupFile.exists()) {
                val raw = backupFile.readText()
                val payload = JSONObject(raw)
                val proj = payload.getJSONObject("project")
                val json = JSONObject().apply {
                    put("projectId", proj.getString("id"))
                    put("projectName", proj.optString("name", "Obra rescatada"))
                    put("width", proj.getInt("width"))
                    put("height", proj.getInt("height"))
                    put("timestamp", backupFile.lastModified())
                    put("layerCount", payload.optJSONArray("layers")?.length() ?: 1)
                    put("previewThumbnailUrl", proj.optString("thumbnailUrl", ""))
                    put("payloadJson", raw)
                }
                return@withContext json.toString()
            }

            null
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    /**
     * Descarta y limpia el registro de crash una vez restaurado o cerrado
     */
    suspend fun clearCrashRecovery(): Boolean = withContext(Dispatchers.IO) {
        try {
            db.crashRecoveryDao().clearEmergencyCheckpoint()
            val backupFile = File(context.filesDir, "crash_recovery_backup.json")
            if (backupFile.exists()) {
                backupFile.delete()
            }
            true
        } catch (e: Exception) {
            false
        }
    }

    /**
     * Elimina el proyecto y limpia sus archivos físicos de calco
     */
    suspend fun deleteProject(projectId: String): Boolean = withContext(Dispatchers.IO) {
        try {
            db.projectDao().deleteProjectById(projectId)
            db.layerDao().deleteLayersByProject(projectId)
            db.tracingDao().deleteTracingByProject(projectId)

            val tracingFile = File(tracingsDir, "tracing_${projectId}.png")
            if (tracingFile.exists()) {
                tracingFile.delete()
            }
            true
        } catch (e: Exception) {
            false
        }
    }
}
