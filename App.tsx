
import React, { useState, useCallback, useEffect, useMemo, Suspense } from 'react';
import { InputSection } from './components/InputSection';
import { MedicationInput, AuraAnalysisResult, StockStatus, AdditionalItem, AppModule, QuickFilterOption } from './types';
import { analyzeInventoryWithAura } from './services/auraService';
import { generateFullReportPDF } from './services/pdfService';
import { Info, FileText, Lock, ShieldCheck, ShieldAlert, ListFilter, Building2, Calendar, Clock, Network } from 'lucide-react';

// NEW IMPORTS
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Sidebar } from './components/Sidebar';
import { MobileNav } from './components/MobileNav'; // Nuevo import
import { ErrorBoundary } from './components/ErrorBoundary';
import { Toaster } from 'sonner';

// Lazy loaded components para optimizar el bundle inicial
import { Dashboard } from './components/Dashboard';
import { AnalysisTable } from './components/AnalysisTable';
import { ReportOptionsModal } from './components/ReportOptionsModal';
import { ReviewWarningModal } from './components/ReviewWarningModal';
import { ManualEntryModal } from './components/ManualEntryModal';
import { SuccessModal } from './components/SuccessModal';
import { LoginScreen } from './components/LoginScreen';
import { AdminPanel } from './components/AdminPanel';
import { UserProfile } from './components/UserProfile';
import { WelcomeModal } from './components/WelcomeModal';
import { RedistributionModule } from './components/RedistributionModule';
import { SheetSearchModule } from './components/SheetSearchModule';
import { AdminStockAssignmentModule } from './components/AdminStockAssignmentModule';
import { AssignedIpressStockModule } from './components/AssignedIpressStockModule';
import { StockMonitoringModule } from './components/IpressStockModule';
import { ImmunizationAdjustmentsModule } from './components/ImmunizationAdjustmentsModule';
import { ImmunizationCatalogModule } from './components/ImmunizationCatalogModule';
import { ImmunizationClosuresModule } from './components/ImmunizationClosuresModule';
import { ImmunizationConsumptionModule } from './components/ImmunizationConsumptionModule';
import { ImmunizationDistributionsModule } from './components/ImmunizationDistributionsModule';
import { ImmunizationIncomesModule } from './components/ImmunizationIncomesModule';
import { ImmunizationIncomeOriginsModule } from './components/ImmunizationIncomeOriginsModule';
import { ImmunizationInitialInventoryModule } from './components/ImmunizationInitialInventoryModule';
import { ImmunizationReportsModule } from './components/ImmunizationReportsModule';
import { ImmunizationReturnsModule } from './components/ImmunizationReturnsModule';
import { ImmunizationStockModule } from './components/ImmunizationStockModule';
import { ImmunizationStockQueryModule } from './components/ImmunizationStockQueryModule';
import { APP_BASE, moduleForPath, pathForModule } from './services/appRoutes';

const SuspenseFallback = () => (
    <div className="flex-1 flex h-full w-full items-center justify-center p-8 bg-gray-50/50">
        <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600"></div>
            <p className="text-gray-500 font-medium text-sm animate-pulse">Cargando módulo...</p>
        </div>
    </div>
);

const STORAGE_KEY = 'aura_data_v1';
const REVIEW_KEY = 'aura_reviews_v1';
const ADDITIONAL_ITEMS_KEY = 'aura_additional_v1';
const WELCOME_KEY = 'aura_welcome_shown_session'; // Clave de sesión

const formatCorteDate = (dateStr: string): string => {
    if (!dateStr) return '';
    const parts = dateStr.trim().split('-');
    if (parts.length === 2) {
        const year = parts[0];
        const monthNum = parseInt(parts[1], 10);
        const months = [
            'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
            'JULIO', 'AGOSTO', 'SETIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
        ];
        if (monthNum >= 1 && monthNum <= 12) {
            return `${months[monthNum - 1]} ${year}`;
        }
    }
    return dateStr;
};

