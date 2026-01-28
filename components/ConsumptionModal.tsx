
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertTriangle, CheckCircle, Calculator, ArrowRight, ShieldCheck, ChevronLeft, ChevronRight, SkipForward, Timer, Lock, Clock, MousePointerClick, Unlock, ChevronDown, Save } from 'lucide-react';
import { AnalyzedMedication, StockStatus } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface ConsumptionModalProps {
  medication: AnalyzedMedication | null;
  isOpen: boolean;
  onClose: () => void;
  referenceDate?: string; // YYYY-MM
  onUpdate: (id: string, quantity: number, mode?: 'ADJUSTED' | 'SIMPLE') => void;
  
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
  const { systemConfig } = useAuth();
  const [reqQuantity, setReqQuantity] = useState<number>(0);
  
  // STATE: CPA MODE SELECTION
  const [cpaMode, setCpaMode] = useState<'ADJUSTED' | 'SIMPLE'>('ADJUSTED');
  
  // Security Timer State
  const [lockTimer, setLockTimer] = useState(0);

  // UI STATE: Custom Confirmation for Unlock (Replaces window.confirm)
  const [showUnlockConfirm, setShowUnlockConfirm] = useState(false);

  // UI STATE: Split Button Menu
  const [showSaveMenu, setShowSaveMenu] = useState(false);
  const saveMenuRef = useRef<HTMLDivElement>(null);

  // --- 1. DYNAMIC RE-CALCULATION LOGIC ---
  const dynamicData = useMemo(() => {
      if (!medication) return null;

      const activeCpm = cpaMode === 'SIMPLE' ? medication.rawCpm : medication.cpm;
      
      const activeMonths = activeCpm > 0 
          ? medication.currentStock / activeCpm 
          : (medication.currentStock > 0 ? Infinity : 0);

      let activeStatus = StockStatus.NORMOSTOCK;
      if (medication.currentStock === 0) {
          activeStatus = StockStatus.DESABASTECIDO;
      } else if (activeCpm === 0 && medication.currentStock > 0) {
          activeStatus = StockStatus.SIN_ROTACION;
      } else if (activeMonths > 6) {
          activeStatus = StockStatus.SOBRESTOCK;
      } else if (activeMonths >= 2 && activeMonths <= 6) {
          activeStatus = StockStatus.NORMOSTOCK;
      } else {
          activeStatus = StockStatus.SUBSTOCK;
      }

      let suggestedReq = 0;
      const MIN_SAFETY_STOCK = 2;

      if (activeStatus !== StockStatus.SOBRESTOCK && activeStatus !== StockStatus.SIN_ROTACION) {
          let targetStock = 0;
          if (medication.isSporadic) {
               targetStock = activeCpm * 3;
          } else {
               targetStock = activeCpm * 6;
          }
          targetStock = Math.max(targetStock, MIN_SAFETY_STOCK);
          if (medication.currentStock < targetStock) {
              suggestedReq = Math.ceil(targetStock - medication.currentStock);
          }
      }

      return {
          cpm: activeCpm,
          months: activeMonths,
          status: activeStatus,
          suggestedReq: suggestedReq
      };
  }, [medication, cpaMode]);

  const needsReview = medication ? (
      medication.status !== StockStatus.SOBRESTOCK && 
      medication.status !== StockStatus.SIN_ROTACION
  ) : false;

  const isLockedTimer = lockTimer > 0 && needsReview && !isReviewed;

  // EFFECT 1: INITIALIZATION (Only on ID change)
  useEffect(() => {
    if (medication) {
        setCpaMode(medication.selectedCpaMode || 'ADJUSTED');
        setReqQuantity(medication.quantityToOrder || 0);
        setShowUnlockConfirm(false); // Reset confirmation state on item change
        setShowSaveMenu(false); // Close menu on change
    }
  }, [medication?.id]); 

  // EFFECT 2: TIMER LOGIC
  useEffect(() => {
      if (needsReview && !isReviewed) {
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
  }, [medication?.id, needsReview, isReviewed, systemConfig.verificationDelaySeconds]);

  // EFFECT 3: AUTO-UPDATE (Only when CPA Mode changes AND NOT Reviewed)
  useEffect(() => {
      if (dynamicData && !isReviewed) {
          setReqQuantity(dynamicData.suggestedReq);
      }
  }, [cpaMode, isReviewed, dynamicData?.suggestedReq]);

  // EFFECT 4: CLICK OUTSIDE LISTENER FOR MENU
  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (saveMenuRef.current && !saveMenuRef.current.contains(event.target as Node)) {
              setShowSaveMenu(false);
          }
      };
      if (showSaveMenu) {
          document.addEventListener('mousedown', handleClickOutside);
      }
      return () => {
          document.removeEventListener('mousedown', handleClickOutside);
      };
  }, [showSaveMenu]);


  const handleQuantityChange = (val: number) => {
    if (isReviewed) return;
    setReqQuantity(val);
    if (medication) {
        onUpdate(medication.id, val, cpaMode);
    }
  };

  const handleConfirmAndNext = useCallback(() => {
      if (!medication || isLockedTimer) return;
      
      onUpdate(medication.id, reqQuantity, cpaMode);
      onToggleReview(medication.id, true);

      if (nextReviewId && onNavigate) {
          onNavigate(nextReviewId);
      } else {
          onClose();
      }
  }, [medication, nextReviewId, onNavigate, onToggleReview, onClose, isLockedTimer, reqQuantity, cpaMode, onUpdate]);

  const handleConfirmAndStay = useCallback(() => {
      if (!medication || isLockedTimer) return;
      
      onUpdate(medication.id, reqQuantity, cpaMode);
      onToggleReview(medication.id, true);
      setShowSaveMenu(false);
      // No navigate called here, so user stays on the validated item
  }, [medication, onUpdate, onToggleReview, isLockedTimer, reqQuantity, cpaMode]);

  const handleManualSave = () => {
      if (!medication) return;
      onUpdate(medication.id, reqQuantity, cpaMode);
      onClose();
  };

  // --- LOGIC TO EXECUTE UNLOCK (Called after confirmation) ---
  const executeUnlock = () => {
      if (!medication) return;
      
      const systemValue = dynamicData?.suggestedReq || 0;
      
      // 1. Reset Local State & Parent State to System Value immediately
      setReqQuantity(systemValue);
      onUpdate(medication.id, systemValue, cpaMode);

      // 2. Unlock (Triggers timer)
      onToggleReview(medication.id, false);
      
      // 3. Close custom modal
      setShowUnlockConfirm(false);
  };

  // --- HANDLER BUTTON CLICK ---
  const handleUncheckClick = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (!medication) return;

      const systemValue = dynamicData?.suggestedReq || 0;
      
      // Logic: If manual value differs, SHOW CUSTOM UI instead of window.confirm
      if (reqQuantity !== systemValue) {
          setShowUnlockConfirm(true);
      } else {
          // If values are same, no need to confirm loss of data
          executeUnlock();
      }
  };

  // Keyboard Shortcuts
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (!isOpen || !medication) return;
          if (showUnlockConfirm) return; // Disable shortcuts if confirm modal is open

          if (isLockedTimer) return;

          if (e.key === 'Enter' && needsReview && !isReviewed) {
              e.preventDefault();
              handleConfirmAndNext();
          }
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
  }, [isOpen, medication, nextItemId, prevItemId, onNavigate, handleConfirmAndNext, needsReview, isLockedTimer, isReviewed, showUnlockConfirm]);


  if (!isOpen || !medication || !dynamicData) return null;

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
  const coverageFromOrder = dynamicData.cpm > 0 ? (reqQuantity / dynamicData.cpm) : 0;
  const totalProjectedCoverage = (isFinite(dynamicData.months) ? dynamicData.months : 0) + coverageFromOrder;

  const getStatusConfig = (status: StockStatus) => {
    switch (status) {
      case StockStatus.DESABASTECIDO: return { bg: "bg-red-50", border: "border-red-200", text: "text-red-800", label: "text-red-600" };
      case StockStatus.SUBSTOCK: return { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-800", label: "text-amber-600" };
      case StockStatus.NORMOSTOCK: return { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-800", label: "text-emerald-600" };
      case StockStatus.SOBRESTOCK: return { bg: "bg-indigo-50", border: "border-indigo-200", text: "text-indigo-800", label: "text-indigo-600" };
      case StockStatus.SIN_ROTACION: return { bg: "bg-gray-100", border: "border-gray-200", text: "text-gray-800", label: "text-gray-500" };
      default: return { bg: "bg-gray-50", border: "border-gray-200", text: "text-gray-800", label: "text-gray-500" };
    }
  };

  const statusConfig = getStatusConfig(dynamicData.status);

  const handleCloseAttempt = () => {
      if (!isLockedTimer && !showUnlockConfirm) onClose();
  };

  const maxDelay = systemConfig?.verificationDelaySeconds || 5;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in duration-200 overflow-y-auto">
      <div className={`bg-white rounded-xl shadow-2xl w-full max-w-7xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] sm:max-h-none h-auto sm:h-auto my-auto ${isReviewed ? 'ring-4 ring-teal-500/30' : ''} relative`}>
        
        {/* --- CUSTOM CONFIRMATION OVERLAY --- */}
        {showUnlockConfirm && (
            <div className="absolute inset-0 z-50 bg-white/70 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
                <div className="bg-white border border-red-200 shadow-2xl rounded-2xl p-6 max-w-sm w-full text-center ring-4 ring-red-50">
                    <div className="bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertTriangle className="h-8 w-8 text-red-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">¿Restaurar cálculo automático?</h3>
                    <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                        El valor manual ingresado (<strong>{reqQuantity}</strong>) se perderá y se volverá a recalcular el monto requerido.
                    </p>
                    <div className="flex gap-3">
                        <button 
                            onClick={() => setShowUnlockConfirm(false)}
                            className="flex-1 py-3 px-4 bg-white border border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={executeUnlock}
                            className="flex-1 py-3 px-4 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors shadow-md"
                        >
                            Confirmar
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Header */}
        <div className={`px-4 py-5 sm:px-8 sm:py-6 flex justify-between items-start shrink-0 ${isReviewed ? 'bg-teal-800' : 'bg-gray-900'} transition-colors duration-300`}>
          <div className="text-white w-full pr-8">
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
                        <CheckCircle className="h-3 w-3" /> VALIDADO Y BLOQUEADO
                    </span>
                )}
            </div>
            
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
            {onNavigate && (
                <div className="flex bg-white/10 rounded-lg mr-2">
                    <button 
                        onClick={() => prevItemId && !isLockedTimer && onNavigate(prevItemId)}
                        disabled={!prevItemId || isLockedTimer}
                        className="p-2 text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent rounded-l-lg transition-colors"
                        title="Anterior (Flecha Izq)"
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </button>
                    <div className="w-px bg-white/20 my-2"></div>
                    <button 
                        onClick={() => nextItemId && !isLockedTimer && onNavigate(nextItemId)}
                        disabled={!nextItemId || isLockedTimer}
                        className="p-2 text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent rounded-r-lg transition-colors"
                        title="Siguiente (Flecha Der)"
                    >
                        <ChevronRight className="h-5 w-5" />
                    </button>
                </div>
            )}
            
            <button 
                onClick={handleCloseAttempt} 
                disabled={isLockedTimer}
                className={`transition-all p-2 rounded-full ${isLockedTimer ? 'text-gray-600 opacity-50 cursor-not-allowed' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
            >
                {isLockedTimer ? <Lock className="h-6 w-6" /> : <X className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto max-h-[70vh] sm:max-h-[80vh]">
          
          <div className="mb-6 flex flex-wrap gap-4 text-sm items-stretch">
             {/* Read-only Stats & Selection */}
             <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full lg:w-auto">
                <div className="bg-gray-100 px-3 py-2 rounded-lg flex flex-col justify-center">
                    <span className="text-gray-500 block text-[10px] uppercase">Stock</span>
                    <span className="font-bold text-gray-900 text-lg sm:text-2xl">{(medication.currentStock || 0).toLocaleString()}</span>
                </div>

                {/* CPA AJUSTADO CARD */}
                <button 
                    onClick={() => !isReviewed && setCpaMode('ADJUSTED')}
                    disabled={isReviewed}
                    className={`px-3 py-2 rounded-lg border flex flex-col justify-center transition-all relative overflow-hidden group ${
                        cpaMode === 'ADJUSTED' 
                        ? 'bg-teal-50 border-teal-500 shadow-md ring-1 ring-teal-500' 
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    } ${isReviewed ? 'opacity-70 cursor-not-allowed grayscale-[0.5]' : ''}`}
                >
                    <div className="flex justify-between items-center w-full">
                        <span className={`${cpaMode === 'ADJUSTED' ? 'text-teal-700' : 'text-gray-500'} block text-[10px] uppercase font-bold`}>CPA Ajust.</span>
                        {cpaMode === 'ADJUSTED' && <CheckCircle className="h-3 w-3 text-teal-600" />}
                    </div>
                    <span className={`font-bold text-lg sm:text-2xl ${cpaMode === 'ADJUSTED' ? 'text-teal-800' : 'text-gray-400'}`}>
                        {(medication.cpm || 0).toFixed(1)}
                    </span>
                </button>

                {/* CPA SIMPLE CARD */}
                <button 
                     onClick={() => !isReviewed && setCpaMode('SIMPLE')}
                     disabled={isReviewed}
                     className={`px-3 py-2 rounded-lg border flex flex-col justify-center transition-all relative overflow-hidden group ${
                        cpaMode === 'SIMPLE' 
                        ? 'bg-blue-50 border-blue-500 shadow-md ring-1 ring-blue-500' 
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    } ${isReviewed ? 'opacity-70 cursor-not-allowed grayscale-[0.5]' : ''}`}
                >
                    <div className="flex justify-between items-center w-full">
                        <span className={`${cpaMode === 'SIMPLE' ? 'text-blue-700' : 'text-gray-500'} block text-[10px] uppercase font-bold`}>CPA Simple</span>
                        {cpaMode === 'SIMPLE' && <CheckCircle className="h-3 w-3 text-blue-600" />}
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={`font-bold text-lg sm:text-2xl ${cpaMode === 'SIMPLE' ? 'text-blue-800' : 'text-gray-400'} ${medication.hasSpikes && cpaMode !== 'SIMPLE' ? 'line-through decoration-red-400' : ''}`}>
                            {(medication.rawCpm || 0).toFixed(1)}
                        </span>
                        {medication.hasSpikes && cpaMode !== 'SIMPLE' && (
                            <MousePointerClick className="h-4 w-4 text-gray-400 opacity-50" />
                        )}
                    </div>
                </button>

                <div className="bg-blue-50 px-3 py-2 rounded-lg border border-blue-100 flex flex-col justify-center transition-all duration-300">
                    <span className="text-blue-600 block text-[10px] uppercase font-bold">Meses Disp.</span>
                    <span className="font-bold text-blue-800 text-lg sm:text-2xl">
                    {isFinite(dynamicData.months || 0) ? (dynamicData.months || 0).toFixed(1) : '∞'}
                    </span>
                </div>
             </div>
             
             <div className={`${statusConfig.bg} px-4 py-2 rounded-lg border ${statusConfig.border} flex flex-col justify-center w-full lg:w-auto transition-colors duration-300`}>
                <span className={`${statusConfig.label} block text-[10px] uppercase font-bold`}>Estado</span>
                <span className={`font-bold ${statusConfig.text} text-xl`}>
                   {dynamicData.status}
                </span>
             </div>

             {/* Dynamic Calculation Area */}
             <div className={`w-full lg:flex-1 text-white rounded-lg shadow-md p-3 flex flex-col sm:flex-row items-center gap-4 border lg:ml-auto transition-colors ${isReviewed ? 'bg-teal-900 border-teal-700' : 'bg-gray-900 border-gray-700'}`}>
                <div className="flex flex-row sm:flex-col gap-2 items-center w-full sm:w-auto justify-between sm:justify-start">
                    <label className="text-[10px] font-bold uppercase text-teal-400 flex items-center gap-1">
                        {isReviewed ? <Lock className="h-3 w-3" /> : <Calculator className="h-3 w-3" />}
                        {isReviewed ? "Validado" : "Requerimiento"}
                    </label>
                    <input 
                        type="number" 
                        min="0"
                        value={reqQuantity}
                        onChange={(e) => handleQuantityChange(Number(e.target.value))}
                        disabled={isReviewed}
                        className={`w-24 sm:w-28 px-2 py-1 rounded border font-bold text-lg focus:ring-2 focus:ring-teal-500 outline-none text-center ${
                            isReviewed 
                            ? 'bg-black/20 border-white/10 text-gray-300 cursor-not-allowed' 
                            : 'bg-gray-800 border-gray-600 text-white'
                        }`}
                    />
                </div>
                
                <ArrowRight className={`h-5 w-5 hidden sm:block ${isReviewed ? 'text-teal-600' : 'text-gray-500'}`} />

                <div className="flex flex-col flex-1 w-full gap-2 sm:gap-0">
                    <div className="flex justify-between items-baseline mb-0 sm:mb-2">
                        <span className="text-[10px] uppercase text-gray-400">Cobertura Pedido</span>
                        <span className="font-bold text-teal-300 text-lg leading-tight">
                            +{(coverageFromOrder || 0).toFixed(1)} Meses
                        </span>
                    </div>
                    
                    <div className={`border-t pt-2 mt-auto flex justify-between items-baseline ${isReviewed ? 'border-teal-800' : 'border-gray-700'}`}>
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
                            const isSpike = val > (medication.spikeThreshold || 0) && val > 0;
                            const cellBg = isSpike 
                                ? (cpaMode === 'SIMPLE' ? 'bg-blue-100 text-blue-900 font-bold' : 'bg-yellow-300 font-bold text-black')
                                : 'bg-white text-gray-600';

                            return (
                                <td 
                                    key={idx} 
                                    className={`p-3 text-center font-mono text-base border-r border-gray-200 last:border-0 ${cellBg}`}
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
                    {cpaMode === 'ADJUSTED' 
                        ? <>Los meses pintados en <span className="bg-yellow-300 px-1 rounded text-black font-bold">AMARILLO</span> se excluyen del cálculo.</>
                        : <>MODO MANUAL ACTIVO: Se están considerando todos los meses (incluso atípicos) para el cálculo.</>
                    }
                </li>
             </ul>
          </div>

        </div>

        {/* Footer */}
        <div className="bg-gray-50 p-4 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0">
            <div className="text-xs text-gray-500 hidden sm:block">
                {needsReview ? (
                   !isLockedTimer ? (
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

            <div className="flex w-full sm:w-auto gap-3 relative">
                <button 
                    onClick={handleCloseAttempt}
                    disabled={isLockedTimer}
                    className={`flex-1 sm:flex-none px-4 py-3 sm:py-2 rounded-lg border font-medium text-sm transition-all ${
                        isLockedTimer 
                        ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' 
                        : 'text-gray-700 bg-white border-gray-300 hover:bg-gray-100'
                    }`}
                >
                    Cancelar
                </button>

                {/* Primary Action Group - Split Button */}
                {needsReview ? (
                    isReviewed ? (
                         <button 
                            type="button"
                            onClick={handleUncheckClick}
                            className="flex-1 sm:flex-none px-6 py-3 sm:py-2 rounded-lg text-white font-bold text-sm transition-all flex justify-center items-center gap-2 shadow-sm bg-red-600 hover:bg-red-700 active:scale-95"
                        >
                            <Unlock className="h-4 w-4 pointer-events-none" />
                            Desbloquear / Editar
                        </button>
                    ) : (
                        <div className="relative flex shadow-md rounded-lg overflow-visible" ref={saveMenuRef}>
                            {/* Main Button Part */}
                            <button 
                                onClick={handleConfirmAndNext}
                                disabled={isLockedTimer}
                                className={`flex-1 sm:flex-none pl-4 pr-3 py-3 sm:py-2 rounded-l-lg font-bold text-sm transition-all flex justify-center items-center gap-2 relative overflow-hidden ${
                                    isLockedTimer 
                                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                                    : 'bg-teal-600 text-white hover:bg-teal-700 active:scale-95'
                                }`}
                            >
                                {isLockedTimer ? (
                                    <>
                                        <Clock className="h-4 w-4 animate-pulse" />
                                        <span>ESPERE ({lockTimer}s)</span>
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

                            {/* Split Divider & Arrow */}
                            {!isLockedTimer && (
                                <button 
                                    onClick={() => setShowSaveMenu(!showSaveMenu)}
                                    className="bg-teal-700 hover:bg-teal-800 text-white px-2 py-3 sm:py-2 rounded-r-lg border-l border-teal-500 transition-colors flex items-center justify-center"
                                    title="Más opciones"
                                >
                                    <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${showSaveMenu ? 'rotate-180' : ''}`} />
                                </button>
                            )}

                            {/* Dropdown Menu (Popup Above) */}
                            {showSaveMenu && !isLockedTimer && (
                                <div className="absolute bottom-full right-0 mb-2 w-56 bg-white rounded-xl shadow-xl border border-gray-200 py-1 z-50 animate-in fade-in slide-in-from-bottom-2">
                                    <button 
                                        onClick={handleConfirmAndStay}
                                        className="w-full text-left px-4 py-3 text-sm font-medium hover:bg-gray-50 text-gray-700 flex items-center gap-3 transition-colors group"
                                    >
                                        <div className="bg-teal-50 p-1.5 rounded-lg group-hover:bg-teal-100 transition-colors">
                                            <Save className="h-4 w-4 text-teal-600" />
                                        </div>
                                        <div>
                                            <span className="block text-gray-900 font-bold">Validar y Permanecer</span>
                                            <span className="text-[10px] text-gray-500">Guardar sin avanzar al siguiente</span>
                                        </div>
                                    </button>
                                </div>
                            )}
                        </div>
                    )
                ) : (
                    <button 
                        onClick={handleManualSave}
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
