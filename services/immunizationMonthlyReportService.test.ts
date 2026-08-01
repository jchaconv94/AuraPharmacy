import { describe, expect, it } from "vitest";
import {
  buildImmunizationDiresaNetworkReportRows,
  buildImmunizationDiresaWarehouseReportRows,
  buildImmunizationUngetNetworkReportRows,
  buildImmunizationUngetWarehouseReportRows,
  buildMonthlyReportWorkbook,
  ImmunizationMonthlyReportOptions
} from "./immunizationMonthlyReportService";
import { ImmunizationProduct, ImmunizationStockLayer, ImmunizationStockMovement } from "../types";

const PERIOD = "2026-07";
const UNGET_ID = "unget-bellavista";
const PRODUCT_ID = "prod-bcg";

const product: ImmunizationProduct = {
  id: PRODUCT_ID,
  codigoSismed: "54003",
  descripcion: "VACUNA ANTITUBERCULOSA (BCG) - INYECTABLE - 20 DOSIS",
  tipoProducto: "VACUNA",
  dosisUnidad: 20,
  isActive: true
};

/** Una sola combinación producto/lote, en dos capas: almacén UNGET e IPRESS. */
const layerBase = {
  productId: PRODUCT_ID,
  product,
  lote: "0374MA05",
  expirationDate: "2026-10-31",
  unitPrice: 12,
  fundingSource: "RO",
  supplyType: "REGULAR",
  isActive: true
};

const warehouseLayer: ImmunizationStockLayer = {
  ...layerBase,
  id: "layer-almacen",
  ownerType: "UNGET",
  ungetId: UNGET_ID,
  currentQuantity: 150
};

const ipressLayer: ImmunizationStockLayer = {
  ...layerBase,
  id: "layer-ipress",
  ownerType: "IPRESS",
  ungetId: UNGET_ID,
  facilityCode: "000123",
  currentQuantity: 320
};

const movement = (
  overrides: Partial<ImmunizationStockMovement> & Pick<ImmunizationStockMovement, "movementType" | "ownerType" | "stockLayerId" | "quantityDelta" | "quantityBefore" | "quantityAfter">
): ImmunizationStockMovement => ({
  productId: PRODUCT_ID,
  ungetId: UNGET_ID,
  period: PERIOD,
  createdAt: "2026-07-10T10:00:00.000Z",
  ...overrides
});

/**
 * Escenario del mes, con saldos iniciales almacén 150 / IPRESS 320:
 *
 * - DIRESA entrega 400 al almacén                    -> ingreso real de la red
 * - el almacén distribuye 220 a la IPRESS            -> traslado interno
 * - la IPRESS consume 95 (1775 dosis aplicadas)      -> salida real
 * - la IPRESS devuelve 10 al almacén                 -> traslado interno
 * - la IPRESS da de baja 4 no disponibles            -> salida real
 * - el almacén pierde 2 por deterioro                -> salida real
 */
