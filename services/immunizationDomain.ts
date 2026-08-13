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

/**
 * Genera la clave única concatenada que identifica de forma unívoca a un producto/capa:
 * Código SISMED (o productId) + Lote + Fecha Vencimiento + Precio Unitario + Fuente Financiamiento + Tipo Suministro.
 * Todos estos datos unidos hacen un código único para poder identificar a un producto sin duplicidades.
 */
export const getItemUniqueCompositeKey = (item: {
  productId?: string;
  codigoSismedSnapshot?: string;
  codigoSismed?: string;
  lote: string;
  expirationDate: string;
  unitPrice: number;
  fundingSource: string;
  supplyType: string;
}): string => {
  const code = (item.codigoSismedSnapshot || item.codigoSismed || item.productId || "").trim().toUpperCase();
  const lot = (item.lote || "").trim().toUpperCase();
  const exp = (item.expirationDate || "").trim();
  const price = Number(item.unitPrice || 0).toFixed(2);
  const source = (item.fundingSource || "").trim().toUpperCase();
  const supply = (item.supplyType || "").trim().toUpperCase();
  return `${code}|${lot}|${exp}|${price}|${source}|${supply}`;
};

/**
 * Consolida (agrupa y suma) una lista de ítems de inventario o ingreso que compartan
 * la misma clave única concatenada. Si existen varios registros idénticos, se fusionan
 * en uno solo acumulando sus saldos (cantidades).
 */
export const consolidateItemsByCompositeKey = <
  T extends {
    productId?: string;
    codigoSismedSnapshot?: string;
    codigoSismed?: string;
    lote: string;
    expirationDate: string;
    quantity: number;
    unitPrice: number;
    fundingSource: string;
    supplyType: string;
    observation?: string;
  }
>(items: T[]): T[] => {
  const map = new Map<string, T>();
  for (const item of items) {
    const key = getItemUniqueCompositeKey(item);
    const existing = map.get(key);
    if (existing) {
      const combinedObservation = [existing.observation, item.observation]
        .filter(Boolean)
        .filter((obs, index, self) => self.indexOf(obs) === index)
        .join("; ");
      map.set(key, {
        ...existing,
        quantity: Number(existing.quantity || 0) + Number(item.quantity || 0),
        observation: combinedObservation || undefined
      });
    } else {
      map.set(key, { ...item });
    }
  }
  return Array.from(map.values());
};

