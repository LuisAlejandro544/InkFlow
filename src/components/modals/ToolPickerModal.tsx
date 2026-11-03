/**
 * @file ToolPickerModal.tsx
 * @description Selector nativo de herramientas de dibujo y estabilizador S-Form estilo IbisPaint.
 * 
 * Modularizado:
 * - Metadatos de herramientas centralizados en `tools/toolDefinitions.ts`.
 * - Panel del balde de pintura en `tools/BucketSettingsCard.tsx`.
 * - Panel de amortiguación S-Form y scratchpad táctil en `tools/StabilizerScratchpad.tsx`.
 * - Cero truncamiento tipográfico, touch targets de al menos 48px y soporte para safe-area-inset-bottom.
 */

import React, { useState } from 'react';
import { X, Paintbrush, Sliders, Check, Sparkles } from 'lucide-react';
import { ToolType } from '../../engine/types';
import { TOOLS } from '../tools/toolDefinitions';
import { BucketSettingsCard } from '../tools/BucketSettingsCard';
import { StabilizerScratchpad } from '../tools/StabilizerScratchpad';

export interface ToolPickerModalProps {
  activeTool: ToolType;
  onSelectTool: (tool: ToolType) => void;
  stabilizerLevel: number;
  onChangeStabilizer: (level: number) => void;
  bucketExpansion?: number;
  onChangeBucketExpansion?: (expansion: number) => void;
  bucketTolerance?: number;
  onChangeBucketTolerance?: (tolerance: number) => void;
  bucketGapClosing?: number;
  onChangeBucketGapClosing?: (gap: number) => void;
  onOpenTextureModal?: () => void;
  onClose: () => void;
}

type MainTab = 'tools' | 'stabilizer';
type ToolCategory = 'all' | 'brushes' | 'edit' | 'nav';

const CATEGORIES: { id: ToolCategory; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'brushes', label: 'Pinceles' },
  { id: 'edit', label: 'Edición' },
  { id: 'nav', label: 'Mover' },
];

