# Fase 12 - Distribucion UNGET a IPRESS

Fecha: 2026-07-22

## Estado

Implementado y validado tecnicamente.

Esta fase agrega el flujo base para que una UNGET distribuya biologicos desde su stock hacia una IPRESS de su propia jurisdiccion.

## Alcance implementado

- Nuevo modulo `Distribuciones UNGET`.
- Nuevo permiso interno `IMMUNIZATION_DISTRIBUTIONS`.
- Vista operativa para UNGET.
- Vista de supervision para DIRESA/OGESS/ADMIN.
- Vista IPRESS para ver y aceptar distribuciones dirigidas a su establecimiento.
- Buscador y filtros compactos por:
  - texto general;
  - UNGET, cuando aplica;
  - IPRESS destino;
  - periodo;
  - estado;
  - criterio;
  - rango de fechas colapsable.
- Registro de distribucion hacia una IPRESS.
- Una distribucion puede contener varios productos/lotes.
- Seleccion de productos desde stock real de la UNGET.
- FEFO automatico por defecto:
  - toma primero el lote con vencimiento mas proximo;
  - si no alcanza, continua con el siguiente lote disponible.
- Modo manual para omitir FEFO y elegir lote especifico.
- Validacion de stock disponible antes de enviar.
- Al enviar:
  - descuenta stock de la UNGET;
  - registra movimiento `UNGET_DISTRIBUTION_OUT`;
  - deja la distribucion en estado `SENT`, pendiente de recepcion IPRESS.
- Aceptacion simple por IPRESS:
  - suma stock a la IPRESS;
  - registra movimiento `IPRESS_DISTRIBUTION_IN`;
  - cambia estado a `RECEIVED`.

## Reglas funcionales implementadas

- La UNGET solo puede distribuir a IPRESS que pertenecen a su propia UNGET.
- No se permite distribuir lotes sin stock.
- No se permite stock negativo.
- No se permite repetir el mismo lote como fila separada; si se agrega de nuevo, se acumula cantidad en la misma fila.
- La distribucion descuenta stock de la UNGET antes de que la IPRESS acepte.
- La IPRESS no puede crear distribuciones; solo visualiza y acepta las que tienen como destino su establecimiento.
- DIRESA/OGESS/ADMIN consultan con filtros, pero la operacion normal corresponde a UNGET.

## Archivos creados o modificados

- `components/ImmunizationDistributionsModule.tsx`
- `supabase/SUPABASE_MIGRATION_IMMUNIZATION_DISTRIBUTIONS.sql`
- `types.ts`
- `services/immunizationApi.ts`
- `App.tsx`
- `components/Sidebar.tsx`
- `components/MobileNav.tsx`
- `docs/PLAN_IMPLEMENTACION_INMUNIZACIONES.md`

## Base de datos

Nueva migracion:

- `supabase/SUPABASE_MIGRATION_IMMUNIZATION_DISTRIBUTIONS.sql`

Incluye:

- tabla `immunization_distribution_batches`;
- tabla `immunization_distribution_items`;
- RPC `send_immunization_distribution`;
- RPC `receive_immunization_distribution`;
- indices por UNGET, IPRESS destino, periodo y estado;
- RLS temporal permisiva, siguiendo el patron actual del proyecto.

## Validacion tecnica

Comandos ejecutados:

- `npm.cmd run lint` aprobado.
- `npm.cmd run build` aprobado.

Resultado del build:

- Build completado correctamente.
- Se mantiene el warning existente de Vite por bundle grande. No bloquea esta fase.

## Pendientes funcionales

Para Supabase real:

1. Ejecutar `supabase/SUPABASE_MIGRATION_IMMUNIZATION_DISTRIBUTIONS.sql`.
2. Asignar `IMMUNIZATION_DISTRIBUTIONS` al rol `INMU_UNGET`.
3. Asignar `IMMUNIZATION_DISTRIBUTIONS` al rol `INMU_IPRESS` si la IPRESS aceptara distribuciones desde este mismo modulo.
4. Asignar `IMMUNIZATION_DISTRIBUTIONS` a `INMU_DIRESA` para supervision.
5. Probar con datos reales:
   - UNGET con stock;
   - IPRESS perteneciente a esa UNGET;
   - distribucion de varios lotes;
   - descuento correcto en stock UNGET;
   - aceptacion IPRESS;
   - incremento correcto en stock IPRESS.

## Limite deliberado de esta fase

La aceptacion IPRESS implementada es simple: acepta exactamente lo enviado.

No se implemento aun la gestion completa de incidencias cuando lo recibido fisicamente no coincide con lo enviado en sistema. Ese flujo requiere:

- cantidad recibida diferente;
- motivo seleccionado;
- observacion obligatoria;
- registro de diferencia;
- posible estado `OBSERVED`;
- decision posterior de UNGET.

Ese bloque queda para la siguiente fase.

## Siguiente fase recomendada

Fase 13 - Recepcion IPRESS con incidencias:

- permitir aceptar conforme;
- permitir observar por diferencia fisica;
- registrar motivo y observacion;
- definir si la diferencia queda como pendiente de regularizacion por UNGET;
- emitir trazabilidad de la recepcion observada.
