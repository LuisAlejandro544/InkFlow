/**
 * @file TracingAdjuster.tsx
 * @description Superposición táctil ergonómica y barra de calibración compacta nativa (estilo IbisPaint X)
 * para posicionar, escalar, rotar y calibrar la foto de referencia para calco o accesorios/stickers.
 * 
 * Mejoras clave de rendimiento y ergonomía (120 FPS Pure GPU Acceleration):
 * 1. Cero Reflows de Diseño: El tamaño de la caja se mantiene constante en dimensiones nativas.
 *    Toda la posición, escala y rotación se aplican exclusivamente mediante CSS hardware transform
 *    (translate3d, rotate, scale) en la GPU, evitando recalcular el layout DOM o remuestrear la imagen
 *    en CPU en cada píxel de movimiento.
 * 2. Gestos Multitáctiles Fluidos: Arrastre con 1 dedo, escalado isotropic desde cualquier esquina
 *    y pinch-to-zoom / rotación con 2 dedos mediante requestAnimationFrame sin disparar re-renderizados
 *    de React. La persistencia al estado de React ocurre al soltar el dedo (1 solo commit).
 * 3. Compensación de Escala Inteligente: Los tiradores táctiles y botones mantienen un tamaño físico
 *    óptimo en pantalla (~36-44px) sin importar cuánto se agrande o achique la foto o el lienzo.
 * 4. Diseño Adaptable sin Desbordamiento (Zero-Overflow): Toda la botonera cabe en pantallas móviles
 *    estrechas desde 320px hasta 430px, asegurando que el botón principal "Fijar Calco" esté siempre
 *    visible y bajo la zona del pulgar.
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  Check, X, RotateCcw, Move, Sliders, Image as ImageIcon, 
  Sparkles, Eye, EyeOff, ChevronDown, ChevronUp, Layers, 
  RotateCw, Maximize2, SlidersHorizontal
} from 'lucide-react';
import { TracingReference, TracingFilterMode } from '../engine/types';

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
  
  // Referencia a la caja transformable para aceleración por GPU pura
  const boxRef = useRef<HTMLDivElement | null>(null);

  // Registro mutable de la transformación actual durante la interacción táctil
  const currentTransformRef = useRef({
    x: tracing.x,
    y: tracing.y,
    scale: tracing.scale,
    rotation: tracing.rotation,
  });

  // Identificador de requestAnimationFrame para sincronizar a 60-120 FPS
  const rafIdRef = useRef<number | null>(null);

  // Referencia al estado de arrastre de 1 dedo o esquina
  const dragRef = useRef<{
    type: 'move' | 'corner';
    corner?: 'tl' | 'tr' | 'bl' | 'br';
    startX: number;
    startY: number;
    startClientX: number;
    startClientY: number;
    startScale: number;
    centerX: number;
    centerY: number;
    startDist: number;
  } | null>(null);

  // Referencia para gestos multitáctiles con 2 dedos (Pinch-to-zoom y rotación)
  const pinchRef = useRef<{
    initialDist: number;
    initialAngle: number;
    initialScale: number;
    initialRotation: number;
    initialX: number;
    initialY: number;
    initialCenterX: number;
    initialCenterY: number;
  } | null>(null);

  // Menú emergente de filtros Wasm
  const [showFiltersMenu, setShowFiltersMenu] = useState<boolean>(false);
  // Modo píldora ultra compacta
  const [isMinimized, setIsMinimized] = useState<boolean>(false);

  /**
   * Actualiza el estilo CSS transform de la caja en la GPU mediante requestAnimationFrame
   */
  const scheduleDOMTransform = useCallback(() => {
    if (rafIdRef.current !== null) return;
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      if (!boxRef.current) return;
      const { x, y, scale, rotation } = currentTransformRef.current;
      boxRef.current.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) rotate(${rotation}rad) scale(${scale})`;
      
      // Counter-scale para que los tiradores táctiles mantengan tamaño visible uniforme en pantalla
      const counterFactor = Math.min(6.0, Math.max(0.6, 1 / (screenScale * scale)));
      boxRef.current.style.setProperty('--counter-scale', String(counterFactor));
    });
  }, [screenScale]);

  // Sincronizar transformación cuando cambian las props de React
  useEffect(() => {
    currentTransformRef.current = {
      x: tracing.x,
      y: tracing.y,
      scale: tracing.scale,
      rotation: tracing.rotation,
    };
    if (boxRef.current) {
      boxRef.current.style.transform = `translate3d(${tracing.x}px, ${tracing.y}px, 0) translate(-50%, -50%) rotate(${tracing.rotation}rad) scale(${tracing.scale})`;
      const counterFactor = Math.min(6.0, Math.max(0.6, 1 / (screenScale * tracing.scale)));
      boxRef.current.style.setProperty('--counter-scale', String(counterFactor));
    }
  }, [tracing.x, tracing.y, tracing.scale, tracing.rotation, screenScale]);

  /**
   * Manejador de movimiento global para 1 dedo (desplazamiento o escalado por esquina)
   */
  const onGlobalPointerMove = useCallback((e: PointerEvent) => {
    if (!dragRef.current) return;
    e.preventDefault();

    if (dragRef.current.type === 'move') {
      const dx = e.clientX - dragRef.current.startClientX;
      const dy = e.clientY - dragRef.current.startClientY;

      // Compensar la rotación del lienzo del estudio para que mover con el dedo siga la pantalla
      const rotRad = (canvasRotation * Math.PI) / 180;
      const cos = Math.cos(-rotRad);
      const sin = Math.sin(-rotRad);
      const canvasDx = (dx * cos - dy * sin) / screenScale;
      const canvasDy = (dx * sin + dy * cos) / screenScale;

      currentTransformRef.current.x = Math.round(dragRef.current.startX + canvasDx);
      currentTransformRef.current.y = Math.round(dragRef.current.startY + canvasDy);
      scheduleDOMTransform();
    } else if (dragRef.current.type === 'corner') {
      // Escalado isotrópico independiente de rotación basado en distancia al centro
      const currentDist = Math.hypot(
        e.clientX - dragRef.current.centerX,
        e.clientY - dragRef.current.centerY
      );
      const scaleMultiplier = currentDist / Math.max(10, dragRef.current.startDist);
      const nextScale = Math.max(0.08, Math.min(8.0, Number((dragRef.current.startScale * scaleMultiplier).toFixed(3))));
      
      currentTransformRef.current.scale = nextScale;
      scheduleDOMTransform();
    }
  }, [canvasRotation, screenScale, scheduleDOMTransform]);

  /**
   * Manejador al soltar el dedo: Realiza 1 solo commit al estado de React
   */
  const onGlobalPointerUp = useCallback((e: PointerEvent) => {
    if (!dragRef.current) return;
    e.preventDefault();
    const wasCorner = dragRef.current.type === 'corner';
    dragRef.current = null;

    window.removeEventListener('pointermove', onGlobalPointerMove);
    window.removeEventListener('pointerup', onGlobalPointerUp);
    window.removeEventListener('pointercancel', onGlobalPointerUp);

    if (wasCorner) {
      onChangeTransform({ scale: currentTransformRef.current.scale });
    } else {
      onChangeTransform({
        x: currentTransformRef.current.x,
        y: currentTransformRef.current.y,
      });
    }
  }, [onGlobalPointerMove, onChangeTransform]);

  /**
   * Inicia el arrastre de traslación con 1 dedo
   */
  const handlePointerDownMove = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    dragRef.current = {
      type: 'move',
      startX: currentTransformRef.current.x,
      startY: currentTransformRef.current.y,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startScale: currentTransformRef.current.scale,
      centerX: 0,
      centerY: 0,
      startDist: 0,
    };

    window.addEventListener('pointermove', onGlobalPointerMove, { passive: false });
    window.addEventListener('pointerup', onGlobalPointerUp);
    window.addEventListener('pointercancel', onGlobalPointerUp);
  };

  /**
   * Inicia el redimensionamiento desde una esquina
   */
  const handlePointerDownCorner = (e: React.PointerEvent<HTMLDivElement>, corner: 'tl' | 'tr' | 'bl' | 'br') => {
    e.preventDefault();
    e.stopPropagation();

    // Obtener el centro visual de la caja en coordenadas de pantalla
    const rect = boxRef.current ? boxRef.current.getBoundingClientRect() : null;
    const centerX = rect ? rect.left + rect.width / 2 : e.clientX;
    const centerY = rect ? rect.top + rect.height / 2 : e.clientY;
    const startDist = Math.hypot(e.clientX - centerX, e.clientY - centerY);

    dragRef.current = {
      type: 'corner',
      corner,
      startX: currentTransformRef.current.x,
      startY: currentTransformRef.current.y,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startScale: currentTransformRef.current.scale,
      centerX,
      centerY,
      startDist: Math.max(10, startDist),
    };

    window.addEventListener('pointermove', onGlobalPointerMove, { passive: false });
    window.addEventListener('pointerup', onGlobalPointerUp);
    window.addEventListener('pointercancel', onGlobalPointerUp);
  };

  // Suscripción a gestos multitáctiles nativos de 2 dedos (Pinch-to-zoom y rotación sin delay)
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;

    const onNativeTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        e.stopPropagation();
        const t0 = e.touches[0];
        const t1 = e.touches[1];
        const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
        const angle = Math.atan2(t1.clientY - t0.clientY, t1.clientX - t0.clientX);
        const centerX = (t0.clientX + t1.clientX) / 2;
        const centerY = (t0.clientY + t1.clientY) / 2;

        pinchRef.current = {
          initialDist: Math.max(10, dist),
          initialAngle: angle,
          initialScale: currentTransformRef.current.scale,
          initialRotation: currentTransformRef.current.rotation,
          initialX: currentTransformRef.current.x,
          initialY: currentTransformRef.current.y,
          initialCenterX: centerX,
          initialCenterY: centerY,
        };
      }
    };

    const onNativeTouchMove = (e: TouchEvent) => {
      if (pinchRef.current && e.touches.length === 2) {
        e.preventDefault();
        e.stopPropagation();
        const t0 = e.touches[0];
        const t1 = e.touches[1];
        const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
        const angle = Math.atan2(t1.clientY - t0.clientY, t1.clientX - t0.clientX);
        const centerX = (t0.clientX + t1.clientX) / 2;
        const centerY = (t0.clientY + t1.clientY) / 2;

        const scaleRatio = dist / pinchRef.current.initialDist;
        const nextScale = Math.max(0.08, Math.min(8.0, Number((pinchRef.current.initialScale * scaleRatio).toFixed(3))));
        const deltaAngle = angle - pinchRef.current.initialAngle;
        const nextRotation = Number((pinchRef.current.initialRotation + deltaAngle).toFixed(3));

        // Paneo durante el pinch
        const dx = centerX - pinchRef.current.initialCenterX;
        const dy = centerY - pinchRef.current.initialCenterY;
        const rotRad = (canvasRotation * Math.PI) / 180;
        const cos = Math.cos(-rotRad);
        const sin = Math.sin(-rotRad);
        const canvasDx = (dx * cos - dy * sin) / screenScale;
        const canvasDy = (dx * sin + dy * cos) / screenScale;

        currentTransformRef.current.scale = nextScale;
        currentTransformRef.current.rotation = nextRotation;
        currentTransformRef.current.x = Math.round(pinchRef.current.initialX + canvasDx);
        currentTransformRef.current.y = Math.round(pinchRef.current.initialY + canvasDy);

        scheduleDOMTransform();
      }
    };

    const onNativeTouchEnd = (e: TouchEvent) => {
      if (pinchRef.current) {
        e.preventDefault();
        pinchRef.current = null;
        onChangeTransform({
          x: currentTransformRef.current.x,
          y: currentTransformRef.current.y,
          scale: currentTransformRef.current.scale,
          rotation: currentTransformRef.current.rotation,
        });
      }
    };

    box.addEventListener('touchstart', onNativeTouchStart, { passive: false });
    box.addEventListener('touchmove', onNativeTouchMove, { passive: false });
    box.addEventListener('touchend', onNativeTouchEnd, { passive: false });
    box.addEventListener('touchcancel', onNativeTouchEnd, { passive: false });

    return () => {
      box.removeEventListener('touchstart', onNativeTouchStart);
      box.removeEventListener('touchmove', onNativeTouchMove);
      box.removeEventListener('touchend', onNativeTouchEnd);
      box.removeEventListener('touchcancel', onNativeTouchEnd);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [canvasRotation, screenScale, scheduleDOMTransform, onChangeTransform]);

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

      {/* 2. BARRA DE CALIBRACIÓN COMPACTA NATIVA (Estilo IbisPaint X - Zero Desbordamiento) */}
      {typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-x-0 bottom-0 z-50 pointer-events-auto select-none">
          {/* Menú flotante emergente de Filtros Wasm (si está activo) */}
          {showFiltersMenu && !isMinimized && (
            <div className="px-3 pb-1.5 flex justify-center animate-in fade-in slide-in-from-bottom-2 duration-150">
              <div className="bg-[#12131bf6] border border-amber-500/50 rounded-2xl p-1.5 shadow-2xl backdrop-blur-2xl flex items-center gap-1.5 max-w-sm w-full">
                {[
                  { mode: 'original', label: 'Color', icon: '🎨' },
                  { mode: 'lineart', label: 'Lineart', icon: '✒️' },
                  { mode: 'grayscale', label: 'B/N', icon: '⬛' },
                  { mode: 'contrast', label: 'Contraste', icon: '☀️' },
                ].map((f) => (
                  <button
                    key={f.mode}
                    type="button"
                    onClick={() => {
                      onApplyFilter(f.mode as TracingFilterMode);
                      setShowFiltersMenu(false);
                    }}
                    className={`flex-1 py-1 px-1 rounded-xl text-xs font-bold flex flex-col items-center gap-0.5 transition-all active:scale-95 ${
                      tracing.filterMode === f.mode
                        ? 'bg-amber-500 text-black shadow-md'
                        : 'bg-[#1b1d28] text-gray-300 hover:text-white border border-[#2b2e40]'
                    }`}
                  >
                    <span className="text-sm">{f.icon}</span>
                    <span className="text-[10px]">{f.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {isMinimized ? (
            /* MODO PÍLDORA ULTRA COMPACTA: No tapa nada del lienzo */
            <div className="px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex justify-center animate-in fade-in slide-in-from-bottom-2 duration-150">
              <div className={`bg-[#12131bf6] border ${
                isAccessory ? 'border-pink-500/80 shadow-pink-900/30' : 'border-amber-500/80 shadow-amber-900/30'
              } rounded-full px-4 py-2 shadow-2xl backdrop-blur-2xl flex items-center justify-between gap-2.5 text-white max-w-sm w-full`}>
                <div className="flex items-center gap-2">
                  {isAccessory ? <span className="text-base">🎀</span> : <ImageIcon size={16} className="text-amber-400" />}
                  <span className={`text-xs font-bold ${isAccessory ? 'text-pink-300' : 'text-amber-300'}`}>
                    {isAccessory ? 'Accesorio' : 'Calco'}
                  </span>
                  <span className="text-[11px] font-mono font-bold bg-[#1e202c] px-2 py-0.5 rounded-full text-amber-400 border border-[#2e3143]">
                    {Math.round(tracing.opacity * 100)}%
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onChangeTransform({ visible: !tracing.visible })}
                    className={`h-8 px-2 rounded-full border text-xs font-semibold flex items-center gap-1 transition-all active:scale-90 ${
                      tracing.visible 
                        ? 'bg-[#1e202c] border-gray-700 text-amber-400' 
                        : 'bg-red-500/20 text-red-300 border-red-500/40'
                    }`}
                  >
                    {tracing.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                    <span className="text-[10px]">{tracing.visible ? 'Visible' : 'Oculto'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsMinimized(false)}
                    className="h-8 px-2.5 rounded-full bg-[#252838] text-xs font-bold flex items-center gap-1 text-gray-200 border border-[#34384d] active:scale-95"
                  >
                    <SlidersHorizontal size={13} className="text-amber-400" />
                    <span>Ajustes</span>
                    <ChevronUp size={14} />
                  </button>

                  <button
                    type="button"
                    onClick={onConfirm}
                    className="h-8 px-3 rounded-full bg-amber-500 text-black font-extrabold text-xs shadow-md active:scale-95 flex items-center gap-1"
                  >
                    <Check size={15} />
                    <span>Fijar</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* BARRA COMPACTA NATIVA ESTILO IBISPAINT (~105px) CON ZERO DESBORDAMIENTO EN 320PX-430PX */
            <div className={`bg-[#12131bf6] border-t ${
              isAccessory ? 'border-pink-500/50' : 'border-amber-500/50'
            } shadow-[0_-8px_30px_rgba(0,0,0,0.85)] backdrop-blur-2xl flex flex-col gap-1.5 text-white w-full px-2.5 pt-2 pb-[max(0.6rem,env(safe-area-inset-bottom))] animate-in slide-in-from-bottom duration-150`}>
              
              {/* FILA 1: Slider de Opacidad + Botones Icono Auxiliares (Ajuste Perfecto) */}
              <div className="flex items-center gap-1.5 max-w-md mx-auto w-full overflow-hidden">
                {/* Badge de Título y % */}
                <div className="flex items-center gap-1 bg-[#1a1c26] px-2 py-1 rounded-lg border border-[#2e3143] shrink-0">
                  <span className={`text-[11px] font-bold uppercase tracking-wider ${
                    isAccessory ? 'text-pink-300' : 'text-amber-400'
                  }`}>
                    {isAccessory ? '🎀' : '📷'}
                  </span>
                  <span className="text-xs font-mono font-black text-white">
                    {Math.round(tracing.opacity * 100)}%
                  </span>
                </div>

                {/* Slider de Opacidad Táctil Fluido */}
                <div className="flex-1 min-w-[50px] px-1 flex items-center">
                  <input
                    type="range"
                    min="5"
                    max="100"
                    value={Math.round(tracing.opacity * 100)}
                    onChange={(e) => onChangeTransform({ opacity: Number(e.target.value) / 100 })}
                    className="w-full accent-amber-500 h-2 bg-[#202230] rounded-lg cursor-pointer"
                  />
                </div>

                {/* Botón Visibilidad Instantánea (Visible vs Oculto) */}
                <button
                  type="button"
                  onClick={() => onChangeTransform({ visible: !tracing.visible })}
                  className={`w-8 h-8 rounded-xl border flex items-center justify-center transition-all active:scale-95 shrink-0 ${
                    tracing.visible 
                      ? 'bg-[#1c1e2a] border-amber-500/50 text-amber-300 shadow-sm' 
                      : 'bg-red-500/20 text-red-300 border-red-500/40'
                  }`}
                  title={tracing.visible ? 'Ocultar foto temporalmente' : 'Mostrar foto de calco'}
                >
                  {tracing.visible ? <Eye size={15} className="text-amber-400" /> : <EyeOff size={15} />}
                </button>

                {/* Botón Centrar */}
                <button
                  type="button"
                  onClick={onCenterImage}
                  className="w-8 h-8 rounded-xl bg-[#1c1e2a] hover:bg-[#252837] text-gray-300 border border-[#2e3143] flex items-center justify-center transition-colors active:scale-95 shrink-0"
                  title="Centrar en el lienzo"
                >
                  <RotateCcw size={14} />
                </button>

                {/* Botón Filtros Wasm */}
                <button
                  type="button"
                  onClick={() => setShowFiltersMenu(!showFiltersMenu)}
                  className={`w-8 h-8 rounded-xl border flex items-center justify-center transition-colors active:scale-95 shrink-0 ${
                    showFiltersMenu || tracing.filterMode !== 'original'
                      ? 'bg-amber-500 text-black border-amber-400 font-bold'
                      : 'bg-[#1c1e2a] hover:bg-[#252837] text-gray-300 border-[#2e3143]'
                  }`}
                  title="Filtros inteligentes Wasm"
                >
                  <Sparkles size={14} />
                </button>

                {/* Minimizar */}
                <button
                  type="button"
                  onClick={() => setIsMinimized(true)}
                  className="w-8 h-8 rounded-xl bg-[#1c1e2a] hover:bg-[#252837] text-gray-300 border border-[#2e3143] flex items-center justify-center transition-colors active:scale-95 shrink-0"
                  title="Minimizar barra para ver todo el lienzo"
                >
                  <ChevronDown size={16} />
                </button>
              </div>

              {/* FILA 2: Acciones Principales en la Zona del Pulgar (100% Accesible sin Recorte) */}
              <div className="flex items-center gap-1.5 max-w-md mx-auto w-full pt-0.5">
                {/* Descartar: Botón icono compacto con acento rojo para no quitar espacio */}
                <button
                  type="button"
                  onClick={onCancel}
                  className="h-10 w-10 min-w-[38px] rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 flex items-center justify-center active:scale-95 transition-all shrink-0"
                  title="Eliminar foto de calco"
                  aria-label="Descartar calco"
                >
                  <X size={18} />
                </button>

                {/* Restablecer Rotación a 0° */}
                <button
                  type="button"
                  onClick={() => onChangeTransform({ rotation: 0 })}
                  className="h-10 px-2 min-w-[36px] rounded-xl bg-[#181a24] text-[11px] font-semibold text-gray-300 border border-[#2b2d3d] flex items-center justify-center gap-0.5 active:scale-95 transition-all shrink-0"
                  title="Enderezar rotación a 0°"
                >
                  <RotateCw size={12} className="text-amber-400" />
                  <span>0°</span>
                </button>

                {/* Restablecer Escala 100% */}
                <button
                  type="button"
                  onClick={() => onChangeTransform({ scale: 1.0 })}
                  className="h-10 px-2 min-w-[40px] rounded-xl bg-[#181a24] text-[11px] font-semibold text-gray-300 border border-[#2b2d3d] flex items-center justify-center gap-0.5 active:scale-95 transition-all shrink-0"
                  title="Escala 100%"
                >
                  <Maximize2 size={12} className="text-amber-400" />
                  <span>100%</span>
                </button>

                {/* Acciones principales según tipo de calco o accesorio */}
                {isAccessory ? (
                  <>
                    <button
                      type="button"
                      onClick={onStampAsNewLayer}
                      className="h-10 px-2.5 bg-[#202332] text-pink-300 border border-pink-500/40 rounded-xl font-bold text-xs flex items-center justify-center gap-1 active:scale-95 transition-all shrink-0"
                      title="Crear capa dedicada con este accesorio"
                    >
                      <Layers size={13} />
                      <span>+ Capa</span>
                    </button>
                    <button
                      type="button"
                      onClick={onStampToActiveLayer}
                      className="flex-1 min-w-[90px] h-10 bg-gradient-to-r from-pink-500 to-rose-600 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1 shadow-lg active:scale-95 transition-all"
                    >
                      <Sparkles size={14} />
                      <span>Estampar</span>
                    </button>
                  </>
                ) : (
                  <>
                    {/* Botón secundario estampar si aplica */}
                    {onStampToActiveLayer && (
                      <button
                        type="button"
                        onClick={onStampToActiveLayer}
                        className="h-10 px-2.5 min-w-[38px] rounded-xl bg-[#1c1e2a] hover:bg-[#252838] text-amber-300 border border-amber-500/40 font-semibold text-xs flex items-center justify-center gap-1 active:scale-95 transition-all shrink-0"
                        title="Estampar como trazo permanente en la capa activa"
                        aria-label="Estampar trazo permanente"
                      >
                        <Sparkles size={14} />
                        <span className="hidden sm:inline">Estampar</span>
                      </button>
                    )}

                    {/* BOTÓN PRINCIPAL: SIEMPRE VISIBLE, EXPANDIBLE Y ACCESIBLE */}
                    <button
                      type="button"
                      onClick={onConfirm}
                      className="flex-1 min-w-[105px] h-10 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:brightness-110 text-black rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/25 active:scale-95 transition-all"
                    >
                      <Check size={16} className="stroke-[3]" />
                      <span>Fijar Calco</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  );
};

