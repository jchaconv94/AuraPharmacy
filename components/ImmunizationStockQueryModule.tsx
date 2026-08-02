import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Boxes, Eye, Layers, Loader2, PackageSearch, RefreshCw, Search, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../services/api";
import { getImmunizationScope, immunizationApi } from "../services/immunizationApi";
import { expirationKeyFor, ImmunizationExpirationKey } from "../services/immunizationProgressService";
import { HealthFacility, ImmunizationStockLayer, Unget } from "../types";
import {
  ImmunizationEmptyState,
  immunizationFilterInputClass as inputClassName,
  ImmunizationKpiCard,
  ImmunizationPageHeader,
  ImmunizationStatusChip,
  normalizeImmunizationText as normalizeText
} from "./ui/immunization";

/**
 * Consulta de Stock Biológico.
 *
 * Pantalla de supervisión, separada a propósito de `Stock Biológico`, que es operativa.
 * Aquí no se registra ni se modifica nada: solo se consulta el stock de otros ámbitos.
 * Por eso lleva su propio permiso, para que un perfil supervisor no termine operando
 * existencias por error (`INMUNIZACIONES_DISENO_FUNCIONAL.md`, sección 7.3).
 */

type Vista = "ESTABLECIMIENTO" | "UNGET" | "REGIONAL";

const VISTAS: Array<{ id: Vista; label: string; descripcion: string }> = [
  { id: "ESTABLECIMIENTO", label: "Por establecimiento", descripcion: "Cada lote con su ubicación" },
  { id: "UNGET", label: "Consolidado UNGET", descripcion: "Sumado por red" },
  { id: "REGIONAL", label: "Consolidado regional", descripcion: "Sumado por producto" }
];

const ETIQUETA_VENCIMIENTO: Record<ImmunizationExpirationKey, { texto: string; tono: "danger" | "warning" | "info" | "neutral" }> = {
  EXPIRED: { texto: "Vencido", tono: "danger" },
  CRITICAL: { texto: "≤ 40 días", tono: "danger" },
  UPCOMING: { texto: "≤ 90 días", tono: "warning" },
  VALID: { texto: "Vigente", tono: "info" },
  UNKNOWN: { texto: "Sin fecha", tono: "neutral" }
};

