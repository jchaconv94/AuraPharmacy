
import React from 'react';
import { X, AlertTriangle, ClipboardList, ScanLine } from 'lucide-react';

interface ReviewWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  progress: number;
}

export const ReviewWarningModal: React.FC<ReviewWarningModalProps> = ({ 
  isOpen, 
  onClose,
  progress
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border-l-8 border-amber-500">
        
        {/* Header */}
        <div className="bg-white p-6 pb-2 flex justify-between items-start">
          <div className="flex items-center gap-3">
             <div className="bg-amber-100 p-3 rounded-full">
                <AlertTriangle className="h-8 w-8 text-amber-600" />
             </div>
             <h3 className="text-xl font-bold text-gray-900">Auditoría Incompleta</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          <p className="text-gray-600 text-sm leading-relaxed">
            Por normativa de seguridad, el responsable de farmacia debe validar el requerimiento de <strong>cada ítem sugerido para compra</strong> antes de generar el reporte oficial.
          </p>
          
          <div className="bg-amber-50 p-4 rounded-lg border border-amber-100">
              <div className="flex justify-between items-end mb-2">
                  <span className="text-xs font-bold text-amber-800 uppercase">Avance de Auditoría</span>
                  <span className="text-2xl font-black text-amber-600">{progress}%</span>
              </div>
              <div className="w-full bg-amber-200 rounded-full h-2.5">
                  <div className="bg-amber-500 h-2.5 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
              </div>
              <p className="text-xs text-amber-700 mt-2 italic">
                  Estado: <strong className="uppercase">Pendiente de Aprobación</strong>
              </p>
          </div>

          <div className="flex gap-3 items-start bg-blue-50 p-3 rounded text-sm text-blue-800">
              <ClipboardList className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                  <strong>¿Qué debo hacer?</strong>
                  <ul className="list-disc list-inside mt-1 space-y-1 text-xs">
                      <li>Haga clic en los ítems marcados con requerimiento.</li>
                      <li>Verifique la cantidad sugerida en el modal.</li>
                      <li>Haga clic en <strong>"CONFIRMAR REVISIÓN"</strong>.</li>
                  </ul>
              </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end">
           <button 
             onClick={onClose}
             className="px-6 py-2.5 text-sm font-bold text-white bg-gray-900 rounded-lg hover:bg-black transition-colors shadow-sm flex items-center gap-2"
           >
             <ScanLine className="h-4 w-4" />
             Entendido, continuar auditoría
           </button>
        </div>

      </div>
    </div>
  );
};
