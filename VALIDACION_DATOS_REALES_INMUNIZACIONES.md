# Validación con datos reales - Módulo de Inmunizaciones

Fecha: 2026-07-30. Previa a la Fase 18.

Objetivo: comprobar contra el Supabase real que el esquema está completo y que los reportes de movimiento biológico de las Fases 16 y 17 calculan bien, antes de construir el consolidado DIRESA encima.

## Estado del esquema

Las 15 tablas de inmunizaciones existen y responden:

`immunization_products`, `immunization_initial_inventories`, `immunization_initial_inventory_items`, `immunization_stock_layers`, `immunization_stock_movements`, `immunization_adjustments`, `immunization_adjustment_items`, `immunization_income_origins`, `immunization_income_batches`, `immunization_income_items`, `immunization_distribution_batches`, `immunization_distribution_items`, `immunization_return_batches`, `immunization_return_items`, `immunization_monthly_closures`.

También están las columnas de las migraciones tardías: `stock_layers.regional_warehouse_id`, `stock_movements.doses_applied` / `doses_lost` / `loss_factor`, `distribution_batches.origin_owner_type` / `destination_owner_type`, `monthly_closures.preclosed_by` / `reopen_reason`, `return_batches.return_type`.

**Corrección al plan:** `PLAN_IMPLEMENTACION_INMUNIZACIONES.md` listaba las migraciones de consumo, devoluciones y cierres como pendientes de ejecutar. Ya estaban aplicadas.

## Resultado de los reportes

Los tres builders calculan correctamente contra los datos reales del periodo `2026-07`. El saldo final de cada reporte coincide con el stock realmente almacenado en `immunization_stock_layers`:

| Reporte | Calculado | Stock real |
|---|---|---|
| Almacén UNGET | 9 | 9 |
| Red completa UNGET | 13 | 13 |
| IPRESS 06523 | 3 | 3 |
| IPRESS 06520 | 1 | 1 |

## Defecto encontrado: registros de IPRESS sin `unget_id`

Los registros propiedad de una IPRESS se guardaban con `unget_id = NULL`. En los datos actuales: 3 de 4 capas y 3 de 8 movimientos de IPRESS, todos de tipo `INITIAL_INVENTORY` y `STOCK_ADJUSTMENT`.

Origen en `services/immunizationApi.ts`:

- `closeInitialInventory` escribía `unget_id: inventory.ownerType === "UNGET" ? inventory.ungetId : null`;
- `createAdjustment` pasaba `p_unget_id: adjustment.ungetId || null`, y el reajuste de una IPRESS no siempre trae `ungetId`.

Esos registros quedaban invisibles para cualquier consulta filtrada por UNGET. El módulo de cierre ya esquivaba el problema para las **capas**, porque las consulta también por códigos de IPRESS, pero los **movimientos** los pedía solo por `unget_id` y perdía 3 de 11.

Efecto medido en el consolidado UNGET:

```
lote 56565565:  saldoAnterior 3 -> 0  |  ingresoMes 0 -> 3
```

Un reajuste de `+3` frascos aparecía como saldo del mes anterior en vez de como ingreso del mes. El saldo final quedaba correcto por casualidad, porque al faltar el movimiento `INITIAL_INVENTORY` el cálculo del saldo anterior cae al stock actual de la capa. Esa coincidencia es lo que hacía que el error pasara desapercibido; con un mes completo de una UNGET real distorsionaría toda la columna de movimientos.

## Correcciones aplicadas

1. **`resolveOwnerUngetId`**: helper nuevo que resuelve la UNGET desde `facilities.unget_id` cuando el propietario es una IPRESS, con caché por código de establecimiento.
2. **`closeInitialInventory`**: capas y movimientos de IPRESS ahora heredan la UNGET del establecimiento.
3. **`createAdjustment`**: idem antes de llamar a la RPC.
4. **`listStockMovements`**: para un ámbito UNGET la consulta ahora empareja por `unget_id` **o** por código de IPRESS, así que también recupera los registros antiguos. Aplicado tanto en la consulta a Supabase como en el filtro del fallback local.
5. **`ImmunizationClosuresModule`**: pasa los códigos de IPRESS de la UNGET a esa consulta.

Verificado contra Supabase: la consulta pasa de devolver **8 a 11 movimientos**, recuperando los `INITIAL_INVENTORY` y `STOCK_ADJUSTMENT` perdidos.

## Reparación de datos pendiente

Las filas ya escritas siguen con `unget_id` nulo. El script está en:

```
SUPABASE_REPAIR_IMMUNIZATION_IPRESS_UNGET_LINK.sql
```

Incluye diagnóstico, reparación en transacción y verificación. Solo escribe donde `unget_id IS NULL` y el establecimiento tiene UNGET asignada; no toca cantidades ni saldos. **No es urgente**, porque el arreglo 4 ya hace que el reporte lea bien los datos antiguos, pero conviene ejecutarlo para dejar la base coherente.

## Herramienta de diagnóstico

```bash
npx vite-node scripts/validateImmunizationReportsAgainstSupabase.ts 2026-07
```

Solo lectura. Descarga capas y movimientos reales, corre los builders, compara el saldo calculado con el stock almacenado y avisa de registros de IPRESS sin `unget_id`. Requiere `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en el entorno.

## Límite de esta validación

El volumen de datos reales es pequeño: 1 producto, 5 capas, 11 movimientos, 1 distribución, 1 devolución. Alcanza para verificar la clasificación de movimientos y el cuadre de saldos, pero no cubre un mes completo con varias IPRESS y muchos lotes. Conviene repetir el diagnóstico cuando exista un periodo real cargado.
