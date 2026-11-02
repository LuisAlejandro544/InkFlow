/**
 * @file BucketSettingsCard.tsx
 * @description Subcomponente modular para la configuración avanzada del Bote de Pintura.
 * 
 * Gestiona:
 * - Selección de Expansión de Borde (0px exacto, 1px fino, 2px recomendado, 3px máximo) para eliminar rebordes blancos.
 * - Deslizador táctil de tolerancia de color (1 a 100).
 */

import React from 'react';
import { PaintBucket, ShieldCheck } from 'lucide-react';

export interface BucketSettingsCardProps {
  bucketExpansion: number;
  onChangeBucketExpansion?: (expansion: number) => void;
  bucketTolerance: number;
  onChangeBucketTolerance?: (tolerance: number) => void;
  bucketGapClosing?: number;
  onChangeBucketGapClosing?: (gap: number) => void;
  triggerHaptic: (ms?: number) => void;
}

const EXPANSION_OPTIONS = [
  { px: 0, label: '0px', desc: 'Exacto' },
  { px: 1, label: '1px', desc: 'Fino' },
  { px: 2, label: '2px', desc: 'Recomendado' },
  { px: 3, label: '3px', desc: 'Máximo' },
];

const GAP_OPTIONS = [
  { px: 0, label: '0px', desc: 'Off' },
  { px: 3, label: '3px', desc: 'Fino' },
  { px: 6, label: '6px', desc: 'Medio' },
  { px: 10, label: '10px', desc: 'Amplio' },
];

export const BucketSettingsCard: React.FC<BucketSettingsCardProps> = ({
  bucketExpansion,
  onChangeBucketExpansion,
  bucketTolerance,
  onChangeBucketTolerance,
  bucketGapClosing = 3,
  onChangeBucketGapClosing,
  triggerHaptic,
}) => {
  return (
    <div className="mt-2.5 p-3.5 rounded-2xl bg-[#141620] border border-indigo-500/40 flex flex-col gap-3 shadow-lg shrink-0">
      {/* 1. Expansión de Borde */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
            <PaintBucket size={15} />
            Expansión de Borde (Anti-Halos)
          </span>
          <span className="text-[10px] text-amber-400 font-mono font-bold">
            {bucketExpansion} px
          </span>
        </div>
        <p className="text-[10px] text-gray-400 leading-tight mb-2">
          Dilata el color hacia el interior de las líneas para eliminar rebordes blancos.
        </p>
        <div className="grid grid-cols-4 gap-1.5">
          {EXPANSION_OPTIONS.map((item) => (
            <button
              key={item.px}
              type="button"
              onClick={() => {
                triggerHaptic(8);
                onChangeBucketExpansion?.(item.px);
              }}
              className={`py-2 px-1 rounded-xl text-center flex flex-col items-center justify-center transition-all ${
                bucketExpansion === item.px
                  ? 'bg-amber-500 text-black font-bold shadow-md'
                  : 'bg-[#1e202e] text-gray-300 hover:text-white border border-[#2d3042] active:scale-95'
              }`}
            >
              <span className="text-xs font-bold font-mono">{item.label}</span>
              <span className="text-[8px] opacity-80">{item.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 2. Cierre Inteligente de Huecos (Gap-Closing) */}
      <div className="pt-2 border-t border-[#232635]">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
            <ShieldCheck size={15} />
            Cierre de Huecos (Gap-Closing)
          </span>
          <span className="text-[10px] text-emerald-400 font-mono font-bold">
            {bucketGapClosing > 0 ? `${bucketGapClosing} px` : 'Desactivado'}
          </span>
        </div>
        <p className="text-[10px] text-gray-400 leading-tight mb-2">
          Cierra automáticamente aberturas de hasta {bucketGapClosing} px en el lineart para evitar que la pintura se desborde fuera del dibujo.
        </p>
        <div className="grid grid-cols-4 gap-1.5">
          {GAP_OPTIONS.map((item) => (
            <button
              key={item.px}
              type="button"
              onClick={() => {
                triggerHaptic(8);
                onChangeBucketGapClosing?.(item.px);
              }}
              className={`py-2 px-1 rounded-xl text-center flex flex-col items-center justify-center transition-all ${
                bucketGapClosing === item.px
                  ? 'bg-emerald-500 text-black font-bold shadow-md'
                  : 'bg-[#1e202e] text-gray-300 hover:text-white border border-[#2d3042] active:scale-95'
              }`}
            >
              <span className="text-xs font-bold font-mono">{item.label}</span>
              <span className="text-[8px] opacity-80">{item.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 3. Deslizador de Tolerancia de Color */}
      <div className="flex items-center gap-2 pt-2 border-t border-[#232635]">
        <span className="text-[10px] text-gray-400 font-bold shrink-0">Tolerancia:</span>
        <input
          type="range"
          min="1"
          max="100"
          value={bucketTolerance}
          onChange={(e) => onChangeBucketTolerance?.(Number(e.target.value))}
          className="flex-1 accent-indigo-400 h-1.5 bg-[#1f212c] rounded-lg cursor-pointer"
        />
        <span className="text-[10px] font-mono font-bold text-indigo-300 w-8 text-right shrink-0">
          {bucketTolerance}
        </span>
      </div>
    </div>
  );
};
