import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  ChevronDown,
  FilterX,
  MapPin,
  Package,
  RefreshCw,
  Search,
  ShieldCheck,
  Syringe
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../services/api";
import {
  getCurrentImmunizationPeriod,
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
import { normalizeImmunizationText as normalizeText } from "./ui/immunization";

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

const currentPeriod = getCurrentImmunizationPeriod();

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
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
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
    setExpanded({});
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

  const selectedUnget = ungets.find(unget => unget.id === adminUngetId);
  const scopeLabel = effectiveScope.ownerType === "IPRESS"
    ? selectedFacility?.name || user?.facilityData?.name || effectiveScope.facilityCode || "Mi IPRESS"
    : effectiveScope.ownerType === "UNGET"
      ? selectedUnget?.name || "Mi almacén UNGET"
      : effectiveScope.ownerType === "DIRESA"
        ? "Almacen regional DIRESA"
        : "Ámbito operativo pendiente";

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-cyan-50 p-3 text-cyan-700"><Boxes className="h-6 w-6" /></div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-black text-slate-900">Stock Biológico</h2>
                  <span className="rounded-lg border border-teal-100 bg-teal-50 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-teal-700">Periodo {currentPeriod}</span>
                </div>
                <p className="mt-1 text-sm text-slate-500">Control operativo del stock propio por producto, lote, vencimiento y valorización.</p>
                {hasOperationalScope && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs font-bold text-slate-600"><MapPin className="h-3.5 w-3.5 text-teal-600" />{scopeLabel}</div>
                )}
              </div>
            </div>
            <button
              onClick={() => void loadStock()}
              disabled={!hasOperationalScope || loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Actualizar
            </button>
          </div>

          {hasOperationalScope && (
            <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
              <Metric label="Productos" value={totals.products} icon={<Syringe className="h-4 w-4" />} />
              <Metric label="Lotes/capas" value={totals.lots} icon={<Boxes className="h-4 w-4" />} />
              <Metric label="Frascos/unid." value={totals.units.toLocaleString("es-PE")} icon={<Package className="h-4 w-4" />} />
              <Metric label="Valorización" value={`S/ ${totals.value.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} icon={<ShieldCheck className="h-4 w-4" />} />
              <button type="button" onClick={() => setExpirationFilter("ALERTS")} disabled={!totals.alerts} className={`col-span-2 rounded-xl border p-4 text-left transition-colors lg:col-span-1 ${totals.alerts ? "border-red-100 bg-red-50 hover:bg-red-100" : "cursor-default border-slate-100 bg-slate-50"}`}>
                <div className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider ${totals.alerts ? "text-red-600" : "text-slate-400"}`}><AlertTriangle className="h-4 w-4" />Alertas vcto.</div>
                <div className={`mt-1 text-xl font-black ${totals.alerts ? "text-red-700" : "text-slate-900"}`}>{totals.alerts}</div>
                {totals.expired > 0 && <div className="mt-1 text-[10px] font-bold text-red-600">{totals.expired} vencidos</div>}
              </button>
            </div>
          )}
        </div>
      </section>

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
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(280px,1fr)_220px_220px_auto]">
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
              <button type="button" onClick={clearFilters} disabled={!hasFilters} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-black text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
                <FilterX className="h-4 w-4" /> Limpiar
              </button>
            </div>
            <div className="mt-3 text-xs text-slate-500"><span className="font-black text-slate-700">{grouped.length}</span> productos y <span className="font-black text-slate-700">{filteredLayers.length}</span> lotes visibles</div>
          </section>

          {loading ? (
            <div className="flex justify-center py-16"><div className="h-9 w-9 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" /></div>
          ) : grouped.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
              <Package className="mx-auto mb-3 h-10 w-10 text-slate-300" />
              <h3 className="font-black text-slate-800">Sin stock registrado</h3>
              <p className="mt-1 text-sm text-slate-500">{hasFilters ? "Cambia los filtros para ampliar los resultados." : "El stock aparecerá al cerrar el inventario inicial o registrar movimientos."}</p>
              {hasFilters && <button type="button" onClick={clearFilters} className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white">Limpiar filtros</button>}
            </div>
          ) : (
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="hidden grid-cols-[130px_minmax(280px,1fr)_110px_120px_150px_150px_160px_32px] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-[10px] font-black uppercase tracking-wide text-slate-500 lg:grid">
                <span>Código</span><span>Producto</span><span>Tipo</span><span>Dosis/Unidad</span><span>Saldo</span><span>Valorización</span><span>Vencimiento próximo</span><span />
              </div>
              <div className="divide-y divide-slate-100">
                {grouped.map(group => {
                  const isOpen = expanded[group.productId] || false;
                  const expirationStatus = group.nearest ? getExpirationStatus(group.nearest) : null;
                  return (
                    <article key={group.productId}>
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        onClick={() => setExpanded(previous => ({ ...previous, [group.productId]: !isOpen }))}
                        className="grid w-full grid-cols-2 gap-3 p-4 text-left transition-colors hover:bg-slate-50 lg:grid-cols-[130px_minmax(280px,1fr)_110px_120px_150px_150px_160px_32px] lg:items-center"
                      >
                        <span className="w-fit rounded-lg border border-teal-100 bg-teal-50 px-2 py-1 font-mono text-xs font-black text-teal-700">{group.codigo}</span>
                        <span className="col-span-2 min-w-0 lg:col-span-1">
                          <span className="block text-[13px] font-bold leading-5 text-slate-900">{group.descripcion}</span>
                          <span className="mt-1 block text-[10px] font-black uppercase tracking-wide text-slate-400">{group.layers.length} {group.layers.length === 1 ? "lote" : "lotes"}</span>
                        </span>
                        <span className="text-xs font-black text-slate-700"><span className="mb-1 block text-[9px] uppercase text-slate-400 lg:hidden">Tipo</span>{group.tipo || "—"}</span>
                        <span className="text-sm font-black text-slate-800"><span className="mb-1 block text-[9px] uppercase text-slate-400 lg:hidden">Dosis/Unidad</span>{group.dosis.toLocaleString("es-PE")}</span>
                        <span className="text-sm font-black text-slate-800"><span className="mb-1 block text-[9px] uppercase text-slate-400 lg:hidden">Saldo</span>{group.total.toLocaleString("es-PE")} <span className="font-medium text-slate-400">fco/unid.</span></span>
                        <span className="text-sm font-bold text-slate-600"><span className="mb-1 block text-[9px] uppercase text-slate-400 lg:hidden">Valorización</span>S/ {group.value.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        {expirationStatus && <span className={`w-fit rounded-lg border px-2 py-1 text-[10px] font-black uppercase ${expirationStatus.className}`}>{expirationStatus.label}</span>}
                        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                      </button>

                      {isOpen && (
                        <div className="bg-slate-50/70 px-3 pb-4 sm:px-4">
                          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                            <table className="w-full min-w-[760px] divide-y divide-slate-100">
                              <thead className="bg-slate-50">
                                <tr>
                                  <TableHeader>Lote</TableHeader><TableHeader>Vencimiento</TableHeader><TableHeader align="right">Saldo</TableHeader><TableHeader align="right">Precio</TableHeader><TableHeader align="right">Valor</TableHeader><TableHeader>Fuente</TableHeader><TableHeader>Suministro</TableHeader>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {group.layers.map((layer, index) => {
                                  const status = getExpirationStatus(layer.expirationDate);
                                  return (
                                    <tr key={layer.id} className="hover:bg-slate-50">
                                      <td className="px-3 py-3 text-xs font-black text-slate-800">{layer.lote}{index === 0 && <span className="ml-2 rounded bg-violet-50 px-1.5 py-0.5 text-[9px] font-black text-violet-700">MÁS PRÓXIMO</span>}</td>
                                      <td className="px-3 py-3"><span className={`rounded-lg border px-2 py-1 text-[10px] font-black uppercase ${status.className}`}>{layer.expirationDate} · {status.shortLabel}</span></td>
                                      <td className="px-3 py-3 text-right text-xs font-black text-slate-900">{layer.currentQuantity.toLocaleString("es-PE")}</td>
                                      <td className="px-3 py-3 text-right text-xs font-bold text-slate-600">S/ {layer.unitPrice.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
                                      <td className="px-3 py-3 text-right text-xs font-black text-slate-700">S/ {(layer.currentQuantity * layer.unitPrice).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                      <td className="px-3 py-3 text-xs text-slate-600">{layer.fundingSource}</td>
                                      <td className="px-3 py-3 text-xs text-slate-600">{layer.supplyType}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
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

const Metric: React.FC<{ label: string; value: React.ReactNode; icon: React.ReactNode }> = ({ label, value, icon }) => (
  <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
    <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">{icon}{label}</div>
    <div className="mt-1 truncate text-xl font-black text-slate-900">{value}</div>
  </div>
);

const FilterSelect: React.FC<{ label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }> = ({ label, value, onChange, options }) => (
  <label className="block">
    <span className="sr-only">{label}</span>
    <select value={value} onChange={event => onChange(event.target.value)} title={label} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100">
      {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  </label>
);

const TableHeader: React.FC<{ children: React.ReactNode; align?: "left" | "right" }> = ({ children, align = "left" }) => (
  <th className={`px-3 py-2 text-[10px] font-black uppercase tracking-wide text-slate-500 ${align === "right" ? "text-right" : "text-left"}`}>{children}</th>
);
