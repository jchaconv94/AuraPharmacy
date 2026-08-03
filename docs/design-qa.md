# Design QA - Reajustes de Stock

## Evidencia

- Source visual truth: capturas adjuntas por el usuario en la conversacion del 21/07/2026; modal `Nuevo reajuste de stock` y tabla `Auditoria de reajustes`.
- Implementation screenshot path: no disponible.
- Viewport de referencia: escritorio, aproximadamente 1918 x 958 px para el modal y 1918 x 958 px para la tabla.
- Estado solicitado: correccion de datos de lote/capa, historial de una IPRESS propia y filtros territoriales para UNGET/DIRESA.

## Full-view comparison evidence

No fue posible capturar la implementacion renderizada. Tanto la conexion al navegador integrado como la conexion a Chrome fallaron antes de poder abrir la aplicacion local. No se realiza una comparacion visual basada solo en el codigo.

## Focused region comparison evidence

Bloqueada por el mismo motivo. Las regiones que deben compararse cuando el navegador este disponible son:

- selector de los tres tipos de reajuste;
- comparacion `Registrado en el sistema` frente a `Encontrado fisicamente`;
- campos y resumen de cantidades de la reclasificacion;
- tabla propia sin columna `Ubicacion`;
- filtros y columna territorial para UNGET/DIRESA;
- vista movil del modal y del historial.

## Findings

- [P1] Falta evidencia visual de la pantalla ejecutada.
  - Location: `components/ImmunizationAdjustmentModal.tsx` y `components/ImmunizationAdjustmentsModule.tsx`.
  - Evidence: no existe captura del estado implementado para compararla con las capturas del usuario.
  - Impact: no se puede confirmar visualmente altura, scroll interno, densidad, recortes o alineacion responsive.
  - Fix: abrir la aplicacion local con un usuario IPRESS y otro UNGET, capturar los estados indicados y repetir la comparacion.

## Required fidelity surfaces

- Fonts and typography: no verificable visualmente; se conservaron las clases tipograficas existentes del modulo.
- Spacing and layout rhythm: no verificable visualmente; requiere captura del modal abierto.
- Colors and visual tokens: se reutilizaron los tokens actuales teal, amber, violet y slate; falta confirmacion renderizada.
- Image quality and asset fidelity: no hay imagenes raster nuevas; se usaron iconos existentes de Lucide, como el resto del sistema.
- Copy and content: implementado con tres acciones diferenciadas y textos de Sistema/Fisico; falta revision final en pantalla.

## Primary interactions and console

- TypeScript: validado con `npm run lint`.
- Build de produccion: validado con `npm run build`.
- Interacciones en navegador: no verificadas por falta de conexion.
- Consola del navegador: no disponible.

## Comparison history

- Iteracion 1: se amplió el flujo desde dos opciones a tres y se agrego la reclasificacion origen/destino.
- Correcciones implementadas: ocultamiento de ubicacion en vista propia, filtros territoriales, detalle agrupado y PDF origen/destino.
- Evidencia post-fix: compilacion correcta y PDF renderizado; la evidencia de pantalla sigue bloqueada.

## Implementation checklist

- [x] Corregir cantidades de una capa existente.
- [x] Registrar una capa fisica no existente.
- [x] Reclasificar producto/lote/vencimiento/precio/fuente/suministro con movimientos enlazados.
- [x] Permitir reclasificacion total o parcial y diferencia neta de cantidad.
- [x] Ocultar ubicacion para usuario de la propia IPRESS.
- [x] Agregar filtros territoriales para UNGET/DIRESA.
- [x] Actualizar constancia PDF.
- [ ] Capturar y comparar la interfaz renderizada.

final result: blocked
