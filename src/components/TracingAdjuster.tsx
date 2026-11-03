/**
 * @file TracingAdjuster.tsx
 * @description Superposición táctil ergonómica y barra de calibración compacta nativa (estilo IbisPaint X)
 * para posicionar, escalar, rotar y calibrar la foto de referencia para calco o accesorios/stickers.
 * 
 * Modularizado:
 * - Manipulación gestual de 1 y 2 dedos con GPU transform extraída a `useTracingGestures.ts`.
 * - Píldora ultra compacta flotante extraída a `tracing/TracingMinimizedPill.tsx`.
 * - Barra de calibración compacta inferior extraída a `tracing/TracingControlBar.tsx`.
 * - Aceleración por GPU a 120 FPS sin reflows ni re-renders del DOM.
 */

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Move } from 'lucide-react';
import { TracingReference, TracingFilterMode } from '../engine/types';
import { useTracingGestures } from '../hooks/useTracingGestures';
import { TracingMinimizedPill } from './tracing/TracingMinimizedPill';
import { TracingControlBar } from './tracing/TracingControlBar';

interface TracingAdjusterProps {
  canvasWidth: number;
  canvasHeight: number;
  screenScale: number;
  canvasRotation?: number;
  tracing: TracingReference;
  onChangeTransform: (update: Partial<TracingReference>) => void;
  onApplyFilter: (mode: TracingFilterMode) => void;
  onCenterImage: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  onStampToActiveLayer?: () => void;
  onStampAsNewLayer?: () => void;
}

