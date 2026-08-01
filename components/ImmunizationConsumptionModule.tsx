import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FilterX,
  Loader2,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  Syringe,
  Trash2,
  X
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import {
  getCurrentImmunizationPeriod,
  getImmunizationScope,
  immunizationApi
} from "../services/immunizationApi";
import {
  ImmunizationConsumptionBatchInput,
  ImmunizationConsumptionItemInput,
  ImmunizationProduct,
  ImmunizationStockLayer,
  ImmunizationStockMovement
} from "../types";

type ConsumptionItemDraft = ImmunizationConsumptionItemInput & {
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

interface ConsumptionGroup {
  id: string;
  period: string;
  createdAt?: string;
  createdBy?: string;
  movements: ImmunizationStockMovement[];
  totalQuantity: number;
  consumedDoses: number;
  dosesApplied: number;
  dosesLost: number;
  lossFactor: number;
  reference?: string;
  consumptionDate?: string;
  activityType?: string;
}

const currentPeriod = getCurrentImmunizationPeriod();
const inputClassName = "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition-shadow placeholder:text-slate-400 focus:border-teal-500 focus:ring-4 focus:ring-teal-100 disabled:bg-slate-100 disabled:text-slate-500";
const todayInputValue = () => new Date().toISOString().slice(0, 10);
const periodFromDate = (value: string) => (/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value) ? value.slice(0, 7) : currentPeriod);
const activityOptions = [
  "Consumo regular",
  "Campaña/Jornada",
  "Barrido",
  "Brigada",
  "Puesto fijo",
  "Otro"
];

const sortLayersByFefo = (a: ImmunizationStockLayer, b: ImmunizationStockLayer) => {
  const expiration = (a.expirationDate || "").localeCompare(b.expirationDate || "");
  if (expiration !== 0) return expiration;
  return (a.lote || "").localeCompare(b.lote || "");
};

const normalizeText = (value: string) => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .trim();

const formatNumber = (value: number, decimals = 0) => value.toLocaleString("es-PE", {
  minimumFractionDigits: decimals,
  maximumFractionDigits: decimals
});

const parseMetric = (observation: string | undefined, label: string) => {
  if (!observation) return undefined;
  const match = observation.match(new RegExp(`${label}:\\s*([0-9]+(?:[.,][0-9]+)?)`, "i"));
  return match ? Number(match[1].replace(",", ".")) : undefined;
};

const parseObservationValue = (observation: string | undefined, label: string) => {
  if (!observation) return undefined;
  const match = observation.match(new RegExp(`${label}:\\s*([^|]+)`, "i"));
  return match?.[1]?.trim();
};

const parseReference = (observation?: string) => parseObservationValue(observation, "Receta") || parseObservationValue(observation, "Referencia");
const parseConsumptionDate = (observation?: string) => parseObservationValue(observation, "Fecha consumo");
const parseActivityType = (observation?: string) => parseObservationValue(observation, "Actividad");

const movementMetrics = (movement: ImmunizationStockMovement) => ({
  consumedDoses: movement.consumedDoses ?? parseMetric(movement.observation, "Dosis consumidas") ?? 0,
  dosesApplied: movement.dosesApplied ?? parseMetric(movement.observation, "Dosis aplicadas") ?? 0,
  dosesLost: movement.dosesLost ?? parseMetric(movement.observation, "Dosis perdidas") ?? 0,
  lossFactor: movement.lossFactor ?? parseMetric(movement.observation, "Factor pérdida") ?? 0
});

