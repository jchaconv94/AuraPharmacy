
import React from 'react';
import { Trophy, FileText, X, CheckCircle, ArrowRight } from 'lucide-react';

interface SuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDownload: () => void;
}

export const SuccessModal: React.FC<SuccessModalProps> = ({ 
  isOpen, 
  onClose,
  onDownload
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-300 border-t-8 border-teal-500 relative">
        
        {/* Confetti Background Effect (CSS only visual trick) */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-10">
            <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-[radial-gradient(circle,theme(colors.teal.500)_1px,transparent_1px)] bg-[length:20px_20px]"></div>
        </div>

        <button 
            onClick={onClose} 
            className="absolute top-2 right-2 p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors z-10"
        >
            <X className="h-5 w-5" />
        </button>

        <div className="p-8 flex flex-col items-center text-center relative z-0">
          
          <div className="mb-6 relative">
             <div className="absolute inset-0 bg-teal-100 rounded-full blur-xl opacity-50 animate-pulse"></div>
             <div className="relative bg-teal-50 p-4 rounded-full border-2 border-teal-100 shadow-sm">
                <Trophy className="h-12 w-12 text-teal-600" />
             </div>
             <div className="absolute -bottom-1 -right-1 bg-green-500 text-white p-1 rounded-full border-2 border-white">
                <CheckCircle className="h-4 w-4" />
             </div>
          </div>

          <h3 className="text-2xl font-black text-gray-900 mb-2 tracking-tight">
            ¡Auditoría Completada!
          </h3>
          
          <p className="text-gray-600 mb-8 leading-relaxed">
            Has validado exitosamente el <strong>100%</strong> de los ítems requeridos. La matriz está lista para ser exportada.
          </p>

          <div className="w-full space-y-3">
            <button 
                onClick={() => {
                    onDownload();
                    onClose();
                }}
                className="w-full py-3.5 px-4 bg-gray-900 text-white rounded-xl font-bold shadow-lg hover:bg-black hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 group"
            >
                <FileText className="h-5 w-5" />
                Descargar Reporte PDF
                <ArrowRight className="h-4 w-4 opacity-50 group-hover:translate-x-1 transition-transform" />
            </button>

            <button 
                onClick={onClose}
                className="w-full py-3 px-4 bg-white text-gray-500 font-bold text-sm hover:text-gray-800 transition-colors"
            >
                Volver al Tablero
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
