-- ============================================================================
--  SEGURIDAD, PASO 3 - Que cada usuario vea solo lo suyo
-- ============================================================================
--
--  QUÉ RESUELVE
--
--  Hoy la base comprueba que tengas sesión, pero no quién eres. Un usuario de una
--  IPRESS con sesión válida podría, saliéndose de la aplicación, pedirle a la base
--  el stock de otra IPRESS y obtenerlo.
--
--  Este script hace que la base aplique el mismo alcance que ya aplica la pantalla:
--
--    ADMIN, DIRESA y OGESS  ->  toda la región
--    UNGET                  ->  su almacén y las IPRESS de su UNGET
--    IPRESS                 ->  solo su establecimiento
--
--  El catálogo de productos y los orígenes de ingreso quedan visibles para
--  cualquiera con sesión, porque son listas de referencia compartidas.
--
--  CÓMO EJECUTARLO - POR PARTES
--
--    1. Ejecuta el BLOQUE 1 y el BLOQUE 2.
--    2. Entra a la aplicación y revisa Stock Biológico. Si ves tus datos, sigue.
--    3. Ejecuta el BLOQUE 3.
--    4. Recorre el resto de módulos.
--
--  No hace falta desplegar nada: la aplicación ya envía el token de sesión.
--
--  REVERSIÓN al final del archivo.
-- ============================================================================


-- ----------------------------------------------------------------------------
--  BLOQUE 1 - Quién soy y qué me corresponde
-- ----------------------------------------------------------------------------

