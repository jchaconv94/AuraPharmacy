import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Activity,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Coins,
  Download,
  FileSpreadsheet,
  Filter,
  LockKeyhole,
  Package,
  PackagePlus,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  X
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import {
  downloadImmunizationInventoryTemplate,
  ImmunizationImportPreview,
  ImmunizationImportRow,
  parseImmunizationInventoryExcel,
  toInventoryItems
} from "../services/immunizationExcelService";
import { api } from "../services/api";
import { getCurrentImmunizationPeriod, getImmunizationScope, ImmunizationScope, immunizationApi } from "../services/immunizationApi";
import { HealthFacility, ImmunizationInitialInventory, ImmunizationInitialInventoryItem, ImmunizationOwnerType, ImmunizationProduct, Unget } from "../types";
import { getItemUniqueCompositeKey } from "../services/immunizationDomain";
import { formatImmunizationDate, ImmunizationKpiCard, normalizeImmunizationText } from "./ui/immunization";
import { CustomSelect } from "./ui/CustomSelect";
import { ConfirmationDialog } from "./ui/ConfirmationDialog";
import { ImmunizationInventoryItemModal, InventoryItemFormData } from "./ImmunizationInventoryItemModal";
import { ImmunizationInitialInventoryImportModal } from "./ImmunizationInitialInventoryImportModal";

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
  const [manualDuplicatePrompt, setManualDuplicatePrompt] = useState<{
    existingItem: ImmunizationInitialInventoryItem;
    newItem: ImmunizationInitialInventoryItem;
    productName: string;
    addQuantity: number;
    newTotalQuantity: number;
  } | null>(null);
  const [similarLotePrompt, setSimilarLotePrompt] = useState<{
    existingItem: ImmunizationInitialInventoryItem;
    newItem: ImmunizationInitialInventoryItem;
    formData: InventoryItemFormData;
    productName: string;
    addQuantity: number;
    diffReason: string;
  } | null>(null);
  const [itemToDelete, setItemToDelete] = useState<ImmunizationInitialInventoryItem | null>(null);
  const [deletingItem, setDeletingItem] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<ImmunizationImportPreview | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [discardingDraft, setDiscardingDraft] = useState(false);
  const [isExcelMenuOpen, setIsExcelMenuOpen] = useState(false);
  const excelMenuRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (excelMenuRef.current && !excelMenuRef.current.contains(event.target as Node)) {
        setIsExcelMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
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

  const kpiProductsCount = useMemo(() => {
    if (preview) return validRows.length;
    return activeInventory ? inventoryItems.length : 0;
  }, [preview, validRows.length, activeInventory, inventoryItems.length]);

  const kpiTotalQuantity = useMemo(() => {
    if (preview) return validRows.reduce((sum, row) => sum + row.quantity, 0);
    return activeInventory ? inventoryItems.reduce((sum, item) => sum + item.quantity, 0) : 0;
  }, [preview, validRows, activeInventory, inventoryItems]);

  const kpiTotalValue = useMemo(() => {
    if (preview) return totalValue;
    return activeInventory ? inventoryItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0) : 0;
  }, [preview, totalValue, activeInventory, inventoryItems]);

  const kpiStatusLabel = useMemo(() => {
    if (preview) return "Previsualización";
    if (!activeInventory) return "Sin registrar";
    return activeInventory.status === "CLOSED" ? "Cerrado" : "Borrador";
  }, [preview, activeInventory]);

  const kpiStatusTone = useMemo(() => {
    if (preview) return "warning" as const;
    if (!activeInventory) return "neutral" as const;
    return activeInventory.status === "CLOSED" ? ("success" as const) : ("warning" as const);
  }, [preview, activeInventory]);

  const processFile = async (file?: File) => {
    if (!file) return;
    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith(".xlsx") && !lowerName.endsWith(".xls") && !lowerName.endsWith(".csv")) {
      toast.error("Seleccione un archivo Excel (.xlsx, .xls) o archivo .csv");
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
    try {
      const products = await immunizationApi.getProducts(true);
      const nextPreview = await parseImmunizationInventoryExcel(
        file,
        products,
        activeInventory?.status === "DRAFT" ? inventoryItems : undefined
      );
      setPreview(nextPreview);
      setIsImportModalOpen(true);
      if (products.length === 0) {
        toast.warning("El catálogo biológico está vacío. Debe cargarlo antes de importar el inventario.");
      }
    } catch (error: any) {
      toast.error(error?.message || "No se pudo leer el archivo Excel");
    } finally {
      setProcessingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleConfirmImportFromModal = async (
    selectedRows: ImmunizationImportRow[],
    mode: "SKIP_EXISTING" | "UPDATE_EXISTING"
  ) => {
    if (selectedRows.length === 0) {
      toast.warning("No hay registros seleccionados para guardar");
      return;
    }
    if (!canSaveForScope || !effectiveScope.ownerType) {
      toast.error("Para guardar, el usuario debe estar vinculado a una UNGET o IPRESS");
      return;
    }
    if (activeInventory && activeInventory.status === "CLOSED") {
      toast.error("El inventario inicial ya se encuentra cerrado");
      return;
    }

    setSaving(true);
    try {
      const newItems = toInventoryItems(selectedRows);
      let itemsToSave: ImmunizationInitialInventoryItem[];

      if (activeInventory?.id && activeInventory.status === "DRAFT") {
        if (mode === "SKIP_EXISTING") {
          // Combinar items existentes del borrador con los nuevos seleccionados que no existían
          const existingMap = new Map<string, ImmunizationInitialInventoryItem>();
          inventoryItems.forEach(item => {
            const key = getItemUniqueCompositeKey(item);
            existingMap.set(key, item);
          });
          newItems.forEach(item => {
            const key = getItemUniqueCompositeKey(item);
            if (!existingMap.has(key)) {
              existingMap.set(key, item);
            }
          });
          itemsToSave = Array.from(existingMap.values());
        } else {
          // En modo UPDATE_EXISTING: los nuevos items del Excel sobreescriben los coincidentes
          const existingMap = new Map<string, ImmunizationInitialInventoryItem>();
          inventoryItems.forEach(item => {
            const key = getItemUniqueCompositeKey(item);
            existingMap.set(key, item);
          });
          newItems.forEach(item => {
            const key = getItemUniqueCompositeKey(item);
            existingMap.set(key, item);
          });
          itemsToSave = Array.from(existingMap.values());
        }
      } else {
        itemsToSave = newItems;
      }

      let result: { success: boolean; inventory?: ImmunizationInitialInventory; message?: string };

      if (activeInventory?.id && activeInventory.status === "DRAFT") {
        result = await immunizationApi.replaceInitialInventoryDraft(activeInventory.id, itemsToSave, user?.username);
      } else {
        result = await immunizationApi.createInitialInventory({
          ownerType: effectiveScope.ownerType,
          ungetId: effectiveScope.ownerType === "UNGET" ? effectiveScope.ungetId : undefined,
          facilityCode: effectiveScope.ownerType === "IPRESS" ? effectiveScope.facilityCode : undefined,
          period: currentPeriod,
          status: "DRAFT",
          sourceType: "EXCEL",
          createdBy: user?.username
        }, itemsToSave);
      }

      if (!result.success) {
        toast.error(result.message || "No se pudo guardar el inventario");
        return;
      }

      toast.success(
        activeInventory
          ? `Inventario inicial actualizado exitosamente con ${itemsToSave.length} registros guardados.`
          : `Inventario inicial guardado exitosamente con ${itemsToSave.length} productos.`
      );
      setIsImportModalOpen(false);
      setPreview(null);
      await loadInventories();
    } catch (error: any) {
      toast.error(error?.message || "Error al guardar el inventario");
    } finally {
      setSaving(false);
    }
  };

  const handleDiscardDraft = async () => {
    if (!activeInventory?.id || activeInventory.status !== "DRAFT") return;
    setDiscardingDraft(true);
    try {
      const res = await immunizationApi.deleteInitialInventoryDraft(activeInventory.id);
      if (!res.success) {
        toast.error(res.message || "No se pudo descartar el borrador");
        return;
      }
      toast.success("Borrador de inventario descartado correctamente.");
      setShowDiscardConfirm(false);
      await loadInventories();
    } catch (error: any) {
      toast.error(error?.message || "Error al descartar el borrador");
    } finally {
      setDiscardingDraft(false);
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

  const saveManualItem = async (form: InventoryItemFormData, forceConfirm?: boolean) => {
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

    if (!editingItem && !forceConfirm) {
      const targetKey = getItemUniqueCompositeKey(item);
      const existing = inventoryItems.find(i => getItemUniqueCompositeKey(i) === targetKey);
      if (existing) {
        setManualDuplicatePrompt({
          existingItem: existing,
          newItem: item,
          productName: product.descripcion,
          addQuantity: form.quantity,
          newTotalQuantity: existing.quantity + form.quantity
        });
        return;
      }

      // Check for similar lot (same product & same lot, but different secondary data)
      const existingSimilar = inventoryItems.find(i =>
        (i.productId === item.productId || i.codigoSismedSnapshot === item.codigoSismedSnapshot) &&
        i.lote.trim().toUpperCase() === item.lote.trim().toUpperCase()
      );

      if (existingSimilar) {
        const diffs: string[] = [];
        if (existingSimilar.expirationDate !== item.expirationDate) {
          diffs.push(`Vencimiento (${formatImmunizationDate(existingSimilar.expirationDate)} vs ${formatImmunizationDate(item.expirationDate)})`);
        }
        if (Number(existingSimilar.unitPrice).toFixed(2) !== Number(item.unitPrice).toFixed(2)) {
          diffs.push(`Precio Unitario (S/ ${Number(existingSimilar.unitPrice).toFixed(2)} vs S/ ${Number(item.unitPrice).toFixed(2)})`);
        }
        if (existingSimilar.fundingSource !== item.fundingSource) {
          diffs.push(`Fuente (${existingSimilar.fundingSource} vs ${item.fundingSource})`);
        }
        if (existingSimilar.supplyType !== item.supplyType) {
          diffs.push(`Suministro (${existingSimilar.supplyType} vs ${item.supplyType})`);
        }

        if (diffs.length > 0) {
          setSimilarLotePrompt({
            existingItem: existingSimilar,
            newItem: item,
            formData: form,
            productName: product.descripcion,
            addQuantity: form.quantity,
            diffReason: diffs.join(" • ")
          });
          return;
        }
      }
    }

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
      setManualDuplicatePrompt(null);
      if (activeInventory?.id) await loadInventoryItems(activeInventory.id);
      await loadInventories();
    } finally {
      setManualSaving(false);
    }
  };

  const confirmManualDuplicate = async () => {
    if (!manualDuplicatePrompt || !activeInventory?.id) return;
    const { existingItem, newItem, newTotalQuantity } = manualDuplicatePrompt;
    const mergedObs = [existingItem.observation, newItem.observation].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join("; ");
    const updatedItem: ImmunizationInitialInventoryItem = {
      ...existingItem,
      quantity: newTotalQuantity,
      observation: mergedObs || undefined
    };

    setManualSaving(true);
    try {
      const result = await immunizationApi.saveInitialInventoryItem(activeInventory.id, updatedItem);
      if (!result.success) {
        toast.error(result.message || "No se pudo actualizar el stock");
        return;
      }
      toast.success(`Stock aumentado a ${newTotalQuantity} unidades en el inventario`);
      setManualModalOpen(false);
      setEditingItem(null);
      setManualDuplicatePrompt(null);
      await loadInventoryItems(activeInventory.id);
      await loadInventories();
    } finally {
      setManualSaving(false);
    }
  };

  const confirmMergeSimilarLote = async () => {
    if (!similarLotePrompt || !activeInventory?.id) return;
    const { existingItem, newItem, addQuantity } = similarLotePrompt;
    const newTotalQuantity = existingItem.quantity + addQuantity;
    const mergedObs = [existingItem.observation, newItem.observation].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join("; ");
    const updatedItem: ImmunizationInitialInventoryItem = {
      ...existingItem,
      quantity: newTotalQuantity,
      observation: mergedObs || undefined
    };

    setManualSaving(true);
    try {
      const result = await immunizationApi.saveInitialInventoryItem(activeInventory.id, updatedItem);
      if (!result.success) {
        toast.error(result.message || "No se pudo unificar el lote");
        return;
      }
      toast.success(`Datos unificados al registro existente y stock actualizado a ${newTotalQuantity} unidades`);
      setManualModalOpen(false);
      setEditingItem(null);
      setSimilarLotePrompt(null);
      await loadInventoryItems(activeInventory.id);
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

  return (
    <div className="space-y-4 pb-2 animate-in fade-in duration-300">
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

      {/* KPI Cards Grid */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <ImmunizationKpiCard
          label={activeInventory ? "Cargado en" : "Periodo"}
          value={activeInventory?.period || currentPeriod}
          tone="info"
          icon={<Calendar className="h-5 w-5" />}
        />
        <ImmunizationKpiCard
          label="Productos/lotes"
          value={String(kpiProductsCount)}
          tone="success"
          icon={<Package className="h-5 w-5" />}
        />
        <ImmunizationKpiCard
          label="Frascos/unidades"
          value={kpiTotalQuantity.toLocaleString("es-PE")}
          tone="info"
          icon={<Activity className="h-5 w-5" />}
        />
        <ImmunizationKpiCard
          label="Valorización"
          value={currencyFormatter.format(kpiTotalValue)}
          tone="neutral"
          icon={<Coins className="h-5 w-5" />}
        />
        <ImmunizationKpiCard
          label="Estado"
          value={kpiStatusLabel}
          tone={kpiStatusTone}
          icon={<LockKeyhole className="h-5 w-5" />}
        />
      </section>

      <div className="w-full">
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden w-full">
          <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">{activeInventory ? "Detalle del inventario" : "Carga desde Excel"}</h3>
              <p className="text-xs text-slate-500 mt-0.5">{activeInventory ? "Revisa los productos guardados antes de cerrar y generar el stock." : "Primero validaremos las filas; nada se guarda automaticamente."}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {activeInventory && activeInventory.status === "CLOSED" && (
                <span className="text-[10px] font-black uppercase px-2.5 py-1.5 rounded-lg border bg-emerald-50 text-emerald-700 border-emerald-100 shrink-0">
                  Cerrado
                </span>
              )}

              {/* Dropdown de Opciones Excel */}
              <div className="relative shrink-0" ref={excelMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsExcelMenuOpen(prev => !prev)}
                  className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-700 text-xs sm:text-sm font-bold hover:bg-slate-50 hover:border-slate-400 shadow-2xs transition-colors shrink-0"
                  title="Opciones de plantilla, importación y gestión de archivo Excel"
                >
                  <FileSpreadsheet className="h-4 w-4 text-teal-600" />
                  <span>Opciones Excel</span>
                  <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${isExcelMenuOpen ? "rotate-180 text-teal-600" : ""}`} />
                </button>

                {isExcelMenuOpen && (
                  <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white border border-slate-200 shadow-xl p-1.5 z-30 animate-in fade-in slide-in-from-top-2 duration-150">
                    <button
                      type="button"
                      onClick={() => {
                        setIsExcelMenuOpen(false);
                        downloadImmunizationInventoryTemplate();
                      }}
                      className="w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <Download className="h-4 w-4 text-teal-600 shrink-0" />
                      <div className="flex flex-col">
                        <span>Descargar Plantilla</span>
                        <span className="text-[10px] font-normal text-slate-400">Formato oficial .xlsx</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsExcelMenuOpen(false);
                        fileInputRef.current?.click();
                      }}
                      disabled={!canSaveForScope || processingFile || inventoryIsClosed}
                      className="w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-teal-800 hover:bg-teal-50 transition-colors disabled:opacity-50 disabled:pointer-events-none"
                    >
                      <Upload className="h-4 w-4 text-teal-600 shrink-0" />
                      <div className="flex flex-col">
                        <span>{activeInventory ? "Reimportar / Cargar Excel" : "Cargar archivo Excel"}</span>
                        <span className="text-[10px] font-normal text-slate-400">Actualizar borrador desde .xlsx</span>
                      </div>
                    </button>

                    {activeInventory && activeInventory.status === "DRAFT" && (
                      <>
                        <div className="my-1 border-t border-slate-100" />
                        <button
                          type="button"
                          onClick={() => {
                            setIsExcelMenuOpen(false);
                            setShowDiscardConfirm(true);
                          }}
                          disabled={!canSaveForScope || discardingDraft || closing}
                          className="w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-rose-700 hover:bg-rose-50 transition-colors disabled:opacity-50 disabled:pointer-events-none"
                        >
                          <Trash2 className="h-4 w-4 text-rose-600 shrink-0" />
                          <div className="flex flex-col">
                            <span>Descartar borrador</span>
                            <span className="text-[10px] font-normal text-rose-400">Eliminar registros del periodo</span>
                          </div>
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Botón Registro Manual */}
              <button
                type="button"
                onClick={() => void openManualItemModal()}
                disabled={!canSaveForScope || inventoryIsClosed || manualSaving}
                className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border border-teal-300 bg-teal-50/80 text-teal-900 text-xs sm:text-sm font-bold hover:bg-teal-100 hover:border-teal-400 shadow-2xs transition-colors shrink-0 disabled:opacity-50 disabled:pointer-events-none"
                title={inventoryIsClosed ? "El inventario ya está cerrado." : "Agrega un producto o lote puntual al borrador antes del cierre."}
              >
                <PackagePlus className="h-4 w-4 text-teal-700" />
                <span>Registro manual</span>
              </button>

              {/* Botón Cerrar y Generar Stock */}
              <button
                type="button"
                onClick={requestCloseInventory}
                disabled={!activeInventory || activeInventory.status === "CLOSED" || inventoryItems.length === 0 || loadingItems || closing}
                className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all border shadow-sm shrink-0 ${
                  activeInventory?.status === "CLOSED"
                    ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                    : "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-emerald-700/20 disabled:opacity-50 disabled:pointer-events-none"
                }`}
                title={activeInventory?.status === "CLOSED" ? "El inventario ya fue cerrado." : "Confirma el borrador y genera el stock biológico por lote."}
              >
                {closing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
                <span>
                  {activeInventory?.status === "CLOSED"
                    ? "Inventario cerrado"
                    : closing
                      ? "Cerrando..."
                      : "Cerrar y generar stock"}
                </span>
              </button>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
            className="hidden"
            onChange={event => void processFile(event.target.files?.[0])}
          />

          {loading && !activeInventory ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2">
              <div className="h-9 w-9 rounded-full border-2 border-teal-500 border-t-transparent animate-spin" />
              <span className="text-xs font-bold text-slate-500">Cargando inventario...</span>
            </div>
          ) : (
            <div className={loading ? "opacity-60 pointer-events-none transition-opacity duration-200" : "transition-opacity duration-200"}>
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
            </div>
          )}
        </section>
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
        isOpen={Boolean(manualDuplicatePrompt)}
        title="¡Producto y Lote ya existe en el inventario!"
        description={`El producto "${manualDuplicatePrompt?.productName}" (SISMED: ${manualDuplicatePrompt?.existingItem.codigoSismedSnapshot}, Lote: ${manualDuplicatePrompt?.existingItem.lote}) con el mismo precio (S/ ${manualDuplicatePrompt?.existingItem.unitPrice.toFixed(2)}), fuente (${manualDuplicatePrompt?.existingItem.fundingSource}) y suministro (${manualDuplicatePrompt?.existingItem.supplyType}) ya se encuentra registrado.`}
        confirmLabel="Sí, aumentar stock"
        cancelLabel="Cancelar"
        tone="warning"
        isConfirming={manualSaving}
        onCancel={() => setManualDuplicatePrompt(null)}
        onConfirm={() => void confirmManualDuplicate()}
      >
        {manualDuplicatePrompt && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-xs text-amber-950 space-y-2">
            <p className="font-bold text-amber-900 text-sm">¿Deseas aumentar el stock de este registro?</p>
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between border-b border-amber-200/80 pb-1">
                <span className="text-slate-600">Stock actual en inventario:</span>
                <span className="font-mono font-bold text-slate-800">{manualDuplicatePrompt.existingItem.quantity} unidades</span>
              </div>
              <div className="flex justify-between border-b border-amber-200/80 pb-1">
                <span className="text-slate-600">Stock adicional a ingresar:</span>
                <span className="font-mono font-bold text-emerald-700">+{manualDuplicatePrompt.addQuantity} unidades</span>
              </div>
              <div className="flex justify-between pt-1 font-black text-slate-900 text-sm">
                <span>Nuevo stock resultante:</span>
                <span className="font-mono text-emerald-700">{manualDuplicatePrompt.newTotalQuantity} unidades</span>
              </div>
            </div>
          </div>
        )}
      </ConfirmationDialog>

      {similarLotePrompt && createPortal(
        <div
          className="fixed inset-0 z-[1200000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200"
          onMouseDown={event => {
            if (event.target === event.currentTarget && !manualSaving) setSimilarLotePrompt(null);
          }}
        >
          <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-white/80 space-y-4 animate-in zoom-in-95 slide-in-from-bottom-3 duration-200">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">¡Doble Validación! Lote similar en inventario</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  El lote <strong className="text-slate-800 font-mono">{similarLotePrompt.existingItem.lote}</strong> de <strong>{similarLotePrompt.productName}</strong> ya existe en la lista pero tiene diferencias.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-xs space-y-3">
              <div className="font-bold text-amber-950 border-b border-amber-200/80 pb-2">
                Diferencias detectadas: <span className="text-amber-900 font-normal">{similarLotePrompt.diffReason}</span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                {(() => {
                  const isExpDiff = similarLotePrompt.existingItem.expirationDate !== similarLotePrompt.newItem.expirationDate;
                  const isPriceDiff = Number(similarLotePrompt.existingItem.unitPrice).toFixed(2) !== Number(similarLotePrompt.newItem.unitPrice).toFixed(2);
                  const isFundingDiff = similarLotePrompt.existingItem.fundingSource !== similarLotePrompt.newItem.fundingSource;
                  const isSupplyDiff = similarLotePrompt.existingItem.supplyType !== similarLotePrompt.newItem.supplyType;

                  return (
                    <>
                      <div className="rounded-xl bg-white p-3 border border-amber-200/80 shadow-2xs space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Registro Existente</p>
                        <p className={`text-xs ${isExpDiff ? "font-black text-amber-800" : "font-semibold text-slate-700"}`}>
                          Venc: {formatImmunizationDate(similarLotePrompt.existingItem.expirationDate)}
                        </p>
                        <p className={`text-xs ${isPriceDiff ? "font-black text-amber-800" : "font-semibold text-slate-700"}`}>
                          Precio: S/ {Number(similarLotePrompt.existingItem.unitPrice).toFixed(2)}
                        </p>
                        <p className={`text-[11px] ${isFundingDiff ? "font-bold text-amber-800" : "text-slate-600"}`}>
                          Fuente: {similarLotePrompt.existingItem.fundingSource}
                        </p>
                        <p className={`text-[11px] ${isSupplyDiff ? "font-bold text-amber-800" : "text-slate-600"}`}>
                          Suministro: {similarLotePrompt.existingItem.supplyType}
                        </p>
                        <p className="text-xs font-bold text-teal-700 pt-1.5 border-t border-slate-100">Stock actual: {similarLotePrompt.existingItem.quantity} un.</p>
                      </div>

                      <div className="rounded-xl bg-white p-3 border border-amber-200/80 shadow-2xs space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Nuevo a Ingresar</p>
                        <p className={`text-xs ${isExpDiff ? "font-black text-red-600 bg-red-50 px-1 rounded" : "font-semibold text-slate-700"}`}>
                          Venc: {formatImmunizationDate(similarLotePrompt.newItem.expirationDate)}
                        </p>
                        <p className={`text-xs ${isPriceDiff ? "font-black text-red-600 bg-red-50 px-1 rounded" : "font-semibold text-slate-700"}`}>
                          Precio: S/ {Number(similarLotePrompt.newItem.unitPrice).toFixed(2)}
                        </p>
                        <p className={`text-[11px] ${isFundingDiff ? "font-bold text-red-600 bg-red-50 px-1 rounded" : "text-slate-600"}`}>
                          Fuente: {similarLotePrompt.newItem.fundingSource}
                        </p>
                        <p className={`text-[11px] ${isSupplyDiff ? "font-bold text-red-600 bg-red-50 px-1 rounded" : "text-slate-600"}`}>
                          Suministro: {similarLotePrompt.newItem.supplyType}
                        </p>
                        <p className="text-xs font-bold text-emerald-700 pt-1.5 border-t border-slate-100">A ingresar: +{similarLotePrompt.addQuantity} un.</p>
                      </div>
                    </>
                  );
                })()}
              </div>

              <p className="text-[11px] text-amber-900 italic pt-1">
                ¿Fue una equivocación al digitar? Puedes adoptar los datos del registro existente y unificar el stock a {similarLotePrompt.existingItem.quantity + similarLotePrompt.addQuantity} unidades, o guardar esta fila con sus datos independientes.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                disabled={manualSaving}
                onClick={() => void confirmMergeSimilarLote()}
                className="w-full h-11 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs transition-all shadow-sm flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Adoptar datos del registro existente y unificar stock ({similarLotePrompt.existingItem.quantity + similarLotePrompt.addQuantity} un.)</span>
              </button>

              <button
                type="button"
                disabled={manualSaving}
                onClick={() => {
                  const form = similarLotePrompt.formData;
                  setSimilarLotePrompt(null);
                  void saveManualItem(form, true);
                }}
                className="w-full h-10 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-all border border-slate-200 flex items-center justify-center gap-2"
              >
                <span>Guardar como registro independiente con sus datos</span>
              </button>

              <button
                type="button"
                disabled={manualSaving}
                onClick={() => setSimilarLotePrompt(null)}
                className="w-full h-9 px-4 text-slate-500 hover:text-slate-700 font-bold text-xs transition-all"
              >
                Cancelar y editar en el formulario
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

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

      <ConfirmationDialog
        isOpen={showDiscardConfirm}
        title="¿Descartar borrador de inventario?"
        description="Se eliminarán todos los productos y lotes guardados en este borrador. Podrás subir un nuevo archivo Excel desde cero o registrar manualmente."
        confirmLabel="Sí, descartar borrador"
        cancelLabel="Cancelar"
        tone="danger"
        isConfirming={discardingDraft}
        onCancel={() => setShowDiscardConfirm(false)}
        onConfirm={() => void handleDiscardDraft()}
      >
        {activeInventory && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4 text-xs text-rose-800">
            <p className="font-bold">Periodo: {activeInventory.period}</p>
            <p className="mt-1 font-medium">Se descartarán {inventoryItems.length} ítems guardados temporalmente.</p>
          </div>
        )}
      </ConfirmationDialog>

      <ImmunizationInitialInventoryImportModal
        isOpen={isImportModalOpen}
        preview={preview}
        isSubmitting={saving}
        onClose={() => {
          if (!saving) {
            setIsImportModalOpen(false);
            setPreview(null);
          }
        }}
        onConfirmImport={(selectedRows, mode) => void handleConfirmImportFromModal(selectedRows, mode)}
      />
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
  const [searchTerm, setSearchTerm] = useState("");
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalValue = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  const filteredItems = useMemo(() => {
    const query = normalizeImmunizationText(searchTerm);
    if (!query) return items;
    return items.filter(item => {
      const code = normalizeImmunizationText(item.product?.codigoSismed || item.codigoSismedSnapshot || "");
      const desc = normalizeImmunizationText(item.product?.descripcion || item.excelDescriptionSnapshot || "");
      const lote = normalizeImmunizationText(item.lote || "");
      const fuente = normalizeImmunizationText(item.fundingSource || "");
      return code.includes(query) || desc.includes(query) || lote.includes(query) || fuente.includes(query);
    });
  }, [items, searchTerm]);

  if (loading && items.length === 0) {
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
    <div className={loading ? "opacity-60 pointer-events-none transition-opacity duration-200" : "transition-opacity duration-200"}>
      <div className="p-3 bg-white border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar por código SISMED, descripción o lote..."
            className="w-full h-9 pl-9 pr-8 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 outline-none focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-100"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm("")} className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="text-xs text-slate-500 font-medium shrink-0">
          Mostrando <span className="font-bold text-slate-800">{filteredItems.length}</span> de <span className="font-bold text-slate-800">{items.length}</span> ítems
        </div>
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
            {filteredItems.map(item => (
              <tr key={item.id || `${item.productId}-${item.lote}-${item.unitPrice}`} className="bg-white hover:bg-slate-50">
                <td className="px-3 py-3 font-black text-teal-700">{item.product?.codigoSismed || item.codigoSismedSnapshot}</td>
                <td className="px-3 py-3 font-semibold text-slate-800">{item.product?.descripcion || item.excelDescriptionSnapshot || "Producto"}</td>
                <td className="px-3 py-3 font-black text-slate-700">{item.lote}</td>
                <td className="px-3 py-3 text-slate-600">{formatImmunizationDate(item.expirationDate)}</td>
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
        {filteredItems.length === 0 && (
          <div className="p-8 text-center text-xs text-slate-500">
            No se encontraron ítems que coincidan con la búsqueda &quot;{searchTerm}&quot;.
          </div>
        )}
      </div>

      <div className="p-4 border-t border-slate-100 flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          {inventory.status === "CLOSED" ? "Este inventario ya genero el stock biologico." : "Al cerrar, estas filas se convertiran en stock disponible por lote."}
        </p>
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
  const availableFacilities = useMemo(() => {
    return ungetId
      ? facilities.filter(facility => facility.ungetId === ungetId)
      : [];
  }, [facilities, ungetId]);

  const ownerTypeOptions = useMemo(() => [
    { value: "", label: "Seleccionar nivel..." },
    { value: "UNGET", label: "UNGET" },
    { value: "IPRESS", label: "IPRESS" }
  ], []);

  const ungetOptions = useMemo(() => [
    { value: "", label: "Seleccionar UNGET..." },
    ...ungets.map(unget => ({
      value: unget.id,
      label: unget.name
    }))
  ], [ungets]);

  const facilityOptions = useMemo(() => [
    { value: "", label: ungetId ? "Seleccionar IPRESS..." : "Seleccione primero una UNGET..." },
    ...availableFacilities.map(facility => ({
      value: facility.code,
      label: `${facility.code} - ${facility.name}`
    }))
  ], [availableFacilities, ungetId]);

  return (
    <section className="bg-white rounded-2xl border border-cyan-200 shadow-sm p-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end">
        <div className="xl:w-60">
          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
            Inventario perteneciente a
          </label>
          <CustomSelect
            value={ownerType}
            onChange={val => onOwnerTypeChange(val as ImmunizationOwnerType | "")}
            options={ownerTypeOptions}
            disabled={loading}
            placeholder="Seleccionar nivel..."
            className="h-11 rounded-xl text-sm font-bold text-slate-800"
          />
        </div>

        {ownerType && (
          <div className="min-w-0 flex-1">
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
              UNGET propietaria
            </label>
            <CustomSelect
              value={ungetId}
              onChange={onUngetChange}
              options={ungetOptions}
              disabled={loading}
              placeholder="Seleccionar UNGET..."
              className="h-11 rounded-xl text-sm font-semibold text-slate-800"
              loading={loading}
            />
          </div>
        )}

        {ownerType === "IPRESS" && (
          <div className="min-w-0 flex-1">
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
              Establecimiento IPRESS
            </label>
            <CustomSelect
              value={facilityCode}
              onChange={onFacilityChange}
              options={facilityOptions}
              disabled={loading || !ungetId}
              placeholder={ungetId ? "Seleccionar IPRESS..." : "Seleccione primero UNGET..."}
              className="h-11 rounded-xl text-sm font-semibold text-slate-800"
              loading={loading}
            />
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
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "VALID" | "ERROR" | "WARNING">("ALL");

  const filteredRows = useMemo(() => {
    return preview.rows.filter(row => {
      if (statusFilter === "VALID" && (row.errors.length > 0 || row.warnings.length > 0)) return false;
      if (statusFilter === "ERROR" && row.errors.length === 0) return false;
      if (statusFilter === "WARNING" && row.warnings.length === 0) return false;
      if (!searchTerm.trim()) return true;
      const query = normalizeImmunizationText(searchTerm);
      const code = normalizeImmunizationText(row.codigoSismed || "");
      const desc = normalizeImmunizationText(row.officialDescription || "");
      const lote = normalizeImmunizationText(row.lote || "");
      return code.includes(query) || desc.includes(query) || lote.includes(query);
    });
  }, [preview.rows, searchTerm, statusFilter]);

  return (
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

      <div className="p-3 bg-white border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar en vista previa por SISMED, descripción o lote..."
            className="w-full h-9 pl-9 pr-8 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 outline-none focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-100"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm("")} className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-bold shrink-0">
          <button
            type="button"
            onClick={() => setStatusFilter("ALL")}
            className={`px-3 py-1.5 rounded-lg border transition-all ${statusFilter === "ALL" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
          >
            Todas ({preview.rows.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("VALID")}
            className={`px-3 py-1.5 rounded-lg border transition-all ${statusFilter === "VALID" ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-emerald-700 border-slate-200 hover:bg-emerald-50"}`}
          >
            Válidas ({validCount})
          </button>
          {invalidCount > 0 && (
            <button
              type="button"
              onClick={() => setStatusFilter("ERROR")}
              className={`px-3 py-1.5 rounded-lg border transition-all ${statusFilter === "ERROR" ? "bg-red-600 text-white border-red-600" : "bg-white text-red-700 border-slate-200 hover:bg-red-50"}`}
            >
              Con errores ({invalidCount})
            </button>
          )}
          {warningCount > 0 && (
            <button
              type="button"
              onClick={() => setStatusFilter("WARNING")}
              className={`px-3 py-1.5 rounded-lg border transition-all ${statusFilter === "WARNING" ? "bg-amber-600 text-white border-amber-600" : "bg-white text-amber-700 border-slate-200 hover:bg-amber-50"}`}
            >
              Advertencias ({warningCount})
            </button>
          )}
        </div>
      </div>

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
            {filteredRows.map(row => (
              <tr key={row.rowNumber} className={row.errors.length ? "bg-red-50/50" : "bg-white hover:bg-slate-50"}>
                <td className="px-3 py-3 font-bold text-slate-400">{row.rowNumber}</td>
                <td className="px-3 py-3 font-black text-slate-800">{row.codigoSismed || "—"}</td>
                <td className="px-3 py-3 text-slate-700">{row.officialDescription}</td>
                <td className="px-3 py-3 font-semibold text-slate-700">{row.lote || "—"}</td>
                <td className="px-3 py-3 text-slate-600">{row.expirationDate ? formatImmunizationDate(row.expirationDate) : "—"}</td>
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
        {filteredRows.length === 0 && <div className="p-10 text-center text-sm text-slate-500">No se encontraron filas de inventario con los filtros seleccionados.</div>}
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
};

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
