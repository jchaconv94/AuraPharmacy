import {
  ImmunizationDistributionBatch,
  ImmunizationDistributionFlow,
  ImmunizationStockLayer
} from "../types";
import { getCurrentImmunizationPeriod } from "./immunizationApi";

/**
 * Reglas de negocio de inmunizaciones que usan varias pantallas.
 *
 * Estaban repetidas en los módulos, y una regla repetida es una regla que tarde o
 * temprano se aplica distinto en cada sitio. Aquí no hay nada visual: lo de presentación
 * vive en `components/ui/immunization.tsx`.
 */

/**
 * Orden FEFO: primero lo que vence antes.
 *
 * Es el criterio por defecto para sacar stock. Cuando dos lotes vencen el mismo día se
 * desempata por número de lote, para que el orden sea estable entre pantallas.
 */
export const sortLayersByFefo = (a: ImmunizationStockLayer, b: ImmunizationStockLayer) => {
  const vencimiento = (a.expirationDate || "").localeCompare(b.expirationDate || "");
  if (vencimiento !== 0) return vencimiento;
  return (a.lote || "").localeCompare(b.lote || "");
};

/** El periodo `YYYY-MM` de una fecha; si no es una fecha válida, el periodo en curso. */
export const periodFromDate = (value: string) =>
  /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value) ? value.slice(0, 7) : getCurrentImmunizationPeriod();

/**
 * Sentido de una distribución.
 *
 * Los registros anteriores al refactor regional no traen `flowType`, así que se deduce
 * del destino: si va a una UNGET, viene de DIRESA.
 */
export const distributionFlow = (batch: ImmunizationDistributionBatch): ImmunizationDistributionFlow =>
  batch.flowType || (batch.destinationOwnerType === "UNGET" || batch.destinationUngetId ? "DIRESA_UNGET" : "UNGET_IPRESS");

/** UNGET que recibe. En el flujo regional puede venir en `ungetId` por compatibilidad. */
export const distributionDestinationUngetId = (batch: ImmunizationDistributionBatch) =>
  batch.destinationUngetId || (distributionFlow(batch) === "DIRESA_UNGET" ? batch.ungetId : undefined);

/** UNGET que envía. En el flujo hacia IPRESS puede venir en `ungetId` por compatibilidad. */
export const distributionOriginUngetId = (batch: ImmunizationDistributionBatch) =>
  batch.originUngetId || (distributionFlow(batch) === "UNGET_IPRESS" ? batch.ungetId : undefined);
