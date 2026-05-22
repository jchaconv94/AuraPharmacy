import React, { useState, useEffect, useMemo } from 'react';
import { Search, Database, RefreshCw, AlertCircle, Link as LinkIcon, FileSpreadsheet, Settings, Save, Check, Copy, X, Plus, Trash2, Building2, ChevronRight, ChevronLeft, MapPin, Clock, AlertTriangle, Download, Filter, ArrowLeft, ChevronDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';

interface SIGData {
  ALMCOD: string;
  DESC_ALM: string;
  ID_Producto: string;
  CODIGO_SIG: string;
  Nombre: string;
  Lote: string;
  Fec_Vencim: string;
  Reg_Sanitario: string;
  TIPSUM: string;
  DESC_TIPSUM: string;
  FFINAN: string;
  DESC_FFINAN: string;
  Saldo: string;
  Precio_Det: string;
  Precio_Cab: string;
  Ultima_Actualizacion: string;
  sourceId?: string;
  [key: string]: any;
}

interface SheetSource {
  id: string;
  name: string;
  urlIndex: number;
  lastUpdate?: string;
  lastUpdateTime?: number;
}

const parseDataDate = (str?: string): number => {
    if (!str) return 0;
    // Intentar parseo nativo primero
    let d = new Date(str);
    if (!isNaN(d.getTime())) return d.getTime();
    
    // Intentar DD/MM/YYYY HH:MM:SS (común en sheets latinas)
    try {
        const parts = str.trim().split(/\s+/);
        const datePart = parts[0].replace(',', '');
        const timePart = parts[1] || '00:00:00';
        const dateMatch = datePart.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
        if (dateMatch) {
            const [, day, month, year] = dateMatch;
            d = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${timePart}`);
            return d.getTime() || 0;
        }
    } catch(e) {}
    
    return 0;
};

const formatFullDate = (timestamp?: number): string => {
    if (!timestamp || timestamp === 0) return 'Sin fecha';
    const d = new Date(timestamp);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
};

const getUpdateStatus = (timestamp?: number) => {
    if (!timestamp || timestamp === 0) return { color: 'bg-gray-400', label: 'Sin datos' };
    
    const now = new Date().getTime();
    const diffMs = now - timestamp;
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours < 0) return { color: 'bg-emerald-500', label: 'Fecha en el futuro' };
    if (diffHours < 1) return { color: 'bg-emerald-500', label: 'Actualizado recientemente' };
    if (diffHours < 24) return { color: 'bg-amber-500', label: 'Más de 1 hora sin actualizar' };
    return { color: 'bg-red-500', label: 'Más de 1 día sin actualizar' };
};

const getSheetType = (name: string): 'CS' | 'PS' | 'ALM' | 'HOSP' | 'OTRO' => {
    const u = name.toUpperCase();
    if (u.includes('C.S.') || u.includes('CENTRO DE SALUD')) return 'CS';
    if (u.includes('P.S.') || u.includes('PUESTO DE SALUD')) return 'PS';
    if (u.includes('ALM') || u.includes('ALMACEN')) return 'ALM';
    if (u.includes('HOSP') || u.includes('HOSPITAL')) return 'HOSP';
    return 'OTRO';
};

const formatDate = (dateValue: any): string => {
    if (!dateValue) return '';
    const str = String(dateValue).trim();
    if (/^\d{2}[\/\-]\d{2}[\/\-]\d{4}/.test(str)) {
        return str;
    }
    try {
        const date = new Date(dateValue);
        if (!isNaN(date.getTime())) {
            const day = date.getDate().toString().padStart(2, '0');
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const year = date.getFullYear();
            return `${day}/${month}/${year}`;
        }
    } catch (e) {}
    return str;
};

interface UngetConfig {
  url: string;
  name: string;
}

const formatAlmCode = (code: string | undefined): string => {
    if (!code) return '-';
    const c = String(code).trim();
    if (c.length >= 8) {
        if (c.substring(5, 8).toUpperCase() === 'F01') {
            return c.substring(0, 5);
        }
        return c.substring(0, c.length - 2);
    }
    return c;
};

const getAlmCodeForSheet = (sheetId: string, sheetData: SIGData[]): string => {
    const row = sheetData.find(r => r.sourceId === sheetId && r.ALMCOD);
    return row ? formatAlmCode(row.ALMCOD) : '';
};

const getExpirationStats = (records: SIGData[]) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    const expired: SIGData[] = [];
    const expiringThisMonth: SIGData[] = [];
    
    records.forEach(r => {
        const stock = parseFloat(String(r.Saldo || '0').replace(/,/g, ''));
        if (stock <= 0) return;
        if (!r.Fec_Vencim) return;
        
        const parts = r.Fec_Vencim.split(/[\/\-]/);
        if (parts.length === 3) {
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const year = parseInt(parts[2], 10);
            if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
                const fullYear = year < 100 ? year + 2000 : year;
                const expDate = new Date(fullYear, month, day);
                if (expDate < today) {
                    expired.push(r);
                } else if (month === currentMonth && fullYear === currentYear) {
                    expiringThisMonth.push(r);
                }
            }
        }
    });

    return { 
        expired, 
        expiringThisMonth,
        expiredCount: expired.length, 
        expiringThisMonthCount: expiringThisMonth.length 
    };
};

export const SheetSearchModule: React.FC = () => {
    const { user, hasPermission } = useAuth();
    const canAccess = hasPermission('SIG_SEARCH');

    // Configuración
    const [scriptUrls, setScriptUrls] = useState<UngetConfig[]>([]);
    const [sources, setSources] = useState<SheetSource[]>([]);
    const [data, setData] = useState<SIGData[]>([]);
    
    // UI states
    const [isLoading, setIsLoading] = useState(false);
    const [isSilentSyncing, setIsSilentSyncing] = useState(false);
    const [isConfigLoading, setIsConfigLoading] = useState(true); // Nuevo: Estado para carga de config
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sheetSearchTerm, setSheetSearchTerm] = useState('');
    const [ungetSearchTerm, setUngetSearchTerm] = useState('');
    const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
    
    // Filtros Avanzados (Sidebar Derecha)
    const [isAdvancedFiltersSidebarOpen, setIsAdvancedFiltersSidebarOpen] = useState(false);
    const [filter_CS, setFilter_CS] = useState(true);
    const [filter_PS, setFilter_PS] = useState(true);
    const [filter_ALM, setFilter_ALM] = useState(true);
    const [filter_HOSP, setFilter_HOSP] = useState(true);
    const [filter_OTRO, setFilter_OTRO] = useState(true);

    const [filter_emerald, setFilter_emerald] = useState(true);
    const [filter_amber, setFilter_amber] = useState(true);
    const [filter_red, setFilter_red] = useState(true);
    const [filter_gray, setFilter_gray] = useState(true);

    const [filterSortOrder, setFilterSortOrder] = useState<'name_asc' | 'name_desc' | 'date_newest' | 'date_oldest' | 'expired_highest'>('name_asc');
    const [filterHasPendingExpirations, setFilterHasPendingExpirations] = useState<boolean>(false);
    const [filterDateLimit, setFilterDateLimit] = useState<'all' | '1h' | '12h' | '24h' | '3d' | '7d'>('all');
    
    // Estados para dropdowns de filtros personalizados
    const [isDateLimitDropdownOpen, setIsDateLimitDropdownOpen] = useState(false);
    const [isSortOrderDropdownOpen, setIsSortOrderDropdownOpen] = useState(false);
    const [isExportDateLimitDropdownOpen, setIsExportDateLimitDropdownOpen] = useState(false);
    
    // Navigation hierarchy
    const [viewLevel, setViewLevel] = useState<'ungets' | 'sheets' | 'data'>('ungets');
    const [selectedUngetIndex, setSelectedUngetIndex] = useState<number | null>(null);
    const [selectedSourceId, setSelectedSourceId] = useState<string>(''); 
    
    // Modal & Config
    const [isConfigOpen, setIsConfigOpen] = useState(false);
    
    // States for Export Options Modal
    const [isExportOptionsModalOpen, setIsExportOptionsModalOpen] = useState(false);
    const [exportCS, setExportCS] = useState(true);
    const [exportPS, setExportPS] = useState(true);
    const [exportALM, setExportALM] = useState(true);
    const [exportHOSP, setExportHOSP] = useState(true);
    const [exportOTRO, setExportOTRO] = useState(true);

    const [exportEmerald, setExportEmerald] = useState(true);
    const [exportAmber, setExportAmber] = useState(true);
    const [exportRed, setExportRed] = useState(true);
    const [exportGray, setExportGray] = useState(true);

    const [exportDateLimit, setExportDateLimit] = useState<'all' | '1h' | '12h' | '24h' | '3d' | '7d'>('all');
    const [exportHasPendingExpirations, setExportHasPendingExpirations] = useState<boolean>(false);
    const [exportScope, setExportScope] = useState<'single' | 'all'>('single');
    const [editingIndex, setEditingIndex] = useState<number | null>(null); // Nuevo: índice que se está editando
    const [tempUrls, setTempUrls] = useState<UngetConfig[]>([]);
    const [newUrlInput, setNewUrlInput] = useState('');
    const [newNameInput, setNewNameInput] = useState('');
    const [copied, setCopied] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState<SIGData | null>(null);

    // Modal para vencimientos en tabla
    const [isExpirationModalOpen, setIsExpirationModalOpen] = useState(false);
    const [expirationModalType, setExpirationModalType] = useState<'expired' | 'expiring' | null>(null);

    const maxUrlsAllowed = user?.maxUrlsAllowed;

    // Publicar evento al cambiar el estado de los filtros avanzados para contraer el sidebar de App.tsx
    useEffect(() => {
        window.dispatchEvent(new CustomEvent('toggle-advanced-filters', {
            detail: { open: isAdvancedFiltersSidebarOpen }
        }));
    }, [isAdvancedFiltersSidebarOpen]);

    // Cerrar automáticamente los filtros avanzados si se sale del nivel de sheets/establecimientos
    useEffect(() => {
        if (viewLevel !== 'sheets') {
            setIsAdvancedFiltersSidebarOpen(false);
        }
    }, [viewLevel]);

    // Initialize from server
    useEffect(() => {
        if (!user || !canAccess) return;
        
        const loadConfigs = async () => {
            setIsConfigLoading(true);
            
            // 1. CARGA RÁPIDA DESDE CACHÉ (Optimistic UI)
            const savedUrls = localStorage.getItem(`aura_sig_urls_${user.username}`);
            if (savedUrls) {
                try {
                    const parsed = JSON.parse(savedUrls);
                    if (Array.isArray(parsed) && parsed.length > 0) setScriptUrls(parsed);
                } catch(e) {}
            }
            
            const savedSources = localStorage.getItem(`aura_sig_sources_${user.username}`);
            if (savedSources) {
                try {
                    const parsed = JSON.parse(savedSources);
                    if (Array.isArray(parsed)) setSources(parsed);
                } catch(e) {}
            }

            const savedData = localStorage.getItem(`aura_sig_data_${user.username}`);
            if (savedData) {
                try {
                    const parsed = JSON.parse(savedData);
                    if (Array.isArray(parsed)) setData(parsed);
                } catch(e) {}
            }

            // 2. CARGA EN SEGUNDO PLANO DESDE EL SERVIDOR
            try {
                const remoteConfigs = await api.getUngetConfigs(user.username);
                if (remoteConfigs && remoteConfigs.length > 0) {
                    setScriptUrls(remoteConfigs);
                } else if (savedUrls) {
                    // Si no hay remoto pero sí local, intentar migrar al servidor
                    try {
                        const parsed = JSON.parse(savedUrls);
                        if (Array.isArray(parsed) && parsed.length > 0) {
                            const migrated = parsed.map(u => typeof u === 'string' ? { url: u, name: `UNGET ${Math.random().toString(36).substr(2, 4).toUpperCase()}` } : u);
                            setScriptUrls(migrated);
                            await api.saveUngetConfigs(user.username, migrated);
                        }
                    } catch(e) {}
                }
            } catch(e) {
                console.error("Error loading configs:", e);
            } finally {
                setIsConfigLoading(false);
            }
        };

        loadConfigs();
    }, [user, canAccess]);

    if (!canAccess) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-12 text-center">
                <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100 flex flex-col items-center max-w-md">
                    <AlertCircle className="h-12 w-12 text-amber-500 mb-4" />
                    <h3 className="text-xl font-black text-gray-900 mb-2">Acceso Restringido</h3>
                    <p className="text-gray-500 text-sm">
                        Su rol actual no tiene permisos para utilizar el módulo de Consulta Stock (SIG). 
                        Contacte al administrador para solicitar acceso.
                    </p>
                </div>
            </div>
        );
    }

    // Save to local storage when state changes
    useEffect(() => {
        if (!user || isConfigLoading) return; // IMPORTANTE: No guardar si aún estamos cargando la config inicial
        try {
            localStorage.setItem(`aura_sig_urls_${user.username}`, JSON.stringify(scriptUrls));
            localStorage.setItem(`aura_sig_sources_${user.username}`, JSON.stringify(sources));
        } catch (e) {
            console.warn("Storage quota exceeded for URLs/Sources.", e);
        }

        try {
            localStorage.setItem(`aura_sig_data_${user.username}`, JSON.stringify(data));
        } catch (e) {
            console.warn("Storage quota exceeded. Data will not be cached locally.", e);
        }
        
        if (sources.length > 0 && selectedSourceId !== '' && !sources.find(s => s.id === selectedSourceId)) {
            setSelectedSourceId('');
        }
    }, [scriptUrls, sources, data, selectedSourceId, user]);

    const fetchData = async (overrideUrls?: UngetConfig[], silent: boolean = false) => {
        if (isConfigLoading && !overrideUrls) return; 

        const urlsToUse = overrideUrls || scriptUrls;

        if (urlsToUse.length === 0) {
            if (!silent) {
                setError("Primero debe configurar al menos una URL de Web App de Apps Script.");
                setTempUrls([...urlsToUse]);
                setIsConfigOpen(true);
            }
            return;
        }

        if (!silent) {
            // Limpiar error inmediatamente al iniciar una carga válida
            setError(null);
            setIsLoading(true);
        } else {
            setIsSilentSyncing(true);
        }

        try {
            let allData: SIGData[] = [];
            let newSources: SheetSource[] = [];

            // Fetch todas las URLs en paralelo
            const fetchPromises = urlsToUse.map(async (config, urlIndex) => {
                try {
                    const response = await fetch(config.url);
                    if (!response.ok) throw new Error("HTTP " + response.status);
                    const json = await response.json();
                    
                    if (Array.isArray(json)) {
                        json.forEach((sheet: any) => {
                            const uniqueSourceId = `${urlIndex}_${sheet.id}`;
                            
                            let lastUpdateStr = '';
                            let lastUpdateTime = 0;
                            if (Array.isArray(sheet.data) && sheet.data.length > 0) {
                                // Tomar el dato de la primera fila de datos (que es la segunda de la hoja según el usuario)
                                const firstRow = sheet.data[0];
                                if (firstRow.Ultima_Actualizacion) {
                                    lastUpdateStr = firstRow.Ultima_Actualizacion;
                                    lastUpdateTime = parseDataDate(lastUpdateStr);
                                }
                            }

                            newSources.push({ 
                                id: uniqueSourceId, 
                                name: sheet.name, 
                                urlIndex,
                                lastUpdate: lastUpdateStr,
                                lastUpdateTime: lastUpdateTime || undefined
                            });
                            
                            if (Array.isArray(sheet.data)) {
                                const validData = sheet.data.filter((row: any) => row && (row.ID_Producto || row.Nombre)).map((row: any) => ({
                                    ...row,
                                    Fec_Vencim: formatDate(row.Fec_Vencim),
                                    Ultima_Actualizacion: formatDate(row.Ultima_Actualizacion),
                                    sourceId: uniqueSourceId
                                }));
                                allData = [...allData, ...validData];
                            }
                        });
                    }
                } catch (err: any) {
                    console.error(`Error fetching URL index ${urlIndex}:`, err);
                    throw new Error(`Fallo en fuente ${urlIndex + 1}: ${err.message}`);
                }
            });

            await Promise.all(fetchPromises);
            
            setSources(newSources);
            setData(allData);
            
            if (allData.length === 0 && !silent) {
               setError("No se encontraron registros en las hojas de cálculo. Revise que tengan información.");
            } else if (allData.length > 0 && silent && error) {
                setError(null); // Clear previous errors silently
            }
            
        } catch (err: any) {
            if (!silent) setError("Ocurrió un error al cargar los datos: " + err.message);
            else console.error("Silent auto-sync failed:", err);
        } finally {
            if (!silent) setIsLoading(false);
            else setIsSilentSyncing(false);
        }
    };

    // Al montar y cargar la configuración, hacer refresh de los datos.
    useEffect(() => {
        if (!isConfigLoading && scriptUrls.length > 0) {
            // Si no hay datos cacheados, hacemos fetch con UI de carga, sino, silent
            fetchData(undefined, data.length > 0);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isConfigLoading]); // Solo cuando termine de cargar la configuración

    // Sincronización automática periódica y al enfocar ventana
    useEffect(() => {
        if (isConfigLoading || scriptUrls.length === 0) return;

        // Auto-sync cada 15 minutos (900000 ms)
        const AUTO_SYNC_INTERVAL = 15 * 60 * 1000;
        const intervalId = setInterval(() => {
            fetchData(undefined, true);
        }, AUTO_SYNC_INTERVAL);

        // Auto-sync al volver la pestaña (si ha pasado más de 10 minutos desde la última vez)
        let lastSyncTime = Date.now();
        const handleFocus = () => {
            const now = Date.now();
            if (now - lastSyncTime > 10 * 60 * 1000) {
                lastSyncTime = now;
                fetchData(undefined, true);
            }
        };

        window.addEventListener('focus', handleFocus);

        return () => {
            clearInterval(intervalId);
            window.removeEventListener('focus', handleFocus);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scriptUrls, isConfigLoading]);

    const handleSaveConfig = async () => {
        if (!user) return;
        
        setIsLoading(true);
        try {
            const result = await api.saveUngetConfigs(user.username, tempUrls);
            if (result.success) {
                setScriptUrls([...tempUrls]);
                setIsConfigOpen(false);
                import('sonner').then(m => m.toast.success("Configuración guardada en la nube."));
                
                // Sincronizar datos inmediatamente con las nuevas URLs
                fetchData(tempUrls);
            } else {
                import('sonner').then(m => m.toast.error("Error al guardar en el servidor: " + result.message));
            }
        } catch (e) {
            import('sonner').then(m => m.toast.error("Error de conexión al guardar configuración."));
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddUrl = () => {
        const url = newUrlInput.trim();
        const name = newNameInput.trim() || `UNGET ${tempUrls.length + 1}`;
        
        if (!url) return;

        if (editingIndex !== null) {
            // Caso edición
            const updated = [...tempUrls];
            updated[editingIndex] = { url, name };
            setTempUrls(updated);
            setEditingIndex(null);
        } else {
            // Caso nuevo
            if (maxUrlsAllowed && tempUrls.length >= maxUrlsAllowed) {
                import('sonner').then(m => m.toast.error(`Ha alcanzado el límite máximo de ${maxUrlsAllowed} URLs para su rol.`));
                return;
            }
            if (tempUrls.find(u => u.url === url)) {
                import('sonner').then(m => m.toast.error("Esta URL ya está registrada."));
                return;
            }
            setTempUrls([...tempUrls, { url, name }]);
        }

        setNewUrlInput('');
        setNewNameInput('');
    };

    const handleEditUrl = (index: number, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        const config = tempUrls[index];
        setEditingIndex(index);
        setNewUrlInput(config.url);
        setNewNameInput(config.name);
        setIsConfigOpen(true);
    };

    const handleDirectEdit = (index: number, e: React.MouseEvent) => {
        e.stopPropagation();
        const config = scriptUrls[index];
        setTempUrls([...scriptUrls]);
        setEditingIndex(index);
        setNewUrlInput(config.url);
        setNewNameInput(config.name);
        setIsConfigOpen(true);
    };

    const handleDirectDelete = async (index: number, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!user) return;
        
        // Usamos una confirmación por toast en lugar de window.confirm que falla en iframes
        import('sonner').then(m => {
            m.toast("¿Eliminar esta conexión?", {
                description: `Se borrará el acceso a "${scriptUrls[index].name}"`,
                action: {
                    label: "Eliminar",
                    onClick: async () => {
                        const updated = scriptUrls.filter((_, idx) => idx !== index);
                        setIsLoading(true);
                        try {
                            const result = await api.saveUngetConfigs(user.username, updated);
                            if (result.success) {
                                setScriptUrls(updated);
                                if (selectedUngetIndex === index) {
                                    setViewLevel('ungets');
                                    setSelectedUngetIndex(null);
                                }
                                m.toast.success("Eliminado correctamente");
                            }
                        } catch(e) {
                            m.toast.error("Error al eliminar");
                        } finally {
                            setIsLoading(false);
                        }
                    }
                },
                cancel: {
                    label: "Cancelar",
                    onClick: () => {}
                }
            });
        });
    };

    const handleSelectUnget = (index: number) => {
        setSelectedUngetIndex(index);
        setViewLevel('sheets');
        setSelectedSourceId('');
        setSearchTerm('');
    };

    const handleSelectSheet = (sourceId: string) => {
        setSelectedSourceId(sourceId);
        setViewLevel('data');
        setSearchTerm('');
    };

    const goBack = () => {
        if (viewLevel === 'data') {
            setViewLevel('sheets');
            setSelectedSourceId('');
        } else if (viewLevel === 'sheets') {
            setViewLevel('ungets');
            setSelectedUngetIndex(null);
        }
    };

    const handleRemoveUrl = (indexToRemove: number) => {
        setTempUrls(tempUrls.filter((_, idx) => idx !== indexToRemove));
    };

    const exportCurrentSheetToExcel = () => {
        if (!selectedSourceId) return;
        const sheetInfo = sources.find(s => s.id === selectedSourceId);
        if (!sheetInfo) return;

        const dataToExport = filteredData.map(r => ({
            'ALMCOD': r.ALMCOD || '',
            'DESC_ALM': r.DESC_ALM || sheetInfo.name || '',
            'ID_Producto': r.ID_Producto || '',
            'CODIGO_SIG': r.CODIGO_SIG || r.SIGA || '',
            'Nombre': r.Nombre || r.DESC_ITEM || '',
            'Lote': r.Lote || r.LOTE || '',
            'Fec_Vencim': r.Fec_Vencim || r.VENCIMIENTO || '',
            'Reg_Sanitario': r.Reg_Sanitario || r.REG_SANITARIO || '',
            'TIPSUM': r.TIPSUM || '',
            'DESC_TIPSUM': r.DESC_TIPSUM || r.TIPO_SUMINISTRO || '',
            'FFINAN': r.FFINAN || '',
            'DESC_FFINAN': r.DESC_FFINAN || r.FF || '',
            'Saldo': r.Saldo !== undefined ? r.Saldo : (r.SALDO !== undefined ? r.SALDO : ''),
            'Precio_Det': r.Precio_Det || r.PRECIO_COMPRA || '',
            'Precio_Cab': r.Precio_Cab || r.PRECIO_REF || ''
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Stock");
        XLSX.writeFile(wb, `Stock_${sheetInfo.name}_${new Date().toISOString().split('T')[0]}.xlsx`.replace(/\s+/g, '_'));
    };

    const exportAllEstablishmentsToExcel = () => {
        if (selectedUngetIndex === null) return;
        setExportScope('single');
        // Pre-populate modal filters with the currently active advanced sidebar filters
        setExportCS(filter_CS);
        setExportPS(filter_PS);
        setExportALM(filter_ALM);
        setExportHOSP(filter_HOSP);
        setExportOTRO(filter_OTRO);

        setExportEmerald(filter_emerald);
        setExportAmber(filter_amber);
        setExportRed(filter_red);
        setExportGray(filter_gray);

        setExportHasPendingExpirations(filterHasPendingExpirations);
        setExportDateLimit(filterDateLimit);

        setIsExportOptionsModalOpen(true);
    };

    const filteredExportSourcesCount = useMemo(() => {
        if (exportScope === 'single' && selectedUngetIndex === null) return 0;
        return sources.filter(s => {
            if (exportScope === 'single' && s.urlIndex !== selectedUngetIndex) return false;
            
            // Type filter
            const typeValue = getSheetType(s.name);
            if (typeValue === 'CS' && !exportCS) return false;
            if (typeValue === 'PS' && !exportPS) return false;
            if (typeValue === 'ALM' && !exportALM) return false;
            if (typeValue === 'HOSP' && !exportHOSP) return false;
            if (typeValue === 'OTRO' && !exportOTRO) return false;

            // Color status Filter
            const colorValue = getUpdateStatus(s.lastUpdateTime).color;
            if (colorValue === 'bg-emerald-500' && !exportEmerald) return false;
            if (colorValue === 'bg-amber-500' && !exportAmber) return false;
            if (colorValue === 'bg-red-500' && !exportRed) return false;
            if (colorValue === 'bg-gray-400' && !exportGray) return false;

            // Date limit filter
            if (exportDateLimit !== 'all') {
                if (!s.lastUpdateTime) return false;
                const now = new Date().getTime();
                const diffMs = now - s.lastUpdateTime;
                const diffHours = diffMs / (1000 * 60 * 60);

                if (exportDateLimit === '1h' && diffHours > 1) return false;
                if (exportDateLimit === '12h' && diffHours > 12) return false;
                if (exportDateLimit === '24h' && diffHours > 24) return false;
                if (exportDateLimit === '3d' && diffHours > 72) return false;
                if (exportDateLimit === '7d' && diffHours > 168) return false;
            }

            return true;
        }).length;
    }, [
        sources,
        selectedUngetIndex,
        exportScope,
        exportCS,
        exportPS,
        exportALM,
        exportHOSP,
        exportOTRO,
        exportEmerald,
        exportAmber,
        exportRed,
        exportGray,
        exportDateLimit
    ]);

    const executeExportAllEstablishmentsToExcel = () => {
        if (exportScope === 'single' && selectedUngetIndex === null) return;
        
        // Filter sources based on conditions configured in the export modal
        const filteredSources = sources.filter(s => {
            if (exportScope === 'single' && s.urlIndex !== selectedUngetIndex) return false;
            
            // Type filter
            const typeValue = getSheetType(s.name);
            if (typeValue === 'CS' && !exportCS) return false;
            if (typeValue === 'PS' && !exportPS) return false;
            if (typeValue === 'ALM' && !exportALM) return false;
            if (typeValue === 'HOSP' && !exportHOSP) return false;
            if (typeValue === 'OTRO' && !exportOTRO) return false;

            // Color status Filter
            const colorValue = getUpdateStatus(s.lastUpdateTime).color;
            if (colorValue === 'bg-emerald-500' && !exportEmerald) return false;
            if (colorValue === 'bg-amber-500' && !exportAmber) return false;
            if (colorValue === 'bg-red-500' && !exportRed) return false;
            if (colorValue === 'bg-gray-400' && !exportGray) return false;

            // Date limit filter
            if (exportDateLimit !== 'all') {
                if (!s.lastUpdateTime) return false;
                
                const now = new Date().getTime();
                const diffMs = now - s.lastUpdateTime;
                const diffHours = diffMs / (1000 * 60 * 60);

                if (exportDateLimit === '1h' && diffHours > 1) return false;
                if (exportDateLimit === '12h' && diffHours > 12) return false;
                if (exportDateLimit === '24h' && diffHours > 24) return false;
                if (exportDateLimit === '3d' && diffHours > 72) return false;
                if (exportDateLimit === '7d' && diffHours > 168) return false;
            }

            return true;
        });

        const filteredSourceIds = new Set(filteredSources.map(s => s.id));

        // Filter data items belonging to the filtered sources
        const ungetData = data.filter(r => {
            if (!r.sourceId || !filteredSourceIds.has(r.sourceId)) return false;

            // Expiration filter
            if (exportHasPendingExpirations) {
                const { expiredCount, expiringThisMonthCount } = getExpirationStats([r]);
                if (expiredCount === 0 && expiringThisMonthCount === 0) return false;
            }
            
            return true;
        });

        if (ungetData.length === 0) {
            alert('No hay registros de stock que coincidan con los filtros seleccionados para exportar.');
            return;
        }

        const dataToExport = ungetData.map(r => {
            const sheetInfo = sources.find(s => s.id === r.sourceId);
            const ungetInfo = sheetInfo ? scriptUrls[sheetInfo.urlIndex] : null;
            return {
                'UNGET': ungetInfo ? ungetInfo.name : 'N/A',
                'ALMCOD': r.ALMCOD || '',
                'DESC_ALM': r.DESC_ALM || (sheetInfo ? sheetInfo.name : ''),
                'ID_Producto': r.ID_Producto || '',
                'CODIGO_SIG': r.CODIGO_SIG || r.SIGA || '',
                'Nombre': r.Nombre || r.DESC_ITEM || '',
                'Lote': r.Lote || r.LOTE || '',
                'Fec_Vencim': r.Fec_Vencim || r.VENCIMIENTO || '',
                'Reg_Sanitario': r.Reg_Sanitario || r.REG_SANITARIO || '',
                'TIPSUM': r.TIPSUM || '',
                'DESC_TIPSUM': r.DESC_TIPSUM || r.TIPO_SUMINISTRO || '',
                'FFINAN': r.FFINAN || '',
                'DESC_FFINAN': r.DESC_FFINAN || r.FF || '',
                'Saldo': r.Saldo !== undefined ? r.Saldo : (r.SALDO !== undefined ? r.SALDO : ''),
                'Precio_Det': r.Precio_Det || r.PRECIO_COMPRA || '',
                'Precio_Cab': r.Precio_Cab || r.PRECIO_REF || ''
            };
        });

        const ungetName = (exportScope === 'single' && selectedUngetIndex !== null) ? (scriptUrls[selectedUngetIndex]?.name || 'UNGET') : 'Regional';
        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Stock Consolidado");
        
        if (exportScope === 'single') {
            XLSX.writeFile(wb, `Stock_Consolidado_${ungetName}_${new Date().toISOString().split('T')[0]}.xlsx`.replace(/\s+/g, '_'));
        } else {
            XLSX.writeFile(wb, `Stock_Consolidado_Regional_${new Date().toISOString().split('T')[0]}.xlsx`.replace(/\s+/g, '_'));
        }
        
        setIsExportOptionsModalOpen(false);
    };

    const exportAllUngetsToExcel = () => {
        if (data.length === 0) return;
        setExportScope('all');
        // Pre-populate modal filters with the currently active advanced sidebar filters
        setExportCS(filter_CS);
        setExportPS(filter_PS);
        setExportALM(filter_ALM);
        setExportHOSP(filter_HOSP);
        setExportOTRO(filter_OTRO);

        setExportEmerald(filter_emerald);
        setExportAmber(filter_amber);
        setExportRed(filter_red);
        setExportGray(filter_gray);

        setExportHasPendingExpirations(filterHasPendingExpirations);
        setExportDateLimit(filterDateLimit);

        setIsExportOptionsModalOpen(true);
    };

    const copyScript = () => {
        navigator.clipboard.writeText(scriptCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const scriptCode = `function doGet(e) {
  // Reemplace 'VUESTRO_ID_AQUI' con el ID real de su Google Sheet
  // Por defecto he colocado el que suministró:
  var id = '1vic6MeMiA5Jk4_UWx8nI462yXe8irgxAoMncJiekOOA';
  
  try {
    var ss = SpreadsheetApp.openById(id);
    var sheets = ss.getSheets();
    var result = [];
    
    for (var i = 0; i < sheets.length; i++) {
        var sheet = sheets[i];
        var data = sheet.getDataRange().getValues();
        if (data.length < 2) continue; // Saltar sin datos
        
        var headers = data[0];
        var rows = [];
        
        for (var j = 1; j < data.length; j++) {
            var row = data[j];
            var obj = {};
            var hasData = false;
            for (var k = 0; k < headers.length; k++) {
                if (headers[k]) {
                    obj[headers[k].toString().trim()] = row[k] !== undefined ? row[k].toString() : "";
                    if (row[k]) hasData = true;
                }
            }
            if(hasData) rows.push(obj);
        }
        
        result.push({
            id: sheet.getSheetId().toString(),
            name: sheet.getName(),
            data: rows
        });
    }
    
    // Devolver un JSON válido respetando el Cross-Origin (CORS)
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
      return ContentService.createTextOutput(JSON.stringify({error: err.message})).setMimeType(ContentService.MimeType.JSON);
  }
}`;

    const filteredUngets = useMemo(() => {
        if (!ungetSearchTerm.trim()) return scriptUrls;
        const term = ungetSearchTerm.toLowerCase();
        return scriptUrls.filter(u => u.name.toLowerCase().includes(term));
    }, [scriptUrls, ungetSearchTerm]);

    const filteredData = useMemo(() => {
        let currentData = selectedSourceId ? data.filter(item => item && item.sourceId === selectedSourceId) : data;
        
        if (!searchTerm.trim()) return currentData.filter(Boolean);
        const lowerTerm = searchTerm.toLowerCase();
        
        return currentData.filter(item => {
            if (!item) return false;
            return (
                String(item.Nombre || '').toLowerCase().includes(lowerTerm) ||
                String(item.CODIGO_SIG || '').toLowerCase().includes(lowerTerm) ||
                String(item.ID_Producto || '').toLowerCase().includes(lowerTerm) ||
                String(item.Lote || '').toLowerCase().includes(lowerTerm) ||
                String(item.DESC_ALM || '').toLowerCase().includes(lowerTerm)
            );
        });
    }, [data, searchTerm, selectedSourceId]);

    const activeSheetData = useMemo(() => selectedSourceId ? data.filter(item => item && item.sourceId === selectedSourceId) : [], [data, selectedSourceId]);
    const activeSheetExpirationInfo = useMemo(() => getExpirationStats(activeSheetData), [activeSheetData]);

    const allUngetSummaries = useMemo(() => {
        const summaries: Record<number, { cs: number, ps: number, alm: number, hosp: number }> = {};
        
        scriptUrls.forEach((_, urlIndex) => {
            const counts = { cs: 0, ps: 0, alm: 0, hosp: 0 };
            const ungetSources = sources.filter(s => s.urlIndex === urlIndex);
            
            ungetSources.forEach(s => {
                const name = s.name.toUpperCase();
                if (name.includes('C.S.') || name.includes('CENTRO DE SALUD')) counts.cs++;
                else if (name.includes('P.S.') || name.includes('PUESTO DE SALUD')) counts.ps++;
                else if (name.includes('ALM') || name.includes('ALMACEN')) counts.alm++;
                else if (name.includes('HOSP') || name.includes('HOSPITAL')) counts.hosp++;
            });
            summaries[urlIndex] = counts;
        });
        
        return summaries;
    }, [scriptUrls, sources]);

    const globalUngetSummary = useMemo(() => {
        const counts = { cs: 0, ps: 0, alm: 0, hosp: 0 };
        sources.forEach(s => {
            const name = s.name.toUpperCase();
            if (name.includes('C.S.') || name.includes('CENTRO DE SALUD')) counts.cs++;
            else if (name.includes('P.S.') || name.includes('PUESTO DE SALUD')) counts.ps++;
            else if (name.includes('ALM') || name.includes('ALMACEN')) counts.alm++;
            else if (name.includes('HOSP') || name.includes('HOSPITAL')) counts.hosp++;
        });
        return counts;
    }, [sources]);

    const filteredAndSortedSources = useMemo(() => {
        if (selectedUngetIndex === null) return [];

        const matching = sources.filter(s => {
            if (s.urlIndex !== selectedUngetIndex) return false;
            
            // Search term filter
            if (sheetSearchTerm) {
                const term = sheetSearchTerm.toLowerCase();
                const lastDash = s.name.lastIndexOf('-');
                const description = lastDash === -1 ? s.name.replace(/^FARM\s*-\s*/i, '') : s.name.substring(0, lastDash).trim().replace(/^FARM\s*-\s*/i, '');
                const code = getAlmCodeForSheet(s.id, data);
                if (!description.toLowerCase().includes(term) && !code.toLowerCase().includes(term)) {
                    return false;
                }
            }

            // Type filter
            const typeValue = getSheetType(s.name);
            if (typeValue === 'CS' && !filter_CS) return false;
            if (typeValue === 'PS' && !filter_PS) return false;
            if (typeValue === 'ALM' && !filter_ALM) return false;
            if (typeValue === 'HOSP' && !filter_HOSP) return false;
            if (typeValue === 'OTRO' && !filter_OTRO) return false;

            // Color status Filter
            const colorValue = getUpdateStatus(s.lastUpdateTime).color;
            if (colorValue === 'bg-emerald-500' && !filter_emerald) return false;
            if (colorValue === 'bg-amber-500' && !filter_amber) return false;
            if (colorValue === 'bg-red-500' && !filter_red) return false;
            if (colorValue === 'bg-gray-400' && !filter_gray) return false;

            // Date limit filter
            if (filterDateLimit !== 'all') {
                if (!s.lastUpdateTime) return false;
                const now = new Date().getTime();
                const diffMs = now - s.lastUpdateTime;
                const diffHours = diffMs / (1000 * 60 * 60);

                if (filterDateLimit === '1h' && diffHours > 1) return false;
                if (filterDateLimit === '12h' && diffHours > 12) return false;
                if (filterDateLimit === '24h' && diffHours > 24) return false;
                if (filterDateLimit === '3d' && diffHours > 72) return false;
                if (filterDateLimit === '7d' && diffHours > 168) return false;
            }

            // Expiration filter
            if (filterHasPendingExpirations) {
                const sheetData = data.filter(r => r.sourceId === s.id);
                const { expiredCount, expiringThisMonthCount } = getExpirationStats(sheetData);
                if (expiredCount === 0 && expiringThisMonthCount === 0) return false;
            }

            return true;
        });

        // Sorting
        return [...matching].sort((s1, s2) => {
            if (filterSortOrder === 'name_asc') {
                return s1.name.localeCompare(s2.name);
            }
            if (filterSortOrder === 'name_desc') {
                return s2.name.localeCompare(s1.name);
            }
            if (filterSortOrder === 'date_newest') {
                const t1 = s1.lastUpdateTime || 0;
                const t2 = s2.lastUpdateTime || 0;
                return t2 - t1;
            }
            if (filterSortOrder === 'date_oldest') {
                const t1 = s1.lastUpdateTime || 0;
                const t2 = s2.lastUpdateTime || 100000000000000; // Put very old/unset at the back/bottom
                const t1_val = t1 === 0 ? 100000000000001 : t1;
                const t2_val = t2 === 0 ? 100000000000001 : t2;
                return t1_val - t2_val;
            }
            if (filterSortOrder === 'expired_highest') {
                const sheetData1 = data.filter(r => r.sourceId === s1.id);
                const stats1 = getExpirationStats(sheetData1);
                const expInd1 = stats1.expiredCount * 10 + stats1.expiringThisMonthCount;

                const sheetData2 = data.filter(r => r.sourceId === s2.id);
                const stats2 = getExpirationStats(sheetData2);
                const expInd2 = stats2.expiredCount * 10 + stats2.expiringThisMonthCount;

                if (expInd2 !== expInd1) {
                    return expInd2 - expInd1;
                }
                return s1.name.localeCompare(s2.name);
            }
            return 0;
        });
    }, [
        sources,
        selectedUngetIndex,
        sheetSearchTerm,
        data,
        filter_CS,
        filter_PS,
        filter_ALM,
        filter_HOSP,
        filter_OTRO,
        filter_emerald,
        filter_amber,
        filter_red,
        filter_gray,
        filterSortOrder,
        filterHasPendingExpirations,
        filterDateLimit
    ]);

    const establishmentSummary = useMemo(() => {
        if (viewLevel !== 'sheets' || selectedUngetIndex === null) return null;
        
        const filteredSources = sources.filter(s => {
            if (s.urlIndex !== selectedUngetIndex) return false;
            if (!sheetSearchTerm) return true;
            
            const term = sheetSearchTerm.toLowerCase();
            const lastDash = s.name.lastIndexOf('-');
            const description = lastDash === -1 ? s.name.replace(/^FARM\s*-\s*/i, '') : s.name.substring(0, lastDash).trim().replace(/^FARM\s*-\s*/i, '');
            const code = getAlmCodeForSheet(s.id, data);
            
            return description.toLowerCase().includes(term) || code.toLowerCase().includes(term);
        });

        const counts = { cs: 0, ps: 0, alm: 0, hosp: 0 };
        filteredSources.forEach(s => {
            const name = s.name.toUpperCase();
            if (name.includes('C.S.') || name.includes('CENTRO DE SALUD')) counts.cs++;
            else if (name.includes('P.S.') || name.includes('PUESTO DE SALUD')) counts.ps++;
            else if (name.includes('ALM') || name.includes('ALMACEN')) counts.alm++;
            else if (name.includes('HOSP') || name.includes('HOSPITAL')) counts.hosp++;
        });

        return counts;
    }, [viewLevel, selectedUngetIndex, sources, sheetSearchTerm, data]);

    return (
        <div className={`flex flex-col h-full bg-gray-50/50 sm:p-4 2xl:p-6 pb-20 max-w-7xl mx-auto w-full transition-all duration-300 ${isAdvancedFiltersSidebarOpen && viewLevel === 'sheets' ? 'md:pr-[380px] xl:pr-[420px]' : ''}`}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3 sm:gap-4 border-b border-gray-200 pb-4 px-4 pt-4 sm:px-0 sm:pt-0">
                <div className="w-full sm:w-auto">
                    <h2 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                        <Database className="h-5 w-5 sm:h-6 sm:w-6 text-teal-600 shrink-0" />
                        <span className="truncate">Consulta Stock</span>
                    </h2>
                    <p className="text-xs sm:text-sm text-gray-500 mt-1 line-clamp-2 sm:line-clamp-none">
                        Consulte medicamentos e insumos directamente desde el registro consolidado (Apps Script).
                    </p>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto mt-2 sm:mt-0 overflow-x-auto pb-1 sm:pb-0 hide-scrollbar">
                    <button 
                        onClick={() => {
                            setTempUrls([...scriptUrls]);
                            setIsConfigOpen(!isConfigOpen);
                        }}
                        className="flex-1 sm:flex-none border border-gray-300 bg-white text-gray-700 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5 sm:gap-2 shrink-0"
                    >
                        <Settings className="h-4 w-4 text-gray-500" />
                        Configurar
                    </button>
                    <button 
                        id="sync-btn"
                        onClick={() => fetchData()} disabled={isLoading || isSilentSyncing}
                        className="flex-1 sm:flex-none bg-teal-600 text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm hover:bg-teal-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 sm:gap-2 shadow-sm shrink-0"
                    >
                        <RefreshCw className={`h-4 w-4 ${isLoading || isSilentSyncing ? 'animate-spin' : ''}`} />
                        {isLoading || isSilentSyncing ? 'Sincronizando...' : 'Sincronizar'}
                    </button>
                </div>
            </div>

            {isConfigOpen && (
                <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-[2.5rem] shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col border border-white/20">
                        {/* Header Modal */}
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center text-teal-600">
                                    <Settings className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="font-black text-gray-900 text-lg uppercase tracking-tight">Gestión de Orígenes UNGET</h3>
                                    <p className="text-xs text-gray-500 font-medium tracking-tight">Configure sus conexiones a Google Apps Script</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => { setIsConfigOpen(false); setEditingIndex(null); setNewUrlInput(''); setNewNameInput(''); }}
                                className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-900"
                            >
                                <X className="h-6 w-6" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 lg:p-8">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <div className="space-y-6">
                                    <div className="bg-gray-50 border border-gray-200 rounded-3xl p-6">
                                        <h4 className="text-sm font-black text-gray-800 mb-4 flex items-center gap-2">
                                            <Plus className={`h-4 w-4 ${editingIndex !== null ? 'text-amber-500' : 'text-teal-500'}`} />
                                            {editingIndex !== null ? 'EDITAR ORÍGEN' : 'AÑADIR NUEVO ORÍGEN'}
                                        </h4>
                                        <div className="space-y-4">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black text-gray-400 ml-1 uppercase">Nombre Identificador</label>
                                                <input
                                                    type="text"
                                                    placeholder="Ej: UNGET CENTRO"
                                                    value={newNameInput}
                                                    onChange={e => setNewNameInput(e.target.value)}
                                                    className="w-full text-sm rounded-xl border-gray-300 focus:border-teal-500 focus:ring-teal-500 shadow-sm py-2.5 px-4 font-medium"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black text-gray-400 ml-1 uppercase">URL Web App (Apps Script)</label>
                                                <input
                                                    type="url"
                                                    placeholder="https://script.google.com/..."
                                                    value={newUrlInput}
                                                    onChange={e => setNewUrlInput(e.target.value)}
                                                    onKeyDown={e => e.key === 'Enter' && handleAddUrl()}
                                                    className="w-full text-sm rounded-xl border-gray-300 focus:border-teal-500 focus:ring-teal-500 shadow-sm py-2.5 px-4 font-mono text-[11px]"
                                                />
                                            </div>
                                            <div className="flex gap-2">
                                                <button 
                                                    onClick={handleAddUrl}
                                                    className={`flex-1 py-2.5 rounded-xl text-white font-bold text-sm transition-all shadow-sm flex items-center justify-center gap-2 ${editingIndex !== null ? 'bg-amber-500 hover:bg-amber-600' : 'bg-teal-600 hover:bg-teal-700'}`}
                                                >
                                                    {editingIndex !== null ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                                                    {editingIndex !== null ? 'Actualizar en Lista' : 'Añadir a Lista'}
                                                </button>
                                                {editingIndex !== null && (
                                                    <button 
                                                        onClick={() => { setEditingIndex(null); setNewUrlInput(''); setNewNameInput(''); }}
                                                        className="px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-all font-bold text-sm"
                                                    >
                                                        Cancelar
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center px-1">
                                            <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider">Lista de Conexiones ({tempUrls.length})</h4>
                                            {maxUrlsAllowed && <span className="text-[10px] font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full">Límite: {maxUrlsAllowed}</span>}
                                        </div>
                                        <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                                            {tempUrls.length > 0 ? tempUrls.map((config, idx) => (
                                                <div key={idx} className={`group flex gap-3 items-center bg-white border p-3 rounded-2xl transition-all shadow-sm ${editingIndex === idx ? 'border-amber-500 bg-amber-50/30' : 'border-gray-100 hover:border-gray-200'}`}>
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${editingIndex === idx ? 'bg-amber-100 text-amber-600' : 'bg-gray-50 text-gray-400'}`}>
                                                        <LinkIcon className="h-4 w-4" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-xs font-black text-gray-800 truncate uppercase">{config.name}</div>
                                                        <div className="text-[9px] text-gray-400 truncate font-mono">{config.url}</div>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <button 
                                                            onClick={(e) => handleEditUrl(idx, e)}
                                                            className={`p-1.5 rounded-lg transition-colors ${editingIndex === idx ? 'text-amber-600 bg-white' : 'text-gray-400 hover:bg-gray-100 hover:text-blue-600'}`}
                                                            title="Editar"
                                                        >
                                                            <Settings className="h-4 w-4" />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleRemoveUrl(idx)}
                                                            className="p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
                                                            title="Quitar"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            )) : (
                                                <div className="py-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                                                    <LinkIcon className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                                                    <p className="text-xs font-bold text-gray-400">No hay orígenes en la lista</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="space-y-4">
                                    <div className="bg-blue-50/50 border border-blue-100 rounded-[2rem] p-6 h-full flex flex-col">
                                        <div className="flex items-center gap-2 mb-4">
                                            <div className="w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center font-black">?</div>
                                            <h4 className="text-sm font-black text-blue-900 uppercase">¿Cómo obtener la URL?</h4>
                                        </div>
                                        <div className="flex-1 space-y-4">
                                            <div className="space-y-4 text-[11px] text-blue-800 font-medium leading-relaxed">
                                                <div className="flex gap-3">
                                                    <div className="w-5 h-5 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center shrink-0 font-black">1</div>
                                                    <p>Cree un Nuevo Proyecto en <a href="https://script.google.com" target="_blank" rel="noreferrer" className="font-black underline decoration-2">script.google.com</a> con el código adjunto.</p>
                                                </div>
                                                <div className="flex gap-3">
                                                    <div className="w-5 h-5 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center shrink-0 font-black">2</div>
                                                    <p>Click en <span className="font-black">Implementar &gt; Nueva Implementación</span>.</p>
                                                </div>
                                                <div className="flex gap-3">
                                                    <div className="w-5 h-5 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center shrink-0 font-black">3</div>
                                                    <p>Tipo: <span className="font-black text-blue-900">Aplicación Web</span>, Acceso: <span className="bg-blue-900 text-white px-1.5 py-0.5 rounded text-[9px]">Cualquier persona</span>.</p>
                                                </div>
                                            </div>

                                            <div className="relative mt-4">
                                                <div className="absolute -top-3 left-4 bg-blue-600 text-[10px] text-white px-2 py-0.5 rounded font-black tracking-wider shadow-sm z-10">CÓDIGO RECOMENDADO</div>
                                                <div className="relative pt-2">
                                                    <pre className="text-[10px] bg-slate-900 text-slate-300 p-5 rounded-3xl overflow-hidden h-44 overflow-y-auto font-mono scrollbar-thin scrollbar-thumb-slate-700 border border-slate-800 shadow-xl">
                                                        {scriptCode}
                                                    </pre>
                                                    <button 
                                                        onClick={copyScript}
                                                        className="absolute top-5 right-5 bg-white/10 hover:bg-white/20 p-2 rounded-xl text-white backdrop-blur-sm transition-all border border-white/5"
                                                    >
                                                        {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer Modal */}
                        <div className="p-6 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-3 sticky bottom-0 z-10">
                            <button 
                                onClick={() => { setIsConfigOpen(false); setEditingIndex(null); }}
                                className="px-6 py-2.5 text-sm font-bold text-gray-500 hover:text-gray-700 transition-colors"
                            >
                                Cerrar sin Guardar
                            </button>
                            <button
                                onClick={handleSaveConfig}
                                disabled={isLoading || tempUrls.length === 0}
                                className="bg-teal-600 text-white px-8 py-2.5 rounded-2xl text-sm font-black hover:bg-teal-700 transition-all shadow-lg shadow-teal-600/20 flex items-center gap-2 disabled:opacity-50"
                            >
                                <Save className="h-4 w-4" />
                                GUARDAR Y SINCRONIZAR CAMBIOS
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 sm:rounded-xl flex items-center gap-2 mb-6 mx-4 sm:mx-0">
                    <AlertCircle className="h-5 w-5 shrink-0" />
                    <span className="text-sm">{error}</span>
                </div>
            )}

            <div className="bg-white sm:rounded-2xl border-y sm:border border-gray-200 shadow-sm flex-1 flex flex-col min-h-[600px] overflow-hidden">
                {/* BREADCRUMBS & SEARCH */}
                <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex flex-col gap-4">
                    {/* BREADCRUMBS */}
                    {/* Mobile Breadcrumb (Back button + Current state) */}
                    <div className="flex sm:hidden items-center gap-2 text-sm">
                        {viewLevel === 'sheets' && (
                            <button 
                                onClick={() => { setViewLevel('ungets'); setSelectedUngetIndex(null); setSelectedSourceId(''); }}
                                className="p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors shrink-0"
                            >
                                <ArrowLeft className="h-5 w-5" />
                            </button>
                        )}
                        {viewLevel === 'data' && (
                             <button 
                                onClick={() => { setViewLevel('sheets'); setSelectedSourceId(''); }}
                                className="p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors shrink-0"
                            >
                                <ArrowLeft className="h-5 w-5" />
                            </button>       
                        )}
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-100 text-teal-800 shrink-0 min-w-0">
                             {viewLevel === 'ungets' && (
                                <>
                                    <Building2 className="h-4 w-4 shrink-0" />
                                    <span className="whitespace-nowrap font-bold">UNGETs</span>
                                </>
                             )}
                             {viewLevel === 'sheets' && (
                                <>
                                    <MapPin className="h-4 w-4 shrink-0" />
                                    <span className="whitespace-nowrap font-bold truncate">{scriptUrls[selectedUngetIndex!]?.name || 'Documento'}</span>
                                </>
                             )}
                             {viewLevel === 'data' && (
                                <>
                                    <FileSpreadsheet className="h-4 w-4 shrink-0" />
                                    <span className="whitespace-nowrap font-bold truncate">{(() => {
                                        const name = sources.find(s => s.id === selectedSourceId)?.name || 'Hoja';
                                        const lastDash = name.lastIndexOf('-');
                                        const desc = lastDash === -1 ? name.replace(/^FARM\s*-\s*/i, '') : name.substring(0, lastDash).trim().replace(/^FARM\s*-\s*/i, '');
                                        const code = selectedSourceId ? getAlmCodeForSheet(selectedSourceId, data) : '';
                                        return code ? `${desc} (${code})` : desc;
                                    })()}</span>
                                </>
                             )}
                        </div>
                    </div>

                    {/* Desktop Breadcrumbs */}
                    <nav className="hidden sm:flex items-center gap-2 text-sm font-medium overflow-x-auto pb-1 -mb-1 hide-scrollbar">
                        <button 
                            onClick={() => { setViewLevel('ungets'); setSelectedUngetIndex(null); setSelectedSourceId(''); }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors shrink-0 ${viewLevel === 'ungets' ? 'bg-teal-100 text-teal-800' : 'text-gray-500 hover:bg-gray-100'}`}
                        >
                            <Building2 className="h-4 w-4 shrink-0" />
                            <span className="whitespace-nowrap">UNGETs</span>
                        </button>
                        
                        {selectedUngetIndex !== null && (
                            <>
                                <ChevronRight className="h-4 w-4 text-gray-300 shrink-0" />
                                <button 
                                    onClick={() => { setViewLevel('sheets'); setSelectedSourceId(''); }}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors shrink-0 ${viewLevel === 'sheets' ? 'bg-teal-100 text-teal-800' : 'text-gray-500 hover:bg-gray-100'}`}
                                >
                                    <MapPin className="h-4 w-4 shrink-0" />
                                    <span className="whitespace-nowrap truncate max-w-[200px] sm:max-w-none">{scriptUrls[selectedUngetIndex]?.name || 'Documento'}</span>
                                </button>
                            </>
                        )}

                        {selectedSourceId && (
                            <>
                                <ChevronRight className="h-4 w-4 text-gray-300 shrink-0" />
                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-100 text-teal-800 shrink-0">
                                    <FileSpreadsheet className="h-4 w-4 shrink-0" />
                                    <span className="whitespace-nowrap truncate max-w-[200px] sm:max-w-none">{(() => {
                                        const name = sources.find(s => s.id === selectedSourceId)?.name || 'Hoja';
                                        const lastDash = name.lastIndexOf('-');
                                        const desc = lastDash === -1 ? name.replace(/^FARM\s*-\s*/i, '') : name.substring(0, lastDash).trim().replace(/^FARM\s*-\s*/i, '');
                                        const code = selectedSourceId ? getAlmCodeForSheet(selectedSourceId, data) : '';
                                        return code ? `${desc} (${code})` : desc;
                                    })()}</span>
                                </div>
                            </>
                        )}
                    </nav>

                    {/* ACTIONS (Search & Filters) */}
                    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center w-full">
                        {/* Search */}
                        <div className="w-full sm:max-w-md">
                            {viewLevel === 'ungets' && (
                                <div className="relative w-full">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Search className="h-4 w-4 text-gray-400" />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Buscar UNGET por nombre..."
                                        value={ungetSearchTerm}
                                        onChange={(e) => setUngetSearchTerm(e.target.value)}
                                        className="block w-full pl-9 pr-3 py-2 border border-teal-500/30 rounded-xl bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 sm:text-xs transition-all shadow-sm"
                                    />
                                </div>
                            )}
                            {viewLevel === 'data' && (
                                <div className="relative w-full">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Search className="h-4 w-4 text-gray-400" />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Buscar en esta hoja..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="block w-full pl-9 pr-3 py-2 border border-teal-500/30 rounded-xl bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 sm:text-xs transition-all shadow-sm"
                                    />
                                </div>
                            )}
                            {viewLevel === 'sheets' && (
                                <div className="relative w-full">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Search className="h-4 w-4 text-gray-400" />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Buscar establecimiento por nombre o código..."
                                        value={sheetSearchTerm}
                                        onChange={(e) => setSheetSearchTerm(e.target.value)}
                                        className="block w-full pl-9 pr-3 py-2 border border-teal-500/30 rounded-xl bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 sm:text-xs transition-all shadow-sm"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Alerts and count */}
                        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto shrink-0 justify-start sm:justify-end overflow-x-auto pb-1 sm:pb-0 hide-scrollbar scroll-smooth">
                            {viewLevel === 'data' && (
                                <>
                                    {activeSheetExpirationInfo.expiredCount > 0 && (
                                        <button 
                                            onClick={() => { setExpirationModalType('expired'); setIsExpirationModalOpen(true); }}
                                            className="flex items-center gap-1.5 bg-red-50 text-red-700 px-3 py-2 rounded-xl border border-red-200 shadow-sm text-xs font-bold shrink-0"
                                            title="Ver productos vencidos"
                                        >
                                            <AlertTriangle className="h-4 w-4" />
                                            <span>{activeSheetExpirationInfo.expiredCount} vencido{activeSheetExpirationInfo.expiredCount !== 1 ? 's' : ''}</span>
                                        </button>
                                    )}
                                    {activeSheetExpirationInfo.expiringThisMonthCount > 0 && (
                                        <button 
                                            onClick={() => { setExpirationModalType('expiring'); setIsExpirationModalOpen(true); }}
                                            className="flex items-center gap-1.5 bg-amber-50 text-amber-700 px-3 py-2 rounded-xl border border-amber-200 shadow-sm text-xs font-bold shrink-0"
                                            title="Ver productos por vencer este mes"
                                        >
                                            <Clock className="h-4 w-4" />
                                            <span>{activeSheetExpirationInfo.expiringThisMonthCount} por vencer</span>
                                        </button>
                                    )}
                                </>
                            )}
                            
                            {viewLevel === 'sheets' && (
                                <>
                                    <button
                                        onClick={exportAllEstablishmentsToExcel}
                                        className="flex items-center gap-1.5 bg-green-50 hover:bg-green-100 text-green-700 px-3 py-2 rounded-xl border border-green-200 shadow-sm text-xs font-bold shrink-0 transition-colors"
                                        title="Descargar Excel de Todos los Establecimientos"
                                    >
                                        <Download className="h-4 w-4" />
                                        <span className="hidden sm:inline">Exportar Todos</span>
                                    </button>

                                    <button
                                        onClick={() => setIsAdvancedFiltersSidebarOpen(true)}
                                        className="flex items-center gap-1.5 bg-teal-50 hover:bg-teal-100/80 text-teal-700 px-3 py-2 rounded-xl border border-teal-200 shadow-sm text-xs font-bold shrink-0 transition-colors relative"
                                        title="Filtros Avanzados"
                                    >
                                        <Filter className="h-4 w-4" />
                                        <span>Filtros Avanzados</span>
                                        {/* Indicador de filtros activos */}
                                        {(!filter_CS || !filter_PS || !filter_ALM || !filter_HOSP || !filter_OTRO || !filter_emerald || !filter_amber || !filter_red || !filter_gray || filterSortOrder !== 'name_asc' || filterHasPendingExpirations) && (
                                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-teal-500 rounded-full border border-white animate-pulse" />
                                        )}
                                    </button>
                                </>
                            )}

                            {viewLevel === 'sheets' && establishmentSummary && (
                                <div className="flex items-center gap-1.5 px-3 py-2 sm:py-1 bg-gray-50 border border-gray-200 rounded-xl shrink-0 overflow-x-auto hide-scrollbar">
                                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white text-blue-700 text-[10px] sm:text-[11px] font-black border border-blue-100 shadow-sm whitespace-nowrap">
                                        C.S: {establishmentSummary.cs}
                                    </div>
                                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white text-amber-700 text-[10px] sm:text-[11px] font-black border border-amber-100 shadow-sm whitespace-nowrap">
                                        P.S: {establishmentSummary.ps}
                                    </div>
                                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white text-teal-700 text-[10px] sm:text-[11px] font-black border border-teal-100 shadow-sm whitespace-nowrap">
                                        ALM: {establishmentSummary.alm}
                                    </div>
                                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white text-red-700 text-[10px] sm:text-[11px] font-black border border-red-100 shadow-sm whitespace-nowrap">
                                        HOSP: {establishmentSummary.hosp}
                                    </div>
                                </div>
                            )}

                            {viewLevel === 'ungets' && globalUngetSummary && sources.length > 0 && (
                                <>
                                    <button
                                        onClick={exportAllUngetsToExcel}
                                        className="flex items-center gap-1.5 bg-green-50 hover:bg-green-100 text-green-700 px-3 py-2 rounded-xl border border-green-200 shadow-sm text-xs font-bold shrink-0 transition-colors"
                                        title="Descargar Excel de Todas las UNGETs"
                                    >
                                        <Download className="h-4 w-4" />
                                        <span className="hidden sm:inline">Exportar todos</span>
                                    </button>
                                    
                                    <div className="flex items-center gap-1.5 px-3 py-2 sm:py-1 bg-gray-50 border border-gray-200 rounded-xl shrink-0 overflow-x-auto hide-scrollbar">
                                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white text-blue-700 text-[10px] sm:text-[11px] font-black border border-blue-100 shadow-sm whitespace-nowrap">
                                            C.S: {globalUngetSummary.cs}
                                        </div>
                                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white text-amber-700 text-[10px] sm:text-[11px] font-black border border-amber-100 shadow-sm whitespace-nowrap">
                                            P.S: {globalUngetSummary.ps}
                                        </div>
                                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white text-teal-700 text-[10px] sm:text-[11px] font-black border border-teal-100 shadow-sm whitespace-nowrap">
                                            ALM: {globalUngetSummary.alm}
                                        </div>
                                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white text-red-700 text-[10px] sm:text-[11px] font-black border border-red-100 shadow-sm whitespace-nowrap">
                                            HOSP: {globalUngetSummary.hosp}
                                        </div>
                                    </div>
                                </>
                            )}

                            {viewLevel === 'data' && (
                                <button
                                    onClick={exportCurrentSheetToExcel}
                                    className="flex items-center gap-1.5 bg-green-50 hover:bg-green-100 text-green-700 px-3 py-2 rounded-xl border border-green-200 shadow-sm text-xs font-bold shrink-0 transition-colors"
                                    title="Descargar Excel del Establecimiento"
                                >
                                    <Download className="h-4 w-4" />
                                    <span className="hidden sm:inline">Exportar Excel</span>
                                </button>
                            )}

                            <div className="hidden sm:block text-xs text-gray-500 bg-white px-3 sm:px-4 py-2 rounded-xl border border-gray-200 shadow-sm font-medium shrink-0 whitespace-nowrap">
                                {viewLevel === 'ungets' ? `${scriptUrls.length} UNGETs` : 
                                 viewLevel === 'sheets' ? `${sources.filter(s => s.urlIndex === selectedUngetIndex).length} Establ.` : 
                                 `${filteredData.length} prod.`}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-auto p-4 sm:p-6 pb-32 sm:pb-6 bg-gray-50/30">
                    {isConfigLoading && scriptUrls.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-teal-600 gap-3 py-20">
                            <RefreshCw className="h-10 w-10 animate-spin" />
                            <span className="font-bold text-lg">Cargando configuración...</span>
                        </div>
                    ) : isLoading && data.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-teal-600 gap-3 py-20">
                            <RefreshCw className="h-10 w-10 animate-spin" />
                            <span className="font-bold text-lg">Sincronizando información...</span>
                        </div>
                    ) : error && data.length === 0 ? (
                         <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto py-20">
                            <AlertCircle className="h-12 w-12 text-red-400 mb-4" />
                            <h3 className="text-lg font-black text-gray-900 mb-2">Error de conexión</h3>
                            <p className="text-sm text-gray-500 mb-6">{error}</p>
                            <button onClick={() => fetchData()} className="bg-teal-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-teal-700 transition-colors">
                                Reintentar Sincronización
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* LEVEL 1: UNGET CARDS */}
                            {viewLevel === 'ungets' && (
                                <div className="animate-in fade-in zoom-in-95 duration-300">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                                        {filteredUngets.length > 0 ? filteredUngets.map((config, idx) => {
                                            // Encontrar el índice original en scriptUrls para las funciones de edición/borrado
                                            const originalIdx = scriptUrls.findIndex(u => u.url === config.url && u.name === config.name);
                                            return (
                                                <div
                                                    key={idx}
                                                    onClick={() => handleSelectUnget(originalIdx)}
                                                    className="group bg-white border border-gray-200 p-4 sm:p-6 rounded-xl sm:rounded-2xl shadow-sm hover:shadow-md hover:border-teal-500 transition-all text-left flex flex-row sm:flex-col items-center sm:items-start gap-4 sm:gap-0 h-full cursor-pointer relative overflow-hidden"
                                                >
                                                    {/* Botones de acción rápidos */}
                                                    <div className="absolute top-4 right-4 flex items-center gap-2 opacity-100 sm:opacity-40 group-hover:opacity-100 transition-opacity z-10">
                                                        <button 
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                handleDirectEdit(originalIdx, e);
                                                            }}
                                                            className="p-1.5 sm:p-2 bg-white/90 backdrop-blur-sm shadow-sm border border-gray-100 rounded-lg text-gray-500 hover:text-blue-600 hover:border-blue-200 transition-all"
                                                            title="Editar conexión"
                                                        >
                                                            <Settings className="h-4 w-4" />
                                                        </button>
                                                        <button 
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                handleDirectDelete(originalIdx, e);
                                                            }}
                                                            className="p-1.5 sm:p-2 bg-white/90 backdrop-blur-sm shadow-sm border border-gray-100 rounded-lg text-gray-500 hover:text-red-600 hover:border-red-200 transition-all"
                                                            title="Eliminar conexión"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </div>

                                                    <div className="w-12 h-12 shrink-0 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center sm:mb-4 group-hover:bg-teal-600 group-hover:text-white transition-colors">
                                                        <Building2 className="h-6 w-6" />
                                                    </div>
                                                    
                                                    <div className="flex-1 min-w-0 pr-16 sm:pr-0">
                                                        <h3 className="text-sm sm:text-lg font-black text-gray-900 sm:mb-2 group-hover:text-teal-700 transition-colors uppercase tracking-tight truncate sm:whitespace-normal">{config.name}</h3>
                                                        
                                                        <div className="sm:hidden text-[10px] sm:text-xs font-bold text-gray-500 mt-0.5 mb-1.5">
                                                            {sources.filter(s => s.urlIndex === originalIdx).length} Estab.
                                                        </div>

                                                        {/* Resumen de establecimientos por tipo */}
                                                        {allUngetSummaries[originalIdx] && (
                                                            <div className="flex flex-wrap gap-1 mb-2 sm:mb-4">
                                                                {allUngetSummaries[originalIdx].cs > 0 && (
                                                                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100 uppercase" title="Centros de Salud">
                                                                        C.S: {allUngetSummaries[originalIdx].cs}
                                                                    </span>
                                                                )}
                                                                {allUngetSummaries[originalIdx].ps > 0 && (
                                                                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-100 uppercase" title="Puestos de Salud">
                                                                        P.S: {allUngetSummaries[originalIdx].ps}
                                                                    </span>
                                                                )}
                                                                {allUngetSummaries[originalIdx].alm > 0 && (
                                                                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-teal-50 text-teal-700 border border-teal-100 uppercase" title="Almacenes">
                                                                        ALM: {allUngetSummaries[originalIdx].alm}
                                                                    </span>
                                                                )}
                                                                {allUngetSummaries[originalIdx].hosp > 0 && (
                                                                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-red-50 text-red-700 border border-red-100 uppercase" title="Hospitales">
                                                                        HOSP: {allUngetSummaries[originalIdx].hosp}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}

                                                        <div className="flex items-center gap-1.5 text-[9px] sm:text-xs text-gray-400 mt-auto">
                                                            <LinkIcon className="h-3 w-3 shrink-0" />
                                                            <span className="truncate max-w-[120px] sm:max-w-[150px]">{config.url}</span>
                                                        </div>
                                                    </div>

                                                    <div className="hidden sm:flex items-center justify-between w-full mt-4 pt-4 border-t border-gray-50">
                                                        <span className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider">
                                                            {sources.filter(s => s.urlIndex === originalIdx).length} Establecimientos
                                                        </span>
                                                        <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-teal-500 group-hover:translate-x-1 transition-all" />
                                                    </div>
                                                </div>
                                            );
                                        }) : (
                                            <div className="col-span-full py-20 text-center">
                                                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                                    <Settings className="h-8 w-8 text-gray-400" />
                                                </div>
                                                <h3 className="text-xl font-bold text-gray-800">No hay UNGETs que coincidan</h3>
                                                <p className="text-gray-500 mt-2">Intente con otro término de búsqueda.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* LEVEL 2: SHEET CARDS */}
                            {viewLevel === 'sheets' && (
                                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                                    <div className="flex items-center justify-between mb-4 sm:mb-6">
                                        <h3 className="text-sm sm:text-lg font-black text-gray-900 uppercase">Seleccione un establecimiento</h3>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                                        {filteredAndSortedSources.length === 0 ? (
                                            <div className="col-span-full py-16 text-center bg-white border border-gray-100 rounded-2xl shadow-sm p-8">
                                                <div className="w-16 h-16 bg-teal-50 text-teal-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                                    <Filter className="h-8 w-8 text-teal-500 animate-pulse" />
                                                </div>
                                                <h3 className="text-base font-bold text-gray-900">No hay establecimientos con estos filtros</h3>
                                                <p className="text-gray-500 mt-1 max-w-sm mx-auto text-xs font-medium">Pruebe cambiando o limpiando los filtros avanzados para encontrar su establecimiento.</p>
                                                <button
                                                    onClick={() => {
                                                        setFilter_CS(true);
                                                        setFilter_PS(true);
                                                        setFilter_ALM(true);
                                                        setFilter_HOSP(true);
                                                        setFilter_OTRO(true);
                                                        setFilter_emerald(true);
                                                        setFilter_amber(true);
                                                        setFilter_red(true);
                                                        setFilter_gray(true);
                                                        setFilterSortOrder('name_asc');
                                                        setFilterHasPendingExpirations(false);
                                                        setFilterDateLimit('all');
                                                    }}
                                                    className="mt-4 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-sm"
                                                >
                                                    Limpiar todos los filtros
                                                </button>
                                            </div>
                                        ) : filteredAndSortedSources.map((sheet) => {
                                            const sheetData = data.filter(r => r.sourceId === sheet.id);
                                            const { expiredCount, expiringThisMonthCount } = getExpirationStats(sheetData);

                                            return (
                                            <button
                                                key={sheet.id}
                                                onClick={() => handleSelectSheet(sheet.id)}
                                                className="group relative bg-white border border-gray-200 p-4 sm:p-6 rounded-xl sm:rounded-2xl shadow-sm hover:shadow-md hover:border-teal-500 transition-all text-left flex flex-row sm:flex-col items-center sm:items-start gap-4 sm:gap-0 h-full"
                                            >
                                                <div className="hidden sm:flex absolute top-4 right-4 flex-col gap-2 items-end z-10">
                                                    {expiredCount > 0 && (
                                                        <div className="flex items-center gap-1.5 bg-red-100 text-red-700 px-2.5 py-1 rounded-full text-[10px] font-bold shadow-sm" title="Vencido en stock">
                                                            <AlertTriangle className="h-3 w-3" />
                                                            <span>{expiredCount} vencido{expiredCount !== 1 ? 's' : ''}</span>
                                                        </div>
                                                    )}
                                                    {expiringThisMonthCount > 0 && (
                                                        <div className="flex items-center gap-1.5 bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full text-[10px] font-bold shadow-sm" title="Vence este mes">
                                                            <Clock className="h-3 w-3" />
                                                            <span>{expiringThisMonthCount} por vencer</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="w-12 h-12 shrink-0 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center sm:mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors relative">
                                                    <FileSpreadsheet className="h-6 w-6" />
                                                    <div 
                                                        className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${getUpdateStatus(sheet.lastUpdateTime).color}`}
                                                        title={getUpdateStatus(sheet.lastUpdateTime).label}
                                                    />
                                                </div>
                                                <div className="flex-1 sm:mb-4 min-w-0">
                                                    {(() => {
                                                        const lastDash = sheet.name.lastIndexOf('-');
                                                        const description = lastDash === -1 ? sheet.name.replace(/^FARM\s*-\s*/i, '') : sheet.name.substring(0, lastDash).trim().replace(/^FARM\s*-\s*/i, '');
                                                        const code = getAlmCodeForSheet(sheet.id, data);
                                                        
                                                        return (
                                                            <>
                                                                {code && <p className="text-[10px] sm:text-xs font-bold text-teal-600 mb-0.5">{code}</p>}
                                                                <h3 className="text-sm sm:text-lg font-black text-gray-900 leading-tight mb-1 truncate sm:whitespace-normal" title={description}>{description}</h3>
                                                            </>
                                                        );
                                                    })()}
                                                    
                                                    {/* Mobile alerts right below the title */}
                                                    <div className="sm:hidden flex items-center gap-2 mt-1.5 flex-wrap">
                                                        {expiredCount > 0 && (
                                                            <div className="flex items-center gap-1 bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full text-[9px] font-bold" title="Vencido en stock">
                                                                <AlertTriangle className="h-2.5 w-2.5" />
                                                                <span>{expiredCount}</span>
                                                            </div>
                                                        )}
                                                        {expiringThisMonthCount > 0 && (
                                                            <div className="flex items-center gap-1 bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full text-[9px] font-bold" title="Vence este mes">
                                                                <Clock className="h-2.5 w-2.5" />
                                                                <span>{expiringThisMonthCount}</span>
                                                            </div>
                                                        )}
                                                        {sheet.lastUpdateTime && (
                                                            <div className="flex items-center gap-1 text-[9px] sm:text-[10px] font-bold text-gray-500">
                                                                <RefreshCw className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                                                                <span className="hidden sm:inline">Act:</span> {formatFullDate(sheet.lastUpdateTime).split(' ')[0]}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Desktop last updated */}
                                                    {sheet.lastUpdateTime && (
                                                        <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-bold text-gray-500 mt-2">
                                                            <RefreshCw className="h-3 w-3" />
                                                            <span>Act: {formatFullDate(sheet.lastUpdateTime)}</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="hidden sm:flex items-center justify-between w-full mt-auto pt-4 border-t border-gray-50">
                                                    <span className="text-[10px] font-black text-teal-600 uppercase">Consultar Stock</span>
                                                    <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-teal-500 group-hover:translate-x-1 transition-all" />
                                                </div>
                                                <div className="sm:hidden ml-auto">
                                                    <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-teal-500 group-hover:translate-x-1 transition-all shrink-0" />
                                                </div>
                                            </button>
                                        )})}
                                    </div>
                                </div>
                            )}

                            {/* LEVEL 3: DATA TABLE */}
                            {viewLevel === 'data' && (
                                <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 -mx-4 md:-mx-6 -mt-4 md:-mt-6 font-sans">
                                    <div className="bg-transparent sm:bg-white sm:border-t border-gray-100 overflow-x-auto custom-scrollbar pb-40 sm:pb-0 px-4 sm:px-0 pt-4 sm:pt-0">
                                        <table className="min-w-full block sm:table">
                                            <thead className="hidden sm:table-header-group bg-gray-50/80 sticky top-0 z-10 backdrop-blur-sm">
                                                <tr>
                                                    <th scope="col" className="px-4 py-3 text-left text-xs font-black text-gray-500 uppercase tracking-wider whitespace-nowrap">Cód. SISMED / SIGA</th>
                                                    <th scope="col" className="px-4 py-3 text-left text-xs font-black text-gray-500 uppercase tracking-wider min-w-[250px]">Descripción del Producto</th>
                                                    <th scope="col" className="px-4 py-3 text-right text-xs font-black text-gray-500 uppercase tracking-wider whitespace-nowrap">Saldo</th>
                                                    <th scope="col" className="px-4 py-3 text-left text-xs font-black text-gray-500 uppercase tracking-wider whitespace-nowrap">Lote / Venc.</th>
                                                    <th scope="col" className="px-4 py-3 text-left text-xs font-black text-gray-500 uppercase tracking-wider whitespace-nowrap">Tipo Sum.</th>
                                                    <th scope="col" className="px-4 py-3 text-left text-xs font-black text-gray-500 uppercase tracking-wider whitespace-nowrap">F. Finan.</th>
                                                </tr>
                                            </thead>
                                            <tbody className="block sm:table-row-group bg-transparent sm:bg-white">
                                                {filteredData.length > 0 ? filteredData.map((row, i) => (
                                                    <tr 
                                                        key={i} 
                                                        onClick={() => setSelectedRecord(row)}
                                                        className="block sm:table-row bg-white rounded-xl sm:rounded-none shadow-sm sm:shadow-none border border-gray-200 sm:border-0 border-b-gray-100 p-4 sm:p-0 hover:bg-teal-50/50 transition-colors cursor-pointer group mb-3 sm:mb-0 relative"
                                                    >
                                                        {/* Mobile Card Layout */}
                                                        <td className="block sm:hidden">
                                                            <div className="flex justify-between items-start mb-2">
                                                                <div className="flex flex-col">
                                                                    <span className="text-xs font-black text-teal-700 bg-teal-50 px-2 py-0.5 rounded w-fit mb-1 border border-teal-100">{row.ID_Producto || '-'}</span>
                                                                    <span className="text-[10px] text-gray-400 font-bold">{row.CODIGO_SIG || '-'}</span>
                                                                </div>
                                                                <div className="text-right">
                                                                    <span className="text-[10px] text-gray-400 font-black uppercase block mb-0.5">Saldo</span>
                                                                    <span className="text-xl font-black text-teal-600 leading-none">{(!isNaN(parseInt(String(row.Saldo), 10))) ? parseInt(String(row.Saldo), 10) : 0}</span>
                                                                </div>
                                                            </div>
                                                            <div className="text-sm font-bold text-gray-900 mb-2 leading-snug">
                                                                {row.Nombre || '-'}
                                                            </div>
                                                            <div className="flex justify-between items-center text-[10px]">
                                                                <div className="flex flex-col gap-0.5 w-full">
                                                                    <span className="text-gray-500 font-mono"><span className="font-bold text-gray-400">Lote:</span> {row.Lote || '-'}</span>
                                                                    <div className="flex justify-between items-center">
                                                                        <span className="text-gray-500 font-mono"><span className="font-bold text-gray-400">Vence:</span> {formatDate(row.Fec_Vencim) || '-'}</span>
                                                                        <div className="flex items-center gap-1.5">
                                                                            <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-100 font-bold uppercase truncate max-w-[80px]" title={row.TIPSUM}>{row.TIPSUM || '-'}</span>
                                                                            <span className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-100 font-bold uppercase truncate max-w-[80px]" title={row.FFINAN}>{row.FFINAN || '-'}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        
                                                        {/* Desktop Table Cells */}
                                                        <td className="hidden sm:table-cell px-4 py-3 whitespace-nowrap text-sm text-gray-500 font-mono group-hover:text-teal-700">
                                                            <div className="font-bold">{row.ID_Producto || '-'}</div>
                                                            <div className="text-[10px] text-gray-400 mt-0.5">{row.CODIGO_SIG || '-'}</div>
                                                        </td>
                                                        <td className="hidden sm:table-cell px-4 py-3 text-sm text-gray-900 font-medium">
                                                            {row.Nombre || '-'}
                                                            <div className="text-[10px] text-gray-400 font-normal mt-0.5 max-w-sm truncate" title={row.Reg_Sanitario}>
                                                                RS: {row.Reg_Sanitario || 'S/N'}
                                                            </div>
                                                        </td>
                                                        <td className="hidden sm:table-cell px-4 py-3 whitespace-nowrap text-sm text-right font-bold text-gray-900">
                                                            {(!isNaN(parseInt(String(row.Saldo), 10))) ? parseInt(String(row.Saldo), 10) : 0}
                                                        </td>
                                                        <td className="hidden sm:table-cell px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                                            <span className="font-mono text-gray-700">{row.Lote || '-'}</span>
                                                            <div className="text-[10px] mt-0.5">Vence: {formatDate(row.Fec_Vencim) || '-'}</div>
                                                        </td>
                                                        <td className="hidden sm:table-cell px-4 py-3 whitespace-nowrap text-sm">
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 uppercase" title={row.DESC_TIPSUM}>
                                                                {row.TIPSUM || '-'}
                                                            </span>
                                                        </td>
                                                        <td className="hidden sm:table-cell px-4 py-3 whitespace-nowrap text-sm">
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100 uppercase" title={row.DESC_FFINAN}>
                                                                {row.FFINAN || '-'}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                )) : (
                                                    <tr className="block sm:table-row">
                                                        <td colSpan={6} className="block sm:table-cell px-4 py-12 text-center text-sm text-gray-500">
                                                            No se encontraron coincidencias para su búsqueda.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Modal de Detalle */}
            {selectedRecord && (
                <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSelectedRecord(null)}>
                    <div 
                        className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header Minimalista y Elegante */}
                        <div className="px-5 sm:px-8 pt-6 sm:pt-8 pb-5 sm:pb-6 bg-gradient-to-b from-teal-50/50 to-white flex justify-between items-start relative border-b border-gray-100">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-400 to-blue-500"></div>
                            <div className="pr-10 sm:pr-12 w-full">
                                <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                                    <span className="inline-flex items-center justify-center h-7 sm:h-8 px-3 rounded-full text-[10px] sm:text-xs font-black bg-teal-100 text-teal-800 shadow-sm border border-teal-200/50 whitespace-nowrap">
                                        COD: {selectedRecord.ID_Producto || 'S/ID'}
                                    </span>
                                    <span className="text-[10px] sm:text-[11px] font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded-full uppercase tracking-wider whitespace-nowrap">
                                        SIGA: {selectedRecord.CODIGO_SIG || '-'}
                                    </span>
                                </div>
                                <h3 className="text-xl sm:text-2xl font-black text-gray-900 leading-tight tracking-tight break-words">
                                    {selectedRecord.Nombre || 'Sin Descripción'}
                                </h3>
                            </div>
                            <button 
                                onClick={() => setSelectedRecord(null)}
                                className="absolute top-4 sm:top-6 right-4 sm:right-6 text-gray-400 hover:text-gray-900 hover:bg-gray-100 p-2 sm:p-2.5 rounded-full transition-all"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        
                        <div className="px-5 sm:px-8 pb-5 sm:pb-8 overflow-y-auto max-h-[70vh] custom-scrollbar">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8 mt-5 sm:mt-6">
                                {/* Estado y Ubicación - Destacado */}
                                <div className="col-span-full bg-gray-50/80 rounded-2xl p-4 sm:p-5 border border-gray-100/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
                                    <div className="w-full sm:w-auto">
                                        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-black mb-1">Establecimiento</p>
                                        <p className="text-sm border-b border-gray-100/50 pb-2 sm:border-0 sm:pb-0 font-bold text-gray-900 leading-snug">{(selectedRecord.DESC_ALM || '-').replace(/^FARM\s*-\s*/i, '')} <span className="text-gray-400 font-medium whitespace-nowrap">({formatAlmCode(selectedRecord.ALMCOD)})</span></p>
                                    </div>
                                    <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start w-full sm:w-auto bg-white sm:bg-transparent p-3 sm:p-0 rounded-xl sm:rounded-none border sm:border-0 border-gray-100 mt-2 sm:mt-0">
                                        <p className="text-[10px] sm:text-[10px] text-gray-500 uppercase tracking-widest font-black mb-0 sm:mb-1">Saldo Actual</p>
                                        <p className={`text-2xl sm:text-3xl font-black leading-none ${parseFloat(String(selectedRecord.Saldo || '0').replace(/,/g, '')) <= 0 ? 'text-red-500' : 'text-teal-600'}`}>
                                            {(!isNaN(parseInt(String(selectedRecord.Saldo), 10))) ? parseInt(String(selectedRecord.Saldo), 10) : 0}
                                        </p>
                                    </div>
                                </div>

                                {/* Bloque de Datos Lote/Vencimiento */}
                                <div className="space-y-5">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Clock className="w-4 h-4 text-gray-400" />
                                        <h4 className="text-xs font-black text-gray-900 uppercase tracking-wider">Control de Calidad</h4>
                                    </div>
                                    <div className="bg-white space-y-4">
                                        <div>
                                            <p className="text-[10px] text-gray-400 uppercase tracking-widest font-black mb-1">Lote</p>
                                            <p className="text-sm font-mono font-bold text-gray-800">{selectedRecord.Lote || '-'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-gray-400 uppercase tracking-widest font-black mb-1">Fecha de Vencimiento</p>
                                            <p className={`text-sm font-black ${
                                                (() => {
                                                    if (!selectedRecord.Fec_Vencim) return 'text-gray-800';
                                                    const today = new Date(); today.setHours(0,0,0,0);
                                                    const parts = selectedRecord.Fec_Vencim.split(/[\/\-]/);
                                                    if (parts.length === 3) {
                                                        const m = parseInt(parts[1],10)-1; const y = parseInt(parts[2],10); const d = parseInt(parts[0],10);
                                                        const fy = y < 100 ? y + 2000 : y;
                                                        const exp = new Date(fy, m, d);
                                                        if (exp < today) return 'text-red-600';
                                                        if (m === today.getMonth() && fy === today.getFullYear()) return 'text-amber-600';
                                                    }
                                                    return 'text-gray-800';
                                                })()
                                            }`}>
                                                {formatDate(selectedRecord.Fec_Vencim) || '-'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-gray-400 uppercase tracking-widest font-black mb-1">Registro Sanitario</p>
                                            <p className="text-sm font-medium text-gray-800 uppercase">{selectedRecord.Reg_Sanitario || '-'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-gray-400 uppercase tracking-widest font-black mb-1">Última Actualización</p>
                                            <p className="text-xs font-medium text-gray-500">{formatDate(selectedRecord.Ultima_Actualizacion) || '-'}</p>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Bloque de Clasificación y Financiamiento */}
                                <div className="space-y-5">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Database className="w-4 h-4 text-gray-400" />
                                        <h4 className="text-xs font-black text-gray-900 uppercase tracking-wider">Clasificación</h4>
                                    </div>
                                    <div className="bg-white space-y-4">
                                        <div>
                                            <p className="text-[10px] text-gray-400 uppercase tracking-widest font-black mb-1">Tipo de Suministro</p>
                                            <p className="text-sm font-medium text-gray-800">{selectedRecord.DESC_TIPSUM || '-'} <span className="text-gray-400 font-bold text-[10px] uppercase ml-1 px-1.5 py-0.5 bg-gray-100 rounded">{selectedRecord.TIPSUM || '-'}</span></p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-gray-400 uppercase tracking-widest font-black mb-1">F. Financiamiento</p>
                                            <p className="text-sm font-medium text-gray-800">{selectedRecord.DESC_FFINAN || '-'} <span className="text-gray-400 font-bold text-[10px] uppercase ml-1 px-1.5 py-0.5 bg-gray-100 rounded">{selectedRecord.FFINAN || '-'}</span></p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 pt-2">
                                            <div>
                                                <p className="text-[10px] text-gray-400 uppercase tracking-widest font-black mb-1">Precio Compra</p>
                                                <p className="text-sm font-black text-gray-900">S/ {selectedRecord.Precio_Det || '-'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-gray-400 uppercase tracking-widest font-black mb-1">Precio Referencial</p>
                                                <p className="text-sm font-bold text-gray-500">S/ {selectedRecord.Precio_Cab || '-'}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="px-8 py-5 bg-gray-50/80 border-t border-gray-100 flex justify-end">
                            <button 
                                onClick={() => setSelectedRecord(null)}
                                className="bg-white border border-gray-200 text-gray-700 px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Expiración */}
            {isExpirationModalOpen && expirationModalType && (
                <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsExpirationModalOpen(false)}>
                    <div 
                        className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 max-h-[90vh]"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className={`p-4 sm:p-6 border-b border-gray-100 flex items-start justify-between ${expirationModalType === 'expired' ? 'bg-red-50' : 'bg-amber-50'}`}>
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${expirationModalType === 'expired' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                                    {expirationModalType === 'expired' ? <AlertTriangle className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-gray-900">
                                        {expirationModalType === 'expired' ? 'Productos Vencidos' : 'Productos por Vencer (Este Mes)'}
                                    </h3>
                                    <p className="text-sm text-gray-500">
                                        {expirationModalType === 'expired' ? 'Atención urgente requerida' : 'Asegure la rotación de estos inventarios'}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setIsExpirationModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors shrink-0">
                                <X className="h-5 w-5 text-gray-400" />
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-auto bg-gray-50/30 p-0">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50/80 sticky top-0 z-10 backdrop-blur-sm">
                                    <tr>
                                        <th scope="col" className="px-4 py-3 text-left text-xs font-black text-gray-500 uppercase tracking-wider whitespace-nowrap">Cód. SISMED / SIGA</th>
                                        <th scope="col" className="px-4 py-3 text-left text-xs font-black text-gray-500 uppercase tracking-wider">Descripción del Producto</th>
                                        <th scope="col" className="px-4 py-3 text-right text-xs font-black text-gray-500 uppercase tracking-wider">Saldo</th>
                                        <th scope="col" className="px-4 py-3 text-left text-xs font-black text-gray-500 uppercase tracking-wider">Lote / Venc.</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-100">
                                    {(expirationModalType === 'expired' ? activeSheetExpirationInfo.expired : activeSheetExpirationInfo.expiringThisMonth).map((row, i) => (
                                        <tr key={i} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => { setIsExpirationModalOpen(false); setSelectedRecord(row); }}>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-black text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded w-fit mb-1">{row.ID_Producto || '-'}</span>
                                                    <span className="text-[10px] text-gray-400 font-bold">{row.CODIGO_SIG}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="text-sm font-bold text-gray-900 break-words line-clamp-2" title={row.Nombre}>{row.Nombre || '-'}</div>
                                                <div className="text-[10px] text-gray-400 mt-0.5 break-words line-clamp-1 truncate" title={row.Reg_Sanitario}>RS: {row.Reg_Sanitario || 'S/N'}</div>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-right">
                                                <span className={`text-base font-black ${row.Saldo?.toString() === '0' ? 'text-red-500' : 'text-gray-900'} bg-gray-50 px-2 py-1 rounded inline-block`}>{row.Saldo || '0'}</span>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <div className="text-sm font-medium text-gray-900 uppercase">{row.Lote || '-'}</div>
                                                <div className={`text-[10px] font-bold mt-0.5 ${expirationModalType === 'expired' ? 'text-red-600' : 'text-amber-600'}`}>Vence: {row.Fec_Vencim || '-'}</div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {((expirationModalType === 'expired' ? activeSheetExpirationInfo.expired : activeSheetExpirationInfo.expiringThisMonth).length === 0) && (
                                <div className="text-center py-12 text-gray-500">
                                    No hay registros para mostrar.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* SIDEBAR DE FILTROS AVANZADOS (DERECHA) */}
            {isAdvancedFiltersSidebarOpen && (
                <div className="fixed inset-0 z-[10000] flex justify-end pointer-events-none">
                    {/* Backdrop Click Dismiss (Solo en móvil para no bloquear interacción de fondo en escritorio) */}
                    <div className="absolute inset-0 bg-black/45 backdrop-blur-xs pointer-events-auto md:hidden" onClick={() => setIsAdvancedFiltersSidebarOpen(false)} />
                    
                    {/* Sidebar Container */}
                    <div className="relative w-full max-w-sm sm:max-w-md md:w-[380px] xl:w-[420px] md:max-w-none bg-slate-50 h-full shadow-[-12px_0_40px_rgba(0,0,0,0.1),-1px_0_4px_rgba(0,0,0,0.02)] border-l border-slate-200 pointer-events-auto animate-in slide-in-from-right duration-350 flex flex-col">
                        {/* Header */}
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.03)] z-10 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center text-teal-600 shadow-sm border border-teal-100/50">
                                    <Filter className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="font-black text-slate-900 text-base tracking-tight uppercase">Filtros Avanzados</h3>
                                    <p className="text-[10px] text-teal-600 font-extrabold tracking-widest uppercase">Establecimientos de Salud</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsAdvancedFiltersSidebarOpen(false)}
                                className="p-2 hover:bg-slate-100 active:scale-95 rounded-xl transition-all text-slate-400 hover:text-slate-900 shadow-sm border border-slate-100 hover:border-slate-200 bg-white"
                                title="Cerrar filtros"
                            >
                                <X className="h-4.5 w-4.5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Filter Section: Type */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between items-center w-full">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-3 bg-teal-500 rounded-full" />
                                        <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Tipo de Establecimiento</h4>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[11px] font-bold">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setFilter_CS(true);
                                                setFilter_PS(true);
                                                setFilter_ALM(true);
                                                setFilter_HOSP(true);
                                                setFilter_OTRO(true);
                                            }}
                                            className="text-teal-600 hover:text-teal-700 font-black hover:underline cursor-pointer active:scale-95 transition-all"
                                        >
                                            Todos
                                        </button>
                                        <span className="text-slate-300 select-none">|</span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setFilter_CS(false);
                                                setFilter_PS(false);
                                                setFilter_ALM(false);
                                                setFilter_HOSP(false);
                                                setFilter_OTRO(false);
                                            }}
                                            className="text-slate-500 hover:text-slate-700 hover:underline cursor-pointer active:scale-95 transition-all"
                                        >
                                            Ninguno
                                        </button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 gap-2.5">
                                    {/* C.S. */}
                                    <label className={`group flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all border select-none ${
                                        filter_CS 
                                            ? 'bg-blue-50/40 border-blue-200 text-blue-900 shadow-[0_3px_10px_-2px_rgba(59,130,246,0.08)]' 
                                            : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50 hover:border-slate-200'
                                    }`}>
                                        <input
                                            type="checkbox"
                                            checked={filter_CS}
                                            onChange={(e) => setFilter_CS(e.target.checked)}
                                            className="sr-only"
                                        />
                                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                                            filter_CS 
                                                ? 'bg-blue-600 border-blue-600 text-white scale-100' 
                                                : 'border-slate-300 bg-white text-transparent group-hover:border-slate-400'
                                        }`}>
                                            <Check className="h-3 w-3 stroke-[3]" />
                                        </div>
                                        <div className="flex justify-between items-center w-full">
                                            <span className={`text-xs font-extrabold transition-colors ${filter_CS ? 'text-blue-950 font-black' : 'text-slate-700 font-bold'}`}>Centro de Salud (C.S.)</span>
                                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-lg border transition-all ${
                                                filter_CS 
                                                    ? 'bg-blue-600/10 text-blue-700 border-blue-200/55 shadow-xs' 
                                                    : 'bg-slate-50 text-slate-500 border-slate-100'
                                            }`}>
                                                C.S. {establishmentSummary?.cs ?? 0}
                                            </span>
                                        </div>
                                    </label>

                                    {/* P.S. */}
                                    <label className={`group flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all border select-none ${
                                        filter_PS 
                                            ? 'bg-amber-50/40 border-amber-200 text-amber-900 shadow-[0_3px_10px_-2px_rgba(245,158,11,0.08)]' 
                                            : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50 hover:border-slate-200'
                                    }`}>
                                        <input
                                            type="checkbox"
                                            checked={filter_PS}
                                            onChange={(e) => setFilter_PS(e.target.checked)}
                                            className="sr-only"
                                        />
                                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                                            filter_PS 
                                                ? 'bg-amber-600 border-amber-600 text-white scale-100' 
                                                : 'border-slate-300 bg-white text-transparent group-hover:border-slate-400'
                                        }`}>
                                            <Check className="h-3 w-3 stroke-[3]" />
                                        </div>
                                        <div className="flex justify-between items-center w-full">
                                            <span className={`text-xs font-extrabold transition-colors ${filter_PS ? 'text-amber-950 font-black' : 'text-slate-700 font-bold'}`}>Puesto de Salud (P.S.)</span>
                                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-lg border transition-all ${
                                                filter_PS 
                                                    ? 'bg-amber-600/10 text-amber-700 border-amber-200/55 shadow-xs' 
                                                    : 'bg-slate-50 text-slate-500 border-slate-100'
                                            }`}>
                                                P.S. {establishmentSummary?.ps ?? 0}
                                            </span>
                                        </div>
                                    </label>

                                    {/* ALM */}
                                    <label className={`group flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all border select-none ${
                                        filter_ALM 
                                            ? 'bg-teal-50/40 border-teal-200 text-teal-900 shadow-[0_3px_10px_-2px_rgba(20,184,166,0.08)]' 
                                            : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50 hover:border-slate-200'
                                    }`}>
                                        <input
                                            type="checkbox"
                                            checked={filter_ALM}
                                            onChange={(e) => setFilter_ALM(e.target.checked)}
                                            className="sr-only"
                                        />
                                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                                            filter_ALM 
                                                ? 'bg-teal-600 border-teal-600 text-white scale-100' 
                                                : 'border-slate-300 bg-white text-transparent group-hover:border-slate-400'
                                        }`}>
                                            <Check className="h-3 w-3 stroke-[3]" />
                                        </div>
                                        <div className="flex justify-between items-center w-full">
                                            <span className={`text-xs font-extrabold transition-colors ${filter_ALM ? 'text-teal-950 font-black' : 'text-slate-700 font-bold'}`}>Almacén (ALM)</span>
                                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-lg border transition-all ${
                                                filter_ALM 
                                                    ? 'bg-teal-600/10 text-teal-700 border-teal-200/55 shadow-xs' 
                                                    : 'bg-slate-50 text-slate-500 border-slate-100'
                                            }`}>
                                                ALM {establishmentSummary?.alm ?? 0}
                                            </span>
                                        </div>
                                    </label>

                                    {/* HOSP */}
                                    <label className={`group flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all border select-none ${
                                        filter_HOSP 
                                            ? 'bg-red-50/40 border-red-200 text-red-900 shadow-[0_3px_10px_-2px_rgba(239,68,68,0.08)]' 
                                            : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50 hover:border-slate-200'
                                    }`}>
                                        <input
                                            type="checkbox"
                                            checked={filter_HOSP}
                                            onChange={(e) => setFilter_HOSP(e.target.checked)}
                                            className="sr-only"
                                        />
                                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                                            filter_HOSP 
                                                ? 'bg-red-600 border-red-600 text-white scale-100' 
                                                : 'border-slate-300 bg-white text-transparent group-hover:border-slate-400'
                                        }`}>
                                            <Check className="h-3 w-3 stroke-[3]" />
                                        </div>
                                        <div className="flex justify-between items-center w-full">
                                            <span className={`text-xs font-extrabold transition-colors ${filter_HOSP ? 'text-red-950 font-black' : 'text-slate-700 font-bold'}`}>Hospital (HOSP)</span>
                                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-lg border transition-all ${
                                                filter_HOSP 
                                                    ? 'bg-red-600/10 text-red-700 border-red-200/55 shadow-xs' 
                                                    : 'bg-slate-50 text-slate-500 border-slate-100'
                                            }`}>
                                                HOSP {establishmentSummary?.hosp ?? 0}
                                            </span>
                                        </div>
                                    </label>

                                    {/* Otros */}
                                    <label className={`group flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all border select-none ${
                                        filter_OTRO 
                                            ? 'bg-slate-200 border-slate-300 text-slate-900 shadow-[0_3px_10px_-2px_rgba(100,116,139,0.08)]' 
                                            : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50 hover:border-slate-200'
                                    }`}>
                                        <input
                                            type="checkbox"
                                            checked={filter_OTRO}
                                            onChange={(e) => setFilter_OTRO(e.target.checked)}
                                            className="sr-only"
                                        />
                                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                                            filter_OTRO 
                                                ? 'bg-slate-700 border-slate-700 text-white scale-100' 
                                                : 'border-slate-300 bg-white text-transparent group-hover:border-slate-400'
                                        }`}>
                                            <Check className="h-3 w-3 stroke-[3]" />
                                        </div>
                                        <div className="flex justify-between items-center w-full">
                                            <span className={`text-xs font-extrabold transition-colors ${filter_OTRO ? 'text-slate-950 font-black' : 'text-slate-700 font-bold'}`}>Otros</span>
                                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-lg border transition-all ${
                                                filter_OTRO 
                                                    ? 'bg-slate-700/10 text-slate-700 border-slate-300 shadow-xs' 
                                                    : 'bg-slate-50 text-slate-500 border-slate-100'
                                            }`}>
                                                Otro {
                                                    sources && selectedUngetIndex !== null ? (
                                                        sources.filter(s => s.urlIndex === selectedUngetIndex).length 
                                                        - ((establishmentSummary?.cs ?? 0) + (establishmentSummary?.ps ?? 0) + (establishmentSummary?.alm ?? 0) + (establishmentSummary?.hosp ?? 0))
                                                    ) : 0
                                                }
                                            </span>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {/* Filter Section: Last Update Status (Color) */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between items-center w-full">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-3 bg-teal-500 rounded-full" />
                                        <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Estado de Actualización</h4>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[11px] font-bold">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setFilter_emerald(true);
                                                setFilter_amber(true);
                                                setFilter_red(true);
                                                setFilter_gray(true);
                                            }}
                                            className="text-teal-600 hover:text-teal-700 font-black hover:underline cursor-pointer active:scale-95 transition-all"
                                        >
                                            Todos
                                        </button>
                                        <span className="text-slate-300 select-none">|</span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setFilter_emerald(false);
                                                setFilter_amber(false);
                                                setFilter_red(false);
                                                setFilter_gray(false);
                                            }}
                                            className="text-slate-500 hover:text-slate-700 hover:underline cursor-pointer active:scale-95 transition-all"
                                        >
                                            Ninguno
                                        </button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 gap-2.5">
                                    {/* Al día */}
                                    <label className={`group flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all border select-none ${
                                        filter_emerald 
                                            ? 'bg-emerald-50/40 border-emerald-200 text-emerald-950 shadow-[0_3px_10px_-2px_rgba(16,185,129,0.08)]' 
                                            : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50 hover:border-slate-200'
                                    }`}>
                                        <input
                                            type="checkbox"
                                            checked={filter_emerald}
                                            onChange={(e) => setFilter_emerald(e.target.checked)}
                                            className="sr-only"
                                        />
                                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                                            filter_emerald 
                                                ? 'bg-emerald-600 border-emerald-600 text-white scale-100' 
                                                : 'border-slate-300 bg-white text-transparent group-hover:border-slate-400'
                                        }`}>
                                            <Check className="h-3 w-3 stroke-[3]" />
                                        </div>
                                        <div className="flex items-center justify-between w-full">
                                            <div className="flex items-center gap-2">
                                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-white shrink-0 shadow-sm animate-pulse" />
                                                <span className={`text-xs font-extrabold transition-colors ${filter_emerald ? 'text-emerald-950 font-black' : 'text-slate-700 font-bold'}`}>Al día</span>
                                            </div>
                                            <span className="text-[10px] text-slate-400 font-bold">&lt;1 hora sin actualizar</span>
                                        </div>
                                    </label>

                                    {/* Pendiente */}
                                    <label className={`group flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all border select-none ${
                                        filter_amber 
                                            ? 'bg-amber-50/40 border-amber-200 text-amber-950 shadow-[0_3px_10px_-2px_rgba(245,158,11,0.08)]' 
                                            : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50 hover:border-slate-200'
                                    }`}>
                                        <input
                                            type="checkbox"
                                            checked={filter_amber}
                                            onChange={(e) => setFilter_amber(e.target.checked)}
                                            className="sr-only"
                                        />
                                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                                            filter_amber 
                                                ? 'bg-amber-600 border-amber-600 text-white scale-100' 
                                                : 'border-slate-300 bg-white text-transparent group-hover:border-slate-400'
                                        }`}>
                                            <Check className="h-3 w-3 stroke-[3]" />
                                        </div>
                                        <div className="flex items-center justify-between w-full">
                                            <div className="flex items-center gap-2">
                                                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 border border-white shrink-0 shadow-sm" />
                                                <span className={`text-xs font-extrabold transition-colors ${filter_amber ? 'text-amber-950 font-black' : 'text-slate-700 font-bold'}`}>Pendiente</span>
                                            </div>
                                            <span className="text-[10px] text-slate-400 font-bold">&gt;1 hora sin actualizar</span>
                                        </div>
                                    </label>

                                    {/* Crítico */}
                                    <label className={`group flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all border select-none ${
                                        filter_red 
                                            ? 'bg-red-50/40 border-red-200 text-red-950 shadow-[0_3px_10px_-2px_rgba(239,68,68,0.08)]' 
                                            : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50 hover:border-slate-200'
                                    }`}>
                                        <input
                                            type="checkbox"
                                            checked={filter_red}
                                            onChange={(e) => setFilter_red(e.target.checked)}
                                            className="sr-only"
                                        />
                                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                                            filter_red 
                                                ? 'bg-red-600 border-red-600 text-white scale-100' 
                                                : 'border-slate-300 bg-white text-transparent group-hover:border-slate-400'
                                        }`}>
                                            <Check className="h-3 w-3 stroke-[3]" />
                                        </div>
                                        <div className="flex items-center justify-between w-full">
                                            <div className="flex items-center gap-2">
                                                <span className="w-2.5 h-2.5 rounded-full bg-red-500 border border-white shrink-0 shadow-sm" />
                                                <span className={`text-xs font-extrabold transition-colors ${filter_red ? 'text-red-950 font-black' : 'text-slate-700 font-bold'}`}>Crítico</span>
                                            </div>
                                            <span className="text-[10px] text-slate-400 font-bold">&gt;24 horas</span>
                                        </div>
                                    </label>

                                    {/* Sin Datos / Desconectado */}
                                    <label className={`group flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all border select-none ${
                                        filter_gray 
                                            ? 'bg-slate-100 border-slate-300 text-slate-950 shadow-[0_3px_10px_-2px_rgba(100,116,139,0.08)]' 
                                            : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50 hover:border-slate-200'
                                    }`}>
                                        <input
                                            type="checkbox"
                                            checked={filter_gray}
                                            onChange={(e) => setFilter_gray(e.target.checked)}
                                            className="sr-only"
                                        />
                                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                                            filter_gray 
                                                ? 'bg-slate-700 border-slate-700 text-white scale-100' 
                                                : 'border-slate-300 bg-white text-transparent group-hover:border-slate-400'
                                        }`}>
                                            <Check className="h-3 w-3 stroke-[3]" />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="w-2.5 h-2.5 rounded-full bg-slate-400 border border-white shrink-0 shadow-sm" />
                                            <span className={`text-xs font-extrabold transition-colors ${filter_gray ? 'text-slate-950 font-black' : 'text-slate-700 font-bold'}`}>Sin Datos / Desconectado</span>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {/* Filter Section: Update Date Limit */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-3 bg-teal-500 rounded-full" />
                                    <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Antigüedad de Sincronización</h4>
                                </div>
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsDateLimitDropdownOpen(!isDateLimitDropdownOpen);
                                            setIsSortOrderDropdownOpen(false);
                                        }}
                                        className="flex items-center justify-between w-full px-4 py-3 bg-white border border-slate-200 hover:border-slate-300 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.02)] transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500/15"
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <Clock className="h-4 w-4 text-slate-400 shrink-0" />
                                            <span className="text-xs font-extrabold text-slate-700">
                                                {filterDateLimit === 'all' && 'Sincronizados en cualquier fecha (Todos)'}
                                                {filterDateLimit === '1h' && 'Sincronizado hace menos de 1 hora'}
                                                {filterDateLimit === '12h' && 'Sincronizado en las últimas 12 horas'}
                                                {filterDateLimit === '24h' && 'Sincronizado en las últimas 24 horas (Hoy)'}
                                                {filterDateLimit === '3d' && 'Sincronizado en los últimos 3 días'}
                                                {filterDateLimit === '7d' && 'Sincronizado en los últimos 7 días'}
                                            </span>
                                        </div>
                                        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-250 ${isDateLimitDropdownOpen ? 'rotate-180 text-teal-600' : ''}`} />
                                    </button>

                                    {isDateLimitDropdownOpen && (
                                        <>
                                            <div className="fixed inset-0 z-30" onClick={() => setIsDateLimitDropdownOpen(false)} />
                                            <div className="absolute left-0 right-0 bottom-full mb-2 bg-white border border-slate-100 rounded-2xl shadow-[0_-12px_30px_rgba(0,0,0,0.08)] z-40 overflow-hidden divide-y divide-slate-50 py-1 animate-in fade-in slide-in-from-bottom-2 duration-200">
                                                {[
                                                    { value: 'all', label: 'Sincronizados en cualquier fecha (Todos)' },
                                                    { value: '1h', label: 'Sincronizado hace menos de 1 hora' },
                                                    { value: '12h', label: 'Sincronizado en las últimas 12 horas' },
                                                    { value: '24h', label: 'Sincronizado en las últimas 24 horas (Hoy)' },
                                                    { value: '3d', label: 'Sincronizado en los últimos 3 días' },
                                                    { value: '7d', label: 'Sincronizado en los últimos 7 días' },
                                                ].map((option) => (
                                                    <button
                                                        key={option.value}
                                                        type="button"
                                                        onClick={() => {
                                                            setFilterDateLimit(option.value as any);
                                                            setIsDateLimitDropdownOpen(false);
                                                        }}
                                                        className={`flex items-center justify-between w-full px-4 py-3 text-left text-xs font-extrabold transition-all cursor-pointer ${
                                                            filterDateLimit === option.value
                                                                ? 'bg-teal-50/65 text-teal-950 font-black'
                                                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                                        }`}
                                                    >
                                                        <span>{option.label}</span>
                                                        {filterDateLimit === option.value && (
                                                            <Check className="h-3.5 w-3.5 text-teal-600 stroke-[3]" />
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Filter Section: Sorting */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-3 bg-teal-500 rounded-full" />
                                    <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Ordenamiento</h4>
                                </div>
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsSortOrderDropdownOpen(!isSortOrderDropdownOpen);
                                            setIsDateLimitDropdownOpen(false);
                                        }}
                                        className="flex items-center justify-between w-full px-4 py-3 bg-white border border-slate-200 hover:border-slate-300 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.02)] transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500/15"
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <Settings className="h-4 w-4 text-slate-400 shrink-0" />
                                            <span className="text-xs font-extrabold text-slate-700">
                                                {filterSortOrder === 'name_asc' && 'Nombre del Establecimiento (A-Z)'}
                                                {filterSortOrder === 'name_desc' && 'Nombre del Establecimiento (Z-A)'}
                                                {filterSortOrder === 'date_newest' && 'Sincronización más reciente primero'}
                                                {filterSortOrder === 'date_oldest' && 'Sincronización más antigua primero'}
                                                {filterSortOrder === 'expired_highest' && 'Mayor número de productos vencidos'}
                                            </span>
                                        </div>
                                        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-250 ${isSortOrderDropdownOpen ? 'rotate-180 text-teal-600' : ''}`} />
                                    </button>

                                    {isSortOrderDropdownOpen && (
                                        <>
                                            <div className="fixed inset-0 z-30" onClick={() => setIsSortOrderDropdownOpen(false)} />
                                            <div className="absolute left-0 right-0 bottom-full mb-2 bg-white border border-slate-100 rounded-2xl shadow-[0_-12px_30px_rgba(0,0,0,0.08)] z-40 overflow-hidden divide-y divide-slate-50 py-1 animate-in fade-in slide-in-from-bottom-2 duration-200">
                                                {[
                                                    { value: 'name_asc', label: 'Nombre del Establecimiento (A-Z)' },
                                                    { value: 'name_desc', label: 'Nombre del Establecimiento (Z-A)' },
                                                    { value: 'date_newest', label: 'Sincronización más reciente primero' },
                                                    { value: 'date_oldest', label: 'Sincronización más antigua primero' },
                                                    { value: 'expired_highest', label: 'Mayor número de productos vencidos' },
                                                ].map((option) => (
                                                    <button
                                                        key={option.value}
                                                        type="button"
                                                        onClick={() => {
                                                            setFilterSortOrder(option.value as any);
                                                            setIsSortOrderDropdownOpen(false);
                                                        }}
                                                        className={`flex items-center justify-between w-full px-4 py-3 text-left text-xs font-extrabold transition-all cursor-pointer ${
                                                            filterSortOrder === option.value
                                                                ? 'bg-teal-50/65 text-teal-950 font-black'
                                                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                                        }`}
                                                    >
                                                        <span>{option.label}</span>
                                                        {filterSortOrder === option.value && (
                                                            <Check className="h-3.5 w-3.5 text-teal-600 stroke-[3]" />
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Filter Section: Expirations */}
                            <div className="space-y-3 pb-8">
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-3 bg-teal-500 rounded-full" />
                                    <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Alertas y Vencimientos</h4>
                                </div>
                                <label className={`group flex items-center gap-3.5 p-3.5 rounded-2xl cursor-pointer transition-all border select-none ${
                                    filterHasPendingExpirations 
                                        ? 'bg-red-500 text-white border-red-500 shadow-[0_4px_15px_rgba(239,68,68,0.25)]' 
                                        : 'bg-white border-slate-100 hover:bg-slate-50 hover:border-red-200'
                                }`}>
                                    <input
                                        type="checkbox"
                                        checked={filterHasPendingExpirations}
                                        onChange={(e) => setFilterHasPendingExpirations(e.target.checked)}
                                        className="sr-only"
                                    />
                                    <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                                        filterHasPendingExpirations 
                                            ? 'bg-white text-red-600 border-white scale-100' 
                                            : 'border-slate-300 bg-white text-transparent group-hover:border-slate-400'
                                    }`}>
                                        <Check className="h-3 w-3 stroke-[3]" />
                                    </div>
                                    <div className="flex items-center gap-2.5">
                                        <AlertTriangle className={`h-4.5 w-4.5 shrink-0 ${filterHasPendingExpirations ? 'text-white' : 'text-red-500'}`} />
                                        <span className={`text-xs font-black leading-tight ${filterHasPendingExpirations ? 'text-white' : 'text-slate-700 group-hover:text-red-700'}`}>
                                            Mostrar sólo establecimientos con productos por vencer / vencidos
                                        </span>
                                    </div>
                                </label>
                            </div>
                        </div>

                        {/* Footer Buttons */}
                        <div className="px-6 py-5 border-t border-slate-100 bg-white/95 backdrop-blur-md flex items-center justify-between gap-3 sticky bottom-0 z-10 shrink-0 shadow-[0_-4px_15px_rgba(0,0,0,0.03)]">
                            <button
                                onClick={() => {
                                    setFilter_CS(true);
                                    setFilter_PS(true);
                                    setFilter_ALM(true);
                                    setFilter_HOSP(true);
                                    setFilter_OTRO(true);
                                    setFilter_emerald(true);
                                    setFilter_amber(true);
                                    setFilter_red(true);
                                    setFilter_gray(true);
                                    setFilterSortOrder('name_asc');
                                    setFilterHasPendingExpirations(false);
                                    setFilterDateLimit('all');
                                }}
                                className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 font-extrabold text-[11px] uppercase tracking-wider rounded-xl border border-slate-200 shadow-sm transition-all shrink-0 active:scale-95"
                            >
                                Reestablecer
                            </button>
                            <button
                                onClick={() => setIsAdvancedFiltersSidebarOpen(false)}
                                className="flex-1 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-black text-[11px] uppercase tracking-widest rounded-xl shadow-lg shadow-teal-600/15 hover:shadow-teal-600/25 transition-all text-center active:scale-95"
                            >
                                Aplicar ({filteredAndSortedSources.length} Est.)
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE OPCIONES DE EXPORTACIÓN (CENTRADITO) */}
            {isExportOptionsModalOpen && (
                <div className="fixed inset-0 z-[10005] flex items-center justify-center bg-black/45 backdrop-blur-xs animate-in fade-in duration-200 p-4">
                    {/* Backdrop Click Dismiss */}
                    <div className="absolute inset-0" onClick={() => setIsExportOptionsModalOpen(false)} />
                    
                    {/* Modal Card */}
                    <div className="relative w-full max-w-lg bg-slate-50 rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col border border-slate-200 overflow-hidden">
                        {/* Header */}
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white shadow-[0_2px_12px_rgba(0,0,0,0.03)] shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 bg-teal-50 rounded-2xl flex items-center justify-center text-teal-600 border border-teal-100 shadow-[0_4px_12px_rgba(13,148,136,0.08)]">
                                    <FileSpreadsheet className="h-5.5 w-5.5" />
                                </div>
                                <div>
                                    <h3 className="font-black text-slate-900 text-base tracking-tight uppercase">Opciones de Exportación</h3>
                                    <p className="text-[10px] text-teal-600 font-extrabold tracking-widest uppercase">
                                        Consolidado: {exportScope === 'single' && selectedUngetIndex !== null ? scriptUrls[selectedUngetIndex]?.name : 'TODAS LAS UNGETs (REGIONAL)'}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsExportOptionsModalOpen(false)}
                                className="p-2 hover:bg-slate-100 active:scale-95 rounded-xl transition-all text-slate-400 hover:text-slate-900 border border-slate-100 hover:border-slate-200 bg-white shadow-sm"
                            >
                                <X className="h-4.5 w-4.5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 space-y-6 overflow-y-auto max-h-[65vh]">
                            
                            {/* Section: Establishment Type */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between w-full">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-3 bg-teal-500 rounded-full" />
                                        <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Tipo de Establecimiento</h4>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[11px] font-bold">
                                        <button 
                                            type="button"
                                            onClick={() => { setExportCS(true); setExportPS(true); setExportALM(true); setExportHOSP(true); setExportOTRO(true); }}
                                            className="text-teal-600 hover:text-teal-700 font-black hover:underline cursor-pointer active:scale-95 transition-all"
                                        >
                                            Todos
                                        </button>
                                        <span className="text-slate-300 select-none">|</span>
                                        <button 
                                            type="button"
                                            onClick={() => { setExportCS(false); setExportPS(false); setExportALM(false); setExportHOSP(false); setExportOTRO(false); }}
                                            className="text-slate-500 hover:text-slate-700 hover:underline cursor-pointer active:scale-95 transition-all"
                                        >
                                            Ninguno
                                        </button>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-2.5">
                                    {/* C.S. */}
                                    <label className={`group flex items-center justify-between p-3.5 rounded-2xl cursor-pointer transition-all border select-none ${
                                        exportCS 
                                            ? 'bg-blue-50/40 border-blue-200 text-blue-900 shadow-[0_3px_10px_-2px_rgba(59,130,246,0.08)]' 
                                            : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50 hover:border-slate-200'
                                    }`}>
                                        <input
                                            type="checkbox"
                                            checked={exportCS}
                                            onChange={(e) => setExportCS(e.target.checked)}
                                            className="sr-only"
                                        />
                                        <span className={`text-xs font-extrabold transition-colors ${exportCS ? 'text-blue-950 font-black' : 'text-slate-700 font-bold'}`}>Centro de Salud (C.S.)</span>
                                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                                            exportCS 
                                                ? 'bg-blue-600 border-blue-600 text-white scale-100' 
                                                : 'border-slate-300 bg-white text-transparent group-hover:border-slate-400'
                                        }`}>
                                            <Check className="h-3 w-3 stroke-[3]" />
                                        </div>
                                    </label>
                                    
                                    {/* P.S. */}
                                    <label className={`group flex items-center justify-between p-3.5 rounded-2xl cursor-pointer transition-all border select-none ${
                                        exportPS 
                                            ? 'bg-amber-50/40 border-amber-200 text-amber-900 shadow-[0_3px_10px_-2px_rgba(245,158,11,0.08)]' 
                                            : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50 hover:border-slate-200'
                                    }`}>
                                        <input
                                            type="checkbox"
                                            checked={exportPS}
                                            onChange={(e) => setExportPS(e.target.checked)}
                                            className="sr-only"
                                        />
                                        <span className={`text-xs font-extrabold transition-colors ${exportPS ? 'text-amber-950 font-black' : 'text-slate-700 font-bold'}`}>Puesto de Salud (P.S.)</span>
                                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                                            exportPS 
                                                ? 'bg-amber-600 border-amber-600 text-white scale-100' 
                                                : 'border-slate-300 bg-white text-transparent group-hover:border-slate-400'
                                        }`}>
                                            <Check className="h-3 w-3 stroke-[3]" />
                                        </div>
                                    </label>

                                    {/* ALM */}
                                    <label className={`group flex items-center justify-between p-3.5 rounded-2xl cursor-pointer transition-all border select-none ${
                                        exportALM 
                                            ? 'bg-teal-50/40 border-teal-200 text-teal-900 shadow-[0_3px_10px_-2px_rgba(20,184,166,0.08)]' 
                                            : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50 hover:border-slate-200'
                                    }`}>
                                        <input
                                            type="checkbox"
                                            checked={exportALM}
                                            onChange={(e) => setExportALM(e.target.checked)}
                                            className="sr-only"
                                        />
                                        <span className={`text-xs font-extrabold transition-colors ${exportALM ? 'text-teal-950 font-black' : 'text-slate-700 font-bold'}`}>Almacén (ALM)</span>
                                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                                            exportALM 
                                                ? 'bg-teal-600 border-teal-600 text-white scale-100' 
                                                : 'border-slate-300 bg-white text-transparent group-hover:border-slate-400'
                                        }`}>
                                            <Check className="h-3 w-3 stroke-[3]" />
                                        </div>
                                    </label>

                                    {/* HOSP */}
                                    <label className={`group flex items-center justify-between p-3.5 rounded-2xl cursor-pointer transition-all border select-none ${
                                        exportHOSP 
                                            ? 'bg-red-50/40 border-red-200 text-red-900 shadow-[0_3px_10px_-2px_rgba(239,68,68,0.08)]' 
                                            : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50 hover:border-slate-200'
                                    }`}>
                                        <input
                                            type="checkbox"
                                            checked={exportHOSP}
                                            onChange={(e) => setExportHOSP(e.target.checked)}
                                            className="sr-only"
                                        />
                                        <span className={`text-xs font-extrabold transition-colors ${exportHOSP ? 'text-red-950 font-black' : 'text-slate-700 font-bold'}`}>Hospital (HOSP)</span>
                                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                                            exportHOSP 
                                                ? 'bg-red-600 border-red-600 text-white scale-100' 
                                                : 'border-slate-300 bg-white text-transparent group-hover:border-slate-400'
                                        }`}>
                                            <Check className="h-3 w-3 stroke-[3]" />
                                        </div>
                                    </label>

                                    {/* OTRO */}
                                    <label className={`group flex items-center justify-between p-3.5 rounded-2xl cursor-pointer col-span-2 transition-all border select-none ${
                                        exportOTRO 
                                            ? 'bg-slate-100 border-slate-300 text-slate-900 shadow-[0_3px_10px_-2px_rgba(100,116,139,0.08)]' 
                                            : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50 hover:border-slate-200'
                                    }`}>
                                        <input
                                            type="checkbox"
                                            checked={exportOTRO}
                                            onChange={(e) => setExportOTRO(e.target.checked)}
                                            className="sr-only"
                                        />
                                        <span className={`text-xs font-extrabold transition-colors ${exportOTRO ? 'text-slate-950 font-black' : 'text-slate-700 font-bold'}`}>Otros / Sin Clasificar</span>
                                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                                            exportOTRO 
                                                ? 'bg-slate-700 border-slate-700 text-white scale-100' 
                                                : 'border-slate-300 bg-white text-transparent group-hover:border-slate-400'
                                        }`}>
                                            <Check className="h-3 w-3 stroke-[3]" />
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {/* Section: Status Update (Color) */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between w-full">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-3 bg-teal-500 rounded-full" />
                                        <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Estado de Actualización</h4>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[11px] font-bold">
                                        <button 
                                            type="button"
                                            onClick={() => { setExportEmerald(true); setExportAmber(true); setExportRed(true); setExportGray(true); }}
                                            className="text-teal-600 hover:text-teal-700 font-black hover:underline cursor-pointer active:scale-95 transition-all"
                                        >
                                            Todos
                                        </button>
                                        <span className="text-slate-300 select-none">|</span>
                                        <button 
                                            type="button"
                                            onClick={() => { setExportEmerald(false); setExportAmber(false); setExportRed(false); setExportGray(false); }}
                                            className="text-slate-500 hover:text-slate-700 hover:underline cursor-pointer active:scale-95 transition-all"
                                        >
                                            Ninguno
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2.5">
                                    {/* Emerald */}
                                    <label className={`group flex items-center justify-between p-3.5 rounded-2xl cursor-pointer transition-all border select-none ${
                                        exportEmerald 
                                            ? 'bg-emerald-50/40 border-emerald-200 text-emerald-950 shadow-[0_3px_10px_-2px_rgba(16,185,129,0.08)]' 
                                            : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50 hover:border-slate-200'
                                    }`}>
                                        <input
                                            type="checkbox"
                                            checked={exportEmerald}
                                            onChange={(e) => setExportEmerald(e.target.checked)}
                                            className="sr-only"
                                        />
                                        <div className="flex items-center gap-2 font-extrabold text-xs">
                                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                                            <span className={exportEmerald ? 'text-emerald-950 font-black' : 'text-slate-700 font-bold'}>Al día (&lt;1h)</span>
                                        </div>
                                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                                            exportEmerald 
                                                ? 'bg-emerald-600 border-emerald-600 text-white scale-100' 
                                                : 'border-slate-300 bg-white text-transparent group-hover:border-slate-400'
                                        }`}>
                                            <Check className="h-3 w-3 stroke-[3]" />
                                        </div>
                                    </label>

                                    {/* Amber */}
                                    <label className={`group flex items-center justify-between p-3.5 rounded-2xl cursor-pointer transition-all border select-none ${
                                        exportAmber 
                                            ? 'bg-amber-50/40 border-amber-200 text-amber-950 shadow-[0_3px_10px_-2px_rgba(245,158,11,0.08)]' 
                                            : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50 hover:border-slate-200'
                                    }`}>
                                        <input
                                            type="checkbox"
                                            checked={exportAmber}
                                            onChange={(e) => setExportAmber(e.target.checked)}
                                            className="sr-only"
                                        />
                                        <div className="flex items-center gap-2 font-extrabold text-xs">
                                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                                            <span className={exportAmber ? 'text-amber-950 font-black' : 'text-slate-700 font-bold'}>Pendiente (&gt;1h)</span>
                                        </div>
                                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                                            exportAmber 
                                                ? 'bg-amber-600 border-amber-600 text-white scale-100' 
                                                : 'border-slate-300 bg-white text-transparent group-hover:border-slate-400'
                                        }`}>
                                            <Check className="h-3 w-3 stroke-[3]" />
                                        </div>
                                    </label>

                                    {/* Red */}
                                    <label className={`group flex items-center justify-between p-3.5 rounded-2xl cursor-pointer transition-all border select-none ${
                                        exportRed 
                                            ? 'bg-red-50/40 border-red-200 text-red-950 shadow-[0_3px_10px_-2px_rgba(239,68,68,0.08)]' 
                                            : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50 hover:border-slate-200'
                                    }`}>
                                        <input
                                            type="checkbox"
                                            checked={exportRed}
                                            onChange={(e) => setExportRed(e.target.checked)}
                                            className="sr-only"
                                        />
                                        <div className="flex items-center gap-2 font-extrabold text-xs">
                                            <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
                                            <span className={exportRed ? 'text-red-950 font-black' : 'text-slate-700 font-bold'}>Crítico (&gt;24h)</span>
                                        </div>
                                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                                            exportRed 
                                                ? 'bg-red-600 border-red-600 text-white scale-100' 
                                                : 'border-slate-300 bg-white text-transparent group-hover:border-slate-400'
                                        }`}>
                                            <Check className="h-3 w-3 stroke-[3]" />
                                        </div>
                                    </label>

                                    {/* Gray */}
                                    <label className={`group flex items-center justify-between p-3.5 rounded-2xl cursor-pointer transition-all border select-none ${
                                        exportGray 
                                            ? 'bg-slate-100 border-slate-300 text-slate-900 shadow-[0_3px_10px_-2px_rgba(100,116,139,0.08)]' 
                                            : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50 hover:border-slate-200'
                                    }`}>
                                        <input
                                            type="checkbox"
                                            checked={exportGray}
                                            onChange={(e) => setExportGray(e.target.checked)}
                                            className="sr-only"
                                        />
                                        <div className="flex items-center gap-2 font-extrabold text-xs">
                                            <span className="w-2.5 h-2.5 rounded-full bg-slate-400 shrink-0" />
                                            <span className={exportGray ? 'text-slate-950 font-black' : 'text-slate-700 font-bold'}>Sin Datos</span>
                                        </div>
                                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                                            exportGray 
                                                ? 'bg-slate-700 border-slate-700 text-white scale-100' 
                                                : 'border-slate-300 bg-white text-transparent group-hover:border-slate-400'
                                        }`}>
                                            <Check className="h-3 w-3 stroke-[3]" />
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {/* Section: Update Date Limit */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-3 bg-teal-500 rounded-full" />
                                    <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Antigüedad de Sincronización</h4>
                                </div>
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsExportDateLimitDropdownOpen(!isExportDateLimitDropdownOpen);
                                        }}
                                        className="flex items-center justify-between w-full px-4 py-3 bg-white border border-slate-200 hover:border-slate-300 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.02)] transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500/15"
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <Clock className="h-4 w-4 text-slate-400 shrink-0" />
                                            <span className="text-xs font-extrabold text-slate-700">
                                                {exportDateLimit === 'all' && 'Sincronizados en cualquier fecha (Todos)'}
                                                {exportDateLimit === '1h' && 'Sincronizado hace menos de 1 hora'}
                                                {exportDateLimit === '12h' && 'Sincronizado en las últimas 12 horas'}
                                                {exportDateLimit === '24h' && 'Sincronizado en las últimas 24 horas (Hoy)'}
                                                {exportDateLimit === '3d' && 'Sincronizado en los últimos 3 días'}
                                                {exportDateLimit === '7d' && 'Sincronizado en los últimos 7 días'}
                                            </span>
                                        </div>
                                        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-250 ${isExportDateLimitDropdownOpen ? 'rotate-180 text-teal-600' : ''}`} />
                                    </button>

                                    {isExportDateLimitDropdownOpen && (
                                        <>
                                            <div className="fixed inset-0 z-30" onClick={() => setIsExportDateLimitDropdownOpen(false)} />
                                            <div className="absolute left-0 right-0 bottom-full mb-2 bg-white border border-slate-100 rounded-2xl shadow-[0_-12px_30px_rgba(0,0,0,0.08)] z-40 overflow-hidden divide-y divide-slate-50 py-1 animate-in fade-in slide-in-from-bottom-2 duration-200">
                                                {[
                                                    { value: 'all', label: 'Sincronizados en cualquier fecha (Todos)' },
                                                    { value: '1h', label: 'Sincronizado hace menos de 1 hora' },
                                                    { value: '12h', label: 'Sincronizado en las últimas 12 horas' },
                                                    { value: '24h', label: 'Sincronizado en las últimas 24 horas (Hoy)' },
                                                    { value: '3d', label: 'Sincronizado en los últimos 3 días' },
                                                    { value: '7d', label: 'Sincronizado en los últimos 7 días' },
                                                ].map((option) => (
                                                    <button
                                                        key={option.value}
                                                        type="button"
                                                        onClick={() => {
                                                            setExportDateLimit(option.value as any);
                                                            setIsExportDateLimitDropdownOpen(false);
                                                        }}
                                                        className={`flex items-center justify-between w-full px-4 py-3 text-left text-xs font-extrabold transition-all cursor-pointer ${
                                                            exportDateLimit === option.value
                                                                ? 'bg-teal-50/65 text-teal-950 font-black'
                                                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                                        }`}
                                                    >
                                                        <span>{option.label}</span>
                                                        {exportDateLimit === option.value && (
                                                            <Check className="h-3.5 w-3.5 text-teal-600 stroke-[3]" />
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Section: Expirations filter */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-3 bg-teal-500 rounded-full" />
                                    <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Medicamentos y Filtros adicionales</h4>
                                </div>
                                <label className={`group flex items-center justify-between p-3.5 rounded-2xl cursor-pointer transition-all border select-none ${
                                    exportHasPendingExpirations 
                                        ? 'bg-red-500 text-white border-red-500 shadow-[0_4px_15px_rgba(239,68,68,0.25)]' 
                                        : 'bg-white border-slate-100 hover:bg-slate-50 hover:border-red-200'
                                }`}>
                                    <input
                                        type="checkbox"
                                        checked={exportHasPendingExpirations}
                                        onChange={(e) => setExportHasPendingExpirations(e.target.checked)}
                                        className="sr-only"
                                    />
                                    <div className="flex items-center gap-3.5">
                                        <AlertTriangle className={`h-4.5 w-4.5 shrink-0 ${exportHasPendingExpirations ? 'text-white' : 'text-red-500 animate-pulse'}`} />
                                        <span className={`text-xs font-black leading-tight ${exportHasPendingExpirations ? 'text-white' : 'text-slate-700 group-hover:text-red-700'}`}>
                                            Exportar únicamente medicamentos vencidos o por vencer
                                        </span>
                                    </div>
                                    <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                                        exportHasPendingExpirations 
                                            ? 'bg-white text-red-600 border-white scale-100' 
                                            : 'border-slate-300 bg-white text-transparent group-hover:border-slate-400'
                                    }`}>
                                        <Check className="h-3 w-3 stroke-[3]" />
                                    </div>
                                </label>
                            </div>
                        </div>

                        {/* Footer Details & Buttons */}
                        <div className="px-6 py-5 border-t border-slate-100 bg-white/95 backdrop-blur-md flex flex-col sm:flex-row items-center sm:justify-between gap-4 sticky bottom-0 z-10 shrink-0 shadow-[0_-4px_15px_rgba(0,0,0,0.03)]">
                            <div className="text-center sm:text-left">
                                <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest leading-none">Total Seleccionado</p>
                                <p className="text-sm font-black text-teal-950 mt-1">
                                    {filteredExportSourcesCount} {filteredExportSourcesCount === 1 ? 'establecimiento' : 'establecimientos'}
                                </p>
                            </div>

                            <div className="w-full sm:w-auto">
                                <button
                                    onClick={executeExportAllEstablishmentsToExcel}
                                    disabled={filteredExportSourcesCount === 0}
                                    className={`w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 text-white font-black text-[11px] uppercase tracking-widest rounded-xl shadow-lg transition-all active:scale-95 cursor-pointer ${
                                        filteredExportSourcesCount === 0 
                                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none border border-slate-200' 
                                        : 'bg-teal-600 hover:bg-teal-700 shadow-teal-600/15 hover:shadow-teal-600/25 border border-teal-600/10'
                                    }`}
                                    type="button"
                                >
                                    <Download className="h-4.5 w-4.5 shrink-0" />
                                    <span>Exportar Excel</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
