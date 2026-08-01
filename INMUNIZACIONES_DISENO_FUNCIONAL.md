# Modulo de Inmunizaciones - Diseno funcional

Este documento resume los acuerdos funcionales para implementar el modulo web de control de productos de inmunizaciones en ToolKit SISMED Web.

El objetivo es reemplazar progresivamente el manejo en Excel de movimientos biologicos por un modulo web ordenado, trazable, responsivo y basado en stock real por producto, lote, vencimiento y precio.

## 1. Contexto general

La herramienta sera usada inicialmente solo para DIRESA San Martin.

En el sistema:

- RED equivale a UNGET.
- DIRESA administra el catalogo maestro y sera el punto inicial de digitacion operativa de vacunas para abastecimiento regional.
- DIRESA manejara stock regional operativo para distribuir productos biologicos a las UNGET.
- OGESS puede mantenerse como dato administrativo de origen/referencia, pero el flujo operativo digitado en el sistema iniciara en DIRESA.
- UNGET maneja stock operativo recibido desde DIRESA y distribuye a sus IPRESS.
- IPRESS recibe, consume, ajusta y reporta stock por lote.

El sistema debe trabajar con productos biologicos, diluyentes y jeringas.

## 2. Principio clave del modelo

Se separan dos conceptos:

1. Catalogo maestro de productos.
2. Inventario/stock real por DIRESA, UNGET o IPRESS.

El catalogo maestro define que productos existen y son validos para el modulo. El inventario define que productos y lotes tiene fisicamente cada DIRESA, UNGET o IPRESS, segun su alcance operativo.

El Excel de importacion no define la descripcion oficial del producto. La importacion debe usar el codigo SISMED para buscar el producto en el catalogo maestro y tomar desde ahi la descripcion oficial, tipo de producto y dosis/unidad.

La descripcion del Excel puede guardarse solo como dato de auditoria o comparacion, pero no debe reemplazar la descripcion oficial del catalogo maestro.

## 3. Roles y alcances

### Usuario Inmunizaciones DIRESA

- Administra el catalogo maestro de productos de inmunizaciones.
- Registra ingresos regionales de productos biologicos.
- Distribuye productos biologicos a las UNGET.
- Revisa recepciones UNGET, incidencias y trazabilidad regional.
- Supervisa reportes consolidados.
- Visualiza avance parcial y definitivo por UNGET e IPRESS.
- Maneja stock regional operativo solo para abastecimiento hacia UNGET.

### Usuario Inmunizaciones UNGET

- Acepta distribuciones recibidas desde DIRESA.
- Distribuye productos a sus IPRESS.
- Revisa y cierra definitivamente los movimientos mensuales de sus IPRESS.
- Solo puede ver y operar dentro de su propia UNGET.
- No puede distribuir a IPRESS de otra UNGET.
- No registra ingresos ordinarios manuales de abastecimiento; su stock ordinario nace por recepciones desde DIRESA.

### Usuario Inmunizaciones IPRESS

- Acepta distribuciones recibidas desde su UNGET.
- Registra consumos por producto/lote.
- Registra bajas por vencimiento/deterioro/ruptura.
- Registra devoluciones o transferencias hacia su UNGET.
- Realiza reajustes de stock por conteo fisico, con auditoria.
- Solo puede ver y operar su IPRESS.

### Admin general

- Puede configurar roles, permisos y usuarios.
- Puede ver todos los modulos segun permisos.

## 4. Catalogo maestro de inmunizaciones

Debe ser unico para DIRESA San Martin.

Campos principales:

- codigo SISMED.
- descripcion oficial.
- tipo de producto: vacuna, jeringa, diluyente.
- dosis/unidad o presentacion.
- estado: activo/inactivo.
- observacion.
- usuario que creo o actualizo.
- fecha de creacion.
- fecha de actualizacion.

Reglas:

- Solo usuario DIRESA o Admin autorizado puede crear/editar/activar/desactivar productos.
- UNGET e IPRESS usan el catalogo, pero no lo modifican.
- Toda importacion de stock debe validar contra este catalogo.
- Si el Excel trae productos no registrados o inactivos, la importacion debe bloquear esas filas.

## 5. Stock por lote y capa

El stock no debe manejarse solo por codigo de producto. Debe manejarse por lote.

Clave funcional del stock:

- ubicacion: DIRESA, UNGET o IPRESS.
- producto del catalogo.
- lote.
- fecha de vencimiento.
- precio unitario.
- fuente de financiamiento.
- tipo de suministro.
- origen del ingreso.
- saldo disponible.

