import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { jsPDF } from "jspdf";
import autoTableModule from "jspdf-autotable";
import { ensurePdfUnicodeFont, PDF_UNICODE_FONT } from "./pdfUnicodeFont";
import {
  ImmunizationMonthlyClosure,
  ImmunizationStockLayer,
  ImmunizationStockMovement
} from "../types";

/**
 * Variantes del formato de movimiento biológico.
 *
 * Las cinco usan exactamente la misma matriz de 19 columnas y las mismas letras
 * (a, b, c...). Lo único que cambia es qué alimenta cada columna y cómo se rotula
 * la salida principal (e), porque un almacén distribuye en vez de consumir.
 *
 * Los consolidados aplican el mismo criterio a distinta altura: lo que queda dentro
 * del ámbito del reporte es traslado interno y no cuenta como movimiento.
 */
export type ImmunizationReportVariant =
  | "IPRESS"
  | "UNGET_WAREHOUSE"
  | "UNGET_NETWORK"
  | "DIRESA_WAREHOUSE"
  | "DIRESA_NETWORK";

export interface ImmunizationMonthlyReportRow {
  codigoSismed: string;
  descripcion: string;
  dosisUnidad: number;
  lote: string;
  expirationDate: string;
  saldoAnterior: number;
  ingresoMes: number;
  fechaRecepcion: string;
  totalDisponible: number;
  consumoFrascos: number;
  consumoDosis: number;
  noDisponibleTransferido: number;
  totalMovimiento: number;
  /** `null` cuando el ámbito no aplica dosis a pacientes (almacén UNGET). */
  dosisAplicadas: number | null;
  dosisPerdidas: number | null;
  factorPerdida: number | null;
  saldoEess: number;
  saldoTotalDosis: number;
  unitPrice: number;
  fundingSource: string;
  supplyType: string;
  observacion: string;
}

export interface ImmunizationMonthlyReportOptions {
  period: string;
  ownerName: string;
  scopeLabel: string;
  generatedBy?: string;
  closure?: ImmunizationMonthlyClosure;
  stockLayers: ImmunizationStockLayer[];
  movements: ImmunizationStockMovement[];
  /**
   * Marca el reporte como preliminar. El consolidado regional solo es definitivo
   * cuando todas las UNGET han cerrado su periodo.
   */
  isPreliminary?: boolean;
  /** Texto que explica por qué el reporte aún es preliminar. */
  preliminaryReason?: string;
}

const quantity = (value: number) => value.toLocaleString("es-PE", { maximumFractionDigits: 2 });
const percent = (value: number) => `${value.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
/** Las columnas de dosis quedan vacías, nunca en cero, cuando el ámbito no aplica dosis. */
const optionalQuantity = (value: number | null) => (value === null ? "" : quantity(value));
const optionalPercent = (value: number | null) => (value === null ? "" : percent(value));
const normalizeFilePart = (value: string) => value.replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");

const formatDateOnly = (value?: string) => {
  if (!value) return "";
  const normalized = value.includes("T") ? value : `${value}T00:00:00`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const uniqueDates = (movements: ImmunizationStockMovement[]) =>
  Array.from(new Set(movements.map(movement => formatDateOnly(movement.createdAt)).filter(Boolean))).join(" / ");

const uuidPattern = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const longTechnicalIdPattern = /\b[a-z0-9_-]{24,}\b/gi;
const technicalObservationPrefixes = [
  /^inventario inicial\b/i,
  /^registro consumo\b/i,
  /^dosis aplicadas\s*:/i,
  /^dosis consumidas\s*:/i,
  /^dosis perdidas\s*:/i,
  /^factor p(?:é|e)rdida\s*:/i,
  /^fefo autom[aá]tico\b/i,
  /^cantidad recibida\s*:/i
];

const sanitizeObservationParts = (observation?: string) => {
  if (!observation) return [];
  return observation
    .split("|")
    .map(part => part
      .replace(uuidPattern, "")
      .replace(longTechnicalIdPattern, "")
      .replace(/\s+/g, " ")
      .replace(/\s+([,.;:])/g, "$1")
      .trim()
    )
    .filter(part => part && !technicalObservationPrefixes.some(pattern => pattern.test(part)))
    .filter(part => !/^[,.;:\-\s]+$/.test(part));
};

const humanizeReason = (value?: string) => {
  if (!value) return "";
  const normalized = value
    .replace(uuidPattern, "")
    .replace(longTechnicalIdPattern, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return "";
  const lower = normalized.toLocaleLowerCase("es-PE");
  return lower.charAt(0).toLocaleUpperCase("es-PE") + lower.slice(1);
};

const formatSignedQuantity = (value: number) => {
  const absoluteValue = Math.abs(value);
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${quantity(absoluteValue)} ${absoluteValue === 1 ? "frasco" : "frascos"}`;
};

const joinSentenceParts = (parts: string[]) => parts.filter(Boolean).join(". ");

const buildMovementObservation = (movement: ImmunizationStockMovement) => {
  const cleanParts = sanitizeObservationParts(movement.observation);
  const firstCleanPart = cleanParts[0];
  const reason = humanizeReason(firstCleanPart || movement.reason);
  const movementQuantity = Math.abs(movement.quantityDelta);
  const quantityLabel = `${quantity(movementQuantity)} ${movementQuantity === 1 ? "frasco" : "frascos"}`;

  if (movement.movementType === "IPRESS_DISPOSAL_OUT") {
    return joinSentenceParts([
      `Baja no disponible enviada a UNGET: ${quantityLabel}`,
      reason ? `Motivo: ${reason}` : ""
    ]);
  }

  if (movement.movementType === "IPRESS_TRANSFER_OUT") {
    return joinSentenceParts([
      `Transferencia/devolución a UNGET: ${quantityLabel}`,
      reason ? `Motivo: ${reason}` : ""
    ]);
  }

  if (movement.movementType === "IPRESS_RETURN_OUT") {
    return joinSentenceParts([
      `Devolución a UNGET: ${quantityLabel}`,
      reason ? `Motivo: ${reason}` : ""
    ]);
  }

  if (movement.movementType === "UNGET_DISTRIBUTION_OUT" || movement.movementType === "DIRESA_DISTRIBUTION_OUT") {
    return `Distribución realizada: ${quantityLabel}`;
  }

  if (movement.movementType === "UNGET_DISPOSAL_RECEIVED") {
    return joinSentenceParts([
      `Baja recepcionada por UNGET: ${quantityLabel}`,
      reason ? `Motivo: ${reason}` : ""
    ]);
  }

  if (movement.movementType === "STOCK_ADJUSTMENT") {
    return joinSentenceParts([
      `Reajuste de stock: ${formatSignedQuantity(movement.quantityDelta)}`,
      reason ? `Motivo: ${reason}` : ""
    ]);
  }

  if (movement.movementType === "IPRESS_CONSUMPTION" && cleanParts.length > 0) {
    return `Observación de consumo: ${cleanParts.map(humanizeReason).join("; ")}`;
  }

  return cleanParts.map(humanizeReason).join("; ");
};

