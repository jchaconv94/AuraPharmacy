
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { InputSection } from './components/InputSection';
import { Dashboard } from './components/Dashboard';
import { AnalysisTable } from './components/AnalysisTable';
import { MedicationInput, AuraAnalysisResult, StockStatus, AdditionalItem, AppModule, QuickFilterOption } from './types';
import { analyzeInventoryWithAura } from './services/auraService';
import { generateFullReportPDF } from './services/pdfService';
import { ReportOptionsModal } from './components/ReportOptionsModal';
import { ReviewWarningModal } from './components/ReviewWarningModal';
import { ManualEntryModal } from './components/ManualEntryModal';
import { SuccessModal } from './components/SuccessModal';
import { Info, FileText, Lock, ShieldCheck, ShieldAlert, ListFilter, UserCircle, LogOut, Settings, BarChart2, LayoutGrid, ChevronDown } from 'lucide-react';

// NEW IMPORTS
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginScreen } from './components/LoginScreen';
import { AdminPanel } from './components/AdminPanel';
import { UserProfile } from './components/UserProfile';

const STORAGE_KEY = 'aura_data_v1';

// --- MAIN APP COMPONENT WRAPPED IN AUTH CONTEXT ---
const App: React.FC = () => {
    return (
        <AuthProvider>
            <AuthenticatedApp />
        </AuthProvider>
    );
};

// --- AUTHENTICATED LOGIC WRAPPER ---
const AuthenticatedApp: React.FC = () => {
    const { isAuthenticated, isLoading, user, logout, hasPermission } = useAuth();
    const [currentView, setCurrentView] = useState<AppModule>('DASHBOARD');

    // If loading, show spinner
    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
            </div>
        );
    }

    // If not authenticated, show Login
    if (!isAuthenticated) {
        return <LoginScreen />;
    }

    // --- RENDER MAIN LAYOUT ---
    return (
        <div className="min-h-screen bg-gray-50/50">
            {/* PREMIUM HEADER */}
            <header className="bg-gray-950 border-b border-white/5 sticky top-0 z-50 backdrop-blur-md bg-opacity-95 shadow-xl">
                <div className="max-w-[98%] mx-auto px-4 sm:px-6">
                    <div className="flex justify-between items-center h-18 py-3">
                        
                        {/* LEFT: BRANDING */}
                        <div 
                            className="flex items-center gap-3 cursor-pointer group" 
                            onClick={() => setCurrentView('DASHBOARD')}
                        >
                            <div className="relative">
                                <div className="absolute inset-0 bg-teal-500 rounded-xl blur opacity-20 group-hover:opacity-40 transition-opacity duration-500"></div>
                                <div className="bg-gray-900 border border-white/10 p-2 rounded-xl relative">
                                    <ShieldCheck className="h-6 w-6 text-teal-400" />
                                </div>
                            </div>
                            <div className="flex flex-col">
                                <h1 className="text-xl font-black text-white tracking-tight leading-none flex items-center gap-1">
                                    AURA <span className="text-teal-500 text-xs font-bold px-1.5 py-0.5 bg-teal-500/10 rounded-md border border-teal-500/20">PRO</span>
                                </h1>
                                <p className="text-[10px] text-gray-400 font-medium leading-none mt-1 tracking-wide uppercase">
                                    {user?.facilityData?.name || 'Logística Farmacéutica'}
                                </p>
                            </div>
                        </div>

                        {/* CENTER: FLOATING NAVIGATION PILL */}
                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden md:block">
                            <nav className="flex items-center gap-1 bg-gray-900/80 border border-white/5 p-1.5 rounded-full shadow-inner">
                                {hasPermission('DASHBOARD') && (
                                    <button 
                                        onClick={() => setCurrentView('DASHBOARD')}
                                        className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold transition-all duration-300 ${
                                            currentView === 'DASHBOARD' 
                                            ? 'bg-teal-600 text-white shadow-lg shadow-teal-900/50' 
                                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                                        }`}
                                    >
                                        <BarChart2 className="h-5 w-5" />
                                        Análisis de Requerimiento
                                    </button>
                                )}
                                
                                {(hasPermission('ADMIN_USERS') || hasPermission('ADMIN_ROLES')) && (
                                    <button 
                                        onClick={() => setCurrentView('ADMIN_USERS')}
                                        className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold transition-all duration-300 ${
                                            currentView.startsWith('ADMIN') 
                                            ? 'bg-teal-600 text-white shadow-lg shadow-teal-900/50' 
                                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                                        }`}
                                    >
                                        <Settings className="h-5 w-5" />
                                        Admin
                                    </button>
                                )}
                            </nav>
                        </div>

                        {/* RIGHT: USER PROFILE & ACTIONS */}
                        <div className="flex items-center gap-4">
                            
                            {/* Mobile Nav Toggle could go here */}

                            <div className="flex items-center gap-3 pl-4 border-l border-white/5">
                                <button 
                                    onClick={() => setCurrentView('PROFILE')}
                                    className="flex items-center gap-3 group p-1.5 pr-3 rounded-full hover:bg-white/5 transition-all border border-transparent hover:border-white/5"
                                >
                                    <div className="bg-gradient-to-br from-teal-500 to-emerald-600 p-[2px] rounded-full">
                                        <div className="bg-gray-900 rounded-full p-1">
                                            <UserCircle className="h-6 w-6 text-gray-200" />
                                        </div>
                                    </div>
                                    <div className="text-right hidden sm:block">
                                        <div className="text-xs font-bold text-white group-hover:text-teal-400 transition-colors">
                                            {user?.personnelData?.firstName}
                                        </div>
                                        <div className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">
                                            {user?.role}
                                        </div>
                                    </div>
                                    <ChevronDown className="h-3 w-3 text-gray-500 group-hover:text-white transition-colors hidden sm:block" />
                                </button>
                                
                                <button 
                                    onClick={logout} 
                                    className="bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 p-2.5 rounded-xl transition-all border border-transparent hover:border-red-500/30"
                                    title="Cerrar Sesión"
                                >
                                    <LogOut className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </header>
            
            {/* CONTENT AREA SWITCHER */}
            <main className="mx-auto w-full">
                {currentView === 'DASHBOARD' && <AnalysisModule />}
                {(currentView === 'ADMIN_USERS' || currentView === 'ADMIN_ROLES') && <AdminPanel />}
                {currentView === 'PROFILE' && <UserProfile />}
            </main>
        </div>
    );
};