// --- MAIN APP COMPONENT WRAPPED IN AUTH CONTEXT ---
const App: React.FC = () => {
    return (
        <ErrorBoundary>
            <AuthProvider>
                <Toaster position="top-center" closeButton theme="light" style={{ zIndex: 2147483647 }} toastOptions={{ style: { zIndex: 2147483647, color: '#1e293b' }, className: 'text-slate-800' }} />
                <AuthenticatedApp />
            </AuthProvider>
        </ErrorBoundary>
    );
};

// --- AUTHENTICATED LOGIC WRAPPER ---
const AuthenticatedApp: React.FC = () => {
    const { isAuthenticated, isLoading, user, logout, hasPermission } = useAuth();
    // La vista inicial sale de la direccion, para que un enlace compartido abra donde debe.
    const [currentView, setCurrentView] = useState<AppModule>(
        () => moduleForPath(window.location.pathname) || 'DASHBOARD'
    );

    // La direccion del navegador sigue a la vista, sin agregar una entrada por render.
    // Solo con sesion iniciada: sin ella la direccion debe ser la raiz.
    useEffect(() => {
        if (!isAuthenticated) return;
        const destino = pathForModule(currentView);
        if (window.location.pathname === destino) return;
        window.history.pushState({ view: currentView }, '', destino);
    }, [currentView, isAuthenticated]);

    // Al cerrar sesion, la direccion vuelve a la raiz y la vista al inicio.
    //
    // Este componente no se desmonta al salir: solo cambia lo que muestra. Sin esto la
    // ruta del ultimo modulo quedaba en la barra del navegador, y el siguiente usuario
    // entraba directo a la pantalla del anterior.
    useEffect(() => {
        if (isAuthenticated || isLoading) return;
        setCurrentView('DASHBOARD');
        if (window.location.pathname !== APP_BASE) {
            window.history.replaceState({}, '', APP_BASE);
        }
    }, [isAuthenticated, isLoading]);

    // Botones de atras y adelante del navegador.
    useEffect(() => {
        const alNavegar = () => setCurrentView(moduleForPath(window.location.pathname) || 'DASHBOARD');
        window.addEventListener('popstate', alNavegar);
        return () => window.removeEventListener('popstate', alNavegar);
    }, []);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    
    const wasSidebarCollapsedRef = React.useRef(false);

    // Welcome Modal State
    const [showWelcome, setShowWelcome] = useState(false);

    // Listen for advanced filters toggled event to collapse/restore sidebar menu
    useEffect(() => {
        const handleAdvFiltersToggle = (e: any) => {
            const isOpen = e.detail?.open;
            if (isOpen) {
                wasSidebarCollapsedRef.current = isSidebarCollapsed;
                setIsSidebarCollapsed(true);
            } else {
                setIsSidebarCollapsed(wasSidebarCollapsedRef.current);
            }
        };
        window.addEventListener('toggle-advanced-filters', handleAdvFiltersToggle);
        return () => {
            window.removeEventListener('toggle-advanced-filters', handleAdvFiltersToggle);
        };
    }, [isSidebarCollapsed]);

    // Effect to trigger welcome modal ONCE per session
    useEffect(() => {
        if (isAuthenticated && user && !isLoading) {
            const hasShown = sessionStorage.getItem(WELCOME_KEY);
            if (!hasShown) {
                setShowWelcome(true);
                sessionStorage.setItem(WELCOME_KEY, 'true');
            }
        }
    }, [isAuthenticated, isLoading, user]);

    // Ensure currentView is allowed, if not switch to an allowed module
    useEffect(() => {
        if (isAuthenticated && !isLoading && user && !hasPermission(currentView)) {
            if (hasPermission('DASHBOARD')) setCurrentView('DASHBOARD');
            else if (hasPermission('IMMUNIZATION_STOCK')) setCurrentView('IMMUNIZATION_STOCK');
                            else if (hasPermission('IMMUNIZATION_STOCK_QUERY')) setCurrentView('IMMUNIZATION_STOCK_QUERY');
            else if (hasPermission('IMMUNIZATION_INCOMES')) setCurrentView('IMMUNIZATION_INCOMES');
            else if (hasPermission('IMMUNIZATION_INCOME_ORIGINS')) setCurrentView('IMMUNIZATION_INCOME_ORIGINS');
            else if (hasPermission('IMMUNIZATION_DISTRIBUTIONS')) setCurrentView('IMMUNIZATION_DISTRIBUTIONS');
            else if (hasPermission('IMMUNIZATION_CONSUMPTION')) setCurrentView('IMMUNIZATION_CONSUMPTION');
            else if (hasPermission('IMMUNIZATION_INITIAL_INVENTORY')) setCurrentView('IMMUNIZATION_INITIAL_INVENTORY');
            else if (hasPermission('IMMUNIZATION_CATALOG')) setCurrentView('IMMUNIZATION_CATALOG');
            else if (hasPermission('IMMUNIZATION_ADJUSTMENTS')) setCurrentView('IMMUNIZATION_ADJUSTMENTS');
            else if (hasPermission('IMMUNIZATION_CLOSURES')) setCurrentView('IMMUNIZATION_CLOSURES');
            else if (hasPermission('IMMUNIZATION_REPORTS')) setCurrentView('IMMUNIZATION_REPORTS');
            else if (hasPermission('IPRESS_STOCK')) setCurrentView('IPRESS_STOCK');
            else if (hasPermission('STOCK_MONITORING')) setCurrentView('STOCK_MONITORING');
            else if (hasPermission('REDISTRIBUTION')) setCurrentView('REDISTRIBUTION');
            else if (hasPermission('SIG_SEARCH')) setCurrentView('SIG_SEARCH');
            else if (hasPermission('ADMIN_STOCK_ASSIGN')) setCurrentView('ADMIN_STOCK_ASSIGN');
            else if (hasPermission('ADMIN_USERS')) setCurrentView('ADMIN_USERS');
            else if (hasPermission('ADMIN_ROLES')) setCurrentView('ADMIN_ROLES');
            else if (hasPermission('ADMIN_FACILITIES')) setCurrentView('ADMIN_FACILITIES');
            else if (hasPermission('ADMIN_CATALOGS')) setCurrentView('ADMIN_CATALOGS');
            else if (hasPermission('ADMIN_PARAMS')) setCurrentView('ADMIN_PARAMS');
            else if (hasPermission('ADMIN_MIGRATION')) setCurrentView('ADMIN_MIGRATION');
            else if (hasPermission('PROFILE')) setCurrentView('PROFILE');
        }
    }, [currentView, isAuthenticated, isLoading, user, hasPermission]);

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
        return (
            <Suspense fallback={
                <div className="min-h-screen flex items-center justify-center bg-gray-50">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
                </div>
            }>
                <LoginScreen />
            </Suspense>
        );
    }

    // --- RENDER MAIN LAYOUT ---
    return (
        <div className="flex h-[100dvh] bg-gray-50/50 overflow-hidden">
            <div className="hidden md:flex">
                <Sidebar 
                    currentView={currentView}
                    setCurrentView={setCurrentView}
                    isCollapsed={isSidebarCollapsed}
                    setIsCollapsed={setIsSidebarCollapsed}
                    user={user}
                    logout={logout}
                    hasPermission={hasPermission}
                />
            </div>

            <div className="flex-1 flex flex-col h-[100dvh] overflow-hidden relative">
                {/* Simplified Header for context */}
                <header className="bg-white/80 border-b border-gray-200 sticky top-0 z-[1000] backdrop-blur-sm shadow-sm h-14 sm:h-16 flex items-center justify-between px-4 sm:px-6 transition-all duration-300 shrink-0">
                     <div className="flex items-center gap-3">
                        <h2 className="text-base sm:text-lg font-bold text-gray-800 flex items-center gap-2">
                           {currentView === 'DASHBOARD' && 'Análisis de Requerimiento'}
                           {currentView === 'REDISTRIBUTION' && 'Módulo de Redistribución'}
                           {currentView === 'SIG_SEARCH' && 'Consulta Stock'}
                           {currentView === 'IPRESS_STOCK' && 'Stock SISMED'}
                           {currentView === 'STOCK_MONITORING' && 'Monitoreo de Stock SISMED'}
                           {currentView === 'IMMUNIZATION_CATALOG' && 'Catálogo Biológico'}
                           {currentView === 'IMMUNIZATION_INITIAL_INVENTORY' && 'Inventario Inicial'}
                           {currentView === 'IMMUNIZATION_STOCK' && 'Stock Biológico'}
                           {currentView === 'IMMUNIZATION_STOCK_QUERY' && 'Consulta de Stock Biológico'}
	                           {currentView === 'IMMUNIZATION_INCOMES' && 'Ingresos Regionales'}
	                           {currentView === 'IMMUNIZATION_INCOME_ORIGINS' && 'Orígenes de Ingreso'}
                           {currentView === 'IMMUNIZATION_DISTRIBUTIONS' && 'Distribuciones'}
                           {currentView === 'IMMUNIZATION_CONSUMPTION' && 'Consumo IPRESS'}
                           {currentView === 'IMMUNIZATION_RETURNS' && 'Devoluciones y Bajas'}
                           {currentView === 'IMMUNIZATION_ADJUSTMENTS' && 'Reajustes de Stock'}
                           {currentView === 'IMMUNIZATION_CLOSURES' && 'Cierre Mensual'}
                           {currentView === 'IMMUNIZATION_REPORTS' && 'Reportes Inmunizaciones'}
                           {currentView === 'ADMIN_STOCK_ASSIGN' && 'Asignar Stock a IPRESS'}
                           {currentView.startsWith('ADMIN') && currentView !== 'ADMIN_STOCK_ASSIGN' && 'Panel de Administración'}
                           {currentView === 'PROFILE' && 'Perfil de Usuario'}
                        </h2>
                     </div>
                     <div className="flex items-center gap-3 text-xs sm:text-sm text-gray-500 font-medium bg-gray-100/80 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full border border-gray-200 shadow-inner">
                         <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-teal-500 animate-[pulse_2s_ease-in-out_infinite] shadow-[0_0_8px_rgba(20,184,166,0.6)]"></span>
                         <span className="truncate max-w-[150px] sm:max-w-[200px]">{user?.facilityData?.name || 'ToolKit SISMED'}</span>
                     </div>
                </header>

                {/* CONTENT AREA SWITCHER */}
                <main className="flex-1 overflow-y-auto w-full p-4 2xl:p-6 pb-24 md:pb-6">
                    <div className="mx-auto max-w-[1600px] h-full">
                        <ErrorBoundary>
                            <Suspense fallback={<SuspenseFallback />}>
                                {currentView === 'DASHBOARD' && <AnalysisModule />}
                                {currentView === 'REDISTRIBUTION' && <RedistributionModule />}
                                {currentView === 'SIG_SEARCH' && <SheetSearchModule />}
                                {currentView === 'IPRESS_STOCK' && <AssignedIpressStockModule />}
                                {currentView === 'STOCK_MONITORING' && <StockMonitoringModule />}
                                {currentView === 'IMMUNIZATION_CATALOG' && <ImmunizationCatalogModule />}
                                {currentView === 'IMMUNIZATION_INITIAL_INVENTORY' && <ImmunizationInitialInventoryModule />}
                                {currentView === 'IMMUNIZATION_STOCK' && <ImmunizationStockModule />}
                                {currentView === 'IMMUNIZATION_STOCK_QUERY' && <ImmunizationStockQueryModule />}
	                                {currentView === 'IMMUNIZATION_INCOMES' && <ImmunizationIncomesModule />}
	                                {currentView === 'IMMUNIZATION_INCOME_ORIGINS' && <ImmunizationIncomeOriginsModule />}
                                {currentView === 'IMMUNIZATION_DISTRIBUTIONS' && <ImmunizationDistributionsModule />}
                                {currentView === 'IMMUNIZATION_CONSUMPTION' && <ImmunizationConsumptionModule />}
                                {currentView === 'IMMUNIZATION_RETURNS' && <ImmunizationReturnsModule />}
                                {currentView === 'IMMUNIZATION_ADJUSTMENTS' && <ImmunizationAdjustmentsModule />}
                                {currentView === 'IMMUNIZATION_CLOSURES' && <ImmunizationClosuresModule />}
                                {currentView === 'IMMUNIZATION_REPORTS' && <ImmunizationReportsModule />}
                                {currentView === 'ADMIN_STOCK_ASSIGN' && <AdminStockAssignmentModule />}
                                {currentView.startsWith('ADMIN') && currentView !== 'ADMIN_STOCK_ASSIGN' && <AdminPanel currentView={currentView} />}
                                {currentView === 'PROFILE' && <UserProfile />}
                            </Suspense>
                        </ErrorBoundary>
                    </div>
                </main>

                <MobileNav 
                    currentView={currentView} 
                    setCurrentView={setCurrentView} 
                    hasPermission={hasPermission} 
                />

                <Suspense fallback={null}>
                    {showWelcome && user && <WelcomeModal user={user} onClose={() => setShowWelcome(false)} />}
                </Suspense>
            </div>
        </div>
    );
};

