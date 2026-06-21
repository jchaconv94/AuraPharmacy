import React, { useState, useEffect, useMemo } from "react";
import { 
  Search, 
  Loader2, 
  FileSpreadsheet, 
  Box, 
  Clock, 
  Filter, 
  ChevronRight, 
  X, 
  AlertTriangle, 
  RefreshCw, 
  Hospital, 
  Table, 
  Grid, 
  TrendingUp, 
  Layers, 
  ArrowLeft, 
  AlertCircle,
  TrendingDown,
  Info,
  Trash2
} from "lucide-react";
import { api } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";
import { supabase } from "../services/supabaseClient";
import { HealthFacility } from "../types";

export interface CalculatedItem {
  id: string;
  facility_code: string;
  almcod: string;
  desc_alm: string;
  medcod: string;
  codigo_sig: string;
  xnom: string;
  lote: string;
  fecha: string; // Expiration
  medregsan: string;
  tipsum: string;
  tipsum_des: string;
  ffinan: string;
  ffinan_des: string;
  saldo: number;
  precio_det: number;
  preciocab: number;
  last_update: string;
}

const getUpdateStatus = (timestamp?: number | null) => {
  if (!timestamp || timestamp === 0)
    return { color: "bg-gray-400", label: "Sin datos", text: "text-gray-500", bg: "bg-gray-50" };

  const now = new Date().getTime();
  const diffMs = now - timestamp;
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffMs < 0 || diffHours <= 1) {
    return { color: "bg-emerald-500", label: "Actualizado recientemente", text: "text-emerald-700", bg: "bg-emerald-50" };
  }

  if (diffHours <= 24) {
    return { color: "bg-amber-500", label: `Hace ${Math.floor(diffHours)}h`, text: "text-amber-700", bg: "bg-amber-50" };
  }

  return { color: "bg-red-500", label: `Hace ${Math.floor(diffHours / 24)}d`, text: "text-red-700", bg: "bg-red-50" };
};

