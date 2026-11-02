/**
 * @file sqliteStorageService.ts
 * @description Servicio cliente del subsistema de almacenamiento SQLite Wasm con OPFS.
 * 
 * Gestiona el ciclo de vida del Web Worker dedicado, serialización de capas en alta fidelidad,
 * auto-guardado no bloqueante (*debounced*), y mecanismos de salvaguarda ante:
 * - Cierre de la app por el usuario deslizando la ventana de recientes (visibilitychange / pagehide).
 * - Descarga del proceso por falta de memoria RAM (OOM) en teléfonos móviles.
 * - Errores de renderizado o excepciones no controladas de JavaScript (window.onerror).
 */

import { Layer, ProjectData } from '../engine/types';
import {
  WorkerRequest,
  WorkerResponse,
  StoredProjectPayload,
  SerializedLayerData,
  CrashRecoveryRecord,
  StorageDiagnostics,
} from './sqliteTypes';

class SqliteStorageService {
  private worker: Worker | null = null;
  private pendingRequests = new Map<string, { resolve: (val: any) => void; reject: (err: any) => void }>();
  private requestCounter = 0;
  private isInitPromise: Promise<StorageDiagnostics> | null = null;
  private autoSaveTimer: any = null;
  private lastAutoSaveTimestamp = 0;
  private currentActiveProject: ProjectData | null = null;
  private currentActiveLayers: Layer[] = [];
  private isInitialized = false;

  constructor() {
    this.setupLifecycleGuards();
  }

  /**
   * Inicializa el Web Worker y la base de datos en OPFS
   */
  public async init(dbName = 'inkflow_studio.sqlite3'): Promise<StorageDiagnostics> {
    if (this.isInitPromise) {
      return this.isInitPromise;
    }

    this.isInitPromise = new Promise((resolve, reject) => {
      try {
        if (typeof window === 'undefined' || typeof Worker === 'undefined') {
          resolve(this.getFallbackDiagnostics('Servidor / sin soporte de Web Workers'));
          return;
        }

        // Instanciar Worker dedicado con import.meta.url de Vite
        this.worker = new Worker(
          new URL('./sqliteStorage.worker.ts', import.meta.url),
          { type: 'module' }
        );

        this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
          this.handleWorkerMessage(event.data);
        };

        this.worker.onerror = (err) => {
          console.error('[SqliteStorageService Worker Error]:', err);
        };

        // Enviar petición de inicialización
        const initReq: WorkerRequest = { type: 'INIT', payload: { dbName } };
        
        // Timeout de seguridad por si el entorno bloquea workers
        const timeout = setTimeout(() => {
          console.warn('[SqliteStorageService] Timeout de inicialización Wasm Worker, usando fallback');
          resolve(this.getFallbackDiagnostics('Timeout'));
        }, 6000);

        this.pendingRequests.set('init_internal', {
          resolve: (diag: StorageDiagnostics) => {
            clearTimeout(timeout);
            this.isInitialized = true;
            resolve(diag);
          },
          reject: (err: any) => {
            clearTimeout(timeout);
            resolve(this.getFallbackDiagnostics(err?.message || 'Error init'));
          },
        });

        this.worker.postMessage(initReq);
      } catch (err) {
        console.warn('[SqliteStorageService] No se pudo crear el Worker Wasm:', err);
        resolve(this.getFallbackDiagnostics(String(err)));
      }
    });