-- Devuelve el ámbito del usuario dueño del token de la petición.
CREATE OR REPLACE FUNCTION public.app_session_identity()
RETURNS TABLE (rol text, facility_code text, unget_id text, es_supervisor boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  SELECT
    upper(COALESCE(u.role, '')),
    p.facility_code,
    p.unget_id::text,
    -- Supervisores: ven toda la región, igual que en la aplicación.
    upper(COALESCE(u.role, '')) = 'ADMIN'
      OR upper(COALESCE(u.role, '')) LIKE '%GLOBAL%'
      OR upper(COALESCE(u.role, '')) LIKE '%ADMINISTRADOR%'
      OR (p.facility_code IS NULL AND p.unget_id IS NULL
          AND (p.ogess_id IS NOT NULL OR p.diresa_id IS NOT NULL
               OR upper(COALESCE(u.role, '')) LIKE '%DIRESA%'
               OR upper(COALESCE(u.role, '')) LIKE '%OGESS%'))
  FROM public.app_sessions s
  JOIN public.users u ON u.username = s.username
  LEFT JOIN public.personnel p ON p.id = u.personnel_id
  WHERE s.expires_at > now()
    AND u.is_active
    AND s.token::text = COALESCE(
          NULLIF(current_setting('request.headers', true), '')::json ->> 'x-session-token',
          '')
  LIMIT 1;
$fn$;

REVOKE ALL ON FUNCTION public.app_session_identity() FROM PUBLIC;


-- Decide si una fila pertenece al ámbito de quien pregunta.
CREATE OR REPLACE FUNCTION public.app_can_access(p_unget_id text, p_facility_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  SELECT EXISTS (
    SELECT 1
    FROM public.app_session_identity() yo
    WHERE
      yo.es_supervisor
      -- IPRESS: solo su propio establecimiento.
      OR (yo.facility_code IS NOT NULL AND p_facility_code = yo.facility_code)
      -- UNGET: su almacén y las IPRESS que le pertenecen.
      OR (yo.facility_code IS NULL AND yo.unget_id IS NOT NULL AND (
            p_unget_id = yo.unget_id
            OR EXISTS (
              SELECT 1 FROM public.facilities f
              WHERE f.code = p_facility_code AND f.unget_id::text = yo.unget_id
            )
          ))
  );
$fn$;

REVOKE ALL ON FUNCTION public.app_can_access(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_can_access(text, text) TO anon, authenticated;


-- ----------------------------------------------------------------------------
--  BLOQUE 2 - Una tabla de prueba: stock biológico
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS app_sesion_valida ON public.immunization_stock_layers;
DROP POLICY IF EXISTS app_ambito ON public.immunization_stock_layers;

CREATE POLICY app_ambito ON public.immunization_stock_layers
  FOR ALL TO anon, authenticated
  USING (public.app_can_access(unget_id::text, facility_code))
  WITH CHECK (public.app_can_access(unget_id::text, facility_code));

-- >>> DETENTE AQUÍ. Entra a Stock Biológico y comprueba que ves tus datos. <<<


-- ----------------------------------------------------------------------------
--  BLOQUE 3 - El resto de las tablas
-- ----------------------------------------------------------------------------

-- 3.1 Tablas con propietario directo.
DO $b1$
DECLARE v_tabla text;
BEGIN
  FOREACH v_tabla IN ARRAY ARRAY[
    'immunization_stock_movements',
    'immunization_initial_inventories',
    'immunization_adjustments',
    'immunization_monthly_closures'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS app_sesion_valida ON public.%I', v_tabla);
    EXECUTE format('DROP POLICY IF EXISTS app_ambito ON public.%I', v_tabla);
    EXECUTE format(
      'CREATE POLICY app_ambito ON public.%I FOR ALL TO anon, authenticated '
      'USING (public.app_can_access(unget_id::text, facility_code)) '
      'WITH CHECK (public.app_can_access(unget_id::text, facility_code))',
      v_tabla);
  END LOOP;
END
$b1$;


-- 3.2 Envíos entre ámbitos: visibles para el origen y para el destino.
DROP POLICY IF EXISTS app_sesion_valida ON public.immunization_distribution_batches;
DROP POLICY IF EXISTS app_ambito ON public.immunization_distribution_batches;

CREATE POLICY app_ambito ON public.immunization_distribution_batches
  FOR ALL TO anon, authenticated
  USING (
    public.app_can_access(unget_id::text, destination_facility_code)
    OR public.app_can_access(origin_unget_id::text, NULL)
    OR public.app_can_access(destination_unget_id::text, NULL)
  )
  WITH CHECK (
    public.app_can_access(unget_id::text, destination_facility_code)
    OR public.app_can_access(origin_unget_id::text, NULL)
    OR public.app_can_access(destination_unget_id::text, NULL)
  );

DROP POLICY IF EXISTS app_sesion_valida ON public.immunization_return_batches;
DROP POLICY IF EXISTS app_ambito ON public.immunization_return_batches;

CREATE POLICY app_ambito ON public.immunization_return_batches
  FOR ALL TO anon, authenticated
  USING (public.app_can_access(origin_unget_id::text, origin_facility_code))
  WITH CHECK (public.app_can_access(origin_unget_id::text, origin_facility_code));

DROP POLICY IF EXISTS app_sesion_valida ON public.immunization_income_batches;
DROP POLICY IF EXISTS app_ambito ON public.immunization_income_batches;

CREATE POLICY app_ambito ON public.immunization_income_batches
  FOR ALL TO anon, authenticated
  USING (public.app_can_access(unget_id::text, NULL))
  WITH CHECK (public.app_can_access(unget_id::text, NULL));


-- 3.3 Tablas de detalle: heredan el alcance de su cabecera.
--
--     La subconsulta solo encuentra la cabecera si la política de esa cabecera deja
--     verla, así que el detalle queda restringido automáticamente.

DROP POLICY IF EXISTS app_sesion_valida ON public.immunization_initial_inventory_items;
DROP POLICY IF EXISTS app_ambito ON public.immunization_initial_inventory_items;
CREATE POLICY app_ambito ON public.immunization_initial_inventory_items
  FOR ALL TO anon, authenticated
  USING      (EXISTS (SELECT 1 FROM public.immunization_initial_inventories c WHERE c.id = inventory_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.immunization_initial_inventories c WHERE c.id = inventory_id));

DROP POLICY IF EXISTS app_sesion_valida ON public.immunization_adjustment_items;
DROP POLICY IF EXISTS app_ambito ON public.immunization_adjustment_items;
CREATE POLICY app_ambito ON public.immunization_adjustment_items
  FOR ALL TO anon, authenticated
  USING      (EXISTS (SELECT 1 FROM public.immunization_adjustments c WHERE c.id = adjustment_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.immunization_adjustments c WHERE c.id = adjustment_id));

DROP POLICY IF EXISTS app_sesion_valida ON public.immunization_income_items;
DROP POLICY IF EXISTS app_ambito ON public.immunization_income_items;
CREATE POLICY app_ambito ON public.immunization_income_items
  FOR ALL TO anon, authenticated
  USING      (EXISTS (SELECT 1 FROM public.immunization_income_batches c WHERE c.id = income_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.immunization_income_batches c WHERE c.id = income_id));

DROP POLICY IF EXISTS app_sesion_valida ON public.immunization_distribution_items;
DROP POLICY IF EXISTS app_ambito ON public.immunization_distribution_items;
CREATE POLICY app_ambito ON public.immunization_distribution_items
  FOR ALL TO anon, authenticated
  USING      (EXISTS (SELECT 1 FROM public.immunization_distribution_batches c WHERE c.id = distribution_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.immunization_distribution_batches c WHERE c.id = distribution_id));

DROP POLICY IF EXISTS app_sesion_valida ON public.immunization_return_items;
DROP POLICY IF EXISTS app_ambito ON public.immunization_return_items;
CREATE POLICY app_ambito ON public.immunization_return_items
  FOR ALL TO anon, authenticated
  USING      (EXISTS (SELECT 1 FROM public.immunization_return_batches c WHERE c.id = return_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.immunization_return_batches c WHERE c.id = return_id));


-- 3.4 Listas de referencia: cualquiera con sesión puede consultarlas.
--     Se mantienen con la política del paso 2.


-- ----------------------------------------------------------------------------
--  BLOQUE 4 - Comprobación
-- ----------------------------------------------------------------------------

SELECT tablename AS tabla, policyname AS politica
FROM pg_policies
WHERE schemaname = 'public' AND tablename LIKE 'immunization_%'
ORDER BY tablename;


-- ----------------------------------------------------------------------------
--  REVERSIÓN - vuelve a "basta con tener sesión"
-- ----------------------------------------------------------------------------
--
--  DO $rev$
--  DECLARE v_tabla text;
--  BEGIN
--    FOREACH v_tabla IN ARRAY ARRAY[
--      'immunization_products','immunization_initial_inventories',
--      'immunization_initial_inventory_items','immunization_stock_layers',
--      'immunization_stock_movements','immunization_adjustments',
--      'immunization_adjustment_items','immunization_income_origins',
--      'immunization_income_batches','immunization_income_items',
--      'immunization_distribution_batches','immunization_distribution_items',
--      'immunization_return_batches','immunization_return_items',
--      'immunization_monthly_closures'
--    ] LOOP
--      EXECUTE format('DROP POLICY IF EXISTS app_ambito ON public.%I', v_tabla);
--      EXECUTE format('DROP POLICY IF EXISTS app_sesion_valida ON public.%I', v_tabla);
--      EXECUTE format(
--        'CREATE POLICY app_sesion_valida ON public.%I FOR ALL TO anon, authenticated '
--        'USING (public.app_request_has_session()) '
--        'WITH CHECK (public.app_request_has_session())', v_tabla);
--    END LOOP;
--  END
--  $rev$;
