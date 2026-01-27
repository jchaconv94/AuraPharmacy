
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Header } from './components/Header';
import { InputSection } from './components/InputSection';
import { Dashboard } from './components/Dashboard';
import { AnalysisTable } from './components/AnalysisTable';
import { MedicationInput, AuraAnalysisResult, StockStatus, AdditionalItem } from './types';
import { analyzeInventoryWithAura } from './services/auraService';
import { generateFullReportPDF } from './services/pdfService';
import { ReportOptionsModal } from './components/ReportOptionsModal';
import { ReviewWarningModal } from './components/ReviewWarningModal';
import { ManualEntryModal } from './components/ManualEntryModal';
import { Info, FileText, Lock, ShieldCheck, ShieldAlert, ScanLine, Filter, ListFilter } from 'lucide-react';

const STORAGE_KEY = 'aura_data_v1';

const App: React.FC = () => {
  // Initialize state from LocalStorage if available
  const [result, setResult] = useState<AuraAnalysisResult | null>(() => {
    try {
      const savedData = localStorage.getItem(STORAGE_KEY);
      return savedData ? JSON.parse(savedData) : null;
    } catch (e) {
      console.error("Error loading from local storage", e);
      return null;
    }
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- LIFTED STATE FOR FILTERING ---
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>({});
  const [showOnlyPending, setShowOnlyPending] = useState(false); // NEW: Quick Filter State

  // --- REVIEW SYSTEM STATE (ITEM LEVEL) ---
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());
  const [showReviewWarning, setShowReviewWarning] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  
  // --- ADDITIONAL ITEMS STATE ---
  const [additionalItems, setAdditionalItems] = useState<AdditionalItem[]>([]);
  const [isManualEntryModalOpen, setIsManualEntryModalOpen] = useState(false);

  // --- FULL SCREEN STATE (LIFTED) ---
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Save to LocalStorage whenever result changes
  useEffect(() => {
    if (result) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [result]);

  const handleAnalyze = useCallback(async (data: MedicationInput[], referenceDate: string, vaccinesExcluded: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const analysisResult = await analyzeInventoryWithAura(data, referenceDate, vaccinesExcluded);
      setResult(analysisResult);
      // Reset filters and review on new analysis
      setSearchTerm('');
      setActiveFilters({});
      setReviewedIds(new Set()); // Reset reviews
      setShowOnlyPending(false);
      setAdditionalItems([]); // Reset additional items
    } catch (err: any) {
      console.error(err);
      setError("Error al procesar los datos matemáticos. Verifique que su archivo no esté corrupto.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleReset = useCallback(() => {
    setResult(null);
    setSearchTerm('');
    setActiveFilters({});
    setError(null);
    setReviewedIds(new Set());
    setIsFullScreen(false);
    setShowOnlyPending(false);
    setAdditionalItems([]);
  }, []);

  const handleMedicationUpdate = (id: string, newQuantity: number) => {
    if (!result) return;
    setResult((prev) => {
      if (!prev) return null;
      const updatedMedications = prev.medications.map((m) =>
        m.id === id
          ? {
              ...m,
              quantityToOrder: newQuantity,
              estimatedInvestment: newQuantity * m.unitPrice,
            }
          : m
      );
      return {
        ...prev,
        medications: updatedMedications,
      };
    });
  };

  // --- REVIEW LOGIC HANDLERS ---
  const handleToggleReview = (id: string, isReviewed: boolean) => {
      setReviewedIds(prev => {
          const next = new Set(prev);
          if (isReviewed) next.add(id);
          else next.delete(id);
          return next;
      });
  };

  // --- ADDITIONAL ITEMS HANDLERS ---
  const handleAddAdditionalItem = (item: AdditionalItem) => {
      setAdditionalItems(prev => [...prev, item]);
  };

  const handleRemoveAdditionalItem = (id: string) => {
      setAdditionalItems(prev => prev.filter(i => i.id !== id));
  };

  // --- FILTERING LOGIC ---
  const filteredMedications = useMemo(() => {
    if (!result) return [];
    let items = result.medications;

    // 0. Quick Pending Filter (High Priority)
    if (showOnlyPending) {
        items = items.filter(m => m.quantityToOrder > 0 && !reviewedIds.has(m.id));
    }

    // 1. Global Search
    if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        items = items.filter(item => 
            item.name.toLowerCase().includes(lower) ||
            item.id.toLowerCase().includes(lower)
        );
    }

    // 2. Column Filters
    if (Object.keys(activeFilters).length > 0) {
        items = items.filter(item => {
            return Object.entries(activeFilters).every(([key, values]) => {
                const filterValues = values as string[];
                if (!filterValues || filterValues.length === 0) return true;
                const itemValue = String((item as any)[key] || '-');
                return filterValues.includes(itemValue);
            });
        });
    }

    return items;
  }, [result, searchTerm, activeFilters, showOnlyPending, reviewedIds]);

  // --- DASHBOARD DATA & PROGRESS CALCULATION ---
  const dashboardResult = useMemo(() => {
    if (!result) return null;
    
    // Note: Dashboard statistics should probably reflect the FULL dataset, not the filtered one,
    // unless explicitly desired. Here we keep dashboard static based on result, 
    // but the table uses filteredMedications.
    
    // Recalculate indicators based on FULL result to keep dashboard consistent
    const totalItems = result.medications.length;
    const availableItems = result.medications.filter(m => 
        m.status === StockStatus.NORMOSTOCK || 
        m.status === StockStatus.SOBRESTOCK || 
        m.status === StockStatus.SIN_ROTACION
    ).length;
    
    const dmeScore = totalItems > 0 ? (availableItems / totalItems) * 100 : 0;
    
    let indicatorStatus: 'OPTIMO' | 'ALTO' | 'REGULAR' | 'BAJO' = 'BAJO';
    if (dmeScore >= 90) indicatorStatus = 'OPTIMO';
    else if (dmeScore >= 80) indicatorStatus = 'ALTO';
    else if (dmeScore >= 70) indicatorStatus = 'REGULAR';

    return {
        ...result,
        medications: result.medications, // Pass full list to dashboard charts
        indicators: {
            dmeScore,
            status: indicatorStatus,
            totalItems,
            availableItems
        }
    };
  }, [result]);

  // --- PROGRESS CALCULATION (Strict Item Level) ---
  const { reviewProgress, isReviewComplete, reviewedCount, totalToReview } = useMemo(() => {
      if (!result) return { reviewProgress: 0, isReviewComplete: false, reviewedCount: 0, totalToReview: 0 };

      // Filter only items that HAVE A REQUIREMENT (Quantity > 0)
      const itemsRequiringReview = result.medications.filter(m => m.quantityToOrder > 0);
      const totalCount = itemsRequiringReview.length;

      if (totalCount === 0) {
          return { reviewProgress: 100, isReviewComplete: true, reviewedCount: 0, totalToReview: 0 };
      }

      const revCount = itemsRequiringReview.filter(m => reviewedIds.has(m.id)).length;
      const progress = Math.round((revCount / totalCount) * 100);

      return {
          reviewProgress: progress,
          isReviewComplete: revCount === totalCount,
          reviewedCount: revCount,
          totalToReview: totalCount
      };

  }, [result, reviewedIds]);


  // --- DOWNLOAD CLICK HANDLER ---
  const handleDownloadClick = () => {
      if (isReviewComplete) {
          setIsReportModalOpen(true);
      } else {
          setShowReviewWarning(true);
      }
  };

  // --- REPORT GENERATION HANDLER ---
  const handleGenerateReport = (excludeVaccines: boolean, excludeNoSupply: boolean) => {
    if (!dashboardResult) return;

    let finalMedications = [...dashboardResult.medications];

    if (excludeVaccines) {
        finalMedications = finalMedications.filter(m => {
            const name = m.name.toUpperCase();
            return !name.includes("VACUNA") && !name.includes("DILUYENTE");
        });
    }

    if (excludeNoSupply) {
        finalMedications = finalMedications.filter(m => m.quantityToOrder > 0);
    }

    // Now passes additionalItems to the generator
    generateFullReportPDF(dashboardResult, finalMedications, additionalItems);
    setIsReportModalOpen(false);
  };

  return (
    <div className={`min-h-screen bg-gray-50/50 ${isFullScreen ? '' : 'pb-12'}`}>
      
      {/* Hide Header in Zen Mode */}
      {!isFullScreen && <Header />}
      
      <main className={`mx-auto ${isFullScreen ? 'w-full px-0 py-0 max-w-none' : 'max-w-[95%] px-4 sm:px-6 lg:px-8 py-8 space-y-8'}`}>
        
        {/* Intro / Context */}
        {!isFullScreen && !result && !loading && (
          <div className="bg-white border border-teal-100 rounded-2xl p-8 flex gap-6 shadow-sm animate-in fade-in slide-in-from-top-4">
            <div className="bg-teal-50 p-4 rounded-full h-fit shrink-0">
              <Info className="h-8 w-8 text-teal-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Bienvenido al Panel de Control de Aura</h2>
              <p className="text-gray-600 mt-2 max-w-3xl leading-relaxed">
                Ingrese su inventario para recibir un análisis basado en la Ficha Técnica N° 30. 
                Aura detectará picos de consumo anormales y calculará las necesidades exactas de reabastecimiento para mantener un Normostock saludable (2 a 6 meses).
              </p>
            </div>
          </div>
        )}

        {/* Hide Input Section in Zen Mode via CSS to preserve loaded items state */}
        <div className={isFullScreen ? 'hidden' : 'block'}>
            <InputSection 
                onAnalyze={handleAnalyze} 
                isAnalyzing={loading} 
                onReset={handleReset} 
                hasAnalyzedData={!!result}
            />
        </div>

        {error && !isFullScreen && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
            <Info className="h-5 w-5" />
            {error}
          </div>
        )}

        {result && dashboardResult && (
          // IMPORTANT: Remove transform animations in FullScreen to fix "fixed" positioning context
          <div className={`space-y-8 ${!isFullScreen ? 'animate-in fade-in slide-in-from-bottom-4 duration-700' : ''}`}>
            
            {/* Header Widgets - Hide in Zen Mode */}
            {!isFullScreen && (
                <div className="flex flex-col xl:flex-row items-end xl:items-center justify-between gap-6 border-b border-gray-200 pb-6">
                    <div>
                        <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Resultados del Análisis</h2>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-2">
                            <span className="text-sm text-gray-500 font-medium">
                                Generado: {new Date(result.timestamp).toLocaleString()}
                            </span>
                            {result.referenceDate && (
                                <span className="text-xs font-bold text-teal-700 bg-teal-50 border border-teal-100 px-3 py-1 rounded-full uppercase tracking-wide">
                                    Corte: {result.referenceDate}
                                </span>
                            )}
                        </div>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row items-stretch gap-4 w-full xl:w-auto">
                        
                        {/* Audit Progress Widget - FIXED DESIGN: Explicit Bar */}
                        <div className={`rounded-2xl border p-4 w-full sm:w-[360px] flex flex-col justify-between gap-3 shadow-sm transition-all duration-300 ${
                            isReviewComplete 
                            ? 'bg-white border-teal-200' 
                            : 'bg-white border-amber-200'
                        }`}>
                            {/* Top: Header & Stats */}
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${isReviewComplete ? 'bg-teal-100 text-teal-600' : 'bg-amber-100 text-amber-600'}`}>
                                        {isReviewComplete ? <ShieldCheck className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}
                                    </div>
                                    <div>
                                        <h4 className={`text-xs font-black uppercase tracking-wider ${isReviewComplete ? 'text-teal-700' : 'text-amber-700'}`}>
                                            {isReviewComplete ? 'Auditoría Finalizada' : 'Auditoría en Curso'}
                                        </h4>
                                        <div className="text-[10px] text-gray-500 font-medium mt-0.5">
                                            {isReviewComplete 
                                                ? 'Todos los ítems validados'
                                                : `${reviewedCount} de ${totalToReview} ítems revisados`
                                            }
                                        </div>
                                    </div>
                                </div>
                                <span className={`text-2xl font-black ${isReviewComplete ? 'text-teal-500' : 'text-amber-500'}`}>
                                    {reviewProgress}%
                                </span>
                            </div>

                            {/* Middle: The Explicit Progress Bar */}
                            <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden border border-gray-100">
                                <div 
                                    className={`h-full transition-all duration-500 rounded-full ${isReviewComplete ? 'bg-teal-500' : 'bg-amber-500'}`}
                                    style={{ width: `${reviewProgress}%` }}
                                />
                            </div>

                            {/* Bottom: Filter Button */}
                            {!isReviewComplete && (
                                <button 
                                    onClick={() => setShowOnlyPending(!showOnlyPending)}
                                    className={`w-full py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                                        showOnlyPending 
                                        ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                                        : 'bg-gray-50 text-gray-600 hover:bg-amber-50 hover:text-amber-700 border border-gray-200 hover:border-amber-200'
                                    }`}
                                >
                                    <ListFilter className="h-3.5 w-3.5" />
                                    {showOnlyPending ? "Mostrando Solo Pendientes" : "Filtrar Pendientes de Validar"}
                                </button>
                            )}
                        </div>

                        <button
                            onClick={handleDownloadClick}
                            className={`group relative flex items-center justify-center gap-3 px-6 py-4 rounded-2xl transition-all shadow-md font-bold text-sm overflow-hidden w-full sm:w-auto ${
                                isReviewComplete 
                                ? 'bg-gray-900 text-white hover:bg-black hover:shadow-xl hover:-translate-y-0.5' 
                                : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                            }`}
                        >
                            <div className="flex flex-col items-center">
                                {isReviewComplete ? <FileText className="h-6 w-6 mb-1" /> : <Lock className="h-6 w-6 mb-1" />}
                                <span>Descargar</span>
                                <span className="text-[10px] opacity-70 font-normal">Informe PDF</span>
                            </div>
                            {isReviewComplete && (
                                <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent z-20" />
                            )}
                        </button>
                    </div>
                </div>
            )}
            
            {/* Dashboard - Hide in Zen Mode */}
            {!isFullScreen && <Dashboard result={dashboardResult} />}
            
            <AnalysisTable 
                medications={filteredMedications} 
                allMedications={result.medications}
                referenceDate={result.referenceDate} 
                onMedicationUpdate={handleMedicationUpdate}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                activeFilters={activeFilters}
                onFilterChange={setActiveFilters}
                onDownloadReport={handleDownloadClick}
                reviewedIds={reviewedIds}
                onToggleReview={handleToggleReview}
                // Full Screen Props
                reviewProgress={reviewProgress}
                reviewedCount={reviewedCount}
                totalToReview={totalToReview}
                isFullScreen={isFullScreen}
                onToggleFullScreen={setIsFullScreen}
                // Pending Filter Props
                showOnlyPending={showOnlyPending}
                onTogglePending={() => setShowOnlyPending(!showOnlyPending)}
                // Additional Items Props
                additionalItemsCount={additionalItems.length}
                onOpenAdditionalModal={() => setIsManualEntryModalOpen(true)}
            />
          </div>
        )}
      </main>

      <ReportOptionsModal 
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        onConfirm={handleGenerateReport}
        totalItems={filteredMedications.length}
        vaccinesAlreadyExcluded={result?.analysisConfig?.vaccinesExcluded ?? false}
      />

      <ReviewWarningModal 
        isOpen={showReviewWarning}
        onClose={() => setShowReviewWarning(false)}
        progress={reviewProgress}
      />
      
      <ManualEntryModal 
        isOpen={isManualEntryModalOpen}
        onClose={() => setIsManualEntryModalOpen(false)}
        items={additionalItems}
        onAdd={handleAddAdditionalItem}
        onRemove={handleRemoveAdditionalItem}
      />
    </div>
  );
};

export default App;
