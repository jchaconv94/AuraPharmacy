# Plan UX/UI profesional - Módulos de Inmunizaciones

Fecha: 2026-07-22

## 1. Alcance de esta revisión

Este plan define una guía visual y de experiencia para profesionalizar los módulos de Inmunizaciones del ToolKit SISMED Web.

Archivos revisados:

- `docs/INMUNIZACIONES_DISENO_FUNCIONAL.md`
- `docs/PLAN_IMPLEMENTACION_INMUNIZACIONES.md`
- `docs/FASE_11_INGRESOS_UNGET.md`
- `docs/design-qa.md`
- `components/ImmunizationCatalogModule.tsx`
- `components/ImmunizationInitialInventoryModule.tsx`
- `components/ImmunizationInventoryItemModal.tsx`
- `components/ImmunizationStockModule.tsx`
- `components/ImmunizationIncomesModule.tsx`
- `components/ImmunizationAdjustmentsModule.tsx`
- `components/ImmunizationAdjustmentModal.tsx`
- `components/ImmunizationReportsModule.tsx`
- `App.tsx`
- `components/Sidebar.tsx`
- `components/MobileNav.tsx`
- `types.ts`

Límite de evidencia:

- No se capturaron nuevas pantallas automatizadas desde navegador porque el proyecto ya tenía registrada una limitación previa con el conector visual.
- El análisis se basa en el código TSX, la documentación funcional y las capturas/observaciones que el usuario compartió durante la implementación.

## 2. Diagnóstico general

La base visual actual es válida: sidebar oscuro, contenido en fondo gris claro, tarjetas blancas, bordes sutiles, radios amplios, acentos teal/emerald/amber y uso de `lucide-react`.

El problema principal no es la paleta. El problema es la falta de un sistema de componentes UX común para pantallas operativas complejas. Cada módulo resuelve filtros, tablas, modales y resúmenes con patrones parecidos pero no idénticos. Eso genera:

- filtros que crecen demasiado en altura;
- formularios modales que se desbalancean cuando hay muchos campos;
- tablas con densidad irregular;
- acciones importantes lejos del contexto;
- mezcla visual entre pantallas operativas y pantallas supervisoras;
- textos largos con demasiado peso tipográfico;
- columnas redundantes para usuarios que ya pertenecen a una ubicación;
- riesgo de volver a crear pantallas tipo Excel sin suficiente jerarquía.

También debe revisarse la codificación de textos visibles: términos como `Biológico`, `Catálogo` y `Código` deben renderizarse con tildes correctas. Si aparecen caracteres corruptos en pantalla o reportes, debe corregirse como deuda UX de prioridad alta.

## 3. Principios visuales para Inmunizaciones

### 3.1 Operativo primero, detalle después

La primera vista debe responder rápido:

- qué periodo estoy viendo;
- qué ámbito estoy operando;
- cuántos productos/lotes tengo;
- qué está vencido, pendiente u observado;
- cuál es la siguiente acción.

El detalle debe aparecer al expandir, abrir un drawer o entrar a un modal.

### 3.2 No replicar Excel como pantalla principal

Excel es referencia funcional, no referencia visual. La pantalla debe usar:

- tarjetas de resumen;
- filas agrupadas por producto;
- detalle por lote expandible;
- filtros compactos;
- acciones guiadas.

La excepción funcional es la distribución jerárquica. Tanto `Distribución Regional` como `Distribución a IPRESS` deben usar matriz asistida porque el usuario distribuye cantidades por destino.

### 3.3 Separar operación de supervisión

Una pantalla operativa debe mostrar solo el stock o movimiento del usuario actual:

- DIRESA: su almacén regional operativo.
- IPRESS: su establecimiento.
- UNGET: su almacén UNGET.

Una pantalla supervisora debe usar filtros territoriales:

- DIRESA: UNGET, IPRESS, estado, periodo.
- OGESS/ADMIN: según alcance.

No se debe mostrar `Ubicación` o `Ámbito` en una tabla propia del usuario si esa información ya está clara en la cabecera.

### 3.4 Densidad controlada

El sistema lo usará personal operativo. Debe ser claro, pero no desperdiciar altura.

