import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  ArchiveX,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FilterX,
  Loader2,
  PackageMinus,
  Plus,
  RefreshCw,
  Search,
  Send,
  Trash2,
  X
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../services/api";
import {
  getCurrentImmunizationPeriod,
  getImmunizationScope,
  immunizationApi
} from "../services/immunizationApi";
import {
  HealthFacility,
  ImmunizationProduct,
  ImmunizationReturnBatch,
  ImmunizationReturnItem,
  ImmunizationReturnReason,
  ImmunizationReturnReceptionInput,
  ImmunizationReturnStatus,
  ImmunizationReturnType,
  ImmunizationStockLayer
} from "../types";
import { sortLayersByFefo, periodFromDate } from "../services/immunizationDomain";
import { ImmunizationKpiCard, immunizationInputClass as inputClassName, normalizeImmunizationText as normalizeText, ImmunizationField as Field, formatImmunizationNumber as formatNumber, todayInputValue, ImmunizationTableHeader as HeaderCell, ImmunizationInfoPill as InfoPill } from "./ui/immunization";

type ReturnItemDraft = ImmunizationReturnItem & {
  tempId: string;
  layer: ImmunizationStockLayer;
  product?: ImmunizationProduct;
};

interface ProductStockOption {
  productId: string;
  product?: ImmunizationProduct;
  layers: ImmunizationStockLayer[];
  recommendedLayer: ImmunizationStockLayer;
  totalQuantity: number;
}

const currentPeriod = getCurrentImmunizationPeriod();

const typeLabel = (type: ImmunizationReturnType) => {
  if (type === "DISPOSAL") return "Baja no disponible";
  if (type === "TRANSFER") return "Transferencia sugerida";
  return "Devolucion a UNGET";
};

const reasonLabel = (reason: ImmunizationReturnReason | string) => {
  const labels: Record<string, string> = {
    VENCIDO: "Vencido",
    DETERIORADO: "Deteriorado",
    RUPTURA: "Ruptura",
    CADENA_FRIO: "Cadena de frio",
    DEVOLUCION: "Devolucion",
    TRANSFERENCIA: "Transferencia",
    OTRO: "Otro"
  };
  return labels[reason] || reason;
};

const statusLabel = (status: ImmunizationReturnStatus) => {
  if (status === "SENT") return "Pendiente UNGET";
  if (status === "RECEIVED") return "Recibido";
  if (status === "OBSERVED") return "Observado";
  return "Anulado";
};

const statusClass = (status: ImmunizationReturnStatus) => {
  if (status === "SENT") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "OBSERVED") return "border-red-200 bg-red-50 text-red-700";
  if (status === "RECEIVED") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-slate-200 bg-slate-100 text-slate-600";
};