const movementIsIncome = (movement: ImmunizationStockMovement) => {
  if (movement.movementType === "INITIAL_INVENTORY") return false;
  return movement.quantityDelta > 0 ||
    ["IPRESS_DISTRIBUTION_IN", "UNGET_DISTRIBUTION_IN", "DIRESA_INCOME", "UNGET_INCOME", "UNGET_TRANSFER_IN", "UNGET_RETURN_IN"].includes(movement.movementType);
};

const movementIsConsumption = (movement: ImmunizationStockMovement) => movement.movementType === "IPRESS_CONSUMPTION";

const movementIsNoDisponible = (movement: ImmunizationStockMovement) =>
  ["IPRESS_DISPOSAL_OUT", "IPRESS_RETURN_OUT", "IPRESS_TRANSFER_OUT", "UNGET_DISTRIBUTION_OUT", "DIRESA_DISTRIBUTION_OUT", "UNGET_DISPOSAL_RECEIVED"].includes(movement.movementType);

const layerGroupKey = (layer: ImmunizationStockLayer) => [
  layer.productId,
  layer.lote?.trim() || "-",
  layer.expirationDate || "",
  Number(layer.unitPrice || 0).toFixed(6),
  layer.fundingSource?.trim() || "",
  layer.supplyType?.trim() || ""
].join("||");

const fallbackMovementGroupKey = (movement: ImmunizationStockMovement) => [
  movement.productId,
  "SIN_LOTE",
  "",
  "0.000000",
  "",
  ""
].join("||");

const movementGroupKey = (
  movement: ImmunizationStockMovement,
  layerById: Map<string, ImmunizationStockLayer>
) => {
  const layer = movement.stockLayerId ? layerById.get(movement.stockLayerId) : undefined;
  return layer ? layerGroupKey(layer) : fallbackMovementGroupKey(movement);
};

const movementMagnitude = (movement: ImmunizationStockMovement) => Math.abs(movement.quantityDelta || 0);

/**
 * Movimientos que solo trasladan stock dentro de la misma UNGET (almacén <-> IPRESS).
 *
 * En el consolidado de red se anulan solos: origen y destino están ambos dentro del
 * reporte, así que contarlos inflaría el movimiento del mes sin que la red haya
 * ganado ni perdido un solo frasco. `UNGET_DISPOSAL_RECEIVED` se registra con delta 0
 * y también queda fuera para no duplicar la baja que ya salió del stock IPRESS.
 */
const INTERNAL_NETWORK_MOVEMENT_TYPES = [
  "UNGET_DISTRIBUTION_OUT",
  "IPRESS_DISTRIBUTION_IN",
  "IPRESS_RETURN_OUT",
  "IPRESS_TRANSFER_OUT",
  "UNGET_RETURN_IN",
  "UNGET_TRANSFER_IN",
  "UNGET_DISPOSAL_RECEIVED"
];

const isInternalNetworkMovement = (movement: ImmunizationStockMovement) =>
  INTERNAL_NETWORK_MOVEMENT_TYPES.includes(movement.movementType);

/**
 * A nivel regional el criterio sube un escalón: la distribución DIRESA -> UNGET también
 * es un traslado interno, porque origen y destino están dentro del mismo consolidado.
 */
const INTERNAL_REGIONAL_MOVEMENT_TYPES = [
  ...INTERNAL_NETWORK_MOVEMENT_TYPES,
  "DIRESA_DISTRIBUTION_OUT",
  "UNGET_DISTRIBUTION_IN"
];

const isInternalRegionalMovement = (movement: ImmunizationStockMovement) =>
  INTERNAL_REGIONAL_MOVEMENT_TYPES.includes(movement.movementType);

/** Almacén regional DIRESA: la salida principal es la distribución a las UNGET. */
const movementIsRegionalWarehouseDistribution = (movement: ImmunizationStockMovement) =>
  movement.movementType === "DIRESA_DISTRIBUTION_OUT";

/** Almacén regional DIRESA: deteriorado, vencido, transferido o reajuste negativo. */
const movementIsRegionalWarehouseLoss = (movement: ImmunizationStockMovement) =>
  movement.quantityDelta < 0 && movement.movementType !== "DIRESA_DISTRIBUTION_OUT";

/** Región: solo entra lo que llega desde fuera de la región. */
const movementIsRegionalIncome = (movement: ImmunizationStockMovement) => {
  if (movement.movementType === "INITIAL_INVENTORY") return false;
  if (isInternalRegionalMovement(movement)) return false;
  return movement.quantityDelta > 0;
};

/** Región: salidas reales, sin contar consumo ni traslados internos. */
const movementIsRegionalLoss = (movement: ImmunizationStockMovement) => {
  if (movement.movementType === "IPRESS_CONSUMPTION") return false;
  if (isInternalRegionalMovement(movement)) return false;
  return movement.quantityDelta < 0;
};

/** Almacén UNGET: ingresos desde DIRESA, devoluciones aceptadas y reajustes positivos. */
const movementIsWarehouseIncome = (movement: ImmunizationStockMovement) =>
  movement.movementType !== "INITIAL_INVENTORY" && movement.quantityDelta > 0;

/** Almacén UNGET: la salida principal es la distribución a IPRESS, no el consumo. */
const movementIsWarehouseDistribution = (movement: ImmunizationStockMovement) =>
  movement.movementType === "UNGET_DISTRIBUTION_OUT";

/** Almacén UNGET: deteriorado, vencido, transferido o reajuste negativo. */
const movementIsWarehouseLoss = (movement: ImmunizationStockMovement) =>
  movement.quantityDelta < 0 && movement.movementType !== "UNGET_DISTRIBUTION_OUT";

/** Red UNGET: el único ingreso real es lo que entra desde fuera de la red. */
const movementIsNetworkIncome = (movement: ImmunizationStockMovement) => {
  if (movement.movementType === "INITIAL_INVENTORY") return false;
  if (isInternalNetworkMovement(movement)) return false;
  return movement.quantityDelta > 0;
};

/** Red UNGET: salidas reales, sin contar consumo ni traslados internos. */
const movementIsNetworkLoss = (movement: ImmunizationStockMovement) => {
  if (movement.movementType === "IPRESS_CONSUMPTION") return false;
  if (isInternalNetworkMovement(movement)) return false;
  return movement.quantityDelta < 0;
};

const sortByDate = (movements: ImmunizationStockMovement[]) =>
  [...movements].sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));

/**
 * Si el inventario inicial se registró dentro del mismo periodo cuenta como saldo
 * anterior, no como ingreso del mes. Regla heredada del reporte IPRESS.
 */
