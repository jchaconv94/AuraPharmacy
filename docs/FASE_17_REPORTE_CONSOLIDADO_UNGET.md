# Fase 17 - Reportes mensuales UNGET

## Alcance implementado

La UNGET descarga dos reportes desde el módulo `Cierre Mensual`, ambos en PDF y Excel `.xlsx`:

1. **Movimiento biológico - Almacén UNGET**: resumen del almacén y de sus distribuciones a IPRESS.
2. **Movimiento biológico consolidado UNGET**: toda la red (almacén + IPRESS) en una sola matriz.

## Rediseño del 2026-07-30

La primera versión de esta fase usaba una matriz propia que mezclaba almacén e IPRESS en la misma fila, con columnas separadas `SALDO ALMACÉN RED MES ANTERIOR (b)` y `SALDO IPRESS MES ANTERIOR (c)`, más una columna `DISTRIBUCIÓN A IPRESS (f)`.

Esa matriz se retiró. Motivo funcional y técnico:

- Una devolución de IPRESS a la UNGET se contaba **dos veces**: como pérdida de la IPRESS en la columna (j) y como ingreso de la UNGET en la columna (d).
- La distribución UNGET -> IPRESS se contaba como salida (f) aunque el frasco seguía dentro de la misma red.
- Los saldos finales cuadraban, pero `TOTAL DE MOVIMIENTO DEL MES (k=f+g+i+j)` quedaba inflado con traslados internos, y al leer la fila no se distinguía si algo se había perdido o solo se había movido de estante.

Decisión: los dos reportes usan **el mismo formato de 19 columnas del movimiento biológico IPRESS**, con las mismas letras (a, b, c...). Solo cambia qué alimenta cada columna y el rótulo de la salida (e).

## Formato compartido

| Columna | Almacén UNGET | Consolidado red UNGET |
|---|---|---|
| (b) saldo mes anterior | saldo del almacén | almacén + todas sus IPRESS |
| (c) ingreso en el mes | recibido de DIRESA + devoluciones aceptadas de IPRESS + reajustes positivos | **solo lo recibido de DIRESA** |
| (d = b+c) total disponible | del almacén | de toda la red |
| (e) salida frascos | `DISTRIBUCIÓN A IPRESS FCO` | `CONSUMO IPRESS DEL MES FCO` |
| (f = e*a) salida dosis | dosis distribuidas | dosis consumidas |
| (g) deteriorado/vencido/transferido | del almacén | almacén + IPRESS |
| (h = e+g) total movimiento | del almacén | real de la red |
| (i) dosis aplicadas | **vacío** | dosis aplicadas por las IPRESS |
| (j = f-i) dosis perdidas | **vacío** | pérdida real de la red |
| (k) % factor pérdida | **vacío** | indicador real de la UNGET |
| (l = d-h) saldo final | `SALDO ALMACÉN` | `SALDO TOTAL RED` |

`SALDO TOTAL RED` menos `SALDO ALMACÉN` da el saldo conjunto de las IPRESS, sin necesidad de un anexo.

Las columnas de dosis del reporte de almacén quedan **vacías, no en cero**: con 0 dosis aplicadas la fórmula `j = f - i` daría que se perdió el 100% de lo distribuido, una alerta falsa. El almacén no aplica dosis a pacientes.

## Regla del consolidado: los traslados internos se anulan

El consolidado trata la UNGET como un único almacén lógico agrupado por producto/lote. Origen y destino de un traslado interno están ambos dentro del reporte, así que se cancelan solos y no aparecen en ninguna columna.

Movimientos tratados como internos (constante `INTERNAL_NETWORK_MOVEMENT_TYPES`):

- `UNGET_DISTRIBUTION_OUT` e `IPRESS_DISTRIBUTION_IN`
- `IPRESS_RETURN_OUT` / `IPRESS_TRANSFER_OUT` y sus contrapartes `UNGET_RETURN_IN` / `UNGET_TRANSFER_IN`
- `UNGET_DISPOSAL_RECEIVED`, que además se registra con `quantity_delta: 0`

