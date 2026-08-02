import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Download,
  FileSpreadsheet,
  LockKeyhole,
  PackagePlus,
  Pencil,
  RefreshCw,
  Trash2,
  Upload,
  X
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import {
  downloadImmunizationInventoryTemplate,
  ImmunizationImportPreview,
  parseImmunizationInventoryExcel,
  toInventoryItems
} from "../services/immunizationExcelService";
import { api } from "../services/api";
import { getCurrentImmunizationPeriod, getImmunizationScope, ImmunizationScope, immunizationApi } from "../services/immunizationApi";
import { HealthFacility, ImmunizationInitialInventory, ImmunizationInitialInventoryItem, ImmunizationOwnerType, ImmunizationProduct, Unget } from "../types";
import { ImmunizationKpiCard } from "./ui/immunization";
import { ConfirmationDialog } from "./ui/ConfirmationDialog";
import { ImmunizationInventoryItemModal, InventoryItemFormData } from "./ImmunizationInventoryItemModal";

const currencyFormatter = new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" });

export const ImmunizationInitialInventoryModule: React.FC = () => {
  const { user } = useAuth();
  const scope = useMemo(() => getImmunizationScope(user), [user]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [inventories, setInventories] = useState<ImmunizationInitialInventory[]>([]);
  const [inventoryItems, setInventoryItems] = useState<ImmunizationInitialInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [processingFile, setProcessingFile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const [showCloseConfirmation, setShowCloseConfirmation] = useState(false);
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [manualProducts, setManualProducts] = useState<ImmunizationProduct[]>([]);
  const [editingItem, setEditingItem] = useState<ImmunizationInitialInventoryItem | null>(null);
  const [manualSaving, setManualSaving] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<ImmunizationInitialInventoryItem | null>(null);
  const [deletingItem, setDeletingItem] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<ImmunizationImportPreview | null>(null);
  const [organizationsLoading, setOrganizationsLoading] = useState(false);
  const [ungets, setUngets] = useState<Unget[]>([]);
  const [facilities, setFacilities] = useState<HealthFacility[]>([]);
  const [adminOwnerType, setAdminOwnerType] = useState<ImmunizationOwnerType | "">("");
  const [adminUngetId, setAdminUngetId] = useState("");
  const [adminFacilityCode, setAdminFacilityCode] = useState("");
  const currentPeriod = getCurrentImmunizationPeriod();
  const isGlobalAdmin = user?.role === "ADMIN" && !scope.ownerType;
  const selectedFacility = facilities.find(facility => facility.code === adminFacilityCode);
  const effectiveScope = useMemo<ImmunizationScope>(() => {
    if (scope.ownerType) return scope;
    if (adminOwnerType === "UNGET" && adminUngetId) {
      return { level: "UNGET", ownerType: "UNGET", ungetId: adminUngetId };
    }
    if (adminOwnerType === "IPRESS" && adminFacilityCode) {
      return {
        level: "IPRESS",
        ownerType: "IPRESS",
        ungetId: selectedFacility?.ungetId,
        facilityCode: adminFacilityCode
      };
    }
    return { level: "GLOBAL" };
  }, [scope, adminOwnerType, adminUngetId, adminFacilityCode, selectedFacility?.ungetId]);

  const loadInventories = async () => {
    if (!effectiveScope.ownerType) {
      setInventories([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setInventories(await immunizationApi.getInitialInventories(effectiveScope));
    } catch {
      toast.error("Error al cargar inventarios iniciales");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInventories();
  }, [effectiveScope.level, effectiveScope.ungetId, effectiveScope.facilityCode]);

  useEffect(() => {
    if (!isGlobalAdmin) return;
    setOrganizationsLoading(true);
    Promise.all([api.getUngets(), api.getFacilities()])
      .then(([ungetRows, facilityRows]) => {
        setUngets(ungetRows.sort((a, b) => a.name.localeCompare(b.name)));
        setFacilities(facilityRows.sort((a, b) => a.name.localeCompare(b.name)));
      })
      .catch(() => toast.error("No se pudo cargar la lista de UNGET e IPRESS"))
      .finally(() => setOrganizationsLoading(false));
  }, [isGlobalAdmin]);

  /**
   * El inventario inicial es una carga única por establecimiento, no un ciclo mensual.
   *
   * Antes se buscaba por el periodo en curso, así que cada primero de mes el inventario
   * cargado dejaba de verse y no había forma de recuperarlo. Ahora se toma el del ámbito
   * seleccionado sin mirar el periodo: primero un borrador en curso, si no el más
   * reciente que ya esté cerrado.
   */
  const activeInventory = useMemo(() => {
    const ordenados = [...inventories].sort((a, b) => (b.period || "").localeCompare(a.period || ""));
    return ordenados.find(item => item.status === "DRAFT") || ordenados[0];
  }, [inventories]);

  const loadInventoryItems = async (inventoryId?: string) => {
    if (!inventoryId) {
      setInventoryItems([]);
      return;
    }
    setLoadingItems(true);
    try {
      setInventoryItems(await immunizationApi.getInitialInventoryItems(inventoryId));
    } catch {
      setInventoryItems([]);
      toast.error("No se pudo cargar el detalle del inventario");
    } finally {
      setLoadingItems(false);
    }
  };

  useEffect(() => {
    void loadInventoryItems(activeInventory?.id);
  }, [activeInventory?.id]);
  const invalidRows = preview?.rows.filter(row => row.errors.length > 0) || [];
  const validRows = preview?.rows.filter(row => row.errors.length === 0) || [];
  const warningRows = preview?.rows.filter(row => row.warnings.length > 0) || [];
  const totalValue = validRows.reduce((sum, row) => sum + row.quantity * row.unitPrice, 0);
  // Las filas con errores se omiten. Solo se bloquea toda la importacion cuando
  // la estructura del archivo es invalida o no queda ninguna fila util.
  const hasBlockingErrors = Boolean(preview && (preview.missingColumns.length > 0 || validRows.length === 0));
  const canSaveForScope = Boolean(
    (effectiveScope.ownerType === "UNGET" && effectiveScope.ungetId) ||
    (effectiveScope.ownerType === "IPRESS" && effectiveScope.facilityCode)
  );
  const inventoryIsClosed = activeInventory?.status === "CLOSED";

  const processFile = async (file?: File) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      toast.error("Seleccione un archivo Excel con extension .xlsx");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error("El archivo supera el limite de 15 MB");
      return;
    }
    if (inventoryIsClosed) {
      toast.error("El inventario inicial ya esta cerrado y no admite nuevas cargas");
      return;
    }

    setProcessingFile(true);
    setPreview(null);
    try {
      const products = await immunizationApi.getProducts(true);
      const nextPreview = await parseImmunizationInventoryExcel(file, products);
      setPreview(nextPreview);
      if (products.length === 0) {
        toast.warning("El catalogo biologico esta vacio. Debe cargarlo antes de importar el inventario.");
      } else if (nextPreview.missingColumns.length > 0) {
        toast.error("El archivo no contiene todas las columnas obligatorias");
      } else {
        toast.success(`Archivo leido: ${nextPreview.rows.length} filas encontradas`);
      }
    } catch (error: any) {
      toast.error(error?.message || "No se pudo leer el archivo Excel");
    } finally {
      setProcessingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const confirmImport = async () => {
    if (!preview || hasBlockingErrors) return;
    if (!canSaveForScope || !effectiveScope.ownerType) {
      toast.error("Para guardar, el usuario debe estar vinculado a una UNGET o IPRESS");
      return;
    }
    if (activeInventory) {
      toast.error("Ya existe un inventario inicial para este periodo");
      return;
    }

    setSaving(true);
    try {
      const result = await immunizationApi.createInitialInventory({
        ownerType: effectiveScope.ownerType,
        ungetId: effectiveScope.ownerType === "UNGET" ? effectiveScope.ungetId : undefined,
        facilityCode: effectiveScope.ownerType === "IPRESS" ? effectiveScope.facilityCode : undefined,
        period: currentPeriod,
        status: "DRAFT",
        sourceType: "EXCEL",
        createdBy: user?.username
      }, toInventoryItems(validRows));

      if (!result.success) {
        toast.error(result.message || "No se pudo guardar el inventario");
        return;
      }
      toast.success(
        invalidRows.length > 0
          ? `Inventario guardado: ${validRows.length} filas validas; ${invalidRows.length} omitidas`
          : `Inventario guardado: ${validRows.length} filas`
      );
      setPreview(null);
      await loadInventories();
    } finally {
      setSaving(false);
    }
  };

  const requestCloseInventory = () => {
    if (!activeInventory?.id || activeInventory.status !== "DRAFT") return;
    if (inventoryItems.length === 0) {
      toast.error("El borrador no contiene filas para generar stock");
      return;
    }
    setShowCloseConfirmation(true);
  };

  const closeInventory = async () => {
    if (!activeInventory?.id || activeInventory.status !== "DRAFT") return;

    setClosing(true);
    try {
      const result = await immunizationApi.closeInitialInventory(activeInventory.id, user?.username);
      if (!result.success) {
        toast.error(result.message || "No se pudo cerrar el inventario");
        return;
      }
      toast.success("Inventario cerrado y stock biologico generado");
      setShowCloseConfirmation(false);
      await loadInventories();
    } finally {
      setClosing(false);
    }
  };

  const openManualItemModal = async (item?: ImmunizationInitialInventoryItem) => {
    if (!canSaveForScope) {
      toast.error("Seleccione primero la UNGET o IPRESS propietaria del inventario");
      return;
    }
    if (inventoryIsClosed) {
      toast.error("El inventario cerrado no admite cambios directos");
      return;
    }
    try {
      const catalog = await immunizationApi.getProducts(Boolean(item));
      const available = catalog.filter(product => product.isActive || product.id === item?.productId);
      if (available.length === 0) {
        toast.error("No hay productos activos en el catalogo biologico");
        return;
      }
      setManualProducts(available);
      setEditingItem(item || null);
      setManualModalOpen(true);
    } catch {
      toast.error("No se pudo cargar el catalogo biologico");
    }
  };

  const saveManualItem = async (form: InventoryItemFormData) => {
    const product = manualProducts.find(row => row.id === form.productId);
    if (!product?.id || !effectiveScope.ownerType) {
      toast.error("Seleccione un producto y un destino validos");
      return;
    }
    const item: ImmunizationInitialInventoryItem = {
      id: editingItem?.id,
      inventoryId: editingItem?.inventoryId,
      productId: product.id,
      codigoSismedSnapshot: product.codigoSismed,
      excelDescriptionSnapshot: editingItem?.excelDescriptionSnapshot,
      lote: form.lote,
      expirationDate: form.expirationDate,
      quantity: form.quantity,
      unitPrice: form.unitPrice,
      fundingSource: form.fundingSource,
      supplyType: form.supplyType,
      observation: form.observation || undefined
    };

    setManualSaving(true);
    try {
      const result = activeInventory?.id
        ? await immunizationApi.saveInitialInventoryItem(activeInventory.id, item)
        : await immunizationApi.createInitialInventory({
            ownerType: effectiveScope.ownerType,
            ungetId: effectiveScope.ownerType === "UNGET" ? effectiveScope.ungetId : undefined,
            facilityCode: effectiveScope.ownerType === "IPRESS" ? effectiveScope.facilityCode : undefined,
            period: currentPeriod,
            status: "DRAFT",
            sourceType: "MANUAL",
            createdBy: user?.username
          }, [item]);

      if (!result.success) {
        toast.error(result.message || "No se pudo guardar el producto");
        return;
      }
      toast.success(editingItem ? "Producto/lote actualizado" : "Producto/lote agregado al borrador");
      setManualModalOpen(false);
      setEditingItem(null);
      if (activeInventory?.id) await loadInventoryItems(activeInventory.id);
      await loadInventories();
    } finally {
      setManualSaving(false);
    }
  };

  const deleteInventoryItem = async () => {
    if (!activeInventory?.id || !itemToDelete?.id) return;
    setDeletingItem(true);
    try {
      const result = await immunizationApi.deleteInitialInventoryItem(activeInventory.id, itemToDelete.id);
      if (!result.success) {
        toast.error(result.message || "No se pudo eliminar la fila");
        return;
      }
      toast.success("Producto/lote eliminado del borrador");
      setItemToDelete(null);
      await loadInventoryItems(activeInventory.id);
    } finally {
      setDeletingItem(false);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    void processFile(event.dataTransfer.files?.[0]);
  };

  if (loading) {
    return <div className="py-16 flex justify-center"><div className="h-9 w-9 rounded-full border-2 border-teal-500 border-t-transparent animate-spin" /></div>;
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-700">
              <ClipboardList className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">Inventario Inicial</h2>
              <p className="text-sm text-slate-500 mt-1 max-w-3xl">
                Carga el stock fisico por lote. La descripcion oficial se obtiene del catalogo biologico usando el codigo SISMED.
              </p>
            </div>
          </div>
          {/* Con inventario cargado se muestra su periodo real, no el mes en curso. */}
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <span>{activeInventory ? "Cargado en" : "Periodo"}</span>
            <span className="font-black text-teal-700">{activeInventory?.period || currentPeriod}</span>
          </div>
        </div>
      </div>

      {isGlobalAdmin && (
        <AdminInventoryScopeSelector
          ownerType={adminOwnerType}
          ungetId={adminUngetId}
          facilityCode={adminFacilityCode}
          ungets={ungets}
          facilities={facilities}
          loading={organizationsLoading}
          onOwnerTypeChange={value => {
            setAdminOwnerType(value);
            setAdminUngetId("");
            setAdminFacilityCode("");
          }}
          onUngetChange={value => {
            setAdminUngetId(value);
            setAdminFacilityCode("");
          }}
          onFacilityChange={setAdminFacilityCode}
        />
      )}

      {!canSaveForScope && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
          <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-black">Selecciona el destino del inventario</p>
            <p className="text-xs mt-0.5">Puedes revisar el Excel, pero el boton se habilitara cuando indiques la UNGET o IPRESS propietaria del stock.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-5">
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">{activeInventory ? "Detalle del inventario" : "Carga desde Excel"}</h3>
              <p className="text-xs text-slate-500 mt-0.5">{activeInventory ? "Revisa los productos guardados antes de cerrar y generar el stock." : "Primero validaremos las filas; nada se guarda automaticamente."}</p>
            </div>
            {activeInventory && (
              <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg border ${activeInventory.status === "CLOSED" ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-amber-50 text-amber-700 border-amber-100"}`}>
                {activeInventory.status === "CLOSED" ? "Cerrado" : "Borrador existente"}
              </span>
            )}
          </div>

          {!preview && activeInventory ? (
            <SavedInventoryView
              inventory={activeInventory}
              items={inventoryItems}
              loading={loadingItems}
              closing={closing}
              onReload={() => void loadInventoryItems(activeInventory.id)}
              onClose={requestCloseInventory}
              onEdit={item => void openManualItemModal(item)}
              onDelete={setItemToDelete}
            />
          ) : !preview ? (
            <div className="p-5 sm:p-8">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={event => void processFile(event.target.files?.[0])}
              />
              <div
                role="button"
                tabIndex={inventoryIsClosed ? -1 : 0}
                aria-disabled={inventoryIsClosed}
                onClick={() => !inventoryIsClosed && fileInputRef.current?.click()}
                onKeyDown={event => {
                  if (!inventoryIsClosed && (event.key === "Enter" || event.key === " ")) fileInputRef.current?.click();
                }}
                onDragOver={event => { event.preventDefault(); if (!inventoryIsClosed) setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`rounded-2xl border-2 border-dashed p-8 sm:p-12 text-center transition-all outline-none focus:ring-4 focus:ring-teal-100 ${
                  inventoryIsClosed
                    ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-70"
                    : isDragging
                      ? "cursor-copy border-teal-500 bg-teal-50 scale-[1.01]"
                      : "cursor-pointer border-teal-200 bg-gradient-to-b from-white to-teal-50/40 hover:border-teal-400"
                }`}
              >
                {processingFile ? (
                  <>
                    <RefreshCw className="h-11 w-11 text-teal-600 mx-auto animate-spin" />
                    <h3 className="text-lg font-black text-slate-900 mt-4">Leyendo y validando el archivo</h3>
                    <p className="text-sm text-slate-500 mt-1">Estamos comparando cada codigo contra el catalogo maestro.</p>
                  </>
                ) : (
                  <>
                    <div className="h-16 w-16 mx-auto rounded-2xl bg-white border border-teal-100 shadow-sm flex items-center justify-center">
                      <FileSpreadsheet className="h-8 w-8 text-teal-600" />
                    </div>
                    <h3 className="text-lg font-black text-slate-900 mt-4">Arrastra aqui tu inventario inicial</h3>
                    <p className="text-sm text-slate-500 mt-1">o haz clic para seleccionar un archivo .xlsx</p>
                    <span className="inline-flex items-center gap-2 mt-5 px-4 py-2 rounded-xl bg-teal-600 text-white text-sm font-black shadow-sm">
                      <Upload className="h-4 w-4" /> Seleccionar Excel
                    </span>
                  </>
                )}
              </div>
            </div>
          ) : (
            <ImportPreview
              preview={preview}
              validCount={validRows.length}
              invalidCount={invalidRows.length}
              warningCount={warningRows.length}
              totalValue={totalValue}
              hasBlockingErrors={hasBlockingErrors}
              saving={saving}
              canConfirm={canSaveForScope && !activeInventory}
              onCancel={() => setPreview(null)}
              onConfirm={() => void confirmImport()}
            />
          )}
        </section>

        <aside className="space-y-3">
          <ActionCard
            icon={<Download className="h-5 w-5" />}
            title="Descargar plantilla .xlsx"
            description="Usa las columnas oficiales para evitar observaciones durante la carga."
            onClick={downloadImmunizationInventoryTemplate}
          />
          <ActionCard
            icon={<PackagePlus className="h-5 w-5" />}
            title="Registro manual"
            description={inventoryIsClosed ? "El inventario ya esta cerrado." : "Agrega un producto o lote puntual al borrador antes del cierre."}
            onClick={() => void openManualItemModal()}
            disabled={!canSaveForScope || inventoryIsClosed || manualSaving}
          />
          <ActionCard
            icon={<LockKeyhole className="h-5 w-5" />}
            title={activeInventory?.status === "CLOSED" ? "Inventario cerrado" : closing ? "Cerrando inventario..." : "Cerrar inventario"}
            description={activeInventory?.status === "CLOSED" ? "El stock ya fue generado y el inventario no admite edicion directa." : "Confirma el borrador y genera el stock biologico por lote."}
            onClick={requestCloseInventory}
            disabled={!activeInventory || activeInventory.status === "CLOSED" || inventoryItems.length === 0 || loadingItems || closing}
          />
        </aside>
      </div>

      <ConfirmationDialog
        isOpen={showCloseConfirmation}
        title="¿Cerrar el inventario inicial?"
        description="Al confirmar, el borrador quedara bloqueado y sus productos se convertiran en stock biologico disponible por lote. Las correcciones posteriores deberan realizarse mediante un reajuste auditado."
        confirmLabel="Cerrar y generar stock"
        cancelLabel="Seguir revisando"
        tone="warning"
        isConfirming={closing}
        onCancel={() => setShowCloseConfirmation(false)}
        onConfirm={() => void closeInventory()}
      >
        <div className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Productos/lotes</p>
            <p className="mt-1 text-lg font-black text-slate-900">{inventoryItems.length}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Saldo total</p>
            <p className="mt-1 text-lg font-black text-slate-900">{inventoryItems.reduce((sum, item) => sum + item.quantity, 0).toLocaleString("es-PE")}</p>
          </div>
          <div className="col-span-2 border-t border-slate-200 pt-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Valorizacion</p>
            <p className="mt-1 text-lg font-black text-teal-700">{currencyFormatter.format(inventoryItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0))}</p>
          </div>
        </div>
      </ConfirmationDialog>

      <ImmunizationInventoryItemModal
        isOpen={manualModalOpen}
        products={manualProducts}
        editingItem={editingItem}
        isSaving={manualSaving}
        onClose={() => {
          if (!manualSaving) {
            setManualModalOpen(false);
            setEditingItem(null);
          }
        }}
        onSubmit={data => void saveManualItem(data)}
      />

      <ConfirmationDialog
        isOpen={Boolean(itemToDelete)}
        title="¿Eliminar este producto/lote?"
        description="La fila sera retirada del borrador del inventario inicial. Esta accion no afecta el stock porque el inventario aun no esta cerrado."
        confirmLabel="Eliminar del borrador"
        cancelLabel="Conservar fila"
        tone="danger"
        isConfirming={deletingItem}
        onCancel={() => setItemToDelete(null)}
        onConfirm={() => void deleteInventoryItem()}
      >
        {itemToDelete && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="font-black text-slate-900">{itemToDelete.product?.descripcion || itemToDelete.excelDescriptionSnapshot || itemToDelete.codigoSismedSnapshot}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold text-slate-600">
              <span className="rounded-lg bg-white px-2 py-1">Codigo: {itemToDelete.product?.codigoSismed || itemToDelete.codigoSismedSnapshot}</span>
              <span className="rounded-lg bg-white px-2 py-1">Lote: {itemToDelete.lote}</span>
              <span className="rounded-lg bg-white px-2 py-1">Saldo: {itemToDelete.quantity}</span>
            </div>
          </div>
        )}
      </ConfirmationDialog>
    </div>
  );
};

interface ImportPreviewProps {
  preview: ImmunizationImportPreview;
  validCount: number;
  invalidCount: number;
  warningCount: number;
  totalValue: number;
  hasBlockingErrors: boolean;
  saving: boolean;
  canConfirm: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

interface SavedInventoryViewProps {
  inventory: ImmunizationInitialInventory;
  items: ImmunizationInitialInventoryItem[];
  loading: boolean;
  closing: boolean;
  onReload: () => void;
  onClose: () => void;
  onEdit: (item: ImmunizationInitialInventoryItem) => void;
  onDelete: (item: ImmunizationInitialInventoryItem) => void;
}

const SavedInventoryView: React.FC<SavedInventoryViewProps> = ({ inventory, items, loading, closing, onReload, onClose, onEdit, onDelete }) => {
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalValue = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  if (loading) {
    return <div className="py-16 flex justify-center"><RefreshCw className="h-8 w-8 text-teal-600 animate-spin" /></div>;
  }

  if (items.length === 0) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
          <AlertTriangle className="h-9 w-9 text-amber-500 mx-auto" />
          <h3 className="font-black text-amber-900 mt-3">Borrador sin detalle visible</h3>
          <p className="text-sm text-amber-800 mt-1">Existe la cabecera del inventario, pero no se encontraron sus productos guardados.</p>
          <button onClick={onReload} className="mt-4 px-4 py-2 rounded-xl border border-amber-300 bg-white text-sm font-black text-amber-800 hover:bg-amber-100">
            Volver a consultar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-4 bg-slate-50 border-b border-slate-100">
        <ImmunizationKpiCard filled label="Productos/lotes" value={String(items.length)} tone="success" />
        <ImmunizationKpiCard filled label="Frascos/unidades" value={totalQuantity.toLocaleString("es-PE")} tone="neutral" />
        <ImmunizationKpiCard filled label="Valorizacion" value={currencyFormatter.format(totalValue)} tone="neutral" />
        <ImmunizationKpiCard filled label="Estado" value={inventory.status === "CLOSED" ? "Cerrado" : "Borrador"} tone={inventory.status === "CLOSED" ? "success" : "warning"} />
      </div>

      <div className="overflow-auto max-h-[470px]">
        <table className="min-w-[1120px] w-full text-xs">
          <thead className="sticky top-0 z-10 bg-slate-100 text-slate-600 uppercase tracking-wide">
            <tr>
              <th className="px-3 py-3 text-left">Codigo SISMED</th>
              <th className="px-3 py-3 text-left min-w-[260px]">Descripcion oficial</th>
              <th className="px-3 py-3 text-left">Lote</th>
              <th className="px-3 py-3 text-left">Vencimiento</th>
              <th className="px-3 py-3 text-right">Saldo</th>
              <th className="px-3 py-3 text-right">Precio</th>
              <th className="px-3 py-3 text-left">Fuente</th>
              <th className="px-3 py-3 text-left">Suministro</th>
              {inventory.status === "DRAFT" && <th className="px-3 py-3 text-right">Acciones</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map(item => (
              <tr key={item.id || `${item.productId}-${item.lote}-${item.unitPrice}`} className="bg-white hover:bg-slate-50">
                <td className="px-3 py-3 font-black text-teal-700">{item.product?.codigoSismed || item.codigoSismedSnapshot}</td>
                <td className="px-3 py-3 font-semibold text-slate-800">{item.product?.descripcion || item.excelDescriptionSnapshot || "Producto"}</td>
                <td className="px-3 py-3 font-black text-slate-700">{item.lote}</td>
                <td className="px-3 py-3 text-slate-600">{item.expirationDate}</td>
                <td className="px-3 py-3 text-right font-black text-slate-900">{item.quantity.toLocaleString("es-PE")}</td>
                <td className="px-3 py-3 text-right text-slate-700">{currencyFormatter.format(item.unitPrice)}</td>
                <td className="px-3 py-3 text-slate-600">{item.fundingSource}</td>
                <td className="px-3 py-3 text-slate-600">{item.supplyType}</td>
                {inventory.status === "DRAFT" && (
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => onEdit(item)}
                        title="Editar fila"
                        aria-label={`Editar lote ${item.lote}`}
                        className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-teal-50 hover:text-teal-700"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(item)}
                        title="Eliminar fila"
                        aria-label={`Eliminar lote ${item.lote}`}
                        className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-xs text-slate-500">
          {inventory.status === "CLOSED" ? "Este inventario ya genero el stock biologico." : "Al cerrar, estas filas se convertiran en stock disponible por lote."}
        </p>
        {inventory.status === "DRAFT" && (
          <button
            onClick={onClose}
            disabled={closing}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-black hover:bg-slate-800 disabled:opacity-50"
          >
            {closing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
            {closing ? "Generando stock..." : "Cerrar y generar stock"}
          </button>
        )}
      </div>
    </div>
  );
};

interface AdminInventoryScopeSelectorProps {
  ownerType: ImmunizationOwnerType | "";
  ungetId: string;
  facilityCode: string;
  ungets: Unget[];
  facilities: HealthFacility[];
  loading: boolean;
  onOwnerTypeChange: (value: ImmunizationOwnerType | "") => void;
  onUngetChange: (value: string) => void;
  onFacilityChange: (value: string) => void;
}

const AdminInventoryScopeSelector: React.FC<AdminInventoryScopeSelectorProps> = ({
  ownerType,
  ungetId,
  facilityCode,
  ungets,
  facilities,
  loading,
  onOwnerTypeChange,
  onUngetChange,
  onFacilityChange
}) => {
  const availableFacilities = ungetId
    ? facilities.filter(facility => facility.ungetId === ungetId)
    : [];

  return (
    <section className="bg-white rounded-2xl border border-cyan-200 shadow-sm p-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end">
        <div className="xl:w-64">
          <label htmlFor="inventory-owner-type" className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
            Inventario perteneciente a
          </label>
          <select
            id="inventory-owner-type"
            value={ownerType}
            disabled={loading}
            onChange={event => onOwnerTypeChange(event.target.value as ImmunizationOwnerType | "")}
            className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100 disabled:bg-slate-100"
          >
            <option value="">Seleccionar nivel...</option>
            <option value="UNGET">UNGET</option>
            <option value="IPRESS">IPRESS</option>
          </select>
        </div>

        {ownerType && (
          <div className="min-w-0 flex-1">
            <label htmlFor="inventory-unget" className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
              UNGET propietaria
            </label>
            <select
              id="inventory-unget"
              value={ungetId}
              disabled={loading}
              onChange={event => onUngetChange(event.target.value)}
              className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100 disabled:bg-slate-100"
            >
              <option value="">Seleccionar UNGET...</option>
              {ungets.map(unget => <option key={unget.id} value={unget.id}>{unget.name}</option>)}
            </select>
          </div>
        )}

        {ownerType === "IPRESS" && (
          <div className="min-w-0 flex-1">
            <label htmlFor="inventory-facility" className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
              Establecimiento IPRESS
            </label>
            <select
              id="inventory-facility"
              value={facilityCode}
              disabled={loading || !ungetId}
              onChange={event => onFacilityChange(event.target.value)}
              className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100 disabled:bg-slate-100"
            >
              <option value="">Seleccionar IPRESS...</option>
              {availableFacilities.map(facility => (
                <option key={facility.code} value={facility.code}>{facility.code} - {facility.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className={`h-11 shrink-0 rounded-xl border px-4 flex items-center text-xs font-black ${
          (ownerType === "UNGET" && ungetId) || (ownerType === "IPRESS" && facilityCode)
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-amber-200 bg-amber-50 text-amber-700"
        }`}>
          {loading
            ? "Cargando destinos..."
            : (ownerType === "UNGET" && ungetId) || (ownerType === "IPRESS" && facilityCode)
              ? "Destino seleccionado"
              : "Destino pendiente"}
        </div>
      </div>
    </section>
  );
};

const ImportPreview: React.FC<ImportPreviewProps> = ({
  preview,
  validCount,
  invalidCount,
  warningCount,
  totalValue,
  hasBlockingErrors,
  saving,
  canConfirm,
  onCancel,
  onConfirm
}) => (
  <div>
    <div className="p-4 grid grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50 border-b border-slate-100">
      <ImmunizationKpiCard filled label="Filas validas" value={String(validCount)} tone="success" />
      <ImmunizationKpiCard filled label="Con errores" value={String(invalidCount)} tone={invalidCount ? "danger" : "neutral"} />
      <ImmunizationKpiCard filled label="Advertencias" value={String(warningCount)} tone={warningCount ? "warning" : "neutral"} />
      <ImmunizationKpiCard filled label="Valor valido" value={currencyFormatter.format(totalValue)} tone="neutral" />
    </div>

    {preview.missingColumns.length > 0 && (
      <div className="m-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
        <span className="font-black">Faltan columnas obligatorias:</span> {preview.missingColumns.join(", ")}.
      </div>
    )}

    {preview.missingColumns.length === 0 && invalidCount > 0 && validCount > 0 && (
      <div className="m-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <p>
          <span className="font-black">Importacion parcial:</span> se guardaran {validCount} {validCount === 1 ? "fila valida" : "filas validas"} y se omitiran {invalidCount} {invalidCount === 1 ? "fila con error" : "filas con errores"}.
        </p>
      </div>
    )}

    <div className="overflow-auto max-h-[480px]">
      <table className="min-w-[1120px] w-full text-xs">
        <thead className="sticky top-0 z-10 bg-slate-100 text-slate-600 uppercase tracking-wide">
          <tr>
            <th className="px-3 py-3 text-left">Fila</th>
            <th className="px-3 py-3 text-left">Codigo SISMED</th>
            <th className="px-3 py-3 text-left min-w-[260px]">Descripcion oficial</th>
            <th className="px-3 py-3 text-left">Lote</th>
            <th className="px-3 py-3 text-left">Vencimiento</th>
            <th className="px-3 py-3 text-right">Saldo</th>
            <th className="px-3 py-3 text-right">Precio</th>
            <th className="px-3 py-3 text-left">Fuente</th>
            <th className="px-3 py-3 text-left">Suministro</th>
            <th className="px-3 py-3 text-left min-w-[260px]">Validacion</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {preview.rows.map(row => (
            <tr key={row.rowNumber} className={row.errors.length ? "bg-red-50/50" : "bg-white hover:bg-slate-50"}>
              <td className="px-3 py-3 font-bold text-slate-400">{row.rowNumber}</td>
              <td className="px-3 py-3 font-black text-slate-800">{row.codigoSismed || "—"}</td>
              <td className="px-3 py-3 text-slate-700">{row.officialDescription}</td>
              <td className="px-3 py-3 font-semibold text-slate-700">{row.lote || "—"}</td>
              <td className="px-3 py-3 text-slate-600">{row.expirationDate || "—"}</td>
              <td className="px-3 py-3 text-right font-black text-slate-800">{row.quantity}</td>
              <td className="px-3 py-3 text-right text-slate-700">{currencyFormatter.format(row.unitPrice)}</td>
              <td className="px-3 py-3 text-slate-600">{row.fundingSource || "—"}</td>
              <td className="px-3 py-3 text-slate-600">{row.supplyType || "—"}</td>
              <td className="px-3 py-3">
                {row.errors.length > 0 ? (
                  <div className="flex items-start gap-2 text-red-700"><X className="h-4 w-4 shrink-0" /><span>{row.errors.join(" · ")}</span></div>
                ) : row.warnings.length > 0 ? (
                  <div className="flex items-start gap-2 text-amber-700"><AlertTriangle className="h-4 w-4 shrink-0" /><span>{row.warnings.join(" · ")}</span></div>
                ) : (
                  <div className="flex items-center gap-2 text-emerald-700"><CheckCircle2 className="h-4 w-4" /><span>Fila valida</span></div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {preview.rows.length === 0 && <div className="p-10 text-center text-sm text-slate-500">No se encontraron filas de inventario.</div>}
    </div>

    <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="text-xs text-slate-500 truncate">
        <span className="font-bold text-slate-700">{preview.fileName}</span> · Hoja: {preview.sheetName}
      </div>
      <div className="flex gap-2">
        <button onClick={onCancel} className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-sm font-bold hover:bg-slate-50">Cancelar</button>
        <button
          onClick={onConfirm}
          disabled={hasBlockingErrors || saving || !canConfirm}
          className="px-4 py-2 rounded-xl bg-teal-600 text-white text-sm font-black hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50 flex items-center gap-2"
        >
          {saving && <RefreshCw className="h-4 w-4 animate-spin" />}
          {invalidCount > 0 && validCount > 0
            ? `Guardar ${validCount} y omitir ${invalidCount}`
            : `Guardar ${validCount} ${validCount === 1 ? "fila" : "filas"}`}
        </button>
      </div>
    </div>
  </div>
);

const ActionCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick?: () => void;
  disabled?: boolean;
}> = ({ icon, title, description, onClick, disabled }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="w-full text-left bg-white rounded-2xl border border-slate-200 shadow-sm p-4 transition-all hover:border-teal-300 hover:shadow-md disabled:hover:border-slate-200 disabled:hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-65"
  >
    <div className="flex gap-3">
      <div className="p-2 rounded-xl bg-teal-50 text-teal-700 shrink-0">{icon}</div>
      <div>
        <h3 className="text-sm font-black text-slate-900">{title}</h3>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">{description}</p>
      </div>
    </div>
  </button>
);
