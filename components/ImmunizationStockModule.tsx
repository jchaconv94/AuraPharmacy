import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  Boxes,
  ChevronLeft,
  ChevronRight,
  Eye,
  FilterX,
  Layers,
  Package,
  RefreshCw,
  Search,
  ShieldCheck,
  Syringe,
  X
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../services/api";
import {
  getImmunizationScope,
  ImmunizationScope,
  immunizationApi
} from "../services/immunizationApi";
import {
  HealthFacility,
  ImmunizationOwnerType,
  ImmunizationProductType,
  ImmunizationStockLayer,
  Unget
} from "../types";
import {
  formatImmunizationCurrency,
  formatImmunizationDate,
  ImmunizationKpiCard,
  normalizeImmunizationText as normalizeText
} from "./ui/immunization";
import { CustomSelect } from "./ui/CustomSelect";

type ExpirationKey = "EXPIRED" | "CRITICAL" | "UPCOMING" | "VALID" | "UNKNOWN";
type ExpirationFilter = "ALL" | ExpirationKey | "ALERTS";

interface ExpirationStatus {
  key: ExpirationKey;
  label: string;
  shortLabel: string;
  days: number | null;
  className: string;
}

interface StockProductGroup {
  productId: string;
  codigo: string;
  descripcion: string;
  tipo?: ImmunizationProductType;
  dosis: number;
  layers: ImmunizationStockLayer[];
  total: number;
  value: number;
  nearest?: string;
}


const getExpirationStatus = (dateStr: string): ExpirationStatus => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiration = new Date(`${dateStr}T00:00:00`);
  const diffDays = Math.ceil((expiration.getTime() - today.getTime()) / 86400000);

  if (Number.isNaN(diffDays)) {
    return { key: "UNKNOWN", label: "Fecha no válida", shortLabel: "Sin fecha", days: null, className: "bg-slate-100 text-slate-600 border-slate-200" };
  }
  if (diffDays < 0) {
    return { key: "EXPIRED", label: `Vencido hace ${Math.abs(diffDays)} días`, shortLabel: "Vencido", days: diffDays, className: "bg-red-50 text-red-700 border-red-200" };
  }
  if (diffDays <= 40) {
    return { key: "CRITICAL", label: `Vence en ${diffDays} días`, shortLabel: "≤ 40 días", days: diffDays, className: "bg-rose-50 text-rose-700 border-rose-200" };
  }
  if (diffDays <= 90) {
    return { key: "UPCOMING", label: `Vence en ${diffDays} días`, shortLabel: "≤ 3 meses", days: diffDays, className: "bg-amber-50 text-amber-700 border-amber-200" };
  }
  return { key: "VALID", label: `Vigente · ${diffDays} días`, shortLabel: "Vigente", days: diffDays, className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
};

