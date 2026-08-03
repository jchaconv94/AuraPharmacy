import {
  HealthFacility,
  ImmunizationDistributionBatch,
  ImmunizationMonthlyClosure,
  ImmunizationReturnBatch,
  ImmunizationStockLayer,
  ImmunizationStockMovement,
  Unget
} from "../types";

/**
 * Cálculo del avance operativo mensual de inmunizaciones.
 *
 * Todo aquí es función pura: recibe los datos ya cargados y devuelve las métricas. Así el
 * tablero de reportes y el módulo de cierre comparten una única definición de "precerrada",
 * "pendiente" o "incidencia abierta", en vez de reimplementarla cada uno.
 */

export type ImmunizationClosureStatusFilter = "ALL" | "PENDING" | "PRE_CLOSED" | "FINAL_CLOSED" | "REOPENED";

export const closureIsIpressReady = (closure?: ImmunizationMonthlyClosure) =>
  closure?.status === "PRE_CLOSED" || closure?.status === "FINAL_CLOSED";

export const closureIsUngetClosed = (closure?: ImmunizationMonthlyClosure) =>
  closure?.status === "FINAL_CLOSED";

export const closureIsReopened = (closure?: ImmunizationMonthlyClosure) =>
  closure?.status === "REOPENED";

export const closureStatusLabel = (closure?: ImmunizationMonthlyClosure) => {
  if (!closure) return "Pendiente";
  if (closure.status === "FINAL_CLOSED") return "Cerrado";
  if (closure.status === "PRE_CLOSED") return "Precerrado";
  return "Reabierto";
};

export const closureStatusValue = (closure?: ImmunizationMonthlyClosure): ImmunizationClosureStatusFilter =>
  closure?.status || "PENDING";

export const closureMatchesStatus = (
  closure: ImmunizationMonthlyClosure | undefined,
  statusFilter: ImmunizationClosureStatusFilter
) => statusFilter === "ALL" || closureStatusValue(closure) === statusFilter;

/** Mismos umbrales que la pantalla de Stock Biológico, para no tener dos criterios. */
export type ImmunizationExpirationKey = "EXPIRED" | "CRITICAL" | "UPCOMING" | "VALID" | "UNKNOWN";

export const expirationKeyFor = (expirationDate: string | undefined, referenceDate: Date): ImmunizationExpirationKey => {
  if (!expirationDate) return "UNKNOWN";
  const normalized = expirationDate.includes("T") ? expirationDate : `${expirationDate}T00:00:00`;
  const expiration = new Date(normalized);
  if (Number.isNaN(expiration.getTime())) return "UNKNOWN";
  const days = Math.ceil((expiration.getTime() - referenceDate.getTime()) / 86400000);
  if (days < 0) return "EXPIRED";
  if (days <= 40) return "CRITICAL";
  if (days <= 90) return "UPCOMING";
  return "VALID";
};

export interface ImmunizationProgressInput {
  period: string;
  ungets: Unget[];
  facilities: HealthFacility[];
  closures: ImmunizationMonthlyClosure[];
  distributions: ImmunizationDistributionBatch[];
  returns: ImmunizationReturnBatch[];
  movements: ImmunizationStockMovement[];
  stockLayers: ImmunizationStockLayer[];
  /** Fecha con la que se evalúan los vencimientos. Por defecto, hoy. */
  referenceDate?: Date;
}

export interface ImmunizationProgressMetrics {
  totalIpress: number;
  preclosedIpress: number;
  pendingIpress: number;
  reopenedIpress: number;
  pendingDistributions: number;
  pendingReturns: number;
  observedDistributions: number;
  observedReturns: number;
  /** Recepciones observadas que siguen sin resolverse. */
  openIncidents: number;
  consumoFrascos: number;
  dosisAplicadas: number;
  dosisPerdidas: number;
  factorPerdida: number;
  bajasFrascos: number;
  stockFrascos: number;
  valorizacion: number;
  expiredLots: number;
  expiringLots: number;
}

export interface ImmunizationUngetProgress extends ImmunizationProgressMetrics {
  unget: Unget;
  closure?: ImmunizationMonthlyClosure;
  isClosed: boolean;
}