Si el mismo producto/lote/vencimiento entra dos veces con precios distintos, se deben mantener dos capas separadas. No se debe promediar el precio.

Motivo: la valorizacion de stock, consumos, distribuciones y bajas depende del precio de cada capa.

En la interfaz, el usuario puede ver el producto agrupado por codigo SISMED, y al hacer clic ver el detalle de lotes/capas.

Decision 2026-07-27:

- DIRESA iniciara con un unico almacen regional operativo.
- El modelo debe quedar preparado para crear mas almacenes regionales en el futuro si la DIRESA lo necesita.
- Si solo existe un almacen regional, la interfaz no debe pedir seleccionarlo en cada operacion; debe usarse automaticamente.
- La UNGET no registra ingresos ordinarios de abastecimiento, pero si puede realizar reajustes auditados porque maneja stock propio como almacen de distribucion.

## 6. Vista principal de stock

La vista principal no debe mostrar todo como una matriz gigante tipo Excel.

Debe agrupar por producto:

- codigo SISMED.
- descripcion oficial.
- tipo de producto.
- dosis/unidad.
- saldo total en frascos/unidades.
- saldo total en dosis, cuando aplique.
- numero de lotes.
- vencimiento mas proximo.
- valorizacion total.
- estado o alertas.

Al abrir una fila debe mostrarse el detalle:

- lote.
- vencimiento.
- precio.
- fuente de financiamiento.
- tipo de suministro.
- saldo.
- valor.
- origen.
- alertas de vencimiento.

Para celular, debe usarse una experiencia tipo tarjetas/lista, no una tabla horizontal pesada.

## 7. Inventario inicial

Cada UNGET e IPRESS debe registrar su propio inventario inicial.

Formas de registro:

- importacion Excel.
- registro manual.

Campos necesarios:

- codigo SISMED.
- producto del catalogo.
- lote.
- fecha de vencimiento.
- saldo fisico.
- precio unitario.
- fuente de financiamiento.
- tipo de suministro.
- observacion opcional.

Reglas:

- El inventario inicial se hace una vez por cada UNGET o IPRESS.
- Cada usuario UNGET/IPRESS puede cerrar su propio inventario inicial.
- Una vez cerrado, no se modifica directamente.
- Si luego existe diferencia, se corrige mediante reajuste auditado.
- El inventario inicial cerrado se toma como saldo anterior del mismo mes de inicio.

Ejemplo:

- Inventario inicial de junio 2026.
- Ese inventario se considera saldo anterior de junio 2026.
- Los movimientos de junio se calculan contra ese saldo.
- El saldo final de junio pasa como saldo anterior de julio.

## 8. Importacion Excel de inventario inicial

El importador debe mostrar una previsualizacion antes de confirmar.

Debe validar:

- codigo SISMED existe en catalogo maestro.
- producto esta activo.
- lote no vacio.
- fecha de vencimiento valida.
- saldo no negativo.
- precio unitario informado y no negativo.
- fuente de financiamiento, si el archivo la trae.
- tipo de suministro, si el archivo lo trae.

Errores bloqueantes:

- producto no existe en catalogo.
- producto inactivo.
- codigo SISMED vacio.
- lote vacio.
- saldo negativo.
- vencimiento invalido.
- precio negativo.

Advertencias no bloqueantes:

- saldo cero.
- precio cero, si se decide permitirlo excepcionalmente.
- descripcion del Excel distinta al catalogo.
- lote proximo a vencer.

La descripcion mostrada e importada oficialmente siempre debe venir del catalogo maestro.

## 9. Periodos mensuales

El periodo debe manejarse por mes calendario.

Formato sugerido:

- YYYY-MM.
- Ejemplo: 2026-06.

Reglas:

- El sistema calcula automaticamente el periodo actual.
- No hace falta abrir manualmente cada mes.
- Todo movimiento pertenece a un periodo segun su fecha.
- El cierre bloquea el periodo.
- El saldo final de un periodo alimenta el saldo anterior del siguiente.

## 10. Estados de periodo

Para movimiento mensual se acuerda usar precierre y cierre definitivo.

Estados sugeridos:

- ABIERTO.
- PRE_CERRADO_IPRESS.
- OBSERVADO_UNGET.
- REABIERTO_PARA_CORRECCION.
- VALIDADO_UNGET.
- CERRADO_DEFINITIVO.

Reglas:

