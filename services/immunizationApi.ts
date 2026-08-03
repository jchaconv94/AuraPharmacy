import {
  ImmunizationAdjustment,
  ImmunizationAdjustmentItem,
  ImmunizationConsumptionBatchInput,
  ImmunizationConsumptionInput,
  ImmunizationDistributionBatch,
  ImmunizationDistributionItem,
  ImmunizationIncomeBatch,
  ImmunizationIncomeItem,
  ImmunizationIncomeOrigin,
  ImmunizationInitialInventory,
  ImmunizationInitialInventoryItem,
  ImmunizationMonthlyClosure,
  ImmunizationMonthlyClosureOwnerType,
  ImmunizationOwnerType,
  ImmunizationProduct,
  ImmunizationReceptionInput,
  ImmunizationReturnBatch,
  ImmunizationReturnItem,
  ImmunizationReturnReceptionInput,
  ImmunizationStockLayer,
  ImmunizationStockMovement,
  User
} from "../types";
import { supabase } from "./supabaseClient";

const PRODUCTS_CACHE_KEY = "aura_immunization_products";
const INVENTORIES_CACHE_KEY = "aura_immunization_initial_inventories";
const INVENTORY_ITEMS_CACHE_KEY = "aura_immunization_initial_inventory_items";
const STOCK_CACHE_KEY = "aura_immunization_stock_layers";
const MOVEMENTS_CACHE_KEY = "aura_immunization_stock_movements";
const INCOME_BATCHES_CACHE_KEY = "aura_immunization_income_batches";
const INCOME_ITEMS_CACHE_KEY = "aura_immunization_income_items";
const INCOME_ORIGINS_CACHE_KEY = "aura_immunization_income_origins";
const DISTRIBUTION_BATCHES_CACHE_KEY = "aura_immunization_distribution_batches";
const DISTRIBUTION_ITEMS_CACHE_KEY = "aura_immunization_distribution_items";
const RETURN_BATCHES_CACHE_KEY = "aura_immunization_return_batches";
const RETURN_ITEMS_CACHE_KEY = "aura_immunization_return_items";
const ADJUSTMENTS_CACHE_KEY = "aura_immunization_adjustments";
const ADJUSTMENT_ITEMS_CACHE_KEY = "aura_immunization_adjustment_items";
const MONTHLY_CLOSURES_CACHE_KEY = "aura_immunization_monthly_closures";
const DEFAULT_REGIONAL_WAREHOUSE_ID = "DIRESA_SAN_MARTIN_REGIONAL";

export interface ImmunizationScope {
  level: "GLOBAL" | "DIRESA" | "OGESS" | "UNGET" | "MICRORED" | "IPRESS";
  ownerType?: ImmunizationOwnerType;
  diresaId?: string;
  ogessId?: string;
  ungetId?: string;
  ungetIds?: string[];
  microredId?: string;
  facilityCode?: string;
  facilityCodes?: string[];
}

const getCachedList = <T,>(key: string): T[] => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T[] : [];
  } catch {
    return [];
  }
};

const setCachedList = <T,>(key: string, value: T[]) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn("No se pudo guardar cache local de inmunizaciones", e);
  }
};

const makeLocalId = (prefix: string) => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
};

const normalizeProduct = (row: any): ImmunizationProduct => ({
  id: row.id,
  codigoSismed: row.codigo_sismed,
  descripcion: row.descripcion,
  tipoProducto: row.tipo_producto,
  dosisUnidad: Number(row.dosis_unidad) || 0,
  isActive: row.is_active !== false,
  observacion: row.observacion || undefined,
  createdBy: row.created_by || undefined,
  updatedBy: row.updated_by || undefined,
  createdAt: row.created_at || undefined,
  updatedAt: row.updated_at || undefined
});

const normalizeInventory = (row: any): ImmunizationInitialInventory => ({
  id: row.id,
  ownerType: row.owner_type,
  ungetId: row.unget_id || undefined,
  facilityCode: row.facility_code || undefined,
  period: row.period,
  status: row.status,
  sourceType: row.source_type,
  createdBy: row.created_by || undefined,
  closedBy: row.closed_by || undefined,
  closedAt: row.closed_at || undefined,
  createdAt: row.created_at || undefined,
  updatedAt: row.updated_at || undefined
});

const normalizeStockLayer = (row: any): ImmunizationStockLayer => {
  const productRow = Array.isArray(row.product) ? row.product[0] : row.product;
  return {
    id: row.id,
    ownerType: row.owner_type,
    regionalWarehouseId: row.regional_warehouse_id || row.regionalWarehouseId || undefined,
    ungetId: row.unget_id || undefined,
    facilityCode: row.facility_code || undefined,
    productId: row.product_id,
    product: productRow ? normalizeProduct(productRow) : undefined,
    lote: row.lote,
    expirationDate: row.expiration_date,
    unitPrice: Number(row.unit_price) || 0,
    fundingSource: row.funding_source,
    supplyType: row.supply_type,
    sourceMovementId: row.source_movement_id || undefined,
    currentQuantity: Number(row.current_quantity) || 0,
    isActive: row.is_active !== false,
    createdAt: row.created_at || undefined,
    updatedAt: row.updated_at || undefined
  };
};

const extractConsumptionBatchId = (observation?: string) => {
  if (!observation) return undefined;
  const match = observation.match(/Registro consumo:\s*([^|]+)/i);
  return match?.[1]?.trim();
};

const normalizeStockMovement = (row: any): ImmunizationStockMovement => ({
  id: row.id,
  movementType: row.movement_type || row.movementType,
  ownerType: row.owner_type || row.ownerType,
  regionalWarehouseId: row.regional_warehouse_id || row.regionalWarehouseId || undefined,
  ungetId: row.unget_id || row.ungetId || undefined,
  facilityCode: row.facility_code || row.facilityCode || undefined,
  productId: row.product_id || row.productId,
  stockLayerId: row.stock_layer_id || row.stockLayerId || undefined,
  quantityDelta: Number(row.quantity_delta ?? row.quantityDelta) || 0,
  quantityBefore: Number(row.quantity_before ?? row.quantityBefore) || 0,
  quantityAfter: Number(row.quantity_after ?? row.quantityAfter) || 0,
  period: row.period,
  reason: row.reason || undefined,
  observation: row.observation || undefined,
  batchId: row.batch_id || row.batchId || extractConsumptionBatchId(row.observation),
  consumedDoses: row.consumed_doses !== undefined ? Number(row.consumed_doses) || 0 : row.consumedDoses,
  dosesApplied: row.doses_applied !== undefined ? Number(row.doses_applied) || 0 : row.dosesApplied,
  dosesLost: row.doses_lost !== undefined ? Number(row.doses_lost) || 0 : row.dosesLost,
  lossFactor: row.loss_factor !== undefined ? Number(row.loss_factor) || 0 : row.lossFactor,
  createdBy: row.created_by || row.createdBy || undefined,
  createdAt: row.created_at || row.createdAt || undefined
});

const normalizeInventoryItem = (row: any): ImmunizationInitialInventoryItem => {
  const productRow = Array.isArray(row.product) ? row.product[0] : row.product;
  return {
    id: row.id,
    inventoryId: row.inventory_id,
    productId: row.product_id,
    codigoSismedSnapshot: row.codigo_sismed_snapshot,
    excelDescriptionSnapshot: row.excel_description_snapshot || undefined,
    lote: row.lote,
    expirationDate: row.expiration_date,
    quantity: Number(row.quantity) || 0,
    unitPrice: Number(row.unit_price) || 0,
    fundingSource: row.funding_source,
    supplyType: row.supply_type,
    observation: row.observation || undefined,
    product: productRow ? normalizeProduct(productRow) : undefined
  };
};

const normalizeIncomeOrigin = (row: any): ImmunizationIncomeOrigin => ({
  id: row.id,
  name: row.name,
  isActive: row.is_active !== false,
  createdBy: row.created_by || undefined,
  updatedBy: row.updated_by || undefined,
  createdAt: row.created_at || undefined,
  updatedAt: row.updated_at || undefined
});

