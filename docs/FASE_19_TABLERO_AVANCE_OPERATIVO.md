# Fase 19 - Tablero de avance operativo

## Alcance implementado

`Reportes Inmunizaciones` dejó de ser un placeholder y ahora es el tablero de avance mensual que pedía `docs/INMUNIZACIONES_DISENO_FUNCIONAL.md` §20, complementando el consolidado biológico de la Fase 18.

Con esto queda cubierta la sección 20 completa: la vista de consolidado biológico vive en `Cierre Mensual`, y la vista de avance operativo en `Reportes Inmunizaciones`.

## Qué muestra

Indicadores del periodo, en dos filas de tarjetas:

| Indicador | Detalle |
|---|---|
| UNGET cerradas | cerradas sobre el total del ámbito |
| IPRESS precerradas | precerradas sobre el total |
| Incidencias abiertas | recepciones observadas, separando distribuciones de devoluciones |
| Pendientes de recepción | distribuciones y devoluciones en estado `SENT` |
| Consumo | frascos consumidos del periodo |
| Dosis aplicadas | de los movimientos de consumo |
| Factor de pérdida | con las dosis perdidas como pista |
| Vencidos / por vencer | lotes con saldo, con los umbrales de Stock Biológico |
| Valorización | valor del stock y total de frascos |

Debajo, una tabla de avance por UNGET con estado del cierre, IPRESS precerradas, reaperturas, pendientes, incidencias, consumo, factor de pérdida, vencidos y valorización. Buscador por nombre o estado y filtro por estado de cierre.

## Descargas desde el tablero

DIRESA trabaja en esta pantalla, así que los archivos se descargan aquí sin tener que pasar por `Cierre Mensual`:

- **Por fila**: cada UNGET tiene botones de PDF y Excel que generan su **consolidado UNGET**, armado con las capas y movimientos de su ámbito. Si esa UNGET no ha cerrado el periodo, el archivo sale marcado como preliminar con su propio motivo, incluyendo cuántas IPRESS le faltan por precerrar.
- **Del ámbito**: almacén regional DIRESA y consolidado regional, con la misma regla preliminar/definitivo.

Cuando una UNGET no tiene stock ni movimientos del periodo, el botón avisa en vez de generar un archivo vacío.

El alcance por fila usa `belongsToUngetScope`, la misma función que alimenta las métricas, que empareja por `unget_id` y también por código de IPRESS.

La cabecera lleva una insignia `PRELIMINAR` o `DEFINITIVO` con la misma regla del consolidado regional: definitivo solo cuando todas las UNGET del ámbito han cerrado.

## Alcance por rol

Requisito de `docs/UX_PLAN_INMUNIZACIONES.md` §5.6. El tablero lee el ámbito completo y luego recorta:

- **IPRESS**: solo su establecimiento.
- **UNGET**: su red y sus IPRESS.
- **OGESS**: las UNGET de su OGESS.
- **DIRESA / ADMIN**: todas las UNGET de la región.

## Servicio compartido

La lógica vive en `services/immunizationProgressService.ts`, en funciones puras. Motivo: el módulo de cierre ya calculaba a mano "precerrada", "pendiente" y "cerrada"; duplicar esas definiciones en el tablero era garantía de que se desincronizaran.

`ImmunizationClosuresModule` ahora importa de ahí `closureIsIpressReady`, `closureIsUngetClosed`, `closureStatusLabel`, `closureMatchesStatus` y el tipo del filtro de estado, en vez de definirlos localmente.

Dos decisiones de cálculo que conviene conocer:

- **El factor de pérdida se consolida sobre las dosis, no promediando porcentajes.** Una UNGET con 20% sobre 100 dosis y otra con 0% sobre 20 no dan 10%: dan `20/120 = 16.67%`. Hay una prueba que lo fija.
- **Las dosis consumidas se derivan si el movimiento no las trae.** `consumedDoses` viene poblado por el registro de consumo, pero si falta se calcula con la presentación del producto, para no reportar cero dosis perdidas por omisión.

## Archivos modificados

- `services/immunizationProgressService.ts` (nuevo)
- `services/immunizationProgressService.test.ts` (nuevo)
- `components/ImmunizationReportsModule.tsx` (reescrito)
- `components/ImmunizationClosuresModule.tsx` (usa los helpers compartidos)
- `scripts/validateImmunizationReportsAgainstSupabase.ts` (verifica también el tablero)

No requiere migración de Supabase ni permisos nuevos: reutiliza el permiso `IMMUNIZATION_REPORTS` que ya existía.

## Validación técnica

```bash
npm run lint
npm test
npm run build
```

- `lint`: correcto.
- `test`: 38 pruebas correctas en 3 archivos.
- `build`: correcto. Se mantiene la advertencia preexistente de bundle grande.

Las descargas por fila se contrastaron replicando con datos reales lo que arma cada botón: de las 7 UNGET, solo Bellavista tiene datos y su consolidado da `13` frascos, igual que el stock almacenado. Las otras seis devuelven cero filas, que es cuando el botón avisa.

### Contraste con datos reales

```
TABLERO DE AVANCE
  UNGET cerradas         0 / 7   (PRELIMINAR)
  IPRESS precerradas     1 / 51
  Pendientes recepción   0 distrib. / 0 devol.
  Incidencias abiertas   1
  Consumo                5 frascos
  Dosis aplicadas        76  |  perdidas 24  |  factor 24.00%
  Stock                  13 frascos  |  S/ 129.39
  Vencidos / por vencer  0 / 0
```

El stock del tablero coincide con la suma de las capas (`9 + 3 + 1 = 13`), y las dosis con los movimientos reales (`10 + 14 + 52 = 76` aplicadas sobre `100` consumidas). El diagnóstico comprueba ese cuadre y falla si se rompe.

## Estado de la reparación de datos

`supabase/SUPABASE_REPAIR_IMMUNIZATION_IPRESS_UNGET_LINK.sql` **ya fue ejecutado**. Verificado el 2026-07-30: 0 filas huérfanas en `immunization_stock_layers`, `immunization_stock_movements`, `immunization_initial_inventories` e `immunization_adjustments`.

## Pendiente posterior

- Exportar el propio tablero de indicadores como resumen ejecutivo. Lo que ya se descarga desde aquí es el movimiento biológico, no el tablero.
- Filtros territoriales avanzados para DIRESA (por OGESS o por provincia); hoy el filtro es por estado y texto.
- Revisar el tablero en móvil: la tabla de avance usa `min-w-[900px]` con scroll horizontal, pendiente de convertir a tarjetas según `docs/UX_PLAN_INMUNIZACIONES.md` §9.
