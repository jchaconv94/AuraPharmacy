# AGENTS.md - ToolKit SISMED Web

Guía de contexto para agentes de IA que trabajen en este repositorio. Última actualización: 2026-07-30 (cierre de Fase 17).

---

## 1. Qué es este proyecto

Aplicación web interna (SPA React + Vite + TypeScript) para la **DIRESA San Martín (Perú)**. Cubre dos grandes dominios:

1. **Farmacia / SISMED** (módulos históricos): análisis de stock, redistribución, consumos, catálogos, panel admin, sincronización de dispositivos.
2. **Inmunizaciones** (módulo en construcción activa): control de biológicos por lote desde el almacén regional DIRESA hasta cada IPRESS, con cierre mensual y reportes de movimiento biológico.

**El trabajo actual está 100% concentrado en Inmunizaciones.** Los módulos de farmacia no se tocan salvo pedido explícito.

Idioma del proyecto: **español**. Documentación, commits, UI, mensajes de error y nombres de módulos en español. Código (identificadores) en inglés/camelCase.

---

## 2. Comandos

```bash
npm install
```

```bash
npm run dev
```

```bash
npm run lint
```

```bash
npm test
```

```bash
npm run build
```

- `npm run lint` = `tsc --noEmit`. **No hay ESLint.** Es la única verificación estática.
- `npm run build` = `tsc && vite build`. Vite emite una advertencia de *bundle grande*: es preexistente y **no bloquea**.
- `npm test` = `vitest run`. La cobertura es mínima y deliberadamente enfocada: `services/immunizationMonthlyReportService.test.ts` (aritmética de los reportes mensuales) y `services/DropdownPositioningService.test.ts`. No hay tests de componentes.
- Servidor local: `http://127.0.0.1:3000/ToolkitSISMED/` (nota el `base: '/ToolkitSISMED/'` en `vite.config.ts`).
- En Windows, si `npm` falla desde bash, usar `npm.cmd`.

**Regla de cierre de fase:** toda fase termina con `npm run lint` y `npm run build` en verde, y un documento `FASE_NN_*.md`. Si la fase toca aritmética de saldos o reportes, agregar también pruebas y dejar `npm test` en verde.

---

## 3. Estado del repositorio — advertencia importante

`.git/` existe pero está **vacío**: el proyecto **no tiene historial de versiones funcional**. `git log`, `git status` y `git diff` fallan con *"not a git repository"*.

Consecuencias prácticas:

- No hay forma de revertir cambios ni de ver un diff de trabajo.
- Antes de refactors grandes conviene copiar los archivos afectados o pedir al usuario que inicialice el repo (`git init` + primer commit).
- No asumir que existe una rama `main` sincronizada, aunque `.github/workflows/deploy.yml` despliegue desde `main` a GitHub Pages.

---

## 4. Arquitectura

```
App.tsx                     Router manual por `currentView` (string switch, sin react-router)
index.tsx                   Bootstrap
types.ts                    Fuente única de tipos, AppModule y AVAILABLE_MODULES
contexts/AuthContext.tsx    Sesión, rol, hasPermission()
components/                 Un archivo .tsx por módulo (componentes grandes, sin subcarpetas por dominio)
components/ui/              ConfirmationDialog, CustomSelect (única capa "compartida" real)
services/                   Acceso a datos y generación de documentos
supabase/functions/         Edge function sync-stock
backend/                    Google Apps Script legado
scripts/                    Generadores de preview de PDF (ejecución manual)
reportes-ejemplo/           PDFs de referencia visual
```

**No hay react-router.** La navegación es `currentView: AppModule` en `App.tsx`, con Sidebar/MobileNav como disparadores. Al agregar un módulo hay que tocar **cinco** lugares:

1. `types.ts` → union `AppModule` + entrada en `AVAILABLE_MODULES`
2. `App.tsx` → import, título de cabecera, render condicional y fallback de permisos
3. `components/Sidebar.tsx`
4. `components/MobileNav.tsx`
5. Permisos por rol en Supabase (`roles_config.allowed_modules`)