// --- ANALYSIS MODULE (Original App Logic) ---
// Extracted to keep App.tsx clean
const AnalysisModule: React.FC = () => {
  // NEW: Get User Context
  const { user } = useAuth();

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

  // NEW: Detect if current loaded data has legacy UUID-style IDs from old session
  const hasLegacyUuidCodes = useMemo(() => {
    if (!result || !result.medications || result.medications.length === 0) return false;
    return result.medications.some(m => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(m.id));
  }, [result]);

  // --- NEW: LIFTED STATE FOR INPUT DATA ---
  const [inputData, setInputData] = useState<MedicationInput[]>(() => {
    try {
      const savedInput = localStorage.getItem('aura_input_data_v1');
      return savedInput ? JSON.parse(savedInput) : [];
    } catch (e) {
      console.error("Error loading input data", e);
      return [];
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
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(() => {
      try {
          const saved = localStorage.getItem(REVIEW_KEY);
          return saved ? new Set(JSON.parse(saved)) : new Set();
      } catch (e) {
          return new Set();
      }
  });

  const [showReviewWarning, setShowReviewWarning] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  
  // --- ADDITIONAL ITEMS STATE ---
  const [additionalItems, setAdditionalItems] = useState<AdditionalItem[]>(() => {
      try {
          const saved = localStorage.getItem(ADDITIONAL_ITEMS_KEY);
          return saved ? JSON.parse(saved) : [];
      } catch (e) {
          return [];
      }
  });
  const [isManualEntryModalOpen, setIsManualEntryModalOpen] = useState(false);

  // --- FULL SCREEN STATE & NATIVE API LOGIC ---
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Handler to toggle NATIVE Fullscreen
  const handleToggleFullScreen = useCallback((targetState: boolean) => {
      const elem = document.documentElement; // Target the whole page

      if (targetState) {
          // Request Native Fullscreen
          if (elem.requestFullscreen) {
              elem.requestFullscreen().catch(err => console.error("Error enabling full-screen mode:", err));
          } else if ((elem as any).webkitRequestFullscreen) { /* Safari */
              (elem as any).webkitRequestFullscreen();
          } else if ((elem as any).msRequestFullscreen) { /* IE11 */
              (elem as any).msRequestFullscreen();
          }
      } else {
          // Exit Native Fullscreen
          if (document.exitFullscreen && document.fullscreenElement) {
              document.exitFullscreen().catch(err => console.error("Error exiting full-screen mode:", err));
          } else if ((document as any).webkitExitFullscreen) { /* Safari */
              (document as any).webkitExitFullscreen();
          } else if ((document as any).msExitFullscreen) { /* IE11 */
              (document as any).msExitFullscreen();
          }
      }
      // Note: Actual state 'isFullScreen' is updated via the event listener below
      // to ensure sync with "Esc" key presses.
  }, []);

  // Listen for browser fullscreen changes (e.g. user presses ESC)
  useEffect(() => {
      const handleFullScreenChange = () => {
          const isNativeFullScreen = !!document.fullscreenElement || 
                                     !!(document as any).webkitFullscreenElement || 
                                     !!(document as any).msFullscreenElement;
          setIsFullScreen(isNativeFullScreen);
      };

      document.addEventListener('fullscreenchange', handleFullScreenChange);
      document.addEventListener('webkitfullscreenchange', handleFullScreenChange);
      document.addEventListener('msfullscreenchange', handleFullScreenChange);

      return () => {
          document.removeEventListener('fullscreenchange', handleFullScreenChange);
          document.removeEventListener('webkitfullscreenchange', handleFullScreenChange);
          document.removeEventListener('msfullscreenchange', handleFullScreenChange);
      };
  }, []);


  useEffect(() => {
    if (result) {
      try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
      } catch (e) {
          console.warn('Storage quota exceeded on main result.', e);
      }
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [result]);

  // PERSIST INPUT DATA
  useEffect(() => {
    try {
      if (inputData && inputData.length > 0) {
        localStorage.setItem('aura_input_data_v1', JSON.stringify(inputData));
      } else {
        localStorage.removeItem('aura_input_data_v1');
      }
    } catch (e) {
      console.warn('Storage quota exceeded on input data.', e);
    }
  }, [inputData]);

  // PERSIST REVIEWED IDS
  useEffect(() => {
      try {
          localStorage.setItem(REVIEW_KEY, JSON.stringify(Array.from(reviewedIds)));
      } catch(e) { console.warn(e); }
  }, [reviewedIds]);

  // PERSIST ADDITIONAL ITEMS
  useEffect(() => {
      try {
          localStorage.setItem(ADDITIONAL_ITEMS_KEY, JSON.stringify(additionalItems));
      } catch(e) { console.warn(e); }
  }, [additionalItems]);

  const handleAnalyze = useCallback(async (
    data: MedicationInput[], 
    referenceDate: string, 
    vaccinesExcluded: boolean,
    metadata?: {
      microred?: string;
      codEess?: string;
      establishmentName?: string;
      category?: string;
    }
  ) => {
    setLoading(true);
    setError(null);
    try {
      const analysisResult = await analyzeInventoryWithAura(data, referenceDate, vaccinesExcluded);
      
      // Inject imported metadata if available
      if (metadata) {
        analysisResult.microred = metadata.microred || undefined;
        analysisResult.codEess = metadata.codEess || undefined;
        analysisResult.establishmentName = metadata.establishmentName || undefined;
        analysisResult.category = metadata.category || undefined;
      }

      setResult(analysisResult);
      setSearchTerm('');
      setActiveFilters({});
      
      // Reset reviews and additional items on NEW analysis
      setReviewedIds(new Set()); 
      localStorage.removeItem(REVIEW_KEY);
      
      setAdditionalItems([]);
      localStorage.removeItem(ADDITIONAL_ITEMS_KEY);

      setQuickFilter('ALL');
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
    localStorage.removeItem(REVIEW_KEY);

    handleToggleFullScreen(false); // Exit fullscreen on reset
    setQuickFilter('ALL');
    
    setAdditionalItems([]);
    localStorage.removeItem(ADDITIONAL_ITEMS_KEY);

    setShowSuccessModal(false);
    setInputData([]); // Clear input data on reset
  }, [handleToggleFullScreen]);

  // UPDATED HANDLER: Now accepts CPA Mode and Excluded Indices
  const handleMedicationUpdate = useCallback((id: string, newQuantity: number, mode?: 'ADJUSTED' | 'SIMPLE', excludedIndices?: number[]) => {
    setResult((prev) => {
      if (!prev) return null;
      const updatedMedications = prev.medications.map((m) =>
        m.id === id
          ? {
              ...m,
              quantityToOrder: newQuantity,
              estimatedInvestment: newQuantity * m.unitPrice,
              selectedCpaMode: mode || m.selectedCpaMode, // Save the mode
              excludedIndices: excludedIndices !== undefined ? excludedIndices : m.excludedIndices // Save excluded indices
            }
          : m
      );
      return {
        ...prev,
        medications: updatedMedications,
      };
    });
  }, []);

  const handleToggleReview = useCallback((id: string, isReviewed: boolean) => {
      setReviewedIds(prev => {
          const next = new Set(prev);
          if (isReviewed) next.add(id);
          else next.delete(id);
          return next;
      });
  }, []);

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
            item.id.toLowerCase().includes(lower) ||
            (item.code && item.code.toLowerCase().includes(lower))
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
    
    // Sort items alphabetically by name
    return [...items].sort((a, b) => (a.name || '').trim().localeCompare((b.name || '').trim(), 'es', { sensitivity: 'base' }));
  }, [result, searchTerm, activeFilters, quickFilter, reviewedIds]);

  // UPDATE: Now depends on filteredMedications to update charts dynamically
  const dashboardResult = useMemo(() => {
    if (!result) return null;

    // Use filtered data for dashboard statistics
    const currentItems = filteredMedications;
    
    // Filter essential medications for DME indicator in UI
    const essentialMedications = currentItems.filter(m => {
        const isMed = (m.medtip || '').toUpperCase().trim() === 'M';
        const isPet = (m.medpet || '').toUpperCase().trim() === 'P';
        const est = (m.medest || '').toUpperCase().trim();
        const isEst = est === '_' || est === 'S';
        return isMed && isPet && isEst;
    });

    const totalEssentialItems = essentialMedications.length;
    
    const availableEssentialItems = essentialMedications.filter(m => 
        m.status === StockStatus.NORMOSTOCK || 
        m.status === StockStatus.SOBRESTOCK
    ).length;
    
    const dmeScore = totalEssentialItems > 0 ? (availableEssentialItems / totalEssentialItems) * 100 : 0;
    
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
            totalItems: totalEssentialItems, // Use essential items for DME fraction
            availableItems: availableEssentialItems // Use essential items for DME fraction
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

  const handleGenerateReport = async (excludeVaccines: boolean, excludeNoSupply: boolean) => {
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
    
    const establishmentName = user?.facilityData?.name || 'ESTABLECIMIENTO DE SALUD';
    const responsibleName = user?.personnelData ? `${user.personnelData.firstName} ${user.personnelData.lastName}` : (user?.username || '');
    await generateFullReportPDF(dashboardResult, finalMedications, additionalItems, establishmentName, responsibleName);
    
    setIsReportModalOpen(false);
  };

  return (
    <div className={`pb-12 ${isFullScreen ? 'max-w-none px-0' : 'max-w-[95%] mx-auto px-4 sm:px-6 lg:px-8 py-4 2xl:py-8 space-y-4 2xl:space-y-8'}`}>
        {!isFullScreen && !result && !loading && (
          <div className="bg-white border border-teal-100 rounded-2xl p-6 2xl:p-8 flex gap-6 shadow-sm animate-in fade-in slide-in-from-top-4">
            <div className="bg-teal-50 p-4 rounded-full h-fit shrink-0">
              <Info className="h-8 w-8 text-teal-600" />
            </div>
            <div>
              <h2 className="text-xl 2xl:text-2xl font-bold text-gray-900">Módulo de Análisis Inteligente</h2>
              <p className="text-gray-600 mt-2 max-w-3xl leading-relaxed text-sm 2xl:text-base">
                Cargue su archivo Excel de requerimiento descargado del SISMED, para que el sistema lo analice.
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
                analysisResult={result}
                currentItems={inputData}
                onItemsChange={setInputData}
                onResultChange={setResult}
                reviewedIds={reviewedIds}
                onReviewedIdsChange={setReviewedIds}
                additionalItems={additionalItems}
                onAdditionalItemsChange={setAdditionalItems}
            />
        </div>

        {error && !isFullScreen && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
            <Info className="h-5 w-5" />
            {error}
          </div>
        )}

        {result && dashboardResult && (
          <div className={`space-y-4 2xl:space-y-8 ${!isFullScreen ? 'animate-in fade-in slide-in-from-bottom-4 duration-700' : ''}`}>
             {!isFullScreen && hasLegacyUuidCodes && (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
                    <div className="flex gap-3 sm:gap-4 items-start">
                        <div className="bg-amber-100 text-amber-700 p-2.5 rounded-xl shrink-0">
                            <Info className="h-5 sm:h-6 w-5 sm:w-6" />
                        </div>
                        <div>
                            <h4 className="font-black text-amber-900 text-base">⚠️ Historial con Códigos Desactualizados (UUID)</h4>
                            <p className="text-amber-800 text-xs sm:text-sm mt-1 leading-relaxed max-w-4xl">
                                Los datos actuales corresponden a una carga previa que usó identificadores temporales (UUID). Para visualizar los códigos reales y únicos de medicamentos de la columna <strong>F ("MED COD")</strong>, simplemente vuelve a cargar tu archivo de SISMED en la sección de arriba. El sistema actualizará de inmediato la base de datos con los códigos reales.
                            </p>
                        </div>
                    </div>
                </div>
             )}

             {!isFullScreen && (
                <div className="flex flex-col xl:flex-row items-end xl:items-center justify-between gap-6 border-b border-gray-200 pb-4 2xl:pb-6">
                    <div>
                        <h2 className="text-2xl 2xl:text-3xl font-bold text-gray-900 tracking-tight">Resultados del Análisis</h2>
                        <div className="mt-2.5 flex flex-wrap items-center gap-2">
                            {/* ESTABLECIMIENTO Y CÓDIGO */}
                            {result.establishmentName && (
                                <div className="flex items-center gap-1.5 text-teal-900 bg-teal-50/80 border border-teal-100 rounded-lg px-2.5 py-1 tracking-tight font-extrabold text-xs">
                                    <Building2 className="h-3.5 w-3.5 text-teal-600 animate-pulse" />
                                    <span>
                                        {result.codEess ? `${result.codEess} - ` : ''}
                                        {result.establishmentName.toUpperCase()}
                                    </span>
                                </div>
                            )}

                            {/* MICRORED */}
                            {result.microred && (
                                <div className="flex items-center gap-1.5 text-teal-800 bg-teal-50/50 border border-teal-100 rounded-lg px-2.5 py-1 text-xs font-semibold">
                                    <Network className="h-3.5 w-3.5 text-teal-600" />
                                    <span>MR: <span className="font-bold text-teal-800">{result.microred.toUpperCase()}</span></span>
                                </div>
                            )}

                            {/* CORTE */}
                            {result.referenceDate && (
                                <div className="flex items-center gap-1.5 text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1 text-xs font-bold uppercase tracking-wide">
                                    <Calendar className="h-3.5 w-3.5 text-amber-600" />
                                    <span>CORTE: {formatCorteDate(result.referenceDate)}</span>
                                </div>
                            )}

                            {/* GENERADO */}
                            <div className="flex items-center gap-1.5 text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-medium">
                                <Clock className="h-3.5 w-3.5 text-slate-400" />
                                <span>Generado: {new Date(result.timestamp).toLocaleString()}</span>
                            </div>
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
                onToggleFullScreen={handleToggleFullScreen}
                quickFilter={quickFilter}
                onQuickFilterChange={setQuickFilter}
                additionalItemsCount={additionalItems.length}
                onOpenAdditionalModal={() => setIsManualEntryModalOpen(true)}
            />
          </div>
        )}

        <Suspense fallback={null}>
            <ReportOptionsModal isOpen={isReportModalOpen} onClose={() => setIsReportModalOpen(false)} onConfirm={handleGenerateReport} totalItems={filteredMedications.length} vaccinesAlreadyExcluded={result?.analysisConfig?.vaccinesExcluded ?? false} />
            <ReviewWarningModal isOpen={showReviewWarning} onClose={() => setShowReviewWarning(false)} progress={reviewProgress} />
            <SuccessModal isOpen={showSuccessModal} onClose={() => setShowSuccessModal(false)} onDownload={handleDownloadClick} />
            <ManualEntryModal isOpen={isManualEntryModalOpen} onClose={() => setIsManualEntryModalOpen(false)} items={additionalItems} onAdd={handleAddAdditionalItem} onRemove={handleRemoveAdditionalItem} />
        </Suspense>
    </div>
  );
};

export default App;
