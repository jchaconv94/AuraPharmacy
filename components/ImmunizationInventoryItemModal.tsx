import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, CheckCircle2, PackagePlus, Save, Search, X } from "lucide-react";
import { ImmunizationInitialInventoryItem, ImmunizationProduct } from "../types";

export interface InventoryItemFormData {
  productId: string;
  lote: string;
  expirationDate: string;
  quantity: number;
  unitPrice: number;
  fundingSource: string;
  supplyType: string;
  observation: string;
}

interface ImmunizationInventoryItemModalProps {
  isOpen: boolean;
  products: ImmunizationProduct[];
  editingItem?: ImmunizationInitialInventoryItem | null;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (data: InventoryItemFormData) => void;
}

const emptyForm = {
  productId: "",
  lote: "",
  expirationDate: "",
  quantity: "",
  unitPrice: "",
  fundingSource: "",
  supplyType: "",
  observation: ""
};

const inputClassName = "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition-shadow placeholder:text-slate-400 focus:border-teal-500 focus:ring-4 focus:ring-teal-100 disabled:bg-slate-100 disabled:text-slate-500";

const normalizeSearchText = (value: string) => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .trim();

export const ImmunizationInventoryItemModal: React.FC<ImmunizationInventoryItemModalProps> = ({
  isOpen,
  products,
  editingItem,
  isSaving,
  onClose,
  onSubmit
}) => {
  const firstInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [resultsOpen, setResultsOpen] = useState(false);
  const [activeResultIndex, setActiveResultIndex] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    const nextForm = editingItem ? {
      productId: editingItem.productId,
      lote: editingItem.lote,
      expirationDate: editingItem.expirationDate,
      quantity: String(editingItem.quantity),
      unitPrice: String(editingItem.unitPrice),
      fundingSource: editingItem.fundingSource,
      supplyType: editingItem.supplyType,
      observation: editingItem.observation || ""
    } : emptyForm;
    setForm(nextForm);
    const currentProduct = products.find(product => product.id === editingItem?.productId);
    setProductSearch(currentProduct ? `${currentProduct.codigoSismed} - ${currentProduct.descripcion}` : "");
    setResultsOpen(false);
    setActiveResultIndex(0);
    setError("");
    const timer = window.setTimeout(() => firstInputRef.current?.focus(), 60);
    return () => window.clearTimeout(timer);
  }, [isOpen, editingItem, products]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSaving) onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSaving, onClose]);

  const selectedProduct = useMemo(
    () => products.find(product => product.id === form.productId),
    [products, form.productId]
  );

  const filteredProducts = useMemo(() => {
    const query = normalizeSearchText(productSearch);
    if (!query || form.productId) return [];
    return products
      .filter(product => normalizeSearchText(`${product.codigoSismed} ${product.descripcion}`).includes(query))
      .slice(0, 10);
  }, [products, productSearch, form.productId]);

  if (!isOpen) return null;

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const quantity = Number(form.quantity);
    const unitPrice = Number(form.unitPrice);
    if (!form.productId || !form.lote.trim() || !form.expirationDate || !form.fundingSource.trim() || !form.supplyType.trim()) {
      setError("Complete todos los campos obligatorios.");
      return;
    }
    if (!Number.isFinite(quantity) || quantity < 0 || !Number.isFinite(unitPrice) || unitPrice < 0) {
      setError("El saldo y el precio deben ser numeros iguales o mayores a cero.");
      return;
    }
    setError("");
    onSubmit({
      productId: form.productId,
      lote: form.lote.trim(),
      expirationDate: form.expirationDate,
      quantity,
      unitPrice,
      fundingSource: form.fundingSource.trim(),
      supplyType: form.supplyType.trim(),
      observation: form.observation.trim()
    });
  };

  const updateField = (field: keyof typeof emptyForm, value: string) => {
    setForm(current => ({ ...current, [field]: value }));
    if (error) setError("");
  };

  const selectProduct = (product: ImmunizationProduct) => {
    updateField("productId", product.id || "");
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

  return createPortal(
    <div
      className="fixed inset-0 z-[1190000] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm animate-in fade-in duration-200 sm:p-5"
      onMouseDown={event => {
        if (event.target === event.currentTarget && !isSaving) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="inventory-item-modal-title"
        className="my-auto w-full max-w-3xl overflow-hidden rounded-3xl border border-white/70 bg-white shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-3 duration-200"
      >
        <header className="flex items-start justify-between border-b border-slate-100 bg-gradient-to-r from-teal-50 to-white px-5 py-5 sm:px-7">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-teal-100 p-3 text-teal-700">
              <PackagePlus className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-teal-700">Inventario inicial</p>
              <h2 id="inventory-item-modal-title" className="mt-1 text-xl font-black text-slate-900">
                {editingItem ? "Editar producto/lote" : "Agregar producto/lote"}
              </h2>
              <p className="mt-1 text-xs text-slate-500">Los datos quedaran en borrador hasta cerrar el inventario.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Cerrar formulario"
            className="rounded-xl p-2 text-slate-400 hover:bg-white hover:text-slate-700 disabled:opacity-40"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <form onSubmit={submit}>
          <div className="max-h-[70vh] space-y-5 overflow-y-auto p-5 sm:p-7">
            <div>
              <label htmlFor="manual-product-search" className="mb-1.5 block text-xs font-black text-slate-700">Producto del catalogo <span className="text-red-500">*</span></label>
              {editingItem && selectedProduct ? (
                <div className="flex items-center gap-3 rounded-2xl border border-teal-200 bg-teal-50/70 px-4 py-3">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-teal-600" />
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-black text-teal-700">{selectedProduct.codigoSismed}</p>
                    <p className="truncate text-sm font-bold text-slate-900">{selectedProduct.descripcion}</p>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3.5 top-3.5 z-10 h-5 w-5 text-slate-400" />
                  <input
                    ref={firstInputRef}
                    id="manual-product-search"
                    type="search"
                    role="combobox"
                    aria-expanded={resultsOpen}
                    aria-controls="manual-product-results"
                    aria-autocomplete="list"
                    aria-activedescendant={resultsOpen && filteredProducts[activeResultIndex] ? `manual-product-${filteredProducts[activeResultIndex].id}` : undefined}
                    value={productSearch}
                    onFocus={() => setResultsOpen(true)}
                    onBlur={() => window.setTimeout(() => setResultsOpen(false), 150)}
                    onKeyDown={handleProductSearchKeyDown}
                    onChange={event => {
                      setProductSearch(event.target.value);
                      updateField("productId", "");
                      setResultsOpen(true);
                      setActiveResultIndex(0);
                    }}
                    disabled={isSaving}
                    autoComplete="off"
                    placeholder="Buscar por codigo SISMED o descripcion..."
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-10 text-sm font-semibold text-slate-800 outline-none transition-shadow placeholder:text-slate-400 focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
                  />
                  {form.productId && (
                    <button
                      type="button"
                      onMouseDown={event => event.preventDefault()}
                      onClick={() => {
                        updateField("productId", "");
                        setProductSearch("");
                        setResultsOpen(true);
                        window.setTimeout(() => firstInputRef.current?.focus(), 0);
                      }}
                      aria-label="Cambiar producto"
                      className="absolute right-2.5 top-2.5 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}

                  {resultsOpen && !form.productId && productSearch.trim() && (
                    <div id="manual-product-results" role="listbox" className="absolute z-30 mt-2 max-h-72 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xl">
                      {filteredProducts.length === 0 ? (
                        <div className="px-4 py-6 text-center">
                          <p className="text-sm font-black text-slate-700">Producto no encontrado</p>
                          <p className="mt-1 text-xs text-slate-500">Verifica el codigo SISMED o parte de la descripcion.</p>
                        </div>
                      ) : filteredProducts.map((product, index) => (
                        <button
                          key={product.id || product.codigoSismed}
                          id={`manual-product-${product.id}`}
                          type="button"
                          role="option"
                          aria-selected={index === activeResultIndex}
                          onMouseDown={event => event.preventDefault()}
                          onMouseEnter={() => setActiveResultIndex(index)}
                          onClick={() => selectProduct(product)}
                          className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${index === activeResultIndex ? "bg-teal-50" : "hover:bg-slate-50"}`}
                        >
                          <span className="shrink-0 rounded-lg bg-slate-100 px-2 py-1 font-mono text-xs font-black text-teal-700">{product.codigoSismed}</span>
                          <span className="min-w-0">
                            <span className="block text-sm font-bold text-slate-900">{product.descripcion}</span>
                            <span className="mt-0.5 block text-[10px] font-black uppercase tracking-wide text-slate-400">{product.tipoProducto} · {product.dosisUnidad} dosis/unidad</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {selectedProduct && (
                <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-wide">
                  <span className="rounded-lg bg-cyan-50 px-2 py-1 text-cyan-700">{selectedProduct.tipoProducto}</span>
                  <span className="rounded-lg bg-slate-100 px-2 py-1 text-slate-600">{selectedProduct.dosisUnidad} dosis/unidad</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Lote" required>
                <input value={form.lote} onChange={event => updateField("lote", event.target.value)} disabled={isSaving} className={inputClassName} placeholder="Ej. 0374MA05" />
              </Field>
              <Field label="Fecha de vencimiento" required>
                <div className="relative">
                  <input type="date" value={form.expirationDate} onChange={event => updateField("expirationDate", event.target.value)} disabled={isSaving} className={`${inputClassName} pr-10`} />
                  <CalendarDays className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-slate-400" />
                </div>
              </Field>
              <Field label="Saldo fisico" required>
                <input type="number" min="0" step="1" value={form.quantity} onChange={event => updateField("quantity", event.target.value)} disabled={isSaving} className={inputClassName} placeholder="0" />
              </Field>
              <Field label="Precio unitario (S/)" required>
                <input type="number" min="0" step="0.0001" value={form.unitPrice} onChange={event => updateField("unitPrice", event.target.value)} disabled={isSaving} className={inputClassName} placeholder="0.00" />
              </Field>
              <Field label="Fuente de financiamiento" required>
                <input value={form.fundingSource} onChange={event => updateField("fundingSource", event.target.value)} disabled={isSaving} className={inputClassName} placeholder="Ej. ROR" />
              </Field>
              <Field label="Tipo de suministro" required>
                <input value={form.supplyType} onChange={event => updateField("supplyType", event.target.value)} disabled={isSaving} className={inputClassName} placeholder="Ej. CI" />
              </Field>
            </div>

            <Field label="Observacion">
              <textarea value={form.observation} onChange={event => updateField("observation", event.target.value)} disabled={isSaving} rows={3} className={`${inputClassName} min-h-24 resize-y py-3`} placeholder="Detalle opcional para auditoria..." />
            </Field>

            {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}
          </div>

          <footer className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/80 p-4 sm:flex-row sm:justify-end sm:px-7">
            <button type="button" onClick={onClose} disabled={isSaving} className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-100 disabled:opacity-50">
              Cancelar
            </button>
            <button type="submit" disabled={isSaving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-black text-white shadow-sm hover:bg-teal-700 disabled:opacity-50">
              {isSaving ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Save className="h-4 w-4" />}
              {isSaving ? "Guardando..." : editingItem ? "Guardar cambios" : "Agregar al borrador"}
            </button>
          </footer>
        </form>
      </section>
    </div>,
    document.body
  );
};

const Field: React.FC<{ label: string; required?: boolean; children: React.ReactNode }> = ({ label, required, children }) => (
  <label className="block text-xs font-black text-slate-700">
    <span className="mb-1.5 block">{label} {required && <span className="text-red-500">*</span>}</span>
    {children}
  </label>
);
