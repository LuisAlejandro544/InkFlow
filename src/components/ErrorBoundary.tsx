/**
 * @file ErrorBoundary.tsx
 * @description Límite de errores de React para IbisPaint WebGPU Studio.
 * Captura excepciones no controladas en el árbol de componentes, previene la pantalla
 * en blanco (white screen) en navegadores móviles y ofrece un botón de recuperación rápida.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw, Palette } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  handleResetState = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // Ignorar restricciones
    }
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-screen h-screen bg-[#0e1015] text-[#e5e7eb] flex flex-col items-center justify-center p-6 select-none">
          <div className="max-w-md w-full bg-[#161820] border border-[#2a2d39] rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Palette size={28} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-white mb-1">
                IbisPaint WebGPU Studio
              </h2>
              <p className="text-xs text-gray-400">
                Se detectó una interrupción en la interfaz gráfica.
              </p>
            </div>

            {this.state.error && (
              <div className="w-full bg-[#101116] border border-[#232530] rounded-xl p-3 text-left">
                <div className="flex items-center gap-1.5 text-red-400 text-xs font-semibold mb-1">
                  <AlertTriangle size={14} />
                  <span>Detalle:</span>
                </div>
                <p className="text-[11px] text-gray-300 font-mono break-words">
                  {this.state.error.message || 'Error desconocido'}
                </p>
              </div>
            )}

            <div className="flex flex-col gap-2 w-full pt-2">
              <button
                onClick={this.handleReload}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold text-sm flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all cursor-pointer"
              >
                <RotateCcw size={16} />
                <span>Restaurar y Continuar Dibujando</span>
              </button>

              <button
                onClick={this.handleResetState}
                className="w-full py-2.5 rounded-xl bg-[#21232d] hover:bg-[#2a2d3a] text-gray-400 hover:text-white font-medium text-xs border border-[#2f3240] transition-colors cursor-pointer"
              >
                Limpiar datos en caché y reiniciar
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
