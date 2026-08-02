import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  ArrowRight,
  ArrowRightLeft,
  Boxes,
  CalendarDays,
  CheckCircle2,
  ClipboardPlus,
  PackagePlus,
  Plus,
  Save,
  Search,
  Trash2,
  X
} from "lucide-react";
import { ImmunizationAdjustmentItem, ImmunizationProduct, ImmunizationStockLayer } from "../types";
import { immunizationInputClass as inputClassName } from "./ui/immunization";
import { ConfirmationDialog } from "./ui/ConfirmationDialog";

interface ImmunizationAdjustmentModalProps {
  isOpen: boolean;
  layers: ImmunizationStockLayer[];
  products: ImmunizationProduct[];
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (items: ImmunizationAdjustmentItem[], reason: string, observation: string) => void;
}

type EntryMode = "QUANTITY" | "RECLASSIFY" | "NEW";

const adjustmentReasons = [
  "Descuadre de datos del lote/capa",
  "Sobrante físico",
  "Faltante físico",
  "Lote no registrado encontrado",
  "Lote registrado no encontrado",
  "Vencimiento distinto",
  "Corrección por error de digitación",
  "Merma o deterioro",
  "Otro"
];

const emptyNewLot = {
  productId: "",
  lote: "",
  expirationDate: "",
  physicalQuantity: "",
  unitPrice: "",
  fundingSource: "",
  supplyType: ""
};

const emptyReclassification = {
  targetProductId: "",
  targetProductSearch: "",
  lote: "",
  expirationDate: "",
  unitPrice: "",
  fundingSource: "",
  supplyType: "",
  originalPhysicalQuantity: "0",
  correctedPhysicalQuantity: ""
};


const normalizeSearchText = (value: string) => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .trim();