Olvidar cualquiera de estos deja el módulo inaccesible o sin título.

### Persistencia

- **Supabase** (`services/supabaseClient.ts`) es el backend real. Cliente `anon`.
- **Autenticación propia** sobre tabla `users` con `bcryptjs` — **no** se usa Supabase Auth.
- Por eso las **políticas RLS son temporales/permisivas**. La seguridad real hoy vive en el frontend/servicios vía `ImmunizationScope`. RLS definitiva requiere migrar a Supabase Auth o mover escrituras a Edge Functions/RPC. Está documentado como deuda conocida en `INMUNIZACIONES_DISENO_FUNCIONAL.md` §25.

> **La clave `anon` es pública y hoy tiene permisos de administración.** Auditoría del 2026-07-31 (`SEGURIDAD_AUDITORIA.md`): `anon` puede leer, escribir y borrar **todas** las tablas de `public`, incluida `users`. Cualquiera que extraiga la clave del bundle desplegado puede crear una cuenta `ADMIN` y entrar. También quedan expuestos DNI, teléfono y correo de 70 personas en `personnel`.
>
> La causa es de diseño: al no usarse Supabase Auth, la base no sabe quién llama y todas las peticiones llegan como `anon`, así que no se pueden escribir políticas RLS por rol. **No se arregla rotando la clave**: la nueva volvería a publicarse en el siguiente despliegue.
>
> **Nunca pidas `password_hash` desde el cliente ni uses `select("*")` sobre `users`** — usa la constante `USER_SELECT` de `services/api.ts`. La verificación de contraseña ocurre en el servidor con la función `app_verify_password`. Contexto completo en `SEGURIDAD_ETAPA_1_LOGIN.md`.
- **Todo servicio de inmunizaciones tiene fallback a `localStorage`** cuando `supabase` es null o falla la consulta. Patrón: `try { if (supabase) {...} } catch { console.warn("Fallback local ...") }` y luego `getCachedList<T>(CACHE_KEY)`. Al agregar una operación nueva hay que implementar **ambos** caminos, o los datos se comportan distinto según el entorno.

---

## 5. Modelo de dominio de Inmunizaciones

### Flujo jerárquico de abastecimiento (vigente desde el refactor de Fase 14)

```
DIRESA (almacén regional)
  → ingreso regional  → stock DIRESA
  → distribución      → recepción UNGET (con incidencias)
UNGET (almacén de red)
  → distribución      → recepción IPRESS (con incidencias)
IPRESS (establecimiento)
  → consumo por lote / devolución / baja / transferencia → UNGET
```

Cierre: **IPRESS precierra**, **UNGET cierra definitivamente** (solo si todas sus IPRESS están precerradas).

> Ojo: el modelo *anterior* era "UNGET registra ingresos". Las Fases 11–13 se escribieron bajo ese modelo y fueron refactorizadas en la Fase 14. Documentos y nombres de permiso pueden conservar el nombre viejo (`IMMUNIZATION_INCOMES` hoy es *"Ingresos Regionales"* de DIRESA).

### Stock por capas (layers)

`immunization_stock_layers` es la unidad real de existencias. Una capa = combinación de propietario + producto + lote + vencimiento + precio + fuente de financiamiento + tipo de suministro. **Nunca** se edita el saldo de una capa directamente desde la UI: todo cambio pasa por un movimiento en `immunization_stock_movements` con `quantity_before` / `quantity_delta` / `quantity_after`.

Salida por defecto: **FEFO** (primero el que vence antes), con opción manual de elegir lote.

### Tipos de movimiento en uso

