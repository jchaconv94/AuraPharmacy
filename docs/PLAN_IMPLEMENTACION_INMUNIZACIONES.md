# Plan de implementacion - Modulo de Inmunizaciones

Este plan organiza la implementacion del modulo de inmunizaciones por fases cortas, con entregables verificables antes de avanzar. La idea es evitar construir todo de golpe y validar flujo, datos y permisos en cada bloque.

Documento funcional base:

- `docs/INMUNIZACIONES_DISENO_FUNCIONAL.md`

## Avance actual

Primer corte implementado:

- Creado `supabase/SUPABASE_SCHEMA_IMMUNIZATIONS_V1.sql`.
- Agregados tipos y modulos internos de inmunizaciones en `types.ts`.
- Creado `services/immunizationApi.ts`.
- Creadas pantallas base: Catalogo Biologico, Inventario Inicial, Stock Biologico, Reajustes de Stock y Reportes Inmunizaciones.
- Conectadas las pantallas a `App.tsx`.
- Agregado grupo de navegacion "Inmunizaciones" en sidebar y acceso movil.
- Habilitado acceso inmediato a Inmunizaciones para el rol `ADMIN`, incluso antes de actualizar los permisos guardados en Supabase.
- Implementado importador `.xlsx` de inventario inicial: seleccion/arrastre, descarga de plantilla, deteccion de columnas alternativas, cruce con catalogo maestro, vista previa, errores bloqueantes, advertencias y guardado como borrador para usuarios UNGET/IPRESS.
- Implementado detalle del borrador, cierre confirmado mediante modal personalizado y generacion de stock biologico por lote/capa.
- Implementado registro manual de inventario inicial con alta, edicion, eliminacion, validacion contra catalogo y origen mixto Excel/manual.
- Completada vista operativa de Stock Biologico: cada IPRESS ve exclusivamente su stock y cada UNGET el stock de su almacen, con busqueda, alertas de vencimiento y detalle por lote/capa.
- Implementada Fase 8 de Reajustes de Stock: conteo fisico de lotes existentes o no registrados, calculo de diferencias, aplicacion atomica al stock, movimiento auditable, historial con detalle y constancia PDF A4.
- Ejecutada Fase 9 de verificacion tecnica: `npm.cmd run lint`, `npm.cmd run build` y servidor local HTTP 200.
- Registrado informe de verificacion en `docs/FASE_9_VERIFICACION_INMUNIZACIONES.md`. La validacion visual automatizada quedo bloqueada por el conector de navegador, pero el flujo fue validado manualmente por el usuario durante la implementacion.
- Validado `npm run lint`.
- Validado `npm run build`.
- Verificado servidor local por HTTP en `http://127.0.0.1:3000/ToolkitSISMED/`.
- Cerrada Fase 10 con handoff de etapa 1 en `docs/FASE_10_HANDOFF_ETAPA_1_INMUNIZACIONES.md`.
- Iniciada Etapa 2 con Fase 11: modulo `Ingresos UNGET`, permiso `IMMUNIZATION_INCOMES`, migracion `supabase/SUPABASE_MIGRATION_IMMUNIZATION_INCOMES.sql`, servicio API, pantalla operativa e integracion al menu.
- Validada Fase 11 tecnicamente con `npm.cmd run lint` y `npm.cmd run build`.
- Corregida Fase 11: buscador y filtros de historial, alcance supervisor DIRESA/OGESS/ADMIN y formulario responsivo de nuevo ingreso.
- Rediseñado panel de filtros de Ingresos UNGET para evitar descuadres visuales y mejorar lectura operativa.
- Compactado panel de filtros de Ingresos UNGET: busqueda y filtros principales en una sola barra, fechas colapsables.
- Implementada Fase 12: modulo `Distribuciones UNGET`, permiso `IMMUNIZATION_DISTRIBUTIONS`, migracion `supabase/SUPABASE_MIGRATION_IMMUNIZATION_DISTRIBUTIONS.sql`, distribucion UNGET -> IPRESS con FEFO automatico, seleccion manual de lote, validacion de stock, envio con descuento de stock UNGET y recepcion IPRESS basica.
- Validada Fase 12 tecnicamente con `npm.cmd run lint` y `npm.cmd run build`.
- Creado plan UX/UI profesional de inmunizaciones en `docs/UX_PLAN_INMUNIZACIONES.md`.
- Implementada Fase 13: recepcion IPRESS con confirmacion fisica por item/lote, motivo y observacion obligatoria cuando existe diferencia, estado `OBSERVED` y stock IPRESS incrementado solo por lo recibido fisicamente.
- Creada migracion `supabase/SUPABASE_MIGRATION_IMMUNIZATION_RECEPTIONS.sql`.
- Validada Fase 13 tecnicamente con `npm.cmd run lint` y `npm.cmd run build`.
- Cambio funcional 2026-07-27: el flujo ordinario de abastecimiento se replantea. DIRESA sera el responsable principal de digitacion de ingresos regionales y distribuira a UNGET; las UNGET aceptaran esas distribuciones y luego distribuiran a sus IPRESS.
- Implementado refactor regional base: ingresos regionales DIRESA, stock regional, distribucion DIRESA -> UNGET, recepcion UNGET con incidencias, distribucion UNGET -> IPRESS y recepcion IPRESS.
- Separada la administracion de `Origenes de Ingreso` en un submodulo propio, con crear/editar/desactivar/reactivar.
- Iniciada fase de `Consumo IPRESS`: registro por lote existente, descuento inmediato de stock, dosis aplicadas, dosis perdidas y factor de perdida.
- Implementada Fase 15: modulo `Devoluciones y Bajas`, permiso `IMMUNIZATION_RETURNS`, migracion `supabase/SUPABASE_MIGRATION_IMMUNIZATION_RETURNS.sql`, salida IPRESS con FEFO y seleccion manual de lote, recepcion UNGET con diferencias, y regla de no ingreso a stock para bajas no disponibles.
- Implementada Fase 16: modulo `Cierre Mensual`, permiso `IMMUNIZATION_CLOSURES`, migracion `supabase/SUPABASE_MIGRATION_IMMUNIZATION_MONTHLY_CLOSURES.sql`, precierre IPRESS, cierre definitivo UNGET condicionado a todas sus IPRESS precerradas y bloqueo operativo por periodo cerrado.
- Implementada Fase 17: reportes mensuales UNGET en PDF y Excel. Documento de fase: `docs/FASE_17_REPORTE_CONSOLIDADO_UNGET.md`.
- Rediseño 2026-07-30 de la Fase 17: se retira la matriz que mezclaba almacen e IPRESS en la misma fila porque contaba dos veces los traslados internos. Se reemplaza por dos reportes que usan el mismo formato de 19 columnas del movimiento biologico IPRESS: `Movimiento biologico - Almacen UNGET` y `Movimiento biologico consolidado UNGET`.
- Decision 2026-07-30: se descarta el anexo `Detalle por establecimiento` en el consolidado. Generaria cientos de filas por IPRESS, producto y lote, y esa informacion ya existe en el movimiento biologico que emite cada IPRESS. El saldo conjunto de las IPRESS se deduce restando el saldo del almacen al saldo total de la red.
- Agregado `scripts/generateImmunizationReportPreviews.ts` para generar muestras PDF y `.xlsx` de las tres variantes con los mismos builders de la aplicacion.
- Corregido defecto preexistente desde la Fase 16 en el Excel del movimiento biologico: los datos se escribian desde la columna B y las subcabeceras desde la E, corridos una columna, lo que hacia que las formulas apuntaran a celdas equivocadas y apareciera `#VALOR!`. Causa: ExcelJS trata un array literal con `undefined` inicial como contiguo y aplica offset 1. Afectaba tambien al reporte IPRESS.
- Regla incorporada: en el consolidado, la distribucion UNGET -> IPRESS y las devoluciones IPRESS -> UNGET son traslados internos y se anulan. Solo cuentan el ingreso desde DIRESA y las salidas reales por consumo, baja no disponible o deterioro.
- Agregada primera cobertura de pruebas del modulo: `services/immunizationMonthlyReportService.test.ts` y script `npm test`.

