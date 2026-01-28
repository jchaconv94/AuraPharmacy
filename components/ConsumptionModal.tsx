
import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertTriangle, CheckCircle, Calculator, ArrowRight, Save, ShieldCheck, ChevronLeft, ChevronRight, FastForward, SkipForward, Timer, Lock, Clock } from 'lucide-react';
import { AnalyzedMedication, StockStatus } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface ConsumptionModalProps {
  medication: AnalyzedMedication | null;
  isOpen: boolean;
  onClose: () => void;
  referenceDate?: string; // YYYY-MM
  onUpdate: (id: string, quantity: number) => void;
  
  // Review Props
  isReviewed: boolean;
  onToggleReview: (id: string, isReviewed: boolean) => void;
  
  // Navigation Props
  nextReviewId?: string; // The ID of the NEXT item that needs review
  onNavigate?: (id: string) => void;
  prevItemId?: string | null;
  nextItemId?: string | null;
}

export const ConsumptionModal: React.FC<ConsumptionModalProps> = ({ 
    medication, 
    isOpen, 
    onClose, 
    referenceDate, 
    onUpdate,
    isReviewed,
    onToggleReview,
    nextReviewId,
    onNavigate,
    prevItemId,
    nextItemId
}) => {
  const { systemConfig } = useAuth(); // Access global config
  const [reqQuantity, setReqQuantity] = useState<number>(0);
  const [initialQuantity, setInitialQuantity] = useState<number | null>(null);
  
  // Security Timer State
  const [lockTimer, setLockTimer] = useState(0);

  // Check if this item is eligible for review (Everything except SOBRESTOCK and SIN_ROTACION)
  const needsReview = medication ? (
      medication.status !== StockStatus.SOBRESTOCK && 
      medication.status !== StockStatus.SIN_ROTACION
  ) : false;

  // Should we lock the UI? Only if it needs review and hasn't been reviewed yet.
  const isLocked = lockTimer > 0 && needsReview && !isReviewed;

  // Initialize state when medication opens or changes
  useEffect(() => {
    if (medication) {
        setReqQuantity(medication.quantityToOrder || 0);
        setInitialQuantity(medication.quantityToOrder || 0); 

        // Start Countdown ONLY if it needs review and is not validated yet
        if (needsReview && !isReviewed) {
            // Use config value, default to 5 if undefined for some reason
            const delay = systemConfig?.verificationDelaySeconds ?? 5;
            setLockTimer(delay); 
            
            if (delay > 0) {
                const timer = setInterval(() => {
                    setLockTimer((prev) => {
                        if (prev <= 1) {
                            clearInterval(timer);
                            return 0;
                        }
                        return prev - 1;
                    });
                }, 1000);
                return () => clearInterval(timer);
            }
        } else {
            setLockTimer(0);
        }
    }
  }, [medication?.id, needsReview, isReviewed, systemConfig.verificationDelaySeconds]); // Dependency on ID triggers reset on navigation

  const handleQuantityChange = (val: number) => {
    setReqQuantity(val);
    if (medication) {
        onUpdate(medication.id, val);
    }
  };

  const handleConfirmAndNext = useCallback(() => {
      if (!medication || isLocked) return;
      
      // 1. Confirm current item
      onToggleReview(medication.id, true);

      // 2. Navigate or Close
      if (nextReviewId && onNavigate) {
          onNavigate(nextReviewId);
      } else {
          onClose();
      }
  }, [medication, nextReviewId, onNavigate, onToggleReview, onClose, isLocked]);

  const handleUncheck = () => {
      if (medication) {
          onToggleReview(medication.id, false);
      }
  };

  // Keyboard Shortcuts
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (!isOpen || !medication) return;
          
          // BLOCK ALL SHORTCUTS IF LOCKED
          if (isLocked) return;

          // Enter to Confirm & Next (only if it needs review)
          if (e.key === 'Enter' && needsReview) {
              e.preventDefault();
              handleConfirmAndNext();
          }
          // Left/Right arrows for manual navigation (if not editing input)
          if (e.target instanceof HTMLInputElement) return; 
          
          if (e.key === 'ArrowRight' && nextItemId && onNavigate) {
              onNavigate(nextItemId);
          }
          if (e.key === 'ArrowLeft' && prevItemId && onNavigate) {
              onNavigate(prevItemId);
          }
      };
      
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, medication, nextItemId, prevItemId, onNavigate, handleConfirmAndNext, needsReview, isLocked]);


  if (!isOpen || !medication) return null;

  // Logic to generate dynamic headers
  const generateMonthLabels = (): string[] => {
      const labels: string[] = [];
      if (!referenceDate) {
          return ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
      }

      const [yearStr, monthStr] = referenceDate.split('-');
      const refDate = new Date(parseInt(yearStr), parseInt(monthStr) - 1, 1);

      for (let i = 0; i < 12; i++) {
         const d = new Date(refDate);
         const offset = 11 - i;
         d.setMonth(d.getMonth() - offset);
         
         const monthName = d.toLocaleString('es-ES', { month: 'short' }).toUpperCase().replace('.', '');
         const yearShort = d.getFullYear().toString().slice(2);
         labels.push(`${monthName} ${yearShort}`);
      }
      return labels;
  };

  const monthsLabels = generateMonthLabels();

  // Calculations for the Simulation
  const coverageFromOrder = medication.cpm > 0 ? (reqQuantity / medication.cpm) : 0;
  const totalProjectedCoverage = (isFinite(medication.monthsOfProvision) ? medication.monthsOfProvision : 0) + coverageFromOrder;

  const getStatusConfig = (status: StockStatus) => {
    switch (status) {
      case StockStatus.DESABASTECIDO:
        return { bg: "bg-red-50", border: "border-red-200", text: "text-red-800", label: "text-red-600" };
      case StockStatus.SUBSTOCK:
        return { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-800", label: "text-amber-600" };
      case StockStatus.NORMOSTOCK:
        return { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-800", label: "text-emerald-600" };
      case StockStatus.SOBRESTOCK:
        return { bg: "bg-indigo-50", border: "border-indigo-200", text: "text-indigo-800", label: "text-indigo-600" };
      case StockStatus.SIN_ROTACION:
        return { bg: "bg-gray-100", border: "border-gray-200", text: "text-gray-800", label: "text-gray-500" };
      default:
        return { bg: "bg-gray-50", border: "border-gray-200", text: "text-gray-800", label: "text-gray-500" };
    }
  };

  const statusConfig = getStatusConfig(medication.status);

  // Helper function to handle close (respecting lock)
  const handleCloseAttempt = () => {
      if (!isLocked) onClose();
  };

  // Max Delay Reference for progress bar calculation
  const maxDelay = systemConfig?.verificationDelaySeconds || 5;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in duration-200 overflow-y-auto">
      <div className={`bg-white rounded-xl shadow-2xl w-full max-w-7xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] sm:max-h-none h-auto sm:h-auto my-auto ${isReviewed ? 'ring-4 ring-teal-500/30' : ''}`}>
        
        {/* Header - Redesigned for High Impact */}
        <div className={`px-4 py-5 sm:px-8 sm:py-6 flex justify-between items-start shrink-0 ${isReviewed ? 'bg-teal-800' : 'bg-gray-900'} transition-colors duration-300`}>
          <div className="text-white w-full pr-8">
            {/* Top Row: Label & Badges */}
            <div className="flex flex-wrap items-center gap-3 mb-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    Análisis Detallado
                </span>
                
                {medication.hasSpikes && (
                    <span className="bg-yellow-400 text-black text-[10px] px-2 py-0.5 rounded font-black whitespace-nowrap shadow-sm">
                    PICO ANORMAL DETECTADO
                    </span>
                )}
                {medication.isSporadic && (
                    <span className="bg-purple-200 text-purple-900 text-[10px] px-2 py-0.5 rounded font-black whitespace-nowrap shadow-sm flex items-center gap-1">
                        <Timer className="h-3 w-3" /> BAJA ROTACIÓN
                    </span>
                )}
                {isReviewed && (
                    <span className="bg-teal-100 text-teal-900 text-[10px] px-2 py-0.5 rounded font-black whitespace-nowrap flex items-center gap-1 shadow-sm">
                        <CheckCircle className="h-3 w-3" /> VALIDADO
                    </span>
                )}
            </div>
            
            {/* Main Content: ID & Name Emphasis */}
            <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="font-mono text-teal-400 font-bold text-2xl tracking-tighter bg-black/20 px-2 py-0.5 rounded border border-white/5">
                        {medication.id}
                    </span>
                    <h2 className="text-xl sm:text-3xl font-black leading-tight text-white tracking-tight uppercase">
                        {medication.name}
                    </h2>
                </div>
                {medication.ff && (
                   <p className="text-gray-400 text-xs sm:text-sm font-medium mt-1">
                      {medication.ff}
                   </p>
                )}
            </div>
          </div>
          
          <div className="flex items-center gap-2 -mr-2 -mt-2">
            {/* Manual Navigation Arrows */}
            {onNavigate && (
                <div className="flex bg-white/10 rounded-lg mr-2">
                    <button 
                        onClick={() => prevItemId && !isLocked && onNavigate(prevItemId)}
                        disabled={!prevItemId || isLocked}
                        className="p-2 text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent rounded-l-lg transition-colors"
                        title="Anterior (Flecha Izq)"
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </button>
                    <div className="w-px bg-white/20 my-2"></div>
                    <button 
                        onClick={() => nextItemId && !isLocked && onNavigate(nextItemId)}
                        disabled={!nextItemId || isLocked}
                        className="p-2 text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent rounded-r-lg transition-colors"
                        title="Siguiente (Flecha Der)"
                    >
                        <ChevronRight className="h-5 w-5" />
                    </button>
                </div>
            )}
            
            <button 
                onClick={handleCloseAttempt} 
                disabled={isLocked}
                className={`transition-all p-2 rounded-full ${isLocked ? 'text-gray-600 opacity-50 cursor-not-allowed' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
            >
                {isLocked ? <Lock className="h-6 w-6" /> : <X className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto max-h-[70vh] sm:max-h-[80vh]">
          
          <div className="mb-6 flex flex-wrap gap-4 text-sm items-stretch">
             {/* Read-only Stats */}
             <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full lg:w-auto">
                <div className="bg-gray-100 px-3 py-2 rounded-lg flex flex-col justify-center">
                    <span className="text-gray-500 block text-[10px] uppercase">Stock</span>
                    <span className="font-bold text-gray-900 text-lg sm:text-2xl">{(medication.currentStock || 0).toLocaleString()}</span>
                </div>
                <div className="bg-teal-50 px-3 py-2 rounded-lg border border-teal-100 flex flex-col justify-center">
                    <span className="text-teal-600 block text-[10px] uppercase font-bold">CPA Ajust.</span>
                    <span className="font-bold text-teal-800 text-lg sm:text-2xl">{(medication.cpm || 0).toFixed(1)}</span>
                </div>
                <div className="bg-gray-50 px-3 py-2 rounded-lg border border-gray-200 flex flex-col justify-center">
                    <span className="text-gray-500 block text-[10px] uppercase">CPA Simple</span>
                    <span className="font-bold text-gray-700 text-lg sm:text-2xl line-through decoration-red-400">{(medication.rawCpm || 0).toFixed(1)}</span>
                </div>
                <div className="bg-blue-50 px-3 py-2 rounded-lg border border-blue-100 flex flex-col justify-center">
                    <span className="text-blue-600 block text-[10px] uppercase font-bold">Meses Disp.</span>
                    <span className="font-bold text-blue-800 text-lg sm:text-2xl">
                    {isFinite(medication.monthsOfProvision || 0) ? (medication.monthsOfProvision || 0).toFixed(1) : '∞'}
                    </span>
                </div>
             </div>
             
             <div className={`${statusConfig.bg} px-4 py-2 rounded-lg border ${statusConfig.border} flex flex-col justify-center w-full lg:w-auto`}>
                <span className={`${statusConfig.label} block text-[10px] uppercase font-bold`}>Estado</span>
                <span className={`font-bold ${statusConfig.text} text-xl`}>
                   {medication.status}
                </span>
             </div>

             {/* Dynamic Calculation Area */}
             <div className="w-full lg:flex-1 bg-gray-900 text-white rounded-lg shadow-md p-3 flex flex-col sm:flex-row items-center gap-4 border border-gray-700 lg:ml-auto">
                <div className="flex flex-row sm:flex-col gap-2 items-center w-full sm:w-auto justify-between sm:justify-start">
                    <label className="text-[10px] font-bold uppercase text-teal-400 flex items-center gap-1">
                        <Calculator className="h-3 w-3" />
                        Requerimiento
                    </label>
                    <input 
                        type="number" 
                        min="0"
                        value={reqQuantity}
                        onChange={(e) => handleQuantityChange(Number(e.target.value))}
                        className="w-24 sm:w-28 px-2 py-1 rounded bg-gray-800 border border-gray-600 text-white font-bold text-lg focus:ring-2 focus:ring-teal-500 outline-none text-center"
                    />
                </div>
                
                <ArrowRight className="h-5 w-5 text-gray-500 hidden sm:block" />

                <div className="flex flex-col flex-1 w-full gap-2 sm:gap-0">
                    <div className="flex justify-between items-baseline mb-0 sm:mb-2">
                        <span className="text-[10px] uppercase text-gray-400">Cobertura Pedido</span>
                        <span className="font-bold text-teal-300 text-lg leading-tight">
                            +{(coverageFromOrder || 0).toFixed(1)} Meses
                        </span>
                    </div>
                    
                    <div className="border-t border-gray-700 pt-2 mt-auto flex justify-between items-baseline">
                        <span className="text-[10px] uppercase text-gray-400">Total Proyectado</span>
                        <span className="font-bold text-white text-lg leading-tight">
                             {isFinite(totalProjectedCoverage) ? (totalProjectedCoverage || 0).toFixed(1) : '∞'} Meses
                        </span>
                    </div>
                </div>
             </div>
          </div>

          <div className="border rounded-lg overflow-hidden overflow-x-auto">
             <table className="w-full text-sm border-collapse min-w-[600px]">
                <thead>
                    <tr className="bg-black text-white">
                        <th className="p-3 text-left border-r border-gray-700 w-32 sticky left-0 bg-black z-10">CONCEPTO</th>
                        {medication.originalHistory.map((_, idx) => (
                            <th key={idx} className="p-3 text-center w-20 border-r border-gray-700 last:border-0 whitespace-nowrap">
                                {monthsLabels[idx] || `M${idx + 1}`}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    <tr className="border-b border-gray-200">
                        <td className="p-3 font-bold text-gray-700 bg-gray-50 border-r border-gray-200 sticky left-0 z-10">
                            CONSUMO
                        </td>
                        {medication.originalHistory.map((val, idx) => {
                            // Logic: If value > threshold AND value > 0, it's a spike.
                            const isSpike = val > (medication.spikeThreshold || 0) && val > 0;
                            
                            return (
                                <td 
                                    key={idx} 
                                    className={`p-3 text-center font-mono text-base border-r border-gray-200 last:border-0 ${
                                        isSpike ? 'bg-yellow-300 font-bold text-black' : 'bg-white text-gray-600'
                                    }`}
                                >
                                    {val}
                                </td>
                            );
                        })}
                    </tr>
                </tbody>
             </table>
          </div>

          <div className="mt-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
             <h4 className="font-bold text-sm text-gray-800 mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Criterio de Auditoría (Ficha 30)
             </h4>
             <ul className="list-disc list-inside text-xs text-gray-600 space-y-1">
                <li>
                    Se calculó la mediana histórica de los meses con movimiento.
                </li>
                <li>
                    El umbral de tolerancia se fijó en <strong>{(medication.spikeThreshold || 0).toFixed(1)}</strong> unidades.
                </li>
                <li>
                    Los meses pintados en <span className="bg-yellow-300 px-1 rounded text-black font-bold">AMARILLO</span> superan este umbral.
                </li>
             </ul>
          </div>

        </div>

        {/* Footer */}
        <div className="bg-gray-50 p-4 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0">
            <div className="text-xs text-gray-500 hidden sm:block">
                {needsReview ? (
                   !isLocked ? (
                       <span className="flex items-center gap-2">
                           <span className="bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded border border-gray-300 font-mono">ENTER</span>
                           <span>para confirmar y avanzar</span>
                       </span>
                   ) : (
                       <span className="flex items-center gap-2 text-amber-600 font-medium">
                           <Clock className="h-3.5 w-3.5" />
                           <span>Por favor, revise los datos antes de validar.</span>
                       </span>
                   )
                ) : (
                   "Este ítem no requiere validación (Sobrestock/Sin Rotación)."
                )}
            </div>

            <div className="flex w-full sm:w-auto gap-3">
                {/* Secondary Button for simple close */}
                <button 
                    onClick={handleCloseAttempt}
                    disabled={isLocked}
                    className={`flex-1 sm:flex-none px-4 py-3 sm:py-2 rounded-lg border font-medium text-sm transition-all ${
                        isLocked 
                        ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' 
                        : 'text-gray-700 bg-white border-gray-300 hover:bg-gray-100'
                    }`}
                >
                    Cancelar
                </button>

                {/* Primary Action */}
                {needsReview ? (
                    isReviewed ? (
                         // If already reviewed, allow uncheck (red button)
                         <button 
                            onClick={handleUncheck}
                            className="flex-1 sm:flex-none px-6 py-3 sm:py-2 rounded-lg text-white font-bold text-sm transition-all flex justify-center items-center gap-2 shadow-sm bg-red-600 hover:bg-red-700"
                        >
                            <X className="h-4 w-4" />
                            Desmarcar Revisión
                        </button>
                    ) : (
                        // If pending review, Primary Action is Confirm & Next (if applicable)
                        // WITH LOCK LOGIC
                        <button 
                            onClick={handleConfirmAndNext}
                            disabled={isLocked}
                            className={`flex-1 sm:flex-none px-6 py-3 sm:py-2 rounded-lg font-bold text-sm transition-all flex justify-center items-center gap-2 shadow-md relative overflow-hidden ${
                                isLocked 
                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                                : 'bg-teal-600 text-white hover:bg-teal-700 hover:scale-[1.02] active:scale-95'
                            }`}
                        >
                            {isLocked ? (
                                <>
                                    <Clock className="h-4 w-4 animate-pulse" />
                                    <span>ESPERE ({lockTimer}s)</span>
                                    {/* Progress Bar Background */}
                                    <div 
                                        className="absolute bottom-0 left-0 h-1 bg-amber-400 transition-all duration-1000 ease-linear"
                                        style={{ width: `${(lockTimer / maxDelay) * 100}%` }}
                                    />
                                </>
                            ) : (
                                <>
                                    <ShieldCheck className="h-4 w-4" />
                                    {nextReviewId ? "VALIDAR Y SIGUIENTE" : "VALIDAR Y FINALIZAR"}
                                    {nextReviewId && <SkipForward className="h-4 w-4 ml-1 opacity-70" />}
                                </>
                            )}
                        </button>
                    )
                ) : (
                    <button 
                        onClick={onClose}
                        className="flex-1 sm:flex-none px-6 py-3 sm:py-2 rounded-lg bg-gray-900 text-white font-bold text-sm hover:bg-gray-800 transition-all"
                    >
                        Guardar Cambios
                    </button>
                )}
            </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