Regla sugerida:

- cabecera de módulo: 1 tarjeta;
- KPIs: máximo 4 o 5 tarjetas pequeñas;
- filtros: una barra compacta;
- filtros avanzados: popover, drawer o sección colapsable;
- tabla/lista: debe quedar visible sin hacer demasiado scroll.

### 3.5 Color funcional

Usar color solo para significado operativo:

- teal/cyan: información del módulo, stock, catálogo.
- emerald: aplicado, cerrado, vigente, acción positiva.
- amber/orange: pendiente, advertencia, revisión, reajuste.
- red: vencido, error, bloqueo, saldo negativo.
- violet: reclasificación/corrección de datos.
- blue: vista supervisora o información contextual.
- slate: acciones neutras, estructura y tablas.

## 4. Sistema visual recomendado

### 4.1 Componentes base a crear/reutilizar

Se recomienda crear una pequeña capa de componentes comunes para Inmunizaciones:

- `ImmunizationPageHeader`
- `ImmunizationKpiCard`
- `ImmunizationFilterBar`
- `ImmunizationAdvancedFilters`
- `ImmunizationDataTable`
- `ImmunizationExpandableRow`
- `ImmunizationModalShell`
- `ImmunizationProductSearch`
- `ImmunizationStatusChip`
- `ImmunizationScopeBadge`
- `ImmunizationEmptyState`
- `ImmunizationConfirmDialog`

Esto evitará que cada fase vuelva a improvisar estilos.

### 4.2 Cabecera estándar de módulo

Formato:

- icono grande a la izquierda;
- título;
- badge de periodo;
- subtítulo corto;
- ámbito operativo debajo;
- acciones principales a la derecha.

Evitar subtítulos largos. Si hay explicación adicional, usar una alerta compacta o tooltip.

### 4.3 Tarjetas KPI

Formato recomendado:

- altura compacta;
- etiqueta en mayúscula pequeña;
- número grande;
- icono alineado a la derecha;
- color solo si comunica estado.

No deben ocupar más de una fila en desktop salvo que haya muchas métricas inevitables.

### 4.4 Barra de filtros estándar

Patrón recomendado:

- una sola barra horizontal en desktop;
- búsqueda como campo dominante;
- 2 a 4 filtros frecuentes visibles;
- botón `Más filtros` o `Fechas`;
- botón `Limpiar`;
- chips compactos de filtros activos debajo, solo si aportan.

No usar una tarjeta alta para filtros simples. Los rangos de fecha deben vivir en popover/drawer/colapsable.

### 4.5 Tablas

Reglas:

- encabezado sticky cuando la tabla tiene scroll;
- filas de 52 a 60 px;
- descripción del producto en 13-14 px, no en tamaño de título;
- códigos SISMED en monospace/chip;
- estados en chips;
- columnas redundantes ocultas por rol;
- acciones al extremo derecho;
- detalle de lote en fila expandible.

En móvil, evitar tablas anchas. Usar tarjetas por producto o lote.

### 4.6 Modales

Todos los modales deben tener:

- overlay con blur;
- header fijo;
- body con scroll vertical interno;
- footer fijo;
- sin scroll horizontal;
- acciones principales siempre visibles al final;
- validaciones cerca del campo afectado;
- resumen antes de aplicar cambios críticos.

Tamaños sugeridos:

- formulario simple: `max-w-3xl`;
- operación con lista: `max-w-5xl`;
- comparación/reclasificación compleja: `max-w-6xl`.

## 5. Mejoras por módulo

### 5.1 Catálogo Biológico

Objetivo UX:

- administrar el maestro de productos con rapidez y seguridad.

Problemas/riesgos:

- formulario inline puede empujar demasiado la tabla;
- filtros básicos aceptables, pero deberían compartir el patrón global;
- falta una lectura más clara de “producto activo/inactivo” como regla operacional.

Mejoras recomendadas:

- mover alta/edición a modal o drawer lateral;
- mantener tabla compacta con columnas: código, descripción, tipo, dosis/unidad, estado, acciones;
- agregar chips de tipo: vacuna, jeringa, diluyente;
- mostrar advertencia cuando un producto inactivo no podrá usarse en importaciones;
- agregar contador visible: total, activos, inactivos;
- usar buscador con placeholder corto: `Código o descripción`.