- La IPRESS trabaja durante el mes y luego hace precierre.
- La UNGET revisa y cierra definitivamente a cada IPRESS.
- La UNGET puede cerrar una IPRESS individualmente, por seleccion multiple o cerrar todos los aptos.
- La UNGET no puede cerrar su periodo mensual si alguna IPRESS de su red no esta cerrada definitivamente.
- DIRESA puede ver avance parcial aunque aun existan UNGET/IPRESS pendientes.

## 11. Validaciones para cierre de IPRESS

Una IPRESS esta apta para cierre solo si cumple:

- no tiene saldos negativos por producto/lote/capa.
- todas las distribuciones estan recibidas, rechazadas o regularizadas.
- no tiene distribuciones pendientes de aceptacion.
- no tiene incidencias abiertas.
- los consumos estan registrados por lote.
- no hay productos vencidos consumidos o distribuidos sin sustento.
- el factor de perdida no tiene errores de calculo.
- el periodo esta en precierre.
- existe usuario responsable identificado.
- existe fecha de corte/periodo definido.

Adicional:

- El saldo final debe convertirse automaticamente en saldo anterior del periodo siguiente.
- Si se corrige un periodo ya precerrado, debe quedar auditoria.

## 12. Distribucion jerarquica DIRESA -> UNGET -> IPRESS

El flujo operativo ordinario de abastecimiento queda replanteado en dos niveles:

1. DIRESA distribuye productos biologicos a las UNGET.
2. Cada UNGET distribuye productos biologicos a sus IPRESS.

La distribucion no necesita numero de guia SISMED visible, porque ese documento lo maneja SISMED/farmacia.

El sistema debe manejar una distribucion interna con identificador tecnico para trazabilidad, pero no presentarla como guia SISMED.

La distribucion debe usar una matriz asistida por producto, no un formulario lento item por item:

- Se selecciona el producto por codigo SISMED o descripcion.
- El sistema muestra destinos en filas.
- El usuario digita cantidades por destino.
- El sistema calcula total distribuido, stock disponible, saldo restante y lotes FEFO sugeridos.
- Se puede buscar destino por codigo o nombre.
- Se puede filtrar destinos y ver solo los que tienen cantidad.
- Se debe permitir agregar varios productos en una misma distribucion.
- Se debe mostrar un resumen antes de enviar, agrupado por destino y por producto/lote.
- El mismo patron se usara para DIRESA -> UNGET y para UNGET -> IPRESS.

### 12.1 Distribucion DIRESA -> UNGET

Forma de uso deseada:

- Usuario DIRESA selecciona un producto.
- El sistema muestra las UNGET destino.
- El usuario ingresa cantidades a distribuir por UNGET.
- El sistema sugiere lotes por FEFO.
- El usuario puede omitir FEFO y elegir lote manualmente.
- El sistema muestra stock regional disponible, total distribuido y saldo restante.
- No permite distribuir mas que el saldo regional disponible.

Reglas:

- Por defecto, el sistema usa FEFO.
- Si el lote mas proximo a vencer no alcanza, toma del siguiente.
- Si el usuario omite un lote mas proximo a vencer, debe registrar motivo.
- La distribucion descuenta inmediatamente del stock regional DIRESA.
- Para la UNGET queda como distribucion pendiente de aceptacion.
- La UNGET suma a su stock solo cuando acepta fisicamente la distribucion.
- Si la UNGET acepta con diferencia, queda incidencia observada visible para DIRESA y UNGET.

### 12.2 Distribucion UNGET -> IPRESS

Forma de uso deseada:

- Usuario UNGET selecciona un producto.
- El sistema muestra sus IPRESS.
- El usuario ingresa cantidades a distribuir por IPRESS.
- El sistema sugiere lotes por FEFO.
- El usuario puede omitir FEFO y elegir lote manualmente.
- El sistema muestra stock disponible, total distribuido y saldo restante.
- No permite distribuir mas que el saldo disponible.

FEFO significa First Expired, First Out: primero vence, primero sale.

Reglas:

- Por defecto, el sistema usa FEFO.
- Si el lote mas proximo a vencer no alcanza, toma del siguiente.
- Si el usuario omite un lote mas proximo a vencer, debe registrar motivo.
- La distribucion descuenta inmediatamente del stock UNGET.
- Para la IPRESS queda como distribucion pendiente de aceptacion.
- Una UNGET solo distribuye a IPRESS de su propia UNGET.

## 13. Aceptacion de distribuciones por destino

Toda distribucion debe ser aceptada por el destino.

Destinos posibles:

- UNGET acepta distribuciones recibidas desde DIRESA.
- IPRESS acepta distribuciones recibidas desde su UNGET.

Puede:

- aceptar completa.
- aceptar con diferencia.
- rechazar.
- observar.

Si la cantidad fisica no coincide:

- no se modifica silenciosamente el movimiento original.
- se registra incidencia de recepcion.
- el destino suma solo la cantidad realmente aceptada.
- la diferencia queda visible para el origen, el destino y DIRESA.

Campos de incidencia:

- cantidad enviada.
- cantidad recibida.
- diferencia.
- motivo seleccionado.
- observacion escrita.
- usuario que observo.
- fecha/hora.
- estado.

Motivos sugeridos:

- faltante fisico.
- sobrante fisico.
- lote diferente.
- vencimiento diferente.
- producto diferente.
- producto deteriorado.
- error de digitacion.
- otro.

La regularizacion/cierre de incidencia debe hacerla el nivel origen:

- DIRESA regulariza incidencias de recepcion UNGET.
- UNGET regulariza incidencias de recepcion IPRESS.

## 14. Consumo IPRESS

Solo la IPRESS registra consumo.

La UNGET no registra consumo propio.

El consumo debe registrarse por producto y lote existente en stock.

Reglas:

- No se permite consumir un lote que no existe en stock.
- No se permite consumir mas que el saldo disponible.
- El usuario registra consumo en frascos/unidades.
- El usuario registra dosis aplicadas.
- El sistema calcula consumo en dosis, dosis perdidas y factor de perdida.

Calculos:

- consumo_dosis = consumo_frascos * dosis_unidad.
- dosis_perdidas = consumo_dosis - dosis_aplicadas.
- factor_perdida = dosis_perdidas / consumo_dosis.
- total_movimiento = consumo_frascos + deteriorado_vencido_transferido.
- saldo_final = disponible - total_movimiento.

El consumo puede registrarse varias veces durante el mes. Al cierre, el sistema consolida por periodo.

## 15. Deteriorados, vencidos y rupturas

Cuando un producto esta vencido o deteriorado:

- La IPRESS registra la baja.
- El stock sale de IPRESS.
- Queda en transito hacia UNGET como baja pendiente de recepcion.
- La UNGET debe aceptar la recepcion.
- Si no coincide con lo fisico, la UNGET registra observacion.
- Nunca entra al stock disponible UNGET.
- Entra a un registro separado de productos no disponibles/bajas.

Motivos:

- vencido.
- deteriorado.
- ruptura.
- cadena de frio.
- otro.

## 16. Devolucion o transferencia IPRESS -> UNGET

Las transferencias entre IPRESS deben pasar por UNGET.

Flujo:

- IPRESS registra devolucion o transferencia hacia UNGET.
- Puede indicar una IPRESS destino sugerida.
- Si no indica destino, es devolucion simple a UNGET.
- El stock sale de IPRESS y queda pendiente de aceptacion por UNGET.
- UNGET acepta la devolucion.
- Si tiene IPRESS destino sugerida, UNGET puede aceptar y derivar.
- UNGET puede cambiar el destino si corresponde.

Tipos:

- devolucion simple a UNGET.
- transferencia sugerida a otra IPRESS.

La IPRESS destino sugerida es opcional.

## 17. Reajuste de stock UNGET/IPRESS

La UNGET y la IPRESS deben tener una herramienta de descuadre/reajuste, porque ambas manejan inventario operativo propio.

No requiere aprobacion previa, pero debe quedar auditado y debe poder imprimirse en PDF.

Alcance:

- Usuario UNGET: reajusta solo stock de su propia UNGET.
- Usuario IPRESS: reajusta solo stock de su propia IPRESS.
- Usuario DIRESA: supervisa reajustes, pero no registra reajustes operativos.

Modo de uso:

- El usuario selecciona producto y lote existente, o registra lote fisico no existente.
- Si el registro existe pero sus datos no coinciden con lo encontrado fisicamente, usa `Corregir datos`.
- La correccion puede cambiar producto del catalogo, lote, vencimiento, precio, fuente de financiamiento o tipo de suministro.
- El registro anterior no se edita ni desaparece: el sistema genera una salida auditada desde la capa incorrecta y una entrada auditada hacia la capa fisica correcta, vinculadas por el mismo identificador de reclasificacion.
- El usuario indica cuantas unidades conservan los datos originales y cuantas corresponden a los datos fisicos corregidos. Esto permite correcciones totales, parciales y diferencias adicionales de cantidad en una sola operacion.
- Si la capa fisica correcta ya existe, la cantidad se acumula en ella; si no existe, se crea una nueva capa.
- El sistema muestra stock del sistema.
- El usuario ingresa stock fisico contado.
- El sistema calcula diferencia.
- Si diferencia positiva, genera ajuste de entrada.
- Si diferencia negativa, genera ajuste de salida.
- Si diferencia cero, no genera movimiento.

