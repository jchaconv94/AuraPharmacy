import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowDownToLine,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  FilterX,
  FileText,
  Loader2,
  PackagePlus,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  X
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
  ImmunizationIncomeBatch,
  ImmunizationIncomeItem,
  ImmunizationIncomeOrigin,
  ImmunizationIncomeSourceType,
  ImmunizationProduct,
  Unget
} from "../types";
import { immunizationInputClass as inputClassName, normalizeImmunizationText as normalizeText, ImmunizationTableHeader as HeaderCell, ImmunizationField as Field, formatImmunizationDate as formatDate, todayInputValue, ImmunizationKpiCard } from "./ui/immunization";

type IncomeItemDraft = ImmunizationIncomeItem & { tempId: string };

const currentPeriod = getCurrentImmunizationPeriod();


const sourceLabel = (sourceType: ImmunizationIncomeSourceType) => {
  if (sourceType === "CENARES") return "CENARES";
  if (sourceType === "OGESS") return "OGESS";
  if (sourceType === "REGIONAL_WAREHOUSE") return "Otro origen";
  if (sourceType === "UNGET_TRANSFER") return "Otro origen";
  return "Otro origen";
};

const inferIncomeSourceType = (sourceName: string): ImmunizationIncomeSourceType => {
  const normalized = normalizeText(sourceName);
  if (normalized.includes("cenares")) return "CENARES";
  if (normalized.includes("ogess")) return "OGESS";
  return "OTHER";
};

const statusLabel = (status: ImmunizationIncomeBatch["status"]) => {
  if (status === "APPLIED") return "Aplicado";
  if (status === "VOIDED") return "Anulado";
  return "Borrador";
};

