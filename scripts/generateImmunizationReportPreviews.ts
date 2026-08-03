/**
 * Genera PDF y Excel de muestra de las tres variantes del movimiento biológico mensual.
 *
 * Usa los mismos builders que la aplicación, así que lo que sale aquí es exactamente lo
 * que descarga el usuario. Ejecutar con:
 *
 *   npx vite-node scripts/generateImmunizationReportPreviews.ts
 *
 * Salida en `reportes-ejemplo/`.
 */
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import {
  buildMonthlyReportPdfDoc,
  buildMonthlyReportWorkbook,
  ImmunizationMonthlyReportOptions,
  ImmunizationReportVariant
} from "../services/immunizationMonthlyReportService";
import { ImmunizationProduct, ImmunizationStockLayer, ImmunizationStockMovement } from "../types";

// La carga de la fuente Unicode usa `fetch` sobre una URL de asset. Fuera del navegador
// esa URL es `file://`, que el fetch de Node no soporta: lo resolvemos desde disco.
const originalFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (url.startsWith("file://")) {
    const buffer = fs.readFileSync(fileURLToPath(url));
    return {
      ok: true,
      arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
    } as Response;
  }
  return originalFetch(input, init);
}) as typeof fetch;

const PERIOD = "2026-07";
const UNGET_ID = "unget-bellavista";
const IPRESS_A = "000123";
const IPRESS_B = "000456";

const products: Record<string, ImmunizationProduct> = {
  bcg: {
    id: "prod-bcg",
    codigoSismed: "54003",
    descripcion: "VACUNA ANTITUBERCULOSA (BCG) - INYECTABLE - 20 DOSIS",
    tipoProducto: "VACUNA",
    dosisUnidad: 20,
    isActive: true
  },
  spr: {
    id: "prod-spr",
    codigoSismed: "54127",
    descripcion: "VACUNA SPR (SARAMPION, PAPERAS, RUBEOLA) - INYECTABLE - 10 DOSIS",
    tipoProducto: "VACUNA",
    dosisUnidad: 10,
    isActive: true
  },
  jeringa: {
    id: "prod-jeringa",
    codigoSismed: "55001",
    descripcion: "JERINGA DESCARTABLE 1 ML CON AGUJA",
    tipoProducto: "JERINGA",
    dosisUnidad: 1,
    isActive: true
  }
};

let layerSeq = 0;
const stockLayers: ImmunizationStockLayer[] = [];
const movements: ImmunizationStockMovement[] = [];

const addLayer = (
  product: ImmunizationProduct,
  ownerType: "DIRESA" | "UNGET" | "IPRESS",
  lote: string,
  expirationDate: string,
  currentQuantity: number,
  facilityCode?: string,
  unitPrice = 12.5
): ImmunizationStockLayer => {
  layerSeq += 1;
  const layer: ImmunizationStockLayer = {
    id: `layer-${layerSeq}`,
    ownerType,
    ungetId: UNGET_ID,
    facilityCode,
    productId: product.id as string,
    product,
    lote,
    expirationDate,
    unitPrice,
    fundingSource: "RO",
    supplyType: "REGULAR",
    currentQuantity,
    isActive: true
  };
  stockLayers.push(layer);
  return layer;
};

let movementSeq = 0;
const addMovement = (
  layer: ImmunizationStockLayer,
  movementType: string,
  quantityDelta: number,
  quantityBefore: number,
  day: string,
  extra: Partial<ImmunizationStockMovement> = {}
) => {
  movementSeq += 1;
  movements.push({
    id: `mov-${movementSeq}`,
    movementType,
    ownerType: layer.ownerType,
    ungetId: UNGET_ID,
    facilityCode: layer.facilityCode,
    productId: layer.productId,
    stockLayerId: layer.id,
    quantityDelta,
    quantityBefore,
    quantityAfter: quantityBefore + quantityDelta,
    period: PERIOD,
    createdAt: `2026-07-${day}T10:00:00.000Z`,
    ...extra
  });
};

// --- BCG lote 0374MA05 -------------------------------------------------------
const bcgWarehouse = addLayer(products.bcg, "UNGET", "0374MA05", "2026-10-31", 0);
const bcgIpressA = addLayer(products.bcg, "IPRESS", "0374MA05", "2026-10-31", 0, IPRESS_A);
const bcgIpressB = addLayer(products.bcg, "IPRESS", "0374MA05", "2026-10-31", 0, IPRESS_B);