Prioridad: media.

### 5.2 Inventario Inicial

Objetivo UX:

- cargar, validar, revisar y cerrar inventario sin perder control.

Problemas/riesgos:

- las tablas de previsualización son pesadas;
- el usuario necesita distinguir rápido filas válidas, errores y advertencias;
- el cierre es irreversible y debe sentirse serio sin depender de alertas nativas.

Mejoras recomendadas:

- presentar el flujo como pasos:
  1. Cargar archivo o registrar manual.
  2. Validar.
  3. Revisar borrador.
  4. Cerrar inventario.
- usar pestañas/segmentos en previsualización: `Válidas`, `Errores`, `Advertencias`;
- botón primario contextual: `Guardar válidas y omitir errores` cuando exista importación parcial;
- panel derecho compacto con acciones: descargar plantilla, registro manual, cerrar;
- en tabla, fijar columnas críticas: código, descripción, lote, saldo, validación;
- mantener producto manual con buscador, no combobox.

Prioridad: alta, porque es entrada inicial de datos.

### 5.3 Stock Biológico

Objetivo UX:

- mostrar el stock operativo propio por producto y lote.

Problemas/riesgos:

- se debe evitar volver a mostrar ubicación en vista propia;
- descripción de producto puede verse demasiado grande;
- el módulo no debe mezclarse con consulta territorial;
- la tabla debe parecerse visualmente al módulo `Stock SISMED`, que el usuario ya considera más correcto.

Mejoras recomendadas:

- tabla principal tipo `Stock SISMED`:
  - código;
  - descripción;
  - tipo;
  - dosis/unidad;
  - saldo;
  - lote/vencimiento próximo;
  - fuente/tipo si aplica;
  - alertas;
  - expandir.
- descripción del producto en 14 px semibold/black, no 20 px;
- detalle expandible con lote, vencimiento, saldo, precio, valor, fuente, suministro;
- no mostrar ubicación/ámbito en vista propia;
- para ADMIN, selector de soporte arriba y fuera de la tabla;
- para DIRESA/UNGET supervisora, crear o usar `Consulta de Stock Biológico`, no este módulo operativo.

Prioridad: alta.

### 5.4 Ingresos UNGET

Objetivo UX:

- registrar ingresos multi-producto sin que el formulario parezca una hoja de cálculo rota.

Problemas/riesgos detectados:

- el panel de filtros puede ocupar demasiado espacio si se abren fechas;
- el modal tiene muchos campos y puede sentirse ancho/desbalanceado;
- la lista de productos agregados debe quedar siempre visible como “carrito” de ingreso.

Mejoras recomendadas:

- mantener filtros compactos:
  - búsqueda;
  - periodo;
  - estado;
  - origen;
  - UNGET solo en supervisor;
  - `Fechas` como popover/colapsable.
- usar chips de filtros activos debajo solo si hay más de un filtro aplicado;
- en modal, dividir visualmente:
  - bloque superior compacto: datos del ingreso;
  - bloque central: agregar producto/lote;
  - bloque inferior: productos agregados;
  - footer sticky con total y acción.
- producto siempre por buscador tipo command palette;
- al agregar un producto, limpiar solo campos de lote/cantidad/precio y mantener foco en producto o lote según flujo real;
- mostrar total de lotes, unidades y valorización en una barra compacta fija.

Prioridad: alta, antes de seguir construyendo módulos similares.

### 5.5 Reajustes de Stock

Objetivo UX:

- resolver descuadres físicos con trazabilidad, sin hacer pensar al usuario en lógica técnica.

Problemas/riesgos:

- el reajuste es complejo: cantidad, lote nuevo y corrección de datos;
- la corrección de datos necesita comunicar claramente “lo que dice el sistema” vs “lo encontrado físicamente”;
- historial debe ser auditoría, no pantalla saturada.

Mejoras recomendadas:

- mantener los tres modos:
  - ajustar cantidad;
  - corregir datos;
  - agregar lote no registrado.
