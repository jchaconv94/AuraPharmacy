import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  Building2,
  CalendarCheck,
  CheckCircle2,
  Clock,
  ClipboardCheck,
  Download,
  FileSpreadsheet,
  FileText,
  FilterX,
  Loader2,
  Lock,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
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
  buildImmunizationDiresaNetworkReportRows,
  buildImmunizationDiresaWarehouseReportRows,
  buildImmunizationMonthlyReportRows,
  buildImmunizationUngetNetworkReportRows,
  buildImmunizationUngetWarehouseReportRows,
  downloadImmunizationDiresaNetworkReportExcel,
  downloadImmunizationDiresaNetworkReportPdf,
  downloadImmunizationDiresaWarehouseReportExcel,
  downloadImmunizationDiresaWarehouseReportPdf,
  downloadImmunizationMonthlyReportExcel,
  downloadImmunizationMonthlyReportPdf,
  downloadImmunizationUngetNetworkReportExcel,
  downloadImmunizationUngetNetworkReportPdf,
  downloadImmunizationUngetWarehouseReportExcel,
  downloadImmunizationUngetWarehouseReportPdf,
  ImmunizationMonthlyReportOptions
} from "../services/immunizationMonthlyReportService";
import {
  closureIsIpressReady,
  closureIsUngetClosed,
  closureMatchesStatus,
  closureStatusLabel,
  ImmunizationClosureStatusFilter
} from "../services/immunizationProgressService";
import {
  HealthFacility,
  ImmunizationDistributionBatch,
  ImmunizationMonthlyClosure,
  ImmunizationReturnBatch,
  ImmunizationStockLayer,
  ImmunizationStockMovement,
  Unget
} from "../types";

type DialogMode = "IPRESS_PRE_CLOSE" | "UNGET_FINAL_CLOSE" | "IPRESS_REOPEN" | null;
type ClosureStatusFilter = ImmunizationClosureStatusFilter;

const currentPeriod = getCurrentImmunizationPeriod();
const inputClassName = "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition-shadow placeholder:text-slate-400 focus:border-teal-500 focus:ring-4 focus:ring-teal-100";
const periodIsFuture = (period: string) => period > currentPeriod;

const closureStatusOptions: Array<{ value: ClosureStatusFilter; label: string }> = [
  { value: "ALL", label: "Todos los estados" },
  { value: "PENDING", label: "Pendientes" },
  { value: "PRE_CLOSED", label: "Precerradas" },
  { value: "FINAL_CLOSED", label: "Cerradas" },
  { value: "REOPENED", label: "Reabiertas" }
];

const normalizeText = (value: string) => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .trim();

const formatDateTime = (value?: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
};

const closureStatusClass = (closure?: ImmunizationMonthlyClosure) => {
  if (!closure) return "border-amber-200 bg-amber-50 text-amber-700";
  if (closure.status === "FINAL_CLOSED") return "border-slate-300 bg-slate-900 text-white";
  if (closure.status === "PRE_CLOSED") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-blue-200 bg-blue-50 text-blue-700";
};

const closureUserLabel = (closure?: ImmunizationMonthlyClosure) => {
  if (!closure) return "-";
  if (closure.status === "REOPENED") return closure.reopenedBy || "-";
  if (closure.status === "FINAL_CLOSED") return closure.closedBy || closure.preclosedBy || "-";
  return closure.preclosedBy || "-";
};

const closureDateLabel = (closure?: ImmunizationMonthlyClosure) => {
  if (!closure) return "-";
  if (closure.status === "REOPENED") return formatDateTime(closure.reopenedAt);
  if (closure.status === "FINAL_CLOSED") return formatDateTime(closure.closedAt || closure.preclosedAt);
  return formatDateTime(closure.preclosedAt);
};

const distributionFlow = (batch: ImmunizationDistributionBatch) =>
  batch.flowType || (batch.destinationOwnerType === "UNGET" || batch.destinationUngetId ? "DIRESA_UNGET" : "UNGET_IPRESS");

const destinationUngetId = (batch: ImmunizationDistributionBatch) =>
  batch.destinationUngetId || (distributionFlow(batch) === "DIRESA_UNGET" ? batch.ungetId : undefined);

const ownerLabel = (scope: ImmunizationScope, ungets: Unget[], facilities: HealthFacility[]) => {
  if (scope.level === "IPRESS") {
    const facility = facilities.find(row => row.code === scope.facilityCode);
    return facility ? `${facility.name} (${facility.code})` : scope.facilityCode || "IPRESS";
  }
  if (scope.level === "UNGET") {
    return ungets.find(row => row.id === scope.ungetId)?.name || scope.ungetId || "UNGET";
  }
  return "DIRESA San Martín";
};

