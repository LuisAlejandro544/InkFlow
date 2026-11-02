/**
 * @file sqliteTypes.ts
 * @description Definición de tipos y mensajes IPC para el subsistema de almacenamiento
 * SQLite en WebAssembly con backend OPFS (Origin Private File System) en Web Worker.
 * 
 * Diseñado bajo arquitectura desacoplada para evitar bloqueos del hilo principal
 * en dispositivos móviles de 32 y 64 bits.
 */

import { BlendMode, ProjectData } from '../engine/types';

export interface SerializedLayerData {
  id: string;
  name: string;
  orderIndex: number;
  visible: boolean;
  opacity: number;
  blendMode: BlendMode;
  locked?: boolean;
  imageDataUrl: string; // PNG en base64 para persistencia fiel con canal alfa
  vectorStrokesJson?: string;
}

export interface StoredProjectPayload {
  project: ProjectData;
  layers: SerializedLayerData[];
  isCrashCheckpoint?: boolean;
  timestamp: number;
}

export interface CrashRecoveryRecord {
  projectId: string;
  projectName: string;
  width: number;
  height: number;
  timestamp: number;
  layerCount: number;
  previewThumbnailUrl: string;
  payloadJson: string;
}

export interface StorageDiagnostics {
  isInitialized: boolean;
  backend: 'opfs' | 'in-memory' | 'kvvfs' | 'fallback';
  sqliteVersion: string;
  opfsSupported: boolean;
  dbFileName: string;
  projectCount: number;
  lastSaveTimestamp: number | null;
}

// Mensajes IPC del hilo principal hacia el Worker
export type WorkerRequest = 
  | { type: 'INIT'; payload?: { dbName?: string } }
  | { type: 'SAVE_PROJECT'; id: string; payload: StoredProjectPayload }
  | { type: 'LOAD_PROJECT'; id: string; projectId: string }
  | { type: 'GET_ALL_PROJECTS'; id: string }
  | { type: 'DELETE_PROJECT'; id: string; projectId: string }
  | { type: 'DUPLICATE_PROJECT'; id: string; projectId: string; newId: string; newName: string }
  | { type: 'SAVE_EMERGENCY_CRASH'; id: string; payload: StoredProjectPayload }
  | { type: 'CHECK_CRASH_RECOVERY'; id: string }
  | { type: 'CLEAR_CRASH_RECOVERY'; id: string }
  | { type: 'GET_DIAGNOSTICS'; id: string };

// Respuestas del Worker hacia el hilo principal
export type WorkerResponse =
  | { type: 'INIT_SUCCESS'; diagnostics: StorageDiagnostics }
  | { type: 'INIT_ERROR'; error: string }
  | { type: 'SAVE_PROJECT_SUCCESS'; id: string; projectId: string; timestamp: number }
  | { type: 'LOAD_PROJECT_SUCCESS'; id: string; data: StoredProjectPayload | null }
  | { type: 'GET_ALL_PROJECTS_SUCCESS'; id: string; projects: ProjectData[] }
  | { type: 'DELETE_PROJECT_SUCCESS'; id: string; success: boolean }
  | { type: 'DUPLICATE_PROJECT_SUCCESS'; id: string; duplicated: ProjectData }
  | { type: 'SAVE_EMERGENCY_CRASH_SUCCESS'; id: string }
  | { type: 'CHECK_CRASH_RECOVERY_SUCCESS'; id: string; recovery: CrashRecoveryRecord | null }
  | { type: 'CLEAR_CRASH_RECOVERY_SUCCESS'; id: string }
  | { type: 'GET_DIAGNOSTICS_SUCCESS'; id: string; diagnostics: StorageDiagnostics }
  | { type: 'ERROR'; id?: string; error: string };
