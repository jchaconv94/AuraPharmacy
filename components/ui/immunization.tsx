import React from "react";
import { Activity, AlertTriangle, CheckCircle2, Lock, Package, XCircle } from "lucide-react";

/**
 * Piezas visuales compartidas por los módulos de Inmunizaciones.
 *
 * Antes cada módulo redefinía lo mismo: `SummaryCard` estaba escrito cuatro veces con
 * firmas distintas, `MetricCard` dos, y la clase de los inputs se repetía en nueve
 * archivos. Eso hacía que cualquier ajuste visual se aplicara solo a la pantalla que se
 * tocaba y el conjunto se fuera separando.
 *
 * Guía de referencia: `docs/UX_PLAN_INMUNIZACIONES.md`.
 */

/** Campos de formulario. Alto 44 px, según el plan UX. */
export const immunizationInputClass =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition-shadow placeholder:text-slate-400 focus:border-teal-500 focus:ring-4 focus:ring-teal-100 disabled:bg-slate-100 disabled:text-slate-500";

/** Listas desplegables de formulario. */
export const immunizationSelectClass =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100 disabled:bg-slate-100 disabled:text-slate-400";

/** Campos dentro de una barra de filtros. Más compactos que los de formulario. */
export const immunizationFilterInputClass =
  "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition-shadow placeholder:text-slate-400 focus:border-teal-500 focus:ring-4 focus:ring-teal-100 disabled:bg-slate-100 disabled:text-slate-500";

/** Normaliza para buscar sin tildes ni mayúsculas. */
export const normalizeImmunizationText = (value: string) => value
  .normalize("NFD")
  .replace(/[̀-ͯ]/g, "")
  .toLowerCase()
  .trim();

/**
 * Color con significado operativo, no decorativo.
 *
 * emerald: aplicado, vigente · amber: pendiente, advertencia · red: vencido, error
 * teal: información del módulo · slate: neutro · oscuro: periodo cerrado o bloqueado
 */
export type ImmunizationTone = "neutral" | "success" | "warning" | "danger" | "info" | "locked";

const toneIcon: Record<ImmunizationTone, string> = {
  neutral: "bg-slate-100 text-slate-700 ring-1 ring-slate-200/80",
  success: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80",
  warning: "bg-amber-50 text-amber-700 ring-1 ring-amber-200/80",
  danger: "bg-red-50 text-red-700 ring-1 ring-red-200/80",
  info: "bg-teal-50 text-teal-700 ring-1 ring-teal-200/80",
  locked: "bg-slate-900 text-slate-100 ring-1 ring-slate-800"
};

const toneTopBar: Record<ImmunizationTone, string> = {
  neutral: "bg-slate-300",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
  info: "bg-teal-500",
  locked: "bg-slate-800"
};

const toneFilled: Record<ImmunizationTone, string> = {
  neutral: "border-slate-200 bg-white text-slate-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  danger: "border-red-200 bg-red-50 text-red-800",
  info: "border-teal-200 bg-teal-50 text-teal-800",
  locked: "border-slate-300 bg-slate-900 text-white"
};

const toneChip: Record<ImmunizationTone, string> = {
  neutral: "border-slate-200 bg-slate-50 text-slate-600",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  danger: "border-red-200 bg-red-50 text-red-700",
  info: "border-teal-200 bg-teal-50 text-teal-700",
  locked: "border-slate-300 bg-slate-900 text-white"
};

const defaultToneIcons: Record<ImmunizationTone, React.ReactNode> = {
  neutral: <Package className="h-5 w-5" />,
  success: <CheckCircle2 className="h-5 w-5" />,
  warning: <AlertTriangle className="h-5 w-5" />,
  danger: <XCircle className="h-5 w-5" />,
  info: <Activity className="h-5 w-5" />,
  locked: <Lock className="h-5 w-5" />
};

/**
 * Tarjeta de indicador / KPI.
 */