const numero = (value: number) => value.toLocaleString("es-PE", { maximumFractionDigits: 2 });
const soles = (value: number) => `S/ ${value.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fecha = (value?: string) => {
  if (!value) return "-";
  const normalizado = value.includes("T") ? value : `${value}T00:00:00`;
  const d = new Date(normalizado);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString("es-PE");
};

export const ImmunizationStockQueryModule: React.FC = () => {
  const { user } = useAuth();
  const scope = useMemo(() => getImmunizationScope(user), [user]);
  const esUnget = scope.level === "UNGET" && Boolean(scope.ungetId);

  const [loading, setLoading] = useState(true);
  const [layers, setLayers] = useState<ImmunizationStockLayer[]>([]);
  const [ungets, setUngets] = useState<Unget[]>([]);
  const [facilities, setFacilities] = useState<HealthFacility[]>([]);

  const [vista, setVista] = useState<Vista>("ESTABLECIMIENTO");
  const [busqueda, setBusqueda] = useState("");
  const [ungetFiltro, setUngetFiltro] = useState("");
  const [facilityFiltro, setFacilityFiltro] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState("");
  const [vencimientoFiltro, setVencimientoFiltro] = useState<"" | "ALERTAS" | ImmunizationExpirationKey>("");

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [ungetRows, facilityRows] = await Promise.all([api.getUngets(), api.getFacilities()]);
      setUngets([...ungetRows].sort((a, b) => a.name.localeCompare(b.name)));
      setFacilities([...facilityRows].sort((a, b) => a.name.localeCompare(b.name)));

      // Una UNGET necesita su almacén y el de sus IPRESS; un supervisor, todo el ámbito.
      // Las políticas de la base recortan lo que no corresponde, así que pedir de más
      // no expone nada.
      if (esUnget && scope.ungetId) {
        const codigos = facilityRows.filter(f => f.ungetId === scope.ungetId).map(f => f.code);
        const [propias, deIpress] = await Promise.all([
          immunizationApi.getStockLayers({ level: "UNGET", ownerType: "UNGET", ungetId: scope.ungetId }),
          codigos.length > 0
            ? immunizationApi.getStockLayers({ level: "UNGET", ownerType: "IPRESS", ungetId: scope.ungetId, facilityCodes: codigos })
            : Promise.resolve<ImmunizationStockLayer[]>([])
        ]);
        setLayers([...propias, ...deIpress]);
      } else {
        setLayers(await immunizationApi.getStockLayers({ level: "GLOBAL" }));
      }
    } catch {
      toast.error("No se pudo cargar la consulta de stock.");
    } finally {
      setLoading(false);
    }
  }, [esUnget, scope.ungetId]);

  useEffect(() => { void cargar(); }, [cargar]);

  const nombreUnget = useCallback(
    (id?: string) => ungets.find(u => u.id === id)?.name || "Sin UNGET",
    [ungets]
  );

  const ubicacion = useCallback((layer: ImmunizationStockLayer) => {
    if (layer.ownerType === "DIRESA") return "Almacén Regional DIRESA";
    if (layer.ownerType === "UNGET") return `Almacén ${nombreUnget(layer.ungetId)}`;
    const f = facilities.find(row => row.code === layer.facilityCode);
    return f ? `${f.code} - ${f.name}` : layer.facilityCode || "Sin establecimiento";
  }, [facilities, nombreUnget]);

  /** La UNGET a la que pertenece una capa, sea propia o de una de sus IPRESS. */
  const ungetDeLayer = useCallback((layer: ImmunizationStockLayer) => {
    if (layer.ungetId) return layer.ungetId;
    const f = facilities.find(row => row.code === layer.facilityCode);
    return f?.ungetId || "";
  }, [facilities]);

  const tiposProducto = useMemo(
    () => Array.from(new Set(layers.map(l => l.product?.tipoProducto).filter(Boolean))).sort() as string[],
    [layers]
  );

  const ungetsDisponibles = useMemo(() => {
    const ids = new Set(layers.map(ungetDeLayer).filter(Boolean));
    return ungets.filter(u => ids.has(u.id));
  }, [layers, ungetDeLayer, ungets]);

  const facilitiesDisponibles = useMemo(() => {
    const codigos = new Set(layers.filter(l => l.ownerType === "IPRESS").map(l => l.facilityCode).filter(Boolean));
    return facilities
      .filter(f => codigos.has(f.code))
      .filter(f => !ungetFiltro || f.ungetId === ungetFiltro);
  }, [facilities, layers, ungetFiltro]);

  const filtradas = useMemo(() => {
    const query = normalizeText(busqueda);
    const hoy = new Date();
    return layers.filter(layer => {
      if (layer.currentQuantity <= 0) return false;
      if (ungetFiltro && ungetDeLayer(layer) !== ungetFiltro) return false;
      if (facilityFiltro && layer.facilityCode !== facilityFiltro) return false;
      if (tipoFiltro && layer.product?.tipoProducto !== tipoFiltro) return false;

      if (vencimientoFiltro) {
        const clave = expirationKeyFor(layer.expirationDate, hoy);
        if (vencimientoFiltro === "ALERTAS") {
          if (!["EXPIRED", "CRITICAL", "UPCOMING"].includes(clave)) return false;
        } else if (clave !== vencimientoFiltro) return false;
      }

      if (query) {
        const texto = normalizeText([
          layer.product?.codigoSismed,
          layer.product?.descripcion,
          layer.lote,
          ubicacion(layer)
        ].filter(Boolean).join(" "));
        if (!texto.includes(query)) return false;
      }
      return true;
    });
  }, [busqueda, facilityFiltro, layers, tipoFiltro, ubicacion, ungetDeLayer, ungetFiltro, vencimientoFiltro]);

  const totales = useMemo(() => {
    const hoy = new Date();
    const claves = filtradas.map(l => expirationKeyFor(l.expirationDate, hoy));
    return {
      lotes: filtradas.length,
      productos: new Set(filtradas.map(l => l.productId)).size,
      frascos: filtradas.reduce((s, l) => s + l.currentQuantity, 0),
      valor: filtradas.reduce((s, l) => s + l.currentQuantity * (Number(l.unitPrice) || 0), 0),
      vencidos: claves.filter(k => k === "EXPIRED").length,
      alertas: claves.filter(k => k === "CRITICAL" || k === "UPCOMING").length
    };
  }, [filtradas]);

  /** Filas ya agregadas según la vista elegida. */
  const filas = useMemo(() => {
    if (vista === "ESTABLECIMIENTO") {
      return filtradas
        .map(layer => ({
          clave: layer.id,
          ubicacion: ubicacion(layer),
          codigo: layer.product?.codigoSismed || "",
          descripcion: layer.product?.descripcion || "Producto sin descripción",
          lote: layer.lote,
          vencimiento: layer.expirationDate,
          cantidad: layer.currentQuantity,
          valor: layer.currentQuantity * (Number(layer.unitPrice) || 0),
          lotes: 1
        }))
        .sort((a, b) => a.ubicacion.localeCompare(b.ubicacion) || a.codigo.localeCompare(b.codigo));
    }

    const grupos = new Map<string, { ubicacion: string; codigo: string; descripcion: string; cantidad: number; valor: number; lotes: number }>();
    filtradas.forEach(layer => {
      const ambito = vista === "UNGET" ? nombreUnget(ungetDeLayer(layer)) : "Región";
      const clave = `${ambito}||${layer.productId}`;
      const actual = grupos.get(clave) || {
        ubicacion: ambito,
        codigo: layer.product?.codigoSismed || "",
        descripcion: layer.product?.descripcion || "Producto sin descripción",
        cantidad: 0,
        valor: 0,
        lotes: 0
      };
      actual.cantidad += layer.currentQuantity;
      actual.valor += layer.currentQuantity * (Number(layer.unitPrice) || 0);
      actual.lotes += 1;
      grupos.set(clave, actual);
    });

    return Array.from(grupos.entries())
      .map(([clave, valor]) => ({ clave, ...valor, lote: "", vencimiento: "" }))
      .sort((a, b) => a.ubicacion.localeCompare(b.ubicacion) || a.codigo.localeCompare(b.codigo));
  }, [filtradas, nombreUnget, ubicacion, ungetDeLayer, vista]);

  const hayFiltros = Boolean(busqueda || ungetFiltro || facilityFiltro || tipoFiltro || vencimientoFiltro);
  const limpiar = () => {
    setBusqueda(""); setUngetFiltro(""); setFacilityFiltro(""); setTipoFiltro(""); setVencimientoFiltro("");
  };

  const detalle = vista === "ESTABLECIMIENTO";

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <ImmunizationPageHeader
        icon={<PackageSearch className="h-7 w-7" />}
        title="Consulta de Stock Biológico"
        description="Consulta territorial de solo lectura. No registra ni modifica movimientos."
        scopeLabel={esUnget ? `Ámbito: ${nombreUnget(scope.ungetId)} y sus IPRESS` : "Ámbito: toda la región"}
        badges={<ImmunizationStatusChip label="SOLO LECTURA" tone="info" />}
        actions={
          <button
            type="button"
            onClick={() => void cargar()}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </button>
        }
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <ImmunizationKpiCard label="Productos" value={numero(totales.productos)} icon={<Boxes className="h-5 w-5" />} tone="info" />
        <ImmunizationKpiCard label="Lotes" value={numero(totales.lotes)} icon={<Layers className="h-5 w-5" />} />
        <ImmunizationKpiCard label="Frascos/unidades" value={numero(totales.frascos)} icon={<Building2 className="h-5 w-5" />} />
        <ImmunizationKpiCard
          label="Vencidos / por vencer"
          value={`${totales.vencidos} / ${totales.alertas}`}
          tone={totales.vencidos > 0 ? "danger" : totales.alertas > 0 ? "warning" : "neutral"}
          icon={<Eye className="h-5 w-5" />}
        />
        <ImmunizationKpiCard label="Valorización" value={soles(totales.valor)} icon={<Wallet className="h-5 w-5" />} />
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-1 rounded-2xl bg-slate-100 p-1">
            {VISTAS.map(opcion => (
              <button
                key={opcion.id}
                type="button"
                onClick={() => setVista(opcion.id)}
                title={opcion.descripcion}
                className={`rounded-xl px-3 py-2 text-xs font-black transition ${
                  vista === opcion.id ? "bg-white text-teal-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {opcion.label}
              </button>
            ))}
          </div>
          <p className="text-xs font-bold text-slate-500">{filas.length} fila(s)</p>
        </div>

        <div className="grid grid-cols-1 gap-3 border-b border-slate-100 p-4 md:grid-cols-2 xl:grid-cols-6">
          <label className="relative block xl:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Código, descripción, lote o ubicación"
              className={`${inputClassName} pl-10`}
            />
          </label>

          <select
            value={ungetFiltro}
            onChange={e => { setUngetFiltro(e.target.value); setFacilityFiltro(""); }}
            className={inputClassName}
            disabled={esUnget}
          >
            <option value="">Todas las UNGET</option>
            {ungetsDisponibles.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>

          <select value={facilityFiltro} onChange={e => setFacilityFiltro(e.target.value)} className={inputClassName}>
            <option value="">Todas las IPRESS</option>
            {facilitiesDisponibles.map(f => <option key={f.code} value={f.code}>{f.code} - {f.name}</option>)}
          </select>

          <select value={tipoFiltro} onChange={e => setTipoFiltro(e.target.value)} className={inputClassName}>
            <option value="">Todos los tipos</option>
            {tiposProducto.map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          <div className="flex gap-2">
            <select
              value={vencimientoFiltro}
              onChange={e => setVencimientoFiltro(e.target.value as typeof vencimientoFiltro)}
              className={inputClassName}
            >
              <option value="">Todo vencimiento</option>
              <option value="ALERTAS">Con alerta</option>
              <option value="EXPIRED">Vencidos</option>
              <option value="CRITICAL">Hasta 40 días</option>
              <option value="UPCOMING">Hasta 90 días</option>
              <option value="VALID">Vigentes</option>
            </select>
            {hayFiltros && (
              <button
                type="button"
                onClick={limpiar}
                className="h-10 shrink-0 rounded-xl border border-slate-200 px-3 text-xs font-black text-slate-600 hover:bg-slate-50"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[220px] items-center justify-center">
            <div className="flex items-center gap-3 text-sm font-black text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin text-teal-600" />
              Cargando stock...
            </div>
          </div>
        ) : filas.length === 0 ? (
          <ImmunizationEmptyState
            icon={<PackageSearch className="h-8 w-8" />}
            title={hayFiltros ? "Ningún lote coincide con los filtros" : "No hay stock para consultar"}
            description={hayFiltros ? "Amplía o limpia los filtros para ver más resultados." : "Aquí aparecerá el stock de los ámbitos que supervisa."}
            action={hayFiltros ? (
              <button type="button" onClick={limpiar} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white">
                Limpiar filtros
              </button>
            ) : undefined}
          />
        ) : (
          <>
            {/* En celular la tabla no cabe: cada fila se muestra como tarjeta. */}
            <div className="divide-y divide-slate-100 md:hidden">
              {filas.map(fila => {
                const clave = detalle ? expirationKeyFor(fila.vencimiento, new Date()) : null;
                return (
                  <article key={fila.clave} className="p-4">
                    <p className="text-xs font-black uppercase tracking-wide text-teal-700">{fila.ubicacion}</p>
                    <p className="mt-1 text-sm font-black text-slate-900">{fila.descripcion}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-slate-400">
                      {fila.codigo}{detalle && fila.lote ? ` · Lote ${fila.lote}` : ""}
                    </p>
                    <div className="mt-3 flex items-end justify-between gap-3">
                      <div>
                        <p className="text-lg font-black text-slate-900">{numero(fila.cantidad)}</p>
                        <p className="text-[10px] font-black uppercase text-slate-400">
                          {detalle ? "frascos/unid." : `${fila.lotes} lote(s)`}
                        </p>
                      </div>
                      <div className="text-right">
                        {clave && <ImmunizationStatusChip label={ETIQUETA_VENCIMIENTO[clave].texto} tone={ETIQUETA_VENCIMIENTO[clave].tono} />}
                        <p className="mt-1 text-xs font-bold text-slate-600">{soles(fila.valor)}</p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[860px] text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-[10px] uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3 text-left font-black">{vista === "REGIONAL" ? "Ámbito" : vista === "UNGET" ? "UNGET" : "Ubicación"}</th>
                    <th className="px-4 py-3 text-left font-black">Código</th>
                    <th className="px-4 py-3 text-left font-black">Producto</th>
                    {detalle && <th className="px-4 py-3 text-left font-black">Lote</th>}
                    {detalle && <th className="px-4 py-3 text-center font-black">Vencimiento</th>}
                    {!detalle && <th className="px-4 py-3 text-center font-black">Lotes</th>}
                    <th className="px-4 py-3 text-right font-black">Saldo</th>
                    <th className="px-4 py-3 text-right font-black">Valorización</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filas.map(fila => {
                    const clave = detalle ? expirationKeyFor(fila.vencimiento, new Date()) : null;
                    return (
                      <tr key={fila.clave} className="transition hover:bg-slate-50/70">
                        <td className="px-4 py-3 font-bold text-slate-700">{fila.ubicacion}</td>
                        <td className="px-4 py-3 font-mono text-xs font-black text-slate-600">{fila.codigo}</td>
                        <td className="max-w-md px-4 py-3 font-black text-slate-900">{fila.descripcion}</td>
                        {detalle && <td className="px-4 py-3 font-mono text-xs text-slate-600">{fila.lote}</td>}
                        {detalle && (
                          <td className="px-4 py-3 text-center">
                            <p className="text-xs font-bold text-slate-600">{fecha(fila.vencimiento)}</p>
                            {clave && <div className="mt-1 flex justify-center"><ImmunizationStatusChip label={ETIQUETA_VENCIMIENTO[clave].texto} tone={ETIQUETA_VENCIMIENTO[clave].tono} /></div>}
                          </td>
                        )}
                        {!detalle && <td className="px-4 py-3 text-center font-bold text-slate-600">{fila.lotes}</td>}
                        <td className="px-4 py-3 text-right font-black text-slate-900">{numero(fila.cantidad)}</td>
                        <td className="px-4 py-3 text-right font-bold text-slate-700">{soles(fila.valor)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
};
