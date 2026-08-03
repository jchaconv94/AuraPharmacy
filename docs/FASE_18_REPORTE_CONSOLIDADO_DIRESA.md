# Fase 18 - Reportes mensuales regionales DIRESA

## Alcance implementado

DIRESA, OGESS y ADMIN descargan dos reportes desde el módulo `Cierre Mensual`, en PDF y Excel `.xlsx`:

1. **Movimiento biológico - Almacén regional DIRESA**: lo recibido del nivel central y lo distribuido a las UNGET.
2. **Movimiento biológico consolidado regional**: almacén regional, todas las UNGET y todas las IPRESS en una sola matriz.

Ambos usan el **mismo formato de 19 columnas** del movimiento biológico IPRESS, igual que los reportes de la Fase 17. El usuario aprende un solo formato y lo lee en los tres niveles.

## Regla aplicada: el criterio de traslado interno sube un nivel

La Fase 17 estableció que dentro de una UNGET la distribución a IPRESS y las devoluciones al almacén son traslados internos y se anulan. A nivel regional el criterio es el mismo, un escalón más arriba: **la distribución DIRESA -> UNGET también pasa a ser interna**.

Constante `INTERNAL_REGIONAL_MOVEMENT_TYPES` en `services/immunizationMonthlyReportService.ts`:

```
INTERNAL_NETWORK_MOVEMENT_TYPES + DIRESA_DISTRIBUTION_OUT + UNGET_DISTRIBUTION_IN
```

Consecuencia: en el consolidado regional el ingreso del mes es únicamente lo que entra a la región desde fuera (`DIRESA_INCOME`, `UNGET_INCOME` y reajustes positivos), y la salida es consumo IPRESS más deterioro, vencimiento y bajas no disponibles. El `% FACTOR DE PÉRDIDA` es el indicador real de la región.

Verificado en pruebas: **el movimiento del mes de la región es idéntico al de la red UNGET**, porque mover stock entre niveles no gasta un solo frasco.

## Columnas por variante

| Columna | Almacén regional | Consolidado regional |
|---|---|---|
| (b) saldo mes anterior | del almacén DIRESA | región completa |
| (c) ingreso en el mes | del nivel central | **solo desde fuera de la región** |
| (e) salida frascos | `DISTRIBUCIÓN A UNGET FCO` | `CONSUMO IPRESS DEL MES FCO` |
| (g) deteriorado/vencido | del almacén regional | almacén, UNGET e IPRESS |
| (i)(j)(k) dosis | **vacías** | dosis reales de las IPRESS |
| (l) saldo final | `SALDO ALMACÉN` | `SALDO TOTAL REGIÓN` |

Sin anexo por UNGET, por el mismo motivo que en la Fase 17: cada UNGET ya emite su propio consolidado. `SALDO TOTAL REGIÓN` menos `SALDO ALMACÉN` da el saldo conjunto de las UNGET e IPRESS.

## Preliminar vs definitivo

Requisito de `docs/INMUNIZACIONES_DISENO_FUNCIONAL.md` §20: el consolidado definitivo solo existe cuando **todas** las UNGET están cerradas.

Implementado con `isPreliminary` y `preliminaryReason` en `ImmunizationMonthlyReportOptions`. Cuando falta alguna UNGET por cerrar:

- el título lleva el sufijo `- PRELIMINAR`;
- la nota de cabecera explica el motivo: `REPORTE PRELIMINAR: faltan N UNGET por cerrar el periodo.`;
- el nombre del archivo se antepone con `PRELIMINAR_`;
- el panel muestra una insignia ámbar `PRELIMINAR - N UNGET SIN CERRAR` y una alerta.

Cuando la región está completa, la insignia pasa a `DEFINITIVO` en verde y el archivo sale sin marcas.

El cálculo usa **todas** las UNGET supervisadas, no las filas visibles en pantalla: el estado del reporte no puede depender de los filtros de la UI.

## Refactor asociado

Las cinco variantes comparten ahora dos builders genéricos:

- `buildWarehouseReportRows(options, ownerType, isDistribution, isLoss)`
- `buildNetworkReportRows(options, ownerTypes, isIncome, isLoss)`

Los cinco builders públicos son envolturas de una línea. Un cambio en la aritmética se aplica a todos los niveles a la vez, y agregar un nivel nuevo es declarar sus clasificadores.

## Carga de datos

El panel supervisor necesita almacén regional, UNGET e IPRESS a la vez, así que carga con ámbito `GLOBAL`. Es correcto porque el diseño contempla un único almacén regional DIRESA para San Martín.

## Archivos modificados

- `services/immunizationMonthlyReportService.ts`
- `services/immunizationMonthlyReportService.test.ts`
- `components/ImmunizationClosuresModule.tsx`
- `scripts/generateImmunizationReportPreviews.ts`

Nuevas exportaciones: `buildImmunizationDiresaWarehouseReportRows`, `buildImmunizationDiresaNetworkReportRows`, `downloadImmunizationDiresaWarehouseReportPdf` / `...Excel`, `downloadImmunizationDiresaNetworkReportPdf` / `...Excel`. `ImmunizationReportVariant` suma `DIRESA_WAREHOUSE` y `DIRESA_NETWORK`.

No requiere migración de Supabase: reutiliza `immunization_stock_layers` y `immunization_stock_movements`.

## Validación técnica

```bash
npm run lint
npm test
npm run build
```

- `lint`: correcto.
- `test`: 23 pruebas correctas en 2 archivos.
- `build`: correcto. Se mantiene la advertencia preexistente de bundle grande.

### Escenario cubierto por las pruebas

Sobre el escenario UNGET de la Fase 17 se añade el almacén regional: el nivel central entrega 500 al almacén DIRESA, que distribuye 400 a la UNGET.

| Comprobación | Resultado |
|---|---|
| Almacén regional: `0 + 500 - 400` | `100` |
| Consolidado: ingreso solo desde fuera | `500`, no `900` |
| Consolidado: saldo final | `869` = `100 + 338 + 431` |
| Movimiento del mes región vs red UNGET | idénticos, `101` |
| Marcado preliminar en título y nota | correcto |

### Muestras generadas

```bash
npx vite-node scripts/generateImmunizationReportPreviews.ts
```

Produce en `reportes-ejemplo/` las seis muestras en PDF y `.xlsx`, incluidas `EJEMPLO_4` (almacén regional), `EJEMPLO_5` (consolidado regional) y `EJEMPLO_6` (el mismo consolidado marcado como preliminar).

Contrastado leyendo los `.xlsx` generados: en el consolidado regional, BCG lote `0374MA05` da `770 + 1200 - 101 = 1869`, que coincide con el stock real `1100 + 338 + 270 + 161`.

## Pendiente posterior

- Convertir `components/ImmunizationReportsModule.tsx`, todavía un placeholder, en el tablero de avance operativo de §20: UNGET cerradas y pendientes, IPRESS observadas, incidencias abiertas, distribuciones y bajas pendientes.
- Validar con un periodo real completo cuando exista volumen suficiente, usando `scripts/validateImmunizationReportsAgainstSupabase.ts`.
