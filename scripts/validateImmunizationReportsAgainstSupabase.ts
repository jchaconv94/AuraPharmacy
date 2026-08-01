/**
 * Valida los reportes de movimiento biológico contra los datos reales de Supabase.
 *
 * Es un diagnóstico de solo lectura: descarga capas de stock y movimientos, corre los
 * builders de la aplicación y comprueba que el saldo calculado coincida con el stock
 * realmente almacenado. Ejecutar con:
 *
 *   npx vite-node scripts/validateImmunizationReportsAgainstSupabase.ts [periodo]
 */
import {
  buildImmunizationMonthlyReportRows,
  buildImmunizationUngetNetworkReportRows,
  buildImmunizationUngetWarehouseReportRows,
  ImmunizationMonthlyReportOptions
} from "../services/immunizationMonthlyReportService";
import { buildImmunizationProgress } from "../services/immunizationProgressService";
import { ImmunizationStockLayer, ImmunizationStockMovement } from "../types";

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error("Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en el entorno.");

const period = process.argv[2] || "2026-07";

const get = async (path: string) => {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  if (!response.ok) throw new Error(`${path} -> HTTP ${response.status}`);
  return response.json();
};

const layerRows = await get("immunization_stock_layers?select=*,product:immunization_products(*)");
const movementRows = await get("immunization_stock_movements?select=*");

const stockLayers: ImmunizationStockLayer[] = layerRows.map((row: any) => ({
  id: row.id,
  ownerType: row.owner_type,
  regionalWarehouseId: row.regional_warehouse_id || undefined,
  ungetId: row.unget_id || undefined,
  facilityCode: row.facility_code || undefined,
  productId: row.product_id,
  product: row.product
    ? {
        id: row.product.id,
        codigoSismed: row.product.codigo_sismed,
        descripcion: row.product.descripcion,
        tipoProducto: row.product.tipo_producto,
        dosisUnidad: Number(row.product.dosis_unidad) || 0,
        isActive: row.product.is_active !== false
      }
    : undefined,
  lote: row.lote,
  expirationDate: row.expiration_date,
  unitPrice: Number(row.unit_price) || 0,
  fundingSource: row.funding_source || "",
  supplyType: row.supply_type || "",
  currentQuantity: Number(row.current_quantity) || 0,
  isActive: row.is_active !== false
}));

const movements: ImmunizationStockMovement[] = movementRows.map((row: any) => ({
  id: row.id,
  movementType: row.movement_type,
  ownerType: row.owner_type,
  ungetId: row.unget_id || undefined,
  facilityCode: row.facility_code || undefined,
  productId: row.product_id,
  stockLayerId: row.stock_layer_id || undefined,
  quantityDelta: Number(row.quantity_delta) || 0,
  quantityBefore: Number(row.quantity_before) || 0,
  quantityAfter: Number(row.quantity_after) || 0,
  period: row.period,
  reason: row.reason || undefined,
  observation: row.observation || undefined,
  dosesApplied: row.doses_applied === null ? undefined : Number(row.doses_applied),
  createdAt: row.created_at || undefined
}));

const facilityRows = await get("facilities?select=code,unget_id");
const facilitiesByUnget = new Map<string, string[]>();
facilityRows.forEach((row: any) => {
  if (!row.unget_id) return;
  facilitiesByUnget.set(row.unget_id, [...(facilitiesByUnget.get(row.unget_id) || []), row.code]);
});

const ungetIds = Array.from(
  new Set([
    ...stockLayers.map(layer => layer.ungetId).filter(Boolean) as string[],
    ...movements.map(movement => movement.ungetId).filter(Boolean) as string[]
  ])
);

console.log(`Periodo ${period} | ${stockLayers.length} capas | ${movements.length} movimientos\n`);

