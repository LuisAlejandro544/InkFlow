/**
 * @file TracingMinimizedPill.tsx
 * @description Píldora ultra compacta flotante para despejar el 100% del lienzo mientras se calca.
 */

import React from 'react';
import { Image as ImageIcon, Eye, EyeOff, SlidersHorizontal, ChevronUp, Check } from 'lucide-react';
import { TracingReference } from '../../engine/types';

interface TracingMinimizedPillProps {
  tracing: TracingReference;
  isAccessory: boolean;
  onToggleVisibility: () => void;
  onExpand: () => void;
  onConfirm: () => void;
}

export const TracingMinimizedPill: React.FC<TracingMinimizedPillProps> = ({
  tracing,
  isAccessory,
  onToggleVisibility,
  onExpand,
  onConfirm,
}) => {
  return (
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
            onClick={onToggleVisibility}
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
            onClick={onExpand}
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
  );
};
