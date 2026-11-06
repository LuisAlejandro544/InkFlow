/**
 * @file ProjectDao.kt
 * @package com.inkflow.studio.database
 * @description Data Access Objects (DAOs) para Android Jetpack Room en InkFlow Studio.
 * 
 * Expone operaciones CRUD con corrutinas de Kotlin (suspend fun)
 * garantizando transacciones atómicas sin bloqueos en el hilo principal de Android.
 */

package com.inkflow.studio.database

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction

@Dao
interface ProjectDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOrUpdate(project: ProjectEntity)

    @Query("SELECT * FROM projects WHERE id = :projectId LIMIT 1")
    suspend fun getProjectById(projectId: String): ProjectEntity?

    @Query("SELECT * FROM projects ORDER BY updated_at DESC")
    suspend fun getAllProjects(): List<ProjectEntity>

    @Query("DELETE FROM projects WHERE id = :projectId")
    suspend fun deleteProjectById(projectId: String)

    @Query("SELECT COUNT(*) FROM projects")
    suspend fun getProjectCount(): Int
}

@Dao
interface LayerDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertLayers(layers: List<LayerEntity>)

    @Query("SELECT * FROM layers WHERE project_id = :projectId ORDER BY order_index ASC")
    suspend fun getLayersForProject(projectId: String): List<LayerEntity>

    @Query("DELETE FROM layers WHERE project_id = :projectId")
    suspend fun deleteLayersByProject(projectId: String)
}

@Dao
interface TracingDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOrUpdate(tracing: TracingEntity)

    @Query("SELECT * FROM project_tracings WHERE project_id = :projectId LIMIT 1")
    suspend fun getTracingForProject(projectId: String): TracingEntity?

    @Query("DELETE FROM project_tracings WHERE project_id = :projectId")
    suspend fun deleteTracingByProject(projectId: String)
}

@Dao
interface CrashRecoveryDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun saveEmergencyCheckpoint(record: CrashRecoveryEntity)

    @Query("SELECT * FROM crash_recovery WHERE id = 'latest_emergency_checkpoint' LIMIT 1")
    suspend fun getLatestEmergencyCheckpoint(): CrashRecoveryEntity?

    @Query("DELETE FROM crash_recovery WHERE id = 'latest_emergency_checkpoint'")
    suspend fun clearEmergencyCheckpoint()
}
