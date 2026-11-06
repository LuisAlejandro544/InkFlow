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

import { Layer, ProjectData, TracingReference } from '../engine/types';
import {
  WorkerRequest,
  WorkerResponse,
  StoredProjectPayload,
  SerializedLayerData,
  SerializedTracingData,
  CrashRecoveryRecord,
  StorageDiagnostics,
} from './sqliteTypes';

/**
 * Serializa la foto de calco o accesorio conservando su ángulo exacto, escala y posición
 */
export function serializeTracing(tracing: TracingReference | null): SerializedTracingData | null {
  if (!tracing || !tracing.src) return null;
  return {
    id: tracing.id,
    src: tracing.src,
    x: tracing.x,
    y: tracing.y,
    width: tracing.width,
    height: tracing.height,
    scale: tracing.scale,
    rotation: tracing.rotation, // Ángulo exacto de rotación del calco
    opacity: tracing.opacity,
    visible: tracing.visible,
    isAdjusting: tracing.isAdjusting,
    filterMode: tracing.filterMode,
    purpose: tracing.purpose,
    extractedColors: tracing.extractedColors,
  };
}

/**
 * Reconstruye el objeto TracingReference a partir de los datos serializados en disco
 */
export function deserializeTracing(data: SerializedTracingData | null | undefined): Promise<TracingReference | null> {
  if (!data || !data.src) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({
        id: data.id,
        image: img,
        src: data.src,
        x: data.x,
        y: data.y,
        width: data.width,
        height: data.height,
        scale: data.scale,
        rotation: data.rotation ?? 0,
        opacity: data.opacity ?? 0.4,
        visible: data.visible !== false,
        isAdjusting: data.isAdjusting ?? false,
        filterMode: (data.filterMode as any) || 'original',
        purpose: data.purpose || 'tracing',
        extractedColors: data.extractedColors,
      });
    };
    img.onerror = () => {
      console.warn('[Tracing] No se pudo recargar la imagen de calco desde el almacenamiento');
      resolve(null);
    };
    img.src = data.src;
  });
}

class SqliteStorageService {
  private worker: Worker | null = null;
  private pendingRequests = new Map<string, { resolve: (val: any) => void; reject: (err: any) => void }>();
  private requestCounter = 0;
  private isInitPromise: Promise<StorageDiagnostics> | null = null;
  private autoSaveTimer: any = null;
  private lastAutoSaveTimestamp = 0;
  private currentActiveProject: ProjectData | null = null;
  private currentActiveLayers: Layer[] = [];
  private currentActiveTracing: TracingReference | null = null;
  private isInitialized = false;

  constructor() {
    this.setupLifecycleGuards();
  }

  /**
   * Sincroniza la foto de calco activa para auto-guardado y salvaguarda de emergencia
   */
  public setCurrentTracing(tracing: TracingReference | null): void {
    this.currentActiveTracing = tracing;

    // Sincronización inmediata con Room en disco físico (APK Android)
    if (typeof window !== 'undefined' && (window as any).InkFlowNativeBridge?.saveTracingToRoom && this.currentActiveProject) {
      try {
        const serialized = serializeTracing(tracing);
        if (serialized) {
          (window as any).InkFlowNativeBridge.saveTracingToRoom(
            this.currentActiveProject.id,
            JSON.stringify(serialized),
            serialized.src || ''
          );
        }
      } catch (e) {
        console.warn('[Room Native] Error al sincronizar calco con Room:', e);
      }
    }
  }

