import React, { useEffect, useMemo, useState } from "react";
import { Edit, Plus, Search, Save, ShieldCheck, Syringe, ToggleLeft, ToggleRight, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import { immunizationApi } from "../services/immunizationApi";
import { ImmunizationProduct, ImmunizationProductType } from "../types";

const emptyForm: ImmunizationProduct = {
  codigoSismed: "",
  descripcion: "",
  tipoProducto: "VACUNA",
  dosisUnidad: 1,
  isActive: true,
  observacion: ""
};

const typeOptions: { value: ImmunizationProductType; label: string }[] = [
  { value: "VACUNA", label: "Vacuna" },
  { value: "JERINGA", label: "Jeringa" },
  { value: "DILUYENTE", label: "Diluyente" }
];

export const ImmunizationCatalogModule: React.FC = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState<ImmunizationProduct[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | ImmunizationProductType>("ALL");
  const [showInactive, setShowInactive] = useState(true);
  const [form, setForm] = useState<ImmunizationProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const canEdit = user?.role === "ADMIN" || (user?.role || "").toUpperCase().includes("DIRESA");

  const loadProducts = async () => {
    setLoading(true);
    try {
      const data = await immunizationApi.getProducts(true);
      setProducts(data);
    } catch (e) {
      toast.error("Error al cargar catalogo biologico");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const filteredProducts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return products.filter(product => {
      if (!showInactive && !product.isActive) return false;
      if (typeFilter !== "ALL" && product.tipoProducto !== typeFilter) return false;
      if (!query) return true;
      return (
        product.codigoSismed.toLowerCase().includes(query) ||
        product.descripcion.toLowerCase().includes(query) ||
        product.tipoProducto.toLowerCase().includes(query)
      );
    });
  }, [products, searchTerm, showInactive, typeFilter]);

  const stats = useMemo(() => {
    return {
      total: products.length,
      active: products.filter(p => p.isActive).length,
      vaccines: products.filter(p => p.tipoProducto === "VACUNA").length,
      supplies: products.filter(p => p.tipoProducto !== "VACUNA").length
    };
  }, [products]);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form) return;
    setSaving(true);
    const tid = toast.loading("Guardando producto...");
    try {
      const result = await immunizationApi.saveProduct(form, user?.username);
      if (result.success) {
        toast.success("Producto guardado", { id: tid });
        setForm(null);
        await loadProducts();
      } else {
        toast.error(result.message || "No se pudo guardar", { id: tid });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (product: ImmunizationProduct) => {
    if (!product.id) return;
    const result = await immunizationApi.toggleProductStatus(product.id, !product.isActive, user?.username);
    if (result.success) {
      toast.success(product.isActive ? "Producto inactivado" : "Producto activado");
      await loadProducts();
    } else {
      toast.error(result.message || "No se pudo cambiar el estado");
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center py-16">
        <div className="h-9 w-9 rounded-full border-2 border-teal-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div className="bg-white border border-teal-100 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-teal-50 text-teal-700">
              <Syringe className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">Catalogo Biologico</h2>
              <p className="text-sm text-slate-500 max-w-3xl mt-1">
                Maestro unico de vacunas, jeringas y diluyentes. La descripcion oficial usada por inventarios y reportes sale de este catalogo.
              </p>
            </div>
          </div>
          {canEdit && (
            <button
              onClick={() => setForm(emptyForm)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-bold hover:bg-teal-700 shadow-sm transition-colors"
            >
              <Plus className="h-4 w-4" />
              Nuevo producto
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total</div>
            <div className="text-2xl font-black text-slate-900">{stats.total}</div>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
            <div className="text-[10px] font-black uppercase tracking-wider text-emerald-600">Activos</div>
            <div className="text-2xl font-black text-emerald-700">{stats.active}</div>
          </div>
          <div className="rounded-xl border border-cyan-100 bg-cyan-50 p-4">
            <div className="text-[10px] font-black uppercase tracking-wider text-cyan-700">Vacunas</div>
            <div className="text-2xl font-black text-cyan-800">{stats.vaccines}</div>
          </div>
          <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
            <div className="text-[10px] font-black uppercase tracking-wider text-amber-700">Insumos</div>
            <div className="text-2xl font-black text-amber-800">{stats.supplies}</div>
          </div>
        </div>
      </div>

      {form && (
        <form onSubmit={handleSave} className="bg-white border border-teal-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 bg-teal-50/70 border-b border-teal-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-teal-900 uppercase tracking-wide">{form.id ? "Editar producto" : "Nuevo producto"}</h3>
              <p className="text-xs text-teal-700/70 mt-0.5">Use el codigo SISMED como identificador principal.</p>
            </div>
            <button type="button" onClick={() => setForm(null)} className="p-2 rounded-lg hover:bg-white text-slate-500">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="p-5 grid grid-cols-1 md:grid-cols-6 gap-4">
            <label className="md:col-span-1">
              <span className="block text-[10px] font-black text-slate-500 uppercase mb-1">Codigo SISMED</span>
              <input
                required
                value={form.codigoSismed}
                onChange={e => setForm({ ...form, codigoSismed: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-teal-500"
              />
            </label>
            <label className="md:col-span-3">
              <span className="block text-[10px] font-black text-slate-500 uppercase mb-1">Descripcion oficial</span>
              <input
                required
                value={form.descripcion}
                onChange={e => setForm({ ...form, descripcion: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-500"
              />
            </label>
            <label className="md:col-span-1">
              <span className="block text-[10px] font-black text-slate-500 uppercase mb-1">Tipo</span>
              <select
                value={form.tipoProducto}
                onChange={e => setForm({ ...form, tipoProducto: e.target.value as ImmunizationProductType })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-500 bg-white"
              >
                {typeOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="md:col-span-1">
              <span className="block text-[10px] font-black text-slate-500 uppercase mb-1">Dosis/unidad</span>
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={form.dosisUnidad}
                onChange={e => setForm({ ...form, dosisUnidad: Number(e.target.value) })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-500"
              />
            </label>
            <label className="md:col-span-5">
              <span className="block text-[10px] font-black text-slate-500 uppercase mb-1">Observacion</span>
              <input
                value={form.observacion || ""}
                onChange={e => setForm({ ...form, observacion: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-500"
              />
            </label>
            <label className="md:col-span-1 flex items-end gap-2 text-xs font-bold text-slate-600">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={e => setForm({ ...form, isActive: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-teal-600"
              />
              Activo
            </label>
          </div>
          <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
            <button type="button" onClick={() => setForm(null)} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-white">
              Cancelar
            </button>
            <button disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 text-white text-sm font-bold hover:bg-teal-700 disabled:opacity-60">
              <Save className="h-4 w-4" />
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col lg:flex-row gap-3 lg:items-center justify-between">
          <div className="relative flex-1 max-w-2xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar por codigo, descripcion o tipo..."
              className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value as "ALL" | ImmunizationProductType)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold bg-white text-slate-700"
            >
              <option value="ALL">Todos los tipos</option>
              {typeOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <button
              onClick={() => setShowInactive(!showInactive)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-teal-600" />
              {showInactive ? "Ver activos e inactivos" : "Solo activos"}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase">Codigo</th>
                <th className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase">Producto</th>
                <th className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase">Tipo</th>
                <th className="px-4 py-3 text-right text-[10px] font-black text-slate-500 uppercase">Dosis/unidad</th>
                <th className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase">Estado</th>
                <th className="px-4 py-3 text-right text-[10px] font-black text-slate-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-400">No hay productos en el catalogo.</td>
                </tr>
              ) : filteredProducts.map(product => (
                <tr key={product.id || product.codigoSismed} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-mono text-xs font-black text-teal-700 bg-teal-50 border border-teal-100 px-2 py-1 rounded-lg">{product.codigoSismed}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-bold text-slate-900">{product.descripcion}</div>
                    {product.observacion && <div className="text-xs text-slate-400 mt-0.5">{product.observacion}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[10px] font-black uppercase text-slate-700 bg-slate-100 px-2 py-1 rounded-lg">{product.tipoProducto}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-black text-slate-800">{product.dosisUnidad.toLocaleString("es-PE")}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg border ${product.isActive ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-slate-100 text-slate-500 border-slate-200"}`}>
                      {product.isActive ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {canEdit && (
                        <>
                          <button onClick={() => setForm(product)} className="p-2 rounded-lg text-slate-500 hover:text-teal-700 hover:bg-teal-50" title="Editar">
                            <Edit className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleToggleStatus(product)} className="p-2 rounded-lg text-slate-500 hover:text-teal-700 hover:bg-teal-50" title={product.isActive ? "Inactivar" : "Activar"}>
                            {product.isActive ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