- Validacion con datos reales 2026-07-30: verificado contra Supabase que las 15 tablas y las columnas de las migraciones tardias existen, y que los tres reportes cuadran con el stock real. Informe: `docs/VALIDACION_DATOS_REALES_INMUNIZACIONES.md`.
- Corregido defecto encontrado en esa validacion: los registros propiedad de una IPRESS se guardaban con `unget_id` nulo desde `closeInitialInventory` y `createAdjustment`, quedando invisibles para las consultas por UNGET. El consolidado mostraba un reajuste como saldo anterior en vez de ingreso del mes.
- Creado `supabase/SUPABASE_REPAIR_IMMUNIZATION_IPRESS_UNGET_LINK.sql` para vincular las filas ya escritas. Pendiente de ejecutar por el usuario; no es urgente.

- Implementada Fase 18: reportes mensuales regionales DIRESA, almacen regional y consolidado de toda la region, con marcado preliminar/definitivo. Documento de fase: `docs/FASE_18_REPORTE_CONSOLIDADO_DIRESA.md`.
- Regla aplicada en la Fase 18: la distribucion DIRESA -> UNGET pasa a ser traslado interno del consolidado regional, igual que la distribucion UNGET -> IPRESS lo es del consolidado UNGET.
- Refactorizados los cinco reportes sobre dos builders genericos (`buildWarehouseReportRows` y `buildNetworkReportRows`); agregar un nivel nuevo es declarar sus clasificadores.