  public getCurrentTracing(): TracingReference | null {
    return this.currentActiveTracing;
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
   * Guarda un proyecto con todas sus capas y foto de calco en SQLite Wasm (OPFS)
   */
  public async saveProject(
    project: ProjectData,
    layers: Layer[],
    tracingRef?: TracingReference | null,
    isCrashCheckpoint = false
  ): Promise<{ projectId: string; timestamp: number }> {
    await this.init();

    // Actualizar referencia en memoria para auto-guardado de ciclo de vida
    this.currentActiveProject = project;
    this.currentActiveLayers = layers;
    if (tracingRef !== undefined) {
      this.currentActiveTracing = tracingRef;
    }

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
      tracing: serializeTracing(this.currentActiveTracing),
      isCrashCheckpoint,
      timestamp: Date.now(),
    };

    // Si corre en APK con puente Room nativo, sincronizar calco con Room en disco físico
    if (typeof window !== 'undefined' && (window as any).InkFlowNativeBridge?.saveTracingToRoom) {
      try {
        const serializedTracing = serializeTracing(this.currentActiveTracing);
        if (serializedTracing) {
          (window as any).InkFlowNativeBridge.saveTracingToRoom(
            project.id,
            JSON.stringify(serializedTracing),
            serializedTracing.src || ''
          );
        }
      } catch (e) {
        console.warn('[Room Native] Error guardando calco en Room:', e);
      }
    }

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
   * Carga un proyecto, todas sus capas y su foto de calco desde SQLite Wasm o Room
   */
  public async loadProject(projectId: string): Promise<{
    project: ProjectData;
    layers: SerializedLayerData[];
    tracing?: SerializedTracingData | null;
  } | null> {
    await this.init();

    const res = await this.sendRequest({
      type: 'LOAD_PROJECT',
      id: '',
      projectId,
    });

    // Si corre en APK con puente Room, comprobar si Room tiene el calco persistido en disco físico
    if (typeof window !== 'undefined' && (window as any).InkFlowNativeBridge?.loadTracingFromRoom) {
      try {
        const raw = (window as any).InkFlowNativeBridge.loadTracingFromRoom(projectId);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.success && parsed.data) {
            if (res && res.data) {
              res.data.tracing = parsed.data;
            } else if (!res || !res.data) {
              // Si SQLite no lo tenía, reconstruir con calco de Room
              return {
                project: {
                  id: projectId,
                  name: 'Ilustración',
                  width: parsed.data.width || 800,
                  height: parsed.data.height || 600,
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                  thumbnailUrl: '',
                  layerCount: 1,
                },
                layers: [],
                tracing: parsed.data,
              };
            }
          }
        }
      } catch (e) {
        console.warn('[Room Native] Error cargando calco desde Room:', e);
      }
    }

    if (!res.data) return null;
    return {
      project: res.data.project,
      layers: res.data.layers,
      tracing: res.data.tracing || null,
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
    if (typeof window !== 'undefined' && (window as any).InkFlowNativeBridge?.deleteProjectFromRoom) {
      try {
        (window as any).InkFlowNativeBridge.deleteProjectFromRoom(projectId);
      } catch {}
    }

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
   * Programa un auto-guardado inteligente (debounced tras dibujar o rotar/mover calco)
   */
  public scheduleAutoSave(
    project: ProjectData,
    layers: Layer[],
    tracingRefOrDelayMs?: TracingReference | null | number,
    delayMs = 1200
  ): void {
    this.currentActiveProject = project;
    this.currentActiveLayers = layers;

    let effectiveDelay = delayMs;
    if (typeof tracingRefOrDelayMs === 'number') {
      effectiveDelay = tracingRefOrDelayMs;
    } else if (tracingRefOrDelayMs !== undefined) {
      this.currentActiveTracing = tracingRefOrDelayMs;
    }

    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
    }

    this.autoSaveTimer = setTimeout(() => {
      this.executeAutoSave();
    }, effectiveDelay);
  }

