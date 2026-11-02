/**
 * @file StabilizerScratchpad.tsx
 * @description Subcomponente modular para la calibración del Estabilizador S-Form estilo IbisPaint.
 * 
 * Contiene:
 * - Tarjeta informativa con descripción dinámica según el nivel de amortiguación.
 * - Deslizador táctil de precisión de 0 a 10 con feedback háptico.
 * - Presets directos (0: Directo, 3: Natural, 6: Ilustración, 10: Manga).
 * - Bloc táctil de pruebas en vivo con cuadrícula técnica y motor wasmEngine.stabilizePoint.
 */

import React, { useRef, useState, useEffect } from 'react';
import { Sparkles, RotateCcw } from 'lucide-react';
import { wasmEngine } from '../../engine/wasmEngine';

export interface StabilizerScratchpadProps {
  stabilizerLevel: number;
  onChangeStabilizer: (level: number) => void;
  triggerHaptic: (ms?: number) => void;
}

const PRESETS = [
  { lvl: 0, label: '0: Directo' },
  { lvl: 3, label: '3: Natural' },
  { lvl: 6, label: '6: Ilustración' },
  { lvl: 10, label: '10: Manga' },
];

export const StabilizerScratchpad: React.FC<StabilizerScratchpadProps> = ({
  stabilizerLevel,
  onChangeStabilizer,
  triggerHaptic,
}) => {
  const scratchpadRef = useRef<HTMLCanvasElement | null>(null);
  const [isScratching, setIsScratching] = useState(false);
  const lastPointRef = useRef<{ x: number; y: number; pressure: number } | null>(null);

  const getStabilizerDescription = (level: number) => {
    if (level === 0) return 'Trazo directo sin amortiguación (reacción táctil inmediata).';
    if (level <= 3) return 'Suavizado natural para bocetos fluidos y escritura cómoda.';
    if (level <= 7) return 'Amortiguación alta para ilustración limpia y arcos firmes.';
    return 'Máxima firmeza estilo manga (elimina cualquier temblor del dedo).';
  };

  const clearScratchpad = () => {
    const cvs = scratchpadRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#0d0e14';
    ctx.fillRect(0, 0, cvs.width, cvs.height);
    
    // Cuadrícula sutil estilo papel técnico
    ctx.strokeStyle = '#1b1d28';
    ctx.lineWidth = 1;
    for (let x = 20; x < cvs.width; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, cvs.height);
      ctx.stroke();
    }
    for (let y = 20; y < cvs.height; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(cvs.width, y);
      ctx.stroke();
    }

    // Texto guía
    ctx.fillStyle = '#6b7280';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Traza aquí con el dedo para sentir la firmeza del filtro', cvs.width / 2, cvs.height / 2 + 4);
  };

  useEffect(() => {
    const timer = setTimeout(clearScratchpad, 50);
    return () => clearTimeout(timer);
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const cvs = scratchpadRef.current;
    if (!cvs) return;
    const rect = cvs.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (cvs.width / rect.width);
    const y = (e.clientY - rect.top) * (cvs.height / rect.height);
    
    setIsScratching(true);
    lastPointRef.current = { x, y, pressure: e.pressure > 0.01 ? e.pressure : 0.6 };

    const ctx = cvs.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#f59e0b';
      ctx.fill();
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isScratching || !lastPointRef.current) return;
    const cvs = scratchpadRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    if (!ctx) return;

    const rect = cvs.getBoundingClientRect();
    const rawX = (e.clientX - rect.left) * (cvs.width / rect.width);
    const rawY = (e.clientY - rect.top) * (cvs.height / rect.height);
    const rawPoint = { x: rawX, y: rawY, pressure: e.pressure > 0.01 ? e.pressure : 0.6 };

    const smoothed = wasmEngine.stabilizePoint(rawPoint, lastPointRef.current, stabilizerLevel);

    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = Math.max(1.5, 6 * smoothed.pressure);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(smoothed.x, smoothed.y);
    ctx.stroke();

    lastPointRef.current = smoothed;
  };

  const handlePointerUp = () => {
    setIsScratching(false);
    lastPointRef.current = null;
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3.5">
      {/* Tarjeta de Nivel Activo */}
      <div className="p-3.5 rounded-2xl bg-[#161720] border border-[#232532] flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <Sparkles size={16} className="text-amber-400" />
            <span className="text-sm font-bold text-gray-100">Amortiguación S-Form</span>
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {getStabilizerDescription(stabilizerLevel)}
          </p>
        </div>
        <div className="text-right shrink-0">
          <span className="font-mono text-base font-bold text-amber-400 bg-amber-500/20 px-3 py-1 rounded-xl border border-amber-500/40">
            Nivel {stabilizerLevel}
          </span>
        </div>
      </div>

      {/* Slider de Alta Precisión */}
      <div className="p-3 rounded-2xl bg-[#161720] border border-[#232532] space-y-2">
        <div className="flex justify-between text-[11px] font-semibold text-gray-400">
          <span>0 (Sin Filtro)</span>
          <span className="text-amber-400 font-mono font-bold">{stabilizerLevel} / 10</span>
          <span>10 (Máxima Firmeza)</span>
        </div>

        <input
          type="range"
          min="0"
          max="10"
          value={stabilizerLevel}
          onChange={(e) => {
            triggerHaptic(6);
            onChangeStabilizer(Number(e.target.value));
          }}
          className="w-full accent-amber-500 h-3 bg-[#0d0e14] rounded-lg cursor-pointer"
        />

        {/* Botones de Preset Rápido */}
        <div className="grid grid-cols-4 gap-1.5 pt-1">
          {PRESETS.map((p) => (
            <button
              key={p.lvl}
              type="button"
              onClick={() => {
                triggerHaptic(8);
                onChangeStabilizer(p.lvl);
              }}
              className={`text-[10px] py-1.5 rounded-xl font-mono font-bold transition-all ${
                stabilizerLevel === p.lvl
                  ? 'bg-amber-500 text-black shadow-md'
                  : 'bg-[#0f1016] text-gray-400 hover:text-white border border-[#20222f]'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bloc Táctil de Pruebas */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-gray-300 px-1">
          <span className="font-semibold text-gray-400">Bloc de Prueba en Vivo:</span>
          <button
            type="button"
            onClick={clearScratchpad}
            className="flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 font-medium bg-[#1e202b] px-2 py-0.5 rounded-lg border border-[#2d3040]"
          >
            <RotateCcw size={11} />
            <span>Limpiar</span>
          </button>
        </div>

        <div className="relative rounded-2xl overflow-hidden border border-[#262835] bg-[#0c0d12]">
          <canvas
            ref={scratchpadRef}
            width={400}
            height={100}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            className="w-full h-[100px] touch-none cursor-crosshair block"
          />
        </div>
      </div>
    </div>
  );
};