addMovement(bcgWarehouse, "UNGET_DISTRIBUTION_IN", 400, 150, "02", { reason: "Recepción conforme de DIRESA" });
addMovement(bcgWarehouse, "UNGET_DISTRIBUTION_OUT", -140, 550, "05");
addMovement(bcgIpressA, "IPRESS_DISTRIBUTION_IN", 140, 200, "06");
addMovement(bcgWarehouse, "UNGET_DISTRIBUTION_OUT", -80, 410, "07");
addMovement(bcgIpressB, "IPRESS_DISTRIBUTION_IN", 80, 120, "08");
addMovement(bcgIpressA, "IPRESS_CONSUMPTION", -60, 340, "12", { dosesApplied: 1140 });
addMovement(bcgIpressB, "IPRESS_CONSUMPTION", -35, 200, "14", { dosesApplied: 635 });
addMovement(bcgIpressA, "IPRESS_RETURN_OUT", -10, 280, "18", { reason: "Transferencia", observation: "Reasignación por baja demanda" });
addMovement(bcgWarehouse, "UNGET_RETURN_IN", 10, 330, "19", { reason: "Recepción conforme de IPRESS" });
addMovement(bcgIpressB, "IPRESS_DISPOSAL_OUT", -4, 165, "20", { reason: "Deteriorado" });
addMovement(bcgWarehouse, "STOCK_ADJUSTMENT", -2, 340, "22", { reason: "Vencido en almacén" });

bcgWarehouse.currentQuantity = 338;
bcgIpressA.currentQuantity = 270;
bcgIpressB.currentQuantity = 161;

// --- SPR lote SPR-2609, sin movimiento de IPRESS ------------------------------
const sprWarehouse = addLayer(products.spr, "UNGET", "SPR-2609", "2027-03-15", 0, undefined, 21.4);
const sprIpressA = addLayer(products.spr, "IPRESS", "SPR-2609", "2027-03-15", 0, IPRESS_A, 21.4);

addMovement(sprWarehouse, "UNGET_DISTRIBUTION_IN", 260, 90, "03", { reason: "Recepción conforme de DIRESA" });
addMovement(sprWarehouse, "UNGET_DISTRIBUTION_OUT", -120, 350, "09");
addMovement(sprIpressA, "IPRESS_DISTRIBUTION_IN", 120, 60, "10");
addMovement(sprIpressA, "IPRESS_CONSUMPTION", -48, 180, "16", { dosesApplied: 455 });

sprWarehouse.currentQuantity = 230;
sprIpressA.currentQuantity = 132;

// --- Jeringas ----------------------------------------------------------------
const jeringaWarehouse = addLayer(products.jeringa, "UNGET", "JER-2026-09", "2028-09-30", 0, undefined, 0.35);
const jeringaIpressA = addLayer(products.jeringa, "IPRESS", "JER-2026-09", "2028-09-30", 0, IPRESS_A, 0.35);
const jeringaIpressB = addLayer(products.jeringa, "IPRESS", "JER-2026-09", "2028-09-30", 0, IPRESS_B, 0.35);

addMovement(jeringaWarehouse, "UNGET_DISTRIBUTION_IN", 3000, 1000, "02", { reason: "Recepción conforme de DIRESA" });
addMovement(jeringaWarehouse, "UNGET_DISTRIBUTION_OUT", -1100, 4000, "05");
addMovement(jeringaIpressA, "IPRESS_DISTRIBUTION_IN", 1100, 1500, "06");
addMovement(jeringaWarehouse, "UNGET_DISTRIBUTION_OUT", -700, 2900, "07");
addMovement(jeringaIpressB, "IPRESS_DISTRIBUTION_IN", 700, 1000, "08");
addMovement(jeringaIpressA, "IPRESS_CONSUMPTION", -680, 2600, "15", { dosesApplied: 680 });
addMovement(jeringaIpressB, "IPRESS_CONSUMPTION", -420, 1700, "17", { dosesApplied: 415 });
addMovement(jeringaIpressA, "IPRESS_DISPOSAL_OUT", -10, 1920, "21", { reason: "Ruptura" });

jeringaWarehouse.currentQuantity = 2200;
jeringaIpressA.currentQuantity = 1910;
jeringaIpressB.currentQuantity = 1280;

