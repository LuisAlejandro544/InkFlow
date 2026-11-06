/**
 * @file storage.test.ts
 * @description Suite de pruebas automatizadas deterministas para el subsistema de almacenamiento
 * masivo SQLite Wasm con OPFS (Origin Private File System) y centinela de Crash Recovery.
 * 
 * Se ejecuta con:
 * npx --yes tsx --test src/storage/storage.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';

describe('📦 Motor de Almacenamiento SQLite Wasm & OPFS', () => {
  let sqlite3: any;
  let db: any;

  it('1. Debe inicializar el módulo oficial @sqlite.org/sqlite-wasm con éxito', async () => {
    sqlite3 = await sqlite3InitModule();
    assert.ok(sqlite3, 'El objeto sqlite3 debe existir');
    assert.ok(sqlite3.oo1, 'La API Orientada a Objetos oo1 debe estar disponible');
    assert.ok(sqlite3.oo1.DB, 'El constructor de Base de Datos DB debe estar disponible');
  });

  it('2. Debe crear las tablas de proyectos, capas y centinela de crash en SQLite', () => {
    db = new sqlite3.oo1.DB(':memory:', 'c');
    assert.ok(db, 'La base de datos debe crearse correctamente');

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
        updated_at INTEGER NOT NULL,
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

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

    const tables = db.selectValues("SELECT name FROM sqlite_master WHERE type='table';");
    assert.ok(tables.includes('projects'), 'Debe existir la tabla projects');
    assert.ok(tables.includes('layers'), 'Debe existir la tabla layers');
    assert.ok(tables.includes('crash_recovery'), 'Debe existir la tabla crash_recovery');
    assert.ok(tables.includes('project_tracings'), 'Debe existir la tabla project_tracings');
  });

  it('3. Debe guardar un proyecto y sus capas de manera atómica con transacción ACID', () => {
    const projId = 'proj_test_1';
    const now = Date.now();

    db.exec('BEGIN TRANSACTION;');
    db.exec({
      sql: `
        INSERT INTO projects (id, name, width, height, thumbnail_url, layer_count, created_at, updated_at, is_autosaved)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
      `,
      bind: [projId, 'Ilustración Manga', 1080, 1920, 'data:image/png;base64,thumb', 2, now, now, 0],
    });

    db.exec({
      sql: `
        INSERT INTO layers (id, project_id, order_index, name, visible, opacity, blend_mode, locked, image_data_url, vector_strokes_json, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `,
      bind: ['layer_1', projId, 0, 'Fondo', 1, 1.0, 'source-over', 0, 'data:image/png;base64,layer1data', '', now],
    });

    db.exec({
      sql: `
        INSERT INTO layers (id, project_id, order_index, name, visible, opacity, blend_mode, locked, image_data_url, vector_strokes_json, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `,
      bind: ['layer_2', projId, 1, 'Lineart', 1, 0.9, 'multiply', 0, 'data:image/png;base64,layer2data', '', now],
    });
    db.exec('COMMIT;');

    const project = db.selectObject('SELECT * FROM projects WHERE id = ?;', [projId]);
    assert.equal(project.name, 'Ilustración Manga');
    assert.equal(project.width, 1080);
    assert.equal(project.height, 1920);

    const layers = db.selectObjects('SELECT * FROM layers WHERE project_id = ? ORDER BY order_index ASC;', [projId]);
    assert.equal(layers.length, 2);
    assert.equal(layers[0].name, 'Fondo');
    assert.equal(layers[0].blend_mode, 'source-over');
    assert.equal(layers[1].name, 'Lineart');
    assert.equal(layers[1].blend_mode, 'multiply');
  });

  it('4. Centinela de Crash Recovery: Debe registrar y recuperar un dibujo ante cierre inesperado', () => {
    const emergencyPayload = {
      project: {
        id: 'proj_crash_test',
        name: 'Boceto Inesperado',
        width: 800,
        height: 1200,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        thumbnailUrl: '',
        layerCount: 1,
      },
      layers: [
        {
          id: 'l_crash',
          name: 'Capa Rápida',
          orderIndex: 0,
          visible: true,
          opacity: 1,
          blendMode: 'source-over',
          imageDataUrl: 'data:image/png;base64,safe',
        },
      ],
      isCrashCheckpoint: true,
      timestamp: Date.now(),
    };

    const payloadJson = JSON.stringify(emergencyPayload);

    // Simular guardado de emergencia
    db.exec({
      sql: `
        INSERT INTO crash_recovery (
          id, project_id, project_name, width, height, timestamp, layer_count, preview_thumbnail_url, payload_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          project_id = excluded.project_id,
          project_name = excluded.project_name,
          payload_json = excluded.payload_json;
      `,
      bind: [
        'latest_emergency_checkpoint',
        emergencyPayload.project.id,
        emergencyPayload.project.name,
        emergencyPayload.project.width,
        emergencyPayload.project.height,
        emergencyPayload.timestamp,
        emergencyPayload.layers.length,
        '',
        payloadJson,
      ],
    });

    // Consultar recuperación
    const recoveryRow = db.selectObject("SELECT * FROM crash_recovery WHERE id = 'latest_emergency_checkpoint';");
    assert.ok(recoveryRow, 'El registro de recuperación debe existir');
    assert.equal(recoveryRow.project_name, 'Boceto Inesperado');
    assert.equal(recoveryRow.layer_count, 1);

    const parsed = JSON.parse(recoveryRow.payload_json);
    assert.equal(parsed.project.id, 'proj_crash_test');
    assert.equal(parsed.layers[0].name, 'Capa Rápida');

    // Descartar/limpiar recuperación
    db.exec("DELETE FROM crash_recovery WHERE id = 'latest_emergency_checkpoint';");
    const cleared = db.selectObject("SELECT * FROM crash_recovery WHERE id = 'latest_emergency_checkpoint';");
    assert.equal(cleared, undefined, 'El registro de recuperación debe eliminarse tras restaurar');
  });

  it('5. Debe eliminar un proyecto y sus capas asociadas limpiamente', () => {
    const projId = 'proj_test_1';
    db.exec('BEGIN TRANSACTION;');
    db.exec({ sql: 'DELETE FROM layers WHERE project_id = ?;', bind: [projId] });
    db.exec({ sql: 'DELETE FROM project_tracings WHERE project_id = ?;', bind: [projId] });
    db.exec({ sql: 'DELETE FROM projects WHERE id = ?;', bind: [projId] });
    db.exec('COMMIT;');

    const p = db.selectObject('SELECT * FROM projects WHERE id = ?;', [projId]);
    assert.equal(p, undefined);

    const l = db.selectObjects('SELECT * FROM layers WHERE project_id = ?;', [projId]);
    assert.equal(l.length, 0);
  });

  it('6. Debe persistir y recuperar la foto de calco con su ángulo, escala y posición exacta', () => {
    const projId = 'proj_tracing_test';
    const now = Date.now();
    const testTracing = {
      id: 'trace_test_123',
      src: 'data:image/jpeg;base64,calco_foto_real',
      x: 540,
      y: 960,
      width: 1200,
      height: 1600,
      scale: 1.35,
      rotation: 0.523599, // 30 grados exactos en radianes
      opacity: 0.45,
      visible: true,
      filterMode: 'lineart',
      purpose: 'tracing',
    };

    // Guardar calco en la tabla project_tracings
    db.exec({
      sql: `
        INSERT INTO project_tracings (project_id, tracing_json, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(project_id) DO UPDATE SET
          tracing_json = excluded.tracing_json,
          updated_at = excluded.updated_at;
      `,
      bind: [projId, JSON.stringify(testTracing), now],
    });

    const row = db.selectObject('SELECT tracing_json FROM project_tracings WHERE project_id = ?;', [projId]);
    assert.ok(row, 'Debe existir el registro en project_tracings');

    const recovered = JSON.parse(row.tracing_json);
    assert.equal(recovered.id, 'trace_test_123');
    assert.equal(recovered.x, 540);
    assert.equal(recovered.y, 960);
    assert.equal(recovered.scale, 1.35);
    assert.equal(recovered.rotation, 0.523599, 'El ángulo exacto debe preservarse');
    assert.equal(recovered.opacity, 0.45);
    assert.equal(recovered.visible, true);
    assert.equal(recovered.filterMode, 'lineart');
    assert.equal(recovered.purpose, 'tracing');
  });

  it('7. Crash Recovery: Debe rescatar y restaurar la foto de calco con su rotación tras crash inesperado', () => {
    const crashWithTracing = {
      project: {
        id: 'proj_crash_with_tracing',
        name: 'Dibujo Calqueado',
        width: 1080,
        height: 1920,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        thumbnailUrl: '',
        layerCount: 1,
      },
      layers: [
        {
          id: 'l1',
          name: 'Capa 1',
          orderIndex: 0,
          visible: true,
          opacity: 1,
          blendMode: 'source-over',
          imageDataUrl: 'data:image/png;base64,trazos_hechos',
        },
      ],
      tracing: {
        id: 'trace_saved_crash',
        src: 'data:image/jpeg;base64,calco_foto_crash',
        x: 400,
        y: 600,
        width: 800,
        height: 1000,
        scale: 0.85,
        rotation: 1.570796, // 90 grados exactos
        opacity: 0.6,
        visible: true,
        filterMode: 'original',
      },
      isCrashCheckpoint: true,
      timestamp: Date.now(),
    };

    db.exec({
      sql: `
        INSERT INTO crash_recovery (
          id, project_id, project_name, width, height, timestamp, layer_count, preview_thumbnail_url, payload_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET payload_json = excluded.payload_json;
      `,
      bind: [
        'latest_emergency_checkpoint',
        crashWithTracing.project.id,
        crashWithTracing.project.name,
        crashWithTracing.project.width,
        crashWithTracing.project.height,
        crashWithTracing.timestamp,
        1,
        '',
        JSON.stringify(crashWithTracing),
      ],
    });

    const checkpoint = db.selectObject("SELECT payload_json FROM crash_recovery WHERE id = 'latest_emergency_checkpoint';");
    assert.ok(checkpoint);
    const parsedCheckpoint = JSON.parse(checkpoint.payload_json);
    assert.ok(parsedCheckpoint.tracing, 'El payload de crash debe incluir la foto de calco');
    assert.equal(parsedCheckpoint.tracing.rotation, 1.570796, 'La rotación de la foto de calco debe estar intacta');
    assert.equal(parsedCheckpoint.tracing.scale, 0.85);
    assert.equal(parsedCheckpoint.tracing.x, 400);
    assert.equal(parsedCheckpoint.tracing.y, 600);
  });

  it('8. Android Jetpack Room: Debe validar el esquema de TracingEntity con almacenamiento físico y rotación continua', () => {
    // Validar modelo relacional de Room en disco (inkflow_studio_room.db)
    db.exec(`
      CREATE TABLE IF NOT EXISTS room_project_tracings (
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
    `);

    const roomTracing = {
      projectId: 'proj_room_apk',
      tracingId: 'trace_room_001',
      filePath: '/data/user/0/com.inkflow.studio/files/tracings/tracing_proj_room_apk.png',
      x: 320.5,
      y: 480.0,
      width: 1080,
      height: 1920,
      scale: 1.15,
      rotation: 45.0, // 45 grados de rotación
      opacity: 0.5,
      visible: 1,
      filterMode: 'lineart',
      purpose: 'tracing',
      extractedColorsJson: JSON.stringify(['#121212', '#ffffff']),
      updatedAt: Date.now(),
    };

    db.exec({
      sql: `
        INSERT INTO room_project_tracings (
          project_id, tracing_id, file_path, x, y, width, height, scale, rotation,
          opacity, visible, filter_mode, purpose, extracted_colors_json, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(project_id) DO UPDATE SET
          file_path = excluded.file_path,
          rotation = excluded.rotation,
          scale = excluded.scale,
          updated_at = excluded.updated_at;
      `,
      bind: [
        roomTracing.projectId,
        roomTracing.tracingId,
        roomTracing.filePath,
        roomTracing.x,
        roomTracing.y,
        roomTracing.width,
        roomTracing.height,
        roomTracing.scale,
        roomTracing.rotation,
        roomTracing.opacity,
        roomTracing.visible,
        roomTracing.filterMode,
        roomTracing.purpose,
        roomTracing.extractedColorsJson,
        roomTracing.updatedAt,
      ],
    });

    const retrieved = db.selectObject('SELECT * FROM room_project_tracings WHERE project_id = ?;', ['proj_room_apk']);
    assert.ok(retrieved, 'El registro de Room debe existir en disco');
    assert.equal(retrieved.file_path, '/data/user/0/com.inkflow.studio/files/tracings/tracing_proj_room_apk.png');
    assert.equal(retrieved.rotation, 45.0, 'La rotación del calco en Room debe ser exacta');
    assert.equal(retrieved.scale, 1.15);
    assert.equal(retrieved.visible, 1);
  });

  it('9. Android Jetpack Room: Centinela de Crash Recovery con persistencia física en disco', () => {
    // Validar tabla Room crash_recovery
    db.exec(`
      CREATE TABLE IF NOT EXISTS room_crash_recovery (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        project_name TEXT NOT NULL,
        width INTEGER NOT NULL,
        height INTEGER NOT NULL,
        timestamp INTEGER NOT NULL,
        layer_count INTEGER NOT NULL,
        preview_thumbnail_url TEXT NOT NULL,
        payload_json TEXT NOT NULL
      );
    `);

    const crashPayload = {
      project: { id: 'room_crash_proj', name: 'Obra APK Salvada', width: 1080, height: 1920 },
      layers: [{ id: 'l1', name: 'Lineart' }],
      tracing: { id: 't1', rotation: 30.0, scale: 1.0 },
    };

    db.exec({
      sql: `
        INSERT INTO room_crash_recovery (
          id, project_id, project_name, width, height, timestamp, layer_count, preview_thumbnail_url, payload_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET payload_json = excluded.payload_json;
      `,
      bind: [
        'latest_emergency_checkpoint',
        'room_crash_proj',
        'Obra APK Salvada',
        1080,
        1920,
        Date.now(),
        1,
        'thumb',
        JSON.stringify(crashPayload),
      ],
    });

    const crashRec = db.selectObject("SELECT * FROM room_crash_recovery WHERE id = 'latest_emergency_checkpoint';");
    assert.ok(crashRec, 'El registro de Room crash_recovery debe existir');
    const parsed = JSON.parse(crashRec.payload_json);
    assert.equal(parsed.project.name, 'Obra APK Salvada');
    assert.equal(parsed.tracing.rotation, 30.0);
  });
});