const movements: ImmunizationStockMovement[] = [
  movement({ movementType: "UNGET_DISTRIBUTION_IN", ownerType: "UNGET", stockLayerId: warehouseLayer.id, quantityDelta: 400, quantityBefore: 150, quantityAfter: 550, createdAt: "2026-07-02T10:00:00.000Z" }),
  movement({ movementType: "UNGET_DISTRIBUTION_OUT", ownerType: "UNGET", stockLayerId: warehouseLayer.id, quantityDelta: -220, quantityBefore: 550, quantityAfter: 330, createdAt: "2026-07-05T10:00:00.000Z" }),
  movement({ movementType: "IPRESS_DISTRIBUTION_IN", ownerType: "IPRESS", facilityCode: "000123", stockLayerId: ipressLayer.id, quantityDelta: 220, quantityBefore: 320, quantityAfter: 540, createdAt: "2026-07-06T10:00:00.000Z" }),
  movement({ movementType: "IPRESS_CONSUMPTION", ownerType: "IPRESS", facilityCode: "000123", stockLayerId: ipressLayer.id, quantityDelta: -95, quantityBefore: 540, quantityAfter: 445, dosesApplied: 1775, createdAt: "2026-07-12T10:00:00.000Z" }),
  movement({ movementType: "IPRESS_RETURN_OUT", ownerType: "IPRESS", facilityCode: "000123", stockLayerId: ipressLayer.id, quantityDelta: -10, quantityBefore: 445, quantityAfter: 435, createdAt: "2026-07-18T10:00:00.000Z" }),
  movement({ movementType: "UNGET_RETURN_IN", ownerType: "UNGET", stockLayerId: warehouseLayer.id, quantityDelta: 10, quantityBefore: 330, quantityAfter: 340, createdAt: "2026-07-19T10:00:00.000Z" }),
  movement({ movementType: "IPRESS_DISPOSAL_OUT", ownerType: "IPRESS", facilityCode: "000123", stockLayerId: ipressLayer.id, quantityDelta: -4, quantityBefore: 435, quantityAfter: 431, createdAt: "2026-07-20T10:00:00.000Z" }),
  movement({ movementType: "STOCK_ADJUSTMENT", ownerType: "UNGET", stockLayerId: warehouseLayer.id, quantityDelta: -2, quantityBefore: 340, quantityAfter: 338, reason: "Deterioro", createdAt: "2026-07-22T10:00:00.000Z" })
];

const options: ImmunizationMonthlyReportOptions = {
  period: PERIOD,
  ownerName: "UNGET Bellavista",
  scopeLabel: "UNGET",
  stockLayers: [{ ...warehouseLayer, currentQuantity: 338 }, { ...ipressLayer, currentQuantity: 431 }],
  movements
};

describe("movimiento biológico del almacén UNGET", () => {
  const [row] = buildImmunizationUngetWarehouseReportRows(options);

  it("toma como salida principal la distribución a IPRESS, no el consumo", () => {
    expect(row.consumoFrascos).toBe(220);
    expect(row.consumoDosis).toBe(220 * 20);
  });

  it("cuadra saldo anterior + ingresos - salidas", () => {
    expect(row.saldoAnterior).toBe(150);
    // 400 desde DIRESA + 10 devueltos por la IPRESS.
    expect(row.ingresoMes).toBe(410);
    expect(row.totalDisponible).toBe(560);
    expect(row.noDisponibleTransferido).toBe(2);
    expect(row.totalMovimiento).toBe(222);
    expect(row.saldoEess).toBe(338);
  });

  it("deja vacías las columnas de dosis porque el almacén no aplica dosis", () => {
    expect(row.dosisAplicadas).toBeNull();
    expect(row.dosisPerdidas).toBeNull();
    expect(row.factorPerdida).toBeNull();
  });
});

describe("movimiento biológico consolidado de la red UNGET", () => {
  const [row] = buildImmunizationUngetNetworkReportRows(options);

  it("suma el saldo anterior de almacén e IPRESS en una sola fila", () => {
    expect(row.saldoAnterior).toBe(150 + 320);
  });

  it("cuenta como ingreso solo lo recibido desde DIRESA", () => {
    // Ni la distribución a IPRESS ni la devolución al almacén inflan el ingreso.
    expect(row.ingresoMes).toBe(400);
    expect(row.totalDisponible).toBe(870);
  });

  it("anula los traslados internos en el movimiento del mes", () => {
    expect(row.consumoFrascos).toBe(95);
    // Solo la baja no disponible de la IPRESS y el deterioro del almacén.
    expect(row.noDisponibleTransferido).toBe(6);
    expect(row.totalMovimiento).toBe(101);
  });

  it("cierra con el stock real de toda la red", () => {
    expect(row.saldoEess).toBe(769);
    expect(row.saldoEess).toBe(338 + 431);
    expect(row.saldoTotalDosis).toBe(769 * 20);
  });

  it("calcula el factor de pérdida real de la red", () => {
    expect(row.dosisAplicadas).toBe(1775);
    expect(row.dosisPerdidas).toBe(95 * 20 - 1775);
    expect(row.factorPerdida).toBeCloseTo((125 / 1900) * 100, 4);
  });
});