- Implementada Fase 19: `Reportes Inmunizaciones` deja de ser placeholder y pasa a ser el tablero de avance operativo mensual con alcance por rol. Documento de fase: `docs/FASE_19_TABLERO_AVANCE_OPERATIVO.md`.
- Creado `services/immunizationProgressService.ts` con funciones puras de avance; el modulo de cierre ahora comparte esas definiciones en vez de duplicarlas.
- Ejecutada la reparacion `supabase/SUPABASE_REPAIR_IMMUNIZATION_IPRESS_UNGET_LINK.sql`. Verificado: 0 filas huerfanas.
- Con la Fase 19 queda cubierta la seccion 20 del diseno funcional: consolidado biologico en `Cierre Mensual` y avance operativo en `Reportes Inmunizaciones`.

- Cerrada la deuda UX principal: capa de componentes compartidos en `components/ui/immunization.tsx`, vista de celular en Consumo IPRESS y Distribuciones, y menu movil con panel lateral al 90% y barra inferior sin saturar.
- Implementado el modulo `Consulta de Stock Biologico` con permiso propio `IMMUNIZATION_STOCK_QUERY`. Era el ultimo modulo del plan que quedaba disenado y sin construir.
- Con esto el alcance funcional del plan queda completo.

Siguiente corte recomendado:

- Las migraciones de consumo, devoluciones y cierres mensuales YA estan ejecutadas en Supabase. Verificado el 2026-07-30.
- La Etapa 2 queda funcionalmente completa. Lo que sigue es consolidacion, no construccion nueva:
  1. Validar un periodo real completo con varias IPRESS usando `scripts/validateImmunizationReportsAgainstSupabase.ts`.
  2. Deuda UX pendiente del `docs/UX_PLAN_INMUNIZACIONES.md`: capa de componentes comunes, revision movil y filtros territoriales avanzados.
  4. RLS definitiva, que requiere Supabase Auth o Edge Functions/RPC.

Seguridad, etapa 1 (2026-07-31):

- Detectado que la clave `anon`, publica en el bundle desplegado, permitia leer `public.users` completa incluido `password_hash` de los 64 usuarios.
- Causa: el login comparaba la contrasena en el navegador, asi que necesitaba descargar el hash.
- Corregido: verificacion en el servidor con la funcion `app_verify_password`, lista explicita de columnas `USER_SELECT` en `services/api.ts` y revocacion de la lectura de `password_hash`.
- Scripts aplicados por el usuario, en orden: `supabase/SUPABASE_SEGURIDAD_APLICAR_ESTO.sql`, `..._PASO_2_DATOS.sql`, `..._PASO_3_AMBITO.sql`, `..._PASO_4_RESTO.sql`. Informe: `SEGURIDAD_ETAPA_1_LOGIN.md`.
- Pendiente etapa 2: cerrar la escritura anonima sobre `users` y el resto de tablas; requiere identidad real en el servidor.

## Objetivo de la primera etapa

Construir la base solida del modulo:

1. Catalogo maestro de productos de inmunizaciones.
2. Roles/permisos para perfiles DIRESA, UNGET e IPRESS.
3. Inventario inicial por UNGET/IPRESS.
4. Importacion `.xlsx` de inventario inicial.
5. Registro manual de inventario inicial.
6. Stock biologico agrupado por producto y detallado por lote/capa.
7. Cierre de inventario inicial.
8. Reajustes de stock con auditoria y PDF.

La operacion mensual completa queda para una segunda etapa: ingresos regionales DIRESA, distribucion DIRESA -> UNGET, recepcion UNGET, distribucion UNGET -> IPRESS, recepcion IPRESS, consumos, devoluciones, bajas, precierre/cierre mensual y reportes mensuales.

## Principios de trabajo

- Implementar por incrementos pequenos.
- Validar datos reales con los Excel existentes.
- No romper modulos actuales de farmacia/SISMED.
- Mantener el estilo visual actual del sistema.
- Evitar duplicar logica de permisos: reutilizar `roles_config`, `allowed_modules` y `jurisdiction_level`.
- No permitir stock negativo.
- No permitir productos fuera del catalogo maestro.
- Registrar auditoria en movimientos criticos.
- Mantener el stock real por lote, vencimiento, precio, fuente y tipo de suministro.

## Fase 0 - Preparacion tecnica

### 0.1 Revisar estado actual del proyecto

Acciones:

- Revisar estructura actual.
- Identificar patrones de componentes existentes.
- Confirmar flujo de autenticacion actual.
- Revisar servicios `api.ts`, tipos en `types.ts` y modulos del menu.
- Confirmar que el servidor Vite levanta correctamente.

Validacion:

- Proyecto compila o se identifican errores previos.
- Se confirma URL local de trabajo.
- Se confirma si hay cambios no relacionados que no se deben tocar.

Entregable:

- Nota tecnica breve antes de empezar cambios grandes.

### 0.2 Definir estrategia de seguridad

Decision inicial:

- Para la primera implementacion se aplicara control de alcance en frontend y servicios API.
- Las tablas nuevas deben quedar preparadas para RLS real.
- RLS definitivo requerira Supabase Auth o Edge Functions/RPC seguras, porque el proyecto actual usa autenticacion propia.

Validacion:

- Confirmar que esta estrategia es aceptable para desarrollo inicial.

## Fase 1 - Modelo de datos y migracion Supabase

### 1.1 Crear esquema SQL inicial

Tablas propuestas para etapa 1:

- `immunization_products`
- `immunization_initial_inventories`
- `immunization_initial_inventory_items`
- `immunization_stock_layers`
- `immunization_stock_movements`
- `immunization_adjustments`
- `immunization_adjustment_items`

Campos base:

`immunization_products`

- id
- codigo_sismed
- descripcion
- tipo_producto
- dosis_unidad
- is_active
- observacion
- created_by
- updated_by
- created_at
- updated_at

`immunization_initial_inventories`

- id
- owner_type: `UNGET` o `IPRESS`
- unget_id
- facility_code
- period
- status: `DRAFT`, `CLOSED`
- source_type: `MANUAL`, `EXCEL`, `MIXED`
- created_by
- closed_by
- closed_at
- created_at
- updated_at

`immunization_initial_inventory_items`

- id
- inventory_id
- product_id
- codigo_sismed_snapshot
- excel_description_snapshot
- lote
- expiration_date
- quantity
- unit_price
- funding_source
- supply_type
- observation

`immunization_stock_layers`

- id
- owner_type
- unget_id
- facility_code
- product_id
- lote
- expiration_date
- unit_price
- funding_source
- supply_type
- source_movement_id
- current_quantity
- is_active
- created_at
- updated_at

`immunization_stock_movements`

- id
- movement_type
- owner_type
- unget_id
- facility_code
- product_id
- stock_layer_id
- quantity_delta
- quantity_before
- quantity_after
- period
- reason
- observation
- created_by
- created_at

`immunization_adjustments`

- id
- owner_type
- unget_id
- facility_code
- period
- status
- reason
- observation
- created_by
- created_at

`immunization_adjustment_items`

- id
- adjustment_id
- product_id
- stock_layer_id
- lote
- expiration_date
- system_quantity
- physical_quantity
- difference_quantity
- unit_price
- funding_source
- supply_type

Validacion:

- Revisar SQL antes de ejecutarlo.
- Confirmar nombres de columnas.
- Confirmar que no interfieren con tablas actuales.

Entregable:

- Nuevo archivo `supabase/SUPABASE_SCHEMA_IMMUNIZATIONS_V1.sql`.

### 1.2 Cargar catalogo inicial

Acciones:

- Extraer productos desde los Excel de movimiento biologico.
- Normalizar codigo SISMED, descripcion y dosis/unidad.
- Clasificar tipo: vacuna, jeringa, diluyente.
- Preparar inserciones iniciales.

Validacion con usuario:

- Revisar lista del catalogo inicial antes de cargar.
- Confirmar codigos dudosos o duplicados.

Entregable:

- Script SQL o archivo de carga inicial del catalogo.

## Fase 2 - Tipos, permisos y navegacion

### 2.1 Agregar tipos TypeScript

Actualizar:

- `types.ts`

Agregar:

- tipos de producto de inmunizaciones.
- tipos de stock layer.
- tipos de inventario inicial.
- tipos de importacion.
- tipos de reajuste.
- nuevos `AppModule`.

Nombres internos propuestos:

- `IMMUNIZATION_CATALOG`
- `IMMUNIZATION_INITIAL_INVENTORY`
- `IMMUNIZATION_STOCK`
- `IMMUNIZATION_ADJUSTMENTS`
- `IMMUNIZATION_REPORTS`

Validacion:

- `npm run lint` o `tsc --noEmit`.

### 2.2 Agregar permisos al sistema

Actualizar:

- `AVAILABLE_MODULES` en `types.ts`.
- `Sidebar.tsx`.
- `MobileNav.tsx`, si aplica.
- permisos iniciales en `roles_config`.

Regla:

- DIRESA: catalogo, stock consulta, reportes.
- UNGET: inventario, stock, reajustes.
- IPRESS: inventario, stock, reajustes.

Validacion:

- Login con usuarios de distintos roles.
- Confirmar que cada rol ve solo sus modulos.

## Fase 3 - Servicios API y reglas de alcance

### 3.1 Crear servicios de inmunizaciones

Opcion recomendada:

- Separar en `services/immunizationApi.ts` para no seguir creciendo `services/api.ts`.

Funciones iniciales:

- `getImmunizationProducts`
- `saveImmunizationProduct`
- `toggleImmunizationProduct`
- `getInitialInventory`
- `createInitialInventory`
- `saveInitialInventoryItems`
- `closeInitialInventory`
- `getImmunizationStock`
- `createStockAdjustment`
- `getAdjustmentPdfData`

