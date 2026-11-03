/**
 * @file BrushTextureModal.tsx
 * @description Diálogo modal de texturas de trazo inspirado en la ergonomía móvil nativa de referencia.
 * 
 * Presenta el catálogo de 9 texturas con previsualización gráfica individual de trazo ondeado,
 * nombres claros sin truncamiento, selección táctil inmediata con retroalimentación háptica
 * y diseño limpio con tipografía equilibrada y bordes redondeados.
 */

import React, { useEffect, useRef } from 'react';
import { Check } from 'lucide-react';
import { BrushTextureConfig, BrushTextureId } from '../engine/types';
import { 
  TEXTURE_DEFINITIONS, 
  TextureDefinition, 
  renderMiniStrokePreview 
} from '../engine/brushTextureEngine';

export interface BrushTextureModalProps {
  currentTexture: BrushTextureConfig;
  brushColor: string;
  onApplyTexture: (config: BrushTextureConfig) => void;
  onClose: () => void;
}

/**
 * Componente de tarjeta individual de textura con su canvas de muestra en vivo
 */
const TextureItemCard: React.FC<{
  def: TextureDefinition;
  isSelected: boolean;
  brushColor: string;
  onSelect: (def: TextureDefinition) => void;
}> = ({ def, isSelected, brushColor, onSelect }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (canvasRef.current) {
      renderMiniStrokePreview(
        canvasRef.current,
        def.id,
        '#1c1b20', // Tinta grafito pura para contraste de alta fidelidad igual a la referencia
        def.defaultDepth,
        def.defaultScale
      );
    }
  }, [def, brushColor]);

  return (
    <button
      type="button"
      onClick={() => onSelect(def)}
      aria-label={`Seleccionar textura ${def.name}`}
      className={`w-full flex items-center justify-between p-2.5 rounded-2xl transition-all duration-150 active:scale-[0.98] ${
        isSelected
          ? 'bg-[#1e1b4b]/60 border-2 border-[#a855f7] shadow-md shadow-purple-950/40'
          : 'bg-[#21262d]/70 hover:bg-[#21262d] border-2 border-[#30363d]/40'
      }`}
    >
      <div className="flex items-center gap-3.5 min-w-0">
        {/* Recuadro de papel físico de prueba con la muestra del trazo ondeado */}
        <div className="w-28 sm:w-32 h-10 rounded-lg bg-white border border-[#30363d] overflow-hidden flex items-center justify-center shadow-xs shrink-0">
          <canvas
            ref={canvasRef}
            width={128}
            height={40}
            className="w-full h-full block"
          />
        </div>

        {/* Nombre de la textura */}
        <span className={`text-[15px] tracking-wide truncate ${
          isSelected ? 'text-[#c084fc] font-semibold' : 'text-[#f0f6fc] font-medium'
        }`}>
          {def.name}
        </span>
      </div>

      {/* Indicador de Selección con Checkmark */}
      {isSelected && (
        <div className="mr-1 text-[#c084fc] shrink-0">
          <Check size={20} strokeWidth={2.6} />
        </div>
      )}
    </button>
  );
};

export const BrushTextureModal: React.FC<BrushTextureModalProps> = ({
  currentTexture,
  brushColor,
  onApplyTexture,
  onClose,
}) => {
  const triggerHaptic = (ms = 10) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate(ms); } catch {}
    }
  };

  const handleSelect = (def: TextureDefinition) => {
    triggerHaptic(10);
    onApplyTexture({
      id: def.id,
      name: def.name,
      depth: def.defaultDepth,
      scale: def.defaultScale,
    });
  };

  return (
    <div 
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          triggerHaptic(8);
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-3 sm:p-5 animate-fade-in"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[390px] bg-[#161b22] rounded-[32px] shadow-2xl shadow-black/80 flex flex-col overflow-hidden max-h-[88vh] border border-[#30363d]"
      >
        {/* Encabezado limpio con título y descripción en Dark Theme */}
        <div className="px-6 pt-6 pb-2.5">
          <h2 className="text-[22px] font-semibold text-[#f0f6fc] tracking-tight">
            Textura del trazo
          </h2>
          <p className="text-[13px] text-[#8b949e] mt-2 leading-relaxed">
            Cambia el grano del lápiz, el portaminas y el carboncillo. Se nota sobre todo en trazos anchos; el borrador y el balde no la usan.
          </p>
        </div>

        {/* Lista scrollable de tarjetas de texturas */}
        <div className="px-5 py-2 flex flex-col gap-2 overflow-y-auto overscroll-contain max-h-[56vh] scrollbar-thin">
          {TEXTURE_DEFINITIONS.map((def) => {
            const isSelected = currentTexture.id === def.id || 
              (def.id === 'none' && (!currentTexture.id || currentTexture.id === 'none')) ||
              (def.id === 'paper' && currentTexture.id === 'watercolor_paper') ||
              (def.id === 'charcoal' && currentTexture.id === 'charcoal_noise');

            return (
              <TextureItemCard
                key={def.id}
                def={def}
                isSelected={isSelected}
                brushColor={brushColor}
                onSelect={handleSelect}
              />
            );
          })}
        </div>

        {/* Pie con botón de texto Cerrar */}
        <div className="px-6 py-3.5 flex justify-end items-center bg-[#161b22] border-t border-[#30363d]/50">
          <button
            type="button"
            onClick={() => {
              triggerHaptic(8);
              onClose();
            }}
            className="text-[14px] font-semibold text-[#c084fc] hover:text-[#d8b4fe] px-5 py-2 rounded-full hover:bg-[#a855f7]/15 active:scale-95 transition-all"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