const openingBalanceForLayer = (layer: ImmunizationStockLayer, layerMovements: ImmunizationStockMovement[]) => {
  const movements = sortByDate(layerMovements);
  const initialInventory = movements.find(movement => movement.movementType === "INITIAL_INVENTORY");
  if (initialInventory) return initialInventory.quantityAfter;
  if (movements[0]) return movements[0].quantityBefore;
  return layer.currentQuantity;
};

export const buildImmunizationMonthlyReportRows = ({
  stockLayers,
  movements,
  period
}: ImmunizationMonthlyReportOptions): ImmunizationMonthlyReportRow[] => {
  const periodMovements = movements.filter(movement => movement.period === period);
  const movementLayerIds = new Set(periodMovements.map(movement => movement.stockLayerId).filter(Boolean));
  const layerMap = new Map(stockLayers.map(layer => [layer.id, layer]));

  for (const movement of periodMovements) {
    if (movement.stockLayerId && !layerMap.has(movement.stockLayerId)) {
      layerMap.set(movement.stockLayerId, {
        id: movement.stockLayerId,
        ownerType: movement.ownerType,
        ungetId: movement.ungetId,
        facilityCode: movement.facilityCode,
        productId: movement.productId,
        lote: "-",
        expirationDate: "",
        unitPrice: 0,
        fundingSource: "",
        supplyType: "",
        currentQuantity: movement.quantityAfter,
        isActive: movement.quantityAfter > 0
      });
    }
  }

  const reportLayers = Array.from(layerMap.values())
    .filter(layer => layer.isActive || layer.currentQuantity > 0 || movementLayerIds.has(layer.id))
    .sort((a, b) => {
      const codeCompare = (a.product?.codigoSismed || "").localeCompare(b.product?.codigoSismed || "");
      if (codeCompare !== 0) return codeCompare;
      const expirationCompare = (a.expirationDate || "").localeCompare(b.expirationDate || "");
      return expirationCompare !== 0 ? expirationCompare : (a.lote || "").localeCompare(b.lote || "");
    });

  return reportLayers.map(layer => {
    const layerMovements = periodMovements
      .filter(movement => movement.stockLayerId === layer.id)
      .sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
    const firstMovement = layerMovements[0];
    const initialInventory = layerMovements.find(movement => movement.movementType === "INITIAL_INVENTORY");
    const incomeMovements = layerMovements.filter(movementIsIncome);
    const saldoAnterior = initialInventory ? initialInventory.quantityAfter : firstMovement ? firstMovement.quantityBefore : layer.currentQuantity;
    const ingresoMes = incomeMovements.reduce((sum, movement) => sum + Math.max(movement.quantityDelta, 0), 0);
    const consumoFrascos = layerMovements.filter(movementIsConsumption).reduce((sum, movement) => sum + Math.abs(movement.quantityDelta), 0);
    const dosisUnidad = Number(layer.product?.dosisUnidad) || 0;
    const consumoDosis = consumoFrascos * dosisUnidad;
    const noDisponibleTransferido = layerMovements.filter(movementIsNoDisponible).reduce((sum, movement) => sum + Math.abs(movement.quantityDelta), 0);
    const dosisAplicadas = layerMovements.filter(movementIsConsumption).reduce((sum, movement) => sum + (movement.dosesApplied || 0), 0);
    const dosisPerdidas = Math.max(consumoDosis - dosisAplicadas, 0);
    const totalDisponible = saldoAnterior + ingresoMes;
    const totalMovimiento = consumoFrascos + noDisponibleTransferido;
    const saldoEess = totalDisponible - totalMovimiento;
    const observations = Array.from(new Set(layerMovements.map(buildMovementObservation).filter(Boolean)));

    return {
      codigoSismed: layer.product?.codigoSismed || "",
      descripcion: layer.product?.descripcion || "Producto sin descripción",
      dosisUnidad,
      lote: layer.lote,
      expirationDate: formatDateOnly(layer.expirationDate),
      saldoAnterior,
      ingresoMes,
      fechaRecepcion: uniqueDates(incomeMovements),
      totalDisponible,
      consumoFrascos,
      consumoDosis,
      noDisponibleTransferido,
      totalMovimiento,
      dosisAplicadas,
      dosisPerdidas,
      factorPerdida: consumoDosis > 0 ? (dosisPerdidas / consumoDosis) * 100 : 0,
      saldoEess,
      saldoTotalDosis: saldoEess * dosisUnidad,
      unitPrice: layer.unitPrice,
      fundingSource: layer.fundingSource,
      supplyType: layer.supplyType,
      observacion: observations.join(" | ")
    };
  });
};

const sortReportRows = (rows: ImmunizationMonthlyReportRow[]) => rows.sort((a, b) => {
  const codeCompare = a.codigoSismed.localeCompare(b.codigoSismed);
  if (codeCompare !== 0) return codeCompare;
  const expirationCompare = a.expirationDate.localeCompare(b.expirationDate);
  return expirationCompare !== 0 ? expirationCompare : a.lote.localeCompare(b.lote);
});

const rowHasContent = (row: ImmunizationMonthlyReportRow) =>
  row.saldoAnterior !== 0 || row.ingresoMes !== 0 || row.totalMovimiento !== 0 || row.saldoEess !== 0;

/**
 * Movimiento biológico de un almacén (UNGET o regional DIRESA).
 *
 * Usa la misma matriz que el reporte IPRESS. La única diferencia conceptual es que la
 * salida (e) es la distribución al siguiente nivel en vez del consumo, y que un almacén
 * no aplica dosis: por eso las columnas de dosis quedan vacías en lugar de en cero, que
 * daría un factor de pérdida del 100% completamente falso.
 */
