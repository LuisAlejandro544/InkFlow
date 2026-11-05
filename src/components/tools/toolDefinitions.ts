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
    desc: 'Trazo vectorial ultra definido. No se pixela ni pierde nitidez, sin importar cuánto zoom hagas para dibujar detalles.', 
    badge: 'Trazo Infinito • Cero Píxeles', 
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    icon: React.createElement(PenTool, { size: 22 }),
    iconBg: 'bg-amber-500/20',
    iconColor: 'text-amber-400',
  },
  { 
    id: 'brush', 
    name: 'Pluma Fuerte', 
    category: 'brushes',
    desc: 'Línea suave y elegante que modula el grosor según la velocidad de tu dedo. Ideal para entintar manga y dibujos finales.', 
    badge: 'Entintado Suave', 
    badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    icon: React.createElement(Paintbrush, { size: 22 }),
    iconBg: 'bg-blue-500/20',
    iconColor: 'text-blue-400',
  },
  { 
    id: 'pencil', 
    name: 'Lápiz Grafito', 
    category: 'brushes',
    desc: 'Textura de lápiz real sobre papel. Perfecto para crear tus primeros bocetos e ideas con soltura.', 
    badge: 'Bocetos y Dibujo', 
    badgeColor: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
    icon: React.createElement(Feather, { size: 22 }),
    iconBg: 'bg-slate-500/20',
    iconColor: 'text-slate-300',
  },
  { 
    id: 'airbrush', 
    name: 'Aerógrafo', 
    category: 'brushes',
    desc: 'Degradados suaves y parejos. Ideal para colorear piel, sombras de volumen, degradados y efectos de luz.', 
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
    desc: 'Tinta opaca y uniforme. Excelente para rellenar bases de color, carteles y rotulación.', 
    badge: 'Color Sólido', 
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    icon: React.createElement(Highlighter, { size: 22 }),
    iconBg: 'bg-emerald-500/20',
    iconColor: 'text-emerald-400',
  },
  { 
    id: 'eraser', 
    name: 'Goma de Borrar', 
    category: 'edit',
    desc: 'Limpia trazos con precisión y suavidad con tu dedo, sin tocar ni dañar tus otras capas de dibujo.', 
    badge: 'Borrado Preciso', 
    badgeColor: 'bg-red-500/20 text-red-300 border-red-500/40',
    icon: React.createElement(Eraser, { size: 22 }),
    iconBg: 'bg-red-500/20',
    iconColor: 'text-red-400',
  },
  { 
    id: 'bucket', 
    name: 'Bote de Pintura', 
    category: 'edit',
    desc: 'Pinta zonas completas en 1 toque. Cierra automáticamente líneas abiertas y elimina los molestos bordes blancos.', 
    badge: 'Relleno Inteligente', 
    badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
    icon: React.createElement(PaintBucket, { size: 22 }),
    iconBg: 'bg-indigo-500/20',
    iconColor: 'text-indigo-400',
  },
  { 
    id: 'eyedropper', 
    name: 'Cuentagotas', 
    category: 'edit',
    desc: 'Toca cualquier punto de tu lienzo o foto de calco para copiar y usar ese color de inmediato.', 
    badge: 'Copiar Color', 
    badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    icon: React.createElement(Pipette, { size: 22 }),
    iconBg: 'bg-cyan-500/20',
    iconColor: 'text-cyan-400',
  },
  { 
    id: 'hand', 
    name: 'Mano / Desplazar', 
    category: 'nav',
    desc: 'Muévete por todo el lienzo con 1 dedo cómodamente sin dibujar ni alterar tus capas por error.', 
    badge: 'Mover sin Manchar', 
    badgeColor: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
    icon: React.createElement(Hand, { size: 22 }),
    iconBg: 'bg-teal-500/20',
    iconColor: 'text-teal-400',
  },
];