export const ToolPickerModal: React.FC<ToolPickerModalProps> = ({
  activeTool,
  onSelectTool,
  stabilizerLevel,
  onChangeStabilizer,
  bucketExpansion = 2,
  onChangeBucketExpansion,
  bucketTolerance = 32,
  onChangeBucketTolerance,
  bucketGapClosing = 3,
  onChangeBucketGapClosing,
  onOpenTextureModal,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<MainTab>('tools');
  const [selectedCategory, setSelectedCategory] = useState<ToolCategory>('all');

  const triggerHaptic = (ms = 10) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate(ms); } catch {}
    }
  };

  const filteredTools = TOOLS.filter((t) => {
    if (selectedCategory === 'all') return true;
    return t.category === selectedCategory;
  });

  return (
    <div 
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          triggerHaptic(8);
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4 animate-fade-in"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg bg-[#121319] border-t sm:border border-[#262835] rounded-t-3xl sm:rounded-3xl text-white shadow-2xl flex flex-col max-h-[88vh] overflow-hidden pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        {/* 1. Tirador táctil nativo para móvil */}
        <div 
          onClick={() => {
            triggerHaptic(8);
            onClose();
          }}
          className="pt-2.5 pb-1 flex justify-center sm:hidden cursor-pointer active:opacity-75 transition-opacity"
          title="Toca para cerrar"
        >
          <div className="w-10 h-1.5 rounded-full bg-neutral-600/70" />
        </div>

        {/* 2. Barra de Navegación Nativa con Botón X y Botón Listo */}
        <div className="flex items-center justify-between px-3.5 py-2 border-b border-[#21232f]">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                triggerHaptic(8);
                onClose();
              }}
              aria-label="Cerrar panel de herramientas"
              className="w-9 h-9 rounded-xl bg-[#1b1c26] hover:bg-[#252735] border border-[#2b2d3d] flex items-center justify-center text-gray-300 hover:text-white active:scale-95 transition-all"
              title="Cerrar"
            >
              <X size={18} />
            </button>
            <div className="flex items-center gap-1.5">
              <Sliders size={17} className="text-amber-400" />
              <h2 className="text-sm sm:text-base font-bold text-gray-100 tracking-tight">Estudio de Herramientas</h2>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              triggerHaptic(8);
              onClose();
            }}
            aria-label="Listo"
            className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-all active:scale-95 flex items-center gap-1 shadow-sm"
          >
            <Check size={14} />
            <span>Listo</span>
          </button>
        </div>

        {/* 3. Segmented Control Nativo Superior (Herramientas vs Estabilizador) */}
        <div className="px-4 pt-3 pb-2">
          <div className="grid grid-cols-2 p-1 bg-[#0b0c10] rounded-xl border border-[#1f212c]">
            <button
              type="button"
              onClick={() => {
                triggerHaptic(8);
                setActiveTab('tools');
              }}
              className={`py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'tools'
                  ? 'bg-[#1e202b] text-amber-300 shadow-md border border-[#2d3040]'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Paintbrush size={14} className={activeTab === 'tools' ? 'text-amber-400' : 'text-gray-500'} />
              <span>Herramientas ({TOOLS.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                triggerHaptic(8);
                setActiveTab('stabilizer');
              }}
              className={`py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'stabilizer'
                  ? 'bg-[#1e202b] text-amber-300 shadow-md border border-[#2d3040]'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Sparkles size={14} className={activeTab === 'stabilizer' ? 'text-amber-400' : 'text-gray-500'} />
              <span>Estabilizador (Nvl {stabilizerLevel})</span>
            </button>
          </div>
        </div>

        {/* 4. CONTENIDO SEGÚN PESTAÑA ACTIVA */}
        {activeTab === 'tools' ? (
          <div className="flex-1 flex flex-col min-h-0 px-4 pb-2">
            {/* Filtros de Categoría */}
            <div className="flex items-center gap-1.5 py-2 overflow-x-auto no-scrollbar shrink-0">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    triggerHaptic(6);
                    setSelectedCategory(cat.id);
                  }}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all shrink-0 ${
                    selectedCategory === cat.id
                      ? 'bg-amber-500 text-black font-bold shadow-sm'
                      : 'bg-[#161720] text-gray-400 hover:text-white border border-[#232532]'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Acceso a Texturas de Pincel estilo IbisPaint */}
            {onOpenTextureModal && (
              <div 
                onClick={() => {
                  triggerHaptic(8);
                  onClose();
                  onOpenTextureModal();
                }}
                className="p-2.5 my-1.5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-[#181a25] to-[#14151e] border border-amber-500/35 flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all shadow-sm"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400 shrink-0">
                    <Sparkles size={16} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-amber-200">Texturas de Pincel (IbisPaint)</div>
                    <div className="text-[10px] text-gray-400">Papel Acuarela, Lienzo, Trama Manga y Carbón</div>
                  </div>
                </div>
                <span className="text-[10px] font-bold bg-amber-500 text-black px-2.5 py-1 rounded-xl shadow-xs shrink-0">
                  Ver Texturas →
                </span>
              </div>
            )}

            {/* Lista Espaciosa de Herramientas con Selección Instantánea */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-0.5 pt-1">
              {filteredTools.map((tool) => {
                const isSelected = activeTool === tool.id;
                return (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => {
                      triggerHaptic(12);
                      onSelectTool(tool.id);
                      onClose();
                    }}
                    className={`w-full p-3 rounded-2xl border text-left transition-all flex items-center gap-3.5 active:scale-[0.98] ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-400 text-white shadow-lg ring-1 ring-amber-400/50'
                        : 'bg-[#161720] border-[#232532] hover:border-gray-700 text-gray-200'
                    }`}
                  >
                    <div className={`p-2.5 rounded-xl shrink-0 ${tool.iconBg} ${tool.iconColor}`}>
                      {tool.icon}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1.5 flex-wrap">
                        <span className="text-sm font-bold text-white tracking-wide">
                          {tool.name}
                        </span>
                        <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md border ${tool.badgeColor}`}>
                          {tool.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400 leading-relaxed mt-0.5">
                        {tool.desc}
                      </p>
                    </div>

                    {isSelected && (
                      <div className="p-1 rounded-full bg-amber-500 text-black shrink-0 shadow-md">
                        <Check size={14} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Subcomponente modular de Ajustes de Expansión de Borde y Cierre de Huecos para el Balde */}
            {activeTool === 'bucket' && (
              <BucketSettingsCard
                bucketExpansion={bucketExpansion}
                onChangeBucketExpansion={onChangeBucketExpansion}
                bucketTolerance={bucketTolerance}
                onChangeBucketTolerance={onChangeBucketTolerance}
                bucketGapClosing={bucketGapClosing}
                onChangeBucketGapClosing={onChangeBucketGapClosing}
                triggerHaptic={triggerHaptic}
              />
            )}
          </div>
        ) : (
          /* Subcomponente modular del Panel del Estabilizador S-Form */
          <StabilizerScratchpad
            stabilizerLevel={stabilizerLevel}
            onChangeStabilizer={onChangeStabilizer}
            triggerHaptic={triggerHaptic}
          />
        )}
      </div>
    </div>
  );
};
