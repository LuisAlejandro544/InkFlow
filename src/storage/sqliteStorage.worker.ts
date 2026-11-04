/**
 * @file sqliteStorage.worker.ts
 * @description Web Worker dedicado para la persistencia masiva de InkFlow Studio en SQLite Wasm
 * con backend OPFS (Origin Private File System).
 * 
 * Ventajas sobre localStorage y Dexie:
 * 1. Aislamiento total: El procesamiento de megabytes de píxeles y vectores ocurre fuera del hilo de UI,
 *    evitando congelamientos o caídas de FPS en pantallas táctiles de 60–120Hz.
 * 2. OPFS real: Almacenamiento privado de bajo nivel con acceso atómico a disco mediante WebAssembly.
 * 3. Transacciones ACID: Si el teléfono se apaga o se cierra abruptamente, la base de datos no se corrompe.
 * 4. Fallback automático transparente: Si el entorno restringe OPFS (iframe sin permisos), pasa a VFS persistente o memoria.
 */

import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import {
  WorkerRequest,
  WorkerResponse,
  StoredProjectPayload,
  CrashRecoveryRecord,
  StorageDiagnostics,
} from './sqliteTypes';

// Estado interno del worker
let sqlite3Instance: any = null;
let db: any = null;
let currentBackend: 'opfs' | 'in-memory' | 'kvvfs' | 'fallback' = 'in-memory';
let isOpfsAvailable = false;
let dbFileName = '/inkflow_studio.sqlite3';
let lastSaveTimestamp: number | null = null;

/**
 * Inicializa el módulo SQLite Wasm y abre la base de datos en OPFS
 */
