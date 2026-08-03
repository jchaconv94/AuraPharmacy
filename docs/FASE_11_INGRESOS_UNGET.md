# Fase 11 - Ingresos nuevos UNGET

Fecha: 2026-07-22

## Estado

Implementado y validado tecnicamente.

Esta fase inicia la Etapa 2 de operacion mensual del modulo de inmunizaciones.

## Alcance implementado

- Nuevo modulo `Ingresos UNGET`.
- Nuevo permiso interno `IMMUNIZATION_INCOMES`.
- Registro de ingresos solo para stock operativo de UNGET.
- Soporte para varios productos/lotes en un solo ingreso.
- Buscador de producto por codigo SISMED o descripcion.
- Origen del ingreso:
  - OGESS / abastecimiento regular.
  - Transferencia de otra UNGET.
  - Otro origen.
- Campo opcional de documento o referencia.
- Observacion general del ingreso.
- Observacion por producto/lote.
- Aplicacion del ingreso al stock biologico por lote/capa.
- Movimiento auditable en `immunization_stock_movements` con tipo `UNGET_INCOME`.
- Historial de ingresos con detalle expandible.
- Reaplicacion de borradores si el ingreso se guardo pero no pudo aplicarse por falta de migracion/RPC.
- Buscador y filtros de historial:
  - texto libre;
  - periodo mensual;
  - rango de fechas;
  - estado;
  - origen;
  - UNGET, para perfiles supervisores.
- Alcance de consulta:
  - UNGET ve sus propios ingresos.
  - DIRESA/OGESS/ADMIN pueden consultar ingresos con filtros avanzados.
- Formulario de nuevo ingreso ajustado a grilla responsiva para evitar desbordes horizontales.

## Archivos agregados

- `components/ImmunizationIncomesModule.tsx`
- `supabase/SUPABASE_MIGRATION_IMMUNIZATION_INCOMES.sql`

## Archivos modificados

- `types.ts`
- `services/api.ts`
- `services/immunizationApi.ts`
- `App.tsx`
- `components/Sidebar.tsx`
- `components/MobileNav.tsx`
- `docs/PLAN_IMPLEMENTACION_INMUNIZACIONES.md`

## Base de datos

Nueva migracion requerida:

- `supabase/SUPABASE_MIGRATION_IMMUNIZATION_INCOMES.sql`

Crea:

- `immunization_income_batches`
- `immunization_income_items`
- funcion RPC `apply_immunization_income`

La RPC aplica el ingreso de forma atomica:

1. bloquea la cabecera del ingreso;
2. valida que este en estado `DRAFT`;
3. valida que tenga items;
4. busca o crea la capa de stock UNGET;
5. incrementa `current_quantity`;
6. registra movimiento `UNGET_INCOME`;
7. vincula el item con la capa de stock;
8. marca la cabecera como `APPLIED`.

## Validacion ejecutada

- `npm.cmd run lint`: aprobado.
- `npm.cmd run build`: aprobado.

Correccion posterior aplicada:

- `npm.cmd run lint`: aprobado.
- `npm.cmd run build`: aprobado.
- Se corrigio la vista de historial con filtros y el formulario descuadrado.
- Se redisenó el panel de filtros con una estructura profesional: encabezado, filtros principales alineados, rango de fechas agrupado y resumen de resultados.
- Se compacto el panel de filtros a una barra de una sola fila; el rango de fechas queda colapsado en el boton `Fechas` para reducir el espacio vertical.

Observacion:

- El build mantiene el warning de bundle grande de Vite. No bloquea ejecucion.

## Pendientes antes de probar con Supabase real

- Ejecutar `supabase/SUPABASE_MIGRATION_IMMUNIZATION_INCOMES.sql` en Supabase.
- Asignar el permiso `IMMUNIZATION_INCOMES` al rol `INMU_UNGET`.
- Validar con usuario UNGET real que:
  - ve el modulo;
  - puede registrar ingreso;
  - el ingreso suma stock;
  - el stock aparece en `Stock Biologico`;
  - el historial muestra el detalle.

## Siguiente fase

Fase 12 implementada en `docs/FASE_12_DISTRIBUCIONES_UNGET_IPRESS.md`.
