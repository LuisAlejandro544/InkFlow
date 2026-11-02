/**
 * @file ExportModal.tsx
 * @description Diálogo de guardado y exportación de obras maestras para IbisPaint WebGPU Studio.
 * 
 * Capacidades mejoradas:
 * 1. Selección entre:
 *    - "Hoja Completa" (lienzo entero original, incluyendo márgenes vacíos).
 *    - "Recortar hasta donde dibujó (Auto-Crop)" (recorta automáticamente al área útil de los trazos del artista).
 * 2. Cálculo en tiempo real del peso exacto de la obra maestra en KB / MB según formato, escala y recorte.
 * 3. Guardado directo en la galería del dispositivo móvil (mediante descarga nativa y Web Share API).
 * 4. Soporte multiescala (1x Estándar, 2x FHD, 3x 4K Ultra) y formatos PNG (con canal alfa opcional), JPEG y WebP.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  X, Download, Share2, Check, Sparkles, Image as ImageIcon, 
  Crop, Maximize2, HardDrive, Layers as LayersIcon 
} from 'lucide-react';
import { Layer } from '../engine/types';
import { calculateArtworkBoundingBox, BoundingBoxResult } from '../engine/transformMath';
import { kotlinVectorEngine } from '../engine/kotlinWasmBridge';

interface ExportModalProps {
  layers: Layer[];
  width: number;
  height: number;
  projectName: string;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  layers,
  width,
  height,
  projectName,
  onClose,
}) => {
  const [format, setFormat] = useState<'png' | 'jpeg' | 'webp'>('png');
  const [scale, setScale] = useState<number>(1);
  const [cropMode, setCropMode] = useState<'full' | 'crop'>('full');
  const [transparentBg, setTransparentBg] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [fileSizeBytes, setFileSizeBytes] = useState<number | null>(null);

  const triggerHaptic = (ms = 10) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate(ms); } catch {}
    }
  };

  /**
   * Calcula el Bounding Box del contenido útil de todas las capas visibles
   */
  const boundingBox = useMemo<BoundingBoxResult>(() => {
    try {
      const datas: Uint8ClampedArray[] = [];
      for (const layer of layers) {
        if (!layer.visible || layer.opacity <= 0) continue;
        const imgData = layer.ctx.getImageData(0, 0, width, height);
        datas.push(imgData.data);
      }
      return calculateArtworkBoundingBox(datas, width, height, 24);
    } catch {
      return {
        minX: 0,
        minY: 0,
        maxX: width,
        maxY: height,
        width,
        height,
        hasContent: true,
      };
    }
  }, [layers, width, height]);

  // Dimensiones finales según el modo elegido y la escala
  const exportDimensions = useMemo(() => {
    if (cropMode === 'crop' && boundingBox.hasContent) {
      return {
        w: Math.round(boundingBox.width * scale),
        h: Math.round(boundingBox.height * scale),
        sourceX: boundingBox.minX,
        sourceY: boundingBox.minY,
        sourceW: boundingBox.width,
        sourceH: boundingBox.height,
      };
    }
    return {
      w: Math.round(width * scale),
      h: Math.round(height * scale),
      sourceX: 0,
      sourceY: 0,
      sourceW: width,
      sourceH: height,
    };
  }, [cropMode, boundingBox, scale, width, height]);

  /**
   * Genera el canvas final listo para exportar
   */
  const generateExportCanvas = useCallback((): HTMLCanvasElement => {
    const { w, h, sourceX, sourceY, sourceW, sourceH } = exportDimensions;

    const cvs = document.createElement('canvas');
    cvs.width = w;
    cvs.height = h;
    const ctx = cvs.getContext('2d')!;

    // Fondo blanco o transparente
    if (!transparentBg || format === 'jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
    }

    // Dibujar cada capa con su opacidad y modo de fusión
    for (const layer of layers) {
      if (!layer.visible || layer.opacity <= 0) continue;
      ctx.save();
      ctx.globalAlpha = layer.opacity;
      ctx.globalCompositeOperation = layer.blendMode as GlobalCompositeOperation;

      // Dibujar sub-región si es modo recorte, o toda la hoja
      ctx.drawImage(
        layer.canvas,
        sourceX, sourceY, sourceW, sourceH,
        0, 0, w, h
      );

      // Renderizar trazos vectoriales de Kotlin/Wasm para esta capa sin pérdida de resolución
      const vectorStrokes = kotlinVectorEngine.getStrokesForLayer(layer.id);
      if (vectorStrokes && vectorStrokes.length > 0) {
        ctx.save();
        ctx.scale(scale, scale);
        ctx.translate(-sourceX, -sourceY);
        kotlinVectorEngine.renderVectorStrokes(ctx, vectorStrokes, scale);
        ctx.restore();
      }

      ctx.restore();
    }

    return cvs;
  }, [exportDimensions, transparentBg, format, layers]);

  /**
   * Calcula el peso exacto del archivo en tiempo real
   */
  useEffect(() => {
    let isCancelled = false;
    const calcWeight = async () => {
      try {
        const cvs = generateExportCanvas();
        const mimeType = format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
        const blob = await new Promise<Blob | null>((resolve) => {
          cvs.toBlob(resolve, mimeType, 0.92);
        });
        if (!isCancelled && blob) {
          setFileSizeBytes(blob.size);
        }
      } catch {
        if (!isCancelled) setFileSizeBytes(null);
      }
    };

    calcWeight();
    return () => {
      isCancelled = true;
    };
  }, [generateExportCanvas, format, scale, cropMode, transparentBg]);

  const formattedFileSize = useMemo(() => {
    if (fileSizeBytes === null) return 'Calculando...';
    if (fileSizeBytes < 1024) return `${fileSizeBytes} B`;
    if (fileSizeBytes < 1024 * 1024) return `${(fileSizeBytes / 1024).toFixed(1)} KB`;
    return `${(fileSizeBytes / (1024 * 1024)).toFixed(2)} MB`;
  }, [fileSizeBytes]);

  const exportWidthName = (s: number) => (s === 1 ? '1x' : s === 2 ? '2x_FHD' : '3x_4K');

  /**
   * Descarga directa en la galería/descargas del dispositivo
   */
  const handleDownload = () => {
    triggerHaptic(12);
    setIsExporting(true);
    try {
      const cvs = generateExportCanvas();
      const mimeType = format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
      const dataUrl = cvs.toDataURL(mimeType, 0.95);

      const a = document.createElement('a');
      a.href = dataUrl;
      const cleanName = (projectName || 'mi_obra').toLowerCase().replace(/[^a-z0-9]/g, '_');
      const cropSuffix = cropMode === 'crop' ? '_recortada' : '_completa';
      a.download = `${cleanName}${cropSuffix}_${exportWidthName(scale)}.${format}`;
      document.body.appendChild(a);
      a.click();
      if (a.parentNode) {
        a.parentNode.removeChild(a);
      } else {
        a.remove?.();
      }

      setSuccessMessage('¡Obra maestra guardada en tu galería!');
      setTimeout(() => setSuccessMessage(''), 3500);
    } finally {
      setIsExporting(false);
    }
  };

  /**
   * Compartir mediante la hoja nativa de Android/iOS (Web Share API)
   */
  const handleShare = async () => {
    triggerHaptic(12);
    if (!navigator.share) {
      handleDownload();
      return;
    }

    try {
      setIsExporting(true);
      const cvs = generateExportCanvas();
      const mimeType = format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
      const blob = await new Promise<Blob | null>((resolve) => {
        cvs.toBlob(resolve, mimeType, 0.95);
      });

      if (!blob) return;

      const cleanName = (projectName || 'mi_obra').toLowerCase().replace(/[^a-z0-9]/g, '_');
      const file = new File([blob], `${cleanName}.${format}`, { type: blob.type });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: projectName || 'Mi Obra Maestra',
          text: 'Ilustración creada en IbisPaint WebGPU Studio',
        });
        setSuccessMessage('¡Obra compartida con éxito!');
      } else {
        handleDownload();
      }
    } catch {
      // Si el usuario cancela la hoja de compartir
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div 
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          triggerHaptic(8);
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4 animate-fade-in"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg bg-[#14151c] border-t sm:border border-[#272937] rounded-t-3xl sm:rounded-3xl p-4 sm:p-5 text-white shadow-2xl flex flex-col gap-3.5 max-h-[92vh] overflow-y-auto pb-[max(1.25rem,env(safe-area-inset-bottom))]"
      >
        {/* Tirador táctil para móvil */}
        <div 
          onClick={() => {
            triggerHaptic(8);
            onClose();
          }}
          className="w-12 h-1.5 rounded-full bg-neutral-600/70 mx-auto -mt-1 sm:hidden cursor-pointer"
        />

        {/* Cabecera */}
        <div className="flex items-center justify-between border-b border-[#222430] pb-2.5">
          <div className="flex items-center gap-2">
            <ImageIcon size={20} className="text-amber-400" />
            <h2 className="text-base sm:text-lg font-bold text-gray-100">Guardar Obra Maestra</h2>
          </div>
          <button
            onClick={() => {
              triggerHaptic(8);
              onClose();
            }}
            aria-label="Cerrar ventana de guardado"
            className="w-9 h-9 rounded-xl bg-[#1b1c26] hover:bg-[#252735] text-gray-300 hover:text-white border border-[#2b2d3d] flex items-center justify-center transition-all active:scale-95"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tarjeta del Peso de la Obra y Resolución */}
        <div className="bg-[#0e0f14] p-3 rounded-2xl border border-[#242634] flex items-center justify-between gap-2 shadow-inner">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <HardDrive size={18} />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Peso de tu Obra</span>
              <span className="text-base font-mono font-bold text-amber-300 truncate block">
                {formattedFileSize}
              </span>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Dimensiones</span>
            <span className="text-xs font-mono font-bold text-gray-200">
              {exportDimensions.w} × {exportDimensions.h} px
            </span>
          </div>
        </div>

        {/* 1. Selector de Recorte: Toda la Hoja vs Recortar al Dibujo */}
        <div>
          <label className="text-xs text-gray-300 block mb-1.5 font-bold flex items-center gap-1.5">
            <Crop size={14} className="text-amber-400" />
            <span>Encuadre de Guardado:</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                triggerHaptic(8);
                setCropMode('full');
              }}
              className={`p-2.5 rounded-xl border text-left transition-all flex flex-col gap-0.5 active:scale-95 ${
                cropMode === 'full'
                  ? 'bg-amber-500/20 border-amber-400 text-amber-200 ring-1 ring-amber-400/50 shadow-sm'
                  : 'bg-[#181922] border-[#262837] text-gray-300 hover:border-gray-600'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold flex items-center gap-1">
                  <Maximize2 size={13} />
                  <span>Hoja Completa</span>
                </span>
                {cropMode === 'full' && <Check size={14} className="text-amber-400" />}
              </div>
              <span className="text-[10px] text-gray-400 leading-tight">
                Incluye todo el lienzo original ({width} × {height}px).
              </span>
            </button>

            <button
              onClick={() => {
                triggerHaptic(8);
                setCropMode('crop');
              }}
              className={`p-2.5 rounded-xl border text-left transition-all flex flex-col gap-0.5 active:scale-95 ${
                cropMode === 'crop'
                  ? 'bg-amber-500/20 border-amber-400 text-amber-200 ring-1 ring-amber-400/50 shadow-sm'
                  : 'bg-[#181922] border-[#262837] text-gray-300 hover:border-gray-600'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold flex items-center gap-1">
                  <Crop size={13} />
                  <span>Recortar al Dibujo</span>
                </span>
                {cropMode === 'crop' && <Check size={14} className="text-amber-400" />}
              </div>
              <span className="text-[10px] text-gray-400 leading-tight">
                {boundingBox.hasContent 
                  ? `Auto-crop a trazos (${boundingBox.width} × ${boundingBox.height}px).`
                  : 'Sin trazos detectados (lienzo completo).'}
              </span>
            </button>
          </div>
        </div>

        {/* 2. Selector de Formato de Imagen */}
        <div>
          <label className="text-xs text-gray-300 block mb-1.5 font-bold">Formato de Imagen</label>
          <div className="grid grid-cols-3 gap-2">
            {(['png', 'jpeg', 'webp'] as const).map((fmt) => (
              <button
                key={fmt}
                onClick={() => {
                  triggerHaptic(8);
                  setFormat(fmt);
                }}
                className={`py-2 px-3 rounded-xl border text-xs font-bold uppercase transition-all active:scale-95 ${
                  format === fmt
                    ? 'bg-amber-500 text-black font-bold border-amber-400 shadow-md'
                    : 'bg-[#181922] border-[#262837] text-gray-300 hover:border-gray-600'
                }`}
              >
                {fmt === 'jpeg' ? 'JPG (Estándar)' : fmt.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* 3. Multiplicador de Calidad / Resolución */}
        <div>
          <label className="text-xs text-gray-300 block mb-1.5 font-bold">Calidad y Escala de Exportación</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { val: 1, label: '1x Estándar', desc: 'Rápido y ligero' },
              { val: 2, label: '2x FHD', desc: 'Alta nitidez' },
              { val: 3, label: '3x Ultra', desc: 'Máxima resolución' },
            ].map((sc) => (
              <button
                key={sc.val}
                onClick={() => {
                  triggerHaptic(8);
                  setScale(sc.val);
                }}
                className={`py-1.5 px-2 rounded-xl border text-left transition-all active:scale-95 ${
                  scale === sc.val
                    ? 'bg-amber-500/20 border-amber-400 text-amber-200 ring-1 ring-amber-400/50'
                    : 'bg-[#181922] border-[#262837] text-gray-300 hover:border-gray-600'
                }`}
              >
                <span className="text-xs font-bold block">{sc.label}</span>
                <span className="text-[9px] text-gray-400 block">{sc.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Opción de fondo transparente para PNG */}
        {format === 'png' && (
          <label className="flex items-center gap-3 bg-[#181922] p-2.5 rounded-xl border border-[#262837] cursor-pointer active:scale-[0.99] transition-transform">
            <input
              type="checkbox"
              checked={transparentBg}
              onChange={(e) => {
                triggerHaptic(6);
                setTransparentBg(e.target.checked);
              }}
              className="w-4 h-4 rounded text-amber-500 bg-gray-900 border-gray-700 focus:ring-amber-500 accent-amber-500"
            />
            <span className="text-xs text-gray-200 font-medium">
              Fondo transparente (PNG con canal alfa sin fondo blanco)
            </span>
          </label>
        )}

        {/* Mensaje de confirmación */}
        {successMessage && (
          <div className="flex items-center gap-2 bg-green-950/50 border border-green-500/60 text-green-300 p-2.5 rounded-xl text-xs font-semibold animate-fade-in">
            <Check size={16} />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Botones de acción principales */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={handleDownload}
            disabled={isExporting}
            className="flex-1 py-3 px-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 text-xs sm:text-sm"
          >
            <Download size={17} />
            <span>Guardar en mi Galería</span>
          </button>

          <button
            onClick={handleShare}
            disabled={isExporting}
            className="py-3 px-4 bg-[#20222d] hover:bg-[#282a38] text-gray-200 font-semibold rounded-xl transition-all border border-[#2e3140] flex items-center justify-center gap-1.5 text-xs sm:text-sm active:scale-95"
            title="Compartir en WhatsApp, Instagram, Fotos, etc."
          >
            <Share2 size={16} className="text-amber-400" />
            <span>Compartir</span>
          </button>
        </div>
      </div>
    </div>
  );
};