  /**
   * Ejecuta el auto-guardado en segundo plano
   */
  private async executeAutoSave(): Promise<void> {
    if (!this.currentActiveProject || !this.currentActiveLayers.length) return;

    try {
      await this.saveProject(this.currentActiveProject, this.currentActiveLayers, this.currentActiveTracing, true);
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

      const serializedTracing = serializeTracing(this.currentActiveTracing);

      const payload: StoredProjectPayload = {
        project: this.currentActiveProject,
        layers: serializedLayers,
        tracing: serializedTracing,
        isCrashCheckpoint: true,
        timestamp: Date.now(),
      };

      // 1. Si estamos en el APK Android con Room, guardar inmediatamente de forma síncrona en disco
      if (typeof window !== 'undefined' && (window as any).InkFlowNativeBridge?.saveEmergencyCrashToRoom) {
        try {
          const rawPayload = JSON.stringify(payload);
          (window as any).InkFlowNativeBridge.saveEmergencyCrashToRoom(rawPayload);
          console.log('✅ [Room Native] Checkpoint de emergencia guardado con éxito en Room y disco físico');
        } catch (err) {
          console.warn('[Room Native] Error en guardado de emergencia Room:', err);
        }
      }

      // 2. Enviar al worker SQLite Wasm en segundo plano
      this.worker.postMessage({
        type: 'SAVE_EMERGENCY_CRASH',
        id: `emergency_${Date.now()}`,
        payload,
      });

      // 3. Respaldo persistente de contingencia en localStorage (sobrevive en Android WebView)
      try {
        localStorage.setItem('inkflow_emergency_saved_at', String(Date.now()));
        localStorage.setItem('inkflow_emergency_project_id', this.currentActiveProject.id);
        localStorage.setItem('inkflow_emergency_checkpoint_payload', JSON.stringify(payload));
        if (serializedTracing) {
          localStorage.setItem('inkflow_emergency_tracing', JSON.stringify(serializedTracing));
        } else {
          localStorage.removeItem('inkflow_emergency_tracing');
        }
      } catch {
        // Ignorar límites de cuota
      }
    } catch (err) {
      console.error('[SqliteStorageService] Error en guardado de emergencia:', err);
    }
  }

  /**
   * Comprueba si existe un dibujo recuperable de un crash o salida abrupta previa
   */
  public async checkCrashRecovery(): Promise<CrashRecoveryRecord | null> {
    // 1. Primero consultar a Android Jetpack Room en el APK
    if (typeof window !== 'undefined' && (window as any).InkFlowNativeBridge?.checkCrashRecoveryFromRoom) {
      try {
        const raw = (window as any).InkFlowNativeBridge.checkCrashRecoveryFromRoom();
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.recovery) {
            return parsed.recovery;
          }
        }
      } catch (err) {
        console.warn('[Room Native] Error consultando crash en Room:', err);
      }
    }

    // 2. Consultar al motor SQLite Wasm
    await this.init();

    try {
      const res = await this.sendRequest({
        type: 'CHECK_CRASH_RECOVERY',
        id: '',
      });
      if (res.recovery) {
        return res.recovery;
      }
    } catch {
      // Continuar al fallback de contingencia
    }

    // 3. Fallback de contingencia en localStorage
    try {
      if (typeof localStorage !== 'undefined') {
        const rawPayload = localStorage.getItem('inkflow_emergency_checkpoint_payload');
        if (rawPayload) {
          const payload = JSON.parse(rawPayload);
          return {
            projectId: payload.project.id,
            projectName: payload.project.name,
            width: payload.project.width,
            height: payload.project.height,
            timestamp: payload.timestamp || Date.now(),
            layerCount: payload.layers?.length || 1,
            previewThumbnailUrl: payload.project.thumbnailUrl || '',
            payloadJson: rawPayload,
          };
        }
      }
    } catch {
      // Ignorar
    }

    return null;
  }

  /**
   * Limpia el registro de recuperación de crash
   */
  public async clearCrashRecovery(): Promise<void> {
    if (typeof window !== 'undefined' && (window as any).InkFlowNativeBridge?.clearCrashRecoveryFromRoom) {
      try {
        (window as any).InkFlowNativeBridge.clearCrashRecoveryFromRoom();
      } catch {}
    }

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('inkflow_emergency_saved_at');
        localStorage.removeItem('inkflow_emergency_project_id');
        localStorage.removeItem('inkflow_emergency_checkpoint_payload');
        localStorage.removeItem('inkflow_emergency_tracing');
      }
    } catch {}

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
