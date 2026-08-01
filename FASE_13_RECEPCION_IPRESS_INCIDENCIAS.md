# Fase 13 - Recepcion IPRESS con incidencias

Fecha: 2026-07-22

## Objetivo

Completar la recepcion de distribuciones UNGET -> IPRESS para que la IPRESS no solo acepte lo enviado, sino que confirme el conteo fisico real por item/lote y registre incidencias cuando exista diferencia.

## Entregables implementados

- Modal de recepcion IPRESS en `components/ImmunizationDistributionsModule.tsx`.
- API ampliada en `services/immunizationApi.ts`.
- Tipos nuevos en `types.ts`:
  - `ImmunizationReceptionReason`.
  - `ImmunizationReceptionItemInput`.
  - `ImmunizationReceptionInput`.
- Nueva migracion Supabase:
  - `SUPABASE_MIGRATION_IMMUNIZATION_RECEPTIONS.sql`.

## Reglas implementadas

- La recepcion solo aplica a distribuciones en estado `SENT`.
- La IPRESS confirma la cantidad fisica recibida por cada item/lote.
- Si la cantidad fisica coincide con lo enviado:
  - la distribucion queda en estado `RECEIVED`;
  - se incrementa el stock IPRESS;
  - se registra movimiento `IPRESS_DISTRIBUTION_IN`.
- Si existe diferencia fisica:
  - el sistema exige motivo seleccionado;
  - el sistema exige observacion escrita;
  - la distribucion queda en estado `OBSERVED`;
  - se incrementa el stock IPRESS solo con la cantidad fisica recibida;
  - se registra movimiento auditable indicando recepcion observada.
- Tambien se puede marcar una incidencia aunque la cantidad coincida, por ejemplo cuando el lote, vencimiento, estado fisico u otro dato no coincide con lo recibido.
- No se permiten cantidades negativas.
- Si un item se recibe con cantidad fisica `0`, no se crea una capa vacia de stock.

## Motivos de incidencia disponibles

- Faltante fisico.
- Sobrante fisico.
- Lote no coincide.
- Vencimiento no coincide.
- Producto deteriorado.
- Otro motivo.

## UX implementado

- Boton `Recepcionar` para IPRESS cuando la distribucion esta pendiente.
- Modal enfocado en conteo fisico recibido.
- Resumen visual de periodo, cantidad enviada y cantidad recibida.
- Tabla por item/lote con:
  - codigo SISMED;
  - producto;
  - lote y vencimiento;
  - cantidad enviada;
  - cantidad fisica recibida;
  - diferencia calculada.
- Si hay diferencia, aparece bloque de incidencia con motivo y observacion obligatoria.
- Si la cantidad coincide pero existe observacion fisica, el usuario puede activar manualmente `Registrar incidencia de recepcion`.
- Si no hay diferencia, se muestra confirmacion de recepcion conforme.

## Migracion requerida

Ejecutar en Supabase despues de la migracion de distribuciones:

```sql
SUPABASE_MIGRATION_IMMUNIZATION_RECEPTIONS.sql
```

Esta migracion reemplaza el RPC `receive_immunization_distribution` para aceptar detalle por item, motivo y observacion de recepcion.

## Validacion tecnica

- `npm.cmd run lint`: aprobado.
- `npm.cmd run build`: aprobado.

Observacion:

- El build mantiene una advertencia no bloqueante de Vite por tamano de bundle mayor a 500 kB. No corresponde a esta fase y la aplicacion compila correctamente.

## Pendiente funcional

- Ejecutar `SUPABASE_MIGRATION_IMMUNIZATION_RECEPTIONS.sql` en Supabase.
- Probar con usuario `INMU_UNGET`:
  - enviar una distribucion.
- Probar con usuario `INMU_IPRESS`:
  - recepcionar conforme.
  - recepcionar con faltante.
  - recepcionar con cantidad 0 en un item.
  - verificar que el stock IPRESS suba solo con lo recibido fisicamente.
- Verificar que el historial muestre estado `OBSERVED` cuando corresponde.

## Siguiente fase recomendada

Fase 14 - Consumo IPRESS por lote:

- registrar consumo por frasco/unidad;
- registrar dosis aplicadas;
- calcular dosis perdidas y factor de perdida;
- descontar exclusivamente lotes existentes en el stock IPRESS;
- permitir registros varias veces durante el mes;
- preparar consolidado mensual para precierre.