Campos de auditoria:

- producto.
- lote.
- vencimiento.
- tipo de ubicacion: UNGET o IPRESS.
- codigo/identificador de ubicacion.
- stock sistema antes.
- stock fisico contado.
- diferencia.
- motivo.
- observacion.
- usuario.
- fecha/hora.
- periodo.
- establecimiento.

Debe generarse PDF de constancia/reajuste.

## 18. Ingresos regionales DIRESA

DIRESA debe registrar los ingresos nuevos de productos biologicos al stock regional.

Formas:

- manual.
- importacion Excel.

Origen del ingreso:

- CENARES.
- OGESS, como referencia administrativa si corresponde.
- almacen de inmunizaciones / punto regional, si aplica.
- transferencia de otra UNGET.
- devolucion UNGET.
- ajuste positivo.
- otro.

Campos adicionales:

- OGESS origen.
- UNGET origen, si es devolucion o transferencia.
- fuente de financiamiento.
- tipo de suministro.
- documento/referencia opcional.
- observacion.

Reglas:

- El usuario DIRESA es el responsable principal de digitacion de ingresos ordinarios.
- UNGET no registra ingresos ordinarios directos por abastecimiento.
- El stock UNGET nace cuando acepta una distribucion desde DIRESA.
- El stock IPRESS nace cuando acepta una distribucion desde UNGET.
- Los reajustes siguen existiendo para corregir descuadres fisicos, pero no reemplazan el flujo ordinario de abastecimiento.

## 19. Stock de reserva regional o punto B

Se explico que CENARES distribuye a la region San Martin por dos puntos:

- Punto A distribuye a OGESS.
- Punto B tambien distribuye, pero puede conservar stock de reserva por ser almacen de inmunizaciones.

Para esta primera etapa no se implementara como flujo operativo completo.

Recomendacion futura:

- manejarlo como ubicacion especial o almacen de reserva regional.
- no mezclarlo con stock comun de UNGET/IPRESS.
- permitir supervision por DIRESA/OGESS.
- permitir que ingresos regionales DIRESA indiquen si provienen de ese punto.

## 20. Reportes DIRESA

DIRESA debe ver avance parcial y definitivo.

Vista de avance operativo:

- UNGET cerradas.
- UNGET pendientes.
- IPRESS cerradas por UNGET.
- IPRESS observadas.
- incidencias abiertas.
- distribuciones pendientes.
- bajas pendientes de recepcion.

Vista de consolidado biologico:

- saldos anteriores.
- ingresos.
- distribuciones.
- consumos.
- bajas.
- devoluciones.
- saldos finales.
- dosis aplicadas.
- dosis perdidas.
- factor de perdida.

El reporte parcial debe marcarse como preliminar.

El consolidado definitivo solo existe cuando todas las UNGET estan cerradas.

## 21. Etapa 1 acordada

La primera implementacion debe concentrarse en la base solida:

1. Catalogo maestro de productos de inmunizaciones.
2. Roles/permisos de inmunizaciones con alcance DIRESA, UNGET e IPRESS.
3. Inventario inicial por UNGET/IPRESS.
4. Registro manual de inventario inicial.
5. Importacion Excel de inventario inicial.
6. Stock por producto/lote/vencimiento/precio/fuente/tipo de suministro.
7. Vista agrupada por producto con detalle por lote.
8. Cierre de inventario inicial.

## 22. Etapa 2 acordada

La segunda etapa debe implementar la operacion mensual:

1. Ingresos regionales DIRESA.
2. Distribucion DIRESA -> UNGET.
3. Aceptacion de distribuciones por UNGET.
4. Distribucion UNGET -> IPRESS.
5. Aceptacion de distribuciones por IPRESS.
6. Incidencias de recepcion.
7. Consumos IPRESS por lote.
8. Deteriorados, vencidos y rupturas.
9. Devoluciones y transferencias IPRESS -> UNGET.
10. Reajustes de stock con PDF de auditoria.
11. Precierre IPRESS.
12. Revision y cierre definitivo UNGET.
13. Reportes parciales y definitivos DIRESA.

## 23. Tablas sugeridas para base de datos

Nombres referenciales:

- immunization_products.
- immunization_inventory_initial.
- immunization_stock_layers.
- immunization_stock_movements.
- immunization_periods.
- immunization_distributions.
- immunization_distribution_items.
- immunization_reception_incidents.
- immunization_adjustments.
- immunization_returns.
- immunization_waste_returns.