export interface ImmunizationProgressSummary extends ImmunizationProgressMetrics {
  totalUngets: number;
  closedUngets: number;
  pendingUngets: number;
  /** El consolidado solo es definitivo con todas las UNGET cerradas. */
  isDefinitive: boolean;
}

export interface ImmunizationProgress {
  summary: ImmunizationProgressSummary;
  ungets: ImmunizationUngetProgress[];
}

const emptyMetrics = (): ImmunizationProgressMetrics => ({
  totalIpress: 0,
  preclosedIpress: 0,
  pendingIpress: 0,
  reopenedIpress: 0,
  pendingDistributions: 0,
  pendingReturns: 0,
  observedDistributions: 0,
  observedReturns: 0,
  openIncidents: 0,
  consumoFrascos: 0,
  dosisAplicadas: 0,
  dosisPerdidas: 0,
  factorPerdida: 0,
  bajasFrascos: 0,
  stockFrascos: 0,
  valorizacion: 0,
  expiredLots: 0,
  expiringLots: 0
});

/**
 * Decide si una capa o movimiento pertenece al ámbito de una UNGET.
 *
 * Empareja por `ungetId` y también por código de IPRESS, porque hubo registros antiguos
 * guardados sin `unget_id` (ver `docs/VALIDACION_DATOS_REALES_INMUNIZACIONES.md`).
 */
export const belongsToUngetScope = (
  row: { ungetId?: string; facilityCode?: string },
  ungetId: string,
  facilityCodes: Set<string>
) => row.ungetId === ungetId || (!!row.facilityCode && facilityCodes.has(row.facilityCode));

/** La distribución puede venir de DIRESA hacia la UNGET o de la UNGET hacia sus IPRESS. */
const distributionBelongsToUnget = (batch: ImmunizationDistributionBatch, ungetId: string) =>
  batch.ungetId === ungetId || batch.originUngetId === ungetId || batch.destinationUngetId === ungetId;

const addFactorPerdida = <T extends ImmunizationProgressMetrics>(metrics: T): T => ({
  ...metrics,
  factorPerdida: metrics.dosisAplicadas + metrics.dosisPerdidas > 0
    ? (metrics.dosisPerdidas / (metrics.dosisAplicadas + metrics.dosisPerdidas)) * 100
    : 0
});

const accumulate = (target: ImmunizationProgressMetrics, source: ImmunizationProgressMetrics) => {
  (Object.keys(target) as Array<keyof ImmunizationProgressMetrics>).forEach(key => {
    if (key === "factorPerdida") return;
    target[key] += source[key];
  });
};