`INITIAL_INVENTORY`, `DIRESA_INCOME`, `UNGET_INCOME`, `DIRESA_DISTRIBUTION_OUT`, `UNGET_DISTRIBUTION_IN`, `UNGET_DISTRIBUTION_OUT`, `IPRESS_DISTRIBUTION_IN`, `IPRESS_CONSUMPTION`, `IPRESS_RETURN_OUT`, `IPRESS_TRANSFER_OUT`, `IPRESS_DISPOSAL_OUT`, `UNGET_RETURN_IN`, `UNGET_TRANSFER_IN`, `UNGET_DISPOSAL_RECEIVED`, `STOCK_ADJUSTMENT`.

### Estados

| Entidad | Estados |
|---|---|
| Ingreso | `DRAFT` → `APPLIED` / `VOIDED` |
| Distribución | `DRAFT` → `SENT` → `RECEIVED` / `OBSERVED` / `VOIDED` |
| Devolución/baja | `SENT` → `RECEIVED` / `OBSERVED` / `VOIDED` |
| Inventario inicial | `DRAFT` → `CLOSED` |
| Cierre mensual | `PRE_CLOSED` / `FINAL_CLOSED` / `REOPENED` |

`OBSERVED` = recibido con diferencia física; exige motivo seleccionado + observación escrita. El stock sube **solo** por la cantidad físicamente recibida.

### Alcance (`ImmunizationScope`)

`getImmunizationScope(user)` en `services/immunizationApi.ts:443` deriva el ámbito desde el usuario:

- `level`: `GLOBAL` | `DIRESA` | `OGESS` | `UNGET` | `MICRORED` | `IPRESS`
- `ownerType`: `DIRESA` | `UNGET` | `IPRESS`
- claves de filtro: `diresaId`, `ogessId`, `ungetId(s)`, `facilityCode(s)`

Precedencia: ADMIN → `GLOBAL`; si hay `facilityCode` → `IPRESS`; luego UNGET, OGESS, DIRESA.

**Todo listado nuevo debe filtrarse por scope en las dos rutas** (query Supabase y filtro del fallback local). El helper `applyOwnerScope(query, scope)` cubre el caso simple; los listados con lógica propia (ver `listMonthlyClosures`, `listStockMovements`) repiten el patrón a mano.

**Regla aprendida (2026-07-30):** un registro propiedad de una IPRESS **siempre debe llevar `unget_id`**, además de `facility_code`. Si no, queda invisible para toda consulta por UNGET y el consolidado mensual pierde esos movimientos. Al escribir capas o movimientos de IPRESS usa `resolveOwnerUngetId(ownerType, ungetId, facilityCode)`, que lo deduce de `facilities.unget_id`. `closeInitialInventory` y `createAdjustment` incumplían esto; ver `VALIDACION_DATOS_REALES_INMUNIZACIONES.md`.

### Reglas críticas (no negociables)

- No se permite saldo negativo.
- No se consume un lote inexistente.
- El catálogo maestro manda sobre la descripción del Excel; producto ausente o inactivo bloquea la fila.
- El inventario inicial cerrado no se edita: se corrige con Reajustes auditados.
- Productos vencidos/deteriorados **no** vuelven a stock disponible.
- Periodo mensual calendario, formato `YYYY-MM`. **No se opera en periodos futuros.**
- Un periodo precerrado (IPRESS) o cerrado (UNGET) bloquea consumo, devolución/baja, recepción, distribución y reajuste. Verificar con `immunizationApi.isPeriodLocked(scope, period)` antes de cualquier escritura nueva.
- Auditoría en todo movimiento crítico: usuario, fecha, motivo. Sin update/delete ordinario sobre movimientos.

---

## 6. Módulos de Inmunizaciones

