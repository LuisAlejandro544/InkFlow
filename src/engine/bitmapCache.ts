/**
 * @file bitmapCache.ts
 * @description Caché VRAM en GPU basada en ImageBitmap para aceleración gráfica a 60–120 FPS.
 * 
 * Ventajas sobre elementos <img> y canvas tradicionales:
 * 1. Cero re-decodificación en renderizado: Una vez decodificado, el bitmap reside directamente
 *    en memoria de texturas lista para la GPU (VRAM), evitando recalcular PNG/WebP en cada frame.
 * 2. Decodificación asíncrona off-thread: `createImageBitmap` corre fuera del hilo principal,
 *    eliminando congelamientos de UI al cargar fotos de calco o cambiar de capa.
 * 3. Gestión estricta de memoria móvil: Incluye desecho explícito mediante `.close()` y política
 *    LRU para evitar fugas de VRAM en teléfonos con memoria limitada.
 */

interface CachedBitmapEntry {
  bitmap: ImageBitmap;
  key: string;
  width: number;
  height: number;
  estimatedBytes: number;
  lastAccessed: number;
}

export class GPUBitmapCache {
  private cache = new Map<string, CachedBitmapEntry>();
  private pendingCreations = new Set<string>(); // Evita decodificaciones paralelas masivas de la misma imagen
  private maxEntries = 12; // Límite adaptado para evitar OOM en teléfonos móviles (32 y 64 bits)
  private maxEstimatedBytes = 32 * 1024 * 1024; // 32 MB de límite estricto en VRAM para teléfonos
  private currentEstimatedBytes = 0;

  /**
   * Comprueba si una imagen ya está siendo decodificada de forma asíncrona en este momento
   */
  public isPending(key: string): boolean {
    return this.pendingCreations.has(key);
  }

  /**
   * Marca una clave como en proceso de decodificación
   */
  public markPending(key: string): void {
    this.pendingCreations.add(key);
  }

  /**
   * Desmarca una clave tras completarse o fallar la decodificación
   */
  public unmarkPending(key: string): void {
    this.pendingCreations.delete(key);
  }

  /**
   * Obtiene un ImageBitmap de la caché VRAM si existe
   */
  public get(key: string): ImageBitmap | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    entry.lastAccessed = Date.now();
    return entry.bitmap;
  }

  /**
   * Almacena un ImageBitmap en la caché con control de cuota VRAM
   */
  public set(key: string, bitmap: ImageBitmap): void {
    // Si ya existía con esa clave, liberar el bitmap previo
    this.invalidate(key);

    const width = bitmap.width;
    const height = bitmap.height;
    // 4 bytes por píxel (RGBA32)
    const estimatedBytes = width * height * 4;

    this.ensureCapacity(estimatedBytes);

    this.cache.set(key, {
      bitmap,
      key,
      width,
      height,
      estimatedBytes,
      lastAccessed: Date.now(),
    });

    this.currentEstimatedBytes += estimatedBytes;
  }

  /**
   * Obtiene o crea un ImageBitmap de forma asíncrona a partir de diversas fuentes
   */
  public async getOrCreate(
    key: string,
    source: ImageBitmapSource | Blob | ImageData | HTMLCanvasElement | string
  ): Promise<ImageBitmap> {
    const existing = this.get(key);
    if (existing) {
      return existing;
    }

    let bitmapSource: ImageBitmapSource;

    if (typeof source === 'string') {
      // Data URL o URL remota/local: convertir a Blob
      if (source.startsWith('data:')) {
        const res = await fetch(source);
        bitmapSource = await res.blob();
      } else {
        const res = await fetch(source);
        bitmapSource = await res.blob();
      }
    } else {
      bitmapSource = source as ImageBitmapSource;
    }

    if (typeof createImageBitmap === 'function') {
      const bitmap = await createImageBitmap(bitmapSource);
      this.set(key, bitmap);
      return bitmap;
    }

    throw new Error('createImageBitmap no soportado en este entorno');
  }

  /**
   * Libera la memoria de texturas en la GPU y elimina la clave
   */
  public invalidate(key: string): void {
    const entry = this.cache.get(key);
    if (entry) {
      try {
        if (typeof entry.bitmap.close === 'function') {
          entry.bitmap.close();
        }
      } catch {
        // Ignorar si ya estaba cerrado
      }
      this.currentEstimatedBytes -= entry.estimatedBytes;
      this.cache.delete(key);
    }
  }

  /**
   * Limpia toda la caché VRAM cerrando todos los bitmaps activos
   */
  public clear(): void {
    for (const entry of this.cache.values()) {
      try {
        if (typeof entry.bitmap.close === 'function') {
          entry.bitmap.close();
        }
      } catch {
        // Ignorar
      }
    }
    this.cache.clear();
    this.currentEstimatedBytes = 0;
  }

  /**
   * Retorna estadísticas de uso de la memoria de texturas
   */
  public getStats() {
    return {
      cachedBitmapsCount: this.cache.size,
      vramUsageMB: Number((this.currentEstimatedBytes / (1024 * 1024)).toFixed(2)),
      maxVramMB: Number((this.maxEstimatedBytes / (1024 * 1024)).toFixed(0)),
    };
  }

  /**
   * Desalojo LRU (Least Recently Used) para mantener el consumo de VRAM dentro del límite
   */
  private ensureCapacity(neededBytes: number): void {
    while (
      (this.cache.size >= this.maxEntries || this.currentEstimatedBytes + neededBytes > this.maxEstimatedBytes) &&
      this.cache.size > 0
    ) {
      // Encontrar la entrada menos recientemente usada
      let oldestKey: string | null = null;
      let oldestTime = Infinity;

      for (const [k, entry] of this.cache.entries()) {
        if (entry.lastAccessed < oldestTime) {
          oldestTime = entry.lastAccessed;
          oldestKey = k;
        }
      }

      if (oldestKey) {
        this.invalidate(oldestKey);
      } else {
        break;
      }
    }
  }
}

export const gpuBitmapCache = new GPUBitmapCache();
