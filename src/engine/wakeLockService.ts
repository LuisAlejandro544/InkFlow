/**
 * @file wakeLockService.ts
 * @description Servicio de mantenimiento de pantalla encendida (Screen WakeLock) para el estudio de dibujo.
 * 
 * Previene que el teléfono móvil atenúe el brillo o bloquee la pantalla mientras el artista
 * está ilustrando, calcando o pensando su próximo trazo.
 * 
 * Características:
 * 1. Comunicación con el puente nativo de Kotlin (`window.InkFlowNativeBridge?.setScreenKeepAlive`).
 * 2. Soporte nativo PWA mediante `navigator.wakeLock.request('screen')`.
 * 3. Auto-reactivación al volver a la app tras un cambio de visibilidad (`visibilitychange`).
 * 
 * Licencia: MIT / Apache-2.0
 */

declare global {
  interface Window {
    InkFlowNativeBridge?: {
      saveImageToGallery?: (base64Data: string, filename: string, mimeType: string) => string;
      setScreenKeepAlive?: (keepAlive: boolean) => void;
      isNativeBridgeReady?: () => boolean;
    };
  }
}

class ScreenWakeLockService {
  private sentinel: any = null;
  private isRequested = false;
  private isHandlingVisibility = false;

  constructor() {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    }
  }

  /**
   * Adquiere el bloqueo de pantalla para mantenerla activa
   */
  public async acquireWakeLock(): Promise<boolean> {
    this.isRequested = true;

    // 1. Intentar primero con el puente nativo de Kotlin (Android)
    if (typeof window !== 'undefined' && window.InkFlowNativeBridge?.setScreenKeepAlive) {
      try {
        window.InkFlowNativeBridge.setScreenKeepAlive(true);
        return true;
      } catch {
        // Fallback al estándar PWA
      }
    }

    // 2. Estándar Web Screen Wake Lock API (PWA en navegadores móviles)
    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
      try {
        // @ts-ignore
        this.sentinel = await navigator.wakeLock.request('screen');
        this.sentinel.addEventListener('release', () => {
          this.sentinel = null;
        });
        return true;
      } catch {
        // Puede fallar si la batería está en modo ahorro extremo
        return false;
      }
    }

    return false;
  }

  /**
   * Libera el bloqueo para permitir que la pantalla repose y ahorre batería
   */
  public async releaseWakeLock(): Promise<void> {
    this.isRequested = false;

    // 1. Liberar puente nativo Kotlin
    if (typeof window !== 'undefined' && window.InkFlowNativeBridge?.setScreenKeepAlive) {
      try {
        window.InkFlowNativeBridge.setScreenKeepAlive(false);
      } catch {}
    }

    // 2. Liberar WakeLock de PWA
    if (this.sentinel) {
      try {
        await this.sentinel.release();
      } catch {}
      this.sentinel = null;
    }
  }

  /**
   * Reactiva el bloqueo automáticamente si el usuario vuelve a la app
   */
  private async handleVisibilityChange(): Promise<void> {
    if (this.isHandlingVisibility) return;
    this.isHandlingVisibility = true;

    if (this.isRequested && typeof document !== 'undefined' && document.visibilityState === 'visible') {
      await this.acquireWakeLock();
    }

    this.isHandlingVisibility = false;
  }

  /**
   * Consulta si el WakeLock está actualmente activo
   */
  public isActive(): boolean {
    const hasNativeBridge = typeof window !== 'undefined' && !!window.InkFlowNativeBridge;
    return this.isRequested && (this.sentinel !== null || hasNativeBridge);
  }
}

export const wakeLockService = new ScreenWakeLockService();