| `AppModule` | Etiqueta UI | Componente | Rol operativo |
|---|---|---|---|
| `IMMUNIZATION_CATALOG` | Catálogo Biológico | `ImmunizationCatalogModule.tsx` | DIRESA/Admin |
| `IMMUNIZATION_INITIAL_INVENTORY` | Inventario Inicial | `ImmunizationInitialInventoryModule.tsx` | UNGET/IPRESS |
| `IMMUNIZATION_STOCK` | Stock Biológico | `ImmunizationStockModule.tsx` | propietario del stock |
| `IMMUNIZATION_INCOMES` | Ingresos Regionales | `ImmunizationIncomesModule.tsx` | DIRESA |
| `IMMUNIZATION_INCOME_ORIGINS` | Orígenes de Ingreso | `ImmunizationIncomeOriginsModule.tsx` | DIRESA/Admin |
| `IMMUNIZATION_DISTRIBUTIONS` | Distribuciones | `ImmunizationDistributionsModule.tsx` | DIRESA→UNGET, UNGET→IPRESS |
| `IMMUNIZATION_CONSUMPTION` | Consumo IPRESS | `ImmunizationConsumptionModule.tsx` | IPRESS |
| `IMMUNIZATION_RETURNS` | Devoluciones y Bajas | `ImmunizationReturnsModule.tsx` | IPRESS → UNGET |
| `IMMUNIZATION_ADJUSTMENTS` | Reajustes de Stock | `ImmunizationAdjustmentsModule.tsx` + `ImmunizationAdjustmentModal.tsx` | UNGET/IPRESS |
| `IMMUNIZATION_CLOSURES` | Cierre Mensual | `ImmunizationClosuresModule.tsx` | IPRESS precierra / UNGET cierra |
| `IMMUNIZATION_REPORTS` | Reportes Inmunizaciones | `ImmunizationReportsModule.tsx` | tablero de avance + descargas por UNGET y del ámbito |

### Servicios

| Archivo | Contenido |
|---|---|
| `services/immunizationApi.ts` (~171 KB) | Objeto `immunizationApi` con toda la lógica CRUD + reglas. Es el archivo más importante del módulo. |
| `services/immunizationMonthlyReportService.ts` | Filas y export PDF/Excel del movimiento biológico mensual. **Cinco** variantes sobre el **mismo** formato de 19 columnas: `IPRESS`, `UNGET_WAREHOUSE`, `UNGET_NETWORK`, `DIRESA_WAREHOUSE` y `DIRESA_NETWORK` (ver `REPORT_VARIANTS`). Un cambio de layout aplica a las cinco. |
| `services/immunizationProgressService.ts` | Avance operativo mensual en **funciones puras**: estado de cierres, pendientes, incidencias, consumo, vencimientos y valorización. Fuente única de "precerrada / pendiente / cerrada" para el tablero y el módulo de cierre. |
| `services/immunizationExcelService.ts` | Parser `.xlsx` de inventario inicial, detección de columnas alternativas, plantilla. |
| `services/immunizationAdjustmentPdfService.ts` | Constancia PDF A4 de reajuste. |

---

## 7. Migraciones SQL

Los `.sql` de la raíz son **scripts que el usuario ejecuta manualmente en el panel de Supabase**. No hay CLI de migraciones ni control de versión de esquema. Al crear una migración: archivo nuevo, idempotente donde sea posible, y anotarla en el documento de fase.

Orden histórico del módulo:

1. `SUPABASE_SCHEMA_IMMUNIZATIONS_V1.sql` — base (productos, inventario inicial, capas, movimientos, reajustes)
2. `SUPABASE_MIGRATION_IMMUNIZATION_ADJUSTMENTS.sql`
3. `SUPABASE_MIGRATION_IMMUNIZATION_INCOMES.sql`
4. `SUPABASE_MIGRATION_IMMUNIZATION_DISTRIBUTIONS.sql`
5. `SUPABASE_MIGRATION_IMMUNIZATION_RECEPTIONS.sql`
6. `SUPABASE_MIGRATION_IMMUNIZATION_REGIONAL_REFACTOR.sql` — refactor de Fase 14
7. `SUPABASE_MIGRATION_IMMUNIZATION_CONSUMPTION.sql`
8. `SUPABASE_MIGRATION_IMMUNIZATION_RETURNS.sql`
9. `SUPABASE_MIGRATION_IMMUNIZATION_MONTHLY_CLOSURES.sql`

