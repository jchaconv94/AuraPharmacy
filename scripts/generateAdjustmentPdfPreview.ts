import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createImmunizationAdjustmentPdf } from "../services/immunizationAdjustmentPdfService";
import { ImmunizationAdjustment, ImmunizationAdjustmentItem } from "../types";

const adjustment: ImmunizationAdjustment = {
  id: "RAJ-2026-07-000018",
  ownerType: "IPRESS",
  facilityCode: "06520",
  period: "2026-07",
  status: "APPLIED",
  reason: "Diferencia identificada durante el conteo físico mensual",
  observation: "Durante la verificación se encontró un frasco adicional del lote 0374MA05 y dos unidades menos del lote BCG2408. Conteo realizado por el responsable de inmunizaciones y contrastado con el kardex físico.",
  createdBy: "inmunizaciones.ipress",
  createdAt: "2026-07-21T15:45:00-05:00"
};

const items: ImmunizationAdjustmentItem[] = [
  {
    id: "ITEM-1",
    adjustmentId: adjustment.id,
    productId: "PRODUCT-1",
    stockLayerId: "LAYER-1",
    lote: "0374MA05",
    expirationDate: "2026-10-31",
    systemQuantity: 3,
    physicalQuantity: 0,
    differenceQuantity: -3,
    unitPrice: 27.3293,
    fundingSource: "ROR",
    supplyType: "SC",
    operationType: "RECLASSIFY_SOURCE",
    reclassificationKey: "84c7aa2a-f0d5-4cb4-88cf-d69831308a90",
    product: { id: "PRODUCT-1", codigoSismed: "54003", descripcion: "VACUNA ANTITUBERCULOSA (BCG) - INYECTABLE - 20 DOSIS", tipoProducto: "VACUNA", dosisUnidad: 20, isActive: true }
  },
  {
    id: "ITEM-2",
    adjustmentId: adjustment.id,
    productId: "PRODUCT-2",
    lote: "BCG2408-CORR",
    expirationDate: "2027-10-31",
    systemQuantity: 0,
    physicalQuantity: 3,
    differenceQuantity: 3,
    unitPrice: 27.3293,
    fundingSource: "ROR",
    supplyType: "SC",
    operationType: "RECLASSIFY_TARGET",
    reclassificationKey: "84c7aa2a-f0d5-4cb4-88cf-d69831308a90",
    product: { id: "PRODUCT-2", codigoSismed: "54003", descripcion: "VACUNA ANTITUBERCULOSA (BCG) - INYECTABLE - 20 DOSIS", tipoProducto: "VACUNA", dosisUnidad: 20, isActive: true }
  }
];

const outputDirectory = resolve("output/pdf");
mkdirSync(outputDirectory, { recursive: true });
const document = await createImmunizationAdjustmentPdf({ adjustment, items, ownerName: "06520 · P.S. Nuevo Tarapoto" });
const outputPath = resolve(outputDirectory, "Constancia_Reajuste_Stock_Biologico_Ejemplo.pdf");
writeFileSync(outputPath, Buffer.from(document.output("arraybuffer")));
console.log(outputPath);
