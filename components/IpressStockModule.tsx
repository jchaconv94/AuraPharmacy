import React, { useState, useEffect } from "react";
import { Search, Loader2, FileSpreadsheet, Box, Clock, Filter, ChevronRight, XCircle, AlertCircle, RefreshCw, Hospital } from "lucide-react";
import { api } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";

// Define locally to avoid missing imports if not exported from SheetSearch
const parseDataDate = (str?: string): number => {
  if (!str) return 0;
  let d = new Date(str);
  if (!isNaN(d.getTime())) return d.getTime();

  try {
    const parts = str.trim().split(/\s+/);
    const datePart = parts[0].replace(",", "");
    const timePart = parts[1] || "00:00:00";
    const dateMatch = datePart.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (dateMatch) {
      const [, day, month, year] = dateMatch;
      d = new Date(
        `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${timePart}`,
      );
      return d.getTime() || 0;
    }
  } catch (e) {}
  return 0;
};

const getUpdateStatus = (timestamp?: number) => {
  if (!timestamp || timestamp === 0)
    return { color: "bg-gray-400 text-gray-700 border-gray-300", label: "Sin datos", fullLabel: "Sin datos" };

  const now = new Date().getTime();
  const diffMs = now - timestamp;
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffMs < 0) {
    return { color: "bg-emerald-50 text-emerald-700 border-emerald-200", indicator: "bg-emerald-500", label: "Actualizado recientemente", fullLabel: "Actualizado recientemente" };
  }

  if (diffHours <= 1) {
    const minLabel = diffMinutes <= 0 ? "< 1m" : `${diffMinutes}m`;
    return { color: "bg-emerald-50 text-emerald-700 border-emerald-200", indicator: "bg-emerald-500", label: `Hace ${minLabel}`, fullLabel: `Hace ${diffMinutes} minuto(s)` };
  }

  if (diffHours <= 24) {
    const hrs = Math.floor(diffHours);
    const mins = diffMinutes % 60;
    return { color: "bg-amber-50 text-amber-700 border-amber-200", indicator: "bg-amber-500", label: `Hace ${hrs}h ${mins}m`, fullLabel: `Hace ${hrs} hora(s) ${mins} minuto(s)` };
  }

  const days = Math.floor(diffHours / 24);
  const hrs = Math.floor(diffHours) % 24;
  return { color: "bg-red-50 text-red-700 border-red-200", indicator: "bg-red-500", label: `Hace ${days}d ${hrs}h`, fullLabel: `Hace ${days} día(s) ${hrs} hora(s)` };
};

const formatDate = (timestamp?: number): string => {
  if (!timestamp || timestamp === 0) return "Sin datos / Por determinar";
  const d = new Date(timestamp);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
};