const buildWarehouseReportRows = (
  { stockLayers, movements, period }: ImmunizationMonthlyReportOptions,
  ownerType: "UNGET" | "DIRESA",
  isDistribution: (movement: ImmunizationStockMovement) => boolean,
  isLoss: (movement: ImmunizationStockMovement) => boolean
): ImmunizationMonthlyReportRow[] => {
  const periodMovements = movements.filter(movement => movement.period === period && movement.ownerType === ownerType);
  const movementLayerIds = new Set(periodMovements.map(movement => movement.stockLayerId).filter(Boolean));
  const layerMap = new Map(
    stockLayers.filter(layer => layer.ownerType === ownerType).map(layer => [layer.id, layer])
  );

  for (const movement of periodMovements) {
    if (movement.stockLayerId && !layerMap.has(movement.stockLayerId)) {
      layerMap.set(movement.stockLayerId, {
        id: movement.stockLayerId,
        ownerType: movement.ownerType,
        ungetId: movement.ungetId,
        facilityCode: movement.facilityCode,
        productId: movement.productId,
        lote: "-",
        expirationDate: "",
        unitPrice: 0,
        fundingSource: "",
        supplyType: "",
        currentQuantity: movement.quantityAfter,
        isActive: movement.quantityAfter > 0
      });
    }
  }

  const rows = Array.from(layerMap.values())
    .filter(layer => layer.isActive || layer.currentQuantity > 0 || movementLayerIds.has(layer.id))
    .map(layer => {
      const layerMovements = sortByDate(periodMovements.filter(movement => movement.stockLayerId === layer.id));
      const incomeMovements = layerMovements.filter(movementIsWarehouseIncome);
      const saldoAnterior = openingBalanceForLayer(layer, layerMovements);
      const ingresoMes = incomeMovements.reduce((sum, movement) => sum + movement.quantityDelta, 0);
      const distribucionSalida = layerMovements.filter(isDistribution).reduce((sum, movement) => sum + movementMagnitude(movement), 0);
      const noDisponibleTransferido = layerMovements.filter(isLoss).reduce((sum, movement) => sum + movementMagnitude(movement), 0);
      const dosisUnidad = Number(layer.product?.dosisUnidad) || 0;
      const totalDisponible = saldoAnterior + ingresoMes;
      const totalMovimiento = distribucionSalida + noDisponibleTransferido;
      const saldoEess = totalDisponible - totalMovimiento;
      const observations = Array.from(new Set(layerMovements.map(buildMovementObservation).filter(Boolean)));

      return {
        codigoSismed: layer.product?.codigoSismed || "",
        descripcion: layer.product?.descripcion || "Producto sin descripción",
        dosisUnidad,
        lote: layer.lote,
        expirationDate: formatDateOnly(layer.expirationDate),
        saldoAnterior,
        ingresoMes,
        fechaRecepcion: uniqueDates(incomeMovements),
        totalDisponible,
        consumoFrascos: distribucionSalida,
        consumoDosis: distribucionSalida * dosisUnidad,
        noDisponibleTransferido,
        totalMovimiento,
        dosisAplicadas: null,
        dosisPerdidas: null,
        factorPerdida: null,
        saldoEess,
        saldoTotalDosis: saldoEess * dosisUnidad,
        unitPrice: layer.unitPrice,
        fundingSource: layer.fundingSource,
        supplyType: layer.supplyType,
        observacion: observations.join(" | ")
      } satisfies ImmunizationMonthlyReportRow;
    })
    .filter(rowHasContent);

  return sortReportRows(rows);
};

/**
 * Movimiento biológico consolidado de un ámbito completo, tratándolo como un único
 * almacén lógico agrupado por producto/lote.
 *
 * Los traslados internos se anulan solos porque origen y destino están ambos dentro del
 * reporte, así que el ingreso del mes es únicamente lo que entra desde fuera del ámbito y
 * la salida es consumo real más deterioro/vencimiento. Gracias a eso el
 * `% factor de pérdida` de esta matriz sí es el indicador real del ámbito.
 *
 * La aritmética asume que no hay stock en tránsito: el reporte solo se habilita cuando no
 * quedan distribuciones ni devoluciones pendientes de recepción.
 */
const buildNetworkReportRows = (
  { stockLayers, movements, period }: ImmunizationMonthlyReportOptions,
  ownerTypes: string[],
  isIncome: (movement: ImmunizationStockMovement) => boolean,
  isLoss: (movement: ImmunizationStockMovement) => boolean
): ImmunizationMonthlyReportRow[] => {
  const isNetworkOwner = (ownerType: string) => ownerTypes.includes(ownerType);
  const periodMovements = movements.filter(movement => movement.period === period && isNetworkOwner(movement.ownerType));
  const layerById = new Map(stockLayers.map(layer => [layer.id, layer]));
  const productById = new Map<string, ImmunizationStockLayer["product"]>();
  stockLayers.forEach(layer => {
    if (layer.product) productById.set(layer.productId, layer.product);
  });

  const groups = new Map<string, { layers: ImmunizationStockLayer[]; movements: ImmunizationStockMovement[] }>();
  const groupFor = (key: string) => {
    const group = groups.get(key) || { layers: [], movements: [] };
    groups.set(key, group);
    return group;
  };

  stockLayers
    .filter(layer => isNetworkOwner(layer.ownerType))
    .forEach(layer => groupFor(layerGroupKey(layer)).layers.push(layer));

  periodMovements.forEach(movement => groupFor(movementGroupKey(movement, layerById)).movements.push(movement));

  const rows = Array.from(groups.values()).map(group => {
    const groupMovements = sortByDate(group.movements);
    const firstMovement = groupMovements[0];
    const representativeLayer = group.layers[0]
      || (firstMovement?.stockLayerId ? layerById.get(firstMovement.stockLayerId) : undefined);
    const productId = representativeLayer?.productId || firstMovement?.productId || "";
    const product = representativeLayer?.product || productById.get(productId);

    const movementByLayerId = new Map<string, ImmunizationStockMovement[]>();
    groupMovements.forEach(movement => {
      if (!movement.stockLayerId) return;
      movementByLayerId.set(movement.stockLayerId, [...(movementByLayerId.get(movement.stockLayerId) || []), movement]);
    });

    const saldoAnterior = group.layers.reduce(
      (sum, layer) => sum + openingBalanceForLayer(layer, movementByLayerId.get(layer.id) || []),
      0
    );
    const incomeMovements = groupMovements.filter(isIncome);
    const ingresoMes = incomeMovements.reduce((sum, movement) => sum + movement.quantityDelta, 0);
    const consumoMovements = groupMovements.filter(movementIsConsumption);
    const consumoFrascos = consumoMovements.reduce((sum, movement) => sum + movementMagnitude(movement), 0);
    const noDisponibleTransferido = groupMovements.filter(isLoss).reduce((sum, movement) => sum + movementMagnitude(movement), 0);
    const dosisUnidad = Number(product?.dosisUnidad) || 0;
    const consumoDosis = consumoFrascos * dosisUnidad;
    const dosisAplicadas = consumoMovements.reduce((sum, movement) => sum + (movement.dosesApplied || 0), 0);
    const dosisPerdidas = Math.max(consumoDosis - dosisAplicadas, 0);
    const totalDisponible = saldoAnterior + ingresoMes;
    const totalMovimiento = consumoFrascos + noDisponibleTransferido;
    const saldoEess = totalDisponible - totalMovimiento;
    const observations = Array.from(new Set(groupMovements.map(buildMovementObservation).filter(Boolean)));

    return {
      codigoSismed: product?.codigoSismed || "",
      descripcion: product?.descripcion || (productId ? "Producto sin descripción" : "Producto sin referencia"),
      dosisUnidad,
      lote: representativeLayer?.lote || "SIN LOTE",
      expirationDate: formatDateOnly(representativeLayer?.expirationDate),
      saldoAnterior,
      ingresoMes,
      fechaRecepcion: uniqueDates(incomeMovements),
      totalDisponible,
      consumoFrascos,
      consumoDosis,
      noDisponibleTransferido,
      totalMovimiento,
      dosisAplicadas,
      dosisPerdidas,
      factorPerdida: consumoDosis > 0 ? (dosisPerdidas / consumoDosis) * 100 : 0,
      saldoEess,
      saldoTotalDosis: saldoEess * dosisUnidad,
      unitPrice: representativeLayer?.unitPrice || 0,
      fundingSource: representativeLayer?.fundingSource || "",
      supplyType: representativeLayer?.supplyType || "",
      observacion: observations.join(" | ")
    } satisfies ImmunizationMonthlyReportRow;
  })
    .filter(rowHasContent);

  return sortReportRows(rows);
};