- hacer el selector de modo más compacto, con icono + título + descripción de una línea;
- en `Corregir datos`, usar comparación lado a lado:
  - tarjeta izquierda: sistema;
  - tarjeta derecha: físico;
  - flecha o vínculo visual al centro;
  - resumen de diferencia abajo.
- agregar microcopy clara:
  - “No se edita el registro anterior; se genera salida auditada y entrada correcta”.
- historial:
  - ocultar ubicación para usuario propio;
  - mostrar ubicación solo a UNGET/DIRESA/ADMIN;
  - botón PDF visible pero no dominante.

Prioridad: media-alta.

### 5.6 Reportes Inmunizaciones

Objetivo UX:

- consulta ejecutiva y exportación mensual.

Estado actual:

- el módulo está como base/placeholder.

Mejoras recomendadas:

- convertirlo en tablero por periodo:
  - avance de cierres;
  - UNGET pendientes;
  - IPRESS observadas;
  - consumos;
  - bajas/devoluciones;
  - productos vencidos;
  - valorización;
  - exportar PDF/Excel.
- DIRESA debe tener filtros territoriales avanzados.
- UNGET debe ver su red y sus IPRESS.
- IPRESS debe ver solo su propio movimiento mensual.
- separar reportes preliminares de definitivos con badge claro.

Prioridad: alta cuando se implemente cierre mensual.

## 6. Patrón recomendado para filtros

### 6.1 Filtros básicos visibles

Desktop:

- búsqueda: ancho flexible;
- periodo;
- estado;
- origen/tipo;
- botón `Más filtros`;
- botón `Limpiar`.

Mobile:

- búsqueda en primera línea;
- botón `Filtros`;
- filtros en bottom sheet o panel colapsable.

### 6.2 Filtros avanzados

Solo deben abrirse cuando el usuario los necesita:

- rango de fechas;
- UNGET;
- IPRESS;
- fuente;
- tipo de suministro;
- vencimiento;
- estado de cierre;
- usuario responsable.

### 6.3 Chips activos

Mostrar debajo de la barra:

- `Periodo: 2026-07`
- `Estado: Aplicado`
- `UNGET: Bellavista`
- `Desde: 01/07/2026`

Cada chip debe permitir quitar el filtro individualmente.

## 7. Patrón recomendado para tablas

### 7.1 Tabla principal

Debe responder:

- qué registro es;
- cuánto tiene;
- en qué estado está;
- qué acción se puede tomar.

No debe intentar mostrar todos los datos a la vez.

### 7.2 Fila expandible

Debe usarse para:

- detalle por lote;
- movimientos del ingreso;
- cambios del reajuste;
- detalle de distribución;
- incidencias.

### 7.3 Columnas según rol

Usuario propio:

- sin ubicación;
- sin ámbito;
- sin filtros territoriales.

Supervisor:

- ubicación visible;
- UNGET/IPRESS filtrable;
- consolidado disponible;
- sin acciones operativas destructivas.

## 8. Patrón recomendado para modales

### 8.1 Estructura

Header:

- icono;
- módulo;
- título;
- explicación de una línea.

Body:

- secciones claras;
- máximo dos niveles de contenedor visual;
- campos alineados;
- sin scroll horizontal.

Footer:

- resumen corto;
- cancelar;
- guardar/aplicar.

### 8.2 Validación

Evitar que el usuario tenga que adivinar:

- error debajo o cerca del campo;
- bloque de error general solo si el problema es global;
- disabled con motivo visual cuando una acción no está disponible.

### 8.3 Confirmación

Para operaciones irreversibles:

- cierre de inventario;
- aplicación de reajuste;
- distribución;
- recepción con diferencia;
- cierre mensual.

Usar modal personalizado, nunca `window.confirm`.

## 9. Responsive móvil

Reglas:

- tablas operativas deben transformarse en tarjetas;
- filtros avanzados en bottom sheet;
- acciones principales grandes y al alcance del pulgar;
- footer sticky en modales;
- evitar `min-w` excesivo salvo en tablas de revisión importada;
- mostrar códigos, lote y saldo como chips.

Pantallas críticas en móvil:

- registrar consumo IPRESS;
- aceptar distribución;
- consultar stock;
- registrar reajuste simple;
- ver alertas de vencimiento.

