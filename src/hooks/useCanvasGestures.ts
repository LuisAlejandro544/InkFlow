/**
 * @file useCanvasGestures.ts
 * @description Hook especializado en navegación táctil y espacial del lienzo (Pinch, Paneo, Rotación libre y Snapping).
 * 
 * Gestiona:
 * - Escala (0.15x a 8.0x) con anclaje al punto focal.
 * - Paneo continuo en coordenadas de pantalla.
 * - Rotación libre a 2 dedos con encaje magnético (*angle snapping*) en 0°, 90°, 180° y 270°.
 * - Aplicación directa mediante CSS transform por hardware en GPU a 120 FPS sin re-renders en rAF.
 * - HUD flotante de porcentaje y ángulo.
 * - Atajos rápidos: Ajustar a pantalla vs 100%, y reseteo de rotación a 0°.
 */

import { useRef, useState, useEffect, useCallback } from 'react';
import { 
  calculateFocalZoomPan, 
  calculateWheelZoom, 
  calculateTouchRotation, 
  snapRotationDegrees 
} from '../engine/transformMath';
import { TracingReference } from '../engine/types';

interface UseCanvasGesturesProps {
  projectWidth: number;
  projectHeight: number;
  tracingRef: TracingReference | null;
  canUndo: boolean;
  onUndo: () => void;
  triggerHaptic: (duration?: number) => void;
}