/** Almacén UNGET: la salida (e) es la distribución a sus IPRESS. */
export const buildImmunizationUngetWarehouseReportRows = (
  options: ImmunizationMonthlyReportOptions
): ImmunizationMonthlyReportRow[] =>
  buildWarehouseReportRows(options, "UNGET", movementIsWarehouseDistribution, movementIsWarehouseLoss);

/** Red UNGET: almacén más sus IPRESS. Solo entra lo recibido de DIRESA. */
export const buildImmunizationUngetNetworkReportRows = (
  options: ImmunizationMonthlyReportOptions
): ImmunizationMonthlyReportRow[] =>
  buildNetworkReportRows(options, ["UNGET", "IPRESS"], movementIsNetworkIncome, movementIsNetworkLoss);

/** Almacén regional DIRESA: la salida (e) es la distribución a las UNGET. */
export const buildImmunizationDiresaWarehouseReportRows = (
  options: ImmunizationMonthlyReportOptions
): ImmunizationMonthlyReportRow[] =>
  buildWarehouseReportRows(options, "DIRESA", movementIsRegionalWarehouseDistribution, movementIsRegionalWarehouseLoss);

/**
 * Consolidado regional: almacén DIRESA, todas las UNGET y todas las IPRESS.
 *
 * La distribución DIRESA -> UNGET se suma a los traslados internos, así que el ingreso del
 * mes es solo lo que entra a la región desde fuera y la salida es consumo real más
 * deterioro. El saldo final es el stock total de la región.
 */
export const buildImmunizationDiresaNetworkReportRows = (
  options: ImmunizationMonthlyReportOptions
): ImmunizationMonthlyReportRow[] =>
  buildNetworkReportRows(options, ["DIRESA", "UNGET", "IPRESS"], movementIsRegionalIncome, movementIsRegionalLoss);

const excelColumns = [
  { key: "codigoSismed", width: 14 },
  { key: "descripcion", width: 54 },
  { key: "dosisUnidad", width: 14 },
  { key: "saldoAnterior", width: 13 },
  { key: "lote", width: 16 },
  { key: "expirationDate", width: 15 },
  { key: "ingresoMes", width: 12 },
  { key: "fechaRecepcion", width: 15 },
  { key: "totalDisponible", width: 14 },
  { key: "consumoFrascos", width: 13 },
  { key: "consumoDosis", width: 13 },
  { key: "noDisponibleTransferido", width: 18 },
  { key: "totalMovimiento", width: 14 },
  { key: "dosisAplicadas", width: 14 },
  { key: "dosisPerdidas", width: 13 },
  { key: "factorPerdida", width: 14 },
  { key: "saldoEess", width: 13 },
  { key: "saldoTotalDosis", width: 13 },
  { key: "observacion", width: 42 }
];

const setCellBorder = (cell: ExcelJS.Cell) => {
  cell.border = {
    top: { style: "thin", color: { argb: "FF475569" } },
    left: { style: "thin", color: { argb: "FF475569" } },
    bottom: { style: "thin", color: { argb: "FF475569" } },
    right: { style: "thin", color: { argb: "FF475569" } }
  };
};

const setHeaderCell = (cell: ExcelJS.Cell) => {
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2CC" } };
  cell.font = { name: "Arial", size: 8, bold: true, color: { argb: "FF000000" } };
  cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  setCellBorder(cell);
};

interface ReportVariantConfig {
  title: string;
  filePrefix: string;
  worksheetName: string;
  /** (b) saldo del mes anterior */
  saldoAnteriorLabel: string;
  /** (c) ingreso del mes */
  ingresoLabel: string;
  /** (e) salida principal en frascos */
  salidaFrascoLabel: string;
  /** (f) salida principal en dosis */
  salidaDosisLabel: string;
  /** (l) saldo final en frascos */
  saldoFinalLabel: string;
  /** Nota aclaratoria bajo la cabecera. */
  note?: string;
  /** El ámbito aplica dosis a pacientes. */
  tracksDoses: boolean;
  closureLabel: (closure?: ImmunizationMonthlyClosure) => string;
}

const preclosureLabel = (closure?: ImmunizationMonthlyClosure) =>
  `Precierre: ${closure?.preclosedBy || "-"} ${closure?.preclosedAt ? new Date(closure.preclosedAt).toLocaleString("es-PE") : ""}`;

const finalClosureLabel = (closure?: ImmunizationMonthlyClosure) =>
  `Cierre UNGET: ${closure?.closedBy || "-"} ${closure?.closedAt ? new Date(closure.closedAt).toLocaleString("es-PE") : ""}`;

