import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    // Actualiza el estado para que el siguiente renderizado muestre la interfaz de repuesto
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);

    // Auto-reload si falla la carga de un módulo dinámico (ej. por una nueva versión desplegada)
    const isChunkLoadFailed = /Failed to fetch dynamically imported module/i.test(error.message);
    if (isChunkLoadFailed) {
      const reloadCount = parseInt(sessionStorage.getItem('chunk_failed_reload') || '0', 10);
      if (reloadCount < 2) {
        sessionStorage.setItem('chunk_failed_reload', String(reloadCount + 1));
        window.location.reload();
      }
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl border border-gray-200 p-8 max-w-lg w-full text-center animate-in fade-in zoom-in duration-300">
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="h-10 w-10" />
            </div>
            
            <h2 className="text-2xl font-black text-gray-900 mb-2">¡Algo salió mal!</h2>
            <p className="text-gray-600 mb-6 font-medium">
              Toolkit SISMED detectó un error crítico en este módulo. No te preocupes, tus datos están seguros.
            </p>
            
            {this.state.error && (
              <div className="bg-gray-950 text-red-400 p-4 rounded-xl text-left font-mono text-xs mb-8 overflow-auto max-h-40 border border-gray-800">
                <p className="font-bold underline mb-1">Detalle técnico:</p>
                {this.state.error.message}
              </div>
            )}
            
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={this.handleReset}
                className="flex-1 bg-teal-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-teal-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-teal-200"
              >
                <RefreshCw className="h-5 w-5" />
                Reintentar Carga
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="flex-1 bg-gray-100 text-gray-700 px-6 py-3 rounded-xl font-bold hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
              >
                <Home className="h-5 w-5" />
                Ir al Inicio
              </button>
            </div>
            
            <p className="mt-8 text-xs text-gray-400">
              Si el problema persiste, intente limpiar la memoria caché de su navegador.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
