/**
 * @file TracingAdjuster.tsx
 * @description Superposición táctil ergonómica para posicionar, escalar, rotar
 * y calibrar la foto de referencia para calco sobre el lienzo sin obstruir la vista del artista.
 * 
 * Mejoras clave de experiencia móvil:
 * - Panel minimizable: Permite colapsar el menú a una barra ultra compacta con 1 toque
 *   para ver y calcar toda la hoja sin que ningún diálogo bloquee el dibujo.
 * - Conmutador instantáneo de visibilidad (Ocultar/Mostrar calco al instante).
 * - Tiradores táctiles en esquinas con amplia zona de toque (touch targets de 44px+).
 * - Gestos multitáctiles con 2 dedos (Pinch-to-scale y rotación) y arrastre con 1 dedo.
 * - Filtros Wasm (Sobel Lineart, Alto Contraste, Monocromo).
 */

import React, { useRef, useState } from 'react';
import { 
  Check, X, RotateCcw, Move, Sliders, Image as ImageIcon, 
  Sparkles, Eye, EyeOff, ChevronDown, ChevronUp, Layers
} from 'lucide-react';
import { TracingReference, TracingFilterMode } from '../engine/types';

interface TracingAdjusterProps {
  canvasWidth: number;
  canvasHeight: number;
  screenScale: number;
  tracing: TracingReference;
  onChangeTransform: (update: Partial<TracingReference>) => void;
  onApplyFilter: (mode: TracingFilterMode) => void;
  onCenterImage: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export const TracingAdjuster: React.FC<TracingAdjusterProps> = ({
  canvasWidth,
  canvasHeight,
  screenScale,
  tracing,
  onChangeTransform,
  onApplyFilter,
  onCenterImage,
  onConfirm,
  onCancel,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragStartRef = useRef<{
    pointerX: number;
    pointerY: number;
    startX: number;
    startY: number;
    startScale: number;
    mode: 'move' | 'corner' | 'pinch';
    corner?: 'tl' | 'tr' | 'bl' | 'br';
  } | null>(null);

  const pinchRef = useRef<{
    initialDist: number;
    initialScale: number;
    initialAngle: number;
    initialRotation: number;
  } | null>(null);

  const [activeTab, setActiveTab] = useState<'transform' | 'filters'>('transform');
  // Estado para minimizar los controles y no tapar el dibujo
  const [isMinimized, setIsMinimized] = useState<boolean>(false);

  // Dimensiones actuales dibujadas en píxeles de lienzo
  const drawWidth = tracing.width * tracing.scale;
  const drawHeight = tracing.height * tracing.scale;

  // Manejador PointerDown para mover la foto con 1 dedo
  const handlePointerDownMove = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // Ignorar
    }
    dragStartRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      startX: tracing.x,
      startY: tracing.y,
      startScale: tracing.scale,
      mode: 'move',
    };
  };

  // Manejador PointerDown para redimensionar desde una esquina
  const handlePointerDownCorner = (e: React.PointerEvent<HTMLDivElement>, corner: 'tl' | 'tr' | 'bl' | 'br') => {
    e.stopPropagation();
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // Ignorar
    }
    dragStartRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      startX: tracing.x,
      startY: tracing.y,
      startScale: tracing.scale,
      mode: 'corner',
      corner,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current) return;
    e.stopPropagation();

    const dx = (e.clientX - dragStartRef.current.pointerX) / screenScale;
    const dy = (e.clientY - dragStartRef.current.pointerY) / screenScale;

    if (dragStartRef.current.mode === 'move') {
      onChangeTransform({
        x: Math.round(dragStartRef.current.startX + dx),
        y: Math.round(dragStartRef.current.startY + dy),
      });
    } else if (dragStartRef.current.mode === 'corner') {
      const corner = dragStartRef.current.corner;
      let scaleMultiplier = 1;
      const initialDiagonal = Math.hypot(tracing.width, tracing.height);
      const deltaDiag = (corner === 'br' || corner === 'tr' ? dx : -dx) + (corner === 'br' || corner === 'bl' ? dy : -dy);
      scaleMultiplier = 1 + deltaDiag / (initialDiagonal * dragStartRef.current.startScale);

      const nextScale = Math.max(0.1, Math.min(6.0, Number((dragStartRef.current.startScale * scaleMultiplier).toFixed(3))));
      onChangeTransform({ scale: nextScale });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignorar
    }
    dragStartRef.current = null;
  };

  // Soporte para gestos multitáctiles a 2 dedos sobre el calco
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      e.stopPropagation();
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      const angle = Math.atan2(t1.clientY - t0.clientY, t1.clientX - t0.clientX);

      pinchRef.current = {
        initialDist: Math.max(10, dist),
        initialScale: tracing.scale,
        initialAngle: angle,
        initialRotation: tracing.rotation,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (pinchRef.current && e.touches.length === 2) {
      e.stopPropagation();
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      const angle = Math.atan2(t1.clientY - t0.clientY, t1.clientX - t0.clientX);

      const scaleRatio = dist / pinchRef.current.initialDist;
      const nextScale = Math.max(0.1, Math.min(6.0, Number((pinchRef.current.initialScale * scaleRatio).toFixed(3))));
      const deltaAngle = angle - pinchRef.current.initialAngle;
      const nextRotation = Number((pinchRef.current.initialRotation + deltaAngle).toFixed(3));

      onChangeTransform({
        scale: nextScale,
        rotation: nextRotation,
      });
    }
  };

  const handleTouchEnd = () => {
    pinchRef.current = null;
  };

  return (
    <div 
      ref={containerRef}
      className="absolute inset-0 pointer-events-none z-30 select-none overflow-hidden"
    >
      {/* 1. Marco interactivo de Transformación sobre el lienzo */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          position: 'absolute',
          left: `${tracing.x}px`,
          top: `${tracing.y}px`,
          width: `${drawWidth}px`,
          height: `${drawHeight}px`,
          transform: `translate(-50%, -50%) rotate(${tracing.rotation}rad)`,
          pointerEvents: 'auto',
          cursor: 'grab',
        }}
        className="touch-none group"
      >
        {/* Borde guía con acento ámbar */}
        <div 
          onPointerDown={handlePointerDownMove}
          className="w-full h-full border-2 border-dashed border-amber-400 bg-amber-400/5 hover:bg-amber-400/10 transition-colors flex items-center justify-center relative shadow-lg"
        >
          {/* Indicador central para mover con 1 dedo */}
          <div className="p-3 rounded-full bg-amber-500 text-black shadow-xl flex items-center justify-center pointer-events-none active:scale-95 transition-transform ring-4 ring-black/40">
            <Move size={20} />
          </div>

          <span className="absolute bottom-2 text-[10px] font-mono font-bold bg-black/85 text-amber-300 px-2.5 py-0.5 rounded-full pointer-events-none shadow-md">
            Mueve con 1 dedo • Pellizca con 2 para zoom
          </span>
        </div>

        {/* Tiradores en las 4 esquinas con área táctil ampliada (36×36px) */}
        <div
          onPointerDown={(e) => handlePointerDownCorner(e, 'tl')}
          aria-label="Escalar calco esquina superior izquierda"
          className="absolute -top-4 -left-4 w-9 h-9 bg-amber-400 border-2 border-black rounded-full shadow-lg cursor-nwse-resize active:scale-125 transition-transform flex items-center justify-center touch-none ring-2 ring-white/50"
        />
        <div
          onPointerDown={(e) => handlePointerDownCorner(e, 'tr')}
          aria-label="Escalar calco esquina superior derecha"
          className="absolute -top-4 -right-4 w-9 h-9 bg-amber-400 border-2 border-black rounded-full shadow-lg cursor-nesw-resize active:scale-125 transition-transform flex items-center justify-center touch-none ring-2 ring-white/50"
        />
        <div
          onPointerDown={(e) => handlePointerDownCorner(e, 'bl')}
          aria-label="Escalar calco esquina inferior izquierda"
          className="absolute -bottom-4 -left-4 w-9 h-9 bg-amber-400 border-2 border-black rounded-full shadow-lg cursor-nesw-resize active:scale-125 transition-transform flex items-center justify-center touch-none ring-2 ring-white/50"
        />
        <div
          onPointerDown={(e) => handlePointerDownCorner(e, 'br')}
          aria-label="Escalar calco esquina inferior derecha"
          className="absolute -bottom-4 -right-4 w-9 h-9 bg-amber-400 border-2 border-black rounded-full shadow-lg cursor-nwse-resize active:scale-125 transition-transform flex items-center justify-center touch-none ring-2 ring-white/50"
        />
      </div>

      {/* 2. Barra de controles reposicionada y minimizable para no estorbar el lienzo */}
      <div 
        style={{ pointerEvents: 'auto' }}
        className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 max-w-sm w-[94%] select-none transition-all duration-300"
      >
        {isMinimized ? (
          /* MODO MINIMIZADO: Píldora ultra compacta que no tapa el dibujo */
          <div className="bg-[#14151df0] border border-amber-500/80 rounded-full px-3.5 py-2 shadow-2xl backdrop-blur-md flex items-center justify-between gap-2 text-white animate-fade-in">
            <div className="flex items-center gap-2">
              <ImageIcon size={16} className="text-amber-400" />
              <span className="text-xs font-bold text-amber-300">Calco</span>
              <span className="text-[11px] font-mono font-semibold bg-[#202230] px-1.5 py-0.5 rounded text-gray-300">
                {Math.round(tracing.opacity * 100)}%
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Conmutador instantáneo de visibilidad */}
              <button
                onClick={() => onChangeTransform({ visible: !tracing.visible })}
                className={`p-1.5 rounded-full border text-xs flex items-center gap-1 transition-all ${
                  tracing.visible 
                    ? 'bg-[#222432] border-gray-700 text-gray-200' 
                    : 'bg-amber-500/20 border-amber-400 text-amber-300'
                }`}
                title={tracing.visible ? 'Ocultar foto temporalmente' : 'Mostrar foto de calco'}
              >
                {tracing.visible ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>

              {/* Botón para expandir ajustes */}
              <button
                onClick={() => setIsMinimized(false)}
                className="px-2.5 py-1 rounded-full bg-[#242738] hover:bg-[#2c2f42] text-xs font-semibold flex items-center gap-1 text-gray-200"
              >
                <Sliders size={13} />
                <span>Ajustes</span>
                <ChevronUp size={14} />
              </button>

              {/* Fijar directo */}
              <button
                onClick={onConfirm}
                className="p-1.5 rounded-full bg-amber-500 hover:bg-amber-400 text-black font-bold shadow-md active:scale-95 transition-all"
                title="Fijar y Empezar a Dibujar"
              >
                <Check size={16} />
              </button>
            </div>
          </div>
        ) : (
          /* MODO EXPANDIDO: Panel completo con opción de minimizar */
          <div className="bg-[#151620f5] border border-amber-500/60 rounded-3xl p-3.5 shadow-2xl backdrop-blur-md flex flex-col gap-2.5 animate-fade-in text-white">
            {/* Cabecera del Calco con Minimizar y Descartar */}
            <div className="flex items-center justify-between border-b border-[#292c3a] pb-2">
              <div className="flex items-center gap-2">
                <ImageIcon size={18} className="text-amber-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  Calibrar Foto de Calco
                </h3>
              </div>

              <div className="flex items-center gap-1.5">
                {/* Ocultar / Mostrar foto de calco */}
                <button
                  onClick={() => onChangeTransform({ visible: !tracing.visible })}
                  className={`p-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-all ${
                    tracing.visible 
                      ? 'bg-[#222432] border-gray-700 text-gray-200' 
                      : 'bg-amber-500/20 border-amber-400 text-amber-300'
                  }`}
                  title={tracing.visible ? 'Ocultar foto temporalmente' : 'Mostrar foto de calco'}
                >
                  {tracing.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                  <span className="text-[10px]">{tracing.visible ? 'Visible' : 'Oculta'}</span>
                </button>

                <button
                  onClick={onCenterImage}
                  className="p-1.5 rounded-lg bg-[#222430] hover:bg-[#2b2d3d] text-gray-300 text-[10px] font-semibold flex items-center gap-1 transition-colors"
                  title="Centrar en medio de la hoja"
                >
                  <RotateCcw size={12} />
                  <span>Centrar</span>
                </button>

                {/* Minimizar panel para despejar la vista */}
                <button
                  onClick={() => setIsMinimized(true)}
                  className="p-1.5 rounded-lg bg-[#222430] hover:bg-[#2b2d3d] text-gray-300 transition-colors"
                  title="Minimizar panel para ver el dibujo completo"
                >
                  <ChevronDown size={15} />
                </button>

                <button
                  onClick={onCancel}
                  aria-label="Descartar foto de calco"
                  className="p-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-400 transition-colors"
                  title="Descartar foto"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Selector de Pestañas: Transformación vs Filtros Wasm */}
            <div className="grid grid-cols-2 gap-1.5 bg-[#101117] p-1 rounded-xl border border-[#232533]">
              <button
                onClick={() => setActiveTab('transform')}
                className={`py-1 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === 'transform' ? 'bg-amber-500 text-black' : 'text-gray-400 hover:text-white'
                }`}
              >
                Opacidad y Ajuste
              </button>
              <button
                onClick={() => setActiveTab('filters')}
                className={`py-1 text-xs font-semibold rounded-lg flex items-center justify-center gap-1 transition-all ${
                  activeTab === 'filters' ? 'bg-amber-500 text-black' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Sparkles size={13} />
                <span>Filtros Wasm</span>
              </button>
            </div>

            {/* Pestaña 1: Slider de Opacidad con Chips de Acceso Rápido */}
            {activeTab === 'transform' ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-300 font-medium">Opacidad del Calco:</span>
                  <span className="font-mono font-bold text-amber-400">
                    {Math.round(tracing.opacity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="100"
                  value={Math.round(tracing.opacity * 100)}
                  onChange={(e) => onChangeTransform({ opacity: Number(e.target.value) / 100 })}
                  className="w-full accent-amber-500 h-2 bg-[#252735] rounded-lg cursor-pointer"
                />
                <div className="flex justify-between gap-1 pt-0.5">
                  {[15, 30, 40, 60, 85].map((preset) => (
                    <button
                      key={preset}
                      onClick={() => onChangeTransform({ opacity: preset / 100 })}
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-lg border transition-all ${
                        Math.round(tracing.opacity * 100) === preset
                          ? 'bg-amber-500 text-black font-bold border-amber-400'
                          : 'bg-[#1b1d28] border-[#292c3a] text-gray-400 hover:text-white'
                      }`}
                    >
                      {preset}%
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Pestaña 2: Filtros Inteligentes Wasm para Calcar */
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { mode: 'original', label: 'Color', desc: 'Foto original' },
                  { mode: 'lineart', label: 'Lineart', desc: 'Bordes Sobel' },
                  { mode: 'grayscale', label: 'B/N', desc: 'Monocromo' },
                  { mode: 'contrast', label: 'Contraste', desc: 'Alto contraste' },
                ].map((f) => (
                  <button
                    key={f.mode}
                    onClick={() => onApplyFilter(f.mode as TracingFilterMode)}
                    className={`py-2 px-1 rounded-xl text-center border flex flex-col items-center justify-center gap-0.5 transition-all ${
                      tracing.filterMode === f.mode
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-md ring-1 ring-amber-400/40'
                        : 'bg-[#181a24] border-[#292c3a] text-gray-400 hover:text-white'
                    }`}
                  >
                    <span className="text-[11px] font-bold">{f.label}</span>
                    <span className="text-[8px] text-gray-500">{f.desc}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Botón de Confirmación Principal */}
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => setIsMinimized(true)}
                className="py-2.5 px-3 rounded-xl bg-[#222432] hover:bg-[#2b2e40] text-gray-300 text-xs font-semibold flex items-center justify-center gap-1 border border-[#303346]"
                title="Minimizar panel para ver mejor el lienzo"
              >
                <ChevronDown size={14} />
                <span>Minimizar</span>
              </button>

              <button
                onClick={onConfirm}
                className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg active:scale-95 transition-all"
              >
                <Check size={16} />
                <span>Fijar Calco y Empezar a Dibujar</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