export const TracingAdjuster: React.FC<TracingAdjusterProps> = ({
  canvasWidth,
  canvasHeight,
  screenScale,
  canvasRotation = 0,
  tracing,
  onChangeTransform,
  onApplyFilter,
  onCenterImage,
  onConfirm,
  onCancel,
  onStampToActiveLayer,
  onStampAsNewLayer,
}) => {
  const isAccessory = tracing.purpose === 'accessory';
  const [isMinimized, setIsMinimized] = useState<boolean>(false);

  const {
    boxRef,
    handlePointerDownMove,
    handlePointerDownCorner,
  } = useTracingGestures({
    tracing,
    screenScale,
    canvasRotation,
    onChangeTransform,
  });

  return (
    <>
      {/* 1. MARCO INTERACTIVO ACELERADO POR GPU PURA (120 FPS Sin Reflows) */}
      <div className="absolute inset-0 pointer-events-none z-30 select-none overflow-visible">
        <div
          ref={boxRef}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: `${tracing.width}px`,
            height: `${tracing.height}px`,
            transform: `translate3d(${tracing.x}px, ${tracing.y}px, 0) translate(-50%, -50%) rotate(${tracing.rotation}rad) scale(${tracing.scale})`,
            transformOrigin: 'center center',
            pointerEvents: 'auto',
            cursor: 'grab',
            willChange: 'transform',
          }}
          className="touch-none group"
        >
          {/* Imagen de calco renderizada en textura GPU sin latencia */}
          {tracing.image && (
            <img
              src={tracing.image.src || tracing.src}
              alt="Referencia de calco"
              className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none"
              style={{
                opacity: tracing.opacity,
                display: tracing.visible ? 'block' : 'none',
              }}
            />
          )}

          {/* Borde guía con acento ámbar o rosa según sea calco o accesorio */}
          <div 
            onPointerDown={handlePointerDownMove}
            className={`w-full h-full border-2 border-dashed ${
              isAccessory 
                ? 'border-pink-400 bg-pink-400/5 hover:bg-pink-400/10' 
                : 'border-amber-400 bg-amber-400/5 hover:bg-amber-400/10'
            } transition-colors flex items-center justify-center relative shadow-2xl`}
          >
            {/* Indicador central para mover con 1 dedo con tamaño constante en pantalla */}
            <div 
              style={{
                transform: 'scale(var(--counter-scale, 1))',
                transformOrigin: 'center center',
              }}
              className={`p-2.5 rounded-full ${
                isAccessory ? 'bg-pink-500' : 'bg-amber-500'
              } text-black shadow-2xl flex items-center justify-center pointer-events-none active:scale-95 transition-transform ring-4 ring-black/50`}
            >
              <Move size={16} />
            </div>

            {/* Píldora de ayuda gestual */}
            <span 
              style={{
                transform: 'scale(var(--counter-scale, 1))',
                transformOrigin: 'bottom center',
              }}
              className="absolute bottom-2 text-[10px] font-mono font-bold bg-black/90 text-amber-300 px-2.5 py-0.5 rounded-full pointer-events-none shadow-xl border border-amber-500/30 whitespace-nowrap"
            >
              1 dedo mueve • 2 dedos rotan y escalan
            </span>
          </div>

          {/* Tiradores en las 4 esquinas con touch target generoso (48px) y escala compensada */}
          <div
            onPointerDown={(e) => handlePointerDownCorner(e, 'tl')}
            aria-label="Escalar esquina superior izquierda"
            style={{
              transform: 'scale(var(--counter-scale, 1))',
              transformOrigin: 'center center',
            }}
            className={`absolute -top-3.5 -left-3.5 w-7 h-7 ${
              isAccessory ? 'bg-pink-400' : 'bg-amber-400'
            } border-2 border-black rounded-full shadow-2xl cursor-nwse-resize active:scale-125 transition-transform flex items-center justify-center touch-none ring-2 ring-white/60 before:absolute before:-inset-2.5 before:content-['']`}
          />
          <div
            onPointerDown={(e) => handlePointerDownCorner(e, 'tr')}
            aria-label="Escalar esquina superior derecha"
            style={{
              transform: 'scale(var(--counter-scale, 1))',
              transformOrigin: 'center center',
            }}
            className={`absolute -top-3.5 -right-3.5 w-7 h-7 ${
              isAccessory ? 'bg-pink-400' : 'bg-amber-400'
            } border-2 border-black rounded-full shadow-2xl cursor-nesw-resize active:scale-125 transition-transform flex items-center justify-center touch-none ring-2 ring-white/60 before:absolute before:-inset-2.5 before:content-['']`}
          />
          <div
            onPointerDown={(e) => handlePointerDownCorner(e, 'bl')}
            aria-label="Escalar esquina inferior izquierda"
            style={{
              transform: 'scale(var(--counter-scale, 1))',
              transformOrigin: 'center center',
            }}
            className={`absolute -bottom-3.5 -left-3.5 w-7 h-7 ${
              isAccessory ? 'bg-pink-400' : 'bg-amber-400'
            } border-2 border-black rounded-full shadow-2xl cursor-nesw-resize active:scale-125 transition-transform flex items-center justify-center touch-none ring-2 ring-white/60 before:absolute before:-inset-2.5 before:content-['']`}
          />
          <div
            onPointerDown={(e) => handlePointerDownCorner(e, 'br')}
            aria-label="Escalar esquina inferior derecha"
            style={{
              transform: 'scale(var(--counter-scale, 1))',
              transformOrigin: 'center center',
            }}
            className={`absolute -bottom-3.5 -right-3.5 w-7 h-7 ${
              isAccessory ? 'bg-pink-400' : 'bg-amber-400'
            } border-2 border-black rounded-full shadow-2xl cursor-nwse-resize active:scale-125 transition-transform flex items-center justify-center touch-none ring-2 ring-white/60 before:absolute before:-inset-2.5 before:content-['']`}
          />
        </div>
      </div>

      {/* 2. BARRA DE CALIBRACIÓN COMPACTA NATIVA (Portal) */}
      {typeof document !== 'undefined' && createPortal(
        isMinimized ? (
          <TracingMinimizedPill
            tracing={tracing}
            isAccessory={isAccessory}
            onToggleVisibility={() => onChangeTransform({ visible: !tracing.visible })}
            onExpand={() => setIsMinimized(false)}
            onConfirm={onConfirm}
          />
        ) : (
          <TracingControlBar
            tracing={tracing}
            isAccessory={isAccessory}
            onChangeTransform={onChangeTransform}
            onApplyFilter={onApplyFilter}
            onCenterImage={onCenterImage}
            onConfirm={onConfirm}
            onCancel={onCancel}
            onStampToActiveLayer={onStampToActiveLayer}
            onStampAsNewLayer={onStampAsNewLayer}
            onMinimize={() => setIsMinimized(true)}
          />
        ),
        document.body
      )}
    </>
  );
};
