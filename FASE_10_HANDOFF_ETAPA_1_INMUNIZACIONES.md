# Fase 10 - Handoff de etapa 1 de Inmunizaciones

Fecha: 2026-07-22

## Estado

Etapa 1 cerrada funcionalmente como base operativa.

El usuario valido manualmente el flujo durante la implementacion. La interfaz aun puede personalizarse mas adelante, pero el sistema funciona para el alcance necesario de esta primera etapa.

## Alcance cerrado en esta etapa

### 1. Catalogo biologico

- Catalogo maestro unico para la DIRESA San Martin.
- Productos identificados por codigo SISMED.
- Descripcion oficial tomada desde el catalogo, no desde los Excel importados.
- Tipo de producto: vacuna, jeringa o diluyente.
- Dosis/unidad registrada como dato propio del producto.
- Bloqueo de productos que no existen en el catalogo durante la importacion de inventario.

### 2. Roles y modulos de inmunizaciones

Roles funcionales considerados:

- `ADMIN`
- `INMU_DIRESA`
- `INMU_UNGET`
- `INMU_IPRESS`

Modulos incorporados o ajustados:

- Catalogo Biologico.
- Inventario Inicial.
- Stock Biologico.
- Reajustes de Stock.
- Reportes Inmunizaciones.
- Stock SISMED, como visor de stock asignado/hojas existentes del sistema SISMED.

Decision importante:

- `Stock Biologico` es para control operativo del stock propio de la UNGET o IPRESS.
- La consulta territorial/consolidada para UNGET/DIRESA debe manejarse en un modulo separado de consulta, no dentro del control operativo.

### 3. Inventario inicial

- Carga de inventario inicial por Excel `.xlsx`.
- Registro manual de producto/lote.
- Buscador de producto por codigo SISMED o descripcion.
- Cruce obligatorio contra catalogo maestro.
- Importacion parcial permitida: guarda filas validas y omite filas con error.
- El Excel puede traer descripcion, pero la descripcion operativa siempre se toma del catalogo maestro.
- El inventario inicial cerrado se convierte en stock biologico por lote/capa.
- Una vez cerrado, el inventario inicial no debe modificarse directamente.

### 4. Stock biologico

- Vista agrupada por producto.
- Detalle por lote/capa.
- Control por:
  - lote;
  - fecha de vencimiento;
  - saldo;
  - precio unitario;
  - fuente de financiamiento;
  - tipo de suministro.
- Alertas de vencimiento.
- Valorizacion del stock.
- Para el usuario de la misma ubicacion no se muestra columna de ubicacion, porque es redundante.

### 5. Reajustes y descruces

El reajuste quedo definido como herramienta auditada de conteo fisico, no solo como aumento/disminucion de cantidad.

Casos soportados:

- diferencia de cantidad entre sistema y fisico;
- lote fisico no registrado;
- lote registrado en sistema pero no encontrado fisicamente;
- correccion/descruce de lote;
- correccion/descruce de vencimiento;
- correccion/descruce de precio;
- correccion/descruce de fuente de financiamiento;
- correccion/descruce de tipo de suministro;
- reclasificacion total o parcial entre una capa incorrecta y una capa fisica correcta.

Regla clave:

- El descruce se registra como salida del registro incorrecto y entrada al registro fisico correcto, enlazadas por una misma operacion de reajuste.

Auditoria:

- Se registra motivo.
- Se registra observacion.
- Se conserva usuario, periodo y fecha.
- Se genera constancia PDF.

### 6. Stock SISMED

Se corrigio la confusion con los modulos de stock:

- `Stock SISMED` queda como visor/consulta de stock SISMED asignado al usuario.
- `Stock Biologico` queda como control interno de inmunizaciones.
- El visor debe mostrar establecimientos/hojas asignadas cuando el usuario de farmacia tiene asignacion de stock.

## Archivos principales

### Base de datos

- `SUPABASE_SCHEMA_IMMUNIZATIONS_V1.sql`
- `SUPABASE_MIGRATION_IMMUNIZATION_ADJUSTMENTS.sql`

### Tipos y servicios

- `types.ts`
- `services/immunizationApi.ts`
- `services/immunizationExcelService.ts`
- `services/immunizationAdjustmentPdfService.ts`

### Pantallas

- `components/ImmunizationCatalogModule.tsx`
- `components/ImmunizationInitialInventoryModule.tsx`
- `components/ImmunizationStockModule.tsx`
- `components/ImmunizationAdjustmentsModule.tsx`
- `components/ImmunizationAdjustmentModal.tsx`
- `components/ImmunizationReportsModule.tsx`
- `components/IpressStockModule.tsx`

### Navegacion

- `components/Sidebar.tsx`
- `components/MobileNav.tsx`
- `App.tsx`

### Documentacion

- `INMUNIZACIONES_DISENO_FUNCIONAL.md`
- `PLAN_IMPLEMENTACION_INMUNIZACIONES.md`
- `FASE_9_VERIFICACION_INMUNIZACIONES.md`
- `FASE_10_HANDOFF_ETAPA_1_INMUNIZACIONES.md`

## Verificacion realizada

- `npm.cmd run lint`: aprobado.
- `npm.cmd run build`: aprobado.
- Servidor local verificado por HTTP 200 en `http://127.0.0.1:3000/ToolkitSISMED/`.
- Validacion manual realizada por el usuario durante la implementacion.

Limitacion:

- La validacion visual automatizada no se pudo ejecutar porque el conector de navegador del entorno fallo al iniciar.
- No hay Playwright, `@playwright/test` ni Puppeteer instalados en el proyecto.

## Pendientes controlados antes de produccion

- Ejecutar en Supabase los SQL pendientes si aun no fueron aplicados.
- Validar con usuarios reales los roles `INMU_DIRESA`, `INMU_UNGET` e `INMU_IPRESS`.
- Cargar o depurar el catalogo inicial real de productos de inmunizaciones.
- Revisar politicas RLS definitivas segun el modelo de autenticacion real del proyecto.
- Personalizar mas la interfaz segun uso operativo real.

## Criterio de entrada a etapa 2

La base queda lista para iniciar la operacion mensual.

Orden recomendado:

1. Ingresos nuevos UNGET.
2. Distribucion UNGET -> IPRESS con FEFO/FIFO sugerido.
3. Recepcion IPRESS e incidencias por diferencias fisicas.
4. Consumo IPRESS por lote, frasco y dosis aplicadas.
5. Bajas por vencido, deteriorado o ruptura.
6. Devoluciones y transferencias IPRESS -> UNGET.
7. Precierre IPRESS.
8. Revision y cierre definitivo UNGET.
9. Reportes DIRESA parciales y definitivos.

## Decision de cierre

Se cierra la Etapa 1 como base funcional suficiente para avanzar.

Los ajustes visuales finos y personalizaciones de experiencia quedan para iteraciones posteriores, sin bloquear el inicio de la Etapa 2.
