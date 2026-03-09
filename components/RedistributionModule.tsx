import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import localforage from 'localforage';
import { Upload, FileSpreadsheet, Search, ArrowRightLeft, Building2, Package, AlertCircle, X, ArrowRight, Merge, Split, CheckCircle2, Circle, Filter, ChevronLeft, ChevronRight, Sparkles, TrendingUp, TrendingDown, AlertTriangle, ClipboardList, Trash2, MousePointerClick, ChevronDown, Check, Download, Maximize, Minimize } from 'lucide-react';

// Hook para persistir estado en localStorage
function useLocalStorage<T>(key: string, initialValue: T) {
    const [storedValue, setStoredValue] = useState<T>(() => {
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch (error) {
            console.warn(`Error reading localStorage key "${key}":`, error);
            return initialValue;
        }
    });

    const setValue = (value: T | ((val: T) => T)) => {
        try {
            const valueToStore = value instanceof Function ? value(storedValue) : value;
            setStoredValue(valueToStore);
            window.localStorage.setItem(key, JSON.stringify(valueToStore));
        } catch (error) {
            console.warn(`Error setting localStorage key "${key}":`, error);
        }
    };

    return [storedValue, setValue] as const;
}

const MultiSelectFilter = ({
    title,
    options,
    selectedValues,
    onChange
}: {
    title: string;
    options: { value: string; label: string }[];
    selectedValues: string[];
    onChange: (values: string[]) => void;
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = React.useRef<HTMLDivElement>(null);
    const triggerRef = React.useRef<HTMLDivElement>(null);
    const [menuStyles, setMenuStyles] = useState<React.CSSProperties>({});

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
                triggerRef.current && !triggerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        const updatePosition = () => {
            if (isOpen && triggerRef.current) {
                const rect = triggerRef.current.getBoundingClientRect();
                setMenuStyles({
                    top: rect.bottom + 4,
                    left: rect.left + rect.width / 2,
                    transform: 'translateX(-50%)',
                    maxHeight: window.innerHeight - rect.bottom - 20
                });
            }
        };

        if (isOpen) {
            updatePosition();
            window.addEventListener('scroll', updatePosition, true);
            window.addEventListener('resize', updatePosition);
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            window.removeEventListener('scroll', updatePosition, true);
            window.removeEventListener('resize', updatePosition);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const toggleValue = (val: string) => {
        if (selectedValues.includes(val)) {
            onChange(selectedValues.filter(v => v !== val));
        } else {
            onChange([...selectedValues, val]);
        }
    };

    const isAllSelected = selectedValues.length === 0;

    return (
        <div className="relative inline-flex items-center justify-center w-full h-full" ref={triggerRef}>
            <div
                className="flex items-center justify-center gap-1 cursor-pointer w-full h-full hover:bg-slate-100 transition-colors p-2"
                onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
            >
                <span>{title}</span>
                <Filter className={`h-3 w-3 ${!isAllSelected ? 'text-indigo-600 fill-indigo-600' : 'text-slate-300'}`} />
            </div>

            {isOpen && createPortal(
                <div
                    ref={dropdownRef}
                    className="fixed min-w-[140px] bg-white border border-slate-200 shadow-xl rounded-xl z-[9999] p-2 font-normal text-left text-xs text-slate-700 animate-in fade-in zoom-in-95 duration-200 flex flex-col"
                    style={{ ...menuStyles }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors shrink-0 mb-1 ${isAllSelected ? 'font-bold text-indigo-700 bg-indigo-50/50 hover:bg-indigo-50/50' : ''}`}
                        onClick={() => { onChange([]); setIsOpen(false); }}
                    >
                        <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${isAllSelected ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-slate-300'}`}>
                            {isAllSelected && <Check className="w-2.5 h-2.5" />}
                        </div>
                        <span>Todos</span>
                    </div>

                    <div className="h-px bg-slate-100 my-1 shrink-0"></div>

                    <div className="overflow-y-auto custom-scrollbar flex-1 min-h-0">
                        {options.map(opt => {
                            const isSelected = selectedValues.includes(opt.value);
                            return (
                                <div
                                    key={opt.value}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors ${isSelected ? 'font-bold text-indigo-700 bg-indigo-50/50 hover:bg-indigo-50/50' : ''}`}
                                    onClick={() => toggleValue(opt.value)}
                                >
                                    <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-slate-300'}`}>
                                        {isSelected && <Check className="w-2.5 h-2.5" />}
                                    </div>
                                    <span className="truncate">{opt.label}</span>
                                </div>
                            )
                        })}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};
import * as XLSX from 'xlsx';
import { AvailabilityRecord, RedistributionItem } from '../types';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

interface RedistributionModuleProps {
    onBack?: () => void;
}

export const RedistributionModule: React.FC<RedistributionModuleProps> = ({ onBack }) => {
    const { systemConfig } = useAuth();
    // --- STATE INITIALIZATION ---
    const [isLoaded, setIsLoaded] = useState(false);
    const [records, setRecords] = useState<AvailabilityRecord[]>([]);
    const [selectedMicrored, setSelectedMicrored] = useState<string>('');
    const [selectedEstablishment, setSelectedEstablishment] = useState<string>('');
    const [selectedProductCode, setSelectedProductCode] = useState<string>('');
    const [selectedProductName, setSelectedProductName] = useState<string>('');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // --- FULLSCREEN STATE ---
    const tableContainerRef = React.useRef<HTMLDivElement>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            tableContainerRef.current?.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable fullscreen: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    };

    // --- CONSOLIDATION STATE ---
    const [isConsolidateModalOpen, setIsConsolidateModalOpen] = useState(false);
    const [consolidationSelection, setConsolidationSelection] = useState<Set<string>>(new Set());

    // --- REVIEW STATE ---
    const [reviewedProducts, setReviewedProducts] = useState<Set<string>>(new Set());
    const [productSearch, setProductSearch] = useLocalStorage<string>('aura_productSearch', '');
    const [statusFilter, setStatusFilter] = useLocalStorage<string[]>('aura_statusFilter', []);
    const [reviewFilter, setReviewFilter] = useLocalStorage<string[]>('aura_reviewFilter', []);
    const [tipoFilter, setTipoFilter] = useLocalStorage<string[]>('aura_tipoFilter', []);
    const [petFilter, setPetFilter] = useLocalStorage<string[]>('aura_petFilter', []);
    const [estFilter, setEstFilter] = useLocalStorage<string[]>('aura_estFilter', []);

    // --- CONFIRMATION MODAL STATE ---
    const [isReviewConfirmOpen, setIsReviewConfirmOpen] = useState(false);
    const [pendingNextProductCode, setPendingNextProductCode] = useState<string | null>(null);
    const [autoReviewEnabled, setAutoReviewEnabled] = useState(false);

    // --- DETAIL MODAL STATE ---
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedDetailItem, setSelectedDetailItem] = useState<RedistributionItem | null>(null);

    // --- UPLOAD CONFIRMATION MODAL ---
    const [isConfirmUploadModalOpen, setIsConfirmUploadModalOpen] = useState(false);
    const [isConfirmImportModalOpen, setIsConfirmImportModalOpen] = useState(false);
    const [estSearchTerm, setEstSearchTerm] = useState('');
    const [isEstDropdownOpen, setIsEstDropdownOpen] = useState(false);
    const [mrSearchTerm, setMrSearchTerm] = useState('');
    const [isMrDropdownOpen, setIsMrDropdownOpen] = useState(false);
    const [isGlobalSearchModalOpen, setIsGlobalSearchModalOpen] = useState(false);
    const [globalSearchTerm, setGlobalSearchTerm] = useState('');
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // --- CLEAR SEARCH ON CLOSE ---
    const prevGlobalModalOpen = React.useRef(isGlobalSearchModalOpen);

    useEffect(() => {
        if (prevGlobalModalOpen.current && !isGlobalSearchModalOpen) {
            // Modal transicionó a cerrado
            setGlobalSearchTerm('');

            if (selectedProductCode && selectedMicrored !== 'ALL') {
                setSimulationData(prev => {
                    const productData = prev[selectedProductCode];
                    if (!productData) return prev;

                    const newData = { ...prev };
                    const newProductData = { ...productData };
                    let hasChanges = false;

                    // Limpiar 'Estimar' de establecimientos extra-microred (los de "TODA LA RED")
                    records.forEach(r => {
                        if (r.medCode === selectedProductCode && r.microred !== selectedMicrored) {
                            if (newProductData[r.codEess]) {
                                delete newProductData[r.codEess];
                                hasChanges = true;
                            }
                        }
                    });

                    if (hasChanges) {
                        newData[selectedProductCode] = newProductData;
                        return newData;
                    }
                    return prev;
                });
            }
        }
        prevGlobalModalOpen.current = isGlobalSearchModalOpen;
    }, [isGlobalSearchModalOpen, selectedProductCode, selectedMicrored, records]);

    // --- TRANSFER LIST STATE ---
    const [transferList, setTransferList] = useState<{
        id: string;
        productCode: string;
        productName: string;
        quantity: number;
        originCod: string;
        originName: string;
        destinationCod: string;
        destinationName: string;
    }[]>([]);

    const [simulationData, setSimulationData] = useState<Record<string, Record<string, { qty: number, input: string }>>>({});
    const [isTransferListOpen, setIsTransferListOpen] = useState(false);
    const [quickTransferSource, setQuickTransferSource] = useState<RedistributionItem | null>(null);
    const [quickTransferDestination, setQuickTransferDestination] = useState<RedistributionItem | null>(null);
    const [isQuickTransferConfirmOpen, setIsQuickTransferConfirmOpen] = useState(false);
    const [quickTransferQty, setQuickTransferQty] = useState<string>('');

    // --- LOAD FROM LOCALFORAGE ---
    useEffect(() => {
        const loadData = async () => {
            try {
                const savedRecords = await localforage.getItem<AvailabilityRecord[]>('aura_records');
                if (savedRecords && Array.isArray(savedRecords)) setRecords(savedRecords);

                const savedMicrored = await localforage.getItem<string>('aura_selectedMicrored');
                if (savedMicrored) setSelectedMicrored(savedMicrored);

                const savedEstablishment = await localforage.getItem<string>('aura_selectedEstablishment');
                if (savedEstablishment) setSelectedEstablishment(savedEstablishment);

                const savedProductCode = await localforage.getItem<string>('aura_selectedProductCode');
                if (savedProductCode) setSelectedProductCode(savedProductCode);

                const savedProductName = await localforage.getItem<string>('aura_selectedProductName');
                if (savedProductName) setSelectedProductName(savedProductName);

                const savedConsolidation = await localforage.getItem<string[]>('aura_consolidationSelection');
                if (savedConsolidation && Array.isArray(savedConsolidation)) setConsolidationSelection(new Set(savedConsolidation));

                const savedReviewed = await localforage.getItem<string[]>('aura_reviewedProducts');
                if (savedReviewed && Array.isArray(savedReviewed)) setReviewedProducts(new Set(savedReviewed));

                const savedTransferList = await localforage.getItem<any[]>('aura_transferList');
                if (savedTransferList && Array.isArray(savedTransferList)) setTransferList(savedTransferList);

                const savedSimulation = await localforage.getItem<any>('aura_simulationData');
                if (savedSimulation && typeof savedSimulation === 'object' && !Array.isArray(savedSimulation)) setSimulationData(savedSimulation);
            } catch (e) {
                console.error("Error loading data from localforage", e);
            } finally {
                setIsLoaded(true);
            }
        };
        loadData();
    }, []);

    // --- SYNC TO LOCALFORAGE ---
    useEffect(() => {
        if (!isLoaded) return;
        localforage.setItem('aura_records', records).catch(e => console.warn("Could not save records to localforage", e));
    }, [records, isLoaded]);

    useEffect(() => {
        if (!isLoaded) return;
        localforage.setItem('aura_selectedMicrored', selectedMicrored).catch(() => { });
    }, [selectedMicrored, isLoaded]);

    useEffect(() => {
        if (!isLoaded) return;
        localforage.setItem('aura_selectedEstablishment', selectedEstablishment).catch(() => { });
    }, [selectedEstablishment, isLoaded]);

    useEffect(() => {
        if (!isLoaded) return;
        localforage.setItem('aura_selectedProductCode', selectedProductCode).catch(() => { });
    }, [selectedProductCode, isLoaded]);

    useEffect(() => {
        if (!isLoaded) return;
        localforage.setItem('aura_selectedProductName', selectedProductName).catch(() => { });
    }, [selectedProductName, isLoaded]);

    useEffect(() => {
        if (!isLoaded) return;
        localforage.setItem('aura_consolidationSelection', Array.from(consolidationSelection)).catch(() => { });
    }, [consolidationSelection, isLoaded]);

    useEffect(() => {
        if (!isLoaded) return;
        localforage.setItem('aura_reviewedProducts', Array.from(reviewedProducts)).catch(() => { });
    }, [reviewedProducts, isLoaded]);

    useEffect(() => {
        if (!isLoaded) return;
        localforage.setItem('aura_transferList', transferList).catch(() => { });
    }, [transferList, isLoaded]);

    useEffect(() => {
        if (!isLoaded) return;
        localforage.setItem('aura_simulationData', simulationData).catch(() => { });
    }, [simulationData, isLoaded]);

    // --- 1. FILE UPLOAD ---
    const importInputRef = React.useRef<HTMLInputElement>(null);

    const handleExportSession = async () => {
        try {
            setLoading(true);
            const exportData: any = {
                version: "1.0",
                timestamp: new Date().toISOString(),
                localforage: {},
                localStorage: {}
            };

            // Get localforage data
            exportData.localforage.aura_records = await localforage.getItem('aura_records');
            exportData.localforage.aura_selectedMicrored = await localforage.getItem('aura_selectedMicrored');
            exportData.localforage.aura_selectedEstablishment = await localforage.getItem('aura_selectedEstablishment');
            exportData.localforage.aura_selectedProductCode = await localforage.getItem('aura_selectedProductCode');
            exportData.localforage.aura_selectedProductName = await localforage.getItem('aura_selectedProductName');
            exportData.localforage.aura_consolidationSelection = await localforage.getItem('aura_consolidationSelection');
            exportData.localforage.aura_reviewedProducts = await localforage.getItem('aura_reviewedProducts');
            exportData.localforage.aura_transferList = await localforage.getItem('aura_transferList');
            exportData.localforage.aura_simulationData = await localforage.getItem('aura_simulationData');

            // Get localStorage data
            const lsKeys = [
                'aura_productSearch',
                'aura_statusFilter',
                'aura_reviewFilter',
                'aura_tipoFilter',
                'aura_petFilter',
                'aura_estFilter'
            ];
            
            lsKeys.forEach(key => {
                const val = window.localStorage.getItem(key);
                if (val) {
                    exportData.localStorage[key] = JSON.parse(val);
                }
            });

            // Create and download file
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", `Aura_Respaldo_${new Date().toISOString().split('T')[0]}.json`);
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
            
            toast.success("Sesión exportada correctamente");
        } catch (error) {
            console.error("Error exporting session:", error);
            toast.error("Error al exportar la sesión");
        } finally {
            setLoading(false);
        }
    };

    const handleImportSession = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            setLoading(true);
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const content = e.target?.result as string;
                    const importedData = JSON.parse(content);

                    if (!importedData.localforage || !importedData.localforage.aura_records || !Array.isArray(importedData.localforage.aura_records)) {
                        throw new Error("Formato de archivo inválido");
                    }

                    if (importedData.localforage.aura_records.length === 0) {
                        throw new Error("El archivo de respaldo está vacío (no contiene registros).");
                    }

                    // Restore localforage
                    for (const [key, value] of Object.entries(importedData.localforage)) {
                        if (value !== undefined && value !== null) {
                            await localforage.setItem(key, value);
                        } else {
                            await localforage.removeItem(key);
                        }
                    }

                    // Restore localStorage
                    if (importedData.localStorage) {
                        for (const [key, value] of Object.entries(importedData.localStorage)) {
                            window.localStorage.setItem(key, JSON.stringify(value));
                        }
                    }

                    // Update state variables directly
                    if (importedData.localforage.aura_records) setRecords(importedData.localforage.aura_records);
                    if (importedData.localforage.aura_selectedMicrored) setSelectedMicrored(importedData.localforage.aura_selectedMicrored);
                    if (importedData.localforage.aura_selectedEstablishment) setSelectedEstablishment(importedData.localforage.aura_selectedEstablishment);
                    if (importedData.localforage.aura_selectedProductCode) setSelectedProductCode(importedData.localforage.aura_selectedProductCode);
                    if (importedData.localforage.aura_selectedProductName) setSelectedProductName(importedData.localforage.aura_selectedProductName);
                    if (importedData.localforage.aura_consolidationSelection) setConsolidationSelection(new Set(importedData.localforage.aura_consolidationSelection));
                    if (importedData.localforage.aura_reviewedProducts) setReviewedProducts(new Set(importedData.localforage.aura_reviewedProducts));
                    if (importedData.localforage.aura_transferList) setTransferList(importedData.localforage.aura_transferList);
                    if (importedData.localforage.aura_simulationData) setSimulationData(importedData.localforage.aura_simulationData);

                    if (importedData.localStorage) {
                        if (importedData.localStorage.aura_productSearch !== undefined) setProductSearch(importedData.localStorage.aura_productSearch);
                        if (importedData.localStorage.aura_statusFilter !== undefined) setStatusFilter(importedData.localStorage.aura_statusFilter);
                        if (importedData.localStorage.aura_reviewFilter !== undefined) setReviewFilter(importedData.localStorage.aura_reviewFilter);
                        if (importedData.localStorage.aura_tipoFilter !== undefined) setTipoFilter(importedData.localStorage.aura_tipoFilter);
                        if (importedData.localStorage.aura_petFilter !== undefined) setPetFilter(importedData.localStorage.aura_petFilter);
                        if (importedData.localStorage.aura_estFilter !== undefined) setEstFilter(importedData.localStorage.aura_estFilter);
                    }

                    toast.success("Sesión importada correctamente.");
                    setLoading(false);

                    // Reset the file input so the same file can be imported again
                    if (importInputRef.current) {
                        importInputRef.current.value = '';
                    }

                } catch (error: any) {
                    console.error("Error parsing imported session:", error);
                    toast.error(error.message || "Error al leer el archivo de respaldo");
                    setLoading(false);
                }
            };
            reader.readAsText(file);
        } catch (error: any) {
            console.error("Error importing session:", error);
            toast.error(error.message || "Error al importar la sesión");
            setLoading(false);
        }
        
        // Reset input
        if (importInputRef.current) importInputRef.current.value = '';
    };

    const clearRedistributionData = () => {
        setRecords([]);
        setSelectedMicrored('');
        setSelectedEstablishment('');
        setSelectedProductCode('');
        setSelectedProductName('');
        setConsolidationSelection(new Set());
        setReviewedProducts(new Set());
        setTransferList([]);
        setSimulationData({});
        setProductSearch('');
        setStatusFilter([]);
        setReviewFilter([]);
        setTipoFilter([]);
        setPetFilter([]);
        setEstFilter([]);
        
        localforage.removeItem('aura_records');
        localforage.removeItem('aura_selectedMicrored');
        localforage.removeItem('aura_selectedEstablishment');
        localforage.removeItem('aura_selectedProductCode');
        localforage.removeItem('aura_selectedProductName');
        localforage.removeItem('aura_consolidationSelection');
        localforage.removeItem('aura_reviewedProducts');
        localforage.removeItem('aura_transferList');
        localforage.removeItem('aura_simulationData');
        window.localStorage.removeItem('aura_productSearch');
        window.localStorage.removeItem('aura_statusFilter');
        window.localStorage.removeItem('aura_reviewFilter');
        window.localStorage.removeItem('aura_tipoFilter');
        window.localStorage.removeItem('aura_petFilter');
        window.localStorage.removeItem('aura_estFilter');
    };

    const renderModal = (modalContent: React.ReactNode) => {
        const target = isFullscreen && tableContainerRef.current ? tableContainerRef.current : document.body;
        return createPortal(modalContent, target);
    };

    const processFile = (file: File, lastMonth: number, lastYear: number) => {
        setLoading(true);
        setError(null);

        // Simulate processing delay for animation
        setTimeout(() => {
            const reader = new FileReader();
            reader.onload = (evt) => {
                try {
                    const bstr = evt.target?.result;
                    const wb = XLSX.read(bstr, { type: 'binary' });
                    const wsname = wb.SheetNames[0];
                    const ws = wb.Sheets[wsname];

                    // Use header: "A" to get data with column letters (A, B, C...) as keys
                    const rawData = XLSX.utils.sheet_to_json(ws, { header: "A" }) as Record<string, any>[];

                    // 1. Find Header Row
                    let headerRowIndex = -1;
                    const colMap: Record<string, string> = {}; // Map Field Name -> Column Letter (e.g., "STOCK" -> "K")

                    // Define required headers for each format (with variations)
                    const requiredNew = [
                        ["RED"],
                        ["MICRORED"],
                        ["COD EESS", "COD. EESS"],
                        ["ESTABLECIMIENTO", "EESS"],
                        ["PRODUCTO", "DESCRIPCION"],
                        ["STOCK"],
                        ["MES_1"]
                    ];
                    const requiredOld = [
                        ["COD EESS", "COD. EESS"],
                        ["ESTABLECIMIENTO", "EESS"],
                        ["PRODUCTO", "DESCRIPCION"],
                        ["STOCK"],
                        ["CPA"]
                    ];

                    for (let i = 0; i < Math.min(20, rawData.length); i++) {
                        const row = rawData[i];
                        const values = Object.values(row).map(v => String(v).toUpperCase().trim());

                        const hasNew = requiredNew.every(variations => variations.some(v => values.some(val => val.includes(v))));
                        const hasOld = requiredOld.every(variations => variations.some(v => values.some(val => val.includes(v))));

                        if (hasNew || hasOld) {
                            headerRowIndex = i;
                            // Build Column Map
                            Object.entries(row).forEach(([key, val]) => {
                                const header = String(val).toUpperCase().trim();
                                colMap[header] = key;
                            });
                            break;
                        }
                    }

                    if (headerRowIndex === -1) {
                        throw new Error("Estructura inválida: El archivo no contiene las columnas necesarias. Verifique que sea la plantilla correcta.");
                    }

                    // 2. Process Data Rows (Start after header)
                    const parsedRecords: AvailabilityRecord[] = [];
                    const consumptionCols = ['O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];

                    for (let i = headerRowIndex + 1; i < rawData.length; i++) {
                        const row = rawData[i];

                        const getVal = (headerPart: string) => {
                            const key = Object.keys(colMap).find(k => k === headerPart) || Object.keys(colMap).find(k => k.includes(headerPart));
                            return key ? row[colMap[key]] : undefined;
                        };

                        const getValExact = (headerExact: string) => {
                            const key = Object.keys(colMap).find(k => k === headerExact);
                            return key ? row[colMap[key]] : undefined;
                        };

                        // Basic Validation: Must have Microred and Med Code
                        const microred = getVal("MICRORED");
                        const medCode = getVal("COD PRODUCTO") || getVal("CODIGO PRODUCTO") || getVal("MED COD") || getVal("CODIGO") || getVal("COD");

                        if (!microred || !medCode) continue;

                        const stock = Number(getVal("STOCK") || 0);
                        const cpa = Number(getVal("CPA") || 0);

                        // Fix Months Provision
                        let monthsProvision = Number(getVal("MES PROV") || getVal("MESES") || 0);
                        if ((monthsProvision === 0 || isNaN(monthsProvision)) && cpa > 0) {
                            monthsProvision = stock / cpa;
                        }

                        // 3. Calculate Consumption from Columns
                        let consumptionSum = 0;
                        let consumptionMonths = 0;
                        const monthlyConsumption: number[] = [];

                        // Check if we have MES_1...MES_12 columns
                        const mesCols = ['MES_1', 'MES_2', 'MES_3', 'MES_4', 'MES_5', 'MES_6', 'MES_7', 'MES_8', 'MES_9', 'MES_10', 'MES_11', 'MES_12'];
                        const hasMesCols = mesCols.some(col => colMap[col]);

                        if (hasMesCols) {
                            // Map MES_1...MES_12 to actual months based on lastMonth
                            // MES_1 is the oldest, MES_12 is the newest (lastMonth)
                            // lastMonth is 1-indexed (1=Jan, 12=Dec)
                            
                            // We need to store the consumption in a way that the UI can display them correctly
                            // based on the selected lastMonth.
                            // Let's store them in an array where index 0 is Jan, index 11 is Dec.
                            const consumptionByMonth = new Array(12).fill(0);
                            
                            for (let m = 0; m < 12; m++) {
                                const colName = `MES_${m + 1}`;
                                const val = Number(getVal(colName) || 0);
                                
                                // Calculate the actual month index (0-11)
                                // lastMonth is 1-based, so lastMonth-1 is the index of the newest month.
                                // MES_12 corresponds to lastMonth-1
                                // MES_1 corresponds to (lastMonth - 12 + 12) % 12
                                
                                const monthIndex = (lastMonth - 1 - (11 - m) + 12) % 12;
                                consumptionByMonth[monthIndex] = val;
                                
                                consumptionSum += val;
                                if (val > 0) consumptionMonths++;
                            }
                            
                            // Replace monthlyConsumption with the ordered array
                            monthlyConsumption.push(...consumptionByMonth);
                        } else {
                            // Fallback to old consumption columns
                            consumptionCols.forEach(colKey => {
                                const val = Number(row[colKey]);
                                if (!isNaN(val)) {
                                    consumptionSum += val;
                                    if (val > 0) consumptionMonths++;
                                    monthlyConsumption.push(val);
                                } else {
                                    monthlyConsumption.push(0);
                                }
                            });
                        }

                        // --- NEW CALCULATION LOGIC (User Request) ---
                        // CPA = Total Consumption / Months with Consumption
                        let calculatedCpa = Number(getVal("CPA") || 0);
                        if (calculatedCpa === 0 && consumptionMonths > 0) {
                            calculatedCpa = consumptionSum / consumptionMonths;
                        }

                        // Months Provision = Stock / Calculated CPA
                        let calculatedMonthsProvision = Number(getVal("MES PROV") || getVal("MESES") || 0);
                        if (calculatedMonthsProvision === 0 && calculatedCpa > 0.01) {
                            calculatedMonthsProvision = stock / calculatedCpa;
                        } else if (stock > 0 && calculatedCpa <= 0.01) {
                            calculatedMonthsProvision = 999; // Infinite provision if stock > 0 but no consumption
                        }

                        // Recalculate Status based on new metrics (User Request: ALWAYS CALCULATE)
                        let calculatedStatus = '';

                        if (stock === 0) {
                            calculatedStatus = 'Desabastecido';
                        } else if (calculatedCpa <= 0.01) {
                            calculatedStatus = 'Sin Rotación';
                        } else if (calculatedMonthsProvision < 2) {
                            calculatedStatus = 'SubStock';
                        } else if (calculatedMonthsProvision > 6) {
                            calculatedStatus = 'SobreStock';
                        } else {
                            calculatedStatus = 'NormoStock';
                        }

                        parsedRecords.push({
                            ue: String(getVal("UE") || ''),
                            red: String(getVal("RED") || ''),
                            microred: String(microred),
                            codEess: String(getVal("COD EESS") || getVal("COD. EESS") || ''),
                            establishmentName: String(getVal("ESTABLECIMIENTO") || getVal("EESS") || ''),
                            category: String(getVal("CAT") || ''),
                            medCode: String(medCode),
                            medName: String(getVal("DESCRIPCION") || getVal("PRODUCTO") || ''),
                            ff: String(getVal("F.F") || ''),
                            price: Number(getVal("PRECIO") || 0),
                            type: String(getValExact("TIPO") || ''),
                            pet: String(getValExact("PET") || ''),
                            est: String(getValExact("EST") || ''),
                            stock: stock,
                            cpa: calculatedCpa, // Use Calculated CPA
                            monthsProvision: calculatedMonthsProvision, // Use Calculated Months
                            status: calculatedStatus,
                            expiryDate: String(getVal("VENCIMIENTO") || getVal("VENC") || ''),
                            consumptionSum: consumptionSum,
                            consumptionMonths: consumptionMonths,
                            monthlyConsumption: monthlyConsumption
                        });
                    }

                    setRecords(parsedRecords);
                    setLoading(false);
                    toast.success("Archivo procesado correctamente");
                } catch (err: any) {
                    console.error(err);
                    setError("Error al procesar el archivo: " + err.message);
                    toast.error("Error al procesar el archivo");
                    setLoading(false);
                }
            };
            reader.readAsBinaryString(file);
        }, 500);
    };

    const [isLastMonthModalOpen, setIsLastMonthModalOpen] = useState(false);
    const [fileToProcess, setFileToProcess] = useState<File | null>(null);
    // lastMonthYear should be YYYY-MM
    const [lastMonthYear, setLastMonthYear] = useState<string>(
        `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
    );

    const downloadTemplate = () => {
        const headers = [
            "RED", "MICRORED", "COD EESS", "ESTABLECIMIENTO", "CAT",
            "COD PRODUCTO", "PRODUCTO", "F.F", "PRECIO", "TIPO", "PET", "EST",
            "MES_1", "MES_2", "MES_3", "MES_4", "MES_5", "MES_6",
            "MES_7", "MES_8", "MES_9", "MES_10", "MES_11", "MES_12",
            "STOCK"
        ];
        const ws = XLSX.utils.aoa_to_sheet([headers]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Plantilla");
        XLSX.writeFile(wb, "Plantilla_Disponibilidad.xlsx");
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate File Extension
        const fileName = file.name.toLowerCase();
        if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
            toast.error("Formato de archivo incorrecto. Por favor suba un archivo Excel (.xlsx o .xls).");
            return;
        }

        setFileToProcess(file);
        setIsLastMonthModalOpen(true);
    };

    const confirmFileProcessing = () => {
        if (fileToProcess) {
            // Parse YYYY-MM to month (1-12) and year
            const [year, month] = lastMonthYear.split('-').map(Number);
            processFile(fileToProcess, month, year);
            setIsLastMonthModalOpen(false);
            setFileToProcess(null);
        }
    };


    // --- 2. FILTERS ---
    const microredOptions = useMemo(() => {
        const unique = new Set(records.map(r => r.microred));
        return Array.from(unique).sort();
    }, [records]);

    const productOptions = useMemo(() => {
        if (!selectedMicrored) return [];

        let filtered = records;
        if (selectedMicrored !== 'ALL') {
            filtered = filtered.filter(r => r.microred === selectedMicrored);
        }
        if (selectedEstablishment) {
            filtered = filtered.filter(r => r.codEess === selectedEstablishment);
        }

        // Aggregate data by product code
        const productMap = new Map<string, {
            name: string;
            totalStock: number;
            monthlyVector: number[];
            type: string;
            pet: string;
            est: string;
        }>();

        filtered.forEach(r => {
            if (!productMap.has(r.medCode)) {
                productMap.set(r.medCode, {
                    name: r.medName,
                    totalStock: 0,
                    monthlyVector: Array(12).fill(0),
                    type: r.type || '',
                    pet: r.pet || '',
                    est: r.est || ''
                });
            }
            const entry = productMap.get(r.medCode)!;
            entry.totalStock += r.stock;

            // Sum monthly consumption vector to calculate consolidated CPA correctly
            if (Array.isArray(r.monthlyConsumption) && r.monthlyConsumption.length === 12) {
                for (let i = 0; i < 12; i++) {
                    entry.monthlyVector[i] += Number(r.monthlyConsumption[i]) || 0;
                }
            }
        });

        return Array.from(productMap.entries()).map(([code, data]) => {
            // Calculate consolidated metrics based on summed vector
            const totalConsumption = data.monthlyVector.reduce((a, b) => a + b, 0);
            const activeMonths = data.monthlyVector.filter(v => v > 0).length;

            const cpa = activeMonths > 0 ? (totalConsumption / activeMonths) : 0;
            const months = cpa > 0 ? (data.totalStock / cpa) : (data.totalStock > 0 ? 999 : 0);

            let status = 'NormoStock';
            if (data.totalStock === 0) {
                status = 'Desabastecido';
            } else if (cpa <= 0.01) {
                status = 'Sin Rotación';
            } else if (months < 2) {
                status = 'SubStock';
            } else if (months > 6) {
                status = 'SobreStock';
            }

            return {
                code,
                name: data.name,
                cpa: cpa,
                months: months,
                activeMonths: activeMonths,
                status: status,
                type: data.type,
                pet: data.pet,
                est: data.est,
                totalStock: data.totalStock,
                monthlyVector: data.monthlyVector
            };
        }).sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    }, [records, selectedMicrored, selectedEstablishment]);

    const filteredProductOptions = useMemo(() => {
        let result = productOptions;

        // 1. Text Search
        if (productSearch) {
            const lower = String(productSearch || '').toLowerCase();
            result = result.filter(p =>
                String(p.name || '').toLowerCase().includes(lower) ||
                String(p.code || '').toLowerCase().includes(lower)
            );
        }

        // 2. Status Filter
        if (statusFilter.length > 0) {
            result = result.filter(p => statusFilter.includes(p.status));
        }

        // 3. Review Filter
        if (reviewFilter.length > 0) {
            result = result.filter(p => {
                const isReviewed = reviewedProducts.has(p.code);
                return (isReviewed && reviewFilter.includes('REVIEWED')) || (!isReviewed && reviewFilter.includes('PENDING'));
            });
        }

        if (tipoFilter.length > 0) {
            result = result.filter(p => tipoFilter.includes(String(p.type || '').toUpperCase()));
        }

        if (petFilter.length > 0) {
            result = result.filter(p => petFilter.includes(String(p.pet || '').toUpperCase()));
        }

        if (estFilter.length > 0) {
            result = result.filter(p => estFilter.includes(String(p.est || '').toUpperCase()));
        }

        return result;
    }, [productOptions, productSearch, statusFilter, reviewFilter, reviewedProducts, tipoFilter, petFilter, estFilter]);

    const microredStats = useMemo(() => {
        if (!selectedMicrored) return null;
        const mrRecords = selectedMicrored === 'ALL' ? records : records.filter(r => r.microred === selectedMicrored);
        const establishments = new Set(mrRecords.map(r => r.codEess)).size;
        const totalItems = mrRecords.length;
        const uniqueProducts = new Set(mrRecords.map(r => r.medCode)).size;
        return { establishments, totalItems, uniqueProducts };
    }, [selectedMicrored, records]);

    const establishmentOptions = useMemo(() => {
        if (!selectedMicrored) return [];
        const mrRecords = selectedMicrored === 'ALL' ? records : records.filter(r => r.microred === selectedMicrored);
        const establishments = Array.from(new Map(mrRecords.map(r => [r.codEess, r.establishmentName])).entries())
            .map(([cod, name]) => ({ cod, name }))
            .sort((a, b) => a.name.localeCompare(b.name));
        return establishments;
    }, [records, selectedMicrored]);

    // --- 3. REDISTRIBUTION LOGIC ---
    const handleMicroredChange = (microred: string) => {
        setSelectedMicrored(microred);
        setSelectedEstablishment('');
        setSelectedProductCode('');
        setSelectedProductName('');
        setProductSearch('');
        setStatusFilter([]);
        setReviewFilter([]);
        setTipoFilter([]);
        setPetFilter([]);
        setEstFilter([]);
    };

    const calculateNeed = (stock: number, cpa: number, status: string, consumptionMonths: number): number => {
        const stockNum = Number(stock);
        const cpaNum = Number(cpa);
        const monthsNum = Number(consumptionMonths);

        // Formula: NEED = (CPA * 6) - STOCK
        if (status === "Sin Rotación") return 0;

        // Calculate with precision
        let need = (cpaNum * 6) - stockNum;

        // Apply adjustment for regular consumption (consumptionMonths > 6)
        if (monthsNum > 6) {
            need = Math.round(need) + Math.round(cpaNum);
        } else {
            need = Math.round(need);
        }

        // If balance is positive and status is SobreStock, consider balance 0
        // Case insensitive check for status
        if (need > 0 && String(status).toLowerCase() === "sobrestock") {
            return 0;
        }

        return need;
    };

    const handleProductChange = (productCode: string) => {
        setSelectedProductCode(productCode);

        // Find and set product name
        const product = productOptions.find(p => p.code === productCode);
        if (product) setSelectedProductName(product.name);

        if (!productCode) {
            setSelectedProductName('');
            return;
        }
    };

    const baseRedistributionData = useMemo(() => {
        if (!selectedProductCode || !selectedMicrored || records.length === 0) return [];

        const allEstablishments: { cod: string, name: string, microred: string }[] = Array.from(new Set(
            records
                .filter(r => selectedMicrored === 'ALL' || r.microred === selectedMicrored)
                .map(r => JSON.stringify({ cod: r.codEess, name: r.establishmentName, microred: r.microred }))
        )).map(s => JSON.parse(s));


        if (systemConfig.warehouseCode && systemConfig.warehouseName) {
            if (!allEstablishments.find(e => e.cod === systemConfig.warehouseCode)) {
                allEstablishments.push({
                    cod: systemConfig.warehouseCode,
                    name: systemConfig.warehouseName,
                    microred: 'ALMACEN'
                });
            }
        }

        const productRecords = records.filter(r =>
            r.medCode === selectedProductCode && (
                selectedMicrored === 'ALL' ||
                r.microred === selectedMicrored
            )
        );

        const transfersForProduct = transferList.filter(t => t.productCode === selectedProductCode);
        const simDataForProduct = simulationData[selectedProductCode] || {};

        const initialData: RedistributionItem[] = allEstablishments.map(eess => {
            const r = productRecords.find(pr => pr.codEess === eess.cod);

            const transferQty = transfersForProduct.filter(t => t.originCod === eess.cod).reduce((sum, t) => sum + t.quantity, 0);
            const receivedQty = transfersForProduct.filter(t => t.destinationCod === eess.cod).reduce((sum, t) => sum + t.quantity, 0);

            const simQty = simDataForProduct[eess.cod]?.qty || 0;
            const simInput = simDataForProduct[eess.cod]?.input || '';

            const isWarehouse = eess.cod === systemConfig.warehouseCode;

            if (r) {
                const need = calculateNeed(r.stock, r.cpa, r.status, Number(r.consumptionMonths || 0));

                return {
                    codEess: r.codEess,
                    establishmentName: r.establishmentName,
                    microred: r.microred,
                    stock: r.stock,
                    cpa: r.cpa,
                    monthsProvision: r.monthsProvision,
                    status: r.status,
                    transferQty,
                    receivedQty,
                    need: need,
                    consumptionSum: r.consumptionSum || 0,
                    consumptionMonths: r.consumptionMonths || 0,
                    monthlyConsumption: Array.isArray(r.monthlyConsumption) ? r.monthlyConsumption : Array(12).fill(0),
                    simulationQty: simQty,
                    simulationInput: simInput,
                    isWarehouse
                };
            } else {
                return {
                    codEess: eess.cod,
                    establishmentName: eess.name,
                    microred: eess.microred,
                    stock: 0,
                    cpa: 0,
                    monthsProvision: 0,
                    status: 'Sin Stock',
                    transferQty,
                    receivedQty,
                    need: 0,
                    consumptionSum: 0,
                    consumptionMonths: 0,
                    monthlyConsumption: Array(12).fill(0),
                    simulationQty: simQty,
                    simulationInput: simInput,
                    isWarehouse
                };
            }
        });

        const baseNamesMap: Record<string, string> = {};
        allEstablishments.forEach(e => {
            const cod = String(e.cod || '');
            if (cod.endsWith('F01')) {
                baseNamesMap[cod.substring(0, 5)] = String(e.name || '');
            }
        });

        initialData.forEach(item => {
            const cod = String(item.codEess || '');
            let sortName = String(item.establishmentName || '');
            if (/F\d{2}$/.test(cod)) {
                const baseCod = cod.substring(0, 5);
                if (baseNamesMap[baseCod]) {
                    sortName = baseNamesMap[baseCod];
                }
            }
            (item as any)._sortName = sortName;
        });

        initialData.sort((a, b) => {
            if (a.isWarehouse) return -1;
            if (b.isWarehouse) return 1;

            // If ALL microreds are selected, group by Microred first
            if (selectedMicrored === 'ALL') {
                const microredA = String(a.microred || '');
                const microredB = String(b.microred || '');
                if (microredA !== microredB) {
                    return microredA.localeCompare(microredB);
                }
            }

            const nameA = (a as any)._sortName;
            const nameB = (b as any)._sortName;

            if (nameA === nameB) {
                return String(a.codEess || '').localeCompare(String(b.codEess || ''));
            }
            return nameA.localeCompare(nameB);
        });

        initialData.forEach(item => {
            delete (item as any)._sortName;
        });

        return initialData;
    }, [records, selectedMicrored, selectedProductCode, transferList, simulationData, systemConfig]);

    // Memoized data for Global Search Modal
    const globalNetworkData = useMemo(() => {
        if (!selectedProductCode || records.length === 0) return [];

        // Get all establishments that have this product across the entire network, excluding the selected microred
        const productRecords = records.filter(r =>
            r.medCode === selectedProductCode &&
            r.stock > 0 &&
            (selectedMicrored !== 'ALL' ? r.microred !== selectedMicrored : true)
        );

        const transfersForProduct = transferList.filter(t => t.productCode === selectedProductCode);
        const simDataForProduct = simulationData[selectedProductCode] || {};

        return productRecords.map(r => {
            const transferQty = transfersForProduct.filter(t => t.originCod === r.codEess).reduce((sum, t) => sum + t.quantity, 0);
            const receivedQty = transfersForProduct.filter(t => t.destinationCod === r.codEess).reduce((sum, t) => sum + t.quantity, 0);

            const simQty = simDataForProduct[r.codEess]?.qty || 0;
            const simInput = simDataForProduct[r.codEess]?.input || '';

            return {
                codEess: r.codEess,
                establishmentName: r.establishmentName,
                microred: r.microred,
                stock: r.stock,
                cpa: r.cpa,
                monthsProvision: r.monthsProvision,
                status: r.status,
                transferQty,
                receivedQty,
                need: calculateNeed(r.stock, r.cpa, r.status, Number(r.consumptionMonths || 0)),
                consumptionSum: r.consumptionSum || 0,
                consumptionMonths: r.consumptionMonths || 0,
                monthlyConsumption: Array.isArray(r.monthlyConsumption) ? r.monthlyConsumption : Array(12).fill(0),
                simulationQty: simQty,
                simulationInput: simInput,
                isWarehouse: false
            } as RedistributionItem;
        }).sort((a, b) => b.stock - a.stock);
    }, [selectedProductCode, records, transferList, simulationData]);

    const redistributionData = useMemo(() => {
        let result = baseRedistributionData;

        if (consolidationSelection.size > 0) {
            const processedSecondaries = new Set<string>();
            const workingData = baseRedistributionData.map(item => ({
                ...item,
                monthlyConsumption: Array.isArray(item.monthlyConsumption) ? [...item.monthlyConsumption] : Array(12).fill(0)
            }));

            workingData.forEach(item => {
                if (consolidationSelection.has(item.codEess)) {
                    const safeCodEess = String(item.codEess || '');
                    const baseCode = safeCodEess.substring(0, 5);
                    const principalCode = baseCode + 'F01';
                    const principalItem = workingData.find(p => p.codEess === principalCode);

                    if (principalItem) {
                        processedSecondaries.add(item.codEess);

                        principalItem.stock += item.stock;

                        if (Array.isArray(principalItem.monthlyConsumption) && Array.isArray(item.monthlyConsumption)) {
                            for (let i = 0; i < 12; i++) {
                                principalItem.monthlyConsumption[i] = (Number(principalItem.monthlyConsumption[i]) || 0) + (Number(item.monthlyConsumption[i]) || 0);
                            }
                            principalItem.consumptionSum = principalItem.monthlyConsumption.reduce((a, b) => a + b, 0);
                            principalItem.consumptionMonths = principalItem.monthlyConsumption.filter(v => v > 0).length;
                            if (principalItem.consumptionMonths > 0) {
                                principalItem.cpa = (principalItem.consumptionSum || 0) / principalItem.consumptionMonths;
                            } else {
                                principalItem.cpa = 0;
                            }
                        } else {
                            principalItem.cpa += item.cpa;
                            principalItem.consumptionSum = (principalItem.consumptionSum || 0) + (item.consumptionSum || 0);
                            principalItem.consumptionMonths = Math.max(principalItem.consumptionMonths || 0, item.consumptionMonths || 0);
                        }

                        if (principalItem.cpa > 0.01) {
                            principalItem.monthsProvision = principalItem.stock / principalItem.cpa;
                        } else {
                            principalItem.monthsProvision = principalItem.stock > 0 ? 999 : 0;
                        }

                        if (principalItem.stock === 0) principalItem.status = 'Desabastecido';
                        else if (principalItem.cpa <= 0.01) principalItem.status = 'Sin Rotación';
                        else if (principalItem.monthsProvision < 2) principalItem.status = 'SubStock';
                        else if (principalItem.monthsProvision > 6) principalItem.status = 'SobreStock';
                        else principalItem.status = 'NormoStock';

                        const baseNeed = calculateNeed(principalItem.stock, principalItem.cpa, principalItem.status, principalItem.consumptionMonths || 0);
                        let baseRedist = 0;
                        if (principalItem.status === 'SobreStock' && principalItem.monthsProvision > 6) {
                            baseRedist = Math.floor(principalItem.stock - (6 * principalItem.cpa));
                        }
                        principalItem.need = baseNeed > 0 ? baseNeed : (baseRedist > 0 ? -baseRedist : 0);

                        principalItem.isConsolidated = true;
                    }
                }
            });

            result = workingData.filter(item => !processedSecondaries.has(item.codEess));
        }

        // Filter warehouse visibility
        return result.filter(item => {
            if (item.isWarehouse) {
                // Show only if there's an active origin selection or active transfers/received
                return quickTransferSource !== null || (item.transferQty || 0) > 0 || (item.receivedQty || 0) > 0;
            }
            return true;
        });
    }, [baseRedistributionData, consolidationSelection, quickTransferSource]);

    const handleSimulationChange = (codEess: string, value: string) => {
        let numValue = 0;

        if (value === '' || value === '-') {
            numValue = 0;
        } else {
            const parsed = parseInt(value);
            if (!isNaN(parsed)) {
                numValue = parsed;
            } else {
                return; // Invalid input (e.g. letters), ignore
            }
        }

        setSimulationData(prev => ({
            ...prev,
            [selectedProductCode]: {
                ...(prev[selectedProductCode] || {}),
                [codEess]: { qty: numValue, input: value }
            }
        }));
    };

    // --- CONSOLIDATION HANDLERS ---
    const handleOpenConsolidateModal = () => {
        if (baseRedistributionData.length === 0) {
            toast.error("No hay datos para consolidar.");
            return;
        }
        setIsConsolidateModalOpen(true);
    };

    const toggleConsolidation = (codEess: string) => {
        setConsolidationSelection(prev => {
            const next = new Set(prev);
            if (next.has(codEess)) {
                next.delete(codEess);
            } else {
                next.add(codEess);
            }
            return next;
        });
    };

    const toggleGroupConsolidation = (secondaries: RedistributionItem[]) => {
        setConsolidationSelection(prev => {
            const next = new Set(prev);
            const allSelected = secondaries.every(s => prev.has(s.codEess));

            if (allSelected) {
                secondaries.forEach(s => next.delete(s.codEess));
            } else {
                secondaries.forEach(s => next.add(s.codEess));
            }
            return next;
        });
    };

    const applyConsolidationSelection = () => {
        setIsConsolidateModalOpen(false);
        toast.success("Vista actualizada");
    };

    const handleQuickConsolidation = (e: React.MouseEvent, principalCodEess: string) => {
        e.stopPropagation();
        const baseCode = String(principalCodEess || '').substring(0, 5);
        const secondaries = baseRedistributionData.filter(item =>
            String(item.codEess || '').startsWith(baseCode) && item.codEess !== principalCodEess
        );

        if (secondaries.length > 0) {
            setConsolidationSelection(prev => {
                const next = new Set(prev);
                let added = false;
                secondaries.forEach(s => {
                    if (!next.has(s.codEess)) {
                        next.add(s.codEess);
                        added = true;
                    }
                });

                // Si fueron añadidos, mostramos éxito. Si ya estaban todos y se le hace clic de nuevo, los removemos.
                if (!added) {
                    secondaries.forEach(s => next.delete(s.codEess));
                    toast.info("Consolidación rápida removida", { duration: 2000 });
                } else {
                    toast.success("Farmacias consolidadas rápidamente", { duration: 2000 });
                }

                return next;
            });
        } else {
            toast.info("No hay farmacias secundarias en este establecimiento", { duration: 2000 });
        }
    };

    const toggleProductReview = (productCode: string) => {
        setReviewedProducts(prev => {
            const next = new Set(prev);
            if (next.has(productCode)) {
                next.delete(productCode);
            } else {
                next.add(productCode);
            }
            return next;
        });
    };

    // --- 4. TRANSFER LOGIC ---

    const handleNavigateProduct = (direction: 'prev' | 'next') => {
        if (!selectedProductCode) return;

        const currentIndex = filteredProductOptions.findIndex(p => p.code === selectedProductCode);
        if (currentIndex === -1) return;

        const newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;

        if (newIndex >= 0 && newIndex < filteredProductOptions.length) {
            const nextProductCode = filteredProductOptions[newIndex].code;

            // Logic for NEXT direction
            if (direction === 'next') {
                const isAlreadyReviewed = reviewedProducts.has(selectedProductCode);

                if (!isAlreadyReviewed) {
                    if (autoReviewEnabled) {
                        // Auto-mark and navigate
                        setReviewedProducts(prev => new Set(prev).add(selectedProductCode));
                        handleProductChange(nextProductCode);
                    } else {
                        // Show modal
                        setPendingNextProductCode(nextProductCode);
                        setIsReviewConfirmOpen(true);
                    }
                    return;
                }
            }

            // Default navigation (Prev or Next if already reviewed)
            handleProductChange(nextProductCode);
        }
    };

    const handleConfirmReviewNavigation = (shouldMarkReviewed: boolean) => {
        if (shouldMarkReviewed && selectedProductCode) {
            setReviewedProducts(prev => new Set(prev).add(selectedProductCode));
        }

        if (pendingNextProductCode) {
            handleProductChange(pendingNextProductCode);
        }

        setIsReviewConfirmOpen(false);
        setPendingNextProductCode(null);
    };

    const handleOpenDetailModal = (item: RedistributionItem) => {
        setSelectedDetailItem(item);
        setIsDetailModalOpen(true);
    };

    const handleNavigateDetailItem = (direction: 'prev' | 'next') => {
        if (!selectedDetailItem) return;

        let currentList = redistributionData;
        if (isGlobalSearchModalOpen) {
            currentList = globalNetworkData.filter(item =>
                item.establishmentName.toLowerCase().includes(globalSearchTerm.toLowerCase()) ||
                item.codEess.toLowerCase().includes(globalSearchTerm.toLowerCase())
            );
        }

        const currentIndex = currentList.findIndex(item => item.codEess === selectedDetailItem.codEess);
        if (currentIndex === -1) return;

        const newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;

        if (newIndex >= 0 && newIndex < currentList.length) {
            setSelectedDetailItem(currentList[newIndex]);
        }
    };

    // --- SMART REDISTRIBUTION LOGIC ---
    // Removed as per user request

    // --- QUICK TRANSFER LOGIC ---
    const handleQuickTransferClick = (item: RedistributionItem, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent opening detail modal

        // If clicking the same source, deselect
        if (quickTransferSource?.codEess === item.codEess) {
            setQuickTransferSource(null);
            return;
        }

        // If no source selected, select this as source
        if (!quickTransferSource) {
            if (item.stock <= 0) {
                toast.error("Este establecimiento no tiene stock para transferir.");
                return;
            }
            setQuickTransferSource(item);
            toast.info(`Origen seleccionado: ${item.establishmentName}. Ahora seleccione el destino.`);
            return;
        }

        // If source selected, this is the destination
        if (quickTransferSource) {
            if (quickTransferSource.codEess === item.codEess) return; // Should be handled by deselect above but safety check

            // Set destination and open modal
            setQuickTransferDestination(item);

            // Calculate suggested quantity
            const maxTransfer = quickTransferSource.stock;
            const currentNeed = item.need || 0;
            const suggestedQty = currentNeed > 0 ? Math.min(maxTransfer, currentNeed) : 1;

            setQuickTransferQty(suggestedQty.toString());
            setIsQuickTransferConfirmOpen(true);
        }
    };

    const confirmQuickTransfer = () => {
        if (!quickTransferSource || !quickTransferDestination) return;

        const qty = parseInt(quickTransferQty);
        const maxTransfer = quickTransferSource.stock;

        if (isNaN(qty) || qty <= 0) {
            toast.error("Cantidad inválida.");
            return;
        }
        if (qty > maxTransfer) {
            toast.error(`No puede transferir más del stock disponible (${maxTransfer}).`);
            return;
        }

        // Add to list
        const newTransfer = {
            id: Date.now().toString(),
            productCode: selectedProductCode,
            productName: selectedProductName,
            quantity: qty,
            originCod: quickTransferSource.codEess,
            originName: quickTransferSource.establishmentName,
            destinationCod: quickTransferDestination.codEess,
            destinationName: quickTransferDestination.establishmentName
        };

        setTransferList(prev => [...prev, newTransfer]);

        toast.success("Transferencia agregada a la lista");

        // Reset state
        setQuickTransferSource(null);
        setQuickTransferDestination(null);
        setIsQuickTransferConfirmOpen(false);
        setQuickTransferQty('');
    };

    const cancelQuickTransfer = () => {
        setQuickTransferDestination(null);
        setIsQuickTransferConfirmOpen(false);
        setQuickTransferQty('');
        // We keep the source selected so they can choose another destination if they want
    };

    const removeTransferFromList = (id: string) => {
        const transfer = transferList.find(t => t.id === id);
        if (transfer) {
            toast.info("Transferencia revertida");
        }
        setTransferList(prev => prev.filter(t => t.id !== id));
    };

    const exportTransferList = () => {
        if (transferList.length === 0) return;

        const exportData = transferList.map(t => ({
            'COD. MED': t.productCode,
            'DESCRIPCION MED': t.productName,
            'CANTIDAD': t.quantity,
            'COD. EESS ORIGEN': t.originCod,
            'EESS ORIGEN': t.originName,
            'COD. EESS DESTINO': t.destinationCod,
            'EESS DESTINO': t.destinationName
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Distribución");
        XLSX.writeFile(wb, `Lista_Distribucion_${selectedMicrored}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    // --- 5. EXPORT FUNCTIONS ---
    // Removed as per user request

    const handleDownloadFilteredProducts = () => {
        if (filteredProductOptions.length === 0) {
            toast.error('No hay productos para descargar');
            return;
        }

        const exportData = filteredProductOptions.map(p => ({
            'Código': p.code,
            'Descripción': p.name,
            'TIPO': p.type || '',
            'PET': p.pet || '',
            'EST': p.est || '',
            'Mes 1': p.monthlyVector?.[0] || 0,
            'Mes 2': p.monthlyVector?.[1] || 0,
            'Mes 3': p.monthlyVector?.[2] || 0,
            'Mes 4': p.monthlyVector?.[3] || 0,
            'Mes 5': p.monthlyVector?.[4] || 0,
            'Mes 6': p.monthlyVector?.[5] || 0,
            'Mes 7': p.monthlyVector?.[6] || 0,
            'Mes 8': p.monthlyVector?.[7] || 0,
            'Mes 9': p.monthlyVector?.[8] || 0,
            'Mes 10': p.monthlyVector?.[9] || 0,
            'Mes 11': p.monthlyVector?.[10] || 0,
            'Mes 12': p.monthlyVector?.[11] || 0,
            'STOCK': p.totalStock,
            'CPA': Number(p.cpa).toFixed(2),
            'Meses': p.months === 999 ? '>99' : Number(p.months).toFixed(1),
            'Situación': p.status
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        
        // Set column widths
        ws['!cols'] = [
            { wch: 8 },   // Código
            { wch: 60 },  // Descripción
            { wch: 5 },   // TIPO
            { wch: 5 },   // PET
            { wch: 5 },   // EST
            { wch: 6 },   // Mes 1
            { wch: 6 },   // Mes 2
            { wch: 6 },   // Mes 3
            { wch: 6 },   // Mes 4
            { wch: 6 },   // Mes 5
            { wch: 6 },   // Mes 6
            { wch: 6 },   // Mes 7
            { wch: 6 },   // Mes 8
            { wch: 6 },   // Mes 9
            { wch: 7 },   // Mes 10
            { wch: 7 },   // Mes 11
            { wch: 7 },   // Mes 12
            { wch: 8 },   // STOCK
            { wch: 8 },   // CPA
            { wch: 8 },   // Meses
            { wch: 15 }   // Situación
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Productos Filtrados");
        
        const fileName = `Productos_${selectedMicrored || 'Todas'}_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);
        toast.success('Listado descargado correctamente');
    };

    // --- RENDER ---
    if (!isLoaded) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-gray-500 font-medium">Cargando datos guardados...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 w-full max-w-[98%] mx-auto space-y-6 animate-in fade-in duration-300">

            {/* HEADER */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <ArrowRightLeft className="h-6 w-6 text-teal-600" />
                        Módulo de Redistribución
                    </h2>
                    <p className="text-gray-500 text-sm mt-1">
                        Gestión de transferencias entre establecimientos por Microred
                    </p>
                </div>
            </div>

            {/* UPLOAD SECTION */}
            <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 transition-all hover:shadow-xl relative">
                <div className="flex flex-col items-center justify-center text-center mt-8 sm:mt-0">

                    {loading ? (
                        <div className="py-12 flex flex-col items-center animate-in fade-in zoom-in duration-500">
                            <div className="relative">
                                <div className="w-20 h-20 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <FileSpreadsheet className="h-8 w-8 text-indigo-600 animate-pulse" />
                                </div>
                            </div>
                            <h3 className="mt-6 text-xl font-bold text-gray-900">Procesando Archivo Excel</h3>
                            <p className="text-gray-500 mt-2 text-sm">Validando estructura y cargando registros...</p>
                        </div>
                    ) : (
                        <>
                            <div
                                className="w-full max-w-2xl mx-auto border-2 border-dashed border-indigo-200 rounded-xl p-10 bg-indigo-50/30 hover:bg-indigo-50 transition-all group cursor-pointer relative"
                                onClick={() => {
                                    if (records.length > 0) {
                                        setIsConfirmUploadModalOpen(true);
                                    } else {
                                        fileInputRef.current?.click();
                                    }
                                }}
                            >
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    accept=".xlsx, .xls"
                                    onChange={handleFileUpload}
                                    onClick={(e) => e.stopPropagation()}
                                    className="hidden"
                                />
                                <div className="flex flex-col items-center gap-4 group-hover:scale-105 transition-transform duration-300">
                                    <div className="bg-white p-4 rounded-full shadow-md group-hover:shadow-lg transition-shadow">
                                        <FileSpreadsheet className="h-10 w-10 text-indigo-600" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-900">Cargar Archivo de Disponibilidad</h3>
                                        <p className="text-sm text-gray-500 mt-1">Arrastre su archivo Excel aquí o haga clic para buscar</p>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-indigo-600 font-medium bg-indigo-100 px-3 py-1 rounded-full">
                                        <Sparkles className="h-3 w-3" />
                                        <span>Formato .xlsx o .xls requerido</span>
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); downloadTemplate(); }}
                                        className="text-xs text-slate-500 hover:text-indigo-600 underline mt-2"
                                    >
                                        Descargar Plantilla Estándar
                                    </button>

                                    {/* Export/Import Session Buttons */}
                                    <div className="flex flex-row gap-4 mt-6 z-10">
                                        {records.length > 0 && (
                                            <button 
                                                onClick={(e) => { 
                                                    e.stopPropagation(); 
                                                    e.preventDefault();
                                                    handleExportSession(); 
                                                }}
                                                className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300 rounded-lg text-sm font-bold transition-all shadow-sm"
                                                title="Exportar avance actual para continuar en otra PC"
                                            >
                                                <Download className="w-4 h-4" />
                                                Exportar Avance
                                            </button>
                                        )}
                                        <button 
                                            onClick={(e) => { 
                                                e.stopPropagation(); 
                                                e.preventDefault();
                                                if (records.length > 0) {
                                                    setIsConfirmImportModalOpen(true);
                                                } else {
                                                    importInputRef.current?.click(); 
                                                }
                                            }}
                                            className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300 rounded-lg text-sm font-bold transition-all shadow-sm"
                                            title="Importar avance desde un archivo de respaldo"
                                        >
                                            <Upload className="w-4 h-4" />
                                            Importar Avance
                                        </button>
                                        <input 
                                            type="file" 
                                            ref={importInputRef} 
                                            accept=".json" 
                                            onChange={handleImportSession} 
                                            onClick={(e) => e.stopPropagation()}
                                            className="hidden" 
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Last Month Selection Modal */}
                            {isLastMonthModalOpen && (
                                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                                    <div className="bg-white p-6 rounded-2xl shadow-xl w-96">
                                        <h3 className="text-lg font-bold text-gray-900 mb-4">Confirme la Fecha del Reporte</h3>
                                        <p className="text-sm text-gray-500 mb-6">Para realizar un cálculo preciso, Aura necesita saber a qué mes corresponde la última columna de datos.</p>
                                        <div className="mb-6">
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">MES DE CORTE (MES 12)</label>
                                            <input 
                                                type="month"
                                                className="w-full p-3 border rounded-lg text-center font-bold text-lg"
                                                value={lastMonthYear}
                                                onChange={(e) => setLastMonthYear(e.target.value)}
                                            />
                                        </div>
                                        <div className="bg-blue-50 p-4 rounded-lg mb-6 flex gap-3">
                                            <span className="text-blue-600">ℹ️</span>
                                            <p className="text-xs text-blue-800"><strong>Nota:</strong> Si descargó el reporte hoy, la fecha por defecto suele ser correcta.</p>
                                        </div>
                                        <button 
                                            onClick={confirmFileProcessing}
                                            className="w-full py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-bold flex items-center justify-center gap-2"
                                        >
                                            ✓ Confirmar y Cargar Datos
                                        </button>
                                    </div>
                                </div>
                            )}

                            {records.length > 0 && (
                                <div className="mt-8 flex items-center gap-6 animate-in slide-in-from-bottom-4 duration-500">
                                    <div className="text-center px-6 py-3 bg-green-50 rounded-xl border border-green-100">
                                        <span className="block text-3xl font-bold text-green-600">{records.length.toLocaleString()}</span>
                                        <span className="text-xs font-bold text-green-800 uppercase tracking-wider">Registros Cargados</span>
                                    </div>
                                    <div className="h-10 w-px bg-gray-200"></div>
                                    <div className="text-left">
                                        <p className="text-sm text-gray-600 flex items-center gap-2">
                                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                                            Datos validados correctamente
                                        </p>
                                        <p className="text-xs text-gray-400 mt-1">Listo para análisis de redistribución</p>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {error && (
                        <div className="mt-6 p-4 bg-red-50 text-red-700 rounded-xl text-sm flex items-center gap-3 border border-red-100 animate-in shake duration-300">
                            <AlertCircle className="h-5 w-5 shrink-0" />
                            <span className="font-medium">{error}</span>
                        </div>
                    )}
                </div>
            </div>

            {records.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    {/* MICRORED SELECTOR */}
                    <div className="md:col-span-4 bg-white p-5 rounded-xl shadow-sm border border-gray-200 min-h-[220px] flex flex-col relative z-30">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                            <Building2 className="h-3.5 w-3.5 text-indigo-500" />
                            Seleccionar Microred
                        </label>

                        <div className="relative mb-3">
                            <div
                                onClick={() => setIsMrDropdownOpen(!isMrDropdownOpen)}
                                className={`w-full pl-3 pr-10 py-2 bg-gray-50 border ${isMrDropdownOpen ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-gray-200'} rounded-xl text-sm text-gray-900 font-bold transition-all cursor-pointer flex items-center justify-between min-h-[38px]`}
                            >
                                <span className="truncate">
                                    {selectedMicrored === 'ALL' ? 'TODAS LAS MICROREDES' : (selectedMicrored || '-- Seleccione Microred --')}
                                </span>
                                <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isMrDropdownOpen ? 'rotate-180' : ''}`} />
                            </div>

                            {isMrDropdownOpen && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={() => setIsMrDropdownOpen(false)} />
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-20 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-200">
                                        <div className="p-2 border-b border-gray-100 bg-gray-50">
                                            <div className="relative">
                                                <Search className="h-3 w-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                                <input
                                                    type="text"
                                                    autoFocus
                                                    placeholder="Buscar microred..."
                                                    className="w-full pl-8 pr-3 py-1.5 text-[11px] bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                                    value={mrSearchTerm}
                                                    onChange={(e) => setMrSearchTerm(e.target.value)}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            </div>
                                        </div>
                                        <div className="max-h-[200px] overflow-y-auto py-1 custom-scrollbar">
                                            <button
                                                onClick={() => {
                                                    handleMicroredChange('ALL');
                                                    setIsMrDropdownOpen(false);
                                                    setMrSearchTerm('');
                                                }}
                                                className={`w-full text-left px-3 py-2 text-[11px] hover:bg-indigo-50 transition-colors flex items-center gap-2 ${selectedMicrored === 'ALL' ? 'bg-indigo-50 text-indigo-600 font-bold' : 'text-gray-700'}`}
                                            >
                                                <Building2 className="h-3.5 w-3.5 opacity-50" />
                                                TODAS LAS MICROREDES
                                            </button>
                                            {microredOptions
                                                .filter(mr => mr.toLowerCase().includes(mrSearchTerm.toLowerCase()))
                                                .map(mr => (
                                                    <button
                                                        key={mr}
                                                        onClick={() => {
                                                            handleMicroredChange(mr);
                                                            setIsMrDropdownOpen(false);
                                                            setMrSearchTerm('');
                                                        }}
                                                        className={`w-full text-left px-3 py-2 text-[11px] hover:bg-indigo-50 transition-colors flex items-center gap-2 ${selectedMicrored === mr ? 'bg-indigo-50 text-indigo-600 font-bold' : 'text-gray-700'}`}
                                                    >
                                                        <div className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0" />
                                                        <span className="truncate">{mr}</span>
                                                    </button>
                                                ))
                                            }
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Stats Summary */}
                        <div className="flex-1 bg-gray-50/50 rounded-xl p-3 border border-gray-100 flex flex-col justify-center gap-2">
                            {selectedMicrored && microredStats ? (
                                <>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-gray-500 font-medium">Establecimientos:</span>
                                        <span className="font-bold text-gray-900 bg-white px-2 py-0.5 rounded-lg border border-gray-100 shadow-sm min-w-[32px] text-center">{microredStats.establishments}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-gray-500 font-medium">Total Productos:</span>
                                        <span className="font-bold text-gray-900 bg-white px-2 py-0.5 rounded-lg border border-gray-100 shadow-sm min-w-[32px] text-center">{microredStats.uniqueProducts}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-gray-500 font-medium">Registros:</span>
                                        <span className="font-bold text-gray-900 bg-white px-2 py-0.5 rounded-lg border border-gray-100 shadow-sm min-w-[32px] text-center">{microredStats.totalItems.toLocaleString()}</span>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center text-gray-400 text-[11px] italic">
                                    Seleccione una microred para ver el resumen.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* PRODUCT REVIEW TABLE (REPLACES DROPDOWN) */}
                    <div className="md:col-span-8 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-[220px] relative z-20">
                        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center gap-4">
                            <div className="flex items-center gap-2.5 shrink-0">
                                <div className="p-1.5 bg-indigo-50 rounded-lg">
                                    <Package className="h-4 w-4 text-indigo-600" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-xs font-bold text-gray-800 leading-tight">Lista de Productos</span>
                                    <span className="text-[10px] text-gray-400 font-medium uppercase tracking-tighter">{filteredProductOptions.length} disponibles</span>
                                </div>
                            </div>

                            {/* Establishment Filter (Searchable Dropdown) */}
                            <div className="flex-1 max-w-[320px] flex items-center gap-2">
                                <div className="relative flex-1 group">
                                    <div
                                        onClick={() => !(!selectedMicrored) && setIsEstDropdownOpen(!isEstDropdownOpen)}
                                        className={`w-full pl-4 pr-10 py-2 text-[11px] bg-white border ${isEstDropdownOpen ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-gray-200'} rounded-xl text-gray-900 font-bold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center justify-between min-h-[34px] ${!selectedMicrored ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        <span className="truncate">
                                            {selectedEstablishment
                                                ? establishmentOptions.find(e => e.cod === selectedEstablishment)?.name
                                                : '-- Todos los Establecimientos --'}
                                        </span>
                                        <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform ${isEstDropdownOpen ? 'rotate-180' : ''}`} />
                                    </div>

                                    {isEstDropdownOpen && (
                                        <>
                                            <div
                                                className="fixed inset-0 z-10"
                                                onClick={() => setIsEstDropdownOpen(false)}
                                            />
                                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-20 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-200">
                                                <div className="p-2 border-b border-gray-100 bg-gray-50">
                                                    <div className="relative">
                                                        <Search className="h-3 w-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                                        <input
                                                            type="text"
                                                            autoFocus
                                                            placeholder="Buscar establecimiento..."
                                                            className="w-full pl-8 pr-3 py-1.5 text-[10px] bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                                            value={estSearchTerm}
                                                            onChange={(e) => setEstSearchTerm(e.target.value)}
                                                            onClick={(e) => e.stopPropagation()}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="max-h-[200px] overflow-y-auto py-1 custom-scrollbar">
                                                    <button
                                                        onClick={() => {
                                                            setSelectedEstablishment('');
                                                            setIsEstDropdownOpen(false);
                                                            setEstSearchTerm('');
                                                        }}
                                                        className={`w-full text-left px-3 py-2 text-[10px] hover:bg-indigo-50 transition-colors flex items-center gap-2 ${!selectedEstablishment ? 'bg-indigo-50 text-indigo-600 font-bold' : 'text-gray-700'}`}
                                                    >
                                                        <Building2 className="h-3 w-3 opacity-50" />
                                                        -- Todos los Establecimientos --
                                                    </button>
                                                    {establishmentOptions
                                                        .filter(e => e.name.toLowerCase().includes(estSearchTerm.toLowerCase()))
                                                        .map(est => (
                                                            <button
                                                                key={est.cod}
                                                                onClick={() => {
                                                                    setSelectedEstablishment(est.cod);
                                                                    setIsEstDropdownOpen(false);
                                                                    setEstSearchTerm('');
                                                                }}
                                                                className={`w-full text-left px-3 py-2 text-[10px] hover:bg-indigo-50 transition-colors flex items-center gap-2 ${selectedEstablishment === est.cod ? 'bg-indigo-50 text-indigo-600 font-bold' : 'text-gray-700'}`}
                                                            >
                                                                <div className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0" />
                                                                <span className="truncate">{est.name}</span>
                                                            </button>
                                                        ))
                                                    }
                                                    {establishmentOptions.filter(e => e.name.toLowerCase().includes(estSearchTerm.toLowerCase())).length === 0 && (
                                                        <div className="px-3 py-4 text-center text-[10px] text-gray-400 italic">
                                                            No se encontraron resultados
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                                {selectedEstablishment && (
                                    <button
                                        onClick={() => setSelectedEstablishment('')}
                                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all shrink-0 border border-transparent hover:border-red-100"
                                        title="Limpiar filtro"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                )}
                            </div>

                            {/* Search Input */}
                            <div className="flex-1 max-w-xs relative group">
                                <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                                <input
                                    type="text"
                                    placeholder="Buscar producto..."
                                    value={productSearch}
                                    onChange={(e) => setProductSearch(e.target.value)}
                                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg text-gray-700 font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all shadow-sm"
                                />
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                                <div className="text-xs text-gray-500 font-normal">
                                    {reviewedProducts.size} rev.
                                </div>
                                <button
                                    onClick={handleDownloadFilteredProducts}
                                    className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors border border-transparent hover:border-emerald-100 flex items-center gap-1"
                                    title="Descargar listado filtrado"
                                >
                                    <Download className="h-4 w-4" />
                                    <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline">Excel</span>
                                </button>
                            </div>
                        </div>
                        <div className="overflow-y-auto flex-1 p-0 custom-scrollbar">
                            {productOptions.length === 0 ? (
                                <div className="flex items-center justify-center h-full text-gray-400 text-sm italic p-4">
                                    Seleccione una Microred para ver los productos
                                </div>
                            ) : (
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50/80 text-slate-500 font-bold text-[10px] uppercase tracking-widest sticky top-0 z-10 backdrop-blur-sm border-b border-slate-100">
                                        <tr>
                                            <th className="p-0 align-middle w-16 text-center">
                                                <MultiSelectFilter
                                                    title="Rev."
                                                    options={[
                                                        { value: 'REVIEWED', label: 'Revisados' },
                                                        { value: 'PENDING', label: 'Pendientes' }
                                                    ]}
                                                    selectedValues={reviewFilter}
                                                    onChange={setReviewFilter}
                                                />
                                            </th>
                                            <th className="p-2 w-20 text-left align-middle">Código</th>
                                            <th className="p-2 text-left align-middle">Descripción</th>
                                            <th className="p-0 align-middle w-16 text-center">
                                                <MultiSelectFilter
                                                    title="TIPO"
                                                    options={Array.from(new Set(productOptions.map(p => String(p.type || '').toUpperCase()).filter(Boolean))).sort().map(val => ({ value: val, label: val }))}
                                                    selectedValues={tipoFilter}
                                                    onChange={setTipoFilter}
                                                />
                                            </th>
                                            <th className="p-0 align-middle w-14 text-center">
                                                <MultiSelectFilter
                                                    title="PET"
                                                    options={Array.from(new Set(productOptions.map(p => String(p.pet || '').toUpperCase()).filter(Boolean))).sort().map(val => ({ value: val, label: val }))}
                                                    selectedValues={petFilter}
                                                    onChange={setPetFilter}
                                                />
                                            </th>
                                            <th className="p-0 align-middle w-14 text-center">
                                                <MultiSelectFilter
                                                    title="EST"
                                                    options={Array.from(new Set(productOptions.map(p => String(p.est || '').toUpperCase()).filter(Boolean))).sort().map(val => ({ value: val, label: val }))}
                                                    selectedValues={estFilter}
                                                    onChange={setEstFilter}
                                                />
                                            </th>
                                            <th className="p-2 w-16 text-center text-blue-700 bg-blue-50/50 align-middle">STOCK</th>
                                            <th className="p-2 w-16 text-center align-middle">CPA</th>
                                            <th className="p-2 w-16 text-center align-middle">Meses</th>
                                            <th className="p-0 align-middle w-32 text-center">
                                                <MultiSelectFilter
                                                    title="Situación"
                                                    options={[
                                                        { value: 'NormoStock', label: 'NormoStock' },
                                                        { value: 'SobreStock', label: 'SobreStock' },
                                                        { value: 'SubStock', label: 'SubStock' },
                                                        { value: 'Desabastecido', label: 'Desabastecido' },
                                                        { value: 'Sin Rotación', label: 'Sin Rotación' }
                                                    ]}
                                                    selectedValues={statusFilter}
                                                    onChange={setStatusFilter}
                                                />
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {filteredProductOptions.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="p-4 text-center text-gray-400 italic text-xs">
                                                    No se encontraron productos
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredProductOptions.map((prod) => {
                                                const isSelected = selectedProductCode === prod.code;
                                                const isReviewed = reviewedProducts.has(prod.code);

                                                let statusColor = "bg-slate-100 text-slate-600";
                                                if (prod.status === "NormoStock") statusColor = "bg-emerald-50 text-emerald-700 border-emerald-100";
                                                if (prod.status === "SobreStock") statusColor = "bg-indigo-50 text-indigo-700 border-indigo-100";
                                                if (prod.status === "SubStock") statusColor = "bg-amber-50 text-amber-700 border-amber-100";
                                                if (prod.status === "Desabastecido") statusColor = "bg-rose-50 text-rose-700 border-rose-100";
                                                if (prod.status === "Sin Rotación") statusColor = "bg-slate-200 text-slate-700 border-slate-300";

                                                return (
                                                    <tr
                                                        key={prod.code}
                                                        className={`
                                                    cursor-pointer transition-all duration-200 border-b border-slate-50
                                                    ${isSelected ? 'bg-indigo-50/80 text-indigo-900' : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'}
                                                `}
                                                        onClick={() => handleProductChange(prod.code)}
                                                    >
                                                        <td className="p-2 text-center" onClick={(e) => { e.stopPropagation(); toggleProductReview(prod.code); }}>
                                                            {isReviewed ? (
                                                                <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" />
                                                            ) : (
                                                                <Circle className="h-4 w-4 text-slate-200 mx-auto hover:text-slate-400 transition-colors" />
                                                            )}
                                                        </td>
                                                        <td className="p-2 font-mono text-[11px] font-bold text-slate-500">{prod.code}</td>
                                                        <td className="p-2 text-[11px] font-medium text-slate-800 truncate max-w-[200px]" title={prod.name}>{prod.name}</td>
                                                        <td className="p-2 text-center text-[10px] text-slate-500 font-mono">{prod.type}</td>
                                                        <td className="p-2 text-center text-[10px] text-slate-500 font-bold">{prod.pet}</td>
                                                        <td className="p-2 text-center text-[10px] text-slate-500 font-bold">{prod.est}</td>
                                                        <td className="p-2 text-center text-[11px] font-mono font-bold text-blue-700 bg-blue-50/30">{prod.totalStock}</td>
                                                        <td className="p-2 text-center text-[11px] font-mono">{prod.cpa.toFixed(1)}</td>
                                                        <td className="p-2 text-center text-[11px] font-mono font-bold">{prod.months === 999 ? '∞' : prod.months.toFixed(1)}</td>
                                                        <td className="p-2 text-center">
                                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-tighter border ${statusColor}`}>
                                                                {prod.status}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* REDISTRIBUTION TABLE */}
            {redistributionData.length > 0 && (
                <div ref={tableContainerRef} className={`bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col ${isFullscreen ? 'h-screen w-screen fixed inset-0 z-50' : 'max-h-[85vh]'}`}>
                    <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center shrink-0">
                        <h3 className="font-bold text-gray-800 flex items-center gap-3">
                            {(() => {
                                const selectedProduct = productOptions.find(p => p.code === selectedProductCode);
                                const isReviewed = reviewedProducts.has(selectedProductCode);
                                return selectedProduct ? (
                                    <>
                                        <span className="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-md text-sm font-mono border border-indigo-200 shadow-sm">{selectedProduct.code}</span>
                                        <span className="truncate max-w-2xl text-lg sm:text-xl text-gray-900 tracking-tight" title={selectedProduct.name}>{selectedProduct.name}</span>
                                        {isReviewed && (
                                            <div title="Revisado">
                                                <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    "Matriz de Redistribución"
                                );
                            })()}
                        </h3>
                        <div className="flex items-center gap-3">
                            {/* Navigation Arrows */}
                            {selectedProductCode && (
                                <div className="flex items-center bg-white rounded-full p-1 border border-gray-200 shadow-sm mr-2 ring-1 ring-black/5">
                                    <button
                                        onClick={() => handleNavigateProduct('prev')}
                                        disabled={filteredProductOptions.findIndex(p => p.code === selectedProductCode) <= 0}
                                        className="flex items-center justify-center w-8 h-8 rounded-full text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-600 transition-all"
                                        title="Producto Anterior"
                                    >
                                        <ChevronLeft className="h-5 w-5" />
                                    </button>
                                    <div className="w-px h-4 bg-gray-200 mx-1"></div>
                                    <button
                                        onClick={() => handleNavigateProduct('next')}
                                        disabled={filteredProductOptions.findIndex(p => p.code === selectedProductCode) >= filteredProductOptions.length - 1}
                                        className="flex items-center justify-center w-8 h-8 rounded-full text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-600 transition-all"
                                        title="Siguiente Producto"
                                    >
                                        <ChevronRight className="h-5 w-5" />
                                    </button>
                                </div>
                            )}

                            {/* Consolidate Button - Only show if there are secondary pharmacies */}
                            {baseRedistributionData.some(item => /F\d{2}$/.test(String(item.codEess || '')) && !String(item.codEess || '').endsWith('F01')) && (
                                <button
                                    onClick={handleOpenConsolidateModal}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 transition-colors shadow-sm"
                                >
                                    <Merge className="h-4 w-4" />
                                    <span className="hidden sm:inline">Consolidar</span>
                                </button>
                            )}

                            {/* Global Search Button - Only show if source is selected and not in 'ALL' view */}
                            {quickTransferSource && selectedMicrored !== 'ALL' && (
                                <button
                                    onClick={() => setIsGlobalSearchModalOpen(true)}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white border border-indigo-700 rounded-lg text-xs font-bold hover:bg-indigo-700 transition-all shadow-sm animate-in zoom-in-95 duration-200"
                                    title="Buscar destino en toda la red"
                                >
                                    <Search className="h-4 w-4" />
                                    <span className="hidden sm:inline">Buscar Destino en Red</span>
                                </button>
                            )}

                            <button
                                onClick={() => setIsTransferListOpen(true)}
                                className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 text-white rounded-lg text-xs font-bold hover:bg-gray-900 transition-colors shadow-sm relative"
                                title="Ver Lista de Distribución"
                            >
                                <ClipboardList className="h-4 w-4" />
                                <span className="hidden sm:inline">Lista de Distribución</span>
                                {transferList.length > 0 && (
                                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">
                                        {transferList.length}
                                    </span>
                                )}
                            </button>

                            <button
                                onClick={toggleFullscreen}
                                className="flex items-center justify-center p-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors border border-gray-300"
                                title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
                            >
                                {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                            </button>

                            <div className="text-xs text-gray-500 ml-2 border-l pl-3 border-gray-300 font-medium">
                                {redistributionData.length} Est.
                            </div>
                        </div>
                    </div>
                    <div className="overflow-auto flex-1 custom-scrollbar">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-100 text-gray-700 font-bold uppercase text-xs sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="p-3 border-b text-left w-px whitespace-nowrap pr-2">COD</th>
                                    <th className="p-3 border-b text-left">Establecimiento</th>
                                    <th className="p-3 border-b text-center">Stock</th>
                                    <th className="p-3 border-b text-center bg-gray-50 text-gray-600 font-semibold text-[10px] uppercase tracking-wider">Suma Cons.</th>
                                    <th className="p-3 border-b text-center bg-gray-50 text-gray-600 font-semibold text-[10px] uppercase tracking-wider">Meses Cons.</th>
                                    <th className="p-3 border-b text-center">CPA</th>
                                    <th className="p-3 border-b text-center">Meses</th>
                                    <th className="p-3 border-b text-center">Situación</th>
                                    <th className="p-3 border-b text-center bg-gray-200 text-gray-800">Balance</th>
                                    <th className="p-3 border-b text-center bg-purple-50 text-purple-800 border-l border-purple-200 w-20">Estimar</th>
                                    <th className="p-3 border-b text-center bg-yellow-50 text-yellow-800 border-l border-yellow-200 w-16">Sale</th>
                                    <th className="p-3 border-b text-center bg-green-50 text-green-800 border-l border-green-200 w-16">Entra</th>
                                    <th className="p-3 border-b text-center bg-blue-50 text-blue-800 border-l border-blue-200">N. Stock</th>
                                    <th className="p-3 border-b text-center bg-blue-50 text-blue-800">N. Meses</th>
                                    <th className="p-3 border-b text-center text-gray-500 w-10"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {redistributionData.map((item, index) => {
                                    const showMicroredHeader = selectedMicrored === 'ALL' &&
                                        !item.isWarehouse &&
                                        (index === 0 || redistributionData[index - 1].microred !== item.microred || redistributionData[index - 1].isWarehouse);

                                    const newStock = item.stock - (item.transferQty || 0) + (item.receivedQty || 0) + (item.simulationQty || 0);
                                    const newMonths = item.cpa > 0 ? (newStock / item.cpa) : (newStock > 0 ? 999 : 0);

                                    // Recalculate Need based on New Stock
                                    const currentNeed = calculateNeed(newStock, item.cpa, item.status, Number(item.consumptionMonths || 0));

                                    // Check if record is effectively empty (no stock, no cpa, no consumption)
                                    const isGhost = item.stock === 0 && item.cpa === 0 && item.consumptionSum === 0;

                                    // Status Color Logic
                                    let statusColor = "bg-gray-100 text-gray-600";
                                    if (item.status === "NormoStock") statusColor = "bg-green-100 text-green-800";
                                    if (item.status === "SobreStock") statusColor = "bg-indigo-100 text-indigo-800";
                                    if (item.status === "SubStock") statusColor = "bg-orange-100 text-orange-800";
                                    if (item.status === "Desabastecido") statusColor = "bg-red-100 text-red-800";
                                    if (item.status === "Sin Rotación") statusColor = "bg-slate-200 text-slate-700";

                                    // Indentation Logic for Secondary Pharmacies (e.g., F02, F03...)
                                    // Check if code ends with Fxx where xx > 01
                                    const isSecondary = /F\d{2}$/.test(String(item.codEess || '')) && !String(item.codEess || '').endsWith('F01');

                                    const isExternal = selectedMicrored !== 'ALL' && item.microred !== selectedMicrored && !item.isWarehouse;
                                    const isSelected = quickTransferSource?.codEess === item.codEess;

                                    const isPrincipal = String(item.codEess || '').endsWith('F01') && !item.isWarehouse;
                                    const hasSecondaries = isPrincipal && baseRedistributionData.some(s =>
                                        String(s.codEess || '').startsWith(String(item.codEess).substring(0, 5)) && s.codEess !== item.codEess
                                    );

                                    // --- SMART ANALYSIS BADGES ---
                                    let analysisBadge = null;

                                    // 1. Dead Stock (Donor)
                                    if (item.stock > 0 && (item.consumptionMonths || 0) <= 1) {
                                        analysisBadge = (
                                            <div className="ml-2 text-red-500" title="Sin Rotación: Candidato a Donante Total">
                                                <AlertTriangle className="h-4 w-4" />
                                            </div>
                                        );
                                    }
                                    // 2. High Rotation (Receiver)
                                    else if (item.status !== 'SobreStock' && (item.consumptionMonths || 0) >= 6) {
                                        analysisBadge = (
                                            <div className="ml-2 text-emerald-600" title="Alta Rotación: Buen candidato para recibir stock">
                                                <TrendingUp className="h-4 w-4" />
                                            </div>
                                        );
                                    }
                                    // 3. Overstock Donor
                                    else if (item.status === 'SobreStock' && item.monthsProvision > 6) {
                                        analysisBadge = (
                                            <div className="ml-2 text-blue-500" title="Excedente: Candidato a Donante">
                                                <TrendingDown className="h-4 w-4" />
                                            </div>
                                        );
                                    }

                                    return (
                                        <React.Fragment key={item.codEess}>
                                            {showMicroredHeader && (
                                                <tr className="bg-slate-100 border-y border-slate-200">
                                                    <td colSpan={15} className="px-4 py-2 font-bold text-slate-700 text-xs uppercase tracking-wider">
                                                        MICRORED: {item.microred}
                                                    </td>
                                                </tr>
                                            )}
                                            <tr
                                                className={`
                                        transition-colors cursor-pointer group
                                        ${item.isWarehouse
                                                    ? 'bg-slate-50 border-l-4 border-l-indigo-500'
                                                    : isExternal
                                                        ? 'bg-purple-50/30 border-l-4 border-l-purple-400'
                                                        : quickTransferSource?.codEess === item.codEess
                                                            ? 'bg-indigo-50 ring-2 ring-indigo-500 ring-inset'
                                                            : quickTransferSource
                                                                ? 'hover:bg-green-100 hover:ring-2 hover:ring-green-500 hover:ring-inset cursor-crosshair'
                                                                : 'hover:bg-blue-100'
                                                }
                                    `}
                                            onClick={() => !item.isWarehouse && handleOpenDetailModal(item)}
                                        >
                                            <td className="p-3 font-mono text-xs text-gray-500 font-bold w-px whitespace-nowrap pr-2">
                                                <div className="flex items-center gap-1.5">
                                                    <span>{item.codEess}</span>
                                                    {hasSecondaries && (
                                                        <div
                                                            className={`shrink-0 p-1 rounded border cursor-pointer transition-colors shadow-sm ${item.isConsolidated
                                                                ? 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-600 hover:text-white'
                                                                : 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-600 hover:text-white'
                                                                }`}
                                                            title={item.isConsolidated ? "Deshacer Consolidación" : "Consolidación Rápida (Unificar secundarias)"}
                                                            onClick={(e) => handleQuickConsolidation(e, item.codEess)}
                                                        >
                                                            {item.isConsolidated ? <Split className="h-3.5 w-3.5" /> : <Merge className="h-3.5 w-3.5" />}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className={`p-3 font-medium text-gray-900 max-w-[200px] truncate ${isSecondary ? 'pl-8 text-gray-600 italic' : ''}`} title={item.establishmentName}>
                                                <div className="flex items-center">
                                                    <span className="truncate">{item.establishmentName}</span>
                                                    {isExternal && (
                                                        <span className="shrink-0 ml-2 px-1.5 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-bold rounded uppercase tracking-wider border border-purple-200">
                                                            EXT
                                                        </span>
                                                    )}
                                                    {analysisBadge}
                                                </div>
                                            </td>
                                            <td className="p-3 text-center font-mono">{isGhost ? '' : item.stock}</td>

                                            {/* CONSUMPTION DATA */}
                                            <td className={`p-3 text-center font-mono text-xs ${isSelected ? 'text-indigo-700 font-bold' : 'text-gray-500 bg-gray-50 group-hover:bg-transparent'}`}>
                                                {isGhost ? '' : (item.consumptionSum || 0)}
                                            </td>
                                            <td className={`p-3 text-center font-mono text-xs ${isSelected ? 'text-indigo-700 font-bold' : 'text-gray-500 bg-gray-50 group-hover:bg-transparent'}`}>
                                                {isGhost ? '' : (item.consumptionMonths || 0)}
                                            </td>

                                            <td className="p-3 text-center font-mono">{isGhost ? '' : item.cpa.toFixed(1)}</td>
                                            <td className="p-3 text-center font-mono font-bold">
                                                {isGhost ? '' : (item.monthsProvision === 999 ? '∞' : item.monthsProvision.toFixed(1))}
                                            </td>
                                            <td className="p-3 text-center">
                                                {!isGhost && (
                                                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${statusColor}`}>
                                                        {item.status}
                                                    </span>
                                                )}
                                            </td>

                                            {/* NECESIDAD / EXCEDENTE / BALANCE */}
                                            <td className={`p-3 text-center font-mono font-bold ${isSelected ? 'text-indigo-700' :
                                                (currentNeed || 0) > 0 ? 'text-blue-600 bg-blue-50 group-hover:bg-transparent' :
                                                    (currentNeed || 0) < 0 ? 'text-red-600 bg-red-50 group-hover:bg-transparent' : 'text-gray-400 bg-gray-50 group-hover:bg-transparent'
                                                }`} title={`Stock: ${newStock}, CPA: ${item.cpa}, MesesCons: ${item.consumptionMonths}, Status: ${item.status}, NeedCalc: ${currentNeed}`}>
                                                {isGhost ? '' : ((currentNeed || 0) !== 0 ? (currentNeed || 0) : '-')}
                                            </td>

                                            {/* ESTIMAR (Simulation Input) */}
                                            <td className={`p-2 text-center border-l border-purple-100 ${isSelected ? '' : 'bg-purple-50 group-hover:bg-transparent'}`} onClick={(e) => e.stopPropagation()}>
                                                <input
                                                    type="text" // text to allow "-"
                                                    value={item.simulationInput !== undefined ? item.simulationInput : (item.simulationQty === 0 ? '' : item.simulationQty)}
                                                    onChange={(e) => handleSimulationChange(item.codEess, e.target.value)}
                                                    placeholder="+/-"
                                                    className={`w-16 p-1 text-center border rounded focus:ring-2 focus:ring-purple-500 outline-none text-xs font-bold ${(item.simulationQty || 0) < 0 ? 'text-red-600 border-red-300 bg-red-50' :
                                                        (item.simulationQty || 0) > 0 ? 'text-blue-600 border-blue-300 bg-blue-50' : 'border-gray-300 text-gray-600'
                                                        }`}
                                                    disabled={isGhost}
                                                />
                                            </td>

                                            {/* SALE (Read Only) */}
                                            <td className={`p-3 text-center border-l border-yellow-100 ${isSelected ? '' : 'bg-yellow-50 group-hover:bg-transparent'}`}>
                                                {(item.transferQty || 0) > 0 ? (
                                                    <span className="font-bold text-yellow-700">-{item.transferQty}</span>
                                                ) : (
                                                    <span className="text-gray-300">-</span>
                                                )}
                                            </td>

                                            {/* ENTRA (Read Only) */}
                                            <td className={`p-3 text-center border-l border-green-100 ${isSelected ? '' : 'bg-green-50 group-hover:bg-transparent'}`}>
                                                {(item.receivedQty || 0) > 0 ? (
                                                    <span className="font-bold text-green-700">+{item.receivedQty}</span>
                                                ) : (
                                                    <span className="text-gray-300">-</span>
                                                )}
                                            </td>

                                            {/* CALCULATED */}
                                            <td className={`p-3 text-center font-mono font-bold border-l border-blue-100 ${isSelected ? 'text-indigo-900' :
                                                newStock < 0 ? 'text-red-600 bg-red-50 group-hover:bg-transparent' : 'text-blue-900 bg-blue-50/30 group-hover:bg-transparent'
                                                }`}>
                                                {newStock === 0 ? '' : newStock}
                                            </td>
                                            <td className={`p-3 text-center font-mono font-bold border-l border-blue-100 ${isSelected ? 'text-indigo-900' :
                                                'text-blue-900 bg-blue-50/30 group-hover:bg-transparent'
                                                }`}>
                                                <div className="flex items-center justify-center gap-2">
                                                    <span>{newStock === 0 ? '' : (newMonths === 999 ? '∞' : newMonths.toFixed(1))}</span>
                                                    {newStock > 0 && (
                                                        <div
                                                            className={`w-3 h-3 rounded-full shadow-sm border border-white ${newMonths === 999 ? 'bg-gray-500' :
                                                                newMonths > 6 ? 'bg-indigo-500' :
                                                                    newMonths >= 2 ? 'bg-green-500' :
                                                                        newMonths > 0 ? 'bg-orange-500' : 'bg-red-500'
                                                                }`}
                                                            title={
                                                                newMonths === 999 ? 'Sin Rotación Estimado' :
                                                                    newMonths > 6 ? 'SobreStock Estimado' :
                                                                        newMonths >= 2 ? 'NormoStock Estimado' :
                                                                            newMonths > 0 ? 'SubStock Estimado' : 'Desabastecido Estimado'
                                                            }
                                                        ></div>
                                                    )}
                                                </div>
                                            </td>

                                            {/* QUICK TRANSFER ACTION */}
                                            <td className="p-2 text-center" onClick={(e) => e.stopPropagation()}>
                                                <button
                                                    onClick={(e) => handleQuickTransferClick(item, e)}
                                                    className={`
                                                p-1.5 rounded-lg transition-all shadow-sm border
                                                ${quickTransferSource?.codEess === item.codEess
                                                            ? 'bg-indigo-600 text-white border-indigo-700 hover:bg-indigo-700'
                                                            : quickTransferSource
                                                                ? 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100 hover:scale-105'
                                                                : 'bg-white text-gray-400 border-gray-200 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200'
                                                        }
                                            `}
                                                    title={quickTransferSource ? (quickTransferSource.codEess === item.codEess ? "Cancelar Selección" : "Transferir Aquí") : "Seleccionar como Origen"}
                                                >
                                                    <MousePointerClick className="h-4 w-4" />
                                                </button>
                                            </td>
                                        </tr>
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* QUICK TRANSFER CONFIRMATION MODAL */}
            {isQuickTransferConfirmOpen && quickTransferSource && quickTransferDestination && renderModal(
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[90] p-4 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-gray-900 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden border border-gray-800 transform transition-all scale-100">
                        {/* Premium Header */}
                        <div className="relative p-6 pb-0 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-white tracking-tight">
                                Confirmar Transferencia
                            </h3>
                            <button
                                onClick={cancelQuickTransfer}
                                className="text-gray-500 hover:text-white transition-colors p-2 hover:bg-gray-800 rounded-full"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Product Line: Code + Name */}
                            <div className="flex items-center gap-3 bg-gray-800/50 p-4 rounded-xl border border-gray-700/50">
                                <span className="bg-teal-500/20 text-teal-400 px-2 py-1 rounded text-sm font-mono font-bold border border-teal-500/30 shrink-0">
                                    {selectedProductCode}
                                </span>
                                <div className="text-white text-lg font-bold leading-tight truncate" title={selectedProductName}>
                                    {selectedProductName}
                                </div>
                            </div>

                            {/* Origin & Destination Cards */}
                            <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-stretch">
                                {/* Origin Card */}
                                <div className="bg-gray-800/80 p-5 rounded-xl border border-indigo-500/30 flex flex-col relative overflow-hidden group hover:border-indigo-500/50 transition-colors">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                                    <div className="mb-4">
                                        <div className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest mb-1.5 opacity-80">De (Origen)</div>
                                        <div className="text-white font-bold text-lg leading-snug line-clamp-2" title={quickTransferSource.establishmentName}>
                                            {quickTransferSource.establishmentName}
                                        </div>
                                    </div>
                                    <div className="mt-auto pt-3 border-t border-gray-700/50">
                                        <div className="text-[10px] text-gray-400 uppercase font-bold mb-1 tracking-wider">Stock Disponible</div>
                                        <div className="text-3xl font-mono font-bold text-indigo-400">{quickTransferSource.stock}</div>
                                    </div>
                                </div>

                                {/* Arrow */}
                                <div className="flex items-center justify-center text-gray-600 px-1">
                                    <ArrowRight className="h-6 w-6" />
                                </div>

                                {/* Destination Card */}
                                <div className="bg-gray-800/80 p-5 rounded-xl border border-green-500/30 flex flex-col text-right relative overflow-hidden group hover:border-green-500/50 transition-colors">
                                    <div className="absolute top-0 right-0 w-1 h-full bg-green-500"></div>
                                    <div className="mb-4">
                                        <div className="text-[10px] text-green-400 font-bold uppercase tracking-widest mb-1.5 opacity-80">A (Destino)</div>
                                        <div className="text-white font-bold text-lg leading-snug line-clamp-2" title={quickTransferDestination.establishmentName}>
                                            {quickTransferDestination.establishmentName}
                                        </div>
                                    </div>
                                    <div className="mt-auto pt-3 border-t border-gray-700/50">
                                        <div className="text-[10px] text-gray-400 uppercase font-bold mb-1 tracking-wider">Necesidad</div>
                                        <div className="text-3xl font-mono font-bold text-green-400">{(quickTransferDestination.need || 0) > 0 ? quickTransferDestination.need : 0}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Input Section */}
                            <div className="text-center py-2">
                                <label className="block text-xs font-bold text-gray-500 mb-4 uppercase tracking-widest">Cantidad a Transferir</label>
                                <div className="relative inline-block group">
                                    <input
                                        type="number"
                                        value={quickTransferQty}
                                        onChange={(e) => setQuickTransferQty(e.target.value)}
                                        className="w-48 bg-transparent text-6xl font-bold text-center text-white border-b-2 border-gray-700 focus:border-indigo-500 outline-none pb-2 transition-all placeholder-gray-800 font-mono group-hover:border-gray-600"
                                        placeholder="0"
                                        autoFocus
                                        min="1"
                                        max={quickTransferSource.stock}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') confirmQuickTransfer();
                                            if (e.key === 'Escape') cancelQuickTransfer();
                                        }}
                                    />
                                </div>
                                <div className="text-xs text-gray-600 mt-4 font-medium">
                                    Presione <span className="text-gray-400 font-bold">Enter</span> para confirmar
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="grid grid-cols-2 gap-4 pt-2">
                                <button
                                    onClick={cancelQuickTransfer}
                                    className="px-4 py-3 bg-gray-800 text-gray-300 rounded-xl font-bold hover:bg-gray-700 transition-all border border-gray-700 text-sm"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={confirmQuickTransfer}
                                    className="px-4 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 text-sm"
                                >
                                    <span>Confirmar</span>
                                    <ArrowRight className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TRANSFER LIST MODAL */}
            {isTransferListOpen && renderModal(
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[80] p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden border border-gray-200 flex flex-col max-h-[85vh]">
                        <div className="bg-gray-900 text-white p-4 flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-2">
                                <ClipboardList className="h-5 w-5 text-teal-400" />
                                <h3 className="font-bold text-lg">LISTA DE DISTRIBUCIÓN</h3>
                            </div>
                            <button onClick={() => setIsTransferListOpen(false)} className="text-gray-400 hover:text-white"><X className="h-5 w-5" /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-0">
                            {transferList.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                                    <ClipboardList className="h-12 w-12 mb-3 opacity-20" />
                                    <p>No hay transferencias registradas aún.</p>
                                    <p className="text-sm mt-1">Utilice el botón de acción en la tabla para agregar transferencias.</p>
                                </div>
                            ) : (
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-100 text-gray-700 font-bold uppercase text-xs sticky top-0 z-10">
                                        <tr>
                                            <th className="p-3 border-b">Producto</th>
                                            <th className="p-3 border-b text-center">Cant.</th>
                                            <th className="p-3 border-b">Origen</th>
                                            <th className="p-3 border-b">Destino</th>
                                            <th className="p-3 border-b text-center">Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {transferList.map((t) => (
                                            <tr key={t.id} className="hover:bg-gray-50">
                                                <td className="p-3">
                                                    <div className="font-bold text-gray-800">{t.productName}</div>
                                                    <div className="font-mono text-xs text-gray-500">{t.productCode}</div>
                                                </td>
                                                <td className="p-3 text-center font-bold text-lg text-indigo-600">{t.quantity}</td>
                                                <td className="p-3">
                                                    <div className="text-gray-800">{t.originName}</div>
                                                    <div className="font-mono text-xs text-gray-500">{t.originCod}</div>
                                                </td>
                                                <td className="p-3">
                                                    <div className="text-gray-800">{t.destinationName}</div>
                                                    <div className="font-mono text-xs text-gray-500">{t.destinationCod}</div>
                                                </td>
                                                <td className="p-3 text-center">
                                                    <button
                                                        onClick={() => removeTransferFromList(t.id)}
                                                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Eliminar"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        <div className="bg-gray-50 p-4 flex justify-between items-center border-t border-gray-200 shrink-0">
                            <div className="text-sm text-gray-600 font-medium">
                                Total Transferencias: <span className="font-bold text-gray-900">{transferList.length}</span>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setIsTransferListOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg">Cerrar</button>
                                <button
                                    onClick={exportTransferList}
                                    disabled={transferList.length === 0}
                                    className="px-4 py-2 text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <FileSpreadsheet className="h-4 w-4" />
                                    Exportar Lista
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* CONSOLIDATION MODAL */}
            {isConsolidateModalOpen && renderModal(
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-200 flex flex-col max-h-[80vh]">
                        <div className="bg-gray-900 text-white p-4 flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-2">
                                <Merge className="h-5 w-5 text-amber-400" />
                                <h3 className="font-bold text-lg">CONSOLIDAR FARMACIAS</h3>
                            </div>
                            <button onClick={() => setIsConsolidateModalOpen(false)} className="text-gray-400 hover:text-white"><X className="h-5 w-5" /></button>
                        </div>

                        <div className="p-6 overflow-y-auto">
                            <p className="text-sm text-gray-600 mb-4">
                                Seleccione las farmacias secundarias que desea unificar con su farmacia principal.
                                Los stocks y consumos se sumarán a la principal.
                            </p>

                            <div className="space-y-6">
                                {/* Group by Base Code */}
                                {Object.entries(
                                    baseRedistributionData.reduce((acc, item) => {
                                        const safeCodEess = String(item.codEess || '');
                                        const baseCode = safeCodEess.substring(0, 5);
                                        if (!acc[baseCode]) acc[baseCode] = [];
                                        acc[baseCode].push(item);
                                        return acc;
                                    }, {} as Record<string, RedistributionItem[]>)
                                ).filter(([_, group]) => group.length > 1).map(([baseCode, group]) => {
                                    const principal = group.find(i => String(i.codEess || '').endsWith('F01')) || group[0];
                                    const secondaries = group.filter(i => i !== principal);

                                    if (secondaries.length === 0) return null;

                                    return (
                                        <div key={baseCode} className="border border-gray-200 rounded-lg overflow-hidden">
                                            <div className="bg-gray-100 p-3 font-bold text-sm text-gray-800 flex justify-between items-center">
                                                <label className="flex items-center gap-3 cursor-pointer select-none">
                                                    <input
                                                        type="checkbox"
                                                        checked={secondaries.length > 0 && secondaries.every(s => consolidationSelection.has(s.codEess))}
                                                        onChange={() => toggleGroupConsolidation(secondaries)}
                                                        className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
                                                    />
                                                    <span>Principal: {principal.establishmentName}</span>
                                                </label>
                                                <span className="font-mono text-xs bg-gray-200 px-2 py-0.5 rounded">{principal.codEess}</span>
                                            </div>
                                            <div className="divide-y divide-gray-100">
                                                {secondaries.map(sec => (
                                                    <label key={sec.codEess} className="flex items-center gap-3 p-3 hover:bg-amber-50 cursor-pointer transition-colors">
                                                        <input
                                                            type="checkbox"
                                                            checked={consolidationSelection.has(sec.codEess)}
                                                            onChange={() => toggleConsolidation(sec.codEess)}
                                                            className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
                                                        />
                                                        <div className="flex-1">
                                                            <div className="text-sm font-medium text-gray-700">{sec.establishmentName}</div>
                                                            <div className="text-xs text-gray-400 font-mono">{sec.codEess}</div>
                                                        </div>
                                                        <div className="text-xs text-gray-500">
                                                            Stock: {sec.stock} | CPA: {sec.cpa.toFixed(1)}
                                                        </div>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* Empty State if no groups found */}
                                {Object.values(baseRedistributionData.reduce((acc, item) => {
                                    const safeCodEess = String(item.codEess || '');
                                    const baseCode = safeCodEess.substring(0, 5);
                                    if (!acc[baseCode]) acc[baseCode] = [];
                                    acc[baseCode].push(item);
                                    return acc;
                                }, {} as Record<string, RedistributionItem[]>)).every(g => g.length <= 1) && (
                                        <div className="text-center py-8 text-gray-400 italic">
                                            No se encontraron establecimientos con múltiples farmacias en esta vista.
                                        </div>
                                    )
                                }
                            </div>
                        </div>

                        <div className="bg-gray-50 p-4 flex justify-end gap-3 border-t border-gray-200 shrink-0">
                            <button onClick={() => setIsConsolidateModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg">Cancelar</button>
                            <button onClick={applyConsolidationSelection} className="px-4 py-2 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm">Aplicar Consolidación</button>
                        </div>
                    </div>
                </div>
            )}

            {/* REVIEW CONFIRMATION MODAL */}
            {isReviewConfirmOpen && renderModal(
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200">
                        <div className="p-6 text-center">
                            <div className="bg-indigo-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle2 className="h-8 w-8 text-indigo-600" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 mb-2">¿Marcar como Revisado?</h3>
                            <p className="text-sm text-gray-600 mb-6">
                                Estás pasando al siguiente producto. ¿Deseas marcar <strong>{productOptions.find(p => p.code === selectedProductCode)?.name || selectedProductCode}</strong> como revisado antes de continuar?
                            </p>

                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={() => handleConfirmReviewNavigation(true)}
                                    className="w-full py-2.5 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                                >
                                    Sí, marcar y continuar
                                </button>
                                <button
                                    onClick={() => handleConfirmReviewNavigation(false)}
                                    className="w-full py-2.5 bg-white border border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    No, solo continuar
                                </button>

                                <label className="flex items-center justify-center gap-2 mt-2 cursor-pointer text-xs text-gray-500 hover:text-indigo-600 transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={autoReviewEnabled}
                                        onChange={(e) => setAutoReviewEnabled(e.target.checked)}
                                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    No volver a preguntar (marcar automáticamente al avanzar)
                                </label>

                                <button
                                    onClick={() => setIsReviewConfirmOpen(false)}
                                    className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 font-medium mt-2"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* CONFIRMATION MODAL FOR IMPORT */}
            {isConfirmImportModalOpen && renderModal(
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-gray-900 p-6 rounded-lg shadow-xl max-w-md w-full">
                        <h2 className="text-xl font-bold text-white mb-4">Confirmar nueva carga</h2>
                        <p className="text-gray-300 mb-6">
                            Subir un nuevo archivo borrará todos los datos actuales de redistribución (registros, selecciones, transferencias, simulación). ¿Está seguro de continuar?
                        </p>
                        <div className="flex justify-end gap-4">
                            <button
                                onClick={() => {
                                    setIsConfirmImportModalOpen(false);
                                }}
                                className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => {
                                    setIsConfirmImportModalOpen(false);
                                    clearRedistributionData();
                                    setTimeout(() => {
                                        importInputRef.current?.click();
                                    }, 100);
                                }}
                                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-500 font-bold"
                            >
                                Confirmar y Cargar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* CONFIRMATION MODAL */}
            {isConfirmUploadModalOpen && renderModal(
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-gray-900 p-6 rounded-lg shadow-xl max-w-md w-full">
                        <h2 className="text-xl font-bold text-white mb-4">Confirmar nueva carga</h2>
                        <p className="text-gray-300 mb-6">
                            Subir un nuevo archivo borrará todos los datos actuales de redistribución (registros, selecciones, transferencias, simulación). ¿Está seguro de continuar?
                        </p>
                        <div className="flex justify-end gap-4">
                            <button
                                onClick={() => {
                                    setIsConfirmUploadModalOpen(false);
                                }}
                                className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => {
                                    setIsConfirmUploadModalOpen(false);
                                    clearRedistributionData();
                                    setTimeout(() => {
                                        fileInputRef.current?.click();
                                    }, 100);
                                }}
                                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-500"
                            >
                                Confirmar y Cargar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* GLOBAL SEARCH MODAL */}
            {isGlobalSearchModalOpen && renderModal(
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[80] p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[95%] overflow-hidden border border-gray-200 flex flex-col max-h-[85vh]">
                        <div className="bg-indigo-900 text-white p-5 flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-800 rounded-lg">
                                    <Search className="h-5 w-5 text-indigo-300" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg leading-tight">BUSCAR DESTINO EN TODA LA RED</h3>
                                    <p className="text-xs text-indigo-300 font-medium">Seleccione un establecimiento de otra microred como destino</p>
                                </div>
                            </div>
                            <button onClick={() => setIsGlobalSearchModalOpen(false)} className="text-indigo-300 hover:text-white transition-colors"><X className="h-6 w-6" /></button>
                        </div>

                        <div className="p-4 bg-gray-50 border-b border-gray-200 shrink-0">
                            <div className="relative group">
                                <Search className="h-5 w-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                                <input
                                    type="text"
                                    autoFocus
                                    placeholder="Buscar por nombre o código de establecimiento..."
                                    value={globalSearchTerm}
                                    onChange={(e) => setGlobalSearchTerm(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-700 font-medium focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all shadow-sm"
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-0 custom-scrollbar">
                            {globalNetworkData.filter(item =>
                                item.establishmentName.toLowerCase().includes(globalSearchTerm.toLowerCase()) ||
                                item.codEess.toLowerCase().includes(globalSearchTerm.toLowerCase())
                            ).length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                                    <Search className="h-12 w-12 mb-3 opacity-20" />
                                    <p className="font-medium">No se encontraron establecimientos con stock</p>
                                    <p className="text-sm mt-1">Intente con otro término de búsqueda</p>
                                </div>
                            ) : (
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-100 text-gray-600 font-bold uppercase text-[10px] tracking-wider sticky top-0 z-10 border-b border-gray-200">
                                        <tr>
                                            <th className="p-4">Establecimiento</th>
                                            <th className="p-4 text-center">Stock</th>
                                            <th className="p-4 text-center border-l bg-gray-50/50">Suma Cons.</th>
                                            <th className="p-4 text-center bg-gray-50/50">Meses Cons.</th>
                                            <th className="p-4 text-center border-l">CPA</th>
                                            <th className="p-4 text-center">Meses</th>
                                            <th className="p-4 text-center">Situación</th>
                                            <th className="p-4 text-center bg-gray-200/50 border-x">Balance</th>
                                            <th className="p-4 text-center text-purple-700 bg-purple-50/50">Estimar</th>
                                            <th className="p-4 text-center text-yellow-700 bg-yellow-50/50 border-l border-yellow-100/50">Sale</th>
                                            <th className="p-4 text-center text-green-700 bg-green-50/50 border-l border-green-100/50">Entra</th>
                                            <th className="p-4 text-center text-blue-800 bg-blue-50/50 border-l border-blue-100/50">N. Stock</th>
                                            <th className="p-4 text-center text-blue-800 bg-blue-50/50">N. Meses</th>
                                            <th className="p-4 text-center border-l">Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {globalNetworkData
                                            .filter(item =>
                                                item.establishmentName.toLowerCase().includes(globalSearchTerm.toLowerCase()) ||
                                                item.codEess.toLowerCase().includes(globalSearchTerm.toLowerCase())
                                            )
                                            .map((item) => (
                                                <tr
                                                    key={item.codEess}
                                                    className="hover:bg-indigo-50/50 transition-colors cursor-pointer group"
                                                    onClick={() => {
                                                        setSelectedDetailItem(item);
                                                        setIsDetailModalOpen(true);
                                                    }}
                                                >
                                                    <td className="p-4">
                                                        <div className="font-bold text-gray-900">{item.establishmentName}</div>
                                                        <div className="flex gap-2 items-center">
                                                            <div className="font-mono text-[10px] text-gray-500">{item.codEess}</div>
                                                            <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-[9px] font-bold uppercase">
                                                                {item.microred}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="p-4 text-center font-mono font-bold text-indigo-600">{item.stock}</td>
                                                    <td className="p-3 text-center font-mono text-xs text-gray-500 bg-gray-50 group-hover:bg-transparent">{item.consumptionSum || 0}</td>
                                                    <td className="p-3 text-center font-mono text-xs text-gray-500 bg-gray-50 group-hover:bg-transparent">{item.consumptionMonths || 0}</td>
                                                    <td className="p-3 text-center font-mono">{item.cpa.toFixed(1)}</td>
                                                    <td className="p-3 text-center font-mono font-bold">
                                                        {item.monthsProvision === 999 ? '∞' : item.monthsProvision.toFixed(1)}
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${item.status === 'NormoStock' ? 'bg-green-100 text-green-700' :
                                                            item.status === 'SobreStock' ? 'bg-indigo-100 text-indigo-700' :
                                                                item.status === 'SubStock' ? 'bg-orange-100 text-orange-700' :
                                                                    'bg-red-100 text-red-700'
                                                            }`}>
                                                            {item.status}
                                                        </span>
                                                    </td>
                                                    <td className={`p-3 text-center font-mono font-bold ${(item.need || 0) > 0 ? 'text-blue-600 bg-blue-50 group-hover:bg-transparent' :
                                                        (item.need || 0) < 0 ? 'text-red-600 bg-red-50 group-hover:bg-transparent' :
                                                            'text-gray-400 bg-gray-50 group-hover:bg-transparent'
                                                        }`}>
                                                        {(item.need || 0) !== 0 ? (item.need || 0) : '-'}
                                                    </td>
                                                    <td className="p-2 text-center border-l border-purple-100 bg-purple-50 group-hover:bg-transparent" onClick={(e) => e.stopPropagation()}>
                                                        <input
                                                            type="text"
                                                            value={item.simulationInput !== undefined ? item.simulationInput : (item.simulationQty === 0 ? '' : item.simulationQty)}
                                                            onChange={(e) => handleSimulationChange(item.codEess, e.target.value)}
                                                            placeholder="+/-"
                                                            className={`w-16 p-1 text-center border rounded focus:ring-2 focus:ring-purple-500 outline-none text-xs font-bold ${(item.simulationQty || 0) < 0 ? 'text-red-600 border-red-300 bg-red-50' :
                                                                (item.simulationQty || 0) > 0 ? 'text-blue-600 border-blue-300 bg-blue-50' : 'border-gray-300 text-gray-600'
                                                                }`}
                                                        />
                                                    </td>
                                                    <td className="p-3 text-center border-l border-yellow-100 bg-yellow-50 group-hover:bg-transparent">
                                                        {(item.transferQty || 0) > 0 ? (
                                                            <span className="font-bold text-yellow-700">-{item.transferQty}</span>
                                                        ) : (
                                                            <span className="text-gray-300">-</span>
                                                        )}
                                                    </td>
                                                    <td className="p-3 text-center border-l border-green-100 bg-green-50 group-hover:bg-transparent">
                                                        {(item.receivedQty || 0) > 0 ? (
                                                            <span className="font-bold text-green-700">+{item.receivedQty}</span>
                                                        ) : (
                                                            <span className="text-gray-300">-</span>
                                                        )}
                                                    </td>
                                                    <td className="p-3 text-center font-mono font-bold border-l border-blue-100 text-blue-900 bg-blue-50/30 group-hover:bg-transparent">
                                                        {(() => {
                                                            const nStock = item.stock + (item.simulationInput !== undefined ? (Number(item.simulationInput) || 0) : (item.simulationQty || 0)) - (item.transferQty || 0) + (item.receivedQty || 0);
                                                            return nStock < 0 ? <span className="text-red-600">{nStock}</span> : (nStock === 0 ? '' : nStock);
                                                        })()}
                                                    </td>
                                                    <td className="p-3 text-center font-mono font-bold border-l border-blue-100 text-blue-900 bg-blue-50/30 group-hover:bg-transparent">
                                                        <div className="flex items-center justify-center gap-2">
                                                            {(() => {
                                                                const nStock = item.stock + (item.simulationInput !== undefined ? (Number(item.simulationInput) || 0) : (item.simulationQty || 0)) - (item.transferQty || 0) + (item.receivedQty || 0);
                                                                const nMonths = item.cpa > 0 ? nStock / item.cpa : (nStock > 0 ? 999 : 0);
                                                                const displayMonths = nStock <= 0 ? '' : (nMonths === 999 ? '∞' : nMonths.toFixed(1));

                                                                return (
                                                                    <>
                                                                        <span>{displayMonths}</span>
                                                                        {nStock > 0 && (
                                                                            <div
                                                                                className={`w-3 h-3 rounded-full shadow-sm border border-white ${nMonths === 999 ? 'bg-gray-500' :
                                                                                    nMonths > 6 ? 'bg-indigo-500' :
                                                                                        nMonths >= 2 ? 'bg-green-500' :
                                                                                            nMonths > 0 ? 'bg-orange-500' : 'bg-red-500'
                                                                                    }`}
                                                                            ></div>
                                                                        )}
                                                                    </>
                                                                );
                                                            })()}
                                                        </div>
                                                    </td>
                                                    <td className="p-3 text-center border-l bg-gray-50 group-hover:bg-transparent" onClick={(e) => e.stopPropagation()}>
                                                        <button
                                                            onClick={() => {
                                                                setQuickTransferDestination(item);
                                                                setIsGlobalSearchModalOpen(false);
                                                                setIsQuickTransferConfirmOpen(true);
                                                                toast.success(`Destino seleccionado: ${item.establishmentName}`);
                                                            }}
                                                            className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-600 hover:text-white transition-all shadow-sm border border-green-100"
                                                            title="Seleccionar como Destino"
                                                        >
                                                            <MousePointerClick className="h-4 w-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end shrink-0">
                            <button
                                onClick={() => setIsGlobalSearchModalOpen(false)}
                                className="px-6 py-2 bg-white border border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* DETAIL MODAL */}
            {
                isDetailModalOpen && selectedDetailItem && renderModal(
                    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-5xl overflow-hidden border border-gray-800 flex flex-col max-h-[90vh]">
                            {/* Header */}
                            <div className="p-6 border-b border-gray-800 flex justify-between items-center">
                                <div className="flex-1 min-w-0 mr-4">
                                    {/* Product Line */}
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="bg-teal-500/20 text-teal-400 px-2 py-0.5 rounded text-sm font-mono font-bold border border-teal-500/30 shrink-0">
                                            {selectedProductCode}
                                        </span>
                                        <h2 className="text-xl font-bold text-white leading-tight truncate" title={selectedProductName}>
                                            {selectedProductName}
                                        </h2>
                                    </div>

                                    {/* Establishment Line */}
                                    <div className="flex items-center gap-3">
                                        <span className="text-gray-500 text-sm font-mono font-bold bg-gray-800 px-2 py-0.5 rounded shrink-0">
                                            {selectedDetailItem.codEess}
                                        </span>
                                        <p className="text-gray-300 text-base truncate" title={selectedDetailItem.establishmentName}>
                                            {selectedDetailItem.establishmentName}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 shrink-0">
                                    {/* Navigation */}
                                    <div className="flex items-center bg-gray-800 rounded-lg p-1 border border-gray-700">
                                        {(() => {
                                            let currentList = redistributionData;
                                            if (isGlobalSearchModalOpen) {
                                                currentList = globalNetworkData.filter(item =>
                                                    item.establishmentName.toLowerCase().includes(globalSearchTerm.toLowerCase()) ||
                                                    item.codEess.toLowerCase().includes(globalSearchTerm.toLowerCase())
                                                );
                                            }
                                            const currentIndex = currentList.findIndex(i => i.codEess === selectedDetailItem.codEess);
                                            
                                            return (
                                                <>
                                                    <button
                                                        onClick={() => handleNavigateDetailItem('prev')}
                                                        disabled={currentIndex <= 0}
                                                        className="p-2 hover:bg-gray-700 rounded-md text-gray-400 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                                                        title="Establecimiento Anterior"
                                                    >
                                                        <ChevronLeft className="h-5 w-5" />
                                                    </button>
                                                    <div className="w-px h-5 bg-gray-700 mx-1"></div>
                                                    <button
                                                        onClick={() => handleNavigateDetailItem('next')}
                                                        disabled={currentIndex >= currentList.length - 1 || currentIndex === -1}
                                                        className="p-2 hover:bg-gray-700 rounded-md text-gray-400 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                                                        title="Siguiente Establecimiento"
                                                    >
                                                        <ChevronRight className="h-5 w-5" />
                                                    </button>
                                                </>
                                            );
                                        })()}
                                    </div>

                                    <button
                                        onClick={() => setIsDetailModalOpen(false)}
                                        className="text-gray-500 hover:text-white transition-colors p-2 hover:bg-gray-800 rounded-lg"
                                    >
                                        <X className="h-6 w-6" />
                                    </button>
                                </div>
                            </div>

                            {/* KPI Cards */}
                            <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-900/50">
                                <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700">
                                    <div className="text-gray-400 text-xs font-bold uppercase mb-1">Stock Actual</div>
                                    <div className="text-3xl font-bold text-white">{selectedDetailItem.stock}</div>
                                </div>
                                <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700">
                                    <div className="text-gray-400 text-xs font-bold uppercase mb-1">CPA (Promedio)</div>
                                    <div className="text-3xl font-bold text-teal-400">{selectedDetailItem.cpa.toFixed(1)}</div>
                                </div>
                                <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700">
                                    <div className="text-gray-400 text-xs font-bold uppercase mb-1">Meses Disp.</div>
                                    <div className="text-3xl font-bold text-blue-400">
                                        {selectedDetailItem.monthsProvision === 999 ? '∞' : selectedDetailItem.monthsProvision.toFixed(1)}
                                    </div>
                                </div>
                                <div className={`p-4 rounded-xl border ${selectedDetailItem.status === 'NormoStock' ? 'bg-green-900/20 border-green-800' :
                                    selectedDetailItem.status === 'SobreStock' ? 'bg-indigo-900/20 border-indigo-800' :
                                        selectedDetailItem.status === 'SubStock' ? 'bg-orange-900/20 border-orange-800' :
                                            'bg-red-900/20 border-red-800'
                                    }`}>
                                    <div className="text-gray-400 text-xs font-bold uppercase mb-1">Situación</div>
                                    <div className={`text-2xl font-bold ${selectedDetailItem.status === 'NormoStock' ? 'text-green-400' :
                                        selectedDetailItem.status === 'SobreStock' ? 'text-indigo-400' :
                                            selectedDetailItem.status === 'SubStock' ? 'text-orange-400' :
                                                'text-red-400'
                                        }`}>
                                        {selectedDetailItem.status}
                                    </div>
                                </div>
                            </div>

                            {/* Consumption Table */}
                            <div className="p-6 overflow-x-auto">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-4 gap-4">
                                    <h3 className="text-white font-bold flex items-center gap-2">
                                        <FileSpreadsheet className="h-4 w-4 text-teal-500" />
                                        Histórico de Consumo (Últimos 12 Meses)
                                    </h3>
                                    <div className="flex gap-3">
                                        <div className="bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-700 flex items-center gap-2">
                                            <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Suma Total</span>
                                            <span className="text-white font-mono font-bold text-lg leading-none">{selectedDetailItem.consumptionSum}</span>
                                        </div>
                                        <div className="bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-700 flex items-center gap-2">
                                            <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Meses con Consumo</span>
                                            <span className="text-white font-mono font-bold text-lg leading-none">{selectedDetailItem.consumptionMonths}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="border border-gray-700 rounded-lg overflow-hidden">
                                    <div className="grid grid-cols-12 divide-x divide-gray-700 bg-gray-950 text-gray-400 text-xs font-bold uppercase text-center">
                                        {Array.from({ length: 12 }).map((_, i) => {
                                            // Extract month and year from lastMonthYear (YYYY-MM)
                                            const [selectedYear, selectedMonth] = lastMonthYear.split('-').map(Number);
                                            
                                            // Calculate the month index (0-11) and the corresponding year
                                            // We are looking at the 12 months ending in selectedMonth/selectedYear
                                            // The sequence starts 11 months before selectedMonth
                                            let monthIndex = (selectedMonth - 12 + i) % 12;
                                            if (monthIndex < 0) monthIndex += 12;
                                            
                                            // Calculate year for this specific month
                                            // If monthIndex is greater than selectedMonth-1, it belongs to the previous year
                                            let year = selectedYear;
                                            if (monthIndex > (selectedMonth - 1)) {
                                                year -= 1;
                                            }
                                            
                                            const monthNames = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
                                            const yearShort = String(year).slice(-2);
                                            
                                            return <div key={i} className="p-3">{`${monthNames[monthIndex]} ${yearShort}`}</div>;
                                        })}
                                    </div>
                                    <div className="grid grid-cols-12 divide-x divide-gray-700 bg-gray-900 text-white font-mono text-sm font-bold text-center">
                                        {selectedDetailItem.monthlyConsumption && selectedDetailItem.monthlyConsumption.length === 12 ? (
                                            selectedDetailItem.monthlyConsumption.map((val, i) => (
                                                <div key={i} className={`p-4 ${val === 0 ? 'text-gray-600' : ''}`}>
                                                    {val}
                                                </div>
                                            ))
                                        ) : (
                                            <div className="col-span-12 p-4 text-gray-500 italic">
                                                No hay datos de consumo mensual disponibles.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="p-6 border-t border-gray-800 bg-gray-900/50 flex justify-between items-center">
                                <div className="flex gap-3">
                                    {!selectedDetailItem.isWarehouse && (
                                        <button
                                            onClick={() => {
                                                if (isGlobalSearchModalOpen) {
                                                    // If global search is open, this is a destination
                                                    setQuickTransferDestination(selectedDetailItem);
                                                    setIsDetailModalOpen(false);
                                                    setIsGlobalSearchModalOpen(false);
                                                    setIsQuickTransferConfirmOpen(true);
                                                    toast.success(`Destino seleccionado: ${selectedDetailItem.establishmentName}`);
                                                } else {
                                                    // Otherwise, this is a source
                                                    setQuickTransferSource(selectedDetailItem);
                                                    setIsDetailModalOpen(false);
                                                    toast.success(`Origen seleccionado: ${selectedDetailItem.establishmentName}`);
                                                }
                                            }}
                                            className={`px-6 py-2 ${isGlobalSearchModalOpen ? 'bg-green-600 hover:bg-green-700 shadow-green-500/20' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20'} text-white font-bold rounded-lg transition-colors flex items-center gap-2 shadow-lg`}
                                        >
                                            <MousePointerClick className="h-4 w-4" />
                                            {isGlobalSearchModalOpen ? 'Transferir a este destino' : 'Transferir desde aquí'}
                                        </button>
                                    )}
                                </div>
                                <button
                                    onClick={() => setIsDetailModalOpen(false)}
                                    className="px-6 py-2 bg-white text-gray-900 font-bold rounded-lg hover:bg-gray-100 transition-colors"
                                >
                                    Cerrar
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* TRANSFER MODAL REMOVED */}
        </div >
    );
};
