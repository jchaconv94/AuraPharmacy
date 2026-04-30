import React, { useState, useEffect, useMemo } from 'react';
import { Search, Database, RefreshCw, AlertCircle, Link as LinkIcon, FileSpreadsheet, Settings, Save, Check, Copy, X, Plus, Trash2, Building2, ChevronRight, ChevronLeft, MapPin, Clock, AlertTriangle } from 'lucide-react';
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
    
    // Navigation hierarchy
    const [viewLevel, setViewLevel] = useState<'ungets' | 'sheets' | 'data'>('ungets');
    const [selectedUngetIndex, setSelectedUngetIndex] = useState<number | null>(null);
    const [selectedSourceId, setSelectedSourceId] = useState<string>(''); 
    
    // Modal & Config
    const [isConfigOpen, setIsConfigOpen] = useState(false);
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

    return (
        <div className="flex flex-col h-full bg-gray-50/50 p-4 2xl:p-6 pb-20 max-w-7xl mx-auto w-full">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-6 gap-4 border-b border-gray-200 pb-4">
                <div>
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                        <Database className="h-6 w-6 text-teal-600" />
                        Consulta Stock
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                        Consulte medicamentos e insumos directamente desde el registro consolidado (Apps Script).
                    </p>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <button 
                        onClick={() => {
                            setTempUrls([...scriptUrls]);
                            setIsConfigOpen(!isConfigOpen);
                        }}
                        className="flex-1 sm:flex-none border border-gray-300 bg-white text-gray-700 px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                    >
                        <Settings className="h-4 w-4 text-gray-500" />
                        Configurar Conexión
                    </button>
                    <button 
                        id="sync-btn"
                        onClick={() => fetchData()} disabled={isLoading || isSilentSyncing}
                        className="flex-1 sm:flex-none bg-teal-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-teal-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                    >
                        <RefreshCw className={`h-4 w-4 ${isLoading || isSilentSyncing ? 'animate-spin' : ''}`} />
                        {isLoading || isSilentSyncing ? 'Sincronizando...' : 'Sincronizar'}
                    </button>
                </div>
            </div>

            {isConfigOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
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
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2 mb-6">
                    <AlertCircle className="h-5 w-5 shrink-0" />
                    <span className="text-sm">{error}</span>
                </div>
            )}

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm flex-1 flex flex-col min-h-[600px] overflow-hidden">
                {/* BREADCRUMBS & SEARCH */}
                <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex flex-col gap-4">
                    {/* BREADCRUMBS */}
                    <nav className="flex flex-wrap items-center gap-2 text-sm font-medium">
                        <button 
                            onClick={() => { setViewLevel('ungets'); setSelectedUngetIndex(null); setSelectedSourceId(''); }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${viewLevel === 'ungets' ? 'bg-teal-100 text-teal-800' : 'text-gray-500 hover:bg-gray-100'}`}
                        >
                            <Building2 className="h-4 w-4" />
                            UNGETs
                        </button>
                        
                        {selectedUngetIndex !== null && (
                            <>
                                <ChevronRight className="h-4 w-4 text-gray-300" />
                                <button 
                                    onClick={() => { setViewLevel('sheets'); setSelectedSourceId(''); }}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${viewLevel === 'sheets' ? 'bg-teal-100 text-teal-800' : 'text-gray-500 hover:bg-gray-100'}`}
                                >
                                    <MapPin className="h-4 w-4" />
                                    {scriptUrls[selectedUngetIndex]?.name || 'Documento'}
                                </button>
                            </>
                        )}

                        {selectedSourceId && (
                            <>
                                <ChevronRight className="h-4 w-4 text-gray-300" />
                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-100 text-teal-800">
                                    <FileSpreadsheet className="h-4 w-4" />
                                    {(() => {
                                        const name = sources.find(s => s.id === selectedSourceId)?.name || 'Hoja';
                                        const lastDash = name.lastIndexOf('-');
                                        if (lastDash === -1) return name.replace(/^FARM\s*-\s*/i, '');
                                        const desc = name.substring(0, lastDash).trim().replace(/^FARM\s*-\s*/i, '');
                                        const code = name.substring(lastDash + 1).trim();
                                        return `${desc} (${code})`;
                                    })()}
                                </div>
                            </>
                        )}
                    </nav>

                    {/* ACTIONS (Search & Filters) */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        {/* Search */}
                        <div className="w-full sm:max-w-md">
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
                        </div>

                        {/* Alerts and count */}
                        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto shrink-0 justify-start sm:justify-end">
                            {viewLevel === 'data' && (
                                <>
                                    {activeSheetExpirationInfo.expiredCount > 0 && (
                                        <button 
                                            onClick={() => { setExpirationModalType('expired'); setIsExpirationModalOpen(true); }}
                                            className="flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-700 px-3 py-2 rounded-xl border border-red-200 shadow-sm text-xs font-bold transition-colors"
                                            title="Ver productos vencidos"
                                        >
                                            <AlertTriangle className="h-4 w-4" />
                                            <span className="hidden sm:inline">{activeSheetExpirationInfo.expiredCount} vencido{activeSheetExpirationInfo.expiredCount !== 1 ? 's' : ''}</span>
                                            <span className="sm:hidden">{activeSheetExpirationInfo.expiredCount}</span>
                                        </button>
                                    )}
                                    {activeSheetExpirationInfo.expiringThisMonthCount > 0 && (
                                        <button 
                                            onClick={() => { setExpirationModalType('expiring'); setIsExpirationModalOpen(true); }}
                                            className="flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 px-3 py-2 rounded-xl border border-amber-200 shadow-sm text-xs font-bold transition-colors"
                                            title="Ver productos por vencer este mes"
                                        >
                                            <Clock className="h-4 w-4" />
                                            <span className="hidden sm:inline">{activeSheetExpirationInfo.expiringThisMonthCount} por vencer</span>
                                            <span className="sm:hidden">{activeSheetExpirationInfo.expiringThisMonthCount}</span>
                                        </button>
                                    )}
                                </>
                            )}
                            <div className="text-xs text-gray-500 bg-white px-4 py-2 rounded-xl border border-gray-200 shadow-sm font-medium">
                                {viewLevel === 'ungets' ? `${scriptUrls.length} UNGETs` : 
                                 viewLevel === 'sheets' ? `${sources.filter(s => s.urlIndex === selectedUngetIndex).length} Hojas` : 
                                 `${filteredData.length} productos`}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-auto p-4 md:p-6 bg-gray-50/30">
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
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in fade-in zoom-in-95 duration-300">
                                    {scriptUrls.length > 0 ? scriptUrls.map((config, idx) => (
                                        <div
                                            key={idx}
                                            onClick={() => handleSelectUnget(idx)}
                                            className="group bg-white border border-gray-200 p-6 rounded-2xl shadow-sm hover:shadow-md hover:border-teal-500 transition-all text-left flex flex-col h-full cursor-pointer relative overflow-hidden"
                                        >
                                            {/* Botones de acción rápidos */}
                                            <div className="absolute top-4 right-4 flex items-center gap-2 opacity-100 sm:opacity-40 group-hover:opacity-100 transition-opacity z-10">
                                                <button 
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        handleDirectEdit(idx, e);
                                                    }}
                                                    className="p-2 bg-white/90 backdrop-blur-sm shadow-sm border border-gray-100 rounded-lg text-gray-500 hover:text-blue-600 hover:border-blue-200 transition-all"
                                                    title="Editar conexión"
                                                >
                                                    <Settings className="h-4 w-4" />
                                                </button>
                                                <button 
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        handleDirectDelete(idx, e);
                                                    }}
                                                    className="p-2 bg-white/90 backdrop-blur-sm shadow-sm border border-gray-100 rounded-lg text-gray-500 hover:text-red-600 hover:border-red-200 transition-all"
                                                    title="Eliminar conexión"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>

                                            <div className="w-12 h-12 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center mb-4 group-hover:bg-teal-600 group-hover:text-white transition-colors">
                                                <Building2 className="h-6 w-6" />
                                            </div>
                                            <h3 className="text-lg font-black text-gray-900 mb-2 group-hover:text-teal-700 transition-colors uppercase tracking-tight">{config.name}</h3>
                                            <div className="flex items-center gap-2 text-xs text-gray-400 mt-auto">
                                                <LinkIcon className="h-3 w-3" />
                                                <span className="truncate max-w-[150px]">{config.url}</span>
                                            </div>
                                            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-50">
                                                <span className="text-xs font-bold text-gray-500">
                                                    {sources.filter(s => s.urlIndex === idx).length} Hojas
                                                </span>
                                                <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-teal-500 group-hover:translate-x-1 transition-all" />
                                            </div>
                                        </div>
                                    )) : (
                                        <div className="col-span-full py-20 text-center">
                                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                                <Settings className="h-8 w-8 text-gray-400" />
                                            </div>
                                            <h3 className="text-xl font-bold text-gray-800">No hay UNGETs configuradas</h3>
                                            <p className="text-gray-500 mt-2">Haga clic en 'Configurar Conexión' para comenzar.</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* LEVEL 2: SHEET CARDS */}
                            {viewLevel === 'sheets' && (
                                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                                    <div className="flex items-center justify-between mb-6">
                                        <h3 className="text-lg font-black text-gray-900 uppercase">Seleccione una Hoja de Cálculo</h3>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                                        {sources.filter(s => s.urlIndex === selectedUngetIndex).map((sheet) => {
                                            const sheetData = data.filter(r => r.sourceId === sheet.id);
                                            const { expiredCount, expiringThisMonthCount } = getExpirationStats(sheetData);

                                            return (
                                            <button
                                                key={sheet.id}
                                                onClick={() => handleSelectSheet(sheet.id)}
                                                className="group relative bg-white border border-gray-200 p-6 rounded-2xl shadow-sm hover:shadow-md hover:border-teal-500 transition-all text-left flex flex-col h-full"
                                            >
                                                <div className="absolute top-4 right-4 flex flex-col gap-2 items-end z-10">
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
                                                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors relative">
                                                    <FileSpreadsheet className="h-6 w-6" />
                                                    <div 
                                                        className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${getUpdateStatus(sheet.lastUpdateTime).color}`}
                                                        title={getUpdateStatus(sheet.lastUpdateTime).label}
                                                    />
                                                </div>
                                                <div className="flex-1 mb-4">
                                                    {(() => {
                                                        const lastDash = sheet.name.lastIndexOf('-');
                                                        if (lastDash === -1) {
                                                            const cleanName = sheet.name.replace(/^FARM\s*-\s*/i, '');
                                                            return (
                                                                <>
                                                                    <h3 className="text-lg font-black text-gray-900 leading-tight mb-1" title={cleanName}>{cleanName}</h3>
                                                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Establecimiento</p>
                                                                </>
                                                            );
                                                        }
                                                        const description = sheet.name.substring(0, lastDash).trim().replace(/^FARM\s*-\s*/i, '');
                                                        const code = sheet.name.substring(lastDash + 1).trim();
                                                        return (
                                                            <>
                                                                <p className="text-xs font-bold text-teal-600 mb-0.5">{code}</p>
                                                                <h3 className="text-lg font-black text-gray-900 leading-tight mb-1" title={description}>{description}</h3>
                                                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Establecimiento</p>
                                                            </>
                                                        );
                                                    })()}
                                                    
                                                    {sheet.lastUpdateTime && (
                                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500 mt-2">
                                                            <RefreshCw className="h-3 w-3" />
                                                            <span>Act: {formatFullDate(sheet.lastUpdateTime)}</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-50">
                                                    <span className="text-[10px] font-black text-teal-600 uppercase">Consultar Stock</span>
                                                    <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-teal-500 group-hover:translate-x-1 transition-all" />
                                                </div>
                                            </button>
                                        );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* LEVEL 3: DATA TABLE */}
                            {viewLevel === 'data' && (
                                <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 -mx-4 md:-mx-6 -mt-4 md:-mt-6">
                                    <div className="bg-white border-t border-gray-100 max-h-[600px] overflow-y-auto custom-scrollbar">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50/80 sticky top-0 z-10 backdrop-blur-sm">
                                                <tr>
                                                    <th scope="col" className="px-4 py-3 text-left text-xs font-black text-gray-500 uppercase tracking-wider whitespace-nowrap">ID / Código SIG</th>
                                                    <th scope="col" className="px-4 py-3 text-left text-xs font-black text-gray-500 uppercase tracking-wider min-w-[250px]">Descripción del Producto</th>
                                                    <th scope="col" className="px-4 py-3 text-right text-xs font-black text-gray-500 uppercase tracking-wider whitespace-nowrap">Saldo</th>
                                                    <th scope="col" className="px-4 py-3 text-left text-xs font-black text-gray-500 uppercase tracking-wider whitespace-nowrap">Lote / Venc.</th>
                                                    <th scope="col" className="px-4 py-3 text-left text-xs font-black text-gray-500 uppercase tracking-wider whitespace-nowrap">Tipo Sum.</th>
                                                    <th scope="col" className="px-4 py-3 text-left text-xs font-black text-gray-500 uppercase tracking-wider whitespace-nowrap">F. Finan.</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-100">
                                                {filteredData.length > 0 ? filteredData.map((row, i) => (
                                                    <tr 
                                                        key={i} 
                                                        onClick={() => setSelectedRecord(row)}
                                                        className="hover:bg-teal-50/50 transition-colors cursor-pointer group"
                                                    >
                                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 font-mono group-hover:text-teal-700">
                                                            <div className="font-bold">{row.ID_Producto || '-'}</div>
                                                            <div className="text-[10px] text-gray-400 mt-0.5">{row.CODIGO_SIG || '-'}</div>
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                                                            {row.Nombre || '-'}
                                                            <div className="text-[10px] text-gray-400 font-normal mt-0.5 max-w-sm truncate" title={row.Reg_Sanitario}>
                                                                RS: {row.Reg_Sanitario || 'S/N'}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-bold text-gray-900">
                                                            {(!isNaN(parseInt(String(row.Saldo), 10))) ? parseInt(String(row.Saldo), 10) : 0}
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                                            <span className="font-mono text-gray-700">{row.Lote || '-'}</span>
                                                            <div className="text-[10px] mt-0.5">Vence: {formatDate(row.Fec_Vencim) || '-'}</div>
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 uppercase" title={row.DESC_TIPSUM}>
                                                                {row.TIPSUM || '-'}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100 uppercase" title={row.DESC_FFINAN}>
                                                                {row.FFINAN || '-'}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                )) : (
                                                    <tr>
                                                        <td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-500">
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
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSelectedRecord(null)}>
                    <div 
                        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="p-4 sm:p-6 border-b border-gray-100 flex justify-between items-start bg-gray-50/50">
                            <div>
                                <h3 className="text-xl font-black text-gray-900 pr-8 leading-tight">
                                    {selectedRecord.Nombre || 'Sin Descripción'}
                                </h3>
                                <div className="flex items-center gap-2 mt-2">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-teal-100 text-teal-800">
                                        {selectedRecord.ID_Producto || 'S/ID'}
                                    </span>
                                    <span className="text-xs text-gray-500 font-mono">
                                        SIG: {selectedRecord.CODIGO_SIG || '-'}
                                    </span>
                                </div>
                            </div>
                            <button 
                                onClick={() => setSelectedRecord(null)}
                                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-xl transition-colors shrink-0"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        
                        <div className="p-4 sm:p-6 overflow-y-auto max-h-[70vh]">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                                <section>
                                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3 pb-1 border-b border-gray-100">Ubicación y Estado</h4>
                                    <div className="space-y-3">
                                        <div>
                                            <p className="text-[10px] text-gray-500 uppercase font-bold">Establecimiento / Almacén</p>
                                            <p className="text-sm font-medium text-gray-900">{(selectedRecord.DESC_ALM || '-').replace(/^FARM\s*-\s*/i, '')} <span className="text-gray-400 text-xs">({selectedRecord.ALMCOD || '-'})</span></p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-gray-500 uppercase font-bold">Saldo Actual</p>
                                            <p className="text-lg font-black text-teal-600">{(!isNaN(parseInt(String(selectedRecord.Saldo), 10))) ? parseInt(String(selectedRecord.Saldo), 10) : 0}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-gray-500 uppercase font-bold">Última Actualización</p>
                                            <p className="text-sm text-gray-700">{formatDate(selectedRecord.Ultima_Actualizacion) || '-'}</p>
                                        </div>
                                    </div>
                                </section>
                                
                                <section>
                                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3 pb-1 border-b border-gray-100">Datos Lote / Vencimiento</h4>
                                    <div className="space-y-3">
                                        <div>
                                            <p className="text-[10px] text-gray-500 uppercase font-bold">Lote</p>
                                            <p className="text-sm font-mono text-gray-900 bg-gray-100 px-2 py-1 rounded inline-block">{selectedRecord.Lote || '-'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-gray-500 uppercase font-bold">Fecha de Vencimiento</p>
                                            <p className="text-sm font-medium text-gray-900">{formatDate(selectedRecord.Fec_Vencim) || '-'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-gray-500 uppercase font-bold">Registro Sanitario</p>
                                            <p className="text-sm text-gray-700 uppercase">{selectedRecord.Reg_Sanitario || '-'}</p>
                                        </div>
                                    </div>
                                </section>

                                <section className="sm:col-span-2 pt-2">
                                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3 pb-1 border-b border-gray-100">Clasificación y Financiamiento</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-[10px] text-gray-500 uppercase font-bold">Tipo de Suministro</p>
                                            <p className="text-sm font-medium text-gray-700">{selectedRecord.DESC_TIPSUM || '-'} <span className="text-gray-400 text-xs">({selectedRecord.TIPSUM || '-'})</span></p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-gray-500 uppercase font-bold">Fuente de Financiamiento</p>
                                            <p className="text-sm font-medium text-gray-700">{selectedRecord.DESC_FFINAN || '-'} <span className="text-gray-400 text-xs">({selectedRecord.FFINAN || '-'})</span></p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-gray-500 uppercase font-bold">Precio Unitario (Detalle)</p>
                                            <p className="text-sm font-medium text-gray-900 bg-gray-50 border border-gray-100 rounded px-2 py-1 inline-block">S/ {selectedRecord.Precio_Det || '-'}</p>
                                        </div>
                                         <div>
                                            <p className="text-[10px] text-gray-500 uppercase font-bold">Precio (Cabecera)</p>
                                            <p className="text-sm font-medium text-gray-500">S/ {selectedRecord.Precio_Cab || '-'}</p>
                                        </div>
                                    </div>
                                </section>
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
                            <button 
                                onClick={() => setSelectedRecord(null)}
                                className="bg-white border border-gray-300 text-gray-700 px-5 py-2 rounded-xl text-sm font-bold hover:bg-gray-50 transition-colors"
                            >
                                Cerrar Detalle
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Expiración */}
            {isExpirationModalOpen && expirationModalType && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsExpirationModalOpen(false)}>
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
                                        <th scope="col" className="px-4 py-3 text-left text-xs font-black text-gray-500 uppercase tracking-wider whitespace-nowrap">ID / Código SIG</th>
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
        </div>
    );
};