La implementacion final puede ajustar nombres segun convenciones del proyecto.

## 24. Reglas criticas

- Todo stock operativo se maneja por lote.
- No se consume lote inexistente.
- No se permite saldo negativo.
- El catalogo maestro manda sobre la descripcion del Excel.
- El inventario inicial cerrado no se edita directamente.
- Todo ajuste posterior queda auditado.
- DIRESA maneja stock regional operativo y distribuye a UNGET.
- UNGET no registra ingresos ordinarios directos de abastecimiento; recibe desde DIRESA.
- UNGET solo opera sus IPRESS.
- IPRESS solo opera su propio establecimiento.
- El periodo mensual es calendario.
- IPRESS precierra, UNGET cierra definitivamente.
- UNGET no cierra su periodo hasta que todas sus IPRESS esten cerradas.
- Los productos vencidos/deteriorados no vuelven a stock disponible.

## 25. Decisiones definidas y pendientes para implementar

### Definidas

Catalogo inicial de productos de inmunizaciones:

- Se refiere a la primera lista oficial de productos que se cargara en `immunization_products` antes de que UNGET/IPRESS importen inventarios.
- No es el inventario de ninguna UNGET/IPRESS.
- Es la lista maestra de codigos SISMED permitidos para trabajar en el modulo.
- Debe incluir vacunas, jeringas y diluyentes.
- Se puede construir inicialmente desde los formatos Excel de movimiento biologico revisados y luego ser validada/ajustada por el usuario Inmunizaciones DIRESA.
- Cada fila del catalogo inicial debe tener: codigo SISMED, descripcion oficial, tipo de producto, dosis/unidad, estado activo y observacion opcional.
- Si un producto no esta en este catalogo o esta inactivo, no puede ingresar por importacion ni por registro manual de inventario.

Nombres exactos propuestos para modulos del menu:

- Inmunizaciones.
- Catalogo Biologico.
- Inventario Inicial.
- Stock Biologico.
- Consulta de Stock Biologico.
- Ingresos Regionales.
- Distribucion Regional.
- Recepcion UNGET.
- Distribucion a IPRESS.
- Recepcion IPRESS.
- Consumo IPRESS.
- Devoluciones y Bajas.
- Reajustes de Stock.
- Cierre Mensual.
- Reportes Inmunizaciones.

Modulos de primera etapa:

- Catalogo Biologico.
- Inventario Inicial.
- Stock Biologico.
- Reajustes de Stock, solo si se decide incluir desde el arranque por necesidad operativa.

Modulos de segunda etapa:

- Ingresos Regionales.
- Distribucion Regional.
- Recepcion UNGET.
- Distribucion a IPRESS.
- Recepcion IPRESS.
- Consumo IPRESS.
- Devoluciones y Bajas.
- Cierre Mensual.
- Reportes Inmunizaciones.

Permisos sugeridos por modulo:

- DIRESA: Catalogo Biologico, Stock Biologico regional, Ingresos Regionales, Distribucion Regional, Consulta de Stock Biologico, Reportes Inmunizaciones.
- UNGET: Recepcion UNGET, Stock Biologico de su almacen, Consulta de Stock Biologico de sus IPRESS, Distribucion a IPRESS, Devoluciones y Bajas, Reajustes de Stock, Cierre Mensual, Reportes Inmunizaciones.
- IPRESS: Inventario Inicial, Stock Biologico, Recepcion IPRESS, Consumo IPRESS, Devoluciones y Bajas, Reajustes de Stock.

Politicas RLS definitivas en Supabase:

El proyecto actual usa una autenticacion propia en tabla `users` y varias politicas temporales permisivas. Para RLS real, Supabase debe poder conocer el usuario actual en la base de datos. Por eso, la politica definitiva debe implementarse con una de estas opciones:

- migrar a Supabase Auth y guardar `username`, `role`, `jurisdiction_level`, `facility_code`, `unget_id`, `ogess_id`, `diresa_id` en claims o tablas relacionadas;
- o mover escrituras criticas a Edge Functions/RPC seguras que validen el usuario antes de escribir.

Reglas RLS objetivo:

- Admin general puede leer y escribir configuracion global.
- Usuario DIRESA puede leer todos los datos de inmunizaciones de San Martin.
- Usuario DIRESA puede crear/editar catalogo maestro.
- Usuario DIRESA puede registrar ingresos regionales y distribuir stock a UNGET.
- Usuario UNGET puede leer y escribir recepciones, stock, distribuciones a IPRESS, devoluciones, reajustes y cierres de su propia UNGET.
- Usuario UNGET puede ver las IPRESS que pertenecen a su UNGET.
- Usuario UNGET no puede operar IPRESS de otra UNGET.
- Usuario UNGET no puede registrar ingresos ordinarios directos de abastecimiento.
- Usuario IPRESS puede leer y escribir solo movimientos de su propio establecimiento.
- Usuario IPRESS no puede modificar catalogo maestro.
- Usuario IPRESS no puede registrar consumo de lotes fuera de su stock.
- DIRESA puede ver reportes consolidados preliminares y definitivos.
- Las tablas de auditoria deben permitir insercion por el usuario que genera el evento, pero no deben permitir edicion ni eliminacion ordinaria.

Politicas por tabla, a nivel funcional:

- `immunization_products`: lectura para usuarios con modulos de inmunizaciones; escritura solo DIRESA/Admin.
- `immunization_inventory_initial`: uso de puesta en marcha; lectura/escritura segun el responsable asignado y sin edicion directa despues del cierre.
- `immunization_stock_layers`: lectura por alcance; escritura solo mediante movimientos controlados, no edicion directa desde UI.
- `immunization_stock_movements`: insercion por el usuario autorizado del alcance; lectura por alcance; sin update/delete ordinario.
- `immunization_adjustments`: insercion por UNGET/IPRESS propietaria; lectura por alcance superior; sin update/delete ordinario.
- `immunization_distributions`: DIRESA origen escribe hacia UNGET; UNGET destino lee y acepta/observa. UNGET origen escribe hacia IPRESS; IPRESS destino lee y acepta/observa. DIRESA lee todo.
- `immunization_returns` y `immunization_waste_returns`: IPRESS origen escribe; UNGET recibe/observa; DIRESA lee.
- `immunization_periods`: IPRESS precierra su periodo; UNGET cierra periodos IPRESS y su propio periodo; DIRESA lee consolidado.

Diseno visual final de las pantallas:

- Debe seguir el estilo actual del sistema: sidebar oscuro, contenido en fondo gris claro, tarjetas blancas, bordes sutiles, acentos teal/cyan/emerald, iconos `lucide-react`, modales centrados y tablas compactas.
- No debe copiar la matriz Excel como pantalla principal. El Excel sera referencia funcional, no referencia visual literal.
- La experiencia debe ser operativa, rapida y clara para personal de salud.
- La pantalla principal de Stock Biologico debe funcionar como un tablero de control operativo por periodo, con resumen superior y lista agrupada por producto.
- Stock Biologico siempre representa una unica existencia operativa: stock regional DIRESA, almacen propio de la UNGET o IPRESS del usuario. No incluye filtros territoriales ni consolidacion de establecimientos.
- Cada producto se muestra como fila/tarjeta principal con codigo SISMED, descripcion, saldo total, lotes, vencimiento mas cercano, valorizacion y alertas.
- Al abrir un producto se muestra detalle por lote/capa: lote, vencimiento, precio, fuente, tipo suministro, saldo y acciones. No se repiten ubicacion ni ambito porque son implicitos en la sesion.
- Consulta de Stock Biologico sera un modulo separado y de solo lectura para UNGET/DIRESA. Permitira filtrar por UNGET e IPRESS y alternar entre detalle por establecimiento, consolidado UNGET y consolidado regional.
- En escritorio se puede usar tabla densa con panel lateral de detalle.
- En celular se debe usar tarjetas expandibles y acciones grandes: Consumo, Recepcion, Devolucion/Baja, Reajuste.
- Las alertas deben tener color funcional: rojo vencido/critico, ambar por vencer/pendiente, verde operativo/cerrado, azul/teal informativo.
- El sistema debe usar pasos guiados para importacion: cargar archivo, validar, previsualizar, corregir errores, confirmar y cerrar.
- Para distribucion, la matriz debe ser asistida: producto seleccionado arriba, destinos en filas, cantidades en celdas, resumen fijo de stock disponible y FEFO sugerido. En DIRESA los destinos son UNGET; en UNGET los destinos son IPRESS.
- El diseno debe evitar pantallas saturadas: mostrar panorama general primero y detalle solo al expandir.

Plantilla PDF para reajuste de stock:

- Nombre: Constancia de Reajuste de Stock Biologico.
- Formato: PDF A4 vertical.
- Encabezado: ToolKit SISMED Web, DIRESA San Martin, modulo Inmunizaciones.
- Datos generales: periodo, fecha/hora, tipo de ubicacion, UNGET/IPRESS, responsable, usuario que registra.
- Tabla de reajuste: codigo SISMED, descripcion oficial, lote, vencimiento, precio, fuente de financiamiento, tipo de suministro, stock sistema, stock fisico contado, diferencia, tipo de ajuste.
- Sustento: motivo seleccionado y observacion escrita.
- Auditoria: identificador interno del reajuste, fecha de generacion, estado del periodo.
- Firmas: responsable de inmunizaciones y responsable/encargado del establecimiento o UNGET.
- Pie: texto indicando que el reajuste modifica el stock del sistema y queda registrado en auditoria.

Plantilla PDF o Excel para reportes mensuales:

- PDF mensual: pensado para impresion, firma y revision rapida.
- Excel mensual: pensado para analisis, filtros, consolidacion y envio operativo.

PDF mensual debe incluir:

- portada con periodo, UNGET/IPRESS o consolidado DIRESA.
- resumen de estado: abierto, precerrado, observado, cerrado.
- indicadores: productos con stock, lotes por vencer, bajas, devoluciones, consumos, dosis aplicadas, dosis perdidas, factor de perdida.
- tabla tipo movimiento biologico agrupada por producto.
- anexo de detalle por lote.
- anexo de incidencias, reajustes, devoluciones y bajas.
- firmas y fecha de emision.

Excel mensual debe incluir hojas:

- Resumen.
- Movimiento Biologico.
- Detalle por Lote.
- Distribuciones.
- Consumos.
- Bajas y Devoluciones.
- Reajustes.
- Incidencias.
- Auditoria.

El Excel debe mantener formulas auditables cuando sea util, pero los datos oficiales deben provenir de la base de datos.

Formato de importacion:

- El inventario inicial se importara desde archivos Excel `.xlsx`.

Columnas obligatorias para importar inventario inicial:

- codigo SISMED.
- lote.
- fecha de vencimiento.
- saldo fisico.
- precio unitario.
- fuente de financiamiento.
- tipo de suministro.

Columnas recomendadas o auxiliares:

- descripcion del producto en Excel, solo para auditoria/comparacion.
- observacion.

Nombres alternativos aceptados:

- codigo SISMED: `codigo_sismed`, `cod_sismed`, `codigo`, `cod`, `medcod`, `id_producto`, `id producto`, `codigo sismed`.
- descripcion: `descripcion`, `producto`, `nombre`, `biologicos/diluyentes/jeringas`, `biologicos`, `xnom`.
- lote: `lote`, `n lote`, `nro lote`, `numero lote`, `no lote`.
- fecha de vencimiento: `fecha_vencimiento`, `vencimiento`, `fec_vencim`, `fecha vencimiento`, `fecha de vencimiento`.
- saldo fisico: `saldo`, `stock`, `stock fisico`, `saldo fisico`, `cantidad`, `saldo disponible`.
- precio unitario: `precio`, `precio unitario`, `precio_det`, `precio detalle`, `precio_cab`, `costo unitario`.
- fuente de financiamiento: `ffinan`, `fuente financiamiento`, `fuente de financiamiento`.
- tipo de suministro: `tipsum`, `tipo suministro`, `tipo de suministro`, `desc_tipsum`.
- observacion: `observacion`, `observaciones`, `nota`, `comentario`.

Regla de importacion:

- La descripcion oficial siempre se toma del catalogo maestro mediante el codigo SISMED.
- La descripcion del Excel no reemplaza el catalogo maestro.
- Si el codigo SISMED no existe o esta inactivo en el catalogo maestro, la fila se bloquea.

### Preparacion tecnica para codificar

Antes de iniciar la implementacion se prepararan estos insumos:

- Extraer la lista concreta del catalogo inicial desde los Excel revisados y validarla como catalogo maestro.
- Incluir `Reajustes de Stock` desde la primera etapa, porque UNGET e IPRESS necesitan corregir descuadres de inventario con auditoria.
- Crear los nombres internos `AppModule` siguiendo el patron actual del proyecto, por ejemplo: `IMMUNIZATION_CATALOG`, `IMMUNIZATION_INITIAL_INVENTORY`, `IMMUNIZATION_STOCK`, `IMMUNIZATION_ADJUSTMENTS`, `IMMUNIZATION_REPORTS`.
- Implementar seguridad de alcance primero en API/servicios y dejar preparada la migracion a RLS real mediante Supabase Auth o Edge Functions/RPC.
- Disenar las pantallas con el estilo actual del sistema antes de codificar componentes complejos.
