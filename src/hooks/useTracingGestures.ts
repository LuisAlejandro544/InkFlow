/**
 * @file useTracingGestures.ts
 * @description Hook especializado en interacción táctil para fotos de calco y stickers/accesorios.
 * 
 * Gestiona:
 * - Movimiento con 1 dedo con compensación de rotación del lienzo.
 * - Escalado isotrópico desde tiradores de esquina basado en distancia al centro.
 * - Gestos multitáctiles con 2 dedos (Pinch-to-zoom, rotación libre y paneo simultáneo).
 * - Aceleración por GPU mediante requestAnimationFrame (`translate3d`, `rotate`, `scale`).
 * - Un único commit al estado React al levantar los dedos.
 */

import { useRef, useEffect, useCallback } from 'react';
import { TracingReference } from '../engine/types';

interface UseTracingGesturesProps {
  tracing: TracingReference;
  screenScale: number;
  canvasRotation: number;
  onChangeTransform: (update: Partial<TracingReference>) => void;
}

export function useTracingGestures({
  tracing,
  screenScale,
  canvasRotation,
  onChangeTransform,
}: UseTracingGesturesProps) {
  const boxRef = useRef<HTMLDivElement | null>(null);

  const currentTransformRef = useRef({
    x: tracing.x,
    y: tracing.y,
    scale: tracing.scale,
    rotation: tracing.rotation,
  });

  const rafIdRef = useRef<number | null>(null);

  const dragRef = useRef<{
    type: 'move' | 'corner' | 'rotate';
    corner?: 'tl' | 'tr' | 'bl' | 'br';
    startX: number;
    startY: number;
    startClientX: number;
    startClientY: number;
    startScale: number;
    startRotation: number;
    startAngle: number;
    centerX: number;
    centerY: number;
    startDist: number;
  } | null>(null);

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

  const scheduleDOMTransform = useCallback(() => {
    if (rafIdRef.current !== null) return;
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      if (!boxRef.current) return;
      const { x, y, scale, rotation } = currentTransformRef.current;
      boxRef.current.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) rotate(${rotation}rad) scale(${scale})`;
      
      const counterFactor = Math.min(6.0, Math.max(0.6, 1 / (screenScale * scale)));
      boxRef.current.style.setProperty('--counter-scale', String(counterFactor));
    });
  }, [screenScale]);

  // Sincronizar transformación cuando cambian las props
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

  const onGlobalPointerMove = useCallback((e: PointerEvent) => {
    if (!dragRef.current) return;
    e.preventDefault();

    if (dragRef.current.type === 'move') {
      const dx = e.clientX - dragRef.current.startClientX;
      const dy = e.clientY - dragRef.current.startClientY;

      const rotRad = (canvasRotation * Math.PI) / 180;
      const cos = Math.cos(-rotRad);
      const sin = Math.sin(-rotRad);
      const canvasDx = (dx * cos - dy * sin) / screenScale;
      const canvasDy = (dx * sin + dy * cos) / screenScale;

      currentTransformRef.current.x = Math.round(dragRef.current.startX + canvasDx);
      currentTransformRef.current.y = Math.round(dragRef.current.startY + canvasDy);
      scheduleDOMTransform();
    } else if (dragRef.current.type === 'corner') {
      const currentDist = Math.hypot(
        e.clientX - dragRef.current.centerX,
        e.clientY - dragRef.current.centerY
      );
      const scaleMultiplier = currentDist / Math.max(10, dragRef.current.startDist);
      const nextScale = Math.max(0.08, Math.min(8.0, Number((dragRef.current.startScale * scaleMultiplier).toFixed(3))));
      
      currentTransformRef.current.scale = nextScale;
      scheduleDOMTransform();
    } else if (dragRef.current.type === 'rotate') {
      // Rotación angular suave con 1 dedo alrededor del centro de la imagen
      const currentAngle = Math.atan2(
        e.clientY - dragRef.current.centerY,
        e.clientX - dragRef.current.centerX
      );
      const deltaAngle = currentAngle - dragRef.current.startAngle;
      let nextRot = dragRef.current.startRotation + deltaAngle;

      // Snapping magnético inteligente en ángulos ortogonales cardinales (0°, 90°, 180°, 270°) si está cerca de ±3.5°
      const deg = ((nextRot * 180 / Math.PI) % 360 + 360) % 360;
      const snapThreshold = 3.5;
      if (Math.abs(deg - 0) < snapThreshold || Math.abs(deg - 360) < snapThreshold) {
        nextRot = Math.round(nextRot / (2 * Math.PI)) * 2 * Math.PI;
      } else if (Math.abs(deg - 90) < snapThreshold) {
        nextRot = Math.round((nextRot - Math.PI / 2) / (2 * Math.PI)) * 2 * Math.PI + Math.PI / 2;
      } else if (Math.abs(deg - 180) < snapThreshold) {
        nextRot = Math.round((nextRot - Math.PI) / (2 * Math.PI)) * 2 * Math.PI + Math.PI;
      } else if (Math.abs(deg - 270) < snapThreshold) {
        nextRot = Math.round((nextRot - (3 * Math.PI) / 2) / (2 * Math.PI)) * 2 * Math.PI + (3 * Math.PI) / 2;
      }

      currentTransformRef.current.rotation = Number(nextRot.toFixed(3));
      scheduleDOMTransform();
    }
  }, [canvasRotation, screenScale, scheduleDOMTransform]);

  const onGlobalPointerUp = useCallback((e: PointerEvent) => {
    if (!dragRef.current) return;
    e.preventDefault();
    const dragType = dragRef.current.type;
    dragRef.current = null;

    window.removeEventListener('pointermove', onGlobalPointerMove);
    window.removeEventListener('pointerup', onGlobalPointerUp);
    window.removeEventListener('pointercancel', onGlobalPointerUp);

    if (dragType === 'corner') {
      onChangeTransform({ scale: currentTransformRef.current.scale });
    } else if (dragType === 'rotate') {
      onChangeTransform({ rotation: currentTransformRef.current.rotation });
    } else {
      onChangeTransform({
        x: currentTransformRef.current.x,
        y: currentTransformRef.current.y,
      });
    }
  }, [onGlobalPointerMove, onChangeTransform]);

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
      startRotation: currentTransformRef.current.rotation,
      startAngle: 0,
      centerX: 0,
      centerY: 0,
      startDist: 0,
    };

    window.addEventListener('pointermove', onGlobalPointerMove, { passive: false });
    window.addEventListener('pointerup', onGlobalPointerUp);
    window.addEventListener('pointercancel', onGlobalPointerUp);
  };

  const handlePointerDownCorner = (e: React.PointerEvent<HTMLDivElement>, corner: 'tl' | 'tr' | 'bl' | 'br') => {
    e.preventDefault();
    e.stopPropagation();

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
      startRotation: currentTransformRef.current.rotation,
      startAngle: 0,
      centerX,
      centerY,
      startDist: Math.max(10, startDist),
    };

    window.addEventListener('pointermove', onGlobalPointerMove, { passive: false });
    window.addEventListener('pointerup', onGlobalPointerUp);
    window.addEventListener('pointercancel', onGlobalPointerUp);
  };

  const handlePointerDownRotate = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const rect = boxRef.current ? boxRef.current.getBoundingClientRect() : null;
    const centerX = rect ? rect.left + rect.width / 2 : e.clientX;
    const centerY = rect ? rect.top + rect.height / 2 : e.clientY;
    // Ángulo inicial desde el centro hasta el tirador superior tocado
    const startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);

    dragRef.current = {
      type: 'rotate',
      startX: currentTransformRef.current.x,
      startY: currentTransformRef.current.y,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startScale: currentTransformRef.current.scale,
      startRotation: currentTransformRef.current.rotation,
      startAngle,
      centerX,
      centerY,
      startDist: 0,
    };

    window.addEventListener('pointermove', onGlobalPointerMove, { passive: false });
    window.addEventListener('pointerup', onGlobalPointerUp);
    window.addEventListener('pointercancel', onGlobalPointerUp);
  };

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

  return {
    boxRef,
    handlePointerDownMove,
    handlePointerDownCorner,
    handlePointerDownRotate,
  };
}