Validacion:

- Servicios devuelven datos normalizados al estilo del proyecto.
- Errores se devuelven con mensajes claros para UI.

### 3.2 Implementar guardas de alcance

Reglas:

- DIRESA lee todo, no escribe stock.
- UNGET solo opera su `unget_id`.
- IPRESS solo opera su `facility_code`.

Validacion:

- Probar que un usuario UNGET no puede consultar/guardar inventario de otra UNGET.
- Probar que una IPRESS no puede consultar/guardar otra IPRESS.

## Fase 4 - Catalogo Biologico

### 4.1 Pantalla principal

Componentes sugeridos:

- `components/ImmunizationCatalogModule.tsx`

Vista:

- Buscador.
- Filtro por tipo: vacuna, jeringa, diluyente.
- Filtro activo/inactivo.
- Tabla compacta con codigo, descripcion, tipo, dosis/unidad, estado.
- Acciones: crear, editar, activar/desactivar.

Validacion:

- Crear producto.
- Editar descripcion/dosis.
- Desactivar producto.
- Confirmar que productos inactivos no pasan importacion.

### 4.2 Modal de producto

Campos:

- codigo SISMED.
- descripcion oficial.
- tipo.
- dosis/unidad.
- observacion.
- activo.

Reglas:

- codigo SISMED unico.
- descripcion obligatoria.
- dosis/unidad obligatoria.

Validacion con usuario:

- Revisar si el formulario es claro.
- Confirmar si los nombres y etiquetas son correctos para inmunizaciones.

## Fase 5 - Importador de inventario inicial

### 5.1 Parser `.xlsx`

Crear logica para:

- leer `.xlsx`;
- detectar columnas por nombres alternativos;
- normalizar valores;
- convertir fechas Excel o texto;
- validar filas;
- cruzar codigo SISMED contra catalogo maestro.

Columnas obligatorias:

- codigo SISMED.
- lote.
- fecha de vencimiento.
- saldo fisico.
- precio unitario.
- fuente de financiamiento.
- tipo de suministro.

Validacion:

- Probar con los archivos reales de referencia.
- Probar errores: producto fuera de catalogo, lote vacio, fecha invalida, saldo negativo.

### 5.2 Vista de previsualizacion

Pantalla:

- resumen de filas validas.
- errores bloqueantes.
- advertencias.
- total valorizado.
- productos encontrados.
- productos no encontrados.

Acciones:

- cancelar.
- descargar/ver errores.
- confirmar importacion si no hay errores criticos.

Validacion con usuario:

- Revisar una importacion real antes de guardar en Supabase.

## Fase 6 - Inventario Inicial

### 6.1 Pantalla de inventario inicial

Componente sugerido:

- `components/ImmunizationInitialInventoryModule.tsx`

Vista:

- estado del inventario: no iniciado, borrador, cerrado.
- periodo inicial.
- propietario: UNGET o IPRESS segun usuario.
- acciones: importar Excel, registro manual, revisar inventario, cerrar inventario.

Validacion:

- Usuario UNGET crea inventario de su UNGET.
- Usuario IPRESS crea inventario de su IPRESS.
- DIRESA solo consulta.

### 6.2 Registro manual

Formulario:

- producto del catalogo.
- lote.
- vencimiento.
- saldo.
- precio.
- fuente financiamiento.
- tipo suministro.
- observacion.

Validacion:

- No permite producto inactivo.
- No permite saldo negativo.
- No permite fecha invalida.

### 6.3 Cierre de inventario inicial

Al cerrar:

- bloquear edicion directa.
- generar stock layers.
- generar movimientos de tipo `INITIAL_INVENTORY`.
- marcar periodo inicial.

Validacion con usuario:

- Revisar resumen antes de cerrar.
- Confirmar que stock agrupado coincide con el inventario cargado.

## Fase 7 - Stock Biologico

Alcance de esta pantalla:

- Es un modulo de control operativo, no de supervision territorial.
- Una IPRESS ve unicamente el stock de su establecimiento.
- Una UNGET ve unicamente el stock de su propio almacen.
- No muestra columnas de ubicacion o ambito porque el propietario del stock ya esta definido por la sesion.
- ADMIN puede seleccionar una sola UNGET o IPRESS para soporte, sin mezclar ni consolidar existencias.
- DIRESA no opera stock desde esta pantalla.

### 7.1 Vista agrupada por producto

Componente sugerido:

- `components/ImmunizationStockModule.tsx`

Vista principal:

- periodo.
- resumen superior: productos, lotes, total frascos/unidades, valorizacion, vencidos/proximos a vencer.
- lista agrupada por codigo SISMED.
- expansion por lote/capa.

Desktop:

- tabla compacta.
- panel lateral de detalle.

Mobile:

- tarjetas expandibles.
- acciones grandes.

Validacion:

- Totales por producto correctos.
- Detalle por lote correcto.
- Valorizacion por capa correcta.

