/**
 * @file StrokeGuideAssistant.tsx
 * @description Componente visual del Asistente de Grosor de Trazo.
 * Proporciona una barra ergonómica con los 4 roles de ilustración:
 * Silueta, Estructura, Detalles y Tramas.
 * 
 * Si existe una foto de referencia de calco, muestra los grosores medidos
 * REALES de la propia imagen (visión artificial) como recomendación en 1 toque,
 * sin forzar al usuario.
 */

import React from 'react';
import { Sparkles, X, Check, Image as ImageIcon, RotateCcw } from 'lucide-react';
import { 
  getCalibratedStrokeRoles, 
  detectRoleFromSize, 
  generateStrokeAdvice, 
  ImageStrokeAnalysis 
} from '../engine/strokeAssistant';

interface StrokeGuideAssistantProps {
  currentBrushSize: number;
  hasTracingPhoto: boolean;
  imageAnalysis?: ImageStrokeAnalysis | null;
  onSelectSize: (sizePx: number) => void;
  onResetToDefaults?: () => void;
  onClose: () => void;
}

export const StrokeGuideAssistant: React.FC<StrokeGuideAssistantProps> = ({
  currentBrushSize,
  hasTracingPhoto,
  imageAnalysis,
  onSelectSize,
  onClose,
}) => {
  const isCalibrated = !!(imageAnalysis && imageAnalysis.isImageCalibrated);
  const activeRoles = getCalibratedStrokeRoles(imageAnalysis || null);
  const activeRoleType = detectRoleFromSize(currentBrushSize, imageAnalysis);
  const advice = generateStrokeAdvice(currentBrushSize, hasTracingPhoto, imageAnalysis);

  return (
    <div className="bg-[#14151df5] border-t border-amber-500/35 px-3 py-2 text-white shadow-2xl backdrop-blur-md animate-fade-in flex flex-col gap-2">
      {/* Cabecera del Asistente con Indicador de Estado Real */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className={`p-1 rounded-md ${isCalibrated ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
            {isCalibrated ? <ImageIcon size={13} /> : <Sparkles size={13} />}
          </div>
          <span className={`text-[11px] font-bold uppercase tracking-wider shrink-0 ${isCalibrated ? 'text-emerald-300' : 'text-amber-300'}`}>
            {isCalibrated ? 'Calibrado por Foto' : 'Asistente de Grosor'}
          </span>
          <span className="text-[10px] text-gray-400 truncate pl-1 border-l border-gray-700">
            {advice.advice}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-2">
          {isCalibrated && (
            <span className="text-[9px] bg-emerald-950/70 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/40 font-mono">
              {imageAnalysis?.sampledEdgesCount} bordes analizados
            </span>
          )}
          <button
            onClick={onClose}
            aria-label="Cerrar asistente de grosor"
            className="p-1 rounded-lg bg-[#1f212c] hover:bg-[#282a38] text-gray-400 hover:text-white transition-colors"
            title="Ocultar asistente de grosor"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Selector de los 4 Roles con Valores Dinámicos Reales y Previsualización de Trazo */}
      <div className="grid grid-cols-4 gap-1.5">
        {activeRoles.map((role) => {
          const isSelected = activeRoleType === role.id;
          return (
            <button
              key={role.id}
              onClick={() => onSelectSize(role.recommendedPx)}
              className={`p-2 rounded-xl border flex flex-col items-center justify-between gap-1 transition-all active:scale-95 text-center ${
                isSelected
                  ? 'bg-amber-500/25 border-amber-400 text-amber-300 shadow-md ring-1 ring-amber-400/50'
                  : 'bg-[#181923] border-[#252835] text-gray-300 hover:bg-[#1f212e]'
              }`}
            >
              {/* Etiqueta y Grosor en Px */}
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-bold leading-tight">{role.shortLabel}</span>
                <span className={`text-[9px] font-mono font-bold ${role.isCalibrated ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {role.recommendedPx}px
                </span>
              </div>

              {/* Previsualización visual del ancho de línea */}
              <div className="w-full h-5 flex items-center justify-center bg-black/50 rounded-lg px-1">
                <div 
                  className={`w-full rounded-full transition-all ${
                    isSelected ? 'bg-amber-400' : role.isCalibrated ? 'bg-emerald-400/90' : 'bg-gray-400'
                  }`}
                  style={{
                    height: `${Math.min(12, Math.max(1.5, role.recommendedPx * 0.45))}px`,
                  }}
                />
              </div>

              {/* Indicador de Selección o Badge */}
              {isSelected ? (
                <div className="flex items-center gap-0.5 text-[8px] font-bold text-amber-300 bg-amber-500/30 px-1 py-0.2 rounded-full">
                  <Check size={9} />
                  <span>Activo</span>
                </div>
              ) : (
                <span className="text-[8px] text-gray-500 font-medium">
                  {role.isCalibrated ? 'Recomendado' : 'Usar'}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
