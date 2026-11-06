/**
 * @file diagnosticLogHub.ts
 * @description Centro neurálgico de telemetría, intercepción de logs, advertencias y diagnóstico en vivo.
 * 
 * Funcionalidades clave:
 * 1. Intercepción transparente de console.error, console.warn, console.info y console.log sin anular la consola estándar.
 * 2. Captura global de excepciones no controladas (window.onerror y unhandledrejection).
 * 3. Buffer circular (FIFO) en memoria de hasta 500 eventos clasificados por nivel y módulo.
 * 4. Integración con el puente nativo Android para recolectar métricas de RAM física y LogCat nativo del proceso.
 * 5. Generación de reportes exhaustivos en formato Markdown/Texto plano listos para copiar con 1 toque o compartir.
 * 6. Suscripción reactiva para alimentar la pantalla de monitoreo en tiempo real.
 */

export type DiagnosticLogLevel = 'error' | 'warn' | 'info' | 'native' | 'engine';

export interface DiagnosticLogItem {
  id: string;
  timestamp: number;
  timeFormatted: string;
  level: DiagnosticLogLevel;
  tag: string;
  message: string;
  details?: string;
  stack?: string;
}

export interface DeviceDiagnosticSpecs {
  userAgent: string;
  platform: string;
  screenWidth: number;
  screenHeight: number;
  devicePixelRatio: number;
  isStandalone: boolean;
  isTauri: boolean;
  isOnline: boolean;
  webGpuSupported: boolean;
  nativeBridgeAvailable: boolean;
  roomDatabaseAvailable: boolean;
  androidMemoryInfo?: {
    availMemMB?: number;
    totalMemMB?: number;
    lowMemory?: boolean;
    deviceModel?: string;
    androidSdk?: number;
    androidRelease?: string;
  };
}

class DiagnosticLogHub {
  private buffer: DiagnosticLogItem[] = [];
  private maxCapacity = 500;
  private listeners: Set<(items: DiagnosticLogItem[]) => void> = new Set();
  private isInitialized = false;

  constructor() {
    this.initInterceptors();
  }

  /**
   * Inicializa la intercepción de logs de consola y excepciones globales
   */
  public initInterceptors(): void {
    if (this.isInitialized || typeof window === 'undefined') return;
    this.isInitialized = true;

    // Registrar inicio del centro de diagnóstico
    this.record('info', 'DiagnosticHub', 'Centro de diagnóstico en vivo iniciado (Buffer de 500 eventos)');

    // 1. Interceptar console.error
    const originalConsoleError = console.error;
    console.error = (...args: unknown[]) => {
      originalConsoleError.apply(console, args);
      const msg = args.map(a => (typeof a === 'object' ? this.safeStringify(a) : String(a))).join(' ');
      const errObj = args.find(a => a instanceof Error) as Error | undefined;
      this.record('error', 'ConsoleError', msg, undefined, errObj?.stack);
    };

    // 2. Interceptar console.warn
    const originalConsoleWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      originalConsoleWarn.apply(console, args);
      const msg = args.map(a => (typeof a === 'object' ? this.safeStringify(a) : String(a))).join(' ');
      this.record('warn', 'ConsoleWarn', msg);
    };

    // 3. Interceptar excepciones globales de JavaScript
    window.addEventListener('error', (event: ErrorEvent) => {
      const msg = event.message || 'Error no controlado de ejecución';
      const fileInfo = event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : 'desconocido';
      this.record(
        'error',
        'GlobalError',
        msg,
        `Ubicación: ${fileInfo}`,
        event.error?.stack
      );
    });