export const ImmunizationClosuresModule: React.FC = () => {
  const { user } = useAuth();
  const scope = useMemo(() => getImmunizationScope(user), [user]);
  const isIpress = scope.level === "IPRESS" && Boolean(scope.facilityCode);
  const isUnget = scope.level === "UNGET" && Boolean(scope.ungetId);
  const isSupervisor = scope.level === "GLOBAL" || scope.level === "DIRESA" || scope.level === "OGESS" || scope.ownerType === "DIRESA";

  const [period, setPeriod] = useState(currentPeriod);
  const [ungets, setUngets] = useState<Unget[]>([]);
  const [facilities, setFacilities] = useState<HealthFacility[]>([]);
  const [closures, setClosures] = useState<ImmunizationMonthlyClosure[]>([]);
  const [distributions, setDistributions] = useState<ImmunizationDistributionBatch[]>([]);
  const [returns, setReturns] = useState<ImmunizationReturnBatch[]>([]);
  const [stockLayers, setStockLayers] = useState<ImmunizationStockLayer[]>([]);
  const [stockMovements, setStockMovements] = useState<ImmunizationStockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [ungetFilter, setUngetFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<ClosureStatusFilter>("ALL");
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [dialogObservation, setDialogObservation] = useState("");
  const [reopenFacility, setReopenFacility] = useState<HealthFacility | null>(null);

  const listScope = useMemo<ImmunizationScope>(() => {
    if (isIpress || isUnget) return scope;
    return { level: scope.level, diresaId: scope.diresaId, ogessId: scope.ogessId };
  }, [isIpress, isUnget, scope]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const shouldLoadReportData = isIpress || isUnget || isSupervisor;
      const [ungetRows, facilityRows] = await Promise.all([
        api.getUngets(),
        api.getFacilities()
      ]);
      const facilityCodesForUnget = isUnget && scope.ungetId
        ? facilityRows.filter(facility => facility.ungetId === scope.ungetId).map(facility => facility.code)
        : [];
      const stockPromise = !shouldLoadReportData
        ? Promise.resolve<ImmunizationStockLayer[]>([])
        : isUnget && scope.ungetId
          ? Promise.all([
            immunizationApi.getStockLayers({ level: "UNGET", ownerType: "UNGET", ungetId: scope.ungetId }),
            facilityCodesForUnget.length > 0
              ? immunizationApi.getStockLayers({ level: "UNGET", ownerType: "IPRESS", ungetId: scope.ungetId, facilityCodes: facilityCodesForUnget })
              : Promise.resolve<ImmunizationStockLayer[]>([])
          ]).then(([ungetLayers, ipressLayers]) => [...ungetLayers, ...ipressLayers])
          // El consolidado regional necesita almacén DIRESA, UNGET e IPRESS a la vez.
          : isSupervisor
            ? immunizationApi.getStockLayers({ level: "GLOBAL" })
            : immunizationApi.getStockLayers(scope);
      const [closureRows, distributionRows, returnRows, stockRows, movementRows] = await Promise.all([
        immunizationApi.listMonthlyClosures(listScope, period),
        immunizationApi.listDistributionBatches(listScope),
        immunizationApi.listReturnBatches(listScope),
        stockPromise,
        shouldLoadReportData
          ? immunizationApi.listStockMovements(
            isSupervisor
              ? { level: "GLOBAL" }
              // Los códigos de IPRESS recuperan movimientos antiguos sin unget_id.
              : isUnget && facilityCodesForUnget.length > 0
                ? { ...scope, facilityCodes: facilityCodesForUnget }
                : scope,
            period
          )
          : Promise.resolve([])
      ]);
      setUngets([...ungetRows].sort((a, b) => a.name.localeCompare(b.name)));
      setFacilities([...facilityRows].sort((a, b) => a.name.localeCompare(b.name)));
      setClosures(closureRows);
      setDistributions(distributionRows);
      setReturns(returnRows);
      setStockLayers(stockRows);
      setStockMovements(movementRows);
    } catch {
      toast.error("No se pudo cargar el cierre mensual.");
    } finally {
      setLoading(false);
    }
  }, [isIpress, isUnget, listScope, period, scope]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const facilityByCode = useMemo(() => {
    const map = new Map<string, HealthFacility>();
    facilities.forEach(facility => map.set(facility.code, facility));
    return map;
  }, [facilities]);

  const supervisedUngets = useMemo(() => {
    if (scope.level === "UNGET" && scope.ungetId) return ungets.filter(unget => unget.id === scope.ungetId);
    if (scope.level === "OGESS" && scope.ogessId) return ungets.filter(unget => unget.ogessId === scope.ogessId);
    if (scope.level === "DIRESA" && scope.diresaId) return ungets.filter(unget => unget.diresaId === scope.diresaId);
    return ungets;
  }, [scope, ungets]);

  const ungetFacilities = useMemo(() => {
    if (!scope.ungetId) return [];
    return facilities.filter(facility => facility.ungetId === scope.ungetId);
  }, [facilities, scope.ungetId]);

  const ownIpressClosure = useMemo(
    () => closures.find(closure => closure.ownerType === "IPRESS" && closure.period === period && closure.facilityCode === scope.facilityCode),
    [closures, period, scope.facilityCode]
  );

  const ownUngetClosure = useMemo(
    () => closures.find(closure => closure.ownerType === "UNGET" && closure.period === period && closure.ungetId === scope.ungetId),
    [closures, period, scope.ungetId]
  );

  const isFuturePeriod = periodIsFuture(period);
  const validOwnIpressClosure = isFuturePeriod ? undefined : ownIpressClosure;
  const validOwnUngetClosure = isFuturePeriod ? undefined : ownUngetClosure;

  const ipressClosuresByCode = useMemo(() => {
    const map = new Map<string, ImmunizationMonthlyClosure>();
    if (isFuturePeriod) return map;
    closures
      .filter(closure => closure.ownerType === "IPRESS" && closure.period === period)
      .forEach(closure => {
        if (closure.facilityCode) map.set(closure.facilityCode, closure);
      });
    return map;
  }, [closures, isFuturePeriod, period]);

  const periodDistributions = useMemo(
    () => distributions.filter(batch => batch.period === period && batch.status === "SENT"),
    [distributions, period]
  );

  const periodReturns = useMemo(
    () => returns.filter(batch => batch.period === period && batch.status === "SENT"),
    [returns, period]
  );

  const pendingIpressDistributions = useMemo(() => (
    periodDistributions.filter(batch => batch.destinationFacilityCode === scope.facilityCode)
  ), [periodDistributions, scope.facilityCode]);

  const pendingUngetDistributions = useMemo(() => (
    periodDistributions.filter(batch => (
      distributionFlow(batch) === "DIRESA_UNGET"
        ? destinationUngetId(batch) === scope.ungetId
        : batch.ungetId === scope.ungetId || batch.originUngetId === scope.ungetId
    ))
  ), [periodDistributions, scope.ungetId]);

  const pendingUngetReturns = useMemo(
    () => periodReturns.filter(batch => batch.originUngetId === scope.ungetId),
    [periodReturns, scope.ungetId]
  );

  const periodConsumptionMovements = useMemo(
    () => stockMovements.filter(movement => movement.period === period && movement.movementType === "IPRESS_CONSUMPTION"),
    [period, stockMovements]
  );

  const reportOptions = useMemo<ImmunizationMonthlyReportOptions>(() => ({
    period,
    ownerName: ownerLabel(scope, ungets, facilities),
    scopeLabel: scope.ownerType || scope.level,
    generatedBy: user?.username,
    closure: validOwnIpressClosure,
    stockLayers,
    movements: stockMovements
  }), [facilities, period, scope, stockLayers, stockMovements, ungets, user?.username, validOwnIpressClosure]);

  const monthlyReportRows = useMemo(
    () => buildImmunizationMonthlyReportRows(reportOptions),
    [reportOptions]
  );

  const ungetReportOptions = useMemo<ImmunizationMonthlyReportOptions>(() => ({
    period,
    ownerName: ownerLabel(scope, ungets, facilities),
    scopeLabel: "UNGET",
    generatedBy: user?.username,
    closure: validOwnUngetClosure,
    stockLayers,
    movements: stockMovements
  }), [facilities, period, scope, stockLayers, stockMovements, ungets, user?.username, validOwnUngetClosure]);

  const ungetWarehouseReportRows = useMemo(
    () => buildImmunizationUngetWarehouseReportRows(ungetReportOptions),
    [ungetReportOptions]
  );

  const ungetNetworkReportRows = useMemo(
    () => buildImmunizationUngetNetworkReportRows(ungetReportOptions),
    [ungetReportOptions]
  );

  /**
   * El consolidado regional solo es definitivo cuando todas las UNGET del ámbito han
   * cerrado su periodo. Mientras falte alguna, el archivo sale marcado como preliminar.
   *
   * Se calcula sobre todas las UNGET supervisadas, no sobre las filas visibles: el estado
   * del reporte no puede depender de los filtros de pantalla.
   */
  const pendingUngetClosures = useMemo(() => supervisedUngets.filter(unget => {
    const closure = closures.find(row => row.ownerType === "UNGET" && row.period === period && row.ungetId === unget.id);
    return !closureIsUngetClosed(closure);
  }).length, [closures, period, supervisedUngets]);

  const diresaReportOptions = useMemo<ImmunizationMonthlyReportOptions>(() => ({
    period,
    ownerName: "DIRESA SAN MARTÍN",
    scopeLabel: "REGIONAL",
    generatedBy: user?.username,
    stockLayers,
    movements: stockMovements,
    isPreliminary: pendingUngetClosures > 0,
    preliminaryReason: pendingUngetClosures > 0
      ? `faltan ${pendingUngetClosures} UNGET por cerrar el periodo.`
      : undefined
  }), [pendingUngetClosures, period, stockLayers, stockMovements, user?.username]);

  const diresaWarehouseReportRows = useMemo(
    () => buildImmunizationDiresaWarehouseReportRows(diresaReportOptions),
    [diresaReportOptions]
  );

  const diresaNetworkReportRows = useMemo(
    () => buildImmunizationDiresaNetworkReportRows(diresaReportOptions),
    [diresaReportOptions]
  );

  const closedIpressCount = ungetFacilities.filter(facility => closureIsIpressReady(ipressClosuresByCode.get(facility.code))).length;
  const pendingIpressCount = Math.max(ungetFacilities.length - closedIpressCount, 0);

  const supervisorRows = useMemo(() => {
    const query = normalizeText(search);
    return supervisedUngets
      .filter(unget => !ungetFilter || unget.id === ungetFilter)
      .map(unget => {
        const scopedFacilities = facilities.filter(facility => facility.ungetId === unget.id);
        const closedFacilities = scopedFacilities.filter(facility => closureIsIpressReady(ipressClosuresByCode.get(facility.code))).length;
        const ungetClosure = closures.find(closure => closure.ownerType === "UNGET" && closure.period === period && closure.ungetId === unget.id);
        return {
          unget,
          total: scopedFacilities.length,
          closed: closedFacilities,
          pending: Math.max(scopedFacilities.length - closedFacilities, 0),
          closure: ungetClosure
        };
      })
      .filter(row => closureMatchesStatus(row.closure, statusFilter))
      .filter(row => !query || normalizeText(`${row.unget.name} ${row.unget.id} ${closureStatusLabel(row.closure)}`).includes(query));
  }, [closures, facilities, ipressClosuresByCode, period, search, statusFilter, supervisedUngets, ungetFilter]);

  const totals = useMemo(() => {
    if (isIpress) {
      return {
        total: 1,
        closed: closureIsIpressReady(validOwnIpressClosure) ? 1 : 0,
        pending: closureIsIpressReady(validOwnIpressClosure) ? 0 : 1,
        locked: closureIsIpressReady(validOwnIpressClosure) ? 1 : 0
      };
    }
    if (isUnget) {
      return {
        total: ungetFacilities.length,
        closed: closedIpressCount,
        pending: pendingIpressCount,
        locked: closureIsUngetClosed(validOwnUngetClosure) ? 1 : 0
      };
    }
    return {
      total: supervisorRows.reduce((sum, row) => sum + row.total, 0),
      closed: supervisorRows.reduce((sum, row) => sum + row.closed, 0),
      pending: supervisorRows.reduce((sum, row) => sum + row.pending, 0),
      locked: supervisorRows.filter(row => closureIsUngetClosed(row.closure)).length
    };
  }, [closedIpressCount, isIpress, isUnget, pendingIpressCount, supervisorRows, ungetFacilities.length, validOwnIpressClosure, validOwnUngetClosure]);

  const openDialog = (mode: DialogMode) => {
    setDialogMode(mode);
    setDialogObservation("");
  };

  const openReopenDialog = (facility: HealthFacility) => {
    setReopenFacility(facility);
    setDialogMode("IPRESS_REOPEN");
    setDialogObservation("");
  };

  const closeDialog = () => {
    if (saving) return;
    setDialogMode(null);
    setDialogObservation("");
    setReopenFacility(null);
  };

  const submitClosure = async () => {
    if (isFuturePeriod) {
      toast.error("No se puede cerrar o precerrar un periodo futuro.");
      return;
    }
    if (dialogMode === "IPRESS_PRE_CLOSE" && periodConsumptionMovements.length === 0) {
      toast.error("No se puede precerrar: el periodo no tiene consumos IPRESS registrados.");
      return;
    }
    if (dialogMode === "IPRESS_REOPEN" && (!reopenFacility || !dialogObservation.trim())) {
      toast.error("Seleccione una IPRESS y registre el motivo de reapertura.");
      return;
    }
    setSaving(true);
    try {
      const username = user?.username;
      const result = dialogMode === "IPRESS_PRE_CLOSE"
        ? await immunizationApi.precloseIpressPeriod(scope, period, dialogObservation, username)
        : dialogMode === "IPRESS_REOPEN" && reopenFacility
          ? await immunizationApi.reopenIpressPreclosure(scope, period, reopenFacility.code, dialogObservation, username)
          : await immunizationApi.finalCloseUngetPeriod(scope, period, ungetFacilities.map(facility => facility.code), dialogObservation, username);

      if (!result.success) {
        toast.error(result.message || "No se pudo registrar el cierre.");
        return;
      }
      toast.success(
        dialogMode === "IPRESS_PRE_CLOSE"
          ? "Periodo precerrado. Ya puede descargar el reporte mensual."
          : dialogMode === "IPRESS_REOPEN"
            ? "Precierre IPRESS reabierto. La IPRESS ya puede corregir y volver a precerrar."
            : "Periodo cerrado definitivamente para la UNGET."
      );
      setDialogMode(null);
      setDialogObservation("");
      setReopenFacility(null);
      await loadData();
    } finally {
      setSaving(false);
    }
  };

  const canPrecloseIpress = isIpress && !isFuturePeriod && periodConsumptionMovements.length > 0 && !closureIsIpressReady(validOwnIpressClosure) && pendingIpressDistributions.length === 0 && periodReturns.length === 0;
  const canCloseUnget = isUnget && !isFuturePeriod && !closureIsUngetClosed(validOwnUngetClosure) && ungetFacilities.length > 0 && pendingIpressCount === 0 && pendingUngetDistributions.length === 0 && pendingUngetReturns.length === 0;

  const downloadMonthlyReport = async (format: "PDF" | "EXCEL") => {
    if (!closureIsIpressReady(validOwnIpressClosure)) {
      toast.error("Primero debe precerrar el periodo para habilitar el reporte mensual.");
      return;
    }
    if (monthlyReportRows.length === 0) {
      toast.error("No hay datos de movimiento biológico para exportar en este periodo.");
      return;
    }
    try {
      if (format === "PDF") {
        await downloadImmunizationMonthlyReportPdf(reportOptions);
      } else {
        await downloadImmunizationMonthlyReportExcel(reportOptions);
      }
    } catch {
      toast.error("No se pudo generar el reporte mensual.");
    }
  };

  /**
   * El movimiento del almacén UNGET es aritmética por capa: siempre cuadra, exista o no
   * stock en tránsito. Por eso solo exige periodo válido y datos, y queda disponible como
   * resumen operativo aunque las IPRESS todavía no hayan precerrado.
   */
  const downloadUngetWarehouseReport = async (format: "PDF" | "EXCEL") => {
    if (!isUnget) return;
    if (isFuturePeriod) {
      toast.error("No se puede generar el reporte de un periodo futuro.");
      return;
    }
    if (ungetWarehouseReportRows.length === 0) {
      toast.error("El almacén UNGET no tiene stock ni movimientos en este periodo.");
      return;
    }
    try {
      if (format === "PDF") {
        await downloadImmunizationUngetWarehouseReportPdf(ungetReportOptions);
      } else {
        await downloadImmunizationUngetWarehouseReportExcel(ungetReportOptions);
      }
    } catch {
      toast.error("No se pudo generar el reporte del almacén UNGET.");
    }
  };

  /**
   * El consolidado suma almacén e IPRESS y anula los traslados internos. Esa aritmética
   * asume que no queda stock en tránsito, así que mantiene el control completo de cierre.
   */
  const downloadUngetNetworkReport = async (format: "PDF" | "EXCEL") => {
    if (!isUnget) return;
    if (isFuturePeriod) {
      toast.error("No se puede generar el consolidado de un periodo futuro.");
      return;
    }
    if (ungetFacilities.length === 0) {
      toast.error("La UNGET no tiene IPRESS asignadas para consolidar.");
      return;
    }
    if (pendingIpressCount > 0) {
      toast.error(`Faltan ${pendingIpressCount} IPRESS por precerrar. El consolidado final UNGET requiere todas las IPRESS precerradas.`);
      return;
    }
    if (pendingUngetDistributions.length > 0 || pendingUngetReturns.length > 0) {
      toast.error("Existen distribuciones, devoluciones o bajas pendientes. Revise esos movimientos antes de generar el consolidado final.");
      return;
    }
    if (ungetNetworkReportRows.length === 0) {
      toast.error("No hay datos de stock o movimientos para consolidar en este periodo.");
      return;
    }
    try {
      if (format === "PDF") {
        await downloadImmunizationUngetNetworkReportPdf(ungetReportOptions);
      } else {
        await downloadImmunizationUngetNetworkReportExcel(ungetReportOptions);
      }
    } catch {
      toast.error("No se pudo generar el reporte consolidado UNGET.");
    }
  };

  const downloadDiresaReport = async (kind: "WAREHOUSE" | "NETWORK", format: "PDF" | "EXCEL") => {
    if (!isSupervisor) return;
    if (isFuturePeriod) {
      toast.error("No se puede generar el reporte de un periodo futuro.");
      return;
    }
    const rows = kind === "WAREHOUSE" ? diresaWarehouseReportRows : diresaNetworkReportRows;
    if (rows.length === 0) {
      toast.error(
        kind === "WAREHOUSE"
          ? "El almacén regional no tiene stock ni movimientos en este periodo."
          : "No hay datos de stock o movimientos para consolidar en este periodo."
      );
      return;
    }
    try {
      if (kind === "WAREHOUSE") {
        if (format === "PDF") await downloadImmunizationDiresaWarehouseReportPdf(diresaReportOptions);
        else await downloadImmunizationDiresaWarehouseReportExcel(diresaReportOptions);
      } else {
        if (format === "PDF") await downloadImmunizationDiresaNetworkReportPdf(diresaReportOptions);
        else await downloadImmunizationDiresaNetworkReportExcel(diresaReportOptions);
      }
    } catch {
      toast.error("No se pudo generar el reporte regional.");
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-teal-50 p-3 text-teal-700">
              <CalendarCheck className="h-7 w-7" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-black text-slate-900">Cierre Mensual</h2>
                <span className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-black text-teal-700">
                  PERIODO {period}
                </span>
              </div>
              <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-600">
                Controla el precierre IPRESS y el cierre definitivo UNGET. Un periodo precerrado o cerrado bloquea nuevos movimientos operativos.
              </p>
              <p className="mt-2 text-xs font-black text-teal-700">Ámbito operativo: {ownerLabel(scope, ungets, facilities)}</p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="month"
              value={period}
              max={currentPeriod}
              onChange={event => {
                const nextPeriod = event.target.value || currentPeriod;
                if (periodIsFuture(nextPeriod)) {
                  setPeriod(currentPeriod);
                  toast.error(`No se puede seleccionar un periodo futuro. Periodo máximo: ${currentPeriod}.`);
                  return;
                }
                setPeriod(nextPeriod);
              }}
              className={`${inputClassName} sm:w-44`}
            />
            <button
              type="button"
              onClick={() => void loadData()}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Actualizar
            </button>
          </div>
        </div>
      </section>

      {isFuturePeriod && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800 shadow-sm">
          No se permite precerrar ni cerrar periodos futuros. Selecciona como máximo el periodo {currentPeriod}.
        </section>
      )}

      {isIpress && !isFuturePeriod && !closureIsIpressReady(validOwnIpressClosure) && periodConsumptionMovements.length === 0 && (
        <section className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm font-semibold text-sky-800 shadow-sm">
          Este periodo todavía no tiene consumos IPRESS registrados. Para precerrar debe existir al menos un registro de consumo del mes.
        </section>
      )}

      <section className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <MetricCard icon={<Building2 className="h-5 w-5" />} label={isIpress ? "IPRESS" : "IPRESS evaluadas"} value={totals.total} />
        <MetricCard icon={<CheckCircle2 className="h-5 w-5" />} label="Precerradas" value={totals.closed} />
        <MetricCard icon={<Clock className="h-5 w-5" />} label="Pendientes" value={totals.pending} tone={totals.pending > 0 ? "amber" : "slate"} />
        <MetricCard icon={<Lock className="h-5 w-5" />} label={isUnget || isSupervisor ? "UNGET cerradas" : "Periodo bloqueado"} value={totals.locked} tone="dark" />
      </section>

      {loading ? (
        <div className="flex min-h-[260px] items-center justify-center rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 text-sm font-black text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin text-teal-600" />
            Cargando cierre mensual...
          </div>
        </div>
      ) : (
        <>
          {isIpress && (
            <IpressClosurePanel
              closure={validOwnIpressClosure}
              isFuturePeriod={isFuturePeriod}
              consumptionCount={periodConsumptionMovements.length}
              pendingDistributions={pendingIpressDistributions.length}
              pendingReturns={periodReturns.length}
              reportRows={monthlyReportRows.length}
              canPreclose={canPrecloseIpress}
              onPreclose={() => openDialog("IPRESS_PRE_CLOSE")}
              onDownloadExcel={() => void downloadMonthlyReport("EXCEL")}
              onDownloadPdf={() => void downloadMonthlyReport("PDF")}
            />
          )}

          {isUnget && (
            <UngetClosurePanel
              facilities={ungetFacilities}
              facilityByCode={facilityByCode}
              closuresByCode={ipressClosuresByCode}
              ungetClosure={validOwnUngetClosure}
              isFuturePeriod={isFuturePeriod}
              pendingDistributions={pendingUngetDistributions.length}
              pendingReturns={pendingUngetReturns.length}
              warehouseReportRows={ungetWarehouseReportRows.length}
              networkReportRows={ungetNetworkReportRows.length}
              canDownloadWarehouseReport={!isFuturePeriod && ungetWarehouseReportRows.length > 0}
              canDownloadNetworkReport={!isFuturePeriod && ungetFacilities.length > 0 && pendingIpressCount === 0 && pendingUngetDistributions.length === 0 && pendingUngetReturns.length === 0}
              canClose={canCloseUnget}
              onFinalClose={() => openDialog("UNGET_FINAL_CLOSE")}
              onDownloadWarehouse={format => void downloadUngetWarehouseReport(format)}
              onDownloadNetwork={format => void downloadUngetNetworkReport(format)}
              canReopen={!isFuturePeriod && !closureIsUngetClosed(validOwnUngetClosure)}
              onReopen={openReopenDialog}
              search={search}
              statusFilter={statusFilter}
              onSearch={setSearch}
              onStatusFilter={setStatusFilter}
            />
          )}

          {isSupervisor && !isIpress && !isUnget && (
            <SupervisorPanel
              rows={supervisorRows}
              ungets={supervisedUngets}
              search={search}
              ungetFilter={ungetFilter}
              statusFilter={statusFilter}
              onSearch={setSearch}
              onUngetFilter={setUngetFilter}
              onStatusFilter={setStatusFilter}
              warehouseReportRows={diresaWarehouseReportRows.length}
              networkReportRows={diresaNetworkReportRows.length}
              pendingUngetClosures={pendingUngetClosures}
              canDownloadReports={!isFuturePeriod}
              onDownloadWarehouse={format => void downloadDiresaReport("WAREHOUSE", format)}
              onDownloadNetwork={format => void downloadDiresaReport("NETWORK", format)}
            />
          )}

          {!isIpress && !isUnget && !isSupervisor && (
            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm font-semibold text-amber-800">
              Este rol no tiene un ámbito operativo válido para cierre mensual.
            </div>
          )}
        </>
      )}

      {dialogMode && createPortal(
        <ClosureDialog
          mode={dialogMode}
          period={period}
          reopenFacility={reopenFacility}
          saving={saving}
          observation={dialogObservation}
          onObservationChange={setDialogObservation}
          onClose={closeDialog}
          onSubmit={submitClosure}
        />,
        document.body
      )}
    </div>
  );
};

