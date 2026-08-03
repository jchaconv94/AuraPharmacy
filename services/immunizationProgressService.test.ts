import { describe, expect, it } from "vitest";
import { belongsToUngetScope, buildImmunizationProgress, expirationKeyFor } from "./immunizationProgressService";
import {
  HealthFacility,
  ImmunizationDistributionBatch,
  ImmunizationMonthlyClosure,
  ImmunizationProduct,
  ImmunizationReturnBatch,
  ImmunizationStockLayer,
  ImmunizationStockMovement,
  Unget
} from "../types";

const PERIOD = "2026-07";
const UNGET_A = "unget-a";
const UNGET_B = "unget-b";
const REFERENCE = new Date("2026-07-31T00:00:00.000Z");

const product: ImmunizationProduct = {
  id: "prod-bcg",
  codigoSismed: "54003",
  descripcion: "VACUNA BCG",
  tipoProducto: "VACUNA",
  dosisUnidad: 20,
  isActive: true
};

const ungets = [
  { id: UNGET_A, name: "UNGET Bellavista" },
  { id: UNGET_B, name: "UNGET Picota" }
] as Unget[];

const facilities = [
  { code: "001", name: "C.S. Uno", ungetId: UNGET_A },
  { code: "002", name: "P.S. Dos", ungetId: UNGET_A },
  { code: "003", name: "C.S. Tres", ungetId: UNGET_B }
] as HealthFacility[];

/** UNGET A cerrada con sus dos IPRESS precerradas; UNGET B abierta y sin precerrar. */
const closures: ImmunizationMonthlyClosure[] = [
  { ownerType: "UNGET", period: PERIOD, ungetId: UNGET_A, status: "FINAL_CLOSED" },
  { ownerType: "IPRESS", period: PERIOD, ungetId: UNGET_A, facilityCode: "001", status: "PRE_CLOSED" },
  { ownerType: "IPRESS", period: PERIOD, ungetId: UNGET_A, facilityCode: "002", status: "PRE_CLOSED" },
  { ownerType: "IPRESS", period: "2026-06", ungetId: UNGET_B, facilityCode: "003", status: "PRE_CLOSED" }
] as ImmunizationMonthlyClosure[];

const distributions = [
  { ungetId: UNGET_A, period: PERIOD, status: "RECEIVED" },
  { ungetId: UNGET_B, period: PERIOD, status: "SENT" },
  { ungetId: UNGET_B, period: PERIOD, status: "OBSERVED" },
  { ungetId: UNGET_B, period: "2026-06", status: "SENT" }
] as ImmunizationDistributionBatch[];

const returns = [
  { originUngetId: UNGET_A, period: PERIOD, status: "OBSERVED" },
  { originUngetId: UNGET_B, period: PERIOD, status: "SENT" }
] as ImmunizationReturnBatch[];

const layer = (id: string, ungetId: string, facilityCode: string, quantity: number, expiration: string): ImmunizationStockLayer => ({
  id,
  ownerType: "IPRESS",
  ungetId,
  facilityCode,
  productId: product.id as string,
  product,
  lote: `L-${id}`,
  expirationDate: expiration,
  unitPrice: 10,
  fundingSource: "RO",
  supplyType: "REGULAR",
  currentQuantity: quantity,
  isActive: quantity > 0
});

const stockLayers = [
  layer("l1", UNGET_A, "001", 100, "2027-12-31"),
  layer("l2", UNGET_A, "002", 50, "2026-07-01"),
  layer("l3", UNGET_B, "003", 30, "2026-08-15")
];

const consumption = (
  ungetId: string,
  facilityCode: string,
  frascos: number,
  consumedDoses: number | undefined,
  dosesApplied: number
): ImmunizationStockMovement => ({
  movementType: "IPRESS_CONSUMPTION",
  ownerType: "IPRESS",
  ungetId,
  facilityCode,
  productId: product.id as string,
  quantityDelta: -frascos,
  quantityBefore: frascos,
  quantityAfter: 0,
  period: PERIOD,
  consumedDoses,
  dosesApplied
});

const movements: ImmunizationStockMovement[] = [
  consumption(UNGET_A, "001", 3, 60, 50),
  // Fila antigua sin `consumedDoses`: debe derivarse de la presentación (2 x 20 = 40).
  consumption(UNGET_A, "002", 2, undefined, 30),
  consumption(UNGET_B, "003", 1, 20, 20),
  {
    movementType: "IPRESS_DISPOSAL_OUT",
    ownerType: "IPRESS",
    ungetId: UNGET_A,
    facilityCode: "001",
    productId: product.id as string,
    quantityDelta: -4,
    quantityBefore: 104,
    quantityAfter: 100,
    period: PERIOD
  }
];