/**
 * ExcelJS trata un array literal como contiguo 0-based: un `undefined` inicial no se
 * salta, corre todo una columna. Estas pruebas fijan la posición real de las celdas.
 */
describe("alineación de columnas en el Excel", () => {
  it("escribe la primera fila de datos desde la columna A", async () => {
    const workbook = await buildMonthlyReportWorkbook(options, "UNGET_WAREHOUSE");
    const sheet = workbook.worksheets[0];
    const [row] = buildImmunizationUngetWarehouseReportRows(options);

    expect(sheet.getCell("A6").value).toBe(row.codigoSismed);
    expect(sheet.getCell("B6").value).toBe(row.descripcion);
    expect(sheet.getCell("C6").value).toBe(row.dosisUnidad);
    expect(sheet.getCell("D6").value).toBe(row.saldoAnterior);
    expect(sheet.getCell("E6").value).toBe(row.lote);
    expect(sheet.getCell("G6").value).toBe(row.ingresoMes);
    expect(sheet.getCell("J6").value).toBe(row.consumoFrascos);
    expect(sheet.getCell("S6").value).toBe(row.observacion);
  });

  it("alinea las cabeceras de la fila 5 con los datos", async () => {
    const workbook = await buildMonthlyReportWorkbook(options, "UNGET_WAREHOUSE");
    const sheet = workbook.worksheets[0];

    // (b) saldo anterior en D, primera subcolumna del bloque combinado D4:I4.
    expect(String(sheet.getCell("D5").value)).toContain("SALDO ALMACÉN");
    expect(sheet.getCell("E5").value).toBe("N° LOTE");
    expect(String(sheet.getCell("J5").value)).toContain("DISTRIBUCIÓN");
  });

  it("resuelve las fórmulas contra las columnas correctas", async () => {
    const workbook = await buildMonthlyReportWorkbook(options, "UNGET_WAREHOUSE");
    const sheet = workbook.worksheets[0];
    const [row] = buildImmunizationUngetWarehouseReportRows(options);

    // (d=b+c): saldo anterior en D más ingreso en G.
    const totalDisponible = sheet.getCell("I6").value as { formula: string; result: number };
    expect(totalDisponible.formula).toBe("D6+G6");
    expect(totalDisponible.result).toBe(row.totalDisponible);
  });

  it("deja vacías las celdas de dosis en el reporte de almacén", async () => {
    const workbook = await buildMonthlyReportWorkbook(options, "UNGET_WAREHOUSE");
    const sheet = workbook.worksheets[0];

    expect(sheet.getCell("N6").value).toBe("");
    expect(sheet.getCell("O6").value).toBe("");
    expect(sheet.getCell("P6").value).toBe("");
  });
});

describe("relación entre los dos reportes UNGET", () => {
  it("permite deducir el saldo de las IPRESS restando el almacén del consolidado", () => {
    // Por eso el consolidado no necesita un anexo por establecimiento: el saldo del
    // almacén sale de su propio reporte y cada IPRESS emite su movimiento biológico.
    const [warehouse] = buildImmunizationUngetWarehouseReportRows(options);
    const [network] = buildImmunizationUngetNetworkReportRows(options);
    expect(network.saldoEess - warehouse.saldoEess).toBe(431);
  });
});

/**
 * Escenario regional: se añade el almacén DIRESA por encima de la misma UNGET.
 *
 * - nivel central entrega 500 al almacén regional  -> único ingreso real de la región
 * - DIRESA distribuye 400 a la UNGET               -> traslado interno de la región
 * - el resto de movimientos son los del escenario UNGET de arriba
 */