Movimientos que sí mueven el total de la red:

- ingreso: `UNGET_DISTRIBUTION_IN` desde DIRESA, `UNGET_INCOME` y reajustes positivos;
- salida: `IPRESS_CONSUMPTION`, `IPRESS_DISPOSAL_OUT` (la baja no disponible sale de la red y no vuelve) y reajustes negativos.

Gracias a esto el `% FACTOR DE PÉRDIDA` del consolidado es por fin el indicador real de la UNGET.

La aritmética asume que no queda stock en tránsito, condición garantizada por el control de habilitación del reporte.

## Decisión sobre el detalle por establecimiento

Se evaluó agregar al consolidado un anexo `Detalle por establecimiento` con el saldo final por IPRESS. **Se descartó el 2026-07-30.**

Motivos:

- el anexo crece como `nº IPRESS x nº productos x nº lotes`, lo que en una UNGET real genera cientos o miles de filas de ruido;
- esa información ya existe: cada IPRESS emite su propio movimiento biológico mensual al precerrar;
- no se pierde ninguna lectura: el saldo del almacén sale del reporte de almacén, y el total de las IPRESS se deduce restándolo del consolidado. Hay una prueba que verifica esta relación.

El consolidado queda en una sola página por corrida de tabla y el usuario maneja solo dos archivos por UNGET.

## Habilitación

**Almacén UNGET**: periodo no futuro y con datos. Su aritmética es por capa, siempre cuadra exista o no stock en tránsito, así que queda disponible como resumen operativo aunque las IPRESS todavía no hayan precerrado.

**Consolidado UNGET**: mantiene el control completo de cierre porque su aritmética asume que no hay stock en tránsito.

- el periodo no es futuro;
- la UNGET tiene IPRESS asignadas;
- todas las IPRESS de la UNGET están precerradas;
- no existen distribuciones pendientes de recepción;
- no existen devoluciones, bajas o transferencias pendientes de recepción por UNGET;
- existen datos de stock o movimientos para consolidar.

## Archivos modificados

- `services/immunizationMonthlyReportService.ts`
- `services/immunizationMonthlyReportService.test.ts` (nuevo)
- `components/ImmunizationClosuresModule.tsx`
- `package.json` (script `test`)

### API pública del servicio

Reemplazos respecto de la primera versión:

| Antes | Ahora |
|---|---|
| `buildImmunizationUngetConsolidatedReportRows` | `buildImmunizationUngetWarehouseReportRows` y `buildImmunizationUngetNetworkReportRows` |
| `downloadImmunizationUngetConsolidatedReportPdf` / `...Excel` | `downloadImmunizationUngetWarehouseReportPdf` / `...Excel` y `downloadImmunizationUngetNetworkReportPdf` / `...Excel` |
| `ImmunizationUngetConsolidatedReportRow` | se elimina: las tres variantes devuelven `ImmunizationMonthlyReportRow` |

Añadidos: `ImmunizationReportVariant`, `buildMonthlyReportPdfDoc` y `buildMonthlyReportWorkbook`.

Los generadores de PDF y Excel se unificaron en `writeMonthlyReportPdf` / `writeMonthlyReportExcel`, parametrizados por `REPORT_VARIANTS`. Las tres variantes comparten layout, por lo que un ajuste visual se aplica a todas a la vez.

En `ImmunizationMonthlyReportRow` los campos `dosisAplicadas`, `dosisPerdidas` y `factorPerdida` pasaron a `number | null`.

## Validación técnica

```bash
npm run lint
npm test
npm run build
```

Resultado:

- `lint`: correcto.
- `test`: 14 pruebas correctas en 2 archivos.
- `build`: correcto. Se mantiene la advertencia preexistente de bundle grande.

### Escenario cubierto por las pruebas

Saldos iniciales almacén 150 / IPRESS 320, un solo producto y lote:

| Movimiento | Cantidad | Naturaleza |
|---|---|---|
| DIRESA entrega al almacén | 400 | ingreso real de la red |
| Almacén distribuye a IPRESS | 220 | traslado interno |
| IPRESS consume (1775 dosis aplicadas) | 95 | salida real |
| IPRESS devuelve al almacén | 10 | traslado interno |
| IPRESS da de baja no disponible | 4 | salida real |
| Almacén pierde por deterioro | 2 | salida real |

Resultados verificados:

- Almacén: `150 + 410 - 222 = 338`, columnas de dosis en `null`.
- Consolidado: `470 + 400 - 101 = 769`, igual a `338 + 431` de stock real.
- Relación entre ambos: `769 - 338 = 431`, el saldo conjunto de las IPRESS sin anexo.
- Factor de pérdida de la red: `125 / 1900 = 6.58%`.

## Corrección: desplazamiento de columnas en el Excel

Detectado y corregido el 2026-07-30. **Era un defecto preexistente desde la Fase 16**, presente también en el Excel del reporte IPRESS.

Síntoma: los datos se escribían desde la columna `B` y las subcabeceras desde la `E`, todo corrido una columna respecto de las cabeceras combinadas. Como consecuencia las fórmulas apuntaban a celdas equivocadas y aparecía `#¡VALOR!` en las columnas de dosis, además de totales absurdos como `46486` en `TOTAL DISPONIBLE` (era `dosis/unidad` más un número de serie de fecha).

Causa: el código asignaba `row.values = [undefined, valor1, valor2, ...]` asumiendo que ExcelJS ignora el índice 0 y usa numeración 1-based. En realidad `node_modules/exceljs/lib/doc/row.js` evalúa `value.hasOwnProperty('0')`, y un array literal con `undefined` explícito **sí** tiene esa propiedad: ExcelJS lo interpreta como array contiguo, aplica `offset = 1` y desplaza todo una columna. La numeración 1-based solo aplica a arrays realmente dispersos.

Solución: quitar el `undefined` inicial de las dos asignaciones (fila 5 de subcabeceras y filas de datos). Las fórmulas ya estaban escritas para la posición correcta, así que no requirieron cambios.

Protección: `services/immunizationMonthlyReportService.test.ts` fija ahora la posición real de las celdas (`A6` es el código SISMED, `D5` la cabecera de saldo anterior, `I6` la fórmula `D6+G6`), de modo que un desplazamiento futuro rompe la prueba.

## Previsualización de los PDF

```bash
npx vite-node scripts/generateImmunizationReportPreviews.ts
```

Genera en `reportes-ejemplo/` una muestra en PDF y `.xlsx` de las tres variantes, con datos ficticios de una UNGET con dos IPRESS y tres productos:

- `EJEMPLO_1_MOVIMIENTO_BIOLOGICO_IPRESS`
- `EJEMPLO_2_MOVIMIENTO_BIOLOGICO_ALMACEN_UNGET`
- `EJEMPLO_3_MOVIMIENTO_BIOLOGICO_CONSOLIDADO_UNGET`

El script usa los mismos builders que la aplicación, así que la muestra es exactamente lo que descarga el usuario. Para permitirlo se separaron `buildMonthlyReportPdfDoc` y `buildMonthlyReportWorkbook` de las funciones de descarga, siguiendo el patrón que ya usaba `immunizationAdjustmentPdfService`.

Al ajustar anchos de columna hay que revisar la advertencia `could not fit page` de `jspdf-autotable`: los anchos deben sumar 291 mm en A4 apaisado con margen de 3 mm.

## Deuda conocida

`scripts/generateUngetConsolidatedPdfPreview.mjs` y `reportes-ejemplo/MOVIMIENTO_BIOLOGICO_UNGET_EJEMPLO_A4.pdf` quedaron obsoletos: reproducen la matriz mixta retirada y duplicaban el layout a mano. Se conservan como referencia comparativa, pero no deben usarse como modelo; el reemplazo es `scripts/generateImmunizationReportPreviews.ts`.

## Pendiente posterior

La siguiente fase natural es el reporte consolidado DIRESA, tomando los cierres finales de todas las UNGET. El mismo criterio aplica un nivel más arriba: la distribución DIRESA -> UNGET pasa a ser traslado interno de la región.