export const buildImmunizationProgress = ({
  period,
  ungets,
  facilities,
  closures,
  distributions,
  returns,
  movements,
  stockLayers,
  referenceDate = new Date()
}: ImmunizationProgressInput): ImmunizationProgress => {
  const periodClosures = closures.filter(closure => closure.period === period);
  const periodDistributions = distributions.filter(batch => batch.period === period);
  const periodReturns = returns.filter(batch => batch.period === period);
  const periodMovements = movements.filter(movement => movement.period === period);

  const closureForIpress = (facilityCode: string) =>
    periodClosures.find(closure => closure.ownerType === "IPRESS" && closure.facilityCode === facilityCode);

  // `consumedDoses` viene poblado por el registro de consumo, pero si falta se deriva de
  // la presentación del producto para no reportar cero dosis perdidas por omisión.
  const dosisUnidadByProduct = new Map<string, number>();
  stockLayers.forEach(layer => {
    const dosisUnidad = Number(layer.product?.dosisUnidad) || 0;
    if (dosisUnidad > 0) dosisUnidadByProduct.set(layer.productId, dosisUnidad);
  });

  const consumedDosesFor = (movement: ImmunizationStockMovement) => {
    const stored = Number(movement.consumedDoses) || 0;
    if (stored > 0) return stored;
    const dosisUnidad = dosisUnidadByProduct.get(movement.productId) || 0;
    return Math.abs(movement.quantityDelta || 0) * dosisUnidad;
  };

  const ungetRows: ImmunizationUngetProgress[] = ungets.map(unget => {
    const scopedFacilities = facilities.filter(facility => facility.ungetId === unget.id);
    const facilityCodes = new Set(scopedFacilities.map(facility => facility.code));
    const closure = periodClosures.find(row => row.ownerType === "UNGET" && row.ungetId === unget.id);

    const belongsToScope = (row: { ungetId?: string; facilityCode?: string }) =>
      belongsToUngetScope(row, unget.id, facilityCodes);

    const scopedMovements = periodMovements.filter(belongsToScope);
    const scopedLayers = stockLayers.filter(belongsToScope);

    const consumptionMovements = scopedMovements.filter(movement => movement.movementType === "IPRESS_CONSUMPTION");
    const dosisAplicadas = consumptionMovements.reduce((sum, movement) => sum + (movement.dosesApplied || 0), 0);
    const consumoFrascos = consumptionMovements.reduce((sum, movement) => sum + Math.abs(movement.quantityDelta || 0), 0);
    const consumoDosis = consumptionMovements.reduce((sum, movement) => sum + consumedDosesFor(movement), 0);

    const bajasFrascos = scopedMovements
      .filter(movement => ["IPRESS_DISPOSAL_OUT", "IPRESS_RETURN_OUT", "IPRESS_TRANSFER_OUT"].includes(movement.movementType))
      .reduce((sum, movement) => sum + Math.abs(movement.quantityDelta || 0), 0);

    const ungetDistributions = periodDistributions.filter(batch => distributionBelongsToUnget(batch, unget.id));
    const ungetReturns = periodReturns.filter(batch => batch.originUngetId === unget.id);

    const observedDistributions = ungetDistributions.filter(batch => batch.status === "OBSERVED").length;
    const observedReturns = ungetReturns.filter(batch => batch.status === "OBSERVED").length;

    const expirationKeys = scopedLayers
      .filter(layer => layer.currentQuantity > 0)
      .map(layer => expirationKeyFor(layer.expirationDate, referenceDate));

    const metrics: ImmunizationProgressMetrics = addFactorPerdida({
      totalIpress: scopedFacilities.length,
      preclosedIpress: scopedFacilities.filter(facility => closureIsIpressReady(closureForIpress(facility.code))).length,
      pendingIpress: scopedFacilities.filter(facility => !closureIsIpressReady(closureForIpress(facility.code))).length,
      reopenedIpress: scopedFacilities.filter(facility => closureIsReopened(closureForIpress(facility.code))).length,
      pendingDistributions: ungetDistributions.filter(batch => batch.status === "SENT").length,
      pendingReturns: ungetReturns.filter(batch => batch.status === "SENT").length,
      observedDistributions,
      observedReturns,
      openIncidents: observedDistributions + observedReturns,
      consumoFrascos,
      dosisAplicadas,
      dosisPerdidas: Math.max(consumoDosis - dosisAplicadas, 0),
      factorPerdida: 0,
      bajasFrascos,
      stockFrascos: scopedLayers.reduce((sum, layer) => sum + layer.currentQuantity, 0),
      valorizacion: scopedLayers.reduce((sum, layer) => sum + layer.currentQuantity * (Number(layer.unitPrice) || 0), 0),
      expiredLots: expirationKeys.filter(key => key === "EXPIRED").length,
      expiringLots: expirationKeys.filter(key => key === "CRITICAL" || key === "UPCOMING").length
    });

    return { ...metrics, unget, closure, isClosed: closureIsUngetClosed(closure) };
  });

  const totals = emptyMetrics();
  ungetRows.forEach(row => accumulate(totals, row));

  const closedUngets = ungetRows.filter(row => row.isClosed).length;

  return {
    ungets: ungetRows,
    summary: {
      ...addFactorPerdida(totals),
      totalUngets: ungetRows.length,
      closedUngets,
      pendingUngets: ungetRows.length - closedUngets,
      isDefinitive: ungetRows.length > 0 && closedUngets === ungetRows.length
    }
  };
};
