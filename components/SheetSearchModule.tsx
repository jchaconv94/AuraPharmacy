import React, { useState, useEffect, useMemo } from 'react';
import { Search, Database, RefreshCw, AlertCircle, Link as LinkIcon, FileSpreadsheet, Settings, Save, Check, Copy, X, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

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
}

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

export const SheetSearchModule: React.FC = () => {
    const { user } = useAuth();

    // Configuración
    const [scriptUrls, setScriptUrls] = useState<string[]>([]);
    const [sources, setSources] = useState<SheetSource[]>([]);
    const [data, setData] = useState<SIGData[]>([]);
    
    // UI states
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSourceId, setSelectedSourceId] = useState<string>(''); // '' means All
    
    // Modal & Config
    const [isConfigOpen, setIsConfigOpen] = useState(false);
    const [tempUrls, setTempUrls] = useState<string[]>([]);
    const [newUrlInput, setNewUrlInput] = useState('');
    const [copied, setCopied] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState<SIGData | null>(null);

    const [maxUrlsAllowed, setMaxUrlsAllowed] = useState<number | undefined>();

    useEffect(() => {
        if (!user || !isConfigOpen) return;
        import('../services/api').then(module => {
            module.api.getRolesConfig().then(roles => {
                const currentRoleConfig = roles.find(r => r.role === user.role);
                if (currentRoleConfig) setMaxUrlsAllowed(currentRoleConfig.maxUrlsAllowed);
            });
        });
    }, [user, isConfigOpen]);

    // Initial load from local storage based on user
    useEffect(() => {
        if (!user) return;
        try {
            const savedUrls = localStorage.getItem(`aura_sig_urls_${user.username}`);
            if (savedUrls) {
                const parsed = JSON.parse(savedUrls);
                if (Array.isArray(parsed)) setScriptUrls(parsed);
            }
            
            const savedSources = localStorage.getItem(`aura_sig_sources_${user.username}`);
            if (savedSources) {
                const parsed = JSON.parse(savedSources);
                if (Array.isArray(parsed)) setSources(parsed);
            }

            const savedData = localStorage.getItem(`aura_sig_data_${user.username}`);
            if (savedData) {
                const parsed = JSON.parse(savedData);
                if (Array.isArray(parsed)) setData(parsed);
            }
        } catch(e) {}
    }, [user]);

    // Save to local storage when state changes
    useEffect(() => {
        if (!user) return;
        localStorage.setItem(`aura_sig_urls_${user.username}`, JSON.stringify(scriptUrls));
        localStorage.setItem(`aura_sig_sources_${user.username}`, JSON.stringify(sources));
        localStorage.setItem(`aura_sig_data_${user.username}`, JSON.stringify(data));
        
        if (sources.length > 0 && selectedSourceId !== '' && !sources.find(s => s.id === selectedSourceId)) {
            setSelectedSourceId('');
        }
    }, [scriptUrls, sources, data, selectedSourceId, user]);

    const fetchData = async () => {
        if (scriptUrls.length === 0) {
            setError("Primero debe configurar al menos una URL de Web App de Apps Script.");
            setTempUrls([]);
            setIsConfigOpen(true);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            let allData: SIGData[] = [];
            let newSources: SheetSource[] = [];

            // Fetch todas las URLs en paralelo
            const fetchPromises = scriptUrls.map(async (url, urlIndex) => {
                try {
                    const response = await fetch(url);
                    if (!response.ok) throw new Error("HTTP " + response.status);
                    const json = await response.json();
                    
                    if (Array.isArray(json)) {
                        json.forEach((sheet: any) => {
                            const uniqueSourceId = `${urlIndex}_${sheet.id}`;
                            newSources.push({ id: uniqueSourceId, name: sheet.name, urlIndex });
                            
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
            
            if (allData.length === 0) {
               setError("No se encontraron registros en las hojas de cálculo. Revise que tengan información.");
            }
            
        } catch (err: any) {
            setError("Ocurrió un error al cargar los datos: " + err.message);
        } finally {
            setIsLoading(false);
        }
    };

    // Al montar, si hay URL pero no hay data, fetch automatically
    useEffect(() => {
        if (scriptUrls.length > 0 && data.length === 0) {
            fetchData();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scriptUrls.length]); // only trigger once on mount if we have URLs loaded

    const handleSaveConfig = () => {
        setScriptUrls([...tempUrls]);
        setIsConfigOpen(false);
        // setTimeout para que se actualice el state de scriptUrls
        setTimeout(() => {
            const btn = document.getElementById('sync-btn');
            if (btn) btn.click();
        }, 100);
    };

    const handleAddUrl = () => {
        if (maxUrlsAllowed && tempUrls.length >= maxUrlsAllowed) {
            import('sonner').then(m => m.toast.error(`Ha alcanzado el límite máximo de ${maxUrlsAllowed} URLs para su rol.`));
            return;
        }

        const url = newUrlInput.trim();
        if (url && !tempUrls.includes(url)) {
            setTempUrls([...tempUrls, url]);
            setNewUrlInput('');
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
                        onClick={fetchData} disabled={isLoading}
                        className="flex-1 sm:flex-none bg-teal-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
                    >
                        <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                        {isLoading ? 'Sincronizando...' : 'Sincronizar'}
                    </button>
                </div>
            </div>

            {isConfigOpen && (
                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm mb-6 animate-in fade-in slide-in-from-top-4">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <LinkIcon className="h-5 w-5 text-teal-500" />
                        Conexión mediante Google Apps Script
                    </h3>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div>
                            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                                <h4 className="text-sm font-bold text-gray-700 mb-2">1. URLs del Web App (Ejecutable)</h4>
                                <p className="text-xs text-gray-500 mb-4">
                                    Añada las URLs públicas de las implementaciones (Deployments) de sus proyectos Google Apps Script. 
                                    {maxUrlsAllowed ? ` Puede añadir hasta ${maxUrlsAllowed} en total.` : ' Puede agregar varias URLs para consolidar información.'}
                                </p>
                                <div className="space-y-4">
                                    <div className="flex gap-2">
                                        <input
                                            type="url"
                                            placeholder="https://script.google.com/macros/s/.../exec"
                                            value={newUrlInput}
                                            onChange={e => setNewUrlInput(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleAddUrl()}
                                            disabled={maxUrlsAllowed !== undefined && tempUrls.length >= maxUrlsAllowed}
                                            className="flex-1 text-sm rounded-lg border-gray-300 focus:border-teal-500 focus:ring-teal-500 shadow-sm py-2 px-3 disabled:bg-gray-100 disabled:text-gray-400"
                                        />
                                        <button 
                                            onClick={handleAddUrl}
                                            disabled={!newUrlInput.trim() || (maxUrlsAllowed !== undefined && tempUrls.length >= maxUrlsAllowed)}
                                            className="bg-gray-200 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
                                        >
                                            <Plus className="h-5 w-5" />
                                        </button>
                                    </div>
                                    
                                    {tempUrls.length > 0 && (
                                        <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                                            {tempUrls.map((url, idx) => (
                                                <div key={idx} className="flex gap-2 items-center bg-white border border-gray-200 p-2 rounded-lg">
                                                    <span className="flex-1 text-xs text-gray-600 truncate" title={url}>{url}</span>
                                                    <button 
                                                        onClick={() => handleRemoveUrl(idx)}
                                                        className="text-red-500 hover:text-red-700 p-1"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <button
                                        onClick={handleSaveConfig}
                                        className="w-full bg-gray-800 text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-black transition-colors flex items-center justify-center gap-2"
                                    >
                                        <Save className="h-4 w-4" />
                                        Guardar Configuración ({tempUrls.length} origen{tempUrls.length !== 1 ? 'es' : ''})
                                    </button>
                                </div>
                            </div>
                        </div>
                        
                        <div>
                            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 relative h-full">
                                <h4 className="text-sm font-bold text-blue-900 mb-2">2. Instrucciones para Apps Script</h4>
                                <ul className="text-xs text-blue-800 space-y-1 mb-3 list-decimal pl-4 font-medium">
                                    <li>Abra <a href="https://script.google.com" target="_blank" rel="noreferrer" className="underline font-bold">script.google.com</a> y cree un Nuevo Proyecto.</li>
                                    <li>Pegue el código de abajo en <code>Código.gs</code>.</li>
                                    <li>Haga clic en <strong>Implementar &gt; Nueva Implementación</strong>.</li>
                                    <li>Elija <strong>Aplicación Web</strong>, Acceso: <strong>Cualquier persona</strong>.</li>
                                    <li>Copie la URL resultante y péguela usando el botón (+).</li>
                                </ul>
                                <div className="relative group">
                                    <pre className="text-[10px] bg-slate-900 text-slate-300 p-3 rounded-lg overflow-hidden h-32 overflow-y-auto font-mono scrollbar-thin scrollbar-thumb-slate-700">
                                        {scriptCode}
                                    </pre>
                                    <button 
                                        onClick={copyScript}
                                        className="absolute top-2 right-2 bg-white/10 hover:bg-white/20 p-1.5 rounded-md text-white backdrop-blur-sm transition-all"
                                        title="Copiar código"
                                    >
                                        {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                                    </button>
                                </div>
                            </div>
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

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm flex-1 flex flex-col min-h-[500px] overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row gap-4 justify-between items-center bg-gray-50/50">
                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto flex-1">
                        {/* Selector de Establecimiento/Hoja */}
                        <div className="w-full sm:w-64 shrink-0">
                            <select
                                value={selectedSourceId}
                                onChange={(e) => setSelectedSourceId(e.target.value)}
                                className="block w-full py-2.5 px-3 border border-gray-300 bg-white rounded-xl text-sm font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors shadow-sm"
                            >
                                {sources.length === 0 ? (
                                    <option value="" disabled>1. Sincronice para obtener Hojas...</option>
                                ) : (
                                    <>
                                        <option value="">-- Todas las hojas --</option>
                                        {sources.map((s) => (
                                            <option key={s.id} value={s.id}>[Url {s.urlIndex + 1}] {s.name} - ESTABLECIMIENTO</option>
                                        ))}
                                    </>
                                )}
                            </select>
                        </div>
                        
                        <div className="w-full relative max-w-md">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="h-4 w-4 text-gray-400" />
                            </div>
                            <input
                                type="text"
                                placeholder="Buscar medicamento, código o lote..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="block w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent sm:text-sm transition-all shadow-sm"
                            />
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm text-gray-500 bg-white px-4 py-2 rounded-xl border border-gray-200 shadow-sm shrink-0">
                        <span className="font-black text-gray-900">{filteredData.length}</span> resultados
                    </div>
                </div>

                <div className="flex-1 overflow-auto rounded-b-2xl max-h-[calc(100vh-250px)]">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-64 text-teal-600 gap-3">
                            <RefreshCw className="h-8 w-8 animate-spin" />
                            <span className="font-medium">Sincronizando información desde Apps Script...</span>
                        </div>
                    ) : (data.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                            <FileSpreadsheet className="h-12 w-12 text-gray-200 mb-3" />
                            <p className="font-medium text-gray-500">No hay datos sincronizados.</p>
                            <p className="text-sm mt-1">Configure la URL de Script y presione Sincronizar.</p>
                        </div>
                    ) : (
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
                                        <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                                            No se encontraron coincidencias para su búsqueda en este establecimiento.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    ))}
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
                                            <p className="text-sm font-medium text-gray-900">{selectedRecord.DESC_ALM || '-'} <span className="text-gray-400 text-xs">({selectedRecord.ALMCOD || '-'})</span></p>
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
        </div>
    );
};
