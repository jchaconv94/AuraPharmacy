# Fase 14 - Refactor de abastecimiento regional DIRESA -> UNGET

Fecha: 2026-07-27

## Motivo del cambio

Se cambia el flujo operativo ordinario de abastecimiento de inmunizaciones.

Modelo anterior:

- UNGET registraba ingresos nuevos a su stock.
- UNGET distribuia a IPRESS.
- IPRESS aceptaba la distribucion.

Modelo nuevo:

- DIRESA registra los ingresos regionales de productos biologicos.
- DIRESA distribuye a las UNGET.
- Cada UNGET acepta fisicamente la distribucion recibida desde DIRESA.
- Luego la UNGET distribuye a sus IPRESS.
- Cada IPRESS acepta fisicamente la distribucion recibida desde su UNGET.

El objetivo es que DIRESA sea el responsable principal de digitacion de informacion de vacunas, lotes, vencimientos, precios, fuente y tipo de suministro para el abastecimiento ordinario.

## Regla funcional principal

El stock debe moverse jerarquicamente:

```text
DIRESA / stock regional
  -> distribucion regional
UNGET / stock propio
  -> distribucion a IPRESS
IPRESS / stock propio
  -> consumo, bajas, devoluciones y reajustes
```

## Cambios funcionales requeridos

### 1. Stock regional DIRESA

DIRESA debe tener stock operativo regional por:

- producto del catalogo maestro;
- lote;
- vencimiento;
- precio unitario;
- fuente de financiamiento;
- tipo de suministro;
- saldo disponible.

Este stock no reemplaza al stock UNGET ni al stock IPRESS. Es una capa superior desde donde se abastece a las UNGET.

Decision 2026-07-27:

- Para la primera implementacion se usara un unico almacen regional DIRESA.
- El modelo debe quedar preparado para soportar mas almacenes regionales en el futuro si DIRESA necesita separar fisicamente sus existencias.
- Recomendacion tecnica: agregar una entidad/campo de almacen regional con un registro por defecto, por ejemplo `Almacen Regional DIRESA`.
- En la interfaz inicial no se debe obligar al usuario a elegir almacen si solo existe uno.

### 2. Ingresos Regionales

El modulo actual `Ingresos UNGET` debe convertirse en `Ingresos Regionales`.

Nuevo comportamiento:

- solo DIRESA/Admin autorizado registra ingresos ordinarios;
- el ingreso aumenta stock regional DIRESA;
- puede ser manual o por Excel;
- todo producto debe existir en el catalogo maestro;
- registra movimiento auditable `DIRESA_INCOME` o equivalente.

La UNGET ya no registra ingresos ordinarios directos de abastecimiento.

### 3. Distribucion Regional

Nuevo modulo o variante de distribucion:

- DIRESA selecciona una o varias UNGET destino;
- selecciona productos/lotes desde stock regional;
- FEFO automatico por defecto;
- puede elegir lote manualmente;
- no permite distribuir mas que el stock regional disponible;
- al enviar, descuenta stock regional;
- para la UNGET queda pendiente de recepcion.

Movimiento sugerido:

- salida regional: `DIRESA_DISTRIBUTION_OUT`.

### 3.1 UX recomendada para distribucion

La distribucion DIRESA -> UNGET y UNGET -> IPRESS debe resolverse con el mismo patron visual, cambiando solo el tipo de destino.

Patron recomendado: matriz asistida por producto.

Flujo:

1. El usuario selecciona el periodo y el origen:
   - DIRESA para distribucion regional;
   - UNGET para distribucion a IPRESS.
2. El usuario busca un producto por codigo SISMED o descripcion.
3. El sistema muestra stock disponible del producto por lote/capa y propone FEFO.
4. El sistema muestra los destinos en filas:
   - UNGET para DIRESA;
   - IPRESS para UNGET.
5. El usuario escribe cantidades en celdas por destino.
6. El sistema calcula en tiempo real:
   - total solicitado;
   - stock disponible;
   - saldo restante;
   - lotes que se usaran por FEFO;
   - alertas si se excede stock.
7. El usuario puede agregar otro producto a la misma distribucion.
8. Antes de enviar, se muestra un resumen por destino y por producto/lote.

Reglas UX:

- Debe existir buscador rapido de destinos por codigo o nombre.
- Debe permitir filtrar destinos.
- Debe permitir limpiar cantidades rapidamente.
- Debe permitir copiar una cantidad a varios destinos seleccionados.
- Debe permitir ver solo destinos con cantidad.
- Debe mantener un panel/resumen fijo con stock disponible y total distribuido.
- Debe permitir elegir lote manualmente solo cuando el usuario necesite omitir FEFO, pidiendo motivo.

Este enfoque es mas eficiente que un formulario item por item, pero evita copiar literalmente el Excel como pantalla principal.

### 4. Recepcion UNGET

La UNGET debe aceptar lo recibido desde DIRESA igual que la IPRESS acepta lo recibido desde UNGET.

Puede:

- aceptar conforme;
- aceptar con diferencia;
- registrar incidencia aunque la cantidad coincida, por lote/vencimiento/deterioro/u otro sustento;
- rechazar u observar, si luego se decide habilitar esa variante.