### 7.2 Alertas de vencimiento

Estados:

- vencido.
- vence en menos de 40 dias.
- vence en 3 meses.
- vigente.

Validacion:

- Comparar comportamiento con referencia de colores de Excel.

### 7.3 Modulo separado: Consulta de Stock Biologico

Se implementara como pantalla independiente de la existencia operativa.

- UNGET podra consultar el stock de las IPRESS pertenecientes exclusivamente a su jurisdiccion.
- DIRESA podra consultar todas las UNGET e IPRESS de la region.
- Filtros: UNGET, IPRESS, codigo/descripcion, lote, tipo de producto y vencimiento.
- Vistas: detalle por establecimiento, consolidado por UNGET y consolidado regional.
- La consulta sera de solo lectura y no permitira registrar ni modificar movimientos.
- Los permisos propuestos seran independientes de `Stock Biologico` para evitar que un perfil supervisor opere existencias por error.

## Fase 8 - Reajustes de Stock

Estado: implementada y validada tecnicamente. Pendiente ejecutar la migracion atomica en Supabase y realizar la validacion funcional con datos reales.

### 8.1 Herramienta de descuadre/reajuste

Componente sugerido:

- `components/ImmunizationAdjustmentsModule.tsx`

Flujo:

- elegir producto/lote/capa.
- mostrar stock sistema.
- ingresar stock fisico contado.
- calcular diferencia.
- permitir `Corregir datos` cuando producto, lote, vencimiento, precio, fuente o suministro fisico no coincidan con la capa del sistema.
- registrar el descruce como dos movimientos enlazados: salida del registro incorrecto y entrada al registro fisico correcto, sin perder la trazabilidad.
- permitir reclasificacion total o parcial e incluir una diferencia neta de cantidad si el conteo fisico tambien difiere.
- pedir motivo y observacion si hay diferencia.
- confirmar.

Motivos sugeridos:

- sobrante fisico.
- faltante fisico.
- lote no registrado encontrado.
- lote registrado no encontrado.
- vencimiento distinto.
- correccion por error de digitacion.
- merma/deterioro.
- otro.

Validacion:

- Ajuste positivo aumenta stock.
- Ajuste negativo disminuye stock.
- No deja saldo negativo.
- Registra movimiento y auditoria.

### 8.2 PDF de reajuste

Crear plantilla:

- Constancia de Reajuste de Stock Biologico.
- A4 vertical.
- datos generales.
- tabla antes/despues.
- motivo/observacion.
- auditoria.
- firmas.

Validacion con usuario:

- Generar PDF de prueba y revisar formato.

## Fase 9 - Verificacion tecnica y visual

### 9.1 Pruebas de build

Ejecutar:

- `npm run lint`
- `npm run build`

Validacion:

- Sin errores TypeScript.
- Build exitoso.

### 9.2 Prueba local en navegador

Acciones:

- levantar Vite.
- probar login.
- revisar menu.
- probar catalogo.
- probar importacion.
- probar inventario.
- probar stock.
- probar reajuste.

Validacion:

- Capturar errores de consola.
- Ajustar UI responsiva.

Estado 2026-07-22:

- `npm.cmd run lint`: aprobado.
- `npm.cmd run build`: aprobado.
- Servidor local: HTTP 200 en `http://127.0.0.1:3000/ToolkitSISMED/`.
- Informe: `docs/FASE_9_VERIFICACION_INMUNIZACIONES.md`.
- Validacion visual manual: aceptada por el usuario durante la implementacion. No esta 100% personalizada, pero funciona para el alcance necesario.
- Limitacion: el conector automatizado de navegador no pudo iniciar.

## Fase 10 - Handoff de etapa 1

Estado 2026-07-22:

- Fase cerrada.
- Documento de entrega: `docs/FASE_10_HANDOFF_ETAPA_1_INMUNIZACIONES.md`.
- La Etapa 1 queda aceptada como base funcional para iniciar la Etapa 2.

Entregables:

- SQL de migracion.
- Catalogo inicial.
- Modulos UI etapa 1.
- Servicios API.
- Importador `.xlsx`.
- Stock biologico agrupado por producto/lote.
- Reajustes auditados.
- PDF de reajuste.
- Validacion local.

Checklist de cierre:

- Catalogo maestro funciona: validado como base.
- Inventario inicial manual funciona: validado como base.
- Inventario inicial por Excel funciona: validado como base, incluyendo importacion parcial de filas validas.
- Cierre de inventario genera stock: validado como base.
- Stock se ve agrupado y por lote: validado como base.
- Reajuste modifica stock con auditoria: validado tecnicamente y disponible para prueba real.
- PDF se genera: implementado.
- Roles muestran modulos correctos: base implementada; pendiente validar con usuarios reales en Supabase.
- Usuario no puede operar fuera de su alcance: base implementada; pendiente reforzar/validar RLS definitiva segun autenticacion real.

