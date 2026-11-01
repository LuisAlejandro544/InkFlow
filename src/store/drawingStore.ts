/**
 * @file drawingStore.ts
 * @description Estado global de la aplicación de dibujo estilo IbisPaint.
 * Maneja el lienzo activo, capas, herramientas seleccionadas, historial de deshacer/rehacer,
 * lista de proyectos guardados y navegación entre pantallas.
 */

import { Layer, ToolType, BlendMode, ProjectData } from '../engine/types';

export interface AppState {
  currentScreen: 'studio' | 'gallery' | 'engine';
  currentProject: ProjectData;
  projects: ProjectData[];
  
  // Herramienta y pincel
  activeTool: ToolType;
  lastDrawingTool: ToolType; // Para alternar rápidamente entre pincel y borrador
  brushSize: number;         // 1 a 100 px
  brushOpacity: number;      // 0.01 a 1.0
  brushColor: string;        // Hexadecimal #rrggbb
  stabilizerLevel: number;   // 0 a 10 (IbisPaint S-Form)
  
  // Capas
  layers: Layer[];
  activeLayerId: string;

  // Zoom y desplazamiento del lienzo
  zoom: number;
  panX: number;
  panY: number;

  // Modales
  isLayersModalOpen: boolean;
  isColorPickerOpen: boolean;
  isToolPickerOpen: boolean;
  isExportModalOpen: boolean;
  isNewCanvasModalOpen: boolean;

  // Historial
  canUndo: boolean;
  canRedo: boolean;
}

// Proyecto inicial por defecto (proporción óptima para pantalla de teléfono: 800 x 1200)
export const DEFAULT_PROJECT: ProjectData = {
  id: 'proj_default_1',
  name: 'Mi Ilustración Móvil',
  width: 800,
  height: 1200,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  thumbnailUrl: '',
  layerCount: 1
};

export const INITIAL_PALETTE = [
  '#000000', '#ffffff', '#e74c3c', '#e67e22', '#f1c40f',
  '#2ecc71', '#3498db', '#9b59b6', '#34495e', '#fd79a8',
  '#ffbe76', '#badc58', '#686de0', '#30336b', '#7ed6df'
];