const REPORT_VARIANTS: Record<ImmunizationReportVariant, ReportVariantConfig> = {
  IPRESS: {
    title: "MOVIMIENTO BIOLÓGICO MENSUAL",
    filePrefix: "MOVIMIENTO_BIOLOGICO",
    worksheetName: "Movimiento biológico",
    saldoAnteriorLabel: "SALDO IPRESS\nMES ANTERIOR\n(b)",
    ingresoLabel: "INGRESO EN EL\nMES (c)",
    salidaFrascoLabel: "CONSUMO DEL\nMES FCO\n(e)",
    salidaDosisLabel: "CONSUMO DEL\nMES DOSIS\n(f=e*a)",
    saldoFinalLabel: "SALDO\nEESS\n(l=d-h)",
    tracksDoses: true,
    closureLabel: preclosureLabel
  },
  UNGET_WAREHOUSE: {
    title: "MOVIMIENTO BIOLÓGICO MENSUAL - ALMACÉN UNGET",
    filePrefix: "MOVIMIENTO_BIOLOGICO_ALMACEN_UNGET",
    worksheetName: "Almacén UNGET",
    saldoAnteriorLabel: "SALDO ALMACÉN\nMES ANTERIOR\n(b)",
    ingresoLabel: "INGRESO EN EL\nMES (c)",
    salidaFrascoLabel: "DISTRIBUCIÓN\nA IPRESS FCO\n(e)",
    salidaDosisLabel: "DISTRIBUCIÓN\nA IPRESS DOSIS\n(f=e*a)",
    saldoFinalLabel: "SALDO\nALMACÉN\n(l=d-h)",
    note: "Movimiento del almacén UNGET. La salida (e) es la distribución a IPRESS. El almacén no aplica dosis, por eso las columnas (i), (j) y (k) van vacías.",
    tracksDoses: false,
    closureLabel: finalClosureLabel
  },
  UNGET_NETWORK: {
    title: "MOVIMIENTO BIOLÓGICO MENSUAL CONSOLIDADO UNGET",
    filePrefix: "MOVIMIENTO_BIOLOGICO_CONSOLIDADO_UNGET",
    worksheetName: "Consolidado UNGET",
    saldoAnteriorLabel: "SALDO RED\nMES ANTERIOR\n(b)",
    ingresoLabel: "INGRESO EN EL\nMES (c)",
    salidaFrascoLabel: "CONSUMO IPRESS\nDEL MES FCO\n(e)",
    salidaDosisLabel: "CONSUMO DEL\nMES DOSIS\n(f=e*a)",
    saldoFinalLabel: "SALDO\nTOTAL RED\n(l=d-h)",
    note: "Consolidado de almacén UNGET e IPRESS. El ingreso (c) es solo lo recibido de DIRESA: la distribución a IPRESS y las devoluciones al almacén son traslados internos y no se cuentan como movimiento. El detalle por establecimiento está en el movimiento biológico que genera cada IPRESS.",
    tracksDoses: true,
    closureLabel: finalClosureLabel
  },
  DIRESA_WAREHOUSE: {
    title: "MOVIMIENTO BIOLÓGICO MENSUAL - ALMACÉN REGIONAL DIRESA",
    filePrefix: "MOVIMIENTO_BIOLOGICO_ALMACEN_REGIONAL",
    worksheetName: "Almacén regional",
    saldoAnteriorLabel: "SALDO ALMACÉN\nREGIONAL MES\nANTERIOR\n(b)",
    ingresoLabel: "INGRESO EN EL\nMES (c)",
    salidaFrascoLabel: "DISTRIBUCIÓN\nA UNGET FCO\n(e)",
    salidaDosisLabel: "DISTRIBUCIÓN\nA UNGET DOSIS\n(f=e*a)",
    saldoFinalLabel: "SALDO\nALMACÉN\n(l=d-h)",
    note: "Movimiento del almacén regional DIRESA. La salida (e) es la distribución a las UNGET. El almacén no aplica dosis, por eso las columnas (i), (j) y (k) van vacías.",
    tracksDoses: false,
    closureLabel: () => "Ámbito regional"
  },
  DIRESA_NETWORK: {
    title: "MOVIMIENTO BIOLÓGICO MENSUAL CONSOLIDADO REGIONAL",
    filePrefix: "MOVIMIENTO_BIOLOGICO_CONSOLIDADO_REGIONAL",
    worksheetName: "Consolidado regional",
    saldoAnteriorLabel: "SALDO REGIÓN\nMES ANTERIOR\n(b)",
    ingresoLabel: "INGRESO EN EL\nMES (c)",
    salidaFrascoLabel: "CONSUMO IPRESS\nDEL MES FCO\n(e)",
    salidaDosisLabel: "CONSUMO DEL\nMES DOSIS\n(f=e*a)",
    saldoFinalLabel: "SALDO\nTOTAL REGIÓN\n(l=d-h)",
    note: "Consolidado de almacén regional, UNGET e IPRESS. El ingreso (c) es solo lo que entra a la región desde fuera: las distribuciones DIRESA -> UNGET -> IPRESS y las devoluciones son traslados internos y no se cuentan como movimiento. El detalle por UNGET está en el consolidado que genera cada UNGET.",
    tracksDoses: true,
    closureLabel: () => "Ámbito regional"
  }
};

const buildRowsForVariant = (
  options: ImmunizationMonthlyReportOptions,
  variant: ImmunizationReportVariant
): ImmunizationMonthlyReportRow[] => {
  if (variant === "UNGET_WAREHOUSE") return buildImmunizationUngetWarehouseReportRows(options);
  if (variant === "UNGET_NETWORK") return buildImmunizationUngetNetworkReportRows(options);
  if (variant === "DIRESA_WAREHOUSE") return buildImmunizationDiresaWarehouseReportRows(options);
  if (variant === "DIRESA_NETWORK") return buildImmunizationDiresaNetworkReportRows(options);
  return buildImmunizationMonthlyReportRows(options);
};

const reportTitle = (options: ImmunizationMonthlyReportOptions, variant: ImmunizationReportVariant) =>
  options.isPreliminary
    ? `${REPORT_VARIANTS[variant].title} - PRELIMINAR`
    : REPORT_VARIANTS[variant].title;

const reportNote = (options: ImmunizationMonthlyReportOptions, variant: ImmunizationReportVariant) => {
  const base = REPORT_VARIANTS[variant].note;
  if (!options.isPreliminary) return base;
  const warning = `REPORTE PRELIMINAR: ${options.preliminaryReason || "el periodo aún no está cerrado en todo el ámbito."}`;
  return base ? `${warning} ${base}` : warning;
};

const reportFileName = (
  options: ImmunizationMonthlyReportOptions,
  variant: ImmunizationReportVariant,
  extension: string
) => {
  const preliminary = options.isPreliminary ? "PRELIMINAR_" : "";
  return `${preliminary}${REPORT_VARIANTS[variant].filePrefix}_${normalizeFilePart(options.ownerName)}_${options.period}.${extension}`;
};

/**
 * Arma el libro Excel sin descargarlo. Separado de la descarga para poder generar
 * previsualizaciones fuera del navegador, igual que `immunizationAdjustmentPdfService`.
 */
