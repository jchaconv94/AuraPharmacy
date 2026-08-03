# Fase 12 - Distribucion UNGET -> IPRESS

Fecha: 2026-07-22

## Objetivo

Implementar el flujo operativo para que una UNGET distribuya productos biologicos a sus IPRESS vinculadas, usando stock existente de la UNGET y respetando la regla de no distribuir fuera de su jurisdiccion.

## Entregables implementados

- Nuevo permiso interno `IMMUNIZATION_DISTRIBUTIONS`.
- Nuevo modulo de menu: `Distribucion`.
- Nueva pantalla: `components/ImmunizationDistributionsModule.tsx`.
- Nueva migracion: `supabase/SUPABASE_MIGRATION_IMMUNIZATION_DISTRIBUTIONS.sql`.
- Tipos nuevos en `types.ts`:
  - `ImmunizationDistributionBatch`.
  - `ImmunizationDistributionItem`.
  - `ImmunizationDistributionStatus`.
  - `ImmunizationDistributionCriterion`.
- API nueva en `services/immunizationApi.ts`:
  - listar distribuciones.
  - consultar detalle.
  - crear distribucion.
  - enviar distribucion.
  - recepcion basica IPRESS.

## Reglas implementadas

- La UNGET solo puede distribuir a IPRESS que pertenezcan a su misma UNGET.
- Una distribucion puede contener varios productos y varios lotes.
- Los productos/lotes se toman desde el stock biologico existente de la UNGET.
- El sistema ofrece asignacion FEFO automatica: primero toma el lote mas proximo a vencer.
- El usuario puede cambiar a modo manual y elegir el lote.
- No permite distribuir cantidades mayores al stock disponible.
- Al enviar:
  - se descuenta el stock de la UNGET.
  - se registra movimiento auditable `UNGET_DISTRIBUTION_OUT`.
  - la distribucion queda en estado `SENT`, pendiente de recepcion IPRESS.
- La IPRESS puede aceptar una recepcion cuando lo recibido coincide.
- Al aceptar:
  - se incrementa el stock IPRESS.
  - se registra movimiento auditable `IPRESS_DISTRIBUTION_IN`.
  - la distribucion pasa a `RECEIVED`.

## Alcance por perfil

- `INMU_UNGET`: registra y envia distribuciones de su UNGET.
- `INMU_IPRESS`: visualiza distribuciones destinadas a su IPRESS y puede aceptar recepcion coincidente.
- `INMU_DIRESA` / `OGESS` / `ADMIN`: consulta historial con filtros por UNGET, IPRESS, periodo, estado, criterio y fechas.
- `ADMIN`: puede seleccionar una UNGET operativa para soporte.

## UX implementado

- Buscador de distribuciones.
- Filtros compactos en una sola barra.
- Filtro de fechas colapsable para no ocupar espacio permanente.
- Buscador de producto por codigo SISMED o descripcion.
- Selector de criterio de distribucion:
  - regular,
  - consumo,
  - disponibilidad,
  - campana,
  - otro.
- Modo de asignacion:
  - `FEFO automatico`,
  - `Elegir lote`.
- Tabla de productos agregados antes de enviar.
- Historial con detalle desplegable por distribucion.

## Migracion requerida

Ejecutar en Supabase:

```sql
supabase/SUPABASE_MIGRATION_IMMUNIZATION_DISTRIBUTIONS.sql
```

La migracion crea:

- `immunization_distribution_batches`.
- `immunization_distribution_items`.
- RPC `send_immunization_distribution`.
- RPC `receive_immunization_distribution`.
- Politicas RLS temporales permisivas.
- Actualizacion de permisos para roles existentes:
  - `ADMIN`,
  - `INMU_UNGET`,
  - `INMU_DIRESA`,
  - `INMU_IPRESS`.

## Validacion tecnica

- `npm.cmd run lint`: aprobado.
- `npm.cmd run build`: aprobado.

Pendiente:

- Ejecutar migracion en Supabase.
- Validar con usuarios reales:
  - UNGET envia a una IPRESS propia.
  - UNGET no puede enviar a una IPRESS de otra UNGET.
  - IPRESS acepta una recepcion coincidente.
  - Stock UNGET baja e IPRESS sube correctamente.

## Limite deliberado de esta fase

La recepcion con diferencia fisica todavia no queda cerrada en esta fase.

Siguiente fase recomendada:

- Fase 13: Recepcion IPRESS con incidencias.
  - motivo seleccionado,
  - observacion escrita,
  - cantidad recibida por item,
  - estado `OBSERVED`,
  - constancia o registro auditable de diferencia,
  - decision de si se acepta parcial o se devuelve a UNGET.
