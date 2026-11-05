/**
 * @file environmentDetector.ts
 * @description Lógica pura y determinista para detección de modo de ejecución:
 * PWA Standalone vs Navegador Web estándar, con excepciones seguras para entornos de desarrollo/preview.
 */

export interface EnvironmentContext {
  isStandalone: boolean;
  isDevOrPreview: boolean;
  hasDismissedWelcome: boolean;
}

/**
 * Determina si la aplicación se ejecuta dentro del contenedor nativo de Tauri (APK Android o Desktop).
 */
export function detectIsTauri(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    '__TAURI_INTERNALS__' in window ||
    '__TAURI__' in window ||
    Boolean((window as unknown as { isTauri?: boolean }).isTauri)
  );
}

/**
 * Determina si la aplicación se está ejecutando instalada en modo standalone (PWA nativa o APK Tauri).
 * @param displayModeMatchesStandalone Resultado de window.matchMedia('(display-mode: standalone)').matches
 * @param navigatorStandalone Propiedad window.navigator.standalone en dispositivos iOS Safari
 * @param referrer Cadena document.referrer para detección de TWA (Trusted Web Activity)
 * @returns boolean indicando si corre en modo standalone
 */
export function detectIsStandalone(
  displayModeMatchesStandalone: boolean,
  navigatorStandalone?: boolean,
  referrer: string = ''
): boolean {
  return (
    detectIsTauri() ||
    displayModeMatchesStandalone ||
    navigatorStandalone === true ||
    referrer.includes('android-app://')
  );
}

/**
 * Determina si el entorno actual es de desarrollo o previsualización de AI Studio.
 * En estos entornos se hace una excepción para no forzar la instalación PWA.
 * @param hostname Nombre de host (ej: localhost, *.run.app, *.aistudio.*)
 * @param search Parámetros de consulta de la URL (ej: ?preview=true)
 * @returns boolean indicando si es entorno de desarrollo / preview
 */
export function detectIsDevOrPreview(hostname: string, search: string = ''): boolean {
  const host = (hostname || '').toLowerCase();
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.includes('run.app') ||
    host.includes('aistudio') ||
    search.includes('preview=true') ||
    search.includes('env=dev')
  );
}

/**
 * Determina si debe mostrarse la pantalla de bienvenida y presentación PWA.
 * Regla:
 * 1. Si ya está instalada y corriendo en standalone -> NO mostrar bienvenida (ir directo al lienzo).
 * 2. Si es entorno de desarrollo / preview y el usuario ya descartó o eligió entrar -> NO mostrar bienvenida.
 * 3. Si en la sesión actual ya se descartó -> NO mostrar bienvenida.
 * 4. Si es navegador web estándar (fuera de PWA) -> SÍ mostrar bienvenida para invitar a instalar la PWA.
 */
export function shouldShowWelcomeScreen(ctx: EnvironmentContext): boolean {
  if (ctx.isStandalone) {
    return false;
  }
  if (ctx.hasDismissedWelcome) {
    return false;
  }
  // En navegador web (o si no se ha descartado), se muestra la pantalla de bienvenida
  return true;
}