export const buildMonthlyReportWorkbook = async (
  options: ImmunizationMonthlyReportOptions,
  variant: ImmunizationReportVariant
): Promise<ExcelJS.Workbook> => {
  const config = REPORT_VARIANTS[variant];
  const rows = buildRowsForVariant(options, variant);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ToolKit SISMED Web";
  workbook.created = new Date();
  const worksheet = workbook.addWorksheet(config.worksheetName, {
    views: [{ state: "frozen", ySplit: 5 }],
    pageSetup: {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.2, right: 0.2, top: 0.35, bottom: 0.35, header: 0.2, footer: 0.2 }
    }
  });

  worksheet.columns = excelColumns;
  worksheet.mergeCells("A1:S1");
  worksheet.getCell("A1").value = reportTitle(options, variant);
  worksheet.getCell("A1").font = { name: "Arial", size: 14, bold: true };
  worksheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(1).height = 24;

  worksheet.mergeCells("A2:S2");
  worksheet.getCell("A2").value = `Periodo: ${options.period} | Ámbito: ${options.scopeLabel} | Ubicación: ${options.ownerName} | Generado por: ${options.generatedBy || "-"} | ${config.closureLabel(options.closure)}`;
  worksheet.getCell("A2").font = { name: "Arial", size: 9, color: { argb: "FF334155" } };
  worksheet.getCell("A2").alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  worksheet.getRow(2).height = 20;

  const excelNote = reportNote(options, variant);
  if (excelNote) {
    worksheet.mergeCells("A3:S3");
    worksheet.getCell("A3").value = excelNote;
    worksheet.getCell("A3").font = { name: "Arial", size: 8, italic: true, color: { argb: "FF475569" } };
    worksheet.getCell("A3").alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    worksheet.getRow(3).height = 22;
  }

  const mergedHeaders = [
    ["A4:A5", "CÓDIGO\nSISMED"],
    ["B4:B5", "BIOLÓGICOS/DILUYENTES/JERINGAS"],
    ["C4:C5", "PRESENTACIÓN\nDOSIS/UNIDAD\n(a)"],
    ["D4:I4", "SALDO DISPONIBLE PARA EL MES X FRASCO"],
    ["J4:M4", "MOVIMIENTO DEL MES X FRASCO"],
    ["N4:P4", "MOVIMIENTO DEL MES X DOSIS"],
    ["Q4:Q5", config.saldoFinalLabel],
    ["R4:R5", "SALDO\nTOTAL\nDOSIS (o)"],
    ["S4:S5", "OBSERVACIONES"]
  ] as const;

  mergedHeaders.forEach(([range, value]) => {
    worksheet.mergeCells(range);
    worksheet.getCell(range.split(":")[0]).value = value;
  });

  // Ojo: ExcelJS trata un array literal como contiguo 0-based (índice 0 -> columna A).
  // Un `undefined` inicial no se salta: desplazaría todo el reporte una columna.
  worksheet.getRow(5).values = [
    undefined,
    undefined,
    undefined,
    config.saldoAnteriorLabel,
    "N° LOTE",
    "(*)FECHA DE\nVENCIMIENTO",
    config.ingresoLabel,
    "FECHA DE\nRECEP.",
    "TOTAL DISPONIBLE\nPARA EL MES\n(d=b+c)",
    config.salidaFrascoLabel,
    config.salidaDosisLabel,
    "(*)DETERIORADO\n/VENCIDO O\nTRANSFERIDO\n(g)",
    "TOTAL MOVIMIENTO\nDEL MES\n(h=e+g)",
    "DOSIS\nAPLICADAS\n(i)",
    "DOSIS\nPERDIDAS\n(j=f-i)",
    "% FACTOR\nPERDIDA\n(k=(j/f)*100)"
  ];

  [4, 5].forEach(rowNumber => {
    const row = worksheet.getRow(rowNumber);
    row.height = rowNumber === 4 ? 24 : 76;
    for (let col = 1; col <= 19; col += 1) {
      setHeaderCell(row.getCell(col));
    }
  });

  rows.forEach((row, index) => {
    const rowNumber = index + 6;
    const excelRow = worksheet.getRow(rowNumber);
    excelRow.values = [
      row.codigoSismed,
      row.descripcion,
      row.dosisUnidad,
      row.saldoAnterior,
      row.lote,
      row.expirationDate,
      row.ingresoMes,
      row.fechaRecepcion,
      { formula: `D${rowNumber}+G${rowNumber}`, result: row.totalDisponible },
      row.consumoFrascos,
      { formula: `J${rowNumber}*C${rowNumber}`, result: row.consumoDosis },
      row.noDisponibleTransferido,
      { formula: `J${rowNumber}+L${rowNumber}`, result: row.totalMovimiento },
      config.tracksDoses ? row.dosisAplicadas ?? 0 : "",
      config.tracksDoses ? { formula: `K${rowNumber}-N${rowNumber}`, result: row.dosisPerdidas ?? 0 } : "",
      config.tracksDoses
        ? { formula: `IF(K${rowNumber}=0,"",O${rowNumber}/K${rowNumber})`, result: (row.factorPerdida ?? 0) / 100 }
        : "",
      { formula: `I${rowNumber}-M${rowNumber}`, result: row.saldoEess },
      { formula: `Q${rowNumber}*C${rowNumber}`, result: row.saldoTotalDosis },
      row.observacion
    ];
    excelRow.height = 34;
    for (let col = 1; col <= 19; col += 1) {
      const cell = excelRow.getCell(col);
      setCellBorder(cell);
      cell.font = { name: "Arial", size: 9, bold: col === 1 || col === 2 };
      cell.alignment = { horizontal: col === 2 || col === 19 ? "left" : "center", vertical: "middle", wrapText: true };
      if ([3, 4, 7, 9, 10, 11, 12, 13, 17, 18].includes(col)) {
        cell.numFmt = "0";
      }
      if (config.tracksDoses && [14, 15].includes(col)) {
        cell.numFmt = "0";
      }
      if (config.tracksDoses && col === 16) {
        cell.numFmt = "0.00%";
      }
    }
  });

  worksheet.autoFilter = "A5:S5";
  worksheet.pageSetup.printTitlesRow = "4:5";

  return workbook;
};

const writeMonthlyReportExcel = async (
  options: ImmunizationMonthlyReportOptions,
  variant: ImmunizationReportVariant
): Promise<void> => {
  const workbook = await buildMonthlyReportWorkbook(options, variant);
  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(
    new Blob([buffer as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    reportFileName(options, variant, "xlsx")
  );
};

const resolveAutoTable = () => {
  const autoTable = typeof autoTableModule === "function"
    ? autoTableModule
    : (autoTableModule as unknown as { default: typeof autoTableModule }).default;
  if (!autoTable) throw new Error("No se pudo inicializar el generador de tablas PDF.");
  return autoTable;
};

const stampPdfFooter = (doc: jsPDF, margin: number) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageCount = doc.getNumberOfPages();
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    doc.setPage(pageNumber);
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, pageHeight - 9, pageWidth - margin, pageHeight - 9);
    doc.setFont(PDF_UNICODE_FONT, "normal");
    doc.setFontSize(6);
    doc.setTextColor(100, 116, 139);
    doc.text("ToolKit SISMED Web - Módulo Inmunizaciones", margin, pageHeight - 5);
    doc.text(`Página ${pageNumber} de ${pageCount}`, pageWidth - margin, pageHeight - 5, { align: "right" });
  }
};