export const IpressStockModule: React.FC = () => {
  const { user: currentUser } = useAuth();
  
  // State
  const [facilities, setFacilities] = useState<HealthFacility[]>([]);
  const [stockRecords, setStockRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // High-level navigation
  const [selectedFacilityCode, setSelectedFacilityCode] = useState<string | null>(null);
  
  // Active facility details tab
  const [activeAlmTab, setActiveAlmTab] = useState<string>("ALL"); // "ALL" or specific almcod
  
  // Search & Filters in detail view
  const [searchTerm, setSearchTerm] = useState("");
  const [ffinanFilter, setFfinanFilter] = useState<string>("ALL");
  const [tipsumFilter, setTipsumFilter] = useState<string>("ALL");
  
  // Custom delete confirmation state
  const [deleteConfirmData, setDeleteConfirmData] = useState<{almcod: string, almName: string} | null>(null);

  useEffect(() => {
    loadBaseData();
  }, []);

  const loadBaseData = async () => {
    try {
      setLoading(true);
      const [allFacilities, allStock] = await Promise.all([
        api.getFacilities(),
        api.getStockActual() // Get all stock records (up to 5000 range)
      ]);
      setFacilities(allFacilities);
      setStockRecords(allStock);
      
      // If user is at IPRESS level, auto-select their facility
      const userFacility = currentUser?.personnelData?.facilityCode || currentUser?.facilityData?.code || (currentUser as any)?.facilityCode;
      if (userFacility) {
        setSelectedFacilityCode(userFacility);
      }
    } catch (e) {
      console.error(e);
      toast.error("Error al cargar la información de Stock");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const allStock = await api.getStockActual();
      setStockRecords(allStock);
      toast.success("Información de stock sincronizada");
    } catch (err) {
      toast.error("Error de conexión al refrescar stock");
    } finally {
      setRefreshing(false);
    }
  };

  const requestDeleteWarehouse = (almcod: string, almName: string) => {
    setDeleteConfirmData({ almcod, almName });
  };

  const confirmDeleteWarehouse = async () => {
    if (!deleteConfirmData) return;
    const { almcod, almName } = deleteConfirmData;
    
    setRefreshing(true);
    setDeleteConfirmData(null);
    try {
      const success = await api.deleteStockActualByAlmcod(almcod);
      if (success) {
        toast.success("Stock eliminado correctamente");
        const allStock = await api.getStockActual();
        setStockRecords(allStock);
      } else {
        toast.error("Error al eliminar los datos");
      }
    } catch (err) {
      toast.error("Error de conexión");
    } finally {
      setRefreshing(false);
    }
  };

  // Jurisdiction definitions
  const userDiresaId = currentUser?.personnelData?.diresaId || currentUser?.facilityData?.diresaId || (currentUser as any)?.diresaId;
  const userOgessId = currentUser?.personnelData?.ogessId || currentUser?.facilityData?.ogessId || (currentUser as any)?.ogessId;
  const userUngetId = currentUser?.personnelData?.ungetId || currentUser?.facilityData?.ungetId || (currentUser as any)?.ungetId;
  const userMicroredId = currentUser?.personnelData?.microredId || currentUser?.facilityData?.microredId || (currentUser as any)?.microredId;
  const userFacilityCode = currentUser?.personnelData?.facilityCode || currentUser?.facilityData?.code || (currentUser as any)?.facilityCode;

  const isGlobalUser = !userDiresaId && !userOgessId && !userUngetId && !userMicroredId && !userFacilityCode;

  const level = useMemo(() => {
    if (!currentUser) return 'IPRESS';
    const r = (currentUser.role || '').toUpperCase();
    if (r === 'ADMIN' || r === 'GLOBAL' || r.includes('SUPER') || r.includes('GENERAL') || r === 'ADMINISTRADOR') return 'GLOBAL';
    if (r.includes('DIRESA')) return 'DIRESA';
    if (r.includes('OGESS')) return 'OGESS';
    if (r.includes('UNGET')) return 'UNGET';
    if (r.includes('MICRORED')) return 'MICRORED';
    return 'IPRESS';
  }, [currentUser]);

  // Filter facilities listing based on user's territory limit
  const activeJurisdictionFacilities = useMemo(() => {
    return facilities.filter(f => {
      if (isGlobalUser) return true;
      if (userFacilityCode) return f.code === userFacilityCode;
      if (userMicroredId) return f.microredId === userMicroredId;
      if (userUngetId) return f.ungetId === userUngetId;
      if (userOgessId) return f.ogessId === userOgessId;
      if (userDiresaId) return f.diresaId === userDiresaId;
      return false;
    });
  }, [facilities, isGlobalUser, userFacilityCode, userMicroredId, userUngetId, userOgessId, userDiresaId]);

  // Establishments that actually contain registered stock in stock_actual and matches jurisdiction
  const stockFacilitiesList = useMemo(() => {
    // Only use base IPRESS (filter out sub-facilities if their parent is present or their code length is > 5)
    // Most standard IPRESS codes are 5 digits. "030S05" technically is 6 chars maybe? So let's filter if there's any strictly shorter prefix in the list.
    const baseFacilities = activeJurisdictionFacilities.filter(f => {
      // Is there another facility that is a strict prefix of this one?
      const isSubFacility = activeJurisdictionFacilities.some(parent => f.code !== parent.code && f.code.startsWith(parent.code));
      return !isSubFacility;
    });

    return baseFacilities.map(f => {
      // Find all stock records synced under this parent facility (this includes its own and its children's stock)
      const fStock = stockRecords.filter(r => r.facility_code === f.code || r.facility_code.startsWith(f.code));

      const uniqueWarehouses = new Set(fStock.map(r => r.almcod).filter(Boolean));
      const lastUpdateTimes = fStock.map(r => new Date(r.ultima_actualizacion).getTime()).filter(Boolean);
      const lastUpdateTime = lastUpdateTimes.length > 0 ? Math.max(...lastUpdateTimes) : null;

      // Include all medications/lots, not just those with > 0 stock (based on user feedback)
      const uniqueMeds = new Set(fStock.map(r => r.codigo_sig || r.medcod));

      return {
        ...f,
        hasStock: fStock.length > 0,
        uniqueWarehousesCount: uniqueWarehouses.size,
        totalItemsCount: fStock.length, // Include all items/lotes (even zero stock)
        uniqueMedicinesCount: uniqueMeds.size,
        totalUnitsSum: fStock.reduce((acc, r) => acc + (Number(r.saldo) || 0), 0),
        lastUpdateTime
      };
    }).sort((a, b) => {
      if (b.hasStock !== a.hasStock) {
        return (b.hasStock ? 1 : 0) - (a.hasStock ? 1 : 0);
      }
      return a.name.localeCompare(b.name);
    });
  }, [activeJurisdictionFacilities, stockRecords]);

  // Get stock records belonging to the selected facility
  const calculatedStockItems = useMemo<CalculatedItem[]>(() => {
    if (!selectedFacilityCode) return [];
    
    // selectedFacilityCode is the parent facility code
    const records = stockRecords.filter(r => 
      r.facility_code === selectedFacilityCode || 
      r.facility_code.startsWith(selectedFacilityCode)
    );

    return records.map(r => {
      const saldo = Number(r.saldo) || 0;
      
      return {
        id: r.id,
        facility_code: r.facility_code,
        almcod: r.almcod,
        desc_alm: r.desc_alm || `Almacén ${r.almcod}`,
        medcod: r.medcod,
        tipsum: r.tipsum || "N/A",
        tipsum_des: r.tipsum_des || "Otros Suministros",
        codigo_sig: r.codigo_sig || r.medcod,
        xnom: r.xnom || "Descripción no disponible",
        lote: r.lote || "S/L",
        fecha: r.fecha || "-",
        medregsan: r.medregsan || "N/A",
        ffinan: r.ffinan || "N/A",
        ffinan_des: r.ffinan_des || "Fuentes Diversas",
        saldo,
        precio_det: Number(r.precio_det) || 0,
        preciocab: Number(r.preciocab) || 0,
        last_update: r.ultima_actualizacion
      };
    });
  }, [selectedFacilityCode, stockRecords]);

  // Detected warehouses list for the selected facility (unique almcod + desc_alm)
  const facilityWarehouses = useMemo(() => {
    if (!selectedFacilityCode) return [];
    const grouped = new Map<string, string>();
    calculatedStockItems.forEach(item => {
      grouped.set(item.almcod, item.desc_alm);
    });
    return Array.from(grouped.entries()).map(([code, name]) => ({ code, name }));
  }, [calculatedStockItems, selectedFacilityCode]);

  // Detailed summary metrics for the selected facility
  const facilitySummaryMetrics = useMemo(() => {
    if (!selectedFacilityCode) return null;
    
    const uniqueMedsSet = new Set<string>();
    let totalUnits = 0;
    let totalEstimatedValue = 0;
    
    const warehouseGroupMap = new Map<string, {
      code: string;
      name: string;
      uniqueMeds: Set<string>;
      batchesCount: number;
      totalUnits: number;
      estimatedValue: number;
    }>();

    calculatedStockItems.forEach(item => {
      uniqueMedsSet.add(item.codigo_sig || item.medcod);
      totalUnits += item.saldo;
      const price = item.precio_det || item.preciocab || 0;
      totalEstimatedValue += item.saldo * price;

      let wh = warehouseGroupMap.get(item.almcod);
      if (!wh) {
        wh = {
          code: item.almcod,
          name: item.desc_alm || `Almacén ${item.almcod}`,
          uniqueMeds: new Set<string>(),
          batchesCount: 0,
          totalUnits: 0,
          estimatedValue: 0
        };
        warehouseGroupMap.set(item.almcod, wh);
      }
      wh.uniqueMeds.add(item.codigo_sig || item.medcod);
      wh.batchesCount += 1;
      wh.totalUnits += item.saldo;
      wh.estimatedValue += item.saldo * price;
    });

    const warehousesList = Array.from(warehouseGroupMap.values()).map(w => ({
      code: w.code,
      name: w.name,
      batchesCount: w.batchesCount,
      totalUnits: w.totalUnits,
      estimatedValue: w.estimatedValue,
      uniqueMedsCount: w.uniqueMeds.size
    }));

    return {
      totalUniqueMeds: uniqueMedsSet.size,
      totalBatches: calculatedStockItems.length,
      totalUnits,
      totalEstimatedValue,
      warehouses: warehousesList
    };
  }, [calculatedStockItems, selectedFacilityCode]);

  // Handle Consolidation ("All") vs Specific warehouse selection
  const processedStockItems = useMemo(() => {
    if (activeAlmTab === "ALL") {
      // Consolidates/Aggregates by medcod + lote + fecha + ffinan + tipsum as explicitly requested
      const aggregateMap = new Map<string, CalculatedItem>();
      
      calculatedStockItems.forEach(item => {
        const compositeKey = `${item.medcod}_${item.lote}_${item.fecha}_${item.ffinan}_${item.tipsum}`;
        const existing = aggregateMap.get(compositeKey);
        
        if (existing) {
          existing.saldo += item.saldo;
        } else {
          // Clone item so we don't mutate original
          aggregateMap.set(compositeKey, { ...item });
        }
      });
      return Array.from(aggregateMap.values());
    } else {
      // Specific warehouse selected
      return calculatedStockItems.filter(item => item.almcod === activeAlmTab);
    }
  }, [calculatedStockItems, activeAlmTab]);

  // Apply UI Filters to final selection
  const finalFilteredItems = useMemo(() => {
    return processedStockItems.filter(item => {
      // Search matching
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        const matchesName = item.xnom.toLowerCase().includes(query);
        const matchesCode = item.codigo_sig.toLowerCase().includes(query);
        const matchesLote = item.lote.toLowerCase().includes(query);
        if (!matchesName && !matchesCode && !matchesLote) return false;
      }

      // Fuente de Financiamiento filter
      if (ffinanFilter !== "ALL" && item.ffinan !== ffinanFilter) return false;

      // Tipsum filter
      if (tipsumFilter !== "ALL" && item.tipsum !== tipsumFilter) return false;

      return true;
    });
  }, [processedStockItems, searchTerm, ffinanFilter, tipsumFilter]);

  // Unique lists for filtering dropdowns
  const uniqueFfinans = useMemo(() => {
    const list = new Map<string, string>();
    calculatedStockItems.forEach(i => list.set(i.ffinan, i.ffinan_des));
    return Array.from(list.entries()).map(([code, name]) => ({ code, name }));
  }, [calculatedStockItems]);

  const uniqueTipsums = useMemo(() => {
    const list = new Map<string, string>();
    calculatedStockItems.forEach(i => list.set(i.tipsum, i.tipsum_des));
    return Array.from(list.entries()).map(([code, name]) => ({ code, name }));
  }, [calculatedStockItems]);

  // Selected facility reference object
  const activeFacilityObj = useMemo(() => {
    return facilities.find(f => f.code === selectedFacilityCode);
  }, [facilities, selectedFacilityCode]);

  // Format Helper for timestamps
  const formatTextTimestamp = (tsStr: string) => {
    if (!tsStr) return "Nacional";
    return new Date(tsStr).toLocaleString("es-PE");
  };

  // CSV/Spreadsheet Export logic
  const handleExportCSV = () => {
    if (finalFilteredItems.length === 0) {
      toast.error("No hay registros en la vista actual para exportar");
      return;
    }

    try {
      const headers = ["Cod SISMED", "Descripcion", "Lote", "Vencimiento", "Almacen", "Financiamiento", "Suministro", "Stock Actual"];
      const rows = finalFilteredItems.map(item => [
        item.codigo_sig,
        `"${item.xnom.replace(/"/g, '""')}"`,
        item.lote,
        item.fecha,
        activeAlmTab === "ALL" ? "Consolidado" : item.desc_alm,
        item.ffinan_des,
        item.tipsum_des,
        item.saldo
      ]);

      const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `STOCK_${selectedFacilityCode}_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Excel CSV exportado correctamente");
    } catch (e) {
      toast.error("Ocurrió un error al preparar el CSV");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">

      {/* Main Grid: Directory of Jurisdictional Establishments */}
      {!selectedFacilityCode && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <div>
              <h2 className="text-base font-bold text-gray-800">Directorio de Stock Territorial</h2>
              <p className="text-xs text-gray-500 mt-0.5">Nivel de jurisdicción consultada: <strong className="text-teal-600 uppercase font-bold">{level || "Cargando"}</strong></p>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing || loading}
              className="px-4 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 hover:text-teal-600 border border-gray-200 rounded-lg text-xs font-bold transition-all flex items-center gap-2"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin text-teal-600' : ''}`} />
              Sincronizar Stock
            </button>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center p-16 bg-white border border-gray-200 rounded-xl shadow-sm">
              <Loader2 className="h-8 w-8 text-teal-600 animate-spin mb-3" />
              <p className="text-sm text-gray-500 font-medium">Buscando reportes e inventarios recibidos...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(280px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4 sm:gap-6 animate-in fade-in duration-200">
              {stockFacilitiesList.map(f => {
                const statusObj = getUpdateStatus(f.lastUpdateTime);

                return (
                 <div
                  key={f.code}
                  className={`bg-white rounded-xl border transition-all relative overflow-hidden flex flex-col h-full ${
                    f.hasStock 
                      ? 'border-gray-200 hover:border-teal-500 hover:shadow-md' 
                      : 'border-dashed border-gray-300 opacity-70'
                  }`}
                >
                  {/* Top bar indicators */}
                  <div className="p-5 flex-1 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="w-12 h-12 shrink-0 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center relative">
                        <Hospital className="h-6 w-6" />
                        {f.hasStock && (
                          <div className="absolute -top-1 -right-1 flex h-4 w-4" title={statusObj.label}>
                            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${statusObj.color}`} />
                            <span className={`relative inline-flex rounded-full h-4 w-4 border-2 border-white ${statusObj.color}`} />
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-gray-400 font-bold uppercase block mb-1">CÓDIGO IPRESS</span>
                        <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border">{f.code}</span>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-bold text-[15px] text-gray-900 leading-tight mb-1 truncate whitespace-normal">{f.name}</h4>
                      <p className="text-[10px] text-gray-500 font-medium mt-0.5 uppercase flex items-center gap-1">
                        <Box className="h-3 w-3 text-gray-400" />
                        {f.district || f.province || 'Jurisdicción General'}
                      </p>
                    </div>

                    {/* Stats */}
                    {f.hasStock ? (
                      <div className="space-y-2 bg-slate-50 p-4 rounded-lg border border-slate-100 text-xs text-left">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-gray-400 block text-[9px] font-bold uppercase tracking-wider mb-0.5">MEDICAMENTOS</span>
                            <span className="font-black text-slate-800">{f.uniqueMedicinesCount} ítems</span>
                          </div>
                          <div>
                            <span className="text-gray-400 block text-[9px] font-bold uppercase tracking-wider mb-0.5">LOTES ÚNICOS</span>
                            <span className="font-black text-slate-700">{f.totalItemsCount} lotes</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 pt-3 border-t border-dashed border-gray-200 mt-2">
                          <div>
                            <span className="text-gray-400 block text-[9px] font-bold uppercase tracking-wider mb-0.5">UNIDADES STOCK</span>
                            <span className="font-black text-teal-600">{(f.totalUnitsSum || 0).toLocaleString()} u.</span>
                          </div>
                          <div>
                            <span className="text-gray-400 block text-[9px] font-bold uppercase tracking-wider mb-0.5">FARM / ALM.</span>
                            <span className="font-black text-slate-700 font-mono bg-white px-1 py-0.5 rounded border border-slate-200 shadow-sm">{f.uniqueWarehousesCount}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-amber-50/55 p-3 rounded-lg border border-dashed border-amber-200 text-amber-800 text-[11px] flex gap-2 items-start leading-normal">
                        <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                        <p>No se ha recibido stock de Sync SISMED 2.0. Autorice un dispositivo para este establecimiento.</p>
                      </div>
                    )}
                  </div>

                  {/* Footer actions */}
                  <div className="bg-gray-50/80 px-5 py-3 border-t border-slate-100 flex items-center justify-between mt-auto">
                    {f.hasStock ? (
                      <>
                        <div className="flex items-center gap-1.5 text-[10.5px] font-medium text-gray-400">
                           <RefreshCw className="h-3 w-3 text-slate-400 shrink-0" />
                           <span>Act: <span className="font-extrabold text-slate-600">{f.lastUpdateTime ? new Date(f.lastUpdateTime).toLocaleDateString() : 'Recientemente'}</span></span>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedFacilityCode(f.code);
                            setActiveAlmTab("ALL");
                          }}
                          className="text-[11px] font-black text-teal-600 hover:text-teal-700 flex items-center gap-1 transition-colors uppercase tracking-wide"
                        >
                          Ver Inventario
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <span className="text-[10.5px] text-red-500 font-black tracking-wide uppercase px-1.5 py-0.5">Sin datos transmitidos</span>
                    )}
                  </div>
                </div>
              )})}
            </div>
          )}
        </div>
      )}

      {/* Detailed Stock View for Selected Establishment */}
      {selectedFacilityCode && (
        <div className="space-y-4 animate-in fade-in duration-200">
          
          {/* Header Action bar */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {/* Only show back button if user can see more than one facility (admin role) */}
              {activeJurisdictionFacilities.length > 1 && (
                <button
                  onClick={() => {
                    setSelectedFacilityCode(null);
                    setActiveAlmTab("ALL");
                  }}
                  className="p-2 border rounded-lg hover:bg-slate-50 transition-colors"
                  title="Volver al Directorio"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              )}
              <div>
                <span className="text-[10px] text-teal-600 font-bold uppercase tracking-wide">Visor de Stock Directo</span>
                <h2 className="text-base font-bold text-gray-800 leading-none mt-0.5">{activeFacilityObj?.name || 'Establecimiento Seleccionado'}</h2>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[11px] text-gray-500 font-mono">IPRESS: <strong className="font-bold">{selectedFacilityCode}</strong></span>
                  <span className="text-gray-300">|</span>
                  <span className="text-[11px] text-gray-500 font-mono">Jurisdicción: {activeFacilityObj?.district || activeFacilityObj?.department || 'Regional'}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCSV}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm hover:shadow transition-all flex items-center gap-1.5"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Exportar Excel (CSV)
              </button>
              <button
                onClick={handleRefresh}
                disabled={refreshing || loading}
                className="p-2 bg-slate-50 hover:bg-slate-100 border rounded-lg text-slate-600 hover:text-slate-900 transition-colors"
                title="Sincronizar"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Resumen General de Stock y Farmacias de la IPRESS */}
          {facilitySummaryMetrics && (
            <div className="space-y-4">
              {/* Tarjetas de Resumen General */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Total Medicamentos Únicos</span>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-xl font-bold text-slate-800">{facilitySummaryMetrics.totalUniqueMeds}</span>
                    <span className="text-[10px] text-gray-500 font-medium">ítems</span>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Lotes Únicos en Stock</span>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-xl font-bold text-slate-800">{facilitySummaryMetrics.totalBatches}</span>
                    <span className="text-[10px] text-gray-500 font-medium">lotes</span>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Total Unidades Físicas</span>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-xl font-bold text-teal-600">{facilitySummaryMetrics.totalUnits.toLocaleString()}</span>
                    <span className="text-[10px] text-gray-500 font-medium">unidades</span>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Valor Total Estimado</span>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-xl font-bold text-emerald-600">S/. {facilitySummaryMetrics.totalEstimatedValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              {/* Sección "Todas las Farmacias/Almacenes" */}
              <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-3">
                <div className="flex items-center gap-2 border-b pb-2">
                  <Hospital className="h-4 w-4 text-teal-600" />
                  <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wide">Desglose de Farmacias y Almacenes de esta IPRESS</h3>
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 rounded-full px-2 py-0.5 ml-auto">
                    {facilitySummaryMetrics.warehouses.length} {facilitySummaryMetrics.warehouses.length === 1 ? 'Farmacia' : 'Farmacias / Almacenes'}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {facilitySummaryMetrics.warehouses.map(wh => {
                    const isSelected = activeAlmTab === wh.code;
                    return (
                      <button
                        key={wh.code}
                        onClick={() => setActiveAlmTab(isSelected ? "ALL" : wh.code)}
                        className={`text-left p-3.5 rounded-lg border transition-all flex flex-col justify-between gap-2 group ${
                          isSelected 
                            ? 'bg-teal-50/40 border-teal-500 ring-2 ring-teal-500/20 shadow-sm' 
                            : 'bg-slate-50/50 border-slate-200 hover:bg-slate-50 hover:border-gray-300'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-xs text-slate-800 line-clamp-1 group-hover:text-teal-600 transition-colors">
                              {wh.name}
                            </span>
                            <span className="text-[9px] font-mono font-bold bg-slate-100 text-slate-500 px-1 py-0.2 rounded border">
                              Cód: {wh.code}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-2 mt-2.5 pt-2 border-t border-dashed border-slate-200 text-[10px]">
                            <div>
                              <span className="text-gray-400 block text-[9px] uppercase font-semibold">Ítems</span>
                              <span className="font-bold text-slate-700">{wh.uniqueMedsCount}</span>
                            </div>
                            <div>
                              <span className="text-gray-400 block text-[9px] uppercase font-semibold">Lotes</span>
                              <span className="font-bold text-slate-700">{wh.batchesCount}</span>
                            </div>
                            <div>
                              <span className="text-gray-400 block text-[9px] uppercase font-semibold">Unidades</span>
                              <span className="font-black text-teal-600">{wh.totalUnits.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-1 text-[9px] text-slate-500 font-mono">
                          <span>Estimado: <strong>S/.{wh.estimatedValue.toLocaleString(undefined, { maximumFractionDigits: 1 })}</strong></span>
                          <div className="flex items-center gap-2">
                             <button
                               onClick={(e) => { e.stopPropagation(); requestDeleteWarehouse(wh.code, wh.name); }}
                               className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-1 rounded transition-colors"
                               title="Eliminar todos los datos de este almacén"
                             >
                               <Trash2 className="h-3 w-3" />
                             </button>
                             <span className="text-teal-600 font-bold group-hover:underline flex items-center gap-0.5">
                               {isSelected ? 'Ver Todos' : 'Filtrar Almacen →'}
                             </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

    
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            
            {/* Left Sidebar: Filters */}
            <div className="lg:col-span-1 bg-white border border-gray-200 rounded-xl p-4 shadow-sm h-fit space-y-4">
              
              <div className="flex items-center justify-between border-b pb-2 mb-2">
                <span className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1">
                  <Filter className="h-3.5 w-3.5 text-slate-500" />
                  Filtrar Lote
                </span>
                {(searchTerm || ffinanFilter !== "ALL" || tipsumFilter !== "ALL") && (
                  <button
                    onClick={() => {
                      setSearchTerm("");
                      setFfinanFilter("ALL");
                      setTipsumFilter("ALL");
                    }}
                    className="text-[10px] text-teal-600 font-bold hover:underline"
                  >
                    Limpiar
                  </button>
                )}
              </div>

              {/* Text search */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">Búsqueda rápida</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Sismed o descripción..."
                    className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Financing selector */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">Fuente de Financiamiento</label>
                <select
                  value={ffinanFilter}
                  onChange={e => setFfinanFilter(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-teal-500 bg-white"
                >
                  <option value="ALL">-- Todas las fuentes --</option>
                  {uniqueFfinans.map(f => (
                    <option key={f.code} value={f.code}>{f.name} ({f.code})</option>
                  ))}
                </select>
              </div>

              {/* Supply Tipsum selector */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">Tipo Suministro</label>
                <select
                  value={tipsumFilter}
                  onChange={e => setTipsumFilter(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-teal-500 bg-white"
                >
                  <option value="ALL">-- Todos los tipos --</option>
                  {uniqueTipsums.map(t => (
                    <option key={t.code} value={t.code}>{t.name} ({t.code})</option>
                  ))}
                </select>
              </div>

            </div>

            {/* Right: Tabular grid content list */}
            <div className="lg:col-span-3 space-y-4">
              
              {/* Warehouse Tabs */}
              <div className="flex border-b border-gray-200 overflow-x-auto bg-white rounded-t-xl">
                <button
                  onClick={() => setActiveAlmTab("ALL")}
                  className={`px-4 py-2.5 font-bold text-xs transition-colors whitespace-nowrap border-b-2 ${
                    activeAlmTab === "ALL" 
                      ? 'border-teal-600 text-teal-600 bg-teal-50/15' 
                      : 'border-transparent text-gray-500 hover:text-gray-800'
                  }`}
                >
                  <span className="flex items-center gap-1">
                    <Layers className="h-3.5 w-3.5" />
                    Todo Sismed (Consolidado)
                  </span>
                </button>
                {facilityWarehouses.map(alm => (
                  <button
                    key={alm.code}
                    onClick={() => setActiveAlmTab(alm.code)}
                    className={`px-4 py-2.5 font-bold text-xs transition-colors whitespace-nowrap border-b-2 ${
                      activeAlmTab === alm.code 
                        ? 'border-teal-600 text-teal-600 bg-teal-50/15' 
                        : 'border-transparent text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    {alm.name} ({alm.code})
                  </button>
                ))}
              </div>

              {finalFilteredItems.length === 0 ? (
                <div className="bg-white border rounded-xl p-12 text-center shadow-sm">
                  <Table className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                  <h4 className="font-bold text-gray-700">Sin datos de correspondencia</h4>
                  <p className="text-xs text-gray-400 mt-1">Modifique los filtros seleccionados o el criterio de búsqueda para encontrar registros.</p>
                </div>
              ) : (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto text-left">
                    <table className="min-w-full divide-y divide-gray-200 text-left">
                      <thead className="bg-gray-50/70 text-gray-500 font-bold text-xs">
                        <tr>
                          <th className="px-5 py-3 text-[11px] uppercase tracking-wider">Código SIG</th>
                          <th className="px-5 py-3 text-[11px] uppercase tracking-wider">Descripción Medicamento</th>
                          <th className="px-5 py-3 text-[11px] uppercase tracking-wider">Lote / Venc.</th>
                          <th className="px-5 py-3 text-[11px] uppercase tracking-wider">Stock</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 text-xs">
                        {finalFilteredItems.map((item, idx) => {
                          return (
                            <tr key={`${item.id}_${idx}`} className="hover:bg-slate-50/50 transition-colors">
                              
                              {/* Codigo SISMED */}
                              <td className="px-5 py-3 font-mono font-bold text-gray-500 whitespace-nowrap">
                                {item.codigo_sig}
                              </td>

                              {/* Description name */}
                              <td className="px-5 py-3">
                                <div>
                                  <span className="font-bold text-gray-800 block line-clamp-1 max-w-[280px]" title={item.xnom}>{item.xnom}</span>
                                  <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-400 font-semibold font-mono">
                                    <span>FF: {item.ffinan_des}</span>
                                    <span>•</span>
                                    <span>T: {item.tipsum_des}</span>
                                  </div>
                                </div>
                              </td>

                              {/* Lote / Expiration date */}
                              <td className="px-5 py-3 whitespace-nowrap">
                                <div className="space-y-0.5">
                                  <span className="font-bold text-gray-700 bg-slate-100 px-1 py-0.2 rounded border text-[10px] font-mono select-all">L:{item.lote}</span>
                                  <span className="text-[10px] text-gray-400 block font-mono">Venc: {item.fecha}</span>
                                </div>
                              </td>

                              {/* Balance Stock */}
                              <td className="px-5 py-3 font-mono font-black text-gray-800 whitespace-nowrap text-sm">
                                {item.saldo.toLocaleString()}
                              </td>

                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

          </div>

        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl border w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4 text-red-600">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Eliminar base de datos local</h3>
              <p className="text-sm text-gray-600 mb-4">
                ¿Estás seguro de que deseas eliminar TODOS los datos de stock del almacén <strong>{deleteConfirmData.almName}</strong> ({deleteConfirmData.almcod})?
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded p-3 mb-6 flex gap-2 text-xs text-amber-800">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>Esta acción es irreversible y eliminará todos los registros de lotes asociados a este almacén.</p>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  className="px-4 py-2 font-bold text-gray-500 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors border text-sm"
                  onClick={() => setDeleteConfirmData(null)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="px-4 py-2 font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg flex items-center gap-2 transition-colors shadow-sm text-sm"
                  onClick={confirmDeleteWarehouse}
                  disabled={refreshing}
                >
                  {refreshing ? 'Eliminando...' : 'Sí, eliminar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