const MetricCard: React.FC<{ icon: React.ReactNode; label: string; value: number; tone?: "slate" | "amber" | "dark" }> = ({ icon, label, value, tone = "slate" }) => {
  const toneClass = tone === "amber"
    ? "bg-amber-50 text-amber-700"
    : tone === "dark"
      ? "bg-slate-900 text-white"
      : "bg-teal-50 text-teal-700";
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-slate-400">{label}</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{value}</p>
        </div>
        <div className={`rounded-2xl p-3 ${toneClass}`}>{icon}</div>
      </div>
    </div>
  );
};

const IpressClosurePanel: React.FC<{
  closure?: ImmunizationMonthlyClosure;
  isFuturePeriod: boolean;
  consumptionCount: number;
  pendingDistributions: number;
  pendingReturns: number;
  reportRows: number;
  canPreclose: boolean;
  onPreclose: () => void;
  onDownloadExcel: () => void;
  onDownloadPdf: () => void;
}> = ({
  closure,
  isFuturePeriod,
  consumptionCount,
  pendingDistributions,
  pendingReturns,
  reportRows,
  canPreclose,
  onPreclose,
  onDownloadExcel,
  onDownloadPdf
}) => (
  <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
    <div className="border-b border-slate-100 p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-lg font-black text-slate-900">Precierre IPRESS</h3>
          <p className="mt-1 text-sm text-slate-500">
            La IPRESS confirma que terminó de registrar consumos, bajas y devoluciones del mes. Al precerrar se habilita el reporte mensual.
          </p>
        </div>
        <span className={`w-fit rounded-full border px-3 py-1 text-xs font-black ${closureStatusClass(closure)}`}>
          {closureStatusLabel(closure)}
        </span>
      </div>
    </div>
    <div className="grid grid-cols-1 gap-3 p-5 md:grid-cols-4">
      <ChecklistCard ok={!isFuturePeriod} title="Periodo válido" value={isFuturePeriod ? "Futuro" : "Actual/pasado"} />
      <ChecklistCard ok={consumptionCount > 0} title="Consumos registrados" value={consumptionCount} />
      <ChecklistCard ok={pendingDistributions === 0} title="Recepciones pendientes" value={pendingDistributions} />
      <ChecklistCard ok={pendingReturns === 0} title="Devoluciones/bajas pendientes" value={pendingReturns} />
    </div>
    {closureIsIpressReady(closure) && (
      <div className="mx-5 mb-5 rounded-2xl border border-teal-200 bg-gradient-to-r from-teal-50 to-white p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 text-sm font-black text-slate-900">
              <Download className="h-4 w-4 text-teal-700" />
              Reporte del movimiento biológico
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Disponible para descargar después del precierre. Incluye {reportRows} producto(s)/lote(s) del periodo.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onDownloadPdf}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <FileText className="h-4 w-4 text-red-600" />
              PDF
            </button>
            <button
              type="button"
              onClick={onDownloadExcel}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 text-sm font-black text-white shadow-sm transition hover:bg-teal-700"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Excel
            </button>
          </div>
        </div>
      </div>
    )}
    <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/70 p-5 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm font-semibold text-slate-600">
        {closure ? `Precerrado por ${closure.preclosedBy || "-"} el ${formatDateTime(closure.preclosedAt)}.` : "Al precerrar, este periodo ya no aceptará nuevos consumos, bajas ni devoluciones."}
      </p>
      <button
        type="button"
        disabled={!canPreclose}
        onClick={onPreclose}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        <Lock className="h-4 w-4" />
        Precerrar y habilitar reporte
      </button>
    </div>
  </section>
);