const normalizeLayerValue = (value: string) => value.trim().toUpperCase();
const formatQuantity = (value: number) => value.toLocaleString("es-PE", { maximumFractionDigits: 2 });
const formatMoney = (value: number) => `S/ ${value.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;

const createReclassificationKey = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `00000000-0000-4000-8000-${Date.now().toString().padStart(12, "0").slice(-12)}`;
};

export function ImmunizationAdjustmentModal({
  isOpen,
  layers,
  products,
  isSaving,
  onClose,
  onSubmit
}: ImmunizationAdjustmentModalProps) {
  const firstInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<EntryMode>("QUANTITY");
  const [layerSearch, setLayerSearch] = useState("");
  const [selectedLayerId, setSelectedLayerId] = useState("");
  const [existingPhysical, setExistingPhysical] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [newLot, setNewLot] = useState(emptyNewLot);
  const [reclassification, setReclassification] = useState(emptyReclassification);
  const [items, setItems] = useState<ImmunizationAdjustmentItem[]>([]);
  const [reason, setReason] = useState("");
  const [observation, setObservation] = useState("");
  const [error, setError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setMode("QUANTITY");
    setLayerSearch("");
    setSelectedLayerId("");
    setExistingPhysical("");
    setProductSearch("");
    setNewLot(emptyNewLot);
    setReclassification(emptyReclassification);
    setItems([]);
    setReason("");
    setObservation("");
    setError("");
    setConfirmOpen(false);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => firstInputRef.current?.focus(), 80);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSaving && !confirmOpen) onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [confirmOpen, isOpen, isSaving, onClose]);

  const selectedLayer = useMemo(
    () => layers.find(layer => layer.id === selectedLayerId),
    [layers, selectedLayerId]
  );

  const usedLayerIds = useMemo(
    () => new Set(items.flatMap(item => item.stockLayerId ? [item.stockLayerId] : [])),
    [items]
  );

  const visibleLayers = useMemo(() => {
    const query = normalizeSearchText(layerSearch);
    const available = layers.filter(layer => !usedLayerIds.has(layer.id) && layer.currentQuantity > 0);
    if (!query) return available.slice(0, 12);
    return available.filter(layer => normalizeSearchText(
      `${layer.product?.codigoSismed || ""} ${layer.product?.descripcion || ""} ${layer.lote}`
    ).includes(query)).slice(0, 20);
  }, [layerSearch, layers, usedLayerIds]);

  const selectedProduct = useMemo(
    () => products.find(product => product.id === newLot.productId),
    [newLot.productId, products]
  );

  const selectedTargetProduct = useMemo(
    () => products.find(product => product.id === reclassification.targetProductId) ||
      (selectedLayer?.productId === reclassification.targetProductId ? selectedLayer.product : undefined),
    [products, reclassification.targetProductId, selectedLayer]
  );

  const visibleProducts = useMemo(() => {
    const query = normalizeSearchText(productSearch);
    if (!query || newLot.productId) return [];
    return products
      .filter(product => product.isActive && normalizeSearchText(`${product.codigoSismed} ${product.descripcion}`).includes(query))
      .slice(0, 10);
  }, [newLot.productId, productSearch, products]);

  const visibleTargetProducts = useMemo(() => {
    const query = normalizeSearchText(reclassification.targetProductSearch);
    if (!query || reclassification.targetProductId) return [];
    return products
      .filter(product => product.isActive && normalizeSearchText(`${product.codigoSismed} ${product.descripcion}`).includes(query))
      .slice(0, 10);
  }, [products, reclassification.targetProductId, reclassification.targetProductSearch]);

  const targetLayer = useMemo(() => {
    if (!reclassification.targetProductId || !reclassification.lote || !reclassification.expirationDate) return undefined;
    const price = Number(reclassification.unitPrice);
    return layers.find(layer =>
      layer.id !== selectedLayerId &&
      layer.productId === reclassification.targetProductId &&
      normalizeLayerValue(layer.lote) === normalizeLayerValue(reclassification.lote) &&
      layer.expirationDate === reclassification.expirationDate &&
      layer.unitPrice === price &&
      normalizeLayerValue(layer.fundingSource) === normalizeLayerValue(reclassification.fundingSource) &&
      normalizeLayerValue(layer.supplyType) === normalizeLayerValue(reclassification.supplyType)
    );
  }, [layers, reclassification, selectedLayerId]);

  const reclassificationCount = new Set(items.filter(item => item.reclassificationKey).map(item => item.reclassificationKey)).size;
  const quantityCount = items.filter(item => item.operationType === "QUANTITY").length;
  const newLayerCount = items.filter(item => item.operationType === "NEW_LAYER").length;
  const stagedOperationCount = quantityCount + newLayerCount + reclassificationCount;

  if (!isOpen) return null;

  const clearError = () => {
    if (error) setError("");
  };

  const resetLayerSelection = () => {
    setLayerSearch("");
    setSelectedLayerId("");
    setExistingPhysical("");
    setReclassification(emptyReclassification);
  };

  const changeMode = (nextMode: EntryMode) => {
    setMode(nextMode);
    resetLayerSelection();
    setProductSearch("");
    setNewLot(emptyNewLot);
    setError("");
    window.setTimeout(() => firstInputRef.current?.focus(), 0);
  };

  const selectLayer = (layer: ImmunizationStockLayer) => {
    setSelectedLayerId(layer.id);
    setLayerSearch(`${layer.product?.codigoSismed || ""} - ${layer.product?.descripcion || "Producto"} · Lote ${layer.lote}`);
    if (mode === "QUANTITY") {
      setExistingPhysical(String(layer.currentQuantity));
    } else {
      setReclassification({
        targetProductId: layer.productId,
        targetProductSearch: `${layer.product?.codigoSismed || ""} - ${layer.product?.descripcion || "Producto"}`,
        lote: layer.lote,
        expirationDate: layer.expirationDate,
        unitPrice: String(layer.unitPrice),
        fundingSource: layer.fundingSource,
        supplyType: layer.supplyType,
        originalPhysicalQuantity: "0",
        correctedPhysicalQuantity: String(layer.currentQuantity)
      });
    }
    clearError();
  };

  const addExistingLayer = () => {
    const physicalQuantity = Number(existingPhysical);
    if (!selectedLayer || !Number.isFinite(physicalQuantity) || physicalQuantity < 0) {
      setError("Seleccione un lote e ingrese un stock físico válido.");
      return;
    }
    const differenceQuantity = physicalQuantity - selectedLayer.currentQuantity;
    if (differenceQuantity === 0) {
      setError("El stock físico coincide con el sistema; este lote no requiere reajuste.");
      return;
    }
    setItems(current => [...current, {
      productId: selectedLayer.productId,
      stockLayerId: selectedLayer.id,
      lote: selectedLayer.lote,
      expirationDate: selectedLayer.expirationDate,
      systemQuantity: selectedLayer.currentQuantity,
      physicalQuantity,
      differenceQuantity,
      unitPrice: selectedLayer.unitPrice,
      fundingSource: selectedLayer.fundingSource,
      supplyType: selectedLayer.supplyType,
      operationType: "QUANTITY",
      product: selectedLayer.product
    }]);
    resetLayerSelection();
    setError("");
  };

  const addReclassification = () => {
    if (!selectedLayer || !reclassification.targetProductId || !reclassification.lote.trim() || !reclassification.expirationDate || !reclassification.fundingSource.trim() || !reclassification.supplyType.trim()) {
      setError("Seleccione el registro del sistema y complete todos los datos encontrados físicamente.");
      return;
    }
    const originalPhysical = Number(reclassification.originalPhysicalQuantity);
    const correctedPhysical = Number(reclassification.correctedPhysicalQuantity);
    const unitPrice = Number(reclassification.unitPrice);
    if (!Number.isFinite(originalPhysical) || originalPhysical < 0 || originalPhysical >= selectedLayer.currentQuantity) {
      setError(`La cantidad que conserva los datos originales debe ser menor a ${formatQuantity(selectedLayer.currentQuantity)}.`);
      return;
    }
    if (!Number.isFinite(correctedPhysical) || correctedPhysical <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) {
      setError("La cantidad con datos corregidos debe ser mayor a cero y el precio no puede ser negativo.");
      return;
    }

    const dataChanged = selectedLayer.productId !== reclassification.targetProductId ||
      normalizeLayerValue(selectedLayer.lote) !== normalizeLayerValue(reclassification.lote) ||
      selectedLayer.expirationDate !== reclassification.expirationDate ||
      selectedLayer.unitPrice !== unitPrice ||
      normalizeLayerValue(selectedLayer.fundingSource) !== normalizeLayerValue(reclassification.fundingSource) ||
      normalizeLayerValue(selectedLayer.supplyType) !== normalizeLayerValue(reclassification.supplyType);
    if (!dataChanged) {
      setError("No cambió ningún dato de identificación. Si solo difiere la cantidad, use «Ajustar cantidad».");
      return;
    }
    if (targetLayer && usedLayerIds.has(targetLayer.id)) {
      setError("La capa física de destino ya participa en este reajuste. Aplique primero el cambio pendiente o elija otra capa.");
      return;
    }
    const duplicateNewTarget = items.some(item =>
      item.operationType === "RECLASSIFY_TARGET" &&
      item.productId === reclassification.targetProductId &&
      normalizeLayerValue(item.lote) === normalizeLayerValue(reclassification.lote) &&
      item.expirationDate === reclassification.expirationDate &&
      item.unitPrice === unitPrice &&
      normalizeLayerValue(item.fundingSource) === normalizeLayerValue(reclassification.fundingSource) &&
      normalizeLayerValue(item.supplyType) === normalizeLayerValue(reclassification.supplyType)
    );
    if (duplicateNewTarget) {
      setError("Ese destino físico ya está incluido en el reajuste actual.");
      return;
    }

    const reclassificationKey = createReclassificationKey();
    const targetBefore = targetLayer?.currentQuantity || 0;
    setItems(current => [...current,
      {
        productId: selectedLayer.productId,
        stockLayerId: selectedLayer.id,
        lote: selectedLayer.lote,
        expirationDate: selectedLayer.expirationDate,
        systemQuantity: selectedLayer.currentQuantity,
        physicalQuantity: originalPhysical,
        differenceQuantity: originalPhysical - selectedLayer.currentQuantity,
        unitPrice: selectedLayer.unitPrice,
        fundingSource: selectedLayer.fundingSource,
        supplyType: selectedLayer.supplyType,
        operationType: "RECLASSIFY_SOURCE",
        reclassificationKey,
        product: selectedLayer.product
      },
      {
        productId: reclassification.targetProductId,
        stockLayerId: targetLayer?.id,
        lote: reclassification.lote.trim(),
        expirationDate: reclassification.expirationDate,
        systemQuantity: targetBefore,
        physicalQuantity: targetBefore + correctedPhysical,
        differenceQuantity: correctedPhysical,
        unitPrice,
        fundingSource: reclassification.fundingSource.trim(),
        supplyType: reclassification.supplyType.trim(),
        operationType: "RECLASSIFY_TARGET",
        reclassificationKey,
        product: selectedTargetProduct
      }
    ]);
    if (!reason) setReason("Descuadre de datos del lote/capa");
    resetLayerSelection();
    setError("");
  };

  const addNewLayer = () => {
    const physicalQuantity = Number(newLot.physicalQuantity);
    const unitPrice = Number(newLot.unitPrice);
    if (!newLot.productId || !newLot.lote.trim() || !newLot.expirationDate || !newLot.fundingSource.trim() || !newLot.supplyType.trim()) {
      setError("Complete todos los datos obligatorios del lote físico.");
      return;
    }
    if (!Number.isFinite(physicalQuantity) || physicalQuantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) {
      setError("El stock físico debe ser mayor a cero y el precio no puede ser negativo.");
      return;
    }
    const duplicate = [...layers, ...items].some(layer =>
      layer.productId === newLot.productId &&
      normalizeLayerValue(layer.lote) === normalizeLayerValue(newLot.lote) &&
      layer.expirationDate === newLot.expirationDate &&
      layer.unitPrice === unitPrice &&
      normalizeLayerValue(layer.fundingSource) === normalizeLayerValue(newLot.fundingSource) &&
      normalizeLayerValue(layer.supplyType) === normalizeLayerValue(newLot.supplyType)
    );
    if (duplicate) {
      setError("Ese lote/capa ya existe. Use «Ajustar cantidad» o «Corregir datos».");
      return;
    }
    setItems(current => [...current, {
      productId: newLot.productId,
      lote: newLot.lote.trim(),
      expirationDate: newLot.expirationDate,
      systemQuantity: 0,
      physicalQuantity,
      differenceQuantity: physicalQuantity,
      unitPrice,
      fundingSource: newLot.fundingSource.trim(),
      supplyType: newLot.supplyType.trim(),
      operationType: "NEW_LAYER",
      product: selectedProduct
    }]);
    setNewLot(emptyNewLot);
    setProductSearch("");
    setError("");
  };

  const removeOperation = (item: ImmunizationAdjustmentItem) => {
    setItems(current => item.reclassificationKey
      ? current.filter(currentItem => currentItem.reclassificationKey !== item.reclassificationKey)
      : current.filter(currentItem => currentItem !== item));
  };

  const requestConfirmation = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (items.length === 0) {
      setError("Agregue al menos una diferencia o corrección de datos.");
      return;
    }
    if (!reason || !observation.trim()) {
      setError("Seleccione el motivo y escriba la observación que sustenta el reajuste.");
      return;
    }
    setError("");
    setConfirmOpen(true);
  };

  const originalPhysical = Number(reclassification.originalPhysicalQuantity) || 0;
  const correctedPhysical = Number(reclassification.correctedPhysicalQuantity) || 0;
  const reclassificationPhysicalTotal = originalPhysical + correctedPhysical;
  const reclassificationNetDifference = selectedLayer ? reclassificationPhysicalTotal - selectedLayer.currentQuantity : 0;

  return createPortal(
    <>
      <div className="fixed inset-0 z-[1190000] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-2 backdrop-blur-sm animate-in fade-in duration-200 sm:p-5" onMouseDown={event => { if (event.target === event.currentTarget && !isSaving) onClose(); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="adjustment-modal-title" className="my-auto flex max-h-[96vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-white/70 bg-white shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-3 duration-200">
          <header className="flex shrink-0 items-start justify-between border-b border-slate-100 bg-gradient-to-r from-amber-50 via-white to-teal-50 px-4 py-4 sm:px-7 sm:py-5">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-amber-100 p-3 text-amber-700"><ClipboardPlus className="h-6 w-6" /></div>
              <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">Verificación física auditada</p><h2 id="adjustment-modal-title" className="mt-1 text-xl font-black text-slate-900">Nuevo reajuste de stock</h2><p className="mt-1 text-xs text-slate-500">Corrige cantidades o datos de identificación sin perder la trazabilidad del registro anterior.</p></div>
            </div>
            <button type="button" onClick={onClose} disabled={isSaving} aria-label="Cerrar formulario" className="rounded-xl p-2 text-slate-400 hover:bg-white hover:text-slate-700 disabled:opacity-40"><X className="h-5 w-5" /></button>
          </header>

          <form onSubmit={requestConfirmation} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-7">
              <div className="grid grid-cols-1 gap-2 rounded-2xl bg-slate-100 p-1.5 md:grid-cols-3">
                <ModeButton active={mode === "QUANTITY"} icon={<Boxes className="h-5 w-5" />} label="Ajustar cantidad" description="El lote coincide; cambia el saldo" onClick={() => changeMode("QUANTITY")} />
                <ModeButton active={mode === "RECLASSIFY"} icon={<ArrowRightLeft className="h-5 w-5" />} label="Corregir datos" description="Lote, vencimiento u otro dato difiere" onClick={() => changeMode("RECLASSIFY")} />
                <ModeButton active={mode === "NEW"} icon={<PackagePlus className="h-5 w-5" />} label="Agregar lote no registrado" description="No existe ningún registro equivalente" onClick={() => changeMode("NEW")} />
              </div>

              {mode !== "NEW" && (
                <LayerPicker inputRef={firstInputRef} query={layerSearch} selectedLayer={selectedLayer} layers={visibleLayers} onQueryChange={value => { setLayerSearch(value); setSelectedLayerId(""); setExistingPhysical(""); setReclassification(emptyReclassification); clearError(); }} onSelect={selectLayer} />
              )}

              {mode === "QUANTITY" && selectedLayer && (
                <div className="grid gap-4 rounded-2xl border border-teal-200 bg-teal-50/60 p-4 md:grid-cols-[1fr_220px_auto] md:items-end">
                  <LayerSummary layer={selectedLayer} title="Registro seleccionado" />
                  <Field label="Stock físico contado" required><input type="number" min="0" step="1" value={existingPhysical} onChange={event => { setExistingPhysical(event.target.value); clearError(); }} className={inputClassName} placeholder="0" /></Field>
                  <div className="flex items-center gap-3 md:block"><DifferenceBadge value={(Number(existingPhysical) || 0) - selectedLayer.currentQuantity} /><button type="button" onClick={addExistingLayer} className="ml-auto inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 text-sm font-black text-white hover:bg-teal-700 md:ml-0 md:mt-2"><Plus className="h-4 w-4" />Agregar conteo</button></div>
                </div>
              )}

              {mode === "RECLASSIFY" && selectedLayer && (
                <div className="space-y-4 rounded-2xl border border-violet-200 bg-violet-50/30 p-4 sm:p-5">
                  <div className="grid items-stretch gap-3 lg:grid-cols-[0.8fr_auto_1.2fr]">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="mb-3 text-[10px] font-black uppercase tracking-wider text-slate-400">Registrado en el sistema</p><LayerSummary layer={selectedLayer} title="" showAllData /></div>
                    <div className="hidden items-center justify-center text-violet-500 lg:flex"><ArrowRight className="h-6 w-6" /></div>
                    <div className="rounded-2xl border-2 border-violet-200 bg-white p-4">
                      <p className="mb-3 text-[10px] font-black uppercase tracking-wider text-violet-700">Encontrado físicamente</p>
                      <div className="space-y-4">
                        <div className="relative">
                          <Field label="Producto del catálogo" required><div className="relative"><Search className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" /><input value={reclassification.targetProductSearch} onChange={event => { setReclassification(current => ({ ...current, targetProductSearch: event.target.value, targetProductId: "" })); clearError(); }} className={`${inputClassName} pl-10`} placeholder="Código SISMED o descripción..." /></div></Field>
                          {visibleTargetProducts.length > 0 && <ProductResults products={visibleTargetProducts} onSelect={product => setReclassification(current => ({ ...current, targetProductId: product.id || "", targetProductSearch: `${product.codigoSismed} - ${product.descripcion}` }))} />}
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          <Field label="Lote" required><input value={reclassification.lote} onChange={event => { setReclassification(current => ({ ...current, lote: event.target.value })); clearError(); }} className={inputClassName} /></Field>
                          <Field label="Vencimiento" required><input type="date" value={reclassification.expirationDate} onChange={event => { setReclassification(current => ({ ...current, expirationDate: event.target.value })); clearError(); }} className={inputClassName} /></Field>
                          <Field label="Precio unitario" required><input type="number" min="0" step="0.0001" value={reclassification.unitPrice} onChange={event => { setReclassification(current => ({ ...current, unitPrice: event.target.value })); clearError(); }} className={inputClassName} /></Field>
                          <Field label="Fuente" required><input value={reclassification.fundingSource} onChange={event => { setReclassification(current => ({ ...current, fundingSource: event.target.value })); clearError(); }} className={inputClassName} /></Field>
                          <Field label="Tipo suministro" required><input value={reclassification.supplyType} onChange={event => { setReclassification(current => ({ ...current, supplyType: event.target.value })); clearError(); }} className={inputClassName} /></Field>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end">
                    <Field label="Cantidad que conserva los datos originales" required><input type="number" min="0" step="1" value={reclassification.originalPhysicalQuantity} onChange={event => { setReclassification(current => ({ ...current, originalPhysicalQuantity: event.target.value })); clearError(); }} className={inputClassName} /></Field>
                    <Field label="Cantidad con los datos físicos corregidos" required><input type="number" min="0" step="1" value={reclassification.correctedPhysicalQuantity} onChange={event => { setReclassification(current => ({ ...current, correctedPhysicalQuantity: event.target.value })); clearError(); }} className={inputClassName} /></Field>
                    <div className="rounded-xl bg-slate-50 px-3 py-2.5"><p className="text-[9px] font-black uppercase text-slate-400">Total físico / diferencia</p><div className="mt-1 flex items-center gap-2"><strong className="font-mono text-sm text-slate-900">{formatQuantity(reclassificationPhysicalTotal)}</strong><DifferenceBadge value={reclassificationNetDifference} /></div></div>
                    <button type="button" onClick={addReclassification} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-black text-white hover:bg-violet-700"><ArrowRightLeft className="h-4 w-4" />Agregar corrección</button>
                  </div>
                  {targetLayer && <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs font-bold text-blue-700">La combinación física ya existe como otra capa. El sistema acumulará allí {formatQuantity(correctedPhysical)} unidades y conservará ambos registros auditados.</div>}
                </div>
              )}

              {mode === "NEW" && (
                <div className="space-y-4 rounded-2xl border border-slate-200 p-4 sm:p-5">
                  <div className="relative">
                    <Field label="Producto del catálogo" required><div className="relative"><Search className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" /><input ref={firstInputRef} value={productSearch} onChange={event => { setProductSearch(event.target.value); setNewLot(current => ({ ...current, productId: "" })); clearError(); }} className={`${inputClassName} pl-10`} placeholder="Buscar por código SISMED o descripción..." /></div></Field>
                    {visibleProducts.length > 0 && <ProductResults products={visibleProducts} onSelect={product => { setNewLot(current => ({ ...current, productId: product.id || "" })); setProductSearch(`${product.codigoSismed} - ${product.descripcion}`); }} />}
                    {selectedProduct && <p className="mt-2 text-xs font-bold text-teal-700"><CheckCircle2 className="mr-1 inline h-4 w-4" />{selectedProduct.tipoProducto} · {selectedProduct.dosisUnidad} dosis/unidad</p>}
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Field label="Lote" required><input value={newLot.lote} onChange={event => { setNewLot(current => ({ ...current, lote: event.target.value })); clearError(); }} className={inputClassName} placeholder="Ej. 0374MA05" /></Field>
                    <Field label="Fecha de vencimiento" required><div className="relative"><input type="date" value={newLot.expirationDate} onChange={event => { setNewLot(current => ({ ...current, expirationDate: event.target.value })); clearError(); }} className={`${inputClassName} pr-9`} /><CalendarDays className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-slate-400" /></div></Field>
                    <Field label="Stock físico" required><input type="number" min="0" step="1" value={newLot.physicalQuantity} onChange={event => { setNewLot(current => ({ ...current, physicalQuantity: event.target.value })); clearError(); }} className={inputClassName} placeholder="0" /></Field>
                    <Field label="Precio unitario (S/)" required><input type="number" min="0" step="0.0001" value={newLot.unitPrice} onChange={event => { setNewLot(current => ({ ...current, unitPrice: event.target.value })); clearError(); }} className={inputClassName} placeholder="0.00" /></Field>
                    <Field label="Fuente de financiamiento" required><input value={newLot.fundingSource} onChange={event => { setNewLot(current => ({ ...current, fundingSource: event.target.value })); clearError(); }} className={inputClassName} placeholder="Ej. ROR" /></Field>
                    <Field label="Tipo de suministro" required><input value={newLot.supplyType} onChange={event => { setNewLot(current => ({ ...current, supplyType: event.target.value })); clearError(); }} className={inputClassName} placeholder="Ej. CI" /></Field>
                    <div className="sm:col-span-2 lg:self-end"><button type="button" onClick={addNewLayer} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 text-sm font-black text-white hover:bg-teal-700"><Plus className="h-4 w-4" />Agregar lote físico</button></div>
                  </div>
                </div>
              )}

              <section aria-labelledby="adjustment-items-title" className="overflow-hidden rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3"><h3 id="adjustment-items-title" className="text-xs font-black uppercase tracking-wide text-slate-700">Cambios que se aplicarán</h3><span className="rounded-lg bg-white px-2.5 py-1 text-xs font-black text-slate-600 shadow-sm">{stagedOperationCount}</span></div>
                {items.length === 0 ? <div className="px-4 py-8 text-center"><AlertTriangle className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-2 text-sm font-bold text-slate-500">Aún no agregó diferencias al reajuste.</p></div> : <DraftItems items={items} onRemove={removeOperation} />}
              </section>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <Field label="Motivo del reajuste" required><select value={reason} onChange={event => { setReason(event.target.value); clearError(); }} className={inputClassName}><option value="">Seleccione un motivo...</option>{adjustmentReasons.map(option => <option key={option} value={option}>{option}</option>)}</select></Field>
                <div className="lg:col-span-2"><Field label="Observación / sustento" required><textarea value={observation} onChange={event => { setObservation(event.target.value); clearError(); }} rows={3} className={`${inputClassName} min-h-24 resize-y py-3`} placeholder="Describe el conteo físico, documento o circunstancia que sustenta el cambio..." /></Field></div>
              </div>
              {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}
            </div>

            <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/90 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
              <p className="text-xs text-slate-500"><strong className="text-slate-700">{quantityCount}</strong> conteos · <strong className="text-violet-700">{reclassificationCount}</strong> correcciones de datos · <strong className="text-teal-700">{newLayerCount}</strong> lotes nuevos</p>
              <div className="flex flex-col-reverse gap-2 sm:flex-row"><button type="button" onClick={onClose} disabled={isSaving} className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-100 disabled:opacity-50">Cancelar</button><button type="submit" disabled={isSaving || items.length === 0} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-black text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-45"><Save className="h-4 w-4" />Revisar y aplicar</button></div>
            </footer>
          </form>
        </section>
      </div>

      <ConfirmationDialog isOpen={confirmOpen} title="¿Aplicar el reajuste de stock?" description={`Se aplicarán ${stagedOperationCount} correcciones. Los cambios de datos conservarán el vínculo entre el registro de origen y la capa física de destino.`} confirmLabel="Aplicar reajuste" tone="warning" isConfirming={isSaving} onCancel={() => setConfirmOpen(false)} onConfirm={() => onSubmit(items, reason, observation.trim())}>
        <div className="grid grid-cols-3 gap-2"><ConfirmationMetric label="Conteos" value={quantityCount} tone="amber" /><ConfirmationMetric label="Datos corregidos" value={reclassificationCount} tone="violet" /><ConfirmationMetric label="Lotes nuevos" value={newLayerCount} tone="teal" /></div>
      </ConfirmationDialog>
    </>,
    document.body
  );
}

function ModeButton({ active, icon, label, description, onClick }: { active: boolean; icon: React.ReactNode; label: string; description: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`flex min-h-16 items-center gap-3 rounded-xl px-4 py-2 text-left transition-colors ${active ? "bg-white text-teal-700 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:bg-white/60 hover:text-slate-800"}`}><span className="shrink-0">{icon}</span><span><span className="block text-sm font-black">{label}</span><span className="mt-0.5 block text-[10px] font-semibold text-slate-400">{description}</span></span></button>;
}

function LayerPicker({ inputRef, query, selectedLayer, layers, onQueryChange, onSelect }: { inputRef: React.RefObject<HTMLInputElement | null>; query: string; selectedLayer?: ImmunizationStockLayer; layers: ImmunizationStockLayer[]; onQueryChange: (value: string) => void; onSelect: (layer: ImmunizationStockLayer) => void }) {
  return <div className="rounded-2xl border border-slate-200 p-4 sm:p-5"><label htmlFor="adjustment-layer-search" className="mb-1.5 block text-xs font-black text-slate-700">1. Buscar el registro que aparece en el sistema</label><div className="relative"><Search className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" /><input ref={inputRef} id="adjustment-layer-search" value={query} onChange={event => onQueryChange(event.target.value)} autoComplete="off" placeholder="Código SISMED, descripción o lote..." className={`${inputClassName} pl-10`} /></div>{!selectedLayer && <div className="mt-3 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white">{layers.length === 0 ? <p className="px-4 py-6 text-center text-sm font-bold text-slate-500">No se encontraron lotes disponibles.</p> : layers.map(layer => <button key={layer.id} type="button" onClick={() => onSelect(layer)} className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-3 py-3 text-left last:border-0 hover:bg-teal-50"><span className="min-w-0"><span className="block truncate text-sm font-black text-slate-900">{layer.product?.codigoSismed} · {layer.product?.descripcion || "Producto"}</span><span className="mt-0.5 block text-xs text-slate-500">Lote {layer.lote} · Vence {layer.expirationDate} · {layer.fundingSource}/{layer.supplyType}</span></span><span className="shrink-0 rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-xs font-black text-slate-700">{formatQuantity(layer.currentQuantity)}</span></button>)}</div>}</div>;
}

function LayerSummary({ layer, title, showAllData = false }: { layer: ImmunizationStockLayer; title: string; showAllData?: boolean }) {
  return <div className="min-w-0">{title && <p className="text-[9px] font-black uppercase tracking-wide text-slate-400">{title}</p>}<p className="mt-1 text-sm font-black text-slate-900">{layer.product?.codigoSismed} · {layer.product?.descripcion || "Producto"}</p><p className="mt-1 text-xs text-slate-600">Lote <strong>{layer.lote}</strong> · Vence <strong>{layer.expirationDate}</strong></p>{showAllData && <p className="mt-1 text-xs text-slate-600">{formatMoney(layer.unitPrice)} · {layer.fundingSource}/{layer.supplyType}</p>}<p className="mt-2 font-mono text-sm font-black text-teal-700">Stock: {formatQuantity(layer.currentQuantity)}</p></div>;
}

function ProductResults({ products, onSelect }: { products: ImmunizationProduct[]; onSelect: (product: ImmunizationProduct) => void }) {
  return <div className="absolute z-30 mt-2 max-h-64 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xl">{products.map(product => <button key={product.id || product.codigoSismed} type="button" onClick={() => onSelect(product)} className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-teal-50"><span className="shrink-0 rounded-lg bg-slate-100 px-2 py-1 font-mono text-xs font-black text-teal-700">{product.codigoSismed}</span><span className="text-sm font-bold text-slate-900">{product.descripcion}</span></button>)}</div>;
}

function DraftItems({ items, onRemove }: { items: ImmunizationAdjustmentItem[]; onRemove: (item: ImmunizationAdjustmentItem) => void }) {
  const visibleItems = items.filter(item => item.operationType !== "RECLASSIFY_TARGET");
  return <div className="divide-y divide-slate-100">{visibleItems.map(item => {
    const target = item.reclassificationKey ? items.find(candidate => candidate.operationType === "RECLASSIFY_TARGET" && candidate.reclassificationKey === item.reclassificationKey) : undefined;
    if (target) return <div key={item.reclassificationKey} className="p-4"><div className="mb-3 flex items-center justify-between"><span className="rounded-lg bg-violet-100 px-2.5 py-1 text-[10px] font-black uppercase text-violet-700">Corrección de datos</span><button type="button" onClick={() => onRemove(item)} aria-label="Quitar corrección de datos" className="rounded-xl p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button></div><div className="grid gap-2 md:grid-cols-[1fr_auto_1fr] md:items-center"><DraftLayer item={item} label="Sistema" /><ArrowRight className="mx-auto hidden h-5 w-5 text-violet-400 md:block" /><DraftLayer item={target} label="Físico" /></div></div>;
    return <div key={item.stockLayerId || `${item.productId}-${item.lote}-${item.expirationDate}`} className="grid gap-3 px-4 py-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center"><div className="min-w-0"><span className={`mb-1 inline-flex rounded-md px-2 py-0.5 text-[9px] font-black uppercase ${item.operationType === "NEW_LAYER" ? "bg-teal-100 text-teal-700" : "bg-amber-100 text-amber-700"}`}>{item.operationType === "NEW_LAYER" ? "Lote nuevo" : "Ajuste de cantidad"}</span><p className="truncate text-sm font-black text-slate-900">{item.product?.codigoSismed} · {item.product?.descripcion || "Producto"}</p><p className="mt-0.5 text-xs text-slate-500">Lote {item.lote} · Vence {item.expirationDate}</p></div><div className="grid grid-cols-2 gap-3 text-xs sm:flex sm:gap-5"><Metric label="Sistema" value={formatQuantity(item.systemQuantity)} /><Metric label="Físico" value={formatQuantity(item.physicalQuantity)} /></div><DifferenceBadge value={item.differenceQuantity} /><button type="button" onClick={() => onRemove(item)} aria-label={`Quitar lote ${item.lote}`} className="justify-self-end rounded-xl p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button></div>;
  })}</div>;
}

function DraftLayer({ item, label }: { item: ImmunizationAdjustmentItem; label: string }) {
  return <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-[9px] font-black uppercase text-slate-400">{label}</p><p className="mt-1 text-xs font-black text-slate-900">{item.product?.codigoSismed} · {item.product?.descripcion || "Producto"}</p><p className="mt-1 text-xs text-slate-500">Lote {item.lote} · {item.expirationDate} · {item.fundingSource}/{item.supplyType}</p><div className="mt-2 flex items-center justify-between"><span className="font-mono text-xs font-black text-slate-700">{formatQuantity(item.physicalQuantity)}</span><DifferenceBadge value={item.differenceQuantity} /></div></div>;
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <label className="block text-xs font-black text-slate-700"><span className="mb-1.5 block">{label} {required && <span className="text-red-500">*</span>}</span>{children}</label>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[9px] font-black uppercase tracking-wide text-slate-400">{label}</p><p className="mt-0.5 font-mono text-sm font-black text-slate-800">{value}</p></div>;
}

function DifferenceBadge({ value }: { value: number }) {
  const positive = value > 0;
  return <span className={`inline-flex w-fit items-center rounded-lg px-2.5 py-1 font-mono text-xs font-black ${positive ? "bg-emerald-100 text-emerald-700" : value < 0 ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"}`}>{positive ? "+" : ""}{formatQuantity(value)}</span>;
}

function ConfirmationMetric({ label, value, tone }: { label: string; value: number; tone: "amber" | "violet" | "teal" }) {
  const classes = tone === "amber" ? "border-amber-200 bg-amber-50 text-amber-800" : tone === "violet" ? "border-violet-200 bg-violet-50 text-violet-800" : "border-teal-200 bg-teal-50 text-teal-800";
  return <div className={`rounded-xl border p-3 ${classes}`}><p className="text-[9px] font-black uppercase">{label}</p><p className="mt-1 text-xl font-black">{value}</p></div>;
}
