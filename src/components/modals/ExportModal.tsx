/**
 * @file ExportModal.tsx
 * @description Diálogo de guardado y exportación de obras maestras para IbisPaint WebGPU Studio.
 * 
 * Modularizado:
 * - Generación de canvas compuesto, cálculo de bounding box y compresión de blobs delegados a `exportEngine.ts`.
 * - Selección entre "Hoja Completa" vs "Recortar al Dibujo (Auto-Crop)".
 * - Cálculo en tiempo real del peso exacto de la obra maestra en KB / MB según formato, escala y recorte.
 * - Guardado directo en la galería del dispositivo móvil (mediante descarga nativa y Web Share API).
 * - Soporte multiescala (1x Estándar, 2x FHD, 3x 4K Ultra) y formatos PNG (con canal alfa opcional), JPEG y WebP.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  X, Download, Share2, Check, Image as ImageIcon, 
  Crop, Maximize2, HardDrive, Sparkles 
} from 'lucide-react';
import { Layer } from '../../engine/types';
import { calculateArtworkBoundingBox, BoundingBoxResult } from '../../engine/transformMath';
import { 
  ExportFormat, 
  ExportQualityMode,
  computeExportDimensions, 
  generateCompositeExportCanvas, 
  estimateArtworkFileSize, 
  estimateArtworkFileSizeFast,
  formatByteSize, 
  downloadArtworkFile, 
  shareArtworkFile,
  saveArtworkToUserGallery
} from '../../engine/exportEngine';
import { useAppTheme } from '../../engine/themeEngine';

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
  const theme = useAppTheme();
  const [format, setFormat] = useState<ExportFormat>('png');
  const [qualityMode, setQualityMode] = useState<ExportQualityMode>('standard');
  const [isPosterScale, setIsPosterScale] = useState<boolean>(false);
  const [cropMode, setCropMode] = useState<'full' | 'crop'>('full');
  const [transparentBg, setTransparentBg] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [fileSizeBytes, setFileSizeBytes] = useState<number | null>(null);

  const scale = isPosterScale ? 3 : 1;

  const triggerHaptic = (ms = 10) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate(ms); } catch {}
    }
  };

  /**
   * Bounding Box por defecto (hoja completa) para montaje instantáneo sin retrasos
   */
  const defaultBoundingBox = useMemo<BoundingBoxResult>(() => ({
    minX: 0,
    minY: 0,
    maxX: width,
    maxY: height,
    width,
    height,
    hasContent: true,
  }), [width, height]);

  const [boundingBox, setBoundingBox] = useState<BoundingBoxResult>(defaultBoundingBox);

  /**
   * Cálculo diferido no bloqueante del Bounding Box para que el modal aparezca al instante (0ms de latencia)
   */
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      try {
        const datas: Uint8ClampedArray[] = [];
        for (const layer of layers) {
          if (!layer.visible || layer.opacity <= 0) continue;
          const imgData = layer.ctx.getImageData(0, 0, width, height);
          datas.push(imgData.data);
        }
        const result = calculateArtworkBoundingBox(datas, width, height, 24);
        if (!cancelled) {
          setBoundingBox(result);
        }
      } catch {
        // En caso de mock o fallo de lectura, preserva el default limpio
      }
    }, 40);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [layers, width, height]);

  // Dimensiones finales según el modo de recorte y si el usuario eligió póster expandido
  const exportDimensions = useMemo(() => {
    return computeExportDimensions(width, height, boundingBox, cropMode, scale);
  }, [cropMode, boundingBox, scale, width, height]);

  /**
   * Genera el canvas final listo para exportar con calidad mejorada (SSAA y filtro de nitidez)
   */
  const generateExportCanvas = useCallback((): HTMLCanvasElement => {
    return generateCompositeExportCanvas(layers, exportDimensions, transparentBg, format, scale, qualityMode);
  }, [layers, exportDimensions, transparentBg, format, scale, qualityMode]);

  /**
   * Calcula el peso estimado en tiempo real de forma ultraligera y debounced
   * Erradica por completo el lag al alternar entre Estándar, HD y Ultra 4K
   */
  useEffect(() => {
    let isCancelled = false;
    const timer = setTimeout(async () => {
      try {
        const bytes = await estimateArtworkFileSizeFast(layers, exportDimensions, transparentBg, format, qualityMode);
        if (!isCancelled) {
          setFileSizeBytes(bytes);
        }
      } catch {
        if (!isCancelled) setFileSizeBytes(null);
      }
    }, 120);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [layers, exportDimensions, format, transparentBg, qualityMode]);

  const formattedFileSize = useMemo(() => {
    return formatByteSize(fileSizeBytes);
  }, [fileSizeBytes]);

  /**
   * Guardado REAL en la galería del usuario (Kotlin MediaStore / Web Share File API)
   */
  const handleDownload = async () => {
    triggerHaptic(12);
    setIsExporting(true);
    // Ceder el hilo de UI brevemente para renderizar de inmediato el estado de guardado
    await new Promise((r) => setTimeout(r, 25));
    try {
      const cvs = generateExportCanvas();
      const result = await saveArtworkToUserGallery(cvs, projectName, cropMode, scale, format, qualityMode);
      if (result.success) {
        setSuccessMessage(result.message);
        setTimeout(() => setSuccessMessage(''), 3500);
      }
    } finally {
      setIsExporting(false);
    }
  };

  /**
   * Compartir mediante la hoja nativa de Android/iOS (Web Share API)
   */
  const handleShare = async () => {
    triggerHaptic(12);
    setIsExporting(true);
    await new Promise((r) => setTimeout(r, 25));
    try {
      const cvs = generateExportCanvas();
      const shared = await shareArtworkFile(cvs, projectName, format);
      if (shared) {
        setSuccessMessage('¡Obra compartida con éxito!');
      } else {
        handleDownload();
      }
    } catch {
      // Cancelado por el usuario
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
            <ImageIcon size={20} style={{ color: theme.accentColor }} />
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
            <div 
              className="w-10 h-10 rounded-xl border flex items-center justify-center shrink-0"
              style={{ backgroundColor: theme.accentSoft, borderColor: theme.accentBorder, color: theme.accentColor }}
            >
              <HardDrive size={18} />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Peso de tu Obra</span>
              <span className="text-base font-mono font-bold truncate block" style={{ color: theme.accentTextHex }}>
                {formattedFileSize}
              </span>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Dimensiones</span>
            <span className="text-xs font-mono font-bold text-gray-200 block">
              {exportDimensions.w} × {exportDimensions.h} px
            </span>
            <span className="text-[9px] font-bold block" style={{ color: theme.accentColor }}>
              {qualityMode === 'ultra_4k' ? '✨ Ultra 4K SSAA' : qualityMode === 'hd' ? '🌟 HD Antialias' : 'Estándar'}
            </span>
          </div>
        </div>

        {/* 1. Selector de Recorte: Toda la Hoja vs Recortar al Dibujo */}
        <div>
          <label className="text-xs text-gray-300 block mb-1.5 font-bold flex items-center gap-1.5">
            <Crop size={14} style={{ color: theme.accentColor }} />
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
                  ? 'shadow-sm'
                  : 'bg-[#181922] border-[#262837] text-gray-300 hover:border-gray-600'
              }`}
              style={cropMode === 'full' ? {
                backgroundColor: theme.accentSoft,
                borderColor: theme.accentColor,
                color: theme.accentTextHex,
              } : undefined}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold flex items-center gap-1">
                  <Maximize2 size={13} />
                  <span>Hoja Completa</span>
                </span>
                {cropMode === 'full' && <Check size={14} style={{ color: theme.accentColor }} />}
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
                  ? 'shadow-sm'
                  : 'bg-[#181922] border-[#262837] text-gray-300 hover:border-gray-600'
              }`}
              style={cropMode === 'crop' ? {
                backgroundColor: theme.accentSoft,
                borderColor: theme.accentColor,
                color: theme.accentTextHex,
              } : undefined}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold flex items-center gap-1">
                  <Crop size={13} />
                  <span>Recortar al Dibujo</span>
                </span>
                {cropMode === 'crop' && <Check size={14} style={{ color: theme.accentColor }} />}
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
                    ? 'text-black font-bold shadow-md'
                    : 'bg-[#181922] border-[#262837] text-gray-300 hover:border-gray-600'
                }`}
                style={format === fmt ? {
                  backgroundColor: theme.accentColor,
                  borderColor: theme.accentColor,
                  color: '#000000',
                } : undefined}
              >
                {fmt === 'jpeg' ? 'JPG (Estándar)' : fmt.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* 3. Calidad Visual del Dibujo (Anti-aliasing, SSAA y Nitidez Real) */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs text-gray-200 font-bold flex items-center gap-1.5">
              <Sparkles size={14} style={{ color: theme.accentColor }} />
              <span>Calidad del Dibujo:</span>
            </label>
            <span className="text-[10px] font-mono font-bold" style={{ color: theme.accentColor }}>
              {qualityMode === 'ultra_4k' ? 'SSAA 2.5x + Nitidez' : qualityMode === 'hd' ? 'SSAA 2x' : 'Directo'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { 
                id: 'standard' as ExportQualityMode, 
                label: 'Estándar', 
                desc: 'Fiel al lienzo',
                badge: 'Rápido' 
              },
              { 
                id: 'hd' as ExportQualityMode, 
                label: 'HD Mejorado', 
                desc: 'Suavizado de bordes',
                badge: 'Antialias' 
              },
              { 
                id: 'ultra_4k' as ExportQualityMode, 
                label: 'Ultra 4K', 
                desc: 'Máxima nitidez de líneas',
                badge: 'Remaster' 
              },
            ].map((qm) => (
              <button
                key={qm.id}
                onClick={() => {
                  triggerHaptic(8);
                  setQualityMode(qm.id);
                }}
                className={`py-2 px-2 rounded-xl border text-left transition-all active:scale-95 flex flex-col justify-between ${
                  qualityMode === qm.id
                    ? 'shadow-sm'
                    : 'bg-[#181922] border-[#262837] text-gray-300 hover:border-gray-600'
                }`}
                style={qualityMode === qm.id ? {
                  backgroundColor: theme.accentSoft,
                  borderColor: theme.accentColor,
                  color: theme.accentTextHex,
                } : undefined}
              >
                <div>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-bold block">{qm.label}</span>
                    {qualityMode === qm.id && <Check size={12} style={{ color: theme.accentColor }} className="shrink-0" />}
                  </div>
                  <span className="text-[9px] text-gray-400 block leading-tight">{qm.desc}</span>
                </div>
                <span className="text-[8px] font-mono uppercase tracking-wider mt-1 block" style={{ color: theme.accentColor }}>
                  {qm.badge}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* 4. Dimensiones del Lienzo: Conservar tamaño real vs Resolución Expandida */}
        <div>
          <label className="text-xs text-gray-300 block mb-1.5 font-bold flex items-center gap-1.5">
            <Maximize2 size={13} style={{ color: theme.accentColor }} />
            <span>Dimensiones del Lienzo:</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                triggerHaptic(8);
                setIsPosterScale(false);
              }}
              className={`p-2.5 rounded-xl border text-left transition-all flex flex-col gap-0.5 active:scale-95 ${
                !isPosterScale
                  ? 'shadow-sm'
                  : 'bg-[#181922] border-[#262837] text-gray-300 hover:border-gray-600'
              }`}
              style={!isPosterScale ? {
                backgroundColor: theme.accentSoft,
                borderColor: theme.accentColor,
                color: theme.accentTextHex,
              } : undefined}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold">Conservar Tamaño</span>
                {!isPosterScale && <Check size={14} style={{ color: theme.accentColor }} />}
              </div>
              <span className="text-[10px] text-gray-400 leading-tight">
                Mantiene tus {width} × {height}px originales y sube la calidad del trazo.
              </span>
            </button>

            <button
              onClick={() => {
                triggerHaptic(8);
                setIsPosterScale(true);
              }}
              className={`p-2.5 rounded-xl border text-left transition-all flex flex-col gap-0.5 active:scale-95 ${
                isPosterScale
                  ? 'shadow-sm'
                  : 'bg-[#181922] border-[#262837] text-gray-300 hover:border-gray-600'
              }`}
              style={isPosterScale ? {
                backgroundColor: theme.accentSoft,
                borderColor: theme.accentColor,
                color: theme.accentTextHex,
              } : undefined}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold">Póster 3x Gigante</span>
                {isPosterScale && <Check size={14} style={{ color: theme.accentColor }} />}
              </div>
              <span className="text-[10px] text-gray-400 leading-tight">
                Expande a {width * 3} × {height * 3}px para imprimir en pared.
              </span>
            </button>
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
              style={{ accentColor: theme.accentColor }}
              className="w-4 h-4 rounded bg-gray-900 border-gray-700"
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

        {/* Nota explicativa de guardado vs compartir */}
        <p className="text-[10px] text-gray-400 bg-[#101117] p-2.5 rounded-xl border border-[#212330] leading-snug">
          <strong style={{ color: theme.accentColor }}>💡 Calidad 4K Remaster:</strong> <span className="text-gray-300 font-medium">Sube la nitidez de las líneas y suaviza bordes pixelados con súper-muestreo, manteniendo las proporciones exactas de tu hoja de dibujo sin inflar el lienzo.</span>
        </p>

        {/* Botones de acción principales */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={handleDownload}
            disabled={isExporting}
            className="flex-1 py-3 px-3 text-black font-bold rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 text-xs sm:text-sm"
            style={{ 
              backgroundColor: theme.accentColor,
              boxShadow: `0 4px 14px ${theme.accentSoft25}` 
            }}
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
            <Share2 size={16} style={{ color: theme.accentColor }} />
            <span>Compartir</span>
          </button>
        </div>
      </div>
    </div>
  );
};