## Segunda etapa - Operacion mensual

Estado: iniciada el 2026-07-22 con la Fase 11.

Revision funcional 2026-07-27:

- Se cambia el flujo ordinario de abastecimiento.
- Antes: UNGET registraba ingresos y distribuia a IPRESS.
- Ahora: DIRESA registra ingresos regionales, distribuye a UNGET y cada UNGET acepta la recepcion. Luego la UNGET distribuye a sus IPRESS y cada IPRESS acepta la recepcion.
- Consecuencia tecnica: las Fases 11, 12 y 13 ya implementadas sirven como base de UI/API, pero deben refactorizarse para soportar origen/destino generico y stock regional DIRESA.

Orden recomendado:

1. Refactor de stock regional DIRESA. Siguiente fase recomendada como Fase 14.
2. Ingresos regionales DIRESA. Reemplaza el enfoque anterior de ingresos UNGET.
3. Distribucion DIRESA -> UNGET con FEFO.
4. Recepcion UNGET con incidencias.
5. Distribucion UNGET -> IPRESS con FEFO.
6. Recepcion IPRESS con incidencias.
7. Consumo IPRESS por lote.
8. Bajas por vencido/deteriorado/ruptura.
9. Devoluciones y transferencias IPRESS -> UNGET.
10. Precierre IPRESS.
11. Revision y cierre definitivo UNGET.
12. Reportes DIRESA parciales y definitivos.

Cada bloque debe tener validacion funcional antes de avanzar al siguiente.

## Fase 11 - Ingresos nuevos UNGET

Estado 2026-07-22:

- Implementado bajo el modelo anterior.
- Estado 2026-07-27: requiere refactor para convertirse en `Ingresos Regionales DIRESA`.
- Documento de fase: `docs/FASE_11_INGRESOS_UNGET.md`.
- Validacion tecnica: `npm.cmd run lint` aprobado y `npm.cmd run build` aprobado.
- Correccion de UI/consulta: buscador, filtros por periodo/fecha/estado/origen/UNGET, vista supervisora y formulario responsivo.

Entregables:

- Permiso `IMMUNIZATION_INCOMES`.
- Pantalla `components/ImmunizationIncomesModule.tsx`.
- Migracion `supabase/SUPABASE_MIGRATION_IMMUNIZATION_INCOMES.sql`.
- API en `services/immunizationApi.ts` para crear, listar, detallar y aplicar ingresos.
- Integracion en `App.tsx`, `Sidebar.tsx` y `MobileNav.tsx`.

Reglas implementadas:

- Solo una UNGET puede registrar ingresos operativos.
- ADMIN puede seleccionar una UNGET para soporte.
- DIRESA/OGESS/ADMIN pueden consultar ingresos con filtros avanzados.
- IPRESS no registra ingresos UNGET.
- El ingreso puede contener varios productos/lotes.
- Cada producto debe existir en el catalogo maestro.
- Al aplicar el ingreso se incrementa el stock de la UNGET por lote/capa.
- Se registra movimiento auditable `UNGET_INCOME`.

Pendiente funcional:

- No ejecutar esta migracion como flujo definitivo sin antes aplicar el refactor.
- Cambiar permiso operativo de ingresos desde `INMU_UNGET` hacia `INMU_DIRESA`.
- Convertir el ingreso para que incremente stock regional DIRESA, no stock UNGET.

## Fase 12 - Distribucion UNGET -> IPRESS

Estado 2026-07-22:

- Implementado bajo el modelo anterior.
- Estado 2026-07-27: requiere refactor para soportar distribucion jerarquica `DIRESA -> UNGET` y `UNGET -> IPRESS`.
- Documento de fase: `docs/FASE_12_DISTRIBUCION_UNGET_IPRESS.md`.
- Validacion tecnica: `npm.cmd run lint` aprobado y `npm.cmd run build` aprobado.

Entregables:

- Permiso `IMMUNIZATION_DISTRIBUTIONS`.
- Pantalla `components/ImmunizationDistributionsModule.tsx`.
- Migracion `supabase/SUPABASE_MIGRATION_IMMUNIZATION_DISTRIBUTIONS.sql`.
- API en `services/immunizationApi.ts` para crear, listar, detallar, enviar y aceptar recepcion basica.
- Integracion en `App.tsx`, `Sidebar.tsx` y `MobileNav.tsx`.

Reglas implementadas:

- UNGET distribuye solo a IPRESS de su misma UNGET.
- Distribucion con varios productos/lotes.
- FEFO automatico por defecto.
- Opcion manual para elegir lote.
- Validacion contra stock disponible.
- Envio descuenta stock UNGET y registra movimiento `UNGET_DISTRIBUTION_OUT`.
- Recepcion coincidente IPRESS incrementa stock IPRESS y registra movimiento `IPRESS_DISTRIBUTION_IN`.
- DIRESA/OGESS/ADMIN consultan con filtros; no operan stock desde esta pantalla.

