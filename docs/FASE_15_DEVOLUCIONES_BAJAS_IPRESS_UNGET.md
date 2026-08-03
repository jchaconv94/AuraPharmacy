# Fase 15 - Devoluciones y bajas IPRESS -> UNGET

## Alcance implementado

Se implemento el modulo `Devoluciones y Bajas` para cubrir el flujo operativo desde IPRESS hacia UNGET:

- baja no disponible por vencido, deteriorado, ruptura, cadena de frio u otro motivo;
- devolucion simple hacia UNGET;
- transferencia sugerida hacia otra IPRESS, pasando por UNGET;
- salida inmediata del stock IPRESS;
- recepcion pendiente por la UNGET;
- confirmacion fisica por item;
- observacion obligatoria cuando existe diferencia;
- auditoria mediante movimientos de stock.

## Reglas aplicadas

- Solo una IPRESS con stock disponible puede registrar el movimiento de salida.
- No se permite retirar cantidades superiores al saldo del lote.
- El producto se busca agrupado por codigo/descripcion y el sistema sugiere lote FEFO.
- El usuario puede cambiar el lote manualmente; queda auditado en la observacion del item.
- Las bajas no disponibles no ingresan al stock disponible de la UNGET.
- Las devoluciones y transferencias recibidas si ingresan al stock UNGET, para que luego la UNGET pueda redistribuir.
- La UNGET debe registrar motivo y observacion si la cantidad fisica recibida no coincide con lo reportado.

## Archivos principales

- `components/ImmunizationReturnsModule.tsx`
- `services/immunizationApi.ts`
- `types.ts`
- `supabase/SUPABASE_MIGRATION_IMMUNIZATION_RETURNS.sql`
- `App.tsx`
- `components/Sidebar.tsx`
- `components/MobileNav.tsx`

## Validacion tecnica

- `npm.cmd run lint` ejecutado correctamente.

## Pendientes funcionales

- Derivacion automatica completa desde UNGET hacia la IPRESS destino sugerida.
- PDF/constancia de baja o devolucion.
- Reporte consolidado de bajas/devoluciones por periodo.
- Bloqueo por cierre mensual cuando se implemente la fase de cierres.

## Siguiente fase recomendada

Fase 16 - Cierre mensual / precierre IPRESS:

- IPRESS precierra su periodo cuando ya no tenga recepciones pendientes.
- UNGET visualiza avance de cierre de sus IPRESS.
- UNGET cierra definitivamente cuando todas sus IPRESS esten cerradas.
- DIRESA visualiza avance consolidado.