export const ImmunizationStockModule: React.FC = () => {
  const { user } = useAuth();
  const userScope = useMemo(() => getImmunizationScope(user), [user]);
  const isGlobalAdmin = (user?.role || "").toUpperCase() === "ADMIN" && !userScope.ownerType;

  const [layers, setLayers] = useState<ImmunizationStockLayer[]>([]);
  const [ungets, setUngets] = useState<Unget[]>([]);
  const [facilities, setFacilities] = useState<HealthFacility[]>([]);
  const [organizationsLoading, setOrganizationsLoading] = useState(false);
  const [adminOwnerType, setAdminOwnerType] = useState<ImmunizationOwnerType | "">("");
  const [adminUngetId, setAdminUngetId] = useState("");
  const [adminFacilityCode, setAdminFacilityCode] = useState("");
  const [selectedModalIndex, setSelectedModalIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [productType, setProductType] = useState<"ALL" | ImmunizationProductType>("ALL");
  const [expirationFilter, setExpirationFilter] = useState<ExpirationFilter>("ALL");

  const selectedFacility = facilities.find(facility => facility.code === adminFacilityCode);
  const effectiveScope = useMemo<ImmunizationScope>(() => {
    if (userScope.ownerType) return userScope;
    if (isGlobalAdmin && adminOwnerType === "DIRESA") {
      return { level: "DIRESA", ownerType: "DIRESA" };
    }
    if (isGlobalAdmin && adminOwnerType === "UNGET" && adminUngetId) {
      return { level: "UNGET", ownerType: "UNGET", ungetId: adminUngetId };
    }
    if (isGlobalAdmin && adminOwnerType === "IPRESS" && adminFacilityCode) {
      return {
        level: "IPRESS",
        ownerType: "IPRESS",
        ungetId: selectedFacility?.ungetId,
        facilityCode: adminFacilityCode
      };
    }
    return { level: userScope.level };
  }, [userScope, isGlobalAdmin, adminOwnerType, adminUngetId, adminFacilityCode, selectedFacility?.ungetId]);

  const hasOperationalScope = Boolean(
    effectiveScope.ownerType === "DIRESA" ||
    (effectiveScope.ownerType === "UNGET" && effectiveScope.ungetId) ||
    (effectiveScope.ownerType === "IPRESS" && effectiveScope.facilityCode)
  );

  useEffect(() => {
    if (!isGlobalAdmin) return;
    setOrganizationsLoading(true);
    Promise.all([api.getUngets(), api.getFacilities()])
      .then(([ungetRows, facilityRows]) => {
        setUngets([...ungetRows].sort((a, b) => a.name.localeCompare(b.name)));
        setFacilities([...facilityRows].sort((a, b) => a.name.localeCompare(b.name)));
      })
      .catch(() => toast.error("No se pudo cargar la lista de UNGET e IPRESS"))
      .finally(() => setOrganizationsLoading(false));
  }, [isGlobalAdmin]);

  const loadStock = useCallback(async () => {
    if (!hasOperationalScope) {
      setLayers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const rows = await immunizationApi.getStockLayers(effectiveScope);
      setLayers(rows.filter(layer => layer.isActive && layer.currentQuantity > 0));
    } catch {
      setLayers([]);
      toast.error("Error al cargar el stock biológico");
    } finally {
      setLoading(false);
    }
  }, [effectiveScope, hasOperationalScope]);

  useEffect(() => {
    setSelectedModalIndex(null);
    void loadStock();
  }, [loadStock]);

  const filteredLayers = useMemo(() => {
    const query = normalizeText(search);
    return layers.filter(layer => {
      if (productType !== "ALL" && layer.product?.tipoProducto !== productType) return false;

      const expiration = getExpirationStatus(layer.expirationDate);
      if (expirationFilter === "ALERTS" && !["EXPIRED", "CRITICAL", "UPCOMING"].includes(expiration.key)) return false;
      if (expirationFilter !== "ALL" && expirationFilter !== "ALERTS" && expiration.key !== expirationFilter) return false;

      if (query) {
        const haystack = normalizeText([
          layer.product?.codigoSismed,
          layer.product?.descripcion,
          layer.lote,
          layer.fundingSource,
          layer.supplyType
        ].filter(Boolean).join(" "));
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [layers, productType, expirationFilter, search]);

  const grouped = useMemo<StockProductGroup[]>(() => {
    const map = new Map<string, StockProductGroup>();
    filteredLayers.forEach(layer => {
      const product = layer.product;
      const current = map.get(layer.productId) || {
        productId: layer.productId,
        codigo: product?.codigoSismed || "-",
        descripcion: product?.descripcion || "Producto no disponible",
        tipo: product?.tipoProducto,
        dosis: product?.dosisUnidad || 1,
        layers: [],
        total: 0,
        value: 0,
        nearest: undefined
      };
      current.layers.push(layer);
      current.total += layer.currentQuantity;
      current.value += layer.currentQuantity * layer.unitPrice;
      if (!current.nearest || layer.expirationDate < current.nearest) current.nearest = layer.expirationDate;
      map.set(layer.productId, current);
    });

    return Array.from(map.values())
      .map(group => ({
        ...group,
        layers: [...group.layers].sort((a, b) => a.expirationDate.localeCompare(b.expirationDate))
      }))
      .sort((a, b) => (a.nearest || "9999").localeCompare(b.nearest || "9999") || a.descripcion.localeCompare(b.descripcion));
  }, [filteredLayers]);

  useEffect(() => {
    if (selectedModalIndex === null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setSelectedModalIndex(prev => (prev !== null && prev > 0 ? prev - 1 : prev));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setSelectedModalIndex(prev => (prev !== null && prev < grouped.length - 1 ? prev + 1 : prev));
      } else if (e.key === "Escape") {
        e.preventDefault();
        setSelectedModalIndex(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedModalIndex, grouped.length]);

  const totals = useMemo(() => {
    const statuses = filteredLayers.map(layer => getExpirationStatus(layer.expirationDate));
    return {
      products: grouped.length,
      lots: filteredLayers.length,
      units: filteredLayers.reduce((sum, layer) => sum + layer.currentQuantity, 0),
      value: filteredLayers.reduce((sum, layer) => sum + layer.currentQuantity * layer.unitPrice, 0),
      alerts: statuses.filter(status => ["EXPIRED", "CRITICAL", "UPCOMING"].includes(status.key)).length,
      expired: statuses.filter(status => status.key === "EXPIRED").length
    };
  }, [grouped.length, filteredLayers]);

  const hasFilters = Boolean(search || productType !== "ALL" || expirationFilter !== "ALL");
  const clearFilters = () => {
    setSearch("");
    setProductType("ALL");
    setExpirationFilter("ALL");
  };

  return (
    <div className="space-y-4 pb-2 animate-in fade-in duration-300">
      {hasOperationalScope && (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
          <ImmunizationKpiCard
            label="Productos"
            value={totals.products}
            icon={<Syringe className="h-5 w-5" />}
            tone="info"
            hint="En catálogo activo"
          />
          <ImmunizationKpiCard
            label="Lotes / Capas"
            value={totals.lots}
            icon={<Boxes className="h-5 w-5" />}
            tone="neutral"
            hint="Existencias registradas"
          />
          <ImmunizationKpiCard
            label="Frascos / Unid."
            value={totals.units.toLocaleString("es-PE")}
            icon={<Package className="h-5 w-5" />}
            tone="success"
            hint="Saldo físico total"
          />
          <ImmunizationKpiCard
            label="Valorización"
            value={formatImmunizationCurrency(totals.value)}
            icon={<ShieldCheck className="h-5 w-5" />}
            tone="info"
            hint="Costo total acumulado"
          />
          <ImmunizationKpiCard
            label="Alertas Vcto."
            value={totals.alerts}
            icon={<AlertTriangle className="h-5 w-5" />}
            tone={totals.alerts > 0 ? (totals.expired > 0 ? "danger" : "warning") : "neutral"}
            hint={
              totals.expired > 0
                ? `${totals.expired} vencidos (bloqueados)`
                : totals.alerts > 0
                ? `${totals.alerts} lotes próx. a vencer`
                : "Sin alertas de vencimiento"
            }
            onClick={totals.alerts > 0 ? () => setExpirationFilter(prev => prev === "ALERTS" ? "ALL" : "ALERTS") : undefined}
            active={expirationFilter === "ALERTS"}
          />
        </div>
      )}

      {isGlobalAdmin && (
        <AdminOperationalScopeSelector
          ownerType={adminOwnerType}
          ungetId={adminUngetId}
          facilityCode={adminFacilityCode}
          ungets={ungets}
          facilities={facilities}
          loading={organizationsLoading}
          onOwnerTypeChange={value => {
            setAdminOwnerType(value);
            setAdminUngetId("");
            setAdminFacilityCode("");
          }}
          onUngetChange={value => {
            setAdminUngetId(value);
            setAdminFacilityCode("");
          }}
          onFacilityChange={setAdminFacilityCode}
        />
      )}

      {!hasOperationalScope && (
        <section className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-950">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <h3 className="text-sm font-black">Este módulo controla una sola existencia operativa</h3>
            <p className="mt-1 text-xs leading-5 text-amber-800">
              {isGlobalAdmin
                ? "Selecciona DIRESA, una UNGET o una IPRESS para revisar un unico stock operativo."
                : "Los perfiles de supervision consultaran stock territorial desde el modulo Consulta de Stock Biologico, con filtros y vista consolidada."}
            </p>
          </div>
        </section>
      )}

      {hasOperationalScope && (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center justify-between">
              <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(240px,1fr)_180px_180px]">
                <label className="relative block">
                  <span className="sr-only">Buscar stock</span>
                  <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Código, descripción o lote..." className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm font-semibold outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100" />
                </label>
                <FilterSelect label="Tipo de producto" value={productType} onChange={value => setProductType(value as "ALL" | ImmunizationProductType)} options={[
                  { value: "ALL", label: "Todos los tipos" },
                  { value: "VACUNA", label: "Vacunas" },
                  { value: "JERINGA", label: "Jeringas" },
                  { value: "DILUYENTE", label: "Diluyentes" }
                ]} />
                <FilterSelect label="Vencimiento" value={expirationFilter} onChange={value => setExpirationFilter(value as ExpirationFilter)} options={[
                  { value: "ALL", label: "Todo vencimiento" },
                  { value: "ALERTS", label: "Todas las alertas" },
                  { value: "EXPIRED", label: "Vencidos" },
                  { value: "CRITICAL", label: "Hasta 40 días" },
                  { value: "UPCOMING", label: "Hasta 3 meses" },
                  { value: "VALID", label: "Vigentes" }
                ]} />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button type="button" onClick={clearFilters} disabled={!hasFilters} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-black text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
                  <FilterX className="h-4 w-4" /> Limpiar
                </button>
                <button
                  type="button"
                  onClick={() => void loadStock()}
                  disabled={!hasOperationalScope || loading}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3.5 text-xs font-black text-teal-700 hover:bg-teal-100/80 shadow-2xs disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Actualizar
                </button>
              </div>
            </div>
            <div className="mt-3 text-xs text-slate-500"><span className="font-black text-slate-700">{grouped.length}</span> productos y <span className="font-black text-slate-700">{filteredLayers.length}</span> lotes visibles</div>
          </section>

          {loading && layers.length === 0 ? (
            <div className="flex justify-center py-16"><div className="h-9 w-9 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" /></div>
          ) : grouped.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
              <Package className="mx-auto mb-3 h-10 w-10 text-slate-300" />
              <h3 className="font-black text-slate-800">Sin stock registrado</h3>
              <p className="mt-1 text-sm text-slate-500">{hasFilters ? "Cambia los filtros para ampliar los resultados." : "El stock aparecerá al cerrar el inventario inicial o registrar movimientos."}</p>
              {hasFilters && <button type="button" onClick={clearFilters} className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white">Limpiar filtros</button>}
            </div>
          ) : (
            <section className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${loading ? "opacity-60 pointer-events-none transition-opacity duration-200" : "transition-opacity duration-200"}`}>
              <div className="overflow-x-auto">
                <div className="min-w-0 lg:min-w-[925px]">
                  <div className="hidden grid-cols-[80px_minmax(240px,1fr)_80px_90px_100px_110px_130px_95px] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-[10px] font-black uppercase tracking-wide text-slate-500 lg:grid">
                    <span>Código</span><span>Producto</span><span>Tipo</span><span>Dosis/Unidad</span><span>Saldo</span><span>Valorización</span><span>Vencimiento próximo</span><span className="text-right">Acción</span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {grouped.map((group, index) => {
                      const expirationStatus = group.nearest ? getExpirationStatus(group.nearest) : null;
                      return (
                        <article key={group.productId}>
                          <button
                            type="button"
                            onClick={() => setSelectedModalIndex(index)}
                            className="group grid w-full grid-cols-2 gap-3 p-4 text-left transition-colors hover:bg-teal-50/40 lg:grid-cols-[80px_minmax(240px,1fr)_80px_90px_100px_110px_130px_95px] lg:items-center"
                          >
                            <span className="w-fit rounded-lg border border-teal-100 bg-teal-50 px-2 py-1 font-mono text-xs font-black text-teal-700 group-hover:bg-teal-100 transition-colors">{group.codigo}</span>
                            <span className="col-span-2 min-w-0 lg:col-span-1">
                              <span className="block text-[13px] font-bold leading-5 text-slate-900 group-hover:text-teal-900 transition-colors">{group.descripcion}</span>
                              <span className="mt-1 block text-[10px] font-black uppercase tracking-wide text-slate-400">{group.layers.length} {group.layers.length === 1 ? "lote" : "lotes"}</span>
                            </span>
                            <span className="text-xs font-black text-slate-700"><span className="mb-1 block text-[9px] uppercase text-slate-400 lg:hidden">Tipo</span>{group.tipo || "—"}</span>
                            <span className="text-sm font-black text-slate-800"><span className="mb-1 block text-[9px] uppercase text-slate-400 lg:hidden">Dosis/Unidad</span>{group.dosis.toLocaleString("es-PE")}</span>
                            <span className="text-sm font-black text-slate-800"><span className="mb-1 block text-[9px] uppercase text-slate-400 lg:hidden">Saldo</span>{group.total.toLocaleString("es-PE")} <span className="font-medium text-slate-400">fco/unid.</span></span>
                            <span className="text-sm font-bold text-slate-600"><span className="mb-1 block text-[9px] uppercase text-slate-400 lg:hidden">Valorización</span>S/ {group.value.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            {expirationStatus && <span className={`w-fit rounded-lg border px-2 py-1 text-[10px] font-black uppercase ${expirationStatus.className}`}>{expirationStatus.label}</span>}
                            <div className="flex justify-end">
                              <span className="inline-flex items-center gap-1.5 rounded-xl border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-black text-teal-700 group-hover:bg-teal-600 group-hover:text-white transition-all shadow-2xs">
                                <Eye className="h-3.5 w-3.5" /> Ver lotes
                              </span>
                            </div>
                          </button>
                        </article>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>
          )}

          {selectedModalIndex !== null && grouped[selectedModalIndex] && (
            <LotDetailModal
              group={grouped[selectedModalIndex]}
              currentIndex={selectedModalIndex}
              totalProducts={grouped.length}
              onPrev={() => setSelectedModalIndex(prev => (prev !== null && prev > 0 ? prev - 1 : prev))}
              onNext={() => setSelectedModalIndex(prev => (prev !== null && prev < grouped.length - 1 ? prev + 1 : prev))}
              onClose={() => setSelectedModalIndex(null)}
            />
          )}
        </>
      )}
    </div>
  );
};

interface AdminOperationalScopeSelectorProps {
  ownerType: ImmunizationOwnerType | "";
  ungetId: string;
  facilityCode: string;
  ungets: Unget[];
  facilities: HealthFacility[];
  loading: boolean;
  onOwnerTypeChange: (value: ImmunizationOwnerType | "") => void;
  onUngetChange: (value: string) => void;
  onFacilityChange: (value: string) => void;
}

const AdminOperationalScopeSelector: React.FC<AdminOperationalScopeSelectorProps> = ({
  ownerType,
  ungetId,
  facilityCode,
  ungets,
  facilities,
  loading,
  onOwnerTypeChange,
  onUngetChange,
  onFacilityChange
}) => {
  const availableFacilities = ungetId
    ? facilities.filter(facility => facility.ungetId === ungetId)
    : [];

  return (
    <section className="rounded-2xl border border-cyan-200 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <h3 className="text-sm font-black text-slate-900">Ámbito operativo</h3>
        <p className="mt-0.5 text-xs text-slate-500">Selector disponible solo para administracion. La vista siempre corresponde a DIRESA, una UNGET o una IPRESS.</p>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <FilterSelect label="Nivel propietario" value={ownerType} onChange={value => onOwnerTypeChange(value as ImmunizationOwnerType | "")} options={[
          { value: "", label: "Seleccionar nivel..." },
          { value: "DIRESA", label: "Almacen regional DIRESA" },
          { value: "UNGET", label: "Almacén UNGET" },
          { value: "IPRESS", label: "Establecimiento IPRESS" }
        ]} />
        {ownerType !== "DIRESA" && (
          <FilterSelect label="UNGET propietaria" value={ungetId} onChange={onUngetChange} options={[
            { value: "", label: loading ? "Cargando UNGET..." : "Seleccionar UNGET..." },
            ...ungets.map(unget => ({ value: unget.id, label: unget.name }))
          ]} />
        )}
        {ownerType === "IPRESS" && (
          <FilterSelect label="Establecimiento IPRESS" value={facilityCode} onChange={onFacilityChange} options={[
            { value: "", label: !ungetId ? "Primero selecciona UNGET" : "Seleccionar IPRESS..." },
            ...availableFacilities.map(facility => ({ value: facility.code, label: `${facility.code} - ${facility.name}` }))
          ]} />
        )}
      </div>
    </section>
  );
};

const FilterSelect: React.FC<{ label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }> = ({ label, value, onChange, options }) => (
  <div className="w-full">
    <span className="sr-only">{label}</span>
    <CustomSelect
      value={value}
      onChange={onChange}
      options={options}
      ariaLabel={label}
      placeholder={label}
      className="h-10 border-slate-200"
    />
  </div>
);

const TableHeader: React.FC<{ children: React.ReactNode; align?: "left" | "right" }> = ({ children, align = "left" }) => (
  <th className={`px-3 py-2 text-[10px] font-black uppercase tracking-wide text-slate-500 ${align === "right" ? "text-right" : "text-left"}`}>{children}</th>
);

interface LotDetailModalProps {
  group: StockProductGroup;
  currentIndex: number;
  totalProducts: number;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}

const LotDetailModal: React.FC<LotDetailModalProps> = ({
  group,
  currentIndex,
  totalProducts,
  onPrev,
  onNext,
  onClose
}) => {
  const expirationStatus = group.nearest ? getExpirationStatus(group.nearest) : null;

  return createPortal(
    <div className="fixed inset-0 z-[200000] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs sm:p-6 animate-in fade-in duration-200" onClick={onClose}>
      <div
        className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-900 p-4 text-white sm:px-6 sm:py-5 shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <span className="shrink-0 rounded-xl border border-teal-500/30 bg-teal-500/20 px-3 py-1.5 font-mono text-xs font-black text-teal-300">
              {group.codigo}
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-base font-black text-white sm:text-lg">{group.descripcion}</h3>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mt-0.5">
                <span>{group.tipo || "Sin tipo"}</span>
                <span>•</span>
                <span>{group.layers.length} {group.layers.length === 1 ? "lote registrado" : "lotes registrados"}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Nav Controls */}
            <div className="flex items-center gap-1.5 rounded-2xl border border-slate-700 bg-slate-800 p-1">
              <button
                type="button"
                onClick={onPrev}
                disabled={currentIndex === 0}
                title="Producto anterior (Flecha izquierda ←)"
                className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2 font-mono text-xs font-bold text-slate-300 select-none">
                {currentIndex + 1} / {totalProducts}
              </span>
              <button
                type="button"
                onClick={onNext}
                disabled={currentIndex === totalProducts - 1}
                title="Producto siguiente (Flecha derecha →)"
                className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              title="Cerrar modal (ESC)"
              className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Summary Bar */}
        <div className="grid grid-cols-2 gap-3 border-b border-slate-200 bg-slate-50 p-4 sm:grid-cols-4 sm:px-6 shrink-0">
          <div className="rounded-xl border border-slate-200/80 bg-white p-2.5 shadow-2xs">
            <span className="block text-[10px] font-black uppercase text-slate-400">Dosis / Unidad</span>
            <span className="mt-0.5 block text-sm font-black text-slate-800">{group.dosis.toLocaleString("es-PE")}</span>
          </div>
          <div className="rounded-xl border border-slate-200/80 bg-white p-2.5 shadow-2xs">
            <span className="block text-[10px] font-black uppercase text-slate-400">Saldo Físico</span>
            <span className="mt-0.5 block text-sm font-black text-slate-900">{group.total.toLocaleString("es-PE")} <span className="text-xs font-normal text-slate-500">fco/unid.</span></span>
          </div>
          <div className="rounded-xl border border-slate-200/80 bg-white p-2.5 shadow-2xs">
            <span className="block text-[10px] font-black uppercase text-slate-400">Valorización Acumulada</span>
            <span className="mt-0.5 block text-sm font-black text-slate-800">S/ {group.value.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div className="rounded-xl border border-slate-200/80 bg-white p-2.5 shadow-2xs">
            <span className="block text-[10px] font-black uppercase text-slate-400">Vencimiento Próximo</span>
            <div className="mt-0.5">
              {expirationStatus ? (
                <span className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-black uppercase ${expirationStatus.className}`}>
                  {expirationStatus.label}
                </span>
              ) : (
                <span className="text-xs text-slate-400">—</span>
              )}
            </div>
          </div>
        </div>

        {/* Lots Content Table */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-700">
              <Boxes className="h-4 w-4 text-teal-600" /> Detalle de Lotes y Capas Existentes
            </h4>
            <span className="text-xs text-slate-400 font-medium hidden sm:inline">Ordenado por regla FEFO (vencimiento próximo)</span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-2xs">
            <table className="w-full min-w-[700px] divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  <TableHeader>LOTE</TableHeader>
                  <TableHeader>VENCIMIENTO</TableHeader>
                  <TableHeader>ESTADO</TableHeader>
                  <TableHeader align="right">SALDO</TableHeader>
                  <TableHeader align="right">PRECIO</TableHeader>
                  <TableHeader align="right">TOTAL</TableHeader>
                  <TableHeader>F. FINAN</TableHeader>
                  <TableHeader>T. SUM</TableHeader>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {group.layers.map((layer, index) => {
                  const status = getExpirationStatus(layer.expirationDate);
                  const isNextToExpire = index === 0;
                  
                  // Elevate color level if it is the closest one to expire (FEFO) to highlight as alert compared to others
                  let badgeClassName = status.className;
                  if (isNextToExpire) {
                    if (status.key === "VALID") {
                      badgeClassName = "bg-amber-50 text-amber-700 border-amber-200 ring-1 ring-amber-300/30";
                    } else if (status.key === "UPCOMING") {
                      badgeClassName = "bg-rose-50 text-rose-700 border-rose-200 ring-1 ring-rose-300/30";
                    }
                  }

                  return (
                    <tr key={layer.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-3.5 py-3 text-xs font-black text-slate-800">
                        {layer.lote}
                      </td>
                      <td className="px-3.5 py-3 text-xs font-bold text-slate-600">
                        {formatImmunizationDate(layer.expirationDate)}
                      </td>
                      <td className="px-3.5 py-3">
                        <span className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-[10px] font-black uppercase whitespace-nowrap ${badgeClassName}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-3.5 py-3 text-right text-xs font-black text-slate-900">
                        {layer.currentQuantity.toLocaleString("es-PE")}
                      </td>
                      <td className="px-3.5 py-3 text-right text-xs font-bold text-slate-600">
                        S/ {layer.unitPrice.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                      </td>
                      <td className="px-3.5 py-3 text-right text-xs font-black text-slate-700">
                        S/ {(layer.currentQuantity * layer.unitPrice).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-3.5 py-3 text-xs font-semibold text-slate-600">{layer.fundingSource}</td>
                      <td className="px-3.5 py-3 text-xs font-semibold text-slate-600">{layer.supplyType}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 p-4 sm:px-6 text-xs text-slate-500 shrink-0">
          <div className="hidden sm:flex items-center gap-3">
            <span className="flex items-center gap-1.5 font-semibold">
              <kbd className="rounded-md border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-mono font-black text-slate-700 shadow-2xs">←</kbd>
              <kbd className="rounded-md border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-mono font-black text-slate-700 shadow-2xs">→</kbd>
              <span className="text-slate-600">Navegar entre productos</span>
            </span>
            <span className="text-slate-300">•</span>
            <span className="flex items-center gap-1.5 font-semibold">
              <kbd className="rounded-md border border-slate-300 bg-white px-1.5 py-0.5 text-[11px] font-mono font-black text-slate-700 shadow-2xs">ESC</kbd>
              <span className="text-slate-600">Cerrar</span>
            </span>
          </div>

          <div className="flex items-center gap-2 sm:hidden w-full justify-between">
            <button
              type="button"
              onClick={onPrev}
              disabled={currentIndex === 0}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" /> Anterior
            </button>
            <span className="font-mono text-xs font-bold text-slate-600">{currentIndex + 1} / {totalProducts}</span>
            <button
              type="button"
              onClick={onNext}
              disabled={currentIndex === totalProducts - 1}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-30"
            >
              Siguiente <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="hidden sm:inline-flex rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-black text-slate-700 hover:bg-slate-100 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