Pendiente funcional:

- No ejecutar esta migracion como flujo definitivo sin antes aplicar el refactor.
- Asignar permisos a roles reales.
- Validar con datos reales de una UNGET y una IPRESS.
- Ejecutar tambien `supabase/SUPABASE_MIGRATION_IMMUNIZATION_RECEPTIONS.sql` para habilitar recepcion con incidencias en Supabase.

## Fase 13 - Recepcion IPRESS con incidencias

Estado 2026-07-22:

- Implementado bajo el modelo anterior.
- Estado 2026-07-27: la logica debe generalizarse para que tambien sirva en recepcion UNGET desde DIRESA.
- Documento de fase: `docs/FASE_13_RECEPCION_IPRESS_INCIDENCIAS.md`.
- Validacion tecnica: `npm.cmd run lint` aprobado y `npm.cmd run build` aprobado.

Entregables:

- Tipos `ImmunizationReceptionReason`, `ImmunizationReceptionItemInput` e `ImmunizationReceptionInput`.
- Modal de recepcion IPRESS en `components/ImmunizationDistributionsModule.tsx`.
- API `receiveDistributionBatch` ampliada para recibir detalle por item/lote.
- Migracion `supabase/SUPABASE_MIGRATION_IMMUNIZATION_RECEPTIONS.sql`.

Reglas implementadas:

- La IPRESS confirma la cantidad fisica recibida por item/lote.
- Si todo coincide, la distribucion queda `RECEIVED`.
- Si existe diferencia, la distribucion queda `OBSERVED`.
- Si existe diferencia, el sistema exige motivo seleccionado y observacion escrita.
- Si la cantidad coincide pero existe incidencia fisica por lote, vencimiento, deterioro u otro dato, el usuario puede marcar la recepcion como observada.
- El stock IPRESS sube solo con la cantidad fisica recibida.
- No se permiten cantidades negativas.
- Si la cantidad recibida de un item es `0`, no se crea capa de stock vacia.

Pendiente funcional:

- No ejecutar esta migracion como flujo definitivo sin antes aplicar el refactor de distribuciones.
- Validar con usuario UNGET el envio de una distribucion.
- Validar con usuario IPRESS una recepcion conforme.
- Validar con usuario IPRESS una recepcion observada por faltante/sobrante.
- Verificar historial y stock resultante con datos reales.

## Fase 14 - Refactor de abastecimiento regional DIRESA -> UNGET

Estado 2026-07-27:

- Planificada.
- Debe ejecutarse antes de consumo IPRESS.
- Documento de fase: `docs/FASE_14_REFACTOR_ABASTECIMIENTO_REGIONAL.md`.

Objetivo:

- Convertir el flujo ya construido en un modelo jerarquico de abastecimiento.
- DIRESA registra ingresos regionales y distribuye a UNGET.
- UNGET acepta recepciones desde DIRESA.
- UNGET distribuye a IPRESS.
- IPRESS acepta recepciones desde UNGET.

Entregables previstos:

- Incorporar owner/ambito regional en stock biologico.
- Iniciar con un unico almacen regional DIRESA, dejando el modelo preparado para multiples almacenes regionales futuros.
- Renombrar funcionalmente `Ingresos UNGET` a `Ingresos Regionales`.
- Crear o adaptar modulo `Distribucion Regional` para DIRESA -> UNGET.
- Usar matriz asistida por producto para distribucion regional y distribucion a IPRESS: destinos en filas, cantidades en celdas, FEFO visible, resumen fijo, buscador de destino y opcion de copiar cantidades.
- Generalizar distribuciones para manejar:
  - origen DIRESA, destino UNGET;
  - origen UNGET, destino IPRESS.
- Generalizar recepciones con incidencias para:
  - recepcion UNGET;
  - recepcion IPRESS.
- Revisar permisos:
  - `INMU_DIRESA`: ingresos regionales, stock regional, distribucion regional, reportes.
  - `INMU_UNGET`: recepcion desde DIRESA, stock propio, distribucion a IPRESS, cierre.
  - `INMU_IPRESS`: recepcion desde UNGET, consumo, bajas, reajustes.
- Crear migracion de refactor para Supabase.
- Mantener trazabilidad por lote, vencimiento, precio, fuente y tipo de suministro.
- Mantener reajustes auditados para UNGET e IPRESS; en UNGET el reajuste no se considera ingreso ordinario sino correccion de stock fisico.

Validacion esperada:

- DIRESA registra ingreso regional y stock regional aumenta.
- DIRESA distribuye a una UNGET y stock regional disminuye.
- UNGET ve distribucion pendiente y acepta conforme u observada.
- Stock UNGET aumenta solo con cantidad fisica recibida.
- UNGET distribuye a IPRESS usando su stock aceptado.
- IPRESS acepta conforme u observada.
- Stock IPRESS aumenta solo con cantidad fisica recibida.
