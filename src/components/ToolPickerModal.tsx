/**
 * @file ToolPickerModal.tsx
 * @description Selector nativo de herramientas de dibujo y estabilizador S-Form estilo IbisPaint.
 * 
 * Rediseñado con estándares de interfaz móvil nativa:
 * - Segmentación en 2 paneles independientes: [🎨 Herramientas] y [⚡ Estabilizador].
 * - Selección táctil instantánea con retroalimentación háptica (sin botones de formulario web).
 * - Cero truncamiento tipográfico con tarjetas espaciosas y diseño ergonómico para dedos.
 * - Calibrador dedicado del Estabilizador S-Form con bloc táctil de pruebas y presets rápidos.
 * - Área táctil mínima de 48px y soporte para la zona segura inferior (safe-area-inset-bottom).
 */

import React, { useRef, useState, useEffect } from 'react';
import { 
  X, Paintbrush, Eraser, SprayCan, Feather, 
  Highlighter, PaintBucket, Pipette, Sliders, Hand, PenTool, Check, Sparkles,
  RotateCcw
} from 'lucide-react';
import { ToolType } from '../engine/types';
import { wasmEngine } from '../engine/wasmEngine';

interface ToolPickerModalProps {
  activeTool: ToolType;
  onSelectTool: (tool: ToolType) => void;
  stabilizerLevel: number;
  onChangeStabilizer: (level: number) => void;
  onClose: () => void;
}

type MainTab = 'tools' | 'stabilizer';
type ToolCategory = 'all' | 'brushes' | 'edit' | 'nav';

interface ToolOption {
  id: ToolType;
  name: string;
  category: 'brushes' | 'edit' | 'nav';
  desc: string;
  badge: string;
  badgeColor: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
}

const TOOLS: ToolOption[] = [
  { 
    id: 'vector_pencil', 
    name: 'Lápiz Vectorial', 
    category: 'brushes',
    desc: 'Motor analítico Kotlin/Wasm. Curvas Bézier continuas ultra nítidas con cero pixelación al hacer zoom.', 
    badge: 'Kotlin/Wasm • Anti-Pixel', 
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    icon: <PenTool size={22} />,
    iconBg: 'bg-amber-500/20',
    iconColor: 'text-amber-400',
  },
  { 
    id: 'brush', 
    name: 'Pluma Fuerte', 
    category: 'brushes',
    desc: 'Línea caligráfica con modulación de grosor por velocidad. Ideal para entintado manga y lineart definitivo.', 
    badge: 'Entintado Pro', 
    badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    icon: <Paintbrush size={22} />,
    iconBg: 'bg-blue-500/20',
    iconColor: 'text-blue-400',
  },
  { 
    id: 'pencil', 
    name: 'Lápiz Grafito', 
    category: 'brushes',
    desc: 'Textura rugosa y analógica que simula el trazo de grafito tradicional sobre papel para bocetos previos.', 
    badge: 'Bocetos y Sketch', 
    badgeColor: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
    icon: <Feather size={22} />,
    iconBg: 'bg-slate-500/20',
    iconColor: 'text-slate-300',
  },
  { 
    id: 'airbrush', 
    name: 'Aerógrafo', 
    category: 'brushes',
    desc: 'Gradientes difuminados con caída gaussiana suave. Perfecto para sombreados volumétricos y brillos.', 
    badge: 'Difuminado Suave', 
    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    icon: <SprayCan size={22} />,
    iconBg: 'bg-purple-500/20',
    iconColor: 'text-purple-400',
  },
  { 
    id: 'marker', 
    name: 'Marcador', 
    category: 'brushes',
    desc: 'Tinta opaca uniforme con punta sólida. Excelente para bloques de color base y rotulación.', 
    badge: 'Tinta Plana', 
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    icon: <Highlighter size={22} />,
    iconBg: 'bg-emerald-500/20',
    iconColor: 'text-emerald-400',
  },
  { 
    id: 'eraser', 
    name: 'Goma de Borrar', 
    category: 'edit',
    desc: 'Eliminación quirúrgica de trazos respetando la capa activa y la presión aplicada con el dedo.', 
    badge: 'Respeto de Capa', 
    badgeColor: 'bg-red-500/20 text-red-300 border-red-500/40',
    icon: <Eraser size={22} />,
    iconBg: 'bg-red-500/20',
    iconColor: 'text-red-400',
  },
  { 
    id: 'bucket', 
    name: 'Bote de Pintura', 
    category: 'edit',
    desc: 'Algoritmo Flood-Fill de alto rendimiento en Wasm. Rellena regiones cerradas con tolerancia inteligente.', 
    badge: 'FloodFill Wasm', 
    badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
    icon: <PaintBucket size={22} />,
    iconBg: 'bg-indigo-500/20',
    iconColor: 'text-indigo-400',
  },
  { 
    id: 'eyedropper', 
    name: 'Cuentagotas', 
    category: 'edit',
    desc: 'Muestreo de color instantáneo en coordenadas de pantalla. Extrae el tono exacto del lienzo o foto de calco.', 
    badge: 'Muestreo RGB', 
    badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    icon: <Pipette size={22} />,
    iconBg: 'bg-cyan-500/20',
    iconColor: 'text-cyan-400',
  },
  { 
    id: 'hand', 
    name: 'Mano / Desplazar', 
    category: 'nav',
    desc: 'Exploración libre del lienzo con 1 dedo sin dibujar ni alterar accidentalmente las capas.', 
    badge: 'Navegación Libre', 
    badgeColor: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
    icon: <Hand size={22} />,
    iconBg: 'bg-teal-500/20',
    iconColor: 'text-teal-400',
  },
];