    // 4. Interceptar Promesas rechazadas no capturadas
    window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const msg = reason instanceof Error ? reason.message : String(reason || 'Promesa rechazada');
      const stack = reason instanceof Error ? reason.stack : undefined;
      this.record('error', 'UnhandledPromise', msg, undefined, stack);
    });
  }

  /**
   * Registra un nuevo evento de diagnóstico en el buffer circular
   */
  /**
   * Registra un nuevo evento de diagnóstico en el buffer circular
   */
  public record(
    level: DiagnosticLogLevel,
    tag: string,
    message: string,
    details?: string,
    stack?: string
  ): DiagnosticLogItem {
    const now = Date.now();
    const d = new Date(now);
    const timeFormatted = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}.${d.getMilliseconds().toString().padStart(3, '0')}`;

    const item: DiagnosticLogItem = {
      id: `diag_${now}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: now,
      timeFormatted,
      level,
      tag,
      message,
      details,
      stack,
    };

    this.buffer.push(item);
    if (this.buffer.length > this.maxCapacity) {
      this.buffer.shift(); // Descarte FIFO del más antiguo
    }

    this.notifyListeners();
    return item;
  }

  /**
   * Métodos de conveniencia fuertemente tipados
   */
  public info(tag: string, message: string, details?: string): DiagnosticLogItem {
    return this.record('info', tag, message, details);
  }

  public warn(tag: string, message: string, details?: string): DiagnosticLogItem {
    return this.record('warn', tag, message, details);
  }

  public error(tag: string, message: string, errOrDetails?: unknown): DiagnosticLogItem {
    let details: string | undefined;
    let stack: string | undefined;
    if (errOrDetails instanceof Error) {
      details = errOrDetails.message;
      stack = errOrDetails.stack;
    } else if (errOrDetails) {
      details = String(errOrDetails);
    }
    return this.record('error', tag, message, details, stack);
  }

  public engine(tag: string, message: string, details?: string): DiagnosticLogItem {
    return this.record('engine', tag, message, details);
  }

  public native(tag: string, message: string, details?: string): DiagnosticLogItem {
    return this.record('native', tag, message, details);
  }

  /**
   * Registra eventos específicos del puente nativo de Android
   */
  public recordNative(tag: string, message: string, details?: string): void {
    this.record('native', tag, message, details);
  }

  /**
   * Registra eventos específicos de los motores de bajo nivel (C++23, Rust, Wasm, WebGPU)
   */
  public recordEngine(tag: string, message: string, details?: string): void {
    this.record('engine', tag, message, details);
  }

  /**
   * Obtiene todos los eventos almacenados actualmente
   */
  public getLogs(): DiagnosticLogItem[] {
    return [...this.buffer];
  }

  /**
   * Obtiene estadísticas cuantitativas de los eventos
   */
  public getStats(): { total: number; errors: number; warnings: number; native: number; engine: number; info: number } {
    let errors = 0;
    let warnings = 0;
    let native = 0;
    let engine = 0;
    let info = 0;
    for (const item of this.buffer) {
      if (item.level === 'error') errors++;
      else if (item.level === 'warn') warnings++;
      else if (item.level === 'native') native++;
      else if (item.level === 'engine') engine++;
      else if (item.level === 'info') info++;
    }

    return {
      total: this.buffer.length,
      errors,
      warnings,
      native,
      engine,
      info,
    };
  }

  /**
   * Limpia todo el historial de eventos del buffer
   */
  public clear(): void {
    this.buffer = [];
    this.notifyListeners();
  }

  /**
   * Suscribe un callback reactivo que se dispara ante cada nuevo log
   */
  public subscribe(listener: (items: DiagnosticLogItem[]) => void): () => void {
    this.listeners.add(listener);
    listener(this.getLogs());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const logs = this.getLogs();
    for (const listener of this.listeners) {
      try {
        listener(logs);
      } catch {
        // Ignorar errores de suscriptores
      }
    }
  }

  /**
   * Recolecta especificaciones del hardware, navegador y estado de puentes
   */
  public getDeviceSpecs(): DeviceDiagnosticSpecs {
    const globalCtx = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null);
    const nativeBridge = (globalCtx as unknown as { InkFlowNativeBridge?: { isNativeBridgeReady?: () => boolean; isRoomAvailable?: () => boolean; getNativeMemoryInfo?: () => string; getNativeLogcat?: (n: number) => string } })?.InkFlowNativeBridge;

    let androidMemoryInfo: DeviceDiagnosticSpecs['androidMemoryInfo'] | undefined;
    if (nativeBridge?.getNativeMemoryInfo) {
      try {
        const raw = nativeBridge.getNativeMemoryInfo();
        androidMemoryInfo = JSON.parse(raw);
      } catch {
        // Ignorar fallo de parseo
      }
    }

    if (typeof window === 'undefined') {
      return {
        userAgent: 'Node.js test environment',
        platform: 'node',
        screenWidth: 0,
        screenHeight: 0,
        devicePixelRatio: 1,
        isStandalone: false,
        isTauri: false,
        isOnline: true,
        webGpuSupported: false,
        nativeBridgeAvailable: Boolean(nativeBridge),
        roomDatabaseAvailable: Boolean(nativeBridge?.isRoomAvailable?.()),
        androidMemoryInfo,
      };
    }

    const nav = window.navigator as unknown as { standalone?: boolean; userAgent?: string; platform?: string; onLine?: boolean; gpu?: unknown };
    const isStandalone = Boolean(
      window.matchMedia?.('(display-mode: standalone)').matches ||
      nav.standalone ||
      document.referrer?.includes('android-app://')
    );

    const isTauri = Boolean(
      (window as unknown as { __TAURI_INTERNALS__?: unknown; __TAURI__?: unknown }).__TAURI_INTERNALS__ ||
      (window as unknown as { __TAURI__?: unknown }).__TAURI__
    );

    return {
      userAgent: nav.userAgent || 'Desconocido',
      platform: nav.platform || 'Desconocido',
      screenWidth: window.innerWidth,
      screenHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio || 1,
      isStandalone,
      isTauri,
      isOnline: nav.onLine !== false,
      webGpuSupported: Boolean(nav.gpu),
      nativeBridgeAvailable: Boolean(nativeBridge),
      roomDatabaseAvailable: Boolean(nativeBridge?.isRoomAvailable?.()),
      androidMemoryInfo,
    };
  }

  /**
   * Lee las últimas líneas del LogCat nativo de Android si el puente está disponible
   */
  public async getNativeLogcat(lines: number = 80): Promise<string> {
    const globalCtx = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null);
    const bridge = (globalCtx as unknown as { InkFlowNativeBridge?: { getNativeLogcat?: (n: number) => string } })?.InkFlowNativeBridge;
    if (bridge?.getNativeLogcat) {
      try {
        return bridge.getNativeLogcat(lines);
      } catch (e: unknown) {
        return `Error solicitando logcat: ${e instanceof Error ? e.message : String(e)}`;
      }
    }
    if (typeof window === 'undefined') return 'No disponible en entorno Node';
    return 'LogCat nativo no disponible (Puente Android no instanciado o corriendo en navegador PWA)';
  }

  /**
   * Ensambla un reporte completo de diagnóstico en formato texto plano / Markdown
   */
  public async generateDiagnosticReport(): Promise<string> {
    const specs = this.getDeviceSpecs();
    const stats = this.getStats();
    const logs = this.getLogs();
    const logcat = await this.getNativeLogcat(60);

    const lines: string[] = [];
    lines.push('================================================================');
    lines.push('🛠️ INKFLOW STUDIO - REPORTE COMPLETO DE DIAGNÓSTICO Y DEBUG');
    lines.push(`Fecha de exportación: ${new Date().toLocaleString()}`);
    lines.push('================================================================\n');

    lines.push('### 📱 1. INFORMACIÓN DEL ENTORNO Y DISPOSITIVO');
    lines.push(`- Versión de InkFlow: v1.0.0 estable (APK Debug Tauri v2 / PWA)`);
    lines.push(`- Contenedor Nativo Tauri v2: ${specs.isTauri ? 'SÍ (Nativo APK Android)' : 'NO (PWA Web)'}`);
    lines.push(`- Modo Standalone: ${specs.isStandalone ? 'SÍ' : 'NO'}`);
    lines.push(`- Pantalla: ${specs.screenWidth}x${specs.screenHeight} px (DPR: ${specs.devicePixelRatio})`);
    lines.push(`- Estado de Red: ${specs.isOnline ? 'Online' : '100% Offline'}`);
    lines.push(`- Soporte WebGPU Nativo: ${specs.webGpuSupported ? 'Disponible' : 'Fallback Canvas 2D'}`);
    lines.push(`- Puente Kotlin (@JavascriptInterface): ${specs.nativeBridgeAvailable ? 'CONECTADO ✅' : 'DESCONECTADO ❌'}`);
    lines.push(`- Persistencia Jetpack Room: ${specs.roomDatabaseAvailable ? 'ACTIVA ✅' : 'INACTIVA'}`);

    if (specs.androidMemoryInfo) {
      const mem = specs.androidMemoryInfo;
      lines.push(`- Dispositivo Android: ${mem.deviceModel || 'N/A'}`);
      lines.push(`- Versión SO: Android ${mem.androidRelease || 'N/A'} (API ${mem.androidSdk || 'N/A'})`);
      lines.push(`- RAM Libre en Dispositivo: ${mem.availMemMB ?? 'N/A'} MB / ${mem.totalMemMB ?? 'N/A'} MB`);
      lines.push(`- Memoria Baja (LowMemory): ${mem.lowMemory ? '⚠️ SÍ' : 'NO'}`);
    }

    lines.push(`- User Agent: ${specs.userAgent}\n`);

    lines.push('### 📊 2. RESUMEN DE EVENTOS EN SESIÓN');
    lines.push(`- Total de Eventos Registrados: ${stats.total}`);
    lines.push(`- ❌ Errores: ${stats.errors}`);
    lines.push(`- ⚠️ Advertencias: ${stats.warnings}`);
    lines.push(`- 🤖 Eventos Nativos Android: ${stats.native}`);
    lines.push(`- ⚡ Motores Wasm / GPU: ${stats.engine}`);
    lines.push(`- ℹ️ Información General: ${stats.info}\n`);

    lines.push('### 📋 3. REGISTRO CRONOLÓGICO DE EVENTOS');
    if (logs.length === 0) {
      lines.push('(No hay eventos registrados en el buffer)');
    } else {
      for (const log of logs) {
        const symbol =
          log.level === 'error' ? '❌' :
          log.level === 'warn' ? '⚠️' :
          log.level === 'native' ? '🤖' :
          log.level === 'engine' ? '⚡' : 'ℹ️';

        lines.push(`[${log.timeFormatted}] ${symbol} [${log.level.toUpperCase()}] [${log.tag}]: ${log.message}`);
        if (log.details) {
          lines.push(`   Detalles: ${log.details}`);
        }
        if (log.stack) {
          lines.push(`   Stack: ${log.stack.split('\n').slice(0, 4).join(' -> ')}`);
        }
      }
    }
    lines.push('');

    lines.push('### 🤖 4. LOGCAT NATIVO ANDROID (Últimas líneas)');
    lines.push(logcat || '(Sin datos de logcat)');
    lines.push('\n================================================================');

    return lines.join('\n');
  }

  /**
   * Copia todo el reporte de diagnóstico al portapapeles del dispositivo
   */
  public async copyFullReport(): Promise<boolean> {
    try {
      const text = await this.generateDiagnosticReport();
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  private safeStringify(obj: unknown): string {
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return String(obj);
    }
  }
}

// Instancia singleton compartida en toda la aplicación
export const diagnosticHub = new DiagnosticLogHub();
