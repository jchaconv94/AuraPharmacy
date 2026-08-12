import React, { useEffect, useMemo, useState } from "react";
import { Boxes, CheckCircle2, Edit, Eye, Package, Plus, Search, Save, ShieldCheck, Syringe, ToggleLeft, ToggleRight, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import { immunizationApi } from "../services/immunizationApi";
import { ImmunizationProduct, ImmunizationProductType, ImmunizationProductTypeItem } from "../types";
import {
  ImmunizationEmptyState,
  ImmunizationField,
  ImmunizationKpiCard,
  ImmunizationPageHeader,
  ImmunizationStatusChip,
  ImmunizationTableHeader,
  formatImmunizationNumber,
  immunizationFilterInputClass,
  immunizationInputClass,
  immunizationSelectClass,
  normalizeImmunizationText
} from "./ui/immunization";

const emptyForm: ImmunizationProduct = {
  codigoSismed: "",
  descripcion: "",
  tipoProducto: "VACUNA",
  dosisUnidad: 1,
  isActive: true,
  observacion: ""
};

export const ImmunizationCatalogModule: React.FC = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState<ImmunizationProduct[]>([]);
  const [productTypes, setProductTypes] = useState<ImmunizationProductTypeItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | ImmunizationProductType>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [form, setForm] = useState<ImmunizationProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const canEdit = user?.role === "ADMIN" || (user?.role || "").toUpperCase().includes("DIRESA");

  const loadData = async (showFullLoading = false) => {
    if (showFullLoading) setLoading(true);
    try {
      const [prods, types] = await Promise.all([
        immunizationApi.getProducts(true),
        immunizationApi.listProductTypes(true)
      ]);
      setProducts(prods);
      setProductTypes(types);
    } catch (e) {
      toast.error("Error al cargar catálogo biológico");
    } finally {
      if (showFullLoading) setLoading(false);
    }
  };

  useEffect(() => {
    void loadData(true);
  }, []);

  const getTypeLabel = (typeVal: string) => {
    if (!typeVal) return "";
    const matched = productTypes.find(
      t => t.code.toUpperCase() === typeVal.toUpperCase() || t.name.toUpperCase() === typeVal.toUpperCase()
    );
    if (matched) return matched.name;
    return typeVal;
  };

  const typeOptions = useMemo(() => {
    const activeTypes = productTypes.filter(t => t.isActive !== false);
    if (activeTypes.length === 0) {
      return [
        { value: "VACUNA", label: "Vacuna" },
        { value: "JERINGA", label: "Jeringa" },
        { value: "DILUYENTE", label: "Diluyente" }
      ];
    }
    return activeTypes.map(t => ({ value: t.code, label: t.name }));
  }, [productTypes]);

  const filteredProducts = useMemo(() => {
    const query = normalizeImmunizationText(searchTerm);
    return products.filter(product => {
      if (statusFilter === "ACTIVE" && !product.isActive) return false;
      if (statusFilter === "INACTIVE" && product.isActive) return false;
      if (typeFilter !== "ALL" && product.tipoProducto !== typeFilter) return false;
      if (!query) return true;
      const typeLabel = getTypeLabel(product.tipoProducto);
      return (
        normalizeImmunizationText(product.codigoSismed).includes(query) ||
        normalizeImmunizationText(product.descripcion).includes(query) ||
        normalizeImmunizationText(product.tipoProducto).includes(query) ||
        normalizeImmunizationText(typeLabel).includes(query)
      );
    });
  }, [products, searchTerm, statusFilter, typeFilter, productTypes]);

  const stats = useMemo(() => {
    return {
      total: products.length,
      active: products.filter(p => p.isActive).length,
      vaccines: products.filter(p => {
        const typeLabel = getTypeLabel(p.tipoProducto).toUpperCase();
        return typeLabel.includes("VACUNA") || p.tipoProducto === "VACUNA";
      }).length,
      supplies: products.filter(p => {
        const typeLabel = getTypeLabel(p.tipoProducto).toUpperCase();
        return !typeLabel.includes("VACUNA") && p.tipoProducto !== "VACUNA";
      }).length
    };
  }, [products, productTypes]);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form) return;

    const codeClean = form.codigoSismed.trim();
    const descClean = form.descripcion.trim();

    if (!codeClean) {
      toast.warning("Ingrese el código SISMED del producto.");
      return;
    }
    if (!descClean) {
      toast.warning("Ingrese la descripción del producto.");
      return;
    }

    // 1. Validar duplicidad de código SISMED
    const codeDup = products.find(
      p => p.id !== form.id && normalizeImmunizationText(p.codigoSismed) === normalizeImmunizationText(codeClean)
    );
    if (codeDup) {
      toast.warning(`El código SISMED "${codeClean}" ya pertenece al producto "${codeDup.descripcion}".`);
      return;
    }

    // 2. Validar duplicidad de descripción
    const descDup = products.find(
      p => p.id !== form.id && normalizeImmunizationText(p.descripcion) === normalizeImmunizationText(descClean)
    );
    if (descDup) {
      toast.warning(`La descripción "${descClean}" ya está registrada con el código SISMED "${descDup.codigoSismed}".`);
      return;
    }

    setSaving(true);
    const tid = toast.loading("Guardando producto...");
    try {
      const isEdit = Boolean(form.id);
      const result = await immunizationApi.saveProduct({ ...form, codigoSismed: codeClean, descripcion: descClean }, user?.username);
      if (result.success) {
        const savedProd = result.product || { ...form, codigoSismed: codeClean, descripcion: descClean };
        setForm(null);
        toast.success(
          isEdit ? "¡Producto actualizado con éxito!" : "¡Producto registrado con éxito!",
          {
            id: tid,
            description: `SISMED: ${savedProd.codigoSismed} · ${savedProd.descripcion}`,
            duration: 3500
          }
        );
        await loadData(false);
      } else {
        toast.error(result.message || "No se pudo guardar el producto", { id: tid });
      }
    } catch (err: any) {
      toast.error(err?.message || "Error inesperado al guardar el producto", { id: tid });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (product: ImmunizationProduct) => {
    if (!product.id) return;
    const result = await immunizationApi.toggleProductStatus(product.id, !product.isActive, user?.username);
    if (result.success) {
      toast.success(product.isActive ? "Producto inactivado" : "Producto activado");
      await loadData(false);
    } else {
      toast.error(result.message || "No se pudo cambiar el estado");
    }
  };

  if (loading && products.length === 0) {
    return (
      <div className="flex h-full items-center justify-center py-16">
        <div className="h-9 w-9 rounded-full border-2 border-teal-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16 animate-in fade-in duration-300">
      <ImmunizationPageHeader
        icon={<Syringe className="h-6 w-6" />}
        title="Catálogo Biológico"
        description="Catálogo maestro de productos biológicos."
        actions={
          canEdit ? (
            <button
              type="button"
              onClick={() => setForm(emptyForm)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-bold hover:bg-teal-700 shadow-sm transition-colors shrink-0"
            >
              <Plus className="h-4 w-4" />
              Nuevo producto
            </button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <ImmunizationKpiCard label="Total" value={stats.total} tone="neutral" icon={<Package className="h-5 w-5" />} />
        <ImmunizationKpiCard label="Activos" value={stats.active} tone="success" icon={<CheckCircle2 className="h-5 w-5" />} />
        <ImmunizationKpiCard label="Vacunas" value={stats.vaccines} tone="info" icon={<Syringe className="h-5 w-5" />} />
        <ImmunizationKpiCard label="Insumos" value={stats.supplies} tone="warning" icon={<Boxes className="h-5 w-5" />} />
      </div>

      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm overflow-y-auto">
          <form
            onSubmit={handleSave}
            className="w-full max-w-3xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200 my-auto"
          >
            <div className="px-6 py-4 bg-teal-50/80 border-b border-teal-100 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-base font-black text-teal-950 uppercase tracking-wide">
                  {form.id ? "Editar producto" : "Nuevo producto"}
                </h3>
                <p className="text-xs text-teal-800/80 mt-0.5">Use el código SISMED como identificador principal.</p>
              </div>
              <button
                type="button"
                onClick={() => setForm(null)}
                className="p-2 rounded-xl hover:bg-teal-100/60 text-slate-500 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-6 gap-4">
              <div className="md:col-span-2">
                <ImmunizationField label="Código SISMED" required>
                  <input
                    required
                    value={form.codigoSismed}
                    onChange={e => setForm({ ...form, codigoSismed: e.target.value })}
                    className={immunizationInputClass}
                    placeholder="00000"
                    autoFocus
                  />
                </ImmunizationField>
              </div>
              <div className="md:col-span-4">
                <ImmunizationField label="Descripción del producto" required>
                  <input
                    required
                    value={form.descripcion}
                    onChange={e => setForm({ ...form, descripcion: e.target.value })}
                    className={immunizationInputClass}
                    placeholder="Nombre de vacuna o biológico..."
                  />
                </ImmunizationField>
              </div>
              <div className="md:col-span-2">
                <ImmunizationField label="Tipo">
                  <select
                    value={form.tipoProducto}
                    onChange={e => setForm({ ...form, tipoProducto: e.target.value as ImmunizationProductType })}
                    className={immunizationSelectClass}
                  >
                    {typeOptions.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </ImmunizationField>
              </div>
              <div className="md:col-span-2">
                <ImmunizationField label="Dosis/Unidad" required>
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.dosisUnidad}
                    onChange={e => setForm({ ...form, dosisUnidad: Number(e.target.value) })}
                    className={immunizationInputClass}
                  />
                </ImmunizationField>
              </div>
              <div className="md:col-span-2 flex items-center pt-6">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={e => setForm({ ...form, isActive: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                  Producto Activo
                </label>
              </div>
              <div className="md:col-span-6">
                <ImmunizationField label="Observación">
                  <input
                    value={form.observacion || ""}
                    onChange={e => setForm({ ...form, observacion: e.target.value })}
                    className={immunizationInputClass}
                    placeholder="Detalle u observación opcional..."
                  />
                </ImmunizationField>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setForm(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-white transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-bold hover:bg-teal-700 transition-colors disabled:opacity-60 shadow-sm"
              >
                <Save className="h-4 w-4" />
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className={`bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden mb-6 ${loading ? "opacity-60 pointer-events-none transition-opacity duration-200" : "transition-opacity duration-200"}`}>
        <div className="p-4 border-b border-slate-100 flex flex-col lg:flex-row gap-3 lg:items-center justify-between">
          <div className="relative flex-1 max-w-2xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar por código, descripción o tipo..."
              className={`${immunizationFilterInputClass} pl-9`}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value as "ALL" | ImmunizationProductType)}
              className="h-10 rounded-xl border border-slate-200 px-3 text-xs font-bold bg-white text-slate-700 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            >
              <option value="ALL">Todos los tipos</option>
              {typeOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>

            {/* Selector Segmentado de Estado */}
            <div className="inline-flex items-center rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-bold shrink-0">
              <button
                type="button"
                onClick={() => setStatusFilter("ACTIVE")}
                className={`h-8 px-3 rounded-lg transition-all flex items-center gap-1.5 ${
                  statusFilter === "ACTIVE"
                    ? "bg-white text-emerald-800 shadow-xs font-black border border-slate-200/60"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <CheckCircle2 className={`h-3.5 w-3.5 ${statusFilter === "ACTIVE" ? "text-emerald-600" : "text-slate-400"}`} />
                Activos
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("INACTIVE")}
                className={`h-8 px-3 rounded-lg transition-all flex items-center gap-1.5 ${
                  statusFilter === "INACTIVE"
                    ? "bg-white text-amber-800 shadow-xs font-black border border-slate-200/60"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <X className={`h-3.5 w-3.5 ${statusFilter === "INACTIVE" ? "text-amber-600" : "text-slate-400"}`} />
                Inactivos
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("ALL")}
                className={`h-8 px-3 rounded-lg transition-all flex items-center gap-1.5 ${
                  statusFilter === "ALL"
                    ? "bg-white text-slate-900 shadow-xs font-black border border-slate-200/60"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <Eye className={`h-3.5 w-3.5 ${statusFilter === "ALL" ? "text-teal-600" : "text-slate-400"}`} />
                Todos
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50">
              <tr>
                <ImmunizationTableHeader>Código</ImmunizationTableHeader>
                <ImmunizationTableHeader>Producto</ImmunizationTableHeader>
                <ImmunizationTableHeader>Tipo</ImmunizationTableHeader>
                <ImmunizationTableHeader align="right">Dosis/Unidad</ImmunizationTableHeader>
                <ImmunizationTableHeader>Estado</ImmunizationTableHeader>
                <ImmunizationTableHeader align="right">Acciones</ImmunizationTableHeader>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8">
                    <ImmunizationEmptyState
                      title="No hay productos en el catálogo"
                      description="Ajusta la búsqueda o agrega un nuevo producto biológico."
                      icon={<Syringe className="h-6 w-6 text-slate-400" />}
                    />
                  </td>
                </tr>
              ) : (
                filteredProducts.map(product => (
                  <tr key={product.id || product.codigoSismed} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="font-mono text-xs font-black text-teal-700 bg-teal-50 border border-teal-100 px-2.5 py-1 rounded-lg">
                        {product.codigoSismed}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="text-sm font-bold text-slate-900">{product.descripcion}</div>
                      {product.observacion && <div className="text-xs text-slate-400 mt-0.5">{product.observacion}</div>}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="text-[10px] font-black uppercase text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
                        {getTypeLabel(product.tipoProducto)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap text-sm font-black text-slate-800">
                      {formatImmunizationNumber(product.dosisUnidad, 0)}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <ImmunizationStatusChip
                        label={product.isActive ? "Activo" : "Inactivo"}
                        tone={product.isActive ? "success" : "neutral"}
                      />
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-right">
                      <div className="flex justify-end items-center gap-1.5">
                        {canEdit && (
                          <>
                            <button
                              type="button"
                              onClick={() => setForm(product)}
                              className="p-2 rounded-xl bg-slate-100 hover:bg-teal-50 text-slate-600 hover:text-teal-800 border border-slate-200/80 hover:border-teal-300 transition-all shadow-2xs hover:shadow-xs"
                              title="Editar producto"
                            >
                              <Edit className="h-4 w-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleStatus(product)}
                              className="p-2 rounded-xl bg-slate-100 hover:bg-teal-50 text-slate-600 hover:text-teal-800 border border-slate-200/80 hover:border-teal-300 transition-all shadow-2xs hover:shadow-xs"
                              title={product.isActive ? "Desactivar producto" : "Activar producto"}
                            >
                              {product.isActive ? (
                                <ToggleRight className="h-5 w-5 text-emerald-600" />
                              ) : (
                                <ToggleLeft className="h-5 w-5 text-slate-400" />
                              )}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