// --- Almacén regional DIRESA, por encima de la UNGET ------------------------
const bcgRegional = addLayer(products.bcg, "DIRESA", "0374MA05", "2026-10-31", 0);
const jeringaRegional = addLayer(products.jeringa, "DIRESA", "JER-2026-09", "2028-09-30", 0, undefined, 0.35);

addMovement(bcgRegional, "DIRESA_INCOME", 1200, 300, "01", { reason: "Ingreso regional del nivel central" });
addMovement(bcgRegional, "DIRESA_DISTRIBUTION_OUT", -400, 1500, "02");
addMovement(jeringaRegional, "DIRESA_INCOME", 8000, 2000, "01", { reason: "Ingreso regional del nivel central" });
addMovement(jeringaRegional, "DIRESA_DISTRIBUTION_OUT", -3000, 10000, "02");

bcgRegional.currentQuantity = 1100;
jeringaRegional.currentQuantity = 7000;

const facilityNames = {
  [IPRESS_A]: `${IPRESS_A} - C.S. BELLAVISTA`,
  [IPRESS_B]: `${IPRESS_B} - P.S. SAN RAFAEL`
};

const baseOptions: ImmunizationMonthlyReportOptions = {
  period: PERIOD,
  ownerName: "UNGET BELLAVISTA",
  scopeLabel: "UNGET",
  generatedBy: "muestra",
  stockLayers,
  movements
};

/** El reporte IPRESS se muestra desde la óptica de un solo establecimiento. */
const ipressOptions: ImmunizationMonthlyReportOptions = {
  ...baseOptions,
  ownerName: facilityNames[IPRESS_A],
  scopeLabel: "IPRESS",
  stockLayers: stockLayers.filter(layer => layer.facilityCode === IPRESS_A),
  movements: movements.filter(movement => movement.facilityCode === IPRESS_A)
};

/** Los reportes UNGET no ven el almacén regional. */
const ungetOptions: ImmunizationMonthlyReportOptions = {
  ...baseOptions,
  stockLayers: stockLayers.filter(layer => layer.ownerType !== "DIRESA"),
  movements: movements.filter(movement => movement.ownerType !== "DIRESA")
};

const diresaOptions: ImmunizationMonthlyReportOptions = {
  ...baseOptions,
  ownerName: "DIRESA SAN MARTÍN",
  scopeLabel: "REGIONAL"
};

/** Se genera preliminar a propósito, para mostrar cómo se marca el archivo. */
const diresaPreliminaryOptions: ImmunizationMonthlyReportOptions = {
  ...diresaOptions,
  isPreliminary: true,
  preliminaryReason: "faltan 2 UNGET por cerrar el periodo."
};

const previews: { variant: ImmunizationReportVariant; options: ImmunizationMonthlyReportOptions; file: string }[] = [
  { variant: "IPRESS", options: ipressOptions, file: "EJEMPLO_1_MOVIMIENTO_BIOLOGICO_IPRESS" },
  { variant: "UNGET_WAREHOUSE", options: ungetOptions, file: "EJEMPLO_2_MOVIMIENTO_BIOLOGICO_ALMACEN_UNGET" },
  { variant: "UNGET_NETWORK", options: ungetOptions, file: "EJEMPLO_3_MOVIMIENTO_BIOLOGICO_CONSOLIDADO_UNGET" },
  { variant: "DIRESA_WAREHOUSE", options: diresaOptions, file: "EJEMPLO_4_MOVIMIENTO_BIOLOGICO_ALMACEN_REGIONAL" },
  { variant: "DIRESA_NETWORK", options: diresaOptions, file: "EJEMPLO_5_MOVIMIENTO_BIOLOGICO_CONSOLIDADO_REGIONAL" },
  { variant: "DIRESA_NETWORK", options: diresaPreliminaryOptions, file: "EJEMPLO_6_CONSOLIDADO_REGIONAL_PRELIMINAR" }
];

const outDir = "reportes-ejemplo";
fs.mkdirSync(outDir, { recursive: true });

for (const { variant, options, file } of previews) {
  const doc = await buildMonthlyReportPdfDoc(options, variant);
  fs.writeFileSync(`${outDir}/${file}.pdf`, Buffer.from(doc.output("arraybuffer")));

  const workbook = await buildMonthlyReportWorkbook(options, variant);
  await workbook.xlsx.writeFile(`${outDir}/${file}.xlsx`);

  console.log(`${outDir}/${file}  ->  PDF ${doc.getNumberOfPages()} pág.  +  XLSX`);
}