// --- ANALYSIS MODULE (Original App Logic) ---
// Extracted to keep App.tsx clean
const AnalysisModule: React.FC = () => {
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
  
  // NEW: Quick Filter State replacing showOnlyPending
  const [quickFilter, setQuickFilter] = useState<QuickFilterOption>('ALL');

  // --- REVIEW SYSTEM STATE ---
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());
  const [showReviewWarning, setShowReviewWarning] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  
  // --- ADDITIONAL ITEMS STATE ---
  const [additionalItems, setAdditionalItems] = useState<AdditionalItem[]>([]);
  const [isManualEntryModalOpen, setIsManualEntryModalOpen] = useState(false);

  // --- FULL SCREEN STATE ---
  const [isFullScreen, setIsFullScreen] = useState(false);

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
      setSearchTerm('');
      setActiveFilters({});
      setReviewedIds(new Set());
      setQuickFilter('ALL');
      setAdditionalItems([]);
      setShowSuccessModal(false);
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
    setQuickFilter('ALL');
    setAdditionalItems([]);
    setShowSuccessModal(false);
  }, []);

  // UPDATED HANDLER: Now accepts CPA Mode
  const handleMedicationUpdate = (id: string, newQuantity: number, mode?: 'ADJUSTED' | 'SIMPLE') => {
    if (!result) return;
    setResult((prev) => {
      if (!prev) return null;
      const updatedMedications = prev.medications.map((m) =>
        m.id === id
          ? {
              ...m,
              quantityToOrder: newQuantity,
              estimatedInvestment: newQuantity * m.unitPrice,
              selectedCpaMode: mode || m.selectedCpaMode // Save the mode
            }
          : m
      );
      return {
        ...prev,
        medications: updatedMedications,
      };
    });
  };

  const handleToggleReview = (id: string, isReviewed: boolean) => {
      setReviewedIds(prev => {
          const next = new Set(prev);
          if (isReviewed) next.add(id);
          else next.delete(id);
          return next;
      });
  };

  const handleAddAdditionalItem = (item: AdditionalItem) => {
      setAdditionalItems(prev => [...prev, item]);
  };

  const handleRemoveAdditionalItem = (id: string) => {
      setAdditionalItems(prev => prev.filter(i => i.id !== id));
  };

  const filteredMedications = useMemo(() => {
    if (!result) return [];
    let items = result.medications;

    // QUICK FILTER LOGIC
    if (quickFilter === 'PENDING') {
        items = items.filter(m => 
            m.status !== StockStatus.SOBRESTOCK && 
            m.status !== StockStatus.SIN_ROTACION &&
            !reviewedIds.has(m.id)
        );
    } else if (quickFilter === 'REQ_POSITIVE') {
        items = items.filter(m => m.quantityToOrder > 0);
    } else if (quickFilter === 'REQ_ZERO') {
        items = items.filter(m => m.quantityToOrder === 0);
    }

    if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        items = items.filter(item => 
            item.name.toLowerCase().includes(lower) ||
            item.id.toLowerCase().includes(lower)
        );
    }

    if (Object.keys(activeFilters).length > 0) {
        items = items.filter(item => {
            return Object.entries(activeFilters).every(([key, values]) => {
                const filterValues = values as string[];
                if (!filterValues || filterValues.length === 0) return true;
                let itemValue = String((item as any)[key] || '-');
                if (key === 'isSporadic') {
                    itemValue = item.isSporadic ? "Baja Rotación" : "Rotación Normal";
                }
                return filterValues.includes(itemValue);
            });
        });
    }
    return items;
  }, [result, searchTerm, activeFilters, quickFilter, reviewedIds]);

  // UPDATE: Now depends on filteredMedications to update charts dynamically
  const dashboardResult = useMemo(() => {
    if (!result) return null;

    // Use filtered data for dashboard statistics
    const currentItems = filteredMedications;
    const totalItems = currentItems.length;
    
    const availableItems = currentItems.filter(m => 
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
        medications: currentItems, // Pass filtered items to dashboard components
        indicators: {
            dmeScore,
            status: indicatorStatus,
            totalItems,
            availableItems
        }
    };
  }, [result, filteredMedications]);

  const { reviewProgress, isReviewComplete, reviewedCount, totalToReview } = useMemo(() => {
      if (!result) return { reviewProgress: 0, isReviewComplete: false, reviewedCount: 0, totalToReview: 0 };
      const itemsRequiringReview = result.medications.filter(m => 
          m.status !== StockStatus.SOBRESTOCK && 
          m.status !== StockStatus.SIN_ROTACION
      );
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

  useEffect(() => {
    if (isReviewComplete && totalToReview > 0) {
        setShowSuccessModal(true);
    }
  }, [isReviewComplete, totalToReview]);

  const handleDownloadClick = () => {
      if (isReviewComplete) {
          setIsReportModalOpen(true);
      } else {
          setShowReviewWarning(true);
      }
  };

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
    generateFullReportPDF(dashboardResult, finalMedications, additionalItems);
    setIsReportModalOpen(false);
  };

  return (
    <div className={`pb-12 ${isFullScreen ? 'max-w-none px-0' : 'max-w-[95%] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8'}`}>
        {!isFullScreen && !result && !loading && (
          <div className="bg-white border border-teal-100 rounded-2xl p-8 flex gap-6 shadow-sm animate-in fade-in slide-in-from-top-4">
            <div className="bg-teal-50 p-4 rounded-full h-fit shrink-0">
              <Info className="h-8 w-8 text-teal-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Módulo de Análisis Inteligente</h2>
              <p className="text-gray-600 mt-2 max-w-3xl leading-relaxed">
                Ingrese su inventario para recibir un análisis basado en la Ficha Técnica N° 30.
              </p>
            </div>
          </div>
        )}

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
          <div className={`space-y-8 ${!isFullScreen ? 'animate-in fade-in slide-in-from-bottom-4 duration-700' : ''}`}>
             {!isFullScreen && (
                <div className="flex flex-col xl:flex-row items-end xl:items-center justify-between gap-6 border-b border-gray-200 pb-6">
                    <div>
                        <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Resultados del Análisis</h2>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-2">
                            <span className="text-sm text-gray-500 font-medium">Generado: {new Date(result.timestamp).toLocaleString()}</span>
                            {result.referenceDate && <span className="text-xs font-bold text-teal-700 bg-teal-50 border border-teal-100 px-3 py-1 rounded-full uppercase tracking-wide">Corte: {result.referenceDate}</span>}
                        </div>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row items-stretch gap-4 w-full xl:w-auto">
                        <div className={`rounded-2xl border p-4 w-full sm:w-[360px] flex flex-col justify-between gap-3 shadow-sm transition-all duration-300 ${isReviewComplete ? 'bg-white border-teal-200' : 'bg-white border-amber-200'}`}>
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${isReviewComplete ? 'bg-teal-100 text-teal-600' : 'bg-amber-100 text-amber-600'}`}>
                                        {isReviewComplete ? <ShieldCheck className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}
                                    </div>
                                    <div>
                                        <h4 className={`text-xs font-black uppercase tracking-wider ${isReviewComplete ? 'text-teal-700' : 'text-amber-700'}`}>{isReviewComplete ? 'Auditoría Finalizada' : 'Auditoría en Curso'}</h4>
                                        <div className="text-[10px] text-gray-500 font-medium mt-0.5">{isReviewComplete ? 'Todos los ítems validados' : `${reviewedCount} de ${totalToReview} ítems revisados`}</div>
                                    </div>
                                </div>
                                <span className={`text-2xl font-black ${isReviewComplete ? 'text-teal-500' : 'text-amber-500'}`}>{reviewProgress}%</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden border border-gray-100">
                                <div className={`h-full transition-all duration-500 rounded-full ${isReviewComplete ? 'bg-teal-500' : 'bg-amber-500'}`} style={{ width: `${reviewProgress}%` }} />
                            </div>
                            {!isReviewComplete && (
                                <button onClick={() => setQuickFilter(quickFilter === 'PENDING' ? 'ALL' : 'PENDING')} className={`w-full py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${quickFilter === 'PENDING' ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-gray-50 text-gray-600 hover:bg-amber-50 hover:text-amber-700 border border-gray-200 hover:border-amber-200'}`}>
                                    <ListFilter className="h-3.5 w-3.5" />
                                    {quickFilter === 'PENDING' ? "Mostrando Solo Pendientes" : "Filtrar Pendientes de Validar"}
                                </button>
                            )}
                        </div>

                        <button onClick={handleDownloadClick} className={`group relative flex items-center justify-center gap-3 px-6 py-4 rounded-2xl transition-all shadow-md font-bold text-sm overflow-hidden w-full sm:w-auto ${isReviewComplete ? 'bg-gray-900 text-white hover:bg-black hover:shadow-xl hover:-translate-y-0.5' : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'}`}>
                            <div className="flex flex-col items-center">
                                {isReviewComplete ? <FileText className="h-6 w-6 mb-1" /> : <Lock className="h-6 w-6 mb-1" />}
                                <span>Descargar</span>
                                <span className="text-[10px] opacity-70 font-normal">Informe PDF</span>
                            </div>
                            {isReviewComplete && <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent z-20" />}
                        </button>
                    </div>
                </div>
            )}
            
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
                reviewProgress={reviewProgress}
                reviewedCount={reviewedCount}
                totalToReview={totalToReview}
                isFullScreen={isFullScreen}
                onToggleFullScreen={setIsFullScreen}
                quickFilter={quickFilter}
                onQuickFilterChange={setQuickFilter}
                additionalItemsCount={additionalItems.length}
                onOpenAdditionalModal={() => setIsManualEntryModalOpen(true)}
            />
          </div>
        )}

        <ReportOptionsModal isOpen={isReportModalOpen} onClose={() => setIsReportModalOpen(false)} onConfirm={handleGenerateReport} totalItems={filteredMedications.length} vaccinesAlreadyExcluded={result?.analysisConfig?.vaccinesExcluded ?? false} />
        <ReviewWarningModal isOpen={showReviewWarning} onClose={() => setShowReviewWarning(false)} progress={reviewProgress} />
        <SuccessModal isOpen={showSuccessModal} onClose={() => setShowSuccessModal(false)} onDownload={handleDownloadClick} />
        <ManualEntryModal isOpen={isManualEntryModalOpen} onClose={() => setIsManualEntryModalOpen(false)} items={additionalItems} onAdd={handleAddAdditionalItem} onRemove={handleRemoveAdditionalItem} />
    </div>
  );
};

export default App;