const progress = buildImmunizationProgress({
  period: PERIOD,
  ungets,
  facilities,
  closures,
  distributions,
  returns,
  movements,
  stockLayers,
  referenceDate: REFERENCE
});

const ungetA = progress.ungets.find(row => row.unget.id === UNGET_A)!;
const ungetB = progress.ungets.find(row => row.unget.id === UNGET_B)!;

describe("avance de cierres", () => {
  it("cuenta las IPRESS precerradas de cada UNGET", () => {
    expect(ungetA.totalIpress).toBe(2);
    expect(ungetA.preclosedIpress).toBe(2);
    expect(ungetB.pendingIpress).toBe(1);
  });

  it("ignora los cierres de otros periodos", () => {
    // La IPRESS 003 precerró junio, no julio.
    expect(ungetB.preclosedIpress).toBe(0);
  });

  it("marca definitivo solo con todas las UNGET cerradas", () => {
    expect(ungetA.isClosed).toBe(true);
    expect(ungetB.isClosed).toBe(false);
    expect(progress.summary.closedUngets).toBe(1);
    expect(progress.summary.pendingUngets).toBe(1);
    expect(progress.summary.isDefinitive).toBe(false);
  });
});

describe("pendientes e incidencias", () => {
  it("separa lo pendiente de recepción de lo observado", () => {
    expect(ungetB.pendingDistributions).toBe(1);
    expect(ungetB.observedDistributions).toBe(1);
    expect(ungetB.pendingReturns).toBe(1);
  });

  it("suma las incidencias abiertas de distribuciones y devoluciones", () => {
    expect(ungetA.openIncidents).toBe(1);
    expect(ungetB.openIncidents).toBe(1);
    expect(progress.summary.openIncidents).toBe(2);
  });

  it("no cuenta lotes de periodos anteriores", () => {
    expect(progress.summary.pendingDistributions).toBe(1);
  });
});

describe("consumo y factor de pérdida", () => {
  it("deriva las dosis consumidas cuando el movimiento no las trae", () => {
    // 60 dosis de la primera IPRESS + 40 derivadas de la segunda.
    expect(ungetA.dosisAplicadas).toBe(80);
    expect(ungetA.dosisPerdidas).toBe(20);
  });

  it("calcula el factor de pérdida sobre las dosis consumidas", () => {
    expect(ungetA.factorPerdida).toBeCloseTo(20, 4);
    expect(ungetB.factorPerdida).toBe(0);
  });

  it("consolida el factor de la región sin promediar porcentajes", () => {
    // 20 perdidas sobre 120 consumidas en total, no el promedio de 20% y 0%.
    expect(progress.summary.dosisAplicadas).toBe(100);
    expect(progress.summary.dosisPerdidas).toBe(20);
    expect(progress.summary.factorPerdida).toBeCloseTo((20 / 120) * 100, 4);
  });

  it("suma las bajas y devoluciones del periodo", () => {
    expect(ungetA.bajasFrascos).toBe(4);
  });
});

describe("alcance de una UNGET", () => {
  const codes = new Set(["001", "002"]);

  it("empareja por unget_id", () => {
    expect(belongsToUngetScope({ ungetId: UNGET_A }, UNGET_A, codes)).toBe(true);
    expect(belongsToUngetScope({ ungetId: UNGET_B }, UNGET_A, codes)).toBe(false);
  });

  it("rescata registros antiguos sin unget_id usando el código de IPRESS", () => {
    expect(belongsToUngetScope({ facilityCode: "001" }, UNGET_A, codes)).toBe(true);
    expect(belongsToUngetScope({ facilityCode: "003" }, UNGET_A, codes)).toBe(false);
  });

  it("no arrastra registros sin ninguna referencia", () => {
    expect(belongsToUngetScope({}, UNGET_A, codes)).toBe(false);
  });
});

describe("stock y vencimientos", () => {
  it("valoriza el stock por capa", () => {
    expect(progress.summary.stockFrascos).toBe(180);
    expect(progress.summary.valorizacion).toBe(1800);
  });

  it("clasifica vencidos y próximos a vencer con los umbrales del stock", () => {
    expect(expirationKeyFor("2026-07-01", REFERENCE)).toBe("EXPIRED");
    expect(expirationKeyFor("2026-08-15", REFERENCE)).toBe("CRITICAL");
    expect(expirationKeyFor("2026-10-15", REFERENCE)).toBe("UPCOMING");
    expect(expirationKeyFor("2027-12-31", REFERENCE)).toBe("VALID");
    expect(progress.summary.expiredLots).toBe(1);
    expect(progress.summary.expiringLots).toBe(1);
  });
});
