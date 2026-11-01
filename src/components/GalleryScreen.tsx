/**
 * @file GalleryScreen.tsx
 * @description Pantalla independiente de Galería de Proyectos de Dibujo.
 * Permite gestionar múltiples ilustraciones, crear lienzos con proporciones
 * optimizadas para teléfonos móviles (Wallpapers, Instagram, Formato Anime, etc.),
 * y organizar las obras creadas sin saturar la pantalla de dibujo.
 */

import React, { useState } from 'react';
import { 
  Plus, Palette, ArrowLeft, Trash2, Copy, 
  ExternalLink, Calendar, Layers as LayersIcon, Smartphone, Square, Monitor 
} from 'lucide-react';
import { ProjectData } from '../engine/types';

interface GalleryScreenProps {
  projects: ProjectData[];
  currentProjectId: string;
  onOpenProject: (project: ProjectData) => void;
  onCreateNewProject: (name: string, width: number, height: number) => void;
  onDuplicateProject: (project: ProjectData) => void;
  onDeleteProject: (id: string) => void;
  onReturnToStudio: () => void;
}

const CANVAS_PRESETS = [
  { name: 'Fondo Móvil (Vertical)', width: 1080, height: 1920, icon: <Smartphone size={18} />, desc: 'Ideal para fondos de pantalla y TikTok' },
  { name: 'Cuadrado Instagram', width: 1080, height: 1080, icon: <Square size={18} />, desc: '1:1 Perfecto para feeds y avatares' },
  { name: 'Miniatura 16:9', width: 1280, height: 720, icon: <Monitor size={18} />, desc: 'Formato apaisado para YouTube / Web' },
  { name: 'Lienzo Rápido (Boceto)', width: 800, height: 1200, icon: <Palette size={18} />, desc: 'Ligero y ultra veloz para dibujar ideas' },
];