export const ImmunizationIncomesModule: React.FC = () => {
  const { user } = useAuth();
  const userScope = useMemo(() => getImmunizationScope(user), [user]);
  const isAdmin = userScope.level === "GLOBAL";
  const isDiresaOperator = userScope.ownerType === "DIRESA" || userScope.level === "DIRESA";

  const [ungets, setUngets] = useState<Unget[]>([]);
  const [incomes, setIncomes] = useState<ImmunizationIncomeBatch[]>([]);
  const [detailByIncome, setDetailByIncome] = useState<Record<string, ImmunizationIncomeItem[]>>({});
  const [expandedId, setExpandedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingDetailId, setLoadingDetailId] = useState("");
  const [loadingForm, setLoadingForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [applyingId, setApplyingId] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [products, setProducts] = useState<ImmunizationProduct[]>([]);
  const [incomeOrigins, setIncomeOrigins] = useState<ImmunizationIncomeOrigin[]>([]);
  const [search, setSearch] = useState("");
  const [periodFilter, setPeriodFilter] = useState(currentPeriod);
  const [statusFilter, setStatusFilter] = useState<"ALL" | ImmunizationIncomeBatch["status"]>("ALL");
  const [sourceFilter, setSourceFilter] = useState<"ALL" | ImmunizationIncomeSourceType>("ALL");
  const [ungetFilter, setUngetFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  useEffect(() => {
    let active = true;
    api.getUngets()
      .then(rows => {
        if (!active) return;
        const sorted = [...rows].sort((a, b) => a.name.localeCompare(b.name));
        setUngets(sorted);
      })
      .catch(() => toast.error("No se pudo cargar la lista de UNGET"));
    return () => { active = false; };
  }, []);

  const listScope = useMemo<ImmunizationScope>(() => (
    { level: userScope.level, diresaId: userScope.diresaId, ogessId: userScope.ogessId }
  ), [userScope]);

  const canOperate = isAdmin || isDiresaOperator;
  const isSupervisorView = isAdmin || ["DIRESA", "OGESS", "GLOBAL"].includes(userScope.level);

  const loadIncomes = useCallback(async () => {
    setLoading(true);
    try {
      setIncomes(await immunizationApi.listIncomeBatches(listScope));
      setExpandedId("");
      setDetailByIncome({});
    } catch {
      toast.error("No se pudieron cargar los ingresos regionales");
    } finally {
      setLoading(false);
    }
  }, [listScope]);

  useEffect(() => {
    void loadIncomes();
  }, [loadIncomes]);

  const getDetails = async (income: ImmunizationIncomeBatch) => {
    const id = income.id || "";
    if (!id) return [];
    if (detailByIncome[id]) return detailByIncome[id];
    setLoadingDetailId(id);
    try {
      const items = await immunizationApi.getIncomeItems(id);
      setDetailByIncome(current => ({ ...current, [id]: items }));
      return items;
    } catch {
      toast.error("No se pudo cargar el detalle del ingreso");
      return [];
    } finally {
      setLoadingDetailId("");
    }
  };

  const toggleDetail = async (income: ImmunizationIncomeBatch) => {
    const id = income.id || "";
    if (expandedId === id) {
      setExpandedId("");
      return;
    }
    setExpandedId(id);
    await getDetails(income);
  };

  const openForm = async () => {
    if (!canOperate) {
      toast.warning("Solo DIRESA o administrador autorizado puede registrar ingresos regionales.");
      return;
    }
    setLoadingForm(true);
    try {
      const [catalog, origins] = await Promise.all([
        immunizationApi.getProducts(false),
        immunizationApi.listIncomeOrigins()
      ]);
      if (catalog.length === 0) {
        toast.warning("El catálogo biológico no tiene productos activos.");
        return;
      }
      if (origins.length === 0) {
        toast.warning("No hay orígenes activos. Registra uno en Orígenes de Ingreso.");
        return;
      }
      setProducts(catalog);
      setIncomeOrigins(origins);
      setFormOpen(true);
    } catch {
      toast.error("No se pudo cargar el catálogo biológico");
    } finally {
      setLoadingForm(false);
    }
  };

  const saveAndApplyIncome = async (income: ImmunizationIncomeBatch, items: ImmunizationIncomeItem[]) => {
    setSaving(true);
    try {
      const created = await immunizationApi.createIncomeBatch(income, items);
      if (!created.success || !created.income?.id) {
        toast.error(created.message || "No se pudo guardar el ingreso");
        return;
      }

      const applied = await immunizationApi.applyIncomeBatch(created.income.id, user?.username);
      if (!applied.success) {
        toast.warning(applied.message || "El ingreso quedó en borrador, pero no se pudo aplicar.");
        setFormOpen(false);
        await loadIncomes();
        return;
      }

      toast.success("Ingreso regional aplicado al stock DIRESA");
      setFormOpen(false);
      await loadIncomes();
    } catch {
      toast.error("Ocurrió un error inesperado al registrar el ingreso");
    } finally {
      setSaving(false);
    }
  };

  const applyExistingIncome = async (income: ImmunizationIncomeBatch) => {
    if (!income.id) return;
    setApplyingId(income.id);
    try {
      const result = await immunizationApi.applyIncomeBatch(income.id, user?.username);
      if (!result.success) {
        toast.error(result.message || "No se pudo aplicar el ingreso");
        return;
      }
      toast.success("Ingreso regional aplicado al stock DIRESA");
      await loadIncomes();
    } finally {
      setApplyingId("");
    }
  };

  const availableFilterUngets = useMemo(() => {
    if (userScope.level === "UNGET" && userScope.ungetId) {
      return ungets.filter(unget => unget.id === userScope.ungetId);
    }
    if (userScope.level === "OGESS" && userScope.ogessId) {
      return ungets.filter(unget => unget.ogessId === userScope.ogessId);
    }
    if (userScope.level === "DIRESA" && userScope.diresaId) {
      return ungets.filter(unget => unget.diresaId === userScope.diresaId);
    }
    return ungets;
  }, [ungets, userScope]);

  const periodOptions = useMemo(() => {
    const periods = new Set(incomes.map(income => income.period).filter(Boolean));
    periods.add(currentPeriod);
    return Array.from(periods).sort((a, b) => b.localeCompare(a));
  }, [incomes]);

  const visibleIncomes = useMemo(() => {
    const query = normalizeText(search);
    const allowedUngetIds = new Set(availableFilterUngets.map(unget => unget.id));
    return incomes.filter(income => {
      if (userScope.level === "IPRESS") return false;
      if (userScope.level === "UNGET" && userScope.ungetId && income.ungetId !== userScope.ungetId) return false;
      if (isSupervisorView && income.ungetId && allowedUngetIds.size > 0 && !allowedUngetIds.has(income.ungetId)) return false;
      if (ungetFilter && income.ungetId !== ungetFilter) return false;
      if (periodFilter !== "ALL" && income.period !== periodFilter) return false;
      if (statusFilter !== "ALL" && income.status !== statusFilter) return false;
      if (sourceFilter !== "ALL" && income.sourceType !== sourceFilter) return false;

      const incomeDate = income.incomeDate || (income.createdAt || "").slice(0, 10);
      if (dateFrom && incomeDate && incomeDate < dateFrom) return false;
      if (dateTo && incomeDate && incomeDate > dateTo) return false;

      if (query) {
        const haystack = normalizeText([
          income.period,
          income.ownerType === "DIRESA" ? "DIRESA Regional" : ungets.find(unget => unget.id === income.ungetId)?.name,
          sourceLabel(income.sourceType),
          income.sourceName,
          income.referenceDocument,
          income.observation,
          income.createdBy,
          income.appliedBy,
          statusLabel(income.status)
        ].filter(Boolean).join(" "));
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [availableFilterUngets, dateFrom, dateTo, incomes, isSupervisorView, periodFilter, search, sourceFilter, statusFilter, ungetFilter, ungets, userScope]);

  const hasFilters = Boolean(search || periodFilter !== currentPeriod || statusFilter !== "ALL" || sourceFilter !== "ALL" || ungetFilter || dateFrom || dateTo);
  const clearFilters = () => {
    setSearch("");
    setPeriodFilter(currentPeriod);
    setStatusFilter("ALL");
    setSourceFilter("ALL");
    setUngetFilter("");
    setDateFrom("");
    setDateTo("");
  };

  const totals = useMemo(() => {
    const applied = visibleIncomes.filter(income => income.status === "APPLIED").length;
    const drafts = visibleIncomes.filter(income => income.status === "DRAFT").length;
    return {
      incomes: visibleIncomes.length,
      applied,
      drafts,
      currentPeriod: visibleIncomes.filter(income => income.period === currentPeriod).length
    };
  }, [visibleIncomes]);

  const ungetName = (ungetId?: string) => {
    if (!ungetId) return "-";
    return ungets.find(unget => unget.id === ungetId)?.name || `UNGET ${ungetId}`;
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700"><ArrowDownToLine className="h-6 w-6" /></div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-black text-slate-900">Ingresos Regionales</h2>
                <span className="rounded-lg border border-teal-100 bg-teal-50 px-2 py-1 text-[10px] font-black uppercase text-teal-700">Periodo {currentPeriod}</span>
              </div>
              <p className="mt-1 max-w-3xl text-sm text-slate-500">
                Registra ingresos nuevos al almacen regional de inmunizaciones de DIRESA.
              </p>
              {canOperate && <p className="mt-2 text-xs font-bold text-slate-600">Almacen operativo <span className="text-teal-700">Regional DIRESA</span></p>}
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={() => void loadIncomes()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Actualizar
            </button>
            {canOperate && (
              <button type="button" onClick={() => void openForm()} disabled={loadingForm} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60">
                {loadingForm ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{loadingForm ? "Preparando..." : "Nuevo ingreso"}
              </button>
            )}
          </div>
        </div>
      </section>

      {!canOperate && (
        <section className={`flex items-start gap-3 rounded-2xl px-5 py-4 ${isSupervisorView ? "border border-blue-200 bg-blue-50 text-blue-950" : "border border-amber-200 bg-amber-50 text-amber-950"}`}>
          {isSupervisorView ? <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" /> : <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />}
          <div>
            <h3 className="text-sm font-black">{isSupervisorView ? "Vista de supervisión de ingresos regionales" : "Módulo operativo DIRESA"}</h3>
            <p className={`mt-1 text-xs leading-5 ${isSupervisorView ? "text-blue-800" : "text-amber-800"}`}>
              {isSupervisorView
                ? "Puede consultar y filtrar ingresos regionales por periodo, fechas, estado, origen y UNGET cuando aplique."
                : "Los ingresos regionales aumentan el stock DIRESA. Si el usuario es UNGET o IPRESS, debe usar recepciones, consulta o reajustes segun corresponda."}
            </p>
          </div>
        </section>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <ImmunizationKpiCard tone="info" label="Ingresos" value={totals.incomes.toString()} icon={<ArrowDownToLine className="h-5 w-5" />} />
        <ImmunizationKpiCard tone="info" label="Aplicados" value={totals.applied.toString()} icon={<ShieldCheck className="h-5 w-5" />} />
        <ImmunizationKpiCard tone="info" label="Borradores" value={totals.drafts.toString()} icon={<FileText className="h-5 w-5" />} />
        <ImmunizationKpiCard tone="info" label="Periodo actual" value={totals.currentPeriod.toString()} icon={<CalendarDays className="h-5 w-5" />} />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input value={search} onChange={event => setSearch(event.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-400 focus:border-teal-500 focus:ring-4 focus:ring-teal-100" placeholder="Buscar ingresos..." />
          </div>

          {isSupervisorView && (
            <select value={ungetFilter} onChange={event => setUngetFilter(event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100 xl:w-52" aria-label="Filtrar por UNGET">
              <option value="">Todas las UNGET</option>
              {availableFilterUngets.map(unget => <option key={unget.id} value={unget.id}>{unget.name}</option>)}
            </select>
          )}

          <select value={periodFilter} onChange={event => setPeriodFilter(event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100 xl:w-36" aria-label="Filtrar por periodo">
            <option value="ALL">Todos los meses</option>
            {periodOptions.map(period => <option key={period} value={period}>{period}</option>)}
          </select>

          <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as "ALL" | ImmunizationIncomeBatch["status"])} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100 xl:w-44" aria-label="Filtrar por estado">
            <option value="ALL">Todos los estados</option>
            <option value="APPLIED">Aplicados</option>
            <option value="DRAFT">Borradores</option>
            <option value="VOIDED">Anulados</option>
          </select>

          <select value={sourceFilter} onChange={event => setSourceFilter(event.target.value as "ALL" | ImmunizationIncomeSourceType)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100 xl:w-48" aria-label="Filtrar por origen">
            <option value="ALL">Todos los orígenes</option>
            <option value="CENARES">CENARES</option>
            <option value="OGESS">OGESS</option>
            <option value="OTHER">Otro</option>
          </select>

          <button type="button" onClick={() => setShowAdvancedFilters(current => !current)} className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-black transition-colors ${dateFrom || dateTo || showAdvancedFilters ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
            <CalendarDays className="h-4 w-4" /> Fechas
            <ChevronDown className={`h-4 w-4 transition-transform ${showAdvancedFilters ? "rotate-180" : ""}`} />
          </button>

          <button type="button" onClick={clearFilters} disabled={!hasFilters} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
            <FilterX className="h-4 w-4" /> Limpiar
          </button>
        </div>

        {(showAdvancedFilters || dateFrom || dateTo) && (
          <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-slate-400">Desde</span>
                <input type="date" value={dateFrom} onChange={event => setDateFrom(event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100" />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-slate-400">Hasta</span>
                <input type="date" value={dateTo} onChange={event => setDateTo(event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100" />
              </label>
            </div>
            <p className="text-xs text-slate-500">
              Mostrando <span className="font-black text-slate-800">{visibleIncomes.length}</span> de <span className="font-black text-slate-800">{incomes.length}</span>
            </p>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 p-4">
          <FileText className="h-4 w-4 text-teal-600" />
          <h3 className="text-sm font-black uppercase tracking-wide text-slate-900">Historial de ingresos regionales</h3>
        </div>
        {loading ? (
          <div className="flex justify-center py-16"><div className="h-9 w-9 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" /></div>
        ) : visibleIncomes.length === 0 ? (
          <div className="p-10 text-center">
            <ArrowDownToLine className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <h3 className="font-black text-slate-800">{incomes.length === 0 ? "Sin ingresos registrados" : "Sin resultados para los filtros"}</h3>
            <p className="mt-1 text-sm text-slate-500">
              {incomes.length === 0
                ? (canOperate ? "Registre el primer ingreso regional de DIRESA." : "Aqui apareceran los ingresos regionales segun su alcance.")
                : "Modifique o limpie los filtros para ampliar la búsqueda."}
            </p>
            {incomes.length > 0 && <button type="button" onClick={clearFilters} className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white">Limpiar filtros</button>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  <HeaderCell>Fecha / periodo</HeaderCell>
                  <HeaderCell>Ámbito</HeaderCell>
                  <HeaderCell>Origen</HeaderCell>
                  <HeaderCell>N° PECOSA</HeaderCell>
                  <HeaderCell>Usuario</HeaderCell>
                  <HeaderCell>Estado</HeaderCell>
                  <HeaderCell align="right">Acciones</HeaderCell>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleIncomes.map(income => {
                  const sourceClassification = sourceLabel(income.sourceType);
                  const showClassification = Boolean(income.sourceName && sourceClassification !== "Otro origen");
                  return (
                  <React.Fragment key={income.id}>
                    <tr className="hover:bg-slate-50/70">
                      <td className="px-4 py-3"><p className="text-xs font-black text-slate-800">{formatIncomeDate(income.incomeDate, income.createdAt)}</p><p className="mt-1 font-mono text-[10px] font-bold text-teal-700">{income.period}</p></td>
                      <td className="px-4 py-3 text-xs font-black text-slate-800">{income.ownerType === "DIRESA" ? "DIRESA Regional" : ungetName(income.ungetId)}</td>
                      <td className="px-4 py-3"><p className="text-xs font-bold text-slate-700">{income.sourceName || sourceClassification}</p>{showClassification && <p className="mt-1 text-[10px] text-slate-500">{sourceClassification}</p>}</td>
                      <td className="max-w-xs px-4 py-3"><p className="line-clamp-1 text-xs font-bold text-slate-600">{income.referenceDocument || "-"}</p>{income.observation && <p className="mt-1 line-clamp-1 text-[10px] text-slate-500">{income.observation}</p>}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{income.appliedBy || income.createdBy || "-"}</td>
                      <td className="px-4 py-3"><StatusBadge status={income.status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          {income.status === "DRAFT" && canOperate && income.ownerType === "DIRESA" && (
                            <button type="button" onClick={() => void applyExistingIncome(income)} disabled={applyingId === income.id} className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white hover:bg-emerald-700 disabled:opacity-60">
                              {applyingId === income.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}Aplicar
                            </button>
                          )}
                          <button type="button" onClick={() => void toggleDetail(income)} aria-label="Ver detalle" className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800">
                            {expandedId === income.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedId === income.id && (
                      <tr>
                        <td colSpan={7} className="bg-slate-50/70 px-4 py-3">
                          <IncomeDetail items={detailByIncome[income.id || ""] || []} loading={loadingDetailId === income.id} />
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

      <IncomeModal
        isOpen={formOpen}
        products={products}
        origins={incomeOrigins}
        period={currentPeriod}
        username={user?.username}
        isSaving={saving}
        onClose={() => { if (!saving) setFormOpen(false); }}
        onSubmit={(income, items) => void saveAndApplyIncome(income, items)}
      />
    </div>
  );
};

function IncomeModal({
  isOpen,
  products,
  origins,
  period,
  username,
  isSaving,
  onClose,
  onSubmit
}: {
  isOpen: boolean;
  products: ImmunizationProduct[];
  origins: ImmunizationIncomeOrigin[];
  period: string;
  username?: string;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (income: ImmunizationIncomeBatch, items: ImmunizationIncomeItem[]) => void;
}) {
  const productSearchRef = useRef<HTMLInputElement>(null);
  const [selectedOriginId, setSelectedOriginId] = useState("");
  const [referenceDocument, setReferenceDocument] = useState("");
  const [incomeDate, setIncomeDate] = useState(todayInputValue());
  const [observation, setObservation] = useState("");
  const [items, setItems] = useState<IncomeItemDraft[]>([]);
  const [error, setError] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [resultsOpen, setResultsOpen] = useState(false);
  const [activeResultIndex, setActiveResultIndex] = useState(0);
  const [itemForm, setItemForm] = useState({
    lote: "",
    expirationDate: "",
    quantity: "",
    unitPrice: "",
    fundingSource: "",
    supplyType: "",
    observation: ""
  });

  useEffect(() => {
    if (!isOpen) return;
    setSelectedOriginId(origins[0]?.id || "");
    setReferenceDocument("");
    setIncomeDate(todayInputValue());
    setObservation("");
    setItems([]);
    setError("");
    setProductSearch("");
    setSelectedProductId("");
    setResultsOpen(false);
    setActiveResultIndex(0);
    setItemForm({ lote: "", expirationDate: "", quantity: "", unitPrice: "", fundingSource: "", supplyType: "", observation: "" });
    const timer = window.setTimeout(() => productSearchRef.current?.focus(), 80);
    return () => window.clearTimeout(timer);
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

  const selectedProduct = useMemo(
    () => products.find(product => product.id === selectedProductId),
    [products, selectedProductId]
  );

  const selectedOrigin = useMemo(
    () => origins.find(origin => origin.id === selectedOriginId),
    [origins, selectedOriginId]
  );

  const filteredProducts = useMemo(() => {
    const query = normalizeText(productSearch);
    if (!query || selectedProductId) return [];
    return products
      .filter(product => normalizeText(`${product.codigoSismed} ${product.descripcion}`).includes(query))
      .slice(0, 10);
  }, [productSearch, products, selectedProductId]);

  if (!isOpen) return null;

  const updateItemField = (field: keyof typeof itemForm, value: string) => {
    setItemForm(current => ({ ...current, [field]: value }));
    if (error) setError("");
  };

  const selectProduct = (product: ImmunizationProduct) => {
    setSelectedProductId(product.id || "");
    setProductSearch(`${product.codigoSismed} - ${product.descripcion}`);
    setResultsOpen(false);
    setActiveResultIndex(0);
  };

  const handleProductSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!resultsOpen || filteredProducts.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveResultIndex(current => Math.min(current + 1, filteredProducts.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveResultIndex(current => Math.max(current - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      selectProduct(filteredProducts[activeResultIndex]);
    } else if (event.key === "Escape") {
      setResultsOpen(false);
    }
  };

  const resetItemForm = () => {
    setSelectedProductId("");
    setProductSearch("");
    setItemForm({ lote: "", expirationDate: "", quantity: "", unitPrice: "", fundingSource: "", supplyType: "", observation: "" });
    window.setTimeout(() => productSearchRef.current?.focus(), 0);
  };

  const addItem = () => {
    const quantity = Number(itemForm.quantity);
    const unitPrice = Number(itemForm.unitPrice);
    if (!selectedProduct?.id || !itemForm.lote.trim() || !itemForm.expirationDate || !itemForm.fundingSource.trim() || !itemForm.supplyType.trim()) {
      setError("Complete producto, lote, vencimiento, fuente y suministro.");
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) {
      setError("La cantidad debe ser mayor a cero y el precio no puede ser negativo.");
      return;
    }
    const draft: IncomeItemDraft = {
      tempId: `income-item-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      productId: selectedProduct.id,
      codigoSismedSnapshot: selectedProduct.codigoSismed,
      lote: itemForm.lote.trim(),
      expirationDate: itemForm.expirationDate,
      quantity,
      unitPrice,
      fundingSource: itemForm.fundingSource.trim(),
      supplyType: itemForm.supplyType.trim(),
      observation: itemForm.observation.trim() || undefined,
      product: selectedProduct
    };
    setItems(current => [...current, draft]);
    setError("");
    resetItemForm();
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedOrigin) {
      setError("Seleccione el origen del ingreso regional.");
      return;
    }
    if (!referenceDocument.trim()) {
      setError("Ingrese el numero de PECOSA del ingreso regional.");
      return;
    }
    if (!incomeDate) {
      setError("Seleccione la fecha de ingreso.");
      return;
    }
    if (items.length === 0) {
      setError("Agregue al menos un producto/lote al ingreso.");
      return;
    }
    const income: ImmunizationIncomeBatch = {
      ownerType: "DIRESA",
      regionalWarehouseId: "DIRESA_SAN_MARTIN_REGIONAL",
      period,
      sourceType: inferIncomeSourceType(selectedOrigin.name),
      sourceName: selectedOrigin.name,
      referenceDocument: referenceDocument.trim() || undefined,
      incomeDate,
      status: "DRAFT",
      observation: observation.trim() || undefined,
      createdBy: username
    };
    onSubmit(income, items.map(({ tempId, ...item }) => item));
  };

  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalValue = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  return createPortal(
    <div
      className="fixed inset-0 z-[1190000] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm animate-in fade-in duration-200 sm:p-5"
      onMouseDown={event => {
        if (event.target === event.currentTarget && !isSaving) onClose();
      }}
    >
      <section role="dialog" aria-modal="true" aria-labelledby="income-modal-title" className="my-auto w-full max-w-5xl overflow-hidden rounded-3xl border border-white/70 bg-white shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-3 duration-200">
        <header className="flex items-start justify-between border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-white px-5 py-5 sm:px-7">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700"><PackagePlus className="h-6 w-6" /></div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">Ingreso regional</p>
              <h2 id="income-modal-title" className="mt-1 text-xl font-black text-slate-900">Nuevo ingreso de biológicos</h2>
              <p className="mt-1 text-xs text-slate-500">Agrega varios productos/lotes y aplica el ingreso al stock regional DIRESA.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={isSaving} aria-label="Cerrar formulario" className="rounded-xl p-2 text-slate-400 hover:bg-white hover:text-slate-700 disabled:opacity-40">
            <X className="h-5 w-5" />
          </button>
        </header>

        <form onSubmit={submit}>
          <div className="max-h-[72vh] space-y-5 overflow-y-auto overflow-x-hidden p-5 sm:p-7">
            <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="mb-3 flex items-center gap-2"><ArrowDownToLine className="h-4 w-4 text-emerald-700" /><h3 className="text-xs font-black uppercase tracking-wide text-slate-700">Datos del ingreso</h3></div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(260px,1fr)_220px_180px]">
                <Field label="Origen del ingreso" required>
                  <select value={selectedOriginId} onChange={event => setSelectedOriginId(event.target.value)} disabled={isSaving} className={inputClassName}>
                    <option value="">Seleccione origen...</option>
                    {origins.map(origin => <option key={origin.id || origin.name} value={origin.id || origin.name}>{origin.name}</option>)}
                  </select>
                </Field>
                <Field label="N° PECOSA" required>
                  <input value={referenceDocument} onChange={event => setReferenceDocument(event.target.value)} disabled={isSaving} className={inputClassName} placeholder="Ej. PECOSA 000123-2026" />
                </Field>
                <Field label="Fecha de ingreso" required>
                  <input type="date" value={incomeDate} onChange={event => setIncomeDate(event.target.value)} disabled={isSaving} className={inputClassName} />
                </Field>
              </div>
              <Field label="Observación general">
                <textarea value={observation} onChange={event => setObservation(event.target.value)} disabled={isSaving} rows={2} className={`${inputClassName} mt-3 min-h-20 resize-y py-3`} placeholder="Sustento u observación del ingreso..." />
              </Field>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center gap-2"><PackagePlus className="h-4 w-4 text-emerald-700" /><h3 className="text-xs font-black uppercase tracking-wide text-slate-700">Agregar producto/lote</h3></div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
                <div className="lg:col-span-2 xl:col-span-4">
                  <label htmlFor="income-product-search" className="mb-1.5 block text-xs font-black text-slate-700">Producto <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3.5 top-3.5 z-10 h-5 w-5 text-slate-400" />
                    <input
                      ref={productSearchRef}
                      id="income-product-search"
                      type="search"
                      role="combobox"
                      aria-expanded={resultsOpen}
                      value={productSearch}
                      onFocus={() => setResultsOpen(true)}
                      onBlur={() => window.setTimeout(() => setResultsOpen(false), 150)}
                      onKeyDown={handleProductSearchKeyDown}
                      onChange={event => {
                        setProductSearch(event.target.value);
                        setSelectedProductId("");
                        setResultsOpen(true);
                        setActiveResultIndex(0);
                      }}
                      disabled={isSaving}
                      autoComplete="off"
                      placeholder="Buscar código SISMED o descripción..."
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-10 text-sm font-semibold text-slate-800 outline-none transition-shadow placeholder:text-slate-400 focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
                    />
                    {selectedProductId && (
                      <button type="button" onMouseDown={event => event.preventDefault()} onClick={() => { setSelectedProductId(""); setProductSearch(""); setResultsOpen(true); }} aria-label="Cambiar producto" className="absolute right-2.5 top-2.5 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                        <X className="h-4 w-4" />
                      </button>
                    )}
                    {resultsOpen && !selectedProductId && productSearch.trim() && (
                      <div className="absolute z-40 mt-2 max-h-72 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xl">
                        {filteredProducts.length === 0 ? (
                          <div className="px-4 py-6 text-center"><p className="text-sm font-black text-slate-700">Producto no encontrado</p><p className="mt-1 text-xs text-slate-500">Debe existir en el catálogo biológico.</p></div>
                        ) : filteredProducts.map((product, index) => (
                          <button key={product.id || product.codigoSismed} type="button" onMouseDown={event => event.preventDefault()} onMouseEnter={() => setActiveResultIndex(index)} onClick={() => selectProduct(product)} className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${index === activeResultIndex ? "bg-emerald-50" : "hover:bg-slate-50"}`}>
                            <span className="shrink-0 rounded-lg bg-slate-100 px-2 py-1 font-mono text-xs font-black text-teal-700">{product.codigoSismed}</span>
                            <span className="min-w-0"><span className="block text-sm font-bold text-slate-900">{product.descripcion}</span><span className="mt-0.5 block text-[10px] font-black uppercase tracking-wide text-slate-400">{product.tipoProducto} · {product.dosisUnidad} dosis/unidad</span></span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <Field label="Lote" required><input value={itemForm.lote} onChange={event => updateItemField("lote", event.target.value)} disabled={isSaving} className={inputClassName} placeholder="Lote" /></Field>
                <Field label="Vencimiento" required><input type="date" value={itemForm.expirationDate} onChange={event => updateItemField("expirationDate", event.target.value)} disabled={isSaving} className={inputClassName} /></Field>
                <Field label="Cantidad" required><input type="number" min="1" step="1" value={itemForm.quantity} onChange={event => updateItemField("quantity", event.target.value)} disabled={isSaving} className={inputClassName} placeholder="0" /></Field>
                <Field label="Precio" required><input type="number" min="0" step="0.0001" value={itemForm.unitPrice} onChange={event => updateItemField("unitPrice", event.target.value)} disabled={isSaving} className={inputClassName} placeholder="0.00" /></Field>
                <Field label="Fuente" required><input value={itemForm.fundingSource} onChange={event => updateItemField("fundingSource", event.target.value)} disabled={isSaving} className={inputClassName} placeholder="ROR" /></Field>
                <Field label="Suministro" required><input value={itemForm.supplyType} onChange={event => updateItemField("supplyType", event.target.value)} disabled={isSaving} className={inputClassName} placeholder="CI" /></Field>
                <div className="flex items-end">
                  <button type="button" onClick={addItem} disabled={isSaving} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-black text-white hover:bg-slate-800 disabled:opacity-50">
                    <Plus className="h-4 w-4" />Agregar
                  </button>
                </div>
              </div>
              <textarea value={itemForm.observation} onChange={event => updateItemField("observation", event.target.value)} disabled={isSaving} rows={2} className={`${inputClassName} mt-3 min-h-16 resize-y py-3`} placeholder="Observación del producto/lote, si aplica..." />
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="flex flex-col gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-xs font-black uppercase tracking-wide text-slate-700">Productos del ingreso</h3>
                <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-wide">
                  <span className="rounded-lg bg-emerald-50 px-2 py-1 text-emerald-700">{items.length} lotes</span>
                  <span className="rounded-lg bg-slate-100 px-2 py-1 text-slate-600">{totalQuantity.toLocaleString("es-PE")} fco/unid.</span>
                  <span className="rounded-lg bg-slate-100 px-2 py-1 text-slate-600">S/ {totalValue.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>
              {items.length === 0 ? (
                <div className="p-8 text-center"><PackagePlus className="mx-auto mb-2 h-9 w-9 text-slate-300" /><p className="text-sm font-bold text-slate-600">Aún no agregaste productos al ingreso.</p></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-slate-50"><tr><HeaderCell>Código</HeaderCell><HeaderCell>Producto</HeaderCell><HeaderCell>Lote</HeaderCell><HeaderCell>Vencimiento</HeaderCell><HeaderCell align="right">Cantidad</HeaderCell><HeaderCell align="right">Precio</HeaderCell><HeaderCell>Fuente</HeaderCell><HeaderCell>Suministro</HeaderCell><HeaderCell align="right">Quitar</HeaderCell></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.map(item => (
                        <tr key={item.tempId}>
                          <td className="px-3 py-3 font-mono text-xs font-black text-teal-700">{item.codigoSismedSnapshot}</td>
                          <td className="max-w-sm px-3 py-3 text-xs font-bold text-slate-800">{item.product?.descripcion || "-"}</td>
                          <td className="px-3 py-3 text-xs font-black text-slate-700">{item.lote}</td>
                          <td className="px-3 py-3 text-xs text-slate-600">{item.expirationDate}</td>
                          <td className="px-3 py-3 text-right text-xs font-black text-slate-900">{item.quantity.toLocaleString("es-PE")}</td>
                          <td className="px-3 py-3 text-right text-xs font-bold text-slate-600">S/ {item.unitPrice.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
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
            <button type="button" onClick={onClose} disabled={isSaving} className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-100 disabled:opacity-50">
              Cancelar
            </button>
            <button type="submit" disabled={isSaving || items.length === 0} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {isSaving ? "Aplicando..." : "Guardar y aplicar ingreso"}
            </button>
          </footer>
        </form>
      </section>
    </div>,
    document.body
  );
}

function IncomeDetail({ items, loading }: { items: ImmunizationIncomeItem[]; loading: boolean }) {
  if (loading) return <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-teal-600" /></div>;
  if (items.length === 0) return <p className="py-4 text-center text-sm text-slate-500">Sin detalle disponible.</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full divide-y divide-slate-100">
        <thead className="bg-slate-50"><tr><HeaderCell>Código</HeaderCell><HeaderCell>Producto</HeaderCell><HeaderCell>Lote</HeaderCell><HeaderCell>Vencimiento</HeaderCell><HeaderCell align="right">Cantidad</HeaderCell><HeaderCell align="right">Precio</HeaderCell><HeaderCell align="right">Valor</HeaderCell><HeaderCell>Fuente</HeaderCell><HeaderCell>Suministro</HeaderCell></tr></thead>
        <tbody className="divide-y divide-slate-100">
          {items.map(item => (
            <tr key={item.id || `${item.productId}-${item.lote}`}>
              <td className="px-3 py-3 font-mono text-xs font-black text-teal-700">{item.codigoSismedSnapshot}</td>
              <td className="max-w-sm px-3 py-3 text-xs font-bold text-slate-800">{item.product?.descripcion || "-"}</td>
              <td className="px-3 py-3 text-xs font-black text-slate-700">{item.lote}</td>
              <td className="px-3 py-3 text-xs text-slate-600">{item.expirationDate}</td>
              <td className="px-3 py-3 text-right text-xs font-black text-slate-900">{item.quantity.toLocaleString("es-PE")}</td>
              <td className="px-3 py-3 text-right text-xs font-bold text-slate-600">S/ {item.unitPrice.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
              <td className="px-3 py-3 text-right text-xs font-black text-slate-700">S/ {(item.quantity * item.unitPrice).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              <td className="px-3 py-3 text-xs text-slate-600">{item.fundingSource}</td>
              <td className="px-3 py-3 text-xs text-slate-600">{item.supplyType}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }: { status: ImmunizationIncomeBatch["status"] }) {
  const className = status === "APPLIED"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : status === "VOIDED"
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-amber-200 bg-amber-50 text-amber-700";
  return <span className={`inline-flex rounded-lg border px-2 py-1 text-[10px] font-black uppercase ${className}`}>{statusLabel(status)}</span>;
}

function formatIncomeDate(incomeDate?: string, fallback?: string) {
  if (!incomeDate) return formatDate(fallback);
  try {
    return new Intl.DateTimeFormat("es-PE", { dateStyle: "short" }).format(new Date(`${incomeDate}T00:00:00`));
  } catch {
    return incomeDate;
  }
}