## 10. Accesibilidad mínima recomendada

Riesgos a controlar:

- combobox de producto debe soportar teclado y lectura por screen reader;
- campos obligatorios deben tener label real;
- no depender solo del color para estados;
- targets táctiles mínimos de 40-44 px;
- foco visible;
- modales deben devolver foco al cerrar;
- tablas deben conservar encabezados claros;
- errores deben usar `role="alert"` cuando bloquean una acción.

## 11. Lista priorizada de implementación UX

### P0 - Corrección de higiene visual y textos

1. Corregir textos con mojibake si términos como `Biológico`, `Catálogo` o `Código` se renderizan con caracteres corruptos.
2. Definir componentes base reutilizables para header, KPI, filtros, tabla, modal, chips y buscador de producto.
3. Estandarizar tamaños:
   - input: `h-10` en filtros, `h-11` en formularios;
   - descripción de producto: 13-14 px en tablas;
   - encabezados de tabla: 10-11 px uppercase;
   - cards: `rounded-2xl border border-slate-200 bg-white shadow-sm`.

### P1 - Ingresos regionales y distribución jerárquica

1. Convertir `Ingresos UNGET` a `Ingresos Regionales`.
2. Convertir fechas avanzadas a popover o panel compacto, no tarjeta alta.
3. Refinar modal de ingreso con footer sticky y resumen de totales.
4. Antes de implementar Distribución, diseñar el patrón matriz asistida reutilizable para DIRESA -> UNGET y UNGET -> IPRESS:
   - producto seleccionado arriba;
   - stock disponible y FEFO visible;
   - destinos en filas;
   - cantidades en celdas;
   - resumen fijo;
   - buscador rápido por código/nombre;
   - filtro para ver solo destinos con cantidad;
   - copiar cantidad a varios destinos seleccionados;
   - selección manual de lote con motivo.

### P2 - Stock Biológico e Inventario Inicial

1. Homologar `Stock Biológico` al estilo de tabla de `Stock SISMED`.
2. Ocultar columnas territoriales en vista propia.
3. Mejorar previsualización de inventario inicial con pestañas de válidas/errores/advertencias.
4. Hacer más compacto el panel lateral de acciones.

### P3 - Reajustes

1. Simplificar visualmente el selector de modo.
2. Mejorar comparación sistema/físico.
3. Reforzar microcopy de auditoría.
4. Ajustar historial para que la información territorial sea contextual por rol.

### P4 - Reportes y cierre mensual

1. Diseñar tablero de avance mensual.
2. Separar preliminar vs definitivo.
3. Crear exportación visualmente clara a PDF/Excel.
4. Mostrar estado de cierre por UNGET/IPRESS con semáforo operativo.

### P5 - Móvil

1. Convertir tablas principales a tarjetas.
2. Implementar filtros como bottom sheet.
3. Revisar modales de ingreso/reajuste/consumo en pantalla pequeña.
4. Validar flujo IPRESS desde celular.

## 12. Criterios de aceptación UX

Un módulo de Inmunizaciones se considera visualmente listo si cumple:

- la pantalla principal muestra información útil sin abrir detalle;
- los filtros no ocupan más altura que la tabla;
- no hay scroll horizontal fuera de tablas justificadas;
- las columnas cambian según rol y no repiten datos implícitos;
- el usuario sabe qué acción sigue;
- los estados se entienden por texto y color;
- el modal crítico tiene header, body y footer estables;
- el flujo funciona en móvil con tarjetas o paneles colapsables;
- el diseño mantiene coherencia con ToolKit SISMED.

## 13. Recomendación de trabajo

Antes de seguir creando muchas pantallas nuevas, conviene cerrar una mini-fase UX técnica:

1. crear componentes base visuales de Inmunizaciones;
2. migrar `Ingresos UNGET` a esos componentes;
3. usar esos mismos componentes como base para `Distribución a IPRESS`;
4. recién después continuar con recepción, consumo, bajas y cierre mensual.

Esto reduce retrabajo. Si se continúa implementando cada módulo con estilos propios, el sistema va a funcionar, pero se volverá más difícil de mantener y de llevar a un estándar profesional.