    return this.isInitPromise;
  }

  /**
   * Despacha mensajes entrantes del Web Worker y resuelve promesas pendientes
   */
  private handleWorkerMessage(data: WorkerResponse) {
    if (!data) return;

    if (data.type === 'INIT_SUCCESS') {
      const pending = this.pendingRequests.get('init_internal');
      if (pending) {
        this.pendingRequests.delete('init_internal');
        pending.resolve(data.diagnostics);
      }
      return;
    }

    if (data.type === 'INIT_ERROR') {
      const pending = this.pendingRequests.get('init_internal');
      if (pending) {
        this.pendingRequests.delete('init_internal');
        pending.reject(new Error(data.error));
      }
      return;
    }

    const reqId = (data as any).id;
    if (reqId && this.pendingRequests.has(reqId)) {
      const { resolve, reject } = this.pendingRequests.get(reqId)!;
      this.pendingRequests.delete(reqId);

      if (data.type === 'ERROR') {
        reject(new Error(data.error));
      } else {
        resolve(data);
      }
    }
  }

  private sendRequest<T = any>(req: WorkerRequest & { id?: string }): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('SQLite Worker no disponible'));
        return;
      }

      const id = `req_${++this.requestCounter}_${Date.now()}`;
      (req as any).id = id;

      this.pendingRequests.set(id, { resolve, reject });
      this.worker.postMessage(req);
    });
  }

  /**
   * Guarda un proyecto con todas sus capas en SQLite Wasm (OPFS)
   */
  public async saveProject(
    project: ProjectData,
    layers: Layer[],
    isCrashCheckpoint = false
  ): Promise<{ projectId: string; timestamp: number }> {
    await this.init();

    // Actualizar referencia en memoria para auto-guardado de ciclo de vida
    this.currentActiveProject = project;
    this.currentActiveLayers = layers;

    // Serializar capas convirtiendo los Canvas a Data URLs PNG con canal alfa
    const serializedLayers: SerializedLayerData[] = layers.map((layer, index) => {
      let imageDataUrl = '';
      try {
        imageDataUrl = layer.canvas.toDataURL('image/png');
      } catch (e) {
        console.warn('Error al serializar canvas de capa:', e);
      }

      return {
        id: layer.id,
        name: layer.name,
        orderIndex: index,
        visible: layer.visible,
        opacity: layer.opacity,
        blendMode: layer.blendMode,
        locked: layer.locked,
        imageDataUrl,
      };
    });

    const payload: StoredProjectPayload = {
      project,
      layers: serializedLayers,
      isCrashCheckpoint,
      timestamp: Date.now(),
    };

    const res = await this.sendRequest({
      type: 'SAVE_PROJECT',
      id: '',
      payload,
    });

    return {
      projectId: res.projectId,
      timestamp: res.timestamp,
    };
  }

  /**
   * Carga un proyecto y todas sus capas desde SQLite Wasm
   */
  public async loadProject(projectId: string): Promise<{ project: ProjectData; layers: SerializedLayerData[] } | null> {
    await this.init();

    const res = await this.sendRequest({
      type: 'LOAD_PROJECT',
      id: '',
      projectId,
    });

    if (!res.data) return null;
    return {
      project: res.data.project,
      layers: res.data.layers,
    };
  }

  /**
   * Obtiene la lista de todos los proyectos guardados
   */
  public async getAllProjects(): Promise<ProjectData[]> {
    await this.init();

    const res = await this.sendRequest({
      type: 'GET_ALL_PROJECTS',
      id: '',
    });

    return res.projects || [];
  }

  /**
   * Elimina un proyecto
   */
  public async deleteProject(projectId: string): Promise<boolean> {
    await this.init();

    const res = await this.sendRequest({
      type: 'DELETE_PROJECT',
      id: '',
      projectId,
    });

    return Boolean(res.success);
  }

  /**
   * Duplica un proyecto existente
   */
  public async duplicateProject(projectId: string, newId: string, newName: string): Promise<ProjectData> {
    await this.init();

    const res = await this.sendRequest({
      type: 'DUPLICATE_PROJECT',
      id: '',
      projectId,
      newId,
      newName,
    });

    return res.duplicated;
  }

  /**
   * Programa un auto-guardado inteligente (debounced a 1.2 segundos tras dibujar)
   */
  public scheduleAutoSave(project: ProjectData, layers: Layer[], delayMs = 1200): void {
    this.currentActiveProject = project;
    this.currentActiveLayers = layers;

    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
    }

    this.autoSaveTimer = setTimeout(() => {
      this.executeAutoSave();
    }, delayMs);
  }

  /**
   * Ejecuta el auto-guardado en segundo plano
   */
  private async executeAutoSave(): Promise<void> {
    if (!this.currentActiveProject || !this.currentActiveLayers.length) return;

    try {
      await this.saveProject(this.currentActiveProject, this.currentActiveLayers, true);
      this.lastAutoSaveTimestamp = Date.now();
    } catch (err) {
      console.warn('[AutoSave SQLite Worker]: Fallo en auto-guardado periódico:', err);
    }
  }

  /**
   * Salvaguarda de emergencia inmediata (Síncrona/Directa) ante salida de la app o crash
   */
  public emergencySave(): void {
    if (!this.currentActiveProject || !this.currentActiveLayers.length || !this.worker) return;

    try {
      const serializedLayers: SerializedLayerData[] = this.currentActiveLayers.map((layer, index) => ({
        id: layer.id,
        name: layer.name,
        orderIndex: index,
        visible: layer.visible,
        opacity: layer.opacity,
        blendMode: layer.blendMode,
        locked: layer.locked,
        imageDataUrl: layer.canvas.toDataURL('image/png'),
      }));

      const payload: StoredProjectPayload = {
        project: this.currentActiveProject,
        layers: serializedLayers,
        isCrashCheckpoint: true,
        timestamp: Date.now(),
      };

      // Enviar inmediatamente sin esperar promesa
      this.worker.postMessage({
        type: 'SAVE_EMERGENCY_CRASH',
        id: `emergency_${Date.now()}`,
        payload,
      });

      // Respaldo de contingencia en sessionStorage
      try {
        sessionStorage.setItem('inkflow_emergency_saved_at', String(Date.now()));
        sessionStorage.setItem('inkflow_emergency_project_id', this.currentActiveProject.id);
      } catch {
        // Ignorar
      }
    } catch (err) {
      console.error('[SqliteStorageService] Error en guardado de emergencia:', err);
    }
  }

  /**
   * Comprueba si existe un dibujo recuperable de un crash o salida abrupta previa
   */
  public async checkCrashRecovery(): Promise<CrashRecoveryRecord | null> {
    await this.init();

    try {
      const res = await this.sendRequest({
        type: 'CHECK_CRASH_RECOVERY',
        id: '',
      });
      return res.recovery || null;
    } catch {
      return null;
    }
  }

  /**
   * Limpia el registro de recuperación de crash
   */
  public async clearCrashRecovery(): Promise<void> {
    await this.init();
    try {
      await this.sendRequest({
        type: 'CLEAR_CRASH_RECOVERY',
        id: '',
      });
    } catch {
      // Ignorar
    }
  }

  /**
   * Diagnóstico de salud de SQLite Wasm y OPFS
   */
  public async getDiagnostics(): Promise<StorageDiagnostics> {
    await this.init();
    try {
      const res = await this.sendRequest({
        type: 'GET_DIAGNOSTICS',
        id: '',
      });
      return res.diagnostics;
    } catch {
      return this.getFallbackDiagnostics('Error al consultar worker');
    }
  }

  /**
   * Configuración de centinelas de ciclo de vida móvil (Android / iOS)
   */
  private setupLifecycleGuards(): void {
    if (typeof window === 'undefined') return;

    // 1. Cuando el usuario minimiza la PWA o cambia a otra app en el teléfono
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.emergencySave();
      }
    });

    // 2. Cuando el navegador móvil descarga la página del proceso
    window.addEventListener('pagehide', () => {
      this.emergencySave();
    });

    // 3. Captura global de errores fatales de JavaScript (Crash)
    window.addEventListener('error', (event) => {
      console.error('[Global Error Guard Captured Crash]:', event.error);
      this.emergencySave();
    });

    window.addEventListener('unhandledrejection', (event) => {
      console.error('[Global Unhandled Rejection Guard]:', event.reason);
      this.emergencySave();
    });
  }

  private getFallbackDiagnostics(reason: string): StorageDiagnostics {
    return {
      isInitialized: false,
      backend: 'fallback',
      sqliteVersion: 'wasm-unavailable',
      opfsSupported: false,
      dbFileName: 'inkflow_studio.sqlite3',
      projectCount: 0,
      lastSaveTimestamp: null,
    };
  }
}

export const sqliteStorageService = new SqliteStorageService();