export const ImmunizationKpiCard: React.FC<{
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  tone?: ImmunizationTone;
  hint?: string;
  filled?: boolean;
}> = ({ label, value, icon, tone = "neutral", hint, filled }) => {
  if (filled) {
    return (
      <div className={`rounded-2xl border px-3.5 py-3 ${toneFilled[tone]}`}>
        <p className="text-[10px] font-black uppercase tracking-wider opacity-70">{label}</p>
        <p className="mt-0.5 truncate text-lg font-black">{value}</p>
        {hint && <p className="mt-0.5 truncate text-[11px] font-semibold opacity-70">{hint}</p>}
      </div>
    );
  }

  const renderIcon = icon || defaultToneIcons[tone];

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md">
      {/* Dynamic top color accent line */}
      <div className={`absolute top-0 left-0 right-0 h-1 ${toneTopBar[tone]}`} />

      <div className="flex items-start justify-between gap-3 pt-0.5">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black uppercase tracking-wider text-slate-500 transition-colors group-hover:text-slate-700">
            {label}
          </p>
          <p className="mt-1.5 truncate text-2xl font-black text-slate-900 tracking-tight">
            {value}
          </p>
          {hint && (
            <p className="mt-1 truncate text-xs font-semibold text-slate-400">
              {hint}
            </p>
          )}
        </div>

        {renderIcon && (
          <div className={`shrink-0 rounded-xl p-2.5 shadow-2xs transition-transform duration-200 group-hover:scale-105 ${toneIcon[tone]}`}>
            {renderIcon}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Cabecera estándar de módulo: icono, título, distintivos, una línea de descripción y
 * el ámbito operativo. Las acciones van a la derecha.
 */
export const ImmunizationPageHeader: React.FC<{
  icon: React.ReactNode;
  title: string;
  description?: string;
  scopeLabel?: string;
  badges?: React.ReactNode;
  actions?: React.ReactNode;
  tone?: ImmunizationTone;
}> = ({ icon, title, description, scopeLabel, badges, actions, tone = "info" }) => (
  <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-start gap-4">
        <div className={`rounded-2xl p-3 ${toneIcon[tone]}`}>{icon}</div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-black text-slate-900">{title}</h2>
            {badges}
          </div>
          {description && <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-600">{description}</p>}
          {scopeLabel && <p className="mt-2 text-xs font-black text-teal-700">{scopeLabel}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-col gap-2 sm:flex-row">{actions}</div>}
    </div>
  </section>
);

/** Distintivo de estado. El texto siempre acompaña al color, nunca al revés. */
export const ImmunizationStatusChip: React.FC<{
  label: string;
  tone?: ImmunizationTone;
}> = ({ label, tone = "neutral" }) => (
  <span className={`w-fit rounded-full border px-2.5 py-1 text-xs font-black ${toneChip[tone]}`}>
    {label}
  </span>
);

/**
 * Celda de cabecera de tabla.
 *
 * Existían cinco versiones de esto repartidas por los módulos, con distinto relleno y
 * tamaño de letra. Una construía la clase de alineación por interpolación, que Tailwind
 * no puede detectar al compilar.
 */
export const ImmunizationTableHeader: React.FC<{
  children: React.ReactNode;
  align?: "left" | "right" | "center";
}> = ({ children, align = "left" }) => (
  <th
    className={`px-4 py-3 text-[10px] font-black uppercase tracking-wide text-slate-500 ${
      align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"
    }`}
  >
    {children}
  </th>
);

/** Campo de formulario con su etiqueta y la marca de obligatorio. */
export const ImmunizationField: React.FC<{
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}> = ({ label, required, hint, children }) => (
  <label className="block">
    <span className="mb-1.5 block text-xs font-black text-slate-700">
      {label} {required && <span className="text-red-500">*</span>}
    </span>
    {children}
    {hint && <span className="mt-1 block text-[11px] font-semibold text-slate-400">{hint}</span>}
  </label>
);

/** Fecha corta: `15/07/2026`. Devuelve `-` cuando no hay valor o no es una fecha. */
export const formatImmunizationDate = (value?: string) => {
  if (!value) return "-";
  const normalizado = value.includes("T") ? value : `${value}T00:00:00`;
  const fecha = new Date(normalizado);
  return Number.isNaN(fecha.getTime()) ? value : fecha.toLocaleDateString("es-PE");
};

/** Fecha y hora: `15/07/26, 14:30`. */
export const formatImmunizationDateTime = (value?: string) => {
  if (!value) return "-";
  const fecha = new Date(value);
  if (Number.isNaN(fecha.getTime())) return "-";
  return fecha.toLocaleString("es-PE", {
    day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit"
  });
};

/** Cantidad con separador de miles y hasta dos decimales. */
export const formatImmunizationNumber = (value: number, decimales = 2) =>
  Number(value || 0).toLocaleString("es-PE", { maximumFractionDigits: decimales });

/** Importe en soles. */
export const formatImmunizationCurrency = (value: number) =>
  `S/ ${Number(value || 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Hoy en el formato que espera un `<input type="date">`. */
export const todayInputValue = () => new Date().toISOString().slice(0, 10);

/** Dato suelto etiqueta/valor, para cabeceras de detalle y resúmenes de una fila. */
export const ImmunizationInfoPill: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div>
    <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</p>
    <p className="mt-1 font-black text-slate-900">{value}</p>
  </div>
);

/** Estado vacío: qué pasa y qué puede hacer el usuario a continuación. */
export const ImmunizationEmptyState: React.FC<{
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}> = ({ title, description, icon, action }) => (
  <div className="flex flex-col items-center gap-3 p-10 text-center">
    {icon && <span className="rounded-2xl bg-slate-100 p-3 text-slate-400">{icon}</span>}
    <div>
      <p className="text-sm font-black text-slate-600">{title}</p>
      {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
    </div>
    {action}
  </div>
);
