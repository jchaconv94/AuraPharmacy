-- ============================================================================
-- Reparación: vincular registros de IPRESS con su UNGET
-- ============================================================================
--
-- PROBLEMA
--
-- Los registros de inmunizaciones propiedad de una IPRESS se guardaron con
-- `unget_id = NULL`. El origen estaba en `closeInitialInventory` y en
-- `createAdjustment` dentro de `services/immunizationApi.ts`, que solo escribían
-- `unget_id` cuando el propietario era una UNGET.
--
-- Esos registros quedan invisibles para cualquier consulta filtrada por UNGET.
-- En el reporte consolidado mensual el efecto observado fue que un reajuste de
-- stock aparecía como `SALDO MES ANTERIOR` en vez de como `INGRESO EN EL MES`.
--
-- Tipos de movimiento afectados: INITIAL_INVENTORY y STOCK_ADJUSTMENT.
--
-- ESTADO DEL CÓDIGO
--
-- La causa ya está corregida: los nuevos registros heredan la UNGET del
-- establecimiento. La consulta de movimientos además empareja por código de
-- IPRESS, así que el reporte ya lee bien los datos antiguos. Esta reparación es
-- recomendable para dejar los datos coherentes, pero no es urgente.
--
-- CÓMO EJECUTAR
--
-- 1. Ejecutar primero el bloque de DIAGNÓSTICO y revisar cuántas filas saldrían.
-- 2. Ejecutar la REPARACIÓN dentro de una transacción.
-- 3. Ejecutar la VERIFICACIÓN: debe devolver 0 filas.
--
-- La reparación solo escribe donde `unget_id IS NULL` y el establecimiento tiene
-- una UNGET asignada. No modifica ninguna cantidad ni ningún saldo.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. DIAGNÓSTICO - ejecutar y revisar antes de reparar
-- ----------------------------------------------------------------------------

SELECT 'immunization_stock_layers' AS tabla, COUNT(*) AS filas_huerfanas
FROM immunization_stock_layers
WHERE owner_type = 'IPRESS' AND unget_id IS NULL
UNION ALL
SELECT 'immunization_stock_movements', COUNT(*)
FROM immunization_stock_movements
WHERE owner_type = 'IPRESS' AND unget_id IS NULL
UNION ALL
SELECT 'immunization_initial_inventories', COUNT(*)
FROM immunization_initial_inventories
WHERE owner_type = 'IPRESS' AND unget_id IS NULL
UNION ALL
SELECT 'immunization_adjustments', COUNT(*)
FROM immunization_adjustments
WHERE owner_type = 'IPRESS' AND unget_id IS NULL;

-- IPRESS con registros huérfanos que NO tienen UNGET asignada en `facilities`.
-- Estas filas no se pueden reparar automáticamente: primero hay que corregir la
-- organización. Lo esperado es que devuelva 0 filas.
SELECT DISTINCT m.facility_code
FROM immunization_stock_movements m
LEFT JOIN facilities f ON f.code = m.facility_code
WHERE m.owner_type = 'IPRESS'
  AND m.unget_id IS NULL
  AND (f.code IS NULL OR f.unget_id IS NULL);


-- ----------------------------------------------------------------------------
-- 2. REPARACIÓN
-- ----------------------------------------------------------------------------

BEGIN;

UPDATE immunization_stock_layers AS l
SET unget_id = f.unget_id
FROM facilities AS f
WHERE l.owner_type = 'IPRESS'
  AND l.unget_id IS NULL
  AND l.facility_code = f.code
  AND f.unget_id IS NOT NULL;

UPDATE immunization_stock_movements AS m
SET unget_id = f.unget_id
FROM facilities AS f
WHERE m.owner_type = 'IPRESS'
  AND m.unget_id IS NULL
  AND m.facility_code = f.code
  AND f.unget_id IS NOT NULL;

UPDATE immunization_initial_inventories AS i
SET unget_id = f.unget_id
FROM facilities AS f
WHERE i.owner_type = 'IPRESS'
  AND i.unget_id IS NULL
  AND i.facility_code = f.code
  AND f.unget_id IS NOT NULL;

UPDATE immunization_adjustments AS a
SET unget_id = f.unget_id
FROM facilities AS f
WHERE a.owner_type = 'IPRESS'
  AND a.unget_id IS NULL
  AND a.facility_code = f.code
  AND f.unget_id IS NOT NULL;

-- Revisar los conteos antes de confirmar. Si algo no cuadra: ROLLBACK;
COMMIT;


-- ----------------------------------------------------------------------------
-- 3. VERIFICACIÓN - debe devolver 0 en todas las filas
-- ----------------------------------------------------------------------------

SELECT 'immunization_stock_layers' AS tabla, COUNT(*) AS pendientes
FROM immunization_stock_layers l
JOIN facilities f ON f.code = l.facility_code
WHERE l.owner_type = 'IPRESS' AND l.unget_id IS NULL AND f.unget_id IS NOT NULL
UNION ALL
SELECT 'immunization_stock_movements', COUNT(*)
FROM immunization_stock_movements m
JOIN facilities f ON f.code = m.facility_code
WHERE m.owner_type = 'IPRESS' AND m.unget_id IS NULL AND f.unget_id IS NOT NULL
UNION ALL
SELECT 'immunization_initial_inventories', COUNT(*)
FROM immunization_initial_inventories i
JOIN facilities f ON f.code = i.facility_code
WHERE i.owner_type = 'IPRESS' AND i.unget_id IS NULL AND f.unget_id IS NOT NULL
UNION ALL
SELECT 'immunization_adjustments', COUNT(*)
FROM immunization_adjustments a
JOIN facilities f ON f.code = a.facility_code
WHERE a.owner_type = 'IPRESS' AND a.unget_id IS NULL AND f.unget_id IS NOT NULL;