export function useCanvasGestures({
  projectWidth,
  projectHeight,
  tracingRef,
  canUndo,
  onUndo,
  triggerHaptic,
}: UseCanvasGesturesProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasWrapperRef = useRef<HTMLDivElement | null>(null);
  const zoomHudRef = useRef<HTMLDivElement | null>(null);

  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);

  const scaleRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const rotationRef = useRef(0);

  const touchPinchRef = useRef<{
    initialDist: number;
    initialScale: number;
    initialPan: { x: number; y: number };
    initialCenter: { x: number; y: number };
    initialRotation: number;
    t0Initial: { x: number; y: number };
    t1Initial: { x: number; y: number };
    startTime: number;
    hasMoved: boolean;
    active: boolean;
  } | null>(null);

  const suppressDrawingRef = useRef<boolean>(false);
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  useEffect(() => {
    rotationRef.current = rotation;
  }, [rotation]);

  const applyTransformDirect = (newScale: number, newPan: { x: number; y: number }, newRot = rotationRef.current) => {
    if (canvasWrapperRef.current) {
      canvasWrapperRef.current.style.transform = `translate3d(${newPan.x}px, ${newPan.y}px, 0) scale(${newScale}) rotate(${newRot}deg)`;
    }
  };

  const updateZoomHUD = (newScale: number, newRot = rotationRef.current, show = true) => {
    if (zoomHudRef.current) {
      const roundedRot = Math.round(newRot);
      const rotText = roundedRot !== 0 ? ` • ${roundedRot}°` : '';
      zoomHudRef.current.textContent = `${Math.round(newScale * 100)}%${rotText}`;
      if (show) {
        zoomHudRef.current.style.opacity = '1';
        zoomHudRef.current.style.pointerEvents = 'none';
      }
    }
  };

  const fitToScreen = useCallback((withHaptic = false) => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const padding = 24;
    const availW = container.clientWidth - padding * 2;
    const availH = container.clientHeight - padding * 2;

    const scaleW = availW / projectWidth;
    const scaleH = availH / projectHeight;
    const newScale = Number(Math.min(scaleW, scaleH, 1.0).toFixed(2));
    const newPan = { x: 0, y: 0 };

    setScale(newScale);
    setPan(newPan);
    setRotation(0);
    rotationRef.current = 0;
    applyTransformDirect(newScale, newPan, 0);
    updateZoomHUD(newScale, 0, false);
    if (withHaptic) {
      triggerHaptic(8);
    }
  }, [projectWidth, projectHeight, triggerHaptic]);

  useEffect(() => {
    fitToScreen(false);
    const onResize = () => fitToScreen(false);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [fitToScreen]);

  const toggleFitOr100 = () => {
    triggerHaptic(12);
    if (Math.abs(rotation) > 0.5 || Math.abs(scale - 1.0) < 0.05) {
      fitToScreen(true);
    } else {
      setScale(1.0);
      setPan({ x: 0, y: 0 });
      setRotation(0);
      rotationRef.current = 0;
      applyTransformDirect(1.0, { x: 0, y: 0 }, 0);
      updateZoomHUD(1.0, 0, true);
      setTimeout(() => {
        if (zoomHudRef.current) zoomHudRef.current.style.opacity = '0';
      }, 1000);
    }
  };

  const resetRotation = () => {
    triggerHaptic(10);
    setRotation(0);
    rotationRef.current = 0;
    applyTransformDirect(scaleRef.current, panRef.current, 0);
    updateZoomHUD(scaleRef.current, 0, true);
    setTimeout(() => {
      if (zoomHudRef.current) zoomHudRef.current.style.opacity = '0';
    }, 1000);
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const focalPoint = {
      x: e.clientX - rect.left - rect.width / 2,
      y: e.clientY - rect.top - rect.height / 2,
    };
    const factor = e.deltaY < 0 ? 1.15 : 0.85;

    const result = calculateWheelZoom(
      focalPoint,
      scaleRef.current,
      panRef.current,
      factor,
      0.15,
      8.0
    );

    scaleRef.current = result.scale;
    panRef.current = result.pan;
    setScale(result.scale);
    setPan(result.pan);
    applyTransformDirect(result.scale, result.pan);
    updateZoomHUD(result.scale, rotationRef.current, true);

    setTimeout(() => {
      if (zoomHudRef.current) zoomHudRef.current.style.opacity = '0';
    }, 1000);
  };

  // Suscripción a eventos táctiles de 2 dedos (Pinch / Rotate / Pan)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onNativeTouchStart = (e: TouchEvent) => {
      if (tracingRef && tracingRef.isAdjusting) {
        return;
      }

      if (e.touches.length === 2) {
        suppressDrawingRef.current = true;

        const t0 = e.touches[0];
        const t1 = e.touches[1];
        const rect = container.getBoundingClientRect();

        const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
        const centerX = (t0.clientX + t1.clientX) / 2 - rect.left - rect.width / 2;
        const centerY = (t0.clientY + t1.clientY) / 2 - rect.top - rect.height / 2;

        touchPinchRef.current = {
          initialDist: Math.max(10, dist),
          initialScale: scaleRef.current,
          initialPan: { ...panRef.current },
          initialCenter: { x: centerX, y: centerY },
          initialRotation: rotationRef.current,
          t0Initial: { x: t0.clientX, y: t0.clientY },
          t1Initial: { x: t1.clientX, y: t1.clientY },
          startTime: performance.now(),
          hasMoved: false,
          active: true,
        };
      } else if (e.touches.length === 3) {
        suppressDrawingRef.current = true;
      }
    };

    const onNativeTouchMove = (e: TouchEvent) => {
      if (tracingRef && tracingRef.isAdjusting) {
        return;
      }

      if (e.cancelable) {
        e.preventDefault();
      }

      if (touchPinchRef.current && touchPinchRef.current.active && e.touches.length === 2) {
        const t0 = e.touches[0];
        const t1 = e.touches[1];
        const rect = container.getBoundingClientRect();

        const currentDist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
        const currentCenterX = (t0.clientX + t1.clientX) / 2 - rect.left - rect.width / 2;
        const currentCenterY = (t0.clientY + t1.clientY) / 2 - rect.top - rect.height / 2;

        const rawRot = calculateTouchRotation(
          touchPinchRef.current.t0Initial,
          touchPinchRef.current.t1Initial,
          { x: t0.clientX, y: t0.clientY },
          { x: t1.clientX, y: t1.clientY },
          touchPinchRef.current.initialRotation
        );

        const currentFocal = { x: currentCenterX, y: currentCenterY };
        const { scale: targetScale, pan: targetPan } = calculateFocalZoomPan(
          touchPinchRef.current.initialCenter,
          currentFocal,
          touchPinchRef.current.initialDist,
          currentDist,
          touchPinchRef.current.initialScale,
          touchPinchRef.current.initialPan,
          0.15,
          8.0
        );

        const targetRot = snapRotationDegrees(rawRot, 3.5);

        scaleRef.current = targetScale;
        panRef.current = targetPan;
        rotationRef.current = targetRot;

        if (
          Math.abs(currentDist - touchPinchRef.current.initialDist) > 8 || 
          Math.abs(rawRot - touchPinchRef.current.initialRotation) > 2.5
        ) {
          touchPinchRef.current.hasMoved = true;
        }

        if (rafIdRef.current === null) {
          rafIdRef.current = requestAnimationFrame(() => {
            applyTransformDirect(scaleRef.current, panRef.current, rotationRef.current);
            updateZoomHUD(scaleRef.current, rotationRef.current, true);
            rafIdRef.current = null;
          });
        }
      }
    };

    const onNativeTouchEnd = (e: TouchEvent) => {
      if (touchPinchRef.current && touchPinchRef.current.active) {
        const wasQuickDoubleTap = 
          !touchPinchRef.current.hasMoved && 
          performance.now() - touchPinchRef.current.startTime < 320;

        if (wasQuickDoubleTap && canUndo) {
          triggerHaptic(15);
          onUndo();
        }

        touchPinchRef.current = null;
        setScale(scaleRef.current);
        setPan({ ...panRef.current });
        setRotation(rotationRef.current);

        setTimeout(() => {
          if (zoomHudRef.current) {
            zoomHudRef.current.style.opacity = '0';
          }
        }, 1200);
      }

      if (e.touches.length === 0) {
        setTimeout(() => {
          suppressDrawingRef.current = false;
        }, 80);
      }
    };

    container.addEventListener('touchstart', onNativeTouchStart, { passive: false });
    container.addEventListener('touchmove', onNativeTouchMove, { passive: false });
    container.addEventListener('touchend', onNativeTouchEnd, { passive: true });
    container.addEventListener('touchcancel', onNativeTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', onNativeTouchStart);
      container.removeEventListener('touchmove', onNativeTouchMove);
      container.removeEventListener('touchend', onNativeTouchEnd);
      container.removeEventListener('touchcancel', onNativeTouchEnd);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [canUndo, onUndo, tracingRef, triggerHaptic]);

  return {
    scale,
    pan,
    rotation,
    scaleRef,
    panRef,
    rotationRef,
    containerRef,
    canvasWrapperRef,
    zoomHudRef,
    suppressDrawingRef,
    applyTransformDirect,
    updateZoomHUD,
    fitToScreen,
    toggleFitOr100,
    resetRotation,
    handleWheel,
    setPan,
  };
}