export const ImmunizationConsumptionModule: React.FC = () => {
  const { user } = useAuth();
  const scope = useMemo(() => getImmunizationScope(user), [user]);
  const canRecord = scope.level === "IPRESS" && scope.ownerType === "IPRESS" && Boolean(scope.facilityCode);

  const [stockLayers, setStockLayers] = useState<ImmunizationStockLayer[]>([]);
  const [movements, setMovements] = useState<ImmunizationStockMovement[]>([]);
  const [products, setProducts] = useState<ImmunizationProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openingForm, setOpeningForm] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [periodFilter, setPeriodFilter] = useState(currentPeriod);
  const [expandedGroupId, setExpandedGroupId] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [layers, history, catalog] = await Promise.all([
        immunizationApi.getStockLayers(scope),
        immunizationApi.listConsumptionMovements(scope),
        immunizationApi.getProducts(false)
      ]);
      setStockLayers(layers.filter(layer => layer.ownerType === "IPRESS"));
      setMovements(history);
      setProducts(catalog);
    } catch {
      toast.error("No se pudo cargar el consumo IPRESS.");
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const productById = useMemo(() => {
    const map = new Map<string, ImmunizationProduct>();
    products.forEach(product => product.id && map.set(product.id, product));
    stockLayers.forEach(layer => {
      if (layer.product?.id) map.set(layer.product.id, layer.product);
    });
    return map;
  }, [products, stockLayers]);

  const layerById = useMemo(() => {
    const map = new Map<string, ImmunizationStockLayer>();
    stockLayers.forEach(layer => layer.id && map.set(layer.id, layer));
    return map;
  }, [stockLayers]);

  const availableLayers = useMemo(() => stockLayers
    .filter(layer => layer.isActive && layer.currentQuantity > 0)
    .sort((a, b) => {
      const productA = a.product || productById.get(a.productId);
      const productB = b.product || productById.get(b.productId);
      return `${productA?.descripcion || ""}${a.expirationDate}`.localeCompare(`${productB?.descripcion || ""}${b.expirationDate}`);
    }), [productById, stockLayers]);

  const periodOptions = useMemo(() => {
    const periods = new Set(movements.map(movement => movement.period).filter(Boolean));
    periods.add(currentPeriod);
    return Array.from(periods).sort((a, b) => b.localeCompare(a));
  }, [movements]);

  const groups = useMemo<ConsumptionGroup[]>(() => {
    const map = new Map<string, ImmunizationStockMovement[]>();
    movements.forEach(movement => {
      const key = movement.batchId || movement.id || `${movement.createdAt}-${movement.stockLayerId}`;
      map.set(key, [...(map.get(key) || []), movement]);
    });
    return Array.from(map.entries()).map(([id, rows]) => {
      const consumedDoses = rows.reduce((sum, movement) => sum + movementMetrics(movement).consumedDoses, 0);
      const dosesApplied = rows.reduce((sum, movement) => sum + movementMetrics(movement).dosesApplied, 0);
      const dosesLost = rows.reduce((sum, movement) => sum + movementMetrics(movement).dosesLost, 0);
      const totalQuantity = rows.reduce((sum, movement) => sum + Math.abs(movement.quantityDelta), 0);
      const first = rows[0];
      return {
        id,
        period: first.period,
        createdAt: first.createdAt,
        createdBy: first.createdBy,
        movements: rows,
        totalQuantity,
        consumedDoses,
        dosesApplied,
        dosesLost,
        lossFactor: consumedDoses > 0 ? (dosesLost / consumedDoses) * 100 : 0,
        reference: rows.map(row => parseReference(row.observation)).find(Boolean),
        consumptionDate: rows.map(row => parseConsumptionDate(row.observation)).find(Boolean),
        activityType: rows.map(row => parseActivityType(row.observation)).find(Boolean)
      };
    }).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  }, [movements]);

  const visibleGroups = useMemo(() => {
    const query = normalizeText(search);
    return groups.filter(group => {
      if (periodFilter !== "ALL" && group.period !== periodFilter) return false;
      if (!query) return true;
      const haystack = group.movements.map(movement => {
        const product = productById.get(movement.productId);
        const layer = movement.stockLayerId ? layerById.get(movement.stockLayerId) : undefined;
        return [
          group.reference,
          group.consumptionDate,
          group.activityType,
          product?.codigoSismed,
          product?.descripcion,
          layer?.lote,
          movement.reason,
          movement.observation,
          movement.createdBy
        ].filter(Boolean).join(" ");
      }).join(" ");
      return normalizeText(haystack).includes(query);
    });
  }, [groups, layerById, periodFilter, productById, search]);

  const totals = useMemo(() => {
    const currentGroups = groups.filter(group => group.period === currentPeriod);
    const consumed = currentGroups.reduce((sum, group) => sum + group.totalQuantity, 0);
    const applied = currentGroups.reduce((sum, group) => sum + group.dosesApplied, 0);
    const lost = currentGroups.reduce((sum, group) => sum + group.dosesLost, 0);
    const consumedDoses = currentGroups.reduce((sum, group) => sum + group.consumedDoses, 0);
    return {
      records: currentGroups.length,
      stock: availableLayers.reduce((sum, layer) => sum + Math.max(layer.currentQuantity, 0), 0),
      consumed,
      applied,
      lossFactor: consumedDoses > 0 ? (lost / consumedDoses) * 100 : 0
    };
  }, [availableLayers, groups]);

  const saveConsumption = async (input: ImmunizationConsumptionBatchInput) => {
    setSaving(true);
    try {
      const result = await immunizationApi.recordConsumptionBatch(scope, input, user?.username);
      if (!result.success) {
        toast.error(result.message || "No se pudo registrar el consumo.");
        return;
      }
      toast.success("Registro de consumo guardado y stock actualizado.");
      setFormOpen(false);
      setExpandedGroupId(result.batchId || "");
      await loadData();
    } finally {
      setSaving(false);
    }
  };

  const openConsumptionForm = async () => {
    if (!canRecord) {
      toast.warning("Solo una IPRESS operativa puede registrar consumos.");
      return;
    }
    setOpeningForm(true);
    try {
      const locked = await immunizationApi.isPeriodLocked(scope, currentPeriod);
      if (locked) {
        toast.error(`El periodo ${currentPeriod} ya está precerrado o cerrado. No se pueden registrar más consumos. Si necesita corregir, solicite a la UNGET reabrir el precierre.`);
        return;
      }
      setFormOpen(true);
    } catch {
      toast.error("No se pudo validar el estado del periodo antes de abrir el registro.");
    } finally {
      setOpeningForm(false);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
              <ReceiptText className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-black text-slate-900">Consumo IPRESS</h2>
                <span className="rounded-lg border border-teal-100 bg-teal-50 px-2 py-1 text-[10px] font-black uppercase text-teal-700">Periodo {currentPeriod}</span>
              </div>
              <p className="mt-1 max-w-3xl text-sm text-slate-500">
                Registra un movimiento de consumo con varios productos/lotes, similar a una receta. Al guardar, el sistema descuenta todos los ítems del stock.
              </p>
              {scope.facilityCode && <p className="mt-2 text-xs font-bold text-slate-600">IPRESS operativa: <span className="text-teal-700">{user?.facilityData?.name || scope.facilityCode}</span></p>}
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={() => void loadData()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Actualizar
            </button>
            {canRecord && (
              <button type="button" onClick={() => void openConsumptionForm()} disabled={openingForm} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white shadow-sm hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-70">
                {openingForm ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{openingForm ? "Validando..." : "Nuevo registro"}
              </button>
            )}
          </div>
        </div>
      </section>

      {!canRecord && (
        <section className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-950">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <h3 className="text-sm font-black">Registro restringido a IPRESS</h3>
            <p className="mt-1 text-xs leading-5 text-amber-800">
              La UNGET y DIRESA pueden revisar información si tienen permiso, pero el consumo operativo solo lo registra una IPRESS.
            </p>
          </div>
        </section>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <SummaryCard label="Registros mes" value={formatNumber(totals.records)} />
        <SummaryCard label="Stock actual" value={formatNumber(totals.stock)} />
        <SummaryCard label="Consumo mes" value={formatNumber(totals.consumed)} />
        <SummaryCard label="Dosis aplicadas" value={formatNumber(totals.applied)} />
        <SummaryCard label="Factor pérdida" value={`${formatNumber(totals.lossFactor, 2)}%`} />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input value={search} onChange={event => setSearch(event.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-400 focus:border-teal-500 focus:ring-4 focus:ring-teal-100" placeholder="Buscar por registro, producto, lote o usuario..." />
          </div>
          <select value={periodFilter} onChange={event => setPeriodFilter(event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100 lg:w-40" aria-label="Filtrar por periodo">
            <option value="ALL">Todos los meses</option>
            {periodOptions.map(period => <option key={period} value={period}>{period}</option>)}
          </select>
          <button type="button" onClick={() => { setSearch(""); setPeriodFilter(currentPeriod); }} disabled={!search && periodFilter === currentPeriod} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
            <FilterX className="h-4 w-4" />Limpiar
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 p-4">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-600" />
            <h3 className="text-sm font-black uppercase tracking-wide text-slate-900">Registros de consumo</h3>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-600">{visibleGroups.length} visibles</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><div className="h-9 w-9 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" /></div>
        ) : visibleGroups.length === 0 ? (
          <div className="p-10 text-center">
            <ReceiptText className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <h3 className="font-black text-slate-800">Sin registros de consumo</h3>
            <p className="mt-1 text-sm text-slate-500">Use “Nuevo registro” para descargar varios productos en un solo movimiento.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  <HeaderCell>Fecha / periodo</HeaderCell>
                  <HeaderCell>Receta / registro</HeaderCell>
                  <HeaderCell align="right">Ítems</HeaderCell>
                  <HeaderCell align="right">Consumo</HeaderCell>
                  <HeaderCell align="right">Dosis aplicadas</HeaderCell>
                  <HeaderCell align="right">Dosis perdidas</HeaderCell>
                  <HeaderCell align="right">Factor</HeaderCell>
                  <HeaderCell>Usuario</HeaderCell>
                  <HeaderCell align="right">Detalle</HeaderCell>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleGroups.map(group => (
                  <React.Fragment key={group.id}>
                    <tr className="hover:bg-slate-50/70">
                      <td className="px-4 py-3"><p className="text-xs font-black text-slate-800">{group.consumptionDate || (group.createdAt ? new Date(group.createdAt).toLocaleDateString("es-PE") : "-")}</p><p className="mt-1 font-mono text-[10px] font-bold text-teal-700">{group.period}</p></td>
                      <td className="max-w-sm px-4 py-3"><p className="text-xs font-black text-slate-900">{group.reference || "Sin numero"}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">{group.activityType || "Sin actividad"} · {group.id}</p></td>
                      <td className="px-4 py-3 text-right text-xs font-black text-slate-900">{group.movements.length}</td>
                      <td className="px-4 py-3 text-right text-xs font-black text-slate-900">{formatNumber(group.totalQuantity)}</td>
                      <td className="px-4 py-3 text-right text-xs font-black text-slate-900">{formatNumber(group.dosesApplied)}</td>
                      <td className="px-4 py-3 text-right text-xs font-black text-slate-900">{formatNumber(group.dosesLost)}</td>
                      <td className="px-4 py-3 text-right text-xs font-black text-slate-900">{formatNumber(group.lossFactor, 2)}%</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{group.createdBy || "-"}</td>
                      <td className="px-4 py-3 text-right">
                        <button type="button" onClick={() => setExpandedGroupId(current => current === group.id ? "" : group.id)} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800" aria-label="Ver detalle">
                          {expandedGroupId === group.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      </td>
                    </tr>
                    {expandedGroupId === group.id && (
                      <tr>
                        <td colSpan={9} className="bg-slate-50/70 px-4 py-3">
                          <GroupDetail group={group} productById={productById} layerById={layerById} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConsumptionBatchModal
        isOpen={formOpen}
        layers={availableLayers}
        products={productById}
        isSaving={saving}
        onClose={() => { if (!saving) setFormOpen(false); }}
        onSubmit={input => void saveConsumption(input)}
      />
    </div>
  );
};

function ConsumptionBatchModal({
  isOpen,
  layers,
  products,
  isSaving,
  onClose,
  onSubmit
}: {
  isOpen: boolean;
  layers: ImmunizationStockLayer[];
  products: Map<string, ImmunizationProduct>;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (input: ImmunizationConsumptionBatchInput) => void;
}) {
  const searchRef = useRef<HTMLInputElement>(null);
  const [period, setPeriod] = useState(currentPeriod);
  const [referenceDocument, setReferenceDocument] = useState("");
  const [consumptionDate, setConsumptionDate] = useState(todayInputValue());
  const [activityType, setActivityType] = useState(activityOptions[0]);
  const [generalObservation, setGeneralObservation] = useState("");
  const [selectedLayerId, setSelectedLayerId] = useState("");
  const [layerSearch, setLayerSearch] = useState("");
  const [resultsOpen, setResultsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [quantity, setQuantity] = useState("");
  const [dosesApplied, setDosesApplied] = useState("");
  const [itemObservation, setItemObservation] = useState("");
  const [items, setItems] = useState<ConsumptionItemDraft[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    const today = todayInputValue();
    setPeriod(periodFromDate(today));
    setReferenceDocument("");
    setConsumptionDate(today);
    setActivityType(activityOptions[0]);
    setGeneralObservation("");
    setSelectedLayerId("");
    setLayerSearch("");
    setResultsOpen(false);
    setActiveIndex(0);
    setQuantity("");
    setDosesApplied("");
    setItemObservation("");
    setItems([]);
    setError("");
    window.setTimeout(() => searchRef.current?.focus(), 80);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSaving) onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isSaving, onClose]);

  const selectedLayer = layers.find(layer => layer.id === selectedLayerId);
  const selectedProduct = selectedLayer ? selectedLayer.product || products.get(selectedLayer.productId) : undefined;
  const usedLayerIds = useMemo(() => new Set(items.map(item => item.stockLayerId)), [items]);
  const productOptions = useMemo<ProductStockOption[]>(() => {
    const grouped = new Map<string, ImmunizationStockLayer[]>();
    layers
      .filter(layer => !usedLayerIds.has(layer.id || ""))
      .forEach(layer => grouped.set(layer.productId, [...(grouped.get(layer.productId) || []), layer]));

    return Array.from(grouped.entries()).map(([productId, productLayers]) => {
      const sortedLayers = [...productLayers].sort(sortLayersByFefo);
      const product = sortedLayers[0]?.product || products.get(productId);
      return {
        productId,
        product,
        layers: sortedLayers,
        recommendedLayer: sortedLayers[0],
        totalQuantity: sortedLayers.reduce((sum, layer) => sum + Math.max(layer.currentQuantity, 0), 0)
      };
    }).sort((a, b) => `${a.product?.codigoSismed || ""}${a.product?.descripcion || ""}`.localeCompare(`${b.product?.codigoSismed || ""}${b.product?.descripcion || ""}`));
  }, [layers, products, usedLayerIds]);

  const filteredProducts = useMemo(() => {
    const query = normalizeText(layerSearch);
    return productOptions
      .filter(option => {
        if (!query) return true;
        return normalizeText(`${option.product?.codigoSismed || option.productId} ${option.product?.descripcion || ""}`).includes(query);
      })
      .slice(0, 12);
  }, [layerSearch, productOptions]);

  const selectableLayersForProduct = useMemo(() => {
    if (!selectedLayer) return [];
    return layers
      .filter(layer => layer.productId === selectedLayer.productId)
      .filter(layer => layer.id === selectedLayerId || !usedLayerIds.has(layer.id || ""))
      .sort(sortLayersByFefo);
  }, [layers, selectedLayer, selectedLayerId, usedLayerIds]);

  if (!isOpen) return null;

  const consumptionQuantity = Number(quantity);
  const applied = Number(dosesApplied);
  const dosesPerUnit = Number(selectedProduct?.dosisUnidad) || 0;
  const consumedDoses = Number.isFinite(consumptionQuantity) && consumptionQuantity > 0 ? consumptionQuantity * dosesPerUnit : 0;
  const lostDoses = Math.max(consumedDoses - (Number.isFinite(applied) ? applied : 0), 0);
  const lossFactor = consumedDoses > 0 ? (lostDoses / consumedDoses) * 100 : 0;
  const totalQuantity = items.reduce((sum, item) => sum + item.consumptionQuantity, 0);
  const totalApplied = items.reduce((sum, item) => sum + item.dosesApplied, 0);
  const totalConsumedDoses = items.reduce((sum, item) => sum + item.consumptionQuantity * (item.product?.dosisUnidad || 0), 0);
  const totalLost = Math.max(totalConsumedDoses - totalApplied, 0);
  const totalLossFactor = totalConsumedDoses > 0 ? (totalLost / totalConsumedDoses) * 100 : 0;
  const fefoLayerId = selectableLayersForProduct[0]?.id || "";
  const selectedIsFefo = Boolean(selectedLayerId && selectedLayerId === fefoLayerId);

  const selectLayer = (layer: ImmunizationStockLayer) => {
    const product = layer.product || products.get(layer.productId);
    setSelectedLayerId(layer.id || "");
    setLayerSearch(`${product?.codigoSismed || ""} - ${product?.descripcion || ""}`);
    setResultsOpen(false);
    setActiveIndex(0);
    setError("");
  };

  const selectProduct = (option: ProductStockOption) => {
    selectLayer(option.recommendedLayer);
  };

  const resetItemForm = () => {
    setSelectedLayerId("");
    setLayerSearch("");
    setQuantity("");
    setDosesApplied("");
    setItemObservation("");
    setResultsOpen(false);
    setActiveIndex(0);
    window.setTimeout(() => searchRef.current?.focus(), 0);
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

  const addItem = () => {
    if (!selectedLayer?.id || !selectedProduct) {
      setError("Seleccione un producto/lote existente en stock.");
      return;
    }
    if (!Number.isFinite(consumptionQuantity) || consumptionQuantity <= 0) {
      setError("Ingrese consumo en frascos/unidades mayor a cero.");
      return;
    }
    if (consumptionQuantity > selectedLayer.currentQuantity) {
      setError(`No puede consumir más del saldo disponible (${selectedLayer.currentQuantity}).`);
      return;
    }
    if (!Number.isFinite(applied) || applied < 0) {
      setError("Ingrese dosis aplicadas válidas.");
      return;
    }
    if (dosesPerUnit > 0 && applied > consumedDoses) {
      setError(`Las dosis aplicadas no pueden superar las dosis consumidas (${consumedDoses}).`);
      return;
    }
    setItems(current => [...current, {
      tempId: `consumption-item-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      stockLayerId: selectedLayer.id!,
      consumptionQuantity,
      dosesApplied: applied,
      observation: [selectedIsFefo ? "FEFO automatico" : "Lote elegido manualmente fuera de FEFO", itemObservation.trim()].filter(Boolean).join(" | ") || undefined,
      layer: selectedLayer,
      product: selectedProduct
    }]);
    setError("");
    resetItemForm();
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!referenceDocument.trim()) {
      setError("Ingrese el numero de receta o registro.");
      return;
    }
    if (!consumptionDate) {
      setError("Ingrese la fecha de consumo.");
      return;
    }
    if (!activityType.trim()) {
      setError("Seleccione el tipo de actividad.");
      return;
    }
    if (items.length === 0) {
      setError("Agregue al menos un producto/lote al registro.");
      return;
    }
    onSubmit({
      period,
      referenceDocument: referenceDocument.trim() || undefined,
      consumptionDate,
      activityType,
      observation: generalObservation.trim() || undefined,
      items: items.map(({ tempId, layer, product, ...item }) => item)
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-[1190000] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm animate-in fade-in duration-200 sm:p-5" onMouseDown={event => {
      if (event.target === event.currentTarget && !isSaving) onClose();
    }}>
      <section role="dialog" aria-modal="true" aria-labelledby="consumption-modal-title" className="my-auto w-full max-w-6xl overflow-hidden rounded-3xl border border-white/70 bg-white shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-3 duration-200">
        <header className="flex items-start justify-between border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-white px-5 py-5 sm:px-7">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700"><ReceiptText className="h-6 w-6" /></div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">Registro de consumo</p>
              <h2 id="consumption-modal-title" className="mt-1 text-xl font-black text-slate-900">Nuevo consumo IPRESS</h2>
              <p className="mt-1 text-xs text-slate-500">Agrega varios productos/lotes en un solo registro. No se permite consumir lotes inexistentes ni superar saldos.</p>
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
                <Field label="Fecha de consumo" required>
                  <input
                    type="date"
                    value={consumptionDate}
                    onChange={event => {
                      setConsumptionDate(event.target.value);
                      setPeriod(periodFromDate(event.target.value));
                    }}
                    disabled={isSaving}
                    className={inputClassName}
                  />
                </Field>
                <Field label="Periodo" required>
                  <input value={period} readOnly disabled className={inputClassName} placeholder="2026-07" />
                </Field>
                <Field label="N° receta / registro" required>
                  <input value={referenceDocument} onChange={event => setReferenceDocument(event.target.value)} disabled={isSaving} className={inputClassName} placeholder="Ej. REC-000123" />
                </Field>
                <Field label="Tipo de actividad" required>
                  <select value={activityType} onChange={event => setActivityType(event.target.value)} disabled={isSaving} className={inputClassName}>
                    {activityOptions.map(option => <option key={option} value={option}>{option}</option>)}
                  </select>
                </Field>
                <div className="md:col-span-2 xl:col-span-4">
                  <Field label="Observación general">
                    <textarea value={generalObservation} onChange={event => setGeneralObservation(event.target.value)} disabled={isSaving} className={`${inputClassName} min-h-20 resize-y py-3`} placeholder="Sustento general del registro, campaña, jornada o incidencia..." />
                  </Field>
                  <p className="mt-2 text-[11px] font-semibold text-slate-500">Evite registrar datos personales de pacientes. Use solo datos operativos para seguimiento de UNGET y DIRESA.</p>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center gap-2">
                <Syringe className="h-4 w-4 text-emerald-700" />
                <h3 className="text-xs font-black uppercase tracking-wide text-slate-700">Agregar producto consumido</h3>
              </div>
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
                <div className="xl:col-span-5">
                  <Field label="Producto del stock" required>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3.5 top-3.5 z-10 h-5 w-5 text-slate-400" />
                      <input
                        ref={searchRef}
                        type="search"
                        role="combobox"
                        aria-expanded={resultsOpen}
                        value={layerSearch}
                        onFocus={() => {
                          if (!selectedLayerId) setResultsOpen(true);
                        }}
                        onBlur={() => window.setTimeout(() => setResultsOpen(false), 150)}
                        onKeyDown={handleKeyDown}
                        onChange={event => {
                          setLayerSearch(event.target.value);
                          setSelectedLayerId("");
                          setResultsOpen(true);
                          setActiveIndex(0);
                        }}
                        disabled={isSaving}
                        autoComplete="off"
                        placeholder="Buscar código SISMED o descripción..."
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-10 text-sm font-semibold text-slate-800 outline-none transition-shadow placeholder:text-slate-400 focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
                      />
                      {selectedLayerId && (
                        <button type="button" onMouseDown={event => event.preventDefault()} onClick={resetItemForm} aria-label="Cambiar lote" className="absolute right-2.5 top-2.5 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                          <X className="h-4 w-4" />
                        </button>
                      )}
                      {resultsOpen && !selectedLayerId && (
                        <div className="absolute z-50 mt-2 max-h-80 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xl">
                          {filteredProducts.length === 0 ? (
                            <div className="px-4 py-6 text-center"><p className="text-sm font-black text-slate-700">Producto no encontrado</p><p className="mt-1 text-xs text-slate-500">Solo se puede consumir stock existente de la IPRESS.</p></div>
                          ) : filteredProducts.map((option, index) => {
                            const product = option.product;
                            const layer = option.recommendedLayer;
                            return (
                              <button key={option.productId} type="button" onMouseDown={event => event.preventDefault()} onMouseEnter={() => setActiveIndex(index)} onClick={() => selectProduct(option)} className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${index === activeIndex ? "bg-emerald-50" : "hover:bg-slate-50"}`}>
                                <span className="shrink-0 rounded-lg bg-slate-100 px-2 py-1 font-mono text-xs font-black text-teal-700">{product?.codigoSismed || "-"}</span>
                                <span className="min-w-0"><span className="block text-sm font-black text-slate-900">{product?.descripcion || "Producto no encontrado"}</span><span className="mt-0.5 block text-[10px] font-black uppercase tracking-wide text-slate-400">Stock {option.totalQuantity} · {option.layers.length} lote{option.layers.length === 1 ? "" : "s"} · FEFO sugerido: {layer.lote} vence {layer.expirationDate}</span></span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </Field>
                </div>
                <div className="xl:col-span-2">
                  <Field label="Consumo" required>
                    <input type="number" min="1" step="1" value={quantity} onChange={event => setQuantity(event.target.value)} disabled={isSaving} className={inputClassName} placeholder="Frascos/unid." />
                  </Field>
                </div>
                <div className="xl:col-span-2">
                  <Field label="Dosis aplicadas" required>
                    <input type="number" min="0" step="1" value={dosesApplied} onChange={event => setDosesApplied(event.target.value)} disabled={isSaving} className={inputClassName} placeholder="0" />
                  </Field>
                </div>
                <div className="xl:col-span-2">
                  <Field label="Obs. ítem">
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
                <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3 text-xs">
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                      <InfoPill label="Lote seleccionado" value={selectedLayer.lote} />
                      <InfoPill label="Vencimiento" value={selectedLayer.expirationDate} />
                      <InfoPill label="Saldo lote" value={formatNumber(selectedLayer.currentQuantity)} />
                      <InfoPill label="Dosis/unid." value={formatNumber(selectedProduct.dosisUnidad)} />
                      <InfoPill label="Estado FEFO" value={selectedIsFefo ? "Sugerido" : "Manual"} />
                    </div>
                    <Field label="Elegir lote">
                      <select
                        value={selectedLayerId}
                        onChange={event => {
                          const layer = selectableLayersForProduct.find(row => row.id === event.target.value);
                          if (layer) selectLayer(layer);
                        }}
                        disabled={isSaving}
                        className={inputClassName}
                      >
                        {selectableLayersForProduct.map((layer, index) => (
                          <option key={layer.id} value={layer.id}>
                            {index === 0 ? "FEFO sugerido · " : "Manual · "}Lote {layer.lote} · vence {layer.expirationDate} · saldo {layer.currentQuantity}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 border-t border-emerald-100 pt-3 md:grid-cols-3">
                    <InfoPill label="Dosis perdidas" value={formatNumber(lostDoses)} />
                    <InfoPill label="Factor pérdida" value={`${formatNumber(lossFactor, 2)}%`} />
                    <InfoPill label="Criterio" value={selectedIsFefo ? "FEFO automático" : "Lote elegido por usuario"} />
                  </div>
                </div>
              )}
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="flex flex-col gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-xs font-black uppercase tracking-wide text-slate-700">Detalle del registro</h3>
                <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-wide">
                  <span className="rounded-lg bg-emerald-50 px-2 py-1 text-emerald-700">{items.length} ítems</span>
                  <span className="rounded-lg bg-slate-100 px-2 py-1 text-slate-600">{formatNumber(totalQuantity)} fco/unid.</span>
                  <span className="rounded-lg bg-slate-100 px-2 py-1 text-slate-600">{formatNumber(totalApplied)} dosis aplicadas</span>
                  <span className="rounded-lg bg-slate-100 px-2 py-1 text-slate-600">{formatNumber(totalLossFactor, 2)}% pérdida</span>
                </div>
              </div>
              {items.length === 0 ? (
                <div className="p-8 text-center"><ReceiptText className="mx-auto mb-2 h-9 w-9 text-slate-300" /><p className="text-sm font-bold text-slate-600">Agregue uno o más productos/lotes al registro.</p></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-slate-50">
                      <tr>
                        <HeaderCell>Código</HeaderCell>
                        <HeaderCell>Producto</HeaderCell>
                        <HeaderCell>Lote</HeaderCell>
                        <HeaderCell align="right">Consumo</HeaderCell>
                        <HeaderCell align="right">Aplicadas</HeaderCell>
                        <HeaderCell align="right">Perdidas</HeaderCell>
                        <HeaderCell align="right">Factor</HeaderCell>
                        <HeaderCell align="right">Quitar</HeaderCell>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.map(item => {
                        const itemConsumedDoses = item.consumptionQuantity * (item.product?.dosisUnidad || 0);
                        const itemLost = Math.max(itemConsumedDoses - item.dosesApplied, 0);
                        const itemFactor = itemConsumedDoses > 0 ? (itemLost / itemConsumedDoses) * 100 : 0;
                        return (
                          <tr key={item.tempId}>
                            <td className="px-3 py-3 font-mono text-xs font-black text-teal-700">{item.product?.codigoSismed || "-"}</td>
                            <td className="max-w-md px-3 py-3 text-xs font-bold text-slate-800">{item.product?.descripcion || "-"}</td>
                            <td className="px-3 py-3 text-xs font-black text-slate-700">{item.layer.lote}</td>
                            <td className="px-3 py-3 text-right text-xs font-black text-slate-900">{formatNumber(item.consumptionQuantity)}</td>
                            <td className="px-3 py-3 text-right text-xs font-black text-slate-900">{formatNumber(item.dosesApplied)}</td>
                            <td className="px-3 py-3 text-right text-xs font-black text-slate-900">{formatNumber(itemLost)}</td>
                            <td className="px-3 py-3 text-right text-xs font-black text-slate-900">{formatNumber(itemFactor, 2)}%</td>
                            <td className="px-3 py-3 text-right"><button type="button" onClick={() => setItems(current => current.filter(row => row.tempId !== item.tempId))} disabled={isSaving} className="rounded-lg p-2 text-red-500 hover:bg-red-50 disabled:opacity-40"><Trash2 className="h-4 w-4" /></button></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}
          </div>

          <footer className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/80 p-4 sm:flex-row sm:justify-end sm:px-7">
            <button type="button" onClick={onClose} disabled={isSaving} className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-100 disabled:opacity-50">
              Cancelar
            </button>
            <button type="submit" disabled={isSaving || items.length === 0} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {isSaving ? "Guardando..." : "Guardar registro"}
            </button>
          </footer>
        </form>
      </section>
    </div>,
    document.body
  );
}

function GroupDetail({
  group,
  productById,
  layerById
}: {
  group: ConsumptionGroup;
  productById: Map<string, ImmunizationProduct>;
  layerById: Map<string, ImmunizationStockLayer>;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <table className="min-w-full divide-y divide-slate-100">
        <thead className="bg-slate-50">
          <tr>
            <HeaderCell>Código</HeaderCell>
            <HeaderCell>Producto</HeaderCell>
            <HeaderCell>Lote</HeaderCell>
            <HeaderCell align="right">Consumo</HeaderCell>
            <HeaderCell align="right">Aplicadas</HeaderCell>
            <HeaderCell align="right">Perdidas</HeaderCell>
            <HeaderCell align="right">Factor</HeaderCell>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {group.movements.map(movement => {
            const product = productById.get(movement.productId);
            const layer = movement.stockLayerId ? layerById.get(movement.stockLayerId) : undefined;
            const metrics = movementMetrics(movement);
            return (
              <tr key={movement.id}>
                <td className="px-3 py-3 font-mono text-xs font-black text-teal-700">{product?.codigoSismed || "-"}</td>
                <td className="max-w-lg px-3 py-3 text-xs font-bold text-slate-800">{product?.descripcion || "Producto no encontrado"}</td>
                <td className="px-3 py-3 text-xs font-black text-slate-700">{layer?.lote || movement.stockLayerId || "-"}</td>
                <td className="px-3 py-3 text-right text-xs font-black text-slate-900">{formatNumber(Math.abs(movement.quantityDelta))}</td>
                <td className="px-3 py-3 text-right text-xs font-black text-slate-900">{formatNumber(metrics.dosesApplied)}</td>
                <td className="px-3 py-3 text-right text-xs font-black text-slate-900">{formatNumber(metrics.dosesLost)}</td>
                <td className="px-3 py-3 text-right text-xs font-black text-slate-900">{formatNumber(metrics.lossFactor, 2)}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const SummaryCard: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">{label}</p>
    <p className="mt-3 text-2xl font-black text-slate-950">{value}</p>
  </div>
);

const HeaderCell: React.FC<{ children: React.ReactNode; align?: "left" | "right" }> = ({ children, align = "left" }) => (
  <th className={`px-4 py-3 ${align === "right" ? "text-right" : "text-left"} text-[11px] font-black uppercase tracking-wide text-slate-500`}>
    {children}
  </th>
);

const Field: React.FC<{ label: string; required?: boolean; children: React.ReactNode }> = ({ label, required, children }) => (
  <label className="block">
    <span className="mb-1.5 block text-xs font-black text-slate-700">{label} {required && <span className="text-red-500">*</span>}</span>
    {children}
  </label>
);

const InfoPill: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</p>
    <p className="mt-1 font-black text-slate-900">{value}</p>
  </div>
);