const ChecklistCard: React.FC<{ ok: boolean; title: string; value: number | string }> = ({ ok, title, value }) => (
  <div className={`rounded-2xl border p-4 ${ok ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
    <div className="flex items-start gap-3">
      <div className={`rounded-xl p-2 ${ok ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
        {ok ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
      </div>
      <div>
        <p className="text-xs font-black uppercase tracking-wide text-slate-500">{title}</p>
        <p className="mt-1 text-xl font-black text-slate-900">{value}</p>
      </div>
    </div>
  </div>
);

const ReportDownloadCard: React.FC<{
  title: string;
  description: string;
  detail: string;
  enabled: boolean;
  onDownload: (format: "PDF" | "EXCEL") => void;
}> = ({ title, description, detail, enabled, onDownload }) => (
  <div className="flex h-full flex-col justify-between gap-4 rounded-2xl border border-teal-200 bg-gradient-to-r from-teal-50 to-white p-4">
    <div>
      <p className="inline-flex items-center gap-2 text-sm font-black text-slate-900">
        <Download className="h-4 w-4 text-teal-700" />
        {title}
      </p>
      <p className="mt-1 text-sm leading-relaxed text-slate-600">{description}</p>
      <p className="mt-1 text-xs font-bold text-slate-500">{detail}</p>
    </div>
    <div className="flex flex-col gap-2 sm:flex-row">
      <button
        type="button"
        disabled={!enabled}
        onClick={() => onDownload("PDF")}
        className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <FileText className="h-4 w-4 text-red-600" />
        PDF
      </button>
      <button
        type="button"
        disabled={!enabled}
        onClick={() => onDownload("EXCEL")}
        className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 text-sm font-black text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        <FileSpreadsheet className="h-4 w-4" />
        Excel
      </button>
    </div>
  </div>
);

const UngetClosurePanel: React.FC<{
  facilities: HealthFacility[];
  facilityByCode: Map<string, HealthFacility>;
  closuresByCode: Map<string, ImmunizationMonthlyClosure>;
  ungetClosure?: ImmunizationMonthlyClosure;
  isFuturePeriod: boolean;
  pendingDistributions: number;
  pendingReturns: number;
  warehouseReportRows: number;
  networkReportRows: number;
  canDownloadWarehouseReport: boolean;
  canDownloadNetworkReport: boolean;
  canClose: boolean;
  onFinalClose: () => void;
  onDownloadWarehouse: (format: "PDF" | "EXCEL") => void;
  onDownloadNetwork: (format: "PDF" | "EXCEL") => void;
  canReopen: boolean;
  onReopen: (facility: HealthFacility) => void;
  search: string;
  statusFilter: ClosureStatusFilter;
  onSearch: (value: string) => void;
  onStatusFilter: (value: ClosureStatusFilter) => void;
}> = ({
  facilities,
  closuresByCode,
  ungetClosure,
  isFuturePeriod,
  pendingDistributions,
  pendingReturns,
  warehouseReportRows,
  networkReportRows,
  canDownloadWarehouseReport,
  canDownloadNetworkReport,
  canClose,
  onFinalClose,
  onDownloadWarehouse,
  onDownloadNetwork,
  canReopen,
  onReopen,
  search,
  statusFilter,
  onSearch,
  onStatusFilter
}) => {
  const pageSizeOptions = [8, 12, 24, 48];
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const query = normalizeText(search);
  const visibleFacilities = facilities.filter(facility => {
    const closure = closuresByCode.get(facility.code);
    const matchesSearch = !query || normalizeText(`${facility.code} ${facility.name} ${closureUserLabel(closure)} ${closure?.reopenReason || ""} ${closureStatusLabel(closure)}`).includes(query);
    return matchesSearch && closureMatchesStatus(closure, statusFilter);
  });
  const totalPages = Math.max(1, Math.ceil(visibleFacilities.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = (safeCurrentPage - 1) * pageSize;
  const paginatedFacilities = visibleFacilities.slice(pageStartIndex, pageStartIndex + pageSize);
  const firstVisibleRow = visibleFacilities.length === 0 ? 0 : pageStartIndex + 1;
  const lastVisibleRow = Math.min(pageStartIndex + pageSize, visibleFacilities.length);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, pageSize]);

  return (
    <section className="space-y-4">
      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-black text-slate-900">Cierre definitivo UNGET</h3>
            <p className="mt-1 text-sm text-slate-500">La UNGET puede cerrar solo cuando todas sus IPRESS estén precerradas y no existan pendientes de recepción.</p>
          </div>
          <span className={`w-fit rounded-full border px-3 py-1 text-xs font-black ${closureStatusClass(ungetClosure)}`}>
            {closureStatusLabel(ungetClosure)}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 p-5 md:grid-cols-5">
          <ChecklistCard ok={!isFuturePeriod} title="Periodo válido" value={isFuturePeriod ? "Futuro" : "Actual/pasado"} />
          <ChecklistCard ok={facilities.length > 0} title="IPRESS asignadas" value={facilities.length} />
          <ChecklistCard ok={facilities.every(facility => closureIsIpressReady(closuresByCode.get(facility.code)))} title="IPRESS precerradas" value={facilities.filter(facility => closureIsIpressReady(closuresByCode.get(facility.code))).length} />
          <ChecklistCard ok={pendingDistributions === 0} title="Distribuciones pendientes" value={pendingDistributions} />
          <ChecklistCard ok={pendingReturns === 0} title="Devoluciones pendientes" value={pendingReturns} />
        </div>
        <div className="mx-5 mb-5 grid grid-cols-1 gap-3 xl:grid-cols-2">
          <ReportDownloadCard
            title="Movimiento biológico - Almacén UNGET"
            description="Resumen del almacén: lo recibido de DIRESA y lo distribuido a sus IPRESS, con el mismo formato del movimiento biológico IPRESS."
            detail={`${warehouseReportRows} producto(s)/lote(s) en almacén.`}
            enabled={canDownloadWarehouseReport}
            onDownload={onDownloadWarehouse}
          />
          <ReportDownloadCard
            title="Movimiento biológico consolidado UNGET"
            description="Toda la red en una sola matriz: almacén e IPRESS sumados, sin contar traslados internos. El detalle por establecimiento está en el reporte de cada IPRESS."
            detail={`${networkReportRows} producto(s)/lote(s) consolidado(s). Requiere todas las IPRESS precerradas y sin pendientes.`}
            enabled={canDownloadNetworkReport}
            onDownload={onDownloadNetwork}
          />
        </div>
        <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/70 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-slate-600">
            {ungetClosure ? `Cerrado por ${ungetClosure.closedBy || "-"} el ${formatDateTime(ungetClosure.closedAt)}.` : "El cierre definitivo congela el periodo mensual de la UNGET."}
          </p>
          <button
            type="button"
            disabled={!canClose}
            onClick={onFinalClose}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <ShieldCheck className="h-4 w-4" />
            Cerrar UNGET
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5">
          <div className="flex flex-col gap-1 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-base font-black text-slate-900">Avance por IPRESS</h3>
              <p className="mt-1 text-sm text-slate-500">Busca y filtra establecimientos antes de cerrar definitivamente la UNGET.</p>
            </div>
            <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
              {visibleFacilities.length} de {facilities.length} visibles
            </span>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_240px_auto]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={event => onSearch(event.target.value)}
                placeholder="Buscar por código, IPRESS, usuario, motivo o estado..."
                className={`${inputClassName} pl-11`}
              />
            </label>
            <select value={statusFilter} onChange={event => onStatusFilter(event.target.value as ClosureStatusFilter)} className={inputClassName}>
              {closureStatusOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <button
              type="button"
              onClick={() => {
                onSearch("");
                onStatusFilter("ALL");
              }}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-600 shadow-sm hover:bg-slate-50"
            >
              <FilterX className="h-4 w-4" />
              Limpiar
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Código</th>
                <th className="px-5 py-3">IPRESS</th>
                <th className="px-5 py-3">Estado</th>
                <th className="px-5 py-3">Usuario</th>
                <th className="px-5 py-3">Fecha</th>
                <th className="px-5 py-3">Motivo reapertura</th>
                <th className="px-5 py-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedFacilities.map(facility => {
                const closure = closuresByCode.get(facility.code);
                return (
                  <tr key={facility.code} className="hover:bg-slate-50">
                    <td className="px-5 py-4 font-mono text-xs font-black text-teal-700">{facility.code}</td>
                    <td className="px-5 py-4 font-black text-slate-900">{facility.name}</td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${closureStatusClass(closure)}`}>
                        {closureStatusLabel(closure)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{closureUserLabel(closure)}</td>
                    <td className="px-5 py-4 text-slate-600">{closureDateLabel(closure)}</td>
                    <td className="max-w-[260px] px-5 py-4 text-xs font-semibold text-slate-500">
                      {closure?.status === "REOPENED" ? closure.reopenReason || "-" : "-"}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {canReopen && closure?.status === "PRE_CLOSED" ? (
                        <button
                          type="button"
                          onClick={() => onReopen(facility)}
                          className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 text-xs font-black text-blue-700 transition hover:bg-blue-100"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Reabrir
                        </button>
                      ) : (
                        <span className="text-xs font-semibold text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {visibleFacilities.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-sm font-semibold text-slate-500">
                    {facilities.length === 0 ? "No hay IPRESS vinculadas a esta UNGET." : "No hay IPRESS que coincidan con los filtros actuales."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/80 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="text-sm font-semibold text-slate-600">
            Mostrando <span className="font-black text-slate-900">{firstVisibleRow}</span>-<span className="font-black text-slate-900">{lastVisibleRow}</span> de <span className="font-black text-slate-900">{visibleFacilities.length}</span> IPRESS
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="flex items-center gap-2 text-sm font-bold text-slate-600">
              Filas:
              <select
                value={pageSize}
                onChange={event => setPageSize(Number(event.target.value))}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-800 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
              >
                {pageSizeOptions.map(option => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={safeCurrentPage <= 1}
                onClick={() => setCurrentPage(page => Math.max(1, page - 1))}
                className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Anterior
              </button>
              <span className="min-w-24 rounded-xl bg-white px-3 py-2 text-center text-sm font-black text-slate-700 shadow-sm">
                {safeCurrentPage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={safeCurrentPage >= totalPages}
                onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))}
                className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Siguiente
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const SupervisorPanel: React.FC<{
  rows: Array<{ unget: Unget; total: number; closed: number; pending: number; closure?: ImmunizationMonthlyClosure }>;
  ungets: Unget[];
  search: string;
  ungetFilter: string;
  statusFilter: ClosureStatusFilter;
  onSearch: (value: string) => void;
  onUngetFilter: (value: string) => void;
  onStatusFilter: (value: ClosureStatusFilter) => void;
  warehouseReportRows: number;
  networkReportRows: number;
  pendingUngetClosures: number;
  canDownloadReports: boolean;
  onDownloadWarehouse: (format: "PDF" | "EXCEL") => void;
  onDownloadNetwork: (format: "PDF" | "EXCEL") => void;
}> = ({
  rows,
  ungets,
  search,
  ungetFilter,
  statusFilter,
  onSearch,
  onUngetFilter,
  onStatusFilter,
  warehouseReportRows,
  networkReportRows,
  pendingUngetClosures,
  canDownloadReports,
  onDownloadWarehouse,
  onDownloadNetwork
}) => (
  <section className="space-y-4">
    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-lg font-black text-slate-900">Reportes regionales DIRESA</h3>
          <p className="mt-1 text-sm text-slate-500">
            Movimiento biológico del almacén regional y consolidado de toda la región.
          </p>
        </div>
        <span
          className={`w-fit rounded-full border px-3 py-1 text-xs font-black ${pendingUngetClosures > 0
            ? "border-amber-200 bg-amber-50 text-amber-700"
            : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}
        >
          {pendingUngetClosures > 0 ? `PRELIMINAR - ${pendingUngetClosures} UNGET SIN CERRAR` : "DEFINITIVO"}
        </span>
      </div>
      {pendingUngetClosures > 0 && (
        <p className="mx-5 mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
          El consolidado definitivo solo existe cuando todas las UNGET han cerrado el periodo. Mientras tanto, el archivo se
          descarga marcado como preliminar.
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 p-5 xl:grid-cols-2">
        <ReportDownloadCard
          title="Movimiento biológico - Almacén regional"
          description="Resumen del almacén DIRESA: lo recibido de nivel central y lo distribuido a sus UNGET."
          detail={`${warehouseReportRows} producto(s)/lote(s) en almacén regional.`}
          enabled={canDownloadReports}
          onDownload={onDownloadWarehouse}
        />
        <ReportDownloadCard
          title="Movimiento biológico consolidado regional"
          description="Toda la región en una sola matriz: almacén regional, UNGET e IPRESS, sin contar traslados internos."
          detail={`${networkReportRows} producto(s)/lote(s) consolidado(s). El detalle por UNGET está en el consolidado de cada UNGET.`}
          enabled={canDownloadReports}
          onDownload={onDownloadNetwork}
        />
      </div>
    </div>

    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-col gap-1 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-base font-black text-slate-900">Filtros de cierre UNGET</h3>
          <p className="text-sm text-slate-500">Busca por UNGET y filtra el estado del cierre definitivo.</p>
        </div>
        <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
          {rows.length} resultado(s)
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_260px_220px_auto]">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={event => onSearch(event.target.value)}
            placeholder="Buscar UNGET, código o estado..."
            className={`${inputClassName} pl-11`}
          />
        </label>
        <select value={ungetFilter} onChange={event => onUngetFilter(event.target.value)} className={inputClassName}>
          <option value="">Todas las UNGET</option>
          {ungets.map(unget => <option key={unget.id} value={unget.id}>{unget.name}</option>)}
        </select>
        <select value={statusFilter} onChange={event => onStatusFilter(event.target.value as ClosureStatusFilter)} className={inputClassName}>
          {closureStatusOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <button
          type="button"
          onClick={() => {
            onSearch("");
            onUngetFilter("");
            onStatusFilter("ALL");
          }}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-600 shadow-sm hover:bg-slate-50"
        >
          <FilterX className="h-4 w-4" />
          Limpiar
        </button>
      </div>
    </div>

    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-5">
        <h3 className="text-base font-black text-slate-900">Avance consolidado por UNGET</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3">UNGET</th>
              <th className="px-5 py-3">IPRESS</th>
              <th className="px-5 py-3">Precerradas</th>
              <th className="px-5 py-3">Pendientes</th>
              <th className="px-5 py-3">Cierre UNGET</th>
              <th className="px-5 py-3">Fecha cierre</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(row => (
              <tr key={row.unget.id} className="hover:bg-slate-50">
                <td className="px-5 py-4 font-black text-slate-900">{row.unget.name}</td>
                <td className="px-5 py-4 font-black text-slate-700">{row.total}</td>
                <td className="px-5 py-4 text-emerald-700 font-black">{row.closed}</td>
                <td className="px-5 py-4 text-amber-700 font-black">{row.pending}</td>
                <td className="px-5 py-4">
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${closureStatusClass(row.closure)}`}>
                    {closureStatusLabel(row.closure)}
                  </span>
                </td>
                <td className="px-5 py-4 text-slate-600">{formatDateTime(row.closure?.closedAt)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-sm font-semibold text-slate-500">No hay resultados para los filtros actuales.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  </section>
);

const ClosureDialog: React.FC<{
  mode: Exclude<DialogMode, null>;
  period: string;
  reopenFacility?: HealthFacility | null;
  saving: boolean;
  observation: string;
  onObservationChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}> = ({ mode, period, reopenFacility, saving, observation, onObservationChange, onClose, onSubmit }) => {
  const isIpressPreclose = mode === "IPRESS_PRE_CLOSE";
  const isReopen = mode === "IPRESS_REOPEN";
  const eyebrow = isIpressPreclose ? "Precierre IPRESS" : isReopen ? "Reapertura IPRESS" : "Cierre UNGET";
  const title = isIpressPreclose ? "Precerrar periodo mensual" : isReopen ? "Reabrir precierre IPRESS" : "Cerrar definitivamente el periodo";
  const message = isIpressPreclose
    ? "Confirma que la IPRESS ya registró sus consumos, bajas y devoluciones del mes. Después del precierre podrá descargar su movimiento biológico mensual."
    : isReopen
      ? `La UNGET reabrirá el precierre de ${reopenFacility ? `${reopenFacility.name} (${reopenFacility.code})` : "la IPRESS seleccionada"}. La IPRESS podrá corregir sus movimientos y volver a precerrar el periodo.`
      : "Confirma que todas las IPRESS de la UNGET están precerradas y que no existen recepciones pendientes. Este cierre congela el periodo para la UNGET.";
  const textareaLabel = isReopen ? "Motivo de reapertura" : "Observación de cierre";
  const placeholder = isReopen
    ? "Detalle el error encontrado, la diferencia con SISMED o el sustento de la corrección..."
    : "Sustento u observación del cierre mensual...";
  const buttonLabel = isReopen ? "Reabrir IPRESS" : "Confirmar cierre";
  return (
    <div className="fixed inset-0 z-[2147483646] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 bg-gradient-to-r from-teal-50 to-white p-6">
          <div className="flex gap-4">
            <div className={`rounded-2xl p-3 ${isReopen ? "bg-blue-100 text-blue-700" : "bg-teal-100 text-teal-700"}`}>
              {isReopen ? <RotateCcw className="h-6 w-6" /> : isIpressPreclose ? <ClipboardCheck className="h-6 w-6" /> : <ShieldCheck className="h-6 w-6" />}
            </div>
            <div>
              <p className={`text-xs font-black uppercase tracking-[0.25em] ${isReopen ? "text-blue-700" : "text-teal-700"}`}>{eyebrow}</p>
              <h3 className="mt-1 text-2xl font-black text-slate-900">{title}</h3>
              <p className="mt-1 text-sm text-slate-600">Periodo {period}.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-white hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4 p-6">
          <div className={`rounded-2xl border p-4 text-sm font-semibold leading-relaxed ${isReopen ? "border-blue-200 bg-blue-50 text-blue-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
            {message}
          </div>
          {isReopen && reopenFacility && (
            <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm md:grid-cols-2">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-slate-400">IPRESS</p>
                <p className="mt-1 font-black text-slate-900">{reopenFacility.name}</p>
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-slate-400">Código</p>
                <p className="mt-1 font-mono font-black text-teal-700">{reopenFacility.code}</p>
              </div>
            </div>
          )}
          <label className="block">
            <span className="text-sm font-black text-slate-700">{textareaLabel}{isReopen && <span className="text-red-500"> *</span>}</span>
            <textarea
              value={observation}
              onChange={event => onObservationChange(event.target.value)}
              rows={4}
              placeholder={placeholder}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition-shadow placeholder:text-slate-400 focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
            />
          </label>
        </div>
        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 p-5 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="h-11 rounded-xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onSubmit}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-black text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : isReopen ? <RotateCcw className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            {buttonLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
