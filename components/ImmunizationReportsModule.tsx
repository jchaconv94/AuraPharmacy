import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Building2,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  PackageX,
  RefreshCw,
  Search,
  Syringe,
  TrendingDown,
  Wallet
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
  belongsToUngetScope,
  buildImmunizationProgress,
  closureMatchesStatus,
  closureStatusLabel,
  ImmunizationClosureStatusFilter,
  ImmunizationUngetProgress
} from "../services/immunizationProgressService";
import {
  downloadImmunizationDiresaNetworkReportExcel,
  downloadImmunizationDiresaNetworkReportPdf,
  downloadImmunizationDiresaWarehouseReportExcel,
  downloadImmunizationDiresaWarehouseReportPdf,
  downloadImmunizationUngetNetworkReportExcel,
  downloadImmunizationUngetNetworkReportPdf,
  ImmunizationMonthlyReportOptions
} from "../services/immunizationMonthlyReportService";
import {
  HealthFacility,
  ImmunizationDistributionBatch,
  ImmunizationMonthlyClosure,
  ImmunizationReturnBatch,
  ImmunizationStockLayer,
  ImmunizationStockMovement,
  Unget
} from "../types";
import { ImmunizationKpiCard, immunizationFilterInputClass as inputClassName, normalizeImmunizationText as normalizeText } from "./ui/immunization";

const currentPeriod = getCurrentImmunizationPeriod();

const statusOptions: Array<{ value: ImmunizationClosureStatusFilter; label: string }> = [
  { value: "ALL", label: "Todos los estados" },
  { value: "PENDING", label: "Pendientes" },
  { value: "PRE_CLOSED", label: "Precerradas" },
  { value: "FINAL_CLOSED", label: "Cerradas" },
  { value: "REOPENED", label: "Reabiertas" }
];