const diresaLayer: ImmunizationStockLayer = {
  ...layerBase,
  id: "layer-regional",
  ownerType: "DIRESA",
  currentQuantity: 100
};

const regionalMovements: ImmunizationStockMovement[] = [
  movement({ movementType: "DIRESA_INCOME", ownerType: "DIRESA", stockLayerId: diresaLayer.id, quantityDelta: 500, quantityBefore: 0, quantityAfter: 500, createdAt: "2026-07-01T10:00:00.000Z" }),
  movement({ movementType: "DIRESA_DISTRIBUTION_OUT", ownerType: "DIRESA", stockLayerId: diresaLayer.id, quantityDelta: -400, quantityBefore: 500, quantityAfter: 100, createdAt: "2026-07-02T09:00:00.000Z" }),
  ...movements
];

const regionalOptions: ImmunizationMonthlyReportOptions = {
  period: PERIOD,
  ownerName: "DIRESA SAN MARTÍN",
  scopeLabel: "REGIONAL",
  stockLayers: [diresaLayer, ...options.stockLayers],
  movements: regionalMovements
};

describe("movimiento biológico del almacén regional DIRESA", () => {
  const [row] = buildImmunizationDiresaWarehouseReportRows(regionalOptions);

  it("toma como salida la distribución a las UNGET", () => {
    expect(row.consumoFrascos).toBe(400);
  });

  it("cuadra el saldo del almacén regional", () => {
    expect(row.saldoAnterior).toBe(0);
    expect(row.ingresoMes).toBe(500);
    expect(row.saldoEess).toBe(100);
  });

  it("no reporta dosis porque el almacén regional no las aplica", () => {
    expect(row.dosisAplicadas).toBeNull();
    expect(row.factorPerdida).toBeNull();
  });
});

describe("movimiento biológico consolidado regional", () => {
  const [row] = buildImmunizationDiresaNetworkReportRows(regionalOptions);

  it("cuenta como ingreso solo lo que entra a la región desde fuera", () => {
    // Los 400 de DIRESA a la UNGET y los 220 de la UNGET a la IPRESS son internos.
    expect(row.ingresoMes).toBe(500);
  });

  it("mantiene el consumo y las pérdidas reales de la región", () => {
    expect(row.consumoFrascos).toBe(95);
    expect(row.noDisponibleTransferido).toBe(6);
    expect(row.totalMovimiento).toBe(101);
  });

  it("cierra con el stock real de toda la región", () => {
    // 100 almacén regional + 338 almacén UNGET + 431 IPRESS.
    expect(row.saldoEess).toBe(869);
    expect(row.saldoEess).toBe(100 + 338 + 431);
  });

  it("no infla el movimiento con las distribuciones internas", () => {
    const [ungetRow] = buildImmunizationUngetNetworkReportRows(options);
    // La región mueve exactamente lo mismo que la red UNGET: los traslados no cuentan.
    expect(row.totalMovimiento).toBe(ungetRow.totalMovimiento);
  });
});

describe("marcado preliminar del consolidado regional", () => {
  it("antepone PRELIMINAR al nombre del archivo y al título", async () => {
    const workbook = await buildMonthlyReportWorkbook(
      { ...regionalOptions, isPreliminary: true, preliminaryReason: "faltan 2 UNGET por cerrar el periodo." },
      "DIRESA_NETWORK"
    );
    const sheet = workbook.worksheets[0];
    expect(String(sheet.getCell("A1").value)).toContain("PRELIMINAR");
    expect(String(sheet.getCell("A3").value)).toContain("faltan 2 UNGET");
  });

  it("no marca nada cuando el periodo está cerrado en toda la región", async () => {
    const workbook = await buildMonthlyReportWorkbook(regionalOptions, "DIRESA_NETWORK");
    const sheet = workbook.worksheets[0];
    expect(String(sheet.getCell("A1").value)).not.toContain("PRELIMINAR");
  });
});