Los `SUPABASE_SCHEMA_V2..V15.sql` pertenecen al dominio de farmacia/SISMED, no a inmunizaciones.

---

## 8. Convenciones de UI

Referencia normativa: `UX_PLAN_INMUNIZACIONES.md`. Resumen operativo:

- **Estilo base:** sidebar oscuro, fondo `slate` claro, tarjetas `rounded-2xl border border-slate-200 bg-white shadow-sm`, iconos `lucide-react`, Tailwind.
- **Color con significado:** teal/cyan = información/stock; emerald = aplicado/cerrado/vigente; amber = pendiente/advertencia/reajuste; red = vencido/error/bloqueo; violet = reclasificación; blue = vista supervisora; slate = neutro.
- **Densidad:** 1 tarjeta de cabecera, máximo 4–5 KPIs, filtros en **una sola barra** compacta; fechas y filtros avanzados en popover/colapsable, nunca en tarjeta alta.
- **Tablas:** encabezado sticky, filas 52–60 px, descripción del producto a 13–14 px (no tamaño título), código SISMED en chip/monospace, estados en chips, acciones a la derecha, detalle por lote en fila expandible.
- **Operación ≠ supervisión:** en vista propia **no** mostrar columnas de Ubicación/Ámbito (son implícitas en la sesión). Solo el supervisor ve filtros territoriales.
- **Modales:** header fijo + body con scroll interno + footer fijo; sin scroll horizontal; `max-w-3xl` formulario simple, `max-w-5xl` operación con lista, `max-w-6xl` comparación compleja.
- **Nunca `window.confirm` / `alert`.** Usar modal propio (`components/ui/ConfirmationDialog.tsx`) para toda acción irreversible: cierre de inventario, aplicar reajuste, enviar distribución, recepción con diferencia, cierre mensual.
- **Móvil:** tablas → tarjetas; filtros → bottom sheet; footer sticky en modales.
- **Acentos:** cuidado con mojibake. `Biológico`, `Catálogo`, `Código`, `Distribución` deben renderizarse correctos en pantalla **y en PDF/Excel** (ver `services/pdfUnicodeFont.ts`).

Deuda UX conocida y aceptada: la capa de componentes comunes propuesta en `UX_PLAN_INMUNIZACIONES.md` §4.1 (`ImmunizationPageHeader`, `ImmunizationKpiCard`, `ImmunizationFilterBar`, etc.) **nunca se creó**. Cada módulo repite sus propios estilos. Si se toca UI a fondo, evaluar extraerlos; si no, mantener consistencia copiando el patrón del módulo más cercano.

---

## 9. Historial de fases

Documento maestro: `PLAN_IMPLEMENTACION_INMUNIZACIONES.md`. Diseño funcional de referencia: `INMUNIZACIONES_DISENO_FUNCIONAL.md`.

**Etapa 1 — base (Fases 1–10, cerrada)**
Catálogo maestro, tipos/permisos/navegación, servicios y alcance, importador `.xlsx` de inventario inicial, registro manual, cierre de inventario que genera capas, stock agrupado por producto/lote con alertas de vencimiento, reajustes auditados con constancia PDF. Handoff: `FASE_10_HANDOFF_ETAPA_1_INMUNIZACIONES.md`.

**Etapa 2 — operación mensual**

