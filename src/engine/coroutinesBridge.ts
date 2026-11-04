/**
 * @file coroutinesBridge.ts
 * @description Puente de concurrencia estructurada y flujos asíncronos basado en la arquitectura
 * `kotlinx.coroutines` (Kotlin/Wasm & Kotlin/Android) para InkFlow Studio.
 * 
 * Implementa en la PWA los 3 pilares clave de corrutinas:
 * 1. Centinela de Auto-Guardado No Bloqueante (`AutoSaveCoroutineSentinel`):
 *    - Bucle continuo asíncrono con suspensión cooperativa (`delay`) que evita frame drops a 60/120 FPS.
 *    - Chequeo de estado sucio (`isDirty`) y manejo de excepciones aislado (SupervisorJob).
 * 2. Conflación de Puntos Táctiles (`TouchPointStreamConflator`):
 *    - Canal confluente de capacidad 1 (`Channel.CONFLATED`) que absorbe el torrente de coordenadas del sensor
 *      táctil (hasta 240Hz) y descarta muestras intermedias obsoletas si el renderizado tarda, previniendo lag.
 * 3. Tareas Asíncronas Cancelables (`CancellableCoroutineJob`):
 *    - Abstracción de `Job` con cancelación en 1 milisegundo ante cambio de pantalla o solicitud del usuario.
 */

export interface CoroutineJob {
  readonly id: string;
  readonly isActive: boolean;
  readonly isCancelled: boolean;
  cancel: () => void;
  join: () => Promise<void>;
}

export interface TouchSample {
  x: number;
  y: number;
  pressure: number;
  timestamp: number;
}

/**
 * Despachadores de corrutinas inspirados en kotlinx.coroutines para la Web y PWA
 */
export const Dispatchers = {
  /**
   * Despachador principal: ejecuta tareas en el hilo de renderizado (requestAnimationFrame / microtask)
   */
  Main: {
    dispatch: (action: () => void | Promise<void>) => {
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => {
          action();
        });
      } else {
        queueMicrotask(() => {
          action();
        });
      }
    }
  },

  /**
   * Despachador en segundo plano: despacha tareas computacionales desacopladas
   */
  Default: {
    dispatch: (action: () => void | Promise<void>) => {
      setTimeout(() => {
        action();
      }, 0);
    }
  },

  /**
   * Despachador I/O: para persistencia en disco o almacenamiento (SQLite OPFS)
   */
  IO: {
    dispatch: (action: () => void | Promise<void>) => {
      setTimeout(() => {
        action();
      }, 0);
    }
  }
};

/**
 * Representa un SupervisorJob que aísla fallos en hijos sin derribar el scope padre
 */
export class SupervisorJob implements CoroutineJob {
  readonly id: string;
  private _isActive = true;
  private _isCancelled = false;
  private children = new Set<CoroutineJob>();
  private _resolveJoin?: () => void;
  private _joinPromise: Promise<void>;

  constructor(id: string = `sup_job_${Date.now()}`) {
    this.id = id;
    this._joinPromise = new Promise<void>((resolve) => {
      this._resolveJoin = resolve;
    });
  }

  get isActive(): boolean {
    return this._isActive;
  }

  get isCancelled(): boolean {
    return this._isCancelled;
  }

  attachChild(child: CoroutineJob): void {
    if (!this._isActive) {
      child.cancel();
      return;
    }
    this.children.add(child);
  }

  detachChild(child: CoroutineJob): void {
    this.children.delete(child);
  }

  cancel(): void {
    if (!this._isActive) return;
    this._isActive = false;
    this._isCancelled = true;
    for (const child of this.children) {
      child.cancel();
    }
    this.children.clear();
    if (this._resolveJoin) this._resolveJoin();
  }

  join(): Promise<void> {
    return this._joinPromise;
  }
}

/**
 * Representa una tarea cancelable gobernada por corrutinas
 */