export const ImmunizationReturnsModule: React.FC = () => {
  const { user } = useAuth();
  const scope = useMemo(() => getImmunizationScope(user), [user]);
  const isIpress = scope.level === "IPRESS" && Boolean(scope.facilityCode);
  const isUnget = scope.level === "UNGET" && Boolean(scope.ungetId);

  const [facilities, setFacilities] = useState<HealthFacility[]>([]);
  const [batches, setBatches] = useState<ImmunizationReturnBatch[]>([]);
  const [detailByReturn, setDetailByReturn] = useState<Record<string, ImmunizationReturnItem[]>>({});
  const [expandedId, setExpandedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingForm, setLoadingForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stockLayers, setStockLayers] = useState<ImmunizationStockLayer[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [receptionOpen, setReceptionOpen] = useState(false);
  const [receptionBatch, setReceptionBatch] = useState<ImmunizationReturnBatch | null>(null);
  const [receptionItems, setReceptionItems] = useState<ImmunizationReturnItem[]>([]);
  const [search, setSearch] = useState("");
  const [periodFilter, setPeriodFilter] = useState(currentPeriod);
  const [statusFilter, setStatusFilter] = useState<"ALL" | ImmunizationReturnStatus>("ALL");
  const [typeFilter, setTypeFilter] = useState<"ALL" | ImmunizationReturnType>("ALL");

  useEffect(() => {
    let active = true;
    api.getFacilities()
      .then(rows => {
        if (active) setFacilities([...rows].sort((a, b) => a.name.localeCompare(b.name)));
      })
      .catch(() => toast.error("No se pudieron cargar establecimientos"));
    return () => { active = false; };
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await immunizationApi.listReturnBatches(scope);
      setBatches(rows);
      setExpandedId("");
      setDetailByReturn({});
    } catch {
      toast.error("No se pudieron cargar devoluciones y bajas.");
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const facilityByCode = useMemo(() => {
    const map = new Map<string, HealthFacility>();
    facilities.forEach(facility => map.set(facility.code, facility));
    return map;
  }, [facilities]);

  const destinationFacilities = useMemo(
    () => facilities.filter(facility => facility.ungetId && facility.ungetId === scope.ungetId && facility.code !== scope.facilityCode),
    [facilities, scope.facilityCode, scope.ungetId]
  );

  const periodOptions = useMemo(() => {
    const periods = new Set(batches.map(batch => batch.period).filter(Boolean));
    periods.add(currentPeriod);
    return Array.from(periods).sort((a, b) => b.localeCompare(a));
  }, [batches]);

  const visibleBatches = useMemo(() => {
    const query = normalizeText(search);
    return batches.filter(batch => {
      if (periodFilter !== "ALL" && batch.period !== periodFilter) return false;
      if (statusFilter !== "ALL" && batch.status !== statusFilter) return false;
      if (typeFilter !== "ALL" && batch.returnType !== typeFilter) return false;
      if (!query) return true;
      const origin = facilityByCode.get(batch.originFacilityCode);
      const destination = batch.suggestedDestinationFacilityCode ? facilityByCode.get(batch.suggestedDestinationFacilityCode) : undefined;
      return normalizeText([
        batch.referenceDocument,
        batch.originFacilityCode,
        origin?.name,
        destination?.name,
        batch.reason,
        batch.observation,
        batch.createdBy
      ].filter(Boolean).join(" ")).includes(query);
    });
  }, [batches, facilityByCode, periodFilter, search, statusFilter, typeFilter]);

  const totals = useMemo(() => ({
    pending: batches.filter(batch => batch.status === "SENT").length,
    received: batches.filter(batch => batch.status === "RECEIVED").length,
    observed: batches.filter(batch => batch.status === "OBSERVED").length,
    disposals: batches.filter(batch => batch.returnType === "DISPOSAL").length
  }), [batches]);

  const openForm = async () => {
    if (!isIpress) {
      toast.warning("Solo una IPRESS puede registrar bajas o devoluciones.");
      return;
    }
    setLoadingForm(true);
    try {
      const layers = await immunizationApi.getStockLayers(scope);
      const activeLayers = layers.filter(layer => layer.ownerType === "IPRESS" && layer.facilityCode === scope.facilityCode && layer.isActive && layer.currentQuantity > 0);
      if (activeLayers.length === 0) {
        toast.warning("La IPRESS no tiene stock disponible para registrar una baja o devolucion.");
        return;
      }
      setStockLayers(activeLayers);
      setFormOpen(true);
    } catch {
      toast.error("No se pudo cargar el stock IPRESS.");
    } finally {
      setLoadingForm(false);
    }
  };

  const getDetails = async (batch: ImmunizationReturnBatch) => {
    const id = batch.id || "";
    if (!id) return [];
    if (detailByReturn[id]) return detailByReturn[id];
    try {
      const items = await immunizationApi.getReturnItems(id);
      setDetailByReturn(current => ({ ...current, [id]: items }));
      return items;
    } catch {
      toast.error("No se pudo cargar el detalle.");
      return [];
    }
  };

  const toggleDetail = async (batch: ImmunizationReturnBatch) => {
    const id = batch.id || "";
    if (expandedId === id) {
      setExpandedId("");
      return;
    }
    setExpandedId(id);
    await getDetails(batch);
  };

  const saveReturn = async (batch: ImmunizationReturnBatch, items: ImmunizationReturnItem[]) => {
    setSaving(true);
    try {
      const result = await immunizationApi.createReturnBatch(scope, batch, items, user?.username);
      if (!result.success) {
        toast.error(result.message || "No se pudo registrar.");
        return;
      }
      toast.success(batch.returnType === "DISPOSAL" ? "Baja enviada a UNGET para recepcion." : "Devolucion enviada a UNGET para recepcion.");
      setFormOpen(false);
      await loadData();
    } finally {
      setSaving(false);
    }
  };

  const openReception = async (batch: ImmunizationReturnBatch) => {
    const items = await getDetails(batch);
    setReceptionBatch(batch);
    setReceptionItems(items);
    setReceptionOpen(true);
  };

  const receiveReturn = async (input: ImmunizationReturnReceptionInput) => {
    if (!receptionBatch?.id) return;
    setSaving(true);
    try {
      const result = await immunizationApi.receiveReturnBatch(scope, receptionBatch.id, user?.username, input);
      if (!result.success) {
        toast.error(result.message || "No se pudo aceptar la recepcion.");
        return;
      }
      toast.success("Recepcion registrada.");
      setReceptionOpen(false);
      setReceptionBatch(null);
      await loadData();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-amber-50 p-3 text-amber-700">
              <ArchiveX className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-black text-slate-900">Devoluciones y Bajas</h2>
                <span className="rounded-lg border border-teal-100 bg-teal-50 px-2 py-1 text-[10px] font-black uppercase text-teal-700">Periodo {currentPeriod}</span>
              </div>
              <p className="mt-1 max-w-4xl text-sm text-slate-500">
                Registra bajas no disponibles, devoluciones y transferencias desde IPRESS hacia UNGET. La UNGET confirma recepcion y audita diferencias fisicas.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={() => void loadData()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Actualizar
            </button>
            {isIpress && (
              <button type="button" onClick={() => void openForm()} disabled={loadingForm} className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-black text-white shadow-sm hover:bg-amber-700 disabled:opacity-50">
                {loadingForm ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Nuevo registro
              </button>
            )}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <ImmunizationKpiCard label="Pendientes" value={formatNumber(totals.pending)} />
        <ImmunizationKpiCard label="Recibidos" value={formatNumber(totals.received)} />
        <ImmunizationKpiCard label="Observados" value={formatNumber(totals.observed)} />
        <ImmunizationKpiCard label="Bajas" value={formatNumber(totals.disposals)} />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input value={search} onChange={event => setSearch(event.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-400 focus:border-teal-500 focus:ring-4 focus:ring-teal-100" placeholder="Buscar por IPRESS, referencia, motivo o usuario..." />
          </div>
          <select value={periodFilter} onChange={event => setPeriodFilter(event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100 xl:w-40">
            <option value="ALL">Todos los meses</option>
            {periodOptions.map(period => <option key={period} value={period}>{period}</option>)}
          </select>
          <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as any)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100 xl:w-44">
            <option value="ALL">Todos los estados</option>
            <option value="SENT">Pendientes</option>
            <option value="RECEIVED">Recibidos</option>
            <option value="OBSERVED">Observados</option>
          </select>
          <select value={typeFilter} onChange={event => setTypeFilter(event.target.value as any)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100 xl:w-52">
            <option value="ALL">Todos los tipos</option>
            <option value="DISPOSAL">Bajas no disponibles</option>
            <option value="RETURN">Devoluciones</option>
            <option value="TRANSFER">Transferencias</option>
          </select>
          <button type="button" onClick={() => { setSearch(""); setPeriodFilter(currentPeriod); setStatusFilter("ALL"); setTypeFilter("ALL"); }} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50">
            <FilterX className="h-4 w-4" />Limpiar
          </button>
        </div>
      </section>

      {isUnget && batches.some(batch => batch.status === "SENT") && (
        <section className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-950">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <h3 className="text-sm font-black">Hay recepciones pendientes</h3>
            <p className="mt-1 text-xs leading-5 text-amber-800">La UNGET debe verificar fisicamente lo devuelto o dado de baja por sus IPRESS.</p>
          </div>
        </section>
      )}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 p-4">
          <div className="flex items-center gap-2">
            <PackageMinus className="h-4 w-4 text-amber-600" />
            <h3 className="text-sm font-black uppercase tracking-wide text-slate-900">Historial de devoluciones y bajas</h3>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-600">{visibleBatches.length} visibles</span>
        </div>

        {loading && batches.length === 0 ? (
          <div className="flex justify-center py-16"><div className="h-9 w-9 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" /></div>
        ) : visibleBatches.length === 0 ? (
          <div className="p-10 text-center">
            <ArchiveX className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <h3 className="font-black text-slate-800">Sin registros</h3>
            <p className="mt-1 text-sm text-slate-500">Los movimientos apareceran cuando una IPRESS registre una baja o devolucion.</p>
          </div>
        ) : (
          <div className={`overflow-x-auto ${loading ? "opacity-60 pointer-events-none transition-opacity duration-200" : "transition-opacity duration-200"}`}>
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  <HeaderCell>Fecha / periodo</HeaderCell>
                  <HeaderCell>Tipo / motivo</HeaderCell>
                  <HeaderCell>IPRESS origen</HeaderCell>
                  <HeaderCell>Destino sugerido</HeaderCell>
                  <HeaderCell>Referencia</HeaderCell>
                  <HeaderCell>Estado</HeaderCell>
                  <HeaderCell>Usuario</HeaderCell>
                  <HeaderCell align="right">Acciones</HeaderCell>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleBatches.map(batch => {
                  const origin = facilityByCode.get(batch.originFacilityCode);
                  const destination = batch.suggestedDestinationFacilityCode ? facilityByCode.get(batch.suggestedDestinationFacilityCode) : undefined;
                  const details = batch.id ? detailByReturn[batch.id] : undefined;
                  return (
                    <React.Fragment key={batch.id}>
                      <tr className="hover:bg-slate-50/70">
                        <td className="px-4 py-3"><p className="text-xs font-black text-slate-800">{batch.movementDate || "-"}</p><p className="mt-1 font-mono text-[10px] font-bold text-teal-700">{batch.period}</p></td>
                        <td className="px-4 py-3"><p className="text-xs font-black text-slate-900">{typeLabel(batch.returnType)}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">{reasonLabel(batch.reason)}</p></td>
                        <td className="px-4 py-3"><p className="text-xs font-black text-slate-800">{origin?.name || batch.originFacilityCode}</p><p className="font-mono text-[10px] text-slate-400">{batch.originFacilityCode}</p></td>
                        <td className="px-4 py-3 text-xs font-bold text-slate-600">{destination ? `${destination.name} (${destination.code})` : "-"}</td>
                        <td className="px-4 py-3 text-xs text-slate-600">{batch.referenceDocument || "-"}</td>
                        <td className="px-4 py-3"><span className={`rounded-lg border px-2 py-1 text-[10px] font-black uppercase ${statusClass(batch.status)}`}>{statusLabel(batch.status)}</span></td>
                        <td className="px-4 py-3 text-xs text-slate-500">{batch.createdBy || "-"}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            {isUnget && batch.status === "SENT" && (
                              <button type="button" onClick={() => void openReception(batch)} className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white hover:bg-emerald-700">
                                <CheckCircle2 className="h-4 w-4" />Recepcionar
                              </button>
                            )}
                            <button type="button" onClick={() => void toggleDetail(batch)} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800" aria-label="Ver detalle">
                              {expandedId === batch.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedId === batch.id && (
                        <tr>
                          <td colSpan={8} className="bg-slate-50/70 px-4 py-3">
                            <ReturnDetail items={details || []} loading={!details} />
                            {(batch.receptionReason || batch.receptionObservation) && (
                              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
                                <p className="font-black">Observacion de recepcion</p>
                                <p className="mt-1">{[batch.receptionReason, batch.receptionObservation].filter(Boolean).join(" | ")}</p>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ReturnFormModal
        isOpen={formOpen}
        layers={stockLayers}
        facilities={destinationFacilities}
        isSaving={saving}
        onClose={() => { if (!saving) setFormOpen(false); }}
        onSubmit={(batch, items) => void saveReturn(batch, items)}
      />

      <ReturnReceptionModal
        isOpen={receptionOpen}
        batch={receptionBatch}
        items={receptionItems}
        isSaving={saving}
        onClose={() => { if (!saving) setReceptionOpen(false); }}
        onSubmit={input => void receiveReturn(input)}
      />
    </div>
  );
};

function ReturnFormModal({
  isOpen,
  layers,
  facilities,
  isSaving,
  onClose,
  onSubmit
}: {
  isOpen: boolean;
  layers: ImmunizationStockLayer[];
  facilities: HealthFacility[];
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (batch: ImmunizationReturnBatch, items: ImmunizationReturnItem[]) => void;
}) {
  const searchRef = useRef<HTMLInputElement>(null);
  const [returnType, setReturnType] = useState<ImmunizationReturnType>("DISPOSAL");
  const [reason, setReason] = useState<ImmunizationReturnReason>("VENCIDO");
  const [movementDate, setMovementDate] = useState(todayInputValue());
  const [period, setPeriod] = useState(periodFromDate(todayInputValue()));
  const [referenceDocument, setReferenceDocument] = useState("");
  const [destinationFacilityCode, setDestinationFacilityCode] = useState("");
  const [observation, setObservation] = useState("");
  const [selectedLayerId, setSelectedLayerId] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [resultsOpen, setResultsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [quantity, setQuantity] = useState("");
  const [itemObservation, setItemObservation] = useState("");
  const [items, setItems] = useState<ReturnItemDraft[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    const today = todayInputValue();
    setReturnType("DISPOSAL");
    setReason("VENCIDO");
    setMovementDate(today);
    setPeriod(periodFromDate(today));
    setReferenceDocument("");
    setDestinationFacilityCode("");
    setObservation("");
    setSelectedLayerId("");
    setProductSearch("");
    setResultsOpen(false);
    setActiveIndex(0);
    setQuantity("");
    setItemObservation("");
    setItems([]);
    setError("");
    window.setTimeout(() => searchRef.current?.focus(), 80);
  }, [isOpen]);

  const usedLayerIds = useMemo(() => new Set(items.map(item => item.sourceStockLayerId)), [items]);
  const selectedLayer = layers.find(layer => layer.id === selectedLayerId);
  const selectedProduct = selectedLayer?.product;

  const productOptions = useMemo<ProductStockOption[]>(() => {
    const grouped = new Map<string, ImmunizationStockLayer[]>();
    layers
      .filter(layer => !usedLayerIds.has(layer.id || ""))
      .forEach(layer => grouped.set(layer.productId, [...(grouped.get(layer.productId) || []), layer]));

    return Array.from(grouped.entries()).map(([productId, productLayers]) => {
      const sortedLayers = [...productLayers].sort(sortLayersByFefo);
      const product = sortedLayers[0]?.product;
      return {
        productId,
        product,
        layers: sortedLayers,
        recommendedLayer: sortedLayers[0],
        totalQuantity: sortedLayers.reduce((sum, layer) => sum + Math.max(layer.currentQuantity, 0), 0)
      };
    }).sort((a, b) => `${a.product?.codigoSismed || ""}${a.product?.descripcion || ""}`.localeCompare(`${b.product?.codigoSismed || ""}${b.product?.descripcion || ""}`));
  }, [layers, usedLayerIds]);

  const filteredProducts = useMemo(() => {
    const query = normalizeText(productSearch);
    return productOptions
      .filter(option => !query || normalizeText(`${option.product?.codigoSismed || option.productId} ${option.product?.descripcion || ""}`).includes(query))
      .slice(0, 12);
  }, [productOptions, productSearch]);

  const selectableLayersForProduct = useMemo(() => {
    if (!selectedLayer) return [];
    return layers
      .filter(layer => layer.productId === selectedLayer.productId)
      .filter(layer => layer.id === selectedLayerId || !usedLayerIds.has(layer.id || ""))
      .sort(sortLayersByFefo);
  }, [layers, selectedLayer, selectedLayerId, usedLayerIds]);

  if (!isOpen) return null;

  const selectedIsFefo = Boolean(selectedLayerId && selectedLayerId === selectableLayersForProduct[0]?.id);
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

  const selectLayer = (layer: ImmunizationStockLayer) => {
    const product = layer.product;
    setSelectedLayerId(layer.id || "");
    setProductSearch(`${product?.codigoSismed || ""} - ${product?.descripcion || ""}`);
    setResultsOpen(false);
    setActiveIndex(0);
    setError("");
  };

  const selectProduct = (option: ProductStockOption) => {
    selectLayer(option.recommendedLayer);
  };

  const resetItemForm = () => {
    setSelectedLayerId("");
    setProductSearch("");
    setQuantity("");
    setItemObservation("");
    setResultsOpen(false);
    setActiveIndex(0);
    window.setTimeout(() => searchRef.current?.focus(), 0);
  };

  const addItem = () => {
    const requested = Number(quantity);
    if (!selectedLayer?.id || !selectedProduct) {
      setError("Seleccione un producto del stock.");
      return;
    }
    if (!Number.isFinite(requested) || requested <= 0) {
      setError("Ingrese una cantidad mayor a cero.");
      return;
    }
    if (requested > selectedLayer.currentQuantity) {
      setError(`No puede retirar mas del saldo disponible (${selectedLayer.currentQuantity}).`);
      return;
    }
    setItems(current => [...current, {
      tempId: `return-item-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      returnId: undefined,
      productId: selectedLayer.productId,
      sourceStockLayerId: selectedLayer.id,
      codigoSismedSnapshot: selectedProduct.codigoSismed,
      lote: selectedLayer.lote,
      expirationDate: selectedLayer.expirationDate,
      quantity: requested,
      unitPrice: selectedLayer.unitPrice,
      fundingSource: selectedLayer.fundingSource,
      supplyType: selectedLayer.supplyType,
      observation: [selectedIsFefo ? "FEFO automatico" : "Lote elegido manualmente fuera de FEFO", itemObservation.trim()].filter(Boolean).join(" | ") || undefined,
      layer: selectedLayer,
      product: selectedProduct
    }]);
    setError("");
    resetItemForm();
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (returnType === "TRANSFER" && !destinationFacilityCode) {
      setError("Seleccione la IPRESS destino sugerida.");
      return;
    }
    if (items.length === 0) {
      setError("Agregue al menos un producto/lote.");
      return;
    }
    onSubmit({
      returnType,
      status: "SENT",
      originUngetId: "",
      originFacilityCode: "",
      suggestedDestinationFacilityCode: returnType === "TRANSFER" ? destinationFacilityCode : undefined,
      period,
      movementDate,
      referenceDocument: referenceDocument.trim() || undefined,
      reason,
      observation: observation.trim() || undefined
    }, items.map(({ tempId, layer, product, ...item }) => item));
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!resultsOpen || filteredProducts.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex(current => Math.min(current + 1, filteredProducts.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex(current => Math.max(current - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      selectProduct(filteredProducts[activeIndex]);
    } else if (event.key === "Escape") {
      setResultsOpen(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[1190000] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm animate-in fade-in duration-200 sm:p-5" onMouseDown={event => {
      if (event.target === event.currentTarget && !isSaving) onClose();
    }}>
      <section role="dialog" aria-modal="true" className="my-auto w-full max-w-6xl overflow-hidden rounded-3xl border border-white/70 bg-white shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-3 duration-200">
        <header className="flex items-start justify-between border-b border-slate-100 bg-gradient-to-r from-amber-50 to-white px-5 py-5 sm:px-7">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-amber-100 p-3 text-amber-700"><ArchiveX className="h-6 w-6" /></div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">Salida IPRESS</p>
              <h2 className="mt-1 text-xl font-black text-slate-900">Nueva devolucion o baja</h2>
              <p className="mt-1 text-xs text-slate-500">Descuenta stock IPRESS y queda pendiente de recepcion por la UNGET.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={isSaving} aria-label="Cerrar formulario" className="rounded-xl p-2 text-slate-400 hover:bg-white hover:text-slate-700 disabled:opacity-40">
            <X className="h-5 w-5" />
          </button>
        </header>

        <form onSubmit={submit}>
          <div className="max-h-[72vh] space-y-5 overflow-y-auto overflow-x-hidden p-5 sm:p-7">
            <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Fecha" required>
                  <input type="date" value={movementDate} onChange={event => { setMovementDate(event.target.value); setPeriod(periodFromDate(event.target.value)); }} disabled={isSaving} className={inputClassName} />
                </Field>
                <Field label="Periodo" required>
                  <input value={period} readOnly disabled className={inputClassName} />
                </Field>
                <Field label="Tipo" required>
                  <select value={returnType} onChange={event => {
                    const nextType = event.target.value as ImmunizationReturnType;
                    setReturnType(nextType);
                    setReason(nextType === "DISPOSAL" ? "VENCIDO" : nextType === "TRANSFER" ? "TRANSFERENCIA" : "DEVOLUCION");
                  }} disabled={isSaving} className={inputClassName}>
                    <option value="DISPOSAL">Baja no disponible</option>
                    <option value="RETURN">Devolucion a UNGET</option>
                    <option value="TRANSFER">Transferencia sugerida</option>
                  </select>
                </Field>
                <Field label="Motivo" required>
                  <select value={reason} onChange={event => setReason(event.target.value as ImmunizationReturnReason)} disabled={isSaving} className={inputClassName}>
                    {returnType === "DISPOSAL" ? (
                      <>
                        <option value="VENCIDO">Vencido</option>
                        <option value="DETERIORADO">Deteriorado</option>
                        <option value="RUPTURA">Ruptura</option>
                        <option value="CADENA_FRIO">Cadena de frio</option>
                        <option value="OTRO">Otro</option>
                      </>
                    ) : returnType === "TRANSFER" ? (
                      <>
                        <option value="TRANSFERENCIA">Transferencia</option>
                        <option value="OTRO">Otro</option>
                      </>
                    ) : (
                      <>
                        <option value="DEVOLUCION">Devolucion</option>
                        <option value="OTRO">Otro</option>
                      </>
                    )}
                  </select>
                </Field>
                {returnType === "TRANSFER" && (
                  <div className="md:col-span-2">
                    <Field label="IPRESS destino sugerida" required>
                      <select value={destinationFacilityCode} onChange={event => setDestinationFacilityCode(event.target.value)} disabled={isSaving} className={inputClassName}>
                        <option value="">Seleccione destino...</option>
                        {facilities.map(facility => <option key={facility.code} value={facility.code}>{facility.code} · {facility.name}</option>)}
                      </select>
                    </Field>
                  </div>
                )}
                <Field label="Documento / referencia">
                  <input value={referenceDocument} onChange={event => setReferenceDocument(event.target.value)} disabled={isSaving} className={inputClassName} placeholder="Opcional" />
                </Field>
                <div className={returnType === "TRANSFER" ? "md:col-span-2 xl:col-span-4" : "md:col-span-2 xl:col-span-3"}>
                  <Field label="Observacion general">
                    <textarea value={observation} onChange={event => setObservation(event.target.value)} disabled={isSaving} className={`${inputClassName} min-h-20 resize-y py-3`} placeholder="Sustento de la baja, devolucion o transferencia..." />
                  </Field>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center gap-2">
                <PackageMinus className="h-4 w-4 text-amber-700" />
                <h3 className="text-xs font-black uppercase tracking-wide text-slate-700">Agregar producto/lote</h3>
              </div>
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
                <div className="xl:col-span-6">
                  <Field label="Producto del stock" required>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3.5 top-3.5 z-10 h-5 w-5 text-slate-400" />
                      <input
                        ref={searchRef}
                        type="search"
                        role="combobox"
                        aria-expanded={resultsOpen}
                        value={productSearch}
                        onFocus={() => { if (!selectedLayerId) setResultsOpen(true); }}
                        onBlur={() => window.setTimeout(() => setResultsOpen(false), 150)}
                        onKeyDown={handleKeyDown}
                        onChange={event => {
                          setProductSearch(event.target.value);
                          setSelectedLayerId("");
                          setResultsOpen(true);
                          setActiveIndex(0);
                        }}
                        disabled={isSaving}
                        autoComplete="off"
                        placeholder="Buscar codigo SISMED o descripcion..."
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-10 text-sm font-semibold text-slate-800 outline-none transition-shadow placeholder:text-slate-400 focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
                      />
                      {selectedLayerId && (
                        <button type="button" onMouseDown={event => event.preventDefault()} onClick={resetItemForm} aria-label="Cambiar producto" className="absolute right-2.5 top-2.5 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                          <X className="h-4 w-4" />
                        </button>
                      )}
                      {resultsOpen && !selectedLayerId && (
                        <div className="absolute z-50 mt-2 max-h-80 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xl">
                          {filteredProducts.length === 0 ? (
                            <div className="px-4 py-6 text-center"><p className="text-sm font-black text-slate-700">Producto no encontrado</p><p className="mt-1 text-xs text-slate-500">Solo se puede retirar stock existente de la IPRESS.</p></div>
                          ) : filteredProducts.map((option, index) => {
                            const layer = option.recommendedLayer;
                            return (
                              <button key={option.productId} type="button" onMouseDown={event => event.preventDefault()} onMouseEnter={() => setActiveIndex(index)} onClick={() => selectProduct(option)} className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${index === activeIndex ? "bg-amber-50" : "hover:bg-slate-50"}`}>
                                <span className="shrink-0 rounded-lg bg-slate-100 px-2 py-1 font-mono text-xs font-black text-teal-700">{option.product?.codigoSismed || "-"}</span>
                                <span className="min-w-0"><span className="block text-sm font-black text-slate-900">{option.product?.descripcion || "Producto no encontrado"}</span><span className="mt-0.5 block text-[10px] font-black uppercase tracking-wide text-slate-400">Stock {option.totalQuantity} · {option.layers.length} lote{option.layers.length === 1 ? "" : "s"} · FEFO sugerido: {layer.lote} vence {layer.expirationDate}</span></span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </Field>
                </div>
                <div className="xl:col-span-2">
                  <Field label="Cantidad" required>
                    <input type="number" min="1" step="1" value={quantity} onChange={event => setQuantity(event.target.value)} disabled={isSaving} className={inputClassName} placeholder="Frascos/unid." />
                  </Field>
                </div>
                <div className="xl:col-span-3">
                  <Field label="Obs. item">
                    <input value={itemObservation} onChange={event => setItemObservation(event.target.value)} disabled={isSaving} className={inputClassName} placeholder="Opcional" />
                  </Field>
                </div>
                <div className="flex items-end xl:col-span-1">
                  <button type="button" onClick={addItem} disabled={isSaving} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-black text-white hover:bg-slate-800 disabled:opacity-50">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {selectedLayer && selectedProduct && (
                <div className="mt-3 rounded-2xl border border-amber-100 bg-amber-50/60 p-3 text-xs">
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                      <InfoPill label="Lote" value={selectedLayer.lote} />
                      <InfoPill label="Vencimiento" value={selectedLayer.expirationDate} />
                      <InfoPill label="Saldo lote" value={formatNumber(selectedLayer.currentQuantity)} />
                      <InfoPill label="Precio" value={`S/ ${selectedLayer.unitPrice.toFixed(2)}`} />
                      <InfoPill label="FEFO" value={selectedIsFefo ? "Sugerido" : "Manual"} />
                    </div>
                    <Field label="Elegir lote">
                      <select value={selectedLayerId} onChange={event => {
                        const layer = selectableLayersForProduct.find(row => row.id === event.target.value);
                        if (layer) selectLayer(layer);
                      }} disabled={isSaving} className={inputClassName}>
                        {selectableLayersForProduct.map((layer, index) => (
                          <option key={layer.id} value={layer.id}>{index === 0 ? "FEFO sugerido · " : "Manual · "}Lote {layer.lote} · vence {layer.expirationDate} · saldo {layer.currentQuantity}</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                </div>
              )}
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="flex flex-col gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-xs font-black uppercase tracking-wide text-slate-700">Detalle del registro</h3>
                <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-wide">
                  <span className="rounded-lg bg-amber-50 px-2 py-1 text-amber-700">{items.length} items</span>
                  <span className="rounded-lg bg-slate-100 px-2 py-1 text-slate-600">{formatNumber(totalQuantity)} fco/unid.</span>
                </div>
              </div>
              {items.length === 0 ? (
                <div className="p-8 text-center"><ArchiveX className="mx-auto mb-2 h-9 w-9 text-slate-300" /><p className="text-sm font-bold text-slate-600">Agregue uno o mas productos/lotes al registro.</p></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-slate-50">
                      <tr>
                        <HeaderCell>Codigo</HeaderCell>
                        <HeaderCell>Producto</HeaderCell>
                        <HeaderCell>Lote</HeaderCell>
                        <HeaderCell align="right">Cantidad</HeaderCell>
                        <HeaderCell>Fuente</HeaderCell>
                        <HeaderCell>Suministro</HeaderCell>
                        <HeaderCell align="right">Quitar</HeaderCell>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.map(item => (
                        <tr key={item.tempId}>
                          <td className="px-3 py-3 font-mono text-xs font-black text-teal-700">{item.codigoSismedSnapshot}</td>
                          <td className="max-w-md px-3 py-3 text-xs font-bold text-slate-800">{item.product?.descripcion || "-"}</td>
                          <td className="px-3 py-3 text-xs font-black text-slate-700">{item.lote}</td>
                          <td className="px-3 py-3 text-right text-xs font-black text-slate-900">{formatNumber(item.quantity)}</td>
                          <td className="px-3 py-3 text-xs text-slate-600">{item.fundingSource}</td>
                          <td className="px-3 py-3 text-xs text-slate-600">{item.supplyType}</td>
                          <td className="px-3 py-3 text-right"><button type="button" onClick={() => setItems(current => current.filter(row => row.tempId !== item.tempId))} disabled={isSaving} className="rounded-lg p-2 text-red-500 hover:bg-red-50 disabled:opacity-40"><Trash2 className="h-4 w-4" /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
            {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}
          </div>

          <footer className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/80 p-4 sm:flex-row sm:justify-end sm:px-7">
            <button type="button" onClick={onClose} disabled={isSaving} className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-100 disabled:opacity-50">Cancelar</button>
            <button type="submit" disabled={isSaving || items.length === 0} className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-black text-white shadow-sm hover:bg-amber-700 disabled:opacity-50">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {isSaving ? "Guardando..." : "Enviar a UNGET"}
            </button>
          </footer>
        </form>
      </section>
    </div>,
    document.body
  );
}

function ReturnReceptionModal({
  isOpen,
  batch,
  items,
  isSaving,
  onClose,
  onSubmit
}: {
  isOpen: boolean;
  batch: ImmunizationReturnBatch | null;
  items: ImmunizationReturnItem[];
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (input: ImmunizationReturnReceptionInput) => void;
}) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [observation, setObservation] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setQuantities(Object.fromEntries(items.map(item => [item.id || "", item.quantity])));
    setReason("");
    setObservation("");
    setError("");
  }, [isOpen, items]);

  if (!isOpen || !batch) return null;
  const hasDifference = items.some(item => Number(quantities[item.id || ""] ?? item.quantity) !== item.quantity);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (hasDifference && !reason) {
      setError("Seleccione motivo cuando existe diferencia fisica.");
      return;
    }
    if ((hasDifference || reason) && !observation.trim()) {
      setError("Ingrese observacion de recepcion.");
      return;
    }
    onSubmit({
      reason: reason || undefined,
      observation: observation.trim() || undefined,
      items: items.map(item => ({ itemId: item.id || "", receivedQuantity: Number(quantities[item.id || ""] ?? item.quantity) }))
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-[1190000] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm sm:p-5" onMouseDown={event => {
      if (event.target === event.currentTarget && !isSaving) onClose();
    }}>
      <section role="dialog" aria-modal="true" className="my-auto w-full max-w-4xl overflow-hidden rounded-3xl border border-white/70 bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-white px-5 py-5 sm:px-7">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700"><CheckCircle2 className="h-6 w-6" /></div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">Recepcion UNGET</p>
              <h2 className="mt-1 text-xl font-black text-slate-900">Aceptar {typeLabel(batch.returnType).toLowerCase()}</h2>
              <p className="mt-1 text-xs text-slate-500">Confirme cantidades fisicas. Las bajas no disponibles no ingresan al stock UNGET.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={isSaving} className="rounded-xl p-2 text-slate-400 hover:bg-white hover:text-slate-700 disabled:opacity-40"><X className="h-5 w-5" /></button>
        </header>
        <form onSubmit={submit}>
          <div className="max-h-[70vh] space-y-4 overflow-y-auto p-5 sm:p-7">
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50">
                  <tr>
                    <HeaderCell>Producto</HeaderCell>
                    <HeaderCell>Lote</HeaderCell>
                    <HeaderCell align="right">Sistema</HeaderCell>
                    <HeaderCell align="right">Fisico recibido</HeaderCell>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map(item => (
                    <tr key={item.id}>
                      <td className="px-4 py-3"><p className="font-mono text-[10px] font-black text-teal-700">{item.codigoSismedSnapshot}</p><p className="text-xs font-bold text-slate-800">{item.product?.descripcion || "-"}</p></td>
                      <td className="px-4 py-3 text-xs font-black text-slate-700">{item.lote}<p className="mt-1 text-[10px] text-slate-400">Vence {item.expirationDate}</p></td>
                      <td className="px-4 py-3 text-right text-xs font-black text-slate-900">{formatNumber(item.quantity)}</td>
                      <td className="px-4 py-3 text-right">
                        <input type="number" min="0" step="1" value={quantities[item.id || ""] ?? item.quantity} onChange={event => setQuantities(current => ({ ...current, [item.id || ""]: Number(event.target.value) }))} disabled={isSaving} className="h-10 w-32 rounded-xl border border-slate-200 px-3 text-right text-sm font-black outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Motivo de incidencia">
                <select value={reason} onChange={event => setReason(event.target.value)} disabled={isSaving} className={inputClassName}>
                  <option value="">Sin incidencia</option>
                  <option value="FALTANTE_FISICO">Faltante fisico</option>
                  <option value="SOBRANTE_FISICO">Sobrante fisico</option>
                  <option value="LOTE_NO_COINCIDE">Lote no coincide</option>
                  <option value="PRODUCTO_DETERIORADO">Producto deteriorado</option>
                  <option value="OTRO">Otro</option>
                </select>
              </Field>
              <Field label="Observacion de recepcion">
                <input value={observation} onChange={event => setObservation(event.target.value)} disabled={isSaving} className={inputClassName} placeholder="Obligatorio si hay diferencia..." />
              </Field>
            </section>
            {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}
          </div>
          <footer className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/80 p-4 sm:flex-row sm:justify-end sm:px-7">
            <button type="button" onClick={onClose} disabled={isSaving} className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-100 disabled:opacity-50">Cancelar</button>
            <button type="submit" disabled={isSaving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {isSaving ? "Guardando..." : "Registrar recepcion"}
            </button>
          </footer>
        </form>
      </section>
    </div>,
    document.body
  );
}

function ReturnDetail({ items, loading }: { items: ImmunizationReturnItem[]; loading: boolean }) {
  if (loading) return <div className="p-6 text-center text-sm font-bold text-slate-500">Cargando detalle...</div>;
  if (items.length === 0) return <div className="p-6 text-center text-sm font-bold text-slate-500">Sin detalle registrado.</div>;
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <table className="min-w-full divide-y divide-slate-100">
        <thead className="bg-slate-50">
          <tr>
            <HeaderCell>Codigo</HeaderCell>
            <HeaderCell>Producto</HeaderCell>
            <HeaderCell>Lote</HeaderCell>
            <HeaderCell align="right">Cantidad</HeaderCell>
            <HeaderCell align="right">Recibido</HeaderCell>
            <HeaderCell>Fuente</HeaderCell>
            <HeaderCell>Suministro</HeaderCell>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map(item => (
            <tr key={item.id}>
              <td className="px-3 py-3 font-mono text-xs font-black text-teal-700">{item.codigoSismedSnapshot}</td>
              <td className="max-w-md px-3 py-3 text-xs font-bold text-slate-800">{item.product?.descripcion || "-"}</td>
              <td className="px-3 py-3 text-xs font-black text-slate-700">{item.lote}<p className="mt-1 text-[10px] text-slate-400">Vence {item.expirationDate}</p></td>
              <td className="px-3 py-3 text-right text-xs font-black text-slate-900">{formatNumber(item.quantity)}</td>
              <td className="px-3 py-3 text-right text-xs font-black text-slate-900">{item.receivedQuantity === undefined ? "-" : formatNumber(item.receivedQuantity)}</td>
              <td className="px-3 py-3 text-xs text-slate-600">{item.fundingSource}</td>
              <td className="px-3 py-3 text-xs text-slate-600">{item.supplyType}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