| Fase | Alcance | Doc | Estado |
|---|---|---|---|
| 11 | Ingresos (modelo antiguo UNGET) | `FASE_11_INGRESOS_UNGET.md` | refactorizada en F14 |
| 12 | Distribución UNGET → IPRESS | `FASE_12_DISTRIBUCION_UNGET_IPRESS.md` | refactorizada en F14 |
| 13 | Recepción IPRESS con incidencias | `FASE_13_RECEPCION_IPRESS_INCIDENCIAS.md` | generalizada en F14 |
| 14 | **Refactor abastecimiento regional** DIRESA → UNGET → IPRESS | `FASE_14_REFACTOR_ABASTECIMIENTO_REGIONAL.md` | implementada |
| 15 | Devoluciones, bajas y transferencias IPRESS → UNGET | `FASE_15_DEVOLUCIONES_BAJAS_IPRESS_UNGET.md` | implementada |
| 16 | Cierre mensual: precierre IPRESS, cierre definitivo UNGET, reapertura con motivo, bloqueo por periodo, reporte mensual IPRESS PDF/Excel | `FASE_16_CIERRE_MENSUAL_INMUNIZACIONES.md` | implementada |
| 17 | **Reportes mensuales UNGET**: almacén y consolidado de red, PDF + Excel, dentro de Cierre Mensual | `FASE_17_REPORTE_CONSOLIDADO_UNGET.md` | implementada y rediseñada el 2026-07-30 |
| — | **Validación con datos reales** contra Supabase; destapó el defecto de `unget_id` nulo en registros de IPRESS | `VALIDACION_DATOS_REALES_INMUNIZACIONES.md` | corregido; reparación de datos opcional pendiente |
| 18 | **Reportes mensuales regionales DIRESA**: almacén regional y consolidado de región, con marcado preliminar/definitivo | `FASE_18_REPORTE_CONSOLIDADO_DIRESA.md` | implementada |
| 19 | **Tablero de avance operativo** en `Reportes Inmunizaciones`, con alcance por rol y descargas por UNGET | `FASE_19_TABLERO_AVANCE_OPERATIVO.md` | **implementada — último punto de trabajo** |

**Los reportes se descargan desde dos sitios y es intencional.** `Cierre Mensual` los ofrece a quien opera su propio cierre (IPRESS y UNGET); `Reportes Inmunizaciones` los ofrece a DIRESA por fila de UNGET y para el ámbito completo, porque ahí es donde supervisa. Ambos usan las mismas funciones de descarga, así que el archivo es idéntico.

Con la Fase 19 la **Etapa 2 queda funcionalmente completa** y §20 del diseño funcional está cubierta entera: el consolidado biológico vive en `Cierre Mensual` y el avance operativo en `Reportes Inmunizaciones`.

### El sistema de reportes (Fases 16-18) — donde quedó el trabajo

Cinco variantes, **un solo formato de 19 columnas**. Todas se arman con dos builders genéricos en `immunizationMonthlyReportService.ts`:

- `buildWarehouseReportRows(options, ownerType, isDistribution, isLoss)` — un almacén; la salida (e) es la distribución al nivel de abajo; las columnas de dosis van en `null`.
- `buildNetworkReportRows(options, ownerTypes, isIncome, isLoss)` — un ámbito consolidado; los traslados internos se anulan.

Los cinco builders públicos son envolturas de una línea. **Agregar un nivel nuevo es declarar sus clasificadores**, no escribir un reporte.

**La regla que sostiene los consolidados, en las dos alturas:** lo que queda dentro del ámbito del reporte es traslado interno y no cuenta como movimiento. `INTERNAL_NETWORK_MOVEMENT_TYPES` cubre UNGET↔IPRESS; `INTERNAL_REGIONAL_MOVEMENT_TYPES` le suma DIRESA↔UNGET. Solo cuentan las entradas desde fuera del ámbito y las salidas reales: consumo, baja no disponible (`IPRESS_DISPOSAL_OUT`, que sale y no vuelve) y reajustes negativos. Gracias a eso el `% factor de pérdida` es el indicador real de cada nivel. **Si tocas esta clasificación, corre `npm test`**: está cubierta en los tres niveles.

`isPreliminary` / `preliminaryReason` marcan el consolidado regional mientras falte alguna UNGET por cerrar: sufijo en el título, aviso en la nota y prefijo en el nombre del archivo. Se calcula sobre todas las UNGET supervisadas, **nunca sobre las filas filtradas en pantalla**.

