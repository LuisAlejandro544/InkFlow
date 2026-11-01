/**
 * @file toolNavigationState.ts
 * @description Gestor de estados de navegación de herramientas para IbisPaint WebGPU Studio.
 * 
 * Responsabilidad arquitectónica:
 * - Controlar las transiciones deterministas entre herramientas de dibujo (Pincel, Pluma, Lápiz, Marcador, Lápiz Vectorial),
 *   herramienta de edición (Goma de Borrar) y herramienta de navegación (Mano / Desplazamiento libre con 1 dedo).
 * - Garantizar que al salir del modo Mover ('hand'), se restaure con total fidelidad la herramienta previa del artista,
 *   impidiendo transiciones involuntarias o corruptas hacia 'vector_pencil'.
 * - Prevenir la polución de 'lastDrawingTool' con valores de navegación ('hand') o borrado ('eraser').
 */

import { ToolType } from './types';

export class ToolNavigationStateManager {
  private activeTool: ToolType = 'brush';
  private lastDrawingTool: ToolType = 'brush';
  private previousToolBeforeHand: ToolType = 'brush';

  constructor(initialTool: ToolType = 'brush') {
    this.activeTool = initialTool;
    this.lastDrawingTool = initialTool !== 'hand' && initialTool !== 'eraser' ? initialTool : 'brush';
    this.previousToolBeforeHand = initialTool;
  }

  getActiveTool(): ToolType {
    return this.activeTool;
  }

  getLastDrawingTool(): ToolType {
    return this.lastDrawingTool;
  }

  getPreviousToolBeforeHand(): ToolType {
    return this.previousToolBeforeHand;
  }

  /**
   * Selecciona una herramienta preservando el historial seguro.
   */
  selectTool(tool: ToolType): void {
    if (tool === 'hand') {
      if (this.activeTool !== 'hand') {
        this.previousToolBeforeHand = this.activeTool;
      }
    } else {
      if (tool !== 'eraser') {
        this.lastDrawingTool = tool;
      }
    }
    this.activeTool = tool;
  }

  /**
   * Alterna el modo Mover (Mano).
   * Al desactivar el modo mover, restaura la herramienta previa sin desvíos indebidos.
   */
  toggleHandMode(): ToolType {
    if (this.activeTool === 'hand') {
      const restored = this.previousToolBeforeHand && this.previousToolBeforeHand !== 'hand'
        ? this.previousToolBeforeHand
        : (this.lastDrawingTool && this.lastDrawingTool !== 'hand' ? this.lastDrawingTool : 'brush');
      this.activeTool = restored;
    } else {
      this.previousToolBeforeHand = this.activeTool;
      this.activeTool = 'hand';
    }
    return this.activeTool;
  }

  /**
   * Alterna rápidamente entre herramienta de trazo y borrador.
   */
  toggleBrushEraser(): ToolType {
    if (this.activeTool === 'eraser') {
      const target = this.lastDrawingTool && this.lastDrawingTool !== 'eraser' && this.lastDrawingTool !== 'hand'
        ? this.lastDrawingTool
        : 'brush';
      this.activeTool = target;
    } else {
      if (this.activeTool !== 'hand') {
        this.lastDrawingTool = this.activeTool;
      }
      this.activeTool = 'eraser';
    }
    return this.activeTool;
  }
}
