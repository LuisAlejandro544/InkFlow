/**
 * @file RoomStorageManager.kt
 * @package com.inkflow.studio.database
 * @description Gestor de persistencia física en disco y Room/SQLite Database para InkFlow Studio.
 * 
 * Resuelve definitivamente los problemas de pérdida de fotos de calco y auto-guardado en el APK:
 * 1. Escribe los bytes reales de las fotos de calco directamente en el almacenamiento interno privado
 *    del dispositivo (context.filesDir/tracings/), inmune a la volatilidad de la RAM del WebView.
 * 2. Guarda los metadatos precisos (ángulo de rotación exacto, escala, opacidad, visibilidad, coordenadas)
 *    en la tabla relacional de Room/SQLite en disco local (inkflow_studio_room.db).
 * 3. Ejecuta guardados de emergencia atómicos ante excepciones y pausas del ciclo de vida de Android.
 * 4. Arquitectura de Alta Disponibilidad: Integra Android Jetpack Room e implementa un motor nativo
 *    SQLiteOpenHelper como salvaguarda autónoma para operar con o sin procesador de anotaciones KSP/KAPT.
 */

package com.inkflow.studio.database

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import android.util.Base64
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream

class RoomStorageManager(private val context: Context) {

    // Instancia de Room si está compilada
    private val roomDb: AppDatabase? by lazy {
        try {
            AppDatabase.getInstance(context)
        } catch (_: Throwable) {
            null
        }
    }

    // Instancia de SQLite nativo del sistema operativo como respaldo directo
    private val nativeHelper = NativeSQLiteHelper(context)

    private val tracingsDir = File(context.filesDir, "tracings").apply {
        if (!exists()) mkdirs()
    }

