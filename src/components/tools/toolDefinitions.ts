/**
 * @file toolDefinitions.ts
 * @description Definición de metadatos, iconos, badges y descripciones de las herramientas de dibujo.
 * 
 * Separado de ToolPickerModal para modularidad limpia y reusabilidad sin acoplar la UI de selección.
 */

import React from 'react';
import { 
  Paintbrush, Eraser, SprayCan, Feather, 
  Highlighter, PaintBucket, Pipette, Hand, PenTool 
} from 'lucide-react';
import { ToolType } from '../../engine/types';

export interface ToolOption {
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

export const TOOLS: ToolOption[] = [
  { 
    id: 'vector_pencil', 
    name: 'Lápiz Vectorial', 
    category: 'brushes',
    desc: 'Motor analítico Kotlin/Wasm. Curvas Bézier continuas ultra nítidas con cero pixelación al hacer zoom.', 
    badge: 'Kotlin/Wasm • Anti-Pixel', 
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    icon: React.createElement(PenTool, { size: 22 }),
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
    icon: React.createElement(Paintbrush, { size: 22 }),
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
    icon: React.createElement(Feather, { size: 22 }),
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
    icon: React.createElement(SprayCan, { size: 22 }),
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
    icon: React.createElement(Highlighter, { size: 22 }),
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
    icon: React.createElement(Eraser, { size: 22 }),
    iconBg: 'bg-red-500/20',
    iconColor: 'text-red-400',
  },
  { 
    id: 'bucket', 
    name: 'Bote de Pintura', 
    category: 'edit',
    desc: 'Algoritmo Flood-Fill con Expansión de Borde (1 a 3 px) para rellenar áreas cerradas y sellar halos blancos bajo el lineart.', 
    badge: 'Expansión 1-3px', 
    badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
    icon: React.createElement(PaintBucket, { size: 22 }),
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
    icon: React.createElement(Pipette, { size: 22 }),
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
    icon: React.createElement(Hand, { size: 22 }),
    iconBg: 'bg-teal-500/20',
    iconColor: 'text-teal-400',
  },
];