const defaultIncomeOrigins = (): ImmunizationIncomeOrigin[] => [
  {
    id: "default-cenares",
    name: "CENARES",
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "default-ogess",
    name: "OGESS",
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

const saveLocalIncomeOrigin = (origin: ImmunizationIncomeOrigin): { success: boolean; origin?: ImmunizationIncomeOrigin; message?: string } => {
  const name = origin.name.trim();
  if (!name) return { success: false, message: "Ingrese el nombre del origen." };
  const now = new Date().toISOString();
  const cached = getCachedList<ImmunizationIncomeOrigin>(INCOME_ORIGINS_CACHE_KEY);
  const baseRows = cached.length > 0 ? cached : defaultIncomeOrigins();
  const existingByIdIndex = origin.id ? baseRows.findIndex(row => row.id === origin.id) : -1;
  const duplicateIndex = baseRows.findIndex(row =>
    row.name.trim().toLowerCase() === name.toLowerCase() &&
    (!origin.id || row.id !== origin.id)
  );
  if (duplicateIndex >= 0) {
    return { success: false, message: "Ya existe un origen con ese nombre." };
  }
  if (existingByIdIndex >= 0) {
    const updated = {
      ...baseRows[existingByIdIndex],
      name,
      isActive: origin.isActive !== false,
      updatedBy: origin.updatedBy || origin.createdBy,
      updatedAt: now
    };
    const next = baseRows.map((row, index) => index === existingByIdIndex ? updated : row);
    setCachedList(INCOME_ORIGINS_CACHE_KEY, next);
    return { success: true, origin: updated };
  }

  const saved: ImmunizationIncomeOrigin = {
    id: origin.id || makeLocalId("imm-income-origin"),
    name,
    isActive: origin.isActive !== false,
    createdBy: origin.createdBy,
    updatedBy: origin.updatedBy || origin.createdBy,
    createdAt: now,
    updatedAt: now
  };
  setCachedList(INCOME_ORIGINS_CACHE_KEY, [...baseRows, saved]);
  return { success: true, origin: saved };
};

const deleteLocalIncomeOrigin = (id: string, username?: string): { success: boolean; message?: string } => {
  const now = new Date().toISOString();
  const cached = getCachedList<ImmunizationIncomeOrigin>(INCOME_ORIGINS_CACHE_KEY);
  const baseRows = cached.length > 0 ? cached : defaultIncomeOrigins();
  const exists = baseRows.some(row => row.id === id);
  if (!exists) return { success: false, message: "No se encontró el origen de ingreso." };
  setCachedList(INCOME_ORIGINS_CACHE_KEY, baseRows.map(row => row.id === id
    ? { ...row, isActive: false, updatedBy: username, updatedAt: now }
    : row
  ));
  return { success: true };
};

const normalizeIncomeBatch = (row: any): ImmunizationIncomeBatch => ({
  id: row.id,
  ownerType: row.owner_type,
  regionalWarehouseId: row.regional_warehouse_id || undefined,
  ungetId: row.unget_id || undefined,
  period: row.period,
  sourceType: row.source_type,
  sourceUngetId: row.source_unget_id || undefined,
  sourceName: row.source_name || undefined,
  referenceDocument: row.reference_document || undefined,
  incomeDate: row.income_date || undefined,
  status: row.status,
  observation: row.observation || undefined,
  createdBy: row.created_by || undefined,
  appliedBy: row.applied_by || undefined,
  appliedAt: row.applied_at || undefined,
  createdAt: row.created_at || undefined,
  updatedAt: row.updated_at || undefined
});

const normalizeIncomeItem = (row: any): ImmunizationIncomeItem => {
  const productRow = Array.isArray(row.product) ? row.product[0] : row.product;
  return {
    id: row.id,
    incomeId: row.income_id,
    productId: row.product_id,
    codigoSismedSnapshot: row.codigo_sismed_snapshot,
    lote: row.lote,
    expirationDate: row.expiration_date,
    quantity: Number(row.quantity) || 0,
    unitPrice: Number(row.unit_price) || 0,
    fundingSource: row.funding_source,
    supplyType: row.supply_type,
    observation: row.observation || undefined,
    stockLayerId: row.stock_layer_id || undefined,
    product: productRow ? normalizeProduct(productRow) : undefined
  };
};

const normalizeDistributionBatch = (row: any): ImmunizationDistributionBatch => ({
  id: row.id,
  flowType: row.flow_type || (row.destination_owner_type === "UNGET" ? "DIRESA_UNGET" : "UNGET_IPRESS"),
  originOwnerType: row.origin_owner_type || (row.destination_owner_type === "UNGET" ? "DIRESA" : "UNGET"),
  destinationOwnerType: row.destination_owner_type || (row.destination_unget_id ? "UNGET" : "IPRESS"),
  regionalWarehouseId: row.regional_warehouse_id || undefined,
  originUngetId: row.origin_unget_id || undefined,
  destinationUngetId: row.destination_unget_id || undefined,
  ungetId: row.unget_id || row.origin_unget_id || row.destination_unget_id || "",
  destinationFacilityCode: row.destination_facility_code || "",
  period: row.period,
  criterion: row.criterion || "REGULAR",
  status: row.status,
  referenceDocument: row.reference_document || undefined,
  observation: row.observation || undefined,
  createdBy: row.created_by || undefined,
  sentBy: row.sent_by || undefined,
  sentAt: row.sent_at || undefined,
  receivedBy: row.received_by || undefined,
  receivedAt: row.received_at || undefined,
  receptionReason: row.reception_reason || undefined,
  receptionObservation: row.reception_observation || undefined,
  createdAt: row.created_at || undefined,
  updatedAt: row.updated_at || undefined
});

const normalizeDistributionItem = (row: any): ImmunizationDistributionItem => {
  const productRow = Array.isArray(row.product) ? row.product[0] : row.product;
  return {
    id: row.id,
    distributionId: row.distribution_id,
    productId: row.product_id,
    sourceStockLayerId: row.source_stock_layer_id,
    codigoSismedSnapshot: row.codigo_sismed_snapshot,
    lote: row.lote,
    expirationDate: row.expiration_date,
    quantity: Number(row.quantity) || 0,
    unitPrice: Number(row.unit_price) || 0,
    fundingSource: row.funding_source,
    supplyType: row.supply_type,
    observation: row.observation || undefined,
    receivedQuantity: row.received_quantity === null || row.received_quantity === undefined ? undefined : Number(row.received_quantity) || 0,
    destinationStockLayerId: row.destination_stock_layer_id || undefined,
    product: productRow ? normalizeProduct(productRow) : undefined
  };
};

const normalizeReturnBatch = (row: any): ImmunizationReturnBatch => ({
  id: row.id,
  returnType: row.return_type || row.returnType,
  status: row.status,
  originUngetId: row.origin_unget_id || row.originUngetId,
  originFacilityCode: row.origin_facility_code || row.originFacilityCode,
  suggestedDestinationFacilityCode: row.suggested_destination_facility_code || row.suggestedDestinationFacilityCode || undefined,
  period: row.period,
  movementDate: row.movement_date || row.movementDate || undefined,
  referenceDocument: row.reference_document || row.referenceDocument || undefined,
  reason: row.reason,
  observation: row.observation || undefined,
  createdBy: row.created_by || row.createdBy || undefined,
  sentAt: row.sent_at || row.sentAt || undefined,
  receivedBy: row.received_by || row.receivedBy || undefined,
  receivedAt: row.received_at || row.receivedAt || undefined,
  receptionReason: row.reception_reason || row.receptionReason || undefined,
  receptionObservation: row.reception_observation || row.receptionObservation || undefined,
  createdAt: row.created_at || row.createdAt || undefined,
  updatedAt: row.updated_at || row.updatedAt || undefined
});

const normalizeReturnItem = (row: any): ImmunizationReturnItem => {
  const productRow = Array.isArray(row.product) ? row.product[0] : row.product;
  return {
    id: row.id,
    returnId: row.return_id || row.returnId,
    productId: row.product_id || row.productId,
    sourceStockLayerId: row.source_stock_layer_id || row.sourceStockLayerId,
    codigoSismedSnapshot: row.codigo_sismed_snapshot || row.codigoSismedSnapshot,
    lote: row.lote,
    expirationDate: row.expiration_date || row.expirationDate,
    quantity: Number(row.quantity) || 0,
    unitPrice: Number(row.unit_price ?? row.unitPrice) || 0,
    fundingSource: row.funding_source || row.fundingSource,
    supplyType: row.supply_type || row.supplyType,
    observation: row.observation || undefined,
    receivedQuantity: row.received_quantity !== undefined ? Number(row.received_quantity) || 0 : row.receivedQuantity,
    destinationStockLayerId: row.destination_stock_layer_id || row.destinationStockLayerId || undefined,
    product: productRow ? normalizeProduct(productRow) : undefined
  };
};

const normalizeMonthlyClosure = (row: any): ImmunizationMonthlyClosure => ({
  id: row.id,
  ownerType: row.owner_type || row.ownerType,
  period: row.period,
  ungetId: row.unget_id || row.ungetId || undefined,
  facilityCode: row.facility_code || row.facilityCode || undefined,
  status: row.status,
  observation: row.observation || undefined,
  preclosedBy: row.preclosed_by || row.preclosedBy || undefined,
  preclosedAt: row.preclosed_at || row.preclosedAt || undefined,
  closedBy: row.closed_by || row.closedBy || undefined,
  closedAt: row.closed_at || row.closedAt || undefined,
  reopenedBy: row.reopened_by || row.reopenedBy || undefined,
  reopenedAt: row.reopened_at || row.reopenedAt || undefined,
  reopenReason: row.reopen_reason || row.reopenReason || undefined,
  createdAt: row.created_at || row.createdAt || undefined,
  updatedAt: row.updated_at || row.updatedAt || undefined
});

const getIncomeSourceLabel = (sourceType: ImmunizationIncomeBatch["sourceType"]) => {
  if (sourceType === "CENARES") return "Ingreso regional desde CENARES";
  if (sourceType === "OGESS") return "Ingreso desde OGESS";
  if (sourceType === "REGIONAL_WAREHOUSE") return "Ingreso desde almacen regional";
  if (sourceType === "UNGET_TRANSFER") return "Ingreso por transferencia de otra UNGET";
  return "Ingreso externo";
};

const getDistributionFlow = (batch: ImmunizationDistributionBatch) =>
  batch.flowType || (batch.destinationOwnerType === "UNGET" || batch.destinationUngetId ? "DIRESA_UNGET" : "UNGET_IPRESS");

const getDistributionOriginOwner = (batch: ImmunizationDistributionBatch): "DIRESA" | "UNGET" =>
  batch.originOwnerType || (getDistributionFlow(batch) === "DIRESA_UNGET" ? "DIRESA" : "UNGET");

const getDistributionDestinationOwner = (batch: ImmunizationDistributionBatch): "UNGET" | "IPRESS" =>
  batch.destinationOwnerType || (getDistributionFlow(batch) === "DIRESA_UNGET" ? "UNGET" : "IPRESS");

const getDestinationUngetId = (batch: ImmunizationDistributionBatch) =>
  batch.destinationUngetId || (getDistributionFlow(batch) === "DIRESA_UNGET" ? batch.ungetId : undefined);

const getOriginUngetId = (batch: ImmunizationDistributionBatch) =>
  batch.originUngetId || (getDistributionFlow(batch) === "UNGET_IPRESS" ? batch.ungetId : undefined);

const getRegionalWarehouseId = (value?: string) => value || DEFAULT_REGIONAL_WAREHOUSE_ID;

export const getCurrentImmunizationPeriod = () => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${now.getFullYear()}-${month}`;
};

const isFutureImmunizationPeriod = (period: string) => period > getCurrentImmunizationPeriod();

export const getImmunizationScope = (user: User | null | undefined): ImmunizationScope => {
  const role = (user?.role || "").toUpperCase();
  const personnel = user?.personnelData;
  const facility = user?.facilityData;

  const facilityCode = personnel?.facilityCode || facility?.code || (user as any)?.facilityCode;
  const microredId = personnel?.microredId || facility?.microredId || (user as any)?.microredId;
  const ungetId = personnel?.ungetId || facility?.ungetId || (user as any)?.ungetId;
  const ogessId = personnel?.ogessId || facility?.ogessId || (user as any)?.ogessId;
  const diresaId = personnel?.diresaId || facility?.diresaId || (user as any)?.diresaId;

  if (role === "ADMIN" || role.includes("GLOBAL") || role.includes("ADMINISTRADOR")) {
    return { level: "GLOBAL", diresaId, ogessId, ungetId, microredId, facilityCode };
  }
  if (facilityCode) {
    return { level: "IPRESS", ownerType: "IPRESS", diresaId, ogessId, ungetId, microredId, facilityCode };
  }
  if (ungetId || role.includes("UNGET")) {
    return { level: "UNGET", ownerType: "UNGET", diresaId, ogessId, ungetId, microredId };
  }
  if (ogessId || role.includes("OGESS")) {
    return { level: "OGESS", diresaId, ogessId, ungetId, microredId };
  }
  if (diresaId || role.includes("DIRESA")) {
    return { level: "DIRESA", ownerType: "DIRESA", diresaId, ogessId, ungetId, microredId };
  }
  return { level: "GLOBAL", diresaId, ogessId, ungetId, microredId, facilityCode };
};

const applyOwnerScope = (query: any, scope: ImmunizationScope) => {
  if (scope.ownerType === "DIRESA") {
    return query.eq("owner_type", "DIRESA");
  }
  if (scope.ownerType === "UNGET" && scope.ungetIds) {
    return scope.ungetIds.length > 0
      ? query.eq("owner_type", "UNGET").in("unget_id", scope.ungetIds)
      : query.eq("owner_type", "UNGET").eq("unget_id", "00000000-0000-0000-0000-000000000000");
  }
  if (scope.ownerType === "IPRESS" && scope.facilityCodes) {
    return scope.facilityCodes.length > 0
      ? query.eq("owner_type", "IPRESS").in("facility_code", scope.facilityCodes)
      : query.eq("owner_type", "IPRESS").eq("facility_code", "__NO_FACILITIES__");
  }
  if (scope.level === "IPRESS" && scope.facilityCode) {
    return query.eq("owner_type", "IPRESS").eq("facility_code", scope.facilityCode);
  }
  if (scope.level === "UNGET" && scope.ungetId) {
    return query.eq("owner_type", "UNGET").eq("unget_id", scope.ungetId);
  }
  return query;
};

const facilityUngetCache = new Map<string, string | null>();

/**
 * Resuelve la UNGET a la que pertenece un establecimiento.
 *
 * Las capas y movimientos de una IPRESS deben llevar `unget_id`; si no, quedan invisibles
 * para cualquier consulta por UNGET y el consolidado mensual pierde esos movimientos.
 */
const resolveOwnerUngetId = async (
  ownerType: ImmunizationOwnerType,
  ungetId?: string,
  facilityCode?: string
): Promise<string | null> => {
  if (ungetId) return ungetId;
  if (ownerType !== "IPRESS" || !facilityCode) return null;
  if (facilityUngetCache.has(facilityCode)) return facilityUngetCache.get(facilityCode) ?? null;
  try {
    if (supabase) {
      const { data, error } = await supabase
        .from("facilities")
        .select("unget_id")
        .eq("code", facilityCode)
        .maybeSingle();
      if (error) throw error;
      const resolved = data?.unget_id || null;
      facilityUngetCache.set(facilityCode, resolved);
      return resolved;
    }
  } catch (e) {
    console.warn("No se pudo resolver la UNGET del establecimiento", e);
  }
  return null;
};

const isClosureLocked = (closure?: ImmunizationMonthlyClosure) => {
  if (!closure) return false;
  if (closure.ownerType === "IPRESS") return closure.status === "PRE_CLOSED" || closure.status === "FINAL_CLOSED";
  if (closure.ownerType === "UNGET") return closure.status === "FINAL_CLOSED";
  return false;
};

const closureMatchesOwner = (
  closure: ImmunizationMonthlyClosure,
  ownerType: ImmunizationMonthlyClosureOwnerType,
  period: string,
  ungetId?: string,
  facilityCode?: string
) => (
  closure.ownerType === ownerType &&
  closure.period === period &&
  (ownerType !== "UNGET" || closure.ungetId === ungetId) &&
  (ownerType !== "IPRESS" || closure.facilityCode === facilityCode)
);

const findMonthlyClosure = async (
  ownerType: ImmunizationMonthlyClosureOwnerType,
  period: string,
  ungetId?: string,
  facilityCode?: string
): Promise<ImmunizationMonthlyClosure | undefined> => {
  try {
    if (supabase) {
      let query = supabase
        .from("immunization_monthly_closures")
        .select("*")
        .eq("owner_type", ownerType)
        .eq("period", period)
        .limit(1);

      if (ownerType === "UNGET") query = query.eq("unget_id", ungetId || "");
      if (ownerType === "IPRESS") query = query.eq("facility_code", facilityCode || "");

      const { data, error } = await query;
      if (error) throw error;
      return data?.[0] ? normalizeMonthlyClosure(data[0]) : undefined;
    }
  } catch (e) {
    console.warn("Fallback local findMonthlyClosure inmunizaciones", e);
  }

  return getCachedList<ImmunizationMonthlyClosure>(MONTHLY_CLOSURES_CACHE_KEY)
    .find(closure => closureMatchesOwner(closure, ownerType, period, ungetId, facilityCode));
};

const isOwnerPeriodLocked = async (
  ownerType: ImmunizationMonthlyClosureOwnerType,
  period: string,
  ungetId?: string,
  facilityCode?: string
) => isClosureLocked(await findMonthlyClosure(ownerType, period, ungetId, facilityCode));

const saveMonthlyClosure = async (
  closure: ImmunizationMonthlyClosure
): Promise<ImmunizationMonthlyClosure> => {
  const now = new Date().toISOString();

  try {
    if (supabase) {
      const existing = await findMonthlyClosure(closure.ownerType, closure.period, closure.ungetId, closure.facilityCode);
      const payload = {
        owner_type: closure.ownerType,
        period: closure.period,
        unget_id: closure.ungetId || null,
        facility_code: closure.facilityCode || null,
        status: closure.status,
        observation: closure.observation?.trim() || null,
        preclosed_by: closure.preclosedBy || existing?.preclosedBy || null,
        preclosed_at: closure.preclosedAt || existing?.preclosedAt || null,
        closed_by: closure.closedBy || existing?.closedBy || null,
        closed_at: closure.closedAt || existing?.closedAt || null,
        reopened_by: closure.reopenedBy || existing?.reopenedBy || null,
        reopened_at: closure.reopenedAt || existing?.reopenedAt || null,
        reopen_reason: closure.reopenReason || existing?.reopenReason || null,
        updated_at: now
      };

      const query = existing?.id
        ? supabase.from("immunization_monthly_closures").update(payload).eq("id", existing.id).select().single()
        : supabase.from("immunization_monthly_closures").insert({ ...payload, created_at: now }).select().single();

      const { data, error } = await query;
      if (error) throw error;
      return normalizeMonthlyClosure(data);
    }
  } catch (e) {
    console.warn("Fallback local saveMonthlyClosure inmunizaciones", e);
  }

  const cached = getCachedList<ImmunizationMonthlyClosure>(MONTHLY_CLOSURES_CACHE_KEY);
  const existingIndex = cached.findIndex(row => closureMatchesOwner(row, closure.ownerType, closure.period, closure.ungetId, closure.facilityCode));
  const existing = existingIndex >= 0 ? cached[existingIndex] : undefined;
  const saved: ImmunizationMonthlyClosure = {
    ...existing,
    ...closure,
    id: existing?.id || closure.id || makeLocalId("imm-closure"),
    observation: closure.observation?.trim() || undefined,
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
  const next = existingIndex >= 0
    ? cached.map((row, index) => index === existingIndex ? saved : row)
    : [saved, ...cached];
  setCachedList(MONTHLY_CLOSURES_CACHE_KEY, next);
  return saved;
};

export const immunizationApi = {
  listMonthlyClosures: async (scope: ImmunizationScope, period?: string): Promise<ImmunizationMonthlyClosure[]> => {
    try {
      if (supabase) {
        let query = supabase
          .from("immunization_monthly_closures")
          .select("*")
          .order("period", { ascending: false })
          .order("created_at", { ascending: false });

        if (period && period !== "ALL") query = query.eq("period", period);

        if (scope.level === "IPRESS" && scope.facilityCode) {
          query = query.eq("owner_type", "IPRESS").eq("facility_code", scope.facilityCode);
        } else if (scope.ownerType === "IPRESS" && scope.facilityCodes) {
          query = scope.facilityCodes.length > 0
            ? query.eq("owner_type", "IPRESS").in("facility_code", scope.facilityCodes)
            : query.eq("owner_type", "IPRESS").eq("facility_code", "__NO_FACILITIES__");
        } else if (scope.level === "UNGET" && scope.ungetId) {
          query = query.eq("unget_id", scope.ungetId);
        } else if (scope.ownerType === "UNGET" && scope.ungetIds) {
          query = scope.ungetIds.length > 0
            ? query.in("unget_id", scope.ungetIds)
            : query.eq("unget_id", "00000000-0000-0000-0000-000000000000");
        }

        const { data, error } = await query;
        if (error) throw error;
        return (data || []).map(normalizeMonthlyClosure);
      }
    } catch (e) {
      console.warn("Fallback local listMonthlyClosures inmunizaciones", e);
    }

    return getCachedList<ImmunizationMonthlyClosure>(MONTHLY_CLOSURES_CACHE_KEY)
      .filter(closure => {
        if (period && period !== "ALL" && closure.period !== period) return false;
        if (scope.level === "IPRESS") return closure.ownerType === "IPRESS" && closure.facilityCode === scope.facilityCode;
        if (scope.ownerType === "IPRESS" && scope.facilityCodes) return closure.ownerType === "IPRESS" && scope.facilityCodes.includes(closure.facilityCode || "");
        if (scope.level === "UNGET") return closure.ungetId === scope.ungetId;
        if (scope.ownerType === "UNGET" && scope.ungetIds) return closure.ungetId ? scope.ungetIds.includes(closure.ungetId) : false;
        return true;
      })
      .sort((a, b) => `${b.period}${b.createdAt || ""}`.localeCompare(`${a.period}${a.createdAt || ""}`));
  },

  listStockMovements: async (scope: ImmunizationScope, period?: string): Promise<ImmunizationStockMovement[]> => {
    try {
      if (supabase) {
        let query = supabase
          .from("immunization_stock_movements")
          .select("*")
          .order("created_at", { ascending: false });

        if (period && period !== "ALL") query = query.eq("period", period);

        if (scope.level === "IPRESS" && scope.facilityCode) {
          query = query.eq("owner_type", "IPRESS").eq("facility_code", scope.facilityCode);
        } else if (scope.ownerType === "IPRESS" && scope.facilityCodes) {
          query = scope.facilityCodes.length > 0
            ? query.eq("owner_type", "IPRESS").in("facility_code", scope.facilityCodes)
            : query.eq("owner_type", "IPRESS").eq("facility_code", "__NO_FACILITIES__");
        } else if (scope.level === "UNGET" && scope.ungetId) {
          // Los movimientos de IPRESS antiguos pueden no tener unget_id, así que también
          // se emparejan por código de establecimiento cuando el llamador los aporta.
          query = scope.facilityCodes && scope.facilityCodes.length > 0
            ? query.or(`unget_id.eq.${scope.ungetId},facility_code.in.(${scope.facilityCodes.join(",")})`)
            : query.eq("unget_id", scope.ungetId);
        } else if (scope.ownerType === "UNGET" && scope.ungetIds) {
          query = scope.ungetIds.length > 0
            ? query.in("unget_id", scope.ungetIds)
            : query.eq("unget_id", "00000000-0000-0000-0000-000000000000");
        } else if (scope.ownerType === "DIRESA") {
          query = query.eq("owner_type", "DIRESA");
        }

        const { data, error } = await query;
        if (error) throw error;
        return (data || []).map(normalizeStockMovement);
      }
    } catch (e) {
      console.warn("Fallback local listStockMovements inmunizaciones", e);
    }

    return getCachedList<ImmunizationStockMovement>(MOVEMENTS_CACHE_KEY)
      .filter(movement => {
        if (period && period !== "ALL" && movement.period !== period) return false;
        if (scope.level === "IPRESS") return movement.ownerType === "IPRESS" && movement.facilityCode === scope.facilityCode;
        if (scope.ownerType === "IPRESS" && scope.facilityCodes) return movement.ownerType === "IPRESS" && scope.facilityCodes.includes(movement.facilityCode || "");
        if (scope.level === "UNGET") {
          if (movement.ungetId === scope.ungetId) return true;
          return Boolean(scope.facilityCodes?.includes(movement.facilityCode || ""));
        }
        if (scope.ownerType === "UNGET" && scope.ungetIds) return movement.ungetId ? scope.ungetIds.includes(movement.ungetId) : false;
        if (scope.ownerType === "DIRESA") return movement.ownerType === "DIRESA";
        return true;
      })
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  },

  isPeriodLocked: async (scope: ImmunizationScope, period: string): Promise<boolean> => {
    if (!period) return false;
    if (scope.ownerType === "IPRESS" || scope.level === "IPRESS") {
      return isOwnerPeriodLocked("IPRESS", period, scope.ungetId, scope.facilityCode);
    }
    if (scope.ownerType === "UNGET" || scope.level === "UNGET") {
      return isOwnerPeriodLocked("UNGET", period, scope.ungetId);
    }
    return false;
  },

  precloseIpressPeriod: async (
    scope: ImmunizationScope,
    period: string,
    observation?: string,
    username?: string
  ): Promise<{ success: boolean; closure?: ImmunizationMonthlyClosure; message?: string }> => {
    try {
      if (scope.level !== "IPRESS" || !scope.facilityCode || !scope.ungetId) {
        return { success: false, message: "Solo una IPRESS vinculada a una UNGET puede realizar el precierre." };
      }
      if (!period || !/^[0-9]{4}-[0-9]{2}$/.test(period)) {
        return { success: false, message: "Periodo inválido." };
      }
      if (isFutureImmunizationPeriod(period)) {
        return { success: false, message: "No se puede precerrar un periodo futuro." };
      }
      const existing = await findMonthlyClosure("IPRESS", period, scope.ungetId, scope.facilityCode);
      if (isClosureLocked(existing)) {
        return { success: false, message: "El periodo ya está precerrado o cerrado para esta IPRESS." };
      }

      const [distributions, returns, consumptionMovements] = await Promise.all([
        immunizationApi.listDistributionBatches(scope),
        immunizationApi.listReturnBatches(scope),
        immunizationApi.listConsumptionMovements(scope)
      ]);
      const pendingDistributions = distributions.filter(batch => batch.period === period && batch.status === "SENT");
      const pendingReturns = returns.filter(batch => batch.period === period && batch.status === "SENT");
      const consumptionCount = consumptionMovements.filter(movement => movement.period === period).length;

      if (pendingDistributions.length > 0) {
        return { success: false, message: `No se puede precerrar: hay ${pendingDistributions.length} distribución(es) pendiente(s) de recepción.` };
      }
      if (pendingReturns.length > 0) {
        return { success: false, message: `No se puede precerrar: hay ${pendingReturns.length} devolución(es) o baja(s) pendiente(s) de aceptación por UNGET.` };
      }
      if (consumptionCount === 0) {
        return { success: false, message: "No se puede precerrar: el periodo no tiene consumos IPRESS registrados." };
      }

      const now = new Date().toISOString();
      const closure = await saveMonthlyClosure({
        ownerType: "IPRESS",
        period,
        ungetId: scope.ungetId,
        facilityCode: scope.facilityCode,
        status: "PRE_CLOSED",
        observation,
        preclosedBy: username,
        preclosedAt: now
      });
      return { success: true, closure };
    } catch (e: any) {
      return { success: false, message: e.message || "Error al precerrar el periodo." };
    }
  },

  finalCloseUngetPeriod: async (
    scope: ImmunizationScope,
    period: string,
    expectedFacilityCodes: string[],
    observation?: string,
    username?: string
  ): Promise<{ success: boolean; closure?: ImmunizationMonthlyClosure; message?: string }> => {
    try {
      if (scope.level !== "UNGET" || !scope.ungetId) {
        return { success: false, message: "Solo una UNGET puede cerrar definitivamente su periodo." };
      }
      if (!period || !/^[0-9]{4}-[0-9]{2}$/.test(period)) {
        return { success: false, message: "Periodo inválido." };
      }
      if (isFutureImmunizationPeriod(period)) {
        return { success: false, message: "No se puede cerrar un periodo futuro." };
      }
      const expectedCodes = expectedFacilityCodes.map(code => code.trim()).filter(Boolean);
      if (expectedCodes.length === 0) {
        return { success: false, message: "No se puede cerrar: la UNGET no tiene IPRESS esperadas para validar." };
      }
      const existing = await findMonthlyClosure("UNGET", period, scope.ungetId);
      if (isClosureLocked(existing)) {
        return { success: false, message: "El periodo ya está cerrado definitivamente para esta UNGET." };
      }

      const [closures, distributions, returns] = await Promise.all([
        immunizationApi.listMonthlyClosures(scope, period),
        immunizationApi.listDistributionBatches(scope),
        immunizationApi.listReturnBatches(scope)
      ]);
      const pendingDistributions = distributions.filter(batch => batch.period === period && batch.status === "SENT");
      const pendingReturns = returns.filter(batch => batch.period === period && batch.status === "SENT");

      if (pendingDistributions.length > 0) {
        return { success: false, message: `No se puede cerrar: hay ${pendingDistributions.length} distribución(es) pendiente(s) de recepción.` };
      }
      if (pendingReturns.length > 0) {
        return { success: false, message: `No se puede cerrar: hay ${pendingReturns.length} devolución(es) o baja(s) pendiente(s) de recepción.` };
      }

      const ipressClosureByCode = new Map(
        closures
          .filter(closure => closure.ownerType === "IPRESS" && closure.period === period)
          .map(closure => [closure.facilityCode || "", closure])
      );
      const pendingFacilities = expectedCodes
        .filter(code => {
          const closure = ipressClosureByCode.get(code);
          return !(closure?.status === "PRE_CLOSED" || closure?.status === "FINAL_CLOSED");
        });

      if (pendingFacilities.length > 0) {
        return { success: false, message: `No se puede cerrar: faltan ${pendingFacilities.length} IPRESS por precerrar.` };
      }

      const now = new Date().toISOString();
      const closure = await saveMonthlyClosure({
        ownerType: "UNGET",
        period,
        ungetId: scope.ungetId,
        status: "FINAL_CLOSED",
        observation,
        closedBy: username,
        closedAt: now
      });
      return { success: true, closure };
    } catch (e: any) {
      return { success: false, message: e.message || "Error al cerrar el periodo UNGET." };
    }
  },

  reopenIpressPreclosure: async (
    scope: ImmunizationScope,
    period: string,
    facilityCode: string,
    reason: string,
    username?: string
  ): Promise<{ success: boolean; closure?: ImmunizationMonthlyClosure; message?: string }> => {
    try {
      if (scope.level !== "UNGET" || !scope.ungetId) {
        return { success: false, message: "Solo una UNGET puede reabrir el precierre de una IPRESS." };
      }
      if (!period || !/^[0-9]{4}-[0-9]{2}$/.test(period)) {
        return { success: false, message: "Periodo inválido." };
      }
      if (isFutureImmunizationPeriod(period)) {
        return { success: false, message: "No se puede reabrir un periodo futuro." };
      }
      const cleanFacilityCode = facilityCode.trim();
      const cleanReason = reason.trim();
      if (!cleanFacilityCode) {
        return { success: false, message: "Seleccione una IPRESS válida para reabrir." };
      }
      if (!cleanReason) {
        return { success: false, message: "Registre el motivo o sustento de la reapertura." };
      }

      const ungetClosure = await findMonthlyClosure("UNGET", period, scope.ungetId);
      if (ungetClosure?.status === "FINAL_CLOSED") {
        return { success: false, message: "No se puede reabrir: la UNGET ya cerró definitivamente el periodo." };
      }

      const existing = await findMonthlyClosure("IPRESS", period, scope.ungetId, cleanFacilityCode);
      if (!existing || existing.ownerType !== "IPRESS" || existing.ungetId !== scope.ungetId || existing.facilityCode !== cleanFacilityCode) {
        return { success: false, message: "No existe un precierre de esa IPRESS para el periodo seleccionado." };
      }
      if (existing.status !== "PRE_CLOSED") {
        return { success: false, message: "Solo se puede reabrir una IPRESS que esté precerrada." };
      }

      const now = new Date().toISOString();
      const closure = await saveMonthlyClosure({
        ...existing,
        status: "REOPENED",
        observation: existing.observation,
        reopenedBy: username,
        reopenedAt: now,
        reopenReason: cleanReason
      });
      return { success: true, closure };
    } catch (e: any) {
      return { success: false, message: e.message || "Error al reabrir el precierre IPRESS." };
    }
  },

  getProducts: async (includeInactive = true): Promise<ImmunizationProduct[]> => {
    try {
      if (supabase) {
        let query = supabase.from("immunization_products").select("*").order("descripcion");
        if (!includeInactive) query = query.eq("is_active", true);
        const { data, error } = await query;
        if (error) throw error;
        return (data || []).map(normalizeProduct);
      }
    } catch (e) {
      console.warn("Fallback local getProducts inmunizaciones", e);
    }
    const cached = getCachedList<ImmunizationProduct>(PRODUCTS_CACHE_KEY);
    return includeInactive ? cached : cached.filter(p => p.isActive);
  },

  saveProduct: async (product: ImmunizationProduct, username?: string): Promise<{ success: boolean; product?: ImmunizationProduct; message?: string }> => {
    try {
      const codigoSismed = product.codigoSismed.trim();
      const descripcion = product.descripcion.trim();
      if (!codigoSismed || !descripcion) {
        return { success: false, message: "Codigo SISMED y descripcion son obligatorios." };
      }
      if (!["VACUNA", "JERINGA", "DILUYENTE"].includes(product.tipoProducto)) {
        return { success: false, message: "Tipo de producto invalido." };
      }

      if (supabase) {
        const payload: any = {
          codigo_sismed: codigoSismed,
          descripcion,
          tipo_producto: product.tipoProducto,
          dosis_unidad: Number(product.dosisUnidad) || 0,
          is_active: product.isActive,
          observacion: product.observacion || null,
          updated_by: username || null,
          updated_at: new Date().toISOString()
        };
        if (product.id) payload.id = product.id;
        if (!product.id) payload.created_by = username || null;

        const { data, error } = await supabase
          .from("immunization_products")
          .upsert(payload, { onConflict: "codigo_sismed" })
          .select()
          .single();
        if (error) throw error;
        return { success: true, product: normalizeProduct(data) };
      }

      const current = getCachedList<ImmunizationProduct>(PRODUCTS_CACHE_KEY);
      const existing = current.find(p => p.id === product.id || p.codigoSismed === codigoSismed);
      const nextProduct: ImmunizationProduct = {
        ...product,
        id: existing?.id || product.id || makeLocalId("imm-prod"),
        codigoSismed,
        descripcion,
        updatedBy: username,
        updatedAt: new Date().toISOString(),
        createdBy: existing?.createdBy || username,
        createdAt: existing?.createdAt || new Date().toISOString()
      };
      const next = existing
        ? current.map(p => p.id === existing.id ? nextProduct : p)
        : [...current, nextProduct];
      setCachedList(PRODUCTS_CACHE_KEY, next);
      return { success: true, product: nextProduct };
    } catch (e: any) {
      return { success: false, message: e.message || "Error al guardar producto." };
    }
  },

  toggleProductStatus: async (id: string, isActive: boolean, username?: string): Promise<{ success: boolean; message?: string }> => {
    try {
      if (supabase) {
        const { error } = await supabase
          .from("immunization_products")
          .update({ is_active: isActive, updated_by: username || null, updated_at: new Date().toISOString() })
          .eq("id", id);
        if (error) throw error;
        return { success: true };
      }
      const current = getCachedList<ImmunizationProduct>(PRODUCTS_CACHE_KEY);
      setCachedList(PRODUCTS_CACHE_KEY, current.map(p => p.id === id ? { ...p, isActive } : p));
      return { success: true };
    } catch (e: any) {
      return { success: false, message: e.message || "Error al cambiar estado." };
    }
  },

  getInitialInventories: async (scope: ImmunizationScope): Promise<ImmunizationInitialInventory[]> => {
    try {
      if (supabase) {
        let query = supabase.from("immunization_initial_inventories").select("*").order("created_at", { ascending: false });
        query = applyOwnerScope(query, scope);
        const { data, error } = await query;
        if (error) throw error;
        return (data || []).map(normalizeInventory);
      }
    } catch (e) {
      console.warn("Fallback local getInitialInventories inmunizaciones", e);
    }
    return getCachedList<ImmunizationInitialInventory>(INVENTORIES_CACHE_KEY).filter(inv => {
      if (scope.level === "IPRESS") return inv.facilityCode === scope.facilityCode;
      if (scope.level === "UNGET") return inv.ownerType === "UNGET" && inv.ungetId === scope.ungetId;
      return true;
    });
  },

  getInitialInventoryItems: async (inventoryId: string): Promise<ImmunizationInitialInventoryItem[]> => {
    try {
      if (supabase) {
        const { data, error } = await supabase
          .from("immunization_initial_inventory_items")
          .select("*, product:product_id(*)")
          .eq("inventory_id", inventoryId)
          .order("created_at", { ascending: true });
        if (error) throw error;
        return (data || []).map(normalizeInventoryItem);
      }
    } catch (e) {
      console.warn("Fallback local getInitialInventoryItems inmunizaciones", e);
    }
    const products = getCachedList<ImmunizationProduct>(PRODUCTS_CACHE_KEY);
    return getCachedList<ImmunizationInitialInventoryItem>(INVENTORY_ITEMS_CACHE_KEY)
      .filter(item => item.inventoryId === inventoryId)
      .map(item => ({ ...item, product: products.find(product => product.id === item.productId) }));
  },

  getStockLayers: async (scope: ImmunizationScope): Promise<ImmunizationStockLayer[]> => {
    try {
      if (supabase) {
        let query = supabase
          .from("immunization_stock_layers")
          .select("*, product:product_id(*)")
          .order("expiration_date", { ascending: true });
        query = applyOwnerScope(query, scope);
        const { data, error } = await query;
        if (error) throw error;
        return (data || []).map(normalizeStockLayer);
      }
    } catch (e) {
      console.warn("Fallback local getStockLayers inmunizaciones", e);
    }
    return getCachedList<ImmunizationStockLayer>(STOCK_CACHE_KEY).filter(layer => {
      if (scope.ownerType === "DIRESA") return layer.ownerType === "DIRESA";
      if (scope.ownerType === "UNGET" && scope.ungetIds) return layer.ownerType === "UNGET" && scope.ungetIds.includes(layer.ungetId || "");
      if (scope.ownerType === "IPRESS" && scope.facilityCodes) return layer.ownerType === "IPRESS" && scope.facilityCodes.includes(layer.facilityCode || "");
      if (scope.level === "DIRESA") return layer.ownerType === "DIRESA";
      if (scope.level === "IPRESS") return layer.facilityCode === scope.facilityCode;
      if (scope.level === "UNGET") return layer.ownerType === "UNGET" && layer.ungetId === scope.ungetId;
      return true;
    });
  },

  createInitialInventory: async (
    inventory: ImmunizationInitialInventory,
    items: ImmunizationInitialInventoryItem[]
  ): Promise<{ success: boolean; inventory?: ImmunizationInitialInventory; message?: string }> => {
    try {
      if (items.some(item => item.quantity < 0 || item.unitPrice < 0)) {
        return { success: false, message: "El saldo y el precio no pueden ser negativos." };
      }

      if (supabase) {
        const { data, error } = await supabase
          .from("immunization_initial_inventories")
          .insert({
            owner_type: inventory.ownerType,
            unget_id: inventory.ungetId || null,
            facility_code: inventory.facilityCode || null,
            period: inventory.period,
            status: inventory.status,
            source_type: inventory.sourceType,
            created_by: inventory.createdBy || null
          })
          .select()
          .single();
        if (error) throw error;

        if (items.length > 0) {
          const { error: itemError } = await supabase.from("immunization_initial_inventory_items").insert(items.map(item => ({
            inventory_id: data.id,
            product_id: item.productId,
            codigo_sismed_snapshot: item.codigoSismedSnapshot,
            excel_description_snapshot: item.excelDescriptionSnapshot || null,
            lote: item.lote,
            expiration_date: item.expirationDate,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            funding_source: item.fundingSource,
            supply_type: item.supplyType,
            observation: item.observation || null
          })));
          if (itemError) throw itemError;
        }

        return { success: true, inventory: normalizeInventory(data) };
      }

      const savedInventory: ImmunizationInitialInventory = {
        ...inventory,
        id: inventory.id || makeLocalId("imm-inv"),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      const inventories = getCachedList<ImmunizationInitialInventory>(INVENTORIES_CACHE_KEY);
      setCachedList(INVENTORIES_CACHE_KEY, [...inventories, savedInventory]);
      const cachedItems = getCachedList<ImmunizationInitialInventoryItem>(INVENTORY_ITEMS_CACHE_KEY);
      setCachedList(INVENTORY_ITEMS_CACHE_KEY, [
        ...cachedItems,
        ...items.map(item => ({ ...item, id: item.id || makeLocalId("imm-inv-item"), inventoryId: savedInventory.id }))
      ]);
      return { success: true, inventory: savedInventory };
    } catch (e: any) {
      return { success: false, message: e.message || "Error al crear inventario inicial." };
    }
  },

  saveInitialInventoryItem: async (
    inventoryId: string,
    item: ImmunizationInitialInventoryItem
  ): Promise<{ success: boolean; item?: ImmunizationInitialInventoryItem; message?: string }> => {
    try {
      if (!item.productId || !item.lote.trim() || !item.expirationDate || !item.fundingSource.trim() || !item.supplyType.trim()) {
        return { success: false, message: "Complete todos los campos obligatorios." };
      }
      if (item.quantity < 0 || item.unitPrice < 0) {
        return { success: false, message: "El saldo y el precio no pueden ser negativos." };
      }

      if (supabase) {
        const { data: inventoryRow, error: inventoryError } = await supabase
          .from("immunization_initial_inventories")
          .select("status, source_type")
          .eq("id", inventoryId)
          .single();
        if (inventoryError) throw inventoryError;
        if (inventoryRow.status !== "DRAFT") return { success: false, message: "El inventario esta cerrado y no admite cambios." };

        let duplicateQuery = supabase
          .from("immunization_initial_inventory_items")
          .select("id")
          .eq("inventory_id", inventoryId)
          .eq("product_id", item.productId)
          .eq("lote", item.lote.trim())
          .eq("expiration_date", item.expirationDate)
          .eq("unit_price", item.unitPrice)
          .eq("funding_source", item.fundingSource.trim())
          .eq("supply_type", item.supplyType.trim());
        if (item.id) duplicateQuery = duplicateQuery.neq("id", item.id);
        const { data: duplicateRows, error: duplicateError } = await duplicateQuery.limit(1);
        if (duplicateError) throw duplicateError;
        if (duplicateRows && duplicateRows.length > 0) {
          return { success: false, message: "Ya existe una fila con el mismo producto, lote, vencimiento, precio, fuente y suministro. Edite la fila existente." };
        }

        const payload = {
          inventory_id: inventoryId,
          product_id: item.productId,
          codigo_sismed_snapshot: item.codigoSismedSnapshot,
          excel_description_snapshot: item.excelDescriptionSnapshot || null,
          lote: item.lote.trim(),
          expiration_date: item.expirationDate,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          funding_source: item.fundingSource.trim(),
          supply_type: item.supplyType.trim(),
          observation: item.observation?.trim() || null
        };

        const query = item.id
          ? supabase.from("immunization_initial_inventory_items").update(payload).eq("id", item.id)
          : supabase.from("immunization_initial_inventory_items").insert(payload);
        const { data: savedRow, error: saveError } = await query.select("*, product:product_id(*)").single();
        if (saveError) throw saveError;

        if (inventoryRow.source_type === "EXCEL") {
          const { error: sourceError } = await supabase
            .from("immunization_initial_inventories")
            .update({ source_type: "MIXED", updated_at: new Date().toISOString() })
            .eq("id", inventoryId);
          if (sourceError) throw sourceError;
        }
        return { success: true, item: normalizeInventoryItem(savedRow) };
      }

      const inventories = getCachedList<ImmunizationInitialInventory>(INVENTORIES_CACHE_KEY);
      const inventory = inventories.find(row => row.id === inventoryId);
      if (!inventory) return { success: false, message: "Inventario no encontrado." };
      if (inventory.status !== "DRAFT") return { success: false, message: "El inventario esta cerrado y no admite cambios." };
      const items = getCachedList<ImmunizationInitialInventoryItem>(INVENTORY_ITEMS_CACHE_KEY);
      const duplicate = items.find(row =>
        row.inventoryId === inventoryId &&
        row.id !== item.id &&
        row.productId === item.productId &&
        row.lote === item.lote.trim() &&
        row.expirationDate === item.expirationDate &&
        row.unitPrice === item.unitPrice &&
        row.fundingSource === item.fundingSource.trim() &&
        row.supplyType === item.supplyType.trim()
      );
      if (duplicate) return { success: false, message: "Ya existe una fila igual. Edite la fila existente." };
      const savedItem: ImmunizationInitialInventoryItem = {
        ...item,
        id: item.id || makeLocalId("imm-inv-item"),
        inventoryId,
        lote: item.lote.trim(),
        fundingSource: item.fundingSource.trim(),
        supplyType: item.supplyType.trim(),
        observation: item.observation?.trim() || undefined
      };
      setCachedList(INVENTORY_ITEMS_CACHE_KEY, item.id
        ? items.map(row => row.id === item.id ? savedItem : row)
        : [...items, savedItem]
      );
      if (inventory.sourceType === "EXCEL") {
        setCachedList(INVENTORIES_CACHE_KEY, inventories.map(row => row.id === inventoryId ? { ...row, sourceType: "MIXED", updatedAt: new Date().toISOString() } : row));
      }
      const product = getCachedList<ImmunizationProduct>(PRODUCTS_CACHE_KEY).find(row => row.id === item.productId);
      return { success: true, item: { ...savedItem, product } };
    } catch (e: any) {
      return { success: false, message: e.message || "Error al guardar la fila del inventario." };
    }
  },

  deleteInitialInventoryItem: async (
    inventoryId: string,
    itemId: string
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      if (supabase) {
        const { data: inventoryRow, error: inventoryError } = await supabase
          .from("immunization_initial_inventories")
          .select("status")
          .eq("id", inventoryId)
          .single();
        if (inventoryError) throw inventoryError;
        if (inventoryRow.status !== "DRAFT") return { success: false, message: "El inventario esta cerrado y no admite cambios." };
        const { error } = await supabase
          .from("immunization_initial_inventory_items")
          .delete()
          .eq("id", itemId)
          .eq("inventory_id", inventoryId);
        if (error) throw error;
        return { success: true };
      }
      const inventories = getCachedList<ImmunizationInitialInventory>(INVENTORIES_CACHE_KEY);
      const inventory = inventories.find(row => row.id === inventoryId);
      if (!inventory) return { success: false, message: "Inventario no encontrado." };
      if (inventory.status !== "DRAFT") return { success: false, message: "El inventario esta cerrado y no admite cambios." };
      const items = getCachedList<ImmunizationInitialInventoryItem>(INVENTORY_ITEMS_CACHE_KEY);
      setCachedList(INVENTORY_ITEMS_CACHE_KEY, items.filter(row => row.id !== itemId || row.inventoryId !== inventoryId));
      return { success: true };
    } catch (e: any) {
      return { success: false, message: e.message || "Error al eliminar la fila del inventario." };
    }
  },

  closeInitialInventory: async (
    inventoryId: string,
    username?: string
  ): Promise<{ success: boolean; inventory?: ImmunizationInitialInventory; message?: string }> => {
    try {
      if (supabase) {
        const { data: inventoryRow, error: inventoryError } = await supabase
          .from("immunization_initial_inventories")
          .select("*")
          .eq("id", inventoryId)
          .single();
        if (inventoryError) throw inventoryError;
        const inventory = normalizeInventory(inventoryRow);
        if (inventory.status === "CLOSED") return { success: false, message: "El inventario ya se encuentra cerrado." };

        const { data: itemRows, error: itemsError } = await supabase
          .from("immunization_initial_inventory_items")
          .select("*")
          .eq("inventory_id", inventoryId);
        if (itemsError) throw itemsError;
        const items = (itemRows || []).map(normalizeInventoryItem);
        if (items.length === 0) return { success: false, message: "El borrador no contiene productos para cerrar." };

        const grouped = new Map<string, ImmunizationInitialInventoryItem>();
        items.forEach(item => {
          const key = JSON.stringify([item.productId, item.lote, item.expirationDate, item.unitPrice, item.fundingSource, item.supplyType]);
          const current = grouped.get(key);
          grouped.set(key, current ? { ...current, quantity: current.quantity + item.quantity } : { ...item });
        });

        // Una IPRESS hereda la UNGET de su establecimiento: sin esto las capas y
        // movimientos quedan huérfanos y el consolidado UNGET no los ve.
        const ownerUngetId = await resolveOwnerUngetId(inventory.ownerType, inventory.ungetId, inventory.facilityCode);

        for (const item of grouped.values()) {
          let layerQuery = supabase
            .from("immunization_stock_layers")
            .select("*")
            .eq("owner_type", inventory.ownerType)
            .eq("product_id", item.productId)
            .eq("lote", item.lote)
            .eq("expiration_date", item.expirationDate)
            .eq("unit_price", item.unitPrice)
            .eq("funding_source", item.fundingSource)
            .eq("supply_type", item.supplyType);
          layerQuery = inventory.ownerType === "UNGET"
            ? layerQuery.eq("unget_id", inventory.ungetId!).is("facility_code", null)
            : layerQuery.eq("facility_code", inventory.facilityCode!);

          const { data: existingLayer, error: findLayerError } = await layerQuery.maybeSingle();
          if (findLayerError) throw findLayerError;
          const quantityBefore = existingLayer ? Number(existingLayer.current_quantity) || 0 : 0;
          const quantityAfter = quantityBefore + item.quantity;
          let stockLayerId: string;

          if (existingLayer) {
            const { data: updatedLayer, error: updateLayerError } = await supabase
              .from("immunization_stock_layers")
              .update({ current_quantity: quantityAfter, is_active: true, updated_at: new Date().toISOString() })
              .eq("id", existingLayer.id)
              .select("id")
              .single();
            if (updateLayerError) throw updateLayerError;
            stockLayerId = updatedLayer.id;
          } else {
            const { data: newLayer, error: insertLayerError } = await supabase
              .from("immunization_stock_layers")
              .insert({
                owner_type: inventory.ownerType,
                unget_id: ownerUngetId,
                facility_code: inventory.ownerType === "IPRESS" ? inventory.facilityCode : null,
                product_id: item.productId,
                lote: item.lote,
                expiration_date: item.expirationDate,
                unit_price: item.unitPrice,
                funding_source: item.fundingSource,
                supply_type: item.supplyType,
                current_quantity: quantityAfter,
                is_active: true
              })
              .select("id")
              .single();
            if (insertLayerError) throw insertLayerError;
            stockLayerId = newLayer.id;
          }

          const { error: movementError } = await supabase.from("immunization_stock_movements").insert({
            movement_type: "INITIAL_INVENTORY",
            owner_type: inventory.ownerType,
            unget_id: ownerUngetId,
            facility_code: inventory.ownerType === "IPRESS" ? inventory.facilityCode : null,
            product_id: item.productId,
            stock_layer_id: stockLayerId,
            quantity_delta: item.quantity,
            quantity_before: quantityBefore,
            quantity_after: quantityAfter,
            period: inventory.period,
            reason: "Cierre de inventario inicial",
            observation: `Inventario inicial ${inventoryId}`,
            created_by: username || null
          });
          if (movementError) throw movementError;
        }

        const closedAt = new Date().toISOString();
        const { data: closedRow, error: closeError } = await supabase
          .from("immunization_initial_inventories")
          .update({ status: "CLOSED", closed_by: username || null, closed_at: closedAt, updated_at: closedAt })
          .eq("id", inventoryId)
          .eq("status", "DRAFT")
          .select("*")
          .single();
        if (closeError) throw closeError;
        return { success: true, inventory: normalizeInventory(closedRow) };
      }

      const inventories = getCachedList<ImmunizationInitialInventory>(INVENTORIES_CACHE_KEY);
      const inventory = inventories.find(item => item.id === inventoryId);
      if (!inventory) return { success: false, message: "Inventario no encontrado." };
      if (inventory.status === "CLOSED") return { success: false, message: "El inventario ya se encuentra cerrado." };
      const items = getCachedList<ImmunizationInitialInventoryItem>(INVENTORY_ITEMS_CACHE_KEY).filter(item => item.inventoryId === inventoryId);
      if (items.length === 0) return { success: false, message: "El borrador no contiene productos para cerrar." };

      const layers = getCachedList<ImmunizationStockLayer>(STOCK_CACHE_KEY);
      const movements = getCachedList<ImmunizationStockMovement>(MOVEMENTS_CACHE_KEY);
      items.forEach(item => {
        const existing = layers.find(layer =>
          layer.ownerType === inventory.ownerType &&
          layer.ungetId === inventory.ungetId &&
          layer.facilityCode === inventory.facilityCode &&
          layer.productId === item.productId &&
          layer.lote === item.lote &&
          layer.expirationDate === item.expirationDate &&
          layer.unitPrice === item.unitPrice &&
          layer.fundingSource === item.fundingSource &&
          layer.supplyType === item.supplyType
        );
        const quantityBefore = existing?.currentQuantity || 0;
        if (existing) existing.currentQuantity += item.quantity;
        else layers.push({
          id: makeLocalId("imm-layer"),
          ownerType: inventory.ownerType,
          ungetId: inventory.ungetId,
          facilityCode: inventory.facilityCode,
          productId: item.productId,
          lote: item.lote,
          expirationDate: item.expirationDate,
          unitPrice: item.unitPrice,
          fundingSource: item.fundingSource,
          supplyType: item.supplyType,
          currentQuantity: item.quantity,
          isActive: true
        });
        movements.push({
          id: makeLocalId("imm-mov"),
          movementType: "INITIAL_INVENTORY",
          ownerType: inventory.ownerType,
          ungetId: inventory.ungetId,
          facilityCode: inventory.facilityCode,
          productId: item.productId,
          quantityDelta: item.quantity,
          quantityBefore,
          quantityAfter: quantityBefore + item.quantity,
          period: inventory.period,
          reason: "Cierre de inventario inicial",
          observation: `Inventario inicial ${inventoryId}`,
          createdBy: username
        });
      });
      setCachedList(STOCK_CACHE_KEY, layers);
      setCachedList(MOVEMENTS_CACHE_KEY, movements);
      const closedAt = new Date().toISOString();
      const closedInventory = { ...inventory, status: "CLOSED" as const, closedBy: username, closedAt, updatedAt: closedAt };
      setCachedList(INVENTORIES_CACHE_KEY, inventories.map(item => item.id === inventoryId ? closedInventory : item));
      return { success: true, inventory: closedInventory };
    } catch (e: any) {
      return { success: false, message: e.message || "Error al cerrar el inventario inicial." };
    }
  },

  listIncomeOrigins: async (includeInactive = false): Promise<ImmunizationIncomeOrigin[]> => {
    try {
      if (supabase) {
        let query = supabase
          .from("immunization_income_origins")
          .select("*")
          .order("name", { ascending: true });
        if (!includeInactive) query = query.eq("is_active", true);
        const { data, error } = await query;
        if (error) throw error;
        return (data || []).map(normalizeIncomeOrigin);
      }
    } catch (e) {
      console.warn("Fallback local listIncomeOrigins inmunizaciones", e);
    }
    const cachedRows = getCachedList<ImmunizationIncomeOrigin>(INCOME_ORIGINS_CACHE_KEY);
    const baseRows = cachedRows.length > 0 ? cachedRows : defaultIncomeOrigins();
    if (cachedRows.length === 0) setCachedList(INCOME_ORIGINS_CACHE_KEY, baseRows);
    const rows = includeInactive ? baseRows : baseRows.filter(origin => origin.isActive !== false);
    if (rows.length > 0) return rows.sort((a, b) => a.name.localeCompare(b.name));
    const defaults = defaultIncomeOrigins();
    setCachedList(INCOME_ORIGINS_CACHE_KEY, defaults);
    return defaults;
  },

  saveIncomeOrigin: async (
    origin: ImmunizationIncomeOrigin
  ): Promise<{ success: boolean; origin?: ImmunizationIncomeOrigin; message?: string }> => {
    try {
      const name = origin.name.trim();
      if (!name) return { success: false, message: "Ingrese el nombre del origen." };

      if (supabase) {
        const now = new Date().toISOString();
        if (origin.id && !origin.id.startsWith("default-")) {
          const { data: duplicate, error: duplicateError } = await supabase
            .from("immunization_income_origins")
            .select("id")
            .ilike("name", name)
            .neq("id", origin.id)
            .limit(1)
            .maybeSingle();
          if (duplicateError) throw duplicateError;
          if (duplicate) return { success: false, message: "Ya existe un origen con ese nombre." };

          const { data, error } = await supabase
            .from("immunization_income_origins")
            .update({
              name,
              is_active: origin.isActive !== false,
              updated_by: origin.updatedBy || origin.createdBy || null,
              updated_at: now
            })
            .eq("id", origin.id)
            .select()
            .single();
          if (error) throw error;
          return { success: true, origin: normalizeIncomeOrigin(data) };
        }

        const { data: existing, error: existingError } = await supabase
          .from("immunization_income_origins")
          .select("*")
          .ilike("name", name)
          .limit(1)
          .maybeSingle();
        if (existingError) throw existingError;

        if (existing) {
          const { data, error } = await supabase
            .from("immunization_income_origins")
            .update({
              is_active: origin.isActive !== false,
              updated_by: origin.updatedBy || origin.createdBy || null,
              updated_at: now
            })
            .eq("id", existing.id)
            .select()
            .single();
          if (error) throw error;
          return { success: true, origin: normalizeIncomeOrigin(data) };
        }

        const { data, error } = await supabase
          .from("immunization_income_origins")
          .insert({
            name,
            is_active: origin.isActive !== false,
            created_by: origin.createdBy || null,
            updated_by: origin.updatedBy || origin.createdBy || null,
            created_at: now,
            updated_at: now
          })
          .select()
          .single();
        if (error) throw error;
        return { success: true, origin: normalizeIncomeOrigin(data) };
      }

      return saveLocalIncomeOrigin(origin);
    } catch (e: any) {
      console.warn("Fallback local saveIncomeOrigin inmunizaciones", e);
      return saveLocalIncomeOrigin(origin);
    }
  },

  deleteIncomeOrigin: async (
    id: string,
    username?: string
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      if (!id) return { success: false, message: "No se encontró el origen de ingreso." };
      if (supabase && !id.startsWith("default-")) {
        const { error } = await supabase
          .from("immunization_income_origins")
          .update({
            is_active: false,
            updated_by: username || null,
            updated_at: new Date().toISOString()
          })
          .eq("id", id);
        if (error) throw error;
        return { success: true };
      }
      return deleteLocalIncomeOrigin(id, username);
    } catch (e: any) {
      console.warn("Fallback local deleteIncomeOrigin inmunizaciones", e);
      return deleteLocalIncomeOrigin(id, username);
    }
  },

  listIncomeBatches: async (scope: ImmunizationScope): Promise<ImmunizationIncomeBatch[]> => {
    try {
      if (supabase) {
        let query = supabase
          .from("immunization_income_batches")
          .select("*")
          .order("created_at", { ascending: false });

        if (scope.ownerType === "DIRESA") {
          query = query.eq("owner_type", "DIRESA");
        } else if (scope.ownerType === "UNGET" && scope.ungetIds) {
          query = scope.ungetIds.length > 0
            ? query.in("unget_id", scope.ungetIds)
            : query.eq("unget_id", "00000000-0000-0000-0000-000000000000");
        } else if (scope.ownerType === "IPRESS" && scope.facilityCodes) {
          query = scope.facilityCodes.length > 0
            ? query.in("destination_facility_code", scope.facilityCodes)
            : query.eq("destination_facility_code", "__NO_FACILITIES__");
        } else if (scope.level === "UNGET" && scope.ungetId) {
          query = query.eq("unget_id", scope.ungetId);
        } else if (scope.level === "IPRESS") {
          return [];
        }

        const { data, error } = await query;
        if (error) throw error;
        return (data || []).map(normalizeIncomeBatch);
      }
    } catch (e) {
      console.warn("Fallback local listIncomeBatches inmunizaciones", e);
    }
    return getCachedList<ImmunizationIncomeBatch>(INCOME_BATCHES_CACHE_KEY).filter(income => {
      if (scope.ownerType === "DIRESA") return income.ownerType === "DIRESA";
      if (scope.ownerType === "UNGET" && scope.ungetIds) return Boolean(income.ungetId && scope.ungetIds.includes(income.ungetId));
      if (scope.level === "UNGET") return income.ungetId === scope.ungetId;
      if (scope.level === "IPRESS") return false;
      return true;
    }).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  },

  getIncomeItems: async (incomeId: string): Promise<ImmunizationIncomeItem[]> => {
    try {
      if (supabase) {
        const { data, error } = await supabase
          .from("immunization_income_items")
          .select("*, product:product_id(*)")
          .eq("income_id", incomeId)
          .order("created_at", { ascending: true });
        if (error) throw error;
        return (data || []).map(normalizeIncomeItem);
      }
    } catch (e) {
      console.warn("Fallback local getIncomeItems inmunizaciones", e);
    }
    const products = getCachedList<ImmunizationProduct>(PRODUCTS_CACHE_KEY);
    return getCachedList<ImmunizationIncomeItem>(INCOME_ITEMS_CACHE_KEY)
      .filter(item => item.incomeId === incomeId)
      .map(item => ({ ...item, product: products.find(product => product.id === item.productId) }));
  },

  createIncomeBatch: async (
    income: ImmunizationIncomeBatch,
    items: ImmunizationIncomeItem[]
  ): Promise<{ success: boolean; income?: ImmunizationIncomeBatch; message?: string }> => {
    try {
      if (!["DIRESA", "UNGET"].includes(income.ownerType)) {
        return { success: false, message: "El ambito del ingreso no es valido." };
      }
      if (income.ownerType === "UNGET" && !income.ungetId) {
        return { success: false, message: "Seleccione la UNGET destino del ingreso." };
      }
      if (!income.sourceType) {
        return { success: false, message: "Seleccione el origen del ingreso." };
      }
      if (income.ownerType === "UNGET" && income.sourceType === "UNGET_TRANSFER" && !income.sourceUngetId) {
        return { success: false, message: "Seleccione la UNGET de origen de la transferencia." };
      }
      if (income.ownerType === "UNGET" && income.sourceType === "UNGET_TRANSFER" && income.sourceUngetId === income.ungetId) {
        return { success: false, message: "La UNGET de origen no puede ser la misma UNGET que recibe." };
      }
      if (items.length === 0) {
        return { success: false, message: "Agregue al menos un producto/lote al ingreso." };
      }
      if (items.some(item =>
        !item.productId ||
        !item.codigoSismedSnapshot.trim() ||
        !item.lote.trim() ||
        !item.expirationDate ||
        item.quantity <= 0 ||
        item.unitPrice < 0 ||
        !item.fundingSource.trim() ||
        !item.supplyType.trim()
      )) {
        return { success: false, message: "Revise los productos del ingreso; hay campos incompletos o cantidades invalidas." };
      }

      if (supabase) {
        const now = new Date().toISOString();
        const { data: batchRow, error: batchError } = await supabase
          .from("immunization_income_batches")
          .insert({
            owner_type: income.ownerType,
            regional_warehouse_id: income.ownerType === "DIRESA" ? getRegionalWarehouseId(income.regionalWarehouseId) : null,
            unget_id: income.ownerType === "UNGET" ? income.ungetId : null,
            period: income.period,
            source_type: income.sourceType,
            source_unget_id: income.sourceUngetId || null,
            source_name: income.sourceName?.trim() || null,
            reference_document: income.referenceDocument?.trim() || null,
            income_date: income.incomeDate || null,
            status: "DRAFT",
            observation: income.observation?.trim() || null,
            created_by: income.createdBy || null,
            created_at: now,
            updated_at: now
          })
          .select()
          .single();
        if (batchError) throw batchError;

        const { error: itemsError } = await supabase.from("immunization_income_items").insert(items.map(item => ({
          income_id: batchRow.id,
          product_id: item.productId,
          codigo_sismed_snapshot: item.codigoSismedSnapshot,
          lote: item.lote.trim(),
          expiration_date: item.expirationDate,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          funding_source: item.fundingSource.trim(),
          supply_type: item.supplyType.trim(),
          observation: item.observation?.trim() || null
        })));
        if (itemsError) throw itemsError;

        return { success: true, income: normalizeIncomeBatch(batchRow) };
      }

      const savedIncome: ImmunizationIncomeBatch = {
        ...income,
        id: income.id || makeLocalId("imm-income"),
        ownerType: income.ownerType,
        regionalWarehouseId: income.ownerType === "DIRESA" ? getRegionalWarehouseId(income.regionalWarehouseId) : undefined,
        status: "DRAFT",
        sourceName: income.sourceName?.trim() || undefined,
        referenceDocument: income.referenceDocument?.trim() || undefined,
        incomeDate: income.incomeDate || undefined,
        observation: income.observation?.trim() || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      setCachedList(INCOME_BATCHES_CACHE_KEY, [savedIncome, ...getCachedList<ImmunizationIncomeBatch>(INCOME_BATCHES_CACHE_KEY)]);
      setCachedList(INCOME_ITEMS_CACHE_KEY, [
        ...getCachedList<ImmunizationIncomeItem>(INCOME_ITEMS_CACHE_KEY),
        ...items.map(item => ({
          ...item,
          id: item.id || makeLocalId("imm-income-item"),
          incomeId: savedIncome.id,
          lote: item.lote.trim(),
          fundingSource: item.fundingSource.trim(),
          supplyType: item.supplyType.trim(),
          observation: item.observation?.trim() || undefined
        }))
      ]);
      return { success: true, income: savedIncome };
    } catch (e: any) {
      const rawMessage = `${e?.message || ""} ${e?.details || ""}`;
      if (rawMessage.includes("immunization_income_batches") || rawMessage.includes("immunization_income_items")) {
        return { success: false, message: "Falta ejecutar supabase/SUPABASE_MIGRATION_IMMUNIZATION_INCOMES.sql y supabase/SUPABASE_MIGRATION_IMMUNIZATION_REGIONAL_REFACTOR.sql en Supabase." };
      }
      return { success: false, message: e.message || "Error al registrar el ingreso regional." };
    }
  },

  applyIncomeBatch: async (
    incomeId: string,
    username?: string
  ): Promise<{ success: boolean; income?: ImmunizationIncomeBatch; message?: string }> => {
    try {
      if (supabase) {
        const { error } = await supabase.rpc("apply_immunization_income", {
          p_income_id: incomeId,
          p_applied_by: username || null
        });
        if (error) {
          const rawMessage = `${error.message || ""} ${error.details || ""}`;
          if (error.code === "PGRST202" || rawMessage.includes("apply_immunization_income")) {
            return { success: false, message: "Falta ejecutar supabase/SUPABASE_MIGRATION_IMMUNIZATION_INCOMES.sql y supabase/SUPABASE_MIGRATION_IMMUNIZATION_REGIONAL_REFACTOR.sql en Supabase." };
          }
          if (rawMessage.includes("INCOME_ALREADY_APPLIED")) {
            return { success: false, message: "El ingreso ya fue aplicado al stock." };
          }
          if (rawMessage.includes("INCOME_WITHOUT_ITEMS")) {
            return { success: false, message: "El ingreso no contiene productos para aplicar." };
          }
          throw error;
        }
        const { data: batchRow, error: fetchError } = await supabase
          .from("immunization_income_batches")
          .select("*")
          .eq("id", incomeId)
          .single();
        if (fetchError) throw fetchError;
        return { success: true, income: normalizeIncomeBatch(batchRow) };
      }

      const batches = getCachedList<ImmunizationIncomeBatch>(INCOME_BATCHES_CACHE_KEY);
      const batch = batches.find(item => item.id === incomeId);
      if (!batch) return { success: false, message: "Ingreso no encontrado." };
      if (batch.status !== "DRAFT") return { success: false, message: "El ingreso ya fue aplicado o anulado." };
      const items = getCachedList<ImmunizationIncomeItem>(INCOME_ITEMS_CACHE_KEY).filter(item => item.incomeId === incomeId);
      if (items.length === 0) return { success: false, message: "El ingreso no contiene productos para aplicar." };

      const products = getCachedList<ImmunizationProduct>(PRODUCTS_CACHE_KEY);
      const layers = [...getCachedList<ImmunizationStockLayer>(STOCK_CACHE_KEY)];
      const movements = [...getCachedList<ImmunizationStockMovement>(MOVEMENTS_CACHE_KEY)];
      const nextIncomeItems = getCachedList<ImmunizationIncomeItem>(INCOME_ITEMS_CACHE_KEY).map(item => ({ ...item }));
      const batchOwnerType = batch.ownerType || "UNGET";
      const batchRegionalWarehouseId = getRegionalWarehouseId(batch.regionalWarehouseId);

      items.forEach(item => {
        let layerIndex = layers.findIndex(layer =>
          layer.ownerType === batchOwnerType &&
          (batchOwnerType !== "DIRESA" || layer.regionalWarehouseId === batchRegionalWarehouseId) &&
          (batchOwnerType !== "UNGET" || layer.ungetId === batch.ungetId) &&
          !layer.facilityCode &&
          layer.productId === item.productId &&
          layer.lote === item.lote.trim() &&
          layer.expirationDate === item.expirationDate &&
          layer.unitPrice === item.unitPrice &&
          layer.fundingSource === item.fundingSource.trim() &&
          layer.supplyType === item.supplyType.trim()
        );
        const quantityBefore = layerIndex >= 0 ? layers[layerIndex].currentQuantity : 0;
        const quantityAfter = quantityBefore + item.quantity;
        const movementId = makeLocalId("imm-mov");

        if (layerIndex >= 0) {
          layers[layerIndex] = {
            ...layers[layerIndex],
            currentQuantity: quantityAfter,
            isActive: true,
            updatedAt: new Date().toISOString()
          };
        } else {
          layers.push({
            id: makeLocalId("imm-layer"),
            ownerType: batchOwnerType,
            regionalWarehouseId: batchOwnerType === "DIRESA" ? batchRegionalWarehouseId : undefined,
            ungetId: batchOwnerType === "UNGET" ? batch.ungetId : undefined,
            productId: item.productId,
            product: products.find(product => product.id === item.productId),
            lote: item.lote.trim(),
            expirationDate: item.expirationDate,
            unitPrice: item.unitPrice,
            fundingSource: item.fundingSource.trim(),
            supplyType: item.supplyType.trim(),
            sourceMovementId: movementId,
            currentQuantity: quantityAfter,
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
          layerIndex = layers.length - 1;
        }

        const storedItemIndex = nextIncomeItems.findIndex(row => row.id === item.id);
        if (storedItemIndex >= 0) nextIncomeItems[storedItemIndex].stockLayerId = layers[layerIndex].id;
        movements.push({
          id: movementId,
          movementType: batchOwnerType === "DIRESA" ? "DIRESA_INCOME" : "UNGET_INCOME",
          ownerType: batchOwnerType,
          regionalWarehouseId: batchOwnerType === "DIRESA" ? batchRegionalWarehouseId : undefined,
          ungetId: batchOwnerType === "UNGET" ? batch.ungetId : undefined,
          productId: item.productId,
          stockLayerId: layers[layerIndex].id,
          quantityDelta: item.quantity,
          quantityBefore,
          quantityAfter,
          period: batch.period,
          reason: getIncomeSourceLabel(batch.sourceType),
          observation: [batch.referenceDocument, batch.observation, item.observation].filter(Boolean).join(" | "),
          createdBy: username || batch.createdBy,
          createdAt: new Date().toISOString()
        });
      });

      const appliedAt = new Date().toISOString();
      const appliedBatch: ImmunizationIncomeBatch = {
        ...batch,
        status: "APPLIED",
        appliedBy: username,
        appliedAt,
        updatedAt: appliedAt
      };
      setCachedList(STOCK_CACHE_KEY, layers);
      setCachedList(MOVEMENTS_CACHE_KEY, movements);
      setCachedList(INCOME_ITEMS_CACHE_KEY, nextIncomeItems);
      setCachedList(INCOME_BATCHES_CACHE_KEY, batches.map(item => item.id === incomeId ? appliedBatch : item));
      return { success: true, income: appliedBatch };
    } catch (e: any) {
      return { success: false, message: e.message || "Error al aplicar ingreso al stock." };
    }
  },

  listDistributionBatches: async (scope: ImmunizationScope): Promise<ImmunizationDistributionBatch[]> => {
    try {
      if (supabase) {
        let query = supabase
          .from("immunization_distribution_batches")
          .select("*")
          .order("created_at", { ascending: false });

        if (scope.ownerType === "DIRESA") {
          query = query.eq("origin_owner_type", "DIRESA");
        } else if (scope.ownerType === "UNGET" && scope.ungetIds) {
          query = scope.ungetIds.length > 0
            ? query.in("unget_id", scope.ungetIds)
            : query.eq("unget_id", "00000000-0000-0000-0000-000000000000");
        } else if (scope.level === "UNGET" && scope.ungetId) {
          query = query.eq("unget_id", scope.ungetId);
        } else if (scope.level === "IPRESS" && scope.facilityCode) {
          query = query.eq("destination_facility_code", scope.facilityCode);
        }

        const { data, error } = await query;
        if (error) throw error;
        return (data || []).map(normalizeDistributionBatch);
      }
    } catch (e) {
      console.warn("Fallback local listDistributionBatches inmunizaciones", e);
    }
    return getCachedList<ImmunizationDistributionBatch>(DISTRIBUTION_BATCHES_CACHE_KEY).filter(batch => {
      const flow = getDistributionFlow(batch);
      if (scope.ownerType === "DIRESA") return getDistributionOriginOwner(batch) === "DIRESA";
      if (scope.ownerType === "UNGET" && scope.ungetIds) {
        return scope.ungetIds.some(ungetId => batch.ungetId === ungetId || batch.originUngetId === ungetId || batch.destinationUngetId === ungetId);
      }
      if (scope.ownerType === "IPRESS" && scope.facilityCodes) return scope.facilityCodes.includes(batch.destinationFacilityCode);
      if (scope.level === "UNGET") return flow === "DIRESA_UNGET"
        ? getDestinationUngetId(batch) === scope.ungetId
        : getOriginUngetId(batch) === scope.ungetId;
      if (scope.level === "IPRESS") return batch.destinationFacilityCode === scope.facilityCode;
      return true;
    }).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  },

  getDistributionItems: async (distributionId: string): Promise<ImmunizationDistributionItem[]> => {
    try {
      if (supabase) {
        const { data, error } = await supabase
          .from("immunization_distribution_items")
          .select("*, product:product_id(*)")
          .eq("distribution_id", distributionId)
          .order("created_at", { ascending: true });
        if (error) throw error;
        return (data || []).map(normalizeDistributionItem);
      }
    } catch (e) {
      console.warn("Fallback local getDistributionItems inmunizaciones", e);
    }
    const products = getCachedList<ImmunizationProduct>(PRODUCTS_CACHE_KEY);
    return getCachedList<ImmunizationDistributionItem>(DISTRIBUTION_ITEMS_CACHE_KEY)
      .filter(item => item.distributionId === distributionId)
      .map(item => ({ ...item, product: products.find(product => product.id === item.productId) }));
  },

  createDistributionBatch: async (
    distribution: ImmunizationDistributionBatch,
    items: ImmunizationDistributionItem[]
  ): Promise<{ success: boolean; distribution?: ImmunizationDistributionBatch; message?: string }> => {
    try {
      const flow = getDistributionFlow(distribution);
      const originOwner = getDistributionOriginOwner(distribution);
      const destinationOwner = getDistributionDestinationOwner(distribution);
      const originUngetId = getOriginUngetId(distribution);
      const destinationUngetId = getDestinationUngetId(distribution);
      const regionalWarehouseId = getRegionalWarehouseId(distribution.regionalWarehouseId);

      if (flow === "DIRESA_UNGET" && (!destinationUngetId || originOwner !== "DIRESA" || destinationOwner !== "UNGET")) {
        return { success: false, message: "Seleccione la UNGET destino de la distribucion regional." };
      }
      if (flow === "UNGET_IPRESS" && (!originUngetId || !distribution.destinationFacilityCode || originOwner !== "UNGET" || destinationOwner !== "IPRESS")) {
        return { success: false, message: "Seleccione la UNGET origen y la IPRESS destino." };
      }
      if (!distribution.criterion) {
        return { success: false, message: "Seleccione el criterio de distribucion." };
      }
      if (items.length === 0) {
        return { success: false, message: "Agregue al menos un producto/lote a distribuir." };
      }
      if (items.some(item =>
        !item.productId ||
        !item.sourceStockLayerId ||
        !item.codigoSismedSnapshot.trim() ||
        !item.lote.trim() ||
        !item.expirationDate ||
        item.quantity <= 0 ||
        item.unitPrice < 0 ||
        !item.fundingSource.trim() ||
        !item.supplyType.trim()
      )) {
        return { success: false, message: "Revise el detalle; hay productos incompletos o cantidades invalidas." };
      }

      const repeatedLayer = items.find((item, index) => items.findIndex(row => row.sourceStockLayerId === item.sourceStockLayerId) !== index);
      if (repeatedLayer) {
        return { success: false, message: "Un mismo lote no debe repetirse en la distribucion. Edite la cantidad del item existente." };
      }

      if (supabase) {
        const now = new Date().toISOString();
        const { data: batchRow, error: batchError } = await supabase
          .from("immunization_distribution_batches")
          .insert({
            flow_type: flow,
            origin_owner_type: originOwner,
            destination_owner_type: destinationOwner,
            regional_warehouse_id: flow === "DIRESA_UNGET" ? regionalWarehouseId : null,
            origin_unget_id: flow === "UNGET_IPRESS" ? originUngetId : null,
            destination_unget_id: flow === "DIRESA_UNGET" ? destinationUngetId : null,
            unget_id: flow === "DIRESA_UNGET" ? destinationUngetId : originUngetId,
            destination_facility_code: flow === "UNGET_IPRESS" ? distribution.destinationFacilityCode : null,
            period: distribution.period,
            criterion: distribution.criterion,
            status: "DRAFT",
            reference_document: distribution.referenceDocument?.trim() || null,
            observation: distribution.observation?.trim() || null,
            created_by: distribution.createdBy || null,
            created_at: now,
            updated_at: now
          })
          .select()
          .single();
        if (batchError) throw batchError;

        const { error: itemsError } = await supabase.from("immunization_distribution_items").insert(items.map(item => ({
          distribution_id: batchRow.id,
          product_id: item.productId,
          source_stock_layer_id: item.sourceStockLayerId,
          codigo_sismed_snapshot: item.codigoSismedSnapshot,
          lote: item.lote.trim(),
          expiration_date: item.expirationDate,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          funding_source: item.fundingSource.trim(),
          supply_type: item.supplyType.trim(),
          observation: item.observation?.trim() || null
        })));
        if (itemsError) throw itemsError;

        return { success: true, distribution: normalizeDistributionBatch(batchRow) };
      }

      const savedDistribution: ImmunizationDistributionBatch = {
        ...distribution,
        id: distribution.id || makeLocalId("imm-dist"),
        flowType: flow,
        originOwnerType: originOwner,
        destinationOwnerType: destinationOwner,
        regionalWarehouseId: flow === "DIRESA_UNGET" ? regionalWarehouseId : undefined,
        originUngetId: flow === "UNGET_IPRESS" ? originUngetId : undefined,
        destinationUngetId: flow === "DIRESA_UNGET" ? destinationUngetId : undefined,
        ungetId: flow === "DIRESA_UNGET" ? destinationUngetId! : originUngetId!,
        destinationFacilityCode: flow === "UNGET_IPRESS" ? distribution.destinationFacilityCode : "",
        criterion: distribution.criterion || "REGULAR",
        status: "DRAFT",
        referenceDocument: distribution.referenceDocument?.trim() || undefined,
        observation: distribution.observation?.trim() || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      setCachedList(DISTRIBUTION_BATCHES_CACHE_KEY, [savedDistribution, ...getCachedList<ImmunizationDistributionBatch>(DISTRIBUTION_BATCHES_CACHE_KEY)]);
      setCachedList(DISTRIBUTION_ITEMS_CACHE_KEY, [
        ...getCachedList<ImmunizationDistributionItem>(DISTRIBUTION_ITEMS_CACHE_KEY),
        ...items.map(item => ({
          ...item,
          id: item.id || makeLocalId("imm-dist-item"),
          distributionId: savedDistribution.id,
          lote: item.lote.trim(),
          fundingSource: item.fundingSource.trim(),
          supplyType: item.supplyType.trim(),
          observation: item.observation?.trim() || undefined
        }))
      ]);
      return { success: true, distribution: savedDistribution };
    } catch (e: any) {
      const rawMessage = `${e?.message || ""} ${e?.details || ""}`;
      if (rawMessage.includes("immunization_distribution_batches") || rawMessage.includes("immunization_distribution_items")) {
        return { success: false, message: "Falta ejecutar supabase/SUPABASE_MIGRATION_IMMUNIZATION_DISTRIBUTIONS.sql y supabase/SUPABASE_MIGRATION_IMMUNIZATION_REGIONAL_REFACTOR.sql en Supabase." };
      }
      return { success: false, message: e.message || "Error al registrar la distribucion." };
    }
  },

  sendDistributionBatch: async (
    distributionId: string,
    username?: string
  ): Promise<{ success: boolean; distribution?: ImmunizationDistributionBatch; message?: string }> => {
    try {
      const localBatchForLock = getCachedList<ImmunizationDistributionBatch>(DISTRIBUTION_BATCHES_CACHE_KEY).find(item => item.id === distributionId);
      let batchForLock = localBatchForLock;
      if (supabase) {
        const { data: lockRow } = await supabase
          .from("immunization_distribution_batches")
          .select("*")
          .eq("id", distributionId)
          .maybeSingle();
        if (lockRow) batchForLock = normalizeDistributionBatch(lockRow);
      }
      if (batchForLock && getDistributionFlow(batchForLock) === "UNGET_IPRESS") {
        const originScope: ImmunizationScope = {
          level: "UNGET",
          ownerType: "UNGET",
          ungetId: getOriginUngetId(batchForLock)
        };
        if (await immunizationApi.isPeriodLocked(originScope, batchForLock.period)) {
          return { success: false, message: "El periodo UNGET ya está cerrado. No se puede enviar una distribución de ese periodo." };
        }
      }

      if (supabase) {
        const { error } = await supabase.rpc("send_immunization_distribution", {
          p_distribution_id: distributionId,
          p_sent_by: username || null
        });
        if (error) {
          const rawMessage = `${error.message || ""} ${error.details || ""}`;
          if (error.code === "PGRST202" || rawMessage.includes("send_immunization_distribution")) {
            return { success: false, message: "Falta ejecutar supabase/SUPABASE_MIGRATION_IMMUNIZATION_DISTRIBUTIONS.sql y supabase/SUPABASE_MIGRATION_IMMUNIZATION_REGIONAL_REFACTOR.sql en Supabase." };
          }
          if (rawMessage.includes("DISTRIBUTION_NOT_DRAFT")) {
            return { success: false, message: "La distribucion ya fue enviada, recibida o anulada." };
          }
          if (rawMessage.includes("DISTRIBUTION_WITHOUT_ITEMS")) {
            return { success: false, message: "La distribucion no contiene productos." };
          }
          if (rawMessage.includes("DESTINATION_OUT_OF_UNGET")) {
            return { success: false, message: "El destino seleccionado no pertenece al ambito operativo correspondiente." };
          }
          if (rawMessage.includes("DESTINATION_UNGET_NOT_FOUND")) {
            return { success: false, message: "La UNGET destino no existe o no esta disponible." };
          }
          if (rawMessage.includes("INVALID_REGIONAL_DISTRIBUTION") || rawMessage.includes("INVALID_UNGET_DISTRIBUTION")) {
            return { success: false, message: "La distribucion tiene un flujo invalido. Ejecute la migracion regional y vuelva a registrar." };
          }
          if (rawMessage.includes("SOURCE_STOCK_NOT_FOUND")) {
            return { success: false, message: "Uno de los lotes seleccionados ya no existe en el stock origen." };
          }
          if (rawMessage.includes("INSUFFICIENT_STOCK")) {
            return { success: false, message: "No hay stock suficiente para uno de los lotes seleccionados. Actualice y revise cantidades." };
          }
          throw error;
        }
        const { data: batchRow, error: fetchError } = await supabase
          .from("immunization_distribution_batches")
          .select("*")
          .eq("id", distributionId)
          .single();
        if (fetchError) throw fetchError;
        return { success: true, distribution: normalizeDistributionBatch(batchRow) };
      }

      const batches = getCachedList<ImmunizationDistributionBatch>(DISTRIBUTION_BATCHES_CACHE_KEY);
      const batch = batches.find(item => item.id === distributionId);
      if (!batch) return { success: false, message: "Distribucion no encontrada." };
      if (batch.status !== "DRAFT") return { success: false, message: "La distribucion ya fue enviada, recibida o anulada." };
      const items = getCachedList<ImmunizationDistributionItem>(DISTRIBUTION_ITEMS_CACHE_KEY).filter(item => item.distributionId === distributionId);
      if (items.length === 0) return { success: false, message: "La distribucion no contiene productos." };

      const layers = [...getCachedList<ImmunizationStockLayer>(STOCK_CACHE_KEY)];
      const movements = [...getCachedList<ImmunizationStockMovement>(MOVEMENTS_CACHE_KEY)];
      const flow = getDistributionFlow(batch);
      const originOwner = getDistributionOriginOwner(batch);
      const regionalWarehouseId = getRegionalWarehouseId(batch.regionalWarehouseId);
      const originUngetId = getOriginUngetId(batch);
      for (const item of items) {
        const layer = layers.find(row => row.id === item.sourceStockLayerId);
        const isValidSource = originOwner === "DIRESA"
          ? layer?.ownerType === "DIRESA" && layer.regionalWarehouseId === regionalWarehouseId
          : layer?.ownerType === "UNGET" && layer.ungetId === originUngetId;
        if (!layer || !isValidSource || layer.productId !== item.productId) {
          return { success: false, message: originOwner === "DIRESA" ? "Uno de los lotes seleccionados ya no pertenece al stock regional DIRESA." : "Uno de los lotes seleccionados ya no pertenece al stock de la UNGET." };
        }
        if (layer.currentQuantity < item.quantity) {
          return { success: false, message: `Stock insuficiente para el lote ${item.lote}. Disponible: ${layer.currentQuantity}.` };
        }
      }

      items.forEach(item => {
        const index = layers.findIndex(row => row.id === item.sourceStockLayerId);
        if (index < 0) return;
        const before = layers[index].currentQuantity;
        const after = before - item.quantity;
        layers[index] = {
          ...layers[index],
          currentQuantity: after,
          isActive: after > 0,
          updatedAt: new Date().toISOString()
        };
        movements.push({
          id: makeLocalId("imm-mov"),
          movementType: flow === "DIRESA_UNGET" ? "DIRESA_DISTRIBUTION_OUT" : "UNGET_DISTRIBUTION_OUT",
          ownerType: originOwner,
          regionalWarehouseId: originOwner === "DIRESA" ? regionalWarehouseId : undefined,
          ungetId: originOwner === "UNGET" ? originUngetId : undefined,
          productId: item.productId,
          stockLayerId: item.sourceStockLayerId,
          quantityDelta: -item.quantity,
          quantityBefore: before,
          quantityAfter: after,
          period: batch.period,
          reason: flow === "DIRESA_UNGET" ? "Distribucion regional a UNGET pendiente de recepcion" : "Distribucion a IPRESS pendiente de recepcion",
          observation: [getDestinationUngetId(batch), batch.destinationFacilityCode, batch.referenceDocument, batch.observation, item.observation].filter(Boolean).join(" | "),
          createdBy: username || batch.createdBy,
          createdAt: new Date().toISOString()
        });
      });

      const sentAt = new Date().toISOString();
      const sentBatch: ImmunizationDistributionBatch = {
        ...batch,
        status: "SENT",
        sentBy: username,
        sentAt,
        updatedAt: sentAt
      };
      setCachedList(STOCK_CACHE_KEY, layers);
      setCachedList(MOVEMENTS_CACHE_KEY, movements);
      setCachedList(DISTRIBUTION_BATCHES_CACHE_KEY, batches.map(item => item.id === distributionId ? sentBatch : item));
      return { success: true, distribution: sentBatch };
    } catch (e: any) {
      return { success: false, message: e.message || "Error al enviar la distribucion." };
    }
  },

  receiveDistributionBatch: async (
    distributionId: string,
    username?: string,
    reception?: ImmunizationReceptionInput
  ): Promise<{ success: boolean; distribution?: ImmunizationDistributionBatch; message?: string }> => {
    try {
      const receptionItems = reception?.items || [];
      if (receptionItems.some(item => !item.itemId || item.receivedQuantity < 0 || !Number.isFinite(item.receivedQuantity))) {
        return { success: false, message: "Revise las cantidades recibidas; no pueden ser negativas." };
      }
      const receptionObservation = reception?.observation?.trim() || "";
      const receptionReason = reception?.reason || undefined;

      if (supabase) {
        const { data: lockRow } = await supabase
          .from("immunization_distribution_batches")
          .select("*")
          .eq("id", distributionId)
          .maybeSingle();
        const batchForLock = lockRow ? normalizeDistributionBatch(lockRow) : undefined;
        if (batchForLock) {
          const destinationOwner = getDistributionDestinationOwner(batchForLock);
          const destinationScope: ImmunizationScope = destinationOwner === "IPRESS"
            ? { level: "IPRESS", ownerType: "IPRESS", ungetId: batchForLock.ungetId, facilityCode: batchForLock.destinationFacilityCode }
            : { level: "UNGET", ownerType: "UNGET", ungetId: getDestinationUngetId(batchForLock) };
          if (await immunizationApi.isPeriodLocked(destinationScope, batchForLock.period)) {
            return { success: false, message: "El periodo del destino ya está cerrado. No se puede aceptar la distribución." };
          }
        }

        const { error } = await supabase.rpc("receive_immunization_distribution", {
          p_distribution_id: distributionId,
          p_received_by: username || null,
          p_reception_reason: receptionReason || null,
          p_reception_observation: receptionObservation || null,
          p_items: receptionItems.map(item => ({
            item_id: item.itemId,
            received_quantity: item.receivedQuantity
          }))
        });
        if (error) {
          const rawMessage = `${error.message || ""} ${error.details || ""}`;
          if (error.code === "PGRST202" || rawMessage.includes("receive_immunization_distribution")) {
            return { success: false, message: "Falta ejecutar supabase/SUPABASE_MIGRATION_IMMUNIZATION_RECEPTIONS.sql y supabase/SUPABASE_MIGRATION_IMMUNIZATION_REGIONAL_REFACTOR.sql en Supabase." };
          }
          if (rawMessage.includes("DISTRIBUTION_NOT_PENDING")) {
            return { success: false, message: "La distribucion no esta pendiente de recepcion." };
          }
          if (rawMessage.includes("INVALID_REGIONAL_RECEPTION") || rawMessage.includes("INVALID_IPRESS_RECEPTION")) {
            return { success: false, message: "La recepcion tiene un flujo invalido. Ejecute la migracion regional y vuelva a registrar." };
          }
          if (rawMessage.includes("RECEPTION_WITHOUT_ITEMS")) {
            return { success: false, message: "La recepcion no contiene detalle de productos." };
          }
          if (rawMessage.includes("RECEPTION_NEGATIVE_QUANTITY")) {
            return { success: false, message: "La cantidad recibida no puede ser negativa." };
          }
          if (rawMessage.includes("OBSERVED_RECEPTION_REQUIRES_REASON")) {
            return { success: false, message: "Si existe diferencia fisica, seleccione un motivo de incidencia." };
          }
          if (rawMessage.includes("OBSERVED_RECEPTION_REQUIRES_OBSERVATION")) {
            return { success: false, message: "Si registra una incidencia fisica, agregue una observacion." };
          }
          throw error;
        }
        const { data: batchRow, error: fetchError } = await supabase
          .from("immunization_distribution_batches")
          .select("*")
          .eq("id", distributionId)
          .single();
        if (fetchError) throw fetchError;
        return { success: true, distribution: normalizeDistributionBatch(batchRow) };
      }

      const batches = getCachedList<ImmunizationDistributionBatch>(DISTRIBUTION_BATCHES_CACHE_KEY);
      const batch = batches.find(item => item.id === distributionId);
      if (!batch) return { success: false, message: "Distribucion no encontrada." };
      const destinationOwnerForLock = getDistributionDestinationOwner(batch);
      const destinationScopeForLock: ImmunizationScope = destinationOwnerForLock === "IPRESS"
        ? { level: "IPRESS", ownerType: "IPRESS", ungetId: batch.ungetId, facilityCode: batch.destinationFacilityCode }
        : { level: "UNGET", ownerType: "UNGET", ungetId: getDestinationUngetId(batch) };
      if (await immunizationApi.isPeriodLocked(destinationScopeForLock, batch.period)) {
        return { success: false, message: "El periodo del destino ya está cerrado. No se puede aceptar la distribución." };
      }
      if (batch.status !== "SENT") return { success: false, message: "La distribucion no esta pendiente de recepcion." };
      const items = getCachedList<ImmunizationDistributionItem>(DISTRIBUTION_ITEMS_CACHE_KEY).filter(item => item.distributionId === distributionId);
      if (items.length === 0) return { success: false, message: "La distribucion no contiene productos." };

      const receivedByItem = new Map(receptionItems.map(item => [item.itemId, item.receivedQuantity]));
      const completedReceptionItems = items.map(item => ({
        item,
        receivedQuantity: item.id && receivedByItem.has(item.id)
          ? Number(receivedByItem.get(item.id))
          : item.quantity
      }));
      if (completedReceptionItems.some(row => row.receivedQuantity < 0 || !Number.isFinite(row.receivedQuantity))) {
        return { success: false, message: "Revise las cantidades recibidas; no pueden ser negativas." };
      }

      const hasDifference = completedReceptionItems.some(row => row.receivedQuantity !== row.item.quantity);
      const isObserved = hasDifference || Boolean(receptionReason);
      if (hasDifference && !receptionReason) {
        return { success: false, message: "Si existe diferencia fisica, seleccione un motivo de incidencia." };
      }
      if ((hasDifference || receptionReason) && !receptionObservation) {
        return { success: false, message: "Si registra una incidencia fisica, agregue una observacion." };
      }

      const products = getCachedList<ImmunizationProduct>(PRODUCTS_CACHE_KEY);
      const layers = [...getCachedList<ImmunizationStockLayer>(STOCK_CACHE_KEY)];
      const movements = [...getCachedList<ImmunizationStockMovement>(MOVEMENTS_CACHE_KEY)];
      const nextDistributionItems = getCachedList<ImmunizationDistributionItem>(DISTRIBUTION_ITEMS_CACHE_KEY).map(item => ({ ...item }));
      const now = new Date().toISOString();
      const flow = getDistributionFlow(batch);
      const destinationOwner = getDistributionDestinationOwner(batch);
      const destinationUngetId = getDestinationUngetId(batch);

      completedReceptionItems.forEach(({ item, receivedQuantity }) => {
        if (receivedQuantity === 0) {
          const itemIndex = nextDistributionItems.findIndex(row => row.id === item.id);
          if (itemIndex >= 0) {
            nextDistributionItems[itemIndex].receivedQuantity = 0;
            nextDistributionItems[itemIndex].destinationStockLayerId = undefined;
          }
          return;
        }

        let layerIndex = layers.findIndex(layer =>
          layer.ownerType === destinationOwner &&
          (destinationOwner !== "UNGET" || layer.ungetId === destinationUngetId) &&
          (destinationOwner !== "IPRESS" || layer.facilityCode === batch.destinationFacilityCode) &&
          layer.productId === item.productId &&
          layer.lote === item.lote.trim() &&
          layer.expirationDate === item.expirationDate &&
          layer.unitPrice === item.unitPrice &&
          layer.fundingSource === item.fundingSource.trim() &&
          layer.supplyType === item.supplyType.trim()
        );
        const before = layerIndex >= 0 ? layers[layerIndex].currentQuantity : 0;
        const after = before + receivedQuantity;
        const movementId = makeLocalId("imm-mov");

        if (layerIndex >= 0) {
          layers[layerIndex] = {
            ...layers[layerIndex],
            currentQuantity: after,
            isActive: true,
            updatedAt: now
          };
        } else {
          layers.push({
            id: makeLocalId("imm-layer"),
            ownerType: destinationOwner,
            ungetId: destinationOwner === "UNGET" ? destinationUngetId : batch.ungetId,
            facilityCode: destinationOwner === "IPRESS" ? batch.destinationFacilityCode : undefined,
            productId: item.productId,
            product: item.product || products.find(product => product.id === item.productId),
            lote: item.lote.trim(),
            expirationDate: item.expirationDate,
            unitPrice: item.unitPrice,
            fundingSource: item.fundingSource.trim(),
            supplyType: item.supplyType.trim(),
            sourceMovementId: movementId,
            currentQuantity: after,
            isActive: true,
            createdAt: now,
            updatedAt: now
          });
          layerIndex = layers.length - 1;
        }

        const itemIndex = nextDistributionItems.findIndex(row => row.id === item.id);
        if (itemIndex >= 0) {
          nextDistributionItems[itemIndex].receivedQuantity = receivedQuantity;
          nextDistributionItems[itemIndex].destinationStockLayerId = layers[layerIndex].id;
        }
        movements.push({
          id: movementId,
          movementType: flow === "DIRESA_UNGET" ? "UNGET_DISTRIBUTION_IN" : "IPRESS_DISTRIBUTION_IN",
          ownerType: destinationOwner,
          ungetId: destinationOwner === "UNGET" ? destinationUngetId : batch.ungetId,
          facilityCode: destinationOwner === "IPRESS" ? batch.destinationFacilityCode : undefined,
          productId: item.productId,
          stockLayerId: layers[layerIndex].id,
          quantityDelta: receivedQuantity,
          quantityBefore: before,
          quantityAfter: after,
          period: batch.period,
          reason: isObserved
            ? (flow === "DIRESA_UNGET" ? "Recepcion observada de distribucion DIRESA" : "Recepcion observada de distribucion UNGET")
            : (flow === "DIRESA_UNGET" ? "Recepcion conforme de distribucion DIRESA" : "Recepcion conforme de distribucion UNGET"),
          observation: [batch.referenceDocument, batch.observation, receptionReason, receptionObservation, item.observation].filter(Boolean).join(" | "),
          createdBy: username,
          createdAt: now
        });
      });

      const receivedBatch: ImmunizationDistributionBatch = {
        ...batch,
        status: isObserved ? "OBSERVED" : "RECEIVED",
        receivedBy: username,
        receivedAt: now,
        receptionReason,
        receptionObservation: receptionObservation || undefined,
        updatedAt: now
      };
      setCachedList(STOCK_CACHE_KEY, layers);
      setCachedList(MOVEMENTS_CACHE_KEY, movements);
      setCachedList(DISTRIBUTION_ITEMS_CACHE_KEY, nextDistributionItems);
      setCachedList(DISTRIBUTION_BATCHES_CACHE_KEY, batches.map(item => item.id === distributionId ? receivedBatch : item));
      return { success: true, distribution: receivedBatch };
    } catch (e: any) {
      return { success: false, message: e.message || "Error al aceptar la recepcion." };
    }
  },

  listConsumptionMovements: async (scope: ImmunizationScope): Promise<ImmunizationStockMovement[]> => {
    try {
      if (supabase) {
        let query = supabase
          .from("immunization_stock_movements")
          .select("*")
          .eq("movement_type", "IPRESS_CONSUMPTION")
          .order("created_at", { ascending: false });

        if (scope.level === "IPRESS" && scope.facilityCode) {
          query = query.eq("owner_type", "IPRESS").eq("facility_code", scope.facilityCode);
        } else if (scope.ownerType === "IPRESS" && scope.facilityCodes) {
          query = scope.facilityCodes.length > 0
            ? query.eq("owner_type", "IPRESS").in("facility_code", scope.facilityCodes)
            : query.eq("facility_code", "__NO_FACILITIES__");
        } else if (scope.ownerType === "UNGET" && scope.ungetIds) {
          query = scope.ungetIds.length > 0
            ? query.eq("owner_type", "IPRESS").in("unget_id", scope.ungetIds)
            : query.eq("unget_id", "00000000-0000-0000-0000-000000000000");
        } else if (scope.level === "UNGET" && scope.ungetId) {
          query = query.eq("owner_type", "IPRESS").eq("unget_id", scope.ungetId);
        } else {
          query = query.eq("owner_type", "IPRESS");
        }

        const { data, error } = await query;
        if (error) throw error;
        return (data || []).map(normalizeStockMovement);
      }
    } catch (e) {
      console.warn("Fallback local listConsumptionMovements inmunizaciones", e);
    }

    return getCachedList<ImmunizationStockMovement>(MOVEMENTS_CACHE_KEY)
      .filter(movement => {
        if (movement.movementType !== "IPRESS_CONSUMPTION") return false;
        if (scope.level === "IPRESS") return movement.facilityCode === scope.facilityCode;
        if (scope.ownerType === "IPRESS" && scope.facilityCodes) return movement.facilityCode ? scope.facilityCodes.includes(movement.facilityCode) : false;
        if (scope.ownerType === "UNGET" && scope.ungetIds) return movement.ungetId ? scope.ungetIds.includes(movement.ungetId) : false;
        if (scope.level === "UNGET") return movement.ungetId === scope.ungetId;
        return movement.ownerType === "IPRESS";
      })
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  },

  recordConsumption: async (
    scope: ImmunizationScope,
    input: ImmunizationConsumptionInput,
    username?: string
  ): Promise<{ success: boolean; movement?: ImmunizationStockMovement; message?: string }> => {
    try {
      if (scope.level !== "IPRESS" || !scope.facilityCode) {
        return { success: false, message: "Solo una IPRESS puede registrar consumos." };
      }
      const quantity = Number(input.consumptionQuantity);
      const dosesApplied = Number(input.dosesApplied);
      if (!input.stockLayerId) return { success: false, message: "Seleccione el lote a consumir." };
      if (!input.period || !/^[0-9]{4}-[0-9]{2}$/.test(input.period)) return { success: false, message: "Periodo inválido." };
      if (await immunizationApi.isPeriodLocked(scope, input.period)) {
        return { success: false, message: "El periodo ya está precerrado o cerrado. No se pueden registrar consumos." };
      }
      if (!Number.isFinite(quantity) || quantity <= 0) return { success: false, message: "El consumo en frascos/unidades debe ser mayor a cero." };
      if (!Number.isFinite(dosesApplied) || dosesApplied < 0) return { success: false, message: "Las dosis aplicadas no pueden ser negativas." };

      if (supabase) {
        const { data: layerRow, error: layerError } = await supabase
          .from("immunization_stock_layers")
          .select("*, product:product_id(*)")
          .eq("id", input.stockLayerId)
          .single();
        if (layerError) throw layerError;

        const layer = normalizeStockLayer(layerRow);
        if (layer.ownerType !== "IPRESS" || layer.facilityCode !== scope.facilityCode) {
          return { success: false, message: "El lote seleccionado no pertenece a la IPRESS del usuario." };
        }
        if (!layer.isActive || layer.currentQuantity <= 0) {
          return { success: false, message: "El lote seleccionado no tiene stock disponible." };
        }
        if (quantity > layer.currentQuantity) {
          return { success: false, message: `No puede consumir más del saldo disponible (${layer.currentQuantity}).` };
        }

        const dosesPerUnit = Number(layer.product?.dosisUnidad) || 0;
        const consumedDoses = quantity * dosesPerUnit;
        if (dosesPerUnit > 0 && dosesApplied > consumedDoses) {
          return { success: false, message: `Las dosis aplicadas no pueden superar las dosis consumidas (${consumedDoses}).` };
        }
        const dosesLost = Math.max(consumedDoses - dosesApplied, 0);
        const lossFactor = consumedDoses > 0 ? (dosesLost / consumedDoses) * 100 : 0;
        const quantityAfter = layer.currentQuantity - quantity;
        const now = new Date().toISOString();

        const { error: updateError } = await supabase
          .from("immunization_stock_layers")
          .update({
            current_quantity: quantityAfter,
            is_active: quantityAfter > 0,
            updated_at: now
          })
          .eq("id", layer.id);
        if (updateError) throw updateError;

        const observation = [
          `Dosis aplicadas: ${dosesApplied}`,
          `Dosis consumidas: ${consumedDoses}`,
          `Dosis perdidas: ${dosesLost}`,
          `Factor pérdida: ${lossFactor.toFixed(2)}%`,
          input.observation?.trim()
        ].filter(Boolean).join(" | ");

        const movementPayload = {
          movement_type: "IPRESS_CONSUMPTION",
          owner_type: "IPRESS",
          unget_id: layer.ungetId || scope.ungetId || null,
          facility_code: scope.facilityCode,
          product_id: layer.productId,
          stock_layer_id: layer.id,
          quantity_delta: -quantity,
          quantity_before: layer.currentQuantity,
          quantity_after: quantityAfter,
          period: input.period,
          reason: "Consumo IPRESS por registro",
          observation,
          consumed_doses: consumedDoses,
          doses_applied: dosesApplied,
          doses_lost: dosesLost,
          loss_factor: lossFactor,
          created_by: username || null,
          created_at: now
        };

        let insertResult = await supabase
          .from("immunization_stock_movements")
          .insert(movementPayload)
          .select()
          .single();

        if (insertResult.error) {
          const rawMessage = `${insertResult.error.message || ""} ${insertResult.error.details || ""}`;
          if (rawMessage.includes("consumed_doses") || rawMessage.includes("doses_applied") || rawMessage.includes("doses_lost") || rawMessage.includes("loss_factor")) {
            const { consumed_doses, doses_applied, doses_lost, loss_factor, ...basePayload } = movementPayload;
            insertResult = await supabase
              .from("immunization_stock_movements")
              .insert(basePayload)
              .select()
              .single();
          }
        }

        if (insertResult.error) {
          await supabase
            .from("immunization_stock_layers")
            .update({
              current_quantity: layer.currentQuantity,
              is_active: layer.isActive,
              updated_at: now
            })
            .eq("id", layer.id);
          throw insertResult.error;
        }
        const movement = normalizeStockMovement(insertResult.data);
        return {
          success: true,
          movement: {
            ...movement,
            consumedDoses,
            dosesApplied,
            dosesLost,
            lossFactor
          }
        };
      }

      const layers = [...getCachedList<ImmunizationStockLayer>(STOCK_CACHE_KEY)];
      const layerIndex = layers.findIndex(layer => layer.id === input.stockLayerId);
      if (layerIndex < 0) return { success: false, message: "Lote no encontrado en el stock." };
      const layer = layers[layerIndex];
      if (layer.ownerType !== "IPRESS" || layer.facilityCode !== scope.facilityCode) {
        return { success: false, message: "El lote seleccionado no pertenece a la IPRESS del usuario." };
      }
      if (!layer.isActive || layer.currentQuantity <= 0) return { success: false, message: "El lote seleccionado no tiene stock disponible." };
      if (quantity > layer.currentQuantity) return { success: false, message: `No puede consumir más del saldo disponible (${layer.currentQuantity}).` };

      const products = getCachedList<ImmunizationProduct>(PRODUCTS_CACHE_KEY);
      const product = layer.product || products.find(row => row.id === layer.productId);
      const dosesPerUnit = Number(product?.dosisUnidad) || 0;
      const consumedDoses = quantity * dosesPerUnit;
      if (dosesPerUnit > 0 && dosesApplied > consumedDoses) {
        return { success: false, message: `Las dosis aplicadas no pueden superar las dosis consumidas (${consumedDoses}).` };
      }
      const dosesLost = Math.max(consumedDoses - dosesApplied, 0);
      const lossFactor = consumedDoses > 0 ? (dosesLost / consumedDoses) * 100 : 0;
      const quantityBefore = layer.currentQuantity;
      const quantityAfter = quantityBefore - quantity;
      const now = new Date().toISOString();

      layers[layerIndex] = {
        ...layer,
        product,
        currentQuantity: quantityAfter,
        isActive: quantityAfter > 0,
        updatedAt: now
      };

      const movement: ImmunizationStockMovement = {
        id: makeLocalId("imm-mov"),
        movementType: "IPRESS_CONSUMPTION",
        ownerType: "IPRESS",
        ungetId: layer.ungetId || scope.ungetId,
        facilityCode: scope.facilityCode,
        productId: layer.productId,
        stockLayerId: layer.id,
        quantityDelta: -quantity,
        quantityBefore,
        quantityAfter,
        period: input.period,
        reason: "Consumo IPRESS por registro",
        observation: input.observation?.trim() || undefined,
        consumedDoses,
        dosesApplied,
        dosesLost,
        lossFactor,
        createdBy: username,
        createdAt: now
      };

      setCachedList(STOCK_CACHE_KEY, layers);
      setCachedList(MOVEMENTS_CACHE_KEY, [movement, ...getCachedList<ImmunizationStockMovement>(MOVEMENTS_CACHE_KEY)]);
      return { success: true, movement };
    } catch (e: any) {
      return { success: false, message: e.message || "Error al registrar el consumo." };
    }
  },

  recordConsumptionBatch: async (
    scope: ImmunizationScope,
    input: ImmunizationConsumptionBatchInput,
    username?: string
  ): Promise<{ success: boolean; movements?: ImmunizationStockMovement[]; batchId?: string; message?: string }> => {
    try {
      if (scope.level !== "IPRESS" || !scope.facilityCode) {
        return { success: false, message: "Solo una IPRESS puede registrar consumos." };
      }
      if (!input.period || !/^[0-9]{4}-[0-9]{2}$/.test(input.period)) {
        return { success: false, message: "Periodo inválido." };
      }
      if (await immunizationApi.isPeriodLocked(scope, input.period)) {
        return { success: false, message: "El periodo ya está precerrado o cerrado. No se pueden registrar consumos." };
      }
      if (!input.referenceDocument?.trim()) {
        return { success: false, message: "Ingrese el numero de receta o registro del consumo." };
      }
      if (!input.consumptionDate || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(input.consumptionDate)) {
        return { success: false, message: "Ingrese una fecha de consumo valida." };
      }
      if (input.period !== input.consumptionDate.slice(0, 7)) {
        return { success: false, message: "El periodo debe coincidir con la fecha de consumo." };
      }
      if (!input.activityType?.trim()) {
        return { success: false, message: "Seleccione el tipo de actividad del consumo." };
      }
      if (!input.items || input.items.length === 0) {
        return { success: false, message: "Agregue al menos un producto/lote al consumo." };
      }

      const requestedByLayer = new Map<string, number>();
      for (const item of input.items) {
        const quantity = Number(item.consumptionQuantity);
        const applied = Number(item.dosesApplied);
        if (!item.stockLayerId) return { success: false, message: "Todos los ítems deben tener lote seleccionado." };
        if (!Number.isFinite(quantity) || quantity <= 0) return { success: false, message: "El consumo en frascos/unidades debe ser mayor a cero." };
        if (!Number.isFinite(applied) || applied < 0) return { success: false, message: "Las dosis aplicadas no pueden ser negativas." };
        requestedByLayer.set(item.stockLayerId, (requestedByLayer.get(item.stockLayerId) || 0) + quantity);
      }

      const batchId = makeLocalId("consumo-ipress");
      const now = new Date().toISOString();
      const recipeNumber = input.referenceDocument.trim();
      const consumptionDate = input.consumptionDate;
      const activityType = input.activityType.trim();

      if (supabase) {
        const layerIds = Array.from(requestedByLayer.keys());
        const { data: layerRows, error: layerError } = await supabase
          .from("immunization_stock_layers")
          .select("*, product:product_id(*)")
          .in("id", layerIds);
        if (layerError) throw layerError;

        const layers = (layerRows || []).map(normalizeStockLayer);
        const layerMap = new Map(layers.map(layer => [layer.id, layer]));
        if (layers.length !== layerIds.length) return { success: false, message: "Uno o más lotes no existen en el stock." };

        for (const layer of layers) {
          const requested = requestedByLayer.get(layer.id || "") || 0;
          if (layer.ownerType !== "IPRESS" || layer.facilityCode !== scope.facilityCode) {
            return { success: false, message: "Uno o más lotes no pertenecen a la IPRESS del usuario." };
          }
          if (!layer.isActive || layer.currentQuantity <= 0) {
            return { success: false, message: `El lote ${layer.lote} no tiene stock disponible.` };
          }
          if (requested > layer.currentQuantity) {
            return { success: false, message: `El lote ${layer.lote} solo tiene ${layer.currentQuantity} disponible.` };
          }
        }

        const workingQuantity = new Map(layers.map(layer => [layer.id || "", layer.currentQuantity]));
        const movementPayloads = input.items.map(item => {
          const layer = layerMap.get(item.stockLayerId)!;
          const quantity = Number(item.consumptionQuantity);
          const applied = Number(item.dosesApplied);
          const before = workingQuantity.get(item.stockLayerId) || 0;
          const after = before - quantity;
          workingQuantity.set(item.stockLayerId, after);
          const dosesPerUnit = Number(layer.product?.dosisUnidad) || 0;
          const consumedDoses = quantity * dosesPerUnit;
          if (dosesPerUnit > 0 && applied > consumedDoses) {
            throw new Error(`Las dosis aplicadas del lote ${layer.lote} no pueden superar las dosis consumidas (${consumedDoses}).`);
          }
          const dosesLost = Math.max(consumedDoses - applied, 0);
          const lossFactor = consumedDoses > 0 ? (dosesLost / consumedDoses) * 100 : 0;
          const observation = [
            `Registro consumo: ${batchId}`,
            `Receta: ${recipeNumber}`,
            `Fecha consumo: ${consumptionDate}`,
            `Actividad: ${activityType}`,
            `Dosis aplicadas: ${applied}`,
            `Dosis consumidas: ${consumedDoses}`,
            `Dosis perdidas: ${dosesLost}`,
            `Factor pérdida: ${lossFactor.toFixed(2)}%`,
            input.observation?.trim(),
            item.observation?.trim()
          ].filter(Boolean).join(" | ");

          return {
            movement_type: "IPRESS_CONSUMPTION",
            owner_type: "IPRESS",
            unget_id: layer.ungetId || scope.ungetId || null,
            facility_code: scope.facilityCode,
            product_id: layer.productId,
            stock_layer_id: layer.id,
            quantity_delta: -quantity,
            quantity_before: before,
            quantity_after: after,
            period: input.period,
            reason: "Consumo IPRESS por registro",
            observation,
            batch_id: batchId,
            consumed_doses: consumedDoses,
            doses_applied: applied,
            doses_lost: dosesLost,
            loss_factor: lossFactor,
            created_by: username || null,
            created_at: now
          };
        });

        const updatedLayerIds: string[] = [];
        try {
          for (const layer of layers) {
            const layerId = layer.id || "";
            const nextQuantity = workingQuantity.get(layerId) || 0;
            const { error: updateError } = await supabase
              .from("immunization_stock_layers")
              .update({
                current_quantity: nextQuantity,
                is_active: nextQuantity > 0,
                updated_at: now
              })
              .eq("id", layerId);
            if (updateError) throw updateError;
            updatedLayerIds.push(layerId);
          }

          let insertResult = await supabase
            .from("immunization_stock_movements")
            .insert(movementPayloads)
            .select();

          if (insertResult.error) {
            const rawMessage = `${insertResult.error.message || ""} ${insertResult.error.details || ""}`;
            if (
              rawMessage.includes("batch_id") ||
              rawMessage.includes("consumed_doses") ||
              rawMessage.includes("doses_applied") ||
              rawMessage.includes("doses_lost") ||
              rawMessage.includes("loss_factor")
            ) {
              const basePayloads = movementPayloads.map(({ batch_id, consumed_doses, doses_applied, doses_lost, loss_factor, ...basePayload }) => basePayload);
              insertResult = await supabase
                .from("immunization_stock_movements")
                .insert(basePayloads)
                .select();
            }
          }

          if (insertResult.error) throw insertResult.error;
          return {
            success: true,
            batchId,
            movements: (insertResult.data || []).map(normalizeStockMovement)
          };
        } catch (e) {
          for (const layer of layers.filter(layer => updatedLayerIds.includes(layer.id || ""))) {
            await supabase
              .from("immunization_stock_layers")
              .update({
                current_quantity: layer.currentQuantity,
                is_active: layer.isActive,
                updated_at: now
              })
              .eq("id", layer.id);
          }
          throw e;
        }
      }

      const layers = [...getCachedList<ImmunizationStockLayer>(STOCK_CACHE_KEY)];
      const products = getCachedList<ImmunizationProduct>(PRODUCTS_CACHE_KEY);
      const layerMap = new Map(layers.map(layer => [layer.id, layer]));

      for (const [layerId, requested] of requestedByLayer.entries()) {
        const layer = layerMap.get(layerId);
        if (!layer) return { success: false, message: "Uno o más lotes no existen en el stock." };
        if (layer.ownerType !== "IPRESS" || layer.facilityCode !== scope.facilityCode) return { success: false, message: "Uno o más lotes no pertenecen a la IPRESS del usuario." };
        if (!layer.isActive || layer.currentQuantity <= 0) return { success: false, message: `El lote ${layer.lote} no tiene stock disponible.` };
        if (requested > layer.currentQuantity) return { success: false, message: `El lote ${layer.lote} solo tiene ${layer.currentQuantity} disponible.` };
      }

      const movements: ImmunizationStockMovement[] = [];
      const workingQuantity = new Map(layers.map(layer => [layer.id || "", layer.currentQuantity]));
      for (const item of input.items) {
        const layerIndex = layers.findIndex(layer => layer.id === item.stockLayerId);
        const layer = layers[layerIndex];
        const product = layer.product || products.find(row => row.id === layer.productId);
        const quantity = Number(item.consumptionQuantity);
        const applied = Number(item.dosesApplied);
        const before = workingQuantity.get(item.stockLayerId) || 0;
        const after = before - quantity;
        const dosesPerUnit = Number(product?.dosisUnidad) || 0;
        const consumedDoses = quantity * dosesPerUnit;
        if (dosesPerUnit > 0 && applied > consumedDoses) {
          return { success: false, message: `Las dosis aplicadas del lote ${layer.lote} no pueden superar las dosis consumidas (${consumedDoses}).` };
        }
        const dosesLost = Math.max(consumedDoses - applied, 0);
        const lossFactor = consumedDoses > 0 ? (dosesLost / consumedDoses) * 100 : 0;
        workingQuantity.set(item.stockLayerId, after);
        layers[layerIndex] = {
          ...layer,
          product,
          currentQuantity: after,
          isActive: after > 0,
          updatedAt: now
        };
        movements.push({
          id: makeLocalId("imm-mov"),
          movementType: "IPRESS_CONSUMPTION",
          ownerType: "IPRESS",
          ungetId: layer.ungetId || scope.ungetId,
          facilityCode: scope.facilityCode,
          productId: layer.productId,
          stockLayerId: layer.id,
          quantityDelta: -quantity,
          quantityBefore: before,
          quantityAfter: after,
          period: input.period,
          reason: "Consumo IPRESS por registro",
          observation: [
            `Registro consumo: ${batchId}`,
            `Receta: ${recipeNumber}`,
            `Fecha consumo: ${consumptionDate}`,
            `Actividad: ${activityType}`,
            input.observation?.trim(),
            item.observation?.trim()
          ].filter(Boolean).join(" | ") || undefined,
          batchId,
          consumedDoses,
          dosesApplied: applied,
          dosesLost,
          lossFactor,
          createdBy: username,
          createdAt: now
        });
      }

      setCachedList(STOCK_CACHE_KEY, layers);
      setCachedList(MOVEMENTS_CACHE_KEY, [...movements, ...getCachedList<ImmunizationStockMovement>(MOVEMENTS_CACHE_KEY)]);
      return { success: true, batchId, movements };
    } catch (e: any) {
      return { success: false, message: e.message || "Error al registrar el consumo." };
    }
  },

  listReturnBatches: async (scope: ImmunizationScope): Promise<ImmunizationReturnBatch[]> => {
    try {
      if (supabase) {
        let query = supabase
          .from("immunization_return_batches")
          .select("*")
          .order("created_at", { ascending: false });

        if (scope.level === "IPRESS" && scope.facilityCode) {
          query = query.eq("origin_facility_code", scope.facilityCode);
        } else if (scope.ownerType === "IPRESS" && scope.facilityCodes) {
          query = scope.facilityCodes.length > 0
            ? query.in("origin_facility_code", scope.facilityCodes)
            : query.eq("origin_facility_code", "__NO_FACILITIES__");
        } else if (scope.level === "UNGET" && scope.ungetId) {
          query = query.eq("origin_unget_id", scope.ungetId);
        } else if (scope.ownerType === "UNGET" && scope.ungetIds) {
          query = scope.ungetIds.length > 0
            ? query.in("origin_unget_id", scope.ungetIds)
            : query.eq("origin_unget_id", "00000000-0000-0000-0000-000000000000");
        }

        const { data, error } = await query;
        if (error) throw error;
        return (data || []).map(normalizeReturnBatch);
      }
    } catch (e) {
      console.warn("Fallback local listReturnBatches inmunizaciones", e);
    }

    return getCachedList<ImmunizationReturnBatch>(RETURN_BATCHES_CACHE_KEY)
      .filter(batch => {
        if (scope.level === "IPRESS") return batch.originFacilityCode === scope.facilityCode;
        if (scope.ownerType === "IPRESS" && scope.facilityCodes) return scope.facilityCodes.includes(batch.originFacilityCode);
        if (scope.level === "UNGET") return batch.originUngetId === scope.ungetId;
        if (scope.ownerType === "UNGET" && scope.ungetIds) return scope.ungetIds.includes(batch.originUngetId);
        return true;
      })
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  },

  getReturnItems: async (returnId: string): Promise<ImmunizationReturnItem[]> => {
    try {
      if (supabase) {
        const { data, error } = await supabase
          .from("immunization_return_items")
          .select("*, product:product_id(*)")
          .eq("return_id", returnId)
          .order("created_at", { ascending: true });
        if (error) throw error;
        return (data || []).map(normalizeReturnItem);
      }
    } catch (e) {
      console.warn("Fallback local getReturnItems inmunizaciones", e);
    }
    const products = getCachedList<ImmunizationProduct>(PRODUCTS_CACHE_KEY);
    return getCachedList<ImmunizationReturnItem>(RETURN_ITEMS_CACHE_KEY)
      .filter(item => item.returnId === returnId)
      .map(item => ({ ...item, product: products.find(product => product.id === item.productId) }));
  },

  createReturnBatch: async (
    scope: ImmunizationScope,
    batch: ImmunizationReturnBatch,
    items: ImmunizationReturnItem[],
    username?: string
  ): Promise<{ success: boolean; returnBatch?: ImmunizationReturnBatch; message?: string }> => {
    try {
      if (scope.level !== "IPRESS" || !scope.facilityCode || !scope.ungetId) {
        return { success: false, message: "Solo una IPRESS vinculada a una UNGET puede registrar bajas o devoluciones." };
      }
      if (!["DISPOSAL", "RETURN", "TRANSFER"].includes(batch.returnType)) {
        return { success: false, message: "Seleccione el tipo de operacion." };
      }
      if (!batch.reason) return { success: false, message: "Seleccione el motivo." };
      if (!batch.period || !/^[0-9]{4}-[0-9]{2}$/.test(batch.period)) return { success: false, message: "Periodo invalido." };
      if (await immunizationApi.isPeriodLocked(scope, batch.period)) {
        return { success: false, message: "El periodo ya está precerrado o cerrado. No se pueden registrar bajas o devoluciones." };
      }
      if (!batch.movementDate || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(batch.movementDate)) return { success: false, message: "Ingrese la fecha del movimiento." };
      if (batch.period !== batch.movementDate.slice(0, 7)) return { success: false, message: "El periodo debe coincidir con la fecha del movimiento." };
      if (batch.returnType === "TRANSFER" && !batch.suggestedDestinationFacilityCode) {
        return { success: false, message: "Seleccione la IPRESS destino sugerida para la transferencia." };
      }
      if (items.length === 0) return { success: false, message: "Agregue al menos un producto/lote." };
      if (items.some(item =>
        !item.productId ||
        !item.sourceStockLayerId ||
        !item.codigoSismedSnapshot?.trim() ||
        !item.lote?.trim() ||
        !item.expirationDate ||
        item.quantity <= 0 ||
        !Number.isFinite(item.quantity) ||
        item.unitPrice < 0 ||
        !item.fundingSource?.trim() ||
        !item.supplyType?.trim()
      )) {
        return { success: false, message: "Revise el detalle; hay productos incompletos o cantidades invalidas." };
      }
      const repeatedLayer = items.find((item, index) => items.findIndex(row => row.sourceStockLayerId === item.sourceStockLayerId) !== index);
      if (repeatedLayer) return { success: false, message: "Un mismo lote no debe repetirse. Edite la cantidad del item existente." };

      const now = new Date().toISOString();
      const movementType = batch.returnType === "DISPOSAL"
        ? "IPRESS_DISPOSAL_OUT"
        : batch.returnType === "TRANSFER"
          ? "IPRESS_TRANSFER_OUT"
          : "IPRESS_RETURN_OUT";

      if (supabase) {
        const layerIds = items.map(item => item.sourceStockLayerId);
        const { data: layerRows, error: layerError } = await supabase
          .from("immunization_stock_layers")
          .select("*, product:product_id(*)")
          .in("id", layerIds);
        if (layerError) throw layerError;
        const layers = (layerRows || []).map(normalizeStockLayer);
        if (layers.length !== layerIds.length) return { success: false, message: "Uno o mas lotes no existen en el stock." };

        for (const item of items) {
          const layer = layers.find(row => row.id === item.sourceStockLayerId);
          if (!layer || layer.ownerType !== "IPRESS" || layer.facilityCode !== scope.facilityCode || layer.productId !== item.productId) {
            return { success: false, message: "Uno de los lotes no pertenece al stock de la IPRESS." };
          }
          if (!layer.isActive || layer.currentQuantity < item.quantity) {
            return { success: false, message: `Stock insuficiente para el lote ${item.lote}. Disponible: ${layer.currentQuantity}.` };
          }
        }

        const { data: batchRow, error: batchError } = await supabase
          .from("immunization_return_batches")
          .insert({
            return_type: batch.returnType,
            status: "SENT",
            origin_unget_id: scope.ungetId,
            origin_facility_code: scope.facilityCode,
            suggested_destination_facility_code: batch.returnType === "TRANSFER" ? batch.suggestedDestinationFacilityCode || null : null,
            period: batch.period,
            movement_date: batch.movementDate,
            reference_document: batch.referenceDocument?.trim() || null,
            reason: batch.reason,
            observation: batch.observation?.trim() || null,
            created_by: username || null,
            sent_at: now,
            created_at: now,
            updated_at: now
          })
          .select()
          .single();
        if (batchError) throw batchError;

        const { error: itemsError } = await supabase
          .from("immunization_return_items")
          .insert(items.map(item => ({
            return_id: batchRow.id,
            product_id: item.productId,
            source_stock_layer_id: item.sourceStockLayerId,
            codigo_sismed_snapshot: item.codigoSismedSnapshot,
            lote: item.lote.trim(),
            expiration_date: item.expirationDate,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            funding_source: item.fundingSource.trim(),
            supply_type: item.supplyType.trim(),
            observation: item.observation?.trim() || null
          })));
        if (itemsError) throw itemsError;

        for (const item of items) {
          const layer = layers.find(row => row.id === item.sourceStockLayerId)!;
          const before = layer.currentQuantity;
          const after = before - item.quantity;
          const { error: updateError } = await supabase
            .from("immunization_stock_layers")
            .update({ current_quantity: after, is_active: after > 0, updated_at: now })
            .eq("id", layer.id);
          if (updateError) throw updateError;

          const { error: movementError } = await supabase
            .from("immunization_stock_movements")
            .insert({
              movement_type: movementType,
              owner_type: "IPRESS",
              unget_id: scope.ungetId,
              facility_code: scope.facilityCode,
              product_id: item.productId,
              stock_layer_id: item.sourceStockLayerId,
              quantity_delta: -item.quantity,
              quantity_before: before,
              quantity_after: after,
              period: batch.period,
              reason: batch.returnType === "DISPOSAL" ? "Baja no disponible enviada a UNGET" : "Devolucion/transferencia enviada a UNGET",
              observation: [batch.referenceDocument, batch.reason, batch.observation, item.observation].filter(Boolean).join(" | "),
              created_by: username || null,
              created_at: now
            });
          if (movementError) throw movementError;
        }

        return { success: true, returnBatch: normalizeReturnBatch(batchRow) };
      }

      const cachedLayers = [...getCachedList<ImmunizationStockLayer>(STOCK_CACHE_KEY)];
      const movements = [...getCachedList<ImmunizationStockMovement>(MOVEMENTS_CACHE_KEY)];
      const products = getCachedList<ImmunizationProduct>(PRODUCTS_CACHE_KEY);
      for (const item of items) {
        const layer = cachedLayers.find(row => row.id === item.sourceStockLayerId);
        if (!layer || layer.ownerType !== "IPRESS" || layer.facilityCode !== scope.facilityCode || layer.productId !== item.productId) {
          return { success: false, message: "Uno de los lotes no pertenece al stock de la IPRESS." };
        }
        if (!layer.isActive || layer.currentQuantity < item.quantity) {
          return { success: false, message: `Stock insuficiente para el lote ${item.lote}. Disponible: ${layer.currentQuantity}.` };
        }
      }

      const savedBatch: ImmunizationReturnBatch = {
        ...batch,
        id: batch.id || makeLocalId("imm-return"),
        status: "SENT",
        originUngetId: scope.ungetId,
        originFacilityCode: scope.facilityCode,
        suggestedDestinationFacilityCode: batch.returnType === "TRANSFER" ? batch.suggestedDestinationFacilityCode : undefined,
        referenceDocument: batch.referenceDocument?.trim() || undefined,
        observation: batch.observation?.trim() || undefined,
        createdBy: username,
        sentAt: now,
        createdAt: now,
        updatedAt: now
      };
      const savedItems = items.map(item => ({
        ...item,
        id: item.id || makeLocalId("imm-return-item"),
        returnId: savedBatch.id,
        product: item.product || products.find(product => product.id === item.productId),
        lote: item.lote.trim(),
        fundingSource: item.fundingSource.trim(),
        supplyType: item.supplyType.trim(),
        observation: item.observation?.trim() || undefined
      }));

      savedItems.forEach(item => {
        const index = cachedLayers.findIndex(layer => layer.id === item.sourceStockLayerId);
        const before = cachedLayers[index].currentQuantity;
        const after = before - item.quantity;
        cachedLayers[index] = { ...cachedLayers[index], currentQuantity: after, isActive: after > 0, updatedAt: now };
        movements.push({
          id: makeLocalId("imm-mov"),
          movementType,
          ownerType: "IPRESS",
          ungetId: scope.ungetId,
          facilityCode: scope.facilityCode,
          productId: item.productId,
          stockLayerId: item.sourceStockLayerId,
          quantityDelta: -item.quantity,
          quantityBefore: before,
          quantityAfter: after,
          period: batch.period,
          reason: batch.returnType === "DISPOSAL" ? "Baja no disponible enviada a UNGET" : "Devolucion/transferencia enviada a UNGET",
          observation: [batch.referenceDocument, batch.reason, batch.observation, item.observation].filter(Boolean).join(" | "),
          createdBy: username,
          createdAt: now
        });
      });

      setCachedList(STOCK_CACHE_KEY, cachedLayers);
      setCachedList(MOVEMENTS_CACHE_KEY, movements);
      setCachedList(RETURN_BATCHES_CACHE_KEY, [savedBatch, ...getCachedList<ImmunizationReturnBatch>(RETURN_BATCHES_CACHE_KEY)]);
      setCachedList(RETURN_ITEMS_CACHE_KEY, [...getCachedList<ImmunizationReturnItem>(RETURN_ITEMS_CACHE_KEY), ...savedItems]);
      return { success: true, returnBatch: savedBatch };
    } catch (e: any) {
      const rawMessage = `${e?.message || ""} ${e?.details || ""}`;
      if (rawMessage.includes("immunization_return_batches") || rawMessage.includes("immunization_return_items")) {
        return { success: false, message: "Falta ejecutar supabase/SUPABASE_MIGRATION_IMMUNIZATION_RETURNS.sql en Supabase." };
      }
      return { success: false, message: e.message || "Error al registrar la baja o devolucion." };
    }
  },

  receiveReturnBatch: async (
    scope: ImmunizationScope,
    returnId: string,
    username?: string,
    reception?: ImmunizationReturnReceptionInput
  ): Promise<{ success: boolean; returnBatch?: ImmunizationReturnBatch; message?: string }> => {
    try {
      if (scope.level !== "UNGET" || !scope.ungetId) {
        return { success: false, message: "Solo la UNGET responsable puede aceptar la recepcion." };
      }
      const receptionItems = reception?.items || [];
      if (receptionItems.some(item => !item.itemId || item.receivedQuantity < 0 || !Number.isFinite(item.receivedQuantity))) {
        return { success: false, message: "Revise las cantidades recibidas; no pueden ser negativas." };
      }
      const receptionReason = reception?.reason?.trim() || "";
      const receptionObservation = reception?.observation?.trim() || "";
      const now = new Date().toISOString();

      const completeReception = (
        batch: ImmunizationReturnBatch,
        items: ImmunizationReturnItem[]
      ) => {
        const receivedByItem = new Map(receptionItems.map(item => [item.itemId, item.receivedQuantity]));
        const completedItems = items.map(item => ({
          item,
          receivedQuantity: item.id && receivedByItem.has(item.id) ? Number(receivedByItem.get(item.id)) : item.quantity
        }));
        const hasDifference = completedItems.some(row => row.receivedQuantity !== row.item.quantity);
        if (hasDifference && !receptionReason) return { error: "Si existe diferencia fisica, seleccione un motivo." };
        if ((hasDifference || receptionReason) && !receptionObservation) return { error: "Si registra una incidencia, agregue una observacion." };
        return { completedItems, isObserved: hasDifference || Boolean(receptionReason) };
      };

      if (supabase) {
        const { data: batchRow, error: batchError } = await supabase
          .from("immunization_return_batches")
          .select("*")
          .eq("id", returnId)
          .single();
        if (batchError) throw batchError;
        const batch = normalizeReturnBatch(batchRow);
        if (batch.originUngetId !== scope.ungetId) return { success: false, message: "La baja/devolucion no pertenece a la UNGET del usuario." };
        if (await immunizationApi.isPeriodLocked(scope, batch.period)) {
          return { success: false, message: "El periodo UNGET ya está cerrado. No se pueden aceptar devoluciones o bajas." };
        }
        if (batch.status !== "SENT") return { success: false, message: "La baja/devolucion no esta pendiente de recepcion." };

        const items = await immunizationApi.getReturnItems(returnId);
        if (items.length === 0) return { success: false, message: "La baja/devolucion no contiene productos." };
        const completion = completeReception(batch, items);
        if ("error" in completion) return { success: false, message: completion.error };
        const { completedItems, isObserved } = completion;

        for (const { item, receivedQuantity } of completedItems) {
          let destinationStockLayerId: string | null = null;
          if (receivedQuantity > 0 && batch.returnType !== "DISPOSAL") {
            const { data: existingRows, error: existingError } = await supabase
              .from("immunization_stock_layers")
              .select("*")
              .eq("owner_type", "UNGET")
              .eq("unget_id", scope.ungetId)
              .eq("product_id", item.productId)
              .eq("lote", item.lote.trim())
              .eq("expiration_date", item.expirationDate)
              .eq("unit_price", item.unitPrice)
              .eq("funding_source", item.fundingSource.trim())
              .eq("supply_type", item.supplyType.trim())
              .limit(1);
            if (existingError) throw existingError;
            const existingLayer = existingRows?.[0] ? normalizeStockLayer(existingRows[0]) : undefined;
            const before = existingLayer?.currentQuantity || 0;
            const after = before + receivedQuantity;

            if (existingLayer) {
              const { error: updateError } = await supabase
                .from("immunization_stock_layers")
                .update({ current_quantity: after, is_active: true, updated_at: now })
                .eq("id", existingLayer.id);
              if (updateError) throw updateError;
              destinationStockLayerId = existingLayer.id;
            } else {
              const { data: newLayer, error: insertLayerError } = await supabase
                .from("immunization_stock_layers")
                .insert({
                  owner_type: "UNGET",
                  unget_id: scope.ungetId,
                  product_id: item.productId,
                  lote: item.lote.trim(),
                  expiration_date: item.expirationDate,
                  unit_price: item.unitPrice,
                  funding_source: item.fundingSource.trim(),
                  supply_type: item.supplyType.trim(),
                  current_quantity: receivedQuantity,
                  is_active: true,
                  created_at: now,
                  updated_at: now
                })
                .select()
                .single();
              if (insertLayerError) throw insertLayerError;
              destinationStockLayerId = newLayer.id;
            }

            const { error: movementError } = await supabase.from("immunization_stock_movements").insert({
              movement_type: batch.returnType === "TRANSFER" ? "UNGET_TRANSFER_IN" : "UNGET_RETURN_IN",
              owner_type: "UNGET",
              unget_id: scope.ungetId,
              product_id: item.productId,
              stock_layer_id: destinationStockLayerId,
              quantity_delta: receivedQuantity,
              quantity_before: before,
              quantity_after: after,
              period: batch.period,
              reason: isObserved ? "Recepcion observada de IPRESS" : "Recepcion conforme de IPRESS",
              observation: [batch.referenceDocument, batch.reason, batch.observation, receptionReason, receptionObservation, item.observation].filter(Boolean).join(" | "),
              created_by: username || null,
              created_at: now
            });
            if (movementError) throw movementError;
          } else if (receivedQuantity > 0) {
            const { error: movementError } = await supabase.from("immunization_stock_movements").insert({
              movement_type: "UNGET_DISPOSAL_RECEIVED",
              owner_type: "UNGET",
              unget_id: scope.ungetId,
              product_id: item.productId,
              stock_layer_id: null,
              quantity_delta: 0,
              quantity_before: 0,
              quantity_after: 0,
              period: batch.period,
              reason: "Baja no disponible recepcionada sin ingreso a stock",
              observation: [batch.referenceDocument, batch.reason, batch.observation, `Cantidad recibida: ${receivedQuantity}`, receptionReason, receptionObservation, item.observation].filter(Boolean).join(" | "),
              created_by: username || null,
              created_at: now
            });
            if (movementError) throw movementError;
          }

          const { error: itemUpdateError } = await supabase
            .from("immunization_return_items")
            .update({ received_quantity: receivedQuantity, destination_stock_layer_id: destinationStockLayerId })
            .eq("id", item.id);
          if (itemUpdateError) throw itemUpdateError;
        }

        const { data: updatedBatchRow, error: updateBatchError } = await supabase
          .from("immunization_return_batches")
          .update({
            status: isObserved ? "OBSERVED" : "RECEIVED",
            received_by: username || null,
            received_at: now,
            reception_reason: receptionReason || null,
            reception_observation: receptionObservation || null,
            updated_at: now
          })
          .eq("id", returnId)
          .select()
          .single();
        if (updateBatchError) throw updateBatchError;
        return { success: true, returnBatch: normalizeReturnBatch(updatedBatchRow) };
      }

      const batches = getCachedList<ImmunizationReturnBatch>(RETURN_BATCHES_CACHE_KEY);
      const batch = batches.find(row => row.id === returnId);
      if (!batch) return { success: false, message: "Baja/devolucion no encontrada." };
      if (batch.originUngetId !== scope.ungetId) return { success: false, message: "La baja/devolucion no pertenece a la UNGET del usuario." };
      if (await immunizationApi.isPeriodLocked(scope, batch.period)) {
        return { success: false, message: "El periodo UNGET ya está cerrado. No se pueden aceptar devoluciones o bajas." };
      }
      if (batch.status !== "SENT") return { success: false, message: "La baja/devolucion no esta pendiente de recepcion." };

      const products = getCachedList<ImmunizationProduct>(PRODUCTS_CACHE_KEY);
      const items = getCachedList<ImmunizationReturnItem>(RETURN_ITEMS_CACHE_KEY).filter(item => item.returnId === returnId);
      if (items.length === 0) return { success: false, message: "La baja/devolucion no contiene productos." };
      const completion = completeReception(batch, items);
      if ("error" in completion) return { success: false, message: completion.error };
      const { completedItems, isObserved } = completion;
      const layers = [...getCachedList<ImmunizationStockLayer>(STOCK_CACHE_KEY)];
      const movements = [...getCachedList<ImmunizationStockMovement>(MOVEMENTS_CACHE_KEY)];
      const allReturnItems = getCachedList<ImmunizationReturnItem>(RETURN_ITEMS_CACHE_KEY).map(item => ({ ...item }));

      completedItems.forEach(({ item, receivedQuantity }) => {
        let destinationStockLayerId: string | undefined;
        if (receivedQuantity > 0 && batch.returnType !== "DISPOSAL") {
          let layerIndex = layers.findIndex(layer =>
            layer.ownerType === "UNGET" &&
            layer.ungetId === scope.ungetId &&
            layer.productId === item.productId &&
            layer.lote === item.lote.trim() &&
            layer.expirationDate === item.expirationDate &&
            layer.unitPrice === item.unitPrice &&
            layer.fundingSource === item.fundingSource.trim() &&
            layer.supplyType === item.supplyType.trim()
          );
          const before = layerIndex >= 0 ? layers[layerIndex].currentQuantity : 0;
          const after = before + receivedQuantity;
          const movementId = makeLocalId("imm-mov");
          if (layerIndex >= 0) {
            layers[layerIndex] = { ...layers[layerIndex], currentQuantity: after, isActive: true, updatedAt: now };
          } else {
            layers.push({
              id: makeLocalId("imm-layer"),
              ownerType: "UNGET",
              ungetId: scope.ungetId,
              productId: item.productId,
              product: item.product || products.find(product => product.id === item.productId),
              lote: item.lote.trim(),
              expirationDate: item.expirationDate,
              unitPrice: item.unitPrice,
              fundingSource: item.fundingSource.trim(),
              supplyType: item.supplyType.trim(),
              sourceMovementId: movementId,
              currentQuantity: receivedQuantity,
              isActive: true,
              createdAt: now,
              updatedAt: now
            });
            layerIndex = layers.length - 1;
          }
          destinationStockLayerId = layers[layerIndex].id;
          movements.push({
            id: movementId,
            movementType: batch.returnType === "TRANSFER" ? "UNGET_TRANSFER_IN" : "UNGET_RETURN_IN",
            ownerType: "UNGET",
            ungetId: scope.ungetId,
            productId: item.productId,
            stockLayerId: destinationStockLayerId,
            quantityDelta: receivedQuantity,
            quantityBefore: before,
            quantityAfter: after,
            period: batch.period,
            reason: isObserved ? "Recepcion observada de IPRESS" : "Recepcion conforme de IPRESS",
            observation: [batch.referenceDocument, batch.reason, batch.observation, receptionReason, receptionObservation, item.observation].filter(Boolean).join(" | "),
            createdBy: username,
            createdAt: now
          });
        } else if (receivedQuantity > 0) {
          movements.push({
            id: makeLocalId("imm-mov"),
            movementType: "UNGET_DISPOSAL_RECEIVED",
            ownerType: "UNGET",
            ungetId: scope.ungetId,
            productId: item.productId,
            quantityDelta: 0,
            quantityBefore: 0,
            quantityAfter: 0,
            period: batch.period,
            reason: "Baja no disponible recepcionada sin ingreso a stock",
            observation: [batch.referenceDocument, batch.reason, batch.observation, `Cantidad recibida: ${receivedQuantity}`, receptionReason, receptionObservation, item.observation].filter(Boolean).join(" | "),
            createdBy: username,
            createdAt: now
          });
        }
        const itemIndex = allReturnItems.findIndex(row => row.id === item.id);
        if (itemIndex >= 0) {
          allReturnItems[itemIndex].receivedQuantity = receivedQuantity;
          allReturnItems[itemIndex].destinationStockLayerId = destinationStockLayerId;
        }
      });

      const updatedBatch: ImmunizationReturnBatch = {
        ...batch,
        status: isObserved ? "OBSERVED" : "RECEIVED",
        receivedBy: username,
        receivedAt: now,
        receptionReason: receptionReason || undefined,
        receptionObservation: receptionObservation || undefined,
        updatedAt: now
      };
      setCachedList(STOCK_CACHE_KEY, layers);
      setCachedList(MOVEMENTS_CACHE_KEY, movements);
      setCachedList(RETURN_ITEMS_CACHE_KEY, allReturnItems);
      setCachedList(RETURN_BATCHES_CACHE_KEY, batches.map(row => row.id === returnId ? updatedBatch : row));
      return { success: true, returnBatch: updatedBatch };
    } catch (e: any) {
      const rawMessage = `${e?.message || ""} ${e?.details || ""}`;
      if (rawMessage.includes("immunization_return_batches") || rawMessage.includes("immunization_return_items")) {
        return { success: false, message: "Falta ejecutar supabase/SUPABASE_MIGRATION_IMMUNIZATION_RETURNS.sql en Supabase." };
      }
      return { success: false, message: e.message || "Error al aceptar la recepcion." };
    }
  },

  listAdjustments: async (scope: ImmunizationScope): Promise<ImmunizationAdjustment[]> => {
    try {
      if (supabase) {
        let query = supabase.from("immunization_adjustments").select("*").order("created_at", { ascending: false });
        query = applyOwnerScope(query, scope);
        const { data, error } = await query;
        if (error) throw error;
        return (data || []).map((row: any) => ({
          id: row.id,
          ownerType: row.owner_type,
          ungetId: row.unget_id || undefined,
          facilityCode: row.facility_code || undefined,
          period: row.period,
          status: row.status,
          reason: row.reason,
          observation: row.observation,
          createdBy: row.created_by || undefined,
          createdAt: row.created_at || undefined
        }));
      }
    } catch (e) {
      console.warn("Fallback local listAdjustments inmunizaciones", e);
    }
    return getCachedList<ImmunizationAdjustment>(ADJUSTMENTS_CACHE_KEY).filter(adjustment => {
      if (scope.ownerType === "UNGET" && scope.ungetIds) return adjustment.ownerType === "UNGET" && scope.ungetIds.includes(adjustment.ungetId || "");
      if (scope.ownerType === "IPRESS" && scope.facilityCodes) return adjustment.ownerType === "IPRESS" && scope.facilityCodes.includes(adjustment.facilityCode || "");
      if (scope.level === "IPRESS") return adjustment.ownerType === "IPRESS" && adjustment.facilityCode === scope.facilityCode;
      if (scope.level === "UNGET") return adjustment.ownerType === "UNGET" && adjustment.ungetId === scope.ungetId;
      return true;
    });
  },

  getAdjustmentItems: async (adjustmentId: string): Promise<ImmunizationAdjustmentItem[]> => {
    try {
      if (supabase) {
        const { data, error } = await supabase
          .from("immunization_adjustment_items")
          .select("*, product:product_id(*)")
          .eq("adjustment_id", adjustmentId)
          .order("created_at", { ascending: true });
        if (error) throw error;
        return (data || []).map((row: any) => {
          const productRow = Array.isArray(row.product) ? row.product[0] : row.product;
          return {
            id: row.id,
            adjustmentId: row.adjustment_id,
            productId: row.product_id,
            stockLayerId: row.stock_layer_id || undefined,
            lote: row.lote,
            expirationDate: row.expiration_date,
            systemQuantity: Number(row.system_quantity) || 0,
            physicalQuantity: Number(row.physical_quantity) || 0,
            differenceQuantity: Number(row.difference_quantity) || 0,
            unitPrice: Number(row.unit_price) || 0,
            fundingSource: row.funding_source,
            supplyType: row.supply_type,
            operationType: row.operation_type || "QUANTITY",
            reclassificationKey: row.reclassification_key || undefined,
            product: productRow ? normalizeProduct(productRow) : undefined
          };
        });
      }
    } catch (e) {
      console.warn("Fallback local getAdjustmentItems inmunizaciones", e);
    }
    const products = getCachedList<ImmunizationProduct>(PRODUCTS_CACHE_KEY);
    return getCachedList<ImmunizationAdjustmentItem>(ADJUSTMENT_ITEMS_CACHE_KEY)
      .filter(item => item.adjustmentId === adjustmentId)
      .map(item => ({ ...item, product: products.find(product => product.id === item.productId) }));
  },

  createAdjustment: async (
    adjustment: ImmunizationAdjustment,
    items: ImmunizationAdjustmentItem[]
  ): Promise<{ success: boolean; adjustment?: ImmunizationAdjustment; message?: string }> => {
    try {
      if (!adjustment.reason.trim() || !adjustment.observation.trim()) {
        return { success: false, message: "Motivo y observación son obligatorios." };
      }
      if ((adjustment.ownerType === "UNGET" && !adjustment.ungetId) || (adjustment.ownerType === "IPRESS" && !adjustment.facilityCode)) {
        return { success: false, message: "El ámbito operativo del reajuste no es válido." };
      }
      if (!adjustment.period || !/^[0-9]{4}-[0-9]{2}$/.test(adjustment.period)) {
        return { success: false, message: "Periodo inválido." };
      }
      const adjustmentScope: ImmunizationScope = adjustment.ownerType === "IPRESS"
        ? { level: "IPRESS", ownerType: "IPRESS", ungetId: adjustment.ungetId, facilityCode: adjustment.facilityCode }
        : { level: "UNGET", ownerType: "UNGET", ungetId: adjustment.ungetId };
      if (await immunizationApi.isPeriodLocked(adjustmentScope, adjustment.period)) {
        return { success: false, message: "El periodo ya está cerrado para este ámbito. No se pueden registrar reajustes." };
      }
      if (items.length === 0 || items.every(item => item.physicalQuantity === item.systemQuantity)) {
        return { success: false, message: "Debe agregar al menos un lote con diferencia de stock." };
      }
      if (items.some(item => !item.productId || !item.lote.trim() || !item.expirationDate || item.physicalQuantity < 0 || item.unitPrice < 0 || !item.fundingSource.trim() || !item.supplyType.trim())) {
        return { success: false, message: "Revise los datos de los lotes; existen campos incompletos o valores negativos." };
      }
      const reclassificationItems = items.filter(item => item.operationType === "RECLASSIFY_SOURCE" || item.operationType === "RECLASSIFY_TARGET");
      const reclassificationKeys = [...new Set(reclassificationItems.map(item => item.reclassificationKey).filter(Boolean))];
      const invalidReclassification = reclassificationItems.some(item => !item.reclassificationKey) || reclassificationKeys.some(key => {
        const pair = reclassificationItems.filter(item => item.reclassificationKey === key);
        return pair.length !== 2 ||
          pair.filter(item => item.operationType === "RECLASSIFY_SOURCE").length !== 1 ||
          pair.filter(item => item.operationType === "RECLASSIFY_TARGET").length !== 1;
      });
      if (invalidReclassification) {
        return { success: false, message: "La corrección de datos de lote está incompleta; debe conservar su registro de origen y destino." };
      }

      if (supabase) {
        const rpcItems = items
          .filter(item => item.physicalQuantity !== item.systemQuantity)
          .map(item => ({
            product_id: item.productId,
            stock_layer_id: item.stockLayerId || null,
            lote: item.lote.trim(),
            expiration_date: item.expirationDate,
            system_quantity: item.systemQuantity,
            physical_quantity: item.physicalQuantity,
            unit_price: item.unitPrice,
            funding_source: item.fundingSource.trim(),
            supply_type: item.supplyType.trim(),
            operation_type: item.operationType || "QUANTITY",
            reclassification_key: item.reclassificationKey || null
          }));
        const adjustmentUngetId = await resolveOwnerUngetId(
          adjustment.ownerType,
          adjustment.ungetId,
          adjustment.facilityCode
        );
        const { data, error } = await supabase.rpc("apply_immunization_stock_adjustment", {
          p_owner_type: adjustment.ownerType,
          p_unget_id: adjustmentUngetId,
          p_facility_code: adjustment.facilityCode || null,
          p_period: adjustment.period,
          p_reason: adjustment.reason.trim(),
          p_observation: adjustment.observation.trim(),
          p_created_by: adjustment.createdBy || null,
          p_items: rpcItems
        });
        if (error) {
          const rawMessage = `${error.message || ""} ${error.details || ""}`;
          if (error.code === "PGRST202" || rawMessage.includes("apply_immunization_stock_adjustment")) {
            return { success: false, message: "Falta ejecutar supabase/SUPABASE_MIGRATION_IMMUNIZATION_ADJUSTMENTS.sql en Supabase." };
          }
          if (rawMessage.includes("STOCK_CHANGED")) {
            return { success: false, message: "El stock cambió mientras realizaba el conteo. Actualice y vuelva a intentarlo." };
          }
          throw error;
        }

        const adjustmentId = typeof data === "string" ? data : String(data || "");
        const createdAt = new Date().toISOString();

        return {
          success: true,
          adjustment: {
            ...adjustment,
            id: adjustmentId,
            status: "APPLIED",
            reason: adjustment.reason.trim(),
            observation: adjustment.observation.trim(),
            createdAt
          }
        };
      }

      const layers = [...getCachedList<ImmunizationStockLayer>(STOCK_CACHE_KEY)];
      const movements = [...getCachedList<ImmunizationStockMovement>(MOVEMENTS_CACHE_KEY)];
      const products = getCachedList<ImmunizationProduct>(PRODUCTS_CACHE_KEY);
      const savedAdjustment: ImmunizationAdjustment = {
        ...adjustment,
        id: adjustment.id || makeLocalId("imm-adj"),
        status: "APPLIED",
        reason: adjustment.reason.trim(),
        observation: adjustment.observation.trim(),
        createdAt: new Date().toISOString()
      };
      const savedItems: ImmunizationAdjustmentItem[] = [];

      items.filter(item => item.physicalQuantity !== item.systemQuantity).forEach(item => {
        let layerIndex = item.stockLayerId ? layers.findIndex(layer => layer.id === item.stockLayerId) : -1;
        if (item.stockLayerId && layerIndex < 0) {
          throw new Error("El lote seleccionado ya no existe. Actualice el stock y vuelva a intentarlo.");
        }
        if (layerIndex < 0 && !item.stockLayerId) {
          layerIndex = layers.findIndex(layer =>
            layer.ownerType === adjustment.ownerType &&
            layer.ungetId === adjustment.ungetId &&
            layer.facilityCode === adjustment.facilityCode &&
            layer.productId === item.productId &&
            layer.lote === item.lote.trim() &&
            layer.expirationDate === item.expirationDate &&
            layer.unitPrice === item.unitPrice &&
            layer.fundingSource === item.fundingSource.trim() &&
            layer.supplyType === item.supplyType.trim()
          );
        }
        if (layerIndex >= 0) {
          const layer = layers[layerIndex];
          const inScope = layer.ownerType === adjustment.ownerType &&
            (adjustment.ownerType !== "UNGET" || layer.ungetId === adjustment.ungetId) &&
            (adjustment.ownerType !== "IPRESS" || layer.facilityCode === adjustment.facilityCode);
          if (!inScope) throw new Error("El lote seleccionado no pertenece al ámbito del usuario.");
          if (layer.currentQuantity !== item.systemQuantity) throw new Error("El stock cambió mientras realizaba el conteo. Actualice y vuelva a intentarlo.");
        } else {
          const newLayer: ImmunizationStockLayer = {
            id: makeLocalId("imm-layer"),
            ownerType: adjustment.ownerType,
            ungetId: adjustment.ungetId,
            facilityCode: adjustment.facilityCode,
            productId: item.productId,
            product: products.find(product => product.id === item.productId),
            lote: item.lote.trim(),
            expirationDate: item.expirationDate,
            unitPrice: item.unitPrice,
            fundingSource: item.fundingSource.trim(),
            supplyType: item.supplyType.trim(),
            currentQuantity: 0,
            isActive: false,
            createdAt: new Date().toISOString()
          };
          layers.push(newLayer);
          layerIndex = layers.length - 1;
        }

        const before = layers[layerIndex].currentQuantity;
        const difference = item.physicalQuantity - before;
        layers[layerIndex] = {
          ...layers[layerIndex],
          currentQuantity: item.physicalQuantity,
          isActive: item.physicalQuantity > 0,
          updatedAt: new Date().toISOString()
        };
        savedItems.push({
          ...item,
          id: item.id || makeLocalId("imm-adj-item"),
          adjustmentId: savedAdjustment.id,
          stockLayerId: layers[layerIndex].id,
          systemQuantity: before,
          differenceQuantity: difference,
          product: item.product || products.find(product => product.id === item.productId)
        });
        movements.push({
          id: makeLocalId("imm-mov"),
          movementType: "STOCK_ADJUSTMENT",
          ownerType: adjustment.ownerType,
          ungetId: adjustment.ungetId,
          facilityCode: adjustment.facilityCode,
          productId: item.productId,
          stockLayerId: layers[layerIndex].id,
          quantityDelta: difference,
          quantityBefore: before,
          quantityAfter: item.physicalQuantity,
          period: adjustment.period,
          reason: adjustment.reason.trim(),
          observation: adjustment.observation.trim(),
          createdBy: adjustment.createdBy,
          createdAt: new Date().toISOString()
        });
      });

      setCachedList(STOCK_CACHE_KEY, layers);
      setCachedList(MOVEMENTS_CACHE_KEY, movements);
      setCachedList(ADJUSTMENTS_CACHE_KEY, [savedAdjustment, ...getCachedList<ImmunizationAdjustment>(ADJUSTMENTS_CACHE_KEY)]);
      setCachedList(ADJUSTMENT_ITEMS_CACHE_KEY, [
        ...getCachedList<ImmunizationAdjustmentItem>(ADJUSTMENT_ITEMS_CACHE_KEY),
        ...savedItems
      ]);
      return { success: true, adjustment: savedAdjustment };
    } catch (e: any) {
      return { success: false, message: e.message || "Error al registrar reajuste." };
    }
  }
};