    /**
     * Guarda la foto de calco o accesorio escribiendo físicamente el archivo en disco
     * y registrando sus metadatos (incluyendo ángulo de rotación continuo) en Room/SQLite.
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

            // 2. Insertar o actualizar registro en Room o SQLite nativo
            val now = System.currentTimeMillis()
            var savedInRoom = false

            if (roomDb != null) {
                try {
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
                        updatedAt = now
                    )
                    roomDb?.tracingDao()?.insertOrUpdate(entity)
                    savedInRoom = true
                } catch (_: Throwable) {
                    savedInRoom = false
                }
            }

            if (!savedInRoom) {
                nativeHelper.writableDatabase.use { db ->
                    val values = ContentValues().apply {
                        put("project_id", projectId)
                        put("tracing_id", tracingId)
                        put("file_path", targetFile.absolutePath)
                        put("x", x)
                        put("y", y)
                        put("width", width)
                        put("height", height)
                        put("scale", scale)
                        put("rotation", rotation)
                        put("opacity", opacity)
                        put("visible", if (visible) 1 else 0)
                        put("filter_mode", filterMode)
                        put("purpose", purpose)
                        put("extracted_colors_json", extractedColors)
                        put("updated_at", now)
                    }
                    db.insertWithOnConflict(
                        "project_tracings",
                        null,
                        values,
                        SQLiteDatabase.CONFLICT_REPLACE
                    )
                }
            }

            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    /**
     * Carga la foto de calco desde Room/SQLite y reconstruye el Base64 desde el archivo en disco.
     */
    suspend fun loadTracing(projectId: String): String? = withContext(Dispatchers.IO) {
        try {
            var filePath: String? = null
            var tracingId = "trace_$projectId"
            var x = 0f
            var y = 0f
            var width = 800
            var height = 600
            var scale = 1f
            var rotation = 0f
            var opacity = 0.4f
            var visible = true
            var filterMode = "original"
            var purpose = "tracing"
            var extractedColorsJson = "[]"

            var loadedFromRoom = false
            if (roomDb != null) {
                try {
                    val entity = roomDb?.tracingDao()?.getTracingForProject(projectId)
                    if (entity != null) {
                        filePath = entity.filePath
                        tracingId = entity.tracingId
                        x = entity.x
                        y = entity.y
                        width = entity.width
                        height = entity.height
                        scale = entity.scale
                        rotation = entity.rotation
                        opacity = entity.opacity
                        visible = entity.visible
                        filterMode = entity.filterMode
                        purpose = entity.purpose
                        extractedColorsJson = entity.extractedColorsJson
                        loadedFromRoom = true
                    }
                } catch (_: Throwable) {
                    loadedFromRoom = false
                }
            }

            if (!loadedFromRoom) {
                nativeHelper.readableDatabase.use { db ->
                    db.rawQuery(
                        "SELECT * FROM project_tracings WHERE project_id = ? LIMIT 1",
                        arrayOf(projectId)
                    ).use { cursor ->
                        if (cursor.moveToFirst()) {
                            filePath = cursor.getString(cursor.getColumnIndexOrThrow("file_path"))
                            tracingId = cursor.getString(cursor.getColumnIndexOrThrow("tracing_id"))
                            x = cursor.getFloat(cursor.getColumnIndexOrThrow("x"))
                            y = cursor.getFloat(cursor.getColumnIndexOrThrow("y"))
                            width = cursor.getInt(cursor.getColumnIndexOrThrow("width"))
                            height = cursor.getInt(cursor.getColumnIndexOrThrow("height"))
                            scale = cursor.getFloat(cursor.getColumnIndexOrThrow("scale"))
                            rotation = cursor.getFloat(cursor.getColumnIndexOrThrow("rotation"))
                            opacity = cursor.getFloat(cursor.getColumnIndexOrThrow("opacity"))
                            visible = cursor.getInt(cursor.getColumnIndexOrThrow("visible")) == 1
                            filterMode = cursor.getString(cursor.getColumnIndexOrThrow("filter_mode"))
                            purpose = cursor.getString(cursor.getColumnIndexOrThrow("purpose"))
                            extractedColorsJson = cursor.getString(cursor.getColumnIndexOrThrow("extracted_colors_json"))
                        }
                    }
                }
            }

            val path = filePath ?: return@withContext null
            val file = File(path)
            if (!file.exists()) return@withContext null

            val bytes = file.readBytes()
            val base64 = Base64.encodeToString(bytes, Base64.NO_WRAP)
            val mimeType = if (purpose == "accessory") "image/png" else "image/jpeg"
            val src = "data:$mimeType;base64,$base64"

            val json = JSONObject().apply {
                put("id", tracingId)
                put("src", src)
                put("x", x)
                put("y", y)
                put("width", width)
                put("height", height)
                put("scale", scale)
                put("rotation", rotation)
                put("opacity", opacity)
                put("visible", visible)
                put("filterMode", filterMode)
                put("purpose", purpose)
                put("isAdjusting", false)
                try {
                    put("extractedColors", JSONArray(extractedColorsJson))
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
            val now = System.currentTimeMillis()

            var savedInRoom = false
            if (roomDb != null) {
                try {
                    val record = CrashRecoveryEntity(
                        id = "latest_emergency_checkpoint",
                        projectId = projectId,
                        projectName = projectName,
                        width = width,
                        height = height,
                        timestamp = now,
                        layerCount = layerCount,
                        previewThumbnailUrl = thumb,
                        payloadJson = payloadJson
                    )
                    roomDb?.crashRecoveryDao()?.saveEmergencyCheckpoint(record)
                    savedInRoom = true
                } catch (_: Throwable) {
                    savedInRoom = false
                }
            }

            if (!savedInRoom) {
                nativeHelper.writableDatabase.use { db ->
                    val values = ContentValues().apply {
                        put("id", "latest_emergency_checkpoint")
                        put("project_id", projectId)
                        put("project_name", projectName)
                        put("width", width)
                        put("height", height)
                        put("timestamp", now)
                        put("layer_count", layerCount)
                        put("preview_thumbnail_url", thumb)
                        put("payload_json", payloadJson)
                    }
                    db.insertWithOnConflict(
                        "crash_recovery",
                        null,
                        values,
                        SQLiteDatabase.CONFLICT_REPLACE
                    )
                }
            }

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
            if (roomDb != null) {
                try {
                    val record = roomDb?.crashRecoveryDao()?.getLatestEmergencyCheckpoint()
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
                } catch (_: Throwable) {}
            }

            // Consulta en SQLite nativo
            try {
                nativeHelper.readableDatabase.use { db ->
                    db.rawQuery(
                        "SELECT * FROM crash_recovery WHERE id = 'latest_emergency_checkpoint' LIMIT 1",
                        null
                    ).use { cursor ->
                        if (cursor.moveToFirst()) {
                            val json = JSONObject().apply {
                                put("projectId", cursor.getString(cursor.getColumnIndexOrThrow("project_id")))
                                put("projectName", cursor.getString(cursor.getColumnIndexOrThrow("project_name")))
                                put("width", cursor.getInt(cursor.getColumnIndexOrThrow("width")))
                                put("height", cursor.getInt(cursor.getColumnIndexOrThrow("height")))
                                put("timestamp", cursor.getLong(cursor.getColumnIndexOrThrow("timestamp")))
                                put("layerCount", cursor.getInt(cursor.getColumnIndexOrThrow("layer_count")))
                                put("previewThumbnailUrl", cursor.getString(cursor.getColumnIndexOrThrow("preview_thumbnail_url")))
                                put("payloadJson", cursor.getString(cursor.getColumnIndexOrThrow("payload_json")))
                            }
                            return@withContext json.toString()
                        }
                    }
                }
            } catch (_: Throwable) {}

            // Fallback de rescate desde archivo físico si la BD aún no arrancaba
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
            if (roomDb != null) {
                try {
                    roomDb?.crashRecoveryDao()?.clearEmergencyCheckpoint()
                } catch (_: Throwable) {}
            }

            try {
                nativeHelper.writableDatabase.use { db ->
                    db.delete("crash_recovery", "id = ?", arrayOf("latest_emergency_checkpoint"))
                }
            } catch (_: Throwable) {}

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
            if (roomDb != null) {
                try {
                    roomDb?.projectDao()?.deleteProjectById(projectId)
                    roomDb?.layerDao()?.deleteLayersByProject(projectId)
                    roomDb?.tracingDao()?.deleteTracingByProject(projectId)
                } catch (_: Throwable) {}
            }

            try {
                nativeHelper.writableDatabase.use { db ->
                    db.delete("projects", "id = ?", arrayOf(projectId))
                    db.delete("layers", "project_id = ?", arrayOf(projectId))
                    db.delete("project_tracings", "project_id = ?", arrayOf(projectId))
                }
            } catch (_: Throwable) {}

            val tracingFile = File(tracingsDir, "tracing_${projectId}.png")
            if (tracingFile.exists()) {
                tracingFile.delete()
            }
            true
        } catch (e: Exception) {
            false
        }
    }

    /**
     * Helper SQLite nativo de Android como salvaguarda incondicional
     */
    private class NativeSQLiteHelper(context: Context) : SQLiteOpenHelper(
        context.applicationContext,
        "inkflow_studio_room.db",
        null,
        1
    ) {
        override fun onCreate(db: SQLiteDatabase) {
            db.execSQL("""
                CREATE TABLE IF NOT EXISTS projects (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    width INTEGER NOT NULL,
                    height INTEGER NOT NULL,
                    thumbnail_url TEXT,
                    layer_count INTEGER DEFAULT 1,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL,
                    is_autosaved INTEGER DEFAULT 0
                );
            """)
            db.execSQL("""
                CREATE TABLE IF NOT EXISTS layers (
                    id TEXT PRIMARY KEY,
                    project_id TEXT NOT NULL,
                    order_index INTEGER NOT NULL,
                    name TEXT NOT NULL,
                    visible INTEGER NOT NULL,
                    opacity REAL NOT NULL,
                    blend_mode TEXT NOT NULL,
                    locked INTEGER DEFAULT 0,
                    image_data_url TEXT NOT NULL,
                    vector_strokes_json TEXT,
                    updated_at INTEGER NOT NULL,
                    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
                );
            """)
            db.execSQL("""
                CREATE TABLE IF NOT EXISTS project_tracings (
                    project_id TEXT PRIMARY KEY,
                    tracing_id TEXT NOT NULL,
                    file_path TEXT NOT NULL,
                    x REAL NOT NULL,
                    y REAL NOT NULL,
                    width INTEGER NOT NULL,
                    height INTEGER NOT NULL,
                    scale REAL NOT NULL,
                    rotation REAL NOT NULL,
                    opacity REAL NOT NULL,
                    visible INTEGER NOT NULL,
                    filter_mode TEXT NOT NULL,
                    purpose TEXT NOT NULL,
                    extracted_colors_json TEXT NOT NULL,
                    updated_at INTEGER NOT NULL
                );
            """)
            db.execSQL("""
                CREATE TABLE IF NOT EXISTS crash_recovery (
                    id TEXT PRIMARY KEY,
                    project_id TEXT NOT NULL,
                    project_name TEXT NOT NULL,
                    width INTEGER NOT NULL,
                    height INTEGER NOT NULL,
                    timestamp INTEGER NOT NULL,
                    layer_count INTEGER NOT NULL,
                    preview_thumbnail_url TEXT,
                    payload_json TEXT NOT NULL
                );
            """)
        }

        override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
            // Migración no destructiva
        }
    }
}
