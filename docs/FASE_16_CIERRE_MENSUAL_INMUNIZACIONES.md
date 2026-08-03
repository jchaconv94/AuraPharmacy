# Fase 16 - Cierre mensual de inmunizaciones

## Alcance implementado

Se replanteó el módulo `Cierre Mensual` para controlar el corte mensual operativo y permitir que la IPRESS descargue su reporte mensual después del precierre.

### Flujo IPRESS

- La IPRESS puede realizar el `Precierre` del periodo solo si el periodo es válido.
- No se permite precerrar periodos futuros.
- No se permite precerrar un periodo sin consumos IPRESS registrados.
- Antes del precierre se valida:
  - que exista al menos un consumo del periodo;
  - que no existan distribuciones pendientes de recepción;
  - que no existan devoluciones, bajas o transferencias pendientes de aceptación por UNGET;
  - que el periodo no esté ya precerrado o cerrado.
- Al precerrar, el periodo queda bloqueado para nuevos consumos, devoluciones/bajas y reajustes.
- Después del precierre se habilita la descarga del reporte mensual en:
  - PDF;
  - Excel `.xlsx`.

### Reporte mensual IPRESS

El reporte se genera con estructura tipo movimiento biológico mensual e incluye:

- código SISMED;
- descripción oficial del catálogo;
- presentación dosis/unidad;
- saldo anterior;
- lote;
- fecha de vencimiento;
- ingreso del mes;
- fecha de recepción;
- total disponible;
- consumo por frasco/unidad;
- consumo por dosis;
- deteriorado/vencido/transferido;
- total movimiento;
- dosis aplicadas;
- dosis perdidas;
- factor de pérdida;
- saldo EESS en frascos;
- saldo total en dosis;
- precio;
- fuente;
- suministro;
- observaciones.

Regla aplicada: si el inventario inicial fue registrado en el mismo periodo, se considera como `saldo anterior`, no como `ingreso del mes`.

El Excel se genera con cabeceras agrupadas y celdas combinadas según la matriz operativa:

- `SALDO DISPONIBLE PARA EL MES X FRASCO`;
- `MOVIMIENTO DEL MES X FRASCO`;
- `MOVIMIENTO DEL MES X DOSIS`;
- columnas finales `SALDO EESS`, `SALDO TOTAL DOSIS` y `OBSERVACIONES`.

Las observaciones del reporte se limpian para no mostrar UUID, identificadores internos ni textos automáticos redundantes que ya existen como columnas del reporte. Cuando existe un evento relevante, se genera una observación operativa específica, por ejemplo:

- `Baja no disponible enviada a UNGET: 1 frasco. Motivo: Deteriorado`.
- `Reajuste de stock: +3 frascos. Motivo: Cambio de lote`.
- `Transferencia/devolución a UNGET: 2 frascos. Motivo: Transferencia`.

### Flujo UNGET

- La UNGET puede realizar el `Cierre definitivo` de su periodo.
- No se permite cerrar periodos futuros.
- La UNGET visualiza el avance de sus IPRESS con buscador por código, nombre, usuario, motivo de reapertura o estado.
- La UNGET puede filtrar el avance por estado: pendientes, precerradas, cerradas o reabiertas.
- La tabla de avance por IPRESS es paginable.
- Antes del cierre se valida:
  - que todas sus IPRESS estén precerradas;
  - que no existan distribuciones pendientes de recepción;
  - que no existan devoluciones o bajas pendientes de recepción;
  - que el periodo UNGET no esté ya cerrado.
- Al cerrar definitivamente, se bloquean movimientos operativos de ese periodo para el ámbito UNGET.
- Antes del cierre definitivo, la UNGET puede reabrir el precierre de una IPRESS específica registrando un motivo obligatorio.
- Al reabrir, la IPRESS queda habilitada para corregir sus movimientos y luego debe volver a precerrar el periodo.

### Vista DIRESA / Admin

- DIRESA/Admin visualiza avance consolidado por UNGET.
- Muestra total de IPRESS, precerradas, pendientes y estado de cierre UNGET.
- Incluye búsqueda, filtro por UNGET y filtro por estado del cierre.

### Corrección antes del cierre definitivo

Implementado actualmente:

- La corrección por `Reajustes` funciona mientras el periodo operativo esté abierto.
- La UNGET puede corregir su propio stock mediante `Reajustes` antes de cerrar definitivamente.
- La UNGET puede reabrir una IPRESS precerrada mientras el periodo UNGET no esté cerrado definitivamente.
- La reapertura registra usuario, fecha y motivo/sustento.
- Una IPRESS reabierta deja de contar como precerrada para el cierre definitivo UNGET.

## Archivos principales

- `components/ImmunizationClosuresModule.tsx`
- `services/immunizationApi.ts`
- `services/immunizationMonthlyReportService.ts`
- `types.ts`
- `App.tsx`
- `components/Sidebar.tsx`
- `components/MobileNav.tsx`
- `services/api.ts`
- `supabase/SUPABASE_MIGRATION_IMMUNIZATION_MONTHLY_CLOSURES.sql`

## Bloqueo operativo agregado

Se agregaron validaciones de periodo cerrado/precerrado antes de:

- consumo IPRESS;
- consumo IPRESS por registro múltiple;
- devolución/baja/transferencia desde IPRESS;
- recepción de devolución/baja por UNGET;
- envío de distribución UNGET -> IPRESS;
- recepción de distribución DIRESA -> UNGET o UNGET -> IPRESS;
- reajuste de stock UNGET/IPRESS.

## Migración Supabase

Ejecutar:

```sql
supabase/SUPABASE_MIGRATION_IMMUNIZATION_MONTHLY_CLOSURES.sql
```

La migración crea:

- `immunization_monthly_closures`
- índices por periodo, UNGET e IPRESS
- políticas RLS temporales consistentes con el resto del módulo
- actualización de permisos para `ADMIN`, `INMU_DIRESA`, `INMU_UNGET` e `INMU_IPRESS`

## Validación técnica

Comandos ejecutados:

```bash
npm run lint
npm run build
```

Resultado:

- `lint`: correcto.
- `build`: correcto.

Nota: Vite mantiene la advertencia existente de bundle grande; no bloquea compilación.

## Pendiente recomendado

En una fase posterior conviene implementar el reporte consolidado UNGET/DIRESA, usando el estado de cierres para separar:

- información abierta/parcial;
- información precerrada IPRESS;
- información cerrada definitiva UNGET.

Nueva regla pendiente definida:

- El movimiento biológico final de una UNGET debe incluir también el stock propio de la UNGET/almacén en una columna adicional.
- La matriz consolidada UNGET debe diferenciar como mínimo:
  - `SALDO ALMACÉN RED MES ANTERIOR` o equivalente para stock UNGET;
  - `SALDO IPRESS MES ANTERIOR`;
  - movimiento de IPRESS;
  - saldo almacén UNGET;
  - saldo EESS;
  - saldo total en frascos y dosis.
- Este reporte debe consolidar IPRESS cerradas/precerradas y el stock operativo de la UNGET en el mismo archivo final.