/** Arma el PDF sin descargarlo. Ver `buildMonthlyReportWorkbook`. */
export const buildMonthlyReportPdfDoc = async (
  options: ImmunizationMonthlyReportOptions,
  variant: ImmunizationReportVariant
): Promise<jsPDF> => {
  const config = REPORT_VARIANTS[variant];
  const rows = buildRowsForVariant(options, variant);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  await ensurePdfUnicodeFont(doc);
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 3;
  const tableWidth = pageWidth - margin * 2;
  const autoTable = resolveAutoTable();
  const pdfNote = reportNote(options, variant);
  const headerHeight = pdfNote ? 26 : 21;

  doc.setFillColor(15, 118, 110);
  doc.rect(0, 0, pageWidth, headerHeight, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont(PDF_UNICODE_FONT, "bold");
  doc.setFontSize(11);
  doc.text(reportTitle(options, variant), margin, 9);
  doc.setFont(PDF_UNICODE_FONT, "normal");
  doc.setFontSize(7.3);
  doc.text(`Periodo: ${options.period}  |  Ámbito: ${options.scopeLabel}  |  ${options.ownerName}`, margin, 15);
  doc.text(`Generado por: ${options.generatedBy || "-"}  |  ${config.closureLabel(options.closure)}`, pageWidth - margin, 15, { align: "right" });
  if (pdfNote) {
    doc.setFontSize(5.8);
    doc.text(doc.splitTextToSize(pdfNote, tableWidth), margin, 20);
  }

  autoTable(doc, {
    startY: headerHeight + 2,
    margin: { left: margin, right: margin, bottom: 10 },
    tableWidth,
    head: [
      [
        { content: "CÓDIGO\nSISMED", rowSpan: 2 },
        { content: "BIOLÓGICOS/DILUYENTES/JERINGAS", rowSpan: 2 },
        { content: "PRESENTACIÓN\nDOSIS/UNIDAD\n(a)", rowSpan: 2 },
        { content: "SALDO DISPONIBLE PARA EL MES X FRASCO", colSpan: 6 },
        { content: "MOVIMIENTO DEL MES X FRASCO", colSpan: 4 },
        { content: "MOVIMIENTO DEL MES X DOSIS", colSpan: 3 },
        { content: config.saldoFinalLabel, rowSpan: 2 },
        { content: "SALDO\nTOTAL\nDOSIS (o)", rowSpan: 2 },
        { content: "OBSERVACIONES", rowSpan: 2 }
      ],
      [
        config.saldoAnteriorLabel,
        "N° LOTE",
        "(*)FECHA DE\nVENCIMIENTO",
        config.ingresoLabel,
        "FECHA DE\nRECEP.",
        "TOTAL DISPONIBLE\nPARA EL MES\n(d=b+c)",
        config.salidaFrascoLabel,
        config.salidaDosisLabel,
        "(*)DETERIORADO\n/VENCIDO O\nTRANSFERIDO\n(g)",
        "TOTAL MOVIMIENTO\nDEL MES\n(h=e+g)",
        "DOSIS\nAPLICADAS\n(i)",
        "DOSIS\nPERDIDAS\n(j=f-i)",
        "% FACTOR\nPERDIDA\n(k=(j/f)*100)"
      ]
    ],
    body: rows.map(row => [
      row.codigoSismed,
      row.descripcion,
      quantity(row.dosisUnidad),
      quantity(row.saldoAnterior),
      row.lote,
      row.expirationDate,
      quantity(row.ingresoMes),
      row.fechaRecepcion,
      quantity(row.totalDisponible),
      quantity(row.consumoFrascos),
      quantity(row.consumoDosis),
      quantity(row.noDisponibleTransferido),
      quantity(row.totalMovimiento),
      optionalQuantity(row.dosisAplicadas),
      optionalQuantity(row.dosisPerdidas),
      optionalPercent(row.factorPerdida),
      quantity(row.saldoEess),
      quantity(row.saldoTotalDosis),
      row.observacion
    ]),
    theme: "grid",
    styles: {
      font: PDF_UNICODE_FONT,
      fontSize: 5.1,
      cellPadding: 0.85,
      textColor: [30, 41, 59],
      lineColor: [71, 85, 105],
      lineWidth: 0.08,
      halign: "center",
      valign: "middle",
      overflow: "linebreak"
    },
    headStyles: { fillColor: [255, 242, 204], textColor: [0, 0, 0], fontStyle: "bold", fontSize: 4.55, halign: "center", valign: "middle" },
    bodyStyles: { minCellHeight: 10, halign: "center", valign: "middle" },
    columnStyles: {
      0: { cellWidth: 10, halign: "center", fontStyle: "bold" },
      1: { cellWidth: 42, halign: "center", fontStyle: "bold" },
      2: { cellWidth: 11, halign: "center" },
      3: { cellWidth: 11, halign: "center" },
      4: { cellWidth: 13, halign: "center" },
      5: { cellWidth: 14, halign: "center" },
      6: { cellWidth: 10, halign: "center" },
      7: { cellWidth: 12, halign: "center" },
      8: { cellWidth: 13, halign: "center" },
      9: { cellWidth: 11, halign: "center" },
      10: { cellWidth: 12, halign: "center" },
      11: { cellWidth: 17, halign: "center" },
      12: { cellWidth: 13, halign: "center" },
      13: { cellWidth: 12, halign: "center" },
      14: { cellWidth: 12, halign: "center" },
      15: { cellWidth: 14, halign: "center" },
      16: { cellWidth: 11, halign: "center" },
      17: { cellWidth: 12, halign: "center" },
      18: { cellWidth: 41, halign: "center" }
    }
  });

  stampPdfFooter(doc, margin);
  return doc;
};

const writeMonthlyReportPdf = async (
  options: ImmunizationMonthlyReportOptions,
  variant: ImmunizationReportVariant
): Promise<void> => {
  const doc = await buildMonthlyReportPdfDoc(options, variant);
  doc.save(reportFileName(options, variant, "pdf"));
};
export const downloadImmunizationMonthlyReportExcel = (options: ImmunizationMonthlyReportOptions): Promise<void> =>
  writeMonthlyReportExcel(options, "IPRESS");

export const downloadImmunizationMonthlyReportPdf = (options: ImmunizationMonthlyReportOptions): Promise<void> =>
  writeMonthlyReportPdf(options, "IPRESS");

export const downloadImmunizationUngetWarehouseReportExcel = (options: ImmunizationMonthlyReportOptions): Promise<void> =>
  writeMonthlyReportExcel(options, "UNGET_WAREHOUSE");

export const downloadImmunizationUngetWarehouseReportPdf = (options: ImmunizationMonthlyReportOptions): Promise<void> =>
  writeMonthlyReportPdf(options, "UNGET_WAREHOUSE");

export const downloadImmunizationUngetNetworkReportExcel = (options: ImmunizationMonthlyReportOptions): Promise<void> =>
  writeMonthlyReportExcel(options, "UNGET_NETWORK");

export const downloadImmunizationUngetNetworkReportPdf = (options: ImmunizationMonthlyReportOptions): Promise<void> =>
  writeMonthlyReportPdf(options, "UNGET_NETWORK");

export const downloadImmunizationDiresaWarehouseReportExcel = (options: ImmunizationMonthlyReportOptions): Promise<void> =>
  writeMonthlyReportExcel(options, "DIRESA_WAREHOUSE");

export const downloadImmunizationDiresaWarehouseReportPdf = (options: ImmunizationMonthlyReportOptions): Promise<void> =>
  writeMonthlyReportPdf(options, "DIRESA_WAREHOUSE");

export const downloadImmunizationDiresaNetworkReportExcel = (options: ImmunizationMonthlyReportOptions): Promise<void> =>
  writeMonthlyReportExcel(options, "DIRESA_NETWORK");

export const downloadImmunizationDiresaNetworkReportPdf = (options: ImmunizationMonthlyReportOptions): Promise<void> =>
  writeMonthlyReportPdf(options, "DIRESA_NETWORK");