export const ToolPickerModal: React.FC<ToolPickerModalProps> = ({
  activeTool,
  onSelectTool,
  stabilizerLevel,
  onChangeStabilizer,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<MainTab>('tools');
  const [selectedCategory, setSelectedCategory] = useState<ToolCategory>('all');
  
  // Scratchpad de prueba para el estabilizador
  const scratchpadRef = useRef<HTMLCanvasElement | null>(null);
  const [isScratching, setIsScratching] = useState(false);
  const lastPointRef = useRef<{ x: number; y: number; pressure: number } | null>(null);

  const triggerHaptic = (ms = 10) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate(ms); } catch {}
    }
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
    if (activeTab === 'stabilizer') {
      setTimeout(clearScratchpad, 50);
    }
  }, [activeTab]);

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

  const filteredTools = TOOLS.filter(t => {
    if (selectedCategory === 'all') return true;
    return t.category === selectedCategory;
  });

  const getStabilizerDescription = (level: number) => {
    if (level === 0) return 'Trazo directo sin amortiguación (reacción táctil inmediata).';
    if (level <= 3) return 'Suavizado natural para bocetos fluidos y escritura cómoda.';
    if (level <= 7) return 'Amortiguación alta para ilustración limpia y arcos firmes.';
    return 'Máxima firmeza estilo manga (elimina cualquier temblor del dedo).';
  };

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
        
        {/* 1. Tirador táctil nativo para móvil (tocar para cerrar) */}
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
              {[
                { id: 'all', label: 'Todas' },
                { id: 'brushes', label: 'Pinceles' },
                { id: 'edit', label: 'Edición' },
                { id: 'nav', label: 'Mover' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    triggerHaptic(6);
                    setSelectedCategory(cat.id as ToolCategory);
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

            {/* Lista Espaciosa de Herramientas con Selección Instantánea */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-0.5 pt-1">
              {filteredTools.map((tool) => {
                const isSelected = activeTool === tool.id;
                return (
                  <button
                    key={tool.id}
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
                    {/* Icono con fondo temático */}
                    <div className={`p-2.5 rounded-xl shrink-0 ${tool.iconBg} ${tool.iconColor}`}>
                      {tool.icon}
                    </div>

                    {/* Texto descriptivo completo sin cortes */}
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

                    {/* Indicador de activo */}
                    {isSelected && (
                      <div className="p-1 rounded-full bg-amber-500 text-black shrink-0 shadow-md">
                        <Check size={14} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          /* PANEL DEDICADO DEL ESTABILIZADOR S-FORM */
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
                {[
                  { lvl: 0, label: '0: Directo' },
                  { lvl: 3, label: '3: Natural' },
                  { lvl: 6, label: '6: Ilustración' },
                  { lvl: 10, label: '10: Manga' },
                ].map((p) => (
                  <button
                    key={p.lvl}
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
        )}
      </div>
    </div>
  );
};