export const GalleryScreen: React.FC<GalleryScreenProps> = ({
  projects,
  currentProjectId,
  onOpenProject,
  onCreateNewProject,
  onDuplicateProject,
  onDeleteProject,
  onReturnToStudio,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [projectName, setProjectName] = useState('Nueva Ilustración');
  const [selectedWidth, setSelectedWidth] = useState(1080);
  const [selectedHeight, setSelectedHeight] = useState(1920);

  const handleCreate = () => {
    onCreateNewProject(projectName.trim() || 'Sin Título', selectedWidth, selectedHeight);
    setIsModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#111215] text-[#e5e7eb] flex flex-col">
      {/* Barra superior de navegación */}
      <header className="h-16 px-4 sm:px-6 bg-[#18191f] border-b border-[#292b34] flex items-center justify-between sticky top-0 z-20 shadow-md">
        <div className="flex items-center gap-3">
          <button
            onClick={onReturnToStudio}
            className="p-2.5 rounded-xl bg-[#23252d] hover:bg-[#2c2f3a] text-gray-300 hover:text-white border border-[#313440] transition-colors flex items-center gap-2 text-sm font-medium"
          >
            <ArrowLeft size={18} />
            <span>Volver al Lienzo</span>
          </button>
          <div className="hidden sm:block">
            <h1 className="text-lg font-bold text-white">Mis Obras y Proyectos</h1>
            <p className="text-xs text-gray-400">Galería de ilustraciones guardadas</p>
          </div>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="py-2.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg active:scale-95 transition-all"
        >
          <Plus size={18} />
          <span>Nuevo Lienzo</span>
        </button>
      </header>

      {/* Contenido de la Galería */}
      <main className="flex-1 p-4 sm:p-6 max-w-6xl mx-auto w-full">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-200">
            Ilustraciones ({projects.length})
          </h2>
          <span className="text-xs text-amber-400 font-mono">
            Acelerado con WebGPU & Wasm
          </span>
        </div>

        {projects.length === 0 ? (
          <div className="text-center py-16 px-4 bg-[#18191f] rounded-2xl border border-[#292b34]">
            <Palette size={48} className="mx-auto text-gray-600 mb-3" />
            <h3 className="text-lg font-semibold text-gray-300 mb-1">Tu galería está vacía</h3>
            <p className="text-sm text-gray-500 max-w-sm mx-auto mb-4">
              Crea tu primer lienzo para empezar a dibujar con pinceles ultra suaves.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="py-2.5 px-5 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl text-sm inline-flex items-center gap-2 shadow-md"
            >
              <Plus size={18} />
              <span>Crear Lienzo</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {projects.map((proj) => {
              const isCurrent = proj.id === currentProjectId;
              return (
                <div
                  key={proj.id}
                  className={`bg-[#18191f] border rounded-2xl overflow-hidden transition-all flex flex-col justify-between ${
                    isCurrent ? 'border-amber-500/80 shadow-lg shadow-amber-500/10' : 'border-[#292b34] hover:border-gray-600'
                  }`}
                >
                  {/* Vista previa / Miniatura */}
                  <div 
                    onClick={() => onOpenProject(proj)}
                    className="h-44 bg-[repeating-conic-gradient(#18191f_0%_25%,#262832_0%_50%)] bg-[length:16px_16px] relative flex items-center justify-center cursor-pointer group overflow-hidden"
                  >
                    {proj.thumbnailUrl ? (
                      <img
                        src={proj.thumbnailUrl}
                        alt={proj.name}
                        className="w-full h-full object-contain p-2"
                      />
                    ) : (
                      <div className="text-center p-4">
                        <Palette size={32} className="mx-auto text-amber-400/60 mb-2 group-hover:scale-110 transition-transform" />
                        <span className="text-xs text-gray-400">Toca para abrir en el estudio</span>
                      </div>
                    )}
                    {isCurrent && (
                      <span className="absolute top-2 left-2 text-[10px] bg-amber-500 text-black font-bold px-2 py-0.5 rounded-full shadow-md">
                        En edición
                      </span>
                    )}
                  </div>

                  {/* Información del Proyecto */}
                  <div className="p-4 flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-sm text-gray-100 truncate">{proj.name}</h3>
                      <span className="text-[10px] text-gray-400 bg-[#23252d] px-2 py-0.5 rounded shrink-0 font-mono">
                        {proj.width} × {proj.height}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <LayersIcon size={13} className="text-amber-400" />
                        {proj.layerCount || 1} capas
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar size={13} />
                        {new Date(proj.updatedAt).toLocaleDateString()}
                      </span>
                    </div>

                    {/* Botones de acción */}
                    <div className="flex items-center gap-2 pt-2 border-t border-[#292b34]">
                      <button
                        onClick={() => onOpenProject(proj)}
                        className="flex-1 py-1.5 px-3 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <ExternalLink size={14} />
                        <span>Abrir</span>
                      </button>

                      <button
                        onClick={() => onDuplicateProject(proj)}
                        aria-label="Duplicar proyecto"
                        className="p-1.5 rounded-lg bg-[#23252d] hover:bg-[#2c2f3a] text-gray-300 transition-colors"
                        title="Duplicar lienzo"
                      >
                        <Copy size={15} />
                      </button>

                      <button
                        onClick={() => onDeleteProject(proj.id)}
                        disabled={projects.length <= 1}
                        aria-label="Eliminar proyecto"
                        className={`p-1.5 rounded-lg transition-colors ${
                          projects.length <= 1
                            ? 'text-gray-600 cursor-not-allowed'
                            : 'bg-red-950/40 hover:bg-red-900/60 text-red-400'
                        }`}
                        title="Eliminar lienzo"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Modal para Crear Nuevo Lienzo con Preajustes */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-[#18191f] border border-[#2e313c] rounded-2xl p-5 text-white shadow-2xl flex flex-col gap-4">
            <h3 className="text-lg font-bold">Crear Nuevo Lienzo de Dibujo</h3>

            <div>
              <label className="text-xs text-gray-400 block mb-1">Nombre del Proyecto</label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full bg-[#121316] border border-[#313440] rounded-xl px-3 py-2 text-sm text-white focus:outline-hidden focus:border-amber-500"
                placeholder="Ej: Ilustración Manga..."
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-2">Preajustes de Formato Móvil</label>
              <div className="grid grid-cols-1 gap-2">
                {CANVAS_PRESETS.map((preset) => {
                  const isSelected = selectedWidth === preset.width && selectedHeight === preset.height;
                  return (
                    <button
                      key={preset.name}
                      onClick={() => {
                        setSelectedWidth(preset.width);
                        setSelectedHeight(preset.height);
                      }}
                      className={`flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'bg-amber-500/15 border-amber-500 ring-1 ring-amber-500/40'
                          : 'bg-[#121316] border-[#262832] hover:border-[#383a48]'
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${isSelected ? 'bg-amber-500 text-black' : 'bg-[#23252d] text-gray-300'}`}>
                        {preset.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-gray-200">{preset.name}</p>
                          <span className="text-[10px] font-mono text-amber-400">{preset.width} × {preset.height}</span>
                        </div>
                        <p className="text-[11px] text-gray-400">{preset.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-[#23252d] hover:bg-[#2c2f3a] text-gray-300 text-sm font-medium transition-colors border border-[#313440]"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold text-sm shadow-md transition-all active:scale-95"
              >
                Crear y Abrir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
