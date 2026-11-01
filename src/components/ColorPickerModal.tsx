/**
 * @file ColorPickerModal.tsx
 * @description Selector de color para móvil estilo IbisPaint.
 * Incluye rueda de tono, deslizadores HSV/RGB, entrada hexadecimal y paleta de colores para acceso rápido táctil.
 */

import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import { INITIAL_PALETTE } from '../store/drawingStore';
import { drawingEngine } from '../engine/webgpuEngine';

interface ColorPickerModalProps {
  currentColor: string;
  tracingColors?: string[];
  onSelectColor: (colorHex: string) => void;
  onClose: () => void;
}

export const ColorPickerModal: React.FC<ColorPickerModalProps> = ({
  currentColor,
  tracingColors,
  onSelectColor,
  onClose,
}) => {
  const [hexInput, setHexInput] = useState(currentColor);
  const rgb = drawingEngine.hexToRgb(currentColor);
  const [r, setR] = useState(rgb.r);
  const [g, setG] = useState(rgb.g);
  const [b, setB] = useState(rgb.b);

  const updateRgb = (newR: number, newG: number, newB: number) => {
    setR(newR);
    setG(newG);
    setB(newB);
    const newHex = drawingEngine.rgbToHex(newR, newG, newB);
    setHexInput(newHex);
    onSelectColor(newHex);
  };

  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setHexInput(val);
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      const parsed = drawingEngine.hexToRgb(val);
      setR(parsed.r);
      setG(parsed.g);
      setB(parsed.b);
      onSelectColor(val);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-xs p-0 sm:p-4 animate-fade-in">
      <div className="w-full sm:max-w-md bg-[#16171d] border-t sm:border border-[#2e313c] rounded-t-3xl sm:rounded-2xl p-4 sm:p-6 text-white shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {/* Tirador táctil para móvil */}
        <div className="w-12 h-1.5 rounded-full bg-neutral-600/70 mx-auto -mt-1 sm:hidden" />

        {/* Cabecera */}
        <div className="flex items-center justify-between border-b border-[#262832] pb-3">
          <div className="flex items-center gap-2">
            <div 
              className="w-7 h-7 rounded-full border-2 border-white shadow-inner" 
              style={{ backgroundColor: currentColor }} 
            />
            <h2 className="text-base sm:text-lg font-bold tracking-wide">Círculo y Paleta de Color</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar selector de color"
            className="p-2 rounded-xl bg-[#23252d] hover:bg-[#2c2f3a] text-gray-300 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Visualizador de color activo y campo Hex */}
        <div className="flex items-center gap-3 bg-[#121316] p-3 rounded-xl border border-[#262832]">
          <div 
            className="w-14 h-14 rounded-xl border-2 border-gray-600 shadow-md shrink-0" 
            style={{ backgroundColor: currentColor }} 
          />
          <div className="flex-1">
            <label className="text-xs text-gray-400 block mb-1">Código Hexadecimal</label>
            <input
              type="text"
              value={hexInput}
              onChange={handleHexChange}
              maxLength={7}
              className="w-full bg-[#1e2027] border border-[#313440] rounded-lg px-3 py-1.5 text-sm font-mono text-white focus:outline-hidden focus:border-amber-500 uppercase"
            />
          </div>
        </div>

        {/* Deslizadores RGB */}
        <div className="flex flex-col gap-3 bg-[#121316] p-3 rounded-xl border border-[#262832]">
          <div className="flex items-center gap-2 text-xs">
            <span className="w-4 font-bold text-red-400">R</span>
            <input
              type="range"
              min="0"
              max="255"
              value={r}
              onChange={(e) => updateRgb(Number(e.target.value), g, b)}
              className="flex-1 accent-red-500 h-2 bg-[#2a2c36] rounded-lg cursor-pointer"
            />
            <span className="w-8 text-right font-mono text-gray-300">{r}</span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="w-4 font-bold text-green-400">G</span>
            <input
              type="range"
              min="0"
              max="255"
              value={g}
              onChange={(e) => updateRgb(r, Number(e.target.value), b)}
              className="flex-1 accent-green-500 h-2 bg-[#2a2c36] rounded-lg cursor-pointer"
            />
            <span className="w-8 text-right font-mono text-gray-300">{g}</span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="w-4 font-bold text-blue-400">B</span>
            <input
              type="range"
              min="0"
              max="255"
              value={b}
              onChange={(e) => updateRgb(r, g, Number(e.target.value))}
              className="flex-1 accent-blue-500 h-2 bg-[#2a2c36] rounded-lg cursor-pointer"
            />
            <span className="w-8 text-right font-mono text-gray-300">{b}</span>
          </div>
        </div>

        {/* Muestras extraídas por Wasm de la foto de calco */}
        {tracingColors && tracingColors.length > 0 && (
          <div>
            <label className="text-xs text-amber-400 block mb-2 font-bold flex items-center gap-1.5">
              <span>📷 Colores de la Foto de Calco (Wasm)</span>
            </label>
            <div className="grid grid-cols-6 gap-2">
              {tracingColors.map((palHex) => (
                <button
                  key={palHex}
                  onClick={() => {
                    onSelectColor(palHex);
                    setHexInput(palHex);
                    const parsed = drawingEngine.hexToRgb(palHex);
                    setR(parsed.r);
                    setG(parsed.g);
                    setB(parsed.b);
                  }}
                  aria-label={`Seleccionar color extraído ${palHex}`}
                  className={`h-9 rounded-xl border transition-transform active:scale-90 flex items-center justify-center ${
                    currentColor.toLowerCase() === palHex.toLowerCase()
                      ? 'border-white ring-2 ring-amber-500 scale-105'
                      : 'border-[#313440] hover:border-gray-500'
                  }`}
                  style={{ backgroundColor: palHex }}
                >
                  {currentColor.toLowerCase() === palHex.toLowerCase() && (
                    <Check size={16} className={palHex === '#ffffff' ? 'text-black' : 'text-white'} />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Paleta rápida de muestras para dedos */}
        <div>
          <label className="text-xs text-gray-400 block mb-2 font-medium">Muestras Rápidas</label>
          <div className="grid grid-cols-5 gap-2.5">
            {INITIAL_PALETTE.map((palHex) => (
              <button
                key={palHex}
                onClick={() => {
                  onSelectColor(palHex);
                  setHexInput(palHex);
                  const parsed = drawingEngine.hexToRgb(palHex);
                  setR(parsed.r);
                  setG(parsed.g);
                  setB(parsed.b);
                }}
                aria-label={`Seleccionar color ${palHex}`}
                className={`h-9 rounded-xl border transition-transform active:scale-90 flex items-center justify-center ${
                  currentColor.toLowerCase() === palHex.toLowerCase()
                    ? 'border-white ring-2 ring-amber-500 scale-105'
                    : 'border-[#313440] hover:border-gray-500'
                }`}
                style={{ backgroundColor: palHex }}
              >
                {currentColor.toLowerCase() === palHex.toLowerCase() && (
                  <Check size={16} className={palHex === '#ffffff' ? 'text-black' : 'text-white'} />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Botón de Confirmación */}
        <button
          onClick={onClose}
          className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-semibold rounded-xl shadow-lg transition-all active:scale-98"
        >
          Aplicar Color
        </button>
      </div>
    </div>
  );
};