async function initializeDatabase(customDbName?: string): Promise<StorageDiagnostics> {
  if (db && sqlite3Instance) {
    return getDiagnostics();
  }

  if (customDbName) {
    dbFileName = customDbName.startsWith('/') ? customDbName : `/${customDbName}`;
  }

  sqlite3Instance = await (sqlite3InitModule as any)({
    print: () => {}, // Silenciar logs excesivos en producción
    printErr: (msg: any) => console.error('[SQLite Wasm Worker Error]:', msg),
  });

  // Intentar inicializar en OPFS (Origin Private File System)
  try {
    if (sqlite3Instance.oo1 && 'OpfsDb' in sqlite3Instance.oo1) {
      db = new sqlite3Instance.oo1.OpfsDb(dbFileName);
      currentBackend = 'opfs';
      isOpfsAvailable = true;
    } else {
      // Fallback a VFS estándar persistente
      db = new sqlite3Instance.oo1.DB(dbFileName, 'c');
      currentBackend = 'fallback';
      isOpfsAvailable = false;
    }
  } catch (opfsErr) {
    console.warn('[SQLite Worker] OPFS no disponible en este contexto, usando fallback seguro:', opfsErr);
    try {
      db = new sqlite3Instance.oo1.DB(dbFileName, 'c');
      currentBackend = 'fallback';
    } catch {
      db = new sqlite3Instance.oo1.DB(':memory:', 'c');
      currentBackend = 'in-memory';
    }
    isOpfsAvailable = false;
  }

  // Crear esquema de tablas con índices
  db.exec(`
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
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_layers_project ON layers(project_id, order_index);

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

    CREATE TABLE IF NOT EXISTS project_tracings (
      project_id TEXT PRIMARY KEY,
      tracing_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  return getDiagnostics();
}

/**
 * Obtiene diagnóstico técnico del estado de la base de datos
 */
function getDiagnostics(): StorageDiagnostics {
  let projectCount = 0;
  try {
    if (db) {
      const res = db.selectValue('SELECT count(*) FROM projects;');
      projectCount = Number(res) || 0;
    }
  } catch {
    projectCount = 0;
  }

  return {
    isInitialized: !!db,
    backend: currentBackend,
    sqliteVersion: sqlite3Instance?.version?.libVersion || 'unknown',
    opfsSupported: isOpfsAvailable,
    dbFileName,
    projectCount,
    lastSaveTimestamp,
  };
}

/**
 * Guarda un proyecto completo junto con todas sus capas de manera atómica (ACID Transaction)
 */
function saveProject(payload: StoredProjectPayload): { projectId: string; timestamp: number } {
  if (!db) throw new Error('Base de datos SQLite Wasm no inicializada');

  const { project, layers, isCrashCheckpoint, timestamp } = payload;
  const now = timestamp || Date.now();

  db.exec('BEGIN TRANSACTION;');
  try {
    // 1. Insertar o actualizar proyecto
    db.exec({
      sql: `
        INSERT INTO projects (id, name, width, height, thumbnail_url, layer_count, created_at, updated_at, is_autosaved)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          width = excluded.width,
          height = excluded.height,
          thumbnail_url = excluded.thumbnail_url,
          layer_count = excluded.layer_count,
          updated_at = excluded.updated_at,
          is_autosaved = excluded.is_autosaved;
      `,
      bind: [
        project.id,
        project.name,
        project.width,
        project.height,
        project.thumbnailUrl || '',
        layers.length,
        project.createdAt || now,
        now,
        isCrashCheckpoint ? 1 : 0,
      ],
    });

    // 2. Eliminar capas anteriores para re-sincronizar el orden exacto
    db.exec({
      sql: 'DELETE FROM layers WHERE project_id = ?;',
      bind: [project.id],
    });

    // 3. Insertar todas las capas en orden
    for (const layer of layers) {
      db.exec({
        sql: `
          INSERT INTO layers (
            id, project_id, order_index, name, visible, opacity, blend_mode,
            locked, image_data_url, vector_strokes_json, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        `,
        bind: [
          layer.id,
          project.id,
          layer.orderIndex,
          layer.name,
          layer.visible ? 1 : 0,
          layer.opacity,
          layer.blendMode,
          layer.locked ? 1 : 0,
          layer.imageDataUrl,
          layer.vectorStrokesJson || '',
          now,
        ],
      });
    }

    // 4. Guardar o limpiar foto de calco asociada con su ángulo, escala y posición exacta
    if (payload.tracing) {
      db.exec({
        sql: `
          INSERT INTO project_tracings (project_id, tracing_json, updated_at)
          VALUES (?, ?, ?)
          ON CONFLICT(project_id) DO UPDATE SET
            tracing_json = excluded.tracing_json,
            updated_at = excluded.updated_at;
        `,
        bind: [project.id, JSON.stringify(payload.tracing), now],
      });
    } else if (payload.tracing === null) {
      db.exec({
        sql: 'DELETE FROM project_tracings WHERE project_id = ?;',
        bind: [project.id],
      });
    }

    db.exec('COMMIT;');
    lastSaveTimestamp = now;
    return { projectId: project.id, timestamp: now };
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

/**
 * Carga un proyecto y todas sus capas desde SQLite
 */
function loadProject(projectId: string): StoredProjectPayload | null {
  if (!db) throw new Error('Base de datos SQLite Wasm no inicializada');

  const projectRow = db.selectObject('SELECT * FROM projects WHERE id = ? LIMIT 1;', [projectId]);
  if (!projectRow) return null;

  const layerRows = db.selectObjects(
    'SELECT * FROM layers WHERE project_id = ? ORDER BY order_index ASC;',
    [projectId]
  );

  const layers = (layerRows || []).map((r: any) => ({
    id: r.id,
    name: r.name,
    orderIndex: r.order_index,
    visible: Boolean(r.visible),
    opacity: Number(r.opacity),
    blendMode: r.blend_mode,
    locked: Boolean(r.locked),
    imageDataUrl: r.image_data_url,
    vectorStrokesJson: r.vector_strokes_json || undefined,
  }));

  // Recuperar datos de la foto de calco con su ángulo, escala y transformación exacta
  let tracingData: any = null;
  try {
    const tracingRow = db.selectObject('SELECT tracing_json FROM project_tracings WHERE project_id = ? LIMIT 1;', [projectId]);
    if (tracingRow && tracingRow.tracing_json) {
      tracingData = JSON.parse(tracingRow.tracing_json);
    }
  } catch {
    // Si no existía registro de calco
  }

  return {
    project: {
      id: projectRow.id,
      name: projectRow.name,
      width: projectRow.width,
      height: projectRow.height,
      createdAt: projectRow.created_at,
      updatedAt: projectRow.updated_at,
      thumbnailUrl: projectRow.thumbnail_url || '',
      layerCount: layers.length,
    },
    layers,
    tracing: tracingData,
    timestamp: projectRow.updated_at,
    isCrashCheckpoint: Boolean(projectRow.is_autosaved),
  };
}

/**
 * Obtiene la lista de todos los proyectos ordenados por fecha de actualización
 */
function getAllProjects(): any[] {
  if (!db) throw new Error('Base de datos SQLite Wasm no inicializada');

  const rows = db.selectObjects(`
    SELECT id, name, width, height, created_at, updated_at, thumbnail_url, layer_count
    FROM projects
    ORDER BY updated_at DESC;
  `);

  return (rows || []).map((r: any) => ({
    id: r.id,
    name: r.name,
    width: r.width,
    height: r.height,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    thumbnailUrl: r.thumbnail_url || '',
    layerCount: r.layer_count || 1,
  }));
}

/**
 * Elimina un proyecto y sus capas asociadas
 */
function deleteProject(projectId: string): boolean {
  if (!db) throw new Error('Base de datos SQLite Wasm no inicializada');

  db.exec('BEGIN TRANSACTION;');
  try {
    db.exec({ sql: 'DELETE FROM layers WHERE project_id = ?;', bind: [projectId] });
    db.exec({ sql: 'DELETE FROM project_tracings WHERE project_id = ?;', bind: [projectId] });
    db.exec({ sql: 'DELETE FROM projects WHERE id = ?;', bind: [projectId] });
    db.exec({ sql: 'DELETE FROM crash_recovery WHERE project_id = ?;', bind: [projectId] });
    db.exec('COMMIT;');
    return true;
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

/**
 * Duplica un proyecto en SQLite
 */
function duplicateProject(projectId: string, newId: string, newName: string): any {
  const current = loadProject(projectId);
  if (!current) throw new Error('Proyecto no encontrado para duplicar');

  const now = Date.now();
  const dupProject = {
    ...current.project,
    id: newId,
    name: newName,
    createdAt: now,
    updatedAt: now,
  };

  const dupLayers = current.layers.map((l, idx) => ({
    ...l,
    id: `layer_${now}_${idx}`,
  }));

  saveProject({
    project: dupProject,
    layers: dupLayers,
    tracing: current.tracing || null,
    timestamp: now,
    isCrashCheckpoint: false,
  });

  return dupProject;
}

/**
 * Guarda un punto de recuperación de emergencia por crash o salida abrupta
 */
function saveEmergencyCrash(payload: StoredProjectPayload): void {
  if (!db) return;

  const now = Date.now();
  const recordId = 'latest_emergency_checkpoint';
  const payloadJson = JSON.stringify(payload);

  db.exec({
    sql: `
      INSERT INTO crash_recovery (
        id, project_id, project_name, width, height, timestamp, layer_count, preview_thumbnail_url, payload_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        project_id = excluded.project_id,
        project_name = excluded.project_name,
        width = excluded.width,
        height = excluded.height,
        timestamp = excluded.timestamp,
        layer_count = excluded.layer_count,
        preview_thumbnail_url = excluded.preview_thumbnail_url,
        payload_json = excluded.payload_json;
    `,
    bind: [
      recordId,
      payload.project.id,
      payload.project.name,
      payload.project.width,
      payload.project.height,
      now,
      payload.layers.length,
      payload.project.thumbnailUrl || '',
      payloadJson,
    ],
  });
}

/**
 * Consulta si hay un punto de recuperación de crash disponible
 */
function checkCrashRecovery(): CrashRecoveryRecord | null {
  if (!db) return null;

  const row = db.selectObject('SELECT * FROM crash_recovery WHERE id = ? LIMIT 1;', ['latest_emergency_checkpoint']);
  if (!row) return null;

  return {
    projectId: row.project_id,
    projectName: row.project_name,
    width: row.width,
    height: row.height,
    timestamp: row.timestamp,
    layerCount: row.layer_count,
    previewThumbnailUrl: row.preview_thumbnail_url || '',
    payloadJson: row.payload_json,
  };
}

/**
 * Limpia el registro de recuperación de crash una vez descartado o restaurado
 */
function clearCrashRecovery(): void {
  if (!db) return;
  db.exec({ sql: 'DELETE FROM crash_recovery WHERE id = ?;', bind: ['latest_emergency_checkpoint'] });
}

// Receptor de mensajes del hilo principal
self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const req = event.data;
  if (!req || !req.type) return;

  try {
    switch (req.type) {
      case 'INIT': {
        const diagnostics = await initializeDatabase(req.payload?.dbName);
        const res: WorkerResponse = { type: 'INIT_SUCCESS', diagnostics };
        self.postMessage(res);
        break;
      }

      case 'SAVE_PROJECT': {
        const result = saveProject(req.payload);
        const res: WorkerResponse = {
          type: 'SAVE_PROJECT_SUCCESS',
          id: req.id,
          projectId: result.projectId,
          timestamp: result.timestamp,
        };
        self.postMessage(res);
        break;
      }

      case 'LOAD_PROJECT': {
        const data = loadProject(req.projectId);
        const res: WorkerResponse = {
          type: 'LOAD_PROJECT_SUCCESS',
          id: req.id,
          data,
        };
        self.postMessage(res);
        break;
      }

      case 'GET_ALL_PROJECTS': {
        const projects = getAllProjects();
        const res: WorkerResponse = {
          type: 'GET_ALL_PROJECTS_SUCCESS',
          id: req.id,
          projects,
        };
        self.postMessage(res);
        break;
      }

      case 'DELETE_PROJECT': {
        const success = deleteProject(req.projectId);
        const res: WorkerResponse = {
          type: 'DELETE_PROJECT_SUCCESS',
          id: req.id,
          success,
        };
        self.postMessage(res);
        break;
      }

      case 'DUPLICATE_PROJECT': {
        const duplicated = duplicateProject(req.projectId, req.newId, req.newName);
        const res: WorkerResponse = {
          type: 'DUPLICATE_PROJECT_SUCCESS',
          id: req.id,
          duplicated,
        };
        self.postMessage(res);
        break;
      }

      case 'SAVE_EMERGENCY_CRASH': {
        saveEmergencyCrash(req.payload);
        const res: WorkerResponse = {
          type: 'SAVE_EMERGENCY_CRASH_SUCCESS',
          id: req.id,
        };
        self.postMessage(res);
        break;
      }

      case 'CHECK_CRASH_RECOVERY': {
        const recovery = checkCrashRecovery();
        const res: WorkerResponse = {
          type: 'CHECK_CRASH_RECOVERY_SUCCESS',
          id: req.id,
          recovery,
        };
        self.postMessage(res);
        break;
      }

      case 'CLEAR_CRASH_RECOVERY': {
        clearCrashRecovery();
        const res: WorkerResponse = {
          type: 'CLEAR_CRASH_RECOVERY_SUCCESS',
          id: req.id,
        };
        self.postMessage(res);
        break;
      }

      case 'GET_DIAGNOSTICS': {
        const diagnostics = getDiagnostics();
        const res: WorkerResponse = {
          type: 'GET_DIAGNOSTICS_SUCCESS',
          id: req.id,
          diagnostics,
        };
        self.postMessage(res);
        break;
      }

      default:
        self.postMessage({ type: 'ERROR', error: 'Tipo de mensaje no reconocido' });
    }
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    self.postMessage({
      type: 'ERROR',
      id: (req as any).id,
      error: errorMsg,
    });
  }
};
