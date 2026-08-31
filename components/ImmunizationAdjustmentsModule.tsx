import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  FileDown,
  FileText,
  Filter,
  Loader2,
  Plus,
  RefreshCw,
  Scale,
  ShieldCheck
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../services/api";
import { CustomSelect } from "./ui/CustomSelect";
import { downloadImmunizationAdjustmentPdf } from "../services/immunizationAdjustmentPdfService";
import {
  getCurrentImmunizationPeriod,
  getImmunizationScope,
  ImmunizationScope,
  immunizationApi
} from "../services/immunizationApi";
import {
  HealthFacility,
  ImmunizationAdjustment,
  ImmunizationAdjustmentItem,
  ImmunizationOwnerType,
  ImmunizationProduct,
  ImmunizationStockLayer,
  Unget
} from "../types";
import { ImmunizationTableHeader as HeaderCell, formatImmunizationDate as formatDate, ImmunizationKpiCard, immunizationSelectClass as selectClassName, ImmunizationUninitializedFacilityBanner } from "./ui/immunization";
import { ImmunizationAdjustmentModal } from "./ImmunizationAdjustmentModal";

export function ImmunizationAdjustmentsModule() {
  const { user } = useAuth();
  const userScope = useMemo(() => getImmunizationScope(user), [user]);
  const isAdmin = userScope.level === "GLOBAL";
  const [adminOwnerType, setAdminOwnerType] = useState<ImmunizationOwnerType>("IPRESS");
  const [adminUngetId, setAdminUngetId] = useState("");
  const [adminFacilityCode, setAdminFacilityCode] = useState("");
  const [ungets, setUngets] = useState<Unget[]>([]);
  const [facilities, setFacilities] = useState<HealthFacility[]>([]);
  const [adjustments, setAdjustments] = useState<ImmunizationAdjustment[]>([]);
  const [detailByAdjustment, setDetailByAdjustment] = useState<Record<string, ImmunizationAdjustmentItem[]>>({});
  const [expandedId, setExpandedId] = useState("");
  const [loadingDetailId, setLoadingDetailId] = useState("");
  const [isInitialized, setIsInitialized] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingForm, setLoadingForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [layers, setLayers] = useState<ImmunizationStockLayer[]>([]);
  const [products, setProducts] = useState<ImmunizationProduct[]>([]);
  const [auditOwnerFilter, setAuditOwnerFilter] = useState<"ALL" | ImmunizationOwnerType>("ALL");
  const [auditUngetFilter, setAuditUngetFilter] = useState("");
  const [auditFacilityFilter, setAuditFacilityFilter] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([api.getUngets(), api.getFacilities()]).then(([nextUngets, nextFacilities]) => {
      if (!active) return;
      setUngets(nextUngets);
      setFacilities(nextFacilities);
      if (nextUngets[0]?.id) setAdminUngetId(current => current || nextUngets[0].id);
    }).catch(() => toast.error("No se pudo cargar la estructura territorial."));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (userScope.level === "UNGET" && userScope.ungetId) {
      setAuditUngetFilter(userScope.ungetId);
    }
  }, [userScope.level, userScope.ungetId]);

  const facilitiesForAdmin = useMemo(
    () => facilities.filter(facility => !adminUngetId || facility.ungetId === adminUngetId),
    [adminUngetId, facilities]
  );

  useEffect(() => {
    if (!isAdmin || adminOwnerType !== "IPRESS") return;
    if (!facilitiesForAdmin.some(facility => facility.code === adminFacilityCode)) {
      setAdminFacilityCode(facilitiesForAdmin[0]?.code || "");
    }
  }, [adminFacilityCode, adminOwnerType, facilitiesForAdmin, isAdmin]);

  const effectiveScope = useMemo<ImmunizationScope>(() => {
    if (!isAdmin) return userScope;
    if (adminOwnerType === "UNGET" && adminUngetId) {
      return { level: "UNGET", ownerType: "UNGET", ungetId: adminUngetId };
    }
    if (adminOwnerType === "IPRESS" && adminFacilityCode) {
      return { level: "IPRESS", ownerType: "IPRESS", facilityCode: adminFacilityCode, ungetId: adminUngetId || undefined };
    }
    return { level: "GLOBAL" };
  }, [adminFacilityCode, adminOwnerType, adminUngetId, isAdmin, userScope]);

  const canOperate = effectiveScope.ownerType === "UNGET"
    ? Boolean(effectiveScope.ungetId)
    : effectiveScope.ownerType === "IPRESS"
      ? Boolean(effectiveScope.facilityCode)
      : false;

  const showTerritorialFilters = !isAdmin && ["UNGET", "DIRESA", "OGESS"].includes(userScope.level);
  const availableFilterUngets = useMemo(
    () => userScope.level === "UNGET" && userScope.ungetId
      ? ungets.filter(unget => unget.id === userScope.ungetId)
      : ungets,
    [ungets, userScope.level, userScope.ungetId]
  );
  const facilitiesForAudit = useMemo(() => facilities.filter(facility => {
    if (userScope.level === "UNGET" && userScope.ungetId && facility.ungetId !== userScope.ungetId) return false;
    return !auditUngetFilter || facility.ungetId === auditUngetFilter;
  }), [auditUngetFilter, facilities, userScope.level, userScope.ungetId]);

  const loadAdjustments = useCallback(async () => {
    setLoading(true);
    try {
      const initPromise = effectiveScope.ownerType === "IPRESS" && effectiveScope.facilityCode
        ? immunizationApi.isFacilityInitialized(effectiveScope)
        : Promise.resolve(true);

      if (!isAdmin && userScope.level === "UNGET" && userScope.ungetId) {
        const facilityCodes = facilities.filter(facility => facility.ungetId === userScope.ungetId).map(facility => facility.code);
        const [ownAdjustments, facilityAdjustments, initialized] = await Promise.all([
          immunizationApi.listAdjustments({ level: "UNGET", ownerType: "UNGET", ungetId: userScope.ungetId }),
          facilityCodes.length > 0
            ? immunizationApi.listAdjustments({ level: "IPRESS", ownerType: "IPRESS", facilityCodes })
            : Promise.resolve([]),
          initPromise
        ]);
        setAdjustments([...ownAdjustments, ...facilityAdjustments].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")));
        setIsInitialized(initialized);
      } else {
        const [rows, initialized] = await Promise.all([
          immunizationApi.listAdjustments(effectiveScope),
          initPromise
        ]);
        setAdjustments(rows);
        setIsInitialized(initialized);
      }
      setExpandedId("");
      setDetailByAdjustment({});
    } catch {
      toast.error("No se pudieron cargar los reajustes.");
    } finally {
      setLoading(false);
    }
  }, [effectiveScope, facilities, isAdmin, userScope.level, userScope.ungetId]);

  useEffect(() => {
    void loadAdjustments();
  }, [loadAdjustments]);

  const ownerName = (adjustment: ImmunizationAdjustment) => {
    if (adjustment.ownerType === "UNGET") {
      return ungets.find(unget => unget.id === adjustment.ungetId)?.name || `UNGET ${adjustment.ungetId || "-"}`;
    }
    const facility = facilities.find(item => item.code === adjustment.facilityCode);
    return facility ? `${facility.code} · ${facility.name}` : `IPRESS ${adjustment.facilityCode || "-"}`;
  };

  const visibleAdjustments = useMemo(() => adjustments.filter(adjustment => {
    if (auditOwnerFilter !== "ALL" && adjustment.ownerType !== auditOwnerFilter) return false;
    if (auditFacilityFilter && adjustment.facilityCode !== auditFacilityFilter) return false;
    if (auditUngetFilter) {
      if (adjustment.ownerType === "UNGET" && adjustment.ungetId !== auditUngetFilter) return false;
      if (adjustment.ownerType === "IPRESS") {
        const facility = facilities.find(item => item.code === adjustment.facilityCode);
        if (facility?.ungetId !== auditUngetFilter) return false;
      }
    }
    return true;
  }), [adjustments, auditFacilityFilter, auditOwnerFilter, auditUngetFilter, facilities]);

  const openForm = async () => {
    if (!canOperate) {
      toast.warning("Seleccione una UNGET o IPRESS operativa antes de registrar el reajuste.");
      return;
    }
    if (effectiveScope.ownerType === "IPRESS" && isInitialized === false) {
      toast.error("El establecimiento aún no cuenta con inventario inicial cerrado ni remesa inicial recibida.");
      return;
    }
    setLoadingForm(true);
    try {
      const locked = await immunizationApi.isPeriodLocked(effectiveScope, getCurrentImmunizationPeriod());
      if (locked) {
        const ownerLabel = effectiveScope.ownerType === "IPRESS" ? "esta IPRESS" : "esta UNGET";
        toast.error(`El periodo ${getCurrentImmunizationPeriod()} ya está cerrado o precerrado para ${ownerLabel}. No se pueden registrar reajustes. Si corresponde, primero debe reabrirse el periodo.`);
        return;
      }
      const [nextLayers, nextProducts] = await Promise.all([
        immunizationApi.getStockLayers(effectiveScope),
        immunizationApi.getProducts(false)
      ]);
      setLayers(nextLayers);
      setProducts(nextProducts);
      setFormOpen(true);
    } catch {
      toast.error("No se pudo preparar el conteo físico.");
    } finally {
      setLoadingForm(false);
    }
  };

  const saveAdjustment = async (items: ImmunizationAdjustmentItem[], reason: string, observation: string) => {
    if (!effectiveScope.ownerType) return;
    setSaving(true);
    const draft: ImmunizationAdjustment = {
      ownerType: effectiveScope.ownerType,
      ungetId: effectiveScope.ownerType === "UNGET" ? effectiveScope.ungetId : undefined,
      facilityCode: effectiveScope.ownerType === "IPRESS" ? effectiveScope.facilityCode : undefined,
      period: getCurrentImmunizationPeriod(),
      status: "APPLIED",
      reason,
      observation,
      createdBy: user?.username
    };
    try {
      const result = await immunizationApi.createAdjustment(draft, items);
      if (!result.success || !result.adjustment) {
        toast.error(result.message || "No se pudo aplicar el reajuste.");
        return;
      }
      const adjustmentId = result.adjustment.id || "";
      setDetailByAdjustment(current => ({ ...current, [adjustmentId]: items }));
      setFormOpen(false);
      toast.success("Reajuste aplicado y registrado en auditoría.");
      await loadAdjustments();
    } catch {
      toast.error("Ocurrió un error inesperado al aplicar el reajuste.");
    } finally {
      setSaving(false);
    }
  };

  const getDetails = async (adjustment: ImmunizationAdjustment) => {
    const id = adjustment.id || "";
    if (!id) return [];
    if (detailByAdjustment[id]) return detailByAdjustment[id];
    setLoadingDetailId(id);
    try {
      const details = await immunizationApi.getAdjustmentItems(id);
      setDetailByAdjustment(current => ({ ...current, [id]: details }));
      return details;
    } catch {
      toast.error("No se pudo cargar el detalle del reajuste.");
      return [];
    } finally {
      setLoadingDetailId("");
    }
  };

  const toggleDetail = async (adjustment: ImmunizationAdjustment) => {
    const id = adjustment.id || "";
    if (expandedId === id) {
      setExpandedId("");
      return;
    }
    setExpandedId(id);
    await getDetails(adjustment);
  };

  const downloadPdf = async (adjustment: ImmunizationAdjustment) => {
    const details = await getDetails(adjustment);
    if (details.length === 0) {
      toast.warning("Este reajuste no tiene detalle disponible para generar la constancia.");
      return;
    }
    await downloadImmunizationAdjustmentPdf({ adjustment, items: details, ownerName: ownerName(adjustment) });
    toast.success("Constancia PDF generada.");
  };

  const locationCount = new Set(visibleAdjustments.map(adjustment => `${adjustment.ownerType}-${adjustment.ungetId || adjustment.facilityCode || ""}`)).size;

  return (
    <div className="space-y-4 pb-2 animate-in fade-in duration-300">
      {effectiveScope.ownerType === "IPRESS" && isInitialized === false && (
        <ImmunizationUninitializedFacilityBanner
          ownerType="IPRESS"
          facilityName={effectiveScope.facilityCode}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-lg border border-teal-100 bg-teal-50 px-2.5 py-1 text-xs font-black uppercase tracking-wide text-teal-700">Periodo {getCurrentImmunizationPeriod()}</span>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => void loadAdjustments()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 shadow-2xs disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Actualizar</button>
          {canOperate && (
            <button
              type="button"
              onClick={() => void openForm()}
              disabled={loadingForm || (effectiveScope.ownerType === "IPRESS" && isInitialized === false)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingForm ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{loadingForm ? "Preparando..." : "Nuevo reajuste"}
            </button>
          )}
        </div>
      </div>

      {isAdmin && (
        <section className="rounded-2xl border border-teal-200 bg-gradient-to-r from-teal-50 to-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-teal-700" /><h3 className="text-sm font-black text-slate-900">Ámbito operativo de soporte</h3><span className="rounded-md bg-teal-100 px-2 py-1 text-[9px] font-black uppercase text-teal-700">Solo administrador</span></div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <CustomSelect
              ariaLabel="Tipo de ubicación"
              value={adminOwnerType}
              onChange={val => setAdminOwnerType(val as ImmunizationOwnerType)}
              options={[
                { value: "IPRESS", label: "IPRESS" },
                { value: "UNGET", label: "UNGET" }
              ]}
              className="h-10 border-slate-200"
            />
            <CustomSelect
              ariaLabel="UNGET"
              value={adminUngetId}
              onChange={val => { setAdminUngetId(val); setAdminFacilityCode(""); }}
              options={[
                { value: "", label: "Seleccione UNGET..." },
                ...ungets.map(unget => ({ value: unget.id, label: unget.name }))
              ]}
              className="h-10 border-slate-200"
            />
            <CustomSelect
              ariaLabel="IPRESS"
              value={adminFacilityCode}
              onChange={setAdminFacilityCode}
              disabled={adminOwnerType === "UNGET"}
              options={[
                { value: "", label: "Seleccione IPRESS..." },
                ...facilitiesForAdmin.map(facility => ({ value: facility.code, label: `${facility.code} · ${facility.name}` }))
              ]}
              className="h-10 border-slate-200"
            />
          </div>
        </section>
      )}

      {!canOperate && !isAdmin && (
        <div className="flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" /><p><strong>Vista de supervisión:</strong> puede revisar los reajustes y descargar sus constancias, pero no modificar el stock operativo.</p></div>
      )}

      {showTerritorialFilters && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2"><Filter className="h-4 w-4 text-teal-600" /><h3 className="text-xs font-black uppercase tracking-wide text-slate-700">Filtrar auditoría por ámbito</h3></div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <CustomSelect
              ariaLabel="Tipo de ámbito"
              value={auditOwnerFilter}
              onChange={val => { const value = val as "ALL" | ImmunizationOwnerType; setAuditOwnerFilter(value); if (value === "UNGET") setAuditFacilityFilter(""); }}
              options={[
                { value: "ALL", label: "UNGET e IPRESS" },
                { value: "UNGET", label: "Solo almacenes UNGET" },
                { value: "IPRESS", label: "Solo IPRESS" }
              ]}
              className="h-10 border-slate-200"
            />
            <CustomSelect
              ariaLabel="Filtrar por UNGET"
              value={auditUngetFilter}
              onChange={val => { setAuditUngetFilter(val); setAuditFacilityFilter(""); }}
              options={[
                ...(userScope.level !== "UNGET" ? [{ value: "", label: "Todas las UNGET" }] : []),
                ...availableFilterUngets.map(unget => ({ value: unget.id, label: unget.name }))
              ]}
              className="h-10 border-slate-200"
            />
            <CustomSelect
              ariaLabel="Filtrar por IPRESS"
              value={auditFacilityFilter}
              onChange={val => { setAuditFacilityFilter(val); if (val) setAuditOwnerFilter("IPRESS"); }}
              disabled={auditOwnerFilter === "UNGET"}
              options={[
                { value: "", label: "Todas las IPRESS" },
                ...facilitiesForAudit.map(facility => ({ value: facility.code, label: `${facility.code} · ${facility.name}` }))
              ]}
              className="h-10 border-slate-200"
            />
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <ImmunizationKpiCard tone="info" label="Reajustes registrados" value={visibleAdjustments.length.toString()} icon={<ClipboardCheck className="h-5 w-5" />} />
        <ImmunizationKpiCard tone="info" label="Aplicados" value={visibleAdjustments.filter(item => item.status === "APPLIED").length.toString()} icon={<ShieldCheck className="h-5 w-5" />} />
        {showTerritorialFilters
          ? <ImmunizationKpiCard tone="info" label="Ubicaciones auditadas" value={locationCount.toString()} icon={<Building2 className="h-5 w-5" />} />
          : <ImmunizationKpiCard tone="info" label="Anulados" value={visibleAdjustments.filter(item => item.status === "VOIDED").length.toString()} icon={<FileText className="h-5 w-5" />} />}
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 p-4"><ClipboardCheck className="h-4 w-4 text-teal-600" /><h3 className="text-sm font-black uppercase tracking-wide text-slate-900">Auditoría de reajustes</h3></div>
        {loading && adjustments.length === 0 ? (
          <div className="flex justify-center py-16"><div className="h-9 w-9 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" /></div>
        ) : visibleAdjustments.length === 0 ? (
          <div className="p-10 text-center"><FileText className="mx-auto mb-3 h-10 w-10 text-slate-300" /><h3 className="font-black text-slate-800">Sin reajustes para este filtro</h3><p className="mt-1 text-sm text-slate-500">Aquí aparecerán las correcciones de cantidad y datos físicos auditadas.</p></div>
        ) : (
          <div className={loading ? "opacity-60 pointer-events-none transition-opacity duration-200" : "transition-opacity duration-200"}>
            <div className="divide-y divide-slate-100 md:hidden">
              {visibleAdjustments.map(adjustment => (
                <article key={adjustment.id} className="p-4">
                  <div className="flex items-start justify-between gap-3"><div><p className="font-mono text-xs font-black text-teal-700">{adjustment.period}</p>{showTerritorialFilters && <h4 className="mt-1 text-sm font-black text-slate-900">{ownerName(adjustment)}</h4>}<p className="mt-1 text-xs font-bold text-slate-600">{adjustment.reason}</p></div><StatusBadge status={adjustment.status} /></div>
                  <p className="mt-3 line-clamp-2 text-xs text-slate-500">{adjustment.observation}</p>
                  <div className="mt-3 flex gap-2"><button type="button" onClick={() => void toggleDetail(adjustment)} className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-700">{expandedId === adjustment.id ? "Ocultar" : "Ver detalle"}</button><button type="button" onClick={() => void downloadPdf(adjustment)} className="inline-flex items-center justify-center gap-1 rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white"><FileDown className="h-4 w-4" />PDF</button></div>
                  {expandedId === adjustment.id && <AdjustmentDetail items={detailByAdjustment[adjustment.id || ""] || []} loading={loadingDetailId === adjustment.id} />}
                </article>
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50"><tr><HeaderCell>Fecha / periodo</HeaderCell>{showTerritorialFilters && <HeaderCell>Ubicación</HeaderCell>}<HeaderCell>Motivo y sustento</HeaderCell><HeaderCell>Usuario</HeaderCell><HeaderCell>Estado</HeaderCell><HeaderCell align="right">Acciones</HeaderCell></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleAdjustments.map(adjustment => (
                    <React.Fragment key={adjustment.id}>
                      <tr className="hover:bg-slate-50/70">
                        <td className="px-4 py-3"><p className="text-xs font-black text-slate-800">{formatDate(adjustment.createdAt)}</p><p className="mt-1 font-mono text-[10px] font-bold text-teal-700">{adjustment.period}</p></td>
                        {showTerritorialFilters && <td className="px-4 py-3"><p className="max-w-64 text-xs font-black text-slate-800">{ownerName(adjustment)}</p><p className="mt-1 text-[10px] font-black uppercase text-slate-400">{adjustment.ownerType}</p></td>}
                        <td className="max-w-sm px-4 py-3"><p className="text-xs font-bold text-slate-700">{adjustment.reason}</p><p className="mt-1 line-clamp-2 text-xs text-slate-500">{adjustment.observation}</p></td>
                        <td className="px-4 py-3 text-xs text-slate-500">{adjustment.createdBy || "-"}</td>
                        <td className="px-4 py-3"><StatusBadge status={adjustment.status} /></td>
                        <td className="px-4 py-3"><div className="flex justify-end gap-1"><button type="button" onClick={() => void downloadPdf(adjustment)} aria-label="Descargar constancia PDF" className="rounded-xl p-2 text-slate-500 hover:bg-teal-50 hover:text-teal-700"><FileDown className="h-4 w-4" /></button><button type="button" onClick={() => void toggleDetail(adjustment)} aria-label="Ver detalle" className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800">{expandedId === adjustment.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</button></div></td>
                      </tr>
                      {expandedId === adjustment.id && <tr><td colSpan={showTerritorialFilters ? 6 : 5} className="bg-slate-50/70 px-4 py-3"><AdjustmentDetail items={detailByAdjustment[adjustment.id || ""] || []} loading={loadingDetailId === adjustment.id} /></td></tr>}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <ImmunizationAdjustmentModal isOpen={formOpen} layers={layers} products={products} isSaving={saving} onClose={() => { if (!saving) setFormOpen(false); }} onSubmit={(items, reason, observation) => void saveAdjustment(items, reason, observation)} />
    </div>
  );
}

function StatusBadge({ status }: { status: ImmunizationAdjustment["status"] }) {
  return <span className={`inline-flex rounded-lg border px-2 py-1 text-[10px] font-black uppercase ${status === "APPLIED" ? "border-emerald-100 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-500"}`}>{status === "APPLIED" ? "Aplicado" : "Anulado"}</span>;
}

function AdjustmentDetail({ items, loading }: { items: ImmunizationAdjustmentItem[]; loading: boolean }) {
  if (loading) return <div className="flex items-center justify-center gap-2 py-5 text-xs font-bold text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Cargando detalle...</div>;
  if (items.length === 0) return <p className="py-4 text-center text-xs font-bold text-slate-400">Sin detalle disponible.</p>;
  const visibleItems = items.filter(item => item.operationType !== "RECLASSIFY_TARGET");
  return <div className="space-y-2">{visibleItems.map(item => {
    const target = item.reclassificationKey ? items.find(candidate => candidate.operationType === "RECLASSIFY_TARGET" && candidate.reclassificationKey === item.reclassificationKey) : undefined;
    if (target) {
      return <div key={item.reclassificationKey} className="rounded-xl border border-violet-200 bg-white p-3"><p className="mb-2 text-[9px] font-black uppercase tracking-wide text-violet-700">Datos de capa corregidos</p><div className="grid gap-2 md:grid-cols-2"><DetailLayer item={item} label="Registro anterior" /><DetailLayer item={target} label="Registro físico correcto" /></div></div>;
    }
    return <div key={item.id || `${item.productId}-${item.lote}`} className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 text-xs sm:grid-cols-[1fr_auto_auto_auto] sm:items-center"><div><p className="font-black text-slate-800">{item.product?.codigoSismed} · {item.product?.descripcion || "Producto"}</p><p className="mt-1 text-slate-500">Lote {item.lote} · Vence {item.expirationDate}</p></div><DetailMetric label="Sistema" value={item.systemQuantity} /><DetailMetric label="Físico" value={item.physicalQuantity} /><DifferenceValue value={item.differenceQuantity} /></div>;
  })}</div>;
}

function DetailLayer({ item, label }: { item: ImmunizationAdjustmentItem; label: string }) {
  return <div className="rounded-lg bg-slate-50 p-3 text-xs"><p className="text-[9px] font-black uppercase text-slate-400">{label}</p><p className="mt-1 font-black text-slate-800">{item.product?.codigoSismed} · {item.product?.descripcion || "Producto"}</p><p className="mt-1 text-slate-500">Lote {item.lote} · {item.expirationDate} · {item.fundingSource}/{item.supplyType}</p><div className="mt-2 flex items-center justify-between"><span className="font-mono font-black text-slate-700">{item.systemQuantity.toLocaleString("es-PE")} → {item.physicalQuantity.toLocaleString("es-PE")}</span><DifferenceValue value={item.differenceQuantity} /></div></div>;
}

function DifferenceValue({ value }: { value: number }) {
  return <span className={`w-fit rounded-lg px-2.5 py-1 font-mono text-xs font-black ${value > 0 ? "bg-emerald-100 text-emerald-700" : value < 0 ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"}`}>{value > 0 ? "+" : ""}{value.toLocaleString("es-PE")}</span>;
}

function DetailMetric({ label, value }: { label: string; value: number }) {
  return <div><p className="text-[9px] font-black uppercase text-slate-400">{label}</p><p className="mt-0.5 font-mono font-black text-slate-800">{value.toLocaleString("es-PE")}</p></div>;
}