export class CancellableCoroutineJob implements CoroutineJob {
  readonly id: string;
  private _isActive = true;
  private _isCancelled = false;
  private _resolveJoin?: () => void;
  private _joinPromise: Promise<void>;
  private parentSupervisor?: SupervisorJob;

  constructor(id: string = `job_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, parent?: SupervisorJob) {
    this.id = id;
    this.parentSupervisor = parent;
    this._joinPromise = new Promise<void>((resolve) => {
      this._resolveJoin = resolve;
    });
    if (parent) {
      parent.attachChild(this);
    }
  }

  get isActive(): boolean {
    return this._isActive;
  }

  get isCancelled(): boolean {
    return this._isCancelled;
  }

  cancel(): void {
    if (!this._isActive) return;
    this._isActive = false;
    this._isCancelled = true;
    if (this.parentSupervisor) {
      this.parentSupervisor.detachChild(this);
    }
    if (this._resolveJoin) this._resolveJoin();
  }

  complete(): void {
    if (!this._isActive) return;
    this._isActive = false;
    if (this.parentSupervisor) {
      this.parentSupervisor.detachChild(this);
    }
    if (this._resolveJoin) this._resolveJoin();
  }

  join(): Promise<void> {
    return this._joinPromise;
  }
}

/**
 * Centinela de Auto-Guardado no bloqueante con patrón de corrutinas y SupervisorJob
 */
export class AutoSaveCoroutineSentinel {
  private currentJob: CancellableCoroutineJob | null = null;
  private loopTimeoutId: any = null;
  private supervisor = new SupervisorJob('sentinel_supervisor');
  private lastSaveTime: number = 0;
  private totalSaves = 0;
  private isSavingNow = false;

  /**
   * Inicia el bucle periódico de guardado con suspensión cooperativa (delay)
   */
  start(
    intervalMs: number,
    isDirty: () => boolean,
    onSave: () => Promise<void> | void
  ): CoroutineJob {
    this.stop();

    const job = new CancellableCoroutineJob(`autosave_${Date.now()}`, this.supervisor);
    this.currentJob = job;

    const runLoop = async () => {
      if (!job.isActive || job.isCancelled) return;

      try {
        if (isDirty()) {
          this.isSavingNow = true;
          await onSave();
          this.lastSaveTime = Date.now();
          this.totalSaves++;
        }
      } catch (err) {
        console.warn('[AutoSaveCoroutineSentinel] Error aislado en ciclo de guardado (SupervisorJob activo):', err);
      } finally {
        this.isSavingNow = false;
      }

      if (job.isActive && !job.isCancelled) {
        this.loopTimeoutId = setTimeout(runLoop, intervalMs);
      }
    };

    this.loopTimeoutId = setTimeout(runLoop, intervalMs);
    return job;
  }

  /**
   * Detiene el centinela y cancela el Job actual de inmediato de forma estructurada
   */
  stop(): void {
    if (this.loopTimeoutId) {
      clearTimeout(this.loopTimeoutId);
      this.loopTimeoutId = null;
    }
    if (this.currentJob) {
      this.currentJob.cancel();
      this.currentJob = null;
    }
    this.isSavingNow = false;
  }

  isActive(): boolean {
    return this.currentJob !== null && this.currentJob.isActive;
  }

  getMetrics() {
    return {
      isActive: this.isActive(),
      lastSaveTime: this.lastSaveTime,
      totalSaves: this.totalSaves,
      isSavingNow: this.isSavingNow,
    };
  }
}

/**
 * Conflator de eventos táctiles para estabilizar el lápiz a alta frecuencia (120Hz-240Hz)
 * sin acumular retraso en el bucle principal. Implementa el patrón Channel.CONFLATED.
 */
export class TouchPointStreamConflator {
  private latestSample: TouchSample | null = null;
  private totalIngested = 0;
  private totalEmitted = 0;
  private timestamps: number[] = [];
  private maxTimestampHistory = 30;

  /**
   * Recibe una nueva coordenada del sensor táctil (dedo o stylus).
   * Al aplicar conflate, reemplaza la muestra previa pendiente si el hilo UI aún no la consumió.
   */
  emit(sample: TouchSample): void {
    this.latestSample = sample;
    this.totalIngested++;

    const now = sample.timestamp || performance.now();
    this.timestamps.push(now);
    if (this.timestamps.length > this.maxTimestampHistory) {
      this.timestamps.shift();
    }
  }

  /**
   * Consume la muestra más reciente disponible para renderizado en el siguiente frame (requestAnimationFrame).
   * Retorna null si no hay muestras nuevas.
   */
  consume(): TouchSample | null {
    if (!this.latestSample) return null;
    const sample = this.latestSample;
    this.latestSample = null;
    this.totalEmitted++;
    return sample;
  }

  peek(): TouchSample | null {
    return this.latestSample;
  }

  hasPending(): boolean {
    return this.latestSample !== null;
  }

  clear(): void {
    this.latestSample = null;
    this.timestamps = [];
  }

  /**
   * Estima la frecuencia de muestreo del sensor táctil en Hertz (Hz)
   */
  getEstimatedSamplingRateHz(): number {
    if (this.timestamps.length < 5) return 60;
    const first = this.timestamps[0];
    const last = this.timestamps[this.timestamps.length - 1];
    const durationMs = last - first;
    if (durationMs <= 0) return 60;
    const hz = Math.round(((this.timestamps.length - 1) / durationMs) * 1000);
    return Math.min(480, Math.max(30, hz));
  }

  getStats() {
    return {
      totalIngested: this.totalIngested,
      totalEmitted: this.totalEmitted,
      droppedSamples: Math.max(0, this.totalIngested - this.totalEmitted),
      estimatedHz: this.getEstimatedSamplingRateHz(),
      hasPending: this.latestSample !== null,
    };
  }
}

/**
 * Abstracción reactiva Flow de Kotlin para el flujo táctil continuo
 */
export class TouchFlow {
  private subscribers: Array<(sample: TouchSample) => void> = [];
  private conflator = new TouchPointStreamConflator();

  emit(sample: TouchSample): void {
    this.conflator.emit(sample);
  }

  /**
   * Procesa la muestra en el siguiente frame con conflate automático
   */
  collectLatest(consumer: (sample: TouchSample) => void): CoroutineJob {
    const job = new CancellableCoroutineJob(`flow_${Date.now()}`);
    
    let isRunning = true;
    const loop = () => {
      if (!isRunning || !job.isActive) return;
      const sample = this.conflator.consume();
      if (sample) {
        consumer(sample);
      }
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(loop);
      } else {
        setTimeout(loop, 16);
      }
    };

    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(loop);
    } else {
      setTimeout(loop, 16);
    }

    const originalCancel = job.cancel.bind(job);
    job.cancel = () => {
      isRunning = false;
      originalCancel();
    };

    return job;
  }
}

/**
 * Scope de concurrencia estructurada global para InkFlow Studio
 */
export class StudioTaskScope {
  private supervisor = new SupervisorJob('studio_scope_root');
  private activeJobs = new Map<string, CancellableCoroutineJob>();

  launch(name: string, task: (job: CoroutineJob) => Promise<void>): CoroutineJob {
    const job = new CancellableCoroutineJob(name, this.supervisor);
    this.activeJobs.set(job.id, job);

    (async () => {
      try {
        await task(job);
      } catch (err) {
        console.warn(`[StudioTaskScope] Error en tarea '${name}' (aislado por SupervisorJob):`, err);
      } finally {
        job.complete();
        this.activeJobs.delete(job.id);
      }
    })();

    return job;
  }

  cancelAll(): void {
    this.supervisor.cancel();
    this.activeJobs.clear();
    this.supervisor = new SupervisorJob('studio_scope_root');
  }

  getActiveCount(): number {
    return this.activeJobs.size;
  }
}

export const studioTaskScope = new StudioTaskScope();
export const globalAutoSaveSentinel = new AutoSaveCoroutineSentinel();
export const globalTouchConflator = new TouchPointStreamConflator();