const formatVencimiento = (dateStr: string) => {
  if (!dateStr || dateStr === "-") return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

const COLUMN_LABELS: Record<string, string> = {
  "ALMCOD": "Cód. Almacén",
  "DESC_ALM": "Almacén",
  "CODIGO_SIG": "Cód. SISMED",
  "Nombre": "Descripción",
  "Lote": "Lote",
  "Fec_Vencim": "Vencimiento",
  "Reg_Sanitario": "Reg. Sanitario",
  "DESC_TIPSUM": "Tipo",
  "DESC_FFINAN": "Fuente Fin.",
  "Saldo": "Stock",
  "Precio_Det": "Precio Unit.",
  "Precio_Cab": "Precio Paq."
};

export const IpressStockModule: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [activeAssignment, setActiveAssignment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fetchingData, setFetchingData] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>({});
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadAssignments();
  }, [currentUser]);

  const loadAssignments = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const facilityCode = currentUser.personnelData?.facilityCode || currentUser.facilityData?.code;
      if (!facilityCode) {
        setAssignments([]);
        setLoading(false);
        return;
      }
      const results = await api.getMyStockAssignments(facilityCode);
      setAssignments(results);
      if (results.length > 0) {
        setActiveAssignment(results[0]);
        fetchSheetData(results[0]);
      }
    } catch(e) {
      toast.error("Error al cargar asignaciones");
    } finally {
      setLoading(false);
    }
  };

  const fetchSheetData = async (assignment: any, forceSync: boolean = false) => {
    if (!assignment?.sheetUrl || !assignment?.sheetName) return;
    if (fetchingData && !forceSync) return; // Prevent double trigger unless forced
    setFetchingData(true);
    if (forceSync) {
      toast.info("Sincronizando...", { id: "sync-toast" });
    } else {
      setData([]);
      setMeta({});
    }
    
    try {
      // Optimización: Agregar parámetro ?sheet= a la URL
      let finalUrl = assignment.sheetUrl;
      try {
        const urlObj = new URL(finalUrl);
        urlObj.searchParams.set("sheet", assignment.sheetName);
        if (forceSync) {
           urlObj.searchParams.set("t", Date.now().toString());
        }
        finalUrl = urlObj.toString();
      } catch(e) { }

      const cacheKey = `aura_sheet_cache_${finalUrl.split('&t=')[0]}`;
      
      if (forceSync) {
         sessionStorage.removeItem(cacheKey);
      }

      const cached = sessionStorage.getItem(cacheKey);
      let responseJSON;
      
      if (cached) {
         const { data, timestamp } = JSON.parse(cached);
         // 5 minutes max cache
         if (new Date().getTime() - timestamp < 5 * 60 * 1000) {
            responseJSON = data;
         }
      }

      if (!responseJSON) {
        const res = await fetch(finalUrl);
        if (!res.ok) throw new Error("Error de red");
        responseJSON = await res.json();
        try {
          // Always use the base URL as cache key
          sessionStorage.setItem(cacheKey, JSON.stringify({ data: responseJSON, timestamp: new Date().getTime() }));
        } catch(e) { /* Ignore quota exceeded */ }
      }
      
      if (Array.isArray(responseJSON)) {
        // Encontrar la hoja específica de esta asignación
        const targetSheet = responseJSON.find(s => s.name === assignment.sheetName);
        
        if (targetSheet && Array.isArray(targetSheet.data)) {
          let lastUpdateStr = "";
          let lastUpdateTime = 0;

          if (targetSheet.data.length > 0) {
            const firstRow = targetSheet.data[0];
            if (firstRow.ULTIMA_ACTUALIZACION || firstRow.Ultima_Actualizacion || firstRow.ultima_actualizacion || firstRow["ULTIMA ACTUALIZACION"]) {
               lastUpdateStr = String(firstRow.ULTIMA_ACTUALIZACION || firstRow.Ultima_Actualizacion || firstRow.ultima_actualizacion || firstRow["ULTIMA ACTUALIZACION"]);
               lastUpdateTime = parseDataDate(lastUpdateStr);
            }
          }
          
          setData(targetSheet.data);
          setMeta({
             timestamp: lastUpdateTime || 0 // Use 0 explicitly if no timestamp is present
          });
          if (forceSync) {
            toast.success("Stock actualizado", { id: "sync-toast" });
          }
        } else {
          throw new Error("No se encontraron datos para este establecimiento en la conexión asignada.");
        }
      } else {
        throw new Error("Formato inválido: Se esperaba un array de hojas.");
      }
    } catch(e: any) {
      toast.error(e.message || "No se pudo cargar la data del establecimiento", { id: "sync-toast" });
    } finally {
      setFetchingData(false);
    }
  };

  const filteredData = data.filter(row => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const nombre = (row.Nombre || "").toLowerCase();
    const codigo = (row.CODIGO_SIG || "").toLowerCase();
    return nombre.includes(term) || codigo.includes(term);
  });

  if (loading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 text-blue-600 animate-spin" /></div>;
  }

  const facilityCode = currentUser?.personnelData?.facilityCode || currentUser?.facilityData?.code;

  if (!facilityCode) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
          <Box className="w-8 h-8 text-amber-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-800">Usuario sin Establecimiento</h2>
        <p className="text-gray-500 mt-2 text-center max-w-sm">Su usuario no está vinculado a ningún establecimiento de salud (IPRESS). Debe solicitar a un administrador que edite su usuario y le asigne un establecimiento válido.</p>
      </div>
    );
  }

  if (assignments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <FileSpreadsheet className="w-8 h-8 text-gray-400" />
        </div>
        <h2 className="text-xl font-semibold text-gray-800">No hay vistas asignadas</h2>
        <p className="text-gray-500 mt-2 text-center max-w-sm">Este establecimiento no tiene ninguna conexión de datos asignada. Contacte al coordinador (DIRESA/OGESS/UNGET) para que vincule una hoja de stock al establecimiento ({facilityCode}).</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* HEADER TABS IF MULTIPLE */}
      {assignments.length > 1 && (
        <div className="flex space-x-2 bg-white p-2 rounded-t-xl border-x border-t border-gray-200 shadow-sm overflow-x-auto">
          {assignments.map(assig => (
            <button
              key={assig.id}
              onClick={() => {
                setActiveAssignment(assig);
                fetchSheetData(assig);
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeAssignment?.id === assig.id 
                  ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                  : 'bg-white text-gray-600 hover:bg-gray-50 border border-transparent'
              }`}
            >
              {assig.sheetName}
            </button>
          ))}
        </div>
      )}

      {/* ACTIVE VIEW */}
      <div className={`flex flex-col flex-1 bg-white border border-gray-200 shadow-sm ${assignments.length === 1 ? 'rounded-xl' : 'rounded-b-xl rounded-tr-xl'} overflow-hidden`}>
        
        {/* Toolbar */}
        <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-50">
          <div>
            <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Hospital className="w-5 h-5 text-teal-600" />
              {activeAssignment?.sheetName}
            </h1>
            <div className="flex items-center gap-2 mt-2">
               {(() => {
                 const statusInfo = getUpdateStatus(meta.timestamp);
                 return (
                   <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${statusInfo.color}`}>
                      <span className="relative flex h-2 w-2">
                        {meta.timestamp > 0 && <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${statusInfo.indicator}`}></span>}
                        <span className={`relative inline-flex rounded-full h-2 w-2 ${statusInfo.indicator}`}></span>
                      </span>
                      <span>Última actualización: {statusInfo.label}</span>
                   </span>
                 );
               })()}
               {meta.timestamp > 0 && (
                 <span className="text-xs text-gray-500 font-medium">({formatDate(meta.timestamp)})</span>
               )}
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64 md:w-80">
              <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text"
                placeholder="Buscar por código o nombre..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
              />
            </div>
            <button
              onClick={() => fetchSheetData(activeAssignment, true)}
              disabled={fetchingData}
              className="flex items-center gap-2 px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50 shrink-0 h-[38px] shadow-sm cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${fetchingData ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Sincronizar</span>
            </button>
          </div>
        </div>

        {/* Data Table */}
        <div className="flex-1 overflow-auto bg-white p-4">
          {fetchingData ? (
             <div className="flex flex-col justify-center items-center h-full space-y-3">
               <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
               <p className="text-gray-500 font-medium tracking-tight">Sincronizando tabla...</p>
             </div>
          ) : filteredData.length === 0 ? (
             <div className="flex flex-col justify-center items-center h-full p-8 text-center text-gray-500">
               <AlertCircle className="w-12 h-12 text-gray-300 mb-3" />
               <p className="font-medium text-gray-900">No se encontraron resultados</p>
               <p className="text-sm">Intenta buscar con otros términos.</p>
             </div>
          ) : (
            <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm">
              <table className="w-full text-sm text-left">
                <thead className="hidden sm:table-header-group sticky top-0 z-30 shadow-xs border-b border-slate-200">
                  <tr className="bg-slate-50">
                    {activeAssignment?.visibleColumns?.map((colKey: string) => (
                      <th key={colKey} scope="col" className={`px-4 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-wider ${colKey === 'Nombre' ? 'min-w-[250px]' : 'whitespace-nowrap'} bg-slate-50 sticky top-0 z-30 border-b border-slate-200/80 shadow-2xs`}>
                        {COLUMN_LABELS[colKey] || colKey}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="block sm:table-row-group bg-transparent sm:bg-white">
                  {filteredData.map((row, idx) => (
                    <tr key={idx} className="block sm:table-row bg-white rounded-xl sm:rounded-none shadow-sm sm:shadow-none border border-gray-200 sm:border-0 border-b-gray-100 p-4 sm:p-0 hover:bg-teal-50/50 transition-colors mb-3 sm:mb-0 relative">
                      
                      {/* Mobile Card Layout (visible sólo en móvil) */}
                      <td className="block sm:hidden">
                        <div className="flex justify-between items-start mb-2">
                           <div className="flex flex-col">
                             {activeAssignment?.visibleColumns?.includes('Id_Producto') && (
                               <span className="text-xs font-black text-teal-700 bg-teal-50 px-2 py-0.5 rounded w-fit mb-1 border border-teal-100">
                                 {row.Id_Producto || row.ID_Producto || "-"}
                               </span>
                             )}
                             {activeAssignment?.visibleColumns?.includes('CODIGO_SIG') && (
                               <span className="text-[10px] text-gray-400 font-bold">
                                 SIGA: {row.CODIGO_SIG || "-"}
                               </span>
                             )}
                           </div>
                           {activeAssignment?.visibleColumns?.includes('Saldo') && (
                             <div className="text-right">
                               <span className="text-[10px] text-gray-400 font-black uppercase block mb-0.5">Saldo</span>
                               <span className={`text-xl font-black leading-none ${row.Saldo?.toString() === '0' ? 'text-red-500' : 'text-teal-600'}`}>
                                 {!isNaN(parseInt(String(row.Saldo), 10)) ? parseInt(String(row.Saldo), 10) : 0}
                               </span>
                             </div>
                           )}
                        </div>
                        {activeAssignment?.visibleColumns?.includes('Nombre') && (
                          <div className="text-sm font-bold text-gray-900 mb-2 leading-snug">
                            {row.Nombre || "-"}
                            {activeAssignment?.visibleColumns?.includes('Reg_Sanitario') && (
                              <div className="text-[10px] text-gray-400 mt-0.5" title={row.Reg_Sanitario}>
                                RS: {row.Reg_Sanitario || "S/N"}
                              </div>
                            )}
                          </div>
                        )}
                        <div className="flex justify-between items-center text-[10px]">
                           <div className="flex flex-col gap-0.5">
                             {activeAssignment?.visibleColumns?.includes('Lote') && (
                               <span className="text-gray-500 font-mono">Lot: {row.Lote || "-"}</span>
                             )}
                             {activeAssignment?.visibleColumns?.includes('Fec_Vencim') && (
                               <span className="text-amber-600 font-bold tracking-tight">Exp: {formatVencimiento(row.Fec_Vencim)}</span>
                             )}
                           </div>
                        </div>
                      </td>

                      {/* Desktop Table Layout (visible sólo en escritorio) */}
                      {activeAssignment?.visibleColumns?.map((colKey: string) => {
                        let renderContent;
                        
                        if (colKey === 'Id_Producto') {
                           renderContent = <span className="font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-100">{row.Id_Producto || row.ID_Producto || "-"}</span>;
                        } else if (colKey === 'CODIGO_SIG') {
                           renderContent = <span className="font-bold text-gray-500">{row.CODIGO_SIG || "-"}</span>;
                        } else if (colKey === 'Nombre') {
                           renderContent = (
                             <div>
                               <div className="text-sm font-bold text-gray-900 whitespace-normal">{row.Nombre || "-"}</div>
                               {activeAssignment?.visibleColumns?.includes('Reg_Sanitario') && colKey === 'Nombre' && (
                                  <div className="text-[10px] text-gray-400 mt-0.5 break-words line-clamp-1 truncate">RS: {row.Reg_Sanitario || "S/N"}</div>
                               )}
                             </div>
                           );
                        } else if (colKey === 'Reg_Sanitario' && activeAssignment?.visibleColumns?.includes('Nombre')) {
                           // Ya se renderiza dentro del Nombre para ahorrar espacio o si la persona quiere una columna separada la renderizamos igual
                           renderContent = <span className="text-xs text-gray-600">{row.Reg_Sanitario || "-"}</span>;
                        } else if (colKey === 'Saldo') {
                           renderContent = <span className={`text-base font-black ${row.Saldo?.toString() === "0" ? "text-red-500" : "text-gray-900"} bg-gray-50 px-2 py-1 rounded inline-block`}>{!isNaN(parseInt(String(row.Saldo), 10)) ? parseInt(String(row.Saldo), 10) : 0}</span>;
                        } else if (colKey === 'Fec_Vencim') {
                           renderContent = <span className="text-xs font-bold text-amber-600">{formatVencimiento(row.Fec_Vencim)}</span>;
                        } else if (colKey === 'DESC_TIPSUM' || colKey === 'TIPSUM') {
                           renderContent = <span className="inline-flex items-center px-2 py-1 rounded bg-indigo-50 text-indigo-600 text-[10px] font-bold uppercase border border-indigo-100/50">{row.TIPSUM || row.DESC_TIPSUM || "-"}</span>;
                        } else if (colKey === 'DESC_FFINAN' || colKey === 'FFINAN') {
                           renderContent = <span className="inline-flex items-center px-2 py-1 rounded bg-amber-50 text-amber-600 text-[10px] font-bold uppercase border border-amber-100/50">{row.FFINAN || row.DESC_FFINAN || "-"}</span>;
                        } else {
                           renderContent = <span className="text-sm text-gray-700">{row[colKey] !== undefined && row[colKey] !== null ? String(row[colKey]) : "-"}</span>;
                        }

                        return (
                          <td key={colKey} className="hidden sm:table-cell px-4 py-3 align-top whitespace-nowrap">
                            {renderContent}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