### Detalle de las variantes UNGET

La UNGET descarga **dos** reportes, y ambos usan el mismo formato de 19 columnas del movimiento biológico IPRESS. Solo cambia qué alimenta cada columna y el rótulo de la salida (e).

| | Almacén UNGET | Consolidado red UNGET |
|---|---|---|
| builder | `buildImmunizationUngetWarehouseReportRows` | `buildImmunizationUngetNetworkReportRows` |
| (b) saldo anterior | del almacén | almacén + todas sus IPRESS |
| (c) ingreso | DIRESA + devoluciones aceptadas + reajustes + | **solo desde DIRESA** |
| (e) salida | `DISTRIBUCIÓN A IPRESS` | `CONSUMO IPRESS` |
| (i)(j)(k) dosis | **`null` → celda vacía** | dosis reales de las IPRESS |
| (l) saldo final | `SALDO ALMACÉN` | `SALDO TOTAL RED` |
| habilitación | periodo no futuro + hay datos | control de cierre completo |

**No hay anexo por establecimiento y es deliberado** (decidido el 2026-07-30). Crecería como `nº IPRESS × nº productos × nº lotes` y esa información ya existe: cada IPRESS emite su propio movimiento biológico al precerrar. Nada se pierde — `SALDO TOTAL RED − SALDO ALMACÉN` da el saldo conjunto de las IPRESS, y hay una prueba que verifica esa relación. Si alguien vuelve a proponer el anexo, este es el motivo por el que se descartó.

**La regla que sostiene el consolidado:** la distribución UNGET→IPRESS y las devoluciones IPRESS→UNGET son **traslados internos** y se anulan (constante `INTERNAL_NETWORK_MOVEMENT_TYPES`). Solo cuentan el ingreso desde DIRESA y las salidas reales: consumo, baja no disponible (`IPRESS_DISPOSAL_OUT`, que sale de la red y no vuelve) y reajustes negativos. Gracias a eso el `% factor de pérdida` del consolidado es el indicador real de la UNGET. **Si tocas esta clasificación, corre `npm test`**: la aritmética está cubierta.

Para ver cómo salen los PDF sin abrir la app:

```bash
npx vite-node scripts/generateImmunizationReportPreviews.ts
```

Usa los mismos builders que la aplicación y escribe las tres muestras en PDF y `.xlsx` en `reportes-ejemplo/`. Es posible porque `buildMonthlyReportPdfDoc` / `buildMonthlyReportWorkbook` están separados de las funciones de descarga. **Si ajustas anchos de columna del PDF, regenera y revisa la advertencia `could not fit page` de jspdf-autotable**: los anchos deben sumar 291 mm en A4 apaisado con margen de 3 mm.

**Trampa de ExcelJS, ya pagada una vez:** `row.values = [...]` con un array literal es **0-based** (índice 0 → columna A). ExcelJS solo usa numeración 1-based con arrays realmente dispersos, porque comprueba `value.hasOwnProperty('0')` y un `undefined` explícito sí cuenta. Poner un `undefined` inicial "para saltar la columna 0" corre todo el reporte una columna y rompe las fórmulas. Las pruebas fijan la posición de las celdas (`A6`, `D5`, `I6`) para que esto no se repita.

La versión anterior de esta fase usaba una matriz propia con columnas (b) almacén y (c) IPRESS separadas: contaba las devoluciones dos veces (pérdida de IPRESS + ingreso de UNGET) e inflaba el total de movimiento con traslados internos. Se retiró. `scripts/generateUngetConsolidatedPdfPreview.mjs` y `reportes-ejemplo/MOVIMIENTO_BIOLOGICO_UNGET_EJEMPLO_A4.pdf` reproducen esa matriz vieja y **quedaron obsoletos**.

Decisión mantenida: **la columna "Necesidad próximo mes" queda fuera**, igual que en el reporte IPRESS.