const orphanLayers = stockLayers.filter(layer => layer.ownerType === "IPRESS" && !layer.ungetId);
const orphanMovements = movements.filter(movement => movement.ownerType === "IPRESS" && !movement.ungetId);
if (orphanLayers.length || orphanMovements.length) {
  console.log("AVISO - registros IPRESS sin unget_id (invisibles para una consulta por UNGET):");
  console.log(`  capas:       ${orphanLayers.length} de ${stockLayers.filter(l => l.ownerType === "IPRESS").length}`);
  console.log(`  movimientos: ${orphanMovements.length} de ${movements.filter(m => m.ownerType === "IPRESS").length}`);
  console.log(`  tipos afectados: ${Array.from(new Set(orphanMovements.map(m => m.movementType))).join(", ") || "-"}\n`);
}

let failures = 0;
const check = (label: string, expected: number, actual: number) => {
  const ok = Math.abs(expected - actual) < 0.0001;
  if (!ok) failures += 1;
  console.log(`  ${ok ? "OK   " : "FALLA"} ${label}: reporte=${actual}  stock real=${expected}`);
};

for (const ungetId of ungetIds) {
  const facilityCodes = facilitiesByUnget.get(ungetId) || [];
  const belongsToUnget = (row: { ownerType: string; ungetId?: string; facilityCode?: string }) =>
    row.ungetId === ungetId || (row.ownerType === "IPRESS" && !!row.facilityCode && facilityCodes.includes(row.facilityCode));

  // Así carga hoy el módulo de cierre: capas por unget_id y por códigos de IPRESS.
  const ungetLayers = stockLayers.filter(belongsToUnget);
  // Así consulta hoy los movimientos: solo por unget_id. Esta es la diferencia a medir.
  const movementsAsApp = movements.filter(movement => movement.ungetId === ungetId);
  const ungetMovements = movements.filter(belongsToUnget);
  const missed = ungetMovements.length - movementsAsApp.length;
  if (missed > 0) {
    console.log(`  NOTA: la consulta actual por unget_id pierde ${missed} movimiento(s) de IPRESS de esta UNGET.`);
  }

  const options: ImmunizationMonthlyReportOptions = {
    period,
    ownerName: `UNGET ${ungetId}`,
    scopeLabel: "UNGET",
    stockLayers: ungetLayers,
    movements: ungetMovements
  };

  console.log(`UNGET ${ungetId}`);

  const warehouseRows = buildImmunizationUngetWarehouseReportRows(options);
  const warehouseReal = ungetLayers
    .filter(layer => layer.ownerType === "UNGET")
    .reduce((sum, layer) => sum + layer.currentQuantity, 0);
  check(
    `almacén (${warehouseRows.length} fila/s)`,
    warehouseReal,
    warehouseRows.reduce((sum, row) => sum + row.saldoEess, 0)
  );

  const networkRows = buildImmunizationUngetNetworkReportRows(options);
  const networkReal = ungetLayers.reduce((sum, layer) => sum + layer.currentQuantity, 0);
  check(
    `red completa (${networkRows.length} fila/s)`,
    networkReal,
    networkRows.reduce((sum, row) => sum + row.saldoEess, 0)
  );

  if (missed > 0) {
    const asApp = buildImmunizationUngetNetworkReportRows({ ...options, movements: movementsAsApp });
    const columns = ["saldoAnterior", "ingresoMes", "totalDisponible", "consumoFrascos", "noDisponibleTransferido", "totalMovimiento", "saldoEess"] as const;
    console.log("  IMPACTO por columna (consulta actual -> correcto):");
    let differing = 0;
    networkRows.forEach(correct => {
      const current = asApp.find(row => row.codigoSismed === correct.codigoSismed && row.lote === correct.lote);
      const diffs = columns
        .filter(column => (current?.[column] ?? 0) !== correct[column])
        .map(column => `${column} ${current?.[column] ?? "-"} -> ${correct[column]}`);
      if (diffs.length) {
        differing += 1;
        console.log(`    lote ${correct.lote}: ${diffs.join(" | ")}`);
      }
    });
    if (!differing) console.log("    ninguna columna cambia con estos datos.");
  }

  const reportedFacilities = Array.from(
    new Set(ungetLayers.filter(layer => layer.ownerType === "IPRESS").map(layer => layer.facilityCode))
  );
  for (const facilityCode of reportedFacilities) {
    const ipressRows = buildImmunizationMonthlyReportRows({
      ...options,
      scopeLabel: "IPRESS",
      stockLayers: ungetLayers.filter(layer => layer.facilityCode === facilityCode),
      movements: ungetMovements.filter(movement => movement.facilityCode === facilityCode)
    });
    const ipressReal = ungetLayers
      .filter(layer => layer.facilityCode === facilityCode)
      .reduce((sum, layer) => sum + layer.currentQuantity, 0);
    check(
      `IPRESS ${facilityCode} (${ipressRows.length} fila/s)`,
      ipressReal,
      ipressRows.reduce((sum, row) => sum + row.saldoEess, 0)
    );
  }

  console.log("");
}

