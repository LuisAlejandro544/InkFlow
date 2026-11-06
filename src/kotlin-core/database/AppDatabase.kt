/**
 * @file AppDatabase.kt
 * @package com.inkflow.studio.database
 * @description Base de datos principal de Android Jetpack Room para InkFlow Studio.
 * 
 * Gestiona el ciclo de vida de SQLite nativo en disco local (/data/user/0/com.inkflow.studio/databases/inkflow_studio_room.db).
 * Provee acceso seguro por hilos e inicialización Singleton.
 */

package com.inkflow.studio.database

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(
    entities = [
        ProjectEntity::class,
        LayerEntity::class,
        TracingEntity::class,
        CrashRecoveryEntity::class
    ],
    version = 1,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {

    abstract fun projectDao(): ProjectDao
    abstract fun layerDao(): LayerDao
    abstract fun tracingDao(): TracingDao
    abstract fun crashRecoveryDao(): CrashRecoveryDao

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        fun getInstance(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "inkflow_studio_room.db"
                )
                    .fallbackToDestructiveMigration()
                    .build()
                INSTANCE = instance
                instance
            }
        }
    }
}