Regla del reporte IPRESS que también aplica a los tres: si el inventario inicial se registró en el mismo periodo, cuenta como **saldo anterior**, no como ingreso del mes. Las observaciones se limpian de UUIDs y textos automáticos redundantes.

---

## 10. Siguiente trabajo (Fase 18 propuesta)

**No queda construcción nueva pendiente en la Etapa 2.** Lo que sigue es consolidación, por orden de valor:

1. **Validar un periodo real completo** con varias IPRESS y muchos lotes. Todo lo construido está probado con datos escasos (1 producto, 11 movimientos); es el mayor riesgo abierto.
2. **Deuda UX** del `UX_PLAN_INMUNIZACIONES.md`: la capa de componentes comunes §4.1 nunca se creó, falta la revisión móvil §9 y los filtros territoriales avanzados para DIRESA.
3. **Módulo `Consulta de Stock Biológico`**: diseñado (§7.3) y nunca implementado.
4. **Seguridad de acceso a datos — es ahora la prioridad real.** La auditoría (`SEGURIDAD_AUDITORIA.md`) confirmó escalada de privilegios explotable. Orden: (a) `SUPABASE_SECURITY_STAGE2_LOCKDOWN.sql` corta la escritura sobre `users` y `roles_config`; (b) reconstruir la administración de usuarios como funciones `SECURITY DEFINER` con reautenticación; (c) migrar a Supabase Auth, única vía para proteger el resto sin romper la app. La etapa 1 (`SEGURIDAD_ETAPA_1_LOGIN.md`) sigue pendiente de aplicar.

**Antes de empezar, corre el diagnóstico contra datos reales** (solo lectura, necesita `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`):

```bash
npx vite-node scripts/validateImmunizationReportsAgainstSupabase.ts 2026-07
```

Compara el saldo que calculan los reportes con el stock realmente almacenado, verifica el tablero de avance y avisa de registros de IPRESS huérfanos. Fue lo que destapó el defecto de `unget_id`.

Otros pendientes menores:

- Exportación del tablero de avance a PDF/Excel, sugerida en `UX_PLAN_INMUNIZACIONES.md` §5.6. Se dejó fuera a propósito: el movimiento biológico ya se exporta desde Cierre Mensual.
- La validación visual automatizada por navegador quedó bloqueada históricamente (ver `design-qa.md`), así que la verificación visual la hace el usuario manualmente.
- `scripts/generateUngetConsolidatedPdfPreview.mjs` y `reportes-ejemplo/MOVIMIENTO_BIOLOGICO_UNGET_EJEMPLO_A4.pdf` siguen ahí y están obsoletos.

---

## 11. Cómo trabajar aquí

1. **Leer primero** el `FASE_NN_*.md` más reciente y la sección correspondiente de `INMUNIZACIONES_DISENO_FUNCIONAL.md` antes de tocar código.
2. **Incrementos pequeños**, una fase por vez, con entregable verificable. No construir varias fases de golpe.
3. **No romper farmacia/SISMED.** Los componentes de ese dominio (`SheetSearchModule`, `RedistributionModule`, `AdminOrganizationModule`, `IpressStockModule`…) son grandes y frágiles; no refactorizarlos de paso.
4. Al agregar una operación de escritura: validar scope, validar periodo bloqueado, no permitir negativos, registrar movimiento auditable, e implementar la **ruta Supabase y la ruta localStorage**.
5. Cerrar cada fase con `npm run lint` + `npm run build` y un documento `FASE_NN_*.md` con: alcance implementado, reglas funcionales, archivos modificados, migración a ejecutar, validación técnica y pendiente posterior.
6. Actualizar `PLAN_IMPLEMENTACION_INMUNIZACIONES.md` (sección "Avance actual") en el mismo cierre.
7. Ante ambigüedad funcional (qué columna, qué regla de saldo, qué rol opera), **preguntar al usuario**: es quien conoce la operación real de la DIRESA y varias decisiones ya se revirtieron por asumir de más.