Al aceptar:

- sube stock UNGET solo con cantidad fisica recibida;
- registra movimiento `UNGET_DISTRIBUTION_IN`;
- si hay incidencia, queda estado `OBSERVED` y observacion visible para DIRESA/UNGET.

### 5. Distribucion UNGET -> IPRESS

El flujo ya implementado se mantiene, pero debe quedar como segundo nivel.

La UNGET solo puede distribuir stock propio ya aceptado.

Reglas:

- no distribuye a IPRESS de otra UNGET;
- FEFO automatico por defecto;
- puede elegir lote manualmente;
- no permite saldo negativo;
- al enviar, descuenta stock UNGET;
- IPRESS queda con recepcion pendiente.
- debe usar el mismo patron de matriz asistida descrito para distribucion regional, pero con IPRESS como filas destino.

### 6. Recepcion IPRESS

La recepcion IPRESS ya implementada se mantiene como tercer tramo del flujo.

Debe conservar:

- cantidad fisica recibida por item/lote;
- motivo seleccionado;
- observacion escrita;
- estado `RECEIVED` o `OBSERVED`;
- stock IPRESS incrementado solo por lo recibido fisicamente.

## Cambios tecnicos esperados

### Tipos y modelo

Revisar si conviene:

- extender `ownerType` para incluir `DIRESA` o `REGIONAL`;
- extender distribuciones para manejar `originOwnerType` y `destinationOwnerType`;
- permitir destinos de tipo `UNGET` e `IPRESS`;
- reutilizar una sola tabla de distribuciones si el modelo queda claro;
- o crear tablas separadas si la complejidad visual/API lo justifica.

Recomendacion inicial:

- reutilizar un modelo unico de distribuciones con origen/destino tipado.
- evitar duplicar tablas si las reglas son casi iguales.

### Permisos

Permisos sugeridos:

- `IMMUNIZATION_REGIONAL_INCOMES`: ingresos regionales DIRESA.
- `IMMUNIZATION_REGIONAL_DISTRIBUTIONS`: distribucion DIRESA -> UNGET.
- `IMMUNIZATION_DISTRIBUTIONS`: distribucion UNGET -> IPRESS.
- `IMMUNIZATION_RECEPTIONS`: recepciones UNGET/IPRESS, segun alcance.

Asignacion:

- `INMU_DIRESA`: ingresos regionales, distribucion regional, stock regional, catalogo, reportes.
- `INMU_UNGET`: recepcion regional, stock UNGET, distribucion IPRESS, reajustes, cierres.
- `INMU_IPRESS`: recepcion IPRESS, stock IPRESS, consumo, bajas, devoluciones, reajustes.

### Migracion Supabase

Se debe crear una migracion nueva antes de ejecutar pruebas reales:

- agregar soporte para stock regional DIRESA;
- adaptar tablas/RPC de ingresos;
- adaptar tablas/RPC de distribuciones;
- adaptar recepcion para UNGET e IPRESS;
- mantener RLS por alcance.

No se recomienda ejecutar como definitivo las migraciones de ingresos/distribuciones anteriores sin esta refactorizacion.

## Validacion funcional minima

1. Usuario DIRESA registra ingreso regional.
2. Stock regional DIRESA aumenta.
3. DIRESA distribuye a una UNGET.
4. Stock regional disminuye.
5. UNGET ve distribucion pendiente.
6. UNGET acepta conforme.
7. Stock UNGET aumenta.
8. DIRESA distribuye a otra UNGET con diferencia observada.
9. UNGET acepta observando diferencia.
10. Stock UNGET aumenta solo con lo recibido fisicamente.
11. UNGET distribuye a IPRESS.
12. IPRESS acepta conforme u observada.
13. Stock IPRESS aumenta solo con lo recibido fisicamente.

## Preguntas abiertas antes de codificar

### Decisiones tomadas

- Stock regional: iniciar con un unico almacen regional DIRESA, dejando el modelo preparado para multiples almacenes futuros.
- Distribucion: usar matriz asistida por producto, reutilizable para DIRESA -> UNGET y UNGET -> IPRESS.
- UNGET: no registra ingresos ordinarios de abastecimiento, pero si puede hacer reajustes auditados porque maneja stock propio como almacen de distribucion.

### Pendientes

1. El inventario inicial existente de UNGET/IPRESS se mantiene para puesta en marcha o DIRESA cargara todo desde cero y luego distribuira?
2. La recepcion UNGET con incidencia la regulariza DIRESA, o solo queda observada para reporte?

Supuesto recomendado para avanzar si no se indica lo contrario:

- El inventario inicial se mantiene solo para puesta en marcha o carga historica inicial. Despues del arranque, el flujo ordinario entra por DIRESA.
- La incidencia de recepcion UNGET queda observada, visible para DIRESA y UNGET, y no modifica silenciosamente el envio original. La regularizacion formal puede implementarse en una fase posterior de control de incidencias.

## Siguiente paso recomendado

Antes de tocar codigo:

- confirmar los pendientes abiertos;
- definir nombres finales de modulos;
- luego implementar la migracion y adaptar servicios/UI.