const number = (value: number) => value.toLocaleString("es-PE", { maximumFractionDigits: 0 });
const money = (value: number) => `S/ ${value.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const percent = (value: number) => `${value.toLocaleString("es-PE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

export const ImmunizationReportsModule: React.FC = () => {
  const { user } = useAuth();
  const scope = useMemo(() => getImmunizationScope(user), [user]);
  const isIpress = scope.level === "IPRESS" && Boolean(scope.facilityCode);
  const isUnget = scope.level === "UNGET" && Boolean(scope.ungetId);

  const [period, setPeriod] = useState(currentPeriod);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ImmunizationClosureStatusFilter>("ALL");

  const [ungets, setUngets] = useState<Unget[]>([]);
  const [facilities, setFacilities] = useState<HealthFacility[]>([]);
  const [closures, setClosures] = useState<ImmunizationMonthlyClosure[]>([]);
  const [distributions, setDistributions] = useState<ImmunizationDistributionBatch[]>([]);
  const [returns, setReturns] = useState<ImmunizationReturnBatch[]>([]);
  const [stockLayers, setStockLayers] = useState<ImmunizationStockLayer[]>([]);
  const [movements, setMovements] = useState<ImmunizationStockMovement[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [ungetRows, facilityRows] = await Promise.all([api.getUngets(), api.getFacilities()]);

      // El tablero es de supervisión: lee el ámbito completo y luego recorta por rol.
      const readScope = { level: "GLOBAL" as const };
      const [closureRows, distributionRows, returnRows, layerRows, movementRows] = await Promise.all([
        immunizationApi.listMonthlyClosures(readScope, period),
        immunizationApi.listDistributionBatches(readScope),
        immunizationApi.listReturnBatches(readScope),
        immunizationApi.getStockLayers(readScope),
        immunizationApi.listStockMovements(readScope, period)
      ]);

      setUngets([...ungetRows].sort((a, b) => a.name.localeCompare(b.name)));
      setFacilities(facilityRows);
      setClosures(closureRows);
      setDistributions(distributionRows);
      setReturns(returnRows);
      setStockLayers(layerRows);
      setMovements(movementRows);
    } catch {
      toast.error("No se pudo cargar el tablero de reportes.");
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  /** Cada rol ve solo su ámbito: la IPRESS su UNGET, la UNGET su red, DIRESA toda la región. */
  const visibleUngets = useMemo(() => {
    if (isIpress || isUnget) return ungets.filter(unget => unget.id === scope.ungetId);
    if (scope.level === "OGESS" && scope.ogessId) return ungets.filter(unget => unget.ogessId === scope.ogessId);
    if (scope.level === "DIRESA" && scope.diresaId) return ungets.filter(unget => unget.diresaId === scope.diresaId);
    return ungets;
  }, [isIpress, isUnget, scope, ungets]);

  const visibleFacilities = useMemo(() => {
    if (isIpress) return facilities.filter(facility => facility.code === scope.facilityCode);
    const ungetIds = new Set(visibleUngets.map(unget => unget.id));
    return facilities.filter(facility => facility.ungetId && ungetIds.has(facility.ungetId));
  }, [facilities, isIpress, scope.facilityCode, visibleUngets]);

  const progress = useMemo(() => buildImmunizationProgress({
    period,
    ungets: visibleUngets,
    facilities: visibleFacilities,
    closures,
    distributions,
    returns,
    movements,
    stockLayers
  }), [closures, distributions, movements, period, returns, stockLayers, visibleFacilities, visibleUngets]);

  const rows = useMemo(() => {
    const query = normalizeText(search);
    return progress.ungets
      .filter(row => closureMatchesStatus(row.closure, statusFilter))
      .filter(row => !query || normalizeText(`${row.unget.name} ${closureStatusLabel(row.closure)}`).includes(query));
  }, [progress.ungets, search, statusFilter]);

  const { summary } = progress;

  /**
   * El consolidado de una UNGET sale preliminar mientras esa UNGET no haya cerrado, con la
   * misma regla que el regional. Se arma con las capas y movimientos de su ámbito.
   */
  const downloadUngetReport = async (row: ImmunizationUngetProgress, format: "PDF" | "EXCEL") => {
    const facilityCodes = new Set(
      facilities.filter(facility => facility.ungetId === row.unget.id).map(facility => facility.code)
    );
    const options: ImmunizationMonthlyReportOptions = {
      period,
      ownerName: row.unget.name,
      scopeLabel: "UNGET",
      generatedBy: user?.username,
      closure: row.closure,
      stockLayers: stockLayers.filter(layer => belongsToUngetScope(layer, row.unget.id, facilityCodes)),
      movements: movements.filter(movement => belongsToUngetScope(movement, row.unget.id, facilityCodes)),
      isPreliminary: !row.isClosed,
      preliminaryReason: !row.isClosed
        ? `la UNGET aún no ha cerrado el periodo${row.pendingIpress > 0 ? `; faltan ${row.pendingIpress} IPRESS por precerrar.` : "."}`
        : undefined
    };

    if (options.stockLayers.length === 0 && options.movements.length === 0) {
      toast.error(`${row.unget.name} no tiene stock ni movimientos en este periodo.`);
      return;
    }

    try {
      if (format === "PDF") await downloadImmunizationUngetNetworkReportPdf(options);
      else await downloadImmunizationUngetNetworkReportExcel(options);
    } catch {
      toast.error(`No se pudo generar el consolidado de ${row.unget.name}.`);
    }
  };

  const regionalReportOptions = useMemo<ImmunizationMonthlyReportOptions>(() => ({
    period,
    ownerName: "DIRESA SAN MARTÍN",
    scopeLabel: "REGIONAL",
    generatedBy: user?.username,
    stockLayers,
    movements,
    isPreliminary: !summary.isDefinitive,
    preliminaryReason: !summary.isDefinitive
      ? `faltan ${summary.pendingUngets} UNGET por cerrar el periodo.`
      : undefined
  }), [movements, period, stockLayers, summary.isDefinitive, summary.pendingUngets, user?.username]);

  const downloadRegionalReport = async (kind: "WAREHOUSE" | "NETWORK", format: "PDF" | "EXCEL") => {
    if (stockLayers.length === 0 && movements.length === 0) {
      toast.error("No hay stock ni movimientos en este periodo.");
      return;
    }
    try {
      if (kind === "WAREHOUSE") {
        if (format === "PDF") await downloadImmunizationDiresaWarehouseReportPdf(regionalReportOptions);
        else await downloadImmunizationDiresaWarehouseReportExcel(regionalReportOptions);
      } else {
        if (format === "PDF") await downloadImmunizationDiresaNetworkReportPdf(regionalReportOptions);
        else await downloadImmunizationDiresaNetworkReportExcel(regionalReportOptions);
      }
    } catch {
      toast.error("No se pudo generar el reporte regional.");
    }
  };

  const scopeLabel = isIpress
    ? "Su establecimiento"
    : isUnget
      ? "Su red UNGET"
      : `${visibleUngets.length} UNGET del ámbito`;

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-700">
              <BarChart3 className="h-7 w-7" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-black text-slate-900">Reportes Inmunizaciones</h2>
                <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-black text-indigo-700">
                  PERIODO {period}
                </span>
                <span
                  className={`rounded-full border px-2.5 py-1 text-xs font-black ${summary.isDefinitive
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-amber-200 bg-amber-50 text-amber-700"}`}
                >
                  {summary.isDefinitive ? "DEFINITIVO" : "PRELIMINAR"}
                </span>
              </div>
              <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-600">
                Avance operativo del cierre mensual. Los archivos del movimiento biológico se descargan desde Cierre Mensual.
              </p>
              <p className="mt-2 text-xs font-black text-indigo-700">Ámbito: {scopeLabel}</p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="month"
              value={period}
              max={currentPeriod}
              onChange={event => {
                const next = event.target.value || currentPeriod;
                if (next > currentPeriod) {
                  toast.error(`No se puede seleccionar un periodo futuro. Periodo máximo: ${currentPeriod}.`);
                  return;
                }
                setPeriod(next);
              }}
              className={`${inputClassName} h-11 sm:w-44`}
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

      {!loading && !summary.isDefinitive && summary.totalUngets > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800 shadow-sm">
          Información preliminar: {summary.pendingUngets} de {summary.totalUngets} UNGET aún no cierran el periodo. El
          consolidado definitivo existe solo cuando todas han cerrado.
        </section>
      )}

      {loading ? (
        <div className="flex min-h-[260px] items-center justify-center rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 text-sm font-black text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
            Cargando tablero...
          </div>
        </div>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <ImmunizationKpiCard
              icon={<CalendarCheck className="h-5 w-5" />}
              label="UNGET cerradas"
              value={`${summary.closedUngets} / ${summary.totalUngets}`}
              tone={summary.pendingUngets > 0 ? "warning" : "success"}
            />
            <ImmunizationKpiCard
              icon={<Building2 className="h-5 w-5" />}
              label="IPRESS precerradas"
              value={`${summary.preclosedIpress} / ${summary.totalIpress}`}
              tone={summary.pendingIpress > 0 ? "warning" : "success"}
            />
            <ImmunizationKpiCard
              icon={<AlertTriangle className="h-5 w-5" />}
              label="Incidencias abiertas"
              value={summary.openIncidents}
              tone={summary.openIncidents > 0 ? "danger" : "neutral"}
              hint={`${summary.observedDistributions} distrib. · ${summary.observedReturns} devol.`}
            />
            <ImmunizationKpiCard
              icon={<Clock className="h-5 w-5" />}
              label="Pendientes de recepción"
              value={summary.pendingDistributions + summary.pendingReturns}
              tone={summary.pendingDistributions + summary.pendingReturns > 0 ? "warning" : "neutral"}
              hint={`${summary.pendingDistributions} distrib. · ${summary.pendingReturns} devol.`}
            />
          </section>

          <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <ImmunizationKpiCard icon={<Syringe className="h-5 w-5" />} label="Consumo (frascos)" value={number(summary.consumoFrascos)} />
            <ImmunizationKpiCard icon={<CheckCircle2 className="h-5 w-5" />} label="Dosis aplicadas" value={number(summary.dosisAplicadas)} tone="success" />
            <ImmunizationKpiCard
              icon={<TrendingDown className="h-5 w-5" />}
              label="Factor de pérdida"
              value={percent(summary.factorPerdida)}
              tone={summary.factorPerdida > 0 ? "warning" : "neutral"}
              hint={`${number(summary.dosisPerdidas)} dosis perdidas`}
            />
            <ImmunizationKpiCard
              icon={<PackageX className="h-5 w-5" />}
              label="Vencidos / por vencer"
              value={`${summary.expiredLots} / ${summary.expiringLots}`}
              tone={summary.expiredLots > 0 ? "danger" : "neutral"}
              hint="Lotes con saldo"
            />
            <ImmunizationKpiCard
              icon={<Wallet className="h-5 w-5" />}
              label="Valorización"
              value={money(summary.valorizacion)}
              hint={`${number(summary.stockFrascos)} frascos en stock`}
            />
          </section>

          {!isIpress && (
            <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 p-5">
                <h3 className="text-lg font-black text-slate-900">Descargas del ámbito</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Movimiento biológico con el formato de 19 columnas. Si el periodo no está cerrado, el archivo sale marcado
                  como preliminar.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 p-5 xl:grid-cols-2">
                <RegionalDownloadCard
                  title="Almacén regional DIRESA"
                  description="Lo recibido del nivel central y lo distribuido a las UNGET."
                  onDownload={format => void downloadRegionalReport("WAREHOUSE", format)}
                />
                <RegionalDownloadCard
                  title="Consolidado regional"
                  description="Almacén regional, UNGET e IPRESS en una sola matriz, sin contar traslados internos."
                  onDownload={format => void downloadRegionalReport("NETWORK", format)}
                />
              </div>
            </section>
          )}

          <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 p-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900">Avance por UNGET</h3>
                <p className="mt-1 text-sm text-slate-500">Estado del cierre, incidencias y consumo de cada red.</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <label className="relative block sm:w-64">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={search}
                    onChange={event => setSearch(event.target.value)}
                    placeholder="Buscar UNGET o estado..."
                    className={`${inputClassName} pl-10`}
                  />
                </label>
                <select
                  value={statusFilter}
                  onChange={event => setStatusFilter(event.target.value as ImmunizationClosureStatusFilter)}
                  className={`${inputClassName} sm:w-48`}
                >
                  {statusOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
            </div>

            {rows.length === 0 ? (
              <div className="p-10 text-center">
                <p className="text-sm font-black text-slate-600">No hay UNGET que coincidan con el filtro.</p>
                <p className="mt-1 text-sm text-slate-500">Ajusta la búsqueda o el estado seleccionado.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="bg-slate-50">
                    <tr className="text-[10px] uppercase tracking-wider text-slate-500">
                      <th className="px-4 py-3 text-left font-black">UNGET</th>
                      <th className="px-4 py-3 text-center font-black">Estado</th>
                      <th className="px-4 py-3 text-center font-black">IPRESS</th>
                      <th className="px-4 py-3 text-center font-black">Pend. recep.</th>
                      <th className="px-4 py-3 text-center font-black">Incidencias</th>
                      <th className="px-4 py-3 text-center font-black">Consumo</th>
                      <th className="px-4 py-3 text-center font-black">Factor pérdida</th>
                      <th className="px-4 py-3 text-center font-black">Vencidos</th>
                      <th className="px-4 py-3 text-right font-black">Valorización</th>
                      <th className="px-4 py-3 text-center font-black">Consolidado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map(row => (
                      <UngetRow
                        key={row.unget.id}
                        row={row}
                        onDownload={format => void downloadUngetReport(row, format)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};

const UngetRow: React.FC<{
  row: ImmunizationUngetProgress;
  onDownload: (format: "PDF" | "EXCEL") => void;
}> = ({ row, onDownload }) => (
  <tr className="transition hover:bg-slate-50/70">
    <td className="px-4 py-3">
      <p className="font-black text-slate-900">{row.unget.name}</p>
    </td>
    <td className="px-4 py-3 text-center">
      <span
        className={`rounded-full border px-2.5 py-1 text-xs font-black ${row.isClosed
          ? "border-slate-300 bg-slate-900 text-white"
          : row.closure
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-amber-200 bg-amber-50 text-amber-700"}`}
      >
        {closureStatusLabel(row.closure)}
      </span>
    </td>
    <td className="px-4 py-3 text-center font-bold text-slate-700">
      {row.preclosedIpress} / {row.totalIpress}
      {row.reopenedIpress > 0 && <span className="ml-1 text-xs font-black text-blue-600">({row.reopenedIpress} reab.)</span>}
    </td>
    <td className={`px-4 py-3 text-center font-black ${row.pendingDistributions + row.pendingReturns > 0 ? "text-amber-600" : "text-slate-400"}`}>
      {row.pendingDistributions + row.pendingReturns}
    </td>
    <td className={`px-4 py-3 text-center font-black ${row.openIncidents > 0 ? "text-red-600" : "text-slate-400"}`}>
      {row.openIncidents}
    </td>
    <td className="px-4 py-3 text-center font-bold text-slate-700">
      {number(row.consumoFrascos)}
      <span className="ml-1 text-xs text-slate-400">fco</span>
    </td>
    <td className={`px-4 py-3 text-center font-black ${row.factorPerdida > 0 ? "text-amber-600" : "text-slate-400"}`}>
      {percent(row.factorPerdida)}
    </td>
    <td className={`px-4 py-3 text-center font-black ${row.expiredLots > 0 ? "text-red-600" : "text-slate-400"}`}>
      {row.expiredLots}
    </td>
    <td className="px-4 py-3 text-right font-bold text-slate-700">{money(row.valorizacion)}</td>
    <td className="px-4 py-3">
      <div className="flex items-center justify-center gap-1.5">
        <button
          type="button"
          onClick={() => onDownload("PDF")}
          title={`Consolidado de ${row.unget.name} en PDF${row.isClosed ? "" : " (preliminar)"}`}
          aria-label={`Descargar consolidado de ${row.unget.name} en PDF`}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-red-600 shadow-sm transition hover:bg-slate-50"
        >
          <FileText className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onDownload("EXCEL")}
          title={`Consolidado de ${row.unget.name} en Excel${row.isClosed ? "" : " (preliminar)"}`}
          aria-label={`Descargar consolidado de ${row.unget.name} en Excel`}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-teal-700 shadow-sm transition hover:bg-slate-50"
        >
          <FileSpreadsheet className="h-4 w-4" />
        </button>
      </div>
    </td>
  </tr>
);

const RegionalDownloadCard: React.FC<{
  title: string;
  description: string;
  onDownload: (format: "PDF" | "EXCEL") => void;
}> = ({ title, description, onDownload }) => (
  <div className="flex h-full flex-col justify-between gap-4 rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-white p-4">
    <div>
      <p className="inline-flex items-center gap-2 text-sm font-black text-slate-900">
        <Download className="h-4 w-4 text-indigo-700" />
        {title}
      </p>
      <p className="mt-1 text-sm leading-relaxed text-slate-600">{description}</p>
    </div>
    <div className="flex flex-col gap-2 sm:flex-row">
      <button
        type="button"
        onClick={() => onDownload("PDF")}
        className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
      >
        <FileText className="h-4 w-4 text-red-600" />
        PDF
      </button>
      <button
        type="button"
        onClick={() => onDownload("EXCEL")}
        className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-black text-white shadow-sm transition hover:bg-indigo-700"
      >
        <FileSpreadsheet className="h-4 w-4" />
        Excel
      </button>
    </div>
  </div>
);