// --- Tablero de avance operativo --------------------------------------------

const closureRows = await get(`immunization_monthly_closures?select=*&period=eq.${period}`);
const distributionRows = await get(`immunization_distribution_batches?select=*&period=eq.${period}`);
const returnRows = await get(`immunization_return_batches?select=*&period=eq.${period}`);
const ungetRows = await get("ungets?select=id,name");

const progress = buildImmunizationProgress({
  period,
  ungets: ungetRows.map((row: any) => ({ id: row.id, name: row.name })) as any,
  facilities: facilityRows.map((row: any) => ({ code: row.code, ungetId: row.unget_id })) as any,
  closures: closureRows.map((row: any) => ({
    ownerType: row.owner_type,
    period: row.period,
    ungetId: row.unget_id || undefined,
    facilityCode: row.facility_code || undefined,
    status: row.status
  })) as any,
  distributions: distributionRows.map((row: any) => ({
    ungetId: row.unget_id,
    originUngetId: row.origin_unget_id || undefined,
    destinationUngetId: row.destination_unget_id || undefined,
    period: row.period,
    status: row.status
  })) as any,
  returns: returnRows.map((row: any) => ({
    originUngetId: row.origin_unget_id,
    period: row.period,
    status: row.status
  })) as any,
  movements,
  stockLayers
});

console.log("TABLERO DE AVANCE");
const { summary } = progress;
console.log(`  UNGET cerradas         ${summary.closedUngets} / ${summary.totalUngets}   (${summary.isDefinitive ? "DEFINITIVO" : "PRELIMINAR"})`);
console.log(`  IPRESS precerradas     ${summary.preclosedIpress} / ${summary.totalIpress}`);
console.log(`  Pendientes recepción   ${summary.pendingDistributions} distrib. / ${summary.pendingReturns} devol.`);
console.log(`  Incidencias abiertas   ${summary.openIncidents}`);
console.log(`  Consumo                ${summary.consumoFrascos} frascos`);
console.log(`  Dosis aplicadas        ${summary.dosisAplicadas}  |  perdidas ${summary.dosisPerdidas}  |  factor ${summary.factorPerdida.toFixed(2)}%`);
console.log(`  Stock                  ${summary.stockFrascos} frascos  |  S/ ${summary.valorizacion.toFixed(2)}`);
console.log(`  Vencidos / por vencer  ${summary.expiredLots} / ${summary.expiringLots}`);
console.log("");

const layerStock = stockLayers
  .filter(layer => layer.ownerType === "IPRESS" || layer.ownerType === "UNGET")
  .reduce((sum, layer) => sum + layer.currentQuantity, 0);
if (Math.abs(layerStock - summary.stockFrascos) > 0.0001) {
  failures += 1;
  console.log(`  FALLA el stock del tablero (${summary.stockFrascos}) no cuadra con las capas (${layerStock}).`);
  console.log("  Suele indicar capas cuya UNGET no se resuelve; revisar el aviso de unget_id.\n");
}

console.log(failures === 0 ? "Sin diferencias." : `${failures} diferencia(s) detectada(s).`);
