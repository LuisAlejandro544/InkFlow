/**
 * @file wasmStreamingCompiler.ts
 * @description Compilador Streaming de WebAssembly con aprovechamiento de caché nativa
 * de código máquina de la CPU (WebAssembly.compileStreaming / instantiateStreaming).
 * 
 * Permite que los navegadores móviles compilen los binarios Wasm en streaming mientras
 * se descargan, y almacenen el código máquina resultante (ARM64/x86) directamente
 * en la caché de disco de bajo nivel, eliminando tiempos de arranque en visitas posteriores.
 */

export interface WasmCompilationResult<T = any> {
  instance: WebAssembly.Instance;
  module: WebAssembly.Module;
  exports: T;
  usedStreaming: boolean;
  compilationTimeMs: number;
}

/**
 * Determina si el entorno actual soporta compilación streaming nativa
 */
export function isWasmStreamingSupported(): boolean {
  return (
    typeof WebAssembly !== 'undefined' &&
    typeof WebAssembly.compileStreaming === 'function' &&
    typeof WebAssembly.instantiateStreaming === 'function'
  );
}

/**
 * Compila e instancia un módulo WebAssembly aprovechando WebAssembly.instantiateStreaming
 * y la caché de código máquina nativo del navegador.
 */
export async function instantiateWasmStreaming<T = any>(
  source: string | Response | Promise<Response> | Uint8Array,
  importObject: WebAssembly.Imports = {}
): Promise<WasmCompilationResult<T>> {
  const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
  let usedStreaming = false;

  // 1. Intentar compilación Streaming nativa (WebAssembly.instantiateStreaming)
  if (isWasmStreamingSupported()) {
    try {
      let responsePromise: Response | Promise<Response>;

      if (typeof source === 'string') {
        responsePromise = fetch(source);
      } else if (source instanceof Uint8Array) {
        // Envolver Uint8Array en una Response con encabezado MIME canónico application/wasm
        // para habilitar el motor de compilación streaming y su caché de CPU en navegadores modernos
        responsePromise = new Response(source as unknown as BodyInit, {
          headers: { 'Content-Type': 'application/wasm' },
        });
      } else {
        responsePromise = source;
      }

      const result = await WebAssembly.instantiateStreaming(responsePromise, importObject);
      usedStreaming = true;
      const endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();

      return {
        instance: result.instance,
        module: result.module,
        exports: result.instance.exports as unknown as T,
        usedStreaming: true,
        compilationTimeMs: Number((endTime - startTime).toFixed(2)),
      };
    } catch (streamingError) {
      console.warn('[WasmStreamingCompiler] Fallback a compilación estándar:', streamingError);
    }
  }

  // 2. Fallback resiliente: Obtener ArrayBuffer y compilar con WebAssembly.instantiate estándar
  let arrayBuffer: ArrayBuffer;

  if (typeof source === 'string') {
    const res = await fetch(source);
    arrayBuffer = await res.arrayBuffer();
  } else if (source instanceof Uint8Array) {
    const uint8 = source as Uint8Array;
    arrayBuffer = uint8.buffer.slice(uint8.byteOffset, uint8.byteOffset + uint8.byteLength) as ArrayBuffer;
  } else {
    const res = await Promise.resolve(source);
    arrayBuffer = await res.arrayBuffer();
  }

  const result = await WebAssembly.instantiate(arrayBuffer, importObject);
  const endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();

  return {
    instance: result.instance,
    module: result.module,
    exports: result.instance.exports as unknown as T,
    usedStreaming,
    compilationTimeMs: Number((endTime - startTime).toFixed(2)),
  };
}
