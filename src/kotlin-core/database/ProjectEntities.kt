/**
 * @file ProjectEntities.kt
 * @package com.inkflow.studio.database
 * @description Entidades de datos para Android Jetpack Room en InkFlow Studio.
 * 
 * Modela la persistencia relacional en disco nativo para el APK de Android:
 * 1. ProjectEntity: Metadatos de la ilustración (dimensiones, nombre, miniatura, timestamps).
 * 2. LayerEntity: Capas de dibujo, modos de fusión, opacidad y orden z.
 * 3. TracingEntity: Referencia de calco o accesorio (ángulo de rotación, escala, posición x/y, ruta física a disco).
 * 4. CrashRecoveryEntity: Centinela inviolable de recuperación ante crash o cierre inesperado.
 */

package com.inkflow.studio.database

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

/**
 * Entidad principal que representa un proyecto o lienzo de dibujo
 */
@Entity(tableName = "projects")
data class ProjectEntity(
    @PrimaryKey
    @ColumnInfo(name = "id")
    val id: String,

    @ColumnInfo(name = "name")
    val name: String,

    @ColumnInfo(name = "width")
    val width: Int,

    @ColumnInfo(name = "height")
    val height: Int,

    @ColumnInfo(name = "thumbnail_url")
    val thumbnailUrl: String = "",

    @ColumnInfo(name = "layer_count")
    val layerCount: Int = 1,

    @ColumnInfo(name = "created_at")
    val createdAt: Long,

    @ColumnInfo(name = "updated_at")
    val updatedAt: Long,

    @ColumnInfo(name = "is_autosaved")
    val isAutosaved: Boolean = false
)

/**
 * Entidad que representa cada capa gráfica de un proyecto
 */
@Entity(
    tableName = "layers",
    foreignKeys = [
        ForeignKey(
            entity = ProjectEntity::class,
            parentColumns = ["id"],
            childColumns = ["project_id"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index(value = ["project_id", "order_index"])]
)
data class LayerEntity(
    @PrimaryKey
    @ColumnInfo(name = "id")
    val id: String,

    @ColumnInfo(name = "project_id")
    val projectId: String,

    @ColumnInfo(name = "order_index")
    val orderIndex: Int,

    @ColumnInfo(name = "name")
    val name: String,

    @ColumnInfo(name = "visible")
    val visible: Boolean = true,

    @ColumnInfo(name = "opacity")
    val opacity: Float = 1.0f,

    @ColumnInfo(name = "blend_mode")
    val blendMode: String = "source-over",

    @ColumnInfo(name = "locked")
    val locked: Boolean = false,

    @ColumnInfo(name = "image_data_url")
    val imageDataUrl: String = "",

    @ColumnInfo(name = "vector_strokes_json")
    val vectorStrokesJson: String = "",

    @ColumnInfo(name = "updated_at")
    val updatedAt: Long
)

/**
 * Entidad para la foto de calco o accesorio/sticker.
 * Guarda la ruta física del archivo en disco (/data/user/0/.../files/tracings/...)
 * para que no dependa de la memoria volátil del WebView y conserve su rotación exacta.
 */
@Entity(
    tableName = "project_tracings",
    foreignKeys = [
        ForeignKey(
            entity = ProjectEntity::class,
            parentColumns = ["id"],
            childColumns = ["project_id"],
            onDelete = ForeignKey.CASCADE
        )
    ]
)
data class TracingEntity(
    @PrimaryKey
    @ColumnInfo(name = "project_id")
    val projectId: String,

    @ColumnInfo(name = "tracing_id")
    val tracingId: String,

    @ColumnInfo(name = "file_path")
    val filePath: String, // Ruta en almacenamiento privado físico

    @ColumnInfo(name = "x")
    val x: Float,

    @ColumnInfo(name = "y")
    val y: Float,

    @ColumnInfo(name = "width")
    val width: Int,

    @ColumnInfo(name = "height")
    val height: Int,

    @ColumnInfo(name = "scale")
    val scale: Float,

    @ColumnInfo(name = "rotation")
    val rotation: Float, // Ángulo exacto de rotación del calco en grados

    @ColumnInfo(name = "opacity")
    val opacity: Float = 0.4f,

    @ColumnInfo(name = "visible")
    val visible: Boolean = true,

    @ColumnInfo(name = "filter_mode")
    val filterMode: String = "original",

    @ColumnInfo(name = "purpose")
    val purpose: String = "tracing",

    @ColumnInfo(name = "extracted_colors_json")
    val extractedColorsJson: String = "[]",

    @ColumnInfo(name = "updated_at")
    val updatedAt: Long
)

/**
 * Entidad de resguardo de emergencia ante crash o cierre abrupto de la app
 */
@Entity(tableName = "crash_recovery")
data class CrashRecoveryEntity(
    @PrimaryKey
    @ColumnInfo(name = "id")
    val id: String = "latest_emergency_checkpoint",

    @ColumnInfo(name = "project_id")
    val projectId: String,

    @ColumnInfo(name = "project_name")
    val projectName: String,

    @ColumnInfo(name = "width")
    val width: Int,

    @ColumnInfo(name = "height")
    val height: Int,

    @ColumnInfo(name = "timestamp")
    val timestamp: Long,

    @ColumnInfo(name = "layer_count")
    val layerCount: Int,

    @ColumnInfo(name = "preview_thumbnail_url")
    val previewThumbnailUrl: String = "",

    @ColumnInfo(name = "payload_json")
    val payloadJson: String
)
